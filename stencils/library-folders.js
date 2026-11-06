// stencils/library-folders.js — the folder model behind the library's Icons and Folders tabs.
// Pure data: no DOM, so it is unit-tested in Node. Every stencil (cards, line icons, the lazy
// 2,015-icon colour pack) lands in exactly one family folder and one sub-folder.

/** Where an icon came from, which decides how it is drawn and which one wins a duplicate. */
export function iconSource(s) {
  const id = String(s.id);
  if (id.startsWith('pk-')) return 'pack';
  if (id.startsWith('lucide-') || id.startsWith('wf-')) return 'line';
  return 'card';
}
const SOURCE_RANK = { card: 0, line: 1, pack: 2 };

// First matching rule wins, so the narrow rules (status, testing) sit above the broad ones.
export const FOLDER_FAMILIES = Object.freeze([
  { id: 'status', label: 'Status & results', color: '#059669', glyph: 'circle-check', test: /status/ },
  { id: 'cloud', label: 'Cloud providers', color: '#f59e0b', glyph: 'cloud', test: /^(aws|azure|gcp|cloud & network)$|^pack\/(aws|azure|google-cloud|sap-btp-and-kyma)$/ },
  { id: 'containers', label: 'Containers & Kubernetes', color: '#326ce5', glyph: 'container', test: /^(docker & containers|kubernetes)$|^pack\/(docker|containers-|kubernetes-|istio)/ },
  { id: 'devops', label: 'DevOps & CI/CD', color: '#7c3aed', glyph: 'git-branch', test: /^(git & source control|ci\/cd & gitops|infrastructure as code|config management)$|^pack\/(ci-cd|iac|ansible|terraform|deployment|sdlc|environments)|^icons\/workflow-(git|ansible)$/ },
  { id: 'linux', label: 'Linux & systems', color: '#ca8a04', glyph: 'terminal', test: /^(linux|teaching concepts & internals)$|^pack\/(linux|languages-shell|computers-and-devices)|^icons\/workflow-linux$/ },
  { id: 'network', label: 'Networking & security', color: '#0891b2', glyph: 'network', test: /^(networking|security & secrets)$|^pack\/(networking|firewall|protocols|security-and-scanning)|^icons\/workflow-network$/ },
  { id: 'data', label: 'Data & observability', color: '#16a34a', glyph: 'database', test: /^(databases, storage & messaging|monitoring & logging)$|^pack\/(data-and-storage|observability)/ },
  { id: 'testing', label: 'Testing & quality', color: '#db2777', glyph: 'flask-conical', test: /^pack\/(testing|performance|security-testing)/ },
  { id: 'diagrams', label: 'Diagramming', color: '#475569', glyph: 'shapes', test: /^(architecture boundaries|flowchart|uml|er diagram|math & science|generic)$|^pack\/general-arrows/ },
  { id: 'people', label: 'People & teaching', color: '#ea580c', glyph: 'users', test: /^pack\/(people|demo|general-)|^icons\/(education|people-collaboration)$/ },
  { id: 'line', label: 'Line icons', color: '#64748b', glyph: 'layers', test: /^icons\// },
]);
const OTHER = { id: 'other', label: 'Other', color: '#94a3b8', glyph: 'folder' };

const LINE_LABELS = {
  education: 'Education', 'tech-devops': 'Tech & DevOps', 'office-business': 'Office & Business', arrows: 'Arrows',
  media: 'Media', 'people-collaboration': 'People & Collaboration', 'nature-weather': 'Nature & Weather',
  'status-symbols': 'Status symbols', 'workflow-git': 'Git concepts', 'workflow-linux': 'Linux concepts',
  'workflow-ansible': 'Ansible concepts', 'workflow-network': 'Network concepts', 'workflow-status': 'Run status',
};
// Labels that mean the same folder in the card set and in the colour pack.
const LABEL_ALIAS = { gcp: 'google cloud', 'docker & containers': 'docker' };

export function familyOf(category) {
  const key = String(category || '').toLowerCase();
  return FOLDER_FAMILIES.find((f) => f.test.test(key)) || OTHER;
}

export function subLabelOf(category, packLabels = {}) {
  const c = String(category || '');
  if (c.startsWith('pack/')) return packLabels[c.slice(5)] || c.slice(5);
  if (c.startsWith('icons/')) return LINE_LABELS[c.slice(6)] || c.slice(6);
  return c;
}

/** "Amazon EKS", "AWS EKS" and "EKS" are the same icon for duplicate purposes. */
export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^(amazon|aws|azure|google cloud|gcp|microsoft)\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Build the folder tree.
 * @param stencils   every stencil currently registered
 * @param packLabels { slug: 'Label' } for the colour pack groups
 * @param dedupe     hide look-alikes: within one folder family, one icon per name, preferring
 *                   the card, then the line icon, then the colour pack version
 */
export function buildFolderIndex(stencils, packLabels = {}, { dedupe = true } = {}) {
  const best = new Map();
  const rows = stencils.map((s, order) => {
    const fam = familyOf(s.category);
    const row = { s, fam, source: iconSource(s), order, subLabel: subLabelOf(s.category, packLabels) };
    row.subId = row.subLabel.toLowerCase();
    row.subId = LABEL_ALIAS[row.subId] || row.subId;
    // Scoped to the sub-folder, so AWS Batch and Azure Batch (different providers) never merge.
    row.key = `${fam.id}|${row.subId}|${normalizeName(s.name)}`;
    const cur = best.get(row.key);
    if (!cur || SOURCE_RANK[row.source] < SOURCE_RANK[cur.source]) best.set(row.key, row);
    return row;
  });
  const entries = dedupe ? rows.filter((r) => best.get(r.key) === r) : rows;

  const families = new Map();
  for (const r of entries) {
    if (!families.has(r.fam.id)) families.set(r.fam.id, { ...r.fam, count: 0, subs: new Map() });
    const f = families.get(r.fam.id);
    if (!f.subs.has(r.subId)) f.subs.set(r.subId, { id: r.subId, label: r.subLabel, count: 0, entries: [] });
    const sub = f.subs.get(r.subId);
    if (sub.label !== r.subLabel && SOURCE_RANK[r.source] === 0) sub.label = r.subLabel;
    sub.entries.push(r);
    sub.count++;
    f.count++;
  }
  const order = [...FOLDER_FAMILIES, OTHER].map((f) => f.id);
  const list = [...families.values()]
    .map((f) => ({ ...f, subs: [...f.subs.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) }))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { families: list, entries, total: stencils.length, shown: entries.length, hidden: stencils.length - entries.length };
}
