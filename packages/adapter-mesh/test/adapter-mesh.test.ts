import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { exportToSchematic } from "../../exporter-schem/src/index.js";
import { importFromSchematic } from "../../importer-schem/src/index.js";
import { generateLayerGuide, generateMaterialList } from "../../core/src/index.js";
import { objToVoxelPlan } from "../src/index.js";

const fixtures = ["cube", "pyramid", "octahedron", "gabled-cabin"];
const expectedSolid = {
  cube: { size: [8, 8, 8], surfaceBlocks: 296, blocks: 512 },
  pyramid: { size: [8, 8, 8], surfaceBlocks: 260, blocks: 300 },
  octahedron: { size: [8, 8, 8], surfaceBlocks: 248, blocks: 256 },
  "gabled-cabin": { size: [8, 8, 6], surfaceBlocks: 240, blocks: 360 },
} as const;

function source(name: string): string {
  return readFileSync(join(import.meta.dirname, "fixtures", `${name}.obj`), "utf8");
}

describe("OBJ to VoxelPlan", () => {
  for (const fixture of fixtures) {
    it(`${fixture}: normalizes, bounds occupancy and is deterministic`, () => {
      const input = source(fixture);
      const first = objToVoxelPlan(input, { targetHeight: 8, maxBlocks: 2_000, voxelMode: "solid", name: fixture });
      const second = objToVoxelPlan(input, { targetHeight: 8, maxBlocks: 2_000, voxelMode: "solid", name: fixture });
      const surface = objToVoxelPlan(input, { targetHeight: 8, maxBlocks: 2_000, voxelMode: "surface", name: fixture });
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      expect(first.version).toBe("0.1");
      expect(first.origin).toEqual([0, 0, 0]);
      expect(first.size).toEqual(expectedSolid[fixture as keyof typeof expectedSolid].size);
      expect(first.blocks.length).toBe(expectedSolid[fixture as keyof typeof expectedSolid].blocks);
      expect(surface.blocks.length).toBe(expectedSolid[fixture as keyof typeof expectedSolid].surfaceBlocks);
      expect(first.blocks.length).toBeLessThanOrEqual(2_000);
      expect(new Set(first.blocks.map((entry) => entry.pos.join(","))).size).toBe(first.blocks.length);
      expect(first.blocks.every(({ pos }) => pos.every((value, axis) => value >= 0 && value < first.size[axis]))).toBe(true);
    });
  }

  it("emits a downstream-compatible plan for metadata and schematic export/import", () => {
    const plan = objToVoxelPlan(source("cube"), { targetHeight: 8, voxelMode: "solid" });
    expect(generateMaterialList(plan)).toEqual([{ block: { name: "minecraft:stone" }, count: plan.blocks.length }]);
    expect(generateLayerGuide(plan).length).toBe(8);
    const schematic = exportToSchematic(plan);
    const roundTrip = importFromSchematic(schematic, { name: plan.name });
    expect(roundTrip.size).toEqual(plan.size);
    expect(roundTrip.blocks.map(({ pos, block }) => ({ pos, block }))).toEqual(plan.blocks);
  });

  it("uses an explicit, stable surface definition and rejects budget explosions", () => {
    const surface = objToVoxelPlan(source("cube"), { targetHeight: 4, voxelMode: "surface" });
    const solid = objToVoxelPlan(source("cube"), { targetHeight: 4, voxelMode: "solid" });
    expect(surface.blocks.length).toBe(56);
    expect(solid.blocks.length).toBe(64);
    expect(() => objToVoxelPlan(source("gabled-cabin"), { targetHeight: 64, maxBlocks: 100 })).toThrow(/exceed maxBlocks/);
  });

  it("computes bounds for large repeated face references without argument overflow", () => {
    const repeatedFaceCount = 50_000;
    const input = [
      "v 0 0 0",
      "v 1 0 0",
      "v 0 1 1",
      ...Array.from({ length: repeatedFaceCount }, () => "f 1 2 3"),
    ].join("\n");

    const plan = objToVoxelPlan(input, { targetHeight: 1, maxBlocks: 1, voxelMode: "surface" });

    expect(plan.size).toEqual([1, 1, 1]);
    expect(plan.blocks).toHaveLength(1);
    expect(plan.blocks[0].pos).toEqual([0, 0, 0]);
    expect(plan.blocks.every(({ pos }) => pos.every((value, axis) => value >= 0 && value < plan.size[axis]))).toBe(true);
  });
});
