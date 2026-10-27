import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function checkGraphLayout(browser, out) {
  const page = await browser.newPage({
    viewport: { width: 740, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/*", (route) =>
      route.request().url().startsWith("file:")
        ? route.continue()
        : route.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    await page.evaluate(() => {
      const preview = window.ikioPreview;
      preview.configs.electricity.circuits.forEach((row, index) => {
        const old = preview.states[row.power_entity];
        preview.states[row.power_entity] = {
          ...old,
          state: String([7, 86, 731, 9999, -9999][index]),
          attributes: { ...old.attributes, unit_of_measurement: "W" },
        };
      });
    });
    const electricity = page.locator("ikio-electricity-card"),
      server = page.locator("ikio-server-monitor-card");
    for (const theme of ["dark", "light"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await electricity.scrollIntoViewIfNeeded();
        await electricity.locator(".ae-device-sparkline svg").first().waitFor();
        const devices = await electricity
          .locator(".ae-device-reading")
          .evaluateAll((items) =>
            items.map((item) => {
              const spark = item
                .querySelector(".ae-device-sparkline")
                .getBoundingClientRect();
              const value = item
                .querySelector(".ae-value")
                .getBoundingClientRect();
              return {
                offset: spark.x - item.getBoundingClientRect().x,
                width: spark.width,
                valueHeight: value.height,
                value: item.querySelector(".ae-value").textContent,
              };
            }),
          );
        assert.ok(devices.length >= 5);
        assert.ok(
          devices[0].offset < 76,
          `Power column is too wide: ${devices[0].offset}`,
        );
        for (const item of devices) {
          assert.ok(
            Math.abs(item.width - devices[0].width) < 1,
            `${theme}/${width}: device graphs differ in width: ${JSON.stringify(devices)}`,
          );
          assert.ok(
            Math.abs(item.offset - devices[0].offset) < 1,
            `${theme}/${width}: device graphs do not align`,
          );
          assert.ok(
            item.valueHeight < 25,
            `${theme}/${width}: four-digit power wraps: ${JSON.stringify(item)}`,
          );
          assert.ok(item.width > 0);
        }
        await server.scrollIntoViewIfNeeded();
        const plot = server.locator(".system-network-plot");
        await plot.waitFor();
        const graph = await plot.boundingBox();
        const start = await server
          .locator(".system-network-times span")
          .first()
          .boundingBox();
        const end = await server
          .locator(".system-network-times span")
          .last()
          .boundingBox();
        assert.ok(
          Math.abs(start.x - graph.x) < 1,
          `${theme}/${width}: start time misaligned`,
        );
        assert.ok(
          Math.abs(end.x + end.width - graph.x - graph.width) < 1,
          `${theme}/${width}: end time misaligned`,
        );
        if (width === 390 && theme === "dark") {
          await server
            .locator(".system-network")
            .screenshot({ path: resolve(out, "server-network-alignment.png") });
          await electricity.locator(".ae-energy>.ae-grid").screenshot({
            path: resolve(out, "electricity-device-alignment.png"),
          });
        }
      }
    assert.deepEqual(errors, []);
    return { card: "graph-layout", passed: true };
  } finally {
    await page.close();
  }
}
