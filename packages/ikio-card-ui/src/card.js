import { bindHaptics } from "./interactions.js";
import { t, language } from "./i18n.js";
import { installCardActions, cancelCustomActions } from "./actions.js";
import { styles } from "./styles.js";
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function details(target, entity) {
  if (entity)
    target.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: entity },
        bubbles: true,
        composed: true,
      }),
    );
}
export function available(state) {
  return !!state && !["unknown", "unavailable"].includes(state.state);
}
export function entityName(hass, state, override) {
  return (
    override ||
    (state && hass?.formatEntityName?.(state)) ||
    state?.attributes?.friendly_name ||
    state?.entity_id ||
    ""
  );
}
export class IkioCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(element("style", styles));
    this.shell = element("ha-card");
    this.actionHaptic = bindHaptics(this.shell, () => !this.preview);
    this.content = element("div");
    this.error = element("p", "", "error");
    this.error.setAttribute("role", "status");
    this.shell.append(this.content, this.error);
    this.shadowRoot.append(this.shell);
    this.pending = new Map();
    this.generation = 0;
    installCardActions(this);
  }
  set hass(value) {
    const previous = this._hass;
    const changedLanguage = this._language !== language(value);
    this._language = language(value);
    this.setAttribute("lang", this._language);
    this._hass = value;
    this.reconcile();
    if (
      this.entityIds?.some(
        (id) => previous?.states?.[id] !== value?.states?.[id],
      ) ||
      previous?.locale !== value?.locale ||
      (this.config?.appearance?.theme === "ha" &&
        previous?.themes?.darkMode !== value?.themes?.darkMode) ||
      previous?.entities !== value?.entities ||
      previous?.devices !== value?.devices ||
      previous?.areas !== value?.areas ||
      !previous ||
      changedLanguage
    )
      if (this.visible === false && this.observer) this.renderDirty = true;
      else this.update?.();
  }
  set preview(value) {
    this._preview = Boolean(value);
    this.update?.();
  }
  get preview() {
    return this._preview || false;
  }
  get hass() {
    return this._hass;
  }
  connectedCallback() {
    this.update?.();
  }
  disconnectedCallback() {
    this.cancelActions();
  }
  cancelActions() {
    this.generation++;
    cancelCustomActions(this);
    for (const action of this.pending.values()) clearTimeout(action.timer);
    this.pending.clear();
    this.error.textContent = "";
  }
  reconcile() {
    for (const [id, action] of this.pending)
      if (action.confirm(this.hass?.states?.[id])) {
        clearTimeout(action.timer);
        this.pending.delete(id);
      }
  }
  async act(id, domain, service, data, confirm, allowUnknown = false) {
    if (
      this.preview ||
      this.pending.has(id) ||
      (!available(this.hass?.states?.[id]) &&
        !(
          allowUnknown &&
          ["button", "input_button"].includes(domain) &&
          service === "press" &&
          this.hass?.states?.[id]?.state === "unknown"
        ))
    )
      return;
    const generation = this.generation;
    this.error.textContent = "";
    const action = {
      confirm,
      timer: setTimeout(() => {
        if (generation !== this.generation || this.pending.get(id) !== action)
          return;
        this.pending.delete(id);
        this.error.textContent = t(
          this.hass,
          "No confirmation yet. Check the entity state before retrying.",
        );
        this.update?.();
      }, 10000),
    };
    this.pending.set(id, action);
    this.update?.();
    try {
      this.actionHaptic();
      await this.hass.callService(domain, service, { ...data, entity_id: id });
    } catch (error) {
      if (generation !== this.generation || this.pending.get(id) !== action)
        return;
      clearTimeout(action.timer);
      this.pending.delete(id);
      this.error.textContent =
        error.message || t(this.hass, "The action could not be completed.");
      this.update?.();
      return;
    }
    if (generation !== this.generation || this.pending.get(id) !== action)
      return;
    this.reconcile();
    this.update?.();
  }
  getCardSize() {
    return Math.max(1, Math.ceil((this.shell?.offsetHeight || 100) / 50));
  }
  getGridOptions() {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }
}
