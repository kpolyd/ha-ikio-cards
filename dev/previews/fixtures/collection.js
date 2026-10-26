import * as mdi from "@mdi/js";
import fallback from "../mdi-preview-icons.json";
const icons = new Proxy(fallback, {
  get: (target, key) => {
    const name =
      "mdi" +
      String(key)
        .replace(/^mdi:/, "")
        .split("-")
        .map((s) => s[0]?.toUpperCase() + s.slice(1))
        .join("");
    return mdi[name]
      ? `<svg viewBox="0 0 24 24"><path d="${mdi[name]}"/></svg>`
      : target[key];
  },
});
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
const types = [
  "lights",
  "climate",
  "appliances",
  "media",
  "vacuum",
  "alarmo",
  "camera",
  "electricity",
  "server-monitor",
  "vehicle",
  "graph",
];
const states = {};
function state(id, value, attributes = {}) {
  return (states[id] = {
    entity_id: id,
    state: String(value),
    attributes: {
      friendly_name: id.split(".")[1].replaceAll("_", " "),
      ...attributes,
    },
    last_updated: new Date(Date.now() - 720000).toISOString(),
    last_changed: new Date(Date.now() - 120000).toISOString(),
  });
}
function sensor(id, value, unit) {
  return state("sensor." + id, value, { unit_of_measurement: unit });
}
state("light.strip", "on", {
  supported_color_modes: ["brightness"],
  brightness: 102,
});
state("light.glow", "on", { supported_color_modes: ["onoff"] });
state("switch.entrance", "off");
state("switch.heater", "off");
state("script.timed_heater", "off");
state("script.snapshot", "off");
state("automation.snapshots", "on");
state("switch.camera", "off");
state("camera.room", "unavailable");
state("person.owner", "home");
state("alarm_control_panel.home", "disarmed", {
  supported_features: 3,
  code_arm_required: false,
});
state("binary_sensor.window", "on");
state("lock.car", "locked");
state("binary_sensor.car_door", "off");
state("binary_sensor.car_window", "on");
state("device_tracker.car", "home", { latitude: 0, longitude: 0 });
state("vacuum.robot", "docked", {
  battery_level: 86,
  supported_features: 8192 | 4 | 16 | 32,
  fan_speed: "Quiet",
  fan_speed_list: ["Quiet", "Balanced", "Turbo"],
});
state("climate.room", "cool", {
  supported_features: 1 | 8,
  hvac_modes: ["off", "cool", "heat", "auto"],
  hvac_action: "cooling",
  temperature: 22,
  min_temp: 16,
  max_temp: 30,
  target_temp_step: 0.5,
  fan_modes: ["auto", "low", "high"],
  fan_mode: "auto",
});
state("humidifier.room", "on", {
  humidity: 55,
  min_humidity: 35,
  max_humidity: 80,
  supported_features: 1,
  available_modes: ["Auto", "Continuous"],
  mode: "Auto",
});
state("fan.bedroom", "off", {
  supported_features: 1 | 2 | 4,
  percentage: 40,
  percentage_step: 10,
  direction: "forward",
  oscillating: false,
});
state("media_player.tv", "playing", {
  supported_features: 1 | 2 | 4 | 8 | 16 | 32 | 128 | 256 | 16384 | 2048,
  media_title: "Evening playlist",
  media_artist: "Cast session",
  volume_level: 0.35,
  is_volume_muted: false,
  media_position: 84,
  media_duration: 250,
  media_position_updated_at: new Date().toISOString(),
  source: "Chromecast",
  source_list: ["Chromecast", "TV"],
});
for (const [id, value, unit] of [
  ["total", 160, "W"],
  ["office", 14, "W"],
  ["tv", 9, "W"],
  ["ac", 0, "W"],
  ["heater", 0, "W"],
  ["dry", 0, "W"],
  ["temperature", 21.6, "°C"],
  ["humidity", 63, "%"],
  ["day", 11.86, "kWh"],
  ["night", 7.11, "kWh"],
  ["bill", 30.09, "€"],
  ["forecast", 60.6, "€"],
  ["fuel", 86, "%"],
  ["range", 437, "km"],
  ["odometer", 25901, "km"],
  ["cpu", 2, "%"],
  ["ram", 30.1, "%"],
  ["ram_used", 4.8, "GiB"],
  ["ram_free", 11.2, "GiB"],
  ["disk_used", 179, "GB"],
  ["disk_free", 821, "GB"],
  ["disk", 17.9, "%"],
  ["database", 871.44, "MB"],
  ["uptime", 13.77, "h"],
  ["server_temperature", 52, "°C"],
])
  sensor(id, value, unit);
