# Feature Matrix — StudioBoard

Verified against commit `b8c9171` + the working-tree changes listed in [QA_CONTEXT.md](./QA_CONTEXT.md) §6.
Legend: **PASS(browser)** = observed in the running app; **PASS(unit)** = covered by `node --test` only;
**PARTIAL** = works with a known limitation; **NOT TESTED** = no evidence gathered; **BLOCKED** = cannot be
verified in this environment.

Age of evidence: all rows below were checked or re-checked on 2026-11-03 unless marked otherwise.

## 1. Tools

| Action | Status | Evidence / note |
|---|---|---|
| Select (V), Pan (H) | PASS(browser) | Used throughout notebook and diagram checks |
| Pen (P), Highlighter (M), Eraser (E) | PASS(browser) | Drawing/erase exercised on the 10-page notebook |
| Rectangle, Rounded Rect, Ellipse, Diamond | PASS(browser) | Drawn and double-click edited |
| Line (L), Smart Connector Arrow (A) | PASS(browser) + PASS(unit) | Binding, ports, orthogonal path tests |
| Text (T) | PASS(browser) | Inline editor opens on dblclick and via F2/Enter |
| Sticky Note (N) | PASS(browser) | — |
| Pointer (W), Question pin (Q) | NOT TESTED | Requires a second live participant to be meaningful |
| Lasso (Shift+L) | NOT TESTED | — |
| Frame / Slide container (F2) | PASS(unit) | Presentation slide ordering tests |
| Editable Table (B) | PASS(browser) | Cell double-click opens the editor |
| Code Block (J) | PASS(browser) | Multiline textarea, newlines preserved exactly |
| Classroom Stamp (S) | NOT TESTED | — |
| Laser pointer (K) | NOT TESTED | Presentation control renders; beam not driven in automation |

## 2. Connectors

| Action | Status | Evidence / note |
|---|---|---|
| Routing: Auto Clean | PASS(browser) + PASS(unit) | Straight on clear path, bends around obstacles, no NaN |
| Routing: Straight | PASS(browser) | 2-point route |
| Routing: Right-Angle (orthogonal) | PASS(unit) | A* path, collinear-dup removal |
| Routing: Rounded-Elbow | PASS(unit) | Corner radius clamped 4–36, canvas + SVG path builders |
| Routing: Curved | PASS(unit) | Control-point route preserved |
| Manual waypoints after drag | PASS(unit) | `manualRoute` set on drag; reset clears it |
| Start / middle / destination labels | PASS(unit) | SVG export includes all three |
| Direction presets (plain / one-way / two-way) | PASS(unit) | — |

## 3. Inspector

| Action | Status | Evidence / note |
|---|---|---|
| Text, colour, stroke, fill, size edits | PASS(browser) | — |
| Code content = multiline textarea | PASS(browser) | 22 lines round-tripped unchanged |
| Connector routing panel | PASS(browser) | Auto Clean button present and applied |
| Page notes (teacher, private) | PASS(browser) | Autosaves on `input`, survives reload, empty value preserved |
| Frame notes | PASS(browser) | Same persistence path as page notes |
| Lock / hide / z-order / layers | PASS(browser) | — |
| Mixed-selection "Mixed" badge | PASS(browser) | — |

## 4. Pages and views

| Action | Status | Evidence / note |
|---|---|---|
| Diagram workspace | PASS(browser) | Default mode; single canvas |
| Vertical Notebook view over the same document | PASS(browser) | 10 sheets, live canvas in the active sheet, 9 previews |
| Notebook zoom (− / + / Ctrl+wheel) | PASS(browser) | 0.55 → 0.80; document camera stays 1 |
| Notebook jump-to-page selector | PASS(browser) | Rebuilt on rename and page switch |
| Add page / Add 10-page lesson | PASS(browser) | `addPages` clamps 1–50 |
| Reorder, duplicate, delete page from notebook header | PASS(browser) | Deletes activate the nearest remaining page |
| Page switch keeps canvas interactivity | PASS(browser) | Drawing works in the reparented canvas |
| Presentation mode | PASS(browser) | Full-viewport, no pages bar, no add/reorder/duplicate/delete controls |
| Reveal steps (S1, S2…) | PASS(unit) | Hidden until `revealStep` reached |
| Focus mode / Fullscreen | PASS(browser) | Toggle verified; reduced-motion CSS present |
| Viewer sees read-only timer | PARTIAL | Role gate added in `ui/timer.js`; **no live-room browser run** |

## 5. Files, export, sharing

| Action | Status | Evidence / note |
|---|---|---|
| Save `.whiteboard.json` | PASS(browser) | Serialised scene, recovery snapshot taken first |
| Open `.whiteboard.json` | PASS(unit) | Parse + migrate |
| PNG export (scale 1–3, transparent, selection-only) | PASS(browser) | Non-empty raster produced |
| Copy PNG to clipboard | NOT TESTED | Requires clipboard permission in the automation profile |
| SVG export | PASS(browser) | 366-byte SVG document produced |
| Multi-page handout (PDF via print) | PASS(browser, DOM) | 10 ordered sheets; the OS print dialog and PDF bytes were not inspected |
| Export excludes teacher notes | PASS(unit) | Server strip + persistence strip tests; renderer never draws notes |
| Share by URL hash (offline fallback) | PASS(unit) | Encode/decode round trip |
| Short link + room creation | PASS(unit) | `tests/collab.test.js` |
| Link revocation | PASS(unit) | Revoked capability token rejected |
| Recovery snapshots / restore earlier version | PASS(browser) | Modal opens; snapshot list present |
| Template insertion without overlapping existing content | PARTIAL | Placement now translates to a free origin; **not browser-verified** |
| 9 built-in lesson templates (Linux boot, DNS, TCP+TLS, Docker, CI/CD, VPC, monitoring, …) | PASS(unit) | All templates build and validate |

## 6. Collaboration (live room)

| Action | Status | Evidence / note |
|---|---|---|
| Connect to backend / health check | BLOCKED | No production backend; local server tested only through unit tests |
| Teacher / editor / questioner / viewer roles | PASS(unit) | Role permission matrix tests |
| Student payloads strip teacher notes | PASS(unit) | Server-side deletion |
| Broadcast teacher viewport | PASS(unit) | Server message handling |
| Raise hand, reactions | NOT TESTED | Needs two live clients |
| Q&A reply / resolve / reopen / delete | PARTIAL | Reply round-trip unit-tested; long-reply wrapping fixed but not visually re-tested |
| Revoke room | PASS(unit) | Client and store paths |
| Short snapshot link (read-only) | PASS(unit) | — |

## 7. Shortcuts and command palette

| Action | Status | Evidence / note |
|---|---|---|
| Command palette search over tools, actions, stencils, templates | PASS(browser) | Opens, filters, keyboard navigation |
| Undo / Redo (bounded at 100 per page) | PASS(unit) | History stack tests |
| Group / Ungroup | PASS(unit) | — |
| F2 / Enter opens editor for the selection | PASS(browser) | — |
| Ctrl/Cmd+wheel zoom, Space-pan | PASS(browser) | Notebook branch preserves native scroll |

## 8. Deliberately not implemented

| Item | Reason |
|---|---|
| Real-time collaborative cursors on notebook previews | Previews are static by design; the active sheet is the live surface |
| PDF file generation in-browser | Zero-dependency build; handout uses the browser print-to-PDF path |
| Server-side rendering / image hosting | Collaboration server is Node built-ins only, no image store |
| Service-worker background sync | Autosave + recovery snapshots cover offline durability; SW adds cache-invalidation risk |
