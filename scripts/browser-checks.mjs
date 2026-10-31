import { checkElectricity } from "./browser-electricity.mjs";
import { checkEditor } from "./browser-editor.mjs";
import { checkReview } from "./browser-review.mjs";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkVacuum } from "./browser-vacuum.mjs";
import { checkChip } from "./browser-chip.mjs";
import { checkBattery } from "./browser-battery.mjs";
import { checkEntity } from "./browser-entity.mjs";
import { checkHome3D } from "./browser-home-3d.mjs";
import { checkWeather } from "./browser-weather.mjs";
import { checkRouter } from "./browser-router.mjs";
import { checkGraphLayout } from "./browser-graph-layout.mjs";

// Simulated HA fixtures only. No network or real device service calls.
const out = resolve("dist/browser-checks");
await mkdir(out, { recursive: true });
const results = [];
const selected = process.argv.slice(2);
if (
  selected.some(
    (name) =>
      ![
        "electricity",
        "editor",
        "lights",
        "weather",
        "home-3d",
        "entity",
        "battery",
        "chip",
        "media",
        "climate",
        "dehumidifier",
        "vacuum",
        "graph-layout",
        "router",
        "review",
      ].includes(name),
  )
)
  throw Error(
    "Choose electricity, chip, battery, entity, home-3d, weather, lights, media, climate, dehumidifier, vacuum, graph-layout, router or review browser scenarios",
  );
