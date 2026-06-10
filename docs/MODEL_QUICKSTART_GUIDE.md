# CraftDAG Model Quickstart Guide

This guide describes how to generate valid CraftDAG `v0.1` building plans for Minecraft-oriented construction.

## Core Concepts

1. **Declarative and Bounded**: CraftDAG is a deterministic desired-state plan, not a series of active actions or scripts. Every document specifies a strict bounding box `size: [width, height, length]` relative to the local origin `[0,0,0]`. All blocks must stay within `0 <= coordinate < size[dimension]`.
2. **Dependency Graph (DAG)**: Nodes in CraftDAG represent semantic construction primitives. The array order does *not* determine compile order. Instead, the `inputs` field defines the graph dependencies. If Node B has an input referencing Node A, Node A will always compile before Node B.
3. **No Code Generation**: Never generate JavaScript, WorldEdit commands, or Mineflayer bot scripts. Only generate valid CraftDAG JSON.
4. **Deterministic Overwrites**: A node compiled later in topological order can overwrite/clear blocks from earlier nodes. Use `Doorway` and `Window` to carve openings into compiled `Wall` or `HollowBox` nodes.

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

## Primitives Schema Reference

All coordinate vectors `from` and `to` are `[X, Y, Z]` relative coordinates.

- **`SolidBox`**: Fills the inclusive 3D bounding box from `from` to `to` with `block`.
- **`HollowBox`**: Fills only the 6-faced outer shell of the box from `from` to `to`, leaving the interior empty.
- **`Wall`**: Fills a vertical plane. Crucially, **either X or Z must be constant** (e.g., `from[0] === to[0]` or `from[2] === to[2]`).
- **`Floor`**: Fills a horizontal plane. Crucially, **Y must be constant** (`from[1] === to[1]`).
- **`Column`**: Fills a vertical support line. Crucially, **both X and Z must be constant** (`from[0] === to[0] && from[2] === to[2]`).
- **`Doorway`**: Clears a rectangular opening. If an optional `block` parameter is provided, it replaces the cleared area with that blockstate.
- **`Window`**: Clears an opening and fills it with glass (defaults to `minecraft:glass`).
- **`GableRoof`**: Generates a triangular sloped roof. Set `direction` to `"x"` (ridge runs along X, slopes down along Z) or `"z"` (ridge runs along Z, slopes down along X).

## Repairing Validation Errors

- If you receive a **Duplicate ID** error: Ensure every node in the `nodes` array has a unique `"id"`.
- If you receive a **Missing Reference** error: Ensure all `"ref"` values in `"inputs"` exactly match an `"id"` of another node in the document.
- If you receive a **Dependency Cycle** error: Ensure there are no circular dependencies (e.g., A depends on B, and B depends on A).
- If you receive an **Out of Bounds** error: Ensure all coordinate indices are non-negative and strictly less than the document's `"size"`.
