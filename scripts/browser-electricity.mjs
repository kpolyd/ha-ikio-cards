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
        const tariffs = root.querySelector(".ae-energy-tariffs");
        const originalChildren = [...tariffs.childNodes];
        const height = c.getBoundingClientRect().height;
        const markers = [...tariffs.querySelectorAll(".ae-tariff-marker")];
        for (const marker of markers) marker.style.display = "none";
        const withoutMarkersHeight = c.getBoundingClientRect().height;
        for (const marker of markers) marker.style.removeProperty("display");
        const energyLabel = document.createElement("p");
        energyLabel.className = "ae-note";
        energyLabel.textContent = "Energy";
        const baselineRows = [
          ...root.querySelectorAll(".ae-tariff-legend .ae-reading"),
        ].map((n) => n.cloneNode(true));
        const total = tariffs.querySelector(".ae-reading").cloneNode(true);
        tariffs.replaceChildren(energyLabel, ...baselineRows, total);
        const baselineHeight = c.getBoundingClientRect().height;
        tariffs.replaceChildren(...originalChildren);
        return {
          baselineHeight,
          withoutMarkersHeight,
          height: c.getBoundingClientRect().height,
          summary: summary.getBoundingClientRect().height,
          overflow: c.scrollWidth > c.clientWidth,
          segments: bar.children.length,
          tariffPalette: [
            tariffs.style.getPropertyValue("--ae-tariff-day-colour"),
            tariffs.style.getPropertyValue("--ae-tariff-night-colour"),
          ],
          tariffMarkers: [...tariffs.querySelectorAll(".ae-tariff-marker")].map(
            (n) => getComputedStyle(n).backgroundColor,
          ),
          tariffSegments: [...bar.children].map(
            (n) => getComputedStyle(n).backgroundColor,
          ),
          tariffLabels: [...tariffs.querySelectorAll(".ae-label")].map(
            (n) => getComputedStyle(n).color,
          ),
          tariffValues: [...tariffs.querySelectorAll(".ae-value")].map(
            (n) => getComputedStyle(n).color,
          ),
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
      assert.equal(size.height, size.withoutMarkersHeight);
      assert.equal(size.icon, "mdi:lightning-bolt");
      assert.equal(size.times.length, 4);
      assert.equal(size.verticalGuides, 4);
      assert.ok(size.times.every((t) => /^\d{2}:\d{2}$/.test(t)));
      assert.notEqual(size.billLabel, size.billValue);
      assert.equal(size.billValues[0].colour, size.billValues[1].colour);
      assert.equal(size.billValues[0].weight, "600");
      assert.ok(size.height <= size.baselineHeight + 0.1, JSON.stringify(size));
      assert.equal(size.segments, 2);
      assert.deepEqual(
        size.tariffPalette,
        theme === "dark" ? ["#a4e4b8", "#c47dd4"] : ["#48835b", "#9553a7"],
      );
      assert.deepEqual(size.tariffMarkers, size.tariffSegments);
      assert.ok(size.tariffValues.every((c) => c === size.billValue));
      assert.ok(size.tariffLabels.every((c) => c === size.billLabel));
      assert.equal(size.fill, true, JSON.stringify(size));
      assert.equal(size.sparkFill, true);
      sizes.push({ theme, width, ...size });
    }
  // Multiple energy readings retain labels, exact shares and matching colours.
  for (const theme of ["dark", "light", "ha"])
    for (const width of [280, 390, 520]) {
      await page.evaluate(
        ({ theme, width }) => {
          window.ikioPreview.configure({ theme, width });
          const c = document.querySelector("ikio-electricity-card");
          c.hass = {
            ...c.hass,
            states: {
              ...c.hass.states,
              "sensor.test_peak": {
                state: "1000",
                attributes: { unit_of_measurement: "Wh" },
              },
              "sensor.test_offpeak": {
                state: "2",
                attributes: { unit_of_measurement: "kWh" },
              },
              "sensor.test_weekend": {
                state: "1",
                attributes: { unit_of_measurement: "kWh" },
              },
            },
          };
          c.setConfig({
            ...c.config,
            total_energy_entity: undefined,
            same_cycle: true,
            energy_readings: [
              { label: "Peak", entity: "sensor.test_peak" },
              { label: "Off-peak", entity: "sensor.test_offpeak" },
              {
                label: "Weekend",
                entity: "sensor.test_weekend",
                colour: "#90CAF9",
              },
            ],
          });
        },
        { theme, width },
      );
      const c = page.locator("ikio-electricity-card");
      await c.scrollIntoViewIfNeeded();
      assert.deepEqual(
        await c
          .locator(".ae-tariff-bar > span")
          .evaluateAll((ns) => ns.map((n) => n.style.width)),
        ["25%", "50%", "25%"],
      );
      assert.equal(await c.locator(".ae-tariff-marker").count(), 3);
      assert.equal(
        await c.evaluate((c) => c.shell.scrollWidth > c.shell.clientWidth + 1),
        false,
      );
      const colours = await c.evaluate((c) =>
        [".ae-tariff-bar > span", ".ae-tariff-marker"].map((selector) =>
          [...c.shadowRoot.querySelectorAll(selector)].map(
            (n) => getComputedStyle(n).backgroundColor,
          ),
        ),
      );
      assert.deepEqual(colours[0], colours[1]);
      if (theme === "dark" && width === 390)
        await c.screenshot({
          path: resolve(out, "electricity-multiple-energy.png"),
        });
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
