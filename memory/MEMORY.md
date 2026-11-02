# Project Memory — Classroom Whiteboard + Diagramming Studio

## Session Plan
- Active Checklist & Requirements: [SESSION_PLAN.md](./SESSION_PLAN.md)
- Feature Verification Checklist: [../feature-list.md](../feature-list.md)

## Architecture & Module Tree
- `index.html` — Single-page offline application entry point
- `styles.css` — CSS variables, light/dark themes, print-friendly CSS, responsive floating UI, accessibility focus rings
- `main.js` — Application coordinator, state manager, event loop, keyboard shortcuts, clipboard & file handlers
- `scene/`
  - `model.js` — Scene, Page, Element factories, ID generator, defaults, z-order, groups, frames, reveal steps
  - `geometry.js` — Bounding boxes, rotation transforms, point-in-polygon, intersection, edge connection points, angle/grid snapping, alignment & distribution helpers
  - `hit.js` — Hit-testing for shapes, lines/connectors, handles, rotation knob, connection ports, text labels, tables
  - `history.js` — Per-page undo/redo stack with diff/change detection & lightweight snapshots (separate `files` map for images)
  - `bindings.js` — Smart connector bindings to shape ports/edges, live update on move/resize/rotate, clone binding remapping
  - `routing.js` — Straight, curved (bezier), and orthogonal (A* / Manhattan obstacle-avoiding elbow) connector routing with draggable midpoint handles
  - `storage.js` — Schema `version` migration hook, debounced `localStorage` autosave with quota toast, `.whiteboard.json` save/open, `.library.json` import/export, URL hash compression/sharing
  - `mermaid.js` — Offline parser for `flowchart`/`graph` and `sequenceDiagram` subsets with clear diagnostics for unsupported syntax
- `render/`
  - `themes.js` — Light and dark palettes, background patterns (plain, grid, dots), element color tokens
  - `shapes.js` — Shared path/primitive generators for clean and hand-drawn (sloppy) shapes, arrowheads, stencils, tables, code blocks, sticky notes, stamps, math overlays
  - `canvas.js` — HiDPI HTML5 Canvas renderer with viewport culling, `ImageBitmap`/HTMLImageElement cache, smart guides, selection handles, laser trail, spotlight/magnifier, annotation overlay
  - `svg-export.js` — Faithful SVG serializer matching canvas rendering with XML escaping, arrowheads, stencils, and embedded images
- `tools/`
  - `select.js` — Click, shift-click, marquee, move, 8-handle resize, rotation (15° Shift snap), Alt-drag clone, group/container dragging, crop mode, smart guide snapping
  - `draw.js` — Freehand pen (smoothed), highlighter, eraser, annotation auto-fading ink, rectangle, rounded rect, ellipse, diamond, sticky note, frame, table, code block
  - `connector.js` — Line and smart arrow creation, port hover detection, live orthogonal/curved preview, endpoint rebinding, midpoint elbow dragging
  - `text.js` — In-place text editor for freestanding text, double-click shape/connector labels (with auto-grow), sticky notes, table cells, code blocks
  - `laser.js` — Ephemeral fading laser trail and spotlight/magnifier pointer handling
  - `stamp.js` — Classroom stamps (tick, cross, star, question, arrow-up, badges 1–9)
  - `math-tools.js` — Interactive ruler and protractor overlay manipulation, coordinate axes & number line helpers
  - `image.js` — Image insertion, downscaling, aspect-ratio lock, crop mode, and background locking
- `ui/`
  - `toolbar.js` — Floating primary tool dock, quick actions, mode toggles, full-screen button
  - `props-panel.js` — Contextual properties panel showing only applicable controls for current selection/tool
  - `library-panel.js` — Searchable, collapsible stencil library + user reusable library + templates drawer
  - `pages.js` — Multi-page tab bar (add, rename, reorder, duplicate, delete)
  - `dialogs.js` — Shortcuts modal (`?`), Mermaid import modal, Export dialog (PNG 1–3x, SVG, Copy PNG, selection-only), Share URL modal, Hyperlink editor, Toast notifications
  - `palette.js` — Command palette (`Ctrl/Cmd+K`) searching all tools, actions, stencils, templates
  - `present.js` — Presentation mode controller (frames as slides, step-by-step reveal 1..N, overview strip, fullscreen integration)
  - `layers.js` — Layers panel (z-order, lock/unlock, hide/show, rename)
  - `timer.js` — Classroom countdown timer (1/3/5/10m + custom) with WebAudio chime
  - `classroom.js` — Shareable classroom links (`#classroom=1&...`), student name join, component pointers/pings (`BroadcastChannel` + canvas beacon), and location/component-attached Question Pins + Q&A drawer
- `stencils/`
  - `card.js`, `devops-cloud.js` (AWS, Azure, GCP), `devops-infra.js` (Linux, Docker, Kubernetes, Networking), `devops-cicd.js` (Git, CI/CD, IaC, Config Management), `devops-data-sec.js` (Monitoring, Logging, Security, Databases, Storage, Messaging), `flowchart.js`, `uml.js`, `er.js`, `generic.js`, `index.js`
- `templates/`
  - `index.js` — 11 offline built-in templates (Blank, Kanban, Mind Map, Flowchart Starter, Kubernetes Architecture, Sequence Diagram, KWL Chart, Venn Diagram, 2x2 Matrix, Number Line, Coordinate Axes)
- `tests/`
  - `scene.test.js` — Node built-in test runner suite (`node --test`)
- `.github/workflows/`
  - `deploy.yml` — Fast GitHub Pages deployment pipeline (`ubuntu-24.04`, `npm ci`, `npm test`, `npm run build`, `touch dist/.nojekyll`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`)
  - `ci.yml` — Pull request & branch CI pipeline (`ubuntu-24.04`, `npm ci`, `npm test`, `npm run build`)

## Invariants
- Only `vite` in `devDependencies`, zero `dependencies`.
- Every source file stays well under 600 lines.
- `npm test` runs `node --test tests/scene.test.js`.
- `npm run build` outputs to `dist/` with `base: './'`.
