# CraftDAG #110: ellipse and tangent path-repeat research

## Decision

The gap is in the engine representation, with Agent-authored coordinate work making it more brittle. Recommend a narrow implementation follow-up: **`EllipseRing` plus `PathRepeat` over an explicitly bounded ellipse**. Do not add a general `CurvePath`, spline language, or landmark component. Keep this branch as a research prototype; the prototype is not wired into the stable ComponentPlan schema.

## Reproduced evidence

MinePilot #73's latest persisted issue text reports the same result across a shell and multi-level arcade: four partial `CircleRing`s with separate centers/radii plus tangent walls for the shell; `ArcadeRun` only handles straight sides; oval bays cannot follow the path with local tangent orientation. The issue also reports a circular `CircleRing + RadialRepeat` control working for ordinary circular structure. Its full `docs/ISSUE_73_CURVED_RADIAL_STRESS_TEST.md` file is referenced as residing in the old MinePilot worktree, but is not present on current `main` and the GitHub Contents API returns 404, so exact historical LOC and repair-round counts could not be recovered.

This checkout independently compiled two small current-vocabulary baselines:

| Fixture | Current plan | Authored components | JSON bytes | Expanded blocks | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Stadium-like shell control | 2 partial `CircleRing`s + 2 tangent `Beam`s | 4 | 938 | 2,240 | Valid and compact, but a capsule/stadium, not an ellipse; ellipse curvature cannot be matched by two fixed-radius caps. |
| Oval two-level arcade | 24 manually positioned `Instance`s per level; fixed-X assembly | 48 instances (+ 4 assembly components) | 6,065 | 768 | Valid; no tangent rotation. Bays remain parallel around the oval and the 24 positions are hand-authored coordinates. |

Both are generated/compiled by `current-workaround.mjs` against CraftDAG 0.2.6. These are bounded reproduction fixtures, not polished MinePilot content. They needed zero repair rounds because the issue is expressiveness/orientation, not schema validity. The persisted #73 summary likewise identifies visual faceting/brittleness and tangent-orientation failure, but does not preserve six-view screenshots or per-round measurements in the accessible issue text.

## Capability audit

| Need | Existing primitive | Adequate? |
| --- | --- | --- |
| Ellipse perimeter | `CircleRing` uses one radius; multiple partial rings and straight connectors can approximate a stadium | No for a true bounded ellipse; faceted or wrong curvature. |
| Partial ellipse | `CircleRing` has `startAngle`/`endAngle`, but only for circles | No. |
| Repeat along path | `Repeat` is linear on X/Y/Z; `RadialRepeat` places a fixed count around a full circle | No for ellipse paths and bounded open arcs. |
| Local tangent orientation | `RadialRepeat.rotate=true` rotates `Instance` assemblies around a circle; arbitrary angles voxelize. `Instance` itself has no rotation | Partial: circle only. The useful voxel rotation machinery already exists, but path sampling does not. |
| Arc endpoint handling | `CircleRing` filters sampled disk pixels by angle; `RadialRepeat` samples `count` around 360° | No path endpoints. Partial-repeat needs explicit endpoint inclusion and seam behavior. |
| Bounded deterministic cost | Plan budgets, integer radii/count, deterministic expansion; radial repeat scales cost by count | Mostly. Ellipse extents, rotated module bounds, and conservative per-repeat block cost need explicit validation. |
| Agent authorability | Circle / line concepts are clear; oval workaround uses multiple centers, radii, and manually placed instances | No for the two target families: author has to do path math and coordinate/rotation bookkeeping. |

`ArcadeRun` creates a straight repeated arch rhythm inside one axis-aligned box. `Assembly`/`Instance` makes a multi-part bay reusable, but Instance has no general rotation. `Repeat` only translates an object along one axis. These are orthogonal and useful for the circular and straight controls; they do not compose into an ellipse-path repeat without coordinate-level authoring.

## Candidate comparison

### Ellipse geometry

| Candidate | Benefits | Cost / risk | Finding |
| --- | --- | --- | --- |
| A: `EllipseRing` | One bounded Minecraft-style raster algorithm; clear dimensions `radiusX/radiusZ`; natural full/partial shell API; easy extents and area estimate | Duplicates some `CircleRing` logic; must define inner offset and angular endpoints | Best minimum geometry primitive. Can be a generic ellipse ring/cylinder, not an arbitrary curve language. |
| B: bounded `CurvePath` | Could eventually serve more path families | Requires path kinds, sampling, arc-length/parameter semantics, tangent rules, endpoint policy, bounds, budget, diagnostics; invites spline/CAD growth | Do not adopt now. The current evidence only needs ellipses, and generic path authoring raises prompt and validation cost. |

### Repeat geometry

| Candidate | Benefits | Cost / risk | Finding |
| --- | --- | --- | --- |
| Extend `RadialRepeat` | Reuses current circular API and tested arbitrary-angle `Instance` voxelization | `radius`/"radial" semantics become misleading with two radii and partial open intervals; accumulating axes, endpoints, spacing modes, and path kinds creates a complex union schema | Keep existing circular behavior stable; do not turn it into a generic path component. |
| `PathRepeat` | Explicitly means placing an assembly along a bounded path; can share the existing node rotation/voxelization helper | One schema component and more diagnostics; must stay ellipse-only initially | Preferred. First version accepts an ellipse path only and a source `Instance`/assembly. |

### Minimum semantics to carry into implementation

