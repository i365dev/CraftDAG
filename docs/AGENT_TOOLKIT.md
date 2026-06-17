# CraftDAG Agent Toolkit

This guide is for coding and harness agents that author CraftDAG build plans in a repository workflow.

Use it with:

- `docs/llm.txt`
- `docs/COMPONENT_PLAN_SPEC.md`
- `docs/LLM_AUTHORING_CONTRACT.md`
- `docs/LARGE_BUILDS.md`
- `docs/SHAPE_PRIMITIVES.md`

## Mental Model

```text
natural-language build intent
-> ComponentPlan JSON written by the agent
-> CraftDAG expansion
-> VoxelPlan target state
-> materials, layers, preview, schematic export
```

ComponentPlan is the primary agent-authored format. Agents should not directly hand-place hundreds of low-level boxes unless they are debugging the compiler or writing a tiny fixture.

## Recommended Loop

1. Read `docs/llm.txt`.
2. Pick the nearest example from `examples/component-plans`.
3. Draft or edit one ComponentPlan JSON file.
4. Run validation through the test suite or a small local script using `validateComponentPlan`.
5. Expand with `expandComponentPlan` when debugging generated CraftDAG node IDs.
6. Compile with `compileComponentPlan` to inspect voxel output.
7. Inspect materials, layers, budget diagnostics, and support diagnostics.
8. Repair the ComponentPlan.
9. Repeat until valid and recognizable.
10. Export or hand the plan to MinePilot preview once package versions are aligned.

## Current Commands

The published CLI currently targets low-level CraftDAG JSON:

```bash
pnpm --filter @i365dev/craftdag-cli build
node packages/cli/dist/index.js validate examples/starter-house.craftdag.json
node packages/cli/dist/index.js compile examples/starter-house.craftdag.json --output /tmp/starter-house.voxel.json
node packages/cli/dist/index.js materials examples/starter-house.craftdag.json
node packages/cli/dist/index.js layers examples/starter-house.craftdag.json
node packages/cli/dist/index.js export examples/starter-house.craftdag.json --format schem --out /tmp/starter-house.schem
```

Note: the low-level `compile` command uses `--output`; file-writing ComponentPlan commands use `--out`.

For ComponentPlan work, use the component command group:

```bash
node packages/cli/dist/index.js component validate examples/component-plans/taj-dome-study.componentplan.json --json
node packages/cli/dist/index.js component expand examples/component-plans/taj-dome-study.componentplan.json --out /tmp/taj-dome.craftdag.json
node packages/cli/dist/index.js component compile examples/component-plans/taj-dome-study.componentplan.json --out /tmp/taj-dome.voxel.json
node packages/cli/dist/index.js component materials examples/component-plans/taj-dome-study.componentplan.json --json
node packages/cli/dist/index.js component layers examples/component-plans/taj-dome-study.componentplan.json --json
node packages/cli/dist/index.js component support examples/component-plans/taj-dome-study.componentplan.json --json
node packages/cli/dist/index.js component export examples/component-plans/taj-dome-study.componentplan.json --format schem --out /tmp/taj-dome.schem
```

`packages/core/test/componentPlanExamples.test.ts` validates, expands, compiles, and produces metadata for the reference ComponentPlan examples.

Use the regression suite before committing changes:

```bash
pnpm --filter @i365dev/craftdag-cli test
pnpm --filter @i365dev/craftdag-core test
pnpm --filter @i365dev/craftdag-core typecheck
pnpm lint
```

## ComponentPlan CLI Contract

These commands are the stable harness-agent interface:

```bash
craftdag component validate path/to/plan.componentplan.json --json
craftdag component expand path/to/plan.componentplan.json --out expanded.craftdag.json
craftdag component compile path/to/plan.componentplan.json --out voxel.json
craftdag component materials path/to/plan.componentplan.json --json
craftdag component layers path/to/plan.componentplan.json --json
craftdag component support path/to/plan.componentplan.json --json
craftdag component export path/to/plan.componentplan.json --format schem --out build.schem
```

`craftdag verify-schem build.schem --against voxel.json --json` is future work.

Prefer JSON output for agent loops. Human-formatted output is useful for local debugging, but agents need stable fields such as `stage`, `code`, `componentId`, `path`, and `repairHint`.

For support checks, read `summary.qualityGate.status` first:

- `pass`: no blocking or review diagnostics.
- `review`: connected spans, eaves, rails, roofs, trees, or stairs need visual/structural review before publishing.
- `block`: unexpected disconnected or floating source nodes should be repaired before export or publishing confidence.

## Error Repair Pattern

When a command fails, agents should treat diagnostics as edit instructions:

```json
{
  "stage": "component-validation",
  "code": "COMPONENT_OUT_OF_BOUNDS",
  "componentId": "north_tower",
  "repairHint": "Move the component anchor, reduce its size, or increase the plan bounds."
}
```

Do:

- make the smallest plan edit that addresses the diagnostic
- rerun validation
- keep build intent recognizable

Do not:

- remove validation
- add unsupported fields
- replace a semantic component with hundreds of low-level coordinates
- hide floating geometry by marking everything decorative

## Golden Agent Tasks

These tasks should be solvable from docs and examples alone:

