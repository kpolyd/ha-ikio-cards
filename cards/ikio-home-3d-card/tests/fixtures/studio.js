// Fictional studio: no household data.
export const home = {
  schemaVersion: 1,
  name: "Example studio",
  coordinates: { origin: { x: 0, z: 0 }, rotationY: 0, bearing: 90 },
  overviewTarget: { x: 2, z: 1.5 },
  rooms: { Overview: [2, 1.5], Studio: [2, 1.5] },
  materials: {
    wall: { color: "#ddddee" },
    white: { color: "#ffffff" },
    black: { color: "#222222" },
    glass: { color: "#aabbcc", transparent: true, opacity: 0.3 },
  },
  floors: [
    {
      room: "Studio",
      position: { x: 2, y: -0.14, z: 1.5 },
      size: { width: 4, height: 0.14, depth: 3 },
      material: "white",
    },
  ],
  objects: [
    {
      id: "studio-wall",
      kind: "wall",
      position: { x: 2, y: 0, z: 0 },
      size: { width: 4, height: 2.75, depth: 0.2 },
    },
    {
      id: "studio-lamp",
      kind: "light",
      name: "Studio lamp",
      position: { x: 2, y: 2.2, z: 1.5 },
      size: { width: 0.2, height: 0.1, depth: 0.2 },
      power: 6,
      color: "#ffeebb",
    },
    {
      id: "studio-screen",
      kind: "box",
      position: { x: 1, y: 0.8, z: 1 },
      size: { width: 0.7, height: 0.5, depth: 0.05 },
      material: "black",
    },
    {
      id: "studio-window",
      kind: "opening",
      openingType: "window",
      position: { x: 4, y: 0, z: 1.5 },
      width: 1,
      axis: "z",
    },
  ],
};
export const inventory = [
  {
    id: "lamp",
    entity: "light.example_lamp",
    name: "Studio lamp",
    room: "Studio",
    demo: { state: "off" },
  },
  {
    id: "screen",
    entity: "media_player.example_screen",
    name: "Screen",
    room: "Studio",
    demo: { state: "off" },
  },
  {
    id: "window",
    entity: "binary_sensor.example_window",
    name: "Window",
    room: "Studio",
    demo: { state: "off" },
  },
  {
    id: "temperature",
    entity: "sensor.example_temperature",
    name: "Temperature",
    room: "Studio",
    demo: { state: "20", unit: "°C" },
  },
  {
    id: "humidity",
    entity: "sensor.example_humidity",
    name: "Humidity",
    room: "Studio",
    demo: { state: "50", unit: "%" },
  },
];
export const devices = {
  schemaVersion: 1,
  scene: [
    { object: "studio-lamp", entity: "lamp", behavior: "light" },
    {
      object: "studio-screen",
      entity: "screen",
      behavior: "screen",
      activeStates: ["playing"],
      activeMaterial: { color: "#5599bb" },
    },
    { object: "studio-window", entity: "window", behavior: "opening" },
  ],
  labels: [
    {
      entity: "temperature",
      type: "climate",
      position: { x: 2, y: 1, z: 1.5 },
      humidity: "humidity",
    },
    {
      entity: "window",
      type: "contact",
      position: { x: 4, y: 2.2, z: 1.5 },
      icon: "window",
    },
  ],
  groups: [],
  layout: {
    edge: 4,
    top: 74,
    visibleTop: 70,
    collisionGap: 3,
    offsets: [0, -32, 32],
  },
};
