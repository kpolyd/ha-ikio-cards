import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

async function state(
  page,
  value,
  attributes = {},
  language = "en",
  removeBattery = false,
) {
  await page.evaluate(
    ({ value, attributes, language, removeBattery }) => {
      const preview = window.ikioPreview;
      const old = preview.states["vacuum.robot"];
      const attrs = { ...old.attributes, ...attributes };
      if (removeBattery) delete attrs.battery_level;
      preview.states["vacuum.robot"] = {
        ...old,
        state: value,
        attributes: attrs,
      };
      const card = document.querySelector("ikio-vacuum-card");
      card.hass = {
        ...card.hass,
        states: { ...preview.states },
        locale: { language },
      };
    },
    { value, attributes, language, removeBattery },
  );
}

export async function checkVacuum(browser, out) {
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
    const card = page.locator("ikio-vacuum-card");
    const disc = card.locator(".vacuum-disc");
    const motion = () =>
      disc.evaluate((node) => getComputedStyle(node).animationName);
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await card.scrollIntoViewIfNeeded();
        assert.equal(await card.getAttribute("appearance"), "ha");
        const box = await card.boundingBox();
        assert.ok(
          box.height >= 100 && box.height <= 120,
          `${theme}/${width}: compact height ${box.height}`,
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
          `${theme}/${width}: overflow`,
        );
        assert.notEqual(
          await card
            .locator("ha-card")
            .evaluate((n) => getComputedStyle(n).backgroundColor),
          "rgba(0, 0, 0, 0)",
        );
      }
    await page.evaluate(() =>
      window.ikioPreview.configure({ theme: "dark", width: 360 }),
    );
    await card.scrollIntoViewIfNeeded();
    assert.equal(await card.locator("details").count(), 0);
    const initial = await card.boundingBox();
    await card.screenshot({ path: resolve(out, "vacuum-docked.png") });
    await card
      .getByRole("button", { name: "Start cleaning", exact: true })
      .click();
    await card.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await page.waitForFunction(() =>
      document.querySelector("ikio-vacuum-card").hasAttribute("vacuum-motion"),
    );
    assert.equal(await motion(), "ikio-vacuum-sweep");
    assert.equal(await disc.evaluate((n) => getComputedStyle(n).width), "28px");
    assert.equal((await card.boundingBox()).height, initial.height);
    await card.screenshot({
      path: resolve(out, "vacuum-cleaning.png"),
      animations: "disabled",
    });
    await card.getByRole("button", { name: "Pause", exact: true }).click();
    await card.getByRole("button", { name: "Resume", exact: true }).waitFor();
    assert.equal(await motion(), "none");
    await card.getByRole("button", { name: "Resume", exact: true }).click();
    await card.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await motion(), "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await card
      .getByRole("combobox", { name: "Suction", exact: true })
      .selectOption("Turbo");
    await page.waitForFunction(
      () => !document.querySelector("ikio-vacuum-card").pending.size,
    );
    assert.equal(
      await card
        .getByRole("combobox", { name: "Suction", exact: true })
        .inputValue(),
      "Turbo",
    );
    await card
      .getByRole("button", { name: "Return to dock", exact: true })
      .click();
    await card
      .locator(".vacuum-state")
      .filter({ hasText: "Returning to dock" })
      .waitFor();
    assert.equal(await card.locator(".vacuum-dock").count(), 0);
    assert.equal(await card.locator(".vacuum-primary").count(), 0);
    assert.equal(await motion(), "none");
    await state(page, "error", { error: "Main brush jammed" });
    assert.equal(
      await card.getByRole("alert").textContent(),
      "Main brush jammed",
    );
    await card.screenshot({ path: resolve(out, "vacuum-error.png") });
    await state(page, "unavailable", { error: null });
    assert.equal(await card.locator(".vacuum-battery").textContent(), "—");
    assert.ok(
      await card
        .locator(".vacuum-controls button,.vacuum-controls select")
        .evaluateAll((nodes) => nodes.every((n) => n.disabled)),
    );
    await state(page, "docked", { battery_level: 0 });
    assert.equal(await card.locator(".vacuum-battery").textContent(), "0%");
    await state(page, "docked", {}, "en", true);
    assert.equal(await card.locator(".vacuum-battery").count(), 0);
    await state(page, "cleaning", { supported_features: 8, error: null });
    await card.getByRole("button", { name: "Stop", exact: true }).waitFor();
    assert.equal(await card.locator("select").count(), 0);
    await state(
      page,
      "docked",
      {
        supported_features: 8192 | 4 | 16 | 32,
        battery_level: 86,
        friendly_name:
          "A long vacuum name that must wrap rather than hide important text",
      },
      "el-GR",
    );
    assert.match(await card.locator(".vacuum-state").textContent(), /Στη βάση/);
    for (const width of [280, 320, 390, 520]) {
      await page.evaluate(
        (width) =>
          (document.querySelector("main").style.gridTemplateColumns =
            `${width}px`),
        width,
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
        `Greek/${width}`,
      );
    }
    await card.screenshot({ path: resolve(out, "vacuum-greek.png") });
    await state(page, "cleaning");
    await card.scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      document.querySelector("ikio-vacuum-card").hasAttribute("vacuum-motion"),
    );
    await page.evaluate(() =>
      document.querySelector("[data-card=lights]").scrollIntoView(),
    );
    await page.waitForFunction(
      () =>
        !document
          .querySelector("ikio-vacuum-card")
          .hasAttribute("vacuum-motion"),
    );
    assert.deepEqual(errors, []);
    return { card: "vacuum", passed: true };
  } finally {
    await page.close();
  }
}
