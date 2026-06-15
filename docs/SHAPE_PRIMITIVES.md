# Shape Primitives

CraftDAG shape primitives are bounded Minecraft-style approximations, not CAD geometry.

The goal is to give agents a small set of orthogonal tools for recognizable large-build silhouettes while preserving deterministic expansion, validation, budgeting, and traceable node IDs.

## First Batch

### TaperedVolume

`TaperedVolume` represents a blocky taper inside an anchored bounding box.

Use it for:

- ship bows and sterns
- tower legs
- buttresses
- stepped supports
- simplified landmark silhouettes

It expands into deterministic one-logical-unit slices along `options.axis`.

Key options:

- `axis`: `"x"` or `"z"`; defaults to the longer horizontal axis
- `startInset`: integer inset at the start of the run
- `endInset`: integer inset at the end of the run

The engine rejects insets that collapse the perpendicular cross section.

### RailingRun

`RailingRun` represents a bounded run of posts and horizontal rails.

Use it for:

- ship deck railings
- bridge rails
- castle wall parapets
- balcony edges
- platform safety rails

Key options:

- `axis`: `"x"` or `"z"`; defaults to the longer horizontal axis
- `postSpacing`: positive integer rhythm between posts
- `includePosts`: defaults to `true`
- `includeTopRail`: defaults to `true`
- `includeMidRail`: defaults to `false`

The engine rejects railing runs that emit no physical parts.

## Non-Goals

- no arbitrary meshes
- no freeform curves
- no object-specific primitives such as `TitanicHull` or `EiffelLeg`
- no bypassing budget checks

If a landmark-specific shape keeps recurring, first try composing it from generic primitives. Add a domain-specific primitive only after generic composition proves too verbose or too brittle.
