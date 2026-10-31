import {
  IkioCard,
  element as el,
  details,
  available,
  entityName,
  bindHold,
  stateText,
  valueText,
  t,
} from "@ikio/card-ui";
import { normalizeConfig } from "./config.js";
import { lightAppearance } from "../../ikio-lights-card/src/adapter.js";
export class Card extends IkioCard {
  constructor() {
    super();
    this.shadowRoot.append(
      el(
        "style",
        `
 :host{height:100%;min-height:48px}ha-card{padding:0;height:100%;min-height:48px;overflow:hidden}.content{height:100%}
 .entity{position:relative;display:flex;align-items:center;gap:7px;width:100%;height:100%;min-height:46px;padding:5px 27px 5px 9px;text-align:start;background:transparent;color:var(--ae-text)}
 .entity.on{background:var(--ae-active)}:host([appearance=ha]) .entity.on{background:color-mix(in srgb,var(--primary-color,#03a9f4) 10%,var(--ae-well))}
 :host([appearance=ha]) .entity.on ha-state-icon,:host([appearance=ha]) .entity.on ha-icon.indicator{color:var(--primary-color,#03a9f4)}
 ha-state-icon{--mdc-icon-size:19px;flex:0 0 19px}.labels{min-width:0;flex:1}.name{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.value{display:block;font-size:12px;font-variant-numeric:tabular-nums;margin-top:1px}.value[hidden],.indicator[hidden],.level[hidden]{display:none}
 .indicator{position:absolute;inset-inline-end:9px;top:50%;transform:translateY(-50%)}ha-icon.indicator{--mdc-icon-size:15px;color:var(--ae-muted)}.on ha-icon.indicator{color:var(--ae-temperature)}
 ha-icon.indicator[icon="mdi:power"]{--mdc-icon-size:18px}.entity:has(ha-icon.indicator[icon="mdi:power"]:not([hidden])){padding-inline-end:30px}
 .dot{width:7px;height:7px;box-sizing:border-box;border:1px solid var(--ae-muted);border-radius:50%}.on .dot{border:0;background:var(--lamp-colour,var(--ae-temperature));box-shadow:0 0 0 1px color-mix(in srgb,var(--ae-text) 20%,transparent)}.unavailable .dot{border-style:dashed}
 .level{position:absolute;bottom:0;inset-inline-start:0;height:2px;background:var(--ae-temperature);pointer-events:none}.unavailable{color:var(--ae-muted)}.entity[aria-busy=true]{outline:1px solid var(--ae-accent);outline-offset:-2px}.error{margin:0;padding:0 9px}.error:empty{padding:0}ha-card:has(.error:not(:empty)){height:auto}.content:has(+.error:not(:empty)){height:auto}.details{background:var(--ae-surface)}
 `,
      ),
    );
    this.content.className = "content";
    this.control = el("button", undefined, "entity");
    this.control.type = "button";
    this.icon = el("ha-state-icon");
    this.labels = el("span", undefined, "labels");
    this.name = el("span", undefined, "name");
    this.value = el("span", undefined, "value");
    this.labels.append(this.name, this.value);
    this.dot = el("span", undefined, "indicator dot");
    this.actionIcon = el("ha-icon", undefined, "indicator");
    this.level = el("span", undefined, "level");
    for (const n of [this.dot, this.actionIcon, this.level])
      n.setAttribute("aria-hidden", "true");
    this.control.append(
      this.icon,
      this.labels,
      this.dot,
      this.actionIcon,
      this.level,
    );
    this.control.onclick = () => this.activate();
    this.more = el("button", undefined, "sr details");
    this.more.type = "button";
    this.more.onclick = () => details(this, this.config?.entity);
    this.content.append(this.control, this.more);
  }
  static getStubConfig() {
    return { schema_version: 1, appearance: { theme: "dark" } };
  }
  static async getConfigElement() {
    await import("./editor.js");
    return document.createElement("ikio-entity-card-editor");
  }
  setConfig(c) {
    const next = normalizeConfig(c);
    this.cancelActions();
    this.config = next;
    this.entityIds = next.entity ? [next.entity] : [];
    this.setAttribute("appearance", next.appearance.theme);
    this.update();
  }
  connectedCallback() {
    if (!this.hold)
      this.hold = bindHold(this.control, () =>
        details(this, this.config?.entity),
      );
    super.connectedCallback();
  }
  disconnectedCallback() {
    this.hold?.destroy();
    this.hold = null;
    super.disconnectedCallback();
  }
  getCardSize() {
    return 1;
  }
  getGridOptions() {
    return { columns: 3, rows: 1, min_columns: 2, min_rows: 1 };
  }
  async activate() {
    const id = this.config?.entity,
      domain = id?.split(".")[0],
      s = this.hass?.states?.[id];
    if (["light", "switch", "input_boolean"].includes(domain)) {
      const target = s?.state === "on" ? "off" : "on";
      return this.act(
        id,
        domain,
        `turn_${target}`,
        {},
        (v) => v?.state === target,
      );
    }
    if (["button", "input_button"].includes(domain)) {
      const previous = s?.state;
      return this.act(
        id,
        domain,
        "press",
        {},
        (v) => available(v) && v.state !== previous,
        true,
      );
    }
    details(this, id);
  }
  update() {
    if (!this.config) return;
    const id = this.config.entity,
      s = this.hass?.states?.[id],
      domain = id?.split(".")[0];
    const isLight = domain === "light",
      toggle = ["light", "switch", "input_boolean"].includes(domain),
      press = ["button", "input_button"].includes(domain),
      on = toggle && s?.state === "on",
      ok = available(s) || (press && s?.state === "unknown"),
      pending = this.pending.has(id);
    this.name.textContent =
      entityName(this.hass, s, this.config.name) ||
      id ||
      t(this.hass, "Entity");
    this.icon.hass = this.hass;
    this.icon.stateObj = s;
    this.icon.icon = this.config.icon || undefined;
    this.value.hidden = ok && toggle;
    this.value.textContent = !id
      ? t(this.hass, "Not configured")
      : !ok
        ? stateText(this.hass, id)
        : press
          ? t(this.hass, "Press")
          : domain === "sensor"
            ? this.hass?.formatEntityState?.(s) || valueText(this.hass, id)
            : stateText(this.hass, id);
    this.control.classList.toggle("on", on);
    this.control.classList.toggle("unavailable", !ok);
    this.control.setAttribute("aria-busy", String(pending));
    if (toggle) this.control.setAttribute("aria-pressed", String(on));
    else this.control.removeAttribute("aria-pressed");
    this.control.disabled =
      !id || ((toggle || press) && (!ok || this.preview || pending));
    this.dot.hidden = !isLight || !on;
    this.actionIcon.hidden = !(
      press ||
      domain === "switch" ||
      domain === "input_boolean"
    );
    this.actionIcon.setAttribute("icon", press ? "mdi:play" : "mdi:power");
    const appearance = isLight
      ? lightAppearance(s, { entity: id })
      : { brightness: null, colour: null };
    if (appearance.colour)
      this.control.style.setProperty("--lamp-colour", appearance.colour);
    else this.control.style.removeProperty("--lamp-colour");
    this.level.hidden = appearance.brightness === null;
    this.level.style.width = `${appearance.brightness ?? 0}%`;
    this.more.textContent = t(this.hass, "Open entity details");
    this.more.hidden = !id;
    const label = `${this.name.textContent} · ${this.value.hidden ? stateText(this.hass, id) : this.value.textContent}`;
    this.control.title = label;
    this.control.setAttribute("aria-label", label);
  }
}
