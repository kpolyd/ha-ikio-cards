export const alarmModes = [
  { mode: "home", flag: 1 },
  { mode: "away", flag: 2 },
  { mode: "night", flag: 4 },
  { mode: "vacation", flag: 32 },
  { mode: "custom_bypass", flag: 16 },
];
export function blockedContacts(contacts, states) {
  return contacts.filter((r) => states[r.entity]?.state !== "off");
}
export function forceData(entity, mode, code) {
  return {
    entity_id: entity,
    mode: mode === "custom_bypass" ? "custom" : mode,
    force: true,
    ...(code ? { code } : {}),
  };
}
