import { describe, it, expect } from "vitest";
import { compileDocument, CraftDagDocument } from "../src/index.js";

describe("Compilers Batch 2 (HollowBox, Doorway, Window, GableRoof)", () => {
  const baseDoc: Omit<CraftDagDocument, "nodes"> = {
    version: "0.1",
    name: "Batch 2 Test",
    size: [10, 10, 10],
    palette: {
      stone: "minecraft:stone_bricks",
      wood: "minecraft:oak_planks",
      glass: "minecraft:glass",
    },
  };

  it("should compile HollowBox correctly by leaving the center empty", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        {
          id: "hollow",
          type: "HollowBox",
          params: {
            from: [0, 0, 0],
            to: [2, 2, 2], // 3x3x3. Center [1,1,1] should be empty.
            block: "stone",
          },
        },
      ],
    };
    const plan = compileDocument(doc);
    expect(plan.blocks.length).toBe(26); // 27 - 1 = 26
    const centerBlock = plan.blocks.find(b => b.pos[0] === 1 && b.pos[1] === 1 && b.pos[2] === 1);
    expect(centerBlock).toBeUndefined();
  });

  it("should carve a Doorway out of a Wall and clear blocks", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        {
          id: "wall",
          type: "Wall",
          params: {
            from: [0, 0, 0],
            to: [4, 2, 0], // X: 0..4 (5), Y: 0..2 (3), Z: 0. Total 15 blocks
            block: "stone",
          },
        },
        {
          id: "door",
          type: "Doorway",
          inputs: [{ ref: "wall" }],
          params: {
            from: [2, 0, 0],
            to: [2, 1, 0], // Carves out Y=0 and Y=1 at X=2, Z=0 (2 blocks)
          },
        },
      ],
    };
    const plan = compileDocument(doc);
    expect(plan.blocks.length).toBe(13); // 15 - 2 = 13
    const doorBottom = plan.blocks.find(b => b.pos[0] === 2 && b.pos[1] === 0 && b.pos[2] === 0);
    const doorTop = plan.blocks.find(b => b.pos[0] === 2 && b.pos[1] === 1 && b.pos[2] === 0);
    expect(doorBottom).toBeUndefined();
    expect(doorTop).toBeUndefined();
  });

  it("should place optional Doorway block if provided", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        {
          id: "wall",
          type: "Wall",
          params: {
            from: [0, 0, 0],
            to: [4, 2, 0],
            block: "stone",
          },
        },
        {
          id: "door",
          type: "Doorway",
          inputs: [{ ref: "wall" }],
          params: {
            from: [2, 0, 0],
            to: [2, 1, 0],
            block: "minecraft:oak_door",
          },
        },
      ],
    };
    const plan = compileDocument(doc);
    expect(plan.blocks.length).toBe(15); // Stays 15 because we replaced stone with door blocks
    const doorBottom = plan.blocks.find(b => b.pos[0] === 2 && b.pos[1] === 0 && b.pos[2] === 0);
    expect(doorBottom?.block.name).toBe("minecraft:oak_door");
  });

  it("should compile Window and default to minecraft:glass", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        {
          id: "wall",
          type: "Wall",
          params: {
            from: [0, 0, 0],
            to: [4, 2, 0],
            block: "stone",
          },
        },
        {
          id: "window",
          type: "Window",
          inputs: [{ ref: "wall" }],
          params: {
            from: [2, 1, 0],
            to: [2, 1, 0], // 1 block at X=2, Y=1, Z=0
          },
        },
      ],
    };
    const plan = compileDocument(doc);
    expect(plan.blocks.length).toBe(15);
    const windowBlock = plan.blocks.find(b => b.pos[0] === 2 && b.pos[1] === 1 && b.pos[2] === 0);
    expect(windowBlock?.block.name).toBe("minecraft:glass");
    expect(windowBlock?.sourceNodeId).toBe("window");
  });

  it("should compile GableRoof correctly along X and Z axes", () => {
    const docX: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        {
          id: "roof",
          type: "GableRoof",
          params: {
            from: [0, 0, 0],
            to: [0, 2, 4], // X=0, Y: 0..2, Z: 0..4 (5 blocks long). Runs along X (ridge is X-axis), slopes along Z.
            block: "wood",
            direction: "x",
          },
        },
      ],
    };
    // Z: 0..4. Center is Z=2.
    // distFromEdge for Z=0,4 is 0 => Y = minY = 0
    // distFromEdge for Z=1,3 is 1 => Y = minY + 1 = 1
    // distFromEdge for Z=2 is 2 => Y = minY + 2 = 2
    const planX = compileDocument(docX);
    expect(planX.blocks.length).toBe(5);
    expect(planX.blocks.find(b => b.pos[2] === 0)?.pos[1]).toBe(0);
    expect(planX.blocks.find(b => b.pos[2] === 4)?.pos[1]).toBe(0);
    expect(planX.blocks.find(b => b.pos[2] === 1)?.pos[1]).toBe(1);
    expect(planX.blocks.find(b => b.pos[2] === 3)?.pos[1]).toBe(1);
    expect(planX.blocks.find(b => b.pos[2] === 2)?.pos[1]).toBe(2);

    const docZ: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        {
          id: "roof",
          type: "GableRoof",
          params: {
            from: [0, 0, 0],
            to: [4, 2, 0], // X: 0..4, Y: 0..2, Z=0. runs along Z, slopes along X.
            block: "wood",
            direction: "z",
          },
        },
      ],
    };
    const planZ = compileDocument(docZ);
    expect(planZ.blocks.length).toBe(5);
    expect(planZ.blocks.find(b => b.pos[0] === 0)?.pos[1]).toBe(0);
    expect(planZ.blocks.find(b => b.pos[0] === 4)?.pos[1]).toBe(0);
    expect(planZ.blocks.find(b => b.pos[0] === 1)?.pos[1]).toBe(1);
    expect(planZ.blocks.find(b => b.pos[0] === 3)?.pos[1]).toBe(1);
    expect(planZ.blocks.find(b => b.pos[0] === 2)?.pos[1]).toBe(2);
  });
});
