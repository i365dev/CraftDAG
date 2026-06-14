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
    "large-castle.componentplan.json",
    "long-fortified-bridge.componentplan.json",
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

      expect(validated.assemblies?.length).toBeGreaterThan(0);
      expect(craftDag.nodes.length).toBeGreaterThan(validated.components.length);
      expect(voxelPlan.blocks.length).toBeGreaterThan(0);
      expect(materials.length).toBeGreaterThan(0);
      expect(layers.length).toBeGreaterThan(0);
      expect(craftDag.nodes.some((node) => node.id.includes("__") && node.id.split("__").length >= 3)).toBe(true);
    });
  }
});
