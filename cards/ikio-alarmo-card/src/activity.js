import { el, button, details, event } from "@ikio/card-ui";

const BATCH = 20;
const INITIAL_WINDOW = 5 * 60000;
const MAX_WINDOW = 6 * 3600000;
const identity = (entry) =>
  JSON.stringify([
    entry.when,
    entry.entity_id,
    entry.state,
    entry.message,
    entry.context_id,
    entry.context_user_id,
    entry.domain,
    entry.source,
  ]);
const merge = (...groups) =>
  [...new Map(groups.flat().map((e) => [identity(e), e])).values()].sort(
    (a, b) => b.when - a.when,
  );

export class SensorActivity {
  constructor(card) {
    this.card = card;
    this.entries = [];
    this.pending = [];
    this.users = [];
  }
  stop() {
    this.stopLive();
    this.generation = (this.generation || 0) + 1;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.cancel?.();
    this.cancel = undefined;
    this.key = undefined;
    this.loading = false;
  }
  reset() {
    this.stop();
    this.cacheKey = undefined;
    this.entries = [];
    this.pending = [];
    this.users = [];
    this.usersLoaded = false;
    this.anchor = undefined;
  }
  sync() {
    const c = this.card;
    if (!c.config.show_activity || !c.visible || !c.isConnected) {
      this.stop();
      return;
    }
    const entities = [
      ...new Set(
        [c.config.entity, ...c.sensorRows().map((r) => r.entity)].filter(
          Boolean,
        ),
      ),
    ].sort();
    const key = JSON.stringify([entities, c.config.activity_hours || 24]);
    if (
      this.key === key &&
      this.connection === c.hass?.connection &&
      this.callWS === c.hass?.callWS
    )
      return;
    const reuse =
      this.cacheKey === key &&
      this.connection === c.hass?.connection &&
      this.callWS === c.hass?.callWS;
    this.stop();
    this.key = key;
    this.cacheKey = key;
    this.connection = c.hass?.connection;
    this.callWS = c.hass?.callWS;
    this.entities = entities;
    if (!reuse) {
      this.entries = [];
      this.pending = [];
      this.users = [];
      this.usersLoaded = false;
      this.liveEnd = Date.now();
      this.cursor = this.liveEnd;
      this.window = INITIAL_WINDOW;
      this.anchor = undefined;
    }
    this.error = undefined;
    if (!entities.length || !this.callWS) {
      this.error = "Activity unavailable";
      c.update();
      return;
    }
    this.startLive();
    this.run(reuse && this.entries.length ? "refresh" : "more");
  }
  closeLiveSubscription() {
    this.liveToken = (this.liveToken || 0) + 1;
    clearTimeout(this.liveTimeout);
    clearTimeout(this.liveFlushTimer);
    this.liveTimeout = undefined;
    this.liveFlushTimer = undefined;
    this.liveBuffer = [];
    const unsubscribe = this.unsubscribeLive;
    this.unsubscribeLive = undefined;
    if (unsubscribe)
      Promise.resolve()
        .then(unsubscribe)
        .catch(() => {});
  }
  stopLive() {
    this.closeLiveSubscription();
    this.liveConnection?.removeEventListener?.("ready", this.liveReady);
    this.liveConnection?.removeEventListener?.(
      "disconnected",
      this.liveDisconnected,
    );
    this.liveConnection = undefined;
    this.liveReady = undefined;
    this.liveDisconnected = undefined;
    this.liveState = "idle";
  }
  startLive() {
    const connection = this.connection;
    if (!connection?.subscribeMessage) {
      this.liveState = "fallback";
      return;
    }
    this.liveConnection = connection;
    this.liveReady = () => {
      if (this.key && this.card.visible && this.card.isConnected)
        this.subscribeLive();
    };
    this.liveDisconnected = () => {
      this.closeLiveSubscription();
      this.liveState = "reconnecting";
    };
    connection.addEventListener?.("ready", this.liveReady);
    connection.addEventListener?.("disconnected", this.liveDisconnected);
    this.subscribeLive();
  }
  subscribeLive() {
    this.closeLiveSubscription();
    this.liveState = "connecting";
    const token = this.liveToken,
      generation = this.generation;
    const connection = this.liveConnection;
    const valid = () =>
      this.liveToken === token &&
      this.generation === generation &&
      this.key &&
      this.card.visible &&
      this.card.isConnected;
    const failed = () => {
      if (!valid()) return;
      this.closeLiveSubscription();
      this.liveState = "fallback";
      this.scheduleRefresh();
    };
    this.liveTimeout = setTimeout(failed, 10000);
    Promise.resolve()
      .then(() => {
        if (!valid()) return;
        return connection.subscribeMessage(
          (message) => {
            if (!valid() || !Array.isArray(message?.events)) return;
            const entries = message.events.filter(
              (entry) =>
                entry &&
                this.entities.includes(entry.entity_id) &&
                Number.isFinite(entry.when) &&
                entry.when * 1000 >= this.floor(),
            );
            if (!entries.length) return;
            this.liveBuffer = merge(this.liveBuffer || [], entries);
            this.liveFlushTimer ??= setTimeout(() => this.flushLive(), 100);
          },
          {
            type: "logbook/event_stream",
            start_time: new Date(
              Math.max(this.floor(), this.liveEnd - 2000),
            ).toISOString(),
            entity_ids: this.entities,
          },
          { resubscribe: false },
        );
      })
      .then((unsubscribe) => {
        if (!valid()) {
          if (unsubscribe)
            Promise.resolve()
              .then(unsubscribe)
              .catch(() => {});
          return;
        }
        if (typeof unsubscribe !== "function") {
          failed();
          return;
        }
        clearTimeout(this.liveTimeout);
        this.liveTimeout = undefined;
        this.unsubscribeLive = unsubscribe;
        this.liveState = "active";
        this.scheduleRefresh();
      })
      .catch(failed);
  }
  flushLive() {
    clearTimeout(this.liveFlushTimer);
    this.liveFlushTimer = undefined;
    if (!this.key || !this.card.visible || !this.card.isConnected) {
      this.liveBuffer = [];
      return;
    }
    const recent = this.liveBuffer || [];
    this.liveBuffer = [];
    if (!recent.length) return;
    const floor = this.floor();
    this.liveEnd = recent.reduce(
      (end, entry) => Math.max(end, entry.when * 1000),
      this.liveEnd,
    );
    const known = new Set(this.entries.map(identity));
    const added = recent.filter((entry) => !known.has(identity(entry)));
    if (
      !added.length &&
      this.entries.every((entry) => entry.when * 1000 >= floor)
    )
      return;
    this.rememberScroll();
    this.entries = merge(added, this.entries).filter(
      (entry) => entry.when * 1000 >= floor,
    );
    const displayed = new Set(this.entries.map(identity));
    this.pending = this.pending.filter(
      (entry) => !displayed.has(identity(entry)) && entry.when * 1000 >= floor,
    );
    this.card.update();
  }
  scheduleRefresh(mode = "refresh") {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.key || !this.card.visible || !this.card.isConnected) return;
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation === this.generation) this.tick(mode);
    }, 60000);
  }
  async tick(mode = "refresh") {
    if (!this.key || !this.card.visible || !this.card.isConnected) return;
    if (
      this.liveState === "active" ||
      this.liveState === "connecting" ||
      this.liveState === "reconnecting"
    ) {
      // Maintain the rolling history window without querying HA every minute.
      const before = this.entries.length;
      const floor = this.floor();
      const current = this.entries.filter(
        (entry) => entry.when * 1000 >= floor,
      );
      this.pending = this.pending.filter((entry) => entry.when * 1000 >= floor);
      if (current.length !== before) {
        this.rememberScroll();
        this.entries = current;
        this.card.update();
      }
      this.scheduleRefresh(mode);
      return;
    }
    if (this.liveConnection?.subscribeMessage) this.subscribeLive();
    if (!this.loading) await this.run(mode);
    else this.scheduleRefresh(mode);
  }
  floor() {
    return Date.now() - (this.card.config.activity_hours || 24) * 3600000;
  }
  hasMore() {
    return this.pending.length > 0 || this.cursor > this.floor();
  }
  rememberScroll() {
    const viewport = this.card.content.querySelector(
      ".security-activity-scroll",
    );
    if (!viewport || viewport.scrollTop <= 1) return;
    const top = viewport.getBoundingClientRect().top;
    const first = [...viewport.querySelectorAll(".security-activity-row")].find(
      (n) => n.getBoundingClientRect().bottom > top,
    );
    this.anchor = {
      key: first?.dataset.key,
      offset: first ? first.getBoundingClientRect().top - top : 0,
      scrollTop: viewport.scrollTop,
    };
  }
  afterRender() {
    if (!this.anchor) return;
    const viewport = this.card.content.querySelector(
      ".security-activity-scroll",
    );
    if (!viewport) return;
    const first = [...viewport.querySelectorAll(".security-activity-row")].find(
      (n) => n.dataset.key === this.anchor.key,
    );
    viewport.scrollTop = first
      ? viewport.scrollTop +
        first.getBoundingClientRect().top -
        viewport.getBoundingClientRect().top -
        this.anchor.offset
      : this.anchor.scrollTop;
    this.anchor = undefined;
  }
  onScroll(viewport) {
    if (
      viewport.clientHeight > 0 &&
      viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 96 &&
      !this.loading &&
      this.hasMore()
    )
      this.run("more");
  }
  async run(mode) {
    if (
      this.loading ||
      !this.key ||
      !this.card.visible ||
      !this.card.isConnected
    )
      return;
    if (mode === "more" && !this.hasMore()) return;
    const c = this.card,
      generation = this.generation;
    const operation = (this.operation = (this.operation || 0) + 1);
    const valid = () =>
      this.generation === generation &&
      this.operation === operation &&
      !!this.key;
    this.loading = true;
    this.mode = mode;
    this.error = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
    c.update();
    let timeout;
    const cancelled = new Promise((resolve, reject) => {
      this.cancel = () => resolve(null);
      timeout = setTimeout(
        () => reject(Error("Activity request timed out")),
        10000,
      );
    });
    const query = async (start, end) => {
      const response = await c.hass.callWS({
        type: "logbook/get_events",
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        entity_ids: this.entities,
      });
      if (!valid()) throw Error("Cancelled");
      if (!Array.isArray(response)) throw Error("Invalid activity response");
      return response.filter(
        (e) =>
          e &&
          this.entities.includes(e.entity_id) &&
          Number.isFinite(e.when) &&
          e.when * 1000 >= start &&
          e.when * 1000 <= end,
      );
    };
    const load = async () => {
      if (c.hass.user?.is_admin && !this.usersLoaded) {
        const users = await c.hass
          .callWS({ type: "config/auth/list" })
          .catch(() => []);
        if (!valid()) return;
        this.users = Array.isArray(users)
          ? users.map(({ id, name }) => ({ id, name }))
          : [];
        this.usersLoaded = true;
      }
      if (mode === "refresh") {
        const end = Date.now(),
          floor = this.floor();
        const recent = await query(Math.max(this.liveEnd, floor), end);
        if (!valid()) return;
        this.rememberScroll();
        this.entries = merge(recent, this.entries).filter(
          (e) => e.when * 1000 >= floor,
        );
        this.pending = this.pending.filter((e) => e.when * 1000 >= floor);
        this.liveEnd = end;
      } else {
        while (this.pending.length < BATCH && this.cursor > this.floor()) {
          const end = this.cursor,
            start = Math.max(this.floor(), end - this.window);
          const older = await query(start, end);
          if (!valid()) return;
          const loaded = new Set(this.entries.map(identity));
          this.pending = merge(this.pending, older).filter(
            (e) => !loaded.has(identity(e)),
          );
          this.cursor = start;
          this.window =
            older.length < BATCH
              ? Math.min(this.window * 2, MAX_WINDOW)
              : INITIAL_WINDOW;
        }
        if (!valid()) return;
        this.rememberScroll();
        this.entries = merge(this.entries, this.pending.splice(0, BATCH));
      }
    };
    try {
      await Promise.race([load(), cancelled]);
    } catch {
      if (valid())
        this.error =
          "Activity unavailable. Check Recorder/Activity access; retrying automatically.";
    } finally {
      clearTimeout(timeout);
      if (valid()) {
        this.operation++;
        this.cancel = undefined;
        this.loading = false;
        c.update();
        this.scheduleRefresh(this.error ? mode : "refresh");
      }
    }
  }
  actor(userId) {
    if (!userId) return;
    const c = this.card;
    const person = Object.values(c.hass?.states || {}).find(
      (s) =>
        s.entity_id?.startsWith("person.") && s.attributes?.user_id === userId,
    );
    const user =
      this.users.find((u) => u.id === userId) ||
      (c.hass?.user?.id === userId ? c.hass.user : undefined);
    return {
      name: user?.name || person?.attributes?.friendly_name || "Unknown user",
      picture: person?.attributes?.entity_picture,
    };
  }
  view() {
    const c = this.card;
    const section = el("section", undefined, "security-activity");
    section.setAttribute("aria-label", "Activity");
    const header = el("header");
    header.append(
      el("h3", "Activity"),
      el("span", `Last ${c.config.activity_hours || 24} hours`),
    );
    section.append(header);
    if (this.error) section.append(el("p", this.error, "ae-note"));
    if (!this.entries.length) {
      if (!this.error)
        section.append(
          el(
            "p",
            this.loading || !this.key
              ? "Loading activity…"
              : "No recorded activity in this period.",
            "ae-note",
          ),
        );
      return section;
    }
    const viewport = el(
      "div",
      undefined,
      "security-activity-scroll",
      "activity-scroll",
    );
    viewport.setAttribute("role", "region");
    viewport.tabIndex = 0;
    viewport.setAttribute(
      "aria-label",
      "Sensor activity; scroll for older events",
    );
    event(viewport, "scroll", (e) => this.onScroll(e.currentTarget));
    section.append(viewport);
    const locale = c.hass?.locale?.language || c.hass?.language || "en";
    const options = { timeZone: c.hass?.config?.time_zone };
    const dateFormat = new Intl.DateTimeFormat(locale, {
      ...options,
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const timeFormat = new Intl.DateTimeFormat(locale, {
      ...options,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    let day;
    for (const entry of this.entries) {
      const date = new Date(entry.when * 1000);
      const dateLabel = dateFormat.format(date);
      if (dateLabel !== day) {
        viewport.append(
          el("h4", dateLabel, undefined, `activity-date-${dateLabel}`),
        );
        day = dateLabel;
      }
      const state = c.state(entry.entity_id);
      const historic = {
        ...state,
        entity_id: entry.entity_id,
        state: entry.state,
        attributes: { ...state?.attributes },
      };
      const name = c.sensorRows().find((r) => r.entity === entry.entity_id);
      const label = name
        ? c.sensorLabel(name)
        : state?.attributes?.friendly_name || entry.name || entry.entity_id;
      const row = button("", () => details(c, entry.entity_id), {
        entity: entry.entity_id,
        key: `activity-${entry.when}-${entry.entity_id}-${entry.context_id || ""}`,
      });
      row.classList.add("security-activity-row");
      const glyph = el("ha-state-icon");
      glyph.dataset.activityEntity = entry.entity_id;
      glyph.dataset.activityState = entry.state || "";
      if (entry.icon) {
        historic.attributes.icon = entry.icon;
        glyph.dataset.activityIcon = entry.icon;
      }
      glyph.hass = c.hass;
      glyph.stateObj = historic;
      glyph.setAttribute("aria-hidden", "true");
      const content = el("span", undefined, "security-activity-content");
      content.append(el("span", label, "security-activity-name"));
      const registry = c.hass?.entities?.[entry.entity_id];
      const areaId =
        registry?.area_id || c.hass?.devices?.[registry?.device_id]?.area_id;
      const meta = el("span", undefined, "security-activity-meta");
      const area = c.hass?.areas?.[areaId]?.name;
      if (area) meta.append(el("span", area));
      const actor = this.actor(entry.context_user_id);
      if (actor) {
        const person = el("span", undefined, "security-activity-actor");
        const fallback = el("ha-icon");
        fallback.setAttribute("icon", "mdi:account-circle");
        if (actor.picture && /^(\/[^/]|https?:\/\/)/.test(actor.picture)) {
          const img = el("img");
          img.src = actor.picture;
          img.alt = "";
          event(img, "error", () => img.replaceWith(fallback));
          person.append(img);
        } else person.append(fallback);
        person.append(el("span", actor.name));
        meta.append(person);
      }
      content.append(meta);
      const end = el("span", undefined, "security-activity-end");
      const fallbackState = {
        armed_away: "Armed away",
        armed_home: "Armed home",
        armed_night: "Armed night",
        armed_vacation: "Armed vacation",
        armed_custom_bypass: "Armed custom bypass",
        disarmed: "Disarmed",
        arming: "Arming",
        pending: "Entry delay",
        triggered: "Triggered",
        unavailable: "Unavailable",
        unknown: "Unknown",
      };
      const motion =
        ["motion", "occupancy", "presence"].includes(
          historic.attributes.device_class,
        ) || name?.kind === "motion";
      const description =
        entry.state !== undefined
          ? c.hass?.formatEntityState?.(historic) ||
            fallbackState[entry.state] ||
            (entry.state === "on"
              ? motion
                ? "Detected"
                : "Open"
              : entry.state === "off"
                ? motion
                  ? "Clear"
                  : "Closed"
                : entry.state)
          : entry.message || "Activity";
      const status = el("span", description);
      if (entry.state === "triggered") row.classList.add("activity-triggered");
      else if (
        entry.state === "on" ||
        ["arming", "pending"].includes(entry.state)
      )
        row.classList.add("activity-active");
      else if (entry.state?.startsWith("armed_"))
        row.classList.add("activity-armed");
      const time = el("time", timeFormat.format(date));
      time.dateTime = date.toISOString();
      end.append(status, time);
      row.replaceChildren(glyph, content, end);
      row.setAttribute(
        "aria-label",
        `${label}: ${description}, ${dateLabel} ${time.textContent}${actor ? `, ${actor.name}` : ""}`,
      );
      viewport.append(row);
    }
    const footer = el(
      "p",
      this.loading
        ? this.mode === "refresh"
          ? "Updating activity…"
          : "Loading older activity…"
        : this.hasMore()
          ? "Scroll for older activity"
          : "End of activity",
      "ae-note",
      "activity-footer",
    );
    footer.setAttribute("role", "status");
    viewport.append(footer);
    return section;
  }
}
