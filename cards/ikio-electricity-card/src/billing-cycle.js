// Five-field numeric cron, evaluated in HA's IANA timezone. Kept local to
// Energy: no backend service, browser-timezone dependency or runtime imports.
const MINUTE = 60000,
  DAY = 86400000;
const cache = new Map();
function field(text, min, max, sunday = false) {
  const values = new Set();
  for (const term of text.split(",")) {
    const match = /^(\*|\d{1,2}(?:-\d{1,2})?)(?:\/(\d{1,2}))?$/.exec(term);
    if (!match)
      throw Error(
        "Use five numeric cron fields with *, ranges, lists or steps; special expressions are not supported.",
      );
    const step = Number(match[2] || 1),
      base = match[1];
    let [start, end] = base === "*" ? [min, max] : base.split("-").map(Number);
    end ??= match[2] ? max : start;
    if (step < 1 || start < min || end > max || start > end)
      throw Error(
        "Billing cycle cron contains an out-of-range value or invalid step.",
      );
    for (let i = start; i <= end; i += step)
      values.add(sunday && i === 7 ? 0 : i);
  }
  return { values, startsStar: text.startsWith("*") };
}
export function parseBillingCron(expression) {
  if (typeof expression !== "string" || expression.length > 256)
    throw Error("Billing cycle cron must be a five-field expression.");
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5)
    throw Error(
      "Billing cycle cron needs five fields: minute hour day month weekday.",
    );
  const [minute, hour, day, month, weekday] = parts.map((p, i) =>
    field(
      p,
      ...[
        [0, 59],
        [0, 23],
        [1, 31],
        [1, 12],
        [0, 7, true],
      ][i],
    ),
  );
  return { minute, hour, day, month, weekday };
}
function localParts(formatter, timestamp) {
  return Object.fromEntries(
    formatter
      .formatToParts(timestamp)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  );
}
const wallTime = (p) =>
  Date.UTC(p.year, p.month - 1, p.day, p.hour || 0, p.minute || 0);
function matchingDay(cron, date) {
  if (!cron.month.values.has(date.getUTCMonth() + 1)) return false;
  const day = cron.day.values.has(date.getUTCDate()),
    weekday = cron.weekday.values.has(date.getUTCDay());
  // Match HA's CronSim/Debian convention, including */n in either day field.
  return cron.day.startsStar || cron.weekday.startsStar
    ? day && weekday
    : day || weekday;
}
function boundary(cron, formatter, now, direction) {
  const fixedTime = !cron.minute.startsStar && !cron.hour.startsStar;
  const local = localParts(formatter, now),
    today = wallTime({ ...local, hour: 0, minute: 0 });
  const times = [...cron.hour.values]
    .flatMap((h) => [...cron.minute.values].map((m) => h * 60 + m))
    .sort((a, b) => direction * (a - b));
  // Includes leap-day cycles around a non-leap century. Impossible dates fail
  // in bounded calendar work rather than scanning millions of UTC minutes.
  for (let i = 0; i <= 366 * 8; i++) {
    const midnight = today + direction * i * DAY,
      date = new Date(midnight);
    if (!matchingDay(cron, date)) continue;
    const offsets = [
      ...new Set(
        [-36, 0, 36].map((h) => {
          const instant = midnight + h * 3600000;
          return wallTime(localParts(formatter, instant)) - instant;
        }),
      ),
    ];
    let best = null;
    for (const time of times) {
      const wall = midnight + time * MINUTE;
      if (
        best !== null &&
        (direction < 0
          ? wall - Math.min(...offsets) <= best
          : wall - Math.max(...offsets) >= best)
      )
        break;
      let instants = offsets
        .map((offset) => wall - offset)
        .filter((instant) => wallTime(localParts(formatter, instant)) === wall)
        .sort((a, b) => a - b);
      // HA runs fixed-time schedules once in a repeated hour (the first
      // occurrence), and catches skipped times up at the end of a spring gap.
      // Wildcard minute/hour schedules instead follow real chronological time.
      if (fixedTime && instants.length > 1) instants = instants.slice(0, 1);
      if (fixedTime && !instants.length && offsets.length > 1) {
        let low = Math.min(...offsets.map((offset) => wall - offset)) / MINUTE;
        let high = Math.max(...offsets.map((offset) => wall - offset)) / MINUTE;
        while (low < high) {
          const mid = Math.floor((low + high) / 2);
          if (wallTime(localParts(formatter, mid * MINUTE)) >= wall) high = mid;
          else low = mid + 1;
        }
        const actual = wallTime(localParts(formatter, low * MINUTE));
        if (actual >= wall && actual - wall <= DAY) instants = [low * MINUTE];
      }
      for (const instant of instants) {
        if (
          direction < 0
            ? instant > now || (best !== null && instant <= best)
            : instant <= now || (best !== null && instant >= best)
        )
          continue;
        best = instant;
      }
    }
    if (best !== null) return best;
  }
  throw Error("Billing cycle cron has no matching reset within eight years.");
}
export function cronBillingCycle(expression, timeZone, now = Date.now()) {
  try {
    if (!timeZone) throw Error("Home Assistant's timezone is unavailable.");
    if (!Number.isFinite(now)) throw Error("The current date is invalid.");
    const key = `${expression}|${timeZone}`,
      saved = cache.get(key);
    if (saved && now >= saved.start && now < saved.end) return saved;
    const cron = parseBillingCron(expression);
    const formatter = new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const result = {
      start: boundary(cron, formatter, now, -1),
      end: boundary(cron, formatter, now, 1),
      timeZone,
    };
    if (cache.size >= 16) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
  } catch (error) {
    return { error: `Billing period unavailable: ${error.message}` };
  }
}
export function billingCycleLabel(cycle, hass) {
  if (cycle.error) return cycle.error;
  const locale = hass?.locale?.language || hass?.language;
  const zone = cycle.timeZone;
  const full = new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const start = localParts(full, cycle.start),
    end = localParts(full, cycle.end);
  const midnight =
    start.hour === 0 &&
    start.minute === 0 &&
    end.hour === 0 &&
    end.minute === 0;
  // User-facing bounds are inclusive; arithmetic uses [start, next reset).
  const last = cycle.end - 1,
    lastParts = localParts(full, last);
  const format = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    day: "numeric",
    month: "short",
    ...(start.year !== lastParts.year ? { year: "numeric" } : {}),
    ...(!midnight
      ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }
      : {}),
  });
  return `${format.format(cycle.start)} – ${format.format(last)}`;
}
