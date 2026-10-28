// SVG paths live here so label renderers do not duplicate icon markup.
export const icons = {
  "Air conditioner":
    '<rect x="3" y="4" width="18" height="9" rx="2"/><path d="M6 10h12M7 16v4m5-4v3m5-3v4"/>',
  TV: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  Dehumidifier:
    '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M8 6h8m-8 3h8m-4 3s-3 3-3 5a3 3 0 0 0 6 0c0-2-3-5-3-5Z"/>',
  fridge:
    '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 9h14M8 5v2m0 5v4"/>',
  motion:
    '<circle cx="12" cy="5" r="2.5"/><path d="M8 21v-6l-3-3 4-4h6l4 4-3 3v6M9 9l-1 5h8l-1-5M12 14v7"/>',
  window:
    '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>',
  door: '<path d="M5 21V3h14v18M3 21h18M15 12h.01"/>',
};
export function svg(name, size, strokeWidth = 1.8) {
  if (!icons[name]) throw new Error("Unknown icon: " + name);
  const dimensions = size == null ? "" : ` width="${size}" height="${size}"`;
  return `<svg viewBox="0 0 24 24"${dimensions} fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
