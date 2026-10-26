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
  assert.equal(mod.colour(50), "#99dfae");
  assert.equal(mod.colour(1100, 100, 7100), mod.colour(500));
  assert.equal(mod.colour(-100), "#a4e4b8");
  assert.equal(mod.colour(9000), "#c47dd4");
  assert.throws(() => mod.colour(0, 1, 1));
});
test("dark and light palettes retain the same ten normalized thresholds", () => {
  const positions = [0, 100, 200, 380, 500, 700, 950, 1500, 2200, 3500];
  assert.deepEqual(
    mod.stops.map(([v]) => v),
    positions,
  );
  assert.deepEqual(
    mod.lightGraphStops.map(([v]) => v),
    positions,
  );
  for (const [value, color] of mod.lightGraphStops)
    assert.equal(mod.colour(value, 0, 3500, mod.lightGraphStops), color);
  assert.equal(
    mod.graphPalette("ha", { themes: { darkMode: false } }),
    mod.lightGraphStops,
  );
  assert.equal(
    mod.graphPalette("ha", { themes: { darkMode: true } }),
    mod.stops,
  );
  assert.equal(mod.graphPalette("light"), mod.lightGraphStops);
});
test("optional palette changes only colours and leaves default graphs unchanged", () => {
  const series = [
    {
      name: "Power",
      points: [
        { time: 1, value: 0 },
        { time: 2, value: 3500 },
      ],
    },
  ];
  const original = mod.graph(series);
  const palette = mod.stops.map(([position]) => [position, "#123456"]);
  const themed = mod.graph(series, { colourStops: palette });
  assert.equal(
    themed.querySelector("path").getAttribute("d"),
    original.querySelector("path").getAttribute("d"),
  );
  assert.deepEqual(
    [...themed.querySelectorAll("stop")].map((n) => n.getAttribute("offset")),
    [...original.querySelectorAll("stop")].map((n) => n.getAttribute("offset")),
  );
  assert.ok(
    [...themed.querySelectorAll("stop")].every(
      (n) => n.getAttribute("stop-color") === "#123456",
    ),
  );
  assert.equal(
    mod.graph(series).querySelector("stop").getAttribute("stop-color"),
    "#a4e4b8",
  );
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

test("energy guides and integer axis labels share exact min/mid/max positions without changing series precision", () => {
  const node = mod.graph(
    [
      {
        name: "Power",
        points: [
          { time: 1, value: 50.2 },
          { time: 2, value: 2643.4 },
        ],
      },
    ],
    {
      axisLabels: true,
      axisGuides: true,
      unit: "W",
      formatAxis: (v, u) => `${Math.round(v)} ${u}`,
    },
  );
  const labels = [...node.querySelectorAll("[data-extremum]")];
  assert.deepEqual(
    labels.map((n) => n.textContent),
    ["2643 W", "1347 W", "50 W"],
  );
  const lines = [...node.querySelectorAll("[data-guide]")];
  assert.deepEqual(
    lines.map((n) => n.getAttribute("data-guide")),
    ["max", "mid", "min"],
  );
  assert.deepEqual(
    lines.map((n) => Number(n.getAttribute("y1"))),
    [8, 50, 92],
  );
  assert.ok(lines.every((n) => n.getAttribute("stroke-dasharray") === "3 4"));
  for (let i = 0; i < labels.length; i++)
    assert.equal(
      parseFloat(labels[i].style.top),
      Number(lines[i].getAttribute("y1")),
    );
  assert.match(
    node.querySelector("svg").getAttribute("aria-label"),
    /50 W to 2643 W/,
  );
});
test("constant energy history gets one guide; plain graphs do not gain guides or a midpoint", () => {
  const series = [
    {
      name: "Power",
      points: [
        { time: 1, value: 160 },
        { time: 2, value: 160 },
      ],
    },
  ];
  const node = mod.graph(series, { axisLabels: true, axisGuides: true });
  assert.equal(node.querySelectorAll("[data-guide]").length, 1);
  assert.equal(node.querySelector("[data-guide]").getAttribute("y1"), "50");
  const plain = mod.graph(series);
  assert.equal(plain.querySelector("[data-guide]"), null);
  assert.equal(plain.querySelector(".ae-y-axis"), null);
  assert.ok(plain.querySelector(".ae-note"));
});

test("sparklines keep the main colour mapping while using independent height and a 0.8 px line", () => {
  const firstY = (node) =>
    Number(
      node
        .querySelector("path")
        .getAttribute("d")
        .match(/^M[^,]+,([^ ]+)/)[1],
    );
  const position = (node) => {
    const gradient = node.querySelector("linearGradient");
    return (
      (firstY(node) - Number(gradient.getAttribute("y1"))) /
      (Number(gradient.getAttribute("y2")) -
        Number(gradient.getAttribute("y1")))
    );
  };
  for (const [min, max] of [
    [0, 3500],
    [-100, 7000],
    [10, 1000],
  ]) {
    for (const value of [0, 10, 700, 3500]) {
      const main = mod.graph(
        [
          {
            name: "Total",
            points: [
              { time: 1, value },
              { time: 2, value: 4000 },
            ],
          },
        ],
        { min, max, axisLabels: true },
      );
      for (const constant of [false, true]) {
        const small = mod.graph(
          [
            {
              name: "Device",
              points: [
                { time: 1, value },
                { time: 2, value: constant ? value : value + 1 },
              ],
            },
          ],
          { min, max, sparkline: true },
        );
        assert.ok(
          Math.abs(position(main) - position(small)) < 1e-10,
          "same watts must land at the same colour-gradient position",
        );
        assert.ok(
          Math.abs(position(small) - (value - min) / (max - min)) < 1e-10,
        );
        assert.deepEqual(
          [...small.querySelectorAll("stop")].map((n) => [
            n.getAttribute("offset"),
            n.getAttribute("stop-color"),
          ]),
          [...main.querySelectorAll("stop")].map((n) => [
            n.getAttribute("offset"),
            n.getAttribute("stop-color"),
          ]),
        );
        assert.equal(
          small.querySelector("path").getAttribute("stroke-width"),
          "0.8",
        );
        assert.equal(
          small.querySelector("path").getAttribute("vector-effect"),
          "non-scaling-stroke",
        );
        assert.ok(
          !small.querySelector("path").getAttribute("d").includes("NaN"),
        );
      }
    }
  }
});

test("sparse device history holds its recorded value until the next timestamp instead of drawing a ramp", () => {
  const series = [
    {
      name: "Device",
      points: [
        { time: 0, value: 0 },
        { time: 90, value: 3910 },
      ],
    },
  ];
  const node = mod.graph(series, { sparkline: true, start: 0, end: 100 });
  const path = node.querySelector("path").getAttribute("d");
  assert.ok(path.startsWith("M8,80 H317.6 V8 "), path);
  assert.ok(path.includes("H352 V8"), path);
  assert.equal(path.includes("L"), false);
  const main = mod.graph(series, { start: 0, end: 100 });
  assert.ok(main.querySelector("path").getAttribute("d").includes("L"));
  const gap = mod.graph(
    [
      {
        name: "Device",
        points: [
          { time: 0, value: 0 },
          { time: 50, value: null },
          { time: 90, value: 3910 },
        ],
      },
    ],
    { sparkline: true, start: 0, end: 100 },
  );
  assert.equal(
    gap.querySelector("path").getAttribute("d").split("M").length,
    3,
  );
  assert.ok(!gap.querySelector("path").getAttribute("d").includes("H317.6"));
});
