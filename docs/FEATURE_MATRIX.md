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

## 13. Stage C/D evidence added 2026-11-03

| Capability | Status | Evidence |
|---|---|---|
| Azure templates AZ-01…AZ-10 | IMPLEMENTED, TESTED(unit), PASSED(browser) | `templates/azure-gcp.js`; 7–9 native stencil components each, arrows bound; unit test asserts 6–14 components and known stencil ids; browser applied `tpl-az-02-aks-platform` on a scratch page (9 stencils, 8 arrows) then deleted the page |
| GCP templates GCP-01…GCP-10 | IMPLEMENTED, TESTED(unit) | Same file and test; provider column is `GCP`; teaching notes on every frame |
| New Azure/GCP service icons | IMPLEMENTED, TESTED(unit) | 19 stencils added to `stencils/devops-cloud.js`; unit test asserts the required ids exist |
| Diagram configuration drawer | IMPLEMENTED, TESTED(unit), PASSED(browser) | `scene/architecture-config.js`, `ui/dialogs.js`; 4 patterns × 15 typed params; invalid combos block Apply; browser Apply produced 6 nodes + 5 edges with tracked config metadata |
| Atomic update, stable ids, manual positions | TESTED(unit) | Second apply keeps every element id; moved node keeps x/y; `relayout:'full'` moves it |
| Duplicate/Reset/Preview/Cancel | IMPLEMENTED, PARTIAL | Variants persist in localStorage; Preview renders a summary and element delta without mutating the page; the visual preview is textual, not a ghost diagram |
| Unified local search | IMPLEMENTED, TESTED(unit), PASSED(browser) | `scene/search.js`; scopes (All/Actions/Library/This board/Lesson), type filters, typo tolerance, matched terms, recents and favourites; browser query "azur sql" returned 5 scoped results |
| Teacher-private notes excluded from student surfaces | TESTED(unit) | `searchEntries(..., { studentMode: true })` drops `visibility: 'teacher'` entries |
| Icon manifest provenance + review date | IMPLEMENTED, TESTED(unit) | Every pack carries `reviewedAt: 2026-11-03`; `describeIcon()` returns what/role/example/source |
| Fill patterns solid/hachure/cross-hatch | IMPLEMENTED, TESTED(unit) | Canvas overlay plus SVG `<pattern>` defs; exported patterns referenced by `fill="url(#wb-pat-…)"`; survives round trip |
| Declarative teaching animation | IMPLEMENTED, TESTED(unit), PARTIAL(browser) | `scene/animation.js` allowlist of 12 actions, deterministic `sampleTrack`, 103-test suite; bar opens and controls render; playback itself was not watched frame-by-frame in the browser |
| One playback clock, no history/collab writes | TESTED(unit) | Sampling does not mutate the page (`JSON.stringify` unchanged); UI clock is a single rAF loop |
| Reduced motion | TESTED(unit) | Steps jump to their end state |
| Request vs response markers | TESTED(unit) | Opposite direction; only the newest marker step is drawn |
| Tracks persist with the page | TESTED(unit) | Round trip through `serializeScene`/`parseSceneJson`; stripped with `stripNotes` |

## 14. Gap-closure pass 2026-11-03 (later)

Every row below was verified in the running dev server at `http://localhost:5177` after the change, not from source presence.

| Capability | Status | Evidence |
|---|---|---|
| CIDR parameter | PASS(browser) | Typed text param validated `/16`–`/28` with per-octet range check; appended to the boundary label; shown on the GCP compute edge. Browser: `10.42.0.0/16` appeared on the board and in the explanation |
| `detail: internals` | PASS(browser) | Adds `concept-process`, `concept-socket`, `concept-kernel-user` plus `runs`/`accepts`/`syscalls` edges; removing the setting deletes them again (board 16 → 23 → 15 elements) |
| `showExplanation` | PASS(browser) | Writes a real `text` element tagged `configExplanation`, positioned below the configured graph; turning it off removes it |
| `variant: high-availability` | PASS(browser) | Adds a `<host>-z2` node at +150 y with a `zone-redundant` connector; requires ≥2 replicas via cross-field validation |
| `connectivity` public vs private | TESTED(unit) | Data path reads `1433 public` / `1433 private`; GCP edge reads `public IP` / `private IP · <cidr>` |
| `relayout` passed to apply | PASS(browser) | Drawer select offers `preserve` / `group` / `full` and passes it; `group` restores configured node positions and leaves foreign objects untouched |
| No duplication when configuring its own template | PASS(browser) | Templates stamp `templateId`; apply adopts matching stencils/arrows. Browser: 16 → 23 elements, no second copy (stencils 7 → 10 = 7 adopted + 3 internals) |
| Applied settings survive reopening the drawer | PASS(browser) | `page.architectureConfigs[patternId]` persisted through `sanitizeSceneForPersistence`; reopen prefilled `internals` / `high-availability` / `10.99.0.0/16` and re-applied to 23 elements |
| `describeIcon()` rendered | PASS(browser) | Inspector "Icon reference" shows what/role/example plus provider, license, version, review date (prefixes no longer duplicated) |
| Library tooltip provenance | IMPLEMENTED | Tooltip carries license and attribution |
| Student search surface | PASS(browser) | `studentMode` derives from `collab.canEditBoard()`; querying a teacher-note phrase returned 1 result as teacher, 0 as student |
| Search aliases | PASS(browser) | `SEARCH_ALIASES` folded into stencil keywords; `r53` → 1 result, Amazon Route 53 |
| Group results | PASS(browser) | Groups emit `kind: 'group'` with member ids; unnamed groups fall back to member text, never the raw id |
| No silent 40-result truncation | PASS(browser) | `searchEntriesDetailed` returns `{items,total}`; query "a" reported 558 matches and rendered only ~10 DOM rows |
| Recents/favourites store searches | PASS(browser) | `recentQueries` / `favouriteQueries` persist and dedupe (8 / 12 cap); saved-search chips reopen and re-run |
| `hide` → `reveal` restores an element | TESTED(unit) | Reveal clears the earlier hide from `hidden` and adds to `visible` |
| Distinct failure / retry / backlog badges | PASS(browser) | Separate colours and shapes plus counts (`retry` ×3); drawn at the element corner from `animationState.badges` |
| Stop restores the camera | PASS(browser) | Camera moved to x −1365, zoom 2.5 during playback and returned exactly to x −72, zoom 0.802 on Stop; replaying afterwards moved it again. Also restored after stepping with ▶| instead of Play |

