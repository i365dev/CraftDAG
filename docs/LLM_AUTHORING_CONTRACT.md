# CraftDAG LLM Authoring Contract

This is the model-facing contract for agents that generate Minecraft build plans with CraftDAG.

For product workflows, generate `ComponentPlan` first. Raw CraftDAG is the lower-level compiler IR and should mainly be used for fixtures, tests, debugging, and fallback generation.

```text
natural language / future reference input
-> optional architectural brief
-> ComponentPlan JSON
-> validate ComponentPlan
-> expand to CraftDAG
-> validate CraftDAG
-> compile VoxelPlan
-> preview / material list / schematic export
```

## Core Rule

Agent is the author. Engine is the compiler.

The agent describes bounded architectural intent. The engine owns coordinate math, scaling, deterministic expansion, validation, export, and repairable errors.

## Output Contract

Return JSON only.

Do not output:

- markdown fences
- commentary
- WorldEdit commands
- Mineflayer code
- JavaScript
- block-by-block action lists
- unknown component types
- extra fields outside the schema

If the caller supports ComponentPlan, return ComponentPlan rather than raw CraftDAG.

## ComponentPlan Mental Model

ComponentPlan is a declarative semantic DAG, not a sequence of commands.

- Every component must have a unique `id`.
- References must use `{ "ref": "existing_component_id" }`.
- Never inline components inside `inputs`.
- Array order is not execution order.
- Use local non-negative logical coordinates only.
- Keep all anchored components inside `bounds`.
- Prefer semantic placement fields over raw block coordinates.

Use:

- `anchor`
- `size`
- `target`
- `wall`
- `offset`
- `y`
- `over`
- `direction`
- `overhang`

Do not use raw `from` / `to` coordinates in ComponentPlan when a semantic placement exists.

## v0.1 Component Vocabulary

Allowed ComponentPlan v0.1 components:

- `Foundation`
- `RoomShell`
- `Door`
- `Window`
- `GableRoof`
- `SupportPost`

Do not invent components such as `Dome`, `Staircase`, `Arch`, `Railing`, `Platform`, or `PortalFrame` until the engine schema supports them.

When intent needs an unsupported component, simplify to the closest supported semantic form or reduce scope.

## Valid ComponentPlan Example

```json
{
  "version": "0.1",
  "name": "Starter Cabin",
  "grid": { "unitBlocks": 1 },
  "bounds": { "width": 9, "height": 10, "length": 9 },
  "palette": {
    "foundation": "minecraft:cobblestone",
    "wall": "minecraft:oak_planks",
    "roof": "minecraft:spruce_planks",
    "glass": "minecraft:glass_pane",
    "door": "minecraft:oak_door",
    "trim": "minecraft:oak_log"
  },
  "components": [
    {
      "id": "foundation",
      "type": "Foundation",
      "placement": {
        "anchor": { "x": 0, "y": 0, "z": 0 },
        "size": { "width": 9, "height": 1, "length": 9 }
      }
    },
    {
      "id": "main_room",
      "type": "RoomShell",
      "inputs": [{ "ref": "foundation" }],
      "placement": {
        "anchor": { "x": 1, "y": 1, "z": 1 },
        "size": { "width": 7, "height": 4, "length": 7 }
      },
      "options": {
        "includeFloor": false,
        "includeCeiling": false
      }
    },
    {
      "id": "front_door",
      "type": "Door",
      "placement": {
        "target": "main_room",
        "wall": "front",
        "offset": 3,
        "y": 0
      }
    },
    {
      "id": "front_window",
      "type": "Window",
      "placement": {
        "target": "main_room",
        "wall": "front",
        "offset": 1,
        "y": 2,
        "width": 1,
        "height": 1
      }
    },
    {
      "id": "roof",
      "type": "GableRoof",
      "placement": {
        "over": "main_room",
        "direction": "x",
        "overhang": 1
      }
    }
  ]
}
```

## Common Invalid Patterns

### Inline Components

Wrong:

```json
{
  "id": "main_room",
  "type": "RoomShell",
  "inputs": [
    {
      "id": "foundation",
      "type": "Foundation",
      "placement": {
        "anchor": { "x": 0, "y": 0, "z": 0 },
        "size": { "width": 9, "height": 1, "length": 9 }
      }
    }
  ]
}
```

Right:

```json
{
  "components": [
    { "id": "foundation", "type": "Foundation" },
    {
      "id": "main_room",
      "type": "RoomShell",
      "inputs": [{ "ref": "foundation" }]
    }
  ]
}
```

