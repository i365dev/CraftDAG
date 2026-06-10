import { describe, it, expect } from "vitest";
import { sortNodes, GraphError, CraftDagDocument } from "../src/index.js";

describe("Graph Validation & Ordering", () => {
  const baseDoc: Omit<CraftDagDocument, "nodes"> = {
    version: "0.1",
    name: "Test Document",
    size: [10, 10, 10],
  };

  it("should sort independent nodes in order of array (since no dependencies)", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        { id: "A", type: "SolidBox", params: { from: [0, 0, 0], to: [1, 0, 1], block: "stone" } },
        { id: "B", type: "SolidBox", params: { from: [0, 0, 0], to: [1, 0, 1], block: "stone" } },
      ],
    };
    const sorted = sortNodes(doc);
    expect(sorted.map(n => n.id)).toEqual(["A", "B"]);
  });

  it("should order nodes by dependency when listed out-of-order in the array", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        { id: "B", type: "SolidBox", inputs: [{ ref: "A" }], params: { from: [0, 1, 0], to: [1, 1, 1], block: "wood" } },
        { id: "A", type: "SolidBox", params: { from: [0, 0, 0], to: [1, 0, 1], block: "stone" } },
      ],
    };
    const sorted = sortNodes(doc);
    expect(sorted.map(n => n.id)).toEqual(["A", "B"]);
  });

  it("should handle a chain of multiple dependencies", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        { id: "C", type: "SolidBox", inputs: [{ ref: "B" }], params: { from: [0, 2, 0], to: [1, 2, 1], block: "glass" } },
        { id: "B", type: "SolidBox", inputs: [{ ref: "A" }], params: { from: [0, 1, 0], to: [1, 1, 1], block: "wood" } },
        { id: "A", type: "SolidBox", params: { from: [0, 0, 0], to: [1, 0, 1], block: "stone" } },
      ],
    };
    const sorted = sortNodes(doc);
    expect(sorted.map(n => n.id)).toEqual(["A", "B", "C"]);
  });

  it("should detect simple direct cycle (A -> B -> A)", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        { id: "A", type: "SolidBox", inputs: [{ ref: "B" }], params: { from: [0, 0, 0], to: [1, 0, 1], block: "stone" } },
        { id: "B", type: "SolidBox", inputs: [{ ref: "A" }], params: { from: [0, 1, 0], to: [1, 1, 1], block: "wood" } },
      ],
    };
    expect(() => sortNodes(doc)).toThrow(GraphError);
    expect(() => sortNodes(doc)).toThrow("Dependency cycle detected");
  });

  it("should detect self-referential cycle (A -> A)", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        { id: "A", type: "SolidBox", inputs: [{ ref: "A" }], params: { from: [0, 0, 0], to: [1, 0, 1], block: "stone" } },
      ],
    };
    expect(() => sortNodes(doc)).toThrow(GraphError);
    expect(() => sortNodes(doc)).toThrow("Dependency cycle detected");
  });

  it("should detect indirect cycle (A -> B -> C -> A)", () => {
    const doc: CraftDagDocument = {
      ...baseDoc,
      nodes: [
        { id: "A", type: "SolidBox", inputs: [{ ref: "C" }], params: { from: [0, 0, 0], to: [1, 0, 1], block: "stone" } },
        { id: "B", type: "SolidBox", inputs: [{ ref: "A" }], params: { from: [0, 1, 0], to: [1, 1, 1], block: "wood" } },
        { id: "C", type: "SolidBox", inputs: [{ ref: "B" }], params: { from: [0, 2, 0], to: [1, 2, 1], block: "glass" } },
      ],
    };
    expect(() => sortNodes(doc)).toThrow(GraphError);
    expect(() => sortNodes(doc)).toThrow("Dependency cycle detected");
  });
});
