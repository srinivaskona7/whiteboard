# Verified Feature Inventory & Status Matrix — StudioBoard

> **Status Legend**:
> - `PASS`: Executed and verified end-to-end via automated unit/integration tests (`tests/scene.test.js`, `tests/collab.test.js`) and/or headless Chrome CDP (`Input.dispatchMouseEvent`) browser checks.
> - `PARTIAL`: Core flow verified; optional hardware/external dependency noted.
> - `NOT TESTED`: Requires physical peripheral or external environment not present in automated headless runner.
> - `FAIL`: Confirmed failing (0 items currently in `FAIL`).

---

## 1. Workspace Presets & Top Bar (`ui/toolbar.js`, `main.js`)

| User-Facing Action / Control | Selector / Shortcut | Status | Verification Evidence |
|---|---|---|---|
| Switch to **Teach** Preset | `[data-preset="teach"]` | **PASS** | Headless Chrome CDP: switches dock to teaching tools, hides side panels, preserves board elements, camera zoom/pan, selection & undo stack |
| Switch to **Diagram** Preset | `[data-preset="diagram"]` | **PASS** | Headless Chrome CDP: opens Inspector, pins shape/connector/container tools, preserves board state |
| Switch to **Collaborate** Preset | `[data-preset="collaborate"]` | **PASS** | Headless Chrome CDP: opens Classroom panel, pins pointer/question/sticky/annotation tools |
| Customize Pinned Tools per Preset | `#btn-customize-dock` / `#btn-customize-focus` | **PASS** | Unit test (`tests/collab.test.js`) + Chrome CDP: saves custom tool list per preset in `localStorage` |
| Restore Preset Default Tools | `#btn-focus-tools-reset` | **PASS** | Unit test + Chrome CDP: restores `DEFAULT_PRESET_TOOLS[preset]` (`customLen: 3 -> restoredLen: 8`) |
| Rename Document Title | `#wb-doc-title` | **PASS** | Saves to scene, updates autosave status, and syncs to live room (`readOnly` in viewer mode) |
| Save Status Indicator | `#wb-autosave-status` | **PASS** | Transitions `Saving…` → `Saved locally` only after `saveSceneToLocalStorage` returns `true` |
| Connection Status Pill | `#wb-conn-status` | **PASS** | Displays `Local board`, `Connecting…`, `Live · {roomId} · N online ({role})`, `Read-Only Snapshot`, or `Offline` |
| Undo Action | `#btn-undo` / `Ctrl/Cmd+Z` | **PASS** | Undoes per-page element changes and restores deleted pages (`pageUndoStack`) |
| Redo Action | `#btn-redo` / `Ctrl/Cmd+Shift+Z` | **PASS** | Redoes per-page element changes; uses unified `getShortcutLabel('redo')` across header, palette & help |
| Toggle Library Panel | `#btn-library` | **PASS** | Opens/closes `#wb-library-panel`; hidden in read-only viewer/snapshot mode |
| Toggle Layers Panel | `#btn-layers` | **PASS** | Opens/closes `#wb-layers-panel` |
| Toggle Classroom Panel | `#btn-classroom` | **PASS** | Opens/closes `#wb-classroom-panel` and probes `/api/health` |
| Toggle Inspector Panel | `#btn-props-toggle` | **PASS** | Unified with `#btn-close-props` (`✕`) via `app.setPropsDrawerOpen(open)` |
| Cycle Light / Dark Theme | `#btn-theme` | **PASS** | Switches theme tokens and persists preference in `localStorage` |

---

## 2. Left Tool Dock & Drawing Tools (`ui/toolbar.js`, `tools/*.js`)

