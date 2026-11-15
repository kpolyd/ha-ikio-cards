const DAY = 24 * 60 * 60 * 1000;
const EVENT_MARGIN = 30 * 60 * 1000;

// HA provides upcoming events. Offset the following day's corresponding
// event to estimate the last transition on this sunrise-to-sunrise timeline.
export function solarTimeline(sun, now) {
  const night = sun?.state === "below_horizon";
  if (!night && sun?.state !== "above_horizon") return null;
  const rise = Date.parse(sun.attributes?.next_rising);
  const set = Date.parse(sun.attributes?.next_setting);
  if (
    !Number.isFinite(now) ||
    ![rise, set].every(
      (event) =>
        event >= now - EVENT_MARGIN && event <= now + DAY + EVENT_MARGIN,
    )
  )
    return null;

  const start = rise - DAY;
  const sunset = night ? set - DAY : set;
  if (!(start < sunset && sunset < rise)) return null;

  const from = night ? sunset : start;
  const to = night ? rise : sunset;
  const current = Math.min(to, Math.max(from, now));
  return {
    daylight: (sunset - start) / DAY,
    position: (current - start) / DAY,
    progress: (current - from) / (to - from),
  };
}

export function sunAngles(state) {
  if (!state || ["unknown", "unavailable"].includes(state.state)) return null;
  const { azimuth, elevation } = state.attributes || {};
  if (
    !Number.isFinite(azimuth) ||
    !Number.isFinite(elevation) ||
    azimuth < 0 ||
    azimuth > 360 ||
    elevation < -90 ||
    elevation > 90
  )
    return null;
  return { azimuth, elevation };
}

export function sunDirection(state, floorPlanBearing = 0) {
  const angles = sunAngles(state);
  if (!angles) return null;
  const { azimuth, elevation } = angles;
  const bearing = ((azimuth - floorPlanBearing) * Math.PI) / 180;
  const altitude = (elevation * Math.PI) / 180;
  // World +X is screen-right and -Z is screen-up in the default top view.
  // The apartment root's rotation is already reflected in that view; do not
  // rotate this world-space direction by the root rotation a second time.
  return {
    x: Math.sin(bearing) * Math.cos(altitude),
    y: Math.sin(altitude),
    z: -Math.cos(bearing) * Math.cos(altitude),
    aboveHorizon: elevation > 0,
  };
}
