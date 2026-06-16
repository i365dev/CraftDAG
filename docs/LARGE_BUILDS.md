# Large Builds With ComponentPlan

This guide defines the first scalable authoring pattern for large CraftDAG / MinePilot builds.

Large builds should not be written as thousands of low-level coordinates. Agents should describe repeated architectural modules once, place them with deterministic instances, then let the engine expand them.

## Core Pattern

Use four levels:

1. Global plan bounds and palette.
2. Optional `sections` for large local regions.
3. Reusable local `assemblies`.
4. `Instance` components that place assemblies into a root plan or section.

Use `Repeat` inside an assembly for a simple linear rhythm, such as a row of posts or repeated wall bays. Use `Instance` when the repeated unit has several components, such as a tower with windows and a roof cap.

## V1 Scope

Supported now:

- sectioned ComponentPlans with `id`, `origin`, `bounds`, optional local `assemblies`, and local `components`
- section-local validation and deterministic global coordinate composition
- section-expanded IDs: `<sectionId>__<componentId>__<partName>`
- local assembly definitions with `id`, `bounds`, and `components`
- top-level `Instance` components with `placement.assembly` and `placement.anchor`
- deterministic expanded IDs: `<instanceId>__<localComponentId>__<partName>`
- assembly-local validation for references, bounds, covers, attachments, and repeats
- global instance bounds validation
- budget checks that count authored components and estimated expanded components
- `policy.sizeTier: "monumental"` for bounded sectioned builds up to `256 x 96 x 256`

Intentionally not supported in v1:

- rotation
- mirroring
- nested `Instance` components inside assemblies
- arbitrary loops or coordinate expressions
- per-instance material overrides
- redstone-specific semantics
- cross-section component references

Keep this scope small. The goal is to make large builds possible without making the authoring space hard for LLMs to understand.

## Agent Authoring Rules

- Use `sections` when one global coordinate space becomes hard to reason about.
- Keep each section's local components inside `section.bounds`.
- Use `section.origin` to place the section in global space.
- Reuse root assemblies across sections when the same module appears in multiple sections.
- Use section-local assemblies for modules that belong only to one section.
- Define each repeated module once in `assemblies`.
- Keep assembly-local anchors near `{ "x": 0, "y": 0, "z": 0 }`.
- Keep assembly bounds tight around the module.
- Place instances only in the root component list or inside section component lists.
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

- sections: `bow`, `midship_front`, `midship_center`, `midship_rear`, `stern`
- root assembly: `mast_module`
- section-local components: decks, compartments, boiler room, engine room
- section or root instances: repeated mast, lifeboat, deckhouse, and funnel modules

Landmark-inspired build:

- Identify the dominant repeated module first.
- Preserve silhouette, symmetry, major masses, and repeated facade rhythm.
- Omit exact sculpture, tiny ornament, and block-perfect dimensions.

## Probe Fixtures

Large-build probes live in `examples/component-plans`.

- `large-castle.componentplan.json` exercises repeated tower and wall-bay instances around a courtyard and keep.
- `long-fortified-bridge.componentplan.json` exercises repeated bridge deck, pier, and tower modules across a long span.
- `sectioned-wall.componentplan.json` exercises section-local components, root assemblies reused inside sections, and global coordinate composition.
- `xi-an-bell-tower-study.componentplan.json` exercises a large landmark with a square masonry base, cross passages, stacked timber halls, broad eaves, stairs, railings, and a roof finial.
- `giant-wild-goose-pagoda-study.componentplan.json` exercises tall setback massing, repeated eave levels, a high vertical silhouette, and support diagnostics on monumental tower forms.

These are not polished product templates. They are regression fixtures and authoring probes for checking whether the current ComponentPlan surface is large enough for agent-generated structures.

For the current coverage matrix and support-diagnostic interpretation, see `docs/BUILD_COVERAGE_MATRIX.md`.

## Relationship To Redstone

Redstone should remain a future module family. Assembly/Instance is useful groundwork for redstone later because circuits also need reusable modules, stable IDs, validation, and deterministic placement. Do not mix redstone semantics into large-build assemblies until the base architectural system is stable.
