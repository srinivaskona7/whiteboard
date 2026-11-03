# ADR-001 — Input, strokes, arrows and persistence

Status: accepted · 2026-11-03 · Applies to the whole app (one scene model, one history)

## Context

The studio must support a pen tablet (Huion), precision architecture diagrams, and
classroom persistence without adding runtime dependencies or a second document model.
Earlier growth had produced three risks: geometric mutation during render, divergent
brush appearance between canvas and SVG, and per-feature settings that could not be
migrated or versioned.

## Decision 1 — Input pipeline

- **Pointer Events only.** `pointerdown`/`pointermove`/`pointerup` on the canvas, with
  `setPointerCapture` for the duration of a stroke so a drag that leaves the canvas still
  receives moves, and `pointercancel`/`window.blur` finalize and discard a stroke rather
  than leaving a phantom in-progress element.
- **Coalesced samples are kept.** `getCoalescedEvents()` is read on every move so pen input
  at high report rates is not resampled down before smoothing; each sample carries
  `{x, y, p}`.
- **Pressure is a pen property.** `pointerType === 'pen'` only; mouse and touch pressure is
  ignored (a mouse always reports 0.5 and would otherwise pin the stroke to mid-width).
- **Smoothing is a three-mode policy, separate from pressure, simplification and texture:**
  `off` (raw), `adaptive` (speed-aware alpha, corners preserved), `stabilizer`
  (0.34 trailing lerp). They are independent by construction and stored on the element.
- **Raw samples are retained but bounded.** Up to 1500 raw points per element are kept for
  later re-smoothing; beyond that the oldest raw points are dropped and the documented
  limit applies. The rendered `points` array is what every renderer reads.

## Decision 2 — Stroke appearance

- `scene/brushes.js` is the single source of truth for the six presets. `BRUSH_PRESETS`
  holds `strokeWidth`, `opacity`, `smoothing`, `pressure`, `minWidthRatio`,
  `maxWidthRatio`, `grain`, `nib`.
- An element stores the **preset id plus any overridden values**; renderers call
  `resolveBrush(el)`. User overrides therefore survive preset authors changing defaults,
  and a preset can be re-applied without losing per-element size.
- **Highlighter is one continuous path** so overlapping segments inside a single stroke
  cannot self-darken. Element opacity is applied exactly once, in `drawSingleElement`;
  sub-draws multiply by that base alpha instead of setting `globalAlpha` again.
- **Texture is deterministic.** Grain uses a xorshift PRNG seeded from the element id and
  `createdAt`, so the same document renders identically on canvas and in SVG, and a reload
  does not reshuffle speckles. Grain point count is capped (420) per stroke.
- **Canvas and SVG share the same geometry builders** (`buildStrokeSegments`,
  `buildNibOffsets`, `buildGrainPoints`), which is why export parity is a property of the
  design rather than a test that has to chase the renderer.

## Decision 3 — Arrows

- Arrow geometry is computed from element properties on read (`getConnectorPoints`); no
  renderer mutates a route.
- Routing modes: `auto` (Auto Clean policy), `straight`, `orthogonal`, `rounded-elbow`,
  `curved`. Auto Clean is a **policy over** the other modes, not a fourth geometry: it
  prefers a straight line when the direct segment clears every obstacle box, otherwise
  falls back to orthogonal A*.
- Routes are sanitized before use: NaN/Infinity dropped, duplicate and collinear points
  removed, corner radius clamped 4–36, endpoints trimmed to the element boundary, heads
  aligned to the tangent at each end.
- Manual waypoints are the user's intent: once `manualRoute` is set, Auto Clean and preset
  application do not silently re-route; "Reset route" clears `manualRoute`, `waypoints`
  and `controlPoint`.
- Arrow quick presets (`scene/arrow-presets.js`) apply **element properties only**
  (routing, stroke style, endpoint heads). They never write route points, so switching a
  preset cannot move an arrow the teacher placed.

## Decision 4 — Persistence

- **One document**: `scene.pages[]` with elements, camera, background, `teacherNotes`,
  width/height. Notebook and presentation are projections over the same array; neither
  owns a copy.
- **Versioned schema with migration.** `scene/version` is checked by
  `migrateSceneData`; a recovery snapshot is written before a save that would change the
  stored schema, so a failed migration is recoverable.
- **Brush and arrow settings are element fields, not side tables**, so an older reader
  that ignores `brush` still renders a normal stroke at the stored width and opacity.
  Unknown keys are preserved through load/save.
- **Teacher notes never leave the teacher's device.** The persistence strip removes them
  from client payloads and the collab server deletes them again server-side; the renderer
  never draws them.
- **Local durability**: debounced autosave flushes on `pagehide`, `input` commits before
  `change`, and an explicit empty note is stored as an empty string rather than being
  dropped as "no change".

## Consequences

- A new brush preset or arrow preset is a data entry in one module plus its preview; it
  does not touch the renderer.
- Adding a routing mode requires handling it in `getConnectorPoints` and the SVG path
  builder only; the inspector, context menu and presets read the same property.
- Elements carry modest extra metadata (`brush`, `smoothing`, `rawPoints` bounded at
  1500). Documents remain plain JSON and readable by any older build.
- Hardware-specific claims (Huion pressure curve, tablet calibration) stay **BLOCKED**
  until a real device is attached; software pressure handling is unit- and
  browser-tested with a synthesized pen pointer only.
