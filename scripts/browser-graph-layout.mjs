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
    for (const [value, unit, expected] of [
      [12500, "B/s", "12.5 kB/s"],
      [12500, "kB/s", "12.5 MB/s"],
      [0.002, "MB/s", "2 kB/s"],
      [8, "Mbit/s", "8 Mbit/s"],
      [0.0005, "Mbps", "500 bit/s"],
      [0.5, "MiB/s", "512 KiB/s"],
      [2048, "Kibit/s", "2 Mibit/s"],
      [0, "GB/s", "0 B/s"],
    ]) {
      await server.evaluate(
        (card, sample) => {
          const id = card.config.network_rx_entity;
          const now = Date.now() / 1000;
          card.network = {
            ...card.network,
            [id]: [
              {
                lu: now - 1801,
                s: String(sample.value),
                a: { unit_of_measurement: sample.unit },
              },
            ],
          };
          card.hass = {
            ...card.hass,
            locale: { language: "en" },
            states: {
              ...card.hass.states,
              [id]: {
                ...card.hass.states[id],
                state: String(sample.value),
                attributes: {
                  ...card.hass.states[id].attributes,
                  unit_of_measurement: sample.unit,
                },
              },
            },
            formatEntityState(state) {
              // Exercise HA's entity-ID requirement, absent from older previews.
              state.entity_id.split(".");
              return `${Number(state.state)} ${state.attributes.unit_of_measurement || ""}`.trim();
            },
          };
        },
        { value, unit },
      );
      assert.equal(
        await server
          .locator(".system-network-legend .ae-value")
          .first()
          .textContent(),
        expected,
        unit,
      );
      assert.ok(
        await server.locator(".system-network-plot path").count(),
        unit,
      );
      assert.ok(await server.locator("[data-extremum]").count(), unit);
    }
    const generic = page.locator("ikio-graph-card");
    // Keep the single-series size contract distinct from the populated
    // multi-series gallery and the multi-series assertion below.
    await page.evaluate(() => {
      window.ikioPreview.configs.graph.entities = [
        { entity: "sensor.demo_graph_power", name: "Power" },
      ];
    });
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await generic.scrollIntoViewIfNeeded();
        await generic.locator(".ae-axis-chart svg").waitFor();
        const heights = [];
        for (const height of [180, 300]) {
          await generic.evaluate(
            (c, height) => (c.style.height = `${height}px`),
            height,
          );
          const metrics = await generic.evaluate((c) => ({
            plot: c.content.querySelector(".ae-graph").getBoundingClientRect()
              .height,
            width: c.shell.scrollWidth > c.shell.clientWidth + 1,
            height: c.shell.scrollHeight > c.shell.clientHeight + 1,
            stroke: getComputedStyle(
              c.content.querySelector("path:not(.ae-area-fill)"),
            ).strokeWidth,
            current: c.content.querySelectorAll(".graph-current").length,
          }));
          assert.equal(
            metrics.width,
            false,
            `${theme}/${width}: horizontal overflow`,
          );
          assert.equal(
            metrics.height,
            false,
            `${theme}/${width}/${height}: height overflow`,
          );
          assert.equal(metrics.stroke, "0.8px");
          assert.equal(metrics.current, 1);
          heights.push(metrics.plot);
        }
        assert(
          heights[1] > heights[0] + 100,
          "plot must fill the native chosen height",
        );
        if (width === 390 && theme === "dark")
          await generic.screenshot({
            path: resolve(out, "graph-native-size.png"),
          });
      }
    await generic.evaluate((c) => {
      c.setConfig({
        ...c.config,
        entities: [
          { entity: "sensor.demo_graph_power", name: "Power" },
          { entity: "sensor.office", name: "Office" },
        ],
        grid_options: { columns: 9, rows: 5 },
      });
      c.style.height = "240px";
    });
    await generic.locator(".ikio-legend-entry").first().waitFor();
    assert.equal(await generic.locator(".ikio-legend-entry").count(), 2);
    assert.equal(
      await generic.evaluate(
        (c) => c.shell.scrollHeight > c.shell.clientHeight + 1,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    return { card: "graph-layout", passed: true };
  } finally {
    await page.close();
  }
}
