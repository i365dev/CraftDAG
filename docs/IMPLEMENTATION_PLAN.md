# CraftDAG Implementation Plan

This document is the main coding-agent brief for implementing CraftDAG.

Before writing code, read `docs/PROJECT_BRIEF.md`.

## Goal of the first implementation

Build the smallest reliable version of the CraftDAG engine:

```text
CraftDAG JSON
→ validate
→ graph order
→ compile primitives
→ Voxel Plan
→ material list
→ layer guide
→ examples
→ CLI
```

Do not implement Mineflayer, Litematica, Bedrock, redstone, or survival automation in the first pass.

## Next implementation goal

After the raw CraftDAG compiler and schematic exporter are working, the next engine milestone is ComponentPlan:

```text
ComponentPlan JSON
→ validate component schema
→ validate semantic component DAG
→ expand to CraftDAG JSON
→ validate CraftDAG
→ compile primitives
→ Voxel Plan
```

ComponentPlan is the preferred authoring layer for agents and LLMs. CraftDAG remains the deterministic compiler IR.

The first ComponentPlan implementation should stay deliberately small:

- `Foundation`
- `RoomShell`
- `Door`
- `Window`
- `GableRoof`
- optional `SupportPost`

Do not start with a broad component marketplace. The priority is a reliable authoring contract, deterministic expansion, structured validation errors, and clear preview/debug stages.

## Recommended repository structure

```text
packages/
  core/
    src/
      index.ts
      types.ts
      schema.ts
      graph.ts
      voxel/
        VoxelGrid.ts
        types.ts
      compiler/
        components/
          expandComponentPlan.ts
          components/
            foundation.ts
            roomShell.ts
            door.ts
            window.ts
            gableRoof.ts
            supportPost.ts
        compileDocument.ts
        primitives/
          solidBox.ts
          wall.ts
          floor.ts
          column.ts
          hollowBox.ts
          doorway.ts
          window.ts
          gableRoof.ts
      metadata/
        materials.ts
        layers.ts
      errors.ts
    test/
  cli/
    src/
      index.ts
  exporter-schem/
    src/
      index.ts
examples/
  starter-house.craftdag.json
  watchtower.craftdag.json
  small-bridge.craftdag.json
docs/
```

## Package responsibilities

### packages/core

Core must be pure TypeScript domain logic. It should not depend on React, Next.js, Mineflayer, or browser APIs.

Core owns:

- document types
- schema validation
- graph validation
- dependency ordering
- Voxel Plan data model
- primitive compilation
- material counting
- layer slicing

### packages/cli

CLI is a thin wrapper around `packages/core`.

It should be useful for quick local testing and coding-agent validation.

### packages/exporter-schem

This package is later-stage. It should convert Voxel Plan to a Minecraft Java building file. It must not parse CraftDAG directly.

## Step 1: project setup

Use:

- TypeScript
- pnpm workspace
- Vitest
- tsup or similar

Root scripts:

- `build`
- `test`
- `typecheck`
- `lint`

Keep the setup minimal. Do not over-engineer release tooling.

## Step 2: domain types

Define:

```ts
type Vec3 = [number, number, number]
```

Initial document:

```ts
type CraftDagDocument = {
  version: "0.1"
  name: string
  size: Vec3
  palette?: Record<string, string>
  nodes: CraftDagNode[]
}
```

Base node shape:

```ts
type BaseNode<T extends string, P> = {
  id: string
  type: T
  inputs?: Array<{ ref: string }>
  params: P
}
```

Initial primitive nodes:

- SolidBox
- Wall
- Floor
- Column
- HollowBox
- Doorway
- Window
- GableRoof

Use discriminated unions.

## Step 2.5: ComponentPlan types

Add a higher-level document type for agent-authored plans. See `docs/COMPONENT_PLAN_SPEC.md` for the full contract.

Recommended shape:

```ts
type ComponentPlanDocument = {
  version: "0.1"
  name: string
  grid?: {
    unitBlocks?: 1 | 2
  }
  bounds: {
    width: number
    height: number
    length: number
  }
  palette: Record<string, string>
  components: ComponentNode[]
}
```

All component placements use logical units. The expander converts logical units to block coordinates. `grid.unitBlocks` defaults to `1`.

Scaling should happen during ComponentPlan expansion, not by post-scaling the final Voxel Plan. Component-aware scaling lets the engine keep doors, windows, roofs, and openings coherent.

## Step 3: schema validation

Use Zod or an equivalent library.

Validation should reject:

- unknown fields
- unknown node types
- invalid Vec3 values
- invalid params
- empty ids
- invalid document version

