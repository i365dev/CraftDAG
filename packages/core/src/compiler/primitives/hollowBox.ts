import { CraftDagDocument, HollowBoxNode } from "../../types.js";
import { VoxelGrid } from "../../voxel/VoxelGrid.js";
import { resolveBlock } from "../resolveBlock.js";

export function compileHollowBox(
  node: HollowBoxNode,
  grid: VoxelGrid,
  doc: CraftDagDocument
): void {
  const { from, to, block } = node.params;
  const blockState = resolveBlock(block, doc.palette);

  const minX = Math.min(from[0], to[0]);
  const maxX = Math.max(from[0], to[0]);
  const minY = Math.min(from[1], to[1]);
  const maxY = Math.max(from[1], to[1]);
  const minZ = Math.min(from[2], to[2]);
  const maxZ = Math.max(from[2], to[2]);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const isShell =
          x === minX ||
          x === maxX ||
          y === minY ||
          y === maxY ||
          z === minZ ||
          z === maxZ;
        if (isShell) {
          grid.setBlock([x, y, z], blockState, node.id);
        }
      }
    }
  }
}
