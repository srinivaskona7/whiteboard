# Project Instructions — Classroom Whiteboard + Diagramming Studio

See [memory/MEMORY.md](./memory/MEMORY.md) and [memory/SESSION_PLAN.md](./memory/SESSION_PLAN.md) for the synchronized architecture, module tree, and step-by-step execution checklist.

## Key Engineering Rules
1. **Stack**: Vite 5 + vanilla ES modules + HTML5 Canvas. Zero runtime dependencies (`vite` is the sole devDependency).
2. **File Size Limit**: Keep every module under ~600 lines.
3. **Offline First**: No backend, no CDN, no network calls at runtime.
4. **Testing & Build**:
   - Unit tests: `npm test` (`node --test tests/scene.test.js`)
   - Production build: `npm run build` (`vite build` with `base: './'`)
5. **Server Config**: `vite.config.js` configures `host: true`, `allowedHosts: true`, and `cors: true`.
