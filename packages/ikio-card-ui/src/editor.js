import { t, language, stateLabel } from "./i18n.js";
let loading;
/** HA editor internals are isolated here. No runtime CDN or private Lit imports. */
export async function ensureEditorComponents() {
  if (customElements.get("ha-form")) return;
  if (!loading)
    loading = (async () => {
      if (!window.loadCardHelpers)
        throw new Error(
          "Home Assistant editor helpers are unavailable. Reload the dashboard editor.",
        );
      const helpers = await window.loadCardHelpers();
      const card = await helpers.createCardElement({
        type: "entities",
        entities: [],
      });
      await card.constructor.getConfigElement?.();
      if (!customElements.get("ha-form"))
        throw new Error(
          "Home Assistant form controls could not be loaded. Reload the dashboard editor.",
        );
    })().catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
export function form(hass, data, schema, labels, changed) {
  const node = document.createElement("ha-form");
  node.hass = hass;
  node.data = data;
  node.schema = schema.map((field) => {
    const options = field.selector?.select?.options;
    return options
      ? {
          ...field,
          selector: {
            ...field.selector,
            select: {
              ...field.selector.select,
              options: options.map((o) =>
                typeof o === "string"
                  ? o
                  : {
                      ...o,
                      label: language(hass).startsWith("en")
                        ? o.label
                        : t(hass, stateLabel(hass, o.label)),
                    },
              ),
            },
          },
        }
      : field;
  });
  node.computeLabel = (field) => t(node.hass, labels[field.name] || field.name);
  node.ikioChanged = changed;
  node.addEventListener("value-changed", (event) => {
    event.stopPropagation();
    node.data = event.detail.value;
    node.ikioChanged(node.data, node);
  });
  return node;
}
export function emitConfig(target, config) {
  target.dispatchEvent(
    new CustomEvent("config-changed", {
      detail: { config },
      bubbles: true,
      composed: true,
    }),
  );
}

/** HA echoes config-changed back into setConfig while the user is typing. */
export function sameConfig(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameConfig(a[key], b[key]))
  );
}
