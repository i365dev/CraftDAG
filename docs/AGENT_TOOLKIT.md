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

## Reference Examples

- `examples/component-plans/stair-run-multilevel.componentplan.json`
- `examples/component-plans/large-castle.componentplan.json`
- `examples/component-plans/large-ship-interior.componentplan.json`
- `examples/component-plans/long-fortified-bridge.componentplan.json`
- `examples/component-plans/taj-dome-study.componentplan.json`
- `examples/component-plans/temple-palace-dome-study.componentplan.json`
- `examples/component-plans/landscape-canopy-patch.componentplan.json`
- `examples/component-plans/path-rock-garden.componentplan.json`

## Repository Boundary

CraftDAG is the engine and toolkit. MinePilot is the user-facing app and preview surface.

Do not create a new repository for agent orchestration until the toolkit workflow grows beyond docs, examples, and CLI contracts.
