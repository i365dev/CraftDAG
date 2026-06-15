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

### ArcadeRun

`ArcadeRun` represents a repeated Minecraft-style stepped arch rhythm inside one anchored facade box.

Use it for:

- colosseum facades
- gothic or palace arcades
- bridge arch rhythms
- cloisters and galleries
- monumental wall openings

Do not use it for exact circular arches, freeform curves, or single door/window openings.

Key options:

- `axis`: `"x"` or `"z"`; defaults to the longer horizontal axis
- `bayCount`: positive integer number of arch bays
- `pierWidth`: positive integer pier thickness; defaults to `1`
- `archHeight`: positive integer stepped arch height; defaults to a small value based on facade height

The engine rejects configurations where bays collapse between piers or the arch height consumes the full facade height.

Example:

```json
{
  "id": "lower_arcade",
  "type": "ArcadeRun",
  "placement": {
    "anchor": { "x": 4, "y": 2, "z": 4 },
    "size": { "width": 60, "height": 8, "length": 3 }
  },
  "options": {
    "axis": "x",
    "bayCount": 8,
    "pierWidth": 1,
    "archHeight": 4
  }
}
```

### SupportBracket

`SupportBracket` represents repeated visible bracket geometry under an overhang.

Use it for:

- ship lifeboat shelves
- balconies
- projecting roofs
- awnings
- light bridge edges
- cantilevered platforms that need visible support

Do not treat it as a physics engine. It adds deterministic support-like geometry and should be paired with support diagnostics and structural intent when needed.

Key options:

- `axis`: `"x"` or `"z"`; defaults to the longer horizontal axis
- `direction`: `"positive"` or `"negative"` along the perpendicular horizontal axis; defaults to `"positive"`
- `spacing`: positive integer rhythm between brackets; defaults to `4`
- `includeTopBeam`: defaults to `true`

Example:

```json
{
  "id": "lifeboat_shelf_brackets",
  "type": "SupportBracket",
  "placement": {
    "anchor": { "x": 12, "y": 8, "z": 24 },
    "size": { "width": 60, "height": 4, "length": 6 }
  },
  "options": {
    "axis": "x",
    "direction": "positive",
    "spacing": 6,
    "includeTopBeam": true
  }
}
```

### TreeCanopy

`TreeCanopy` represents a stylized Minecraft tree inside one anchored bounding box.

Use it for:

- sakura trees
- garden trees
- village trees
- park landscaping
- small forest patches when combined with `Repeat`

Do not use it for exact botanical simulation or giant custom tree sculptures.

Key options:

- `trunkHeight`: positive integer trunk height; defaults to roughly half the component height
- `trunkWidth`: positive integer trunk width; defaults to `1`
- `canopyStyle`: `"rounded"`, `"tiered"`, `"weeping"`, or `"flat"`; defaults to `"rounded"`

Materials:

- `trunk`: wood/log material
- `leaf`: leaves, blossom, or canopy material

Example:

```json
{
  "id": "sakura_tree",
  "type": "TreeCanopy",
  "placement": {
    "anchor": { "x": 5, "y": 1, "z": 5 },
    "size": { "width": 9, "height": 9, "length": 9 }
  },
  "materials": {
    "trunk": "minecraft:cherry_log",
    "leaf": "minecraft:pink_wool"
  },
  "options": {
    "trunkHeight": 4,
    "canopyStyle": "rounded"
  }
}
```

### OrganicPatch

`OrganicPatch` represents a deterministic irregular ground patch.

Use it for:

- ponds
- gravel beds
- flower beds
- moss patches
- soft-edged garden zones

Do not use it for structural slabs, building floors, or arbitrary terrain generation.

Key options:

- `roughness`: non-negative integer edge trim strength; defaults to `1`
- `includeBorder`: emits border blocks beside trimmed rows; defaults to `false`

Materials:

- `fill`: main patch material
- `border`: optional border material when `includeBorder` is true

Example:

```json
{
  "id": "koi_pond",
  "type": "OrganicPatch",
  "placement": {
    "anchor": { "x": 12, "y": 1, "z": 12 },
    "size": { "width": 20, "height": 1, "length": 12 }
  },
  "materials": {
    "fill": "minecraft:water",
    "border": "minecraft:stone"
  },
  "options": {
    "roughness": 2,
    "includeBorder": true
  }
}
```

### PathRun

`PathRun` represents a deterministic local path inside one anchored bounding box.

Use it for:

- garden paths
- gravel walks
- stepping stones
- village footpaths
- simple meandering walkways

Do not use it as a pathfinding system or road network solver.

Key options:

- `style`: `"continuous"`, `"stepping_stones"`, or `"gravel"`; defaults to `"continuous"`
- `width`: positive integer path width; defaults to `1` for stepping stones and `2` otherwise
- `stepSpacing`: positive integer spacing for `stepping_stones`; defaults to `2`
- `waypoints`: local `{ x, z }` points inside `placement.size`; defaults to a straight centerline

Example:

```json
{
  "id": "meandering_gravel_path",
  "type": "PathRun",
  "placement": {
    "anchor": { "x": 4, "y": 1, "z": 4 },
    "size": { "width": 42, "height": 1, "length": 28 }
  },
  "options": {
    "style": "gravel",
    "width": 2,
    "waypoints": [
      { "x": 0, "z": 2 },
      { "x": 13, "z": 2 },
      { "x": 13, "z": 15 },
      { "x": 28, "z": 15 }
    ]
  }
}
```

### RockCluster

`RockCluster` represents a deterministic group of rough boulders inside one anchored bounding box.

Use it for:

- rock gardens
- boulders around ponds
- fake mountains
- small cliff accents
- natural stone clusters

Do not use it for exact terrain erosion, caves, or large mountain generation.

Key options:

- `count`: positive integer number of boulders; defaults to `3`
- `heightVariation`: non-negative integer vertical variation; defaults to `2`
- `roughness`: non-negative integer deterministic horizontal scatter; defaults to `1`

Example:

```json
{
  "id": "dry_garden_rocks",
  "type": "RockCluster",
  "placement": {
    "anchor": { "x": 36, "y": 1, "z": 8 },
    "size": { "width": 14, "height": 7, "length": 14 }
  },
  "options": {
    "count": 5,
    "heightVariation": 3,
    "roughness": 2
  }
}
```

## Non-Goals

- no arbitrary meshes
- no freeform curves
- no object-specific primitives such as `TitanicHull` or `EiffelLeg`
- no bypassing budget checks

If a landmark-specific shape keeps recurring, first try composing it from generic primitives. Add a domain-specific primitive only after generic composition proves too verbose or too brittle.
