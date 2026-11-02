# StudioBoard — Classroom Whiteboard + Diagramming Studio

A fast, offline-first **Classroom Whiteboard & Technical Diagramming Studio** built with **Vite 5**, **vanilla ES modules**, and an **HTML5 Canvas + SVG engine** with **zero runtime dependencies**.

It combines **Excalidraw-style sketchy/clean whiteboarding**, **draw.io-style smart orthogonal connectors & technical stencils**, and **Miro/classroom teaching tools** (presentation slides, step-by-step reveal, laser pointer, spotlight/magnifier, stamps, countdown timer, and auto-fading annotation ink).

---

## Key Capabilities

### P0 — Core Whiteboarding & Diagramming
- **Drawing & Shapes**: Freehand pen (with point simplification & smoothing), highlighter, eraser, rectangle, rounded rectangle, ellipse, diamond, line, smart arrow, and rich text.
- **In-Shape Labels & Auto-Grow**: Double-click any shape or connector to type centered labels; shapes automatically expand to fit overflowing text (toggleable per element).
- **Smart Connectors (draw.io style)**:
  - 4 directional connection ports (`top`, `right`, `bottom`, `left`) highlighted on hover.
  - Persistent bindings that automatically re-route when bound shapes move, resize, or rotate.
  - **Straight**, **Orthogonal** (obstacle-avoiding Manhattan routing with draggable elbow midpoint handle), and **Curved** (quadratic Bezier with draggable control point) routing.
  - Configurable arrowheads (`none`, `arrow`, `triangle`, `diamond`, `circle`, `bar`), line styles (`solid`, `dashed`, `dotted`), and draggable connector text labels.
- **Selection & Transform**: Click, Shift-click, marquee box, `Ctrl/Cmd+A`, 8-handle resize, rotation handle (`Shift` snaps to 15° increments), arrow-key nudging (`Shift` = 10px), copy/cut/paste with cascading offset and binding preservation, `Ctrl/Cmd+D` duplicate, and `Alt+drag` quick cloning.
- **Images**: Insert via file picker, drag-and-drop, or clipboard paste; automatic downscaling for large images; aspect-ratio lock toggle (`Shift` inverts temporarily).
- **Themes & Backgrounds**: Light and dark themes (persisted, defaults to `prefers-color-scheme`), with `plain`, `grid`, and `dots` backgrounds that scale with zoom.
- **Teaching Essentials**: Ephemeral fading laser pointer (`K`), highlighter (`M`), eraser (`E`), per-page undo/redo, cursor-centered zoom (`10%–800%`), pan (`Space+drag`, middle mouse, or Hand tool `H`), fit-to-content (`1`), and Full Screen (`F`).
- **Export & Persistence**:
  - Export to **PNG** (`1x`, `2x`, `3x`, transparent or themed background, full page or selection-only), **Copy PNG to Clipboard**, and **SVG** (faithful vector serialization matching canvas rendering).
  - Debounced `localStorage` autosave with quota warning toast, plus **Save / Open `.whiteboard.json`** (bundling embedded images and all pages) with schema `version` migration.

### P1 — Diagramming Power
- **Searchable Stencil Library**: 40+ original vector stencils across **Flowchart**, **UML**, **Entity-Relationship (ER)**, **Kubernetes** (`pod`, `deploy`, `svc`, `ing`, `pvc`, `cm`, `secret`, `ns`, `node`, `cronjob`, `sts`), **Cloud** (AWS, GCP, Azure, Bucket, DB, Function, Queue, CDN), **Network**, and **Math/Classroom**.
- **Containers, Frames & Groups**: Group/ungroup (`Ctrl/Cmd+G`), collapsible Frames/containers (swimlanes, VPC/namespace boxes, slides) that move child elements together and optionally clip contents.
- **Alignment & Snapping**: Align left/center/right/top/middle/bottom, distribute horizontally/vertically, match size, smart alignment guides, snap-to-grid, snap-to-objects, and snap-to-angle.
- **Layers, Multi-Page & Reusable Library**:
  - Layers panel with z-order reordering (`[` / `]`), lock/unlock, and hide/show.
  - Multi-page tab bar (add, rename, reorder, duplicate, delete) with isolated camera and undo/redo stacks per page.
  - Reusable User Library ("+ To Library", persisted in `localStorage`, import/export `.library.json`).
