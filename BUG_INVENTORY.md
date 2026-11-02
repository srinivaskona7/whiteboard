# StudioBoard Reproducible Bug Inventory & Root-Cause Audit

This inventory documents the confirmed production defects and interface mismatches discovered during the comprehensive architecture and runtime audit, along with reproduction steps, expected vs. actual behavior, root causes, severity, and verification tests.

---

## BUG-01 — Critical: Production Render Crash (`this.laserTool.prune is not a function`)
- **Severity**: Critical (P0 — Halts canvas rendering immediately on startup)
- **Reproduction Steps**:
  1. Launch StudioBoard (`npm run dev` or `npm run build && npm run preview`).
  2. `WhiteboardApp` constructor calls `this.requestRender()`, which executes `this.renderNow()`.
  3. Line 343 of `main.js` calls `const activeTrail = this.laserTool.prune(now);`.
- **Expected Behavior**: `this.laserTool.prune(now)` prunes expired laser points older than `LASER_LIFETIME_MS` (1200ms) using a unified `Date.now()` clock and returns the active trail array so `CanvasRenderer.render()` draws the board.
- **Actual Behavior**: `Uncaught TypeError: this.laserTool.prune is not a function` at `WhiteboardApp.renderNow (main.js:343)`. The canvas remains blank (`#ffffff`) and `this.laserTool` also ran a competing `requestAnimationFrame` loop (`startCleanupLoop`) using `performance.now()`.
- **Root Cause**: `tools/laser.js` only defined `onPointerDown`, `onPointerMove`, `onPointerUp`, and `startCleanupLoop()`, omitting `prune(now)`, `getActiveTrail(now)`, `hasActiveTrail(now)`, and `cancel()`.
- **Fix & Verification**: Implemented the complete `LaserTool` contract in `tools/laser.js` with `Date.now()` normalization, removed the competing RAF loop, guarded `render/canvas.js`, and added automated unit/integration tests in `tests/scene.test.js`.

---

## BUG-02 — Critical: Inline Text Editor Commit & Property Mismatch (`this.textTool.commit is not a function`)
- **Severity**: Critical (P0 — Crashes when switching tools or clicking canvas while text editor is open)
- **Reproduction Steps**:
  1. Select the Text (`T`) tool or double-click a shape to open the inline text editor.
  2. Click on the canvas or switch to another tool (`V`, `R`, etc.).
- **Expected Behavior**: The open text editor commits its text to the element, closes cleanly, and records history.
- **Actual Behavior**: `main.js` called `this.textTool.commit()` and read `this.textTool.editingEl`, whereas `tools/text.js` only defined `commitAndClose()` and `this.editingElement`, and lacked `onPointerMove` and `onPointerUp` handlers.
- **Root Cause**: Method and property naming drift between `main.js` and `tools/text.js`.
- **Fix & Verification**: Added `editingEl` getter, `commit()`, `cancel()`, `onPointerMove()`, and `onPointerUp()` to `TextTool` in `tools/text.js`.

---

## BUG-03 — High: Debounced Autosave Argument Inversion
- **Severity**: High (P1 — Status pill and storage quota callbacks never fire; debounce delay defaults to `NaN` / `0ms`)
- **Reproduction Steps**:
  1. Draw or move any element on the board.
  2. Observe `this.scheduleAutosave(this.scene)` in `main.js`.
- **Expected Behavior**: Autosave debounces for 350ms, writes sanitized scene JSON to `localStorage`, updates `#wb-autosave-status` to `Saved locally` only after a verified write, and invokes `onQuotaError` if storage is full.
- **Actual Behavior**: `main.js` called `createDebouncedAutosave((state) => ..., 350)`, while `scene/storage.js` expected `(delayMs = 350, onQuotaError = null, onStatusChange = null)`.
- **Root Cause**: Parameter order mismatch between `main.js` and `scene/storage.js`.
- **Fix & Verification**: Updated `createDebouncedAutosave` in `scene/storage.js` to accept both `(delayMs, onQuotaError, onStatusChange)` and `(onStatusChange, delayMs, onQuotaError)` and verified write confirmation before reporting `saved`.

---

## BUG-04 — High: `NaN` Coordinates on Duplicate, Paste, and Page Duplication
- **Severity**: High (P1 — Duplicated/pasted elements corrupt board geometry)
- **Reproduction Steps**:
  1. Select a shape and press `Ctrl/Cmd + D` (or `Ctrl/Cmd + C` then `Ctrl/Cmd + V`, or duplicate a page).
- **Expected Behavior**: Cloned elements are offset by `(dx, dy)` with valid finite coordinates.
- **Actual Behavior**: `main.js` called `cloneElementsWithBindings(selected, 28, 28)` passing numeric `dx, dy`, while `scene/model.js` expected `offset = { x: 24, y: 24 }` and computed `c.x += offset.x` (`undefined`), producing `x: NaN, y: NaN`.
- **Root Cause**: Signature mismatch in `cloneElementsWithBindings` (`scene/model.js`).
- **Fix & Verification**: Updated `cloneElementsWithBindings` in `scene/model.js` to accept either `(elements, dx, dy)` or `(elements, { x, y })`.

