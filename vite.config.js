import path from 'node:path';
import { defineConfig } from 'vite';
import { CollabStore, attachCollabRoutes } from './server/collab-server.js';

function studioBoardCollabPlugin() {
  const storePath = path.resolve(process.cwd(), '.data/collab-store.json');
  const sharedStore = new CollabStore(storePath);
  return {
    name: 'studioboard-collab-backend',
    configureServer(server) {
      const { apiMiddleware } = attachCollabRoutes(server.httpServer, sharedStore);
      server.middlewares.use((req, res, next) => {
        apiMiddleware(req, res, next);
      });
    },
    configurePreviewServer(server) {
      const { apiMiddleware } = attachCollabRoutes(server.httpServer, sharedStore);
      server.middlewares.use((req, res, next) => {
        apiMiddleware(req, res, next);
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [studioBoardCollabPlugin()],
  server: {
    host: true,
    allowedHosts: true,
    cors: true,
  },
  preview: {
    host: true,
    allowedHosts: true,
    cors: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
