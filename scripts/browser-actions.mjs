import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function checkActions(browser, out) {
  const page = await browser.newPage({
      viewport: { width: 900, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const types = await page
      .locator("body > main")
      .evaluate((root) =>
        [...root.querySelectorAll(":scope > section > *")]
          .map((n) => n.localName)
          .filter((n) =>
            [
              "ikio-lights-card",
              "ikio-chip-card",
              "ikio-entity-card",
              "ikio-climate-card",
              "ikio-dehumidifier-card",
              "ikio-media-card",
              "ikio-vacuum-card",
              "ikio-weather-card",
              "ikio-mini-graph-card",
            ].includes(n),
          ),
      );
    assert.equal(types.length, 9);
    for (const type of types) {
      const card = page.locator(type);
      await card.scrollIntoViewIfNeeded();
      const result = await card.evaluate(async (c) => {
        const originalConfig = structuredClone(c.config),
          originalHass = c.hass,
          originalPreview = c.preview;
        const calls = [],
          opened = [];
        const listen = (e) => opened.push(e.detail.entityId);
        c.addEventListener("hass-more-info", listen);
        c.preview = false;
        c.hass = {
          ...c.hass,
          callService: async (...args) => calls.push(args),
        };
        c.setConfig({
          ...c.config,
          action_entity: "sensor.action_test",
          tap_action: { action: "more-info" },
          hold_action: {
            action: "perform-action",
            perform_action: "script.turn_on",
            target: { entity_id: "script.action_test" },
          },
        });
        const area =
          c.localName === "ikio-lights-card"
            ? c.content.querySelector("button.toggle[data-entity]")
            : c.localName === "ikio-entity-card"
              ? c.control
              : c.localName === "ikio-chip-card"
                ? c.content.querySelector(".ikio-sensor-chip")
                : c.content.querySelector(
                    ".weather-name, .ae-energy-header, .ae-drive-header, header",
                  );
        const target = area.matches("button")
          ? area
          : area.querySelector(".ae-title, .security-emblem, h2");
        if (!target) throw Error(`No action target: ${c.localName}`);
        target.click();
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            shiftKey: true,
            bubbles: true,
          }),
        );
        await Promise.resolve();
        const result = {
          entity:
            target.dataset.entity ||
            c.config.primary_entity ||
            c.config.entity ||
            c.config.climate_entity ||
            c.config.humidifier_entity,
          opened: [...opened],
          calls: [...calls],
          accessible:
            target.matches("button") ||
            (target.getAttribute("role") === "button" && target.tabIndex === 0),
        };
        c.setConfig(originalConfig);
        c.hass = originalHass;
        c.preview = originalPreview;
        c.removeEventListener("hass-more-info", listen);
        return result;
      });
      assert.deepEqual(result.opened, [result.entity], type);
      assert.deepEqual(
        result.calls,
        [
          [
            "script",
            "turn_on",
            {},
            {
              entity_id: result.entity,
            },
          ],
        ],
        type,
      );
      assert(result.accessible, type);
    }
    for (const type of [
      "electricity",
      "router",
      "server-monitor",
      "battery",
      "graph",
      "vehicle",
      "alarmo",
    ]) {
      const c = page.locator(`ikio-${type}-card`);
      const result = await c.evaluate((card) => {
        const original = structuredClone(card.config),
          opened = [],
          calls = [];
        const listen = (e) => opened.push(e.detail.entityId);
        const originalHass = card.hass,
          originalPreview = card.preview;
        card.preview = false;
        card.hass = {
          ...card.hass,
          callService: async (...args) => calls.push(args),
        };
        card.addEventListener("hass-more-info", listen);
        card.setConfig({
          ...original,
          action_entity: "sensor.ignored_action",
          tap_action: { action: "more-info", entity: "sensor.ignored_action" },
          hold_action: {
            action: "perform-action",
            perform_action: "script.ignored_action",
          },
        });
        const header = card.shadowRoot.querySelector(
          "header, .weather-name, .ae-drive-header, .ae-energy-header",
        );
        if (header) {
          const target = header.querySelector("h2,.ae-title") || header;
          target.click();
          target.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "Enter",
              shiftKey: true,
              bubbles: true,
            }),
          );
        }
        card.setConfig(original);
        card.hass = originalHass;
        card.preview = originalPreview;
        card.removeEventListener("hass-more-info", listen);
        return { opened, calls };
      });
      assert(!result.opened.includes("sensor.ignored_action"), type);
      assert(
        !result.calls.some(
          (call) => call[0] === "script" && call[1] === "ignored_action",
        ),
        type,
      );
    }
    const entity = page.locator("ikio-entity-card");
    await entity.scrollIntoViewIfNeeded();
    await entity.evaluate((c) => {
      c.preview = false;
      window.actionCalls = [];
      c.hass = {
        ...c.hass,
        callService: async (...a) => window.actionCalls.push(a),
      };
      c.setConfig({
        ...c.config,
        tap_action: { action: "perform-action", perform_action: "script.tap" },
        hold_action: {
          action: "perform-action",
          perform_action: "script.hold",
        },
      });
    });
    const box = await entity.locator(".entity").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    assert.deepEqual(
      await page.evaluate(() => window.actionCalls.map((a) => a.slice(0, 2))),
      [["script", "hold"]],
    );
    await entity.screenshot({
      path: resolve(out, "entity-custom-actions.png"),
    });
    assert.deepEqual(errors, []);
    return { card: "actions", passed: true, cards: types.length };
  } finally {
    await page.close();
  }
}
