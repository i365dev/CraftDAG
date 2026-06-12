import zlib from "zlib";
import nbt from "prismarine-nbt";
import { describe, it, expect } from "vitest";
import { compileDocument, VoxelPlan, stringifyBlockState } from "@i365dev/craftdag-core";
import { exportToSchematic } from "../src/index.js";
import fs from "fs";
import path from "path";

/**
 * Decodes an array of VarInts from a byte array or buffer.
 */
function readVarInts(bytes: Buffer | number[]): number[] {
  const ids: number[] = [];
  let idx = 0;
  while (idx < bytes.length) {
    let value = 0;
    let shift = 0;
    while (true) {
      const byte = bytes[idx++];
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        break;
      }
      shift += 7;
    }
    ids.push(value);
  }
  return ids;
}

/**
 * Parses a Sponge Schematic v2 buffer and reconstructs a coordinate map.
 */
async function reconstructFromSchematic(buffer: Buffer): Promise<{
  width: number;
  height: number;
  length: number;
  dataVersion: number;
  blocks: Map<string, string>;
}> {
  // 1. Gzip decompress
  const unzipped = zlib.gunzipSync(buffer);

  // 2. Parse NBT
  const { parsed } = await nbt.parse(unzipped);
  const simplified = nbt.simplify(parsed) as any;

  expect(simplified.Version).toBe(2);

  const width = simplified.Width;
  const height = simplified.Height;
  const length = simplified.Length;
  const dataVersion = simplified.DataVersion;

  // 3. Decode Palette
  const reversePalette = new Map<number, string>();
  for (const [key, val] of Object.entries(simplified.Palette)) {
    reversePalette.set(val as number, key);
  }

  // 4. Decode VarInt BlockData
  const blockDataBytes = simplified.BlockData;
  const blockIds = readVarInts(blockDataBytes);

  // 5. Reconstruct 3D Grid Map
  const blocksMap = new Map<string, string>();
  let index = 0;
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        const id = blockIds[index++];
        const blockstateStr = reversePalette.get(id);
        if (!blockstateStr) {
          throw new Error(`Block ID ${id} not found in Palette`);
        }
        blocksMap.set(`${x},${y},${z}`, blockstateStr);
      }
    }
  }

  return { width, height, length, dataVersion, blocks: blocksMap };
}

/**
 * Asserts that the reconstructed schematic matches the original VoxelPlan exactly.
 */
async function assertRoundTrip(plan: VoxelPlan, buffer: Buffer, expectedDataVersion = 3463): Promise<void> {
  const { width, height, length, dataVersion, blocks } = await reconstructFromSchematic(buffer);

  // Assert basic properties
  expect(width).toBe(plan.size[0]);
  expect(height).toBe(plan.size[1]);
  expect(length).toBe(plan.size[2]);
  expect(dataVersion).toBe(expectedDataVersion);

  // Index blocks in original plan
  const planBlocksMap = new Map<string, string>();
  for (const b of plan.blocks) {
    const key = `${b.pos[0]},${b.pos[1]},${b.pos[2]}`;
    planBlocksMap.set(key, stringifyBlockState(b.block));
  }

  // Verify every coordinate in the bounding box
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y},${z}`;
        const expectedBlockstate = planBlocksMap.get(key) ?? "minecraft:air";
        const actualBlockstate = blocks.get(key);
        expect(actualBlockstate).toBe(expectedBlockstate);
      }
    }
  }
}

describe("Schematic Round-Trip Semantic Verification", () => {
  it("should round-trip a small handcrafted VoxelPlan successfully", async () => {
    const mockPlan: VoxelPlan = {
      version: "0.1",
      name: "Handcrafted Test",
      size: [2, 2, 3],
      origin: [0, 0, 0],
      blocks: [
        { pos: [0, 0, 0], block: { name: "minecraft:stone" } },
        { pos: [1, 0, 2], block: { name: "minecraft:oak_planks" } },
        { pos: [0, 1, 1], block: { name: "minecraft:glass" } },
      ],
    };

    const buffer = exportToSchematic(mockPlan, { dataVersion: 3578 });
    await assertRoundTrip(mockPlan, buffer, 3578);
  });

  const examples = ["starter-house", "watchtower", "small-bridge"];
  const examplesDir = path.resolve(__dirname, "../../../examples");

  for (const name of examples) {
    it(`should successfully round-trip compile and verify example: ${name}`, async () => {
      const jsonPath = path.join(examplesDir, `${name}.craftdag.json`);
      expect(fs.existsSync(jsonPath)).toBe(true);

      const content = fs.readFileSync(jsonPath, "utf-8");
      const doc = JSON.parse(content);

      // Compile to VoxelPlan
      const plan = compileDocument(doc);
      
      // Export to Sponge Schematic
      const buffer = exportToSchematic(plan);

      // Round-trip verify
      await assertRoundTrip(plan, buffer, 3463);
    });
  }
});