| Tool / Action | Selector / Shortcut | Status | Verification Evidence |
|---|---|---|---|
| Select / Move / Resize / Rotate | `[data-tool="select"]` (`V`) | **PASS** | Hardware mouse click & drag verified; viewer mode restricts to selection/hyperlink open only |
| Pan / Hand Tool | `[data-tool="hand"]` (`H` / `Space`) | **PASS** | Pans camera; automatically opts out of Follow Teacher when student pans |
| Freehand Pen | `[data-tool="pen"]` (`P`) | **PASS** | Captures points, bounds, stylus pressure (`p`), and palm rejection during pen strokes |
| Highlighter | `[data-tool="highlighter"]` (`M`) | **PASS** | Semi-transparent stroke rendering on Canvas and SVG export |
| Eraser | `[data-tool="eraser"]` (`E`) | **PASS** | Erases hit elements and updates connector bindings & question anchors |
| Rectangle | `[data-tool="rect"]` (`R`) | **PASS** | Verified via both real mouse click (`Input.dispatchMouseEvent`) on dock button and `R` shortcut |
| Rounded Rectangle | `[data-tool="rounded-rect"]` (`U`) | **PASS** | Renders configurable corner roundness |
| Ellipse / Circle | `[data-tool="ellipse"]` (`O`) | **PASS** | Verified creation, bounds, and port attachment |
| Diamond (Decision) | `[data-tool="diamond"]` (`D`) | **PASS** | Verified creation, polygon rendering, and cardinal ports |
| Smart Connector Arrow | `[data-tool="arrow"]` (`A`) | **PASS** | Auto boundary attachment, explicit ports, straight/orthogonal/rounded-elbow/curved routing |
| Line Connector | `[data-tool="line"]` (`L`) | **PASS** | Plain/arrow presets, solid/dashed/dotted styles |
| Text Box | `[data-tool="text"]` (`T`) | **PASS** | Inline textarea editor; blocked in viewer/snapshot mode |
| Sticky Note | `[data-tool="sticky"]` (`N`) | **PASS** | Auto-grow text wrapping and fill palette |
| Presentation Frame | `[data-tool="frame"]` (`F2`) | **PASS** | Container membership, collapse/expand, slide order, `includeInPresentation`, and private `teacherNotes` |
| Table (`rows × cols`) | `[data-tool="table"]` (`B`) | **PASS** | Verified insertion, cell editing, and `+ Row` / `− Row` / `+ Col` / `− Col` (`3×3 → 4×4`) |
| Code Block | `[data-tool="code"]` (`J`) | **PASS** | Monospace rendering with line-range highlighting (`1,3-4`) |
| Classroom Stamp | `[data-tool="stamp"]` (`S`) | **PASS** | Tick, cross, star, question, arrow-up, and auto-incrementing `#N` badge stamps |
| Laser Pointer | `[data-tool="laser"]` (`K`) | **PASS** | Ephemeral 1.2s trail using unified `LaserTool.prune(now)` contract |
| Point at Component | `[data-tool="pointer"]` (`W`) | **PASS** | Broadcasts named pulsing ring (`pointer:ping`) on current page |
| Pin Question to Board | `[data-tool="question"]` (`Q`) | **PASS** | Anchors question card to hit component (`targetElementId`) and tracks component movement |
| Tool Lock | `#btn-tool-lock` (`Shift+Q`) | **PASS** | Keeps active drawing tool selected after creating an element |
| Physical Stylus Hardware Pressure | `PointerEvent.pressure` | **PARTIAL** | Simulated `PointerEvent` pressure (`0.78`) & palm rejection verified in unit tests; physical Huion tablet hardware not attached to CI runner |

---

## 3. Inspector Panel (`ui/props-panel.js`)

