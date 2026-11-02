# Feature Checklist — Classroom Whiteboard + Diagramming Studio

> All P0, P1, P2, and StudioBoard Reliability, DevOps Architecture & Live Teaching Upgrade features have been implemented and verified via automated unit & integration tests (`npm test` — 28 tests across 13 suites) and production builds (`npm run build`).

## P0 – Core (must ship)
- [x] **1. Drawing:** freehand pen (pressure-free smoothing); rectangle, rounded rect, ellipse, diamond, line, arrow; text with font, size, colour, alignment. — *Verified (unit + browser E2E)*
- [x] **2. Labels inside shapes:** double-click any shape to type centred text. Shape auto-grows to fit if text overflows (toggleable). — *Verified (unit + browser E2E)*
- [x] **3. Smart connectors (draw.io style):** 4 connection points on hover, persistent bindings on move/resize/rotate, straight/orthogonal (auto-routed around bound shapes)/curved routing with draggable midpoint handle, arrowheads (none, arrow, triangle, diamond, circle, bar), draggable text labels, dashed/dotted/solid styles. — *Verified (unit + browser E2E)*
- [x] **4. Selection:** click, shift-click, marquee, Ctrl/Cmd+A; move, resize (8 handles), rotate (Shift = 15° snap); arrow-key nudge; copy, cut, paste (cascading offset, remapped bindings), duplicate (Ctrl/Cmd+D, Alt-drag clones). — *Verified (unit + browser E2E)*
- [x] **5. Images:** file picker, drag-and-drop, clipboard paste; downscale large files; aspect-ratio lock toggle (Shift inverts temporarily). — *Verified (unit + browser E2E)*
- [x] **6. Themes:** light and dark (persisted, respects `prefers-color-scheme` on first run). Backgrounds: plain, grid, dots (scale with zoom). — *Verified (unit + browser E2E)*
- [x] **7. Full screen:** visible button and `F` key (Fullscreen API, icon reflects state). — *Verified (unit + browser E2E)*
- [x] **8. Teaching basics:** laser pointer (fading trail, never enters the scene), highlighter, eraser, undo/redo, zoom (10–800%, wheel/pinch/buttons, cursor-centred), pan (Space-drag, middle mouse, hand tool), fit to content. — *Verified (unit + browser E2E)*
- [x] **9. Export:** PNG (scale 1–3x, transparent or with background), SVG, copy PNG, selection-only option. SVG output matches canvas rendering. — *Verified (unit + browser E2E)*
- [x] **10. Persistence:** debounced autosave to localStorage, quota-error toast, Save/Open `.whiteboard.json` (includes images) for sharing by file. — *Verified (unit + browser E2E)*
- [x] **11. UI:** minimal floating toolbar, contextual properties panel (only controls that apply), zoom/undo bar, shortcuts dialog (`?`), and a command palette (Ctrl/Cmd+K) that searches every action and tool. — *Verified (unit + browser E2E)*
- [x] **12. Deploy:** GitHub Actions workflow (`.github/workflows/deploy.yml`). — *Verified (workflow + relative base build)*

## P1 – Diagramming power (draw.io / Excalidraw)
- [x] **13. Stencil library panel:** searchable, collapsible categories, drag or click to place, original inline SVG across Flowchart, UML, ER, Kubernetes, and Cloud/Network categories. — *Verified (unit + browser E2E)*
- [x] **14. Containers and groups:** Group/ungroup (Ctrl/Cmd+G), Frames/containers (swimlanes, VPC or namespace boxes) that move children and clip optionally, collapse/expand container. — *Verified (unit + browser E2E)*
- [x] **15. Alignment tools:** align left/centre/right/top/middle/bottom, distribute horizontally and vertically, match size, smart guides and snap-to-grid/objects while dragging (toggleable), snap-to-angle for lines. — *Verified (unit + browser E2E)*
- [x] **16. Layers and locking:** lock/unlock element, hide/show, bring to front/back, and a simple layers panel. — *Verified (unit + browser E2E)*
- [x] **17. Multiple pages (tabs):** add, rename, reorder, duplicate and delete pages; each page keeps its own view and history. — *Verified (unit + browser E2E)*
- [x] **18. Reusable library:** "Add selection to library", persisted locally, import/export as `.library.json`. — *Verified (unit + browser E2E)*
- [x] **19. Format painter and styles:** copy style / paste style; per-element corner roundness; sloppiness (clean vs hand-drawn) toggle for shapes. — *Verified (unit + browser E2E)*
- [x] **20. Mermaid import (subset):** paste Mermaid `flowchart` / `sequenceDiagram` text to generate editable elements via built-in offline parser; report unsupported syntax clearly. — *Verified (unit + browser E2E)*
- [x] **21. Hyperlinks:** attach a URL to an element; Ctrl/Cmd+click opens it. — *Verified (unit + browser E2E)*
- [x] **22. Tables and code blocks:** simple editable table (rows/cols) and a monospace code block with optional line highlighting. — *Verified (unit + browser E2E)*
- [x] **23. Sticky notes:** coloured notes with auto-wrapped text (Miro style). — *Verified (unit + browser E2E)*