- Small cottage: `Foundation`, `RoomShell`, `Door`, `Window`, `GableRoof`.
- Medium gatehouse: `RoomShell`, `Opening`, `FlatRoof`, `SupportPost`, `RailingRun`.
- Castle wall: assemblies, `Instance`, `Repeat`, `StairRun`, `ArcadeRun`.
- Large ship interior: sections, `Compartment`, `Corridor`, `StairRun`.
- Landmark dome study: `SteppedTier`, `RoomShell`, `ArcadeRun`, `SteppedDome`.
- Garden scene: `TreeCanopy`, `OrganicPatch`, `PathRun`, `RockCluster`.

Functional/redstone tasks should wait for module support. Until then, describe desired behavior in issue docs, not arbitrary redstone wire layouts.

## Large Build Authoring Patterns

These patterns emerge from real landmark-scale builds. They are not component-specific but describe how to combine primitives for complex structures.

### Curved and diagonal structures

Use multi-segment `DiagonalBeam` chains to approximate curves and sloped lines. Each segment changes angle slightly:

```json
{ "id": "leg_a", "from": { "x": 16, "y": 1,  "z": 16 }, "to": { "x": 22, "y": 14, "z": 22 }, "thickness": 4 },
{ "id": "leg_b", "from": { "x": 22, "y": 14, "z": 22 }, "to": { "x": 28, "y": 30, "z": 28 }, "thickness": 3 },
{ "id": "leg_c", "from": { "x": 28, "y": 30, "z": 28 }, "to": { "x": 35, "y": 48, "z": 35 }, "thickness": 2 }
```

Key rules:
- Decreasing `thickness` as the structure rises (4→3→2) looks more natural
- Connect segments with `inputs: [{ "ref": "previous_segment" }]`
- Plan segment endpoints so the chain passes near (not through) intermediate platforms
- Three segments is usually enough; four for very tall structures

### Converging towers and spires

`SteppedDome` with `hollow: true` creates a lattice framework that shrinks toward the top. Calculate the final size: `final = width - (levels - 1) × 2 × insetPerLevel`. Do NOT exceed 1x1 or the dome collapses.

After the dome reaches minimum size, use `CircleRing` with constant radius for an equal-width top section, then cap with `SteppedDome` (solid, not hollow).

### Circular platforms and fences

`CircleRing` with `fill: "solid"` and `thickness` creates a solid circular platform. Use a second `CircleRing` with slightly larger radius + `fill: "hollow"` + `thickness: 1` as a fence ring on top.

For partial arcs (archways, semicircle balconies): use `startAngle`/`endAngle`. 0° = +X axis, counterclockwise.

### Observation decks

Pattern: `Platform` (floor) → `Beam` (thick edges, 2 blocks high, placed outside the floor perimeter) → `RailingRun` (thin fence on top of the beam).

Make the Beam edges extend 2 blocks beyond the floor on each side so visitors have a balcony to stand on.

### Deck supports

If a platform sits on top of converging legs, add cross-support beams underneath. Use `DiagonalBeam` from each leg corner toward the deck center, placed at y = deck.y - 2. This prevents "floating platform" diagnostics.

### Proportion iteration

Large landmark builds typically need 5-10 iterations to get proportions right. Start with rough coordinates, validate, compile, preview in MinePilot, then adjust. The `--dry-run` flag helps catch shape primitive collapse before compiling.

## Common Pitfalls

| Pitfall | Why it happens | Fix |
|---------|---------------|-----|
| Shape primitive collapse | `insetPerLevel` × `levels` shrinks below 1×1 | Pre-calculate: `width - (levels-1)×2×inset` must be ≥ 2 |
| Diagonal beam goes out of bounds | Thickness loop creates blocks at negative coords | Start `from` at least `thickness` away from edge |
| CircleRing arc extends past bounds | Center ± radius exceeds plan dimensions | Ensure `center.z - radius ≥ 0` and `center.z + radius ≤ bounds.length` |
| Floating deck diagnostics | Platform has no blocks underneath | Add `DiagonalBeam` cross-supports from legs to deck center |
| Instance can't be an input target | v0.1 rule: only physical components can be referenced | Use the assembly's internal component ID directly, or add intermediate `Platform` |
| Repeat can't repeat Instance | v0.1 limitation (fixed in 0.1.8) | Use `Repeat(source=Instance, ...)` — supported since 0.1.8 |
| Wall attachments don't work on all components | Only `RoomShell`, `Compartment`, `Corridor` support wall attachment | Use a RoomShell wrapper, or place the attachment component separately |

## Reference Examples

- `examples/component-plans/stair-run-multilevel.componentplan.json`
- `examples/component-plans/large-castle.componentplan.json`
- `examples/component-plans/large-ship-interior.componentplan.json`
- `examples/component-plans/long-fortified-bridge.componentplan.json`
- `examples/component-plans/taj-dome-study.componentplan.json`
- `examples/component-plans/temple-palace-dome-study.componentplan.json`
- `examples/component-plans/xi-an-bell-tower-study.componentplan.json`
- `examples/component-plans/giant-wild-goose-pagoda-study.componentplan.json`
- `examples/component-plans/landscape-canopy-patch.componentplan.json`
- `examples/component-plans/path-rock-garden.componentplan.json`

## Repository Boundary

CraftDAG is the engine and toolkit. MinePilot is the user-facing app and preview surface.

Do not create a new repository for agent orchestration until the toolkit workflow grows beyond docs, examples, and CLI contracts.