## 15. Review round on the gap-closure pass (same day)

Three reviewers read the diff. Six confirmed defects, all fixed and re-verified.

| Defect | Fix | Evidence |
|---|---|---|
| Preview wrote unapplied values into `page.architectureConfigs` (shallow page copy) | Preview page deep-clones `architectureConfigs` | browser: apply `/16` → preview `/24` → live config still `/16` |
| Template adoption's "any unclaimed stencil" fallback rewrote the DNS zone into the monitor and orphaned a VMSS | Adopt on exact `stencilId` only; unmatched specs are created fresh | script + unit test: DNS keeps `az-dns`, `az-monitor` added |
| Undo reverted elements but not the stored configuration | `HistoryManager` snapshots and restores `architectureConfigs` and `animationTrack` alongside `elements` | unit test: undo returns `/24` → `/16` |
| Stop after ▶| left the camera moved (snapshot only taken in `play()`) | `applyCameraStep` takes the snapshot when none exists; a page switch skips camera moves | browser: step onto a camera step, Stop restores x 3 / zoom 0.423 |
| Building or clearing a track was never saved or broadcast | `setTrack` and Clear call `history.commit`, `scheduleAutosave` and `broadcastSceneChange` | browser: track present in `classroom_whiteboard_scene_v2` after the debounce and after reload |
| `createTableElementData` threw `ReferenceError: r` (exported, uncalled) | Restored the clamped `r` binding | unit test: rows/cols clamp |
| Matches past the 40th were unreachable however the count read | Palette passes `limit: entries.length`; the windowed list bounds DOM cost | browser: "cloud" → 135 matches, 135 reachable, 9 rows in the DOM |
| `connectivity` inert on `azure-aks` and `gcp-gke` | Entry edge labelled `public` / `private endpoint` / `hybrid ExpressRoute` in every pattern | unit |

## 16. Dock, brush drawer and arrow tabs (2026-11-03)

| Requirement | Status | Evidence |
|---|---|---|
| Freehand, Highlighter, Eraser, Sticky Note, Spotlight and Arrow pinned in **all three** presets | PASS(browser) | `DEFAULT_PRESET_TOOLS` lists all six per preset; the dock reported `missing: []` for teach, diagram and collaborate |
| Existing prefs gain the new pins | PASS(unit + browser) | `REQUIRED_PINNED_TOOLS` is topped up once, keyed by a stamp derived from the list; the user's own order is preserved and a later unpin is not resurrected |
| Spotlight is a pinnable dock tool | PASS(browser) | `TOOL_REGISTRY` entry with `F7`; the dock button reflects `spotlight.active`, toggles the mode and leaves `activeTool` untouched |
| Brush drawer expands only for Freehand / Highlighter | PASS(browser) | `#wb-brush-drawer` present for pen and highlighter, absent for eraser, rect, sticky, spotlight and select |
| Drawer drives the real brush state | PASS(browser) | chip → `currentBrush: chalk`; size 13 / opacity 42 → `brushOverrides {strokeWidth:13, opacity:0.42}`; colour → `currentStyle.stroke`; all persisted to workspace prefs |
| Arrow tabs are detailed, not a single list | PASS(browser) | Presets / Route / Heads tabs; Route applies `curved`, Heads applies `diamond` + `triangle` to the selected arrow; radius slider enables only for `rounded-elbow` |
| Tab choices survive into the *next* arrow | PASS(browser) | `pendingArrowStyle` accumulates and is applied by `ConnectorTool.applyPendingPreset` and `insertSimpleArrow` |
| No duplicate arrow button | PASS(browser) | `arrow` is filtered out of the plain dock list and the `+` menu; the split button is the single arrow entry |
| Pinned ids always resolve | PASS(unit) | `tests/dock.test.js` fails on a pinned id with no registry entry — the silent-drop class of bug |

