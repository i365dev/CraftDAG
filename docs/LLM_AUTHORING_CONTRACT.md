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
- `Platform`
- `Beam`
- `RoomShell`
- `Compartment`
- `Corridor`
- `Door`
- `Window`
- `Opening`
- `Portal`
- `GableRoof`
- `FlatRoof`
- `SupportPost`
- `Repeat`
- `Instance`

Use `Foundation` for ground/base slabs. Use `Platform` for elevated decks, counters, bridge decks, canopy plates, and other horizontal surfaces that are not foundations. Use `Beam` for lintels, horizontal spans, trim, rafters, or beam-like masses.

Use `Compartment` for generic interior rooms such as cabins, holds, boiler rooms, galleries, cells, storage rooms, and machine rooms. Put the domain intent in `role`; do not invent component types like `BoilerRoom`, `DiningHall`, or `CargoHold`.

Use `Corridor` for open-ended circulation runs inside large builds. It creates a floor, two side walls, and an optional ceiling. Set `options.axis` when the intended direction is ambiguous.

Use `GableRoof` for pitched triangular roofs. Use `FlatRoof` for low canopies, awnings, tower caps, flat roofs, well roofs, and other simple one-logical-unit-thick covers.

Use `Door` for literal doors, `Window` for glazed openings, `Opening` for unfilled pass-throughs or gate cutouts, and `Portal` for filled vertical portal planes.

Use `Repeat` for bounded linear repetition of anchored components, such as columns, support posts, beams, room bays, or bridge supports. Prefer `Repeat` over manually listing many near-identical components.

Use `assemblies` plus top-level `Instance` components when a multi-component module repeats, such as castle towers, wall segments, bridge bays, facade modules, or ship compartments. Define the module once in local coordinates, then place it several times with different anchors.

For `Instance` v0.1, do not use rotation, mirroring, nested instances, material overrides, expressions, or arbitrary loops. Keep assembly IDs and local component IDs short and descriptive. Expect expanded low-level IDs to look like `<instanceId>__<localComponentId>__<partName>`.

Use optional `role` metadata to preserve architectural intent for previews and repair loops:

```json
{
  "id": "engine_room",
  "type": "Compartment",
  "role": "engine_room",
  "placement": {
    "anchor": { "x": 48, "y": 1, "z": 2 },
    "size": { "width": 16, "height": 7, "length": 12 }
  }
}
```

`role` does not change geometry. It helps agents and tools understand why a component exists.

Do not invent components such as `Dome`, `Staircase`, `Arch`, `Railing`, or `PortalFrame` until the engine schema supports them.

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

`FlatRoof` creates a one-logical-unit-thick flat cover directly above its covered component. Prefer `FlatRoof` for low canopies, awnings, tower caps, and simple flat roofs.

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
4. Use `FlatRoof` if the intended shape is a low cover rather than a pitched roof.
5. Choose a smaller size tier.

Do not bypass validation.

## Size And Scope Policy

Prefer small and medium plans.

`policy.sizeTier` defaults to `"small"` when omitted. Use it to communicate intended scale before expansion:

| Tier | Max logical bounds | Max components | Max estimated expanded blocks |
| --- | --- | ---: | ---: |
| `small` | `32 x 32 x 32` | 64 | 32,768 |
| `medium` | `64 x 48 x 64` | 256 | 196,608 |
| `large` | `96 x 64 x 96` | 512 | 589,824 |

Small flat ComponentPlans are preferred. Medium plans may use several sections but should still be previewable and repairable. Large plans should use assemblies for repeated modules before manually listing many components.

`unitBlocks: 2` increases expanded block estimates. Do not use it to force a large landmark through a small budget.

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

Agents should use structured diagnostics when available. Prefer `diagnosticsFromError(error)` over parsing `error.message`.

A diagnostic may include:

- `severity`
- `stage`
- `code`
- `path`
- `componentId`
- `sectionId`
- `assemblyId`
- `instanceId`
- `availableRefs`
- `repairHint`

Use IDs and `path` to locate the failing authoring unit, then apply `repairHint` with the smallest valid edit.

Common repairs:

| Failure | Repair |
| --- | --- |
| Unknown component type | Replace with an allowed v0.1 component or reduce scope. |
| Wrong horizontal component semantics | Use `Foundation` for ground/base slabs, `Platform` for horizontal surfaces, and `Beam` for spans or lintels. |
| Duplicate `id` | Rename one component and update references. |
| Broken `ref` | Reference an existing component or define the missing component. |
| Out-of-bounds anchor/size | Move the component, shrink it, or increase bounds within policy. |
| Door/window/opening/portal exceeds target wall | Reduce offset, width, or height; choose a larger target. |
| Roof exceeds bounds | Reserve more height, reduce span, reduce overhang, use `FlatRoof` for low covers, or downscope. |
| Plan over budget | Split into sections, simplify details, shrink bounds, reduce component count, or choose a larger valid size tier. |
| Unsupported landmark detail | Preserve major silhouette and omit fine detail. |

## Future Capabilities Not Yet In v0.1

The following are expected future directions, not current allowed output:

- arches and shaped openings
- hip roofs, stair/slab roof materialization, and explicit pitch controls
- railings and fence lines
- hierarchical assemblies
- vision/reference-image decomposition

Until these exist in the schema, describe the closest supported simplified structure or reduce scope.
