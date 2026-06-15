import { describe, expect, it } from "vitest";
import {
  analyzeComponentPlanSupport,
  analyzeVoxelSupport,
  ComponentPlanDocument,
  validateComponentPlan,
  ValidationError,
} from "../src/index.js";

describe("support analysis", () => {
  const basePlan = (components: ComponentPlanDocument["components"]): ComponentPlanDocument => ({
    version: "0.1",
    name: "Support Analysis Plan",
    bounds: { width: 12, height: 12, length: 12 },
    palette: {
      foundation: "minecraft:stone",
      wall: "minecraft:stone",
      floor: "minecraft:oak_planks",
      roof: "minecraft:stone",
      glass: "minecraft:glass",
      door: "minecraft:oak_door",
      trim: "minecraft:oak_log",
    },
    components,
  });

  it("accepts optional structural intent metadata on ComponentPlan nodes", () => {
    const plan = basePlan([
      {
        id: "base",
        type: "Foundation",
        placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 4, height: 1, length: 4 } },
        structural: { supportPolicy: "must_connect_to_ground", maxCantilever: 0 },
      },
      {
        id: "floating_lantern",
        type: "SupportPost",
        placement: { anchor: { x: 8, y: 5, z: 8 }, size: { width: 1, height: 2, length: 1 } },
        structural: { supportPolicy: "decorative", supportRoots: ["base"] },
      },
    ]);

    expect(() => validateComponentPlan(plan)).not.toThrow();
  });

  it("reports disconnected unannotated components", () => {
    const plan = basePlan([
      {
        id: "base",
        type: "Foundation",
        placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 4, height: 1, length: 4 } },
      },
      {
        id: "floating_platform",
        type: "Platform",
        placement: { anchor: { x: 8, y: 5, z: 8 }, size: { width: 3, height: 1, length: 3 } },
      },
    ]);

    const result = analyzeComponentPlanSupport(plan);

    expect(result.disconnectedBlocks).toBe(9);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "DISCONNECTED_COMPONENT",
        sourceNodeId: "floating_platform__platform",
        componentId: "floating_platform",
        supportPolicy: "must_connect_to_input",
      }),
    ]);
  });

  it("validates input before collecting structural entries", () => {
    expect(() => analyzeComponentPlanSupport(undefined)).toThrow(ValidationError);
  });

  it("allows intentional floating components by structural intent", () => {
    const plan = basePlan([
      {
        id: "base",
        type: "Foundation",
        placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 4, height: 1, length: 4 } },
      },
      {
        id: "floating_banner",
        type: "Platform",
        placement: { anchor: { x: 8, y: 5, z: 8 }, size: { width: 3, height: 1, length: 3 } },
        structural: { supportPolicy: "may_float" },
      },
    ]);

    const result = analyzeComponentPlanSupport(plan);
    const withAllowed = analyzeComponentPlanSupport(plan, { includeAllowed: true });

    expect(result.disconnectedBlocks).toBe(9);
    expect(result.diagnostics).toEqual([]);
    expect(withAllowed.diagnostics).toEqual([
      expect.objectContaining({
        code: "ALLOWED_DISCONNECTED_COMPONENT",
        sourceNodeId: "floating_banner__platform",
        supportPolicy: "may_float",
      }),
    ]);
  });

  it("inherits instance structural policy for assembly children", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Floating Assembly",
      bounds: { width: 12, height: 12, length: 12 },
      palette: {
        foundation: "minecraft:stone",
        wall: "minecraft:stone",
        floor: "minecraft:oak_planks",
        roof: "minecraft:stone",
        glass: "minecraft:glass",
        door: "minecraft:oak_door",
        trim: "minecraft:oak_log",
      },
      assemblies: [{
        id: "lantern_module",
        bounds: { width: 3, height: 3, length: 3 },
        components: [{
          id: "body",
          type: "Platform",
          placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 3, height: 1, length: 3 } },
        }],
      }],
      components: [
        {
          id: "base",
          type: "Foundation",
          placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 4, height: 1, length: 4 } },
        },
        {
          id: "floating_lantern",
          type: "Instance",
          placement: { assembly: "lantern_module", anchor: { x: 8, y: 5, z: 8 } },
          structural: { supportPolicy: "decorative" },
        },
      ],
    };

    const result = analyzeComponentPlanSupport(plan);
    const withAllowed = analyzeComponentPlanSupport(plan, { includeAllowed: true });

    expect(result.disconnectedBlocks).toBe(9);
    expect(result.diagnostics).toEqual([]);
    expect(withAllowed.diagnostics).toContainEqual(expect.objectContaining({
      code: "ALLOWED_DISCONNECTED_COMPONENT",
      sourceNodeId: "floating_lantern__body__platform",
      supportPolicy: "decorative",
    }));
  });

  it("merges instance structural metadata with assembly child intent", () => {
    const plan: ComponentPlanDocument = {
      version: "0.1",
      name: "Merged Structural Metadata",
      bounds: { width: 12, height: 12, length: 12 },
      palette: {
        foundation: "minecraft:stone",
        wall: "minecraft:stone",
        floor: "minecraft:oak_planks",
        roof: "minecraft:stone",
        glass: "minecraft:glass",
        door: "minecraft:oak_door",
        trim: "minecraft:oak_log",
      },
      assemblies: [{
        id: "floating_module",
        bounds: { width: 3, height: 3, length: 3 },
        components: [{
          id: "body",
          type: "Platform",
          placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 3, height: 1, length: 3 } },
          structural: { supportPolicy: "may_float" },
        }],
      }],
      components: [
        {
          id: "base",
          type: "Foundation",
          placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 4, height: 1, length: 4 } },
        },
        {
          id: "floating_instance",
          type: "Instance",
          placement: { assembly: "floating_module", anchor: { x: 8, y: 5, z: 8 } },
          structural: { supportRoots: ["base"], maxCantilever: 3 },
        },
      ],
    };

    const result = analyzeComponentPlanSupport(plan, { includeAllowed: true });

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "ALLOWED_DISCONNECTED_COMPONENT",
      sourceNodeId: "floating_instance__body__platform",
      supportPolicy: "may_float",
      supportRoots: ["base"],
      maxCantilever: 3,
    }));
  });

  it("distinguishes connected side-supported spans from disconnected components", () => {
    const plan = basePlan([
      {
        id: "left_pier",
        type: "Foundation",
        placement: { anchor: { x: 1, y: 0, z: 1 }, size: { width: 2, height: 4, length: 2 } },
      },
      {
        id: "right_pier",
        type: "Foundation",
        placement: { anchor: { x: 7, y: 0, z: 1 }, size: { width: 2, height: 4, length: 2 } },
      },
      {
        id: "bridge_span",
        type: "Platform",
        inputs: [{ ref: "left_pier" }, { ref: "right_pier" }],
        placement: { anchor: { x: 1, y: 4, z: 1 }, size: { width: 8, height: 1, length: 2 } },
      },
    ]);

    const result = analyzeComponentPlanSupport(plan);

    expect(result.disconnectedBlocks).toBe(0);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "NOT_VERTICALLY_SUPPORTED_BUT_CONNECTED",
      sourceNodeId: "bridge_span__platform",
    }));
  });

  it("treats blocks at or below groundY as connected roots", () => {
    const result = analyzeVoxelSupport({
      version: "0.1",
      name: "Subsurface Plan",
      size: [4, 4, 4],
      origin: [0, 0, 0],
      blocks: [{
        pos: [1, -1, 1],
        block: { name: "minecraft:stone" },
        sourceNodeId: "basement",
      }],
    }, { groundY: 0 });

    expect(result.disconnectedBlocks).toBe(0);
    expect(result.diagnostics).toEqual([]);
  });

  it("filters decorative railing diagnostics by default", () => {
    const plan = basePlan([
      {
        id: "base",
        type: "Foundation",
        placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 8, height: 1, length: 8 } },
      },
      {
        id: "deck",
        type: "Platform",
        inputs: [{ ref: "base" }],
        placement: { anchor: { x: 0, y: 1, z: 0 }, size: { width: 8, height: 1, length: 8 } },
      },
      {
        id: "rail",
        type: "RailingRun",
        inputs: [{ ref: "deck" }],
        placement: { anchor: { x: 0, y: 2, z: 0 }, size: { width: 8, height: 3, length: 1 } },
        options: { axis: "x", includeMidRail: true },
      },
    ]);

    const result = analyzeComponentPlanSupport(plan);
    const withAllowed = analyzeComponentPlanSupport(plan, { includeAllowed: true });

    expect(result.diagnostics.some((diagnostic) => diagnostic.sourceNodeId?.startsWith("rail__"))).toBe(false);
    expect(withAllowed.diagnostics.some((diagnostic) => diagnostic.code === "ALLOWED_NOT_VERTICALLY_SUPPORTED_BUT_CONNECTED")).toBe(true);
  });
});