state("binary_sensor.host", "on");
const configs = {
  lights: {
    name: "Living room lights",
    lights: [
      { entity: "light.strip", name: "Ceiling strip" },
      { entity: "light.glow", name: "TV glow" },
      { entity: "switch.entrance", name: "Entrance" },
    ],
  },
  climate: {
    name: "Living room comfort",
    temperature_entity: "sensor.temperature",
    humidity_entity: "sensor.humidity",
    climate_entity: "climate.room",
    humidifier_entity: "humidifier.room",
  },
  appliances: {
    name: "Water heater",
    entity: "switch.heater",
    power_entity: "sensor.heater",
    timed_runs: [
      { label: "Start 30-minute run", start_script: "script.timed_heater" },
    ],
  },
  media: { name: "Chromecast", entity: "media_player.tv" },
  vacuum: { name: "Roborock Q8 Max", entity: "vacuum.robot" },
  alarmo: {
    name: "Home security",
    entity: "alarm_control_panel.home",
    persons: [{ entity: "person.owner", name: "Resident" }],
    contacts: [{ entity: "binary_sensor.window", name: "Kitchen window" }],
  },
  camera: {
    name: "Living room camera",
    entity: "camera.room",
    power_switch: "switch.camera",
    snapshot_automation: "automation.snapshots",
    snapshot_script: "script.snapshot",
  },
  electricity: {
    name: "Electricity",
    show_power_distribution: true,
    power_entity: "sensor.total",
    day_entity: "sensor.day",
    night_entity: "sensor.night",
    same_cycle: true,
    billing_period_label: "1–31 October · fixture",
    accrued_bill_entity: "sensor.bill",
    forecast_bill_entity: "sensor.forecast",
    circuits: [
      { name: "Office", power_entity: "sensor.office" },
      { name: "TV", power_entity: "sensor.tv" },
      { name: "Air conditioner", power_entity: "sensor.ac" },
      { name: "Dehumidifier", power_entity: "sensor.dry" },
      { name: "Water heater", power_entity: "sensor.heater" },
    ],
    show_untracked: true,
    non_overlapping: true,
    hours: 6,
  },
  "server-monitor": {
    name: "Home Assistant server",
    network_rx_entity: "sensor.network_rx",
    network_tx_entity: "sensor.network_tx",
    availability_entity: "binary_sensor.host",
    cpu_entity: "sensor.cpu",
    ram_used_entity: "sensor.ram_used",
    ram_free_entity: "sensor.ram_free",
    disk_used_entity: "sensor.disk_used",
    disk_free_entity: "sensor.disk_free",
    temperature_entity: "sensor.server_temperature",
    uptime_entity: "sensor.uptime",
    database_entity: "sensor.database",
  },
  vehicle: {
    name: "Car",
    range_entity: "sensor.range",
    fuel_entity: "sensor.fuel",
    odometer_entity: "sensor.odometer",
    tracker_entity: "device_tracker.car",
    locks: [{ entity: "lock.car" }],
    doors: [{ entity: "binary_sensor.car_door" }],
    windows: [{ entity: "binary_sensor.car_window" }],
  },
  graph: {
    name: "Office power",
    entities: [{ entity: "sensor.office" }],
    expected_min: 0,
    expected_max: 3500,
    hours: 6,
  },
};
sensor("network_rx", 0.3, "MB/s");
sensor("network_tx", 0.1, "MB/s");
const connection = {},
  cards = [];
