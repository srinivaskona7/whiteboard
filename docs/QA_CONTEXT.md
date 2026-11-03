# QA Context — StudioBoard

Last updated: 2026-11-03 (drawing / arrow / table / tablet stage)

## 1. What was tested

| Item | Value |
|---|---|
| Source commit | `dcece8c` on `main`, plus the uncommitted working-tree changes listed in §6 |
| Build | Vite 5 production build (`npm run build`), `base: './'` |
| App version | `package.json` 1.0.0 |
| Node / npm | v26.13.0 / 11.20.0 |
| Serving | Vite dev server `http://localhost:5177` (`npm run dev -- --port 5177 --strictPort`) |
| Browser | Chrome via the `chrome-devtools` MCP automation profile |
| Viewport | Desktop, default automation viewport (~1280×800), macOS darwin 27.0.0 |
| Collaboration backend | Exercised through `node --test` only; **no live multi-browser room was run** |
| Production deployment | **Not tested.** No deploy, image build, Helm install or pipeline trigger was performed (deployment is manual and belongs to the user) |
| Pen hardware | **No physical tablet attached.** Pen input was synthesized (`pointerType: 'pen'`) in the browser; Huion-specific validation is **BLOCKED** |

## 2. Verification method

1. Reproduce the reported behaviour in the running app before changing code.
2. Change the existing implementation site; no parallel model, renderer or history.
3. Re-run the same interaction in the browser and record the observed value.
4. `npm test`, then `npm run build`, then read the console for errors.
5. Anything not exercised is labelled **NOT TESTED** or **BLOCKED**, never passing.

## 3. Executed commands and results

| Command | Result |
|---|---|
| `npm test` | **69 tests, 21 suites, 69 pass / 0 fail** (≈0.7 s) |
| `npm run build` | success; JS 513.5 kB (gzip 141.4 kB), CSS 34.4 kB (gzip 6.6 kB) |
| Console after a full interaction pass | no errors, no warnings |
| `npm run dev -- --port 5177 --strictPort` | served the app used for every browser check below |

## 4. Browser evidence on the current build

### Drawing and erasing

| Check | Expected | Actual |
|---|---|---|
| Six drawing presets | Six visibly different cards, each applying its own width/opacity/geometry | 6 cards rendered; signatures distinct; Technical 2 px monoline, Pressure Ink varies width with `p` |
| Pressure input | Pen pressure changes segment width | Synthesized pen stroke produced non-constant widths; mouse pressure ignored |
| Highlighter overlap | No self-darkening inside one stroke | Crossing pixel `rgb(249,237,187)` equals single-pass pixel; element opacity applied once |
| Stroke eraser | Splits ink, keeps the rest | 40-point stroke + eraser size 20 → 2 pieces, 35 points total |
| Eraser ring | Visible at pointer with size | `eraserCursor` present, radius tracks size |
| Stabilization | Off / Adaptive / Stabilizer selectable independent of pressure | Selector present, value stored on element |
| Tool ↦ preset | Highlighter draws a highlighter; switching back to Pen restores its own preset | `setTool('highlighter')` → `brushForCurrentTool().id === 'highlighter'`; back to pen → `technical` |
| Preset cards on a selection | Clicking a card restyles the selected stroke | Selected 41-point stroke → Pencil → `el.brush === 'pencil'`; Apply button enabled |
| Size/opacity overrides | Persist across reload | Slider 9 px → stored `brushOverrides {strokeWidth:9}` → still 9 after `location.reload()` |
| Drawing controls at idle | Inspector hidden; Canvas chip visible | Panel hidden at idle, chip shown, chip opens canvas settings |

### Arrows

| Check | Expected | Actual |
|---|---|---|
| Direct dock action | One click inserts a plain one-way arrow | Inserted 180 px straight arrow, `startArrow:none`, `endArrow:arrow`, `sloppy:true` |
| Dock split popover | Six preview cards | 6 cards, 6 inline SVG previews, closes after choosing |
| Preset application | Documented combination only | `dashed-two-way` → straight + dashed + heads both ends; `rounded-elbow` → routing + radius 14 + triangle head |
| Inspector preset cards | Same six with previews, active state | 6 cards; clicking applies immediately |
| Context menu on arrow | Path type, heads, reverse, reset, duplicate, delete | Present with keyboard navigation |

### Tables

