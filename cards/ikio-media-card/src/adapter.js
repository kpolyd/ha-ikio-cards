import { features } from "@ikio/card-ui";
export const flags = {
  pause: 1,
  seek: 2,
  volume: 4,
  mute: 8,
  volumeStep: 1024,
  previous: 16,
  next: 32,
  on: 128,
  off: 256,
  source: 2048,
  stop: 4096,
  play: 16384,
};
export function transport(state) {
  const result = [];
  if (features(state, 16))
    result.push({
      icon: "mdi:skip-previous",
      label: "Previous",
      service: "media_previous_track",
    });
  if (state?.state === "playing" && features(state, 1))
    result.push({
      icon: "mdi:pause",
      label: "Pause",
      service: "media_pause",
      target: "paused",
    });
  else if (features(state, 16384))
    result.push({
      icon: "mdi:play",
      label: "Play",
      service: "media_play",
      target: "playing",
    });
  if (features(state, 32))
    result.push({
      icon: "mdi:skip-next",
      label: "Next",
      service: "media_next_track",
    });
  return result;
}
export function position(state, now = Date.now()) {
  const a = state?.attributes || {},
    duration = Number(a.media_duration),
    base = Number(a.media_position),
    at = Date.parse(a.media_position_updated_at);
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(base))
    return null;
  if (
    [a.media_duration, a.media_position].some(
      (v) => v === null || v === undefined || String(v).trim() === "",
    )
  )
    return null;
  const value =
    base +
    (state.state === "playing" && Number.isFinite(at)
      ? Math.max(0, now - at) / 1000
      : 0);
  return { value: Math.min(duration, Math.max(0, value)), duration };
}
export function safeImage(url, hass) {
  if (!url) return null;
  if (
    typeof url === "string" &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url)
  )
    return url;
  try {
    const resolved = new URL(
      url,
      hass?.hassUrl?.("/") || globalThis.location?.origin || "http://localhost",
    );
    return ["https:", "http:"].includes(resolved.protocol)
      ? resolved.href
      : null;
  } catch {
    return null;
  }
}

export function volumeLevel(state) {
  const value = state?.attributes?.volume_level;
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? value
    : null;
}
export function playbackTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  return (
    (hours ? `${hours}:` : "") +
    `${hours ? String(Math.floor(value / 60) % 60).padStart(2, "0") : Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`
  );
}
