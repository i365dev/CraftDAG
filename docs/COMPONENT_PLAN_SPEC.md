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
  policy?: ComponentPlanPolicy
  bounds: ComponentSize
  palette: ComponentPalette
  assemblies?: ComponentAssemblyDefinition[]
  components?: ComponentNode[]
  sections?: ComponentPlanSection[]
}

type ComponentAssemblyDefinition = {
  id: string
  bounds: ComponentSize
  components: AssemblyComponentNode[]
}

type ComponentPlanSection = {
  id: string
  origin: { x: number; y: number; z: number }
  bounds: ComponentSize
  assemblies?: ComponentAssemblyDefinition[]
  components: ComponentNode[]
}

type ComponentGrid = {
  unitBlocks?: 1 | 2
}

type ComponentPlanPolicy = {
  sizeTier?: "small" | "medium" | "large" | "monumental"
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

## Budget Policy

`policy.sizeTier` defaults to `"small"`.

The validator rejects plans that exceed the active tier before expansion or compilation. Budgets are deliberately conservative so MinePilot and other agent workflows can ask for a repair before rendering an impractical plan.

| Tier | Max logical bounds | Max components | Max estimated expanded blocks |
| --- | --- | ---: | ---: |
| `small` | `32 x 32 x 32` | 64 | 32,768 |
| `medium` | `64 x 48 x 64` | 256 | 196,608 |
| `large` | `96 x 64 x 96` | 512 | 589,824 |
| `monumental` | `256 x 96 x 256` | 2,048 | 6,291,456 |

`grid.unitBlocks` affects estimated expanded blocks. A logical solid volume with `unitBlocks: 2` is estimated as eight times as many Minecraft blocks as the same logical volume with `unitBlocks: 1`.

When validation reports a budget error, repair by shrinking bounds, reducing repeated detail, choosing a larger `sizeTier`, or splitting the build into sections.

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
    "y": 0
  }
}
```

The expander translates semantic dependencies into low-level CraftDAG inputs and deterministic overwrite order.

For attached and covering components, `placement.target` and `placement.over` are implicit dependencies. Agents may include them in `inputs` for readability, but the expander must add the low-level CraftDAG dependency even when they are omitted.

## v0.1 Component Set

Start with a small component vocabulary:

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

Avoid broad component catalogs until the repair loop and preview workflow are stable.

Use `Foundation` for ground/base slabs that establish a structure's footprint.

Use `Platform` for semantic horizontal surfaces that are not foundations, such as elevated decks, counters, bridge decks, canopy plates, or simple horizontal slabs.

Use `Beam` for semantic spans, lintels, horizontal trim, rafters, or other rectangular beam-like masses.

Use `RoomShell` for one-off exterior or interior hollow volumes.

Use `Compartment` for bounded interior rooms, holds, machinery spaces, cabins, cells, galleries, or any other semantic room-like subdivision. Domain meaning should normally go in `role`, for example `role: "boiler_room"` or `role: "passenger_cabin"`, instead of creating a new component type.

Use `Corridor` for open-ended interior circulation runs. It expands to a floor, two side walls, and an optional ceiling. Corridors default to the longer horizontal axis, or agents can set `options.axis` to `"x"` or `"z"`.

Use `GableRoof` for pitched roof volumes. Use `FlatRoof` for low canopies, awnings, tower caps, simple flat roofs, and other one-logical-unit-thick covers.

Use `Door` only for literal door-sized entrances. Use `Window` for glazed wall openings. Use `Opening` for semantic pass-throughs, gates, large cutouts, and other unfilled rectangular wall openings. Use `Portal` for filled vertical portal planes inside a wall or frame.

Use `Repeat` for bounded repetition of an existing anchored source component, such as a column run, facade rhythm, bridge support sequence, or repeated shell bay. `Repeat` is not a free-form loop and is not a standalone physical component.

Use `assemblies` plus `Instance` when the same multi-component module should appear several times, such as castle towers, bridge bays, wall segments, facade modules, or repeated ship compartments. `Instance` is a placement of an assembly, not a physical component by itself.

## Role Metadata

Every component may include an optional `role` string:

```json
{
  "id": "boiler_room_01",
  "type": "Compartment",
  "role": "boiler_room",
  "placement": {
    "anchor": { "x": 8, "y": 1, "z": 2 },
    "size": { "width": 18, "height": 6, "length": 10 }
  }
}
```

`role` is semantic metadata for agents, previews, reports, and future repair loops. It does not change geometry. Prefer role metadata over domain-specific primitive types.

## Placement Model

Large components use explicit anchors and logical sizes.

```ts
type AnchoredPlacement = {
  anchor: { x: number; y: number; z: number }
  size: { width: number; height: number; length: number }
}
```

Attached components use semantic placement.

For wall attachments, `offset` is relative to the selected wall start and `y` is relative to the target component's `anchor.y`. For example, `y: 0` means the attachment begins at the bottom of the target wall.

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

`Door`, `Window`, `Opening`, and `Portal` all use `WallAttachmentPlacement`. Default sizes are intentionally small and repairable:

- `Door`: `1 x 2`
- `Window`: `1 x 1`
- `Opening`: `1 x 2`
- `Portal`: `2 x 3`

Covering components use semantic coverage.

```ts
type CoverPlacement = {
  over: string
  overhang?: number
  direction?: "x" | "z"
}
```

`GableRoof` uses `direction` to choose the roof ridge direction. `FlatRoof` ignores `direction`; include only `over` and optional `overhang`.

For both roof components, `overhang` is clipped symmetrically to stay within global bounds.

Repeating components use bounded linear repetition.

```ts
type RepeatPlacement = {
  source: string
  axis: "x" | "y" | "z"
  count: number
  step: number
}
```

`Repeat` duplicates the source component `count - 1` times, because the source component itself remains the first instance. In v0.1, only anchored components can be repeated: `Foundation`, `Platform`, `Beam`, `RoomShell`, `Compartment`, `Corridor`, and `SupportPost`.

Repeated clone IDs are stable:

```text
<repeatId>__<sourceId>_<index>__<partName>
```

## Assemblies And Instances

Assemblies are local, reusable component groups. They are the first large-build primitive in ComponentPlan v0.1.

```ts
type ComponentAssemblyDefinition = {
  id: string
  bounds: ComponentSize
  components: AssemblyComponentNode[]
}

