import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function checkEntity(browser, out) {
  const page = await browser.newPage({
      viewport: { width: 740, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const card = page.locator("ikio-entity-card");
    for (const theme of ["dark", "light", "ha"])
      for (const width of [100, 160, 320, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await card.scrollIntoViewIfNeeded();
        for (const domain of [
          "light",
          "switch",
          "input_boolean",
          "sensor",
          "binary_sensor",
          "button",
          "input_button",
        ]) {
          const result = await card.evaluate(
            (c, { domain, theme }) => {
              const id = domain + ".entity_test";
              c.setConfig({
                entity: id,
                name: "A long entity name for a compact card",
                appearance: { theme },
              });
              c.hass = {
                ...c.hass,
                states: {
                  ...c.hass.states,
                  [id]: {
                    entity_id: id,
                    state:
                      domain === "sensor"
                        ? "21.4"
                        : domain.endsWith("button")
                          ? "unknown"
                          : "on",
                    attributes: {
                      friendly_name: "Example",
                      device_class:
                        domain === "sensor" ? "temperature" : undefined,
                      unit_of_measurement:
                        domain === "sensor" ? "°C" : undefined,
                      supported_color_modes: ["rgb"],
                      color_mode: "rgb",
                      rgb_color: [140, 80, 210],
                      brightness: 128,
                    },
                  },
                },
              };
              const b = c.control.getBoundingClientRect();
              const dot = c.dot.getBoundingClientRect();
              return {
                width: b.width,
                height: b.height,
                native: c.icon.localName,
                dot: !c.dot.hidden,
                action: !c.actionIcon.hidden,
                line: !c.level.hidden,
                nowrap: getComputedStyle(c.name).whiteSpace,
                overflow: c.shell.scrollWidth > c.shell.clientWidth + 2,
                centred:
                  Math.abs(dot.y + dot.height / 2 - b.y - b.height / 2) < 1,
              };
            },
            { domain, theme },
          );
          assert.equal(result.native, "ha-state-icon");
          assert.equal(result.dot, domain === "light");
          assert.equal(result.line, domain === "light");
          assert.equal(
            result.action,
            ["switch", "input_boolean", "button", "input_button"].includes(
              domain,
            ),
          );
          assert.equal(result.nowrap, "nowrap");
          assert(!result.overflow, `${domain}/${width} overflow`);
          assert(result.height >= 46);
          if (result.dot) assert(result.centred);
        }
      }
    const actions = await card.evaluate(async (c) => {
      const calls = [];
      c.hass = { ...c.hass, callService: async (...a) => calls.push(a) };
      c.setConfig({ entity: "input_boolean.demo" });
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          "input_boolean.demo": { state: "off", attributes: {} },
        },
      };
      c.control.click();
      await Promise.resolve();
      c.control.click();
      const pressed = c.control.getAttribute("aria-pressed");
      c.setConfig({ entity: "button.demo" });
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          "button.demo": { state: "unknown", attributes: {} },
        },
      };
      c.control.click();
      await Promise.resolve();
      c.control.click();
      return { calls, pressed };
    });
    assert.deepEqual(
      actions.calls.map((a) => a.slice(0, 2)),
      [
        ["input_boolean", "turn_on"],
        ["button", "press"],
      ],
    );
    assert.equal(actions.pressed, "false");
    await card.evaluate((c) => {
      c.setConfig({ entity: "sensor.temperature" });
      c.style.height = "100px";
    });
    assert(
      (await card.locator(".entity").boundingBox()).height >= 98,
      "fills native chosen height",
    );
    await card.screenshot({ path: resolve(out, "entity-card.png") });
    assert.deepEqual(errors, []);
    return { card: "entity", passed: true };
  } finally {
    await page.close();
  }
}
