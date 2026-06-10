import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("CLI Integration", () => {
  const cliPath = path.resolve(__dirname, "../dist/index.js");
  const tempJsonPath = path.resolve(__dirname, "temp-test.json");

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

  beforeAll(() => {
    fs.writeFileSync(tempJsonPath, JSON.stringify(validDoc, null, 2), "utf-8");
  });

  afterAll(() => {
    if (fs.existsSync(tempJsonPath)) {
      fs.unlinkSync(tempJsonPath);
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
});
