import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { compileDocument, generateMaterialList, generateLayerGuide } from "../src/index.js";

describe("Examples integration tests", () => {
  const examplesDir = path.resolve(__dirname, "../../../examples");
  const examples = ["starter-house.craftdag", "watchtower.craftdag", "small-bridge.craftdag"];

  for (const example of examples) {
    it(`${example} validates, compiles, has materials and layers`, () => {
      const filePath = path.join(examplesDir, `${example}.json`);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, "utf-8");
      const doc = JSON.parse(content);

      // Verify compile
      const plan = compileDocument(doc);
      expect(plan.blocks.length).toBeGreaterThan(0);

      // Verify materials
      const materials = generateMaterialList(plan);
      expect(materials.length).toBeGreaterThan(0);

      // Verify layers
      const layers = generateLayerGuide(plan);
      expect(layers.length).toBeGreaterThan(0);
    });
  }
});
