import { describe, expect, it } from "vitest";
import {
  compileComponentPlan,
  ComponentPlanDocument,
  diagnosticsFromError,
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
    bounds: { width: 7, height: 8, length: 7 },
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
          y: 0,
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
          y: 1,
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
    expect(validated.components?.length).toBe(5);
  });

  it("expands components to stable CraftDAG node IDs", () => {
    const craftDag = expandComponentPlan(starterCabin);

    expect(craftDag.size).toEqual([7, 8, 7]);
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

  it("adds implicit CraftDAG dependencies from semantic attachment and cover placement", () => {
    const plan: ComponentPlanDocument = {
      ...starterCabin,
      components: starterCabin.components.map((component) => {
        if (component.type === "Door" || component.type === "Window" || component.type === "GableRoof") {
          const { inputs: _inputs, ...rest } = component;
          return rest;
        }
        return component;
      }),
    };

    const craftDag = expandComponentPlan(plan);
    const door = craftDag.nodes.find((node) => node.id === "front_door__opening");
    const window = craftDag.nodes.find((node) => node.id === "front_window__opening");
    const roof = craftDag.nodes.find((node) => node.id === "roof__gable");

    expect(door?.inputs).toEqual([{ ref: "main_room__shell" }]);
    expect(window?.inputs).toEqual([{ ref: "main_room__shell" }]);
    expect(roof?.inputs).toEqual([{ ref: "main_room__shell" }]);
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

    expect(craftDag.size).toEqual([14, 16, 14]);
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

  it("calculates scaled gable roof height from the scaled slope span", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Odd Span Roof",
      grid: { unitBlocks: 2 },
      bounds: { width: 5, height: 10, length: 5 },
      palette: {
        wall: "minecraft:oak_planks",
        roof: "minecraft:spruce_planks",
      },
      components: [
        {
          id: "room",
          type: "RoomShell",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 5, height: 1, length: 5 },
          },
        },
        {
          id: "roof",
          type: "GableRoof",
          inputs: [{ ref: "room" }],
          placement: {
            over: "room",
            direction: "x",
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);
    const roof = craftDag.nodes.find((node) => node.id === "roof__gable");

    expect(roof).toMatchObject({
      type: "GableRoof",
      params: {
        from: [0, 2, 0],
        to: [9, 6, 9],
      },
    });
  });

  it("keeps roof overhang symmetric when bounds limit the requested overhang", () => {
    const craftDag = expandComponentPlan(starterCabin);
    const roof = craftDag.nodes.find((node) => node.id === "roof__gable");

    expect(roof).toMatchObject({
      type: "GableRoof",
      params: {
        from: [0, 4, 0],
        to: [6, 7, 6],
      },
    });
  });

  it("rejects roofs that exceed height bounds instead of truncating them", () => {
    const invalid: ComponentPlanDocument = {
      ...starterCabin,
      bounds: { ...starterCabin.bounds, height: 6 },
    };

    expect(() => validateComponentPlan(invalid)).toThrow(ValidationError);

    try {
      validateComponentPlan(invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "ROOF_HEIGHT_OUT_OF_BOUNDS",
          componentId: "roof",
          repairHint: expect.stringContaining("at least 8"),
        }),
      ]);
    }
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

  it("rejects wall attachments exceeding the target wall height", () => {
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
            y: 5,
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

  it("expands Opening components as semantic pass-through cutouts", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Gatehouse Opening",
      grid: { unitBlocks: 2 },
      bounds: { width: 7, height: 5, length: 5 },
      palette: {
        wall: "minecraft:stone_bricks",
      },
      components: [
        {
          id: "gatehouse",
          type: "RoomShell",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 7, height: 5, length: 5 },
          },
        },
        {
          id: "passage",
          type: "Opening",
          placement: {
            target: "gatehouse",
            wall: "front",
            offset: 2,
            y: 0,
            width: 3,
            height: 3,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);
    const opening = craftDag.nodes.find((node) => node.id === "passage__opening");

    expect(opening).toMatchObject({
      type: "Doorway",
      inputs: [{ ref: "gatehouse__shell" }],
      params: {
        from: [4, 0, 0],
        to: [9, 5, 0],
      },
    });
    expect((opening as any)?.params.block).toBeUndefined();
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("expands Portal components as filled vertical planes", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Portal Plane",
      bounds: { width: 5, height: 5, length: 5 },
      palette: {
        wall: "minecraft:deepslate_tiles",
        portal: "minecraft:purple_stained_glass",
      },
      components: [
        {
          id: "frame_wall",
          type: "RoomShell",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 5, height: 5, length: 5 },
          },
        },
        {
          id: "portal_surface",
          type: "Portal",
          placement: {
            target: "frame_wall",
            wall: "front",
            offset: 2,
            y: 1,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);
    const portal = craftDag.nodes.find((node) => node.id === "portal_surface__portal");

    expect(portal).toMatchObject({
      type: "Window",
      inputs: [{ ref: "frame_wall__shell" }],
      params: {
        from: [2, 1, 0],
        to: [3, 3, 0],
        block: "portal",
      },
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("requires portal palette or explicit surface material for Portal components", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Missing Portal Material",
      bounds: { width: 5, height: 5, length: 5 },
      palette: {
        wall: "minecraft:deepslate_tiles",
      },
      components: [
        {
          id: "frame_wall",
          type: "RoomShell",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 5, height: 5, length: 5 },
          },
        },
        {
          id: "portal_surface",
          type: "Portal",
          placement: {
            target: "frame_wall",
            wall: "front",
            offset: 2,
            y: 1,
          },
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
          code: "UNKNOWN_MATERIAL_REF",
          componentId: "portal_surface",
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

  it("expands Platform and Beam components as semantic horizontal solid volumes", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Bridge Deck",
      grid: { unitBlocks: 2 },
      bounds: { width: 8, height: 4, length: 5 },
      palette: {
        floor: "minecraft:spruce_planks",
        trim: "minecraft:oak_log",
      },
      components: [
        {
          id: "deck",
          type: "Platform",
          placement: {
            anchor: { x: 1, y: 2, z: 1 },
            size: { width: 6, height: 1, length: 3 },
          },
        },
        {
          id: "front_beam",
          type: "Beam",
          inputs: [{ ref: "deck" }],
          placement: {
            anchor: { x: 1, y: 3, z: 1 },
            size: { width: 6, height: 1, length: 1 },
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes).toEqual([
      expect.objectContaining({
        id: "deck__platform",
        type: "SolidBox",
        params: {
          from: [2, 4, 2],
          to: [13, 5, 7],
          block: "floor",
        },
      }),
      expect.objectContaining({
        id: "front_beam__beam",
        type: "SolidBox",
        inputs: [{ ref: "deck__platform" }],
        params: {
          from: [2, 6, 2],
          to: [13, 7, 3],
          block: "trim",
        },
      }),
    ]);
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("expands Compartment and Corridor components for large-build interiors", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Interior Slice",
      bounds: { width: 18, height: 6, length: 12 },
      palette: {
        wall: "minecraft:stone_bricks",
        floor: "minecraft:smooth_stone",
      },
      components: [
        {
          id: "boiler_room",
          type: "Compartment",
          role: "boiler_room",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 8, height: 5, length: 8 },
          },
          options: {
            includeCeiling: false,
          },
        },
        {
          id: "service_corridor",
          type: "Corridor",
          role: "service_corridor",
          inputs: [{ ref: "boiler_room" }],
          placement: {
            anchor: { x: 8, y: 0, z: 2 },
            size: { width: 8, height: 4, length: 3 },
          },
          options: {
            axis: "x",
          },
        },
      ],
    };

    const validated = validateComponentPlan(plan);
    expect(validated.components?.[0]).toMatchObject({ role: "boiler_room" });

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes.map((node) => node.id)).toEqual([
      "boiler_room__shell",
      "service_corridor__floor",
      "service_corridor__left_wall",
      "service_corridor__right_wall",
      "service_corridor__ceiling",
    ]);
    expect(craftDag.nodes[0]).toMatchObject({
      id: "boiler_room__shell",
      type: "HollowBox",
      params: {
        from: [0, 0, 0],
        to: [7, 4, 7],
        block: "wall",
        includeFloor: undefined,
        includeCeiling: false,
      },
    });
    expect(craftDag.nodes[1]).toMatchObject({
      id: "service_corridor__floor",
      type: "SolidBox",
      inputs: [{ ref: "boiler_room__shell" }],
      params: {
        from: [8, 0, 2],
        to: [15, 0, 4],
        block: "floor",
      },
    });
    expect(craftDag.nodes[2]).toMatchObject({
      id: "service_corridor__left_wall",
      inputs: [{ ref: "service_corridor__floor" }],
      params: {
        from: [8, 0, 2],
        to: [15, 3, 2],
        block: "wall",
      },
    });
    expect(craftDag.nodes[3]).toMatchObject({
      id: "service_corridor__right_wall",
      params: {
        from: [8, 0, 4],
        to: [15, 3, 4],
        block: "wall",
      },
    });
    expect(craftDag.nodes[4]).toMatchObject({
      id: "service_corridor__ceiling",
      params: {
        from: [8, 3, 2],
        to: [15, 3, 4],
        block: "floor",
      },
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects corridors that cannot contain a walkable channel", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Corridor",
      bounds: { width: 8, height: 4, length: 8 },
      palette: {
        wall: "minecraft:stone_bricks",
        floor: "minecraft:smooth_stone",
      },
      components: [
        {
          id: "too_narrow",
          type: "Corridor",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 2, height: 3, length: 8 },
          },
          options: {
            axis: "z",
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "INVALID_CORRIDOR_SIZE",
          componentId: "too_narrow",
          repairHint: expect.stringContaining("width >= 3"),
        }),
      ]);
    }
  });

  it("uses the first emitted Corridor part for semantic references when floor is disabled", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Floorless Corridor Ref",
      bounds: { width: 10, height: 5, length: 5 },
      palette: {
        wall: "minecraft:stone_bricks",
        trim: "minecraft:oak_log",
      },
      components: [
        {
          id: "maintenance_passage",
          type: "Corridor",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 8, height: 3, length: 3 },
          },
          options: {
            axis: "x",
            includeFloor: false,
            includeCeiling: false,
          },
        },
        {
          id: "overhead_pipe",
          type: "Beam",
          inputs: [{ ref: "maintenance_passage" }],
          placement: {
            anchor: { x: 0, y: 3, z: 1 },
            size: { width: 8, height: 1, length: 1 },
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes.map((node) => node.id)).toEqual([
      "maintenance_passage__left_wall",
      "maintenance_passage__right_wall",
      "overhead_pipe__beam",
    ]);
    expect(craftDag.nodes[2]).toMatchObject({
      id: "overhead_pipe__beam",
      inputs: [{ ref: "maintenance_passage__left_wall" }],
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects corridors that emit no physical parts", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Empty Corridor",
      bounds: { width: 8, height: 4, length: 8 },
      palette: {
        wall: "minecraft:stone_bricks",
        floor: "minecraft:smooth_stone",
      },
      components: [
        {
          id: "empty_passage",
          type: "Corridor",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 3, height: 3, length: 8 },
          },
          options: {
            includeFloor: false,
            includeWalls: false,
            includeCeiling: false,
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "EMPTY_CORRIDOR",
          componentId: "empty_passage",
        }),
      ]);
    }
  });

  it("expands TaperedVolume and RailingRun components for non-box silhouettes", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Shape Slice",
      bounds: { width: 16, height: 6, length: 10 },
      palette: {
        wall: "minecraft:stone_bricks",
        trim: "minecraft:dark_oak_fence",
      },
      components: [
        {
          id: "bow",
          type: "TaperedVolume",
          role: "ship_bow",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 5, height: 3, length: 7 },
          },
          options: {
            axis: "x",
            startInset: 0,
            endInset: 3,
          },
        },
        {
          id: "deck_railing",
          type: "RailingRun",
          role: "deck_railing",
          inputs: [{ ref: "bow" }],
          placement: {
            anchor: { x: 6, y: 3, z: 0 },
            size: { width: 9, height: 3, length: 1 },
          },
          options: {
            axis: "x",
            postSpacing: 4,
          },
        },
      ],
    };

    const validated = validateComponentPlan(plan);
    expect(validated.components?.[0]).toMatchObject({ role: "ship_bow" });

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes.map((node) => node.id)).toEqual([
      "bow__slice_0",
      "bow__slice_1",
      "bow__slice_2",
      "bow__slice_3",
      "bow__slice_4",
      "deck_railing__post_0",
      "deck_railing__post_1",
      "deck_railing__post_2",
      "deck_railing__top_rail",
    ]);
    expect(craftDag.nodes[0]).toMatchObject({
      id: "bow__slice_0",
      params: {
        from: [0, 0, 0],
        to: [0, 2, 6],
        block: "wall",
      },
    });
    expect(craftDag.nodes[4]).toMatchObject({
      id: "bow__slice_4",
      params: {
        from: [4, 0, 3],
        to: [4, 2, 3],
        block: "wall",
      },
    });
    expect(craftDag.nodes[5]).toMatchObject({
      id: "deck_railing__post_0",
      inputs: [{ ref: "bow__slice_0" }],
      params: {
        from: [6, 3, 0],
        to: [6, 5, 0],
        block: "trim",
      },
    });
    expect(craftDag.nodes[8]).toMatchObject({
      id: "deck_railing__top_rail",
      inputs: [{ ref: "deck_railing__post_0" }],
      params: {
        from: [6, 5, 0],
        to: [14, 5, 0],
        block: "trim",
      },
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects tapered volumes whose insets collapse the cross section", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Taper",
      bounds: { width: 8, height: 4, length: 5 },
      palette: {
        wall: "minecraft:stone_bricks",
      },
      components: [
        {
          id: "collapsed_bow",
          type: "TaperedVolume",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 6, height: 3, length: 5 },
          },
          options: {
            axis: "x",
            endInset: 3,
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "INVALID_TAPERED_VOLUME_INSET",
          componentId: "collapsed_bow",
        }),
      ]);
    }
  });

  it("expands SteppedTier and VerticalSetbackVolume components for large-form massing", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Large Form Massing",
      bounds: { width: 24, height: 18, length: 16 },
      palette: {
        foundation: "minecraft:smooth_sandstone",
        wall: "minecraft:stone_bricks",
      },
      components: [
        {
          id: "pyramid_base",
          type: "SteppedTier",
          role: "pyramid_terraces",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 9, height: 4, length: 9 },
          },
          options: {
            axis: "both",
            levels: 4,
            stepHeight: 1,
            insetPerLevel: 1,
          },
        },
        {
          id: "setback_tower",
          type: "VerticalSetbackVolume",
          role: "burj_style_tower",
          inputs: [{ ref: "pyramid_base" }],
          placement: {
            anchor: { x: 12, y: 0, z: 0 },
            size: { width: 10, height: 12, length: 7 },
          },
          options: {
            axis: "both",
            levels: 3,
            levelHeight: 4,
            setbackPerLevel: 1,
          },
        },
      ],
    };

    const validated = validateComponentPlan(plan);
    expect(validated.components?.[0]).toMatchObject({ type: "SteppedTier" });

    const craftDag = expandComponentPlan(plan);
    expect(craftDag.nodes.map((node) => node.id)).toEqual([
      "pyramid_base__tier_0",
      "pyramid_base__tier_1",
      "pyramid_base__tier_2",
      "pyramid_base__tier_3",
      "setback_tower__setback_0",
      "setback_tower__setback_1",
      "setback_tower__setback_2",
    ]);
    expect(craftDag.nodes[0]).toMatchObject({
      id: "pyramid_base__tier_0",
      params: {
        from: [0, 0, 0],
        to: [8, 0, 8],
        block: "foundation",
      },
    });
    expect(craftDag.nodes[3]).toMatchObject({
      id: "pyramid_base__tier_3",
      params: {
        from: [3, 3, 3],
        to: [5, 3, 5],
      },
    });
    expect(craftDag.nodes[4]).toMatchObject({
      id: "setback_tower__setback_0",
      inputs: [{ ref: "pyramid_base__tier_0" }],
      params: {
        from: [12, 0, 0],
        to: [21, 3, 6],
        block: "wall",
      },
    });
    expect(craftDag.nodes[6]).toMatchObject({
      id: "setback_tower__setback_2",
      params: {
        from: [14, 8, 2],
        to: [19, 11, 4],
      },
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects large-form massing components whose insets collapse a level", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Large Form Massing",
      bounds: { width: 8, height: 8, length: 8 },
      palette: {
        foundation: "minecraft:smooth_sandstone",
        wall: "minecraft:stone_bricks",
      },
      components: [
        {
          id: "collapsed_tiers",
          type: "SteppedTier",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 5, height: 4, length: 5 },
          },
          options: {
            levels: 4,
            insetPerLevel: 1,
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "INVALID_STEPPED_TIER_INSET",
          componentId: "collapsed_tiers",
        }),
      ]);
    }
  });

  it("expands SteppedDome components for landmark roofs", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Stepped Dome Study",
      bounds: { width: 20, height: 12, length: 20 },
      palette: {
        roof: "minecraft:smooth_quartz",
      },
      components: [
        {
          id: "main_dome",
          type: "SteppedDome",
          role: "taj_style_central_dome",
          placement: {
            anchor: { x: 2, y: 1, z: 2 },
            size: { width: 9, height: 5, length: 9 },
          },
          options: {
            levels: 5,
            insetPerLevel: 1,
          },
        },
      ],
    };

    const validated = validateComponentPlan(plan);
    expect(validated.components?.[0]).toMatchObject({ type: "SteppedDome" });

    const craftDag = expandComponentPlan(plan);
    expect(craftDag.nodes.map((node) => node.id)).toEqual([
      "main_dome__dome_0",
      "main_dome__dome_1",
      "main_dome__dome_2",
      "main_dome__dome_3",
      "main_dome__dome_4",
    ]);
    expect(craftDag.nodes[0]).toMatchObject({
      id: "main_dome__dome_0",
      params: {
        from: [2, 1, 2],
        to: [10, 1, 10],
        block: "roof",
      },
    });
    expect(craftDag.nodes[4]).toMatchObject({
      id: "main_dome__dome_4",
      params: {
        from: [6, 5, 6],
        to: [6, 5, 6],
      },
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("expands hollow SteppedDome components as perimeter tiers", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Hollow Dome Study",
      bounds: { width: 16, height: 8, length: 16 },
      palette: {
        roof: "minecraft:smooth_quartz",
      },
      components: [
        {
          id: "hollow_dome",
          type: "SteppedDome",
          placement: {
            anchor: { x: 1, y: 1, z: 1 },
            size: { width: 7, height: 3, length: 7 },
          },
          options: {
            levels: 3,
            hollow: true,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);
    expect(craftDag.nodes.map((node) => node.id)).toContain("hollow_dome__dome_0_front");
    expect(craftDag.nodes.map((node) => node.id)).toContain("hollow_dome__dome_0_right");
    expect(craftDag.nodes[0]).toMatchObject({
      id: "hollow_dome__dome_0_front",
      params: {
        from: [1, 1, 1],
        to: [7, 1, 1],
      },
    });
  });

  it("rejects SteppedDome components whose insets collapse a level", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Dome",
      bounds: { width: 8, height: 8, length: 8 },
      palette: {
        roof: "minecraft:smooth_quartz",
      },
      components: [
        {
          id: "collapsed_dome",
          type: "SteppedDome",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 5, height: 4, length: 5 },
          },
          options: {
            levels: 4,
            insetPerLevel: 1,
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "INVALID_STEPPED_DOME_INSET",
          componentId: "collapsed_dome",
        }),
      ]);
    }
  });

  it("expands ArcadeRun and SupportBracket components for facade and cantilever support", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Arcade And Bracket Study",
      bounds: { width: 32, height: 12, length: 12 },
      palette: {
        wall: "minecraft:stone_bricks",
        trim: "minecraft:polished_andesite",
      },
      components: [
        {
          id: "colosseum_arcade",
          type: "ArcadeRun",
          role: "colosseum_facade_bays",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 19, height: 7, length: 2 },
          },
          options: {
            axis: "x",
            bayCount: 3,
            pierWidth: 1,
            archHeight: 3,
          },
        },
        {
          id: "lifeboat_shelf_brackets",
          type: "SupportBracket",
          role: "ship_lifeboat_shelf_support",
          inputs: [{ ref: "colosseum_arcade" }],
          placement: {
            anchor: { x: 22, y: 0, z: 0 },
            size: { width: 9, height: 4, length: 4 },
          },
          options: {
            axis: "x",
            direction: "positive",
            spacing: 4,
            includeTopBeam: true,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes[0]).toMatchObject({
      id: "colosseum_arcade__pier_0",
      params: {
        from: [0, 0, 0],
        to: [0, 6, 1],
        block: "wall",
      },
    });
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "colosseum_arcade__bay_1_arch_left_2",
      params: expect.objectContaining({
        from: [7, 6, 0],
        to: [9, 6, 1],
      }),
    }));
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "lifeboat_shelf_brackets__top_beam",
      inputs: [{ ref: "colosseum_arcade__pier_0" }],
      params: expect.objectContaining({
        from: [22, 3, 0],
        to: [30, 3, 3],
        block: "trim",
      }),
    }));
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "lifeboat_shelf_brackets__bracket_1_step_3",
      params: expect.objectContaining({
        from: [26, 0, 3],
        to: [26, 0, 3],
      }),
    }));
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects arcade runs whose bays collapse between piers", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Arcade",
      bounds: { width: 8, height: 6, length: 2 },
      palette: {
        wall: "minecraft:stone_bricks",
      },
      components: [
        {
          id: "crowded_arcade",
          type: "ArcadeRun",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 8, height: 6, length: 2 },
          },
          options: {
            axis: "x",
            bayCount: 4,
            pierWidth: 2,
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "INVALID_ARCADE_RUN_BAYS",
          componentId: "crowded_arcade",
        }),
      ]);
    }
  });

  it("expands TreeCanopy and OrganicPatch components for landscape features", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Landscape Features",
      bounds: { width: 20, height: 10, length: 16 },
      palette: {
        trim: "minecraft:cherry_log",
        roof: "minecraft:pink_wool",
        floor: "minecraft:water",
      },
      components: [
        {
          id: "sakura_tree",
          type: "TreeCanopy",
          role: "sakura_tree",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 7, height: 7, length: 7 },
          },
          options: {
            trunkHeight: 3,
            canopyStyle: "rounded",
          },
        },
        {
          id: "koi_pond",
          type: "OrganicPatch",
          role: "irregular_koi_pond",
          placement: {
            anchor: { x: 10, y: 0, z: 2 },
            size: { width: 7, height: 1, length: 5 },
          },
          options: {
            roughness: 1,
            includeBorder: false,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "sakura_tree__trunk",
      params: expect.objectContaining({
        from: [4, 0, 4],
        to: [4, 2, 4],
        block: "trim",
      }),
    }));
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "sakura_tree__canopy_1",
      params: expect.objectContaining({
        from: [1, 4, 1],
        to: [7, 4, 7],
        block: "roof",
      }),
    }));
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "koi_pond__fill_0",
      params: expect.objectContaining({
        from: [11, 0, 2],
        to: [15, 0, 2],
        block: "floor",
      }),
    }));
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "koi_pond__fill_2",
      params: expect.objectContaining({
        from: [10, 0, 4],
        to: [16, 0, 4],
      }),
    }));
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("expands PathRun and RockCluster components for garden composition", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Path And Rock Study",
      bounds: { width: 24, height: 8, length: 20 },
      palette: {
        floor: "minecraft:gravel",
        wall: "minecraft:stone",
      },
      components: [
        {
          id: "stepping_path",
          type: "PathRun",
          role: "meandering_stepping_stones",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 12, height: 1, length: 10 },
          },
          options: {
            style: "stepping_stones",
            stepSpacing: 3,
            waypoints: [
              { x: 0, z: 0 },
              { x: 6, z: 0 },
              { x: 6, z: 5 },
              { x: 11, z: 5 },
            ],
          },
        },
        {
          id: "rock_garden",
          type: "RockCluster",
          role: "dry_garden_rocks",
          placement: {
            anchor: { x: 14, y: 0, z: 2 },
            size: { width: 8, height: 5, length: 8 },
          },
          options: {
            count: 3,
            heightVariation: 2,
            roughness: 1,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "stepping_path__stone_0",
      params: expect.objectContaining({
        from: [1, 0, 1],
        to: [1, 0, 1],
        block: "floor",
      }),
    }));
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "stepping_path__stone_6",
      params: expect.objectContaining({
        from: [7, 0, 1],
        to: [7, 0, 1],
      }),
    }));
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "rock_garden__rock_0",
      params: expect.objectContaining({
        from: [14, 0, 2],
        to: [16, 1, 4],
        block: "wall",
      }),
    }));
    expect(craftDag.nodes).toContainEqual(expect.objectContaining({
      id: "rock_garden__rock_2",
      params: expect.objectContaining({
        from: [14, 0, 4],
        to: [16, 3, 6],
      }),
    }));
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects PathRun waypoints outside local bounds", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Path",
      bounds: { width: 12, height: 4, length: 12 },
      palette: {
        floor: "minecraft:gravel",
      },
      components: [
        {
          id: "bad_path",
          type: "PathRun",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 6, height: 1, length: 6 },
          },
          options: {
            waypoints: [
              { x: 0, z: 0 },
              { x: 7, z: 0 },
            ],
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "INVALID_PATH_RUN_WAYPOINT",
          componentId: "bad_path",
        }),
      ]);
    }
  });

  it("expands StairRun components for vertical circulation", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Stair Run Study",
      bounds: { width: 12, height: 8, length: 14 },
      palette: {
        floor: "minecraft:stone_bricks",
        trim: "minecraft:spruce_planks",
      },
      components: [
        {
          id: "main_stair",
          type: "StairRun",
          role: "main_deck_stair",
          placement: {
            anchor: { x: 2, y: 1, z: 3 },
            size: { width: 3, height: 4, length: 8 },
          },
          options: {
            axis: "z",
            direction: "positive",
            style: "solid",
            includeSideRails: true,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes.map((node) => node.id)).toEqual([
      "main_stair__step_0",
      "main_stair__step_1",
      "main_stair__step_2",
      "main_stair__step_3",
      "main_stair__left_rail",
      "main_stair__right_rail",
    ]);
    expect(craftDag.nodes[0]).toMatchObject({
      id: "main_stair__step_0",
      params: {
        from: [2, 1, 3],
        to: [4, 1, 4],
        block: "floor",
      },
    });
    expect(craftDag.nodes[3]).toMatchObject({
      id: "main_stair__step_3",
      params: {
        from: [2, 4, 9],
        to: [4, 4, 10],
      },
    });
    expect(craftDag.nodes[4]).toMatchObject({
      id: "main_stair__left_rail",
      params: {
        from: [2, 1, 3],
        to: [2, 4, 10],
        block: "trim",
      },
    });
    expect(craftDag.nodes[5]).toMatchObject({
      id: "main_stair__right_rail",
      params: {
        from: [4, 1, 3],
        to: [4, 4, 10],
      },
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects StairRun components that are too short for the requested height", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Stair",
      bounds: { width: 8, height: 8, length: 8 },
      palette: {
        floor: "minecraft:stone_bricks",
      },
      components: [
        {
          id: "too_short_stair",
          type: "StairRun",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 3, height: 5, length: 4 },
          },
          options: {
            axis: "z",
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "INVALID_STAIR_RUN_LENGTH",
          componentId: "too_short_stair",
        }),
      ]);
    }
  });

  it("spans the full StairRun length when run length is not divisible by height", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Uneven Stair Run",
      bounds: { width: 8, height: 8, length: 12 },
      palette: {
        floor: "minecraft:stone_bricks",
      },
      components: [
        {
          id: "uneven_stair",
          type: "StairRun",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 3, height: 4, length: 10 },
          },
          options: {
            axis: "z",
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes.map((node) => node.params)).toEqual([
      expect.objectContaining({ from: [1, 0, 1], to: [3, 0, 2] }),
      expect.objectContaining({ from: [1, 1, 3], to: [3, 1, 5] }),
      expect.objectContaining({ from: [1, 2, 6], to: [3, 2, 7] }),
      expect.objectContaining({ from: [1, 3, 8], to: [3, 3, 10] }),
    ]);
  });

  it("rejects railing runs that emit no physical parts", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Empty Railing",
      bounds: { width: 8, height: 4, length: 2 },
      palette: {
        trim: "minecraft:dark_oak_fence",
      },
      components: [
        {
          id: "empty_rail",
          type: "RailingRun",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 8, height: 3, length: 1 },
          },
          options: {
            includePosts: false,
            includeTopRail: false,
            includeMidRail: false,
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "EMPTY_RAILING_RUN",
          componentId: "empty_rail",
        }),
      ]);
    }
  });

  it("rejects mid rails on railing runs that are too short to emit them", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Short Mid Rail",
      bounds: { width: 8, height: 3, length: 2 },
      palette: {
        trim: "minecraft:dark_oak_fence",
      },
      components: [
        {
          id: "short_rail",
          type: "RailingRun",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 8, height: 2, length: 1 },
          },
          options: {
            includePosts: false,
            includeTopRail: false,
            includeMidRail: true,
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "INVALID_RAILING_MID_RAIL_HEIGHT",
          componentId: "short_rail",
        }),
      ]);
    }
  });

  it("requires floor or explicit material for Platform components", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Missing Platform Material",
      bounds: { width: 4, height: 2, length: 4 },
      palette: {
        trim: "minecraft:oak_log",
      },
      components: [
        {
          id: "deck",
          type: "Platform",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 4, height: 1, length: 4 },
          },
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
          code: "UNKNOWN_MATERIAL_REF",
          componentId: "deck",
        }),
      ]);
    }
  });

  it("expands FlatRoof as a low one-unit cover with implicit dependency", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Market Canopy",
      grid: { unitBlocks: 2 },
      bounds: { width: 9, height: 6, length: 7 },
      palette: {
        trim: "minecraft:oak_log",
        roof: "minecraft:red_wool",
      },
      components: [
        {
          id: "canopy_frame",
          type: "Beam",
          placement: {
            anchor: { x: 2, y: 3, z: 2 },
            size: { width: 5, height: 1, length: 3 },
          },
        },
        {
          id: "canopy_roof",
          type: "FlatRoof",
          placement: {
            over: "canopy_frame",
            overhang: 1,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes).toEqual([
      expect.objectContaining({
        id: "canopy_frame__beam",
        type: "SolidBox",
      }),
      expect.objectContaining({
        id: "canopy_roof__flat_roof",
        type: "SolidBox",
        inputs: [{ ref: "canopy_frame__beam" }],
        params: {
          from: [2, 8, 2],
          to: [15, 9, 11],
          block: "roof",
        },
      }),
    ]);
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("expands Repeat components into bounded repeated source clones", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Column Rhythm",
      grid: { unitBlocks: 2 },
      bounds: { width: 9, height: 4, length: 3 },
      palette: {
        trim: "minecraft:oak_log",
      },
      components: [
        {
          id: "column",
          type: "SupportPost",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 1, height: 4, length: 1 },
          },
        },
        {
          id: "column_run",
          type: "Repeat",
          placement: {
            source: "column",
            axis: "x",
            count: 4,
            step: 2,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes).toEqual([
      expect.objectContaining({
        id: "column__post",
        type: "SolidBox",
        params: {
          from: [2, 0, 2],
          to: [3, 7, 3],
          block: "trim",
        },
      }),
      expect.objectContaining({
        id: "column_run__column_1__post",
        type: "SolidBox",
        inputs: [{ ref: "column__post" }],
        params: {
          from: [6, 0, 2],
          to: [7, 7, 3],
          block: "trim",
        },
      }),
      expect.objectContaining({
        id: "column_run__column_2__post",
        type: "SolidBox",
        inputs: [{ ref: "column__post" }],
        params: {
          from: [10, 0, 2],
          to: [11, 7, 3],
          block: "trim",
        },
      }),
      expect.objectContaining({
        id: "column_run__column_3__post",
        type: "SolidBox",
        inputs: [{ ref: "column__post" }],
        params: {
          from: [14, 0, 2],
          to: [15, 7, 3],
          block: "trim",
        },
      }),
    ]);
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects FlatRoof covers that start outside height bounds", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Flat Roof Too High",
      bounds: { width: 4, height: 3, length: 4 },
      palette: {
        trim: "minecraft:oak_log",
        roof: "minecraft:spruce_planks",
      },
      components: [
        {
          id: "frame",
          type: "Beam",
          placement: {
            anchor: { x: 0, y: 2, z: 0 },
            size: { width: 4, height: 1, length: 4 },
          },
        },
        {
          id: "cap",
          type: "FlatRoof",
          placement: {
            over: "frame",
          },
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
          code: "COVER_OUT_OF_BOUNDS",
          componentId: "cap",
        }),
      ]);
    }
  });

  it("rejects ComponentPlan bounds that exceed the declared size tier", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Too Wide For Small",
      bounds: { width: 33, height: 8, length: 8 },
      palette: {
        foundation: "minecraft:cobblestone",
      },
      components: [
        {
          id: "base",
          type: "Foundation",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 33, height: 1, length: 8 },
          },
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
          code: "PLAN_BOUNDS_OVER_BUDGET",
        }),
      ]);
    }
  });

  it("allows larger bounds when a medium size tier is declared", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Medium Hall",
      policy: { sizeTier: "medium" },
      bounds: { width: 33, height: 8, length: 8 },
      palette: {
        foundation: "minecraft:cobblestone",
      },
      components: [
        {
          id: "base",
          type: "Foundation",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 33, height: 1, length: 8 },
          },
        },
      ],
    };

    expect(() => validateComponentPlan(plan)).not.toThrow();
  });

  it("rejects ComponentPlans with too many components for the size tier", () => {
    const components: ComponentPlanDocument["components"] = [];
    for (let index = 0; index < 65; index += 1) {
      components.push({
        id: `post_${index}`,
        type: "SupportPost",
        placement: {
          anchor: { x: index % 8, y: 0, z: Math.floor(index / 8) },
          size: { width: 1, height: 1, length: 1 },
        },
      });
    }

    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Too Many Posts",
      bounds: { width: 8, height: 2, length: 9 },
      palette: {
        trim: "minecraft:oak_log",
      },
      components,
    };

    expect(() => validateComponentPlan(invalid)).toThrow(ValidationError);

    try {
      validateComponentPlan(invalid);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "PLAN_COMPONENTS_OVER_BUDGET",
        }),
      ]);
    }
  });

  it("rejects ComponentPlans with estimated expanded blocks over budget", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Too Dense For Small",
      bounds: { width: 32, height: 32, length: 32 },
      palette: {
        foundation: "minecraft:cobblestone",
      },
      components: [
        {
          id: "lower_mass",
          type: "Foundation",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 32, height: 32, length: 32 },
          },
        },
        {
          id: "upper_mass",
          type: "Foundation",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 32, height: 32, length: 32 },
          },
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
          code: "PLAN_ESTIMATED_BLOCKS_OVER_BUDGET",
        }),
      ]);
    }
  });

  it("counts Corridor slab thickness when estimating scaled block budgets", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Scaled Corridor Budget",
      grid: { unitBlocks: 2 },
      policy: { sizeTier: "small" },
      bounds: { width: 32, height: 16, length: 32 },
      palette: {
        wall: "minecraft:stone_bricks",
        floor: "minecraft:smooth_stone",
      },
      components: [
        {
          id: "lower_corridor",
          type: "Corridor",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 32, height: 16, length: 32 },
          },
          options: {
            axis: "x",
          },
        },
        {
          id: "upper_corridor",
          type: "Corridor",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 32, height: 16, length: 32 },
          },
          options: {
            axis: "x",
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "PLAN_ESTIMATED_BLOCKS_OVER_BUDGET",
        }),
      ]);
    }
  });

  it("rejects Repeat clones that exceed ComponentPlan bounds", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Run Out Of Bounds",
      bounds: { width: 5, height: 4, length: 3 },
      palette: {
        trim: "minecraft:oak_log",
      },
      components: [
        {
          id: "column",
          type: "SupportPost",
          placement: {
            anchor: { x: 1, y: 0, z: 1 },
            size: { width: 1, height: 4, length: 1 },
          },
        },
        {
          id: "column_run",
          type: "Repeat",
          placement: {
            source: "column",
            axis: "x",
            count: 4,
            step: 2,
          },
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
          code: "COMPONENT_OUT_OF_BOUNDS",
          componentId: "column_run",
        }),
      ]);
    }
  });

  it("estimates RoomShell blocks as hollow volume and does not exceed budget", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Hollow Room shell Budget",
      policy: { sizeTier: "small" },
      bounds: { width: 32, height: 16, length: 32 },
      palette: {
        wall: "minecraft:oak_planks",
      },
      components: [
        {
          id: "hall",
          type: "RoomShell",
          placement: {
            anchor: { x: 2, y: 0, z: 2 },
            size: { width: 28, height: 8, length: 28 },
          },
          options: {
            includeFloor: false,
            includeCeiling: false,
          },
        },
      ],
    };

    expect(() => validateComponentPlan(plan)).not.toThrow();
  });

  it("passes down Repeat explicit inputs to all repeated clones", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Repeat Explicit Inputs",
      bounds: { width: 10, height: 5, length: 10 },
      palette: {
        trim: "minecraft:oak_log",
      },
      components: [
        {
          id: "base_beam",
          type: "Beam",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 10, height: 1, length: 1 },
          },
        },
        {
          id: "support",
          type: "SupportPost",
          placement: {
            anchor: { x: 0, y: 1, z: 0 },
            size: { width: 1, height: 4, length: 1 },
          },
        },
        {
          id: "support_run",
          type: "Repeat",
          inputs: [{ ref: "base_beam" }],
          placement: {
            source: "support",
            axis: "x",
            count: 3,
            step: 4,
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    const clone1 = craftDag.nodes.find((n) => n.id === "support_run__support_1__post");
    const clone2 = craftDag.nodes.find((n) => n.id === "support_run__support_2__post");

    expect(clone1).toBeDefined();
    expect(clone2).toBeDefined();

    expect(clone1!.inputs).toEqual(
      expect.arrayContaining([
        { ref: "base_beam__beam" },
        { ref: "support__post" },
      ])
    );
    expect(clone2!.inputs).toEqual(
      expect.arrayContaining([
        { ref: "base_beam__beam" },
        { ref: "support__post" },
      ])
    );
  });

  it("expands Assembly instances with stable namespaced node IDs", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Twin Tower Gate",
      policy: { sizeTier: "medium" },
      bounds: { width: 24, height: 14, length: 12 },
      palette: {
        foundation: "minecraft:stone_bricks",
        wall: "minecraft:stone_bricks",
        roof: "minecraft:dark_oak_planks",
        glass: "minecraft:glass_pane",
        trim: "minecraft:dark_oak_log",
      },
      assemblies: [
        {
          id: "tower_module",
          bounds: { width: 6, height: 10, length: 6 },
          components: [
            {
              id: "tower_body",
              type: "RoomShell",
              placement: {
                anchor: { x: 0, y: 0, z: 0 },
                size: { width: 6, height: 7, length: 6 },
              },
              options: {
                includeFloor: false,
                includeCeiling: false,
              },
            },
            {
              id: "front_window",
              type: "Window",
              placement: {
                target: "tower_body",
                wall: "front",
                offset: 2,
                y: 3,
                width: 2,
                height: 2,
              },
            },
            {
              id: "tower_cap",
              type: "FlatRoof",
              placement: {
                over: "tower_body",
              },
            },
          ],
        },
      ],
      components: [
        {
          id: "gate_base",
          type: "Foundation",
          placement: {
            anchor: { x: 0, y: 0, z: 0 },
            size: { width: 24, height: 1, length: 12 },
          },
        },
        {
          id: "left_tower",
          type: "Instance",
          inputs: [{ ref: "gate_base" }],
          placement: {
            assembly: "tower_module",
            anchor: { x: 1, y: 1, z: 3 },
          },
        },
        {
          id: "right_tower",
          type: "Instance",
          inputs: [{ ref: "gate_base" }],
          placement: {
            assembly: "tower_module",
            anchor: { x: 17, y: 1, z: 3 },
          },
        },
        {
          id: "bridge",
          type: "Beam",
          inputs: [{ ref: "gate_base" }],
          placement: {
            anchor: { x: 7, y: 6, z: 4 },
            size: { width: 10, height: 2, length: 4 },
          },
        },
      ],
    };

    const craftDag = expandComponentPlan(plan);

    expect(craftDag.nodes.map((node) => node.id)).toEqual([
      "gate_base__solid",
      "left_tower__tower_body__shell",
      "left_tower__front_window__opening",
      "left_tower__tower_cap__flat_roof",
      "right_tower__tower_body__shell",
      "right_tower__front_window__opening",
      "right_tower__tower_cap__flat_roof",
      "bridge__beam",
    ]);
    expect(craftDag.nodes.find((node) => node.id === "left_tower__tower_body__shell")).toMatchObject({
      inputs: [{ ref: "gate_base__solid" }],
      params: {
        from: [1, 1, 3],
        to: [6, 7, 8],
      },
    });
    expect(craftDag.nodes.find((node) => node.id === "left_tower__front_window__opening")).toMatchObject({
      inputs: expect.arrayContaining([
        { ref: "left_tower__tower_body__shell" },
        { ref: "gate_base__solid" },
      ]),
      params: {
        from: [3, 4, 3],
        to: [4, 5, 3],
      },
    });
    expect(() => compileComponentPlan(plan)).not.toThrow();
  });

  it("rejects Instance components that reference an unknown assembly", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Missing Assembly",
      bounds: { width: 8, height: 8, length: 8 },
      palette: {},
      components: [
        {
          id: "tower",
          type: "Instance",
          placement: {
            assembly: "missing",
            anchor: { x: 0, y: 0, z: 0 },
          },
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
          code: "UNKNOWN_ASSEMBLY_REF",
          componentId: "tower",
        }),
      ]);
    }
  });

  it("rejects Instance components that exceed global bounds", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Tower Out Of Bounds",
      bounds: { width: 8, height: 8, length: 8 },
      palette: {
        wall: "minecraft:stone_bricks",
      },
      assemblies: [
        {
          id: "tower_module",
          bounds: { width: 6, height: 6, length: 6 },
          components: [
            {
              id: "tower_body",
              type: "RoomShell",
              placement: {
                anchor: { x: 0, y: 0, z: 0 },
                size: { width: 6, height: 6, length: 6 },
              },
            },
          ],
        },
      ],
      components: [
        {
          id: "tower",
          type: "Instance",
          placement: {
            assembly: "tower_module",
            anchor: { x: 4, y: 0, z: 0 },
          },
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
          severity: "error",
          stage: "component-validation",
          code: "INSTANCE_OUT_OF_BOUNDS",
          componentId: "tower",
          instanceId: "tower",
          assemblyId: "tower_module",
        }),
      ]);
    }
  });

  it("validates assembly-local references before instances expand", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Assembly Ref",
      bounds: { width: 8, height: 8, length: 8 },
      palette: {
        glass: "minecraft:glass",
      },
      assemblies: [
        {
          id: "bad_module",
          bounds: { width: 4, height: 4, length: 4 },
          components: [
            {
              id: "bad_window",
              type: "Window",
              placement: {
                target: "missing_wall",
                wall: "front",
                offset: 0,
                y: 0,
              },
            },
          ],
        },
      ],
      components: [
        {
          id: "bad_instance",
          type: "Instance",
          placement: {
            assembly: "bad_module",
            anchor: { x: 0, y: 0, z: 0 },
          },
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
          componentId: "bad_window",
        }),
      ]);
    }
  });

  it("adds assembly context to duplicate component IDs inside root assemblies", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Duplicate Assembly Component",
      bounds: { width: 8, height: 8, length: 8 },
      palette: {
        wall: "minecraft:stone_bricks",
      },
      assemblies: [
        {
          id: "tower_module",
          bounds: { width: 4, height: 4, length: 4 },
          components: [
            {
              id: "wall",
              type: "RoomShell",
              placement: {
                anchor: { x: 0, y: 0, z: 0 },
                size: { width: 4, height: 4, length: 4 },
              },
            },
            {
              id: "wall",
              type: "RoomShell",
              placement: {
                anchor: { x: 0, y: 0, z: 0 },
                size: { width: 4, height: 4, length: 4 },
              },
            },
          ],
        },
      ],
      components: [
        {
          id: "tower",
          type: "Instance",
          placement: {
            assembly: "tower_module",
            anchor: { x: 0, y: 0, z: 0 },
          },
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "DUPLICATE_COMPONENT_ID",
          componentId: "wall",
          assemblyId: "tower_module",
        }),
      ]);
    }
  });

  it("adds section and assembly context to duplicate component IDs inside section assemblies", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Duplicate Section Assembly Component",
      bounds: { width: 8, height: 8, length: 8 },
      palette: {
        wall: "minecraft:stone_bricks",
      },
      sections: [
        {
          id: "midship",
          origin: { x: 0, y: 0, z: 0 },
          bounds: { width: 8, height: 8, length: 8 },
          assemblies: [
            {
              id: "cabin_module",
              bounds: { width: 4, height: 4, length: 4 },
              components: [
                {
                  id: "wall",
                  type: "RoomShell",
                  placement: {
                    anchor: { x: 0, y: 0, z: 0 },
                    size: { width: 4, height: 4, length: 4 },
                  },
                },
                {
                  id: "wall",
                  type: "RoomShell",
                  placement: {
                    anchor: { x: 0, y: 0, z: 0 },
                    size: { width: 4, height: 4, length: 4 },
                  },
                },
              ],
            },
          ],
          components: [],
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(diagnosticsFromError(error)).toEqual([
        expect.objectContaining({
          stage: "component-validation",
          code: "DUPLICATE_COMPONENT_ID",
          componentId: "wall",
          sectionId: "midship",
          assemblyId: "cabin_module",
        }),
      ]);
    }
  });

  it("expands sectioned ComponentPlans with section-local coordinates and namespaced node IDs", () => {
    const sectioned: ComponentPlanDocument = {
      version: "0.1",
      name: "Sectioned Wall",
      policy: { sizeTier: "large" },
      bounds: { width: 24, height: 8, length: 12 },
      palette: {
        foundation: "minecraft:stone_bricks",
        wall: "minecraft:oak_planks",
        floor: "minecraft:smooth_stone",
        trim: "minecraft:spruce_log",
      },
      assemblies: [
        {
          id: "pillar_module",
          bounds: { width: 2, height: 5, length: 2 },
          components: [
            {
              id: "pillar",
              type: "SupportPost",
              placement: {
                anchor: { x: 0, y: 0, z: 0 },
                size: { width: 2, height: 5, length: 2 },
              },
            },
          ],
        },
      ],
      sections: [
        {
          id: "west",
          origin: { x: 0, y: 0, z: 0 },
          bounds: { width: 12, height: 8, length: 12 },
          components: [
            {
              id: "base",
              type: "Foundation",
              placement: {
                anchor: { x: 0, y: 0, z: 0 },
                size: { width: 12, height: 1, length: 4 },
              },
            },
            {
              id: "wall",
              type: "Beam",
              inputs: [{ ref: "base" }],
              placement: {
                anchor: { x: 0, y: 1, z: 1 },
                size: { width: 12, height: 3, length: 2 },
              },
            },
            {
              id: "pillar_a",
              type: "Instance",
              inputs: [{ ref: "base" }],
              placement: {
                assembly: "pillar_module",
                anchor: { x: 0, y: 1, z: 1 },
              },
            },
          ],
        },
        {
          id: "east",
          origin: { x: 12, y: 0, z: 0 },
          bounds: { width: 12, height: 8, length: 12 },
          components: [
            {
              id: "base",
              type: "Foundation",
              placement: {
                anchor: { x: 0, y: 0, z: 0 },
                size: { width: 12, height: 1, length: 4 },
              },
            },
            {
              id: "wall",
              type: "Beam",
              inputs: [{ ref: "base" }],
              placement: {
                anchor: { x: 0, y: 1, z: 1 },
                size: { width: 12, height: 3, length: 2 },
              },
            },
            {
              id: "pillar_b",
              type: "Instance",
              inputs: [{ ref: "base" }],
              placement: {
                assembly: "pillar_module",
                anchor: { x: 10, y: 1, z: 1 },
              },
            },
          ],
        },
      ],
    };

    const craftDag = expandComponentPlan(sectioned);
    const voxelPlan = compileComponentPlan(sectioned);
    const westBase = craftDag.nodes.find((node) => node.id === "west__base__solid");
    const eastBase = craftDag.nodes.find((node) => node.id === "east__base__solid");
    const eastPillar = craftDag.nodes.find((node) => node.id === "east__pillar_b__pillar__post");

    expect(craftDag.size).toEqual([24, 8, 12]);
    expect(westBase).toMatchObject({
      type: "SolidBox",
      params: { from: [0, 0, 0], to: [11, 0, 3] },
    });
    expect(eastBase).toMatchObject({
      type: "SolidBox",
      params: { from: [12, 0, 0], to: [23, 0, 3] },
    });
    expect(eastPillar).toMatchObject({
      type: "SolidBox",
      params: { from: [22, 1, 1], to: [23, 5, 2] },
    });
    expect(voxelPlan.blocks.length).toBeGreaterThan(0);
  });

  it("rejects sections that exceed global ComponentPlan bounds", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Section Bounds",
      policy: { sizeTier: "large" },
      bounds: { width: 16, height: 8, length: 16 },
      palette: {
        foundation: "minecraft:stone_bricks",
      },
      sections: [
        {
          id: "overflow",
          origin: { x: 12, y: 0, z: 0 },
          bounds: { width: 8, height: 8, length: 8 },
          components: [
            {
              id: "base",
              type: "Foundation",
              placement: {
                anchor: { x: 0, y: 0, z: 0 },
                size: { width: 8, height: 1, length: 8 },
              },
            },
          ],
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
          severity: "error",
          stage: "component-validation",
          code: "SECTION_OUT_OF_BOUNDS",
          componentId: "overflow",
          sectionId: "overflow",
        }),
      ]);
    }
  });

  it("adds section context to diagnostics for section-local component failures", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Bad Section Ref",
      policy: { sizeTier: "large" },
      bounds: { width: 16, height: 8, length: 16 },
      palette: {
        foundation: "minecraft:stone_bricks",
        wall: "minecraft:stone_bricks",
      },
      sections: [
        {
          id: "midship",
          origin: { x: 0, y: 0, z: 0 },
          bounds: { width: 16, height: 8, length: 16 },
          components: [
            {
              id: "bad_wall",
              type: "Beam",
              inputs: [{ ref: "missing_base" }],
              placement: {
                anchor: { x: 0, y: 1, z: 0 },
                size: { width: 8, height: 2, length: 1 },
              },
            },
          ],
        },
      ],
    };

    try {
      validateComponentPlan(invalid);
      throw new Error("Expected validation to fail");
    } catch (error) {
      const diagnostics = diagnosticsFromError(error);
      expect(diagnostics).toEqual([
        expect.objectContaining({
          severity: "error",
          stage: "component-validation",
          code: "UNKNOWN_COMPONENT_REF",
          componentId: "bad_wall",
          sectionId: "midship",
          repairHint: expect.stringContaining("missing_base"),
        }),
      ]);
    }
  });

  it("counts repeated assembly clones in Instance component budgets", () => {
    const invalid: ComponentPlanDocument = {
      version: "0.1",
      name: "Repeated Assembly Budget",
      bounds: { width: 32, height: 4, length: 3 },
      palette: {
        trim: "minecraft:oak_log",
      },
      assemblies: [
        {
          id: "post_run_module",
          bounds: { width: 32, height: 4, length: 3 },
          components: [
            {
              id: "post",
              type: "SupportPost",
              placement: {
                anchor: { x: 0, y: 0, z: 1 },
                size: { width: 1, height: 4, length: 1 },
              },
            },
            {
              id: "post_run",
              type: "Repeat",
              placement: {
                source: "post",
                axis: "x",
                count: 32,
                step: 1,
              },
            },
          ],
        },
      ],
      components: [
        {
          id: "run_a",
          type: "Instance",
          placement: {
            assembly: "post_run_module",
            anchor: { x: 0, y: 0, z: 0 },
          },
        },
        {
          id: "run_b",
          type: "Instance",
          placement: {
            assembly: "post_run_module",
            anchor: { x: 0, y: 0, z: 0 },
          },
        },
        {
          id: "run_c",
          type: "Instance",
          placement: {
            assembly: "post_run_module",
            anchor: { x: 0, y: 0, z: 0 },
          },
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
          code: "PLAN_COMPONENTS_OVER_BUDGET",
        }),
      ]);
    }
  });
});
