import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

test("all renamed cards and editors register with current names and no legacy aliases", async () => {
  const dom = new JSDOM("<body/>", { url: "http://localhost" });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  const names = {
    lights: "Lights",
    electricity: "Electricity",
    vehicle: "Vehicle",
    alarmo: "Alarmo",
    "server-monitor": "Server Monitor",
    router: "Router",
    weather: "Weather",
    climate: "Climate",
    dehumidifier: "Dehumidifier",
    media: "Media",
    camera: "Camera",
    vacuum: "Vacuum",
    appliances: "Appliances",
    graph: "Graph",
    chip: "Chip",
  };
  for (const [slug, name] of Object.entries(names)) {
    const id = `ikio-${slug}-card`;
    await import(`../../../cards/${id}/src/index.js`);
    const Card = customElements.get(id);
    assert.ok(Card, id);
    assert.equal(
      window.customCards.find((c) => c.type === id)?.name,
      `Ikio ${name}`,
    );
    const editor = await Card.getConfigElement();
    assert.equal(editor.localName, `${id}-editor`);
    const card = document.createElement(id);
    card.setConfig(Card.getStubConfig());
    card.hass = { states: {} };
    document.body.append(card);
    assert.ok(card.shadowRoot.textContent.length, id);
    card.remove();
  }
  assert.equal(window.customCards.length, 15);
  for (const old of [
    "light",
    "energy",
    "drive",
    "security",
    "system",
    "comfort",
    "cleaning",
    "appliance",
  ])
    assert.equal(customElements.get(`ikio-${old}-card`), undefined);
  dom.window.close();
});
