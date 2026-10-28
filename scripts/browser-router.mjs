import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function checkRouter(browser, out) {
  const page = await browser.newPage({
    viewport: { width: 740, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const card = page.locator("ikio-router-card");
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await card.scrollIntoViewIfNeeded();
        await card.locator(".system-network-plot").waitFor();
        assert.equal(await card.locator(".router-metric").count(), 3);
        assert.equal(
          await card.locator(".system-network-axis [data-extremum]").count(),
          3,
        );
        const plot = await card.locator(".system-network-plot").boundingBox();
        assert.equal(Math.round(plot.height), 132);
        const axis = await card
          .locator(".system-network-axis [data-extremum]")
          .evaluateAll((nodes) =>
            nodes.map((n) => {
              const b = n.getBoundingClientRect();
              return { x: b.x, right: b.right, mid: b.y + b.height / 2 };
            }),
          );
        assert.ok(axis.every((n) => n.right < plot.x));
        assert.ok(Math.abs(axis[1].mid - (plot.y + plot.height / 2)) < 1);
        assert.equal(
          await card.evaluate((c) =>
            [...c.shadowRoot.querySelectorAll("*")].some(
              (n) =>
                n.clientWidth > 0 &&
                n.scrollWidth > n.clientWidth + 2 &&
                getComputedStyle(n).overflowX === "visible",
            ),
          ),
          false,
          `${theme}/${width} overflow`,
        );
        if (width === 390 && theme !== "ha")
          await card.screenshot({ path: resolve(out, `router-${theme}.png`) });
      }
    // Registry-only precision changes must update both legend and the shared axis.
    await page.evaluate((options) => window.ikioPreview.configure(options), {
      theme: "dark",
      width: 280,
    });
    await card.evaluate((c) => {
      const now = Date.now();
      c.networkChecked = now;
      c.network = {
        "sensor.network_rx": [
          {
            lu: (now - 1800000) / 1000,
            s: "0",
            a: { unit_of_measurement: "Mbit/s" },
          },
          { lu: now / 1000, s: "16.234567" },
        ],
        "sensor.network_tx": [
          {
            lu: (now - 1800000) / 1000,
            s: "0",
            a: { unit_of_measurement: "kB/s" },
          },
        ],
      };
      c.hass = {
        ...c.hass,
        locale: { language: "en", number_format: "decimal_comma" },
        entities: {
          ...c.hass.entities,
          "sensor.network_rx": { display_precision: 2 },
          "sensor.network_tx": { display_precision: 0 },
        },
        states: {
          ...c.hass.states,
          "sensor.network_rx": {
            entity_id: "sensor.network_rx",
            state: "16.234567",
            attributes: { unit_of_measurement: "Mbit/s" },
          },
          "sensor.network_tx": {
            entity_id: "sensor.network_tx",
            state: "2.345",
            attributes: { unit_of_measurement: "kB/s" },
          },
        },
      };
    });
    assert.deepEqual(
      await card.locator(".system-network-legend .ae-value").allTextContents(),
      ["16,23 Mbit/s", "2 kB/s"],
    );
    assert.equal(
      await card.locator('[data-extremum="mid"]').textContent(),
      "8,12 Mbit/s",
    );
    assert.equal(
      await card.locator('[data-extremum="max"]').textContent(),
      "16,23 Mbit/s",
    );
    await card.evaluate((c) => {
      c.hass = {
        ...c.hass,
        entities: {
          ...c.hass.entities,
          "sensor.network_rx": { display_precision: 3 },
        },
      };
    });
    assert.equal(
      await card.locator('[data-extremum="min"]').textContent(),
      "0,000 Mbit/s",
    );
    assert.equal(
      await card.evaluate((c) =>
        [...c.shadowRoot.querySelectorAll("*")].some(
          (n) =>
            n.clientWidth > 0 &&
            n.scrollWidth > n.clientWidth + 2 &&
            getComputedStyle(n).overflowX === "visible",
        ),
      ),
      false,
    );
    const downloadLabel = await card
      .locator(".system-network-legend .ae-label")
      .first()
      .boundingBox();
    assert.ok(
      downloadLabel.height < 20,
      "Precision must not split Download across lines",
    );
    await card.screenshot({
      path: resolve(out, "router-sensor-precision.png"),
    });
    await page.evaluate((options) => window.ikioPreview.configure(options), {
      theme: "dark",
      width: 390,
    });
    for (const [value, cls] of [
      ["off", "offline"],
      ["unavailable", "unknown"],
      ["on", "online"],
    ]) {
      await card.evaluate((c, value) => {
        c.hass = {
          ...c.hass,
          states: {
            ...c.hass.states,
            "binary_sensor.demo_internet": { state: value, attributes: {} },
          },
        };
      }, value);
      assert.equal(await card.locator(`.router-internet.${cls}`).count(), 1);
    }
    await card.evaluate((c) => {
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          "sensor.demo_rsrq": {
            entity_id: "sensor.demo_rsrq",
            state: "-9",
            attributes: { unit_of_measurement: "dBm" },
          },
          "sensor.demo_snr": {
            entity_id: "sensor.demo_snr",
            state: "8.4",
            attributes: { unit_of_measurement: "dBm" },
          },
        },
      };
    });
    assert.deepEqual(
      await card.locator(".router-gauge-value").allTextContents(),
      ["-100 dBm", "-9 dBm", "8.4 dBm"],
    );
    assert.equal(await card.locator(".router-gauge-fill").count(), 3);
    await card.screenshot({
      path: resolve(out, "router-radio-reported-units.png"),
    });
    await card.evaluate((c) =>
      c.setConfig({ ...c.config, connection_type: "fibre" }),
    );
    assert.equal(await card.locator(".router-cellular").count(), 0);
    await card.evaluate((c) =>
      c.setConfig({
        ...c.config,
        connection_type: "cellular",
        snr_entity: "sensor.absent",
        internet_ip_entity: "sensor.demo_ipv6",
      }),
    );
    await card.evaluate((c) => {
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          "sensor.demo_ipv6": {
            state: "2001:db8:1234:5678:abcd:ef01:2345:6789",
            attributes: {},
          },
        },
      };
    });
    assert.equal(await card.locator(".router-metric.unknown").count(), 1);
    assert.equal(
      await card.evaluate((c) =>
        [...c.shadowRoot.querySelectorAll("*")].some(
          (n) =>
            n.clientWidth > 0 &&
            n.scrollWidth > n.clientWidth + 2 &&
            getComputedStyle(n).overflowX === "visible",
        ),
      ),
      false,
    );
    await page.evaluate(() =>
      window.ikioPreview.configure({
        theme: "dark",
        width: 320,
        scenario: "unavailable",
      }),
    );
    assert.equal(await card.locator(".router-internet.unknown").count(), 1);
    assert.equal(await card.locator(".router-gauge-fill").count(), 0);
    assert.deepEqual(errors, []);
    return { card: "router", passed: true };
  } finally {
    await page.close();
  }
}
