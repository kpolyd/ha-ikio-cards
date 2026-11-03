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
    // Reproduce temporary invalid values during real key events. Strict card
    // validation must not turn an editable draft into a YAML-only editor.
    const numericEditorStyle = await focusEditor.evaluate(
      (e) => e.style.cssText,
    );
    for (const type of ["graph", "mini-graph"]) {
      await page.evaluate(
        async ({ type, style }) => {
          const Card = customElements.get(`ikio-${type}-card`);
          const editor = await Card.getConfigElement();
          editor.id = "numeric-regression";
          editor.style.cssText = style;
          editor.setConfig({
            entities: [{ entity: "sensor.example", opaque: 42 }],
            primary_entity: "sensor.example",
            hours: 6,
            expected_min: 20,
            expected_max: 30,
            graph_height: 32,
            grid_options: { rows: 2 },
            visibility: [{ condition: "user", users: ["demo"] }],
          });
          editor.hass = { states: {}, locale: { language: "en" } };
          editor.addEventListener("config-changed", (event) =>
            editor.setConfig(JSON.parse(JSON.stringify(event.detail.config))),
          );
          document.querySelector("#editor-preview").replaceChildren(editor);
        },
        { type, style: numericEditorStyle },
      );
      const numericEditor = page.locator("#numeric-regression");
      await numericEditor.locator("section").first().waitFor();
      await numericEditor.locator("details").evaluateAll((nodes) =>
        nodes.forEach((node) => {
          node.open = true;
        }),
      );
      const input = (key) =>
        numericEditor.locator(`input[aria-label="${key}"]`).first();
      const error = numericEditor.locator(".config-error");
      for (const [key, partial, final] of [
        ["hours", "0", "12"],
        ["expected_min", "35", "25"],
        ["expected_max", "2", "40"],
        ...(type === "mini-graph" ? [["graph_height", "4", "40"]] : []),
      ]) {
        const control = input(key);
        await control.fill("");
        await control.pressSequentially(partial);
        assert.equal(
          await error.isVisible(),
          true,
          `${type}/${key}: invalid draft feedback`,
        );
        assert.equal(
          await control.evaluate((e) => e.getRootNode().activeElement === e),
          true,
        );
        await control.fill(final);
        assert.equal(
          await error.isVisible(),
          false,
          `${type}/${key}: corrected`,
        );
        assert.equal(await control.inputValue(), final);
        assert.equal(
          await numericEditor.evaluate((e, key) => e.config[key], key),
          Number(final),
        );
      }
      assert.deepEqual(
        await numericEditor.evaluate((e) => e.config.grid_options),
        { rows: 2 },
      );
      assert.deepEqual(
        await numericEditor.evaluate((e) => e.config.visibility),
        [{ condition: "user", users: ["demo"] }],
      );
      // Existing invalid saved configurations must also open for correction.
      await numericEditor.evaluate((e) =>
        e.setConfig({ ...e.config, expected_min: 50 }),
      );
      assert.equal(await error.isVisible(), true);
      await numericEditor.screenshot({
        path: resolve(out, `editor-${type}-invalid-range.png`),
      });
      await input("expected_min").fill("25");
      assert.equal(await error.isVisible(), false);
    }
    await page.evaluate(async () => {
      const Card = customElements.get("ikio-electricity-card");
      const editor = await Card.getConfigElement();
      editor.setConfig({
        power_entity: "sensor.total",
        billing_cycle_cron: "0 0 20 * *",
        cycle_start_entity: "sensor.old_start",
        cycle_end_entity: "sensor.old_end",
        forecast_minimum_hours: 24,
        energy_readings: [
          { label: "Day", entity: "sensor.day" },
          { label: "Night", entity: "sensor.night" },
        ],
        grid_options: { columns: 6 },
      });
      editor.hass = { states: {}, locale: { language: "en" } };
      editor.style.cssText = "display:block;width:390px;max-width:100%";
      editor.addEventListener("config-changed", (e) =>
        editor.setConfig(e.detail.config),
      );
      document.querySelector("main").replaceChildren(editor);
    });
    const energyEditor = page.locator("ikio-electricity-card-editor");
    const billing = energyEditor.locator('[data-key="group:Billing cycle"]');
    await billing.locator(":scope > summary").click();
    const energyList = billing.locator('[data-key="list:energy_readings"]');
    await energyList.locator(":scope > summary").click();
    const first = energyList.locator('[data-key="list:energy_readings:0"]');
    await first.locator(":scope > summary").click();
    await first.locator('input[aria-label="label"]').fill("Peak");
    await first.locator('input[aria-label="colour"]').fill("#90CAF9");
    await first.getByRole("button", { name: "Move down", exact: true }).click();
    assert.deepEqual(
      await energyEditor.evaluate((e) =>
        e.config.energy_readings.map((r) => r.label),
      ),
      ["Night", "Peak"],
    );
    assert.equal(
      await energyEditor.evaluate((e) => e.config.energy_readings[1].colour),
      "#90CAF9",
    );
    assert.deepEqual(
      await energyEditor.evaluate((e) =>
        [
          e.config.cycle_start_entity,
          e.config.cycle_end_entity,
          e.config.forecast_minimum_hours,
        ].map((v) => v === undefined),
      ),
      [true, true, true],
    );
    assert.deepEqual(
      await energyEditor.evaluate((e) => e.config.grid_options),
      { columns: 6 },
    );
    assert.equal(
      await energyEditor
        .locator('[data-key="group:Device power"] [data-key="list:circuits"]')
        .count(),
      1,
    );
    for (const width of [280, 390, 520]) {
      await energyEditor.evaluate((e, w) => (e.style.width = `${w}px`), width);
      assert.equal(
        await energyEditor.evaluate((e) => e.scrollWidth > e.clientWidth + 2),
        false,
      );
    }
    await energyEditor.screenshot({
      path: resolve(out, "editor-electricity-billing-cycle.png"),
    });
    assert.deepEqual(errors, []);
    return {
      scenario: "editor",
      status: "passed",
      note: "Simulated ha-form; shared layout, required markers, input focus, list addition, metadata, Greek labels, mobile-sized Backspace/normalized feedback and recoverable graph numeric drafts",
    };
  } finally {
    await page.close();
  }
}
