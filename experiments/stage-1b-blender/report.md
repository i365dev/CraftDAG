# CraftDAG #114 — Stage 1B Blender/DCC route

## Scope and result

This is a real Blender 5.2.2 headless benchmark on the exact five Stage 1A briefs, using `targetHeight=64`, `maxBlocks=1,000,000`, and the unmodified #116 OBJ adapter in both surface and solid modes. It starts from PR #116 head `54ce13e`; nothing was merged and no Minecraft content was published.

The results support Blender as an **optional upstream producer for freeform organic shapes**, not as the default authoring route. The tower is essentially tied with Stage 1A; house and ship remain borderline; the statue reads better at a distance; the dragon has a stronger broad-wing silhouette but costs 2.5× as many solid blocks.

## Benchmark table

| Case | Scene objects | OBJ tris | Repair rounds | Stage 1B size | Surface / solid blocks | Stage 1A solid blocks | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| Simple house | 9 | 108 | 3 | 36×64×36 | 14,350 / 51,468 | 35,924 | BORDERLINE |
| Castle tower | 13 | 300 | 2 | 31×64×31 | 9,927 / 30,721 | 30,726 | PASS |
| Ship | 7 | 116 | 3 | 39×64×17 | 3,815 / 4,337 | 6,602 | BORDERLINE |
| Statue | 10 | 848 | 2 | 27×64×21 | 5,545 / 10,924 | 10,863 | PASS |
| Dragon | 20 | 2,658 | 2 | 75×64×60 | 14,832 / 44,203 | 17,485 | BORDERLINE |

The generation source is 184 LOC versus Stage 1A's 131 LOC. Source triangles are fan-triangulated from OBJ faces using the #116 parser, matching the adapter's expansion. Full Stage 1A comparison values and per-case notes are in [`report.json`](report.json); the per-case schema matches Stage 1A in [`report.schema.json`](report.schema.json).

## Reproduced evidence and repair history

- **House:** the first voxel preview showed the OBJ axis inversion; the initial roof rotations also made a valley. After changing exporter axes and reversing the roof slopes, the MinePilot front view shows an attached pitched roof. The solid result still hides shallow door/window inserts in one stone palette.
- **Tower:** the same axis correction made the lookout and battlements upright. Its dimensions and occupancy nearly exactly match Stage 1A. It shows no useful DCC advantage for this family.
- **Ship:** the initial authored OBJ failed adapter parsing because a hull face referenced a vertex outside the mesh. A three-vertex keel section fixed the source geometry; no adapter edit was needed. The mast and sails survive, while the hull remains shallow. Open sail sheets contribute surface coverage but no filled interior in solid mode.
- **Statue:** the axis fix restored an upright head/plinth relationship. MinePilot front view preserves a distinct head, arms, torso and base; face and clothing detail disappear.
- **Dragon:** the axis fix preserves the perched side profile. The MinePilot front view shows a broad wing and recognizable creature silhouette; in isometric/solid views the far wing and limbs fuse into the body. Its depth grows from Stage 1A's 22 to 60 blocks.

Each case has a Blender render and three final MinePilot views (isometric/front/right) under [`artifacts/`](artifacts/). The `initial/` and `minepilot/initial/` directories preserve the inverted-axis first pass, dark source renders, and the first failed ship OBJ evidence. The temporary MinePilot review page used the existing production `createVoxelPreview` renderer and was removed after capture.

## Capability and authoring observations

Blender keeps named collections and objects (`walls`, `roof`, `openings`, `hull`, `sails`, `body`, `wings`, `legs`) in `.blend` and object/group names in OBJ. These labels could be bounded compilation hints later. The #116 adapter currently emits a flat VoxelPlan and discards names, so there is no downstream semantic benefit today and no basis for mesh-to-ComponentPlan reconstruction.

Scene scripting stayed repeatable without GUI correction, but the exporter axes were easy to misconfigure: the initial `forward_axis=NEGATIVE_Y, up_axis=Z` wrote vertical bounds `0..-64` and inverted all five previews. A source-side Y-range check caught it. Blender API/version friction also surfaced in the engine enum, cylinder radius argument, and exporter axis enum. The first EEVEE pass was nearly black, so evidence renders use the readable material-colored Workbench studio pass.

Repeated adapter runs produced byte-identical VoxelPlans. Repeated OBJ exports matched byte-for-byte for house, tower and ship. Statue and dragon varied only in face ordering; their named objects, vertex data and canonical triangle geometry matched. Their results remain geometrically reproducible, though raw OBJ bytes are not stable across runs.

The author's scene contains semantic named objects, but the added object count (7–20) and 184 source LOC are a modest authoring cost. Blender requires more validation of transforms, export coordinates and mesh closure than Stage 1A's direct procedural geometry. It avoided GUI-like repairs after the scripted path was corrected; the preview loop was still essential because both the upside-down export and the boat's thin hull looked plausible when inspecting only scene state.

## Recommendation

Proceed to a **narrow** implementation follow-up for Blender/DCC-authored organic meshes, retaining bounded OBJ input and the deterministic #116 adapter. Keep ComponentPlan as the shorter, clearer route for ordinary houses and towers. Do not expand the core DSL for Blender scene semantics yet. The strongest positive signal is the dragon's broad three-dimensional silhouette; the strongest negative is the large solid-block cost and fused details after voxelization.

## Reproduction

```sh
blender --background --factory-startup --python experiments/stage-1b-blender/source/run_all.py
node experiments/stage-1b-blender/source/voxelize.mjs
```

`voxelize.mjs` expects the #116 adapter build at `packages/adapter-mesh/dist/index.mjs`.
