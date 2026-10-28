import { LabelType } from "../enums.js";
import { getLabels } from "../label-config.js";
import { language } from "@ikio/card-ui/i18n";
import { createLabel } from "./types.js";

// Owns DOM lifecycle and projection only; type renderers own appearance/state.
export function createLabelLayer({
  canvas,
  camera,
  worldPoint,
  entities,
  labelGroups: groupsConfig = [],
  layout: layoutConfig,
  openings,
  onPick,
  onLayoutChange = () => {},
  getHass = () => undefined,
}) {
  const badgeLayer = document.createElement("div");
  badgeLayer.className = "sensor-badges";
  canvas.parentElement.append(badgeLayer);
  const sensorBadges = getLabels(entities, openings).map((spec) =>
    createLabel(spec, onPick, getHass),
  );
  sensorBadges.forEach((b) => badgeLayer.append(b.el));
  const hiddenChildren = new Set(),
    groups = new Map();
  for (const group of groupsConfig) {
    const children = group.members.map((id) =>
      sensorBadges.find((b) => b.id === id),
    );
    if (children.some((b) => !b))
      throw new Error("Unknown label in group: " + group.members.join(", "));
    const stack = document.createElement("div");
    stack.className = "device-badge-stack";
    badgeLayer.append(stack);
    children.forEach((b, i) => {
      stack.append(b.el);
      if (i) hiddenChildren.add(b);
      if (group.compactPower && b.kind === LabelType.POWER)
        b.el.classList.add("device-power-badge");
    });
    groups.set(children[0], { el: stack, centerBetween: group.centerBetween });
  }
  const placedBadges = sensorBadges
    .filter((b) => !hiddenChildren.has(b))
    .map((b) => ({ ...b, ...groups.get(b) }));
  const sizes = new Map();
  const owners = new Map(
    sensorBadges.map((badge) => [
      badge,
      placedBadges.find(({ el }) => el === badge.el || el.contains(badge.el))
        .el,
    ]),
  );
  const specs = new Map(entities.map((entity) => [entity.entity, entity]));
  let viewportWidth;
  // Group dimensions can change after fonts load or CSS breakpoints change.
  const sizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          for (const { target } of entries) sizes.delete(target);
          onLayoutChange();
        });
  placedBadges.forEach((b) => sizeObserver?.observe(b.el));
  const snapshots = new Map();
  function place(topView) {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    if (width !== viewportWidth) {
      viewportWidth = width;
      sizes.clear();
    }
    const projected = placedBadges.map((b) => {
      const p = worldPoint(b.x, b.z, b.y).project(camera);
      let x = ((p.x + 1) * width) / 2;
      const y = ((1 - p.y) * height) / 2;
      if (b.centerBetween && topView) {
        // Center between two configured projected model edges.
        const leftEdge = worldPoint(
            b.x,
            b.centerBetween.z[0],
            b.centerBetween.y,
          ).project(camera),
          rightEdge = worldPoint(
            b.x,
            b.centerBetween.z[1],
            b.centerBetween.y,
          ).project(camera);
        x = (((leftEdge.x + rightEdge.x) / 2 + 1) * width) / 2;
      }
      const visible =
        p.z >= -1 &&
        p.z <= 1 &&
        x > 0 &&
        x < width &&
        y > layoutConfig.visibleTop &&
        y < height;
      return { b, x, y, visible };
    });
    // Unhide together, then measure together. No transform writes interrupt
    // these reads, and camera-only placement reuses cached dimensions.
    for (const { b, visible } of projected)
      if (visible && b.el.hidden) {
        b.el.hidden = false;
        sizes.delete(b.el);
      }
    for (const { b, visible } of projected)
      if (visible && !sizes.has(b.el))
        sizes.set(b.el, { w: b.el.offsetWidth, h: b.el.offsetHeight });
    const placed = [];
    const transforms = [];
    for (const { b, x, y, visible } of projected) {
      if (!visible) continue;
      const { w, h } = sizes.get(b.el);
      const left = Math.max(
        layoutConfig.edge,
        Math.min(width - w - layoutConfig.edge, x - w / 2),
      );
      let top = y - h / 2;
      for (const delta of layoutConfig.offsets) {
        const candidate = Math.max(
          layoutConfig.top,
          Math.min(height - h - layoutConfig.edge, y - h / 2 + delta),
        );
        if (
          !placed.some(
            (r) =>
              left < r.x + r.w + layoutConfig.collisionGap &&
              left + w + layoutConfig.collisionGap > r.x &&
              candidate < r.y + r.h + layoutConfig.collisionGap &&
              candidate + h + layoutConfig.collisionGap > r.y,
          )
        ) {
          top = candidate;
          break;
        }
      }
      transforms.push([
        b.el,
        `translate(${Math.round(left)}px,${Math.round(top)}px)`,
      ]);
      placed.push({ x: left, y: top, w, h });
    }
    for (const { b, visible } of projected)
      if (b.el.hidden === visible) b.el.hidden = !visible;
    for (const [el, transform] of transforms)
      if (el.style.transform !== transform) el.style.transform = transform;
  }

  return {
    place,
    update(states) {
      let changed = false;
      sensorBadges.forEach((b) => {
        const spec = specs.get(b.id);
        const snapshot = JSON.stringify([
          language(getHass()),
          getHass()?.locale?.number_format,
          [b.id, spec?.humidity].map((id) => [
            states[id]?.state,
            states[id]?.attributes?.unit_of_measurement,
          ]),
        ]);
        if (snapshots.get(b.id) === snapshot) return;
        snapshots.set(b.id, snapshot);
        const previousText = b.el.textContent;
        const wasUnavailable = b.el.dataset.markerState === "unavailable";
        b.update(states);
        if (
          previousText !== b.el.textContent ||
          wasUnavailable !== (b.el.dataset.markerState === "unavailable")
        ) {
          sizes.delete(owners.get(b));
          changed = true;
        }
      });
      return changed;
    },
    dispose() {
      sizeObserver?.disconnect();
      sensorBadges.forEach((badge) => badge.dispose?.());
      badgeLayer.remove();
    },
  };
}
