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
    for (const theme of ["dark", "light", "ha-dark", "ha-light"])
      for (const width of [100, 160, 320, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme: theme.startsWith("ha-") ? "ha" : theme, width },
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
          "select",
          "input_select",
          "number",
          "climate",
          "lock",
        ]) {
          const result = await card.evaluate(
            (c, { domain, theme }) => {
              if (theme.startsWith("ha-")) {
                const dark = theme === "ha-dark";
                for (const [key, value] of Object.entries({
                  "--ha-card-background": dark ? "#1c1c1c" : "#ffffff",
                  "--secondary-background-color": dark ? "#282828" : "#e5e5e5",
                  "--primary-text-color": dark ? "#eeeeee" : "#212121",
                  "--secondary-text-color": dark ? "#aaaaaa" : "#727272",
                  "--divider-color": dark ? "#444444" : "#cccccc",
                  "--primary-color": "#03a9f4",
                  "--state-light-active-color": "#ff9800",
                }))
                  c.style.setProperty(key, value);
              }
              const id = domain + ".entity_test";
              c.setConfig({
                entity: id,
                name: "A long entity name for a compact card",
                appearance: { theme: theme.startsWith("ha-") ? "ha" : theme },
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
              const onBackground = getComputedStyle(c.control).backgroundColor;
              const onIcon = getComputedStyle(c.icon).color;
              const actionColour = getComputedStyle(c.actionIcon).color;
              const actionSize = getComputedStyle(c.actionIcon)
                .getPropertyValue("--mdc-icon-size")
                .trim();
              const lampColour =
                c.control.style.getPropertyValue("--lamp-colour");
              const dotColour = getComputedStyle(c.dot).backgroundColor;
              c.style.setProperty("--state-light-active-color", "#ff00ff");
              const legacyBackground = getComputedStyle(
                c.control,
              ).backgroundColor;
              c.style.setProperty("--primary-color", "#ab47bc");
              const changedBackground = getComputedStyle(
                c.control,
              ).backgroundColor;
              const changedIcon = getComputedStyle(c.icon).color;
              const dotRestored =
                getComputedStyle(c.dot).backgroundColor === dotColour;
              c.style.setProperty("--primary-color", "#03a9f4");
              return {
                onBackground,
                onIcon,
                actionColour,
                actionSize,
                lampColour,
                dotColour,
                legacyBackground,
                changedBackground,
                changedIcon,
                dotRestored,
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
          if (["switch", "input_boolean"].includes(domain))
            assert.equal(result.actionSize, "18px");
          if (
            theme.startsWith("ha-") &&
            ["light", "switch", "input_boolean"].includes(domain)
          ) {
            assert.equal(result.onIcon, "rgb(3, 169, 244)");
            if (domain !== "light")
              assert.equal(result.actionColour, "rgb(3, 169, 244)");
            assert.equal(result.legacyBackground, result.onBackground);
            assert.notEqual(result.changedBackground, result.onBackground);
            assert.equal(result.changedIcon, "rgb(171, 71, 188)");
            if (domain === "light") assert.equal(result.dotRestored, true);
          }
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
          if (domain === "light") {
            const hidden = await card.evaluate((c) => {
              const original = c.hass,
                id = c.config.entity;
              const results = [];
              for (const state of ["off", "unavailable", "on"]) {
                c.hass = {
                  ...original,
                  states: {
                    ...original.states,
                    [id]: { ...original.states[id], state },
                  },
                };
                results.push(c.dot.hidden);
              }
              return results;
            });
            assert.deepEqual(hidden, [true, true, false]);
          }
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
