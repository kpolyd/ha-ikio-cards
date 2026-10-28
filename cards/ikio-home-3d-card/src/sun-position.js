export function sunDirection(state, floorPlanBearing = 0) {
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