---

## BUG-05 — High: Missing `WhiteboardApp` Methods Invoked by UI Panels, Dialogs, and Command Palette
- **Severity**: High (P1 — Clicking UI controls or Command Palette actions throws `TypeError`)
- **Reproduction Steps**:
  1. Change page background or click "Copy Style" in `ui/props-panel.js`.
  2. Reorder layers in `ui/layers.js` or reorder pages in `ui/pages.js`.
  3. Export PNG or SVG in `ui/dialogs.js`.
  4. Run Command Palette (`Ctrl/Cmd + K`) commands in `ui/palette.js` or insert a DevOps Diagram Pack in `ui/library-panel.js`.
- **Expected Behavior**: Every UI button and Command Palette action executes its corresponding `WhiteboardApp` method cleanly.
- **Actual Behavior**: Missing methods on `WhiteboardApp`: `getViewportCenterWorld`, `setBackground`, `copySelectedStyle`, `reorderElementById`, `reorderPage`, `exportPngDownload`, `copyPngToClipboard`, `downloadBlob`, `openImageFilePicker`, `openWhiteboardFilePicker`, `saveWhiteboardFile`, `setZoom`, `toggleTheme`, `toggleFullScreen`, `fadingInk`, `scheduleFadingCleanup`, and `pack.build()` in `buildDevOpsDiagramPacks()`. Also `tools/image.js` referenced undefined `pt.x` instead of `pos.x`.
- **Root Cause**: Incomplete coordinator method surface in `main.js`, undefined variable in `tools/image.js`, and non-deterministic random IDs without `.build()` in `ui/registry.js`.
- **Fix & Verification**: Implemented all missing methods on `WhiteboardApp`, fixed `pos.x`/`pos.y` in `tools/image.js`, and gave `buildDevOpsDiagramPacks()` deterministic IDs and a `.build()` factory.

---

## BUG-06 — Medium: Port Drag Sub-Interaction & Format Painter Property Mismatch
- **Severity**: Medium (P2 — Dragging from a shape's connection port in Select mode fails to route pointer move/up)
- **Reproduction Steps**:
  1. Hover a shape in Select mode and drag from one of its cardinal connection ports (`top`, `right`, `bottom`, `left`).
- **Expected Behavior**: Dragging from a port starts `connectorTool` via `activeSubInteraction` and completes the bound connector on pointer release.
- **Actual Behavior**: `tools/select.js` set `this.app.activeSubInteraction = this.app.connectorTool`, which `main.js` ignored during `_onPointerMove` and `_onPointerUp`.
- **Root Cause**: `_getToolHandler()` in `main.js` did not check `this.activeSubInteraction`.
- **Fix & Verification**: Updated `_getToolHandler()` and `cancelActiveInteractions()` in `main.js` and synchronized `copiedStyle` / `formatPainterStyle`.

---

## BUG-07 — Medium: Image Crop Overlay Property Mismatch & Minimap Not Rendered
- **Severity**: Medium (P2 — Cropping an image throws `TypeError`; Minimap canvas stays blank)
- **Reproduction Steps**:
  1. Select an image and click "Crop Image", or toggle the Minimap button in the bottom bar.
- **Expected Behavior**: Crop overlay renders green dashed bounds and Minimap renders a live overview of board elements and viewport bounds.
- **Actual Behavior**: `main.js` set `cropState.box` while `render/canvas.js` read `cropState.rect`; `CanvasRenderer` ignored the `minimapCanvas` parameter.
- **Root Cause**: Property name mismatch (`box` vs `rect`) and missing `drawMinimap` implementation in `render/canvas.js`.
- **Fix & Verification**: Supported both `cropState.rect` and `cropState.box` and implemented `drawMinimap()` in `render/canvas.js`.

---

## BUG-08 — Medium: Desktop Topbar Wrapping, Bottom Bar Overlap, Panel Close Desync & `Q` Shortcut Collision
- **Severity**: Medium (P2 — Visual overlap and conflicting keyboard shortcut)
- **Reproduction Steps**:
  1. Open StudioBoard on desktop (`1280×800` or `1440×900`) and inspect header, bottom page bar, zoom bar, and close (`✕`) buttons on panels.
  2. Press `Q` on the keyboard.
- **Expected Behavior**: Topbar stays on a single clean row, bottom page navigation and zoom controls occupy distinct non-overlapping regions, panel close buttons sync toolbar active states (`aria-pressed`), `Q` selects Pin Question, and `Shift+Q` toggles Tool Lock.
- **Actual Behavior**: CSS class names in `ui/toolbar.js`, `ui/pages.js`, and `ui/library-panel.js` differed from `styles.css`, causing layout wrapping/overlap; `Q` was assigned to both Question Pinning and Tool Lock.
- **Root Cause**: Selector drift between `ui/*.js` and `styles.css`, plus duplicate shortcut label on `#btn-tool-lock`.
- **Fix & Verification**: Synchronized layout selectors and responsive flexbox/grid rules in `styles.css`, updated panel close handlers in `ui/*.js`, and separated `Q` (Question) from `Shift+Q` (Tool Lock).
