export type Vector3 = [number, number, number];
export type MeshTriangle = [Vector3, Vector3, Vector3];
export type MeshFormat = "OBJ" | "STL";
export type UpAxis = "auto" | "x" | "y" | "z";

export type ParsedMesh = {
  name: string;
  format: MeshFormat;
  triangles: MeshTriangle[];
  vertexCount: number;
  bounds: { min: Vector3; max: Vector3 };
  closedConfidence: number;
};

export type VoxelizedMesh = {
  width: number;
  depth: number;
  height: number;
  layers: Set<string>[];
  occupiedVoxels: number;
  confidence: number;
  upAxis: Exclude<UpAxis, "auto">;
  flipped: boolean;
};

export type VoxelizeOptions = {
  maxWidthStuds: number;
  maxDepthStuds: number;
  maxHeightLayers: number;
  upAxis: UpAxis;
  flipUp?: boolean;
};

const MAX_TRIANGLES = 250_000;
const numberPattern = "[-+]?(?:\\d*\\.?\\d+)(?:[eE][-+]?\\d+)?";
const cellKey = (x: number, z: number) => `${x}:${z}`;

function meshBounds(triangles: MeshTriangle[]) {
  const min: Vector3 = [Infinity, Infinity, Infinity];
  const max: Vector3 = [-Infinity, -Infinity, -Infinity];
  for (const triangle of triangles) {
    for (const vertex of triangle) {
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], vertex[axis]);
        max[axis] = Math.max(max[axis], vertex[axis]);
      }
    }
  }
  return { min, max };
}

function edgeKey(a: Vector3, b: Vector3) {
  const point = (value: Vector3) => value.map(item => Number(item.toPrecision(7))).join(",");
  const first = point(a), second = point(b);
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function closedConfidence(triangles: MeshTriangle[]) {
  const edges = new Map<string, number>();
  for (const [a, b, c] of triangles) {
    for (const key of [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]) {
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  if (!edges.size) return 0;
  return [...edges.values()].filter(count => count === 2).length / edges.size;
}

function finishMesh(name: string, format: MeshFormat, triangles: MeshTriangle[], vertexCount: number): ParsedMesh {
  if (!triangles.length) throw new Error(`${format} file contains no usable triangles`);
  if (triangles.length > MAX_TRIANGLES) throw new Error(`Mesh has more than ${MAX_TRIANGLES.toLocaleString()} triangles; simplify it before importing`);
  const bounds = meshBounds(triangles);
  if (bounds.max.every((value, axis) => value === bounds.min[axis])) throw new Error("Mesh has no measurable size");
  return { name, format, triangles, vertexCount, bounds, closedConfidence: closedConfidence(triangles) };
}

export function parseObj(text: string, name = "Imported OBJ"): ParsedMesh {
  const vertices: Vector3[] = [], triangles: MeshTriangle[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("v ")) {
      const values = line.slice(2).trim().split(/\s+/).slice(0, 3).map(Number);
      if (values.length === 3 && values.every(Number.isFinite)) vertices.push(values as Vector3);
    } else if (line.startsWith("f ")) {
      const indices = line.slice(2).trim().split(/\s+/).map(token => Number.parseInt(token.split("/")[0], 10)).map(index => index < 0 ? vertices.length + index : index - 1);
      if (indices.length < 3 || indices.some(index => !vertices[index])) continue;
      for (let index = 1; index < indices.length - 1; index++) triangles.push([vertices[indices[0]], vertices[indices[index]], vertices[indices[index + 1]]]);
    }
  }
  return finishMesh(name, "OBJ", triangles, vertices.length);
}

function parseBinaryStl(buffer: ArrayBuffer, name: string): ParsedMesh | null {
  if (buffer.byteLength < 84) return null;
  const view = new DataView(buffer), count = view.getUint32(80, true);
  if (!count || 84 + count * 50 > buffer.byteLength) return null;
  const triangles: MeshTriangle[] = [];
  for (let index = 0; index < count; index++) {
    const start = 84 + index * 50 + 12, triangle: Vector3[] = [];
    for (let vertex = 0; vertex < 3; vertex++) triangle.push([view.getFloat32(start + vertex * 12, true), view.getFloat32(start + vertex * 12 + 4, true), view.getFloat32(start + vertex * 12 + 8, true)]);
    if (triangle.flat().every(Number.isFinite)) triangles.push(triangle as MeshTriangle);
  }
  return finishMesh(name, "STL", triangles, triangles.length * 3);
}

export function parseStl(buffer: ArrayBuffer, name = "Imported STL"): ParsedMesh {
  const binary = parseBinaryStl(buffer, name);
  if (binary) return binary;
  const text = new TextDecoder().decode(buffer), matcher = new RegExp(`vertex\\s+(${numberPattern})\\s+(${numberPattern})\\s+(${numberPattern})`, "gi"), vertices: Vector3[] = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) vertices.push([Number(match[1]), Number(match[2]), Number(match[3])]);
  const triangles: MeshTriangle[] = [];
  for (let index = 0; index + 2 < vertices.length; index += 3) triangles.push([vertices[index], vertices[index + 1], vertices[index + 2]]);
  return finishMesh(name, "STL", triangles, vertices.length);
}

export async function parseMeshFile(file: File): Promise<ParsedMesh> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "obj") return parseObj(await file.text(), file.name);
  if (extension === "stl") return parseStl(await file.arrayBuffer(), file.name);
  throw new Error("Choose an OBJ or STL file");
}

