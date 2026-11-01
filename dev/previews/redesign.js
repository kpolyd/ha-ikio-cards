import { demoGraphHistory } from "./fixtures/graph-history.js";
import {
  electricityIds,
  demoPowerHistory,
  applyDemoPower,
} from "./fixtures/electricity.js";
import icons from "./mdi-preview-icons.json";
const types = [
  "climate",
  "media",
  "vacuum",
  "server-monitor",
  "graph",
];
const descriptions = {
  climate:
    "Compact target-temperature dial, supported HVAC modes, and optional device settings.",
  media:
    "Compact track information, paired audio controls, and a quiet extras footer.",
  vacuum:
    "One obvious cleaning action, quieter battery status, and collapsible maintenance/missions.",
  "server-monitor":
    "One resource strip, paired supporting readings, and services tucked away.",
  graph:
    "Current readings with line-pattern samples matching the plotted series.",
};
class FixtureIcon extends HTMLElement {
  static get observedAttributes() {
    return ["icon"];
  }
  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.draw();
  }
  attributeChangedCallback() {
    if (this.shadowRoot) this.draw();
  }
  draw() {
    this.shadowRoot.innerHTML =
      "<style>:host{display:inline-flex;width:var(--mdc-icon-size,20px);height:var(--mdc-icon-size,20px);flex:none}svg{width:100%;height:100%;fill:currentColor}</style>" +
      (icons[this.getAttribute("icon")] || icons["mdi:power"]);
  }
}
customElements.define("ha-icon", FixtureIcon);
const states = {},
  cards = [];
const now = Date.now();
function state(id, value, attributes = {}) {
  states[id] = {
    entity_id: id,
    state: String(value),
    attributes: {
      friendly_name: id.split(".")[1].replaceAll("_", " "),
      ...attributes,
    },
    last_changed: new Date(now - 120000).toISOString(),
    last_updated: new Date(now).toISOString(),
  };
}
function sensor(id, value, unit) {
  state("sensor." + id, value, { unit_of_measurement: unit });
}
state("climate.room", "cool", {
  supported_features: 1 | 8 | 16 | 32,
  hvac_modes: ["off", "cool", "heat", "auto"],
  hvac_action: "cooling",
  temperature: 22,
  min_temp: 16,
  max_temp: 30,
  target_temp_step: 0.5,
  fan_modes: ["auto", "low", "high"],
  fan_mode: "auto",
  preset_modes: ["none", "eco"],
  preset_mode: "eco",
  swing_modes: ["off", "vertical"],
  swing_mode: "off",
});
state("humidifier.room", "on", {
  humidity: 55,
  min_humidity: 35,
  max_humidity: 80,
  supported_features: 1,
  available_modes: ["Auto", "Continuous"],
  mode: "Auto",
});
state("fan.room", "on", {
  supported_features: 1 | 2 | 4,
  percentage: 40,
  percentage_step: 10,
  direction: "forward",
  oscillating: false,
});
state("media_player.room", "playing", {
  supported_features: 1 | 2 | 4 | 8 | 16 | 32 | 128 | 256 | 16384 | 2048,
  media_title: "A quiet evening",
  media_artist: "Studio session",
  volume_level: 0.35,
  is_volume_muted: false,
  media_position: 84,
  media_duration: 250,
  media_position_updated_at: new Date().toISOString(),
  source: "Music",
  source_list: ["Music", "TV", "Radio"],
});
state("vacuum.robot", "docked", {
  battery_level: 86,
  supported_features: 8192 | 4 | 16 | 32,
  fan_speed: "Balanced",
  fan_speed_list: ["Quiet", "Balanced", "Turbo"],
});
state("switch.appliance", "off");
state("script.run_30", "off");
state("script.run_60", "off");
state("script.stop_run", "off");
state("timer.appliance", "idle");
state("script.restart", "off");
state("script.clean_kitchen", "off");
state("switch.service", "on");
state("light.glow", "on");
state("binary_sensor.host", "on");
state("binary_sensor.service", "on");
for (const [id, value, unit] of [
  ["temperature", 23.6, "°C"],
  ["humidity", 54, "%"],
  ["fridge", 3.8, "°C"],
  ["power", 145, "W"],
  ["appliance_power", 0, "W"],
  ["energy", 1.2, "kWh"],
  ["cpu", 12, "%"],
  ["ram", 36, "%"],
  ["ram_used", 5.8, "GB"],
  ["ram_total", 16, "GB"],
  ["disk_used", 420, "GB"],
  ["disk_total", 1, "TB"],
  ["disk", 42, "%"],
  ["uptime", 72, "h"],
  ["server_temperature", 48, "°C"],
  ["network_rx", 2.4, "MB/s"],
  ["network_tx", 0.7, "MB/s"],
  ["database", 871, "MB"],
  ["brush", 72, "%"],
  ["media_power", 78, "W"],
  ["office", 29, "W"],
])
  sensor(id, value, unit);
