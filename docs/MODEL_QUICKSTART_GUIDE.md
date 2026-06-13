# CraftDAG Model Quickstart Guide

This guide describes how to generate valid low-level CraftDAG `v0.1` building plans for Minecraft-oriented construction.

For agent-authored product generation, prefer `docs/COMPONENT_PLAN_SPEC.md`. ComponentPlan is the higher-level architectural DSL intended for LLMs. CraftDAG is the deterministic compiler IR.

## Core Concepts

1. **Compiler IR**: CraftDAG is deterministic and inspectable, but it is lower-level than ComponentPlan. Use raw CraftDAG for fixtures, tests, debugging, and fallback generation.
2. **Declarative and Bounded**: CraftDAG is a deterministic desired-state plan, not a series of active actions or scripts. Every document specifies a strict bounding box `size: [width, height, length]` relative to the local origin `[0,0,0]`. All blocks must stay within `0 <= coordinate < size[dimension]`.
3. **Dependency Graph (DAG)**: Nodes in CraftDAG represent semantic construction primitives. The array order does *not* determine compile order. Instead, the `inputs` field defines the graph dependencies. If Node B has an input referencing Node A, Node A will always compile before Node B.
4. **No Code Generation**: **CRITICAL RULE**: Never generate JavaScript, WorldEdit commands, or Mineflayer bot scripts. Only generate valid CraftDAG JSON.
5. **Deterministic Overwrites**: A node compiled later in topological order can overwrite/clear blocks from earlier nodes. Use `Doorway` and `Window` to carve openings into compiled `Wall` or `HollowBox` nodes.

## Node Inputs Rule

When a node depends on another, it must reference its ID in `inputs` using `{ "ref": "<id>" }`. Do *not* nest node definitions inside `inputs`.

### ✗ Incorrect (Nested Nodes)
```json
{
  "id": "walls",
  "type": "HollowBox",
  "inputs": [
    {
      "id": "foundation",
      "type": "SolidBox",
      "params": { ... }
    }
  ]
}
```

### ✓ Correct (Flat Array, Reference by ID)
```json
{
  "id": "foundation",
  "type": "SolidBox",
  "params": { ... }
},
{
  "id": "walls",
  "type": "HollowBox",
  "inputs": [{ "ref": "foundation" }],
  "params": { ... }
}
```

---

## Complete Valid Example (`starter-cottage.json`)

Below is a complete, minimal, and fully valid CraftDAG document showcasing topological layering:

```json
{
  "version": "0.1",
  "name": "Starter Cottage",
  "size": [5, 5, 5],
  "palette": {
    "stone": "minecraft:stone_bricks",
    "wood": "minecraft:oak_planks",
    "door": "minecraft:oak_door",
    "glass": "minecraft:glass"
  },
  "nodes": [
    {
      "id": "foundation",
      "type": "SolidBox",
      "params": {
        "from": [0, 0, 0],
        "to": [4, 0, 4],
        "block": "stone"
      }
    },
    {
      "id": "walls",
      "type": "HollowBox",
      "inputs": [{ "ref": "foundation" }],
      "params": {
        "from": [0, 1, 0],
        "to": [4, 3, 4],
        "block": "wood",
        "includeFloor": false,
        "includeCeiling": false
      }
    },
    {
      "id": "doorway",
      "type": "Doorway",
      "inputs": [{ "ref": "walls" }],
      "params": {
        "from": [2, 1, 0],
        "to": [2, 2, 0],
        "block": "door"
      }
    },
    {
      "id": "window",
      "type": "Window",
      "inputs": [{ "ref": "walls" }],
      "params": {
        "from": [1, 2, 0],
        "to": [1, 2, 0],
        "block": "glass"
      }
    },
    {
      "id": "roof",
      "type": "GableRoof",
      "inputs": [{ "ref": "walls" }],
      "params": {
        "from": [0, 4, 0],
        "to": [4, 4, 4],
        "block": "wood",
        "direction": "x"
      }
    }
  ]
}
```

---

## Primitives Schema Reference

All coordinate vectors `from` and `to` are `[X, Y, Z]` relative coordinates.

- **`SolidBox`**: Fills the inclusive 3D bounding box from `from` to `to` with `block`.
- **`HollowBox`**: Fills the 6-faced outer shell of the box from `from` to `to` with `block`.
  - **`includeFloor`** (boolean, optional, default `true`): If `false`, the floor face (`y === minY`) is omitted, leaving it open underneath (ideal when layering walls on top of a foundation).
  - **`includeCeiling`** (boolean, optional, default `true`): If `false`, the ceiling face (`y === maxY`) is omitted, leaving it open on top (ideal when adding a separate roof).
- **`Wall`**: Fills a vertical plane. **Either X or Z must be constant** (e.g., `from[0] === to[0]` or `from[2] === to[2]`).
- **`Floor`**: Fills a horizontal plane. **Y must be constant** (`from[1] === to[1]`).
- **`Column`**: Fills a vertical support line. **Both X and Z must be constant** (`from[0] === to[0] && from[2] === to[2]`).
- **`Doorway`**: Clears a rectangular opening. If an optional `block` parameter is provided, it replaces the cleared area with that block.
- **`Window`**: Clears an opening and fills it with glass (defaults to `minecraft:glass`).
- **`GableRoof`**: Generates a triangular solid roof. Fills all blocks from `minY` up to the calculated slope peak Y. Set `direction` to `"x"` (ridge runs along X, slopes down along Z) or `"z"` (ridge runs along Z, slopes down along X).

---

## Repairing Common Validation & Compilation Errors

When the compilation pipeline fails, use the following guide to repair the JSON document:

| Error Message / Code | Underlying Cause | Repair Instructions |
|----------------------|------------------|---------------------|
| `Schema validation failed: ...` | A node has missing required fields, illegal properties, or misspelled primitive type. | Check that all node properties strictly match the schemas (e.g. `SolidBox` requires `block`, `Doorway` does not). Remove any extra fields. |
| `Duplicate node ID found: "..."` | Two or more nodes share the same `"id"`. | Rename one of the nodes to a unique string and update any reference inputs pointing to it. |
| `Node "A" references non-existent node: "B"` | An entry in node `"A"`'s `inputs` array has a `"ref"` value `"B"` that is not defined in any node. | Verify spelling of `"id"` and `"ref"`. Ensure the referenced node exists in the `nodes` array. |
| `Dependency cycle detected ...` | Circular dependency exists (e.g., A depends on B, B depends on A). | Break the cycle by removing unnecessary `inputs` references. Ensure dependencies flow one-way. |
| `Coordinate [X, Y, Z] is out of bounds ...` | A coordinate in `from` or `to` exceeds the document's `"size"` bounds or is negative. | Ensure all coordinates satisfy: `0 <= coord < size[axis]`. Increase the overall `"size"` if necessary. |
| `Wall node "..." must have either constant X or constant Z ...` | A `Wall` primitive has different X and different Z coordinates for its `from` and `to`. | Change the wall's coordinates so either `from[0] === to[0]` (X-axis wall) or `from[2] === to[2]` (Z-axis wall). |
| `Floor node "..." must have a constant Y coordinate.` | A `Floor` primitive has different Y coordinates for its `from` and `to`. | Change the coordinates so `from[1] === to[1]`. |
| `Column node "..." must have constant X and Z coordinates.` | A `Column` primitive has varying X or Z coordinates. | Change the coordinates so `from[0] === to[0]` and `from[2] === to[2]`. |
