import { CraftDagDocument, WindowNode } from "../../types.js";
import { VoxelGrid } from "../../voxel/VoxelGrid.js";
import { resolveBlock } from "../resolveBlock.js";

export function compileWindow(
  node: WindowNode,
  grid: VoxelGrid,
  doc: CraftDagDocument
): void {
  const { from, to, block } = node.params;
  const blockStr = block || "minecraft:glass";
  const blockState = resolveBlock(blockStr, doc.palette);

  const minX = Math.min(from[0], to[0]);
  const maxX = Math.max(from[0], to[0]);
  const minY = Math.min(from[1], to[1]);
  const maxY = Math.max(from[1], to[1]);
  const minZ = Math.min(from[2], to[2]);
  const maxZ = Math.max(from[2], to[2]);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        grid.setBlock([x, y, z], blockState, node.id);
      }
    }
  }
}
