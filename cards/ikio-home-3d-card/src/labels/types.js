import { t } from "@ikio/card-ui/i18n";
import { formatNumber, bindHold } from "@ikio/card-ui";
import { LabelType } from "../enums.js";
// Reusable label renderers. Adding a type requires only a registry entry here.
// Every type returns an update(states) function; the layer handles placement.
import { svg, icons } from "./icons.js";

export function reading(state, digits, unit, hass) {
  const raw = state?.state;
  const number = raw == null || String(raw).trim() === "" ? NaN : Number(raw);
  return Number.isFinite(number)
    ? formatNumber(hass, number, digits, digits) +
        (state.attributes?.unit_of_measurement || unit)
    : "—";
}

function button(label, className, entity, onPick) {
  const element = document.createElement("button");
  element.type = "button";
  element.dataset.entity = entity;
  element.className = className;
  element.setAttribute("aria-label", label);
  element.addEventListener("click", () => onPick({ badgeEntity: entity }));
  return element;
}

function nativeIcon(name) {
  const icon = document.createElement("ha-icon");
  icon.setAttribute("icon", name);
  icon.setAttribute("aria-hidden", "true");
  return icon;
}
function setIcon(target, name, size = 22) {
  if (Object.hasOwn(icons, name)) target.innerHTML = svg(name, size, 1.8);
  else
    target.replaceChildren(
      nativeIcon(
        typeof name === "string" && name.startsWith("mdi:")
          ? name
          : "mdi:power",
      ),
    );
}

function metric(
  { el, spec, onPick, getHass },
  { className, icon, digits, unit },
) {
  const value = button(spec.name, className, spec.entity, onPick);
  const text = document.createElement("span");
  value.append(nativeIcon(icon), text);
  el.append(value);
  return {
    value,
    update(states) {
      text.textContent = reading(states[spec.entity], digits, unit, getHass());
    },
  };
}

const alarmStates = {
  disarmed: "Disarmed",
  armed_home: "Armed home",
  armed_away: "Armed away",
  armed_night: "Armed night",
  armed_vacation: "Armed vacation",
  armed_custom_bypass: "Armed custom",
  arming: "Arming",
  pending: "Pending",
  disarming: "Disarming",
  triggered: "Triggered",
};

function binaryMarker({ el, spec, onPick, getHass }) {
  const motion = spec.type === LabelType.MOTION;
  el.classList.add("sensor-marker");
  el.dataset.markerKind = spec.type;
  const value = button(spec.name, "badge-marker", spec.entity, onPick);
  setIcon(value, spec.icon || (motion ? "motion" : "door"), 14);
  el.append(value);
  return (states) => {
    const state = states[spec.entity]?.state;
    const known = state === "on" || state === "off";
    const status = !known
      ? "Unavailable"
      : motion
        ? state === "on"
          ? "Motion detected"
          : "Clear"
        : state === "on"
          ? "Open"
          : "Closed";
    el.dataset.markerState = !known
      ? "unavailable"
      : state === "on"
        ? "active"
        : "idle";
    value.setAttribute("aria-label", spec.name + ": " + t(getHass(), status));
    value.title = el.title = spec.name + ": " + t(getHass(), status);
  };
}

export const labelTypes = {
  [LabelType.CLIMATE](context) {
    const { el, spec, onPick, getHass } = context;
    el.classList.add("climate-badge");
    el.dataset.layout = spec.layout || "inline";
    const temperature = metric(context, {
      className: "badge-temp",
      icon: "mdi:thermometer",
      digits: 1,
      unit: "°C",
    });
    let humidity;
    if (spec.humidity) {
      humidity = button(spec.name, "badge-humidity", spec.humidity, onPick);
      humidity.append(
        nativeIcon("mdi:water-percent"),
        document.createElement("span"),
      );
      el.append(humidity);
    }
    return (states) => {
      temperature.update(states);
      if (humidity)
        humidity.querySelector("span").textContent = reading(
          states[spec.humidity],
          0,
          "%",
          getHass(),
        );
    };
  },
  [LabelType.POWER](context) {
    return metric(context, {
      className: "badge-power",
      icon: "mdi:lightning-bolt",
      digits: 0,
      unit: "W",
    }).update;
  },
  [LabelType.FRIDGE]({ el, spec, onPick, getHass }) {
    el.classList.add("fridge-badge");
    const value = button(spec.name, "badge-fridge", spec.entity, onPick);
    value.innerHTML = svg("fridge", null, 1.8) + "<span></span>";
    el.append(value);
    const text = value.querySelector("span");
    return (states) => {
      text.textContent = reading(states[spec.entity], 1, "°C", getHass());
    };
  },
  [LabelType.ALARM]({ el, spec, onPick, getHass }) {
    const value = button(spec.name, "badge-alarm", spec.entity, onPick);
    const text = document.createElement("span");
    value.append(nativeIcon("mdi:shield-home-outline"), text);
    el.append(value);
    return (states) => {
      const state = states[spec.entity]?.state;
      text.textContent = t(getHass(), alarmStates[state] || "Unavailable");
      el.dataset.alarmState = state || "unavailable";
    };
  },
  [LabelType.DEVICE]({ el, spec, onPick, getHass }) {
    el.classList.add("device-badge");
    const value = button(spec.name, "badge-device", spec.entity, onPick);
    setIcon(value, spec.icon);
    const dot = document.createElement("span");
    dot.className = "device-dot";
    dot.setAttribute("aria-hidden", "true");
    value.append(dot);
    el.append(value);
    return (states) => {
      const state = states[spec.entity]?.state;
      const unavailable = !state || ["unknown", "unavailable"].includes(state);
      const offStates =
        spec.offStates ||
        (spec.entity.startsWith("media_player.")
          ? ["off", "standby"]
          : ["off"]);
      const on = !unavailable && !offStates.includes(state);
      const status = unavailable ? "Unavailable" : on ? "On" : "Off";
      el.dataset.deviceState = unavailable ? "unavailable" : on ? "on" : "off";
      value.setAttribute("aria-label", spec.name + ": " + t(getHass(), status));
      value.title = spec.name + ": " + t(getHass(), status);
    };
  },
  [LabelType.MOTION]: binaryMarker,
  [LabelType.CONTACT]: binaryMarker,
};

export function createLabel(spec, onPick, getHass = () => undefined) {
  const render = labelTypes[spec.type];
  if (!render) throw new Error("Unknown label type: " + spec.type);
  const el = document.createElement("div");
  el.className = "sensor-badge";
  el.dataset.sensor = spec.entity;
  el.setAttribute("aria-label", spec.name);
  el.title = spec.name;
  if (spec.title) {
    const title = button(spec.title, "badge-name", spec.entity, onPick);
    title.textContent = spec.title;
    el.append(title);
  }
  const update = render({ el, spec, onPick, getHass });
  const holds = [...el.querySelectorAll("button")].map((button) =>
    bindHold(button, () => onPick({ badgeEntity: button.dataset.entity })),
  );
  return {
    el,
    id: spec.entity,
    kind: spec.type,
    ...spec.position,
    update,
    dispose() {
      holds.forEach((hold) => hold.destroy());
    },
  };
}
