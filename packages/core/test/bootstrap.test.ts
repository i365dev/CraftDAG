import { describe, it, expect } from "vitest";
import { version } from "../src/index.js";

describe("Bootstrap", () => {
  it("should output correct version", () => {
    expect(version).toBe("0.1.0");
  });
});
