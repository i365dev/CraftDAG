# CraftDAG Project Brief

CraftDAG is an open building-plan DSL and compiler for Minecraft-oriented construction workflows.

It is the open core behind MinePilot. MinePilot is the user-facing app; CraftDAG is the deterministic engine that turns structured building intent into a target block state, metadata, and downstream outputs.

## Why this project exists

Most AI Minecraft experiments try to make a language model directly control a bot inside Minecraft. That path is impressive as a demo, but it is unstable for construction tasks. The model has to design the structure, remember the plan, reason about coordinates, handle block placement constraints, recover from errors, and interact with a live game environment.

CraftDAG takes a different approach:

```text
Natural language idea
→ ComponentPlan
→ CraftDAG building plan
→ schema validation
→ graph validation
→ voxel compilation
→ preview / material list / layer guide / file output / future executor
```

The model should not directly write Mineflayer code, WorldEdit commands, or raw block placement commands. For most agent workflows, the model should produce a constrained, inspectable, repairable ComponentPlan. The deterministic engine expands that plan to CraftDAG and compiles it to Voxel Plan.

## Core philosophy

1. LLMs are for intent translation, style selection, and plan generation.
2. ComponentPlan is the preferred agent-authored architectural DSL.
3. CraftDAG is the low-level compiler IR for structure, validation, determinism, and repeatability.
4. Voxel Plan is the compiled target state.
5. Exporters and executors consume Voxel Plan, not raw model output.
6. The first version should be small, boring, and reliable.

This is closer to Terraform or Kubernetes desired-state thinking than to an autonomous game bot.

## What CraftDAG is

CraftDAG is:

- a declarative DSL for small Minecraft building plans
- an expansion target for higher-level ComponentPlan documents
- a schema-validated document format
- a dependency graph of semantic building primitives
- a compiler from semantic primitives to voxel target state
- a source of material counts and layer-by-layer construction guides
- a foundation for later file exporters and bot executors

## What CraftDAG is not

CraftDAG is not:

- a general Minecraft agent
- a Mineflayer replacement
- a redstone generator
- a city generator
- a survival automation bot
- a Bedrock-first platform
- a free-form JavaScript execution environment
- a direct WorldEdit command generator

## Product relationship

CraftDAG and MinePilot should be separated:

```text
CraftDAG = open core engine
MinePilot = user-facing product / playground / hosted app
```

CraftDAG should be usable without MinePilot. MinePilot should depend on CraftDAG as a library or package.

## Initial target

The first useful target is not a giant castle or full game automation. The first target is:

> Generate small, survival-friendly Java Edition builds that can be previewed, explained, and exported.

Good first build types:

- starter house
- watchtower
- small bridge
- mine entrance
- nether portal room
- storage room shell

Avoid first:

- large castles
- cities
- organic sculptures
- complex redstone
- pathfinding construction bot
- automatic survival resource gathering

## Recommended architecture

```text
ComponentPlan document
  ↓ component schema validation
  ↓ deterministic expansion
CraftDAG document
  ↓ CraftDAG schema validation
Validated document
  ↓ graph validation + topological sort
Semantic DAG
  ↓ primitive compilation
Voxel Plan
  ↓ derived outputs
Material list
Layer guide
Preview mesh data
Schematic-compatible file output
Future Litematica output
Future build queue
Future bot executor
```

## Main packages

Recommended TypeScript monorepo:

```text
packages/core
packages/cli
packages/exporter-schem
packages/renderer-data
examples
docs
```

### packages/core

Owns the domain model:

- CraftDAG schema
- primitive types
- graph validation
- topological sorting
- Voxel Plan IR
- primitive compilers
- material list generation
- layer guide generation

This package must not depend on MinePilot UI or Mineflayer.

### packages/cli

A developer-facing tool for local validation and compilation:

- validate a CraftDAG file
- compile to Voxel Plan JSON
- print material counts
- print layer data
- call exporters when available

### packages/exporter-schem

Converts Voxel Plan into a schematic-compatible output for Minecraft Java workflows.

This package should depend on Voxel Plan, not on CraftDAG nodes directly.

### packages/renderer-data

Optional later package. Converts Voxel Plan into a simple renderable data shape for web preview.

## CraftDAG document model

CraftDAG is the low-level compiler IR. It should describe semantic primitives, not every final block, but it is still more coordinate-oriented than the agent-facing ComponentPlan layer.

For LLM authoring guidance, start with `docs/COMPONENT_PLAN_SPEC.md`. Use raw CraftDAG generation only for low-level tests, fixtures, and advanced debugging.

