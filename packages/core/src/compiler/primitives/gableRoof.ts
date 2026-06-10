import { CraftDagDocument, GableRoofNode } from "../../types.js";
import { VoxelGrid } from "../../voxel/VoxelGrid.js";
import { resolveBlock } from "../resolveBlock.js";

export function compileGableRoof(
  node: GableRoofNode,
  grid: VoxelGrid,
  doc: CraftDagDocument
): void {
  const { from, to, block, direction = "x" } = node.params;
  const blockState = resolveBlock(block, doc.palette);

  const minX = Math.min(from[0], to[0]);
  const maxX = Math.max(from[0], to[0]);
  const minY = Math.min(from[1], to[1]);
  const maxY = Math.max(from[1], to[1]);
  const minZ = Math.min(from[2], to[2]);
  const maxZ = Math.max(from[2], to[2]);

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      let distFromEdge = 0;
      if (direction === "x") {
        distFromEdge = Math.min(z - minZ, maxZ - z);
      } else {
        distFromEdge = Math.min(x - minX, maxX - x);
      }
      const y = Math.min(minY + distFromEdge, maxY);
      grid.setBlock([x, y, z], blockState, node.id);
    }
  }
}
