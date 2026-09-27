# Stage 1B authoring notes

- Model author: GPT-6 Luna Codex agent (not the GPT-5.6 Luna used for Stage 1A).
- Main scene source: `author_scene.py` (184 LOC); `run_all.py` invokes the five cases in one Blender process. Scenes are built from named objects/collections and primitive/custom mesh geometry; no Minecraft blocks or VoxelPlan data are authored here.
- Blender used: 5.2.2 LTS, headless CLI at `/private/tmp/blender-runtime/Blender.app/Contents/MacOS/Blender`. `bpy` Python import crashed on this host; the CLI worked outside the sandbox. No GUI interaction was needed.
- Re-run: `/private/tmp/blender-runtime/Blender.app/Contents/MacOS/Blender --background --factory-startup --python experiments/stage-1b-blender/source/run_all.py`.
- The authored scenes use Y-up coordinates and normalize mesh bounds to Y=0..64. The correct OBJ setting for this scene convention is `forward_axis='Y', up_axis='Z'`; the first setting (`NEGATIVE_Y`, `Z`) emitted Y=0..-64 and inverted every model in MinePilot. Bounds should be checked after export.
- OBJ exports include object/group names but omit unused UVs, normals and materials (`export_uv=False`, `export_normals=False`, `export_materials=False`). The adapter consumes geometry and flattens the named parts.
- Source renders use Blender Workbench with material colors, studio light and cavity. EEVEE was initially too dark in this headless setup. Render configuration is evidence-only and does not change voxel geometry.
- First API attempts exposed Blender 5.2 differences: use `BLENDER_WORKBENCH` for review renders; `primitive_cylinder_add` takes `radius` while `primitive_cone_add` takes `radius1/radius2`; OBJ axes use enum values such as `Y`/`Z` (not `-Y`).
- Initial ship OBJ failed the existing adapter with an out-of-range face index at line 37. The fault was an authored hull face, not a #116 adapter bug; the scene now uses a three-vertex V-keel at each station.
- Repeated Blender runs preserved canonical mesh geometry. OBJ face ordering was not byte-stable for statue and dragon; two adapter runs emitted identical surface and solid VoxelPlan hashes for all cases.
- `voxelize.mjs` imports `../../../packages/adapter-mesh/dist/index.mjs`; build the normal #116 adapter package first. It writes surface and solid VoxelPlans with `targetHeight=64` and `maxBlocks=1,000,000`.

The final MinePilot images come from the existing MinePilot production `createVoxelPreview` function via a temporary local review page. That page and copied public data were removed after screenshots were saved under `artifacts/minepilot/final/`.
