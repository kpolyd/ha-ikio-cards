import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkVacuum } from "./browser-vacuum.mjs";
import { checkGraphLayout } from "./browser-graph-layout.mjs";

// Simulated HA fixtures only. No network or real device service calls.
const out = resolve("dist/browser-checks");
await mkdir(out, { recursive: true });
const results = [];
const selected = process.argv.slice(2);
if (
  selected.some(
    (name) =>
      !["media", "climate", "dehumidifier", "vacuum", "graph-layout"].includes(
        name,
      ),
  )
)
  throw Error(
    "Choose media, climate, dehumidifier, vacuum or graph-layout browser scenarios",
  );
const shouldRun = (name) => !selected.length || selected.includes(name);
const browser = await chromium.launch({ headless: true });
try {
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
    await media
      .getByRole("button", { name: "Increase volume", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        window.ikioPreview.states["media_player.tv"].attributes.volume_level ===
        0.4,
    );
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
