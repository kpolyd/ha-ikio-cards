import {
  entity,
  text,
  number,
  bool,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
import { parseBillingCron } from "./billing-cycle.js";
export const fields = [
  entity("power_entity", "Total power", "sensor", true),
  entity(
    "total_energy_entity",
    "Billing-cycle total energy (optional)",
    "sensor",
  ),
  text("billing_cycle_cron", "Billing cycle cron (e.g. 0 0 20 * *)"),
  text("billing_period_label", "Billing-cycle label override (optional)"),
  bool(
    "same_cycle",
    "Energy readings cover the same billing cycle and do not overlap",
  ),
  entity("accrued_bill_entity", "Estimated/accrued bill", "sensor"),
  entity("forecast_bill_entity", "Forecast bill", "sensor"),
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
    name: "energy_readings",
    label: "Billing-cycle energy",
    section: "Billing cycle",
    item: "energy reading",
    helper:
      "Separate, non-overlapping readings from the same billing cycle. Blank colours use the automatic palette.",
    fields: [
      { ...text("label", "Label"), required: true },
      entity("entity", "Energy entity", "sensor", true),
      text("colour", "Colour (optional hex, e.g. #90CAF9)"),
    ],
  },
  {
    name: "circuits",
    label: "Device readings",
    section: "Device power",
    helper:
      "Stable display order. Do not select both a parent circuit and its child.",
    fields: [
      entity("power_entity", "Power sensor", "sensor", true),
      text("name", "Device name"),
    ],
  },
];
export function normalizeConfig(config) {
  const c = structuredClone(config);
  if (c.energy_readings === undefined)
    c.energy_readings = [
      ...(c.day_entity ? [{ label: "Day", entity: c.day_entity }] : []),
      ...(c.night_entity ? [{ label: "Night", entity: c.night_entity }] : []),
    ];
  delete c.day_entity;
  delete c.night_entity;
  delete c.cycle_start_entity;
  delete c.cycle_end_entity;
  delete c.forecast_minimum_hours;
  return c;
}
export function validate(c) {
  validateConfig(c, fields, lists);
  if (c.same_cycle !== undefined && typeof c.same_cycle !== "boolean")
    throw Error("Billing-cycle confirmation must be a toggle");
  const seen = new Set();
  for (const row of c.energy_readings || []) {
    if (
      !row ||
      typeof row.label !== "string" ||
      !row.label.trim() ||
      !row.entity
    )
      throw Error("Each energy reading needs a label and an energy entity");
    if (seen.has(row.entity) || row.entity === c.total_energy_entity)
      throw Error(
        "Energy readings must use distinct entities, separate from total energy",
      );
    seen.add(row.entity);
    if (
      row.colour !== undefined &&
      row.colour !== null &&
      row.colour !== "" &&
      (typeof row.colour !== "string" || !/^#[0-9a-f]{6}$/i.test(row.colour))
    )
      throw Error("Energy reading colours must be six-digit hex values");
  }
  if (
    c.billing_cycle_cron?.trim?.() ||
    (c.billing_cycle_cron !== undefined &&
      typeof c.billing_cycle_cron !== "string")
  )
    parseBillingCron(c.billing_cycle_cron);
  if (
    c.distribution_max_devices !== undefined &&
    !Number.isInteger(c.distribution_max_devices)
  )
    throw Error("Distribution device limit must be a whole number");
  if ((c.expected_min ?? 0) >= (c.expected_max ?? 3500))
    throw Error("Expected minimum must be less than maximum");
}

const selectFields = (...names) =>
  names.map((name) => fields.find((field) => field.name === name));
export const editorOptions = {
  actions: false,
  sections: [
    { label: "Power", fields: selectFields("power_entity") },
    {
      label: "Billing cycle",
      fields: selectFields(
        "billing_cycle_cron",
        "billing_period_label",
        "total_energy_entity",
        "accrued_bill_entity",
        "forecast_bill_entity",
      ),
      footerFields: selectFields("same_cycle"),
    },
    {
      label: "Power history",
      fields: selectFields("hours", "expected_min", "expected_max"),
    },
    {
      label: "Device power",
      fields: [],
      footerFields: selectFields("show_untracked", "non_overlapping"),
    },
    {
      label: "Power distribution",
      fields: selectFields(
        "show_power_distribution",
        "distribution_max_devices",
      ),
    },
  ],
};
