import zlib from "zlib";
import nbt from "prismarine-nbt";
import { describe, it, expect } from "vitest";
import { VoxelPlan } from "@craftdag/core";
import { exportToSchematic } from "../src/index.js";

describe("Schematic Exporter", () => {
  const mockPlan: VoxelPlan = {
    version: "0.1",
    name: "Tiny House",
    size: [2, 1, 3], // Width=2, Height=1, Length=3
    origin: [0, 0, 0],
    blocks: [
      { pos: [0, 0, 0], block: { name: "minecraft:stone" } },
      { pos: [1, 0, 2], block: { name: "minecraft:oak_planks" } },
    ],
  };

  it("should generate a valid Gzipped Sponge Schematic v2 file", async () => {
    const buffer = exportToSchematic(mockPlan);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    // Decompress and parse the NBT to check structural correctness
    const unzipped = zlib.gunzipSync(buffer);
    const { parsed } = await nbt.parse(unzipped);
    const simplified = nbt.simplify(parsed) as any;

    expect(simplified.Version).toBe(2);
    expect(simplified.Width).toBe(2);
    expect(simplified.Height).toBe(1);
    expect(simplified.Length).toBe(3);
    
    // Palette should contain minecraft:air, minecraft:stone, and minecraft:oak_planks
    expect(simplified.Palette).toBeDefined();
    expect(simplified.Palette["minecraft:air"]).toBe(0);
    expect(simplified.Palette["minecraft:stone"]).toBeDefined();
    expect(simplified.Palette["minecraft:oak_planks"]).toBeDefined();

    // BlockData length check: Total blocks = 2 * 1 * 3 = 6 indices
    expect(simplified.BlockData).toBeDefined();
    // Since VarInt encoding is used and IDs are small, each block is 1 byte, so 6 bytes total
    expect(simplified.BlockData.length).toBe(6);
  });

  it("should support custom DataVersion options", async () => {
    const buffer = exportToSchematic(mockPlan, { dataVersion: 3578 });
    const unzipped = zlib.gunzipSync(buffer);
    const { parsed } = await nbt.parse(unzipped);
    const simplified = nbt.simplify(parsed) as any;
    expect(simplified.DataVersion).toBe(3578);
  });
});
