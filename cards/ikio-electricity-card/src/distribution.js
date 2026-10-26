import { el, event, entityName, unitValue, formatNumber } from "@ikio/card-ui";

// This is a live consumption partition, not a second history request or an
// energy-dashboard collection. Never turn unavailable inputs into zero watts.
export function distributionModel(config, hass) {
  const states = hass?.states || {};
  const total = unitValue(states[config.power_entity], "power");
  const fail = (message) => ({ total, message });
  if (!Number.isFinite(total))
    return fail(
      "Power distribution unavailable: check total power and its unit.",
    );
  if (total < 0)
    return fail(
      "Power distribution needs a consumption total; the current reading is exporting power.",
    );
  if (!config.non_overlapping)
    return fail(
      "Confirm that the selected device circuits do not overlap in the editor to show power distribution.",
    );
  const rows = (config.circuits || []).filter((r) => r.power_entity);
  const ids = rows.map((r) => r.power_entity);
  if (
    new Set(ids).size !== ids.length ||
    ids.includes(config.power_entity) ||
    ids.includes(config.untracked_entity)
  )
    return fail(
      "Power distribution needs distinct device sensors, separate from total and untracked power.",
    );
  const groups = new Map();
  const devices = [];
  for (const row of rows) {
    const id = row.power_entity,
      state = states[id];
    const name = entityName(hass, state, row.name) || id;
    const value = unitValue(state, "power");
    if (!Number.isFinite(value) || value < 0)
      return fail(
        `Power distribution unavailable: ${name} needs a non-negative power reading in W, kW or MW.`,
      );
    const entry = hass?.entities?.[id];
    const areaId = entry?.area_id || hass?.devices?.[entry?.device_id]?.area_id;
    const key = areaId || "unassigned";
    if (!groups.has(key))
      groups.set(key, {
        id: `area:${key}`,
        name: hass?.areas?.[areaId]?.name || "Unassigned",
        value: 0,
        devices: [],
      });
    const area = groups.get(key);
    const device = {
      id: `device:${id}`,
      entity: id,
      name,
      value,
      area: area.id,
    };
    area.value += value;
    area.devices.push(device);
    devices.push(device);
  }
  const sum = devices.reduce((s, d) => s + d.value, 0);
  if (
    sum > total + Number.EPSILON * Math.max(1, total) * 16 ||
    (total === 0 && sum > 0)
  )
    return fail(
      "Measurements do not reconcile: device power exceeds total power. Check for overlapping circuits.",
    );
  const remainder = Math.max(0, total - sum);
  if (config.untracked_entity) {
    const measured = unitValue(states[config.untracked_entity], "power");
    if (
      !Number.isFinite(measured) ||
      measured < 0 ||
      Math.abs(sum + measured - total) > 1
    )
      return fail(
        "Measurements do not reconcile: check the untracked-power sensor and device readings.",
      );
    // Allow one watt of independent-sensor rounding; conserve the total exactly.
  }
  const areas = [...groups.values()];
  areas.forEach((area, index) => {
    const hue =
      [165, 215, 39, 280, 345, 80][index] ?? (165 + index * 137.508) % 360;
    area.color = `hsl(${hue.toFixed(2)} 42% var(--ae-ring-lightness))`;
    area.devices.forEach((device, i) => {
      const shift =
        area.devices.length > 1 ? -(i / (area.devices.length - 1)) * 18 : 0;
      device.color = `hsl(${hue.toFixed(2)} 42% calc(var(--ae-ring-lightness) + ${shift.toFixed(2)}%))`;
    });
  });
  // Keep a bounded number of labelled outer segments. Every hidden watt stays
  // in an Other segment within its own area; area totals are never distorted.
  const limit = config.distribution_max_devices ?? 8;
  const keep = new Set(
    devices
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
      .map((d) => d.id),
  );
  for (const area of areas) {
    const small = area.devices.filter((d) => d.value > 0 && !keep.has(d.id));
    area.devices = area.devices.filter((d) => d.value > 0 && keep.has(d.id));
    if (small.length)
      area.devices.push({
        id: `other:${area.id}`,
        area: area.id,
        name: `Other (${area.name})`,
        value: small.reduce((s, d) => s + d.value, 0),
        color: area.color,
      });
  }
  if (remainder > 0)
    areas.push({
      id: "untracked",
      name: "Untracked",
      value: remainder,
      color: "var(--ae-muted)",
      devices: [
        {
          id: "device:untracked",
          name: "Untracked",
          value: remainder,
          area: "untracked",
          entity: config.untracked_entity,
          color: "var(--ae-muted)",
        },
      ],
    });
  const active = areas.filter((a) => a.value > 0);
  const items = active.flatMap((a) => [a, ...a.devices]);
  return { total, areas: active, items };
}

