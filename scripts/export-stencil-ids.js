// Writes workflows/generated/stencil-ids.json so the workflow builder can check every step icon
// against the real registry. Run through `npm run workflows:build`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_STENCILS } from '../stencils/index.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'workflows', 'generated', 'stencil-ids.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(ALL_STENCILS.map((s) => ({ id: s.id, name: s.name, card: !!s.isCard }))));
console.log(`stencil ids: ${ALL_STENCILS.length}`);
