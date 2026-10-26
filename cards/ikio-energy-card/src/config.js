import {
  entity,
  text,
  number,
  bool,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("power_entity", "Total power", "sensor", true),
  entity("day_entity", "Billing-cycle day energy", "sensor"),
  entity("night_entity", "Billing-cycle night energy", "sensor"),
  entity(
    "total_energy_entity",
    "Billing-cycle total energy (optional)",
    "sensor",
  ),
  text("billing_period_label", "Billing-cycle dates/label"),
  bool("same_cycle", "Day and night entities cover the same billing cycle"),
  entity("cycle_start_entity", "Billing-cycle start timestamp", [
    "sensor",
    "input_datetime",
  ]),
  entity("cycle_end_entity", "Billing-cycle end timestamp", [
    "sensor",
    "input_datetime",
  ]),
  entity("accrued_bill_entity", "Estimated/accrued bill", "sensor"),
  entity("forecast_bill_entity", "Forecast bill", "sensor"),
  entity("forecast_valid_entity", "Forecast validity", [
    "binary_sensor",
    "input_boolean",
  ]),
  number(
    "forecast_minimum_hours",
    "Minimum forecast age (hours)",
    0,
    8760,
    0.5,
  ),
  entity("untracked_entity", "Existing untracked-power sensor", "sensor"),
  bool("show_untracked", "Show calculated untracked power"),
  bool("non_overlapping", "Selected circuits do not overlap"),
  bool("show_power_distribution", "Show labelled power distribution rings"),
  number(
    "distribution_max_devices",
    "Distribution device limit (smaller devices become Other)",
    1,
    20,
  ),
  number("hours", "Power history hours", 1, 168),
  number("expected_min", "Expected minimum power", -1e9, 1e9, 0.01),
  number("expected_max", "Expected maximum power", -1e9, 1e9, 0.01),
];
export const lists = [
  {
    name: "circuits",
    label: "Device power",
    helper:
      "Stable display order. Do not select both a parent circuit and its child.",
    fields: [
      entity("power_entity", "Power sensor", "sensor", true),
      text("name", "Device name"),
    ],
  },
];
export function validate(c) {
  validateConfig(c, fields, lists);
  if (
    c.distribution_max_devices !== undefined &&
    !Number.isInteger(c.distribution_max_devices)
  )
    throw Error("Distribution device limit must be a whole number");
  if ((c.expected_min ?? 0) >= (c.expected_max ?? 3500))
    throw Error("Expected minimum must be less than maximum");
}