const hass = {
  states,
  entities: {
    "light.strip": { device_id: "living_lamp" },
    "light.glow": { area_id: "living" },
    "switch.entrance": { area_id: "hall" },
  },
  devices: { living_lamp: { area_id: "living" } },
  areas: { living: { name: "Living room" }, hall: { name: "Entrance" } },
  connection,
  locale: { language: "en" },
  services: { alarmo: { arm: {} } },
  config: { time_zone: "Europe/Athens" },
  callWS: async (msg) => {
    if (msg.type === "alarmo/entities")
      return [{ entity_id: "alarm_control_panel.home", area_id: 1 }];
    if (msg.type === "alarmo/sensors")
      return {
        "binary_sensor.window": { enabled: true, area: 1, name: "Window" },
      };
    if (msg.type === "alarmo/countdown") return { delay: 30, remaining: 18 };
    if (msg.type !== "history/history_during_period")
      throw Error("Unexpected mock request: " + msg.type);
    return Object.fromEntries(
      msg.entity_ids.map((id) => [
        id,
        Array.from({ length: 121 }, (_, i) => ({
          lu:
            Date.parse(msg.start_time) / 1000 +
            (i * (Date.parse(msg.end_time) - Date.parse(msg.start_time))) /
              120000,
          s:
            i % 19 === 7
              ? "unknown"
              : String(
                  id.includes("network")
                    ? i % 11 === 0
                      ? 0.3
                      : 0
                    : Math.round(100 + 50 * Math.sin(i / 5)),
                ),
          a: {
            unit_of_measurement:
              states[id]?.attributes?.unit_of_measurement || "W",
          },
        })),
      ]),
    );
  },
  callService: async (domain, service, data) => {
    document.querySelector("#log").textContent = JSON.stringify({
      domain,
      service,
      data: { ...data, code: data.code ? "[redacted]" : undefined },
    });
    const old = states[data.entity_id];
    if (!old) return;
    let value = old.state,
      attrs = { ...old.attributes };
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
      if (data.volume_level !== undefined)
        attrs.volume_level = data.volume_level;
      if (data.source) attrs.source = data.source;
      if (data.is_volume_muted !== undefined)
        attrs.is_volume_muted = data.is_volume_muted;
    }
    if (domain === "climate" && data.hvac_mode) value = data.hvac_mode;
    for (const key of ["temperature", "humidity", "percentage", "mode"])
      if (data[key] !== undefined) attrs[key] = data[key];
    if (data.brightness_pct !== undefined)
      attrs.brightness = Math.round((data.brightness_pct / 100) * 255);
    if (domain === "alarm_control_panel" || domain === "alarmo") {
      value =
        service === "alarm_disarm"
          ? "disarmed"
          : `armed_${data.mode || service.replace("alarm_arm_", "")}`;
      if (data.force) attrs.bypassed_sensors = ["binary_sensor.window"];
    }
    states[data.entity_id] = { ...old, state: value, attributes: attrs };
    setTimeout(update, 150);
  },
};
function update() {
  for (const card of cards) card.hass = { ...hass, states: { ...states } };
}
for (const type of types) {
  const section = document.createElement("section"),
    caption = document.createElement("p"),
    card = document.createElement("ikio-" + type + "-card");
  caption.className = "caption";
  caption.textContent = type;
  section.dataset.card = type;
  section.id = type;
  section.append(caption, card);
  document.querySelector("main").append(section);
  cards.push(card);
  card.setConfig(configs[type]);
  card.addEventListener(
    "hass-more-info",
    (e) =>
      (document.querySelector("#log").textContent =
        "Native HA details: " + e.detail.entityId),
  );
}
update();
for (const button of document.querySelectorAll("[data-theme]"))
  button.onclick = () => {
    for (let i = 0; i < cards.length; i++)
      cards[i].setConfig({
        ...configs[types[i]],
        appearance: { theme: button.dataset.theme },
      });
    update();
  };
document.querySelector("#width").onchange = (e) => {
  const width = e.target.value;
  document.querySelector("main").style.gridTemplateColumns =
    width === "auto"
      ? "repeat(auto-fit,minmax(min(100%,340px),1fr))"
      : `minmax(0,${width}px)`;
};
let offline = false;
document.querySelector("#offline").onclick = () => {
  offline = !offline;
  for (const id of [
    "sensor.total",
    "climate.room",
    "vacuum.robot",
    "media_player.tv",
  ])
    states[id] = {
      ...states[id],
      state: offline
        ? "unavailable"
        : id.startsWith("climate")
          ? "cool"
          : id.startsWith("vacuum")
            ? "docked"
            : id.startsWith("media")
              ? "playing"
              : "160",
    };
  update();
};

window.ikioPreview = {
  types,
  cards,
  states,
  configs,
  async configure({ theme = "dark", width = 360, scenario = "normal" } = {}) {
    for (const [i, card] of cards.entries())
      card.setConfig({ ...configs[types[i]], appearance: { theme } });
    document.body.style.background = theme === "dark" ? "#0d171b" : "#f4f6f5";
    document.querySelector("main").style.gridTemplateColumns = `${width}px`;
    if (scenario === "unavailable")
      for (const id of Object.keys(states))
        states[id] = { ...states[id], state: "unavailable" };
    update();
    await document.fonts.ready;
    for (let tries = 0; tries < 100; tries++) {
      await new Promise((r) => setTimeout(r, 50));
      if (
        cards.every((c) => !c.loading && !c.networkLoading && !c.alarmoLoading)
      )
        break;
    }
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  },
  ready: true,
};
