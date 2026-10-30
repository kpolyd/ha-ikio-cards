import { addBatteryFixtures } from "./battery.js";
import home3dModel from "../../../cards/ikio-home-3d-card/examples/home-model.json";
import home3dEntities from "../../../cards/ikio-home-3d-card/examples/entities.json";
import home3dBindings from "../../../cards/ikio-home-3d-card/examples/device-bindings.json";
// Fictional JSON responses let the downloadable gallery run without a server.
const home3dFiles = new Map([
  ["/local/ikio-demo/home-model.json", home3dModel],
  ["/local/ikio-demo/entities.json", home3dEntities],
  ["/local/ikio-demo/device-bindings.json", home3dBindings],
]);
const originalFetch = window.fetch.bind(window);
window.ikioHomeFileRequests = 0;
window.fetch = async (input, options = {}) => {
  const path = new URL(typeof input === "string" ? input : input.url, location.href).pathname;
  if (path.startsWith("/local/ikio-demo/")) {
    window.ikioHomeFileRequests++;
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return new Response(JSON.stringify(home3dFiles.get(path) ?? {}), { status: home3dFiles.has(path) ? 200 : 404, headers: {"Content-Type":"application/json"} });
  }
  return originalFetch(input, options);
};
import mediaArtwork from "../media-artwork.png";
import {
  electricityIds,
  demoPowerHistory,
  applyDemoPower,
} from "./electricity.js";
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
class FixtureStateIcon extends FixtureIcon {
  set stateObj(value) {
    this._stateObj = value;
    const kind = value?.attributes?.device_class;
    const icon =
      value?.attributes?.icon ||
      (value?.attributes?.unit_of_measurement === "MB"
        ? "mdi:database"
        : kind === "motion"
          ? "mdi:motion-sensor"
          : kind === "door"
            ? "mdi:door-open"
            : kind === "window"
              ? "mdi:window-open-variant"
              : value?.entity_id?.startsWith("alarm_control_panel.")
                ? "mdi:shield-outline"
                : "mdi:information-outline");
    this.setAttribute("icon", icon);
  }
  get stateObj() {
    return this._stateObj;
  }
}
customElements.define("ha-state-icon", FixtureStateIcon);
const types = [
  "lights",
  "climate",
  "dehumidifier",
  "appliances",
  "media",
  "vacuum",
  "alarmo",
  "camera",
  "electricity",
  "server-monitor",
  "vehicle",
  "graph",
  "chip",
  "router",
  "weather",
  "home-3d",
  "entity",
  "battery",
].filter((type) => customElements.get(`ikio-${type}-card`));
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
  supported_color_modes: ["rgb"],
  color_mode: "rgb",
  rgb_color: [167, 139, 250],
  brightness: 166,
});
state("light.glow", "on", { supported_color_modes: ["color_temp"], color_mode: "color_temp", color_temp_kelvin: 2700, brightness: 204 });
state("light.demo_dimmer", "on", { supported_color_modes: ["brightness"], color_mode: "brightness", brightness: 102 });
state("light.demo_bedside", "off", { supported_color_modes: ["color_temp"], color_mode: "color_temp", color_temp_kelvin: 6500, brightness: 64 });
state("light.demo_balcony", "unavailable");
state("switch.entrance", "off");
sensor("demo_containers", 12, "");
state("sensor.demo_backup", "3 hours ago", { icon: "mdi:backup-restore" });
state("switch.heater", "off");
for (let i = 0; i < 6; i++) {
  state(`binary_sensor.demo_service_${i}`, i === 2 ? "off" : "on");
  state(`switch.demo_service_${i}`, i === 2 ? "off" : "on");
}
state("script.timed_heater", "off");
state("script.snapshot", "off");
state("automation.snapshots", "on");
state("switch.camera", "off");
state("camera.room", "unavailable");
state("person.owner", "home", {
  user_id: "demo-user",
  friendly_name: "Demo resident",
});
state("alarm_control_panel.home", "disarmed", {
  supported_features: 3,
  code_arm_required: false,
});
state("binary_sensor.window", "on", { device_class: "window" });
state("binary_sensor.demo_balcony", "on", {
  friendly_name: "Balcony",
  device_class: "door",
});
state("binary_sensor.demo_motion", "on", {
  friendly_name: "Motion",
  device_class: "motion",
});
state("binary_sensor.demo_entrance", "on", {
  friendly_name: "Front door",
  device_class: "door",
});
state("lock.car", "locked");
state("binary_sensor.car_door", "off");
state("binary_sensor.car_window", "on");
state("device_tracker.car", "home", { latitude: 0, longitude: 0 });
state("vacuum.robot", "docked", {
  friendly_name: "Robot vacuum",
  icon: "mdi:robot-vacuum",
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
sensor("dehumidifier_power", 245, "W");
state("binary_sensor.dehumidifier_tank", "off", { device_class: "problem" });
state("select.dehumidifier_fan", "High", { options: ["Low", "High"] });
state("humidifier.room", "on", {
  humidity: 50,
  current_humidity: 62,
  action: "drying",
  device_class: "dehumidifier",
  icon: "mdi:air-humidifier-off",
  target_humidity_step: 5,
  min_humidity: 35,
  max_humidity: 80,
  supported_features: 1,
  available_modes: ["Auto", "Continuous", "Laundry"],
  mode: "Auto",
});
state("fan.bedroom", "off", {
  supported_features: 1 | 2 | 4,
  percentage: 40,
  percentage_step: 10,
  direction: "forward",
  oscillating: false,
});
state("scene.movie", "scening");
sensor("media_power", 18, "W");
state("media_player.tv", "playing", {
  entity_picture: mediaArtwork,
  device_class: "speaker",
  icon: "mdi:speaker",
  supported_features: 1 | 2 | 4 | 8 | 16 | 32 | 128 | 256 | 16384 | 2048,
  media_title: "Evening horizon",
  media_artist: "Ikio demo",
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
applyDemoPower(states);
const configs = {
  battery: {},
  entity: {entity: "light.glow", name: "Bedside"},
  lights: {
    name: "Lights",
    group_by_location: true,
    lights: [
      { entity: "light.strip", name: "RGB strip", location: "Living room" },
      { entity: "light.glow", name: "White", location: "Living room" },
      { entity: "light.demo_dimmer", name: "Dimmer", location: "Living room" },
      { entity: "light.demo_bedside", name: "Bedside", location: "Bedroom" },
      { entity: "switch.entrance", name: "Switch", location: "Bedroom" },
      { entity: "light.demo_balcony", name: "Wall light", location: "Balcony" },
    ],
  },
  climate: {
    name: "Living room",
    temperature_entity: "sensor.temperature",
    humidity_entity: "sensor.humidity",
    climate_entity: "climate.room",
  },
  dehumidifier: {
    name: "Dehumidifier",
    humidifier_entity: "humidifier.room",
    power_entity: "sensor.dehumidifier_power",
    tank_full_entity: "binary_sensor.dehumidifier_tank",
    fan_entity: "select.dehumidifier_fan",
  },
  appliances: {
    name: "Water heater",
    entity: "switch.heater",
    power_entity: "sensor.heater",
    timed_runs: [
      { label: "Start 30-minute run", start_script: "script.timed_heater" },
    ],
  },
  media: {
    name: "Living room speaker", entity: "media_player.tv", power_entity: "sensor.media_power",
  },
  vacuum: { entity: "vacuum.robot" },
  alarmo: {
    show_activity: true,
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
    services: [
      "Immich",
      "Jellyfin",
      "Mealie",
      "Nextcloud",
      "Cloudflare",
      "Tailscale",
    ].map((name, i) => ({
      name,
      status_entity: `binary_sensor.demo_service_${i}`,
      control_entity: `switch.demo_service_${i}`,
    })),
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
    extra_readings: [
      { entity: "sensor.database", name: "Database" },
      { entity: "sensor.demo_containers", name: "Containers" },
      { entity: "sensor.demo_backup", name: "Last backup" },
    ],
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
  chip: { entity: "sensor.database", name: "Database" },
  graph: {
    name: "Office power",
    entities: [{ entity: "sensor.office" }],
    expected_min: 0,
    expected_max: 3500,
    hours: 6,
  },
};
// Simulated router bindings; never a real household/device connection.
state("binary_sensor.demo_internet", "on");
state("binary_sensor.demo_router", "on");
sensor("demo_wan_ip", "198.51.100.7");
sensor("demo_local_ip", "192.0.2.1");
sensor("demo_latency", 28, "ms");
sensor("demo_devices", 13);
sensor("demo_network_type", "4G LTE");
sensor("demo_signal", 75, "%");
sensor("demo_rsrp", -100, "dBm");
sensor("demo_rsrq", -9, "dB");
sensor("demo_snr", 8.4, "dB");
configs.router = {
  name:"Router", availability_entity:"binary_sensor.demo_router", uptime_entity:"sensor.uptime",
  internet_status_entity:"binary_sensor.demo_internet",internet_ip_entity:"sensor.demo_wan_ip",local_ip_entity:"sensor.demo_local_ip",latency_entity:"sensor.demo_latency",devices_entity:"sensor.demo_devices",
  connection_type:"cellular",network_type_entity:"sensor.demo_network_type",signal_entity:"sensor.demo_signal",rsrp_entity:"sensor.demo_rsrp",rsrq_entity:"sensor.demo_rsrq",snr_entity:"sensor.demo_snr",
  network_rx_entity:"sensor.network_rx",network_tx_entity:"sensor.network_tx"
};
sensor("network_rx", 0.3, "MB/s");
sensor("network_tx", 0.1, "MB/s");
// Forecast subscriptions are local fixtures; no weather service is contacted.
state("weather.demo", "rainy", {
  friendly_name: "Weather", supported_features: 3, temperature: 7.7, temperature_unit: "°C",
  apparent_temperature: 5.2, humidity: 86, wind_speed: 7, wind_bearing: 0,
  wind_speed_unit: "km/h", pressure: 1012, pressure_unit: "hPa", precipitation_unit: "mm",
});
configs.weather = { entity: "weather.demo", name: "Weather" };
const weatherForecasts = {
  daily: [8.5,13.7,13.4,12.9,11.7,14.3,12.6].map((temperature,i)=>({
    datetime: new Date(Date.now()+i*86400000).toISOString(), temperature,
    templow:[3.3,8.5,7.9,7.8,9.2,8.8,8.3][i], precipitation:[27,.7,6.5,2.3,10,1.8,3.3][i],
    precipitation_probability:[95,30,85,65,90,45,70][i], condition:i===2?"lightning-rainy":"rainy",
    wind_speed:[7,5,7,6,5,18,14][i], wind_bearing: i<4?0:225,
  })),
  hourly: Array.from({length:12},(_,i)=>({datetime:new Date(Date.now()+i*3600000).toISOString(),temperature:7.7+i*.2,
    precipitation:Math.max(0,2-i*.2),precipitation_probability:Math.max(0,90-i*5),condition:i>8?"cloudy":"rainy",wind_speed:7,wind_bearing:0})),
  twice_daily: Array.from({length:8},(_,i)=>({datetime:new Date(Date.now()+i*43200000).toISOString(),temperature:i%2?5:10,
    is_daytime:i%2===0,condition:i%2?"clear-night":"partlycloudy",precipitation:0})),
};
const weatherListeners = new Set();
configs["home-3d"] = {
  home_model: "/local/ikio-demo/home-model.json",
  entity_inventory: "/local/ikio-demo/entities.json",
  device_bindings: "/local/ikio-demo/device-bindings.json",
};
for (const item of home3dEntities) state(item.entity, item.demo?.state || "off", { unit_of_measurement: item.demo?.unit || "" });
state("sun.sun", "above_horizon", { azimuth:180,elevation:30 });
const connection = {
  subscribeMessage: async (callback,message) => {
    if (message.type !== "weather/subscribe_forecast") throw Error("Unsupported fixture subscription");
    const listener={callback,type:message.forecast_type};weatherListeners.add(listener);
    queueMicrotask(()=>{if(weatherListeners.has(listener)) callback({type:listener.type,forecast:weatherForecasts[listener.type]});});
    return ()=>weatherListeners.delete(listener);
  },
}, cards = [];
const hass = {
  states,
  entities: {
    "binary_sensor.window": { area_id: "kitchen" },
    "binary_sensor.demo_balcony": { area_id: "living" },
    "binary_sensor.demo_motion": { area_id: "living" },
    "binary_sensor.demo_entrance": { device_id: "demo_contact" },
    "light.strip": { device_id: "living_lamp" },
    "light.glow": { area_id: "living" },
    "switch.entrance": { area_id: "hall" },
  },
  devices: {
    living_lamp: { area_id: "living" },
    demo_contact: { area_id: "hall" },
  },
  areas: {
    living: { name: "Living room" },
    hall: { name: "Entrance" },
    kitchen: { name: "Kitchen" },
  },
  connection,
  locale: { language: "en" },
  services: { alarmo: { arm: {} } },
  config: { time_zone: "Europe/Athens" },
  callWS: async (msg) => {
    if (msg.type === "logbook/get_events")
      return [
        {
          entity_id: "alarm_control_panel.home",
          state: "disarmed",
          context_user_id: "demo-user",
          when: Date.now() / 1000 - 20,
        },
        {
          entity_id: "binary_sensor.demo_motion",
          state: "off",
          when: Date.now() / 1000 - 30,
        },
        {
          entity_id: "binary_sensor.demo_balcony",
          state: "on",
          when: Date.now() / 1000 - 45,
        },
        {
          entity_id: "alarm_control_panel.home",
          state: "armed_away",
          context_user_id: "demo-user",
          when: Date.now() / 1000 - 400,
        },
        ...Array.from({ length: 50 }, (_, i) => ({
          entity_id:
            i % 2 ? "binary_sensor.demo_motion" : "binary_sensor.demo_balcony",
          state: i % 4 < 2 ? "on" : "off",
          when: Date.now() / 1000 - 60 - i * 15,
          context_id: `demo-activity-${i}`,
        })),
      ].filter(
        (entry) =>
          msg.entity_ids.includes(entry.entity_id) &&
          entry.when * 1000 >= Date.parse(msg.start_time) &&
          entry.when * 1000 <= Date.parse(msg.end_time),
      );
    if (msg.type === "alarmo/entities")
      return [{ entity_id: "alarm_control_panel.home", area_id: 1 }];
    if (msg.type === "alarmo/sensors")
      return {
        "binary_sensor.window": { enabled: true, area: 1, type: "window" },
        "binary_sensor.demo_balcony": { enabled: true, area: 1, type: "door" },
        "binary_sensor.demo_motion": { enabled: true, area: 1, type: "motion" },
        "binary_sensor.demo_entrance": { enabled: true, area: 1, type: "door" },
      };
    if (msg.type === "alarmo/countdown") return { delay: 30, remaining: 18 };
    if (msg.type !== "history/history_during_period")
      throw Error("Unexpected mock request: " + msg.type);
    return Object.fromEntries(
      msg.entity_ids.map((id) => [
        id,
        electricityIds.includes(id)
          ? demoPowerHistory(
              id,
              Date.parse(msg.start_time),
              Date.parse(msg.end_time),
            )
          : Array.from({ length: 121 }, (_, i) => ({
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
    if (domain === "select" && data.option) value = data.option;
    if (domain === "media_player" && service === "media_seek") {
      attrs.media_position = data.seek_position;
      attrs.media_position_updated_at = new Date(Date.now()).toISOString();
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
addBatteryFixtures(hass);
// Provide simulated HA tokens for the Vacuum Follow Home Assistant preview.
function applyVacuumTheme(card, theme) {
  if (card.localName !== "ikio-vacuum-card") return;
  const light = theme === "light";
  const tokens = {
    "--ha-card-background": light ? "#f3f7f6" : "#17282e",
    "--secondary-background-color": light ? "#e4eeeb" : "#21353b",
    "--divider-color": light ? "#bdcfca" : "#34474d",
    "--primary-text-color": light ? "#17282e" : "#e5e9e7",
    "--secondary-text-color": light ? "#50645f" : "#a4adb2",
    "--primary-color": light ? "#245d85" : "#90caf9",
    "--warning-color": light ? "#805900" : "#f2c66d",
    "--error-color": light ? "#9a3830" : "#f2a69b",
  };
  for (const [name, value] of Object.entries(tokens)) card.style.setProperty(name, value);
}
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
  applyVacuumTheme(card, "dark");
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
    for (let i = 0; i < cards.length; i++) {
      applyVacuumTheme(cards[i], button.dataset.theme);
      cards[i].setConfig({
        ...configs[types[i]],
        appearance: { theme: button.dataset.theme },
      });
    }
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
  weatherForecasts,
  weatherPush(type, forecast) {
    for(const listener of weatherListeners) if(listener.type === type) listener.callback({type,forecast});
  },
  async configure({ theme = "dark", width = 360, scenario = "normal" } = {}) {
    for (const [i, card] of cards.entries()) {
      applyVacuumTheme(card, theme);
      card.setConfig({ ...configs[types[i]], appearance: { theme } });
    }
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
