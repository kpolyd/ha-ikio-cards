// Discovery uses HA's state and registry snapshots only: no polling, history or
// device commands. An explicit battery percentage wins over legacy attributes.
const metadataKind = (id, entry) => {
  const key = entry?.translation_key || id.split(".")[1] || "";
  if (/(?:^|_)battery_(?:type|size)$/.test(key)) return "type";
  if (/(?:^|_)battery_(?:quantity|count)$/.test(key)) return "quantity";
};
function percentage(value) {
  if (
    !["string", "number"].includes(typeof value) ||
    String(value).trim() === ""
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}
function reported(value) {
  return typeof value === "string" &&
    value.trim() &&
    !["unknown", "unavailable", "none"].includes(value.trim().toLowerCase())
    ? value.trim()
    : null;
}
export function batteryInfo(attributes, metadata = {}) {
  let type =
    reported(attributes.battery_type) ||
    reported(attributes.battery_size) ||
    reported(metadata.type);
  const embedded = type?.match(/^(\d+)\s*[x×*]\s*(.+)$/i);
  if (embedded) type = embedded[2].trim();
  const raw =
    attributes.battery_quantity ??
    attributes.battery_count ??
    metadata.quantity ??
    embedded?.[1];
  const quantity = raw === undefined ? 1 : Number(raw);
  const rechargeable =
    attributes.battery_rechargeable === true ||
    /rechargeable|li[ -]?ion|li[ -]?po|lithium[ -]?ion/i.test(type || "");
  return {
    type,
    quantity:
      Number.isInteger(quantity) && quantity > 0 && quantity <= 100
        ? quantity
        : null,
    rechargeable,
  };
}
export function discoverBatteries(hass, config = {}) {
  const states = hass?.states || {},
    entities = hass?.entities || {};
  const ignored = new Set(config.ignored_devices || []),
    candidates = [],
    metadata = new Map(),
    dependencies = new Set();
  for (const [id, state] of Object.entries(states)) {
    const entry = entities[id],
      deviceId = entry?.device_id;
    if (ignored.has(deviceId) || entry?.disabled_by) continue;
    const kind = metadataKind(id, entry);
    if (kind) {
      // Associate companion metadata by device registry ID, never by a fuzzy
      // friendly-name match that could combine unrelated household devices.
      if (deviceId) {
        const data = metadata.get(deviceId) || {};
        data[kind] = state.state;
        metadata.set(deviceId, data);
        dependencies.add(id);
      }
      continue;
    }
    const attrs = state.attributes || {},
      domain = id.split(".")[0];
    const unavailable = ["unknown", "unavailable"].includes(state.state);
    let value,
      binary = false,
      priority;
    if (domain === "sensor" && attrs.device_class === "battery") {
      value = unavailable ? null : percentage(state.state);
      priority = 3;
    } else if (domain === "binary_sensor" && attrs.device_class === "battery") {
      binary = true;
      value = state.state === "on" ? 0 : state.state === "off" ? 100 : null;
      priority = 1;
    } else if (
      attrs.battery_level !== undefined ||
      attrs.battery !== undefined
    ) {
      value = unavailable
        ? null
        : percentage(attrs.battery_level ?? attrs.battery);
      priority = 2;
    } else continue;
    dependencies.add(id);
    const device = hass?.devices?.[deviceId];
    const areaId = entry?.area_id || device?.area_id;
    candidates.push({
      id,
      state,
      deviceId,
      value,
      binary,
      priority,
      name: device?.name_by_user || device?.name || attrs.friendly_name || id,
      area: hass?.areas?.[areaId]?.name || "",
      updated: state.last_updated,
    });
  }
  // One physical device = one replacement requirement. Retain a usable reading
  // ahead of unavailable duplicate entities, then prefer percentage sensors.
  const unique = new Map();
  for (const candidate of candidates.sort((a, b) => a.id.localeCompare(b.id))) {
    const key = candidate.deviceId || candidate.id,
      old = unique.get(key);
    const score = (row) => (row.value === null ? 0 : 10) + row.priority;
    if (!old || score(candidate) > score(old)) unique.set(key, candidate);
  }
  const rows = [...unique.values()]
    .map((row) => ({
      ...row,
      ...batteryInfo(row.state.attributes || {}, metadata.get(row.deviceId)),
    }))
    .sort(
      (a, b) =>
        (a.value ?? Infinity) - (b.value ?? Infinity) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );
  return { rows, dependencies: [...dependencies] };
}
export function isLow(row, lowThreshold) {
  return (
    row.value !== null &&
    (row.binary ? row.value === 0 : row.value <= lowThreshold)
  );
}
export function replacementSummary(rows, lowThreshold) {
  const types = new Map();
  let unknown = 0;
  for (const row of rows) {
    if (!isLow(row, lowThreshold) || row.rechargeable) continue;
    if (!row.type || row.quantity === null) {
      unknown++;
      continue;
    }
    const key = row.type.toUpperCase();
    types.set(key, (types.get(key) || 0) + row.quantity);
  }
  return { types: [...types].sort(([a], [b]) => a.localeCompare(b)), unknown };
}