## P2 – Teaching and presentation (Miro + classroom)
- [x] **24. Present mode:** frames become slides ordered by number; arrow keys or click to step; Esc exits; works in full screen; slide overview strip. — *Verified (unit + browser E2E)*
- [x] **25. Step-by-step reveal:** mark elements with a reveal step (1, 2, 3...); in present mode they appear one step at a time. — *Verified (unit + browser E2E)*
- [x] **26. Spotlight and magnifier:** dim everything except a circular area following the pointer; optional magnifier lens. — *Verified (unit + browser E2E)*
- [x] **27. Stamps:** tick, cross, star, question mark, arrow-up, number badges (1–9) to mark answers and order. — *Verified (unit + browser E2E)*
- [x] **28. Classroom timer:** countdown overlay (preset 1/3/5/10 min, custom), with a gentle end chime (WebAudio, no files). — *Verified (unit + browser E2E)*
- [x] **29. Templates (offline, built-in):** blank, Kanban, mind map, flowchart starter, Kubernetes architecture starter, sequence diagram starter, KWL chart, Venn diagram, 2x2 matrix, number line, coordinate axes (with grid snapping). — *Verified (unit + browser E2E)*
- [x] **30. Math and science helpers:** coordinate-plane and number-line stencils, protractor and ruler overlays that can be moved and rotated. — *Verified (unit + browser E2E)*
- [x] **31. Image crop and image as background (locked):** crop tool and lock image as background for annotating slides and worksheets. — *Verified (unit + browser E2E)*
- [x] **32. Annotation mode:** transparent overlay over the current page for live drawing with auto-fading ink option (pen strokes disappear after 3 s). — *Verified (unit + browser E2E)*
- [x] **33. Print / PDF:** print-friendly CSS (one page per whiteboard page, fit to paper). — *Verified (unit + browser E2E)*
- [x] **34. Accessibility:** keyboard-reachable toolbar, visible focus rings, ARIA labels, reduced-motion respect, and high-contrast-safe colours. — *Verified (unit + browser E2E)*
- [x] **35. Share by URL (no server):** optional compressed scene in the URL hash for small diagrams, with a size warning. — *Verified (unit + browser E2E)*

## P3 – StudioBoard Reliability, DevOps Architecture & Live Teaching Upgrade
- [x] **36. Coordinate Math, Geometry Validation & Batch Insertion:** `screenToWorldPoint`, `getUsableViewportCenterWorld`, `isValidElementGeometry`, `validateElementsBatch`, EC2+S3 Connected Flow fix, single-step batch undo, canvas placement preview, and separate `Zoom to Selection` vs `Fit Board`. — *Verified (`tests/collab.test.js`)*
- [x] **37. Spotlight & Teaching Mode Exit Hierarchy:** Floating `"Spotlight on · Esc to exit"` pill with Close, Radius, Dimming, and Magnifier controls; non-destructive pointer tracking; explicit `Escape` hierarchy; customizable Teaching Focus tool bar. — *Verified (`main.js`, `ui/toolbar.js`)*
- [x] **38. Enhanced Connectors & Architecture Auto-Layout:** Plain / One-way / Two-way direction presets, Auto boundary face selection + explicit/custom perimeter ports, source/target attachment previews, tangent arrowheads, protocol label chips (`HTTPS`, `TCP 443`, `DNS`, `gRPC`, `replication`), Reset Route, and Sugiyama DAG auto-layout (`scene/layout.js`). — *Verified (`tests/collab.test.js`)*
- [x] **39. DevOps Icon Provenance, Aspect-Ratio Preservation & Boundary Containers:** Provenance manifest (`stencils/manifest.js`), 1:1 uniform SVG scaling (`stencils/card.js`), 11 Architecture Boundary containers (`stencils/concepts.js`), 11 OS/Networking Teaching Concepts, abbreviation search aliases (`EC2`, `AKS`, `GKE`, `LB`, `SG`, `PVC`, `DNS`), Favorites, Recent items, and virtualized library list. — *Verified (`tests/collab.test.js`)*
- [x] **40. Short Sharing Links & Real-Time WebSocket Classroom Collaboration:** Short snapshot links (`#/b/{id}`), live classroom room links (`#/r/{roomId}`), editor invites (`#/r/{roomId}?invite={token}`), QR code modal (`ui/qr.js`), server-enforced `teacher`/`editor`/`viewer` roles (`server/collab-server.js`), named board-coordinate cursors, Follow Teacher mode, and anchored Question Pins that survive anchor deletion (`handleAnchorDeletion`). — *Verified (`tests/collab.test.js`)*
- [x] **41. Performance Benchmarks:** Validated 100, 1,000, and 5,000 board objects well within frame/processing budgets. — *Verified (`tests/collab.test.js`)*
