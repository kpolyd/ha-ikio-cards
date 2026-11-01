import { bindHold } from "./interactions.js";
import { t } from "./i18n.js";

export const actionTypes = [
  "more-info",
  "toggle",
  "perform-action",
  "navigate",
  "url",
  "none",
];
const entityId = /^[a-z_][a-z0-9_]*\.[\w]+$/;
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const custom = (value) => value?.action && value.action !== "default";
export function validateActions(config) {
  if (
    config?.action_entity !== undefined &&
    config.action_entity !== "" &&
    (typeof config.action_entity !== "string" ||
      !entityId.test(config.action_entity))
  )
    throw Error("Choose a valid action entity.");
  for (const key of ["tap_action", "hold_action"]) {
    const a = config?.[key];
    if (a == null) continue;
    if (
      !object(a) ||
      !["default", ...actionTypes, "call-service"].includes(a.action)
    )
      throw Error("Choose a supported card action.");
    if (a.entity !== undefined && !entityId.test(a.entity))
      throw Error("Choose a valid action entity.");
    if (
      ["perform-action", "call-service"].includes(a.action) &&
      !entityId.test(a.perform_action || a.service || "")
    )
      throw Error("Choose an action to perform.");
    if (
      (a.data !== undefined && !object(a.data)) ||
      (a.service_data !== undefined && !object(a.service_data)) ||
      (a.target !== undefined && !object(a.target))
    )
      throw Error("Action data and target must be objects.");
    if (
      a.action === "navigate" &&
      (typeof a.navigation_path !== "string" ||
        !a.navigation_path.startsWith("/") ||
        a.navigation_path.startsWith("//"))
    )
      throw Error("Choose a local navigation path.");
    if (a.action === "url") {
      let url;
      try {
        url = new URL(a.url_path);
      } catch {
        /* Report the same actionable error. */
      }
      if (!url || !["http:", "https:"].includes(url.protocol))
        throw Error("Choose an HTTP or HTTPS URL.");
    }
  }
}
function info(card, entity) {
  if (entity)
    card.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId: entity },
        bubbles: true,
        composed: true,
      }),
    );
}
export function mainActionArea(card) {
  if (card.localName === "ikio-entity-card") return card.control;
  if (["ikio-chip-card", "ikio-chip-badge"].includes(card.localName))
    return card.content.querySelector(".chip-only .ikio-sensor-chip");
  return card.content.querySelector(
    ".weather-name, .ae-energy-header, .ae-drive-header, header",
  );
}
function context(card, event) {
  const area = mainActionArea(card),
    path = event.composedPath();
  if (!area || !path.includes(area)) return null;
  const interactive = path.find((n) =>
    n.matches?.("button, a, input, select, textarea, summary, [role=button]"),
  );
  if (
    interactive &&
    interactive !== area &&
    !interactive.matches(
      ".ae-title, .security-emblem, .weather-name, [data-ikio-actions]",
    )
  )
    return null;
  const c = card.config || {};
  const entity =
    path.find((n) => n.dataset?.entity)?.dataset.entity ||
    c.entity ||
    c.climate_entity ||
    c.humidifier_entity ||
    c.vacuum_entity ||
    c.media_entity ||
    c.power_entity ||
    c.availability_entity ||
    c.entities?.[0]?.entity;
  return { area, entity };
}
function active(card) {
  return custom(card.config?.tap_action) || custom(card.config?.hold_action);
}
export function cancelCustomActions(card) {
  clearTimeout(card._customActionRequest?.timer);
  card._customActionRequest = null;
  card._customActionReview?.remove();
  card._customActionReview = null;
  card._cardActionHold?.reset({ suppressClick: true });
}
function confirmation(card, action, run) {
  if (
    !action.confirmation ||
    action.confirmation.exemptions?.some((e) => e.user === card.hass?.user?.id)
  )
    return run();
  card._customActionReview?.remove();
  const root = document.createElement("div");
  root.className = "ikio-action-review";
  root.setAttribute("role", "group");
  const message = document.createElement("p");
  message.textContent =
    action.confirmation.text || t(card.hass, "Confirm this action?");
  const generation = card.generation;
  const close = () => {
    root.remove();
    if (card._customActionReview === root) card._customActionReview = null;
  };
  root.append(message);
  for (const [label, fn] of [
    [
      "Confirm",
      () => {
        close();
        if (card.generation === generation && !card.preview) run();
      },
    ],
    ["Cancel", close],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t(card.hass, label);
    button.onclick = fn;
    root.append(button);
  }
  card._customActionReview = root;
  card.shell.append(root);
}
export async function executeCardAction(card, action, fallbackEntity) {
  if (card.preview || !custom(action) || action.action === "none") return;
  const generation = card.generation;
  const run = async () => {
    try {
      if (card.preview || generation !== card.generation) return;
      const id = action.entity || card.config?.action_entity || fallbackEntity;
      if (action.action === "more-info") {
        if (!id) throw Error("Choose an action entity for this card.");
        info(card, id);
        return;
      }
      if (action.action === "navigate") {
        const view = card.ownerDocument.defaultView;
        view.history[action.navigation_replace ? "replaceState" : "pushState"](
          null,
          "",
          action.navigation_path,
        );
        const event = new view.Event("location-changed", {
          bubbles: true,
          composed: true,
        });
        event.detail = { replace: Boolean(action.navigation_replace) };
        view.dispatchEvent(event);
        return;
      }
      if (action.action === "url") {
        card.ownerDocument.defaultView.open(
          action.url_path,
          "_blank",
          "noopener,noreferrer",
        );
        return;
      }
      if (action.action === "toggle") {
        const domain = id?.split(".")[0],
          state = card.hass?.states?.[id];
        if (!id) throw Error("Choose an action entity for this card.");
        if (!state || ["unknown", "unavailable"].includes(state.state)) return;
        if (
          !(
            [
              "light",
              "switch",
              "input_boolean",
              "fan",
              "humidifier",
              "automation",
              "siren",
              "remote",
            ].includes(domain) || card.hass?.services?.[domain]?.toggle
          )
        )
          throw Error("This entity does not support toggle.");
        const target = state.state === "on" ? "off" : "on";
        await card.act(id, domain, "toggle", {}, (s) => s?.state === target);
        return;
      }
      if (card._customActionRequest) return;
      const [domain, service] = (action.perform_action || action.service).split(
        ".",
      );
      const request = {};
      card._customActionRequest = request;
      card.error.textContent = "";
      try {
        card.actionHaptic();
        await Promise.race([
          card.hass.callService(
            domain,
            service,
            action.data || action.service_data || {},
            action.target ||
              (card.config?.action_entity
                ? { entity_id: card.config.action_entity }
                : undefined),
          ),
          new Promise((_, reject) => {
            request.timer = setTimeout(
              () =>
                reject(
                  Error(
                    "The action did not respond. Check Home Assistant before retrying.",
                  ),
                ),
              10000,
            );
          }),
        ]);
      } finally {
        clearTimeout(request.timer);
        if (card._customActionRequest === request)
          card._customActionRequest = null;
      }
    } catch (error) {
      if (card.generation === generation)
        card.error.textContent = t(card.hass, error.message);
    }
  };
  return confirmation(card, action, run);
}
export function installCardActions(card) {
  const update = card.update;
  if (update)
    card.update = function (...args) {
      const result = update.apply(this, args);
      prepareCardActions(this);
      return result;
    };
  const setConfig = card.setConfig;
  if (setConfig)
    card.setConfig = function (config) {
      validateActions(config);
      return setConfig.call(this, config);
    };
  card._cardActionHold = bindHold(
    card.shell,
    (event) => {
      const hit = card._actionHoldContext;
      if (!hit || card.preview) return;
      const action = card.config?.hold_action;
      if (custom(action)) void executeCardAction(card, action, hit.entity);
      else info(card, hit.entity);
    },
    {
      capture: true,
      enabled: (event) => {
        card._actionHoldContext = context(card, event);
        return active(card) && Boolean(card._actionHoldContext);
      },
    },
  );
  card.shell.addEventListener(
    "click",
    (event) => {
      const hit = context(card, event);
      if (!hit || !custom(card.config?.tap_action)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void executeCardAction(card, card.config.tap_action, hit.entity);
    },
    true,
  );
  card.shell.addEventListener(
    "keydown",
    (event) => {
      if (!active(card) || !["Enter", " "].includes(event.key)) return;
      const hit = context(card, event);
      if (!hit) return;
      if (event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (custom(card.config?.hold_action))
          void executeCardAction(card, card.config.hold_action, hit.entity);
        else if (!card.preview) info(card, hit.entity);
      } else if (event.target.hasAttribute("data-ikio-actions")) {
        event.preventDefault();
        event.target.click();
      }
    },
    true,
  );
}
function prepareCardActions(card) {
  const area = mainActionArea(card);
  if (!area) return;
  const target = area.matches("button")
    ? area
    : area.querySelector(".ae-title, .security-emblem, h2");
  if (!target) return;
  if (target.localName !== "button") {
    if (active(card)) {
      target.dataset.ikioActions = "";
      target.tabIndex = 0;
      target.setAttribute("role", "button");
    } else if (target.hasAttribute("data-ikio-actions")) {
      target.removeAttribute("data-ikio-actions");
      target.removeAttribute("tabindex");
      target.removeAttribute("role");
    }
  }
  // Native toggle controls still gate their own command. A custom navigation or
  // details action remains usable when the entity itself is unavailable.
  if (card.localName === "ikio-entity-card" && active(card))
    target.disabled = false;
}
