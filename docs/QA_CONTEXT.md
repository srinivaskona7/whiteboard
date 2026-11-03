# QA Context — StudioBoard

Last updated: 2026-11-03

## 1. What was tested

| Item | Value |
|---|---|
| Commit under test | `b8c9171` (branch `main`) plus the uncommitted working-tree changes listed in §6 |
| Build | Vite 5 production build (`npm run build`), `base: './'` |
| App version | `package.json` 1.0.0 |
| Node | v26.13.0 |
| npm | 11.20.0 |
| Serving | Vite dev server on `http://localhost:5177` (`npm run dev -- --port 5177 --strictPort`) |
| Browser | Chrome via the `chrome-devtools` MCP automation profile |
| Device / viewport | Desktop, default automation viewport (~1280×800), macOS darwin 27.0.0 |
| Collaboration backend | Exercised through `node --test tests/collab.test.js` only; **no live multi-browser room was run** |
| Production deployment | **Not tested.** No deploy, image build, Helm install or pipeline trigger was performed (by standing project rule, deployment is manual and belongs to the user) |

## 2. Verification method

1. Reproduce the reported defect in the running app before changing code.
2. Make the smallest change at the existing implementation site.
3. Re-run the same interaction in the browser and record the observed value.
4. Run `npm test` and `npm run build`.
5. Anything that could not be exercised is listed below as **NOT TESTED** or **BLOCKED**, never as passing.

## 3. Executed commands and results

| Command | Result |
|---|---|
| `npm test` | 42 tests, 15 suites, **42 pass / 0 fail** (578 ms) |
| `npm run build` | success; `dist/assets/index-*.js` ≈ 447.7 kB (gzip 121.9 kB), CSS 30.0 kB (gzip 5.8 kB) |
| `npm run dev -- --port 5177 --strictPort` | dev server served the app; all browser checks below ran against it |

## 4. Browser evidence (current build)

| Check | Expected | Actual |
|---|---|---|
| Reload after editing | Pages and elements survive; camera unchanged | 10 pages, 1 element, `page.camera.zoom === 1` |
| Notes typed locally, then reload | Note text present | Present, including an explicitly cleared empty note |
| Notes typed in presentation drawer, then reload | Note text present | Present (`input` autosave + `change` commit + `pagehide` flush) |
| Code block editing | Multiline content preserved exactly | Inspector renders a `<textarea>`; 22 lines round-tripped unchanged |
| Double-click a shape at zoom 1.0 | Inline editor opens | Editor open, selection = 1 |
| Double-click a shape at zoom 0.5 | Inline editor opens at the pointer's world position | Editor open, selection = 1 |
| Presentation mode | No authoring controls, no pages bar | `[data-move-slide]` count 0; `.wb-pages-bar` computed `display:none`; only presenter buttons present |
| Exit presentation | Authoring UI restored | `.wb-pages-bar` `display:flex`, `wb-presenting` removed |
| Notebook view | 10 sheets, live canvas in the active sheet, 9 previews | 10 sheets, 9 previews, live canvas reparented |
| Notebook zoom | View zoom changes, document camera does not | view 0.55 → 0.80; stored page camera stays 1 |
| Exit notebook | Live canvas returns to the canvas wrapper | `canvas.parentElement.id === 'wb-canvas-wrap'` |
| PNG export | Non-empty raster | `exportToPngCanvas` → 324×264 canvas at content bounds |
| SVG export | Non-empty SVG document | 366-byte `<svg …>` string |
| Multi-page handout | One sheet per page, in page order | 10 `.wb-print-sheet` nodes, each with a 5120 px (2× @ DPR 2) canvas |
| Auto routing, clear path | 2 points, no bends | 2 points |
| Auto routing, blocked path | Detour, all finite | 6 points, no NaN, bends around the blocker |

## 5. Defects reproduced, fixed, and re-verified

| Defect | Root cause found | Fix site | Status |
|---|---|---|---|
| Notes empty after reload | Only `change` (blur) was bound; pending debounce not flushed on unload; `""` dropped from the serialized page | `ui/props-panel.js`, `ui/present.js`, `scene/storage.js`, `main.js` | Fixed, re-verified |
| Code block collapsed to one line | Inspector used `<input type="text">` | `ui/props-panel.js` (now `<textarea>`) | Fixed, re-verified |
| Double-click did not edit shapes/table cells | No canvas `dblclick` listener existed | `main.js` `_onDoubleClick`, `scene/hit.js` | Fixed, re-verified at two zooms |
| Presentation exposed add/reorder/duplicate/delete page controls | Slide reorder buttons and pages bar rendered inside presenting mode | `ui/present.js`, `styles.css` | Fixed, re-verified |
| Notebook zoom contaminated the saved camera | `ui/notebook.js` mutated `page.camera` | `main.js` `getCamera()`/`getRenderPage()`, `ui/notebook.js` | Fixed, re-verified |
| Template insertion overlapped existing content | Built elements pushed at authored coordinates | `main.js` `applyTemplate` (translate to a non-overlapping origin) | Fixed, covered by placement logic; **not browser-tested** |
| Handout printed only the current viewport | `window.print()` on the live canvas | `main.js` `printHandout()`, `styles.css` print rules | Fixed, DOM-verified (10 sheets) |
| Long Q&A replies could overflow/clip | Reply block lacked wrapping and the `.wb-question-meta` class was unstyled | `styles.css` | Fixed; **not visually re-tested with a long reply** |

## 6. Working-tree changes covered by this report

`index.html`, `main.js`, `render/canvas.js`, `scene/model.js`, `scene/routing.js`, `scene/storage.js`, `styles.css`, `tools/connector.js`, `tools/select.js`, `tools/text.js`, `ui/palette.js`, `ui/present.js`, `ui/props-panel.js`, `ui/toolbar.js`, `ui/dialogs.js`, `ui/timer.js`, `ui/notebook.js` (new), `tests/scene.test.js`.

## 7. Not tested / blocked

| Item | Why |
|---|---|
| Production or preview deployment | Manual-only by project rule; no deploy was run |
| Real multi-device live room (teacher + student, revocation, kick) | No second authenticated browser session was driven; server behaviour is covered by `tests/collab.test.js`, not by end-to-end browser evidence |
| Viewer timer read-only guard | Requires a live room with `role === 'viewer'`; logic is role-gated but no browser run was captured |
| Printer/PDF output itself | The print DOM was verified; the OS print dialog and the produced PDF bytes were not inspected |
| Accessibility audit (screen reader, contrast sweep) | Not run |
| Performance budget (large boards, 100+ pages) | Not measured; only the 10-page notebook was exercised |
| Safari/Firefox | Not run; Chromium only |

## 8. Remaining uncertainty

- The collaboration server stores rooms and short links in `.data/collab-store.json` relative to the process CWD (`server/start.js`). In production that path must be a persisted volume, or links and rooms vanish on restart.
- `.whiteboard.json` files saved by an older build still migrate through `migrateSceneData`, but no fixture older than the current schema was hand-tested beyond the unit cases.
- Auto Clean routing prefers a straight line only when the direct segment misses every obstacle box; dense diagrams can therefore still prefer the orthogonal A* result. This is intended, but no large-diagram benchmark was recorded.
