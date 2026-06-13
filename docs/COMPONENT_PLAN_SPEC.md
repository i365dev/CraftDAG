# ComponentPlan v0.1 Spec

ComponentPlan is the recommended authoring language for LLM and agent-generated builds.

It is intentionally higher level than raw CraftDAG nodes:

```text
Natural language request
-> ComponentPlan
-> validate ComponentPlan
-> expand to CraftDAG
-> validate CraftDAG
-> compile to VoxelPlan
-> preview / material list / schematic export / future executors
```

## Design Principle

Agent is the author. Engine is the compiler.

The agent should describe architectural intent using a small, schema-constrained component vocabulary. The engine should own coordinate math, scaling, deterministic expansion, validation, and repairable errors.

This keeps generation:

- understandable to an LLM
- deterministic for tests
- observable in the UI
- repairable after validation failures
- reproducible across local, CI, and product flows

## Relationship To CraftDAG

ComponentPlan is not a replacement for CraftDAG. It sits above CraftDAG.

```text
BuildIntent
-> ComponentPlan       Agent-authored architectural DSL
-> CraftDAG            Low-level deterministic compiler IR
-> VoxelPlan           Final target block state
```

CraftDAG remains the engine IR and debugging layer. ComponentPlan is the authoring layer most agents should use.

## Document Shape

```ts
type ComponentPlanDocument = {
  version: "0.1"
  name: string
  grid?: ComponentGrid
  bounds: ComponentSize
  palette: ComponentPalette
  components: ComponentNode[]
}

type ComponentGrid = {
  unitBlocks?: 1 | 2
}

type ComponentSize = {
  width: number
  height: number
  length: number
}

type ComponentPalette = {
  foundation?: string
  wall?: string
  floor?: string
  roof?: string
  trim?: string
  glass?: string
  door?: string
}
```

All sizes and offsets in ComponentPlan are logical units. The expander converts logical units to Minecraft block coordinates.

`grid.unitBlocks` defaults to `1`. In v0.1, the engine should support `1` and `2` only.

## Scaling

Scaling is an engine concern, not an LLM math task.

Agents may express that a build should be small, medium, compact, or larger. The product or engine policy decides whether that maps to `unitBlocks: 1` or `unitBlocks: 2`.

The expander should apply scaling while converting ComponentPlan to CraftDAG. Do not post-scale the final VoxelPlan, because doors, windows, roofs, and detail components need component-aware expansion.

Example:

```json
{
  "version": "0.1",
  "name": "Large Starter Cabin",
  "grid": { "unitBlocks": 2 },
  "bounds": { "width": 7, "height": 5, "length": 7 },
  "palette": {
    "foundation": "minecraft:cobblestone",
    "wall": "minecraft:oak_planks",
    "roof": "minecraft:spruce_planks",
    "glass": "minecraft:glass"
  },
  "components": []
}
```

This describes a logical 7 x 5 x 7 build. With `unitBlocks: 2`, the expanded CraftDAG occupies a larger block footprint while preserving component semantics.

## Component DAG Semantics

`components[].inputs` is a semantic dependency graph. It is not an instruction list.

Use dependencies to say that one component attaches to, cuts into, covers, or decorates another component.

Example:

```json
{
  "id": "front_door",
  "type": "Door",
  "inputs": [{ "ref": "main_room" }],
  "placement": {
    "target": "main_room",
    "wall": "front",
    "offset": 3,
    "y": 1
  }
}
```

The expander translates semantic dependencies into low-level CraftDAG inputs and deterministic overwrite order.

## v0.1 Component Set

Start with a small component vocabulary:

- `Foundation`
- `RoomShell`
- `Door`
- `Window`
- `GableRoof`
- `SupportPost`

Avoid broad component catalogs until the repair loop and preview workflow are stable.

## Placement Model

Large components use explicit anchors and logical sizes.

```ts
type AnchoredPlacement = {
  anchor: { x: number; y: number; z: number }
  size: { width: number; height: number; length: number }
}
```

Attached components use semantic placement.

```ts
type WallAttachmentPlacement = {
  target: string
  wall: "front" | "back" | "left" | "right"
  offset: number
  y: number
  width?: number
  height?: number
}
```

Covering components use semantic coverage.

```ts
type CoverPlacement = {
  over: string
  overhang?: number
  direction?: "x" | "z"
}
```

Agents should not calculate raw `from` and `to` coordinates for attached components when a semantic placement is available.

## Example

```json
{
  "version": "0.1",
  "name": "Starter Cabin",
  "grid": { "unitBlocks": 1 },
  "bounds": { "width": 7, "height": 6, "length": 7 },
  "palette": {
    "foundation": "minecraft:cobblestone",
    "wall": "minecraft:oak_planks",
    "roof": "minecraft:spruce_planks",
    "glass": "minecraft:glass",
    "door": "minecraft:oak_door"
  },
  "components": [
    {
      "id": "foundation",
      "type": "Foundation",
      "placement": {
        "anchor": { "x": 0, "y": 0, "z": 0 },
        "size": { "width": 7, "height": 1, "length": 7 }
      },
      "materials": { "main": "foundation" }
    },
    {
      "id": "main_room",
      "type": "RoomShell",
      "inputs": [{ "ref": "foundation" }],
      "placement": {
        "anchor": { "x": 0, "y": 1, "z": 0 },
        "size": { "width": 7, "height": 3, "length": 7 }
      },
      "materials": { "wall": "wall" },
      "options": {
        "includeFloor": false,
        "includeCeiling": false
      }
    },
    {
      "id": "front_door",
      "type": "Door",
      "inputs": [{ "ref": "main_room" }],
      "placement": {
        "target": "main_room",
        "wall": "front",
        "offset": 3,
        "y": 1
      },
      "materials": { "door": "door" }
    },
    {
      "id": "front_window",
      "type": "Window",
      "inputs": [{ "ref": "main_room" }],
      "placement": {
        "target": "main_room",
        "wall": "front",
        "offset": 1,
        "y": 2,
        "width": 1,
        "height": 1
      },
      "materials": { "glass": "glass" }
    },
    {
      "id": "roof",
      "type": "GableRoof",
      "inputs": [{ "ref": "main_room" }],
      "placement": {
        "over": "main_room",
        "overhang": 1,
        "direction": "x"
      },
      "materials": { "roof": "roof" }
    }
  ]
}
```

## Validation Contract

ComponentPlan validation should reject:

- unknown top-level fields
- unknown component types
- duplicate component IDs
- missing semantic references
- dependency cycles
- placements outside logical bounds
- unsupported `grid.unitBlocks`
- unknown material role references
- attached components that reference non-attachable targets

Errors should be structured for repair:

```json
{
  "stage": "component-validation",
  "code": "UNKNOWN_COMPONENT_REF",
  "componentId": "front_window",
  "path": "components[3].inputs[0].ref",
  "message": "Component front_window references unknown component room1.",
  "availableRefs": ["foundation", "main_room"],
  "repairHint": "Change inputs[0].ref to main_room or define component room1."
}
```

## Expansion Contract

The expander must be pure and deterministic.

For each component, generate stable CraftDAG node IDs:

```text
<componentId>__<partName>
```

Examples:

- `main_room__shell`
- `front_door__opening`
- `roof__gable`

The expansion pipeline should be:

```text
validate ComponentPlan
-> expand ComponentPlan to CraftDAG
-> validate CraftDAG
-> compile CraftDAG to VoxelPlan
```

MinePilot should be able to display each stage so agent outputs can be inspected and repaired.
