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

### SteppedTier

`SteppedTier` represents stacked horizontal tiers inside one anchored bounding box.

Use it for:

- pyramids
- amphitheater or colosseum seating
- palace terraces and podiums
- stepped plinths
- blocky tiered roofs

Do not use it for arbitrary curves, natural hills, or vertical tower setbacks.

Key options:

- `axis`: `"x"`, `"z"`, or `"both"`; defaults to `"both"`
- `levels`: positive integer tier count; defaults to the height divided by `stepHeight`
- `stepHeight`: positive integer height per tier; defaults to `1`
- `insetPerLevel`: non-negative integer shrink amount per tier; defaults to `1`

Each higher tier starts at `anchor.y + level * stepHeight`. The engine rejects configurations where an inset collapses any emitted tier.

Example:

```json
{
  "id": "pyramid_base",
  "type": "SteppedTier",
  "placement": {
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "size": { "width": 17, "height": 5, "length": 17 }
  },
  "options": {
    "axis": "both",
    "levels": 5,
    "stepHeight": 1,
    "insetPerLevel": 2
  }
}
```

### VerticalSetbackVolume

`VerticalSetbackVolume` represents tall, stacked volumes that narrow as they rise.

Use it for:

- Burj-style towers
- pagodas
- tiered spires
- stepped skyscraper massing
- monumental obelisks with blocky setbacks

Do not use it for ship bows, bridge buttresses, or horizontal tapers; use `TaperedVolume` for those.

Key options:

- `axis`: `"x"`, `"z"`, or `"both"`; defaults to `"both"`
- `levels`: positive integer vertical segment count; defaults to roughly one level per six logical blocks of height
- `levelHeight`: positive integer height per segment; defaults to `ceil(height / levels)`
- `setbackPerLevel`: non-negative integer shrink amount per segment; defaults to `1`

The engine rejects configurations where a setback collapses any emitted level.

Example:

```json
{
  "id": "setback_tower",
  "type": "VerticalSetbackVolume",
  "placement": {
    "anchor": { "x": 8, "y": 4, "z": 8 },
    "size": { "width": 21, "height": 42, "length": 21 }
  },
  "options": {
    "levels": 7,
    "levelHeight": 6,
    "setbackPerLevel": 1
  }
}
```

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