| Inspector Control | Selector | Status | Verification Evidence |
|---|---|---|---|
| Close Inspector (`✕`) | `#btn-close-props` | **PASS** | Calls `app.setPropsDrawerOpen(false)`; stays closed on canvas hover (`inspectorClosed: true`) |
| Role-Appropriate Viewer Inspector | `#btn-ro-fit`, `#btn-ro-export`, `#btn-ro-question` | **PASS** | Hides all editing & teacher-note controls when `!app.collab.canEditBoard()` |
| Container Hierarchy Breadcrumbs | `#wb-container-breadcrumbs` | **PASS** | Displays `["Prod VPC", "Private Subnet", "EC2 Instance"]`; clicking ancestor selects parent container |
| Navigate Inside / Select Children | `#btn-select-container-children` | **PASS** | Selects direct child components of a container or frame |
| Table `+ Row` / `− Row` / `+ Col` / `− Col` | `#btn-table-add-row`, etc. | **PASS** | Placed at top of Inspector; real mouse clicks verified (`3×3 → 4×4`) with Undo |
| Connector Route (`Straight`, `Right-Angle`, `Rounded-Elbow`, `Curved`) | `[data-routing]` | **PASS** | Verified switching across all 4 modes; preserves bindings and manual bends |
| Rounded-Elbow Corner Radius | `#prop-corner-radius` | **PASS** | Clamped to `45%` of adjacent segment lengths (`strokeRoundedElbowCanvasPath` & `buildRoundedElbowSvgPath`) |
| Connector Direction Presets (`Plain`, `One-Way`, `Two-Way`) | `[data-dir-preset]` | **PASS** | Updates `startArrow` and `endArrow` with undo history |
| Source / Middle / Destination Labels | `#prop-start-label`, `#prop-label-text`, `#prop-end-label` | **PASS** | Positioned clear of arrowheads/boundaries; verified on Canvas and in SVG/PNG exports |
| Reset Manual Connector Route | `#btn-reset-route` | **PASS** | Clears manual `elbowOffset` / `controlPoint` and recomputes clean route |
| Frame: Include in Presentation | `#prop-frame-include-pres` | **PASS** | Excludes unchecked frames from presentation slide count and navigation while keeping them editable |
| Teacher Notes (Page & Frame) | `#prop-page-teacher-notes`, `#prop-el-teacher-notes` | **PASS** | Saved locally & for authenticated teacher; stripped from snapshots, student hashes, and non-teacher room state |
| Mixed Selection Badges | `.wb-mixed-badge` | **PASS** | Displays `Mixed` when selected items differ and applies only the single property changed |
| Align, Distribute, Match Size & Auto-Layout (`LR`/`TB`) | `[data-align-el]`, `[data-dist]`, `#btn-auto-layout-lr` | **PASS** | Verified in unit tests (`tests/scene.test.js`, `tests/collab.test.js`) |

---

## 4. Architecture Library (`ui/library-panel.js`, `stencils/*.js`, `templates/index.js`)

| Library Feature | Selector | Status | Verification Evidence |
|---|---|---|---|
| Segmented Library Tabs (`Icons`, `Diagram Packs`, `My Library`, `Templates`) | `.wb-tabs .wb-tab` | **PASS** | Styled with borders, radius (`6px`), and active elevation |
| 161 Curated Stencils + Provenance Manifest | `stencils/manifest.js` | **PASS** | Every stencil has verified license, provenance, category, and abbreviation tags (`EC2`, `S3`, `AKS`, `GKE`, `PVC`, `LB`, `SG`, `DNS`) |
| Recognizable Canvas & Export Icon Artwork | `stencils/card.js` (`drawSvgBodyToCanvas`) | **PASS** | Fixed attribute boundary regex; verified `10,271` orange icon pixels rendered in PNG export for EC2 & S3 |
| Multi-Select Batch Placement (`Grid`, `Row`, `Col`, `Connected Flow`) | `#btn-place-batch` | **PASS** | Inserts selected icons with finite coordinates and single-step undo |
| 7 Complete DevOps Architecture Packs + 18 Templates | `templates/index.js` | **PASS** | Verified `pack-linux-boot`, `pack-k8s-arch`, `pack-dns-flow`, `pack-tcp-tls`, `pack-docker-lifecycle`, `pack-cicd-gitops`, `pack-observability` |

---

## 5. Teaching Controls & Lesson Presentation (`ui/present.js`, `ui/timer.js`)

