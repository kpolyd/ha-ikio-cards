import { IkioLightsCard } from "./card.js";
if (!customElements.get("ikio-lights-card"))
  customElements.define("ikio-lights-card", IkioLightsCard);
window.customCards ||= [];
if (!window.customCards.some((card) => card.type === "ikio-lights-card"))
  window.customCards.push({
    type: "ikio-lights-card",
    name: "Ikio Lights",
    description:
      "Compact lights and switches with location labels and native entity details on hold.",
    preview: true,
    documentationURL:
      "https://github.com/kpolyd/ha-ikio-cards/tree/main/cards/ikio-lights-card",
  });
