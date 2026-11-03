# Feature Matrix — StudioBoard

Verified against commit `dcece8c` + the working-tree changes in [QA_CONTEXT.md](./QA_CONTEXT.md) §6.
Legend: **PASS(browser)** observed in the running app · **PASS(unit)** covered by `node --test` ·
**PARTIAL** works with a stated limitation · **NOT TESTED** no evidence · **BLOCKED** cannot be verified here.

All rows were checked or re-checked on 2026-11-03.

## 1. Input and drawing

| Action | Status | Evidence / note |
|---|---|---|
| Pointer capture for a stroke | IMPLEMENTED (NOT TESTED on hardware) | `setPointerCapture`/`releasePointerCapture` wired on pointerdown/up/cancel; synthetic events cannot activate a real pointer, so the leave-canvas behaviour is unverified |
| Coalesced pointer samples | PASS(browser) | Test canvas reported the coalesced batch size |
| Pointercancel / window blur | PASS(unit) + PASS(browser) | Stroke finalised, no phantom element left active |
| Pen pressure only from `pointerType:'pen'` | PASS(unit) + PASS(browser) | Mouse pressure ignored; pen stroke width varies |
| Pressure curve calibration | PASS(browser) | Tablet test canvas → min/max applied, persisted to workspace prefs |
| Stabilization Off / Adaptive / Stabilizer | PASS(browser) | Selector persists; independent of pressure and simplification |
| Raw sample retention | PASS(unit) | Capped at 1500 points per element |
| Deterministic grain | PASS(unit) | Same element + seed → identical speckles |
| Six drawing presets (Technical, Pressure Ink, Pencil, Chisel, Highlighter, Chalk) | PASS(browser) + PASS(unit) | Six distinct signatures and previews |
| Tool overrides preset | PASS(browser) | Highlighter tool → `highlighter` preset; Pen → `technical`; a card clicked with ink selected restyles that stroke |
| Preset overrides (size, opacity, pressure ratios) | PASS(browser) + PASS(unit) | Size 9 px → stored in `brushOverrides`, still 9 px after a real reload |
| Highlighter does not stack within one stroke | PASS(browser) | Crossing pixel equals single-pass pixel |
| Canvas ↔ SVG stroke parity | PASS(unit) + PASS(browser) | Same geometry builders; exported SVG inspected |
| Huion hardware validation | **BLOCKED** | No physical tablet attached |
| Shape recognition | NOT IMPLEMENTED | Deliberately absent, so it cannot be confused with stabilization; freehand stays freehand |
| Brush preset favourites | PARTIAL | The chosen preset and its overrides persist in workspace prefs; there is no separate star/favourites list |

## 2. Eraser

| Action | Status | Evidence / note |
|---|---|---|
| Object erase | PASS(browser) | Whole stroke deleted in Whole-Object mode; Trim-Ink mode still splits it (7 + 27 points) |
| Stroke erase (ink trim) | PASS(browser) | 40-point stroke → 2 pieces, 35 points retained |
| Scope all / ink / objects | PASS(browser) | Selector in the Inspector |
| Live size ring | PASS(browser) | Cursor ring follows size |
| Size and mode persist | PASS(unit) | Stored in workspace preferences |

## 3. Arrows and connectors

| Action | Status | Evidence / note |
|---|---|---|
| Routing: Auto Clean policy | PASS(browser) + PASS(unit) | Straight when clear, orthogonal detour around obstacles |
| Routing: Straight / Right-angle / Rounded-elbow / Curved | PASS(browser) + PASS(unit) | Each sets only its own property |
| Direct dock "simple arrow" action | PASS(browser) | 180 px straight one-way arrow in one click |
| Dock split popover with six previews | PASS(browser) | 6 cards, 6 inline SVG previews |
| Inspector preset cards | PASS(browser) | Same six, active state reflects the selection |
| Appearance: solid / dashed / dotted, opacity | PASS(browser) | Applies to selection |
| Endpoint heads: none, open, filled triangle, diamond, circle, bar | PASS(browser) | Both ends independently |
| One-way / two-way shortcuts | PASS(browser) | Direction preset buttons and dashed two-way preset |
| Route sanitisation | PASS(unit) | NaN/Infinity, duplicates and collinear points removed |
| Manual waypoints preserved | PASS(unit) | `manualRoute` blocks re-routing until reset |
| Radius clamp, tangent heads, boundary trim | PASS(unit) | 4–36 px, tangent-aligned, endpoints trimmed |
| Context menu on arrow | PASS(browser) | Path type, heads, reverse, reset, duplicate, delete |