Known limits: the drawer duplicates the Inspector's drawing section by design (both edit the same state);
the drawer is positioned beside the dock and shifts right of an open left panel via `:has()` — on a browser
without `:has()` it would overlap that panel.

## 17. Placement, text entry and classroom address (2026-11-03)

| Requirement | Status | Evidence |
|---|---|---|
| Double-click empty canvas starts a text box | PASS(browser) | Element count 0 → 1, created `text`, inline editor open, `activeTool` still `select` |
| Drawing tools keep their double-tap | PASS(browser) | With `pen` active the same gesture created nothing and opened no editor |
| A first configuration lands clear of existing content | PASS(unit + browser) | Foreign 600×420 rect at the origin; applied group moved to y 480–912 with `overlaps: 0`; the existing rect never moved |
| The explanation follows the group and wraps | PASS(unit + browser) | Wrapped at 96 chars (2 lines), `autoGrow` box 850×54, repositioned below the group on `relayout: group` |
| Connector labels do not collide | PASS(browser) | Five labelled edges, no pair within 90×20 px; remaining collisions came from the overlap itself |
| Classroom backend defaults to a reachable address | PASS(browser) | Panel reads `http://localhost:5177 (same origin)` and is online; no `127.0.0.1:4179` default |
| A loopback backend is called out | PASS(browser) | Setting `http://127.0.0.1:4179` renders "it works only on this machine…" and suggests the page origin |
| Same-origin is stored as same-origin | PASS(code) | Connecting with the page's own origin clears the stored base instead of pinning a host |

Known limits: Miro activities and the 5 % canvas-area target are still open and
are not addressed here. Remote classroom access was not exercised from a second device.

## 18. Deep architecture, icon and lesson work (2026-11-03)

| Requirement | Status | Evidence |
|---|---|---|
| AWS reference templates | PASS(unit + browser) | `templates/aws.js`, 10 diagrams (`tpl-aws-01-three-tier-web` … `tpl-aws-10-recovery`), 6–14 native AWS stencils each, frame, teaching notes, `templateId` stamped; catalog 38 → 48 |
| AWS service icons | PASS(unit + browser) | 19 stencils (API Gateway, Step Functions, EventBridge, Kinesis, Glue, Athena, Redshift, ECR, Secrets Manager, CloudTrail, NAT, Transit Gateway, ElastiCache, OpenSearch, WAF, Direct Connect, Cognito, EFS, CloudFormation) |
| Azure + GCP additions | PASS(unit + browser) | 16 more (APIM, Front Door, Bastion, Private Endpoint, Event Hubs, Cache, Synapse, Static Web App; Cloud Functions, App Engine, Cloud Armor, API Gateway, Memorystore, Dataproc, Dataplex, Cloud CDN); registry 236 → 271 |
| Services the ranked research still found missing | PASS(unit + browser) | 11 more: AWS PrivateLink; Azure Logic Apps, NAT Gateway, L4 Load Balancer, Application Insights, ExpressRoute/VPN Gateway; GCP Cloud NAT, Private Service Connect, Cloud Tasks, Cloud Logging, Cloud VPN. Registry 271 → 282 |
| Icons render in the palette | PASS(browser) | All 46 new ids laid out and screenshotted: distinct glyph, correct provider badge, no blank or duplicated art |
| Configurable architectures | PASS(unit + browser) | `aws-three-tier`, `aws-serverless`, `azure-multiregion`, `devops-platform` added to `CONFIG_PATTERNS` (4 → 8); each applies to ≥4 tracked nodes using known stencils |
| Provider-correct defaults | PASS(unit) | AWS patterns default to an AWS region (`eu-west-1`/`eu-central-1`/`us-east-1`/`us-west-2`); Azure patterns never do |
| Production guard on delivery pattern | PASS(unit) | `environment: prod` with `replicas < 2` is refused before the page is touched |
| Lesson generated from the diagram | PASS(unit + browser) | `scene/lesson.js` walks real connector bindings; entry is the root with the most outgoing edges, so a title or legend is never picked; disconnected shapes are not revealed |
| Failure / retry / health-check beats | PASS(browser) | Last reachable hop gets `failure` → `retry ×3` → `pulse`; suppressed when the diagram has a single node |
| Canary rollout beat | PASS(unit + browser) | 10 / 50 / 100 on the deployment-looking node (`cluster|aks|gke|eks|…`); `pulse` and `rollout` added to the allowlist, both require a `targetId` |
| Reduced motion still teaches | PASS(unit) | `pulse` sets a static highlight as well as the ring, so a reduced-motion playback leaves the node marked |
| Lesson pacing matches the research | PASS(unit + browser) | Hop 600 ms with a 400 ms pause, reveal 500 ms; a four-node lesson runs 7.7 s. A test fails if a hop leaves the 400–600 ms / 300–500 ms range |

Known limits: the catalog reached 80 with the advanced pack and 150 with the architecture
packs (see §20). Dot-voting (the first Miro activity) is in progress. The 5 % canvas-area
target is now measured (`scene/layout-metrics.js`, §20). The animated lesson was watched on
the AWS three-tier template only; the other templates were not played end to end.

