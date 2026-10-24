import { features } from "@ikio/card-ui";
export function primary(state) {
  if (
    ["docked", "idle", "paused"].includes(state?.state) &&
    features(state, 8192)
  )
    return {
      service: "start",
      label: state.state === "paused" ? "Resume" : "Start cleaning",
      icon: "mdi:play",
    };
  if (state?.state === "cleaning") {
    if (features(state, 4))
      return { service: "pause", label: "Pause", icon: "mdi:pause" };
    if (features(state, 8))
      return { service: "stop", label: "Stop", icon: "mdi:stop" };
  }
  return null;
}
