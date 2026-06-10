import { CompileError } from "../errors.js";
import { Vec3, BlockState, VoxelBlock, VoxelPlan } from "../types.js";

export class VoxelGrid {
  private grid = new Map<string, { block: BlockState; sourceNodeId?: string }>();

  constructor(
    public readonly size: Vec3,
    public readonly origin: Vec3 = [0, 0, 0],
    public readonly name: string = "voxel-plan"
  ) {}

  /**
   * Helper to format a coordinate to a string key.
   */
  private posToKey(pos: Vec3): string {
    return `${pos[0]},${pos[1]},${pos[2]}`;
  }

  /**
   * Checks if a coordinate is within the grid boundaries.
   */
  public isOutOfBounds(pos: Vec3): boolean {
    const [x, y, z] = pos;
    const [w, h, l] = this.size;
    return x < 0 || x >= w || y < 0 || y >= h || z < 0 || z >= l;
  }

  /**
   * Sets a block at the specified coordinate.
   * Throws CompileError if the coordinate is out of bounds.
   */
  public setBlock(pos: Vec3, block: BlockState, sourceNodeId?: string): void {
    if (this.isOutOfBounds(pos)) {
      throw new CompileError(
        `Coordinate [${pos.join(", ")}] is out of bounds for grid size [${this.size.join(", ")}]`
      );
    }
    this.grid.set(this.posToKey(pos), { block, sourceNodeId });
  }

  /**
   * Gets the block at the specified coordinate, or undefined if empty.
   */
  public getBlock(pos: Vec3): { block: BlockState; sourceNodeId?: string } | undefined {
    return this.grid.get(this.posToKey(pos));
  }

  /**
   * Clears the block at the specified coordinate.
   */
  public clearBlock(pos: Vec3): void {
    if (this.isOutOfBounds(pos)) {
      throw new CompileError(
        `Coordinate [${pos.join(", ")}] is out of bounds for grid size [${this.size.join(", ")}]`
      );
    }
    this.grid.delete(this.posToKey(pos));
  }

  /**
   * Checks if there is a block at the specified coordinate.
   */
  public hasBlock(pos: Vec3): boolean {
    return this.grid.has(this.posToKey(pos));
  }

  /**
   * Iterates over all non-empty blocks in the grid.
   */
  public getBlocks(): VoxelBlock[] {
    const blocks: VoxelBlock[] = [];
    for (const [key, val] of this.grid.entries()) {
      const [x, y, z] = key.split(",").map(Number) as Vec3;
      blocks.push({
        pos: [x, y, z],
        block: val.block,
        sourceNodeId: val.sourceNodeId,
      });
    }
    return blocks;
  }

  /**
   * Converts the grid into a serialized VoxelPlan.
   */
  public toVoxelPlan(): VoxelPlan {
    return {
      version: "0.1",
      name: this.name,
      size: this.size,
      origin: this.origin,
      blocks: this.getBlocks(),
    };
  }
}