Initial shape:

```ts
type CraftDagDocument = {
  version: "0.1"
  name: string
  size: Vec3
  palette?: Record<string, string>
  nodes: CraftDagNode[]
}
```

`size` defines the bounding box of the build in relative coordinates. Keep builds bounded from the start.

## Node model

Every node should have:

- `id`: unique stable identifier
- `type`: primitive type
- `inputs`: optional dependency references
- `params`: type-specific parameters

Example:

```json
{
  "id": "foundation",
  "type": "SolidBox",
  "params": {
    "from": [0, 0, 0],
    "to": [8, 0, 8],
    "block": "minecraft:stone_bricks"
  }
}
```

Dependencies should use references:

```json
"inputs": [{ "ref": "foundation" }]
```

Do not inline nodes inside inputs.

## Initial primitives

Start with a small primitive set:

- `SolidBox`: fill a rectangular volume
- `HollowBox`: create the shell of a rectangular volume
- `Wall`: create a vertical plane
- `Floor`: create a horizontal plane
- `Column`: create a vertical support
- `Doorway`: create or clear a door opening
- `Window`: create or fill a window opening
- `GableRoof`: create a simple roof

The primitive set should stay small until the compiler is stable.

## Voxel Plan

Voxel Plan is the internal compiled representation.

It is not the public DSL in v0.1. It is an internal IR that downstream modules consume.

Conceptually:

```ts
type VoxelPlan = {
  version: "0.1"
  name: string
  size: Vec3
  origin: Vec3
  blocks: VoxelBlock[]
}

type VoxelBlock = {
  pos: Vec3
  block: BlockState
  sourceNodeId?: string
}

type BlockState = {
  name: string
  properties?: Record<string, string>
}
```

Important design point:

- Voxel Plan is target state.
- It is not an action list.
- It says what blocks should exist, not how a bot should place them.

Later, a build queue or executor can derive actions from Voxel Plan.

## Validation principles

CraftDAG should fail early and clearly.

Validation layers:

1. JSON/schema validation
2. graph validation
3. compile-time bounds validation
4. block name validation
5. output target validation

Required rules:

- reject unknown fields
- reject unknown node types
- reject duplicate ids
- reject missing references
- reject cycles
- reject invalid coordinates
- reject out-of-bounds blocks
- keep generated builds within document size

## Conflict policy

In v0.1, a later node in topological order may overwrite an earlier block. This is useful for openings such as doors and windows.

The behavior must be deterministic. If possible, record source node metadata so preview/debug tools can explain where a block came from.

## LLM generation strategy

Do not start with free-form full-DAG generation.

Recommended phases:

### Phase A: no model

Hand-write CraftDAG examples and make the compiler work.

### Phase B: prompt to template config

Map user text to a small config:

```json
{
  "buildType": "starter_house",
  "size": [9, 7, 9],
  "style": "medieval",
  "materials": {
    "foundation": "minecraft:stone_bricks",
    "wall": "minecraft:oak_planks",
    "roof": "minecraft:dark_oak_planks",
    "glass": "minecraft:glass_pane"
  },
  "features": ["door", "windows"]
}
```

Then deterministic templates generate CraftDAG.

### Phase C: model-generated CraftDAG

Only after schema, examples, validation errors, and repair prompts are stable should the model produce full CraftDAG JSON.

## Quality bar

The first successful output should be:

- small
- bounded
- understandable
- previewable
- exportable
- survival-friendly
- easy to inspect

It does not need to look like a professional Minecraft builder's work. It must be better than a broken half-built agent demo.

## First implementation sequence

Recommended order:

1. repository structure
2. schema types
3. graph validation
4. Voxel Plan IR
5. SolidBox / Wall / Floor / Column compilers
6. material counts
7. layer guide
8. HollowBox / Doorway / Window / GableRoof
9. examples
10. CLI
11. schematic-compatible output

Do not start with Mineflayer or game integration.

## Definition of done for v0.1

CraftDAG v0.1 is successful when:

- at least three examples validate
- at least three examples compile to Voxel Plan
- material lists are correct
- layer guides are generated
- one starter house example can be previewed by MinePilot
- one output path can generate a file for a Java Edition building workflow

## Naming

Use:

- CraftDAG for the open core engine
- MinePilot for the product/user-facing app
- Voxel Plan for the internal compiled target state
- primitive for semantic building nodes
- exporter for output adapters
- executor for future bot/game integration

Avoid describing CraftDAG as an agent. It is a compiler and build-plan engine.
