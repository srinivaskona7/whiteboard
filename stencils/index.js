// stencils/index.js
import { DEVOPS_CLOUD_STENCILS } from './devops-cloud.js';
import { DEVOPS_INFRA_STENCILS } from './devops-infra.js';
import { DEVOPS_CICD_STENCILS } from './devops-cicd.js';
import { DEVOPS_DATA_SEC_STENCILS } from './devops-data-sec.js';
import { FLOWCHART_STENCILS } from './flowchart.js';
import { UML_STENCILS } from './uml.js';
import { ER_STENCILS } from './er.js';
import { GENERIC_STENCILS } from './generic.js';

export const ALL_STENCILS = [
  ...DEVOPS_CLOUD_STENCILS,
  ...DEVOPS_INFRA_STENCILS,
  ...DEVOPS_CICD_STENCILS,
  ...DEVOPS_DATA_SEC_STENCILS,
  ...FLOWCHART_STENCILS,
  ...UML_STENCILS,
  ...ER_STENCILS,
  ...GENERIC_STENCILS,
];

const STENCIL_MAP = new Map(ALL_STENCILS.map((s) => [s.id, s]));

export function getStencilById(id) {
  return STENCIL_MAP.get(id) || ALL_STENCILS[0];
}

export function getAllCategories() {
  const cats = new Set();
  for (const s of ALL_STENCILS) {
    cats.add(s.category);
  }
  return Array.from(cats);
}

export function getStencilsByCategory(filterQuery = '', categoryFilter = 'all') {
  const tokens = filterQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const groups = new Map();

  for (const s of ALL_STENCILS) {
    if (categoryFilter && categoryFilter !== 'all' && s.category !== categoryFilter) {
      continue;
    }
    if (tokens.length > 0) {
      const haystack = `${s.name} ${s.category} ${s.id} ${s.badge || ''} ${s.tags || ''} ${s.defaultText || ''}`.toLowerCase();
      const matchesAll = tokens.every((t) => haystack.includes(t));
      if (!matchesAll) continue;
    }
    if (!groups.has(s.category)) {
      groups.set(s.category, []);
    }
    groups.get(s.category).push(s);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}
