import { describe, it, expect } from "vitest";
import { VoxelGrid, CompileError } from "../src/index.js";

describe("Voxel Plan & Grid", () => {
  it("should create a voxel grid and serialize it to a VoxelPlan", () => {
    const grid = new VoxelGrid([10, 5, 10], [0, 0, 0], "test-build");
    
    expect(grid.size).toEqual([10, 5, 10]);
    expect(grid.origin).toEqual([0, 0, 0]);
    expect(grid.name).toBe("test-build");

    const blockState = { name: "minecraft:stone" };
    grid.setBlock([0, 0, 0], blockState, "node-1");

    expect(grid.hasBlock([0, 0, 0])).toBe(true);
    expect(grid.getBlock([0, 0, 0])).toEqual({
      block: blockState,
      sourceNodeId: "node-1",
    });

    const plan = grid.toVoxelPlan();
    expect(plan.version).toBe("0.1");
    expect(plan.name).toBe("test-build");
    expect(plan.blocks.length).toBe(1);
    expect(plan.blocks[0]).toEqual({
      pos: [0, 0, 0],
      block: blockState,
      sourceNodeId: "node-1",
    });
  });

  it("should throw CompileError on out-of-bounds setBlock", () => {
    const grid = new VoxelGrid([5, 5, 5]);
    expect(() => grid.setBlock([5, 0, 0], { name: "minecraft:stone" })).toThrow(CompileError);
    expect(() => grid.setBlock([0, -1, 0], { name: "minecraft:stone" })).toThrow(CompileError);
  });

  it("should overwrite previous blocks deterministically on repeated writes", () => {
    const grid = new VoxelGrid([5, 5, 5]);
    grid.setBlock([1, 1, 1], { name: "minecraft:dirt" }, "node-1");
    grid.setBlock([1, 1, 1], { name: "minecraft:glass" }, "node-2");

    expect(grid.getBlock([1, 1, 1])).toEqual({
      block: { name: "minecraft:glass" },
      sourceNodeId: "node-2",
    });
    expect(grid.getBlocks().length).toBe(1);
  });

  it("should clear blocks correctly", () => {
    const grid = new VoxelGrid([5, 5, 5]);
    grid.setBlock([1, 1, 1], { name: "minecraft:dirt" });
    expect(grid.hasBlock([1, 1, 1])).toBe(true);

    grid.clearBlock([1, 1, 1]);
    expect(grid.hasBlock([1, 1, 1])).toBe(false);
    expect(grid.getBlock([1, 1, 1])).toBeUndefined();
  });
});