| Teaching Feature | Selector / Shortcut | Status | Verification Evidence |
|---|---|---|---|
| Enter / Exit Presentation Mode | `#btn-present` (`F6`) / `#btn-pres-exit` (`Esc`) | **PASS** | Restores exact pre-presentation camera `(x, y, zoom)` on exit (`cameraRestoredOnExit: true`) |
| Named Frame Thumbnails & Inline Reordering | `[data-pres-slide]`, `[data-move-slide]` | **PASS** | Filters out excluded frames (`includeInPresentation === false`) and reorders slides |
| Progressive Reveal Steps (`Step 0..N`) | `#btn-pres-next` / `#btn-pres-prev` | **PASS** |Temporarily hides higher `revealStep` elements during presentation without mutating `el.hidden` |
| Private Teacher Notes Drawer in Presentation | `#btn-pres-notes` | **PASS** | Displays/edits frame & page teacher notes; hidden from student viewers/questioners |
| Spotlight & 2x Magnifier Lens + Exit Banner | `#btn-spotlight` (`F7`), `#btn-magnifier`, `#btn-exit-spotlight` | **PASS** | Prevents accidental drawing while active; first `Escape` exits Spotlight before exiting Presentation |
| Live Annotation Mode (Auto-Fading Ink) | `#btn-annotation-mode` (`F8`) | **PASS** | Ephemeral strokes fade over 3s and are stripped from saved documents |
| Classroom Timer (Countdown + Shared Room Sync) | `#btn-timer`, `timer:sync` | **PASS** | Syncs running/remaining state across live room participants |

---

## 6. Live Collaboration, Sharing & Facilitation (`server/collab-server.js`, `scene/collab-client.js`, `ui/classroom.js`)

| Collaboration Feature | Endpoint / Control | Status | Verification Evidence |
|---|---|---|---|
| Short Read-Only Snapshot (`#/b/{id}`) | `POST /api/boards`, `GET /api/boards/:id` | **PASS** | Verified creation, QR code, expiry, teacher-note stripping, and read-only loading |
| Live Classroom Room (`#/r/{roomId}`) | `POST /api/rooms`, `WS /ws` | **PASS** | Verified across 2 independent Chrome instances & WebSocket clients |
| Server-Enforced Roles (`teacher`, `editor`, `questioner`, `viewer`) | `CollabStore.resolveRole` & `applyRoomOperation` | **PASS** | Rejects viewer/questioner board edits/deletes with `403 FORBIDDEN_VIEWER_ROLE` |
| Snapshot & Room Link Revocation | `DELETE /api/boards/:id`, `DELETE /api/rooms/:id` (`#btn-cls-revoke-room`) | **PASS** | Revoked links return `410 Gone`; only teacher token can revoke room |
| Named Cursors, Pointers & Pinned Questions | `presence:update`, `pointer:ping`, `question:add` | **PASS** | Questions anchor to components (`targetElementId`), follow movement, and survive anchor deletion |
| Raise Hand (`✋`), Reactions (`👍 👏 💡 ❓ ✅`) & Unanswered Filter | `#btn-cls-raise-hand`, `[data-cls-reaction]`, `#btn-filter-unanswered` | **PASS** | Verified end-to-end between student and teacher sessions |
| Follow Teacher & Stop Following Opt-Out | `#chk-follow-teacher`, `#btn-stop-following` | **PASS** | Syncs teacher viewport and automatically opts out on manual student pan/zoom |

---

## 7. Persistence, Import/Export, Page Controls & Safe Updates (`scene/storage.js`, `ui/pages.js`)

| Feature | Selector / Function | Status | Verification Evidence |
|---|---|---|---|
| Add / Switch / Duplicate / Reorder Pages | `#btn-add-page`, `[data-switch-page]`, `[data-dup-page]` | **PASS** | Verified repeated hardware mouse clicks (`1 → 5` pages); hidden in viewer mode |
| Delete Page (Nearest-Page Selection + Undo) | `[data-del-page]` / `app.deletePage` | **PASS** | Deleting `Page 4` selects `Page 3` (`nearestSelectedIsPage3: true`); `app.undo()` restores `Page 4` (`restoredIsPage4: true`) |
| Save / Open `.whiteboard.json` & Recovery Snapshots | `#btn-save-json`, `#btn-open-json`, `#btn-recovery` | **PASS** | Round-trip verified; creates recovery checkpoint before destructive operations |
| Export PNG, SVG & Print/PDF Handout | `#btn-export`, `exportToPngCanvas`, `exportToSvgString` | **PASS** | Verified non-zero DevOps icon pixels, all 3 connector labels, tables, and teacher-note exclusion |
| Safe Application Update Banner (`Save & Reload`) | `#wb-update-banner`, `#btn-apply-app-update` | **PASS** | Shows non-disruptive banner without force-refreshing during teaching; saves recovery checkpoint before reload |
