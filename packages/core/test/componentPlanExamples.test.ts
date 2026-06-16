import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  compileComponentPlan,
  ComponentPlanDocument,
  expandComponentPlan,
  generateLayerGuide,
  generateMaterialList,
  validateComponentPlan,
} from "../src/index.js";

describe("ComponentPlan large examples", () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const examplesDir = path.resolve(dirname, "../../../examples/component-plans");
  const examples = [
    "arcade-bracket-study.componentplan.json",
    "fortified-wall-shape.componentplan.json",
    "large-form-massing.componentplan.json",
    "landscape-canopy-patch.componentplan.json",
    "large-castle.componentplan.json",
    "large-ship-interior.componentplan.json",
    "long-fortified-bridge.componentplan.json",
    "path-rock-garden.componentplan.json",
    "sectioned-wall.componentplan.json",
    "ship-bow-shape.componentplan.json",
    "stair-run-multilevel.componentplan.json",
  ];

  for (const example of examples) {
    it(`${example} validates, expands, compiles, and produces metadata`, () => {
      const filePath = path.join(examplesDir, example);
      expect(fs.existsSync(filePath)).toBe(true);

      const doc = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ComponentPlanDocument;
      const validated = validateComponentPlan(doc);
      const craftDag = expandComponentPlan(validated);
      const voxelPlan = compileComponentPlan(validated);
      const materials = generateMaterialList(voxelPlan);
      const layers = generateLayerGuide(voxelPlan);
      const rootComponentCount = validated.components?.length ?? 0;
      const sectionComponentCount = validated.sections?.reduce((total, section) => total + section.components.length, 0) ?? 0;
      const rootAssemblyCount = validated.assemblies?.length ?? 0;
      const sectionAssemblyCount = validated.sections?.reduce((total, section) => total + (section.assemblies?.length ?? 0), 0) ?? 0;
      const shapeComponentCount = [
        ...(validated.components ?? []),
        ...(validated.sections?.flatMap((section) => section.components) ?? []),
      ].filter((component) => (
        component.type === "TaperedVolume" ||
        component.type === "SteppedTier" ||
        component.type === "VerticalSetbackVolume" ||
        component.type === "RailingRun" ||
        component.type === "ArcadeRun" ||
        component.type === "SupportBracket" ||
        component.type === "TreeCanopy" ||
        component.type === "OrganicPatch" ||
        component.type === "PathRun" ||
        component.type === "RockCluster" ||
        component.type === "StairRun"
      )).length;

      expect(rootAssemblyCount + sectionAssemblyCount + shapeComponentCount).toBeGreaterThan(0);
      expect(craftDag.nodes.length).toBeGreaterThanOrEqual(rootComponentCount + sectionComponentCount);
      if (example === "large-ship-interior.componentplan.json") {
        expect(craftDag.nodes.filter((node) => node.id.includes("corridor")).length).toBeGreaterThan(4);
      }
      expect(voxelPlan.blocks.length).toBeGreaterThan(0);
      expect(materials.length).toBeGreaterThan(0);
      expect(layers.length).toBeGreaterThan(0);
      if (rootAssemblyCount + sectionAssemblyCount > 0) {
        expect(craftDag.nodes.some((node) => node.id.includes("__") && node.id.split("__").length >= 3)).toBe(true);
      }
      if (shapeComponentCount > 0) {
        expect(craftDag.nodes.some((node) => (
          node.id.includes("__slice_") ||
          node.id.includes("__tier_") ||
          node.id.includes("__setback_") ||
          node.id.includes("__post_") ||
          node.id.includes("__pier_") ||
          node.id.includes("__bracket_") ||
          node.id.includes("__canopy_") ||
          node.id.includes("__fill_") ||
          node.id.includes("__path_") ||
          node.id.includes("__stone_") ||
          node.id.includes("__rock_") ||
          node.id.includes("__step_")
        ))).toBe(true);
      }
    });
  }
});
