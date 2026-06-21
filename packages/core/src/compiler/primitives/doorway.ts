import { BlockState, CraftDagDocument, DoorwayNode } from "../../types.js";
import { VoxelGrid } from "../../voxel/VoxelGrid.js";
import { resolveBlock } from "../resolveBlock.js";

function isDoorBlock(name: string): boolean {
  return /_door$/.test(name);
}

/**
 * Infers a door-facing direction from the doorway axis.
 * For a wall aligned to X (minZ === maxZ), the door faces north/south — default north.
 * For a wall aligned to Z (minX === maxX), the door faces east/west — default east.
 */
function doorFacing(minX: number, maxX: number, minZ: number, maxZ: number): string {
  if (minZ === maxZ) return "north";
  return "east";
}

export function compileDoorway(
  node: DoorwayNode,
  grid: VoxelGrid,
  doc: CraftDagDocument
): void {
  const { from, to, block } = node.params;
  const blockState = block ? resolveBlock(block, doc.palette) : undefined;

  const minX = Math.min(from[0], to[0]);
  const maxX = Math.max(from[0], to[0]);
  const minY = Math.min(from[1], to[1]);
  const maxY = Math.max(from[1], to[1]);
  const minZ = Math.min(from[2], to[2]);
  const maxZ = Math.max(from[2], to[2]);

  const height = maxY - minY + 1;
  const isDoor = blockState && isDoorBlock(blockState.name);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (!blockState) {
          grid.clearBlock([x, y, z]);
        } else if (isDoor) {
          if (y >= minY + 2) {
            grid.clearBlock([x, y, z]);
            continue;
          }

          const doorProps: Record<string, string> = {
            ...blockState.properties,
            facing: doorFacing(minX, maxX, minZ, maxZ),
            half: y === minY ? "lower" : "upper",
          };

          const doorState: BlockState = { name: blockState.name, properties: doorProps };
          grid.setBlock([x, y, z], doorState, node.id);
        } else {
          grid.setBlock([x, y, z], blockState, node.id);
        }
      }
    }
  }
}
