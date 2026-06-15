import { describe, expect, it } from "vitest";
import { diagnosticsFromError, ValidationError } from "../src/index.js";

describe("diagnosticsFromError", () => {
  it("normalizes CraftDAG error details into agent-friendly diagnostics", () => {
    const error = new ValidationError("Plan failed", [
      {
        stage: "component-validation",
        code: "UNKNOWN_COMPONENT_REF",
        message: "Missing component.",
        componentId: "wall",
        sectionId: "midship",
        repairHint: "Define the referenced component.",
      },
    ]);

    expect(diagnosticsFromError(error)).toEqual([
      {
        severity: "error",
        stage: "component-validation",
        code: "UNKNOWN_COMPONENT_REF",
        message: "Missing component.",
        componentId: "wall",
        sectionId: "midship",
        assemblyId: undefined,
        instanceId: undefined,
        sourceNodeId: undefined,
        path: undefined,
        availableRefs: undefined,
        repairHint: "Define the referenced component.",
      },
    ]);
  });

  it("normalizes unknown errors into one generic diagnostic", () => {
    expect(diagnosticsFromError(new Error("Something broke"))).toEqual([
      {
        severity: "error",
        stage: "unknown",
        code: "UNKNOWN_ERROR",
        message: "Something broke",
      },
    ]);
  });
});
