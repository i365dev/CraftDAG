import { describe, expect, it } from "vitest";
import {
  compileComponentPlan,
  ComponentPlanDocument,
  expandComponentPlan,
  validateComponentPlan,
  ValidationError,
  analyzeComponentPlanSupport,
} from "../src/index.js";

describe("FloorStack Component", () => {
  const basicFloorStackDoc: ComponentPlanDocument = {
    version: "0.1",
    name: "Basic Floor Stack Tower",
    bounds: { width: 10, height: 12, length: 10 },
    palette: {
      foundation: "minecraft:stone_bricks",
      wall: "minecraft:stone",
      floor: "minecraft:spruce_planks",
      roof: "minecraft:spruce_slabs",
      circulation: "minecraft:ladder",
    },
    components: [
      {
        id: "tower",
        type: "FloorStack",
        placement: {
          anchor: { x: 1, y: 0, z: 1 },
          size: { width: 8, height: 12, length: 8 },
        },
        options: {
          levels: 3,
          levelHeight: 4,
          setbackPerLevel: 1,
          stairStyle: "ladder",
          stairSide: "back",
        },
      },
    ],
  };

  it("validates and parses a FloorStack component", () => {
    const validated = validateComponentPlan(basicFloorStackDoc);
    expect(validated.components?.[0].type).toBe("FloorStack");
  });

  it("expands FloorStack into floor, wall, roof, ladder, and hole nodes", () => {
    const craftDag = expandComponentPlan(basicFloorStackDoc);

    // Should contain floors, walls, roof, ladders, and doorway holes
    const nodeIds = craftDag.nodes.map((node) => node.id);
    
    // Level 0 floor, wall, circulation (ladder) to level 1
    expect(nodeIds).toContain("tower__floor_0");
    expect(nodeIds).toContain("tower__wall_0");
    expect(nodeIds).toContain("tower__ladder_0");
    expect(nodeIds).toContain("tower__ladder_hole_0");

    // Level 1 floor, wall, circulation (ladder) to level 2
    expect(nodeIds).toContain("tower__floor_1");
    expect(nodeIds).toContain("tower__wall_1");
    expect(nodeIds).toContain("tower__ladder_1");
    expect(nodeIds).toContain("tower__ladder_hole_1");

    // Level 2 (top level) floor, wall, roof
    expect(nodeIds).toContain("tower__floor_2");
    expect(nodeIds).toContain("tower__wall_2");
    expect(nodeIds).toContain("tower__roof");
  });

  it("checks floor slab bounds expansion: level > 0 floor size matches previous level size", () => {
    const craftDag = expandComponentPlan(basicFloorStackDoc);
    const floor0 = craftDag.nodes.find((n) => n.id === "tower__floor_0")!;
    const floor1 = craftDag.nodes.find((n) => n.id === "tower__floor_1")!;

    // Level 0 levelBox: anchor x=1, z=1, size width=8, length=8
    // So floor_0 goes from [1, 0, 1] to [8, 0, 8]
    expect(floor0.params.from).toEqual([1, 0, 1]);
    expect(floor0.params.to).toEqual([8, 0, 8]); // 1 + 8 - 1 = 8

    // Level 1 levelBox: anchor x=2, z=2, size width=6, length=6
    // But floor_1 should use level 0's size to cover the lower level completely: [1, 4, 1] to [8, 4, 8]
    expect(floor1.params.from).toEqual([1, 4, 1]);
    expect(floor1.params.to).toEqual([8, 4, 8]);
  });

  it("throws validation error for invalid level height (levelHeight < 2)", () => {
    const invalidDoc: ComponentPlanDocument = {
      ...basicFloorStackDoc,
      components: [
        {
          id: "tower",
          type: "FloorStack",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 8, height: 12, length: 8 },
          },
          options: {
            levels: 12,
            levelHeight: 1, // Invalid height
          },
        },
      ],
    };

    expect(() => validateComponentPlan(invalidDoc)).toThrow(ValidationError);
  });

  it("throws validation error when setbacks collapse one or more levels", () => {
    const invalidDoc: ComponentPlanDocument = {
      ...basicFloorStackDoc,
      components: [
        {
          id: "tower",
          type: "FloorStack",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 8, height: 12, length: 8 },
          },
          options: {
            levels: 6,
            levelHeight: 2,
            setbackPerLevel: 2, // 6 levels * 2 inset = 12 setback, width is 8 -> collapsed!
          },
        },
      ],
    };

    expect(() => validateComponentPlan(invalidDoc)).toThrow(ValidationError);
  });

  it("falls back to ladder style if stair does not fit (width - 2 < levelHeight)", () => {
    const docWithStairs: ComponentPlanDocument = {
      ...basicFloorStackDoc,
      components: [
        {
          id: "tower",
          type: "FloorStack",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 5, height: 8, length: 5 },
          },
          options: {
            levels: 2,
            levelHeight: 4, // uw = 5 - 2*1 = 3 (for level 1). levelHeight = 4. 4 > 3 - 2 = 1. Stair doesn't fit!
            setbackPerLevel: 1,
            stairStyle: "stair",
            stairSide: "back",
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(docWithStairs);
    const nodeIds = craftDag.nodes.map((node) => node.id);

    // It should contain ladder instead of stair steps
    expect(nodeIds).toContain("tower__ladder_0");
    expect(nodeIds.some((id) => id.includes("stair_0_step"))).toBe(false);
  });

  it("successfully compiles stairs when they do fit", () => {
    const docWithStairs: ComponentPlanDocument = {
      ...basicFloorStackDoc,
      bounds: { width: 15, height: 12, length: 15 },
      components: [
        {
          id: "tower",
          type: "FloorStack",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 12, height: 8, length: 12 },
          },
          options: {
            levels: 2,
            levelHeight: 4, // next level width = 10, 10 - 2 = 8 >= 4. Stairs fit!
            setbackPerLevel: 1,
            stairStyle: "stair",
            stairSide: "back",
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(docWithStairs);
    const nodeIds = craftDag.nodes.map((node) => node.id);

    expect(nodeIds).toContain("tower__stair_0_step_0");
    expect(nodeIds).toContain("tower__stair_hole_0");
    expect(nodeIds).not.toContain("tower__ladder_0");
  });

  it("passes support connectivity analysis with no disconnected components", () => {
    // The support analysis requires a foundation to connect to ground
    const fullPlan: ComponentPlanDocument = {
      version: "0.1",
      name: "Supported Floor Stack",
      bounds: { width: 12, height: 12, length: 12 },
      palette: {
        foundation: "minecraft:stone_bricks",
        wall: "minecraft:stone",
        floor: "minecraft:spruce_planks",
        roof: "minecraft:spruce_slabs",
        circulation: "minecraft:ladder",
      },
      components: [
        {
          id: "plinth",
          type: "Foundation",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 12, height: 1, length: 12 },
          },
        },
        {
          id: "tower",
          type: "FloorStack",
          inputs: [{ ref: "plinth" }],
          placement: {
            anchor: { x: 2, y: 1, z: 2 },
            size: { width: 8, height: 8, length: 8 },
          },
          options: {
            levels: 2,
            levelHeight: 4,
            setbackPerLevel: 1,
            stairStyle: "ladder",
          },
        },
      ],
    };

    const analysisResult = analyzeComponentPlanSupport(fullPlan);
    expect(analysisResult.summary.disconnectedBlocks).toBe(0);
    expect(analysisResult.summary.qualityGate.status).not.toBe("block");
  });
});