## 19. Advanced template pack (2026-11-04)

| Requirement | Status | Evidence |
|---|---|---|
| Advanced pack, 32 new templates | PASS(unit) | `templates/advanced.js` (`ADVANCED_TEMPLATES`, `tpl-adv-` ids), registered in `templates/index.js`; catalog 48 → 80; unit test asserts exactly 80 and 32 unique registered ids |
| 14 cloud architecture diagrams | PASS(unit) | Zero-trust, ML pipeline, hybrid hub-and-spoke per provider (`provider: AWS/Azure/GCP`) plus 2 Cross-cloud (`tpl-adv-multicloud-ingress`, `tpl-adv-data-lakehouse`); 6–14 native stencils, labelled arrows, lesson frame with ≥ 80-char teacherNotes, `templateId` stamped on every element |
| Provider purity | PASS(unit) | AWS diagrams use only `aws-*` provider stencils, Azure only `az-*`, GCP only `gcp-*`; Cross-cloud mixes by design; unit test enforces it |
| 18 classroom / methodology boards | PASS(unit) | Retrospective, planning poker, SWOT, fishbone, user journey, timeline, ER starter, state machine, swimlane flow, story map, Gantt, RACI, affinity map, Eisenhower, SRE golden signals, STRIDE threat model, incident postmortem, quiz — native frames/rects/tables/stickies with `templateId` stamped |

Known limits: the pack is unit-tested and follows the existing pack contracts, but no template
in the new pack was applied and inspected in the browser yet. Where the stencil registry has no
icon for a named service (SageMaker, IoT Core, Timestream, QuickSight, Data Factory, IAP,
Vertex AI), the closest existing provider stencil carries the correct service label.

## 20. 150-template architecture catalog (2026-11-04)

| Requirement | Status | Evidence |
|---|---|---|
| Catalog reaches 150 | PASS(unit) | 7 new packs registered in `templates/index.js`: `arch-aws-x`, `arch-az-x`, `arch-gcp-x`, `arch-hybrid`, `arch-k8s`, `arch-obs`, `arch-data` (10 each, `tpl-awsx-/tpl-azx-/tpl-gcpx-/tpl-hyb-/tpl-k8s-/tpl-obs-/tpl-data-` ids); `tests/catalog.test.js` asserts exactly 150 unique ids, every pack registered, and every template builds |
| Provider deep-dives | PASS(unit) | AWS: media, payments saga, fraud, batch, VPN, EKS GitOps, IoT, search, backup/DR, fan-out. Azure: media, FHIR, e-commerce, APIM, batch ETL, AVD, Databricks, SIEM, jamstack, hub-spoke. GCP: recommendations, video, gaming, banking, streaming, datalake, hybrid fleet, SCC, serverless, MLOps |
| Cross-cloud / hybrid | PASS(unit) | Multicloud DR, landing zone, identity federation, cross-cloud data replication, service mesh, multicluster GitOps, edge, network migration, FinOps, zero-trust perimeter |
| Kubernetes internals | PASS(unit) | Pod lifecycle, control plane (`k8s-apiserver`, `k8s-etcd` stencils), service routing, Istio mesh, operator pattern, HPA, CSI storage, NetworkPolicy, Argo Rollouts, chaos |
| Observability / SRE | PASS(unit) | OTel pipeline, Prometheus, ELK, distributed tracing, SLO burn, incident command, on-call routing, eBPF, log aggregation, golden signals |
| Data / AI | PASS(unit) | Lambda vs Kappa, CQRS + event sourcing, CDC, feature store, RAG, model registry, data mesh, streaming lakehouse, vector search, GPU training cluster |
| Per-pack contracts | PASS(unit) | Each pack has its own test file (count, unique ids, 6–14 stencils, known stencil ids, labelled bound arrows, frame + ≥80-char teacherNotes, `templateId` on every element, provider purity) |
| 6 more configuration patterns (14 total) | PASS(unit) | `aws-microservices`, `azure-event-driven`, `gcp-ml-pipeline`, `zero-trust-access`, `data-lakehouse`, `hybrid-connectivity` in `scene/architecture-config.js`; tests in `tests/config.test.js` |
| 5 % canvas-area target measured | PASS(unit) | `scene/layout-metrics.js` (`boundsOf`, `areaRatio`, `overlaps`); `tests/config.test.js` asserts each pattern's generated graph area ratio and node-overlap freedom |

Known limits: the 70 new architecture templates are unit-tested at the pack level but not yet
applied and inspected in the browser; search totals beyond the palette window were not re-verified
at 150. Services without a stencil use the closest existing stencil with a correct label
(recorded per pack in the pack test files). The registry is deduped to 269 unique ids and
`tests/registry-integrity.test.js` locks uniqueness, alias targets and lesson-pack resolution;
all 14 patterns now measure under the 5 % target (the two historical 0.0559 violations were
relaid out to 0.0481 on 2026-11-04).

## 21. Dot voting (2026-11-04)

