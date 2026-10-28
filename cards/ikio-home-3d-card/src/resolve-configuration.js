// No default home or entity mappings. All data comes from the three input files.
import { LabelType } from "./enums.js";
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const point = (value) =>
  object(value) && [value.x, value.y ?? 0, value.z].every(finite);
const safeId = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  !["__proto__", "prototype", "constructor"].includes(value);
const kinds = new Set([
  "box",
  "wall",
  "wallRun",
  "cylinder",
  "sphere",
  "rail",
  "cabinet",
  "chair",
  "picture",
  "radiator",
  "opening",
  "doorFrame",
  "light",
  "fan",
  "halo",
  "mesh",
]);
const behaviors = new Set([
  "light",
  "fan",
  "fanLight",
  "opening",
  "screen",
  "pick",
]);
const positive = (value) => finite(value) && value > 0;
function validateGeometry(node) {
  if (
    !["wallRun", "rail"].includes(node.kind) &&
    (!point(node.position) || !finite(node.position.y))
  )
    throw Error("Missing object position");
  if (
    ["box", "wall", "cabinet", "light"].includes(node.kind) &&
    (!object(node.size) ||
      ![node.size.width, node.size.height, node.size.depth].every(positive))
  )
    throw Error("Missing object dimensions");
  if (node.kind === "cylinder" && ![node.radius, node.height].every(positive))
    throw Error("Invalid cylinder");
  if (
    node.kind === "sphere" &&
    (!object(node.radii) ||
      ![node.radii.x, node.radii.y, node.radii.z].every(positive))
  )
    throw Error("Invalid sphere");
  if (
    node.kind === "rail" &&
    (!point(node.from) ||
      !finite(node.from.y) ||
      !point(node.to) ||
      !positive(node.radius))
  )
    throw Error("Invalid rail");
  if (
    ["opening", "doorFrame", "radiator"].includes(node.kind) &&
    (!positive(node.width) || !["x", "z"].includes(node.axis))
  )
    throw Error("Invalid opening or radiator");
  if (
    ["picture", "halo"].includes(node.kind) &&
    ![node.width, node.height].every(positive)
  )
    throw Error("Invalid flat object dimensions");
  if (
    node.kind === "fan" &&
    (typeof node.name !== "string" ||
      !point(node.emitterPosition) ||
      !finite(node.emitterPosition.y))
  )
    throw Error("Invalid fan");
  if (
    ["light", "fan"].includes(node.kind) &&
    (!finite(node.power) || node.power < 0)
  )
    throw Error("Invalid light power");
  if (
    node.kind === "mesh" &&
    (!object(node.geometry) ||
      !["TorusGeometry", "CylinderGeometry", "ConeGeometry"].includes(
        node.geometry.type,
      ) ||
      !object(node.geometry.parameters))
  )
    throw Error("Unsupported mesh geometry");
  if (
    node.kind === "wallRun" &&
    (!["x", "z"].includes(node.axis) ||
      ![node.start, node.end, node.coordinate].every(finite) ||
      node.end <= node.start ||
      ![node.height, node.thickness].every(positive))
  )
    throw Error("Invalid wall run");
}
export function resolveConfiguration(home, inventory, devices) {
  if (
    !object(home) ||
    !object(devices) ||
    !Array.isArray(inventory) ||
    home.schemaVersion !== 1 ||
    devices.schemaVersion !== 1
  )
    throw Error("Unsupported home configuration schema version");
  if (
    !object(home.coordinates) ||
    !point({ ...home.coordinates.origin, y: 0 }) ||
    ![home.coordinates.rotationY, home.coordinates.bearing].every(finite) ||
    !point({ ...home.overviewTarget, y: 0 })
  )
    throw Error("Invalid model coordinates");
  if (
    !object(home.rooms) ||
    !Array.isArray(home.rooms.Overview) ||
    !object(home.materials) ||
    !Array.isArray(home.floors) ||
    !Array.isArray(home.objects)
  )
    throw Error("Invalid home model structure");
  for (const [name, target] of Object.entries(home.rooms))
    if (
      !safeId(name) ||
      !Array.isArray(target) ||
      target.length !== 2 ||
      !target.every(finite)
    )
      throw Error("Invalid room target");
  for (const floor of home.floors)
    if (
      !object(floor) ||
      !point(floor.position) ||
      !object(floor.size) ||
      ![floor.size.width, floor.size.height, floor.size.depth].every(
        (v) => finite(v) && v > 0,
      ) ||
      !Object.hasOwn(home.rooms, floor.room)
    )
      throw Error("Invalid floor");
  if (
    !Array.isArray(devices.scene) ||
    !Array.isArray(devices.labels) ||
    !Array.isArray(devices.groups) ||
    !object(devices.layout)
  )
    throw Error("Invalid device bindings structure");
  const layout = { ...devices.layout };
  if (
    ![layout.edge, layout.top, layout.visibleTop, layout.collisionGap].every(
      (v) => finite(v) && v >= 0,
    ) ||
    !Array.isArray(layout.offsets) ||
    !layout.offsets.length ||
    !layout.offsets.every(finite)
  )
    throw Error("Invalid label layout");
  const byId = new Map(),
    actualIds = new Set();
  for (const item of inventory) {
    if (!object(item) || !safeId(item.id) || byId.has(item.id))
      throw Error("Duplicate or missing inventory ID");
    if (
      typeof item.entity !== "string" ||
      !/^[a-z_]+\.[a-zA-Z0-9_]+$/.test(item.entity) ||
      actualIds.has(item.entity)
    )
      throw Error("Duplicate or invalid Home Assistant entity");
    byId.set(item.id, item);
    actualIds.add(item.entity);
  }
  const entityId = (id) => {
    if (!byId.has(id)) throw Error("Unknown inventory ID");
    return byId.get(id).entity;
  };
  const objects = new Map();
  for (const node of home.objects) {
    if (
      !object(node) ||
      !safeId(node.id) ||
      objects.has(node.id) ||
      !kinds.has(node.kind)
    )
      throw Error("Duplicate or invalid model object");
    validateGeometry(node);
    if (node.position && !point(node.position))
      throw Error("Invalid object position");
    if (
      node.size &&
      (!object(node.size) ||
        !Object.values(node.size).every((v) => finite(v) && v > 0))
    )
      throw Error("Invalid object size");
    if (node.rotation && !Object.values(node.rotation).every(finite))
      throw Error("Invalid object rotation");
    if (
      typeof node.material === "string" &&
      !Object.hasOwn(home.materials, node.material) &&
      !node.material.endsWith("Floor")
    )
      throw Error("Unknown material");
    objects.set(node.id, node);
  }
  const bindings = devices.scene.map((binding) => {
    if (
      !object(binding) ||
      !objects.has(binding.object) ||
      !behaviors.has(binding.behavior)
    )
      throw Error("Invalid scene binding");
    const kind = objects.get(binding.object).kind;
    if (
      (binding.behavior === "light" && kind !== "light") ||
      (["fan", "fanLight"].includes(binding.behavior) && kind !== "fan") ||
      (binding.behavior === "opening" &&
        !["opening", "doorFrame"].includes(kind))
    )
      throw Error("Incompatible scene binding");
    if (binding.activeStates && !Array.isArray(binding.activeStates))
      throw Error("Invalid screen states");
    return { ...binding, entity: entityId(binding.entity) };
  });
  for (const node of home.objects) {
    if (node.kind === "wallRun") {
      if (!Array.isArray(node.openings)) throw Error("Invalid wall openings");
      for (const id of node.openings) {
        const opening = objects.get(id);
        if (
          !opening ||
          !["opening", "doorFrame"].includes(opening.kind) ||
          opening.axis !== node.axis
        )
          throw Error("Invalid wall opening");
      }
    }
    if (
      node.kind === "halo" &&
      !["light", "fan"].includes(objects.get(node.source)?.kind)
    )
      throw Error("Unknown halo light source");
  }
  const labels = new Map();
  for (const label of devices.labels) {
    if (
      !object(label) ||
      labels.has(label.entity) ||
      !Object.values(LabelType).includes(label.type) ||
      !point(label.position)
    )
      throw Error("Invalid label");
    entityId(label.entity);
    if (label.humidity) entityId(label.humidity);
    labels.set(label.entity, label);
  }
  const entities = inventory.map(({ id, ...item }) => {
    const label = labels.get(id);
    return label
      ? {
          ...item,
          ...label,
          name: label.name || item.name || item.entity,
          entity: item.entity,
          ...(label.humidity ? { humidity: entityId(label.humidity) } : {}),
        }
      : item;
  });
  const grouped = new Set();
  const labelGroups = devices.groups.map((group) => {
    if (
      !object(group) ||
      !Array.isArray(group.members) ||
      !group.members.length
    )
      throw Error("Invalid label group");
    if (
      group.centerBetween &&
      (!Array.isArray(group.centerBetween.z) ||
        group.centerBetween.z.length !== 2 ||
        !group.centerBetween.z.every(finite) ||
        !finite(group.centerBetween.y))
    )
      throw Error("Invalid group anchor");
    return {
      ...group,
      members: group.members.map((id) => {
        if (!labels.has(id) || grouped.has(id))
          throw Error("Invalid group label");
        grouped.add(id);
        return entityId(id);
      }),
    };
  });
  const lightEntities = new Set(
    bindings
      .filter((b) => ["light", "fanLight"].includes(b.behavior) && !b.onOffOnly)
      .map((b) => b.entity),
  );
  return {
    home,
    entities,
    rooms: home.rooms,
    bindings,
    labelGroups,
    layout,
    lightEntities,
  };
}
