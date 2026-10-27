// Deterministic six-hour household profile shared by every demo. No real entities.
export const electricityIds = [
  "sensor.total",
  "sensor.office",
  "sensor.tv",
  "sensor.ac",
  "sensor.dry",
  "sensor.heater",
];
export function demoPower(id, progress) {
  const minute = Math.max(0, Math.min(360, progress * 360));
  const active = (start, end) => minute >= start && minute < end;
  const office = Math.round(
    62 +
      12 * Math.sin(minute / 13) +
      (active(55, 130) || active(220, 320) ? 115 : 0),
  );
  const tv = active(170, 355) ? Math.round(92 + 8 * Math.sin(minute / 9)) : 4;
  const ac =
    active(105, 165) || active(235, 295)
      ? Math.round(620 + 110 * Math.sin(minute / 17))
      : 0;
  const dry =
    active(25, 95) || active(185, 270)
      ? Math.round(205 + 8 * Math.sin(minute / 7))
      : 0;
  const heater = active(65, 85) || active(245, 270) ? 2300 : 0;
  const background = Math.round(
    90 +
      (Math.floor(minute / 22) % 3 === 0 ? 75 : 0) +
      7 * Math.sin(minute / 8),
  );
  // Short kitchen bursts, distinct from the individually metered appliances.
  const kitchen = active(118, 124) || active(310, 316) ? 1900 : 0;
  return {
    "sensor.office": office,
    "sensor.tv": tv,
    "sensor.ac": ac,
    "sensor.dry": dry,
    "sensor.heater": heater,
    "sensor.total": office + tv + ac + dry + heater + background + kitchen,
  }[id];
}
export function demoPowerHistory(id, start, end) {
  // 30-second samples include both endpoints and remain consistent across series.
  const count = 721;
  return Array.from({ length: count }, (_, i) => ({
    lu: (start + ((end - start) * i) / (count - 1)) / 1000,
    s: String(demoPower(id, i / (count - 1))),
    a: { unit_of_measurement: "W" },
  }));
}
export function applyDemoPower(states) {
  for (const id of electricityIds)
    if (states[id])
      states[id] = { ...states[id], state: String(demoPower(id, 1)) };
}
