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
          .filter((n) => n.startsWith("ikio-") && n !== "ikio-home-3d-card"),
      );
    assert(types.length >= 16);
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
          c.localName === "ikio-entity-card"
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
      assert.deepEqual(result.opened, ["sensor.action_test"], type);
      assert.deepEqual(
        result.calls,
        [["script", "turn_on", {}, { entity_id: "script.action_test" }]],
        type,
      );
      assert(result.accessible, type);
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
