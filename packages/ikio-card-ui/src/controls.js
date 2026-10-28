import { rateDisplay, rateFactor } from "./rate-display.js";
import { t, stateLabel, language, translateError } from "./i18n.js";
import { IkioCard, element, details, available, entityName } from "./card.js";
import { bindHold } from "./interactions.js";
export const features = (state, flag) =>
  ((state?.attributes?.supported_features || 0) & flag) !== 0;
export function numeric(state) {
  if (!available(state) || String(state.state).trim() === "") return null;
  const n = Number(state.state);
  return Number.isFinite(n) ? n : null;
}
const numberFormats = new Map();
export function formatNumber(hass, value, digits = 2, minimumDigits = 0) {
  const preference = hass?.locale?.number_format;
  const locale =
    preference === "system"
      ? undefined
      : {
          comma_decimal: "en-US",
          decimal_comma: "de",
          space_comma: "fr",
          quote_decimal: "de-CH",
          none: "en-US",
        }[preference] ||
        hass?.locale?.language ||
        hass?.language;
  const key = JSON.stringify([locale, preference, digits, minimumDigits]);
  if (!numberFormats.has(key)) {
    if (numberFormats.size >= 32)
      numberFormats.delete(numberFormats.keys().next().value);
    numberFormats.set(
      key,
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: digits,
        minimumFractionDigits: minimumDigits,
        useGrouping: preference !== "none",
      }),
    );
  }
  return Number.isFinite(value) ? numberFormats.get(key).format(value) : "—";
}
export function stateText(hass, id) {
  const s = hass?.states?.[id];
  return s
    ? hass.formatEntityState?.(s) ||
        (language(hass).startsWith("en") ? s.state : stateLabel(hass, s.state))
    : t(hass, "Entity not found");
}
export function valueText(hass, id) {
  const s = hass?.states?.[id];
  if (!s) return t(hass, id ? "Entity not found" : "Not configured");
  if (!available(s)) return stateText(hass, id);
  const n = numeric(s);
  if (n !== null && rateFactor(s.attributes?.unit_of_measurement) !== null)
    return rateDisplay(hass, { entity: id });
  return n === null
    ? stateText(hass, id)
    : `${formatNumber(hass, n)} ${s.attributes?.unit_of_measurement || ""}`.trim();
}
export function el(tag, text, cls, key) {
  const node = element(tag, text, cls);
  if (key) node.dataset.key = key;
  return node;
}
export function event(node, name, handler) {
  (node._handlers ||= {})[name] = handler;
  node["on" + name] = handler;
  return node;
}
export function button(
  label,
  handler,
  { icon, disabled = false, key = label, entity: entityId } = {},
) {
  const node = el("button", icon ? undefined : label, "ae-button", key);
  node.type = "button";
  if (entityId) node.dataset.entity = entityId;
  node.disabled = disabled;
  node.title = label;
  node.setAttribute("aria-label", label);
  if (icon) {
    node.classList.add("ae-icon");
    const glyph = el("ha-icon");
    glyph.setAttribute("icon", icon);
    node.append(glyph);
  }
  return event(node, "click", handler);
}
export function select(label, options, value, handler, key = label) {
  const wrap = el("label", undefined, "ae-select", key),
    sr = el("span", label, "sr"),
    node = el("select");
  node.setAttribute("aria-label", label);
  for (const option of options) {
    const opt = el("option", String(option));
    opt.value = String(option);
    node.append(opt);
  }
  node.value = String(value ?? "");
  event(node, "change", (e) => handler(e.currentTarget.value));
  wrap.append(sr, node);
  return wrap;
}
export function range(label, value, min, max, step, handler, key = label) {
  const wrap = el("label", undefined, "ae-range", key),
    caption = el("span", `${label}: ${value}`),
    node = el("input");
  node.type = "range";
  Object.assign(node, {
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
  });
  node.setAttribute("aria-label", label);
  event(node, "input", (e) => {
    e.currentTarget.previousElementSibling.textContent = `${label}: ${e.currentTarget.value}`;
  });
  event(node, "change", (e) => handler(Number(e.currentTarget.value)));
  wrap.append(caption, node);
  return wrap;
}
export function reading(label, value, id, cls = "") {
  const wrap = el(
    id ? "button" : "div",
    undefined,
    `ae-reading ${cls}`,
    id || label,
  );
  if (id) {
    wrap.type = "button";
    wrap.dataset.entity = id;
    event(wrap, "click", (e) => details(e.currentTarget, id));
  }
  wrap.append(el("span", label, "ae-label"), el("strong", value, "ae-value"));
  return wrap;
}
export function row(...children) {
  const node = el("div", undefined, "ae-row");
  node.append(...children.filter(Boolean));
  return node;
}
export function group(...children) {
  const node = el("div", undefined, "ae-group");
  node.append(...children.filter(Boolean));
  return node;
}
export function note(text, cls = "") {
  return el("p", text, `ae-note ${cls}`);
}
export function title(card, name, id, summary) {
  const node = el("header", undefined, undefined, "header");
  const label = id
    ? button(name, () => details(card, id), { key: "title" })
    : el("h2", name);
  if (id) {
    label.className = "ae-title";
    label.dataset.entity = id;
  }
  node.append(label);
  if (summary) node.append(el("span", summary, "summary"));
  return node;
}
export function unitValue(state, kind) {
  const value = numeric(state);
  if (value === null) return null;
  const unit = state?.attributes?.unit_of_measurement;
  const factors =
    kind === "power"
      ? { W: 1, kW: 1000, MW: 1000000 }
      : kind === "energy"
        ? { Wh: 0.001, kWh: 1, MWh: 1000 }
        : {
            B: 1,
            kB: 1000,
            MB: 1e6,
            GB: 1e9,
            TB: 1e12,
            KiB: 1024,
            MiB: 1048576,
            GiB: 1073741824,
            TiB: 1099511627776,
          };
  return unit in factors ? value * factors[unit] : null;
}
export function summaryState(states, active, secure) {
  if (!states.length) return "Not configured";
  if (states.some((s) => s && active.includes(s.state))) return "Open";
  if (states.some((s) => !available(s) || !secure.includes(s.state)))
    return "Unknown";
  return "Closed";
}
// Reconcile real nodes so focused controls, selection and native media survive hass updates.
function patch(old, next) {
  if (
    old.nodeType !== next.nodeType ||
    old.nodeName !== next.nodeName ||
    old.dataset?.key !== next.dataset?.key
  ) {
    old.replaceWith(next);
    return next;
  }
  if (old.nodeType === 3) {
    if (old.textContent !== next.textContent)
      old.textContent = next.textContent;
    return old;
  }
  for (const a of [...old.attributes])
    if (!next.hasAttribute(a.name)) old.removeAttribute(a.name);
  for (const a of next.attributes)
    if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
  for (const name of new Set([
    ...Object.keys(old._handlers || {}),
    ...Object.keys(next._handlers || {}),
  ]))
    old["on" + name] = next._handlers?.[name] || null;
  old._handlers = next._handlers;
  if ("disabled" in old) old.disabled = next.disabled;

  if ("checked" in old) old.checked = next.checked;
  if (
    old.nodeName !== "SELECT" &&
    "value" in old &&
    old.getRootNode().activeElement !== old
  )
    old.value = next.value;
  if (!next.hasAttribute("data-native"))
    patchChildren(old, [...next.childNodes]);
  if (old.nodeName === "SELECT" && old.getRootNode().activeElement !== old)
    old.value = next.value;
  return old;
}
export function patchChildren(parent, children) {
  for (let i = 0; i < children.length; i++) {
    const next = children[i],
      current = parent.childNodes[i];
    if (!current) {
      parent.append(next);
      continue;
    }
    if (next.dataset?.key && current.dataset?.key !== next.dataset.key) {
      const match = [...parent.children].find(
        (n) => n.dataset.key === next.dataset.key,
      );
      parent.insertBefore(match || next, current);
      if (!match) continue;
    }
    patch(parent.childNodes[i], next);
  }
  while (parent.childNodes.length > children.length) parent.lastChild.remove();
}
export const controlStyles = `.ae-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.ae-row>*{flex:1;min-width:0}.ae-group{display:grid;gap:4px}.ae-group>header{margin-bottom:0}.ae-row:empty{display:none}.ae-row>.ae-reading{flex:1 1 80px}.ae-button,.ae-select select{min-height:44px;min-width:44px;border:1px solid var(--ae-border);border-radius:9px;background:var(--ae-well);padding:6px 8px;color:var(--ae-text)}.ae-row>.ae-icon{flex:0 0 44px}.ae-button:disabled{opacity:.5}.ae-button[aria-pressed=true]{background:var(--ae-active)}.ae-button[aria-disabled=true]{opacity:.5;pointer-events:none}.ae-button[href]{display:flex;align-items:center;text-decoration:none}.ae-button ha-icon{--mdc-icon-size:20px}.ae-title{background:none;text-align:left;padding:0;min-height:44px;flex:1;font-weight:600;font-size:14px;overflow-wrap:anywhere}.ae-select{min-height:44px}.ae-row>.ae-select{flex:1 1 96px}.ae-select select{width:100%;font:inherit}.ae-range{display:grid;grid-template-columns:minmax(0,45%) minmax(0,1fr);align-items:center;column-gap:6px;min-width:0;font-size:12px;color:var(--ae-muted)}.ae-range input{height:44px;width:100%;margin:0;accent-color:var(--ae-accent)}.ae-reading{display:flex;flex-direction:column;justify-content:center;gap:2px;min-height:44px;text-align:left;border-radius:8px;padding:4px;background:transparent;color:var(--ae-text);font:inherit;overflow-wrap:anywhere}.ae-label{font-size:12px;color:var(--ae-muted)}.ae-value{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}.ae-hero .ae-value{font-size:24px}.ae-group>.ae-reading:not(.ae-hero){flex-direction:row;align-items:center;justify-content:space-between;gap:8px}.ae-reading:not(button){min-height:32px}.ae-reading[data-entity]{min-height:44px}.ae-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.ae-separator{border-top:1px solid var(--ae-border);margin-top:6px;padding-top:6px;grid-column:1/-1}.ae-note{margin:2px 0;font-size:12px;color:var(--ae-muted);overflow-wrap:anywhere}.ae-warn{color:var(--ae-warning,#f2c66d)}.ae-good{color:var(--ae-temperature,#a4e4b8)}.ae-graph{width:100%;height:84px;display:block}.ae-location-link{flex:0 0 auto;align-self:center;color:var(--ae-accent);font-size:12px;text-decoration:none;padding:6px 0}.ae-location-link:hover{text-decoration:underline}.ae-location-link:focus-visible{outline:2px solid var(--ae-accent);outline-offset:2px}.ae-location-link[aria-disabled=true]{color:var(--ae-muted);pointer-events:none}.ae-progress{width:100%;height:4px;accent-color:var(--ae-accent)}dialog{border:1px solid var(--ae-border);border-radius:12px;background:var(--ae-surface);color:var(--ae-text);max-width:min(440px,90vw)}dialog::backdrop{background:#0008}dialog input{min-height:44px;width:100%;font:inherit}details>summary{min-height:44px;cursor:pointer;display:flex;align-items:center}details{font-size:13px}@container(max-width:260px){.ae-grid{grid-template-columns:1fr}}`;
export class ControlCard extends IkioCard {
  constructor() {
    super();
    this.shadowRoot.prepend(el("style", controlStyles));
    this.holds = new Map();
    this.requests = new Set();
    this.visible = true;
  }
  setConfig(config) {
    try {
      this.validate?.(config);
    } catch (error) {
      throw new Error(translateError(this.hass, error.message));
    }
    this.cancelActions();
    this.shadowRoot.querySelector("dialog")?.remove();
    this.requests.clear();
    this.config = structuredClone(config);
    this.config.appearance = { theme: "dark", ...config.appearance };
    this.entityIds = collectEntities(config);
    this.setAttribute("appearance", this.config.appearance.theme);
    this.revision = (this.revision || 0) + 1;
    this.onConfig?.();
    this.update();
  }
  connectedCallback() {
    super.connectedCallback();
    this.visibility = () => {
      this.visible = !document.hidden && this.intersecting !== false;
      this.onVisibility?.();
      if (this.visible && this.renderDirty) {
        this.renderDirty = false;
        this.update();
      }
    };
    document.addEventListener("visibilitychange", this.visibility);
    if (globalThis.IntersectionObserver) {
      this.observer = new IntersectionObserver((entries) => {
        this.intersecting = entries[0].isIntersecting;
        this.visibility();
      });
      this.observer.observe(this);
    }
    this.visibility();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.shadowRoot.querySelector("dialog")?.remove();
    document.removeEventListener("visibilitychange", this.visibility);
    this.observer?.disconnect();
    for (const binding of this.holds.values()) binding.destroy();
    this.holds.clear();
    this.requests.clear();
    this.revision = (this.revision || 0) + 1;
    this.onDisconnect?.();
  }
  update() {
    if (!this.config) return;
    const nodes = this.render();
    patchChildren(this.content, Array.isArray(nodes) ? nodes : [nodes]);
    for (const [node, binding] of this.holds)
      if (!this.content.contains(node)) {
        binding.destroy();
        this.holds.delete(node);
      }
    for (const node of this.content.querySelectorAll("button")) {
      if (!node.dataset.entity) {
        const id = this.config.entity || this.config[this.active + "_entity"];
        if (id) node.dataset.entity = id;
      }
    }
    for (const node of this.content.querySelectorAll("[data-entity]"))
      if (!this.holds.has(node))
        this.holds.set(
          node,
          bindHold(node, () => details(this, node.dataset.entity)),
        );
    this.afterRender?.();
  }
  state(id = this.config?.entity) {
    return this.hass?.states?.[id];
  }
  label(id) {
    return (
      entityName(this.hass, this.state(id)) ||
      id ||
      t(this.hass, "Not configured")
    );
  }
  blocked(id) {
    return (
      this.preview ||
      !(
        available(this.state(id)) ||
        (/^(button|input_button|scene)\./.test(id) &&
          this.state(id)?.state === "unknown")
      ) ||
      this.pending.has(id) ||
      this.requests.has(id)
    );
  }
  async send(id, domain, service, data = {}, confirm) {
    if (this.blocked(id)) return;
    if (confirm) return this.act(id, domain, service, data, confirm);
    const generation = this.generation;
    this.requests.add(id);
    this.error.textContent = "";
    this.update();
    try {
      this.actionHaptic();
      await this.hass.callService(domain, service, { ...data, entity_id: id });
    } catch (e) {
      if (generation === this.generation)
        this.error.textContent = e.message || t(this.hass, "Action failed");
    } finally {
      if (generation === this.generation) {
        this.requests.delete(id);
        this.update();
      }
    }
  }
  toggle(id) {
    const target = this.state(id)?.state === "on" ? "off" : "on";
    return this.send(
      id,
      id.split(".")[0],
      `turn_${target}`,
      {},
      (s) => s?.state === target,
    );
  }
  action(entity, label, confirm = false) {
    if (!entity) return;
    const domain = entity.split(".")[0];
    if (confirm) {
      this.dialog(label, [note(t(this.hass, "Confirm this action?"))], () =>
        this.action(entity, label),
      );
      return;
    }
    return this.send(
      entity,
      domain,
      domain === "script"
        ? "turn_on"
        : domain === "scene"
          ? "turn_on"
          : "press",
    );
  }
  dialog(label, children, submit) {
    if (this.preview) return;
    this.shadowRoot.querySelector("dialog")?.remove();
    const dialog = el("dialog");
    dialog.append(el("h3", label), ...children);
    const actions = row(
      button(t(this.hass, "Cancel"), () => dialog.close()),
      ...(submit
        ? [
            button(t(this.hass, "Confirm"), async () => {
              try {
                await submit();
                dialog.close();
              } catch (e) {
                this.error.textContent = e.message;
              }
            }),
          ]
        : []),
    );
    dialog.append(actions);
    event(dialog, "close", () => dialog.remove());
    this.shadowRoot.append(dialog);
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute("open", "");
  }
}
export function collectEntities(value) {
  const out = new Set();
  function walk(v) {
    if (typeof v === "string" && /^[a-z_]+\.[\w]+$/.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  }
  walk(value);
  return [...out];
}
export function registerCard(tag, Card, name) {
  if (!customElements.get(tag)) customElements.define(tag, Card);
  window.customCards ||= [];
  if (!window.customCards.some((c) => c.type === tag))
    window.customCards.push({
      type: tag,
      name: `Ikio ${name}`,
      description: `Compact ${name.toLowerCase()} with visual configuration.`,
      preview: true,
      documentationURL: `https://github.com/kpolyd/ha-ikio-cards/tree/main/cards/${tag}`,
    });
}
