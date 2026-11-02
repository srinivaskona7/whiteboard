# Project Instructions — Classroom Whiteboard + Diagramming Studio

See [memory/MEMORY.md](./memory/MEMORY.md) and [memory/SESSION_PLAN.md](./memory/SESSION_PLAN.md) for the synchronized architecture, module tree, and step-by-step execution checklist.

## Key Engineering Rules
1. **Stack**: Vite 5 + vanilla ES modules + HTML5 Canvas + Node built-in HTTP/WebSocket collaboration server (`server/collab-server.js`). Zero runtime npm dependencies (`vite` is the sole devDependency).
2. **Modular Architecture**: Keep modules focused and well-structured across `scene/`, `render/`, `tools/`, `ui/`, `stencils/`, `templates/`, and `server/`.
3. **Offline First + Live Collaboration**: Works 100% offline with local storage, `.whiteboard.json` files, and `#scene=...` fallback links, while supporting short stored links (`#/b/{id}`, `#/r/{roomId}`) and real-time WebSocket classroom collaboration when the collaboration server is reachable.
4. **Testing & Build**:
   - Automated tests: `npm test` (`node --test tests/*.test.js`)
   - Production build: `npm run build` (`vite build` with `base: './'`)
5. **Server Config**: `vite.config.js` configures `host: true`, `allowedHosts: true`, and `cors: true` with the `/api/*` and `/ws` collaboration middleware attached.