### Raw Attachment Coordinates

Wrong:

```json
{
  "id": "front_window",
  "type": "Window",
  "params": {
    "from": [4, 2, 0],
    "to": [5, 3, 0]
  }
}
```

Right:

```json
{
  "id": "front_window",
  "type": "Window",
  "placement": {
    "target": "main_room",
    "wall": "front",
    "offset": 4,
    "y": 2,
    "width": 2,
    "height": 2
  }
}
```

### Exact Landmark Replica Requests

Wrong:

```text
Generate a full-scale exact Notre-Dame replica.
```

Right:

```text
Generate a simplified medium cathedral-inspired build that preserves a nave, two front towers, tall windows, symmetry, and a gable roof. Omit fine sculpture, exact proportions, and full interior detail.
```

## Roof Height Rule

`GableRoof` v0.1 creates a solid triangular roof volume. It is not a stair/slab roof.

Always reserve enough `bounds.height` for the covered component plus roof slope.

For a `GableRoof`, the plan must satisfy:

```text
bounds.height * unitBlocks >=
  (covered.anchor.y + covered.size.height) * unitBlocks
  + ceil(slopeSpan * unitBlocks / 2)
```

Where:

- If `direction` is `"x"`, the ridge runs along X and the slope span is the covered length on Z.
- If `direction` is `"z"`, the ridge runs along Z and the slope span is the covered width on X.
- `overhang` can increase the slope span.
- `unitBlocks: 2` also scales the roof height requirement.

If validation reports that a roof exceeds bounds:

1. Increase `bounds.height`.
2. Reduce the covered component width/length.
3. Remove or reduce `overhang`.
4. Choose a smaller size tier.

Do not bypass validation.

## Size And Scope Policy

Prefer small and medium plans.

Recommended current limits:

- Small: up to roughly `32 x 32 x 32`, flat ComponentPlan is acceptable.
- Medium: may use several sections, but should still be previewable and repairable.
- Large: should be reduced to a simplified interpretation until hierarchical assemblies and budgets are available.

When a prompt asks for a large or famous building, do not attempt a full exact replica. First reduce scope.

Preserve:

- silhouette
- main masses
- symmetry
- towers or wings
- repeated facade rhythm
- dominant material palette

Omit:

- exact dimensions
- fine sculpture
- complex interiors
- terrain/city context
- block-perfect facade detail

## Optional Architectural Brief Before ComponentPlan

For ambiguous, large, or reference-driven prompts, produce or internally use a brief before ComponentPlan.

Example:

```json
{
  "kind": "architectural_brief",
  "target": "simplified landmark-inspired build",
  "sizeTier": "medium",
  "preserve": [
    "central dome silhouette",
    "four corner towers",
    "symmetry",
    "raised platform"
  ],
  "omit": [
    "fine marble inlay",
    "full interior",
    "exact proportions"
  ],
  "sections": [
    { "id": "platform", "role": "base" },
    { "id": "central_hall", "role": "main mass" },
    { "id": "corner_towers", "role": "repeated vertical accents" }
  ]
}
```

Do not include this brief inside strict ComponentPlan JSON unless the caller explicitly asks for a separate planning artifact.

## Repair Loop

When validation fails, repair the plan. Do not switch to code, commands, or raw block placement.

Common repairs:

| Failure | Repair |
| --- | --- |
| Unknown component type | Replace with an allowed v0.1 component or reduce scope. |
| Duplicate `id` | Rename one component and update references. |
| Broken `ref` | Reference an existing component or define the missing component. |
| Out-of-bounds anchor/size | Move the component, shrink it, or increase bounds within policy. |
| Door/window exceeds target wall | Reduce offset, width, or height; choose a larger target. |
| Roof exceeds bounds | Reserve more height, reduce span, reduce overhang, or downscope. |
| Plan too large | Split into sections, simplify details, or choose a smaller size tier. |
| Unsupported landmark detail | Preserve major silhouette and omit fine detail. |

## Future Capabilities Not Yet In v0.1

The following are expected future directions, not current allowed output:

- horizontal surfaces / beams / platforms
- explicit openings, arches, and portals
- roof variants and pitch controls
- railings and fence lines
- hierarchical assemblies
- bounded repetition
- large-build budgets
- vision/reference-image decomposition

Until these exist in the schema, describe the closest supported simplified structure or reduce scope.

