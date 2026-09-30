import { BlockState, VoxelPlan } from "@i365dev/craftdag-core";

type Point3 = [number, number, number];
type Triangle = [Point3, Point3, Point3];

export interface ObjToVoxelPlanOptions {
  /** Scale the mesh's vertical extent to this many voxels. The bottom is placed at Y=0. */
  targetHeight?: number;
  /** Maximum both for the normalized bounding-box volume and emitted occupied blocks. */
  maxBlocks?: number;
  /** Surface triangle coverage or parity-filled interiors for closed meshes. */
  voxelMode?: "surface" | "solid";
  /** One deterministic fallback Minecraft block; OBJ/MTL materials are not interpreted yet. */
  defaultBlock?: string;
  name?: string;
}

const DEFAULT_TARGET_HEIGHT = 16;
const DEFAULT_MAX_BLOCKS = 100_000;
const EPSILON = 1e-9;

function fail(message: string): never {
  throw new Error(`OBJ adapter: ${message}`);
}

function parseObj(source: string): Triangle[] {
  const vertices: Point3[] = [];
  const triangles: Triangle[] = [];
  for (const [lineIndex, rawLine] of source.split(/\r?\n/).entries()) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const [kind, ...fields] = line.split(/\s+/);
    if (kind === "v") {
      if (fields.length < 3) fail(`line ${lineIndex + 1}: vertex needs three coordinates`);
      const vertex = fields.slice(0, 3).map(Number) as Point3;
      if (!vertex.every(Number.isFinite)) fail(`line ${lineIndex + 1}: non-finite vertex`);
      vertices.push(vertex);
    } else if (kind === "f") {
      if (fields.length < 3) fail(`line ${lineIndex + 1}: face needs at least three vertices`);
      const indices = fields.map((field) => {
        const rawIndex = Number(field.split("/")[0]);
        if (!Number.isInteger(rawIndex) || rawIndex === 0) fail(`line ${lineIndex + 1}: invalid face index`);
        const index = rawIndex > 0 ? rawIndex - 1 : vertices.length + rawIndex;
        if (index < 0 || index >= vertices.length) fail(`line ${lineIndex + 1}: face index out of range`);
        return index;
      });
      for (let i = 1; i < indices.length - 1; i += 1) {
        triangles.push([vertices[indices[0]], vertices[indices[i]], vertices[indices[i + 1]]]);
      }
    }
  }
  if (triangles.length === 0) fail("no triangular faces found");
  return triangles;
}

function computeMeshBounds(triangles: Triangle[]): { min: Point3; max: Point3 } {
  const min: Point3 = [Infinity, Infinity, Infinity];
  const max: Point3 = [-Infinity, -Infinity, -Infinity];
  for (const triangle of triangles) {
    for (const vertex of triangle) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], vertex[axis]);
        max[axis] = Math.max(max[axis], vertex[axis]);
      }
    }
  }
  return { min, max };
}

function cross(a: Point3, b: Point3): Point3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function subtract(a: Point3, b: Point3): Point3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function triangleIntersectsCell(triangle: Triangle, x: number, y: number, z: number): boolean {
  const center: Point3 = [x + 0.5, y + 0.5, z + 0.5];
  const v = triangle.map((point) => subtract(point, center)) as Triangle;
  const edges = [subtract(v[1], v[0]), subtract(v[2], v[1]), subtract(v[0], v[2])];
  const axes: Point3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], cross(edges[0], edges[1])];
  for (const edge of edges) {
    axes.push(cross(edge, [1, 0, 0]), cross(edge, [0, 1, 0]), cross(edge, [0, 0, 1]));
  }
  for (const axis of axes) {
    if (axis[0] === 0 && axis[1] === 0 && axis[2] === 0) continue;
    const p0 = v[0][0] * axis[0] + v[0][1] * axis[1] + v[0][2] * axis[2];
    const p1 = v[1][0] * axis[0] + v[1][1] * axis[1] + v[1][2] * axis[2];
    const p2 = v[2][0] * axis[0] + v[2][1] * axis[1] + v[2][2] * axis[2];
    const radius = 0.5 * (Math.abs(axis[0]) + Math.abs(axis[1]) + Math.abs(axis[2]));
    if (Math.min(p0, p1, p2) > radius + EPSILON || Math.max(p0, p1, p2) < -radius - EPSILON) return false;
  }
  return true;
}

