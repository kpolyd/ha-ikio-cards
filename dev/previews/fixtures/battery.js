// Fictional integration data; no household device bindings.
export function addBatteryFixtures(hass) {
  const data = [
    [
      "entrance",
      "Entrance contact",
      "Hallway",
      12,
      "CR2032",
      1,
      "mdi:door-closed",
    ],
    [
      "bathroom",
      "Temperature sensor",
      "Bathroom",
      25,
      "AAA",
      2,
      "mdi:thermometer",
    ],
    [
      "living",
      "Motion sensor",
      "Living room",
      45,
      "CR2450",
      1,
      "mdi:motion-sensor",
    ],
    ["phone", "Phone", "", 50, "Li-ion", 1, "mdi:cellphone"],
    ["kitchen", "Motion sensor", "Kitchen", 75, "", 1, "mdi:motion-sensor"],
    ["tablet", "Tablet", "", 80, "Li-ion", 1, "mdi:tablet"],
    [
      "window",
      "Window contact",
      "Bedroom",
      83,
      "CR1632",
      1,
      "mdi:window-closed-variant",
    ],
    [
      "office",
      "Temperature sensor",
      "Office",
      90,
      "CR2032",
      1,
      "mdi:thermometer",
    ],
  ];
  for (const [key, name, area, value, type, quantity, icon] of data) {
    const id = `sensor.demo_battery_${key}`,
      device = `demo_battery_${key}`;
    hass.states[id] = {
      entity_id: id,
      state: String(value),
      attributes: {
        friendly_name: name,
        device_class: "battery",
        unit_of_measurement: "%",
        battery_type: type,
        battery_quantity: quantity,
        icon,
      },
      last_updated: new Date(
        Date.now() - (value === 12 ? 20 : value === 25 ? 2880 : 3) * 60000,
      ).toISOString(),
    };
    hass.entities[id] = { device_id: device };
    hass.devices[device] = { name, area_id: area ? device : undefined };
    if (area) hass.areas[device] = { name: area };
  }
}
