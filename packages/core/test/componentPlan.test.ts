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
    expect(validated.components.length).toBe(5);
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
});