| Requirement | Status | Evidence |
|---|---|---|
| Teacher-controlled voting session | PASS(unit) | `ui/voting.js` `initVotingUI`; start/stop/reset gated by `canControl()` (viewer/questioner cannot), enforced server-side in `applyRoomOperation` (viewer `vote:session` → 403) |
| Votes are board state | PASS(unit) | `el.votes` on the element, committed via history/autosave; a voted sticky round-trips `serializeScene`/`parseSceneJson` with the vote intact |
| Cap and tally | PASS(unit) | `scene/voting.js`: `castVote` caps at `MAX_VOTES_PER_ELEMENT = 3`; `tally` sorted by votes with stable ties |
| Students can vote | PASS(unit + server unit) | Viewer votes go through a dedicated `vote:cast` op (scene-sync is blocked for viewers); server clamps and rebroadcasts the authoritative count; 3 server-op tests |
| Vote badge rendering | PASS(unit) | `render/canvas.js` `drawElementBadges`: amber dot + count at the element's top-right inside the camera transform |
| Toolbar + shortcut wiring | PASS(unit) | `TOOL_REGISTRY` vote entry + dock button + Teaching menu; Shift+V (V is Select); Esc exits; `PINNED_TOOLS_VERSION` → 3 with stamp migration |
| Session is room state, not scene | PASS(unit) | `vote:session` op like `timer:sync`; a scene-borne flag would race with undo and never reach students |
| Remote votes enter history and autosave | PASS(unit) | `applyRemoteVote` routes through `commitChange` (active page) or `history.record` + autosave + broadcast (other pages); regression tests lock that a teacher undo reverts a student vote as a visible, redoable step instead of silently erasing it class-wide |
| Results tally every page | PASS(unit) | `stop()` tallies all pages' elements — a room-wide session must not drop page-2 dots from the announcement |

Known limits: reset has no confirm dialog (`app.dialogs` exposes none) — it is undoable via
history instead. Not yet browser-verified with a second device; student-vote path verified by
server-op unit tests only.




## 22. Quick-add dots, icon-size stepper, equidistant guides, wrap toggle (2026-11-04)

| Requirement | Status | Evidence |
|---|---|---|
| Quick-add dots on the sole selection | PASS(unit) | `render/canvas.js` `drawQuickAddDots` — 4 dots (7 px screen radius, accent fill, white outline) at the four `dotAnchor` edge midpoints, drawn in world space like the selection handles; shown only when the select tool is active, editing is allowed (`quickAddEnabled` from `main.js` renderNow), not presenting, not text-editing, and `isQuickAddable(el)` |
| Clicking a dot duplicates + connects | PASS(unit) | `tools/select.js` step 1b checks the dots before the port/scene hit tests (they share edge midpoints with connection ports); `main.js` `applyQuickAdd` creates the clone and arrow from `buildQuickAdd`, binds both ends with auto ports, selects the clone, commits; `scene/quick-add.js` `buildQuickAdd` is pure (no app, no DOM), placement via `quickAddPlacement` (80 px base gap, +40 scan, never-fail walled-in fallback) |
| Arrow follows the connector tool idiom | PASS(unit) | Arrow spec copies `stroke`/`strokeWidth`/`strokeStyle`/`routing` from the current style with `startArrow: 'none'`, `endArrow: 'arrow'`; `tests/quick-add-wiring.test.js` asserts spec fields, non-overlapping origin, edge-to-edge endpoints, refusals (arrow/ink/boundary/locked), finite walled-in coordinates and page-clear placement |
| Icon-size stepper in the library panel | PASS(unit) | `ui/library-panel.js` stepper over `ICON_SIZE_LEVELS`, persisted in the workspace prefs key `libraryIconSize`; `tests/icon-size.test.js` |
| Equidistant (equal-gap) smart guides | PASS(unit) | `scene/geometry.js` `computeSmartGuides` equal-gap snaps compete only when strictly closer than edge/midpoint snaps, then replace that axis's guides with one guide per equalized gap; the same `{type, x/y, y1/x1, y2/x2}` field shape, so the existing `render/canvas.js` guide loop (all `smartGuides`, dash style) draws the two-guide win unchanged; `tests/smart-guides.test.js` |
| Alt+W wrap / unwrap toggle | PASS(unit) | `main.js` `toggleTextWrap`: selected text folds into the topmost `canWrap` shape (`wrapTextIntoShape`, text element removed, anchors cleaned via `commitChange([removedId])`); selected labelled shape detaches via `unwrapShapeText` into a new text element with both `stroke` and `textColor` set (rendering reads `textColor`); W alone stays the Point tool; guarded like other editing shortcuts (present mode, `canEditBoard`); `tests/text-wrap.test.js`; registered in `ui/registry.js` `SHORTCUT_REFERENCE` |

Known limits: the dots are click-only — no drag-from-dot placement, and no frame-children
copying (a frame quick-adds as the frame only). The dot size and hit radius are screen-stable
(`7/zoom` and `11/zoom` world px), matching the selection-handle idiom rather than fixed world
units. Not yet browser-verified by hand; the wiring is covered by pure unit tests only.

## 23. Locked-tool (padlock) mode (2026-11-04)

