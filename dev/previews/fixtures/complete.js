// Fully populated, fictional examples. Keep optional bindings local to the demo.
export function completeDemo(states, configs) {
  const put = (id, value, attributes = {}) => {
    states[id] = {
      entity_id: id,
      state: String(value),
      attributes: {
        friendly_name: id.split(".")[1].replaceAll("_", " "),
        ...attributes,
      },
      last_changed: new Date(Date.now() - 720000).toISOString(),
      last_updated: new Date(Date.now() - 120000).toISOString(),
    };
  };
  const sensor = (key, value, unit, attributes = {}) =>
    put(`sensor.${key}`, value, { unit_of_measurement: unit, ...attributes });
  states["sensor.demo_battery_kitchen"].attributes.battery_type = "CR2450";

  Object.assign(configs.battery, {
    name: "Batteries",
    low_threshold: 25,
    collapse_threshold: 80,
    ignored_devices: ["demo_battery_phone"],
  });
  Object.assign(configs.entity, { icon: "mdi:lamp" });
  configs["home-3d"].name = "Home 3D";
  for (const row of configs.lights.lights)
    row.icon = row.entity.startsWith("switch.")
      ? "mdi:power-socket-eu"
      : "mdi:lightbulb-outline";

  sensor("demo_climate_power", 684, "W", { device_class: "power" });
  sensor("temperature", 23.4, "°C", { device_class: "temperature" });
  sensor("humidity", 62, "%", { device_class: "humidity" });
  put("select.demo_horizontal_position", "Centre", {
    options: ["Left", "Centre", "Right", "Swing"],
  });
  put("number.demo_vertical_position", 3, { min: 1, max: 5, step: 1 });
  Object.assign(states["climate.room"].attributes, {
    supported_features: 1 | 8 | 16 | 32 | 512,
    current_temperature: 23.4,
    current_humidity: 62,
    swing_horizontal_modes: ["off", "on"],
    swing_horizontal_mode: "off",
  });
  Object.assign(configs.climate, {
    power_entity: "sensor.demo_climate_power",
    temperature_step: 1,
    show_fan: true,
    show_preset: true,
    show_swing: true,
    show_horizontal: true,
    show_vertical: true,
    horizontal_position_entity: "select.demo_horizontal_position",
    vertical_position_entity: "number.demo_vertical_position",
  });
  Object.assign(configs.dehumidifier, {
    humidity_entity: "sensor.humidity",
    tank_full_state: "on",
    humidity_step: 5,
    show_mode: true,
  });
  Object.assign(configs.media, {
    show_volume: true,
    volume_step: 5,
    show_source: true,
  });
  // All native vacuum controls are capability-derived; there are no extra slots.
  Object.assign(states["vacuum.robot"].attributes, {
    supported_features: 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128 | 256 | 512 | 8192,
    status: "Docked",
    battery_level: 86,
  });
  Object.assign(configs.alarmo, {
    modes: ["home", "away", "night", "vacation", "custom_bypass"],
    allow_override: true,
    show_activity: true,
    activity_hours: 24,
    motion: [
      { entity: "binary_sensor.demo_motion", name: "Living room motion" },
    ],
  });
  states["alarm_control_panel.home"].attributes.supported_features =
    1 | 2 | 4 | 16 | 32;

  sensor("day", 186.4, "kWh");
  sensor("night", 74.2, "kWh");
  sensor("demo_total_energy", 260.6, "kWh");
  sensor("bill", 64.8, "€");
  sensor("forecast", 77.3, "€");
  put("sensor.demo_cycle_start", "2026-10-01T00:00:00+03:00", {
    device_class: "timestamp",
  });
  put("sensor.demo_cycle_end", "2026-11-01T00:00:00+02:00", {
    device_class: "timestamp",
  });
  put("binary_sensor.demo_forecast_valid", "on");
  const metered = configs.electricity.circuits.reduce(
    (sum, row) => sum + Number(states[row.power_entity].state),
    0,
  );
  sensor("demo_untracked", Number(states["sensor.total"].state) - metered, "W");
  Object.assign(configs.electricity, {
    total_energy_entity: "sensor.demo_total_energy",
    billing_cycle_cron: "0 0 1 * *",
    cycle_start_entity: "sensor.demo_cycle_start",
    cycle_end_entity: "sensor.demo_cycle_end",
    forecast_valid_entity: "binary_sensor.demo_forecast_valid",
    forecast_minimum_hours: 24,
    untracked_entity: "sensor.demo_untracked",
    distribution_max_devices: 8,
    expected_min: 0,
    expected_max: 4500,
  });

  sensor("ram", 30, "%");
  sensor("demo_ram_total", 16, "GiB");
  sensor("demo_disk_total", 1000, "GB");
  sensor("uptime", 219.6, "h");
  const server = configs["server-monitor"];
  Object.assign(server, {
    ram_total_entity: "sensor.demo_ram_total",
    ram_percent_entity: "sensor.ram",
    disk_total_entity: "sensor.demo_disk_total",
    disk_percent_entity: "sensor.disk",
  });
  server.extra_readings.forEach((row, i) =>
    Object.assign(row, {
      show_name: true,
      icon: ["mdi:database", "mdi:docker", "mdi:backup-restore"][i],
    }),
  );
  server.services.forEach((row, i) => {
    row.restart_action = `button.demo_restart_${i}`;
    put(row.restart_action, new Date(Date.now() - 3 * 3600000).toISOString(), {
      friendly_name: `Restart ${row.name}`,
      icon: "mdi:restart",
    });
  });

  put("sensor.demo_parking", "Home garage");
  sensor("fuel", 38.7, "L");
  // Synthetic coordinates enable the map control without a real vehicle location.
  Object.assign(states["device_tracker.car"].attributes, {
    latitude: 0,
    longitude: 0,
  });
  put(
    "sensor.demo_location_updated",
    new Date(Date.now() - 12 * 60000).toISOString(),
    {
      device_class: "timestamp",
    },
  );
  Object.assign(configs.vehicle, {
    license_plate: "IOT - 6969",
    fuel_capacity: 45,
    location_entity: "sensor.demo_parking",
    location_timestamp_entity: "sensor.demo_location_updated",
    locks_active_state: "auto",
    doors_active_state: "on",
    windows_active_state: "on",
    // Supported alternative image inputs point to the same bundled demo artwork.
    image: {
      media_content_id: states["image.demo_vehicle"].attributes.entity_picture,
      media_content_type: "image/png",
    },
    image_url: states["image.demo_vehicle"].attributes.entity_picture,
  });
  Object.assign(configs.chip, { show_name: true, icon: "mdi:database" });
  Object.assign(configs.graph, {
    show_legend: true,
    entities: [
      {
        entity: "sensor.demo_graph_power",
        name: "Home",
        expected_min: 0,
        expected_max: 3500,
      },
      {
        entity: "sensor.office",
        name: "Office",
        expected_min: 0,
        expected_max: 250,
      },
    ],
  });

  sensor("demo_router_temperature", 43, "°C", { device_class: "temperature" });
  Object.assign(configs.router, {
    connected_state: "on",
    history_minutes: 30,
    graph_height: 132,
    rsrp_min: -130,
    rsrp_max: -60,
    rsrp_warning: -90,
    rsrp_critical: -110,
    rsrq_min: -20,
    rsrq_max: -3,
    rsrq_warning: -10,
    rsrq_critical: -15,
    snr_min: -10,
    snr_max: 30,
    snr_warning: 13,
    snr_critical: 0,
    extra_readings: [
      {
        entity: "sensor.demo_router_temperature",
        name: "Temperature",
        show_name: true,
      },
    ],
  });
  Object.assign(configs.weather, {
    show_current: true,
    show_feels_like: true,
    show_humidity: true,
    show_wind: true,
    show_pressure: true,
    show_forecast: true,
    forecast_type: "daily",
    forecast_slots: 7,
    show_forecast_conditions: true,
    show_temperature_graph: true,
    show_precipitation: true,
    show_precipitation_probability: true,
    show_forecast_wind: true,
  });
  configs["mini-graph"] = {
    name: "Living room",
    primary_entity: "sensor.temperature",
    secondary_entity: "sensor.humidity",
    hours: 6,
    graph_height: 32,
    expected_min: 18,
    expected_max: 28,
    show_extrema: true,
    show_time_labels: true,
  };
  for (const config of Object.values(configs))
    config.appearance = { theme: "dark" };
}