applyDemoPower(states);
const configs = {
  climate: {
    name: "Living room",
    temperature_entity: "sensor.temperature",
    humidity_entity: "sensor.humidity",
    climate_entity: "climate.room",
  },
  media: {
    name: "Media",
    entity: "media_player.room",
    power_entity: "sensor.media_power",
    backlight_entity: "light.glow",
  },
  vacuum: {
    name: "Robot vacuum",
    entity: "vacuum.robot",
    maintenance: [{ entity: "sensor.brush", name: "Main brush remaining" }],
    missions: [{ entity: "script.clean_kitchen", label: "Clean kitchen" }],
  },
  "server-monitor": {
    name: "Home server",
    availability_entity: "binary_sensor.host",
    cpu_entity: "sensor.cpu",
    ram_percent_entity: "sensor.ram",
    ram_used_entity: "sensor.ram_used",
    ram_total_entity: "sensor.ram_total",
    disk_used_entity: "sensor.disk_used",
    disk_total_entity: "sensor.disk_total",
    disk_percent_entity: "sensor.disk",
    temperature_entity: "sensor.server_temperature",
    uptime_entity: "sensor.uptime",
    network_rx_entity: "sensor.network_rx",
    network_tx_entity: "sensor.network_tx",
    services: [
      {
        name: "Media service",
        status_entity: "binary_sensor.service",
        control_entity: "switch.service",
        restart_action: "script.restart",
      },
    ],
  },
  graph: {
    name: "Device power",
    entities: [
      { entity: "sensor.power", name: "Living room" },
      { entity: "sensor.office", name: "Office" },
    ],
    hours: 6,
    expected_min: 0,
    expected_max: 3500,
  },
};
const connection = {};
const hass = {
  states,
  connection,
  locale: { language: "en" },
  callWS: async (msg) =>
    Object.fromEntries(
      (msg.entity_ids || []).map((id) => [
        id,
        electricityIds.includes(id)
          ? demoPowerHistory(
              id,
              Date.parse(msg.start_time),
              Date.parse(msg.end_time),
            )
          : demoGraphHistory(id, states[id], Date.parse(msg.start_time), Date.parse(msg.end_time)),
      ]),
    ),
  callService: async (domain, service, data) => {
    document.querySelector("#log").textContent =
      "Simulated: " + domain + "." + service;
    const old = states[data.entity_id];
    if (!old) return;
    let value = old.state;
    const attrs = { ...old.attributes };
    if (service === "turn_on") value = "on";
    if (service === "turn_off") value = "off";
    if (domain === "vacuum") {
      value =
        service === "start"
          ? "cleaning"
          : service === "pause"
            ? "paused"
            : service === "return_to_base"
              ? "returning"
              : value;
      if (data.fan_speed) attrs.fan_speed = data.fan_speed;
    }
    if (domain === "media_player") {
      value =
        service === "media_play"
          ? "playing"
          : service === "media_pause"
            ? "paused"
            : value;
      for (const key of ["volume_level", "source", "is_volume_muted"])
        if (data[key] !== undefined) attrs[key] = data[key];
      if (data.seek_position !== undefined) {
        attrs.media_position = data.seek_position;
        attrs.media_position_updated_at = new Date().toISOString();
      }
    }
    if (domain === "climate" && data.hvac_mode) value = data.hvac_mode;
    for (const key of [
      "temperature",
      "humidity",
      "percentage",
      "mode",
      "fan_mode",
      "preset_mode",
      "swing_mode",
      "direction",
      "oscillating",
    ])
      if (data[key] !== undefined) attrs[key] = data[key];
    states[data.entity_id] = { ...old, state: value, attributes: attrs };
    if (data.entity_id.startsWith("script.run_")) {
      state("switch.appliance", "on");
      sensor("appliance_power", 2100, "W");
      state("timer.appliance", "active", {
        finishes_at: new Date(Date.now() + 1800000).toISOString(),
      });
    }
    if (data.entity_id === "script.stop_run") {
      state("switch.appliance", "off");
      sensor("appliance_power", 0, "W");
      state("timer.appliance", "idle");
    }
    setTimeout(update, 80);
  },
};
function update() {
  for (const card of cards) card.hass = { ...hass, states: { ...states } };
}
for (const type of types) {
  const section = document.createElement("section");
  section.id = type;
  section.dataset.card = type;
  const h = document.createElement("h2");
  h.textContent = type[0].toUpperCase() + type.slice(1);
  const card = document.createElement("ikio-" + type + "-card");
  const caption = document.createElement("p");
  caption.textContent = descriptions[type];
  section.append(h, card, caption);
  document.querySelector("main").append(section);
  cards.push(card);
  card.setConfig(configs[type]);
  card.addEventListener(
    "hass-more-info",
    (e) =>
      (document.querySelector("#log").textContent =
        "Simulated entity details: " + e.detail.entityId),
  );
  const link = document.createElement("a");
  link.href = "#" + type;
  link.textContent = h.textContent;
  document.querySelector("nav").append(link);
}
update();
for (const mode of ["dark", "light"])
  document.getElementById(mode).onclick = () => {
    document.body.classList.toggle("light", mode === "light");
    cards.forEach((card, i) =>
      card.setConfig({ ...configs[types[i]], appearance: { theme: mode } }),
    );
    update();
  };
document.querySelector("#width").onchange = (e) => {
  document.querySelector("main").style.gridTemplateColumns =
    e.target.value === "auto" ? "" : `minmax(0,${e.target.value}px)`;
};
const baseline = structuredClone(states);
document.querySelector("#state").onchange = (e) => {
  Object.assign(states, structuredClone(baseline));
  const mode = e.target.value;
  if (mode === "offline") {
    for (const id of [
      "climate.room",
      "media_player.room",
      "vacuum.robot",
      "switch.appliance",
      "camera.room",
      "binary_sensor.host",
      "binary_sensor.service",
    ])
      states[id] = { ...states[id], state: "unavailable" };
  }
  if (mode === "busy") {
    state("vacuum.robot", "cleaning", baseline["vacuum.robot"].attributes);
    state("switch.appliance", "on");
    sensor("appliance_power", 2100, "W");
    state("timer.appliance", "active", {
      finishes_at: new Date(Date.now() + 1320000).toISOString(),
    });
    sensor("cpu", 76, "%");
  }
  update();
};
