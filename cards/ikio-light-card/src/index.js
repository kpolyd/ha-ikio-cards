import { IkioLightCard } from "./card.js";
if (!customElements.get("ikio-light-card"))
  customElements.define("ikio-light-card", IkioLightCard);
window.customCards ||= [];
if (!window.customCards.some((card) => card.type === "ikio-light-card"))
  window.customCards.push({
    type: "ikio-light-card",
    name: "Ikio Lights",
    description:
      "Compact lights and switches with location labels and native entity details on hold.",
    preview: true,
    documentationURL:
      "https://github.com/kpolyd/ha-ikio-cards/tree/main/cards/ikio-light-card",
  });
