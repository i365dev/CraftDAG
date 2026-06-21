# Build Coverage Matrix

This document tracks CraftDAG coverage from the viewpoint of an agent authoring Minecraft builds.

It complements `COMPONENT_DESIGN_GUIDE.md` and issue #81. The goal is not to claim perfect coverage. The goal is to make current strengths, stress probes, and remaining gaps visible before adding more components or moving into redstone modules.

## Reading The Matrix

Coverage uses three separate signals:

- **Authoring coverage**: can an agent express the build without low-level block coordinates?
- **Compiler coverage**: can CraftDAG validate, expand, compile, and export the plan?
- **Diagnostic coverage**: do support and validation diagnostics distinguish real mistakes from intentional Minecraft-style spans, roofs, eaves, and decorative details?

Do not treat `component support --json` returning `ok: true` as "no issue". Support diagnostics may still contain warnings that need human or agent review.

## Current Coverage Snapshot

| Demand category | Stress samples | Current coverage | What works | Known gaps |
| --- | --- | --- | --- | --- |
| Survival houses and starter bases | `stair-run-multilevel` | High | Room shells, roofs, doors, windows, stairs, decks | No stair cores, elevators, or storage automation yet; ladders available via FloorStack.stairStyle="ladder" |
| Castles, walls, medieval villages | `large-castle`, `sectioned-wall`, `long-fortified-bridge` | High | Assemblies, repeated wall bays, towers, bridges, battlements | Crenellation remains assembly/repeat based; circular/octagonal towers are approximate |
| Large landmarks and monumental builds | `taj-dome-study`, `temple-palace-dome-study`, `xi-an-bell-tower-study`, `giant-wild-goose-pagoda-study` | Medium-high | Stepped podiums, domes, setback towers, arcades, large bounds, reusable modules | Support diagnostics still noisy for domes, eaves, and setback masses; radial/ring forms remain limited |
| Modern buildings and city blocks | `large-form-massing` | Medium-high | Vertical setback massing, repeated volumes, simple facade rhythms | No dedicated facade grid or floor-stack authoring pattern yet |
| Interiors and underground bases | `large-ship-interior`, `stair-run-multilevel` | Medium-high | Compartments, corridors, stairs, reusable room/deck ideas | No RoomGrid/CabinGrid; dense interiors still require manual compartments |
| Landscape and nature | `landscape-canopy-patch`, `path-rock-garden` | Medium-high | Stylized trees, organic patches, paths, rocks, gardens | Larger terrain, slopes, waterfalls, hedges, and biome-scale scenes remain future work |
| Redstone and automation | none yet | Low | Architectural hosts can be generated | Needs #59-style verified module support before arbitrary redstone |
| Sculptures, organic creatures, pixel art | none yet | Low-medium | Some massing possible with organic patches and rocks | Freeform voxel/image/mesh adapters are future work |

## Landmark Stress Samples

These samples are regression probes, not polished templates.

| Sample | Purpose | Components stressed | Current result | Notes |
| --- | --- | --- | --- | --- |
| `taj-dome-study` | Monumental dome over a square hall with corner kiosks | `SteppedTier`, `RoomShell`, `ArcadeRun`, `SteppedDome`, `SupportPost` | Validates and compiles; support warnings remain | Main dome and finial can produce disconnected warnings because dome tiers are analyzed as generated source nodes |
| `temple-palace-dome-study` | Palace/temple podium with reusable pavilion modules | `SteppedTier`, `RoomShell`, `Instance`, `SteppedDome`, `ArcadeRun` | Validates and compiles; support warnings remain | Good assembly authoring probe; dome support diagnostics are still noisy |
| `xi-an-bell-tower-study` | Xi'an Bell Tower-inspired square pedestal, cross passages, timber halls, wide green eaves, roof finial | `RoomShell`, `Opening`, `SteppedTier`, `StairRun`, `ArcadeRun`, `Platform`, `RailingRun`, `SteppedDome`, `Instance` | Validates and compiles; warnings are mostly connected eaves/rails | Good stress test for Chinese pavilion roof/eave semantics without adding a landmark-specific component |
| `giant-wild-goose-pagoda-study` | Tall Tang-style pagoda with walkable shrinking levels, front entries, interior stair runs, and repeated eave levels | `SteppedTier`, `RoomShell`, `Opening`, `Platform`, `StairRun`, `SteppedDome` | Validates and compiles; disconnected count is clean | Exposes authoring cost for walkable multi-level setback towers: today agents must hand-author each level |
| `large-ship-interior` | Large compartmental interior with corridors and stairs | `Compartment`, `Corridor`, `StairRun`, assemblies | Validates and compiles; vertical unsupported warnings remain | Useful pre-redstone host for future machinery/automation rooms |
| `path-rock-garden` | Natural garden features with paths and rocks | `OrganicPatch`, `PathRun`, `RockCluster` | Validates, compiles, and has clean support diagnostics | Current landscape primitives work well for small garden-scale scenes |