| Check | Expected | Actual |
|---|---|---|
| Insert dialog | Rows, columns, header, shading, alignment, TSV | Opens with defaults; TSV of 3×3 grew a 2×2 request to 3×3 instead of dropping cells |
| Fit to content | Real measured column widths, no clipped cell | 236×104, `colWidths [74,80,82]`, `rowHeights [35,35,35]` |
| Striping / header | Rendered and exported | Canvas tint applied; unit test asserts both tints in SVG |
| Inspector structure controls | Row/col add-remove, header, stripe, align, valign, padding, equal columns | All present; padding change persisted to `cellPadding` |
| Spreadsheet paste | Tab/newline text fills the grid from the active cell | 2×2 paste at (0,0) produced `[A,B,Owner]` / `[C,D,platform]`, nothing dropped |
| Tab / Shift+Tab in a cell | Commit and move to the next/previous cell, wrapping rows | (0,0) → Tab → (0,1) → Shift+Tab → (0,0), editor stays open |
| Long content | Wraps, never silently clips | Wrapped at 250% zoom with ellipsis only past the available line count |

### Code, tablet, export, views

| Check | Expected | Actual |
|---|---|---|
| Expanded code editor | Exact whitespace round trip, top-left anchor | Saved text byte-identical; `y` unchanged after growth |
| Tablet test canvas | Live pressure/tilt/samples, explicit BLOCKED note | BLOCKED notice shown before pen input; synthesized pen reported `range 0.20 – 1.00`, 2 coalesced samples, tilt `—` |
| Pressure calibration | Applies and persists | `min 0.25 / max 1.10` stored in workspace prefs and honoured by `buildStrokeSegments` |
| PNG export | Valid PNG bytes | 764×424, signature `137 80 78 71 13 10 26 10`, ≈9.2 kB |
| SVG export | Valid, finite | 1391 bytes, `<svg>…</svg>`, 4 paths, no `NaN`/`Infinity` |
| Presentation | No authoring controls | Canvas chip hidden, pages bar `display:none`, presenter controls only |
| Notebook view | Projection only, camera untouched | Sheets render, chip hidden, document camera stays 1 |
| Zoom 50 / 100 / 200 % | Rendering stable at all three | Camera reports 0.5 / 1 / 2, no console errors |
| Save status | Reports quota failure honestly | Unit test drives a throwing storage; status becomes error, not "saved" |
| Cross-tab conflict | Warns instead of overwriting silently | Synthetic storage event set the pill to "Changed in another tab" with a warning toast |
| Workspace arrow defaults | Teach/Diagram/Collaborate start from their own arrow look | teach → `simple-sketch`, diagram → `clean-technical`; dock insertion followed the active preset |
| Connector roughness control | Clean / Sketch / Rough applies to the selection | Click Rough → `roughness:2`, `sloppy:true` on the arrow |
| Object opacity | Slider changes the selection | Arrow opacity → `0.4`; canvas and SVG apply it |
| Locked objects | Mutating menu/Inspector actions refuse | Locked table: all nine structure actions `disabled:true` in `buildContextItems`; Inspector shows "Unlock the table…" |
| Context-menu focus | Escape returns focus | `activeElement` after Escape = `#wb-canvas-wrap`; `aria-activedescendant` = `ctx-item-1` |

## 5. Defects reproduced, fixed, re-verified in this stage

