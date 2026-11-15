import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function checkHome3D(browser, out) {
  const page = await browser.newPage({
      viewport: { width: 900, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/*", (route) =>
      route.request().url().startsWith("file:")
        ? route.continue()
        : route.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const card = page.locator("ikio-home-3d-card");
    await card.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => !!document.querySelector("ikio-home-3d-card")?.model,
    );
    for (const theme of ["dark", "light"])
      for (const width of [280, 320, 390, 640]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await card.scrollIntoViewIfNeeded();
        await page.waitForFunction(
          () => !!document.querySelector("ikio-home-3d-card")?.model,
        );
        assert.equal(await card.locator("canvas").count(), 1);
        const toolbar = await card.evaluate((c) => {
          const root = c.shadowRoot;
          const tools = root.querySelector(".tools").getBoundingClientRect();
          const controls = [
            ...root.querySelectorAll(
              ".view-controls button, .view-controls select",
            ),
          ].map((control) => control.getBoundingClientRect());
          const graph = root
            .querySelector(".sun-graph")
            .getBoundingClientRect();
          return {
            count: controls.length,
            compact: controls.every((control) => control.height === 26),
            singleRow: controls.every(
              (control) =>
                Math.abs(
                  control.top +
                    control.height / 2 -
                    (graph.top + graph.height / 2),
                ) < 1,
            ),
            leftAligned: controls[0].left === tools.left,
            rightAligned: Math.abs(graph.right - tools.right) < 1,
            overlap: controls.some((control) => control.right > graph.left),
          };
        });
        assert.deepEqual(
          toolbar,
          {
            count: 4,
            compact: true,
            singleRow: true,
            leftAligned: true,
            rightAligned: true,
            overlap: false,
          },
          `${theme}/${width} toolbar`,
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
          `${theme}/${width} overflow`,
        );
        assert.equal(
          await card.evaluate((c) =>
            c.model.camera.position.toArray().every(Number.isFinite),
          ),
          true,
        );
        assert.equal(
          await card.locator(".configuration-status").isVisible(),
          false,
        );
        if (width === 390)
          await card.screenshot({ path: resolve(out, `home-3d-${theme}.png`) });
      }
    await page.evaluate(() =>
      window.ikioPreview.configure({ theme: "dark", width: 390 }),
    );
    await card.getByRole("button", { name: "Top view", exact: true }).click();
    await card.screenshot({
      path: resolve(out, "home-3d-room-perspective.png"),
    });
    await card.getByRole("button", { name: "Top view", exact: true }).click();
    const appearances = await card.evaluate((c) => {
      const results = [];
      for (const theme of ["dark", "light", "ha"]) {
        c.style.setProperty("--ha-card-background", "#345678");
        c.style.setProperty("--primary-text-color", "#ffffff");
        c.style.setProperty("--secondary-background-color", "#234567");
        c.style.setProperty("--divider-color", "#456789");
        c.setConfig({ ...c.config, appearance: { theme } });
        const model = c.model;
        const backgrounds = [];
        const intensities = [];
        for (const elevation of [-20, 0, 30]) {
          c.hass = {
            ...c.hass,
            states: {
              ...c.hass.states,
              "sun.sun": {
                state: elevation < 0 ? "below_horizon" : "above_horizon",
                attributes: { elevation, azimuth: 120 },
              },
            },
          };
          backgrounds.push(
            getComputedStyle(c.shadowRoot.querySelector(".view"))
              .backgroundColor,
          );
          intensities.push(
            c.model.scene.children.find((o) => o.isHemisphereLight).intensity,
          );
        }
        results.push({
          theme,
          backgrounds,
          intensities,
          sameModel: model === c.model,
        });
      }
      return results;
    });
    for (const result of appearances) {
      assert.equal(
        new Set(result.backgrounds).size,
        1,
        "sun cannot change background",
      );
      assert(
        result.intensities[0] < result.intensities[1] &&
          result.intensities[1] < result.intensities[2],
      );
      assert(result.sameModel, "appearance changes preserve the model");
    }
    assert.equal(appearances[0].backgrounds[0], "rgb(23, 40, 46)");
    assert.equal(appearances[1].backgrounds[0], "rgb(243, 247, 246)");
    assert.equal(appearances[2].backgrounds[0], "rgb(52, 86, 120)");
    await card.evaluate((c) =>
      c.style.setProperty("--ha-card-background", "#123456"),
    );
    assert.equal(
      await card
        .locator(".view")
        .evaluate((n) => getComputedStyle(n).backgroundColor),
      "rgb(18, 52, 86)",
      "HA theme changes apply live",
    );
    for (const darkMode of [true, false]) {
      const palette = await card.evaluate((c, darkMode) => {
        c.hass = { ...c.hass, themes: { ...c.hass.themes, darkMode } };
        const style = getComputedStyle(c);
        return [
          "--temperature-color",
          "--humidity-color",
          "--power-color",
          "--fridge-color",
          "--device-on-color",
          "--marker-open-color",
          "--badge-error-color",
        ].map((key) => style.getPropertyValue(key).trim());
      }, darkMode);
      assert.deepEqual(
        palette,
        darkMode
          ? [
              "#a4e4b8",
              "#adcfff",
              "#f2d487",
              "#b9e6ff",
              "#90caf9",
              "#f2c66d",
              "#f2a69b",
            ]
          : [
              "#28613e",
              "#36597f",
              "#775600",
              "#245f73",
              "#245d85",
              "#805900",
              "#9a3830",
            ],
      );
    }
    const requests = await page.evaluate(() => window.ikioHomeFileRequests);
    await card.evaluate((c) => {
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          "light.example_lamp": {
            state: "on",
            attributes: { brightness: 128 },
          },
        },
      };
    });
    assert.equal(
      await page.evaluate(() => window.ikioHomeFileRequests),
      requests,
      "HA updates do not reload files",
    );
    await card
      .getByRole("combobox", { name: "Choose room", exact: true })
      .selectOption("Studio");
    assert.equal(await card.evaluate((c) => c.room), "Studio");
    await card.getByRole("button", { name: "Top view", exact: true }).click();
    assert.equal(
      await card
        .getByRole("button", { name: "Top view", exact: true })
        .getAttribute("aria-pressed"),
      "false",
    );
    await card.getByRole("button", { name: "Full walls", exact: true }).click();
    assert.equal(
      await card
        .getByRole("button", { name: "Full walls", exact: true })
        .getAttribute("aria-pressed"),
      "false",
    );
    await card.getByRole("button", { name: "Reset", exact: true }).click();
    assert.equal(
      await card.evaluate((c) => c.room === "Overview" && c.top),
      true,
    );
    await card
      .locator('[data-sensor="sensor.example_temperature"] .badge-temp')
      .click();
    assert.match(
      await page.locator("#log").textContent(),
      /sensor.example_temperature/,
    );
    await card.evaluate((c) => {
      c.hass = {
        ...c.hass,
        locale: { language: "el-GR", number_format: "decimal_comma" },
      };
    });
    assert.equal(
      await card
        .getByRole("button", { name: "Κάτοψη", exact: true })
        .isVisible(),
      true,
    );
    assert.match(await card.locator(".badge-temp").textContent(), /20,0/);
    await card.screenshot({ path: resolve(out, "home-3d-greek.png") });
    await card.evaluate((c) => {
      c.setConfig({ ...c.config, home_model: "/local/ikio-demo/missing.json" });
    });
    await card.locator(".configuration-status button").waitFor();
    assert.equal(await card.locator("canvas").count(), 0);
    assert.equal(await card.evaluate((c) => c.model), null);
    await card.evaluate((c) => {
      c.setConfig({
        ...c.config,
        home_model: "/local/ikio-demo/home-model.json",
      });
    });
    await page.waitForFunction(
      () => !!document.querySelector("ikio-home-3d-card")?.model,
    );
    await card.evaluate((c) => {
      const parent = c.parentElement;
      c.remove();
      parent.append(c);
    });
    await page.waitForFunction(
      () => !!document.querySelector("ikio-home-3d-card")?.model,
    );
    assert.equal(await card.locator("canvas").count(), 1);
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      await mobile.route("**/*", (route) =>
        route.request().url().startsWith("file:")
          ? route.continue()
          : route.abort(),
      );
      await mobile.setContent(
        '<iframe sandbox="allow-scripts" style="border: 0; width: 100%; height: 100vh"></iframe>',
      );
      await mobile.locator("iframe").evaluate(
        (frame, gallery) => {
          frame.srcdoc = gallery;
        },
        await readFile("dist/previews/index.html", "utf8"),
      );
      const mobileCard = mobile
        .frameLocator("iframe")
        .locator("ikio-home-3d-card");
      await mobileCard.locator(".sun-curve").waitFor();
      await mobileCard.scrollIntoViewIfNeeded();
      assert.deepEqual(
        await mobileCard.evaluate(() => [
          location.href,
          window.ikioHomeFileRequests,
        ]),
        ["about:srcdoc", 3],
      );
      for (const width of [280, 320, 390]) {
        await mobileCard.evaluate(
          (_, width) => window.ikioPreview.configure({ theme: "dark", width }),
          width,
        );
        const mobileToolbar = await mobileCard.evaluate((c) => {
          const root = c.shadowRoot;
          const graph = root
            .querySelector(".sun-graph")
            .getBoundingClientRect();
          const tools = root.querySelector(".tools").getBoundingClientRect();
          return {
            rightAligned: Math.abs(graph.right - tools.right) < 1,
            controls: [...root.querySelectorAll(".view-control")].map(
              (wrapper) => {
                const control =
                  wrapper.firstElementChild.getBoundingClientRect();
                return {
                  width: control.width,
                  height: control.height,
                  clearOfGraph: control.right < graph.left,
                  sameRow:
                    Math.abs(
                      control.top +
                        control.height / 2 -
                        (graph.top + graph.height / 2),
                    ) < 1,
                  visualHeight: getComputedStyle(wrapper, "::before").height,
                };
              },
            ),
          };
        });
        assert(
          mobileToolbar.rightAligned &&
            mobileToolbar.controls.every(
              ({ width, height, clearOfGraph, sameRow, visualHeight }) =>
                width >= 44 &&
                height >= 44 &&
                clearOfGraph &&
                sameRow &&
                visualHeight === "26px",
            ),
          `touch toolbar at ${width}px: ${JSON.stringify(mobileToolbar)}`,
        );
      }
      await mobileCard.screenshot({ path: resolve(out, "home-3d-mobile.png") });
      const top = mobileCard.getByRole("button", {
        name: "Top view",
        exact: true,
      });
      await top.tap();
      assert.equal(await top.getAttribute("aria-pressed"), "false");
    } finally {
      await mobile.close();
    }
    assert.deepEqual(errors, []);
    return {
      card: "home-3d",
      passed: true,
      renderer: "software WebGL; no native device tested",
    };
  } finally {
    await page.close();
  }
}
