# Session Plan: Classroom Whiteboard + Diagramming Studio

## User Inputs & Constraints
- **Stack**: Vite 5 + vanilla JavaScript (ES modules) + custom HTML5 Canvas engine.
- **Dependencies**: Zero runtime dependencies. Dev dependency: `vite` only (`^5.0.0`).
- **Config**: `vite.config.js` with `base: './'`, `host: true`, `allowedHosts: true`, `cors: true`. Commit `package-lock.json`.
- **Module Structure** (no file over ~600 lines):
  - `scene/` (`model.js`, `geometry.js`, `hit.js`, `history.js`, `bindings.js`, `routing.js`, `storage.js`, `mermaid.js`)
  - `render/` (`canvas.js`, `svg-export.js`, `themes.js`, `shapes.js`)
  - `tools/` (`select.js`, `draw.js`, `text.js`, `connector.js`, `laser.js`, `stamp.js`, `math-tools.js`, `image.js`)
  - `ui/` (`toolbar.js`, `props-panel.js`, `library-panel.js`, `pages.js`, `dialogs.js`, `palette.js`, `present.js`, `layers.js`, `timer.js`)
  - `stencils/` (`flowchart.js`, `uml.js`, `er.js`, `kubernetes.js`, `cloud.js`, `network.js`, `generic.js`, `index.js`)
  - `templates/` (`index.js`)
  - `main.js`, `index.html`, `styles.css`
- **Priorities**: Implement and verify P0 completely before P1, then P2. Update `feature-list.md` only after automated verification passes.

## Step-by-Step Checklist
- [x] Step 1: Initialize `memory/SESSION_PLAN.md`, `memory/MEMORY.md`, `GEMINI.md`, `AGENTS.md`, `CLAUDE.md`, and initial `feature-list.md`.
- [x] Step 2: Scaffold `package.json` (Vite 5 + node `--test`), `vite.config.js`, `.gitignore`, `.github/workflows/deploy.yml`, and install `vite` to generate `package-lock.json`.
- [x] Step 3: Implement `scene/` core engine modules (`model.js`, `geometry.js`, `hit.js`, `history.js`, `bindings.js`, `routing.js`, `storage.js`, `mermaid.js`).
- [x] Step 4: Implement `stencils/` and `templates/` modules (Flowchart, UML, ER, Kubernetes, Cloud, Network, Generic, Math stencils & 11 built-in templates).
- [x] Step 5: Implement `render/` modules (`themes.js`, `shapes.js`, `canvas.js`, `svg-export.js`).
- [x] Step 6: Implement `tools/` modules (`select.js`, `draw.js`, `connector.js`, `text.js`, `laser.js`, `stamp.js`, `math-tools.js`, `image.js`).
- [x] Step 7: Implement `ui/` modules (`toolbar.js`, `props-panel.js`, `library-panel.js`, `pages.js`, `dialogs.js`, `palette.js`, `present.js`, `layers.js`, `timer.js`) + `main.js`, `index.html`, `styles.css`.
- [x] Step 8: Write comprehensive unit tests (`tests/scene.test.js`) for geometry, hit-testing, edge points, orthogonal routing, binding updates, history, Mermaid parser, and save/load migration; verify `npm test` and `npm run build`.
- [x] Step 9: Execute headless Chromium end-to-end verification across all P0, P1, and P2 features (35 features), capturing screenshots and verifying zero console errors.
- [x] Step 10: Update `feature-list.md` with verified `[x]` statuses, write `README.md`, synchronize `memory/MEMORY.md` & `GEMINI.md`/`AGENTS.md`/`CLAUDE.md`, and deliver final verification report.
