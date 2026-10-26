import {
  entity,
  text,
  number,
  choice,
  validateConfig,
} from "@ikio/card-ui/schema-editor";
export const fields = [
  entity("image_entity", "Car image entity (optional)", [
    "image",
    "sensor",
    "device_tracker",
    "camera",
  ]),
  {
    name: "image",
    label: "Car image (optional)",
    selector: { media: { accept: ["image/*"], image_upload: true } },
  },
  text("license_plate", "License plate (optional)"),
  text("plate_country", "Plate country code (default GR, empty to omit)"),
  entity("vin_entity", "VIN sensor (optional)", "sensor"),
  text("image_url", "Car image URL or /local/ path (optional alternative)"),
  entity("fuel_entity", "Fuel level", "sensor"),
  number(
    "fuel_capacity",
    "Fuel capacity (same volume unit as fuel sensor)",
    0.01,
    10000,
    0.1,
  ),
  entity("range_entity", "Remaining range", "sensor"),
  entity("odometer_entity", "Odometer", "sensor"),
  entity("tracker_entity", "Car location", "device_tracker"),
  entity("location_entity", "Parking label (optional)", [
    "sensor",
    "device_tracker",
  ]),
  entity("location_timestamp_entity", "Location update timestamp", "sensor"),
  choice("locks_active_state", "Lock state interpretation", [
    { value: "auto", label: "Automatic (recommended)" },
    { value: "unlocked", label: "Locked/unlocked (legacy automatic)" },
    { value: "on", label: "on means unlocked (standard HA binary sensor)" },
    { value: "off", label: "off means unlocked (inverted binary sensor)" },
  ]),
  choice("doors_active_state", "Door indicator means open when state is", [
    "on",
    "off",
    "open",
  ]),
  choice("windows_active_state", "Window indicator means open when state is", [
    "on",
    "off",
    "open",
  ]),
];
export const lists = ["locks", "doors", "windows"].map((name) => ({
  name,
  label:
    name === "locks"
      ? "Lock status entities"
      : `${name[0].toUpperCase() + name.slice(1)} status entities`,
  helper:
    name === "locks"
      ? "Automatic supports locked/unlocked and HA lock binary sensors (off = locked, on = unlocked). Use the inverted option only if your integration reverses those states."
      : "Choose an aggregate entity or all relevant members. No individual names are displayed on the card.",
  fields: [
    entity(
      "entity",
      "Status entity",
      name === "locks"
        ? ["lock", "binary_sensor", "sensor"]
        : ["binary_sensor", "sensor"],
      true,
    ),
  ],
}));
export const validate = (c) => {
  validateConfig(c, fields, lists);
  if (
    c.image != null &&
    (typeof c.image !== "object" ||
      typeof c.image.media_content_id !== "string")
  )
    throw Error("Choose a car image using the visual editor");
  if (c.plate_country != null && typeof c.plate_country !== "string")
    throw Error("Plate country code must be text");
  if (c.license_plate != null && typeof c.license_plate !== "string")
    throw Error("License plate must be text");
  if (c.image_url != null && typeof c.image_url !== "string")
    throw Error("Car image URL must be text");
};