## 4. Right-click menus

| Context | Status | Evidence / note |
|---|---|---|
| Empty canvas | PASS(browser) | Paste, select all, insert, presets, grid/guides, fit/zoom/focus |
| Object / freehand | PASS(browser) | Edit, drawing preset submenu, style copy/paste, arrange, lock, export, delete |
| Arrow | PASS(browser) | See §3 |
| Table | PASS(browser) | Row/column insert/delete, header, structure/TSV, duplicate, delete |
| Keyboard navigation | PASS(browser) | Arrow keys, Enter/Space, Escape, Tab closes; `aria-activedescendant` set; Escape returns focus to `#wb-canvas-wrap` |
| Disabled reasons | PASS(browser) | Title attribute states why an item is unavailable |
| Native menu in text fields | PASS(browser) | Canvas-only handler; fields are never intercepted |

## 5. Text, code and tables

| Action | Status | Evidence / note |
|---|---|---|
| Inline text editing with IME/Unicode | PASS(browser) | Native textarea/input; board shortcuts suppressed while typing |
| Expanded code editor | PASS(browser) | Language, font size, highlight lines, wrap, line-number gutter, copy, Save/Cancel |
| Code whitespace exactness | PASS(browser) | Byte-identical round trip through save and reload |
| Code top-left anchor on growth | PASS(unit) | `x`/`y` unchanged while `h` grows |
| Code language/wrap persistence | PASS(unit) | Round-trip test after the dropped-props fix |
| Table insert dialog | PASS(browser) | Rows, columns, header, shading, alignment, TSV |
| Table cell editing | PASS(browser) | Double-click opens the cell editor |
| Tab / Shift+Tab cell navigation | PASS(browser) | Commits the cell and moves right/left, wrapping across rows, both directions verified |
| Table wrapping | PASS(browser) + PASS(unit) | Words wrap, over-long tokens hard-break, blank lines kept |
| Table header / striping / alignment / valign / padding | PASS(browser) | Inspector controls; header and stripe exported to SVG |
| Fit to content | PASS(browser) | Measured `colWidths [74,80,82]`, `rowHeights [35,35,35]` |
| Equal columns | PASS(browser) | Clears per-column spans |
| Row/column insert and delete | PASS(browser) + PASS(unit) | Grid stays rectangular; last row/column protected |
| TSV paste into the table | PASS(browser) | Grows the grid instead of dropping cells |
| Merged cells | NOT IMPLEMENTED | Explicitly deferred; no partial implementation |
| Column-drag resize on canvas | NOT IMPLEMENTED | Widths are data-driven; resizing is via Fit / Equal and the structure dialog |

## 6. Inspector and contextual UI

| Action | Status | Evidence / note |
|---|---|---|
| Contextual visibility | PASS(browser) | Hidden at idle, opens on selection or canvas mode |
| Pin option | PASS(browser) | Toggle → stored `inspectorPinned:true` in workspace prefs; restored on boot |
| Canvas chip | PASS(browser) | Shown only when the panel is dismissed |
| Eraser context section | PASS(browser) | Size, mode, scope; no irrelevant stroke styling |
| Drawing preset section | PASS(browser) | Six previews, size, opacity, stabilization, apply, reset, Tablet Test |
| Connector section | PASS(browser) | Routing, direction, preset cards, heads, labels, ports |
| Table section | PASS(browser) | Structure controls listed in §5 |

## 7. Pages, views and teaching

| Action | Status | Evidence / note |
|---|---|---|
| Diagram workspace | PASS(browser) | Default; single canvas |
| Vertical Notebook view | PASS(browser) | Projection over the same document; document camera untouched |
| Notebook zoom | PASS(browser) | View zoom changes, `page.camera` stays 1 |
| Presentation mode | PASS(browser) | Canvas chip hidden (state + CSS), pages bar `display:none`, no authoring controls |
| Presentation exit | PASS(browser) | Authoring UI restored |
| Reveal steps | PASS(unit) | Hidden until `revealStep` reached |
| Focus mode / fullscreen | PASS(browser) | Toggle verified; reduced-motion CSS present |
| Teacher notes privacy | PASS(unit) | Stripped client-side and server-side; never rendered |
| Teacher notes persistence | PASS(browser) | Survives reload, including an explicitly empty note |
| Viewer timer authority | PARTIAL | Role-gated in `ui/timer.js`; no live-room browser run |
| Page delete selects nearest page | PASS(browser) | Deletion announces and activates a remaining page |

## 8. Files, export, sharing

