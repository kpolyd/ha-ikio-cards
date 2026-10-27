import { el, button, details, event } from "@ikio/card-ui";

const LIMIT = 200;
export class SensorActivity {
  constructor(card) {
    this.card = card;
    this.entries = [];
    this.users = [];
  }
  stop() {
    this.generation = (this.generation || 0) + 1;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.cancel?.();
    this.cancel = undefined;
    this.key = undefined;
    this.loading = false;
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
    this.stop();
    this.key = key;
    this.connection = c.hass?.connection;
    this.callWS = c.hass?.callWS;
    this.entries = [];
    this.users = [];
    this.usersLoaded = false;
    this.error = undefined;
    if (!entities.length || !this.callWS) {
      this.error = "Activity unavailable";
      c.update();
      return;
    }
    const generation = this.generation;
    this.load(entities, generation);
  }
  async load(entities, generation) {
    const c = this.card;
    if (generation !== this.generation) return;
    this.loading = true;
    c.update();
    const end = Date.now();
    const start = end - (c.config.activity_hours || 24) * 3600000;
    let timeout;
    const cancelled = new Promise((resolve, reject) => {
      this.cancel = () => resolve(null);
      timeout = setTimeout(
        () => reject(Error("Activity request timed out")),
        10000,
      );
    });
    try {
      const response = await Promise.race([
        Promise.all([
          c.hass.callWS({
            type: "logbook/get_events",
            start_time: new Date(start).toISOString(),
            end_time: new Date(end).toISOString(),
            entity_ids: entities,
          }),
          c.hass.user?.is_admin && !this.usersLoaded
            ? c.hass.callWS({ type: "config/auth/list" }).catch(() => [])
            : Promise.resolve(this.users),
        ]),
        cancelled,
      ]);
      if (!response || generation !== this.generation) return;
      const [entries, users] = response;
      if (!Array.isArray(entries)) throw Error("Invalid activity response");
      this.users = Array.isArray(users)
        ? users.map(({ id, name }) => ({ id, name }))
        : [];
      this.usersLoaded = true;
      this.entries = entries
        .filter(
          (e) =>
            entities.includes(e.entity_id) &&
            Number.isFinite(e.when) &&
            e.when * 1000 >= start &&
            e.when * 1000 <= end,
        )
        .sort((a, b) => b.when - a.when);
      this.truncated = this.entries.length > LIMIT;
      this.entries = this.entries.slice(0, LIMIT);
      this.error = undefined;
    } catch {
      if (generation === this.generation)
        this.error =
          "Activity unavailable. Check Recorder/Activity access; retrying automatically.";
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) {
        this.cancel = undefined;
        this.loading = false;
        c.update();
        this.timer = setTimeout(() => this.load(entities, generation), 60000);
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
        section.append(el("h4", dateLabel));
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
      section.append(row);
    }
    if (this.truncated)
      section.append(el("p", `Showing the latest ${LIMIT} events.`, "ae-note"));
    return section;
  }
}
