// stencils/index.js
import { FLOWCHART_STENCILS } from './flowchart.js';
import { UML_STENCILS } from './uml.js';
import { ER_STENCILS } from './er.js';
import { KUBERNETES_STENCILS } from './kubernetes.js';
import { CLOUD_STENCILS } from './cloud.js';
import { NETWORK_STENCILS } from './network.js';
import { GENERIC_STENCILS } from './generic.js';

export const ALL_STENCILS = [
  ...FLOWCHART_STENCILS,
  ...UML_STENCILS,
  ...ER_STENCILS,
  ...KUBERNETES_STENCILS,
  ...CLOUD_STENCILS,
  ...NETWORK_STENCILS,
  ...GENERIC_STENCILS,
];

const STENCIL_MAP = new Map(ALL_STENCILS.map((s) => [s.id, s]));

export function getStencilById(id) {
  return STENCIL_MAP.get(id) || FLOWCHART_STENCILS[0];
}

export function getStencilsByCategory(searchQuery = '') {
  const q = searchQuery.trim().toLowerCase();
  const groups = new Map();
  for (const s of ALL_STENCILS) {
    if (
      q &&
      !s.name.toLowerCase().includes(q) &&
      !s.category.toLowerCase().includes(q) &&
      !s.id.toLowerCase().includes(q)
    ) {
      continue;
    }
    if (!groups.has(s.category)) {
      groups.set(s.category, []);
    }
    groups.get(s.category).push(s);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}
