import * as T from "three";
import { batchStaticMeshes } from "./static-batches.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Reusable geometry builders. All apartment measurements arrive in `home`.
export function buildHomeScene({
  root,
  home,
  bindings,
  pos,
  cachePointLightShadows,
}) {
  const geometryCache = new Map();
  function geometry(Type, ...parameters) {
    const key = Type.name + JSON.stringify(parameters);
    if (!geometryCache.has(key))
      geometryCache.set(key, new Type(...parameters));
    return geometryCache.get(key);
  }
  const materialCache = new Map();
  const mat = (color, extra = {}) =>
    new T.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
  const mats = Object.fromEntries(
    Object.entries(home.materials).map(([key, definition]) => [
      key,
      new T.MeshStandardMaterial(definition),
    ]),
  );
  function material(spec) {
    if (typeof spec === "string") {
      if (spec.endsWith("Floor"))
        return (mats[spec] ??= floorMaterial(spec.slice(0, -5)));
      return mats[spec];
    }
    // Cache equal inline materials without putting mutable Three.js objects in configuration.
    const key = JSON.stringify(spec);
    if (!materialCache.has(key))
      materialCache.set(key, new T.MeshStandardMaterial(spec));
    return materialCache.get(key);
  }
  const walls = [],
    openings = [],
    targets = [],
    lighting = [],
    fans = [],
    halos = [],
    screens = [],
    fullWallObjects = [];
  const objects = new Map();
  const forObject = (id) => bindings.filter((binding) => binding.object === id);
  function box(x, z, w, d, h, y, m = "white", round = 0, parent = root) {
    const geo = round
      ? geometry(
          RoundedBoxGeometry,
          w,
          h,
          d,
          3,
          Math.min(round, w / 3, d / 3, h / 3),
        )
      : geometry(T.BoxGeometry, w, h, d);
    const o = new T.Mesh(geo, typeof m === "string" ? material(m) : m);
    o.position.copy(pos(x, y + h / 2, z));
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function cyl(x, z, r, h, y, m = "black", parent = root) {
    const o = new T.Mesh(
      geometry(T.CylinderGeometry, r, r, h, 24),
      typeof m === "string" ? material(m) : m,
    );
    o.position.copy(pos(x, y + h / 2, z));
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function sphere(x, z, rx, ry, rz, y, m) {
    const o = new T.Mesh(
      geometry(T.SphereGeometry, 1, 20, 12),
      typeof m === "string" ? material(m) : m,
    );
    o.scale.set(rx, ry, rz);
    o.position.copy(pos(x, y, z));
    root.add(o);
    o.castShadow = true;
    return o;
  }
  function rail(x1, z1, x2, z2, y, r = 0.022, m = "black") {
    const a = pos(x1, y, z1),
      b = pos(x2, y, z2);
    const o = new T.Mesh(
      geometry(T.CylinderGeometry, r, r, a.distanceTo(b), 10),
      mats[m],
    );
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      b.sub(a).normalize(),
    );
    root.add(o);
    return o;
  }
  function wall(x, z, w, d, h = 2.75, base = 0) {
    const o = box(x, z, w, d, h, base, "wall");
    walls.push({ o, h, base });
    return o;
  }
  function picture(x, z, w, h, rot, kind) {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 192;
    const q = c.getContext("2d");
    q.fillStyle = kind === "race" ? "#68858a" : "#b2a18a";
    q.fillRect(0, 0, 256, 192);
    q.fillStyle = "#534a40";
    q.fillRect(12, 125, 230, 50);
    if (kind === "race") {
      for (let i = 0; i < 2; i++) {
        q.fillStyle = i ? "#e6bd41" : "#a83a2c";
        q.fillRect(45 + i * 100, 55 - i * 25, 44, 95);
        q.fillStyle = "#202a29";
        q.fillRect(29 + i * 100, 75 - i * 25, 19, 55);
        q.fillRect(86 + i * 100, 75 - i * 25, 19, 55);
      }
    } else {
      q.fillStyle = "#e3daca";
      q.beginPath();
      q.ellipse(120, 115, 90, 35, 0.1, 0, 7);
      q.fill();
      for (let i = 0; i < 6; i++) {
        q.fillStyle = ["#9c482e", "#bd6739", "#c88449"][i % 3];
        q.beginPath();
        q.arc(68 + i * 24, 105 + (i % 2) * 15, 16, 0, 7);
        q.fill();
      }
    }
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    const p = new T.Mesh(
      geometry(T.PlaneGeometry, w, h),
      new T.MeshStandardMaterial({ map: tx, side: T.DoubleSide }),
    );
    p.position.copy(pos(x, 1.7, z));
    p.rotation.y = rot;
    root.add(p);
    return p;
  }

  function floorMaterial(type) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const q = c.getContext("2d");
    let seed = 33;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    q.fillStyle = type === "wood" ? "#986930" : "#d4cfc1";
    q.fillRect(0, 0, 512, 512);
    if (type === "wood") {
      for (let row = 0; row < 16; row++) {
        for (let col = -1; col < 5; col++) {
          const x = col * 128 + (row % 3) * 42,
            y = row * 32;
          const l = 40 + rnd() * 12;
          q.fillStyle = `hsl(${32 + rnd() * 5},43%,${l}%)`;
          q.fillRect(x + 1, y + 1, 126, 30);
          for (let g = 0; g < 8; g++) {
            q.strokeStyle = "rgba(73,47,20,.10)";
            q.beginPath();
            q.moveTo(x, y + g * 4);
            q.lineTo(x + 128, y + g * 4 + rnd() * 4);
            q.stroke();
          }
        }
      }
    } else {
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          q.fillStyle =
            type === "bath" ? "#444b4b" : `hsl(42,12%,${83 + rnd() * 7}%)`;
          q.fillRect(x * 128 + 1, y * 128 + 1, 126, 126);
          if (type === "marble")
            for (let n = 0; n < 4; n++) {
              q.strokeStyle = "rgba(108,117,119,.16)";
              q.beginPath();
              q.moveTo(x * 128 + rnd() * 128, y * 128);
              q.lineTo(x * 128 + rnd() * 128, (y + 1) * 128);
              q.stroke();
            }
        }
    }
    const tx = new T.CanvasTexture(c);
    tx.wrapS = tx.wrapT = T.RepeatWrapping;
    tx.repeat.set(2, 2);
    tx.colorSpace = T.SRGBColorSpace;
    return mat("#ffffff", { map: tx, roughness: type === "wood" ? 0.5 : 0.7 });
  }
  function doorLintel(name, x, z, width, axis, base) {
    const lintel = wall(
      x,
      z,
      axis === "x" ? width : 0.2,
      axis === "x" ? 0.2 : width,
      2.75 - base,
      base,
    );
    lintel.name = `${name} lintel`;
    return lintel;
  }
  function opening(x, z, width, axis, type, entity = null, lintelX = x) {
    const g = new T.Group();
    root.add(g);
    const y = type === "window" ? 1.05 : 0,
      ht = type === "window" ? 1.05 : 2.12;
    if (type === "door")
      // The wall centre may differ from the glazing plane.
      doorLintel(entity, lintelX, z, width, axis, ht);
    const alongX = axis === "x";
    for (const k of [-1, 1])
      box(
        x + (alongX ? (k * width) / 2 : 0),
        z + (alongX ? 0 : (k * width) / 2),
        alongX ? 0.045 : 0.09,
        alongX ? 0.09 : 0.045,
        ht,
        y,
        "white",
        0,
        g,
      );
    box(
      x,
      z,
      alongX ? width : 0.09,
      alongX ? 0.09 : width,
      0.045,
      y,
      "white",
      0,
      g,
    );
    box(
      x,
      z,
      alongX ? width : 0.09,
      alongX ? 0.09 : width,
      0.045,
      y + ht - 0.045,
      "white",
      0,
      g,
    );
    const panel = box(
      x,
      z,
      alongX ? width - 0.08 : 0.026,
      alongX ? 0.026 : width - 0.08,
      ht - 0.08,
      y + 0.04,
      "glass",
      0,
      g,
    );
    panel.userData.entity = entity;
    targets.push(panel);
    openings.push({ panel, entity, x, z, axis, width });
    return g;
  }
  function doorFrame(name, x, z, width, axis, entity) {
    const g = new T.Group();
    g.name = name;
    g.userData = { opening: name, axis, width, entity };
    root.add(g);
    const alongX = axis === "x";
    for (const sign of [-1, 1])
      box(
        x + (alongX ? (sign * width) / 2 : 0),
        z + (alongX ? 0 : (sign * width) / 2),
        alongX ? 0.055 : 0.22,
        alongX ? 0.22 : 0.055,
        2.12,
        0,
        "white",
        0,
        g,
      );
    const header = box(
      x,
      z,
      alongX ? width + 0.055 : 0.22,
      alongX ? 0.22 : width + 0.055,
      0.065,
      2.12,
      "white",
      0,
      g,
    );
    doorLintel(name, x, z, width, axis, 2.12 + 0.065);
    if (entity) {
      header.userData.entity = entity;
      targets.push(header);
    }
    return g;
  }
  function cabinet(
    x,
    z,
    w,
    d,
    h,
    orient = "z",
    color = "wood",
    facing = 1,
    { doorCount, name = "" } = {},
  ) {
    const body = box(x, z, w, d, h, 0, color, 0.015);
    body.name = name;
    const count =
      doorCount ?? Math.max(1, Math.round((orient === "z" ? w : d) / 0.48));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count - 0.5;
      if (orient === "z") {
        const door = box(
          x + t * w,
          z + facing * (d / 2 + 0.01),
          w / count - 0.025,
          0.025,
          h - 0.07,
          0.035,
          color,
          0.008,
        );
        if (name) door.name = `${name} door ${i + 1}`;
        cyl(
          x + t * w + 0.09,
          z + facing * (d / 2 + 0.035),
          0.018,
          0.025,
          h * 0.55,
          "metal",
        ).rotation.x = Math.PI / 2;
      } else {
        box(
          x + w / 2 + 0.01,
          z + t * d,
          0.025,
          d / count - 0.025,
          h - 0.07,
          0.035,
          color,
          0.008,
        );
        sphere(
          x + w / 2 + 0.04,
          z + t * d + 0.09,
          0.022,
          0.022,
          0.022,
          h * 0.55,
          "metal",
        );
      }
    }
    return body;
  }

  function radiator(x, z, w, axis, depth = 0.14) {
    for (let i = 0; i < Math.round(w / 0.07); i++) {
      box(
        x + (axis === "x" ? i * 0.07 - w / 2 : 0),
        z + (axis === "z" ? i * 0.07 - w / 2 : 0),
        axis === "x" ? 0.045 : depth,
        axis === "z" ? 0.045 : depth,
        0.65,
        0.12,
        "white",
        0.018,
      );
    }
  }
  function chair(x, z, rot = 0) {
    const g = new T.Group();
    root.add(g);
    box(x, z, 0.42, 0.43, 0.07, 0.43, "black", 0.03, g);
    box(x, z + 0.2, 0.42, 0.055, 0.45, 0.48, "black", 0.03, g);
    for (const a of [-0.16, 0.16])
      for (const b of [-0.16, 0.16])
        box(x + a, z + b, 0.032, 0.032, 0.43, 0, "black", 0, g);
    if (rot) {
      g.position.copy(pos(x, 0, z));
      for (const o of g.children) o.position.sub(pos(x, 0, z));
      g.rotation.y = rot;
    }
    return g;
  }
  const floors = home.floors.map(
    ({ room, position: p, size: s, material: m }) => {
      const mesh = box(p.x, p.z, s.width, s.depth, s.height, p.y, m);
      mesh.userData.room = room;
      targets.push(mesh);
      return [
        room,
        p.x - s.width / 2,
        p.z - s.depth / 2,
        p.x + s.width / 2,
        p.z + s.depth / 2,
      ];
    },
  );
  function pointLight(color, position, distance = 4) {
    const light = new T.PointLight(color, 0, distance, 2);
    cachePointLightShadows(light);
    light.position.copy(pos(position.x, position.y, position.z));
    root.add(light);
    return light;
  }
  function bindPick(mesh, binding) {
    if (!binding) return;
    mesh.userData.entity = binding.entity;
    targets.push(mesh);
  }
  function makeFan(node, links) {
    const group = new T.Group();
    const p = node.position;
    group.position.copy(pos(p.x, p.y, p.z));
    root.add(group);
    const hub = new T.Mesh(
      geometry(T.CylinderGeometry, 0.13, 0.13, 0.12, 24),
      mats.white,
    );
    group.add(hub);
    const blades = new T.Group();
    group.add(blades);
    for (let i = 0; i < 3; i++) {
      const blade = new T.Mesh(
        geometry(RoundedBoxGeometry, 0.55, 0.035, 0.14, 3, 0.045),
        mats.black,
      );
      const arm = new T.Group();
      arm.rotation.y = (i * Math.PI * 2) / 3;
      blade.position.x = 0.32;
      arm.add(blade);
      blades.add(arm);
    }
    const lightMaterial = mat("#ddd7bc", {
      emissive: node.color,
      emissiveIntensity: 0,
    });
    const disk = new T.Mesh(
      geometry(T.CylinderGeometry, 0.105, 0.105, 0.025, 24),
      lightMaterial,
    );
    disk.position.y = -0.08;
    group.add(disk);
    const fanBinding = links.find((link) => link.behavior === "fan");
    const lightBinding = links.find((link) => link.behavior === "fanLight");
    bindPick(hub, fanBinding);
    bindPick(disk, lightBinding);
    const light = pointLight("#ffd69b", node.emitterPosition, 5);
    light.name = node.name.replace("fan", "illumination");
    fans.push({ id: fanBinding?.entity, blades, running: false });
    lighting.push({
      object: node.id,
      id: lightBinding?.entity,
      mesh: disk,
      light,
      power: node.power,
      color: node.color,
      onOffOnly: lightBinding?.onOffOnly ?? false,
    });
    return group;
  }
  let glowTexture;
  function makeHalo(node) {
    if (!glowTexture) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 192;
      const q = canvas.getContext("2d");
      q.shadowColor = "white";
      q.shadowBlur = 30;
      q.fillStyle = "white";
      q.fillRect(43, 38, 170, 116);
      glowTexture = new T.CanvasTexture(canvas);
    }
    const mesh = new T.Mesh(
      geometry(T.PlaneGeometry, node.width, node.height),
      new T.MeshBasicMaterial({
        map: glowTexture,
        color: "#ffd494",
        transparent: true,
        opacity: 0,
        side: T.DoubleSide,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    mesh.position.copy(pos(node.position.x, node.position.y, node.position.z));
    mesh.userData.overviewFit = false;
    root.add(mesh);
    halos.push({ mesh, source: node.source, opacity: node.opacity });
    return mesh;
  }
  function customMesh(node) {
    const p = node.geometry.parameters;
    let shape;
    switch (node.geometry.type) {
      case "TorusGeometry":
        shape = geometry(
          T.TorusGeometry,
          p.radius,
          p.tube,
          p.radialSegments,
          p.tubularSegments,
          p.arc,
        );
        break;
      case "CylinderGeometry":
        shape = geometry(
          T.CylinderGeometry,
          p.radiusTop,
          p.radiusBottom,
          p.height,
          p.radialSegments,
          p.heightSegments,
          p.openEnded,
          p.thetaStart,
          p.thetaLength,
        );
        break;
      case "ConeGeometry":
        shape = geometry(
          T.ConeGeometry,
          p.radius,
          p.height,
          p.radialSegments,
          p.heightSegments,
          p.openEnded,
        );
        break;
      default:
        throw new Error("Unsupported geometry: " + node.geometry.type);
    }
    const mesh = new T.Mesh(shape, material(node.material));
    mesh.position.copy(pos(node.position.x, node.position.y, node.position.z));
    root.add(mesh);
    return mesh;
  }
  function wallRun(node) {
    // Shared opening dimensions keep wall ends aligned when a doorway moves.
    const cuts = node.openings
      .map((id) => home.objects.find((object) => object.id === id))
      .sort((a, b) => a.position[node.axis] - b.position[node.axis]);
    let cursor = node.start;
    const segment = (start, end) => {
      if (end <= start) return;
      const centre = (start + end) / 2;
      wall(
        node.axis === "x" ? centre : node.coordinate,
        node.axis === "z" ? centre : node.coordinate,
        node.axis === "x" ? end - start : node.thickness,
        node.axis === "z" ? end - start : node.thickness,
        node.height,
      );
    };
    for (const cut of cuts) {
      segment(cursor, cut.position[node.axis] - cut.width / 2);
      cursor = cut.position[node.axis] + cut.width / 2;
    }
    segment(cursor, node.end);
  }
  for (const node of home.objects) {
    const p = node.position,
      s = node.size;
    const links = forObject(node.id);
    const link = links[0];
    const m = node.material && material(node.material);
    let object;
    switch (node.kind) {
      case "wallRun":
        wallRun(node);
        break;
      case "box":
        object = box(p.x, p.z, s.width, s.depth, s.height, p.y, m, node.round);
        break;
      case "wall":
        object = wall(p.x, p.z, s.width, s.depth, s.height, p.y);
        break;
      case "cylinder":
        object = cyl(p.x, p.z, node.radius, node.height, p.y, m);
        break;
      case "sphere":
        object = sphere(
          p.x,
          p.z,
          node.radii.x,
          node.radii.y,
          node.radii.z,
          p.y,
          m,
        );
        break;
      case "rail":
        object = rail(
          node.from.x,
          node.from.z,
          node.to.x,
          node.to.z,
          node.from.y,
          node.radius,
          node.material,
        );
        break;
      case "cabinet":
        object = cabinet(
          p.x,
          p.z,
          s.width,
          s.depth,
          s.height,
          node.axis,
          node.material,
          node.facing,
          { doorCount: node.doorCount, name: node.name },
        );
        break;
      case "chair":
        object = chair(p.x, p.z, node.rotationY);
        break;
      case "picture":
        object = picture(
          p.x,
          p.z,
          node.width,
          node.height,
          node.rotationY,
          node.art,
        );
        break;
      case "radiator":
        radiator(p.x, p.z, node.width, node.axis, node.depth);
        break;
      case "opening":
        object = opening(
          p.x,
          p.z,
          node.width,
          node.axis,
          node.openingType,
          link?.entity,
          node.lintelX,
        );
        break;
      case "doorFrame":
        object = doorFrame(
          node.name,
          p.x,
          p.z,
          node.width,
          node.axis,
          link?.entity,
        );
        break;
      case "mesh":
        object = customMesh(node);
        break;
      case "light": {
        const mesh = box(
          p.x,
          p.z,
          s.width,
          s.depth,
          s.height,
          p.y,
          mat("#e5dfcb", { emissive: node.color, emissiveIntensity: 0 }),
          0.008,
        );
        bindPick(mesh, link);
        const light = pointLight(
          node.color,
          node.emitterPosition ?? { x: p.x, y: p.y - 0.06, z: p.z },
        );
        light.name = node.name + " illumination";
        lighting.push({
          object: node.id,
          id: link?.entity,
          mesh,
          light,
          power: node.power,
          color: node.color,
          onOffOnly: link?.onOffOnly ?? false,
        });
        object = mesh;
        break;
      }
      case "fan":
        object = makeFan(node, links);
        break;
      case "halo":
        object = makeHalo(node);
        break;
      default:
        throw new Error("Unknown model object kind: " + node.kind);
    }
    if (!object) continue;
    if (node.name) object.name = node.name;
    if (node.rotation)
      object.rotation.set(node.rotation.x, node.rotation.y, node.rotation.z);
    if (node.fullWallsOnly) fullWallObjects.push(object);
    objects.set(node.id, object);
    for (const binding of links) {
      if (binding.behavior === "pick") bindPick(object, binding);
      if (binding.behavior === "screen") {
        bindPick(object, binding);
        screens.push({
          mesh: object,
          id: binding.entity,
          activeStates: binding.activeStates,
          activeMaterial: material(binding.activeMaterial),
          inactiveMaterial: object.material,
        });
      }
    }
  }
  const excluded = new Set([
    ...home.objects
      .filter(({ kind }) => kind === "opening" || kind === "doorFrame")
      .map(({ id }) => objects.get(id)),
    ...targets,
    ...walls.map(({ o }) => o),
    ...fullWallObjects,
    ...openings.map(({ panel }) => panel),
    ...lighting.map(({ mesh }) => mesh),
    ...fans.map(({ blades }) => blades),
    ...screens.map(({ mesh }) => mesh),
  ]);
  const batches = batchStaticMeshes(root, excluded);
  return {
    batches,
    mats,
    walls,
    openings,
    targets,
    lighting,
    fans,
    halos,
    screens,
    floors,
    fullWallObjects,
    objects,
  };
}
