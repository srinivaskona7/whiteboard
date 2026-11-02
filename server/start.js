// server/start.js — Standalone Collaboration Server Entrypoint (default port 4179)
import path from 'node:path';
import { createStandaloneCollabServer } from './collab-server.js';

const port = Number(process.env.PORT || 4179);
const storagePath = path.resolve(process.cwd(), '.data/collab-store.json');
const srv = createStandaloneCollabServer({ port, storagePath });

srv.start().then((actualPort) => {
  console.log(`[StudioBoard Collab Server] Listening on http://127.0.0.1:${actualPort}`);
});