| Defect | Root cause | Fix site | Status |
|---|---|---|---|
| Full Inspector stayed open with nothing selected | No contextual visibility rule | `main.js` `propsContextVisible`, `updateUI` | Fixed, browser-verified |
| Eraser showed stroke styling | Same panel for every tool | `ui/props-panel.js` eraser section | Fixed, browser-verified |
| No right-click menu | No canvas `contextmenu` handler | `ui/context-menu.js`, `main.js` | Fixed, browser-verified (canvas, object, arrow, table) |
| Simple arrow required connector configuration | Arrow only available as a tool | Dock split button `insertSimpleArrow` | Fixed, browser-verified |
| Long code block grew left under the rail | Code auto-growth anchored centre | `scene/model.js` `autoGrowShapeForText` | Fixed, unit-verified |
| Long table content crowded cell edges | No wrapping in canvas or SVG | `render/shapes.js`, `render/svg-export.js` | Fixed, browser-verified at 250% |
| Table ignored `headerRow:false` | Renderer always painted the header tint | `render/shapes.js`, `render/svg-export.js` | Fixed, unit-verified |
| Table header/stripe/valign lost on reload | `createElement` dropped unknown props | `scene/model.js` | Fixed, round-trip test |
| Code language/wrap lost on reload | Same dropped-props cause | `scene/model.js` | Fixed, round-trip test |
| Inspector table row/col buttons assumed a rectangular `cells` grid | Direct array mutation | `scene/table.js` shared helpers | Fixed, unit-verified |
| Canvas settings chip stayed visible in presentation | `presentUI.enter()` did not refresh the UI, and the chip was outside the presentation hide rule | `ui/present.js`, `styles.css` | Fixed, browser-verified |
| Highlighter tool drew the Technical pen | `currentBrush` was global and never switched with the tool | `main.js` `setTool` | Fixed, browser-verified |
| Preset card / Apply to Selected were no-ops | Apply re-applied the selection's existing preset; cards never passed `applyToSelection` | `ui/props-panel.js`, `main.js` `setBrushPreset` | Fixed, browser-verified |
| Brush size/opacity reverted on reload | Slider wrote `app.brushOverrides` without persisting it | `main.js` `setBrushOverrides({silent})`, `ui/props-panel.js` | Fixed, browser-verified across reload |
| Workspace settings (brush, eraser, pin) discarded on reload | `loadWorkspacePrefs` returned a fixed whitelist | `scene/storage.js` | Fixed, unit + browser-verified |
| Whole-Object eraser trimmed ink into pieces | Ink handling keyed on `scope` only | `tools/draw.js` `eraseAt` | Fixed, browser-script-verified |
| Right-click and Inspector mutated locked tables/arrows | No `locked` guard on the new actions | `ui/context-menu.js`, `ui/props-panel.js`, `ui/dialogs.js` | Fixed, browser-verified |
| Roughness buttons did nothing | Markup had no click handler | `ui/props-panel.js` | Fixed, browser-verified |
| Connector opacity had no control | Stroke section lacked an opacity slider | `ui/props-panel.js` | Fixed, browser-verified |
| Tabular SVG text ignored `textColor` and wrapped differently from canvas | Export used the border colour and a character estimate | `render/svg-export.js` | Fixed, unit-verified (export now measures with a canvas context) |
| Fit to content ellipsised its own fitted text / header wrapped after fit | Row budget left no 8 px headroom; header measured at 400 | `render/shapes.js` `fitTableToContent` | Fixed, unit-verified |
| TSV-grown tables lost rows when reopened | Dialog clamped to 50×20 regardless of the existing table | `ui/dialogs.js` | Fixed, code-verified |
| Malformed `rows` (2.5, 1e9) crashed rendering | Raw document values used as array lengths | `scene/model.js` `createElement` | Fixed, unit-verified |
| Single-point ink dot exported at full opacity | Opacity group only wrapped multi-point strokes | `render/svg-export.js` | Fixed, unit-verified |
| Viewer could paste TSV / toggle grid settings | Paste listener and two toggles had no role check | `main.js` | Fixed, code-verified (no second session to exercise) |
| Context menu announced no active item and dropped focus | `aria-activedescendant` set only on navigation; canvas cannot take focus | `ui/context-menu.js`, `main.js` | Fixed, browser-verified |

## 6. Working-tree changes covered by this report

`index.html`, `main.js`, `render/canvas.js`, `render/shapes.js`, `render/svg-export.js`, `scene/model.js`, `scene/storage.js`, `scene/table.js` (new), `scene/brushes.js` (new), `scene/arrow-presets.js` (new), `styles.css`, `tools/connector.js`, `tools/draw.js`, `tools/text.js`, `ui/arrow-preview.js` (new), `ui/context-menu.js` (new), `ui/dialogs.js`, `ui/palette.js`, `ui/present.js`, `ui/props-panel.js`, `ui/toolbar.js`, `tests/drawing.test.js` (new), `docs/ADR-001-input-strokes-arrows-persistence.md` (new).

## 7. Not tested / blocked

| Item | Why |
|---|---|
| Huion (or any) physical tablet pressure curve, tilt, eraser button | No hardware attached; the test canvas says so explicitly |
| Pen input through the real OS driver stack | Synthetic `PointerEvent`s only |
| Pointer capture with a real pointer leaving the canvas | `setPointerCapture` is wired, but synthetic events cannot activate a pointer id, so the behaviour is unverified outside hardware |
| Live multi-device room (revocation, kick, timer role) | No second authenticated browser session; server covered by unit tests |
| Printer/PDF bytes | Print DOM verified; OS dialog and PDF output not inspected |
| Screen-reader sweep / contrast audit | Not run |
| Large-board performance (100+ pages, 1000+ elements) | Not measured |
| Safari / Firefox | Chromium only |
| Merged table cells | Deliberately deferred (documented in the matrix) |

## 8. Remaining uncertainty

- `.data/collab-store.json` is relative to the server CWD; production needs a persisted volume.
- Auto Clean still prefers orthogonal A* on dense diagrams; no large-diagram benchmark recorded.
- Grain is deterministic per element id + `createdAt`. Copying an element carries the id/seed pairing but not an identical visual position; this is intended (a copy looks slightly different, like re-inking).
- Raw stroke samples are capped at 1500 per element; beyond that re-smoothing is approximate by design.