## Latest Stress Run

Run locally from the repository root after building the CLI:

```bash
pnpm --filter @i365dev/craftdag-cli build
node packages/cli/dist/index.js component validate examples/component-plans/xi-an-bell-tower-study.componentplan.json --json
node packages/cli/dist/index.js component compile examples/component-plans/xi-an-bell-tower-study.componentplan.json --out /tmp/xian-bell.voxel.json
node packages/cli/dist/index.js component support examples/component-plans/xi-an-bell-tower-study.componentplan.json --json
```

Observed support diagnostics on the current samples:

| Sample | Validation | Compile | Support warnings | Disconnected blocks | Large cantilever blocks | Interpretation |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `path-rock-garden` | pass | pass | 0 | 0 | 0 | Clean landscape fixture |
| `sectioned-wall` | pass | pass | 0 | 0 | 0 | Clean section/assembly fixture |
| `large-form-massing` | pass | pass | 1 | 0 | 0 | Setback/massing fixture is mostly clean |
| `stair-run-multilevel` | pass | pass | 5 | 0 | 0 | Stair authoring works; connected rail/floor warnings remain |
| `fortified-wall-shape` | pass | pass | 9 | 0 | 0 | Wall-shape fixture has connected overhang warnings |
| `landscape-canopy-patch` | pass | pass | 4 | 0 | 0 | Tree canopy creates expected connected unsupported leaves |
| `large-castle` | pass | pass | 20 | 0 | 0 | Mostly connected span/rail warnings |
| `large-ship-interior` | pass | pass | 15 | 0 | 0 | Interior floors/corridors compile; connected unsupported blocks need review |
| `long-fortified-bridge` | pass | pass | 15 | 0 | 0 | Bridge spans intentionally create support warnings |
| `taj-dome-study` | pass | pass | 30 | 1724 | 0 | Dome tier support diagnostics need refinement or explicit intent |
| `temple-palace-dome-study` | pass | pass | 58 | 828 | 0 | Assembly authoring works; dome diagnostics remain noisy |
| `xi-an-bell-tower-study` | pass | pass | 20 | 108 | 728 | Good visual landmark probe; broad eaves create intentional span/cantilever review points |
| `giant-wild-goose-pagoda-study` | pass | pass | 20 | 0 | 24 | Walkable pagoda is structurally connected; repeated levels are verbose and need authoring support |
| `ship-bow-shape` | pass | pass | 38 | 1996 | 0 | Ship bow taper is useful visually but support diagnostics need clearer intent |
| `arcade-bracket-study` | pass | pass | 60 | 1328 | 0 | Arch/bracket sample exposes span semantics and diagnostic noise |

## Pre-Redstone Hardening Notes

Before #59 redstone module work, the architectural layer is usable but should not be described as perfect.

Important next hardening items:

- Support JSON should separate blocking diagnostics from review warnings more clearly for agents and SEO quality gates; track this in #93.
- Landmark samples should include intentional structural metadata for decorative eaves, roofs, finials, and similar details.
- Walkable multi-level builds such as pagodas, bell towers, stair towers, castles, hotels, and server hubs need a more compact authoring pattern than hand-authored `RoomShell` + `StairRun` stacks; track this in #94.
- `SteppedDome` still needs better support semantics or docs explaining expected warning patterns.
- Large samples should be previewed visually in MinePilot, not only compiled in CI.
- SEO build pages need a stable artifact manifest: dimensions, block count, material list, layer guide, schematic availability, diagnostics summary, verification status, tags, and provenance; track this in #95.
- New components should not be added just to make one landmark prettier; first try role metadata, assemblies, repeats, sections, and structural intent.