Excalidraw-style tool lock: with the padlock active, the shape, connector and text
tools stay selected after each element instead of one-shotting back to Select, so a
sequence can be drawn without re-picking the tool. Pen, highlighter, eraser, laser,
stamp and pointer were already persistent and are untouched by this.

| Requirement | Status | Evidence |
|---|---|---|
| Shape, connector and text tools stay active when locked | PASS(source) | `tools/draw.js` (`if (!this.app.toolLock)` guards the pointerup one-shot), `tools/connector.js`, `tools/text.js` — the same guards that `ui/classroom.js` relies on; pen/highlighter/eraser/laser/stamp never one-shot |
| Toggle via Shift+Q and the dock padlock | PASS(source) | `main.js` `toggleToolLock()` behind the `Shift+Q` handler (toasts "Tool lock on — tools stay active" / "Tool lock off"); the dock button (`#btn-tool-lock`, `ui/toolbar.js`) is the pressed-state indicator, already in `ui/registry.js` `SHORTCUT_REFERENCE` as "Shift + Q — Toggle Keep Active Tool Locked" |
| Persists across reloads | PASS(unit) | `app.toolLock` is a get/set accessor in `main.js`: every write (dock button, Shift+Q) mirrors the flag into the workspace prefs key `toolLockEnabled` and saves via `saveWorkspacePreferences`; the constructor seeds it from `loadWorkspacePreferences`; `scene/storage.js` `loadWorkspacePrefs` whitelists `Boolean(parsed.toolLockEnabled)` (default false); `tests/tool-lock.test.js` |

Known limits: the dock padlock button persists and reflects state but does not toast
(it lives in `ui/toolbar.js` and renders its own active class + `aria-pressed`). The
toggle wiring is source-verified only, not browser-verified by hand; the pref contract
is covered by `tests/tool-lock.test.js`.

## 24. Social layer: cursor chat and anchored emotes (2026-11-04)

FigJam/Miro-style social features, open to every role (viewer included) — they are
social, never board content.

- **Cursor chat** — press `/` to open a small floating input at the last canvas pointer
  position; Enter sends, Esc cancels. The message becomes a speech bubble drawn at the
  sender's world cursor position (offset up-right, author name in the participant colour,
  word-wrapped body), fading out over the last ~2 s of a **15 s lifetime**. Server op
  `chat:cursor` (student-writable, before the teacher gate): empty/whitespace text → 400,
  text capped at 140 chars, non-finite position → 400. The sender applies its own bubble
  optimistically; the WS broadcast therefore **excludes the sender's socket**
  (`vote:cast` is the deliberate counter-example — see the vote echo test).