export const distributionStyles = `
.ae-power-distribution{min-width:0;border-top:1px solid var(--ae-border);margin-top:4px;padding-top:4px;--ae-ring-lightness:65%}
:host([appearance=light]) .ae-power-distribution{--ae-ring-lightness:42%}
.ae-power-distribution .ae-ring-button{display:block;position:relative;width:100%;padding:0;background:transparent;text-align:initial;touch-action:pan-y;border-radius:6px}
.ae-power-distribution svg{display:block;width:100%}
.ae-power-distribution text{fill:var(--ae-text);font:11px var(--ha-font-family,system-ui,sans-serif)}
.ae-power-distribution .ae-ring-caption{fill:var(--ae-muted)}
.ae-power-distribution .ae-ring-number{font-size:21px;font-weight:500;font-variant-numeric:tabular-nums}
.ae-power-distribution .ae-ring-leader{fill:none;stroke:var(--ae-muted);stroke-width:.8;opacity:.65}
.ae-power-distribution [data-selection]{cursor:pointer}
.ae-power-distribution .ae-ring-selected{font-weight:500;text-decoration:underline;text-underline-offset:3px}
`;

const NS = "http://www.w3.org/2000/svg";
let textContext;
function linesFor(text, width, fontSize = 11) {
  if (globalThis.window?.CanvasRenderingContext2D) {
    textContext ||= document.createElement("canvas").getContext("2d");
    textContext.font = `${fontSize}px system-ui`;
  }
  const measure = (value) =>
    textContext
      ? textContext.measureText(value).width
      : [...value].length * fontSize * 0.65;
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    if (line && measure(`${line} ${word}`) <= width) {
      line += ` ${word}`;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    for (const char of word) {
      if (line && measure(line + char) > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function svgElement(tag, attributes, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes || {}))
    node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function distributionView(
  model,
  { hass, width, selection, totalEntity, onSelect },
) {
  const section = el(
    "section",
    undefined,
    "ae-power-distribution",
    "power-distribution",
  );
  section.setAttribute("aria-label", "Current power distribution");
  if (model.message) {
    section.append(el("p", model.message, "ae-note ae-warn"));
    return section;
  }
  const current = model.items.find((item) => item.id === selection) || {
    name: "Total",
    value: model.total,
    entity: totalEntity,
  };
  const button = el(
    "button",
    undefined,
    "ae-ring-button",
    "distribution-control",
  );
  button.type = "button";
  button.setAttribute(
    "aria-label",
    `${current.name}: ${formatNumber(hass, current.value, 0)} W. Tap a section to inspect power; tap the centre or press Escape for total. Arrow keys explore areas and devices. Hold for entity details.`,
  );
  const w = Math.max(200, width),
    height = 184,
    cx = w / 2,
    cy = height / 2;
  const radius = Math.min(74, Math.max(44, (w - 150) / 2));
  const inner = radius * 0.72,
    hole = radius * 0.54,
    tau = Math.PI * 2;
  const point = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const arc = (r0, r1, start, end) => {
    const p = point(r1, start),
      q = point(r1, end),
      s = point(r0, end),
      t = point(r0, start),
      large = end - start > Math.PI ? 1 : 0;
    return `M${p} A${r1} ${r1} 0 ${large} 1 ${q} L${s} A${r0} ${r0} 0 ${large} 0 ${t}Z`;
  };
  const svg = svgElement("svg", {
    viewBox: `0 0 ${w} ${height}`,
    height,
    "aria-hidden": "true",
  });
  const labels = [];
  let angle = 0;
  const selected = model.items.find((item) => item.id === selection);
  for (const area of model.areas) {
    const end = angle + (area.value / model.total) * tau;
    const gap = Math.min(0.012, (end - angle) / 4);
    const active =
      !selected || selected.id === area.id || selected.area === area.id;
    svg.append(
      svgElement("path", {
        d: arc(hole, inner - 2, angle + gap, end - gap),
        fill: area.color,
        opacity: active ? 0.4 : 0.15,
        "data-selection": area.id,
        "data-ring": "area",
      }),
    );
    for (const device of area.devices) {
      const next = angle + (device.value / model.total) * tau,
        padding = Math.min(0.012, (next - angle) / 4),
        mid = (angle + next) / 2;
      const activeDevice =
        !selected || selected.id === device.id || selected.id === device.area;
      svg.append(
        svgElement("path", {
          d: arc(inner + 2, radius, angle + padding, next - padding),
          fill: device.color,
          opacity: activeDevice ? 1 : 0.25,
          "data-selection": device.id,
          ...(device.entity ? { "data-entity": device.entity } : {}),
          "data-ring": "device",
        }),
      );
      labels.push({
        device,
        mid,
        side: Math.sin(mid) >= 0 ? 1 : -1,
        y: point(radius + 10, mid)[1],
      });
      angle = next;
    }
    angle = end;
  }
  if (!model.total)
    svg.append(
      svgElement("circle", {
        cx,
        cy,
        r: (inner + radius) / 2,
        fill: "none",
        stroke: "var(--ae-border)",
        "stroke-width": radius - inner - 2,
      }),
    );
  // Each side is collision-resolved independently. Grow only if an unusually
  // large device list needs it; ordinary five/eight-device charts stay shallow.
  for (const label of labels) {
    const x = cx + label.side * (radius + 16);
    const room = label.side > 0 ? w - x - 2 : x - 2;
    label.lines = linesFor(label.device.name, room);
    label.height = label.lines.length * 13;
  }
  const maxSideHeight = Math.max(
    ...[-1, 1].map((s) =>
      labels
        .filter((l) => l.side === s)
        .reduce((sum, l) => sum + l.height + 6, 0),
    ),
  );
  const actualHeight = Math.max(height, maxSideHeight + 16);
  svg.setAttribute(
    "viewBox",
    `0 ${-(actualHeight - height) / 2} ${w} ${actualHeight}`,
  );
  svg.setAttribute("height", actualHeight);
  for (const side of [-1, 1]) {
    const list = labels
      .filter((l) => l.side === side)
      .sort((a, b) => a.y - b.y);
    const top = -(actualHeight - height) / 2 + 10,
      bottom = top + actualHeight - 20;
    list.forEach((l, i) => {
      l.y = Math.max(
        top + l.height / 2,
        l.y,
        i ? list[i - 1].y + list[i - 1].height / 2 + l.height / 2 + 6 : top,
      );
    });
    for (let i = list.length - 1; i >= 0; i--) {
      const next = list[i + 1];
      list[i].y = Math.min(
        list[i].y,
        next
          ? next.y - next.height / 2 - list[i].height / 2 - 6
          : bottom - list[i].height / 2,
      );
    }
    for (const label of list) {
      const { device, mid, y } = label,
        start = point(radius - 2, mid),
        elbow = point(radius + 8, mid),
        end = cx + side * (radius + 12),
        x = end + side * 4;
      const group = svgElement("g", {
        "data-selection": device.id,
        ...(device.entity ? { "data-entity": device.entity } : {}),
      });
      group.append(
        svgElement("path", {
          d: `M${start} L${elbow[0]} ${y} H${end}`,
          class: "ae-ring-leader",
        }),
      );
      // Keep names complete: split into short lines rather than shrinking text
      // or silently truncating the only visible identity of a device.
      const caption = svgElement("text", {
        x,
        y: y + 4 - (label.lines.length - 1) * 6.5,
        "text-anchor": side > 0 ? "start" : "end",
        class: selection === device.id ? "ae-ring-selected" : "",
      });
      label.lines.forEach((line, index) =>
        caption.append(svgElement("tspan", { x, dy: index ? 13 : 0 }, line)),
      );
      group.append(caption);
      svg.append(group);
    }
  }
  const center = svgElement("g", {
    "data-selection": "",
    "data-entity": current.entity || totalEntity,
  });
  center.append(
    svgElement("circle", { cx, cy, r: hole - 1, fill: "transparent" }),
  );
  const nameLines = linesFor(current.name, hole * 1.65);
  const centerName = svgElement("text", {
    x: cx,
    y: cy - (nameLines.length === 2 ? 26 : 13),
    "text-anchor": "middle",
    class: "ae-ring-caption",
    "data-center-name": "",
  });
  (nameLines.length > 2 ? ["Selected"] : nameLines).forEach((line, i) =>
    centerName.append(svgElement("tspan", { x: cx, dy: i ? 13 : 0 }, line)),
  );
  center.append(centerName);
  const number = svgElement(
    "text",
    { x: cx, y: cy + 10, "text-anchor": "middle", class: "ae-ring-number" },
    formatNumber(hass, current.value, 0),
  );
  number.style.fontSize = `${Math.min(21, Math.max(11, (hole * 1.7) / (number.textContent.length * 0.65)))}px`;
  center.append(number);
  center.append(
    svgElement(
      "text",
      { x: cx, y: cy + 27, "text-anchor": "middle", class: "ae-ring-caption" },
      "W",
    ),
  );
  svg.append(center);
  button.append(svg);
  event(button, "click", (e) => {
    if (!e.detail && !e.target.closest?.("[data-selection]")) {
      const devices = model.areas.flatMap((a) => a.devices),
        i = devices.findIndex((d) => d.id === selection);
      onSelect(devices[(i + 1) % devices.length]?.id || null);
    } else
      onSelect(
        e.target
          .closest?.("[data-selection]")
          ?.getAttribute("data-selection") || null,
      );
  });
  event(button, "keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onSelect(null);
    }
    if (["ArrowRight", "ArrowLeft", "Home"].includes(e.key)) {
      e.preventDefault();
      const choices = model.items,
        index = choices.findIndex((d) => d.id === selection),
        step = e.key === "ArrowLeft" ? -1 : 1;
      onSelect(
        e.key === "Home"
          ? null
          : choices[(index + step + choices.length) % choices.length]?.id ||
              null,
      );
    }
  });
  const status = el(
    "span",
    `${current.name}: ${formatNumber(hass, current.value, 0)} W`,
    "sr",
    "distribution-selection",
  );
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  section.append(button, status);
  return section;
}