const shouldRun = (name) => !selected.length || selected.includes(name);
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  if (shouldRun("electricity"))
    results.push(await checkElectricity(browser, out));
  if (shouldRun("editor")) results.push(await checkEditor(browser, out));
  if (shouldRun("lights")) {
    const page = await browser.newPage({
      viewport: { width: 740, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) =>
      route.request().url().startsWith("file:")
        ? route.continue()
        : route.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const card = page.locator("ikio-lights-card");
    for (const theme of ["dark", "light", "ha-dark", "ha-light"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          ({ theme, width }) =>
            window.ikioPreview.configure({
              theme: theme.startsWith("ha-") ? "ha" : theme,
              width,
            }),
          { theme, width },
        );
        await card.evaluate((c, theme) => {
          if (theme.startsWith("ha-")) {
            const dark = theme === "ha-dark";
            for (const [key, value] of Object.entries({
              "--ha-card-background": dark ? "#1c1c1c" : "#ffffff",
              "--secondary-background-color": dark ? "#282828" : "#e5e5e5",
              "--primary-text-color": dark ? "#eeeeee" : "#212121",
              "--secondary-text-color": dark ? "#aaaaaa" : "#727272",
              "--divider-color": dark ? "#444444" : "#cccccc",
              "--primary-color": "#03a9f4",
              "--state-light-active-color": "#ff9800",
            }))
              c.style.setProperty(key, value);
          }
        }, theme);
        const colours = await card.evaluate((c) => {
          const row = c.rows[0];
          const setState = (state) => {
            c.hass = {
              ...c.hass,
              states: {
                ...c.hass.states,
                [row.row.entity]: { ...c.hass.states[row.row.entity], state },
              },
            };
            return getComputedStyle(row.tile).backgroundColor;
          };
          const off = setState("off");
          const on = setState("on");
          return {
            off,
            on,
            restored: setState("off"),
            stable: c.rows[0].toggle === row.toggle,
            pressed: row.toggle.getAttribute("aria-pressed"),
          };
        });
        assert.notEqual(
          colours.on,
          colours.off,
          `${theme}/${width}: on must differ from off`,
        );
        assert.equal(colours.restored, colours.off);
        assert.equal(colours.stable, true);
        assert.equal(colours.pressed, "false");
        if (theme.startsWith("ha-")) {
          const fallback = await card.evaluate((c) => {
            c.style.removeProperty("--state-light-active-color");
            const row = c.rows[0];
            c.hass = {
              ...c.hass,
              states: {
                ...c.hass.states,
                [row.row.entity]: {
                  ...c.hass.states[row.row.entity],
                  state: "on",
                },
              },
            };
            return getComputedStyle(row.tile).backgroundColor;
          });
          assert.notEqual(
            fallback,
            colours.off,
            "Primary colour fallback remains visibly active",
          );
          assert.notEqual(
            fallback,
            colours.on,
            "HA light active colour overrides the primary fallback",
          );
        }
        if (width === 390) {
          await card.scrollIntoViewIfNeeded();
          await card.screenshot({ path: resolve(out, `lights-${theme}.png`) });
        }
      }
    const mixed = await card.evaluate((c) => {
      c.setConfig({
        group_by_location: true,
        appearance: { theme: "dark" },
        lights: [
          {
            entity: "light.test_rgb",
            name: "A very long ceiling strip name",
            location: "Room",
          },
          { entity: "light.test_white", name: "White", location: "Room" },
          { entity: "light.test_dimmer", name: "Dimmer", location: "Room" },
          { entity: "switch.test_power", name: "Switch", location: "Other" },
        ],
      });
      const state = (mode, attrs = {}) => ({
        state: "on",
        attributes: {
          supported_color_modes: [mode],
          color_mode: mode,
          brightness: 128,
          ...attrs,
        },
      });
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          "light.test_rgb": state("rgb", {
            rgb_color: [120, 40, 210],
            icon: "mdi:led-strip",
          }),
          "light.test_white": state("color_temp", { color_temp_kelvin: 2700 }),
          "light.test_dimmer": state("brightness"),
          "switch.test_power": { state: "off", attributes: {} },
        },
      };
      return c.rows.map((ui) => {
        const dot = ui.dot.getBoundingClientRect(),
          button = ui.toggle.getBoundingClientRect(),
          name = getComputedStyle(ui.name);
        return {
          height: button.height,
          centre: Math.abs(
            dot.y + dot.height / 2 - button.y - button.height / 2,
          ),
          right: button.right - dot.right,
          nameWrap: name.whiteSpace,
          line: !ui.level.hidden,
          colour: ui.toggle.style.getPropertyValue("--lamp-colour"),
          native: ui.icon.localName,
          icon: ui.icon.stateObj.attributes.icon,
        };
      });
    });
    assert.deepEqual(
      mixed.map((r) => r.line),
      [true, true, true, false],
    );
    assert(mixed[0].colour && mixed[1].colour);
    assert.equal(mixed[2].colour, "");
    assert.equal(mixed[0].icon, "mdi:led-strip");
    for (const row of mixed) {
      assert.equal(row.native, "ha-state-icon");
      assert.equal(row.height, 44);
      assert(row.centre < 1);
      assert(row.right < 10);
      assert.equal(row.nameWrap, "nowrap");
    }
    assert.deepEqual(errors, []);
    results.push({ card: "lights", passed: true });
    await page.close();
  }
  if (shouldRun("chip")) results.push(await checkChip(browser, out));
  if (shouldRun("battery")) results.push(await checkBattery(browser, out));
  if (shouldRun("entity")) results.push(await checkEntity(browser, out));
  if (shouldRun("home-3d")) results.push(await checkHome3D(browser, out));
  if (shouldRun("weather")) results.push(await checkWeather(browser, out));
  if (shouldRun("review")) results.push(await checkReview(browser));
  if (shouldRun("router")) results.push(await checkRouter(browser, out));
  if (shouldRun("media")) {
    const page = await browser.newPage({
      viewport: { width: 740, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) =>
      route.request().url().startsWith("file:")
        ? route.continue()
        : route.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const media = page.locator("ikio-media-card");
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          {
            theme,
            width,
          },
        );
        if (theme === "ha")
          await media.evaluate((c) => {
            c.style.setProperty("--ha-card-background", "#f3f7f6");
            c.style.setProperty("--secondary-background-color", "#e4eeeb");
            c.style.setProperty("--divider-color", "#bdcfca");
            c.style.setProperty("--primary-text-color", "#17282e");
            c.style.setProperty("--secondary-text-color", "#50645f");
            c.style.setProperty("--primary-color", "#245d85");
          });
        await media.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {
          const img = document
            .querySelector("ikio-media-card")
            .content.querySelector("img");
          return img.complete && img.naturalWidth > 0;
        });
        assert.equal(
          await media.evaluate((c) =>
            [...c.shadowRoot.querySelectorAll("*")].some(
              (n) =>
                n.clientWidth > 0 &&
                n.scrollWidth > n.clientWidth + 2 &&
                getComputedStyle(n).overflowX === "visible",
            ),
          ),
          false,
          `${theme}/${width}`,
        );
        if (width === 390 && ["light", "ha"].includes(theme))
          await media.screenshot({ path: resolve(out, `media-${theme}.png`) });
      }
    await page.evaluate(() =>
      window.ikioPreview.configure({ theme: "dark", width: 360 }),
    );
    assert.equal(
      await media
        .locator(".media-artwork")
        .evaluate((img) =>
          getComputedStyle(img).maskComposite.split(",")[0].trim(),
        ),
      "intersect",
    );
    const watts = await media
      .locator("header .media-power-reading")
      .boundingBox();
    const power = await media.locator("header .media-power").boundingBox();
    assert.ok(
      Math.abs(watts.y - power.y) < 3 && watts.x + watts.width <= power.x + 1,
      "Wattage is adjacent to power button",
    );
    await media.screenshot({ path: resolve(out, "media-dark.png") });
    assert.equal(await media.locator(".media-volume input").count(), 0);
    await page.evaluate(() => {
      window.ikioHaptics = [];
      window.addEventListener("haptic", (event) =>
        window.ikioHaptics.push(event.detail),
      );
    });
    await media.locator(".media-power-reading").click();
    assert.deepEqual(await page.evaluate(() => window.ikioHaptics), []);
    await media
      .getByRole("button", { name: "Increase volume", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        window.ikioPreview.states["media_player.tv"].attributes.volume_level ===
        0.4,
    );
    assert.deepEqual(await page.evaluate(() => window.ikioHaptics), [
      "selection",
    ]);
    await media.getByRole("button", { name: "Mute", exact: true }).click();
    await media.getByRole("button", { name: "Unmute", exact: true }).waitFor();
    assert.equal(
      await media.locator(".media-volume output").textContent(),
      "Muted",
    );
    await media.getByRole("button", { name: "Unmute", exact: true }).click();
    await media.getByRole("button", { name: "Pause", exact: true }).click();
    await media.getByRole("button", { name: "Play", exact: true }).waitFor();
    const seek = media.getByRole("slider", { name: "Playback", exact: true });
    await seek.fill("120");
    await seek.dispatchEvent("change");
    assert.equal(await page.evaluate(() => window.ikioHaptics.length), 4);
    await page.waitForFunction(
      () =>
        window.ikioPreview.states["media_player.tv"].attributes
          .media_position === 120,
    );
    assert.equal(await media.locator("details").count(), 0);
    const source = media.getByRole("combobox", { name: "Source", exact: true });
    await source.selectOption("TV");
    await page.waitForFunction(
      () =>
        window.ikioPreview.states["media_player.tv"].attributes.source === "TV",
    );
    await media.getByRole("button", { name: "Power off", exact: true }).click();
    await page.waitForFunction(
      () => window.ikioPreview.states["media_player.tv"].state === "off",
    );
    await media.locator(".media-controls").waitFor({ state: "hidden" });
    assert.equal(await media.locator(".media-controls").isVisible(), false);
    assert.equal(await media.locator(".media-now").isVisible(), false);
    assert.ok(
      (await media.boundingBox()).height <= 70,
      "Off state is header-only",
    );
    assert.equal(
      await media.locator("header .media-power-reading").isVisible(),
      true,
    );
    await media.screenshot({ path: resolve(out, "media-off.png") });
    await media.getByRole("button", { name: "Power on", exact: true }).click();
    await media.locator(".media-now").waitFor();
    await media.locator(".media-controls").waitFor();
    await media.evaluate((c) => {
      const states = { ...c.hass.states };
      states["media_player.tv"] = {
        ...states["media_player.tv"],
        attributes: {
          ...states["media_player.tv"].attributes,
          media_title:
            "A long media title that wraps over several lines on a compact mobile dashboard",
          entity_picture: "data:image/png;base64,broken",
        },
      };
      c.hass = { ...c.hass, states, locale: { language: "el-GR" } };
    });
    await media.locator(".has-art").waitFor({ state: "detached" });
    assert.match(
      await media.getByRole("combobox").getAttribute("aria-label"),
      /Πηγή/,
    );
    assert.equal(await media.locator("details").count(), 0);
    for (const width of [280, 320, 390, 520]) {
      await page.evaluate(
        (width) =>
          (document.querySelector("main").style.gridTemplateColumns =
            `${width}px`),
        width,
      );
      assert.equal(
        await media.evaluate((c) =>
          [...c.shadowRoot.querySelectorAll("*")].some(
            (n) =>
              n.clientWidth > 0 &&
              n.scrollWidth > n.clientWidth + 2 &&
              getComputedStyle(n).overflowX === "visible",
          ),
        ),
        false,
        `Greek long/${width}`,
      );
    }
    await media.screenshot({ path: resolve(out, "media-greek.png") });
    assert.deepEqual(errors, []);
    results.push({ card: "media", passed: true });
    await page.close();
  }
  for (const type of ["climate", "dehumidifier"]) {
    if (!shouldRun(type)) continue;
    const page = await browser.newPage({
      viewport: { width: 740, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) =>
      route.request().url().startsWith("file:")
        ? route.continue()
        : route.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const card = page.locator(`ikio-${type}-card`);
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await card.scrollIntoViewIfNeeded();
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
          `${type}/${theme}/${width}`,
        );
      }
    await page.evaluate(() =>
      window.ikioPreview.configure({ theme: "dark", width: 360 }),
    );
    const name =
      type === "climate" ? "Increase target" : "Increase target humidity";
    await card.getByRole("button", { name, exact: true }).click();
    await page.waitForFunction(
      (type) =>
        type === "climate"
          ? window.ikioPreview.states["climate.room"].attributes.temperature ===
            22.5
          : window.ikioPreview.states["humidifier.room"].attributes.humidity ===
            55,
      type,
    );
    // Wait for the rendered confirmation before the next action.
    await page.waitForFunction(
      (type) =>
        !document
          .querySelector(`ikio-${type}-card`)
          .content.textContent.includes("Updating device"),
      type,
    );
    const summary = card.locator("summary");
    assert.equal(
      await summary.evaluate((s) => getComputedStyle(s, "::after").content),
      "none",
    );
    await summary.click();
    await page.waitForFunction(
      (type) =>
        window.ikioPreview.cards
          .find((c) => c.localName === `ikio-${type}-card`)
          .openSections.has(`${type}-settings`),
      type,
    );
    assert.equal(await card.locator(".settings-chevron").count(), 1);
    if (type === "climate") {
      await card.getByRole("button", { name: "Heat", exact: true }).click();
      await page.waitForFunction(
        () => window.ikioPreview.states["climate.room"].state === "heat",
      );
      await card
        .getByRole("button", { name: "Heat", exact: true })
        .getAttribute("aria-pressed");
    } else {
      await card.getByRole("button", { name: "Off", exact: true }).click();
      await page.waitForFunction(
        () => window.ikioPreview.states["humidifier.room"].state === "off",
      );
      await page.waitForFunction(() =>
        document
          .querySelector("ikio-dehumidifier-card")
          .content.querySelector('button[aria-pressed="true"]')
          .textContent.includes("Off"),
      );
      await card.getByRole("button", { name: "Laundry", exact: true }).click();
      await page.waitForFunction(
        () =>
          window.ikioPreview.states["humidifier.room"].state === "on" &&
          window.ikioPreview.states["humidifier.room"].attributes.mode ===
            "Laundry",
      );
      await card
        .getByRole("combobox", { name: "Fan speed", exact: true })
        .selectOption("Low");
      await page.waitForFunction(
        () =>
          window.ikioPreview.states["select.dehumidifier_fan"].state === "Low",
      );
    }
    await page.waitForFunction(
      (type) =>
        !document
          .querySelector(`ikio-${type}-card`)
          .content.textContent.includes("Updating device"),
      type,
    );
    assert.equal(await card.locator("details").evaluate((d) => d.open), true);
    await card.screenshot({ path: resolve(out, `${type}-dark.png`) });
    assert.deepEqual(errors, []);
    results.push({ card: type, passed: true });
    await page.close();
  }
  if (shouldRun("vacuum")) results.push(await checkVacuum(browser, out));
  if (shouldRun("graph-layout"))
    results.push(await checkGraphLayout(browser, out));
} finally {
  await browser.close();
  await writeFile(
    resolve(out, "report.json"),
    JSON.stringify({ simulated: true, results }, null, 2) + "\n",
  );
}
console.log(JSON.stringify({ simulated: true, results }));