- **Element-anchored emotes** — right-click → "Emote 👍" flyout (👍 ❤️ 😂 🎉 ❓ 👏) sends the
  existing `reaction:send` op with an optional `elementId` and world `x`/`y` (point above
  the element's bounds; on empty canvas, the world point alone). Anchored reactions draw as
  a floating emoji rising and fading over **~8 s** near the element/point, in addition to
  the existing classroom toast — the toast behaviour is unchanged. Garbage anchors
  (non-string `elementId`, NaN coords) are stripped server-side, never rejected; a
  reaction whose anchor element has been deleted simply stops drawing (toast already fired).
- **Ephemeral by design** — cursor chats are never persisted, never stored in the room
  scene, and never replayed: late joiners see nothing. Reactions remain what they were
  (ephemeral toasts in the classroom panel) plus the new anchored float.

Evidence: `server/collab-server.js` (`chat:cursor`, anchored `reaction:send`),
`scene/collab-client.js` (`broadcastCursorChat`, `activeCursorChats`, `cursorChats` cap 12,
`sendReaction(emoji, anchor)`), `render/canvas.js` (`drawCursorChatBubbles`,
`drawAnchoredReactions`), `ui/cursor-chat.js`, `main.js` (`/` keydown, render-state wiring,
`_lastCanvasPointer`), `ui/context-menu.js` (Emote flyout), `ui/registry.js`
`SHORTCUT_REFERENCE`; `tests/cursor-chat.test.js` (store + client unit tests) and
`tests/collab.test.js` §24 (real-socket: teacher receives the bubble, sender never echoes).

Known limits: cursor chat is unavailable while Presentation mode is active (its keydown
branch returns early, as for all other shortcuts), and the input is single-line. Bubbles
are screen-stable (`1/zoom` scaling) like the remote cursor labels. Not yet
browser-verified with two devices by hand; the delivery path is covered by the real-socket
tests.

## 25. Research pass: what was adopted, and what was deliberately not (2026-11-04)

A research pass over ~20 popular drawing/whiteboard apps (Excalidraw, tldraw, Miro,
FigJam, draw.io, Lucidchart, Mural, Milanote, Conceptboard, Figma, MS Whiteboard, Jamboard,
Sketchboard, Eraser, IcePanel, Zoom Whiteboard, Whimsical, Ziteboard, AWW App) produced
the adopt-list behind sections 22–24. Much of it was already in the product — verified
present and left alone: double-click-to-edit text, Alt-drag duplicate, snap-to-grid with
Alt bypass, Shift angle/ratio constraints, 1px/10px arrow-key nudge, Ctrl+D duplicate,
port-anchored connectors, and the (then un-persisted) Shift+Q tool lock.

**Deliberately NOT adopted, with reasons** (this list exists so the next session doesn't
re-litigate them):
- **AI diagramming / AI sticky clustering** (Miro AI, FigJam AI, Zoom AI Companion,
  Eraser, Excalidraw+ text-to-diagram) — no AI service in the product's zero-dependency
  offline-first architecture; adopting one would break both the offline promise and the
  no-runtime-deps rule.
- **MS-Whiteboard ink-to-shape / ink-to-table** — a handwriting recognizer project
  (rough.js-class dependencies or a model); the product is shapes-first for classrooms,
  and Excalidraw-style hand-drawn look was not a goal.
- **Excalidraw+ double-click arrowhead toggle** — double-click on arrows/lines already
  opens the label editor (`_onDoubleClick`); the toggle would regress that gesture.
- **FigJam stamp wheel / high-five** — the emote flyout (§24) covers the classroom need
  with less UI surface; high-five needs a presence affordance we don't have.
- **Model-based reusable objects across diagrams** (IcePanel C4) — a data-model layer
  change, not a canvas feature; revisit if architecture teaching ever needs one-edit-
  propagates-everywhere semantics.
- **Rate-limiting note** — the student-writable social ops (`chat:cursor`,
  `reaction:send`) remain unthrottled server-side (parity with the pre-existing
  `reaction:send`); `op.color` is capped at 24 chars. A per-clientId token bucket is the
  recorded follow-up if room abuse becomes real.

## 26. Lucide icons tab (2026-11-04)

A curated **311-icon Lucide set** (ISC license, commercial-safe) as a dedicated
"Lucide Icons" library tab: education (43), tech-devops (70), office-business (55), arrows
(30), media (27), people-collaboration (26), nature-weather (27), status-symbols (33).
Subcategory pills + search (alias-aware, reuses `scoreStencilSearchMatch`) + the shared
icon-size stepper + favorites/recents + click-to-place and drag-to-canvas, exactly like the
architecture stencil tab. Icons draw on canvas as true vector stencils (stroke follows the
current style color; scaling keeps 2-unit stroke weight proportional).

Pipeline: `lucide-static@1.68.0` is a devDependency only — `scripts/gen-lucide-icons.js`
parses the vendored SVGs and bakes the geometry into the checked-in
`stencils/lucide-icons.js` (~161 KB), so runtime stays zero-dependency and fresh clones
build without the package. The generator is idempotent (sha256-stable, test-locked). Icons
resolve through the normal stencil registry (`lucide-` ids, dedupe-safe, real canvas
`draw` + `toSvg`), are placed by the standard `placeStencil` path, and carry correct
provenance (`getIconProvenance` → Lucide / ISC; regression-locked).

Known limits: the build bundle crosses the 500 kB chunk warning (pre-existing catalogs plus
the baked geometry); one curated name (`address-book`) doesn't exist in the package and was
skipped with a warning, never invented.

## 27. Spotlight: rounded, right-click controllable (2026-11-04)

The spotlight cutout is now an **ellipse** (180 default radius): pinned to a right-clicked
point via "Spotlight here", or fitted to a right-clicked element's bounds (+32px padding,
min radius 60) via "Spotlight → element"; while pinned the lens stays put, and "follow
cursor" re-enables the old behavior. The right-click menu also offers size presets
(small 100 / medium 180 / large 260) and "Spotlight off (Esc)". Esc precedence: an open
context menu consumes Esc first (menu closes only); otherwise Esc exits spotlight. The
radius slider keeps working during an element fit (the fit scales with it).

Geometry lives in pure exported helpers (`spotlightEllipse`, `spotlightEscapeAction`) in
`render/canvas.js`, locked by `tests/spotlight.test.js` (10 tests incl. mock-canvas render
asserts: ellipse calls, no legacy arc).

Known limits: the spotlight remains a **local overlay** — pointing moves it only on the
operator's own screen (broadcasting would need a new collab op); the toolbar banner shows
the base radius, not the fitted rx/ry, while an element fit is active.

## 28. Excel-like table editor and numbered step bubbles (2026-11-04)

**Tables** gained a real formatting layer: per-cell / per-row / per-column / whole-table
alignment (left/center/right) and fill colour via the props panel, with scope buttons
(Cell/Row/Column/Table) and a Select-all-cells button; insert/delete row/column
(pre-existing) and TSV paste now inherit the previous row/column's alignment and colour so
tables stay visually consistent. All ops are pure functions in `scene/table.js`
(`cellAligns`/`cellColors` grids kept rectangular through every structural change),
mutations go through `commitChange()` (undoable), and the styles round-trip
serialize/parse. The renderer paints per-cell fills under the grid rules.

**Numbered step bubbles**: a new Steps stamp kind — a round teal bubble with a bold white
number that auto-increments 1, 2, 3 … on each placement (unbounded, restart at 1 by
re-picking the kind or the Restart-at-1 button). The counter rides `badgeValue` so it
survives storage and exports without a model change.