function rayHitX(point: Point3, triangle: Triangle): number | undefined {
  // A tiny fixed Y/Z skew avoids most shared-edge degeneracies for axis-aligned meshes.
  const direction: Point3 = [1, 1.23456789e-7, 2.34567891e-7];
  const edge1 = subtract(triangle[1], triangle[0]);
  const edge2 = subtract(triangle[2], triangle[0]);
  const h = cross(direction, edge2);
  const determinant = edge1[0] * h[0] + edge1[1] * h[1] + edge1[2] * h[2];
  if (Math.abs(determinant) < EPSILON) return undefined;
  const inverse = 1 / determinant;
  const s = subtract(point, triangle[0]);
  const u = inverse * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);
  if (u < -EPSILON || u > 1 + EPSILON) return undefined;
  const q = cross(s, edge1);
  const v = inverse * (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2]);
  if (v < -EPSILON || u + v > 1 + EPSILON) return undefined;
  const distance = inverse * (edge2[0] * q[0] + edge2[1] * q[1] + edge2[2] * q[2]);
  return distance > EPSILON ? distance : undefined;
}

function validateBlock(name: string): BlockState {
  if (!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(name)) fail(`invalid namespaced defaultBlock "${name}"`);
  return { name };
}

/** Parse a deterministic OBJ subset, voxelize it and emit CraftDAG's ordinary VoxelPlan. */
export function objToVoxelPlan(source: string, options: ObjToVoxelPlanOptions = {}): VoxelPlan {
  const targetHeight = options.targetHeight ?? DEFAULT_TARGET_HEIGHT;
  const maxBlocks = options.maxBlocks ?? DEFAULT_MAX_BLOCKS;
  const mode = options.voxelMode ?? "surface";
  if (!Number.isInteger(targetHeight) || targetHeight < 1) fail("targetHeight must be a positive integer");
  if (!Number.isInteger(maxBlocks) || maxBlocks < 1) fail("maxBlocks must be a positive integer");
  if (mode !== "surface" && mode !== "solid") fail("voxelMode must be surface or solid");
  const block = validateBlock(options.defaultBlock ?? "minecraft:stone");
  const parsed = parseObj(source);
  const { min, max } = computeMeshBounds(parsed);
  const extents = subtract(max, min);
  if (extents.some((extent) => extent <= EPSILON)) fail("mesh bounds must have non-zero width, height and depth");
  const scale = targetHeight / extents[1];
  const triangles = parsed.map((triangle) => triangle.map((vertex) => [
    (vertex[0] - min[0]) * scale,
    (vertex[1] - min[1]) * scale,
    (vertex[2] - min[2]) * scale,
  ]) as Triangle);
  const size: Point3 = [
    Math.max(1, Math.ceil(extents[0] * scale - EPSILON)),
    targetHeight,
    Math.max(1, Math.ceil(extents[2] * scale - EPSILON)),
  ];
  const volume = size[0] * size[1] * size[2];
  if (!Number.isSafeInteger(volume) || volume > maxBlocks) {
    fail(`normalized bounds ${size.join("x")} exceed maxBlocks=${maxBlocks} (bounding volume ${volume})`);
  }

  const occupied = new Set<string>();
  const add = (x: number, y: number, z: number) => occupied.add(`${x},${y},${z}`);
  for (const triangle of triangles) {
    const triMin = [0, 1, 2].map((axis) => Math.max(0, Math.floor(Math.min(...triangle.map((v) => v[axis])) - EPSILON)));
    const triMax = [0, 1, 2].map((axis) => Math.min(size[axis] - 1, Math.floor(Math.max(...triangle.map((v) => v[axis])) + EPSILON)));
    for (let y = triMin[1]; y <= triMax[1]; y += 1) {
      for (let z = triMin[2]; z <= triMax[2]; z += 1) {
        for (let x = triMin[0]; x <= triMax[0]; x += 1) {
          if (triangleIntersectsCell(triangle, x, y, z)) add(x, y, z);
        }
      }
    }
  }
  if (mode === "solid") {
    for (let y = 0; y < size[1]; y += 1) {
      for (let z = 0; z < size[2]; z += 1) {
        const hits = triangles.map((triangle) => rayHitX([-1, y + 0.5, z + 0.5], triangle))
          .filter((x): x is number => x !== undefined)
          .sort((a, b) => a - b);
        const uniqueHits: number[] = [];
        for (const hit of hits) {
          if (uniqueHits.length === 0 || Math.abs(hit - uniqueHits[uniqueHits.length - 1]) > 1e-7) uniqueHits.push(hit);
        }
        let crossings = uniqueHits.length;
        let nextHit = 0;
        for (let x = 0; x < size[0]; x += 1) {
          while (nextHit < uniqueHits.length && uniqueHits[nextHit] <= x + 1.5) {
            crossings -= 1;
            nextHit += 1;
          }
          if (crossings % 2 === 1) add(x, y, z);
        }
      }
    }
  }
  if (occupied.size > maxBlocks) fail(`occupied block count ${occupied.size} exceeds maxBlocks=${maxBlocks}`);
  const blocks = Array.from(occupied, (key) => key.split(",").map(Number) as Point3)
    .sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0])
    .map((pos) => ({ pos, block }));
  return { version: "0.1", name: options.name ?? "OBJ mesh", size, origin: [0, 0, 0], blocks };
}