Schema validation does not need to detect cycles. That belongs to graph validation.

For ComponentPlan, validation should return structured repairable errors:

- validation stage
- stable error code
- component ID when applicable
- JSON path
- human-readable message
- repair hint
- available alternatives when useful

## Step 4: graph validation

Implement:

- node id map
- duplicate id check
- input reference check
- cycle detection
- topological sort

Array order is not execution order. Dependencies decide order.

If a node references another node in `inputs`, the referenced node must compile first.

Return clear domain errors. Do not just throw generic strings.

ComponentPlan has semantic graph validation before expansion. `components[].inputs` means "attaches to", "cuts into", "covers", or "depends on" at the architectural level. The expander owns the mapping from those semantic dependencies to low-level CraftDAG node inputs and overwrite order.

## Step 5: Voxel Plan

Voxel Plan is the compiled target state.

Recommended internal types:

```ts
type BlockState = {
  name: string
  properties?: Record<string, string>
}

type VoxelBlock = {
  pos: Vec3
  block: BlockState
  sourceNodeId?: string
}

type VoxelPlan = {
  version: "0.1"
  name: string
  size: Vec3
  origin: Vec3
  blocks: VoxelBlock[]
}
```

Implement an internal grid/map for compilation. A string key like `x,y,z` is acceptable for v0.1.

Required helpers:

- `setBlock(pos, block, sourceNodeId)`
- `getBlock(pos)`
- `deleteBlock(pos)` or set air/clear helper
- `hasBlock(pos)`
- `toVoxelPlan()`
- bounds check

Conflict behavior:

- deterministic overwrites are allowed
- later compiled nodes can overwrite earlier blocks
- this enables windows and doors to cut into walls

## Step 6: primitive compilers batch 1

Implement first:

### SolidBox

Params:

- `from: Vec3`
- `to: Vec3`
- `block: string`

Fill the inclusive rectangular volume.

### Floor

Params:

- `from: Vec3`
- `to: Vec3`
- `block: string`

A horizontal plane. Validate that Y is constant or normalize through explicit params.

### Wall

Params:

- `from: Vec3`
- `to: Vec3`
- `block: string`

A vertical plane. Validate that either X or Z is constant.

### Column

Params:

- `from: Vec3`
- `to: Vec3`
- `block: string`

A vertical line or rectangular support.

## Step 7: metadata

Implement:

- `generateMaterialList(voxelPlan)`
- `generateLayerGuide(voxelPlan)`

Material list should count non-air blocks by block name plus properties.

Layer guide should group blocks by Y coordinate and sort by Y ascending.

## Step 8: primitive compilers batch 2

### HollowBox

Creates outer shell of a box. Do not fill the interior.

### Doorway

Creates an opening by clearing blocks in a rectangular area. It may optionally place door blocks later, but clearing is enough for v0.1.

### Window

Creates a window opening and fills it with a transparent block such as glass or glass pane.

### GableRoof

Creates a simple roof. For v0.1, prioritize deterministic shape over perfect Minecraft block states.

It is acceptable to use full blocks first instead of stairs.

## Step 9: examples

Create three examples:

1. starter house
2. watchtower
3. small bridge

Each example must:

- validate
- compile
- produce material list
- produce layer guide

## Step 10: CLI

Minimum commands:

```text
validate <file>
compile <file>
materials <file>
layers <file>
```

The CLI should be useful for agents and humans.

Example local validation flow:

```text
pnpm test
pnpm build
pnpm craftdag validate examples/starter-house.craftdag.json
pnpm craftdag compile examples/starter-house.craftdag.json
```

Adjust exact package script names as needed.

## Testing guidance

Tests should verify exact behavior, not just snapshots.

Important tests:

- duplicate ids fail
- missing refs fail
- cycles fail
- SolidBox block count
- Wall block count
- Floor block count
- Column block count
- out-of-bounds block write fails
- material counts are exact
- layers are sorted

## Coding style

- Keep functions small.
- Prefer explicit domain errors.
- Avoid global mutable state.
- Avoid hidden Minecraft client dependencies in core.
- Keep output deterministic.
- Do not call an LLM from this repository in v0.1.

## Definition of done

A first useful implementation is done when:

- `pnpm test` passes
- examples validate
- examples compile to Voxel Plan
- material counts are correct
- layer guides are generated
- MinePilot can import or copy the example output later

## Non-goals for this implementation

- no real-time bot
- no pathfinding
- no automatic survival building
- no Bedrock
- no redstone
- no world terrain adaptation
- no user accounts
- no hosted service
