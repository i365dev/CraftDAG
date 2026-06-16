import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("CLI Integration", () => {
  const cliPath = path.resolve(__dirname, "../dist/index.js");
  const tempJsonPath = path.resolve(__dirname, "temp-test.json");
  const tempComponentJsonPath = path.resolve(__dirname, "temp-component-test.json");
  const tempExpandedPath = path.resolve(__dirname, "temp-component-expanded.json");
  const tempVoxelPath = path.resolve(__dirname, "temp-component.voxel.json");
  const tempSchemPath = path.resolve(__dirname, "temp-test.schem");
  const tempComponentSchemPath = path.resolve(__dirname, "temp-component-test.schem");

  const validDoc = {
    version: "0.1",
    name: "CLI Test House",
    size: [5, 5, 5],
    nodes: [
      {
        id: "box",
        type: "SolidBox",
        params: {
          from: [0, 0, 0],
          to: [1, 1, 1],
          block: "minecraft:stone",
        },
      },
    ],
  };

  const validComponentPlan = {
    version: "0.1",
    name: "CLI Component Test House",
    bounds: { width: 8, height: 8, length: 8 },
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
          size: { width: 5, height: 1, length: 5 },
        },
      },
      {
        id: "room",
        type: "RoomShell",
        inputs: [{ ref: "foundation" }],
        placement: {
          anchor: { x: 0, y: 1, z: 0 },
          size: { width: 5, height: 3, length: 5 },
        },
        options: {
          includeFloor: false,
          includeCeiling: false,
        },
      },
    ],
  };

  beforeAll(() => {
    fs.writeFileSync(tempJsonPath, JSON.stringify(validDoc, null, 2), "utf-8");
    fs.writeFileSync(tempComponentJsonPath, JSON.stringify(validComponentPlan, null, 2), "utf-8");
  });

  afterAll(() => {
    if (fs.existsSync(tempJsonPath)) {
      fs.unlinkSync(tempJsonPath);
    }
    if (fs.existsSync(tempSchemPath)) {
      fs.unlinkSync(tempSchemPath);
    }
    for (const filePath of [tempComponentJsonPath, tempExpandedPath, tempVoxelPath, tempComponentSchemPath]) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  });

  it("should validate a correct JSON file successfully", () => {
    const output = execSync(`node ${cliPath} validate ${tempJsonPath}`).toString();
    expect(output).toContain("✓ Document is valid!");
  });

  it("should compile a correct JSON file and output voxel plan to stdout", () => {
    const output = execSync(`node ${cliPath} compile ${tempJsonPath}`).toString();
    const plan = JSON.parse(output);
    expect(plan.version).toBe("0.1");
    expect(plan.name).toBe("CLI Test House");
    expect(plan.blocks.length).toBe(8); // 2x2x2 = 8
  });

  it("should list materials in formatted structure", () => {
    const output = execSync(`node ${cliPath} materials ${tempJsonPath}`).toString();
    expect(output).toContain("Material List for \"CLI Test House\":");
    expect(output).toContain("minecraft:stone");
    expect(output).toContain("8");
  });

  it("should print layer guide", () => {
    const output = execSync(`node ${cliPath} layers ${tempJsonPath}`).toString();
    expect(output).toContain("Layer-by-Layer Guide for \"CLI Test House\":");
    expect(output).toContain("Layer Y = 0");
    expect(output).toContain("Layer Y = 1");
  });

  it("should export to Sponge schematic using options", () => {
    const output = execSync(`node ${cliPath} export ${tempJsonPath} --format schem --out ${tempSchemPath}`).toString();
    expect(output).toContain("✓ Sponge schematic exported successfully to");
    expect(fs.existsSync(tempSchemPath)).toBe(true);
    expect(fs.statSync(tempSchemPath).size).toBeGreaterThan(0);
  });

  it("should support custom --data-version option in export", () => {
    const output = execSync(`node ${cliPath} export ${tempJsonPath} --format schem --out ${tempSchemPath} --data-version 3578`).toString();
    expect(output).toContain("✓ Sponge schematic exported successfully to");
    expect(fs.existsSync(tempSchemPath)).toBe(true);
  });

  it("should validate ComponentPlan JSON with machine-readable output", () => {
    const output = execSync(`node ${cliPath} component validate ${tempComponentJsonPath} --json`).toString();
    const result = JSON.parse(output);
    expect(result).toEqual({ ok: true, diagnostics: [] });
  });

  it("should expand and compile ComponentPlan JSON with --out", () => {
    execSync(`node ${cliPath} component expand ${tempComponentJsonPath} --out ${tempExpandedPath}`);
    execSync(`node ${cliPath} component compile ${tempComponentJsonPath} --out ${tempVoxelPath}`);

    const expanded = JSON.parse(fs.readFileSync(tempExpandedPath, "utf-8"));
    const voxel = JSON.parse(fs.readFileSync(tempVoxelPath, "utf-8"));

    expect(expanded.nodes.map((node: { id: string }) => node.id)).toContain("foundation__solid");
    expect(voxel.name).toBe("CLI Component Test House");
    expect(voxel.blocks.length).toBeGreaterThan(0);
  });

  it("should emit ComponentPlan materials, layers, and support as JSON", () => {
    const materials = JSON.parse(execSync(`node ${cliPath} component materials ${tempComponentJsonPath} --json`).toString());
    const layers = JSON.parse(execSync(`node ${cliPath} component layers ${tempComponentJsonPath} --json`).toString());
    const support = JSON.parse(execSync(`node ${cliPath} component support ${tempComponentJsonPath} --json`).toString());

    expect(materials.ok).toBe(true);
    expect(materials.materials.length).toBeGreaterThan(0);
    expect(layers.ok).toBe(true);
    expect(layers.layers.length).toBeGreaterThan(0);
    expect(support.ok).toBe(true);
    expect(support.totalBlocks).toBeGreaterThan(0);
    expect(Array.isArray(support.diagnostics)).toBe(true);
  });

  it("should export ComponentPlan JSON to Sponge schematic", () => {
    const output = execSync(`node ${cliPath} component export ${tempComponentJsonPath} --format schem --out ${tempComponentSchemPath}`).toString();
    expect(output).toContain("✓ Sponge schematic exported successfully to");
    expect(fs.existsSync(tempComponentSchemPath)).toBe(true);
    expect(fs.statSync(tempComponentSchemPath).size).toBeGreaterThan(0);
  });
});
