# Component and Primitive Design Guide

This guide is for code-writing agents and developers extending CraftDAG.

CraftDAG should not grow by casually adding new components whenever a sample becomes easier to write. The DSL must stay compact, orthogonal, inspectable, and repairable. Every new low-level primitive or high-level ComponentPlan component increases schema surface area, LLM prompt burden, documentation cost, validation complexity, and long-term maintenance risk.

Use this guide before proposing or implementing new primitives/components.

## Core principle

```text
Agent is the author. Engine is the compiler.
```

A component is worth adding only when it helps agents express reusable Minecraft construction intent more reliably while keeping deterministic validation, expansion, preview, repair, and export simple.

Prefer:

```text
small orthogonal vocabulary
+ role metadata
+ assemblies / instances
+ repeat / sections
+ examples / diagnostics
```

Avoid:

```text
large domain-specific component catalog
+ special-case geometry
+ hidden coupling
+ model-specific shortcuts
+ components that only make one showcase easier
```

## Two-layer model

CraftDAG has two distinct layers:

### Low-level CraftDAG primitives

Low-level primitives are compiler IR. They should remain few, deterministic, and close to block placement semantics.

Examples:

- `SolidBox`
- `HollowBox`
- `Wall`
- `Floor`
- `Column`
- `Doorway`
- `Window`
- `GableRoof`

Add a low-level primitive only when the compiler needs a new fundamental voxel operation that cannot be cleanly expressed through existing primitives without excessive duplication or incorrect ordering.

### High-level ComponentPlan components

ComponentPlan is the agent-facing authoring layer. Components should describe architectural or landscape intent without requiring the agent to do block-level coordinate math.

Examples:

- `RoomShell`
- `Compartment`
- `Corridor`
- `StairRun`
- `TaperedVolume`
- `SteppedTier`
- `VerticalSetbackVolume`
- `ArcadeRun`
- `TreeCanopy`
- `OrganicPatch`
- `PathRun`
- `RockCluster`
- `Repeat`
- `Instance`

Add a high-level component only when it captures a reusable pattern that agents otherwise express verbosely or incorrectly.

## Component admission checklist

Before adding a new component, answer all questions below.

### 1. Reuse frequency

Is this pattern common across multiple build families?

Good candidates:

- repeated arch facades
- tiered massing
- tree canopies
- organic ground patches
- corridors
- compartments
- support brackets

Weak candidates:

- `TitanicHull`
- `TajMahalDome`
- `ColosseumFacade`
- `JapaneseGarden`
- `BoilerRoom` as a component type
- `EngineRoom` as a component type

If a concept is domain-specific but geometrically ordinary, use `role` metadata instead of creating a new component type.

Example:

```json
{
  "id": "boiler_room_01",
  "type": "Compartment",
  "role": "boiler_room"
}
```

### 2. Orthogonality

Does the component represent a distinct construction pattern, or does it overlap with existing components?

Ask whether the proposal is mostly one of these:

- `SolidBox` with a semantic name
- `RoomShell` with a role
- `Repeat` of an existing component
- an `Assembly` template
- a sample-specific convenience wrapper

Do not add a component merely because it shortens one example.

Acceptable overlap can exist when semantics differ meaningfully for agents and diagnostics. For example, `RoomShell` and `Compartment` expand similarly, but they carry different authoring intent: exterior/interior shell vs bounded subdivision.

### 3. Coupling risk

Will the component require special behavior across many systems?

Every new component may require updates to:

- `types.ts`
- `componentPlan.ts` schema
- expander
- validator
- budget estimator
- materials/layers
- diagnostics
- docs/spec
- examples
- LLM authoring guidance
- MinePilot sample UI
- tests

A component with broad cross-cutting behavior must have strong value. Avoid components that require many one-off exceptions.

### 4. Deterministic expansion

Can the component expand deterministically from bounded integer parameters?

Good:

- fixed axis
- bounded size
- bounded count
- monotonic step/inset
- deterministic roughness
- explicit material roles

Risky:

- freeform meshes
- probabilistic generation without seed/control
- unconstrained curves
- physics-dependent behavior
- version-dependent behavior without explicit target

Minecraft-style approximations are preferred over mathematically exact geometry.

### 5. Validation and repairability

Can the engine validate common mistakes and provide repair hints?

A component should make invalid plans easier to diagnose, not harder.

At minimum, consider diagnostics for:

- out of bounds
- over budget
- invalid dimensions
- collapsed tiers/slices
- invalid axis/direction
- missing target/reference
- unsupported component used as a physical input
- unsafe repeat/instance composition
- ambiguous material role

Agent-facing diagnostics should include codes and repair hints where possible.

### 6. Agent authoring clarity

Can an LLM reliably decide when to use this component?

Each component should have clear guidance:

- when to use it
- when not to use it
- minimum useful dimensions
- common mistakes
- example JSON
- relationship to nearby components

If the distinction between two components is hard to explain, the DSL is probably becoming too coupled.

### 7. Prompt-surface cost

Will the component increase prompt burden more than it increases expressive power?

Every new component must be explained in `llm.txt`, `COMPONENT_PLAN_SPEC.md`, examples, and agent docs. A component that saves only a few lines but requires long explanations is usually not worth adding.

### 8. Existing alternatives

Before adding a component, try these alternatives:

1. Use `role` metadata.
2. Use `Repeat`.
3. Use an `Assembly` plus `Instance`.
4. Use `sections` for large-scale decomposition.
5. Add a sample/template instead of a core component.
6. Add diagnostics or authoring guidance instead of a component.
7. Add options to an existing component only if the option remains simple and orthogonal.

If an existing component plus clearer docs solves the problem, do not add a new component.

## Decision matrix

| Question | Add component | Do not add component |
| --- | --- | --- |
| Used across many build families? | Yes | No, only one landmark/showcase |
| Hard to express with existing components? | Yes | No, just verbose by a few lines |
| Deterministic bounded expansion? | Yes | No, needs freeform generation |
| Easy for agents to choose? | Yes | No, overlaps unclearly |
| Validatable and repairable? | Yes | No, hides failure modes |
| Low prompt/documentation cost? | Yes | No, requires long explanations |
| Can role/assembly/repeat handle it? | No | Yes |

## Component categories and current intent

### Structural primitives

- `Foundation`: footprint/base slab
- `Platform`: horizontal surface
- `Beam`: span/trim/linear mass
- `RoomShell`: hollow volume
- `Compartment`: semantic room-like subdivision
- `Corridor`: interior circulation run
- `StairRun`: blocky vertical circulation run
- `SupportPost`: vertical support

### Shape primitives

- `TaperedVolume`: axis-based tapered massing
- `SteppedTier`: horizontal stepped tiers
- `VerticalSetbackVolume`: vertical setback segments
- `GableRoof`: pitched roof volume
- `FlatRoof`: flat cover/cap/canopy

### Repeated detail primitives

- `RailingRun`: posts/rails along a run
- `ArcadeRun`: repeated blocky arches
- `SupportBracket`: repeated visible cantilever/overhang support

### Landscape primitives

- `TreeCanopy`: stylized tree trunk + canopy
- `OrganicPatch`: irregular patch/pond/garden bed
- `PathRun`: continuous or stepping-stone path
- `RockCluster`: deterministic boulder/rock mass group

### Attachment and cutout primitives

- `Door`: literal door-sized entrance
- `Window`: glazed opening
- `Opening`: unfilled cutout/gate/pass-through
- `Portal`: filled vertical plane

### Composition primitives

- `Repeat`: bounded repetition of one physical source component
- `Assembly`: reusable local component group
- `Instance`: placement of an assembly
- `Section`: large-build decomposition with local origin/bounds

## Anti-patterns

### Landmark-specific components

Do not add components named after one landmark or one build.

Bad:

```text
TitanicHull
TajMahalDome
ColosseumFacade
BurjTower
JapaneseGarden
```

Prefer:

```text
TaperedVolume
SteppedTier
VerticalSetbackVolume
ArcadeRun
StairRun
TreeCanopy
OrganicPatch
Assembly + role metadata
```

### Domain roles as component types

Bad:

```text
BoilerRoom
CargoHold
EngineRoom
ThroneRoom
PrayerHall
MuseumGallery
```

Prefer:

```text
Compartment + role
RoomShell + role
Assembly + role
```

### Visual detail as core type

Do not add a core component for every decorative idea. Prefer material roles, assemblies, repeats, or samples unless the pattern is broadly reusable.

### Options explosion

Avoid adding many options to one component until it becomes an implicit component catalog.

If a component needs many modes, consider whether it should remain smaller, whether some modes belong in examples, or whether the concept is not orthogonal.

### Hidden physical semantics

Do not make a component imply physics, redstone behavior, entity behavior, or game mechanics unless the module explicitly supports and validates those semantics.

For example, `SupportBracket` may express visible support and structural intent. It is not a physics simulation.

## Required changes for new components

A component PR should normally include:

- Type definition in `types.ts`
- Zod schema in `componentPlan.ts`
- Expansion implementation
- Validation and budget behavior
- Tests for schema, expansion, compile output, and at least one failure mode
- Documentation in `COMPONENT_PLAN_SPEC.md`
- LLM/agent guidance where relevant
- At least one example or fixture that proves the component reduces authoring burden

If a component is experimental, state that explicitly in the issue/PR and avoid exposing it as the recommended authoring path until samples validate it.

## When to add a low-level CraftDAG primitive

Add a low-level primitive only when:

- it represents a fundamental voxel operation;
- it cannot be compiled cleanly from existing IR without excessive block duplication;
- it has deterministic overwrite/dependency semantics;
- it is useful to multiple high-level components;
- it does not encode one landmark, biome, or domain role.

Most new authoring capabilities should begin as high-level ComponentPlan components that expand into existing low-level primitives.

## When to add a high-level ComponentPlan component

Add a high-level component when:

- multiple examples need the same pattern;
- agents repeatedly make mistakes when writing it manually;
- the component can be explained in one short paragraph;
- validation can catch common mistakes;
- the expander can emit deterministic CraftDAG nodes;
- the component improves preview/material/layer/diagnostic output.

## Review checklist for code-writing agents

Before opening a PR that adds a component, include a short design note answering:

```text
1. What repeated build pattern does this component capture?
2. Why are existing components insufficient?
3. Which existing components does it overlap with?
4. Why is the overlap acceptable?
5. What are the bounded parameters?
6. How does it expand deterministically?
7. What validation failures can be detected?
8. What repair hints should agents receive?
9. What examples prove the component is useful?
10. How does this affect LLM authoring docs?
```

A component that cannot answer these questions should stay as an example, assembly, role, or issue discussion until the need is clearer.