Known limits: cell selection is element-level — there is no rubber-band multi-cell
selection or a visible active-cell highlight yet (the styles target the last-edited cell,
row, or column); SVG export draws a Steps bubble as the generic badge circle with the
number; steps reset is via the props panel, not the context menu.

Evidence: `scene/table.js`, `ui/props-panel.js`, `tools/stamp.js`, `render/shapes.js`,
`tests/table.test.js` (12), `tests/step-bubbles.test.js` (8); `render/canvas.js`,
`ui/context-menu.js`, `main.js`, `tests/spotlight.test.js` (10); `scripts/gen-lucide-icons.js`,
`stencils/lucide-icons.js`, `ui/library-panel.js`, `tests/lucide-icons.test.js` (9).

### Review round (same day)

Four lenses (correctness, edges, integration, spec) over sections 26–28. Spec: 4/4 items MET.
Confirmed defects, all fixed and test-locked (suite 366):

- **Lucide SVG export geometry** — `toSvg` skipped the 8px inset the canvas draw uses, so
  exported icons rendered ~20% larger than the board. The generator template now shares
  the same pad/scale math, and a `toSvg`-vs-`draw` equivalence test pins it.
- **Generator safety** — a zero-icon run (missing/renamed `lucide-static`) used to clobber
  the checked-in `stencils/lucide-icons.js` with an empty module and exit 0. It now
  refuses to write and exits non-zero; the idempotency test snapshots and restores the
  file, and a refusal test covers the missing-package case (`LUCIDE_ICONS_DIR`).
- **SVG export dropped table styles** — `cellColors` fills and `cellAligns` overrides
  were ignored by the SVG table branch. Both now mirror the canvas renderer exactly
  (fills under the grid lines, cell > table alignment precedence).
- **Spotlight pins frozen in screen coords** — pan/zoom (or moving a pinned element)
  left the lens stale. Pins now live in world space (`pinWorld` / `pinElementId`) and
  re-project through the camera every render; element pins re-fit to the element's
  current bounds. Turning the spotlight off/on clears all pin and fit state (a stale
  element-fit ellipse used to survive re-activation).
- **Whole-table fill** now clears per-cell colour overrides, matching what whole-table
  alignment already did (the new fill previously looked like it didn't apply).

Remaining known limits are unchanged from §26–28 above.

## 29. DevOps Pack: 2015 full-colour icons in 38 groups (2026-11-04)

A user-supplied offline pack (`~/Downloads/aws-keys/icons.js`, "DevOps, Cloud, Networking &
Teaching Icon Pack") is fully integrated as a fourth icon source. Unlike Lucide's stroke
geometry, these SVGs use gradients, clip paths and `<text>` labels, so they are baked
verbatim and rasterized by the browser: canvas draws them via `Image` + data URL (dashed
placeholder for the first frame, auto re-render on load); SVG export embeds the same markup
as a nested `<svg>` at the identical contain-fit geometry — draw and `toSvg` share
`packIconGeometry` and an equivalence test pins the lockstep.

**Organization** ("folders/types"): the pack's own `group` field (AWS, Azure, Google Cloud,
Kubernetes Resources, Kubernetes Components & kubectl, Docker, Ansible, Terraform, Linux,
Networking, Firewall & Security, Testing, Demo & Teaching Content, … — 38 groups) becomes
the category pills of a dedicated **DevOps Pack** tab: search, group pills with counts,
windowed All view (64 cards, Show-all button), favourites, recents, click-place and drag.
Pack categories are deliberately kept out of the main Icons tab's category strip (they
would add 38 pills); the icons stay reachable from the main tab's search once registered.

**Performance**: the generated module is ~2.6 MB of markup, so it is **lazily code-split** —
the initial bundle is unchanged (281 KB gzip); the pack loads as its own chunk (185 KB gzip)
when the tab is first opened, and render/SVG-export paths trigger the same load when they
meet a `pk-*` element that is not yet registered (placeholder → auto re-render), so saved
boards self-heal after reload without visiting the tab.

**Definitional hygiene**: the pack's generic defs ids (`g1`, `k1`) are per-icon namespaced at
generation time, so many icons can coexist in one exported SVG or one library DOM without
gradient/clip hijacking. Pack ids are `pk-*` (e.g. `pk-aws-amazon-ec2`); they intentionally
coexist with the curated geometry packs (`aws-ec2`), both reachable in search. Provenance is
recorded in the manifest (`iconpack`, license unstated — user-supplied).

Regeneration: `node scripts/gen-icon-pack-icons.js` (env `ICON_PACK_SOURCE`/`ICON_PACK_OUT`
for tests) — idempotent (sha256 compare), refuses zero-icon/malformed sources with exit 1.

Evidence: `scripts/gen-icon-pack-icons.js`, `stencils/icon-pack-icons.js` (generated),
`stencils/index.js` (`registerIconPackStencils` / `ensureIconPackLoaded`),
`render/shapes.js`, `render/svg-export.js`, `ui/library-panel.js`, `stencils/manifest.js`,
`tests/icon-pack.test.js` (11; suite 377). Browser-verified: tab + group pills, search,
placement, canvas raster (EC2 gradient sampled on the live canvas), SVG export at
geometry, reload self-heal; `vite build` splits the chunk.
