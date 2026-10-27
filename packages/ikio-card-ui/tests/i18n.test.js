import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { t, language } from "../src/i18n.js";
import { catalogs } from "../src/translations/index.js";
let dom;
before(async () => {
  dom = new JSDOM("<body></body>", { url: "http://localhost" });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  customElements.define("ha-form", class extends HTMLElement {});
  await import("../../../cards/ikio-climate-card/src/index.js");
  await import("../../../cards/ikio-lights-card/src/index.js");
  await import("../../../cards/ikio-chip-card/src/index.js");
});
after(() => dom.window.close());
test("language uses HA preference, regional variants and English fallback", () => {
  assert.equal(
    language({ locale: { language: "el_GR" }, language: "en" }),
    "el-gr",
  );
  assert.equal(
    t({ locale: { language: "el-GR" } }, "Current power"),
    "Τρέχουσα ισχύς",
  );
  assert.equal(t({ language: "el" }, "Device settings"), "Ρυθμίσεις συσκευής");
  assert.equal(
    t({ locale: { language: "fr" } }, "Current power"),
    "Current power",
  );
  assert.equal(t(undefined, "Current power"), "Current power");
  assert.equal(t("el", "Last {count} hours", { count: 1 }), "Τελευταία 1 ώρα");
  assert.equal(
    t("el", "Last {count} hours", { count: 24 }),
    "Τελευταίες 24 ώρες",
  );
  assert.equal(
    t("el", "{count} sensors bypassed", { count: 1 }),
    "1 αισθητήρας σε παράκαμψη",
  );
  assert.equal(
    t("el", "License plate: {p0}", { p0: "<Home & Away>" }),
    "Πινακίδα κυκλοφορίας: <Home & Away>",
  );
  assert.equal(
    t("el", "unregistered integration value"),
    "unregistered integration value",
  );
  const saved = catalogs.el.Power;
  delete catalogs.el.Power;
  assert.equal(t("el", "Power"), "Power");
  catalogs.el.Power = saved;
});
test("catalog key coverage, nonempty messages and placeholders match English", async () => {
  await import("../../../scripts/check-translations.mjs");
});
test("climate language changes preserve entity names, native options, config and service data", async () => {
  const card = document.createElement("ikio-climate-card");
  card.setConfig({ climate_entity: "climate.test", name: "Heat" });
  document.body.append(card);
  const calls = [];
  const state = {
    entity_id: "climate.test",
    state: "cool",
    attributes: {
      temperature: 22,
      min_temp: 16,
      max_temp: 30,
      target_temp_step: 1,
      supported_features: 9,
      fan_modes: ["Quiet", "Turbo"],
      fan_mode: "Quiet",
      hvac_modes: ["off", "cool", "heat"],
      current_temperature: 24,
    },
  };
  const hass = {
    locale: { language: "en" },
    states: { "climate.test": state },
    callService: async (...a) => calls.push(a),
  };
  card.hass = hass;
  const config = structuredClone(card.config);
  assert.match(card.content.textContent, /Target/);
  card.hass = { ...hass, locale: { language: "el" } };
  assert.equal(card.content.querySelector(".ae-title").textContent, "Heat");
  assert.match(card.content.textContent, /Στόχος/);
  assert.match(card.content.textContent, /Ψύξη/);
  assert.match(card.content.textContent, /Quiet/);
  card.content.querySelector('[data-key="heat"]').click();
  await Promise.resolve();
  assert.deepEqual(calls[0], [
    "climate",
    "set_hvac_mode",
    { hvac_mode: "heat", entity_id: "climate.test" },
  ]);
  assert.deepEqual(card.config, config);
  card.remove();
});
test("editor labels and options follow HA without translating configuration values or metadata", async () => {
  const C = customElements.get("ikio-climate-card"),
    editor = await C.getConfigElement();
  editor.setConfig({
    climate_entity: "climate.test",
    name: "Power",
    grid_options: { columns: 6 },
  });
  editor.hass = { locale: { language: "el" }, states: {} };
  document.body.append(editor);
  await new Promise((r) => setTimeout(r, 0));
  let form = editor.shadowRoot.querySelector("ha-form");
  assert.equal(
    form.computeLabel({ name: "climate_entity" }),
    "Οντότητα κλιματισμού",
  );
  const appearance = [...editor.shadowRoot.querySelectorAll("ha-form")].at(-1);
  assert.equal(appearance.schema[0].selector.select.options[0].value, "dark");
  assert.equal(
    appearance.schema[0].selector.select.options[0].label,
    "Ikio σκούρο",
  );
  assert.equal(form.data.name, "Power");
  assert.deepEqual(form.data.grid_options, { columns: 6 });
  editor.hass = { locale: { language: "en" }, states: {} };
  form = editor.shadowRoot.querySelector("ha-form");
  assert.equal(form.computeLabel({ name: "climate_entity" }), "Climate entity");
  editor.remove();
});
test("persistent Lights and Chip badge respond to language changes while preserving custom names", () => {
  const lights = document.createElement("ikio-lights-card");
  lights.setConfig({ lights: [{ entity: "light.test", name: "Lights" }] });
  document.body.append(lights);
  const state = {
    entity_id: "light.test",
    state: "on",
    attributes: { friendly_name: "Power" },
  };
  const hass = { locale: { language: "en" }, states: { "light.test": state } };
  lights.hass = hass;
  const node = lights.content.querySelector(".toggle");
  lights.hass = { ...hass, locale: { language: "el" } };
  assert.equal(lights.content.querySelector("h2").textContent, "Φωτισμός");
  assert.equal(lights.content.querySelector(".name").textContent, "Lights");
  assert.equal(lights.content.querySelector(".toggle"), node);
  lights.remove();
  const badge = document.createElement("ikio-chip-badge");
  badge.setConfig({ entity: "sensor.test", name: "Power" });
  badge.hass = {
    locale: { language: "el" },
    states: { "sensor.test": { state: "unavailable", attributes: {} } },
  };
  document.body.append(badge);
  assert.equal(
    badge.content.querySelector(".ikio-chip-name").textContent,
    "Power",
  );
  assert.equal(
    badge.content.querySelector(".ikio-chip-value").textContent,
    "Μη διαθέσιμο",
  );
  badge.remove();
});
