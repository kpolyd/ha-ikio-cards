import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function checkWeather(browser, out) {
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
    const card = page.locator("ikio-weather-card");
    // Compactness checks exercise the default options. The gallery enables
    // every optional detail; those options are tested separately below.
    await page.evaluate(() =>
      Object.assign(window.ikioPreview.configs.weather, {
        show_pressure: false,
        show_precipitation_probability: false,
        show_forecast_wind: false,
      }),
    );
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        if (theme === "ha")
          await card.evaluate((c) => {
            for (const [key, value] of Object.entries({
              "--ha-card-background": "#ffffff",
              "--secondary-background-color": "#eeeeee",
              "--divider-color": "#cccccc",
              "--primary-text-color": "#212121",
              "--secondary-text-color": "#626262",
              "--primary-color": "#0077a6",
            }))
              c.style.setProperty(key, value);
          });
        await card.scrollIntoViewIfNeeded();
        await card.locator(".weather-rain-bar").first().waitFor();
        assert.equal(await card.locator(".weather-rain-bar").count(), 7);
        assert.equal(await card.locator(".weather-line").count(), 2);
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
        assert.ok(
          (await card.boundingBox()).height < 300,
          `${theme}/${width} remains compact`,
        );
        assert.equal(
          await card.locator(".weather-plot").evaluate((chart) => {
            const box = chart.getBoundingClientRect();
            return [...chart.querySelectorAll("text")].every((label) => {
              const b = label.getBoundingClientRect();
              return (
                b.left >= box.left - 1 &&
                b.right <= box.right + 1 &&
                b.top >= box.top &&
                b.bottom <= box.bottom
              );
            });
          }),
          true,
          `${theme}/${width} chart labels fit`,
        );
        if (width === 390)
          await card.screenshot({ path: resolve(out, `weather-${theme}.png`) });
      }
    const hourly = card.getByRole("button", { name: "Hourly", exact: true });
    await hourly.click();
    await page.waitForFunction(
      () =>
        document.querySelector("ikio-weather-card").selectedType === "hourly" &&
        document.querySelector("ikio-weather-card").rows.length > 0,
    );
    assert.equal(await card.locator(".weather-line.templow").count(), 0);
    assert.equal(await hourly.getAttribute("aria-pressed"), "true");
    await card.evaluate((c) => {
      const state = c.hass.states[c.config.entity];
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          [c.config.entity]: {
            ...state,
            attributes: { ...state.attributes, supported_features: 7 },
          },
        },
      };
    });
    await card
      .getByRole("combobox", { name: "Forecast", exact: true })
      .selectOption("twice_daily");
    await page.waitForFunction(() => {
      const c = document.querySelector("ikio-weather-card");
      return c.selectedType === "twice_daily" && c.rows.length > 0;
    });
    assert.match(
      await card.locator(".weather-forecast").textContent(),
      /Day.*Night/,
    );
    assert.equal(await card.locator(".weather-line.templow").count(), 0);
    await card
      .getByRole("combobox", { name: "Forecast", exact: true })
      .selectOption("hourly");
    await card.evaluate((c) => {
      c.hass = {
        ...c.hass,
        locale: {
          language: "el-GR",
          number_format: "decimal_comma",
          time_format: "24",
        },
      };
    });
    assert.match(
      await card.locator(".weather-temperature").textContent(),
      /7,7/,
    );
    assert.match(
      await card.locator(".weather-legend").textContent(),
      /Θερμοκρασία/,
    );
    for (const width of [280, 320, 390, 520]) {
      await page.evaluate((width) => {
        document.querySelector("main").style.gridTemplateColumns = `${width}px`;
      }, width);
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
        `Greek/${width}`,
      );
    }
    await card.screenshot({ path: resolve(out, "weather-greek.png") });
    await card.evaluate((c) => {
      c.setConfig({
        ...c.config,
        show_temperature_graph: false,
        show_precipitation_probability: true,
        show_forecast_wind: true,
        show_pressure: true,
      });
    });
    await card.locator(".weather-rain-bar").first().waitFor();
    assert.equal(await card.locator(".weather-line").count(), 0);
    assert.equal(await card.locator(".weather-values").isVisible(), true);
    assert.equal(await card.locator(".weather-probability").count(), 7);
    await card.evaluate((c) => {
      c.setConfig({
        ...c.config,
        show_temperature_graph: true,
        forecast_type: "daily",
        show_forecast_conditions: false,
        show_precipitation_probability: false,
        show_forecast_wind: false,
      });
    });
    await card.locator(".weather-line.templow").waitFor();
    await page.evaluate(() => {
      const rows = window.ikioPreview.weatherForecasts.daily.map((r, i) => ({
        ...r,
        temperature: i === 1 ? null : -12.5,
        templow: i === 1 ? null : -18,
        precipitation: i === 2 ? null : 0,
      }));
      window.ikioPreview.weatherPush("daily", rows);
    });
    assert.equal(await card.locator(".weather-rain-bar").count(), 6);
    assert.match(
      await card.locator(".weather-line.temperature").getAttribute("d"),
      /M.*M/,
    );
    assert.doesNotMatch(
      await card.locator(".weather-plot").innerHTML(),
      /NaN|Infinity/,
    );
    await card.evaluate((c) => {
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          [c.config.entity]: {
            ...c.hass.states[c.config.entity],
            state: "unavailable",
          },
        },
      };
    });
    assert.equal(await card.locator(".weather-rain-bar").count(), 0);
    assert.match(
      await card.locator(".weather-current").textContent(),
      /Μη διαθέσιμο/,
    );
    await page.evaluate(() =>
      window.ikioPreview.configure({ theme: "dark", width: 390 }),
    );
    await card.scrollIntoViewIfNeeded();
    await card.locator(".weather-rain-bar").first().waitFor();
    await card.evaluate((c) => {
      c.testConnection = c.hass.connection;
      c.hass = {
        ...c.hass,
        connection: {
          subscribeMessage: async () => {
            throw Error("simulated network failure");
          },
        },
      };
    });
    await card.locator(".weather-retry").waitFor();
    assert.equal(await card.locator(".weather-rain-bar").count(), 0);
    assert.match(
      await card.locator(".weather-temperature").textContent(),
      /7.7/,
    );
    await card.evaluate((c) => {
      c.hass = { ...c.hass, connection: c.testConnection };
    });
    await card.locator(".weather-rain-bar").first().waitFor();
    assert.equal(await card.locator(".weather-retry").isVisible(), false);
    await card.evaluate((c) => {
      c.style.display = "none";
    });
    await page.waitForFunction(
      () => !document.querySelector("ikio-weather-card").subscription,
    );
    await card.evaluate((c) => {
      c.style.display = "";
    });
    await card.scrollIntoViewIfNeeded();
    await card.locator(".weather-rain-bar").first().waitFor();
    await card.evaluate(async (c) => {
      const editor = await c.constructor.getConfigElement();
      editor.setConfig(c.config);
      editor.hass = c.hass;
      const shell = document.createElement("section");
      shell.append(editor);
      document.body.append(shell);
      // Native HA form internals are covered by DOM tests; only lazy registration here.
      c.testEditor = editor;
    });
    assert.equal(
      await card.evaluate((c) => c.testEditor.localName),
      "ikio-weather-card-editor",
    );
    assert.deepEqual(errors, []);
    return { card: "weather", passed: true };
  } finally {
    await page.close();
  }
}
