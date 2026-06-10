import zlib from "zlib";
import nbt from "prismarine-nbt";
import { VoxelPlan, stringifyBlockState } from "@craftdag/core";

/**
 * Encodes a number as a VarInt byte array.
 */
function writeVarInt(value: number): number[] {
  const bytes: number[] = [];
  let temp = value;
  while ((temp & ~0x7f) !== 0) {
    bytes.push((temp & 0x7f) | 0x80);
    temp >>>= 7;
  }
  bytes.push(temp & 0x7f);
  return bytes;
}

export interface ExportOptions {
  dataVersion?: number;
}

/**
 * Converts a CraftDAG VoxelPlan into a Sponge Schematic v2 (.schem) file buffer,
 * which is Gzip-compressed NBT.
 */
export function exportToSchematic(plan: VoxelPlan, options?: ExportOptions): Buffer {
  const dataVersion = options?.dataVersion ?? 3463; // Default to Minecraft 1.20.1 (3463)
  const [width, height, length] = plan.size;

  // Build the palette map and reverse map
  // Key: string representation of blockstate, Value: integer ID
  const paletteMap = new Map<string, number>();
  
  // Initialize with minecraft:air at ID 0
  paletteMap.set("minecraft:air", 0);

  // Group plan blocks by coordinates for fast lookup
  const blocksMap = new Map<string, string>();
  for (const blockObj of plan.blocks) {
    const key = `${blockObj.pos[0]},${blockObj.pos[1]},${blockObj.pos[2]}`;
    const blockstateStr = stringifyBlockState(blockObj.block);
    blocksMap.set(key, blockstateStr);

    if (!paletteMap.has(blockstateStr)) {
      paletteMap.set(blockstateStr, paletteMap.size);
    }
  }

  // Generate BlockData VarInt array
  const blockDataBytes: number[] = [];

  // Index order is: (y * length + z) * width + x
  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        const coordKey = `${x},${y},${z}`;
        const blockstateStr = blocksMap.get(coordKey) || "minecraft:air";
        const id = paletteMap.get(blockstateStr)!;
        blockDataBytes.push(...writeVarInt(id));
      }
    }
  }

  // Create Palette NBT Compound
  const paletteNbtValue: Record<string, { type: "int"; value: number }> = {};
  for (const [blockstateStr, id] of paletteMap.entries()) {
    paletteNbtValue[blockstateStr] = { type: "int", value: id };
  }

  // Build the full Schematic NBT object
  const nbtData = {
    type: "compound" as const,
    name: "Schematic",
    value: {
      Version: { type: "int" as const, value: 2 },
      DataVersion: { type: "int" as const, value: dataVersion },
      Width: { type: "short" as const, value: width },
      Height: { type: "short" as const, value: height },
      Length: { type: "short" as const, value: length },
      Offset: { type: "intArray" as const, value: [0, 0, 0] },
      PaletteMax: { type: "int" as const, value: paletteMap.size },
      Palette: {
        type: "compound" as const,
        value: paletteNbtValue,
      },
      BlockData: {
        type: "byteArray" as const,
        value: blockDataBytes,
      },
    },
  };

  // Serialize NBT to uncompressed buffer
  const uncompressedBuffer = nbt.writeUncompressed(nbtData);

  // Compress using Gzip
  return zlib.gzipSync(uncompressedBuffer);
}

export const exporterVersion = "0.1.0";
