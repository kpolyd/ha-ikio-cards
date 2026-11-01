import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
export async function checkChip(browser, out) {
  const page = await browser.newPage({
      viewport: { width: 740, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.route("**/*", (r) =>
      r.request().url().startsWith("file:") ? r.continue() : r.abort(),
    );
    await page.goto(pathToFileURL(resolve("dist/previews/index.html")).href);
    await page.waitForFunction(() => window.ikioPreview?.ready);
    const card = page.locator("ikio-chip-card");
    for (const theme of ["dark", "light", "ha"])
      for (const width of [100, 160, 280, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await card.scrollIntoViewIfNeeded();
        if (theme === "ha")
          await card.evaluate((c) => {
            for (const [name, value] of Object.entries({
              "--ha-card-background": "#f3f7f6",
              "--secondary-background-color": "#e4eeeb",
              "--divider-color": "#bdcfca",
              "--primary-text-color": "#17282e",
              "--secondary-text-color": "#50645f",
              "--primary-color": "#245d85",
            }))
              c.style.setProperty(name, value);
          });
        const stateColors = await card.evaluate(async (c) => {
          const colors = [];
          c.setConfig({ ...c.config, entity: "light.chip_test" });
          for (const state of ["on", "off", "unknown"]) {
            c.hass = {
              ...c.hass,
              states: {
                ...c.hass.states,
                "light.chip_test": {
                  entity_id: "light.chip_test",
                  state,
                  attributes: {},
                },
              },
            };
            await new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            );
            colors.push(
              getComputedStyle(c.content.querySelector("ha-state-icon")).color,
            );
          }
          return colors;
        });
        assert.notEqual(stateColors[0], stateColors[1], `${theme}/active`);
        assert.equal(stateColors[1], stateColors[2], `${theme}/unknown`);
        for (const show_name of [false, true]) {
          await card.evaluate(
            (c, show_name) =>
              c.setConfig({
                ...c.config,
                entity: "sensor.temperature",
                show_name,
                name: "Living",
                icon: "mdi:thermometer",
              }),
            show_name,
          );
          const metrics = await card.evaluate((c) => {
            const chip = c.content.querySelector("button"),
              surface = chip.querySelector(".ikio-chip-surface");
            return {
              height: surface.getBoundingClientRect().height,
              touch: chip.getBoundingClientRect().height,
              hidden: chip.querySelector(".ikio-chip-name").hidden,
              icon: chip.querySelector("ha-state-icon").icon,
              border: getComputedStyle(surface).borderTopWidth,
              overflow: c.shell.scrollWidth > c.shell.clientWidth + 2,
            };
          });
          assert.equal(metrics.hidden, !show_name);
          assert.equal(metrics.height, show_name ? 34 : 28);
          assert(metrics.touch >= 44);
          assert.equal(metrics.border, "1px");
          assert.equal(metrics.icon, "mdi:thermometer");
          assert.equal(
            metrics.overflow,
            false,
            `${theme}/${width}/${show_name}`,
          );
          if (width === 390)
            await card.screenshot({
              path: resolve(
                out,
                `chip-${theme}-${show_name ? "named" : "minimal"}.png`,
              ),
            });
        }
      }
    await card.locator("button").click();
    assert.match(
      await page.locator("#log").textContent(),
      /sensor.temperature/,
    );
    await card.evaluate((c) => {
      c.setConfig({
        ...c.config,
        icon: "",
        show_name: true,
        name: "Πολύ μεγάλο όνομα αισθητήρα για έλεγχο στενής προβολής",
      });
      c.hass = { ...c.hass, locale: { language: "el-GR" } };
    });
    for (const width of [100, 160, 280, 390]) {
      await page.evaluate(
        (width) =>
          (document.querySelector("main").style.gridTemplateColumns =
            `${width}px`),
        width,
      );
      assert.equal(
        await card.evaluate(
          (c) => c.shell.scrollWidth > c.shell.clientWidth + 2,
        ),
        false,
        `long/${width}`,
      );
    }
    const shared = await page
      .locator("ikio-server-monitor-card")
      .evaluate((c) =>
        [...c.content.querySelectorAll(".ikio-sensor-chip")].map((chip) => ({
          compact: chip.classList.contains("ikio-chip-compact"),
          nameHidden: chip.querySelector(".ikio-chip-name").hidden,
        })),
      );
    assert(shared.length > 0);
    assert(shared.every((chip) => chip.compact && !chip.nameHidden));
    await card.evaluate((c) => {
      const badge = document.createElement("ikio-chip-badge");
      badge.id = "chip-test-badge";
      badge.style.cssText = c.style.cssText;
      badge.setConfig({ ...c.config, name: "Room", icon: "mdi:thermometer" });
      badge.hass = c.hass;
      document.querySelector("main").append(badge);
    });
    const badge = page.locator("#chip-test-badge");
    assert.equal(
      await badge
        .locator(".ikio-chip-surface")
        .evaluate((n) => n.getBoundingClientRect().height),
      34,
    );
    for (const target of [card, badge]) {
      await target.scrollIntoViewIfNeeded();
      await target.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const light = await target.evaluate(async (c) => {
        const id = "light.strip",
          calls = [];
        c.setConfig({
          ...c.config,
          entity: id,
          name: "Example light",
          icon: "",
        });
        const original = window.ikioPreview.states[id];
        const hass = {
          ...c.hass,
          locale: { language: "en" },
          language: "en",
          formatEntityState: (s) => s.state,
          callService: async (...args) => calls.push(args),
        };
        let opened;
        c.addEventListener(
          "hass-more-info",
          (e) => (opened = e.detail.entityId),
        );
        const values = [],
          colors = [];
        for (const state of ["on", "off", "unavailable"]) {
          c.hass = {
            ...hass,
            states: { ...hass.states, [id]: { ...original, state } },
          };
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          colors.push(
            getComputedStyle(c.content.querySelector("ha-state-icon")).color,
          );
          values.push(
            c.content
              .querySelector(".ikio-chip-value")
              .textContent.toLowerCase(),
          );
        }
        c.content.querySelector("button").click();
        return {
          values,
          colors,
          opened,
          calls: calls.length,
          native: c.content.querySelector("ha-state-icon").stateObj.entity_id,
        };
      });
      assert.deepEqual(light.values, ["on", "off", "unavailable"]);
      assert.notEqual(light.colors[0], light.colors[1]);
      assert.equal(light.colors[1], light.colors[2]);
      assert.equal(light.opened, "light.strip");
      assert.equal(light.native, "light.strip");
      assert.equal(light.calls, 0);
    }
    for (const target of [card, badge]) {
      await target.scrollIntoViewIfNeeded();
      const selected = await target.evaluate(async (c) => {
        const id = "select.chip_source",
          calls = [];
        c.setConfig({ ...c.config, entity: id });
        const states = [];
        c.hass = { ...c.hass, callService: async (...a) => calls.push(a) };
        for (const state of ["Grid", "Solar", "unavailable"]) {
          c.hass = {
            ...c.hass,
            states: {
              ...c.hass.states,
              [id]: {
                entity_id: id,
                state,
                attributes: { options: ["Grid", "Solar"] },
              },
            },
          };
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
          states.push(c.content.querySelector(".ikio-chip-value").textContent);
        }
        let opened;
        c.addEventListener(
          "hass-more-info",
          (e) => (opened = e.detail.entityId),
        );
        c.content.querySelector("button").click();
        return { states, opened, calls };
      });
      assert.deepEqual(selected.states, ["Grid", "Solar", "unavailable"]);
      assert.equal(selected.opened, "select.chip_source");
      assert.deepEqual(selected.calls, []);
    }
    const server = page.locator("ikio-server-monitor-card");
    for (const theme of ["dark", "light", "ha"])
      for (const width of [280, 320, 390, 520]) {
        await page.evaluate(
          (options) => window.ikioPreview.configure(options),
          { theme, width },
        );
        await server.evaluate((c) =>
          c.setConfig({
            ...c.config,
            extra_readings: c.config.extra_readings.map((row, i) => ({
              ...row,
              show_name: i === 0,
              icon: i === 0 ? "mdi:harddisk" : "",
            })),
          }),
        );
        if (theme === "ha")
          await server.evaluate((c) => {
            for (const [name, value] of Object.entries({
              "--ha-card-background": "#f3f7f6",
              "--secondary-background-color": "#e4eeeb",
              "--divider-color": "#bdcfca",
              "--primary-text-color": "#17282e",
              "--secondary-text-color": "#50645f",
              "--primary-color": "#245d85",
            }))
              c.style.setProperty(name, value);
          });
        await server.scrollIntoViewIfNeeded();
        const metrics = await server.evaluate((c) => {
          const chips = [...c.content.querySelectorAll(".ikio-sensor-chip")];
          return {
            ip: c.content.querySelector(".system-ip").textContent,
            font: getComputedStyle(c.content.querySelector(".system-ip"))
              .fontSize,
            heights: chips.map(
              (n) =>
                n.querySelector(".ikio-chip-surface").getBoundingClientRect()
                  .height,
            ),
            borders: chips.map(
              (n) =>
                getComputedStyle(n.querySelector(".ikio-chip-surface"))
                  .borderTopWidth,
            ),
            padding: chips.map((n) => getComputedStyle(n).paddingLeft),
            icon: chips[0].querySelector("ha-state-icon").icon,
            overflow: c.shell.scrollWidth > c.shell.clientWidth + 2,
          };
        });
        assert.equal(metrics.ip, "192.0.2.10");
        assert.equal(metrics.font, "11px");
        assert.deepEqual(metrics.heights, [34, 28, 28]);
        assert(metrics.borders.every((v) => v === "1px"));
        assert(metrics.padding.every((v) => v === "0px"));
        assert.equal(metrics.icon, "mdi:harddisk");
        assert.equal(metrics.overflow, false, `server/${theme}/${width}`);
        if (width === 390)
          await server.screenshot({
            path: resolve(out, `server-ip-chips-${theme}.png`),
          });
      }
    await server.evaluate((c) => {
      c.setConfig({
        ...c.config,
        name: "Διακομιστής με μεγάλο όνομα",
        ip_address_entity: "sensor.server_ip",
      });
      c.hass = {
        ...c.hass,
        states: {
          ...c.hass.states,
          "sensor.server_ip": {
            state: "2001:db8:abcd:1234:5678:90ab:cdef:1234",
            attributes: {},
          },
        },
      };
    });
    await page.evaluate(
      () =>
        (document.querySelector("main").style.gridTemplateColumns = "280px"),
    );
    assert.equal(
      await server.evaluate(
        (c) => c.shell.scrollWidth > c.shell.clientWidth + 2,
      ),
      false,
      "IPv6/Greek header",
    );
    await server.screenshot({
      path: resolve(out, "server-ipv6-long-name.png"),
    });
    await card.evaluate((c) => {
      c.setConfig({ entity: "person.demo" });
      window.ikioPreview.states["person.demo"] = {
        entity_id: "person.demo",
        state: "home",
        attributes: { friendly_name: "Demo person", icon: "mdi:account" },
      };
      c.hass = { ...c.hass, states: { ...window.ikioPreview.states } };
    });
    assert.equal(
      await card.locator(".ikio-chip-name").evaluate((n) => n.hidden),
      false,
    );
    await card.scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      /home/i.test(
        document
          .querySelector("ikio-chip-card")
          .content.querySelector(".ikio-chip-value").textContent,
      ),
    );
    assert.match(await card.locator(".ikio-chip-value").textContent(), /home/i);
    await card.locator("button").click();
    assert.match(await page.locator("#log").textContent(), /person.demo/);
    await card.evaluate((c) => {
      window.ikioPreview.states["switch.demo_plug"] = {
        entity_id: "switch.demo_plug",
        state: "on",
        attributes: { friendly_name: "Demo plug", icon: "mdi:power-socket-eu" },
      };
      c.setConfig({ entity: "switch.demo_plug" });
      c.hass = { ...c.hass, states: { ...window.ikioPreview.states } };
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("ikio-chip-card")
          .content.querySelector(".ikio-chip-value")
          .textContent.toLowerCase() === "on",
    );
    await card.locator("button").click();
    assert.match(await page.locator("#log").textContent(), /switch.demo_plug/);
    await card.evaluate((c) => {
      window.ikioPreview.states["switch.demo_plug"] = {
        ...window.ikioPreview.states["switch.demo_plug"],
        state: "off",
      };
      c.hass = { ...c.hass, states: { ...window.ikioPreview.states } };
    });
    await page.waitForFunction(
      () =>
        document
          .querySelector("ikio-chip-card")
          .content.querySelector(".ikio-chip-value")
          .textContent.toLowerCase() === "off",
    );
    assert.deepEqual(errors, []);
    return { card: "chip", passed: true };
  } finally {
    await page.close();
  }
}
