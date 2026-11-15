import { element as el, formatNumber, language, t } from "@ikio/card-ui";
import { solarTimeline, sunAngles } from "./sun-position.js";

const BEARINGS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const LEFT = 4;
const RIGHT = 86;
const HORIZON = 16;
const DAY_PEAK = -22;
const NIGHT_PEAK = 16;

export function createSunGraph() {
  const element = el("div", undefined, "sun-graph");
  element.hidden = true;
  element.setAttribute("role", "img");
  element.innerHTML = `
    <span class="sun-reading" aria-hidden="true"><ha-icon></ha-icon><span></span></span>
    <svg class="sun-curve" viewBox="0 0 90 30" aria-hidden="true">
      <line class="sun-horizon" x1="${LEFT}" y1="${HORIZON}" x2="${RIGHT}" y2="${HORIZON}"/>
      <line class="sunset-line" y1="5" y2="26"/>
      <path class="day-arc"/>
      <path class="night-arc"/>
      <circle class="sun-marker" r="3.5"/>
    </svg>`;
  const icon = element.querySelector("ha-icon");
  const reading = element.querySelector(".sun-reading span");
  const curve = element.querySelector(".sun-curve");
  const sunset = curve.querySelector(".sunset-line");
  const dayArc = curve.querySelector(".day-arc");
  const nightArc = curve.querySelector(".night-arc");
  const marker = curve.querySelector(".sun-marker");
  let previousSun, previousLanguage, previousNumberFormat;

  return {
    element,
    update(sun, hass) {
      const locale = language(hass);
      const numberFormat = hass?.locale?.number_format;
      if (
        sun === previousSun &&
        locale === previousLanguage &&
        numberFormat === previousNumberFormat
      )
        return;
      previousSun = sun;
      previousLanguage = locale;
      previousNumberFormat = numberFormat;
      const night = sun?.state === "below_horizon";
      element.hidden = !night && sun?.state !== "above_horizon";
      if (element.hidden) return;
      element.toggleAttribute("data-night", night);
      icon.setAttribute(
        "icon",
        night ? "mdi:weather-night" : "mdi:weather-sunny",
      );

      const angles = sunAngles(sun);
      let label = night ? t(hass, "Night") : t(hass, "Day");
      if (!night && angles) {
        const bearing =
          BEARINGS[Math.round(angles.azimuth / 45) % BEARINGS.length];
        label = `${t(hass, bearing)} ${formatNumber(hass, angles.elevation, 0)}°`;
      }
      reading.textContent = label;
      const timeline = solarTimeline(sun, Date.now());
      curve.toggleAttribute("hidden", !timeline);
      if (!timeline) {
        element.setAttribute(
          "aria-label",
          t(hass, "Sun position: {reading}", { reading: label }),
        );
        return;
      }
      const { daylight, position, progress } = timeline;
      const sunsetX = LEFT + daylight * (RIGHT - LEFT);
      const x = LEFT + position * (RIGHT - LEFT);
      const peak = night ? NIGHT_PEAK : DAY_PEAK;
      const y = HORIZON + 2 * progress * (1 - progress) * peak;
      sunset.setAttribute("x1", sunsetX);
      sunset.setAttribute("x2", sunsetX);
      dayArc.setAttribute(
        "d",
        `M ${LEFT} ${HORIZON} Q ${(LEFT + sunsetX) / 2} ${HORIZON + DAY_PEAK} ${sunsetX} ${HORIZON}`,
      );
      nightArc.setAttribute(
        "d",
        `M ${sunsetX} ${HORIZON} Q ${(sunsetX + RIGHT) / 2} ${HORIZON + NIGHT_PEAK} ${RIGHT} ${HORIZON}`,
      );
      marker.setAttribute("cx", x);
      marker.setAttribute("cy", y);
      const percent = formatNumber(hass, 100 * (1 - progress), 0);
      element.setAttribute(
        "aria-label",
        night
          ? t(hass, "Night. About {percent}% of the night remains.", {
              percent,
            })
          : t(hass, "{reading}. About {percent}% of daylight remains.", {
              reading: label,
              percent,
            }),
      );
    },
  };
}