function axisIndexes(mesh: ParsedMesh, requested: UpAxis) {
  const names = ["x", "y", "z"] as const;
  // OBJ convention is Y-up and STL convention is Z-up. Choosing the longest
  // dimension made long noses, wings, and vehicles stand on end.
  const up = requested === "auto" ? (mesh.format === "OBJ" ? 1 : 2) : names.indexOf(requested);
  const horizontal = [0, 1, 2].filter(axis => axis !== up);
  return { up, across: horizontal[0], depth: horizontal[1], name: names[up] };
}

function barycentricRayX(pointY: number, pointZ: number, triangle: MeshTriangle) {
  const [a, b, c] = triangle;
  const denominator = (b[1] - c[1]) * (a[2] - c[2]) + (c[2] - b[2]) * (a[1] - c[1]);
  if (Math.abs(denominator) < 1e-9) return null;
  const first = ((b[1] - c[1]) * (pointZ - c[2]) + (c[2] - b[2]) * (pointY - c[1])) / denominator;
  const second = ((c[1] - a[1]) * (pointZ - c[2]) + (a[2] - c[2]) * (pointY - c[1])) / denominator;
  const third = 1 - first - second;
  if (first < -1e-7 || second < -1e-7 || third < -1e-7) return null;
  return first * a[0] + second * b[0] + third * c[0];
}

export function voxelizeMesh(mesh: ParsedMesh, options: VoxelizeOptions): VoxelizedMesh {
  const axes = axisIndexes(mesh, options.upAxis), spans = mesh.bounds.max.map((value, axis) => Math.max(1e-9, value - mesh.bounds.min[axis]));
  const scale = Math.min(options.maxWidthStuds / spans[axes.across], options.maxDepthStuds / spans[axes.depth], options.maxHeightLayers / spans[axes.up]);
  const width = Math.max(1, Math.round(spans[axes.across] * scale)), depth = Math.max(1, Math.round(spans[axes.depth] * scale)), height = Math.max(1, Math.round(spans[axes.up] * scale));
  const transformed = mesh.triangles.map(triangle => triangle.map(vertex => [
    (vertex[axes.across] - mesh.bounds.min[axes.across]) / spans[axes.across] * width,
    (options.flipUp ? mesh.bounds.max[axes.up] - vertex[axes.up] : vertex[axes.up] - mesh.bounds.min[axes.up]) / spans[axes.up] * height,
    (vertex[axes.depth] - mesh.bounds.min[axes.depth]) / spans[axes.depth] * depth,
  ] as Vector3) as MeshTriangle);
  const bins = new Map<string, MeshTriangle[]>();
  for (const triangle of transformed) {
    const minY = Math.max(0, Math.floor(Math.min(...triangle.map(vertex => vertex[1])))), maxY = Math.min(height - 1, Math.floor(Math.max(...triangle.map(vertex => vertex[1]))));
    const minZ = Math.max(0, Math.floor(Math.min(...triangle.map(vertex => vertex[2])))), maxZ = Math.min(depth - 1, Math.floor(Math.max(...triangle.map(vertex => vertex[2]))));
    for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const key = `${y}:${z}`, bucket = bins.get(key);
      if (bucket) bucket.push(triangle); else bins.set(key, [triangle]);
    }
  }
  const solid = Array.from({ length: height }, () => new Set<string>()), sampleOffsets = [.3, .7];
  for (let y = 0; y < height; y++) for (let z = 0; z < depth; z++) {
    const votes = new Uint8Array(width), bucket = bins.get(`${y}:${z}`) ?? [];
    for (const offsetY of sampleOffsets) for (const offsetZ of sampleOffsets) {
      const intersections = bucket.map(triangle => barycentricRayX(y + offsetY, z + offsetZ, triangle)).filter((value): value is number => value !== null).sort((a, b) => a - b);
      const unique = intersections.filter((value, index) => index === 0 || Math.abs(value - intersections[index - 1]) > 1e-5);
      for (let pair = 0; pair + 1 < unique.length; pair += 2) {
        const start = Math.max(0, Math.floor(unique[pair])), end = Math.min(width - 1, Math.floor(unique[pair + 1]));
        for (let x = start; x <= end; x++) if (Math.min(unique[pair + 1], x + 1) - Math.max(unique[pair], x) >= .2) votes[x]++;
      }
    }
    for (let x = 0; x < width; x++) if (votes[x] >= 2) solid[y].add(cellKey(x, z));
  }
  if (!solid.some(layer => layer.size)) throw new Error("The mesh could not be filled. Check that it is a closed/watertight solid and try another up axis");
  const occupiedVoxels = solid.reduce((total, layer) => total + layer.size, 0);
  return { width, depth, height, layers: solid, occupiedVoxels, confidence: Math.round(mesh.closedConfidence * 100), upAxis: axes.name, flipped: Boolean(options.flipUp) };
}
