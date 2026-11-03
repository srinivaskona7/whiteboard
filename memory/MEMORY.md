# Project Memory — Classroom Whiteboard + Diagramming Studio

## Session Plan
- Active Checklist & Requirements: [SESSION_PLAN.md](./SESSION_PLAN.md) (Phases A → H in progress)
- Feature Verification Checklist: [../feature-list.md](../feature-list.md)

## Architecture & Module Tree
- `index.html` — Single-page offline-first application entry point with inline SVG favicon, Spotlight floating pill, Teaching Focus bar, and Collaboration presence UI
- `styles.css` — CSS variables, light/dark themes, print-friendly CSS, responsive floating UI (`390px`, `768px`, `1440px`), accessibility focus rings
- `main.js` — Application coordinator, state manager, event loop, explicit `Escape` hierarchy, keyboard shortcuts, clipboard & file handlers
- `vite.config.js` — Vite 5 configuration (`base: './'`, `host: true`, `allowedHosts: true`, `cors: true`) with attached collaboration API & WebSocket middleware
- `server/`
  - `collab-server.js` — Persistent short-link snapshot store (`#/b/{id}`), live classroom room store (`#/r/{roomId}`), RFC 6455 WebSocket server, and server-side role enforcement (`teacher`, `editor`, `viewer`)
- `scene/`
  - `model.js` — Scene, Page, Element factories, ID generator, defaults, connector direction presets (`plain`, `one-way`, `two-way`), groups, frames, boundary containers (`getContainerChildren`), and question anchor deletion handler (`handleAnchorDeletion`)
  - `geometry.js` — `screenToWorldPoint`, `worldToScreenPoint`, `getUsableViewportCenterWorld`, `isValidElementGeometry`, `validateElementsBatch`, bounding boxes, rotation transforms, connection ports (`auto`, `top`, `right`, `bottom`, `left`, `custom`), alignment & distribution helpers
  - `hit.js` — Hit-testing for shapes, lines/connectors, handles, rotation knob, connection ports, text labels, tables
  - `history.js` — Per-page undo/redo stack (`commit` / `record`, `undo`, `redo`) with diff detection & single-step batch transactions
  - `bindings.js` — Smart connector bindings to shape ports/boundaries (`auto` + explicit/custom perimeter ports), live update on move/resize/rotate, clone binding remapping
  - `routing.js` — Straight, curved (bezier), and orthogonal (A* / Manhattan obstacle-avoiding elbow) connector routing, tangent orientation (`getConnectorTangentFromPoint`), and `resetConnectorRoute`
  - `layout.js` — Batch stencil placement (`computeBatchStencilPlacement` for `grid`, `row`, `column`, `flow`) and layered Sugiyama DAG auto-layout (`autoLayoutArchitecture`)
  - `collab-client.js` — Short-link route parser (`parseShareRoute`), HTTP snapshot/room client, and throttled real-time WebSocket classroom sync client
  - `storage.js` — Schema `version` migration hook, `assertValidSceneGeometry` guard, debounced `localStorage` autosave, `.whiteboard.json` save/open, `.library.json` import/export, offline `#scene=...` fallback hash sharing
  - `mermaid.js` — Offline parser for `flowchart`/`graph` and `sequenceDiagram` subsets + `computeNonOverlappingOrigin` (supports both `(page, w, h)` and `(elements, x, y)` signatures)
- `render/`
  - `themes.js` — Light and dark palettes (`THEME_ORDER`, `THEMES`), background patterns (plain, grid, dots), element color tokens
  - `shapes.js` — Shared path/primitive generators for clean and hand-drawn (sloppy) shapes, tangent arrowheads, stencils, tables, code blocks, sticky notes, stamps, math overlays
  - `canvas.js` — HiDPI HTML5 Canvas renderer with viewport culling, `ImageBitmap`/HTMLImageElement cache, smart guides, selection handles, placement preview ghost, attachment preview, remote board-coordinate cursors, laser trail, spotlight/magnifier
  - `svg-export.js` — Faithful SVG serializer matching canvas rendering with XML escaping, arrowheads, aspect-ratio-preserving stencils, and embedded images
- `tools/`
  - `select.js` — Click, shift-click, marquee, move, 8-handle resize, rotation (15° Shift snap), Alt-drag clone, group & boundary container dragging, crop mode, smart guide snapping
  - `draw.js` — Freehand pen (smoothed), highlighter, eraser (`EraserTool`), annotation auto-fading ink, shapes (`ShapeTool`: rectangle, rounded rect, ellipse, diamond, sticky note, frame, table, code block)
  - `connector.js` — Line and smart arrow creation, port/boundary hover detection, live source/target attachment preview, endpoint rebinding, midpoint elbow/curve dragging
  - `text.js` — In-place text editor for freestanding text, double-click shape/connector labels (with auto-grow), sticky notes, table cells, code blocks
  - `laser.js` — Ephemeral fading laser trail and non-destructive spotlight/magnifier pointer tracking
  - `stamp.js` — Classroom stamps (tick, cross, star, question, arrow-up, badges 1–9)
  - `math-tools.js` — Interactive ruler and protractor overlay manipulation (`MathOverlayTool`), coordinate axes & number line helpers
  - `image.js` — Image insertion (`insertImageFile`, `handleImageFiles`, `setupImagePasteAndDrop`), downscaling, aspect-ratio lock, crop mode, and background locking
