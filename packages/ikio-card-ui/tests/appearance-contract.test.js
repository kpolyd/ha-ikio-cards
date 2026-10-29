import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { JSDOM } from "jsdom";

test("every card ends its editor with the standard theme selector and defaults to Ikio dark", async () => {
  const dom = new JSDOM("<body/>", { url: "http://localhost" });
  for (const key of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[key] = dom.window[key];
  customElements.define("ha-form", class extends HTMLElement {});
  const entries = (await readdir(new URL("../../../cards/", import.meta.url)))
    .filter((n) => n.startsWith("ikio-"))
    .sort();
  try {
    for (const id of entries) {
      await import(`../../../cards/${id}/src/index.js`);
      const Card = customElements.get(id),
        stub = { ...Card.getStubConfig(), view_layout: { column: 2 } };
      delete stub.appearance;
      const card = new Card();
      card.setConfig(stub);
      assert.equal(
        card.config.appearance?.theme || card.getAttribute("appearance"),
        "dark",
        `${id}: runtime default`,
      );
      const editor = await Card.getConfigElement();
      editor.setConfig(stub);
      editor.hass = { states: {}, locale: { language: "en" } };
      document.body.append(editor);
      await new Promise((r) => setTimeout(r, 0));
      const getAppearance = () => {
        const forms = [...editor.shadowRoot.querySelectorAll("ha-form")];
        const appearance = forms.filter((f) =>
          f.schema?.some((s) => s.name === "theme"),
        );
        assert.equal(appearance.length, 1, `${id}: one appearance selector`);
        assert.equal(
          forms.at(-1),
          appearance[0],
          `${id}: appearance is last form`,
        );
        assert.equal(
          appearance[0].schema.length,
          1,
          `${id}: dedicated bottom theme form`,
        );
        assert.equal(
          appearance[0].computeLabel({ name: "theme" }),
          "Appearance",
          id,
        );
        assert.deepEqual(
          appearance[0].schema[0].selector.select.options,
          [
            { value: "dark", label: "Ikio dark" },
            { value: "light", label: "Ikio light" },
            { value: "ha", label: "Follow Home Assistant" },
          ],
          id,
        );
        return appearance[0];
      };
      assert.equal(getAppearance().data.theme, "dark", `${id}: editor default`);
      let saved;
      editor.addEventListener(
        "config-changed",
        (e) => (saved = e.detail.config),
      );
      for (const theme of ["light", "ha", "dark"]) {
        getAppearance().dispatchEvent(
          new CustomEvent("value-changed", { detail: { value: { theme } } }),
        );
        assert.equal(saved.appearance.theme, theme, id);
        assert.deepEqual(
          saved.view_layout,
          { column: 2 },
          `${id}: preserve metadata`,
        );
        editor.setConfig(saved);
        card.setConfig(saved);
        assert.equal(
          getAppearance().data.theme,
          theme,
          `${id}: retain selection after feedback`,
        );
        assert.equal(
          card.config.appearance.theme,
          theme,
          `${id}: runtime respects saved theme`,
        );
      }
      editor.remove();
      card.remove();
    }
  } finally {
    dom.window.close();
  }
});
