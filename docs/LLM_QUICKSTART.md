# CraftDAG LLM Quickstart Guide

This guide is designed for LLMs (such as Gemini, GPT, Kimi) to generate valid CraftDAG `v0.1` building plans for Minecraft-oriented construction.

---

## Mental Model

1. **Declarative and Bounded**: CraftDAG is a deterministic desired-state plan, not a series of active actions or execution scripts. Every plan specifies a strict bounding box `size: [width, height, length]` relative to the local origin `[0,0,0]`.
2. **Local Non-Negative Coordinates**: **CRITICAL**: Coordinate indices in `from` and `to` are `[X, Y, Z]` vectors. Every coordinate index must be a non-negative integer satisfying:
   - `0 <= X < size[0]`
   - `0 <= Y < size[1]`
   - `0 <= Z < size[2]`
   Negative coordinates or absolute world coordinate offsets are **strictly forbidden** in v0.1.
3. **Dependency Graph (DAG)**: Nodes in CraftDAG represent semantic construction primitives. The array order does *not* determine compile order. Instead, the `inputs` field defines the graph dependencies. If Node B has an input referencing Node A, Node A will always compile before Node B.
4. **Deterministic Overwrites**: A node compiled later in topological order can overwrite/clear blocks from earlier nodes. Use `Doorway` and `Window` to carve openings into compiled `Wall` or `HollowBox` nodes.

---

## Output Contract

- **Return only valid CraftDAG JSON**.
- Never wrap the JSON in markdown code blocks unless requested.
- Do not output commentary, explanations, or code alongside the JSON.

---

## Document Shape

A valid CraftDAG document must conform to the following schema structure:

```json
{
  "version": "0.1",
  "name": "Plan Name",
  "size": [Width, Height, Length],
  "palette": {
    "paletteKey": "minecraft:blockstate_identifier"
  },
  "nodes": [
    {
      "id": "node-id",
      "type": "PrimitiveType",
      "inputs": [{ "ref": "dependency-node-id" }],
      "params": {
        // primitive-specific parameters
      }
    }
  ]
}
```

---

## Allowed Primitive Types

- **`SolidBox`**: Fills the inclusive 3D bounding box from `from` to `to` with `block`.
- **`HollowBox`**: Fills only the outer shell of the box from `from` to `to` with `block`.
  - `includeFloor` (boolean, optional, default `true`): If `false`, the floor face (`y === minY`) is omitted, leaving it open underneath (ideal when layering walls on top of a foundation).
  - `includeCeiling` (boolean, optional, default `true`): If `false`, the ceiling face (`y === maxY`) is omitted, leaving it open on top (ideal when adding a separate roof).
- **`Wall`**: Fills a vertical plane. **Either X or Z must be constant** (e.g., `from[0] === to[0]` or `from[2] === to[2]`).
- **`Floor`**: Fills a horizontal plane. **Y must be constant** (`from[1] === to[1]`).
- **`Column`**: Fills a vertical support line. **Both X and Z must be constant** (`from[0] === to[0] && from[2] === to[2]`).
- **`Doorway`**: Clears a rectangular opening. If an optional `block` parameter is provided, it replaces the cleared area with that block.
- **`Window`**: Clears an opening and fills it with glass (defaults to `minecraft:glass`).
- **`GableRoof`**: Generates a triangular solid roof volume. **CRITICAL**: `GableRoof` v0.1 generates a solid block roof volume (fills all blocks from `minY` to peak `Y`). It **does not yet use stairs or slabs**. Set `direction` to `"x"` (ridge runs along X, slopes down along Z) or `"z"` (ridge runs along Z, slopes down along X).

---

## Valid Example: Starter Cottage

Below is a complete, minimal, and fully valid CraftDAG document showcasing correct topological references:

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

## Forbidden Examples

### ✗ No Code/Command Generation
Never output JavaScript, Mineflayer API calls, or WorldEdit commands.
```javascript
// FORBIDDEN
const bot = mineflayer.createBot({...});
bot.chat("//set stone");
```

### ✗ No Nested Nodes in Inputs
Do not inline node definitions inside inputs. Use flat node arrays and reference dependencies by ID.
```json
// FORBIDDEN
{
  "id": "walls",
  "type": "HollowBox",
  "inputs": [
    { "id": "foundation", "type": "SolidBox", ... }
  ]
}
```

### ✗ No Negative or Out-of-Bounds Coordinates
Coordinate indices must always start at `0` and be strictly less than the document's `"size"`.
```json
// FORBIDDEN
"params": {
  "from": [-1, 0, 0], // Negative coordinates are invalid
  "to": [5, 5, 5]     // Exceeds document size [5, 5, 5] (maximum allowed X index is 4)
}
```

### ✗ No Unsupported Block Properties or Namespaces
Only reference blocks that are registered in the palette, or use standard namespaces like `minecraft:`. Do not use arbitrary string names without definition.

---

## Repair Rules

When validation fails, modify the CraftDAG JSON. Do not bypass validation. Use the table below to fix errors:

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
