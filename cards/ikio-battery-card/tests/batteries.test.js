import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverBatteries,
  batteryInfo,
  replacementSummary,
} from "../src/batteries.js";
const sensor = (state, attributes = {}) => ({
  state: String(state),
  attributes: {
    device_class: "battery",
    unit_of_measurement: "%",
    ...attributes,
  },
});
test("discovers only battery readings, sorts numerically, preserves zero and reports invalid/unavailable honestly", () => {
  const { rows } = discoverBatteries({
    states: {
      "sensor.zero": sensor(0),
      "sensor.high": sensor(80),
      "sensor.low": sensor(9),
      "sensor.humidity": {
        state: "10",
        attributes: { device_class: "humidity", unit_of_measurement: "%" },
      },
      "sensor.negative": sensor(-1),
      "sensor.empty": sensor(""),
      "sensor.large": sensor(101),
      "sensor.missing": sensor("unavailable"),
      "sensor.boolean": sensor(true),
    },
  });
  assert.deepEqual(
    rows.slice(0, 3).map((r) => r.value),
    [0, 9, 80],
  );
  assert.equal(rows.length, 8);
  assert(rows.slice(3).every((r) => r.value === null));
});
test("one device uses a percentage sensor ahead of attributes/binary status and ignores devices entirely", () => {
  const hass = {
    states: {
      "vacuum.robot": { state: "docked", attributes: { battery_level: 70 } },
      "sensor.robot_battery": sensor(15, { battery_type: "CR2032" }),
      "binary_sensor.robot_battery": {
        state: "on",
        attributes: { device_class: "battery" },
      },
      "sensor.other": sensor(25, { battery_type: "CR2032" }),
    },
    entities: {
      "vacuum.robot": { device_id: "robot" },
      "sensor.robot_battery": { device_id: "robot" },
      "binary_sensor.robot_battery": { device_id: "robot" },
      "sensor.other": { device_id: "other", area_id: "office" },
    },
    devices: { robot: { name_by_user: "Robot" } },
    areas: { office: { name: "Office" } },
  };
  assert.deepEqual(
    discoverBatteries(hass).rows.map((r) => r.id),
    ["sensor.robot_battery", "sensor.other"],
  );
  const { rows } = discoverBatteries(hass, { ignored_devices: ["robot"] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].area, "Office");
  assert.deepEqual(replacementSummary(rows, 25).types, [["CR2032", 1]]);
  hass.states["sensor.robot_battery"] = sensor("unavailable");
  assert.equal(
    discoverBatteries(hass).rows.find((r) => r.deviceId === "robot").id,
    "vacuum.robot",
  );
});
test("discovers legacy battery attributes and binary low indicators without inventing percentages", () => {
  const { rows } = discoverBatteries({
    states: {
      "lock.front": { state: "locked", attributes: { battery_level: 18 } },
      "sensor.legacy": { state: "abc", attributes: { battery: 22 } },
      "binary_sensor.low": {
        state: "on",
        attributes: { device_class: "battery" },
      },
      "binary_sensor.normal": {
        state: "off",
        attributes: { device_class: "battery" },
      },
    },
  });
  assert.deepEqual(
    rows.map((r) => r.value),
    [0, 18, 22, 100],
  );
  assert.equal(rows[0].binary, true);
  assert.equal(rows[3].binary, true);
});
test("metadata comes from reported attributes or companion entities on the same device", () => {
  const { rows } = discoverBatteries({
    states: {
      "sensor.a": sensor(12),
      "sensor.a_battery_type": { state: "2xAAA", attributes: {} },
      "sensor.b": sensor(10),
      "sensor.unrelated_battery_type": { state: "CR2032", attributes: {} },
    },
    entities: {
      "sensor.a": { device_id: "a" },
      "sensor.a_battery_type": { device_id: "a" },
    },
  });
  assert.equal(rows.find((r) => r.id === "sensor.a").type, "AAA");
  assert.equal(rows.find((r) => r.id === "sensor.a").quantity, 2);
  assert.equal(rows.find((r) => r.id === "sensor.b").type, null);
  assert.equal(rows.length, 2);
});
test("replacement summary aggregates cells, normalizes type case, excludes rechargeables and tracks missing types/counts", () => {
  const rows = [
    { value: 25, ...batteryInfo({ battery_type: "CR2032" }) },
    {
      value: 12,
      ...batteryInfo({ battery_type: "cr2032", battery_quantity: 2 }),
    },
    { value: 20, ...batteryInfo({ battery_type: "2 × AAA" }) },
    { value: 5, ...batteryInfo({ battery_type: "Li-ion" }) },
    {
      value: 10,
      ...batteryInfo({ battery_type: "AAA", battery_rechargeable: true }),
    },
    { value: 25, ...batteryInfo({}) },
    { value: 4, ...batteryInfo({ battery_type: "AA", battery_quantity: 0 }) },
    { value: 26, ...batteryInfo({ battery_type: "AA" }) },
    { value: null, ...batteryInfo({ battery_type: "AA" }) },
  ];
  assert.deepEqual(replacementSummary(rows, 25), {
    types: [
      ["AAA", 2],
      ["CR2032", 3],
    ],
    unknown: 2,
  });
});

test("binary Normal stays healthy even when the numeric low threshold is 100", () => {
  const rows = [
    { value: 0, binary: true, ...batteryInfo({ battery_type: "AAA" }) },
    { value: 100, binary: true, ...batteryInfo({ battery_type: "AA" }) },
  ];
  assert.deepEqual(replacementSummary(rows, 100).types, [["AAA", 1]]);
});
