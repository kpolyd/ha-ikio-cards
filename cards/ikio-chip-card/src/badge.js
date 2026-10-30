import { Card } from "./card.js";
import { el } from "@ikio/card-ui";

// Reuse the approved chip, editor and interactions in HA's badge surface.
// Disable inline-size containment so a badge can size itself to its content.
export class Badge extends Card {
  constructor() {
    super();
    this.shadowRoot.append(
      el(
        "style",
        ":host{display:inline-block;container-type:normal;width:max-content;max-width:100%}",
      ),
    );
  }
}
if (!customElements.get("ikio-chip-badge"))
  customElements.define("ikio-chip-badge", Badge);
window.customBadges ||= [];
if (!window.customBadges.some((badge) => badge.type === "ikio-chip-badge"))
  window.customBadges.push({
    type: "ikio-chip-badge",
    name: "Ikio Chip",
    description:
      "A compact sensor chip with an optional name and icon override.",
    preview: true,
    documentationURL:
      "https://github.com/kpolyd/ha-ikio-cards/tree/main/cards/ikio-chip-card#dashboard-badges",
  });
