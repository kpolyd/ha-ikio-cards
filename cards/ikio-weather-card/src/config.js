import {
  entity,
  bool,
  choice,
  number,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const periods = ["daily", "hourly", "twice_daily"];
export const periodLabels = {
  daily: "Daily",
  hourly: "Hourly",
  twice_daily: "Day / night",
};
export const sections = [
  {
    label: "Weather",
    fields: [entity("entity", "Weather entity", "weather", true)],
  },
  {
    label: "Current conditions",
    fields: [
      bool("show_current", "Current conditions"),
      bool("show_feels_like", "Feels-like temperature"),
      bool("show_humidity", "Humidity"),
      bool("show_wind", "Wind speed & direction"),
      bool("show_pressure", "Pressure"),
    ],
  },
  {
    label: "Forecast",
    fields: [
      bool("show_forecast", "Show forecast"),
      choice(
        "forecast_type",
        "Default forecast",
        periods.map((value) => ({ value, label: periodLabels[value] })),
      ),
      number("forecast_slots", "Forecast entries", 3, 7),
      bool("show_forecast_conditions", "Condition icons"),
      bool("show_temperature_graph", "Temperature graph"),
      bool("show_precipitation", "Rain amount"),
      bool("show_precipitation_probability", "Rain probability"),
      bool("show_forecast_wind", "Forecast wind"),
    ],
  },
];
export const fields = sections.flatMap((s) => s.fields);
export const defaults = {
  forecast_type: "daily",
  forecast_slots: 7,
  show_current: true,
  show_feels_like: true,
  show_humidity: true,
  show_wind: true,
  show_pressure: false,
  show_forecast: true,
  show_forecast_conditions: true,
  show_temperature_graph: true,
  show_precipitation: true,
  show_precipitation_probability: false,
  show_forecast_wind: false,
};
export function normalizeConfig(config) {
  validateConfig(config, fields);
  if (
    config.forecast_type !== undefined &&
    !periods.includes(config.forecast_type)
  )
    throw Error("Unsupported forecast type");
  if (
    config.forecast_slots !== undefined &&
    !Number.isInteger(config.forecast_slots)
  )
    throw Error("Forecast entries must be a whole number");
  for (const field of fields.filter((f) => f.selector.boolean)) {
    if (
      config[field.name] !== undefined &&
      typeof config[field.name] !== "boolean"
    )
      throw Error("Weather display options must be toggles");
  }
  if (config.name !== undefined && typeof config.name !== "string")
    throw Error("Card name must be text");
  return {
    ...structuredClone(config),
    schema_version: 1,
    ...Object.fromEntries(
      Object.entries(defaults).map(([k, v]) => [k, config[k] ?? v]),
    ),
    appearance: { theme: "dark", ...config.appearance },
  };
}

export const editorOptions = { sections };
