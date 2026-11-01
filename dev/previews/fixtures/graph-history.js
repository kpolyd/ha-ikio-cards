// Fictional, deterministic preview histories. No recorder or production behaviour.
const power = [
  [0, 74],
  [0.12, 130],
  [0.17, 980],
  [0.23, 520],
  [0.31, 1420],
  [0.39, 260],
  [0.46, 3150],
  [0.5, 2860],
  [0.55, 145],
  [0.64, 620],
  [0.71, 1850],
  [0.77, 2650],
  [0.83, 350],
  [0.92, 1190],
  [1, 812],
];
const download = [
  [0, 0.05],
  [0.1, 0.12],
  [0.16, 1.2],
  [0.27, 2.8],
  [0.33, 0.6],
  [0.42, 0.08],
  [0.49, 3.4],
  [0.57, 2.1],
  [0.64, 0.15],
  [0.73, 0.8],
  [0.8, 0.18],
  [0.89, 1.8],
  [1, 1],
];
const upload = [
  [0, 0.15],
  [0.13, 0.22],
  [0.19, 0.1],
  [0.28, 1.6],
  [0.34, 4.7],
  [0.43, 3.1],
  [0.51, 0.3],
  [0.63, 0.12],
  [0.7, 2.3],
  [0.79, 0.5],
  [0.88, 0.2],
  [1, 1],
];
function sample(points, p) {
  const i = points.findIndex(([x]) => x >= p);
  if (i <= 0) return points[0][1];
  const [x, a] = points[i - 1],
    [y, b] = points[i];
  return a + ((b - a) * (p - x)) / (y - x);
}
export function demoGraphValue(id, state, progress) {
  const p = Math.max(0, Math.min(1, progress)),
    live = Number(state?.state);
  if (!Number.isFinite(live)) return null;
  let value;
  if (id.includes("network_rx")) value = sample(download, p) * live;
  else if (id.includes("network_tx")) value = sample(upload, p) * live;
  else if (id === "sensor.demo_graph_power") value = sample(power, p);
  else if (id.includes("cpu"))
    value = sample(
      [
        [0, 12],
        [0.14, 18],
        [0.24, 64],
        [0.34, 35],
        [0.48, 79],
        [0.6, 16],
        [0.74, 42],
        [0.88, 11],
        [1, live],
      ],
      p,
    );
  else value = live * (0.86 + 0.1 * Math.sin(p * 9) + 0.06 * Math.sin(p * 29));
  // Finish at the reported live reading instead of adding a discontinuity.
  if (p > 0.94) value += ((live - value) * (p - 0.94)) / 0.06;
  return Number(value.toFixed(3));
}
export function demoGraphHistory(id, state, start, end) {
  return Array.from({ length: 181 }, (_, i) => ({
    lu: (start + ((end - start) * i) / 180) / 1000,
    s: String(demoGraphValue(id, state, i / 180) ?? "unknown"),
    a: { unit_of_measurement: state?.attributes?.unit_of_measurement || "" },
  }));
}
