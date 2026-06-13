import { describe, expect, it } from "vitest";
import {
  compileComponentPlan,
  ComponentPlanDocument,
  expandComponentPlan,
  GraphError,
  validateComponentPlan,
  ValidationError,
} from "../src/index.js";

describe("ComponentPlan", () => {
  const starterCabin: ComponentPlanDocument = {
    version: "0.1",
    name: "Starter Cabin",
    grid: { unitBlocks: 1 },
    bounds: { width: 7, height: 6, length: 7 },
    palette: {
      foundation: "minecraft:cobblestone",
      wall: "minecraft:oak_planks",
      roof: "minecraft:spruce_planks",
      glass: "minecraft:glass",
      door: "minecraft:oak_door",
    },
    components: [
      {
        id: "foundation",
        type: "Foundation",
        placement: {
          anchor: { x: 0, y: 0, z: 0 },
          size: { width: 7, height: 1, length: 7 },
        },
      },
      {
        id: "main_room",
        type: "RoomShell",
        inputs: [{ ref: "foundation" }],
        placement: {
          anchor: { x: 0, y: 1, z: 0 },
          size: { width: 7, height: 3, length: 7 },
        },
        options: {
          includeFloor: false,
          includeCeiling: false,
        },
      },
      {
        id: "front_door",
        type: "Door",
        inputs: [{ ref: "main_room" }],
        placement: {
          target: "main_room",
          wall: "front",
          offset: 3,
          y: 1,
        },
      },
      {
        id: "front_window",
        type: "Window",
        inputs: [{ ref: "main_room" }],
        placement: {
          target: "main_room",
          wall: "front",
          offset: 1,
          y: 2,
          width: 1,
          height: 1,
        },
      },
      {
        id: "roof",
        type: "GableRoof",
        inputs: [{ ref: "main_room" }],
        placement: {
          over: "main_room",
          overhang: 1,
          direction: "x",
        },
      },
    ],
  };

  it("validates a v0.1 component plan", () => {
    const validated = validateComponentPlan(starterCabin);
    expect(validated.components.length).toBe(5);
  });

  it("expands components to stable CraftDAG node IDs", () => {
    const craftDag = expandComponentPlan(starterCabin);

    expect(craftDag.size).toEqual([7, 6, 7]);
    expect(craftDag.nodes.map((node) => node.id)).toEqual([
      "foundation__solid",
      "main_room__shell",
      "front_door__opening",
      "front_window__opening",
      "roof__gable",
    ]);
    expect(craftDag.nodes[1].inputs).toEqual([{ ref: "foundation__solid" }]);
    expect(craftDag.nodes[2].inputs).toEqual([{ ref: "main_room__shell" }]);
  });

  it("expands wall attachments to deterministic opening coordinates", () => {
    const craftDag = expandComponentPlan(starterCabin);
    const door = craftDag.nodes.find((node) => node.id === "front_door__opening");
    const window = craftDag.nodes.find((node) => node.id === "front_window__opening");

    expect(door).toMatchObject({
      type: "Doorway",
      params: {
        from: [3, 1, 0],
        to: [3, 2, 0],
        block: "door",
      },
    });
    expect(window).toMatchObject({
      type: "Window",
      params: {
        from: [1, 2, 0],
        to: [1, 2, 0],
        block: "glass",
      },
    });
  });

  it("applies unitBlocks during expansion instead of post-scaling VoxelPlan", () => {
    const scaled: ComponentPlanDocument = {
      ...starterCabin,
      grid: { unitBlocks: 2 },
    };

    const craftDag = expandComponentPlan(scaled);
    const foundation = craftDag.nodes[0];
    const door = craftDag.nodes.find((node) => node.id === "front_door__opening");

    expect(craftDag.size).toEqual([14, 12, 14]);
    expect(foundation).toMatchObject({
      type: "SolidBox",
      params: {
        from: [0, 0, 0],
        to: [13, 1, 13],
      },
    });
    expect(door).toMatchObject({
      type: "Doorway",
      params: {
        from: [6, 2, 0],
        to: [7, 5, 0],
      },
    });
  });

  it("compiles a ComponentPlan through the existing CraftDAG compiler", () => {
    const voxelPlan = compileComponentPlan(starterCabin);

    expect(voxelPlan.name).toBe("Starter Cabin");
    expect(voxelPlan.blocks.length).toBeGreaterThan(0);
    expect(voxelPlan.blocks.some((block) => block.sourceNodeId === "front_window__opening")).toBe(true);
  });

  it("rejects unknown semantic references with repairable details", () => {
    const invalid: ComponentPlanDocument = {
      ...starterCabin,
      components: [
        {
          ...starterCabin.components[0],
          inputs: [{ ref: "missing_component" }],
        },
      ],
    };

    expect(() => validateComponentPlan(invalid)).toThrow(ValidationError);

    try {
      validateComponentPlan(invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "UNKNOWN_COMPONENT_REF",
          componentId: "foundation",
        }),
      ]);
    }
  });

  it("rejects component dependency cycles", () => {
    const invalid: ComponentPlanDocument = {
      ...starterCabin,
      components: [
        {
          ...starterCabin.components[0],
          inputs: [{ ref: "main_room" }],
        },
        {
          ...starterCabin.components[1],
          inputs: [{ ref: "foundation" }],
        },
      ],
    };

    expect(() => validateComponentPlan(invalid)).toThrow(GraphError);
  });

  it("rejects unknown material references before compilation", () => {
    const invalid: ComponentPlanDocument = {
      ...starterCabin,
      components: [
        {
          ...starterCabin.components[0],
          materials: { main: "not_in_palette" },
        },
      ],
    };

    expect(() => validateComponentPlan(invalid)).toThrow(ValidationError);
    expect(() => validateComponentPlan(invalid)).toThrow("unknown material");
  });

  it("rejects wall attachments below the target wall anchor", () => {
    const invalid: ComponentPlanDocument = {
      ...starterCabin,
      components: starterCabin.components.map((component) => {
        if (component.id !== "front_door" || component.type !== "Door") {
          return component;
        }

        return {
          ...component,
          placement: {
            ...component.placement,
            y: 0,
          },
        };
      }),
    };

    expect(() => validateComponentPlan(invalid)).toThrow(ValidationError);

    try {
      validateComponentPlan(invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "ATTACHMENT_OUT_OF_BOUNDS",
          componentId: "front_door",
        }),
      ]);
    }
  });

  it("expands scaled SupportPost components as solid post volumes", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Scaled Post",
      grid: { unitBlocks: 2 },
      bounds: { width: 3, height: 4, length: 3 },
      palette: {
        trim: "minecraft:spruce_log",
      },
      components: [
        {
          id: "post",
          type: "SupportPost",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 1, height: 4, length: 1 },
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes[0]).toMatchObject({
      id: "post__post",
      type: "SolidBox",
      params: {
        from: [2, 0, 2],
        to: [3, 7, 3],
        block: "trim",
      },
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });
});