type InstancePlacement = {
  assembly: string
  anchor: { x: number; y: number; z: number }
}
```

Assembly components use local coordinates inside `assembly.bounds`. An `Instance` places that local assembly into global ComponentPlan coordinates using `placement.anchor`.

In v0.1:

- assembly components may use the normal physical components and `Repeat`
- assembly-local references only resolve to components inside that assembly
- top-level `Instance.inputs` may reference concrete top-level components for ordering
- expanded node IDs are deterministic: `<instanceId>__<localComponentId>__<partName>`
- nested `Instance` inside an assembly is not supported
- rotation, mirroring, expressions, arbitrary loops, and material overrides are not supported

Example:

```json
{
  "assemblies": [
    {
      "id": "tower_module",
      "bounds": { "width": 6, "height": 10, "length": 6 },
      "components": [
        {
          "id": "tower_body",
          "type": "RoomShell",
          "placement": {
            "anchor": { "x": 0, "y": 0, "z": 0 },
            "size": { "width": 6, "height": 7, "length": 6 }
          }
        },
        {
          "id": "tower_cap",
          "type": "FlatRoof",
          "placement": { "over": "tower_body" }
        }
      ]
    }
  ],
  "components": [
    {
      "id": "left_tower",
      "type": "Instance",
      "placement": {
        "assembly": "tower_module",
        "anchor": { "x": 1, "y": 1, "z": 3 }
      }
    },
    {
      "id": "right_tower",
      "type": "Instance",
      "placement": {
        "assembly": "tower_module",
        "anchor": { "x": 17, "y": 1, "z": 3 }
      }
    }
  ]
}
```

Agents should not calculate raw `from` and `to` coordinates for attached components when a semantic placement is available.

## Sections

Sections are local ComponentPlan regions for monumental or long-axis builds. They let agents decompose a large structure into bounded parts such as `bow`, `midship`, `stern`, `garden_axis`, `central_hall`, or `wall_span_03`.

```ts
type ComponentPlanSection = {
  id: string
  origin: { x: number; y: number; z: number }
  bounds: ComponentSize
  assemblies?: ComponentAssemblyDefinition[]
  components: ComponentNode[]
}
```

Section components use local coordinates inside `section.bounds`. The expander shifts them by `section.origin` into global ComponentPlan coordinates.

In v0.1:

- root `components` and `sections` may coexist
- a plan must define at least one root component or one section
- each section validates against its own local bounds
- each section must fit inside global `bounds`
- root assemblies are available to sections
- section-local assemblies are available only inside that section
- section-expanded node IDs are deterministic: `<sectionId>__<componentId>__<partName>`
- assembly instances inside sections expand as `<sectionId>__<instanceId>__<localComponentId>__<partName>`
- cross-section component references are not supported

Example:

```json
{
  "version": "0.1",
  "name": "Sectioned Wall",
  "policy": { "sizeTier": "large" },
  "bounds": { "width": 48, "height": 16, "length": 16 },
  "palette": {
    "foundation": "minecraft:stone_bricks",
    "wall": "minecraft:stone_bricks",
    "floor": "minecraft:smooth_stone",
    "trim": "minecraft:spruce_log"
  },
  "sections": [
    {
      "id": "west_span",
      "origin": { "x": 0, "y": 0, "z": 0 },
      "bounds": { "width": 24, "height": 16, "length": 16 },
      "components": [
        {
          "id": "base",
          "type": "Foundation",
          "placement": {
            "anchor": { "x": 0, "y": 0, "z": 5 },
            "size": { "width": 24, "height": 1, "length": 6 }
          }
        }
      ]
    },
    {
      "id": "east_span",
      "origin": { "x": 24, "y": 0, "z": 0 },
      "bounds": { "width": 24, "height": 16, "length": 16 },
      "components": [
        {
          "id": "base",
          "type": "Foundation",
          "placement": {
            "anchor": { "x": 0, "y": 0, "z": 5 },
            "size": { "width": 24, "height": 1, "length": 6 }
          }
        }
      ]
    }
  ]
}
```

## Example

```json
{
  "version": "0.1",
  "name": "Starter Cabin",
  "grid": { "unitBlocks": 1 },
  "bounds": { "width": 9, "height": 8, "length": 9 },
  "palette": {
    "foundation": "minecraft:cobblestone",
    "wall": "minecraft:oak_planks",
    "floor": "minecraft:oak_planks",
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
        "size": { "width": 9, "height": 1, "length": 9 }
      },
      "materials": { "main": "foundation" }
    },
    {
      "id": "main_room",
      "type": "RoomShell",
      "inputs": [{ "ref": "foundation" }],
      "placement": {
        "anchor": { "x": 1, "y": 1, "z": 1 },
        "size": { "width": 7, "height": 3, "length": 7 }
      },
      "materials": { "wall": "wall" },
      "options": {
        "includeFloor": false,
        "includeCeiling": false
      }
    },
    {
      "id": "porch_deck",
      "type": "Platform",
      "inputs": [{ "ref": "foundation" }],
      "placement": {
        "anchor": { "x": 3, "y": 1, "z": 0 },
        "size": { "width": 3, "height": 1, "length": 1 }
      },
      "materials": { "main": "floor" }
    },
    {
      "id": "front_door",
      "type": "Door",
      "inputs": [{ "ref": "main_room" }],
      "placement": {
        "target": "main_room",
        "wall": "front",
        "offset": 3,
        "y": 0
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
        "y": 1,
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
- bounds, component counts, or estimated expanded blocks over the active `policy.sizeTier` budget
- repeat sources that are missing, non-anchored, or unsupported
- repeated clones outside logical bounds
- duplicate assembly IDs
- instance references to unknown assemblies
- instance placements outside global logical bounds
- assembly-local references to missing local components
- unsupported `grid.unitBlocks`
- unknown material role references
- attached components that reference non-attachable targets
- cover components whose generated roof volume would exceed `bounds.height`
- attached components that exceed target wall width or height

Errors should be structured for repair:

```json
{
  "severity": "error",
  "stage": "component-validation",
  "code": "UNKNOWN_COMPONENT_REF",
  "componentId": "front_window",
  "sectionId": "midship_center",
  "assemblyId": "window_bay_module",
  "instanceId": "port_window_bay_03",
  "path": "components[3].inputs[0].ref",
  "message": "Component front_window references unknown component room1.",
  "availableRefs": ["foundation", "main_room"],
  "repairHint": "Change inputs[0].ref to main_room or define component room1."
}
```

Diagnostic fields are intentionally agent-friendly:

- `severity` is `"error"` or `"warning"`; current validation failures are errors.
- `stage` identifies the pipeline stage, such as `"component-validation"`.
- `code` is stable enough for repair logic.
- `componentId`, `sectionId`, `assemblyId`, and `instanceId` identify the failing authoring context when available.
- `path` points to the approximate JSON location when schema validation can provide it.
- `availableRefs` lists valid alternatives for broken references when available.
- `repairHint` should be concise and directly actionable.

Use `diagnosticsFromError(error)` from `@i365dev/craftdag-core` when an agent or CLI needs a normalized diagnostic array instead of parsing thrown error strings.

## Roof Semantics

Use `GableRoof` when the prompt asks for a pitched, triangular roof volume.

Use `FlatRoof` when the prompt asks for a low cover:

- market canopy
- awning
- well roof
- tower cap
- flat building roof
- covered bridge cap

`FlatRoof` expands to a one-logical-unit-thick `SolidBox` directly above the covered component. With `grid.unitBlocks: 2`, that becomes two Minecraft blocks thick because logical units scale during expansion.

`GableRoof` height depends on its covered span:

```text
bounds.height * unitBlocks >=
  (covered.anchor.y + covered.size.height) * unitBlocks
  + ceil(slopeSpan * unitBlocks / 2)
```

Where `slopeSpan` is the covered Z length when `direction` is `"x"`, or the covered X width when `direction` is `"z"`. `overhang` can increase this span. If validation reports a roof height error, increase `bounds.height`, reduce the covered span, reduce `overhang`, or use `FlatRoof` if the intended shape is a low cover.

## Expansion Contract

The expander must be pure and deterministic.

For each component, generate stable CraftDAG node IDs:

```text
<componentId>__<partName>
```

Examples:

- `main_room__shell`
- `front_door__opening`
- `gate_passage__opening`
- `portal_surface__portal`
- `roof__gable`
- `canopy_roof__flat_roof`

The expansion pipeline should be:

```text
validate ComponentPlan
-> expand ComponentPlan to CraftDAG
-> validate CraftDAG
-> compile CraftDAG to VoxelPlan
```

MinePilot should be able to display each stage so agent outputs can be inspected and repaired.
