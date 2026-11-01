import test from "node:test";
import assert from "node:assert/strict";
import { demoGraphHistory } from "../../dev/previews/fixtures/graph-history.js";
test("preview histories remain continuous, deterministic, unit-correct and aligned with live readings", () => {
  for (const [id, live, unit] of [
    ["sensor.demo_graph_power", 812, "W"],
    ["sensor.network_rx", 2.84, "MB/s"],
    ["sensor.network_tx", 0.34, "MB/s"],
    ["sensor.cpu", 18.6, "%"],
  ]) {
    const state = {
        state: String(live),
        attributes: { unit_of_measurement: unit },
      },
      history = demoGraphHistory(id, state, 0, 21600000);
    assert.deepEqual(history, demoGraphHistory(id, state, 0, 21600000));
    assert.equal(history[0].lu, 0);
    assert.equal(history.at(-1).lu, 21600);
    assert.equal(Number(history.at(-1).s), live);
    assert(
      history.every(
        (p, i) =>
          Number.isFinite(Number(p.s)) &&
          Number(p.s) >= 0 &&
          p.a.unit_of_measurement === unit &&
          (!i || p.lu > history[i - 1].lu),
      ),
    );
    if (unit === "%") assert(history.every((p) => Number(p.s) <= 100));
    if (unit === "W") {
      assert(Math.min(...history.map((p) => Number(p.s))) < 100);
      assert(Math.max(...history.map((p) => Number(p.s))) > 3000);
    }
  }
  const rx = demoGraphHistory(
    "sensor.network_rx",
    { state: "2.84" },
    0,
    1000,
  ).map((p) => Number(p.s));
  const tx = demoGraphHistory(
    "sensor.network_tx",
    { state: ".34" },
    0,
    1000,
  ).map((p) => Number(p.s));
  assert.notEqual(
    rx.indexOf(Math.max(...rx)),
    tx.indexOf(Math.max(...tx)),
    "upload/download bursts should occur at different times",
  );
});
