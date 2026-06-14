# Large Builds With ComponentPlan

This guide defines the first scalable authoring pattern for large CraftDAG / MinePilot builds.

Large builds should not be written as thousands of low-level coordinates. Agents should describe repeated architectural modules once, place them with deterministic instances, then let the engine expand them.

## Core Pattern

Use three levels:

1. Global plan bounds and palette.
2. Reusable local `assemblies`.
3. Top-level `Instance` components that place assemblies into the global plan.

Use `Repeat` inside an assembly for a simple linear rhythm, such as a row of posts or repeated wall bays. Use `Instance` when the repeated unit has several components, such as a tower with windows and a roof cap.

## V1 Scope

Supported now:

- local assembly definitions with `id`, `bounds`, and `components`
- top-level `Instance` components with `placement.assembly` and `placement.anchor`
- deterministic expanded IDs: `<instanceId>__<localComponentId>__<partName>`
- assembly-local validation for references, bounds, covers, attachments, and repeats
- global instance bounds validation
- budget checks that count authored components and estimated expanded components

Intentionally not supported in v1:

- rotation
- mirroring
- nested `Instance` components inside assemblies
- arbitrary loops or coordinate expressions
- per-instance material overrides
- redstone-specific semantics

Keep this scope small. The goal is to make large builds possible without making the authoring space hard for LLMs to understand.

## Agent Authoring Rules

- Define each repeated module once in `assemblies`.
- Keep assembly-local anchors near `{ "x": 0, "y": 0, "z": 0 }`.
- Keep assembly bounds tight around the module.
- Place instances only at top level.
- Use top-level `Instance.inputs` only for ordering against concrete top-level components, such as a shared foundation.
- Do not reference top-level components from inside an assembly.
- Do not reference an `Instance` or `Repeat` as a physical target.
- Prefer one or two reusable modules over many near-duplicate modules.

## Example Uses

Castle:

- `tower_module`: tower shell, windows, flat cap
- `wall_bay_module`: wall segment, battlement posts, gate opening
- top-level instances: four towers, several wall bays, central keep

Bridge:

- `pier_module`: support posts and cap beam
- `deck_bay_module`: platform, side beams, low rail posts
- top-level instances: repeated piers and bays across a river span

Large ship:

- `hull_section_module`: platform/deck and side beams
- `mast_module`: post and cross beams
- top-level instances: repeated hull sections, two or three mast modules

Landmark-inspired build:

- Identify the dominant repeated module first.
- Preserve silhouette, symmetry, major masses, and repeated facade rhythm.
- Omit exact sculpture, tiny ornament, and block-perfect dimensions.

## Probe Fixtures

Large-build probes live in `examples/component-plans`.

- `large-castle.componentplan.json` exercises repeated tower and wall-bay instances around a courtyard and keep.
- `long-fortified-bridge.componentplan.json` exercises repeated bridge deck, pier, and tower modules across a long span.

These are not polished product templates. They are regression fixtures and authoring probes for checking whether the current ComponentPlan surface is large enough for agent-generated structures.

## Relationship To Redstone

Redstone should remain a future module family. Assembly/Instance is useful groundwork for redstone later because circuits also need reusable modules, stable IDs, validation, and deterministic placement. Do not mix redstone semantics into large-build assemblies until the base architectural system is stable.
