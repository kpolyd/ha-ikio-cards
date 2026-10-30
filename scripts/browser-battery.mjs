import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function checkBattery(browser, out) {
  const page = await browser.newPage({
      viewport: { width: 740, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const card = page.locator("ikio-battery-card");
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await card.scrollIntoViewIfNeeded();
        if (theme === "ha")
          await card.evaluate((c) => {
            for (const [name, value] of Object.entries({
              "--ha-card-background": "#f3f7f6",
              "--secondary-background-color": "#e4eeeb",
              "--divider-color": "#bdcfca",
              "--primary-text-color": "#17282e",
              "--secondary-text-color": "#50645f",
              "--primary-color": "#245d85",
              "--warning-color": "#805900",
              "--error-color": "#9a3830",
            }))
              c.style.setProperty(name, value);
          });
        const metrics = await card.evaluate((c) => ({
          overflow: c.shell.scrollWidth > c.shell.clientWidth + 2,
          heights: [
            ...c.content.querySelectorAll(".battery-row,.battery-expand"),
          ].map((n) => n.getBoundingClientRect().height),
          values: [...c.content.querySelectorAll(".battery-row")].map(
            (n) => c.batteries.find((r) => r.id === n.dataset.entity)?.value,
          ),
          summary: c.content.querySelector(".battery-replace").textContent,
        }));
        assert.equal(metrics.overflow, false, `${theme}/${width}`);
        assert(metrics.heights.every((h) => h >= 44));
        assert(metrics.values.every((v) => v <= 80));
        assert.match(metrics.summary, /1 × CR2032/);
        assert.match(metrics.summary, /2 × AAA/);
        if (width === 390)
          await card.screenshot({ path: resolve(out, `battery-${theme}.png`) });
      }
    const expand = card.locator(".battery-expand");
    await expand.focus();
    await page.keyboard.press("Enter");
    assert.equal(await expand.getAttribute("aria-expanded"), "true");
    const values = await card.evaluate((c) =>
      [...c.content.querySelectorAll(".battery-row")].map(
        (n) => c.batteries.find((r) => r.id === n.dataset.entity).value,
      ),
    );
    assert.deepEqual(
      values,
      [...values].sort((a, b) => a - b),
    );
    assert(values.some((v) => v > 80));
    await card.locator('[data-entity="sensor.demo_battery_entrance"]').click();
    assert.match(
      await page.locator("#log").textContent(),
      /sensor.demo_battery_entrance/,
    );
    await card.evaluate((c) => {
      c.setConfig({ ...c.config, ignored_devices: ["demo_battery_entrance"] });
      c.hass = {
        ...c.hass,
        locale: { language: "el-GR" },
        devices: {
          ...c.hass.devices,
          demo_battery_bathroom: {
            ...c.hass.devices.demo_battery_bathroom,
            name: "Αισθητήρας θερμοκρασίας με πολύ μεγάλο όνομα για έλεγχο αναδίπλωσης",
          },
        },
      };
    });
    assert.equal(
      await card
        .locator('[data-entity="sensor.demo_battery_entrance"]')
        .count(),
      0,
    );
    assert.match(
      await card.locator(".battery-replace").textContent(),
      /Αντικατάσταση/,
    );
    for (const width of [280, 320, 390, 520]) {
      await page.evaluate(
        (width) =>
          (document.querySelector("main").style.gridTemplateColumns =
            `${width}px`),
        width,
      );
      assert.equal(
        await card.evaluate(
          (c) => c.shell.scrollWidth > c.shell.clientWidth + 2,
        ),
        false,
        `Greek/${width}`,
      );
    }
    await card.screenshot({ path: resolve(out, "battery-greek.png") });
    await card.evaluate((c) => {
      c.hass = {
        ...c.hass,
        states: Object.fromEntries(
          Object.entries(c.hass.states).map(([id, s]) => [
            id,
            { ...s, state: "unavailable" },
          ]),
        ),
      };
    });
    assert.equal(await card.locator(".battery-track").count(), 0);
    assert.equal(await card.locator(".battery-replace").count(), 0);
    assert.deepEqual(errors, []);
    return { card: "battery", passed: true };
  } finally {
    await page.close();
  }
}