- **Format Painter, Mermaid Import, Tables, Code & Sticky Notes**:
  - Copy/paste element styles, per-element corner roundness, and clean vs. hand-drawn (`sloppy`) rendering toggle.
  - Built-in offline **Mermaid parser** supporting `flowchart TD/LR` and `sequenceDiagram` with clear line-level diagnostics for unsupported syntax.
  - Editable **Tables** (add/remove rows & columns, double-click any cell to edit), monospace **Code Blocks** (with line highlighting e.g. `1,3-4`), **Sticky Notes** with auto-wrapped text, and **Hyperlinks** (`Ctrl/Cmd+Click` or click the `↗` badge).

### P2 — Classroom & Presentation Mode
- **Presentation Mode & Step-by-Step Reveal**: Frames act as ordered slides (`Slide 1..N`) with a bottom slide overview strip; elements assigned a **Reveal Step (`1..10`)** appear one step at a time via `Right Arrow` / `Space` / click.
- **Spotlight & Magnifier**: Dim the board around a circular pointer spotlight with optional `2x` magnifier lens.
- **Classroom Stamps & Timer**: Quick-place stamps (`✓`, `✗`, `★`, `?`, `↑`, and auto-incrementing number badges `1–9`), plus a countdown timer (`1m`, `3m`, `5m`, `10m`, custom) with a gentle WebAudio chord chime.
- **11 Offline Templates & Math Helpers**: Built-in templates for *Blank*, *Kanban*, *Mind Map*, *Flowchart Starter*, *Kubernetes Architecture*, *Sequence Diagram*, *KWL Chart*, *Venn Diagram*, *2×2 Matrix*, *Number Line*, and *Coordinate Axes*, plus interactive movable/rotatable **Ruler** and **Protractor** overlays.
- **Image Crop, Background Lock, Fading Ink & URL Hash Sharing**: Crop images in-place, lock worksheets/slides as background, draw with 3-second auto-fading annotation ink, print to PDF via `@media print`, and share small scenes via `#scene=...` URL hashes.

---

## Quick Start

```bash
# Install dependencies (Vite 5 is the sole devDependency; zero runtime dependencies)
npm install

# Run unit tests (Node built-in test runner)
npm test

# Start development server
npm run dev

# Build static production bundle into dist/
npm run build

# Preview production bundle
npm run preview
```

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `V` | Select / Move / Resize / Rotate Tool |
| `H` or `Space + Drag` | Hand / Pan Canvas |
| `P` / `M` / `E` | Freehand Pen / Highlighter / Eraser |
| `R` / `U` / `O` / `D` | Rectangle / Rounded Rect / Ellipse / Diamond |
| `L` / `A` | Line / Smart Connector Arrow |
| `T` or `Double-Click` | Text Tool / Edit Shape or Cell Label |
| `N` / `S` / `K` / `I` | Sticky Note / Stamp / Laser Pointer / Insert Image |
| `Ctrl/Cmd + Z` / `Y` | Undo / Redo (per page) |
| `Ctrl/Cmd + C / X / V / D` | Copy / Cut / Paste / Duplicate Selection |
| `Alt + Drag` | Clone Selection |
| `Ctrl/Cmd + G` / `Shift+G` | Group / Ungroup Selection |
| `[` / `]` | Send to Back / Bring to Front |
| `+` / `-` / `0` / `1` | Zoom In / Zoom Out / Reset 100% / Fit to Content |
| `F` | Toggle Full Screen |
| `Ctrl/Cmd + K` | Open Command Palette |
| `?` | Keyboard Shortcuts Reference |