- `ui/`
  - `toolbar.js` — Compact primary tool dock, `+ Insert` menu, Teaching menu, Spotlight floating exit bar, Teaching Focus customization bar
  - `props-panel.js` — Contextual properties panel with connector direction presets, port selectors, protocol label chips (`HTTPS`, `TCP 443`, `DNS`, `gRPC`, `replication`), Reset Route, Auto-Layout, and boundary container options
  - `library-panel.js` — Searchable stencil library with abbreviation aliases (`EC2`, `AKS`, `GKE`, `LB`, `SG`, `PVC`, `DNS`), Favorites (`★`), Recent (`🕒`), Compact/Comfortable density, keyboard navigation, virtualized list windowing, and Multi-Select Grid/Row/Column/Flow placement preview
  - `pages.js` — Multi-page tab bar (add, rename, reorder, duplicate, delete)
  - `dialogs.js` — Short-link Share modal (`#/b/{id}`, `#/r/{roomId}`, `#/r/{roomId}?invite={token}` + QR code + offline `#scene=...` fallback), Export dialog, Mermaid import modal, Shortcuts modal (`?`), Toast notifications
  - `qr.js` — Zero-dependency offline SVG QR-like visual matrix generator for classroom room/board join links
  - `palette.js` — Command palette (`Ctrl/Cmd+K`) searching all tools, actions, stencils, templates
  - `present.js` — Presentation mode controller (frames as slides, step-by-step reveal 1..N, overview strip, fullscreen integration)
  - `layers.js` — Layers panel (z-order, lock/unlock, hide/show, rename)
  - `timer.js` — Classroom countdown timer (1/3/5/10m + custom) with WebAudio chime
  - `classroom.js` — Live classroom collaboration UI, participant name prompt, Follow Teacher toggle, component pointers/pings, and anchored Question Pins + Q&A drawer (Locate, Reply, Resolve, Reopen, Unanswered filter)
  - `registry.js` — Tool & shortcut metadata (`TOOL_REGISTRY`, `SHORTCUT_REFERENCE`, `ICONS`) and 1-click DevOps diagram packs (`buildDevOpsDiagramPacks`)
- `stencils/`
  - `manifest.js` — Icon provenance manifest (`ICON_PACK_SOURCES`, `getIconProvenance`) for AWS, Azure, GCP, Kubernetes, CNCF, Devicon, and StudioBoard Teaching Concepts
  - `card.js` — Aspect-ratio-preserving (`1:1` uniform scale) DevOps card renderer and architecture boundary container renderer (`createDevOpsStencil`, `createBoundaryStencil`)
  - `concepts.js` — 11 Architecture Boundary containers (`ARCHITECTURE_BOUNDARY_STENCILS`) and 11 vendor-neutral OS/Networking teaching concepts (`TEACHING_CONCEPT_STENCILS`)
  - `devops-cloud.js` (AWS, Azure, GCP), `devops-infra.js` (Linux, Docker, Kubernetes, Networking), `devops-cicd.js` (Git, CI/CD, IaC, Config Management), `devops-data-sec.js` (Monitoring, Logging, Security including `sec-sg`, Databases, Storage, Messaging), `flowchart.js`, `uml.js`, `er.js`, `generic.js`, `cloud.js`, `kubernetes.js`, `network.js`, `index.js`
- `templates/`
  - `index.js` — 11 offline built-in templates
- `tests/`
  - `scene.test.js` — Core geometry, hit-testing, routing, bindings, history, Mermaid, storage migration, SVG export, and stencil/template suite
  - `collab.test.js` — EC2+S3 Connected Flow regression test, `Number.isFinite` validation test, connector direction presets & auto-port tests, provenance & abbreviation alias tests, boundary container & deleted-anchor question tests, short-link & role-enforcement collaboration tests, and 100 / 1,000 / 5,000 object performance benchmarks

## Invariants
- Only `vite` in `devDependencies`, zero `dependencies`.
- `npm test` runs `node --test tests/*.test.js` (42 tests across 15 suites as of 2026-11-03).
- `npm run build` outputs to `dist/` with `base: './'`.
- The app instance for browser verification is `window.__WHITEBOARD_APP__` (there is no `window.app`).
- `ui/notebook.js` is a projection over the one scene model: the live `#wb-canvas` is reparented into the
  active sheet and other pages are static `renderPageToCanvas` previews. Notebook zoom lives in
  `app.getCamera()`, never in the persisted `page.camera`.
- `app.printHandout()` builds `#wb-print-root` with one sheet per page, ordered, then calls `window.print()`.
