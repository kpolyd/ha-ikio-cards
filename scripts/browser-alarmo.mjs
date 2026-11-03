import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function checkAlarmo(browser, out) {
  const page = await browser.newPage({
    viewport: { width: 740, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const card = page.locator("ikio-alarmo-card");
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 320, 360, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
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
        await card.scrollIntoViewIfNeeded();
        assert.equal(await card.locator(".security-person").count(), 4);
        assert.equal(
          await card.evaluate(
            (c) => c.shell.scrollWidth > c.shell.clientWidth + 1,
          ),
          false,
          `${theme}/${width}`,
        );
        const geometry = await card.evaluate((c) => {
          const rect = (s) =>
            c.shadowRoot.querySelector(s).getBoundingClientRect();
          return {
            titleRight: rect(".security-heading").right,
            peopleLeft: rect(".security-people").left,
            gap: getComputedStyle(
              c.shadowRoot.querySelector(".security-people-grid"),
            ).gap,
          };
        });
        assert(geometry.titleRight <= geometry.peopleLeft);
        assert.equal(geometry.gap, "4px");
        if (width === 360)
          await card.screenshot({ path: resolve(out, `alarmo-${theme}.png`) });
      }
    await page.evaluate(() =>
      window.ikioPreview.configure({ theme: "dark", width: 360 }),
    );
    // Nine residents occupy exactly three rows, without losing anyone.
    await card.evaluate((c) => {
      const states = { ...c.hass.states };
      for (let i = 0; i < 5; i++)
        states[`person.extra_${i}`] = {
          state: "home",
          attributes: { friendly_name: `Demo ${i}` },
        };
      c.hass = { ...c.hass, states };
    });
    assert.equal(await card.locator(".security-person").count(), 9);
    assert.equal(
      await card
        .locator(".security-people-grid")
        .evaluate((g) => g.scrollHeight <= g.clientHeight + 1),
      true,
    );
    await card.screenshot({ path: resolve(out, "alarmo-nine-home.png") });
    // Simulated service calls are disabled in preview, but bypass consent is interactive.
    const bypass = card.locator(".security-bypass");
    const checkbox = bypass.locator("input");
    const sensorsBox = await card.locator(".security-sensors").boundingBox();
    const labelBox = await bypass.boundingBox();
    await page.mouse.click(
      sensorsBox.x + sensorsBox.width - 4,
      labelBox.y + labelBox.height / 2,
    );
    assert.equal(
      await checkbox.isChecked(),
      false,
      "empty row space must be inert",
    );
    await bypass.locator("span").click();
    assert.equal(await checkbox.isChecked(), true, "text toggles checkbox");
    await checkbox.click();
    assert.equal(
      await checkbox.isChecked(),
      false,
      "checkbox toggles directly",
    );
    await checkbox.focus();
    await page.keyboard.press("Space");
    assert.equal(await checkbox.isChecked(), true, "keyboard remains usable");
    await card.evaluate((c) =>
      c.setConfig({
        ...c.config,
        ignored_persons: [
          ...c.config.ignored_persons,
          { entity: "person.owner" },
        ],
      }),
    );
    assert.equal(await card.locator(".security-person").count(), 8);
    await card.evaluate((c) =>
      c.setConfig({ ...c.config, show_people: false }),
    );
    assert.equal(await card.locator(".security-people").count(), 0);
    assert.deepEqual(errors, []);
    return { card: "alarmo", passed: true };
  } finally {
    await page.close();
  }
}
