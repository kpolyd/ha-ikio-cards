import {
  entity,
  text,
  bool,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("entity", "Control entity", ["switch", "input_boolean"], true),
  entity("power_entity", "Power sensor", "sensor"),
  entity("energy_entity", "Energy sensor", "sensor"),
  entity("stop_script", "Stop-run script (optional)", "script"),
  bool("confirm_manual_on", "Confirm manual turn-on"),
];
export const lists = [
  {
    name: "timed_runs",
    label: "Backend timed runs",
    helper:
      "Select an existing HA script that schedules the complete run and shutoff. The card does not create a safety timer.",
    fields: [
      text("label", "Run label (for example 30 minutes)"),
      entity("start_script", "Existing timed-run script", "script", true),
      entity("timer_entity", "Backend timer (optional)", "timer"),
    ],
  },
];
export const validate = (c) => validateConfig(c, fields, lists);
