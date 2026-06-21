import zlib from "node:zlib";
import nbt from "prismarine-nbt";
import { VoxelPlan, VoxelBlock, BlockState, Vec3 } from "@i365dev/craftdag-core";

interface SchematicData {
  version: number;
  dataVersion: number;
  width: number;
  height: number;
  length: number;
  offset: Vec3;
  paletteMax: number;
  palette: Map<number, BlockState>;
  blockIds: number[];
}

function parseBlockState(str: string): BlockState {
  const bracketIdx = str.indexOf("[");
  if (bracketIdx === -1) return { name: str };
  const name = str.slice(0, bracketIdx);
  const propsStr = str.slice(bracketIdx + 1, -1);
  const properties: Record<string, string> = {};
  for (const pair of propsStr.split(",")) {
    const [key, value] = pair.split("=");
    if (key && value) properties[key.trim()] = value.trim();
  }
  return { name, properties };
}

function parseSchematic(buffer: Buffer): SchematicData {
  const uncompressed = zlib.gunzipSync(buffer);
  const parsed = nbt.parseUncompressed(uncompressed);
  const root = (parsed as any).value;

  const version = root.Version?.value ?? 2;
  const dataVersion = root.DataVersion?.value ?? 0;
  const width = root.Width?.value ?? 0;
  const height = root.Height?.value ?? 0;
  const length = root.Length?.value ?? 0;
  const offset: Vec3 = root.Offset?.value ?? [0, 0, 0];
  const paletteMax = root.PaletteMax?.value ?? 0;

  const palette = new Map<number, BlockState>();
  const paletteCompound = root.Palette?.value ?? {};
  for (const [blockStr, entry] of Object.entries(paletteCompound)) {
    const id = (entry as any).value as number;
    palette.set(id, parseBlockState(blockStr));
  }

  const blockDataBytes: number[] = root.BlockData?.value ?? [];
  const blockIds: number[] = [];
  let i = 0;
  while (i < blockDataBytes.length) {
    let value = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = blockDataBytes[i++] & 0xff;
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while ((byte & 0x80) !== 0 && i < blockDataBytes.length);
    blockIds.push(value);
  }

  return { version, dataVersion, width, height, length, offset, paletteMax, palette, blockIds };
}

export interface ImportOptions {
  name?: string;
}

export function importFromSchematic(schematicBuffer: Buffer, options?: ImportOptions): VoxelPlan {
  const data = parseSchematic(schematicBuffer);
  const { width, height, length, palette, blockIds, dataVersion } = data;

  const blocks: VoxelBlock[] = [];
  let blockIndex = 0;

  for (let y = 0; y < height; y++) {
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < width; x++) {
        const id = blockIds[blockIndex++];
        const blockState = palette.get(id);
        if (blockState && blockState.name !== "minecraft:air") {
          blocks.push({
            pos: [x, y, z],
            block: blockState,
            sourceNodeId: `schem_import_${dataVersion}`,
          });
        }
      }
    }
  }

  return {
    version: "0.1",
    name: options?.name ?? "Imported Schematic",
    size: [width, height, length],
    origin: [0, 0, 0],
    blocks,
  };
}

export const importerVersion = "0.2.0";
