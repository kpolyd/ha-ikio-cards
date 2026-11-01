import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Exercises our editor DOM with a small native-input substitute for ha-form.
// Native HA selectors themselves require verification in Home Assistant.
export async function checkEditor(browser, out) {
  const page = await browser.newPage({
    viewport: { width: 740, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.route("**/*", (route) =>
      route.request().url().startsWith("file:")
        ? route.continue()
        : route.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    await page.evaluate(async () => {
      customElements.define(
        "ha-form",
        class extends HTMLElement {
          set data(value) {
            this._data = value;
            for (const input of this.querySelectorAll("input")) {
              const key = input.getAttribute("aria-label");
              if (input.type === "checkbox")
                input.checked = Boolean(value[key]);
              else input.value = value[key] ?? "";
            }
          }
          get data() {
            return this._data;
          }
          set schema(value) {
            this._schema = value;
            this.replaceChildren();
            for (const field of value) {
              const input = document.createElement("input");
              input.type = field.selector?.boolean
                ? "checkbox"
                : field.selector?.number
                  ? "number"
                  : "text";
              input.value = this.data[field.name] ?? "";
              input.checked = !!this.data[field.name];
              input.required = !!field.required;
              input.setAttribute("aria-label", field.name);
              input.style.cssText =
                "box-sizing:border-box;width:100%;min-height:44px;padding:8px;border:1px solid var(--divider-color);border-radius:7px;background:var(--secondary-background-color);color:var(--primary-text-color);font:inherit";
              input.addEventListener("input", () =>
                this.dispatchEvent(
                  new CustomEvent("value-changed", {
                    detail: {
                      value: {
                        ...this.data,
                        [field.name]:
                          input.type === "checkbox"
                            ? input.checked
                            : input.type === "number"
                              ? input.value === ""
                                ? undefined
                                : input.valueAsNumber
                              : input.value,
                      },
                    },
                  }),
                ),
              );
              this.append(input);
            }
          }
          set computeLabel(value) {
            this._computeLabel = value;
            this.querySelectorAll("label").forEach((label) => label.remove());
            for (const [index, input] of [
              ...this.querySelectorAll("input"),
            ].entries()) {
              const label = document.createElement("label");
              label.style.cssText =
                "display:block;font-size:13px;margin-bottom:4px";
              label.textContent = value(this._schema[index]);
              input.before(label);
            }
          }
          get computeLabel() {
            return this._computeLabel;
          }
          get schema() {
            return this._schema;
          }
        },
      );
      const host = document.createElement("main");
      host.id = "editor-preview";
      document.body.replaceChildren(host);
      const Card = customElements.get("ikio-server-monitor-card");
      const editor = await Card.getConfigElement();
      editor.setConfig({
        name: "Simulated server",
        ip_address_entity: "sensor.server_ip",
        extra_readings: [
          { entity: "sensor.database", name: "Database", show_name: true },
        ],
        view_layout: { column: 2 },
      });
      editor.hass = { states: {}, locale: { language: "en" } };
      editor.addEventListener("config-changed", (e) =>
        editor.setConfig(e.detail.config),
      );
      host.append(editor);
    });
    const editor = page.locator("ikio-server-monitor-card-editor");
    await editor.locator("section").first().waitFor();
    for (const dark of [true, false])
      for (const width of [280, 320, 390, 520]) {
        await editor.evaluate(
          (e, { dark, width }) => {
            document.body.style.cssText = `margin:20px;background:${dark ? "#0d171b" : "#edf3f1"};font-family:Arial,sans-serif`;
            e.style.cssText = `display:block;width:${width}px;--primary-text-color:${dark ? "#e5e9e7" : "#17282e"};--secondary-text-color:${dark ? "#a4adb2" : "#50645f"};--secondary-background-color:${dark ? "#21353b" : "#e4eeeb"};--divider-color:${dark ? "#34474d" : "#bdcfca"};--error-color:${dark ? "#ff8a80" : "#b3261e"};--primary-color:#90caf9`;
          },
          { dark, width },
        );
        const list = editor.locator('[data-key="list:extra_readings"]');
        await list.evaluate((node) => {
          node.open = true;
          node.querySelector("details").open = true;
        });
        assert.equal(
          await editor.evaluate((e) => e.scrollWidth > e.clientWidth + 1),
          false,
          `editor overflow ${dark}/${width}`,
        );
        const marker = editor.locator(".field .required").first();
        assert.equal(await marker.textContent(), " *");
        assert.notEqual(
          await marker.evaluate((e) => getComputedStyle(e).color),
          await editor.evaluate((e) => getComputedStyle(e).color),
        );
        const input = editor.locator('input[aria-label="entity"]');
        await input.fill("");
        assert.equal(await input.evaluate((e) => e.required), true);
        assert.equal(await editor.locator(".field-error:visible").count(), 1);
        await input.fill("sensor.edited");
        assert.equal(await editor.locator(".field-error:visible").count(), 0);
        assert.equal(
          await input.evaluate((e) => e === e.getRootNode().activeElement),
          true,
        );
        if (width === 390)
          await editor.screenshot({
            path: resolve(out, `editor-${dark ? "dark" : "light"}.png`),
          });
      }
    const list = editor.locator('[data-key="list:extra_readings"]');
    await list.locator(":scope > button").click();
    const newRow = editor.locator('[data-key="list:extra_readings:1"]');
    assert.equal(await newRow.evaluate((e) => e.open), true);
    assert.equal(
      await editor.evaluate((e) => e.config.extra_readings[0].entity),
      "sensor.edited",
    );
    assert.deepEqual(await editor.evaluate((e) => e.config.view_layout), {
      column: 2,
    });
    await editor.evaluate((e) => {
      e.hass = { states: {}, locale: { language: "el" } };
    });
    assert.match(await editor.locator("h3").first().textContent(), /Γενικά/);
    // Real browser Backspace events on a phone-sized viewport, including the
    // host's JSON roundtrip which drops undefined values and restores defaults.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(async () => {
      const Card = customElements.get("ikio-climate-card");
      const editor = await Card.getConfigElement();
      editor.id = "focus-regression";
      editor.style.cssText =
        "display:block;width:340px;--primary-text-color:#17282e;--secondary-text-color:#50645f;--secondary-background-color:#e4eeeb;--divider-color:#bdcfca";
      editor.setConfig({
        name: "Office",
        temperature_step: 1,
        climate_entity: "climate.example",
        view_layout: { column: 2 },
      });
      editor.hass = { states: {}, locale: { language: "en" } };
      editor.addEventListener("config-changed", (e) => {
        const config = JSON.parse(JSON.stringify(e.detail.config));
        if (config.name === "") delete config.name;
        editor.setConfig({ ...config, schema_version: 1 });
      });
      document.querySelector("#editor-preview").append(editor);
    });
    const focusEditor = page.locator("#focus-regression");
    for (const [key, initial, replacement] of [
      ["name", "Office", "Room"],
      ["temperature_step", "1", "2"],
    ]) {
      const input = focusEditor.locator(`input[aria-label="${key}"]`);
      await input.click();
      await input.press("End");
      for (let i = 0; i < initial.length; i++) {
        await input.press("Backspace");
        assert.equal(
          await input.evaluate((e) => e.getRootNode().activeElement === e),
          true,
          `${key}: retain focus through backspace`,
        );
      }
      assert.equal(await input.inputValue(), "");
      await input.pressSequentially(replacement);
      assert.equal(await input.inputValue(), replacement);
      assert.equal(
        await focusEditor.evaluate((e, key) => e.config[key], key),
        key === "temperature_step" ? 2 : "Room",
      );
      await input.press("Tab");
    }
    assert.deepEqual(await focusEditor.evaluate((e) => e.config.view_layout), {
      column: 2,
    });
    await focusEditor.screenshot({
      path: resolve(out, "editor-mobile-backspace.png"),
    });
    assert.deepEqual(errors, []);
    return {
      scenario: "editor",
      status: "passed",
      note: "Simulated ha-form; shared layout, required markers, input focus, list addition, metadata, Greek labels and mobile-sized Backspace/normalized feedback",
    };
  } finally {
    await page.close();
  }
}
