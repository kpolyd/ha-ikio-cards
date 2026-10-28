// Null means unavailable: retain the last valid lighting level.
export function daylightForSun(sun) {
  const elevation = sun?.attributes?.elevation;
  if (
    !sun ||
    ["unknown", "unavailable"].includes(sun.state) ||
    !Number.isFinite(elevation) ||
    elevation < -90 ||
    elevation > 90
  )
    return null;
  return Math.max(0, Math.min(1, (elevation + 6) / 12));
}
