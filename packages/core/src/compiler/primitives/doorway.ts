import { BlockState, CraftDagDocument, DoorwayNode } from "../../types.js";
import { VoxelGrid } from "../../voxel/VoxelGrid.js";
import { resolveBlock } from "../resolveBlock.js";

function isDoorBlock(name: string): boolean {
  return /_door$/.test(name);
}

/** Fallback facing derivation when the ComponentPlan didn't pass one. */
function fallbackFacing(minX: number, maxX: number, minZ: number, maxZ: number): string {
  return minZ === maxZ ? "north" : "east";
}

export function compileDoorway(
  node: DoorwayNode,
  grid: VoxelGrid,
  doc: CraftDagDocument
): void {
  const { from, to, block, facing } = node.params;
  const blockState = block ? resolveBlock(block, doc.palette) : undefined;

  const minX = Math.min(from[0], to[0]);
  const maxX = Math.max(from[0], to[0]);
  const minY = Math.min(from[1], to[1]);
  const maxY = Math.max(from[1], to[1]);
  const minZ = Math.min(from[2], to[2]);
  const maxZ = Math.max(from[2], to[2]);

  const isDoor = blockState && isDoorBlock(blockState.name);
  const doorFacing = facing ?? fallbackFacing(minX, maxX, minZ, maxZ);

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

          const doorIndex = minZ === maxZ ? x - minX : z - minZ;
          const hinge = doorIndex % 2 === 0 ? "left" : "right";

          const doorProps: Record<string, string> = {
            ...blockState.properties,
            facing: doorFacing,
            half: y === minY ? "lower" : "upper",
            hinge,
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
