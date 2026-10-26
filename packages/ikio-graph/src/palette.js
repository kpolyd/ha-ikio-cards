// Approved Ikio chart palette. Preserve all normalized value positions.
export const darkGraphStops = [
  [0, "#a4e4b8"],
  [100, "#8edaa4"],
  [200, "#79cf91"],
  [380, "#f2d487"],
  [500, "#f2c66d"],
  [700, "#f2b66d"],
  [950, "#ed9c6e"],
  [1500, "#ed876f"],
  [2200, "#e56868"],
  [3500, "#c47dd4"],
];
export const lightGraphStops = [
  [0, "#48835b"],
  [100, "#3b8052"],
  [200, "#2f7b48"],
  [380, "#937323"],
  [500, "#9b7128"],
  [700, "#a66a30"],
  [950, "#b25e3b"],
  [1500, "#bb5142"],
  [2200, "#be424b"],
  [3500, "#9553a7"],
];

export function graphPalette(theme = "dark", hass) {
  return theme === "light" ||
    (theme === "ha" && hass?.themes?.darkMode === false)
    ? lightGraphStops
    : darkGraphStops;
}
