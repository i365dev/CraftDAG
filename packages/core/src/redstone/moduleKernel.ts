import type { Vec3, VoxelPlan } from "../types.js";

/** Experimental structural core for already-authored, concrete module layouts. */
export type HorizontalFacing = "north" | "east" | "south" | "west";

export interface StaticModuleBlock {
  role: string;
  pos: Vec3;
  block: string;
  properties: Record<string, string>;
}

export interface StaticModuleDefinition {
  identity: { id: string; version: string };
  canonicalFacing: HorizontalFacing;
  bounds: Vec3;
  blocks: StaticModuleBlock[];
}

const FACINGS: HorizontalFacing[] = ["north", "east", "south", "west"];
const FACING_INDEX = new Map(FACINGS.map((facing, index) => [facing, index]));
const UNSUPPORTED_DIRECTIONAL_PROPERTIES = new Set(["axis", "hinge", "orientation", "rotation", "shape"]);

function assertFacing(value: string): asserts value is HorizontalFacing {
  if (!FACING_INDEX.has(value as HorizontalFacing)) throw new Error(`unsupported horizontal facing: ${value}`);
}

function assertDefinition(module: StaticModuleDefinition): void {
  if (!module.identity.id.trim() || !module.identity.version.trim()) throw new Error("module identity and version must be non-empty");
  if (!Array.isArray(module.bounds) || module.bounds.length !== 3 || module.bounds.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new Error("module bounds must be three positive integers");
  }
  assertFacing(module.canonicalFacing);
  if (!module.blocks.length) throw new Error("module must contain at least one authored block");

  const roles = new Set<string>();
  const positions = new Set<string>();
  for (const entry of module.blocks) {
    if (!/^[a-z][a-z0-9_]*$/.test(entry.role)) throw new Error(`invalid block role: ${entry.role}`);
    if (roles.has(entry.role)) throw new Error(`duplicate block role: ${entry.role}`);
    roles.add(entry.role);
    if (!Array.isArray(entry.pos) || entry.pos.length !== 3 || entry.pos.some((value) => !Number.isInteger(value))) {
      throw new Error(`block ${entry.role} position must contain three integers`);
    }
    const [x, y, z] = entry.pos;
    const [width, height, depth] = module.bounds;
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) {
      throw new Error(`block ${entry.role} is outside module bounds`);
    }
    const coordinate = entry.pos.join(",");
    if (positions.has(coordinate)) throw new Error(`occupied-coordinate collision at ${coordinate}`);
    positions.add(coordinate);
    if (!/^minecraft:[a-z0-9_./-]+$/.test(entry.block)) throw new Error(`invalid concrete Minecraft block id: ${entry.block}`);
    for (const [property, value] of Object.entries(entry.properties)) {
      if (typeof value !== "string") throw new Error(`block property ${property} on ${entry.role} must be a string`);
      if (property === "facing") assertFacingOrVertical(value);
    }
  }
}

function assertFacingOrVertical(value: string): void {
  if (value === "up" || value === "down") return;
  assertFacing(value);
}

function rotateState(properties: Record<string, string>, turns: number): Record<string, string> {
  const output: Record<string, string> = {};
  for (const property of Object.keys(properties).sort()) {
    const value = properties[property];
    if (UNSUPPORTED_DIRECTIONAL_PROPERTIES.has(property) && turns !== 0) {
      throw new Error(`unsupported directional block-state property: ${property}`);
    }
    if (property === "facing") {
      output[property] = value === "up" || value === "down" ? value : rotateFacing(value as HorizontalFacing, turns);
    } else if (FACING_INDEX.has(property as HorizontalFacing)) {
      output[rotateFacing(property as HorizontalFacing, turns)] = value;
    } else {
      output[property] = value;
    }
  }
  return output;
}

function rotateFacing(facing: HorizontalFacing, turns: number): HorizontalFacing {
  const index = FACING_INDEX.get(facing);
  if (index === undefined) throw new Error(`unsupported horizontal facing: ${facing}`);
  return FACINGS[(index + turns) % FACINGS.length];
}

function rotatePosition(position: Vec3, bounds: Vec3, turns: number): Vec3 {
  let [x, , z] = position;
  const y = position[1];
  let [width, , depth] = bounds;
  for (let turn = 0; turn < turns; turn += 1) {
    [x, z] = [depth - 1 - z, x];
    [width, depth] = [depth, width];
  }
  return [x, y, z];
}

/** Compile concrete authored topology into the existing ordinary VoxelPlan shape. */
export function compileStaticModule(module: StaticModuleDefinition, facing: HorizontalFacing): VoxelPlan {
  assertDefinition(module);
  assertFacing(facing);
  const turns = (FACING_INDEX.get(facing)! - FACING_INDEX.get(module.canonicalFacing)! + FACINGS.length) % FACINGS.length;
  const [width, height, depth] = module.bounds;
  const size: Vec3 = turns % 2 === 0 ? [width, height, depth] : [depth, height, width];

  return {
    version: "0.1",
    name: `${module.identity.id}@${module.identity.version} (${facing})`,
    size,
    origin: [0, 0, 0],
    blocks: module.blocks.map((entry) => ({
      pos: rotatePosition(entry.pos, module.bounds, turns),
      block: { name: entry.block, properties: rotateState(entry.properties, turns) },
      sourceNodeId: entry.role,
    })),
  };
}
