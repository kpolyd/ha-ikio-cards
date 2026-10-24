import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
let dom, mod;
before(async () => {
  dom = new JSDOM("<body></body>");
  for (const k of [
    "window",
    "document",
    "HTMLElement",
    "customElements",
    "CustomEvent",
  ])
    globalThis[k] = dom.window[k];
  mod = await import("../src/index.js");
});
after(() => dom.window.close());
test("fixed stops, midpoint and rescaled range use encoded RGB interpolation", () => {
  for (const [v, c] of mod.stops) assert.equal(mod.colour(v), c);
  assert.equal(mod.colour(50), "#6af68c");
  assert.equal(mod.colour(1100, 100, 7100), mod.colour(500));
  assert.equal(mod.colour(-100), "#6ff7b3");
  assert.equal(mod.colour(9000), "#d400ff");
  assert.throws(() => mod.colour(0, 1, 1));
});
test("history retains missing-data gaps and converts recorded power units", () => {
  const data = mod.normalizeHistory(
    [
      { lu: 1, s: "1", a: { unit_of_measurement: "kW" } },
      { lu: 2, s: "unavailable" },
      { lu: 3, s: "0" },
    ],
    "W",
  );
  assert.deepEqual(
    data.map((p) => p.value),
    [1000, null, 0],
  );
  assert.deepEqual(
    data.map((p) => p.time),
    [1000, 2000, 3000],
  );
});
test("bounded samples preserve peaks and a gap rather than fabricating continuity", () => {
  const source = Array.from({ length: 3000 }, (_, i) => ({
    time: i,
    value: i === 555 ? 9000 : i === 1500 ? null : 10,
  }));
  const data = mod.downsample(source);
  assert.ok(data.length <= 240);
  assert.ok(data.some((p) => p.value === 9000));
  assert.ok(data.some((p) => p.value === null));
});
test("renderer uses vertical value gradient and starts a new path after gaps", () => {
  const node = mod.graph(
    [
      {
        name: "Power",
        points: [
          { time: 1, value: 0 },
          { time: 2, value: 3500 },
          { time: 3, value: null },
          { time: 4, value: 10 },
        ],
      },
    ],
    { start: 1, end: 4 },
  );
  assert.equal(
    node.querySelector("linearGradient").getAttribute("gradientUnits"),
    "userSpaceOnUse",
  );
  assert.equal(node.querySelectorAll("stop").length, 10);
  assert.equal(
    node.querySelector("path").getAttribute("d").split("M").length,
    3,
  );
});
test("identical history requests are deduplicated, rejected requests can retry", async () => {
  let calls = 0;
  const hass = {
    connection: {},
    callWS: async () => {
      calls++;
      return { sensor: [] };
    },
  };
  await Promise.all([
    mod.fetchHistory(hass, ["sensor"], 6, 100000),
    mod.fetchHistory(hass, ["sensor"], 6, 100000),
  ]);
  assert.equal(calls, 1);
  let fail = true;
  const broken = {
    connection: {},
    callWS: async () => {
      if (fail) throw Error("Unavailable");
      return {};
    },
  };
  await assert.rejects(mod.fetchHistory(broken, ["sensor"], 6, 100000));
  fail = false;
  await mod.fetchHistory(broken, ["sensor"], 6, 100000);
});

test("energy axis labels use the displayed window, not the expected colour range", () => {
  const node = mod.graph(
    [
      {
        name: "Power",
        points: [
          { time: 0, value: 9000 },
          { time: 1, value: 100 },
          { time: 2, value: 200 },
          { time: 3, value: 150 },
        ],
      },
    ],
    { start: 1, end: 3, unit: "W", min: 0, max: 3500, axisLabels: true },
  );
  assert.equal(node.querySelector("[data-extremum=max]").textContent, "200 W");
  assert.equal(node.querySelector("[data-extremum=min]").textContent, "100 W");
  assert.equal(node.querySelector(".ae-note"), null);
  assert.ok(node.querySelector("path"));
});
test("constant, negative and unavailable windows keep truthful axis labels", () => {
  const constant = mod.graph(
    [
      {
        name: "Power",
        points: [
          { time: 1, value: 0 },
          { time: 2, value: 0 },
        ],
      },
    ],
    { axisLabels: true },
  );
  assert.equal(constant.querySelectorAll("[data-extremum]").length, 1);
  assert.equal(constant.querySelector("[data-extremum]").textContent, "0");
  const negative = mod.graph(
    [
      {
        name: "Power",
        points: [
          { time: 1, value: -50 },
          { time: 2, value: -10 },
        ],
      },
    ],
    { axisLabels: true },
  );
  assert.equal(
    negative.querySelector("[data-extremum=min]").textContent,
    "-50",
  );
  assert.equal(
    negative.querySelector("[data-extremum=max]").textContent,
    "-10",
  );
  assert.equal(
    mod
      .graph([{ name: "Power", points: [{ time: 1, value: null }] }], {
        axisLabels: true,
      })
      .querySelector(".ae-y-axis"),
    null,
  );
});
