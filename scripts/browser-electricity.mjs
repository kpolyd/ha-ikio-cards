import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function checkElectricity(browser, out) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
  await page.waitForFunction(() => window.ikioPreview?.ready);
  const sizes = [];
  for (const theme of ["dark", "light"])
    for (const width of [280, 320, 390, 520]) {
      await page.evaluate(
        ({ theme, width }) => window.ikioPreview.configure({ theme, width }),
        { theme, width },
      );
      await page.locator("ikio-electricity-card").scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () => document.querySelector("ikio-electricity-card").visible,
      );
      await page
        .locator("ikio-electricity-card")
        .evaluate((c) => c.loadHistory());
      await page.waitForFunction(
        () =>
          Object.keys(
            document.querySelector("ikio-electricity-card").history || {},
          ).length > 0,
      );
      const size = await page.locator("ikio-electricity-card").evaluate((c) => {
        const root = c.shadowRoot;
        const bar = root.querySelector(".ae-tariff-bar");
        const summary = root.querySelector(".ae-energy-summary");
        return {
          height: c.getBoundingClientRect().height,
          summary: summary.getBoundingClientRect().height,
          overflow: c.scrollWidth > c.clientWidth,
          segments: bar.children.length,
          fill: !!root.querySelector(".ae-area-fill"),
          verticalGuides: root.querySelectorAll('[data-guide="time"]').length,
          times: [...root.querySelectorAll(".ae-time-axis span")].map(
            (n) => n.textContent,
          ),
          icon: root
            .querySelector(".ae-energy-header ha-icon")
            ?.getAttribute("icon"),
          billLabel: getComputedStyle(
            root.querySelector(".ae-energy-bills .ae-label"),
          ).color,
          billValues: [
            ...root.querySelectorAll(".ae-energy-bills .ae-value"),
          ].map((n) => ({
            colour: getComputedStyle(n).color,
            weight: getComputedStyle(n).fontWeight,
          })),
          billValue: getComputedStyle(
            root.querySelector(".ae-energy-bills .ae-value"),
          ).color,
          sparkFill: !!root.querySelector(".ae-device-sparkline .ae-area-fill"),
        };
      });
      assert.equal(size.overflow, false);
      assert.equal(size.icon, "mdi:lightning-bolt");
      assert.equal(size.times.length, 4);
      assert.equal(size.verticalGuides, 4);
      assert.ok(size.times.every((t) => /^\d{2}:\d{2}$/.test(t)));
      assert.notEqual(size.billLabel, size.billValue);
      assert.equal(size.billValues[0].colour, size.billValues[1].colour);
      assert.equal(size.billValues[0].weight, "600");
      assert.ok(size.height <= (width === 280 ? 604 : 575));
      assert.equal(size.segments, 2);
      assert.equal(size.fill, true, JSON.stringify(size));
      assert.equal(size.sparkFill, true);
      sizes.push({ theme, width, ...size });
    }
  assert.deepEqual(errors, []);
  if (process.env.ELECTRICITY_PREVIEW) {
    await page.goto(
      pathToFileURL(resolve(process.env.ELECTRICITY_PREVIEW)).href,
    );
    await page.waitForFunction(
      () =>
        !!document
          .querySelector("ikio-electricity-card")
          ?.shadowRoot.querySelector(".ae-area-fill"),
    );
    assert.equal(await page.locator("main > section").count(), 1);
  }
  await page.close();
  return { name: "electricity", sizes };
}
