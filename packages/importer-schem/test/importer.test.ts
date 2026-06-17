import { describe, it, expect } from "vitest";
import { exportToSchematic } from "../../exporter-schem/src/index.js";
import { importFromSchematic } from "../src/index.js";
import { compileComponentPlan } from "../../core/src/index.js";

const samplePlan = {
  version: "0.1" as const,
  name: "test",
  bounds: { width: 32, height: 24, length: 32 },
  palette: {
    foundation: "minecraft:stone",
    wall: "minecraft:stone_bricks",
    floor: "minecraft:oak_planks",
    roof: "minecraft:spruce_planks",
    trim: "minecraft:deepslate_bricks",
    glass: "minecraft:glass",
    door: "minecraft:dark_oak_door",
  },
  policy: { sizeTier: "small" as const },
  components: [
    {
      id: "base",
      type: "Foundation" as const,
      placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 32, height: 1, length: 32 } },
    },
    {
      id: "walls",
      type: "RoomShell" as const,
      inputs: [{ ref: "base" }],
      placement: { anchor: { x: 4, y: 1, z: 4 }, size: { width: 24, height: 6, length: 24 } },
      options: { includeFloor: false, includeCeiling: false },
    },
    {
      id: "roof",
      type: "GableRoof" as const,
      inputs: [{ ref: "walls" }],
      placement: { over: "walls", direction: "x" as const },
    },
  ],
};

describe("schematic importer", () => {
  it("round-trips export → import with matching block count", () => {
    const voxel = compileComponentPlan(samplePlan);
    const schematic = exportToSchematic(voxel);
    const imported = importFromSchematic(schematic, { name: voxel.name });

    expect(imported.blocks.length).toBe(voxel.blocks.length);
    expect(imported.size).toEqual(voxel.size);
    expect(imported.name).toBe(voxel.name);
  });

  it("preserves non-air block state names", () => {
    const voxel = compileComponentPlan(samplePlan);
    const schematic = exportToSchematic(voxel);
    const imported = importFromSchematic(schematic);

    const names = new Set(imported.blocks.map((b) => b.block.name));
    expect(names.has("minecraft:air")).toBe(false);
    expect(names.has("minecraft:stone")).toBe(true);
  });

  it("handles empty schematic (all air)", () => {
    const emptyPlan = {
      version: "0.1" as const,
      name: "empty",
      size: [4, 4, 4] as [number, number, number],
      origin: [0, 0, 0] as [number, number, number],
      blocks: [],
    };
    const schematic = exportToSchematic(emptyPlan);
    const imported = importFromSchematic(schematic);
    expect(imported.blocks.length).toBe(0);
    expect(imported.size).toEqual([4, 4, 4]);
  });
});
