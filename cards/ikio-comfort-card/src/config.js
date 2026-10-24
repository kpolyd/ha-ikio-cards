import { entity, choice, validateConfig } from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("temperature_entity", "Room temperature", "sensor"),
  entity("humidity_entity", "Room humidity", "sensor"),
  entity("fridge_entity", "Fridge temperature (separate reading)", "sensor"),
  entity("climate_entity", "Air conditioner / thermostat", "climate"),
  entity("humidifier_entity", "Humidifier / dehumidifier", "humidifier"),
  entity("fan_entity", "Fan", "fan"),
  choice("default_device", "Initially selected device", [
    "climate",
    "humidifier",
    "fan",
  ]),
  entity("climate_power_entity", "Air conditioner power", "sensor"),
  entity("humidifier_power_entity", "Dehumidifier power", "sensor"),
  entity("fan_power_entity", "Fan power", "sensor"),
];
export const lists = [];
export const validate = (c) => validateConfig(c, fields, lists);
