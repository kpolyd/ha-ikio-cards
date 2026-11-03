// Time-weighted bucket means: unchanged sensors retain their last recorded state.
// A bucket touched by unavailable history stays a gap rather than hiding it.
export function bucketHistory(points, start, end, pointsPerHour) {
  if (!points.length || end <= start) return [];
  const step = 3600000 / pointsPerHour;
  const result = [
    { time: start, value: points[0].time <= start ? points[0].value : null },
  ];
  let index = 0;
  for (let left = start; left < end; left += step) {
    const right = Math.min(end, left + step);
    let time = left,
      total = 0,
      gap = false;
    while (time < right) {
      while (index + 1 < points.length && points[index + 1].time <= time)
        index++;
      const point = points[index];
      const next = Math.min(right, points[index + 1]?.time ?? right);
      if (point.time > time) {
        gap = true;
        time = Math.min(right, point.time);
        continue;
      }
      if (!Number.isFinite(point.value)) gap = true;
      else total += point.value * (next - time);
      time = next;
    }
    result.push({
      time: (left + right) / 2,
      value: gap ? null : total / (right - left),
    });
  }
  result.push({ ...points.at(-1) });
  return result;
}