| Action | Status | Evidence / note |
|---|---|---|
| Save `.whiteboard.json` | PASS(browser) | Serialised scene, recovery snapshot first |
| Open `.whiteboard.json` | PASS(unit) | Parse + migrate + defaults |
| PNG export | PASS(browser) | 764×424, valid PNG signature, ≈9.2 kB |
| SVG export | PASS(browser) | 1391 bytes, well-formed, no NaN, stroke parity |
| Multi-page handout (print → PDF) | PASS(browser, DOM) | One sheet per page in order; PDF bytes not inspected |
| Teacher notes excluded from export | PASS(unit) | Client strip plus server strip |
| Share by URL hash | PASS(unit) | Encode/decode round trip |
| Short link + room creation / revocation | PASS(unit) | `tests/collab.test.js` |
| Recovery snapshots | PASS(browser) | Modal opens, snapshot list present |
| Templates placed without overlap | PARTIAL | Placement translates to a free origin; not browser-verified |
| Save status reporting | PASS(browser) + PASS(unit) | "Saving…", "Saved locally", "Save failed (Quota)" with an actionable message |
| Quota failure | PASS(unit) | Throwing storage → error status, no false "saved" |
| Cross-tab conflict | PASS(browser) | Storage event sets "Changed in another tab", non-destructive warning toast |
| Corrupt stored document | PASS(unit) | Falls back to a clean scene instead of throwing |

## 9. Collaboration (live room)

| Action | Status | Evidence / note |
|---|---|---|
| Connect to a live backend | BLOCKED | No production backend; local server covered by unit tests |
| Role permission matrix | PASS(unit) | Teacher / editor / questioner / viewer |
| Student payloads strip teacher notes | PASS(unit) | Server-side deletion |
| Broadcast teacher viewport | PASS(unit) | Server message handling |
| Raise hand / reactions | NOT TESTED | Needs two live clients |
| Q&A reply / resolve / reopen | PARTIAL | Round trip unit-tested; long-reply wrapping CSS fixed, not visually retested |
| Revoke room | PASS(unit) | Client and store paths |
| Short read-only snapshot link | PASS(unit) | Capability token rejected after revocation |

## 10. Shortcuts, palette, performance

| Action | Status | Evidence / note |
|---|---|---|
| Command palette over tools, actions, presets, stencils, templates | PASS(browser) | Opens, filters, keyboard navigation |
| New palette entries: table insert, tablet test, six brushes, six arrows, expanded code editor | PASS(browser) | Present and runnable |
| Undo / Redo | PASS(unit) | Bounded history per page |
| Zoom 50 / 100 / 200 % | PASS(browser) | Camera correct at all three, no console errors |
| Console cleanliness | PASS(browser) | No errors or warnings after the full pass |
| Large-board performance | NOT TESTED | No 100+ page / 1000+ element benchmark |
| Accessibility sweep | NOT TESTED | Role/aria labels exist; no screen-reader or contrast audit |

## 11. Deliberately not implemented

| Item | Reason |
|---|---|
| Merged table cells | Needs a spanning model; deferred rather than half-built |
| Per-column drag resize | Fit / Equal / structure dialog cover the teaching cases without a new interaction layer |
| Real-time cursors on notebook previews | Previews are static; the active sheet is the live surface |
| In-browser PDF generation | Zero-dependency build; handout uses print-to-PDF |
| Server-side rendering / image hosting | Collaboration server is Node built-ins only |
| Service-worker background sync | Autosave + recovery snapshots cover offline durability |

## 12. Architecture invariants from the brief

| Invariant | Status | Honest position |
|---|---|---|
| One command registry powering keyboard, palette, menus and toolbar | PARTIAL | Tool ids and actions live in `ui/palette.js` / `ui/toolbar.js` and the menus call the same `app.*` methods, but there is no single declarative registry; adding a command still means touching more than one file |
| No geometry mutation during render | PARTIAL | Tables, strokes and connectors read stored geometry; `drawTableElement` does not write, but `syncFreehandBounds` still normalises freehand bounds from the render path and the SVG exporter calls it too |
| One render scheduler | PASS(unit) | Every mutation routes through `app.requestRender()` (rAF-coalesced) |
| Caches invalidated on change | PARTIAL | Per-element grain/nib caches are derived from element identity and are deterministic; there is no explicit cache-invalidation layer beyond that |
| Versioned brush/arrow settings + migrations with backups | PARTIAL | The workspace prefs object carries the new fields and unknown values are filtered; there is no schema version number or one-time backup for it |
| Bounded collaboration strokes | PASS(unit) | Raw samples capped at 1500 per element before they reach the socket or storage |