- Parameterize an ellipse by `x=cx+rx*cos(t)`, `z=cz+rz*sin(t)` in degrees. The tangent is `(-rx*sin(t), rz*cos(t))`.
- `EllipseRing` uses integer center/radii/y/height/thickness, with optional partial `startAngle`/`endAngle` matching `CircleRing` conventions. Bounds use the full declared ellipse extents, even for a partial arc, unless later evidence justifies tighter angular bounds.
- `PathRepeat` starts with an explicit ellipse `{center, radiusX, radiusZ}` plus `startAngle`, `endAngle`, `count`, and `closed`. Closed paths divide by `count` and omit a duplicate seam endpoint. Open paths include both endpoints and divide by `count - 1`. Reject invalid count and spans beyond one turn.
- Start with `count`, not spacing. Spacing requires ellipse arc-length approximation and count rounding, which is avoidable API complexity for this use case.
- `orientToTangent` defaults false or is required explicitly; when enabled, local assembly +X follows the analytic tangent. Keep integer block positions and deterministic nearest-voxel rotation; do not imply continuous Minecraft block-state rotation.
- Estimate shell blocks from ellipse area/thickness/height conservatively. Estimate repeat cost as source assembly estimate times count (safe overestimate despite overlap). Validate center, ellipse extents, module envelope, and emitted voxels against plan bounds before returning geometry.
- Namespace repeated IDs with stable path ID + source ID + index. Run the ordinary support analysis on expanded nodes; surface disconnected first/last supports and out-of-bounds modules with the path ID and repair hints.

## Prototype evidence

`geometry-prototype.mjs` is an isolated, deterministic geometry spike, deliberately outside core exports/schema. It implements the two proposed concepts and an isometric SVG renderer:

| Prototype fixture | Emitted unique voxels | API proof |
| --- | ---: | --- |
| Elliptical arena shell | 2,412 | `EllipseRing`, radii 28 x 16, thickness 2, height 9. |
| Two-level elliptical colonnade | 816 | Same shell plus two 24-bay `PathRepeat`s, tangent-oriented local post/lintel module. |
| Open elliptical harbor wall probe | 25 | Open 0°–180° `PathRepeat`, count 9, both endpoints included. |

The helper rejects out-of-bounds voxel positions, invalid radii/count/angles, and outputs over the explicit block budget. Closed paths omit a duplicate endpoint by dividing the angle span by `count`; open paths include both ends. Quantized rotation can merge neighboring voxels by design. Re-running the same fixtures produces identical SVG hashes.

Artifacts: [`ellipse-shell.svg`](artifacts/ellipse-shell.svg), [`curved-arcade.svg`](artifacts/curved-arcade.svg), [`open-arc-endpoints.svg`](artifacts/open-arc-endpoints.svg).

These SVGs are geometry artifacts, not MinePilot's six-view Three.js review captures. CraftDAG has no visual review renderer, and these images do not show block states or prove build quality in Minecraft. Treat them as preview artifacts for reviewer inspection; no independent visual rating was recorded. An implementation needs MinePilot preview review for close-up faceting and overlap.

## Proposed API sketch

```json
{
  "id": "outer_shell",
  "type": "EllipseRing",
  "placement": {
    "center": { "x": 36, "z": 20 }, "y": 0,
    "radiusX": 28, "radiusZ": 16
  },
  "options": { "height": 9, "thickness": 2, "fill": "hollow" }
}
```

```json
{
  "id": "arcade_bays",
  "type": "PathRepeat",
  "placement": {
    "path": { "type": "ellipse", "center": { "x": 36, "z": 20 }, "radiusX": 25, "radiusZ": 13 },
    "source": "bay_module", "count": 24,
    "startAngle": 0, "endAngle": 360, "closed": true,
    "orientToTangent": true
  }
}
```

Exact field placement and whether `source` references an assembly or existing `Instance` remain prototype questions. Avoid both an awkward `Instance` wrapper and nested instances unless compiler contracts require them.

## Risks and recommendation

- **Compatibility:** additive component type avoids changing `CircleRing` and existing `RadialRepeat` plans. Reuse node IDs/rotation helpers where possible; component schema and documentation additions remain.
- **DSL growth:** two types add prompt surface. Bound the path to ellipse-only and defer spacing mode, splines, arbitrary polylines, mirroring, and general rotation.
- **Visual quantization:** local tangent direction is continuous but output is voxelized. Closely spaced modules can collide or leave gaps; expose deterministic diagnostics if measured sampling cannot keep bay spacing coherent.
- **Support analysis:** repeated clones must retain provenance, and endpoint supports on an open path must not be silently omitted.
- **Budget:** radial/ring cost estimates currently operate on formulas separate from exact expansion. Require conservative tests at the configured limits before shipping.

**Recommendation:** #110 has enough cross-family evidence to proceed to a focused implementation PR after this research review. Implement `EllipseRing` and ellipse-only `PathRepeat` together, and require the shell + multi-level arcade fixtures plus a circular regression before merge. Do not merge this prototype as production code. No changes to core schema, compiler, or exported API were made here.

## Reproduction commands

```bash
pnpm --filter @i365dev/craftdag-core build
node prototypes/issue-110/current-workaround.mjs
node prototypes/issue-110/geometry-prototype.mjs prototypes/issue-110/ellipse-shell.json
node prototypes/issue-110/geometry-prototype.mjs prototypes/issue-110/curved-arcade.json
node prototypes/issue-110/geometry-prototype.mjs prototypes/issue-110/open-arc-endpoints.json
```
