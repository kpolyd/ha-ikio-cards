export function fitTopView(
  points,
  { width, height, fov, top = 8, padding = 8, minDistance = 3 },
) {
  if (!points.length || width <= padding * 2 || height <= top + padding)
    return null;
  const tangent = Math.tan((fov * Math.PI) / 360);
  const horizontal = (tangent * width) / height;
  const left = -1 + (2 * padding) / width;
  const right = 1 - (2 * padding) / width;
  const upper = 1 - (2 * top) / height;
  const bottom = -1 + (2 * padding) / height;

  function centers(distance) {
    let minX = -Infinity;
    let maxX = Infinity;
    let minZ = -Infinity;
    let maxZ = Infinity;
    for (const point of points) {
      const depth = distance - point.y;
      minX = Math.max(minX, point.x - right * horizontal * depth);
      maxX = Math.min(maxX, point.x - left * horizontal * depth);
      minZ = Math.max(minZ, point.z + bottom * tangent * depth);
      maxZ = Math.min(maxZ, point.z + upper * tangent * depth);
    }
    return { minX, maxX, minZ, maxZ, fits: minX <= maxX && minZ <= maxZ };
  }

  let near = minDistance;
  for (const point of points) near = Math.max(near, point.y + 0.1);
  let far = near;
  while (!centers(far).fits) far *= 2;
  for (let iteration = 0; iteration < 32; iteration++) {
    const middle = (near + far) / 2;
    if (centers(middle).fits) far = middle;
    else near = middle;
  }
  const distance = far + 0.01;
  const { minX, maxX, minZ, maxZ } = centers(distance);
  return { distance, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
}
