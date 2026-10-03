import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileStaticModule, type StaticModuleDefinition } from "../src/redstone/moduleKernel.js";

interface ExpectedTopology {
  bounds: [number, number, number];
  blocks: Array<{ role: string; pos: [number, number, number]; block: string; properties: Record<string, string> }>;
}

interface RegressionFixture extends StaticModuleDefinition {
  expected: Record<string, ExpectedTopology>;
  provenance: { verifiedProof: string; pullRequest: number; mergedCommit?: string };
}

function fixture(name: string): RegressionFixture {
  return JSON.parse(readFileSync(new URL(`./fixtures/redstone/${name}.json`, import.meta.url), "utf8")) as RegressionFixture;
}

function topology(plan: ReturnType<typeof compileStaticModule>): ExpectedTopology {
  return {
    bounds: plan.size,
    blocks: plan.blocks.map(({ sourceNodeId, pos, block }) => ({
      role: sourceNodeId!,
      pos,
      block: block.name,
      properties: block.properties ?? {},
    })),
  };
}

const cases = [
  ["ItemSorterSlice", "item-sorter-slice"],
  ["quasi-connected PistonDoor", "quasi-connected-piston-door"],
] as const;

describe.each(cases)("static module kernel: %s", (_label, file) => {
  const sample = fixture(file);
  const definition: StaticModuleDefinition = {
    identity: sample.identity,
    canonicalFacing: sample.canonicalFacing,
    bounds: sample.bounds,
    blocks: sample.blocks,
  };

  it("matches canonical authored topology and all four static verified outputs", () => {
    expect(sample.provenance.verifiedProof).toMatch(/^https:\/\/github\.com\/i365dev\/MinePilot\/pull\/(134|136)$/);
    expect(topology(compileStaticModule(definition, definition.canonicalFacing))).toEqual(sample.expected[definition.canonicalFacing]);
    for (const facing of ["north", "east", "south", "west"] as const) {
      expect(topology(compileStaticModule(definition, facing))).toEqual(sample.expected[facing]);
    }
  });

  it("produces ordinary VoxelPlans deterministically on repeated compilation", () => {
    for (const facing of ["north", "east", "south", "west"] as const) {
      const first = compileStaticModule(definition, facing);
      const second = compileStaticModule(definition, facing);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(first.blocks.every((block) => Boolean(block.sourceNodeId))).toBe(true);
    }
  });

  it("fails closed for invalid facings, malformed topology, and unsupported directional states", () => {
    expect(() => compileStaticModule(definition, "up" as never)).toThrow(/unsupported horizontal facing/);

    const duplicateCoordinate = structuredClone(definition);
    duplicateCoordinate.blocks[1].pos = [...duplicateCoordinate.blocks[0].pos];
    expect(() => compileStaticModule(duplicateCoordinate, definition.canonicalFacing)).toThrow(/occupied-coordinate collision/);

    const outOfBounds = structuredClone(definition);
    outOfBounds.blocks[0].pos = [outOfBounds.bounds[0], 0, 0];
    expect(() => compileStaticModule(outOfBounds, definition.canonicalFacing)).toThrow(/outside module bounds/);

    const duplicateRole = structuredClone(definition);
    duplicateRole.blocks[1].role = duplicateRole.blocks[0].role;
    expect(() => compileStaticModule(duplicateRole, definition.canonicalFacing)).toThrow(/duplicate block role/);

    const unsupportedFacing = structuredClone(definition);
    const facingBlock = unsupportedFacing.blocks.find((entry) => entry.properties.facing);
    expect(facingBlock).toBeDefined();
    facingBlock!.properties.facing = "diagonal";
    expect(() => compileStaticModule(unsupportedFacing, definition.canonicalFacing)).toThrow(/unsupported horizontal facing/);

    const unsupportedState = structuredClone(definition);
    unsupportedState.blocks[0].properties.axis = "x";
    const otherFacing = definition.canonicalFacing === "north" ? "east" : "north";
    expect(() => compileStaticModule(unsupportedState, otherFacing)).toThrow(/unsupported directional block-state property: axis/);
  });
});
