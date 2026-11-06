// stencils/library-topics.js — the library's learning map. Every stencil
// category is filed under exactly one topic and one concept folder; topics run
// in learning order (the same order as the Workflows tab), folders run from
// the basics to the specialist material, and icons inside a folder run from
// beginner to expert. tests/library-topics.test.js fails if any category —
// static card, line icon, pack group or glyph set — is left unfiled.
//
// Pure data + functions: no DOM, no lazy imports. Pack counts come from the
// generated static index, so topic sizes show before the 5 MB pack loads.
import { PACK_INDEX } from './icon-pack-index.js';
import { scoreStencilSearchMatch } from './index.js';

export const LEVEL_LABELS = ['Any level', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

const f = (id, label, ...categories) => ({ id, label, categories });

export const LIBRARY_TOPICS = [
  {
    id: 'git',
    label: 'Git & version control',
    blurb: 'Repositories, commits, branches, merges and recovery.',
    color: '#F05133',
    icon: 'lucide-git-branch',
    workflows: ['hello', 'git'],
    folders: [
      f('objects', 'Files, folders & objects', 'pack/git-files-folders-and-objects'),
      f('commands', 'Git commands', 'pack/git-commands'),
      f('concepts', 'Concept line icons', 'icons/workflow-git'),
      f('hosting', 'Hosting & tools', 'Git & Source Control'),
    ],
  },
  {
    id: 'linux',
    label: 'Linux',
    blurb: 'Filesystem, permissions, processes, boot, networking, storage and hardening.',
    color: '#CA8A04',
    icon: 'lucide-terminal',
    workflows: ['linux'],
    folders: [
      f('fhs', 'Filesystem hierarchy', 'pack/linux-filesystem-hierarchy'),
      f('files', 'Files, permissions & commands', 'pack/linux-files-permissions-and-commands'),
      f('packages', 'Packages & software', 'pack/linux-packages-and-software'),
      f('processes', 'Processes, services & performance', 'pack/linux-processes-services-and-performance'),
      f('daemons', 'Daemons & config files', 'pack/linux-daemons-processes-and-config-files'),
      f('boot', 'Boot process', 'pack/linux-boot-process'),
      f('networking', 'Linux networking', 'pack/linux-networking'),
      f('storage', 'Storage & disks', 'pack/linux-storage-and-disks'),
      f('security', 'Security & hardening', 'pack/linux-security-and-hardening'),
      f('scripting', 'Bash & Python scripting', 'pack/bash-and-python-scripting'),
      f('tiles', 'Linux tiles', 'pack/linux'),
      f('languages', 'Languages, shell & OS', 'pack/languages-shell-and-os'),
      f('concepts', 'Concept line icons', 'icons/workflow-linux'),
      f('services', 'Service icons', 'Linux'),
    ],
  },
  {
    id: 'docker',
    label: 'Docker & containers',
    blurb: 'Images, containers, Dockerfiles, volumes and networks.',
    color: '#2496ED',
    icon: 'lucide-container',
    workflows: ['docker'],
    folders: [
      f('files', 'Files, folders & processes', 'pack/docker-files-folders-and-processes'),
      f('tiles', 'Docker tiles', 'pack/docker'),
      f('images', 'Containers, images & VMs', 'pack/containers-images-and-vms'),
      f('services', 'Service icons', 'Docker & Containers'),
    ],
  },
  {
    id: 'k8s',
    label: 'Kubernetes',
    blurb: 'Cluster components, workloads, manifests, Helm and the service mesh.',
    color: '#326CE5',
    icon: 'lucide-boxes',
    workflows: ['k8s'],
    folders: [
      f('components', 'Components & kubectl', 'pack/kubernetes-components-and-kubectl'),
      f('resources', 'Resources', 'pack/kubernetes-resources'),
      f('files', 'Files, folders & processes', 'pack/kubernetes-files-folders-and-processes'),
      f('helm', 'Helm & Kustomize', 'pack/helm-and-kustomize-files-folders-and-concepts'),
      f('mesh', 'Istio & service mesh', 'pack/istio-and-service-mesh'),
      f('status', 'Pod & platform status', 'pack/kubernetes-and-platform-status'),
      f('tiles', 'Containers & Kubernetes tiles', 'pack/containers-and-kubernetes'),
      f('services', 'Service icons', 'Kubernetes'),
    ],
  },
  {
    id: 'cicd',
    label: 'CI/CD & delivery',
    blurb: 'Pipelines, runners, environments, deployment strategies and the SDLC.',
    color: '#7C3AED',
    icon: 'lucide-rocket',
    workflows: ['jenkins'],
    folders: [
      f('concepts', 'Files, runners & concepts', 'pack/ci-cd-and-gitops-files-runners-and-concepts'),
      f('environments', 'Environments', 'pack/environments'),
      f('release', 'Deployment & release', 'pack/deployment-and-release'),
      f('sdlc', 'SDLC & ops', 'pack/sdlc-and-ops'),
      f('tiles', 'CI/CD & source control tiles', 'pack/ci-cd-and-source-control'),
      f('services', 'Service icons', 'CI/CD & GitOps'),
    ],
  },
  {
    id: 'aws',
    label: 'AWS',
    blurb: 'Services, then compute, storage, databases, networking, identity and security in depth.',
    color: '#FF9900',
    icon: 'lucide-cloud',
    workflows: ['aws'],
    folders: [
      f('services', 'Service icons', 'AWS'),
      f('tiles', 'Service tiles', 'pack/aws'),
      f('ec2', 'EC2', 'pack/aws-ec2-concepts'),
      f('scaling', 'Auto Scaling & load balancing', 'pack/aws-auto-scaling-and-load-balancing'),
      f('s3', 'S3', 'pack/aws-s3-concepts'),
      f('databases', 'RDS, Aurora & DynamoDB', 'pack/aws-rds-aurora-and-dynamodb-concepts'),
      f('vpc', 'VPC & networking', 'pack/aws-vpc-and-network-architecture'),
      f('edge', 'Route 53, CloudFront & edge', 'pack/aws-route-53-cloudfront-and-edge'),
      f('iam', 'IAM & policies', 'pack/aws-iam-and-policies'),
      f('kms', 'ACM, KMS & secrets', 'pack/aws-acm-kms-and-secrets'),
      f('hardening', 'Hardening & security', 'pack/aws-hardening-and-security-architecture'),
      f('eks', 'EKS', 'pack/aws-eks-concepts'),
      f('cli', 'CLI, files & config', 'pack/aws-cli-files-and-config'),
      f('patterns', 'Architecture patterns', 'pack/aws-architecture-patterns-and-well-architected'),
    ],
  },
  {
    id: 'clouds',
    label: 'Azure, Google Cloud & SAP',
    blurb: 'The other clouds: Azure and Google Cloud services, SAP BTP and Kyma.',
    color: '#0078D4',
    icon: 'lucide-cloud-cog',
    workflows: [],
    folders: [
      f('azure', 'Azure services', 'Azure'),
      f('azure-tiles', 'Azure tiles', 'pack/azure'),
      f('gcp', 'Google Cloud services', 'GCP'),
      f('gcp-tiles', 'Google Cloud tiles', 'pack/google-cloud'),
      f('sap', 'SAP BTP & Kyma', 'pack/sap-btp-and-kyma'),
      f('generic', 'Cloud & network', 'Cloud & Network'),
    ],
  },
  {
    id: 'terraform',
    label: 'Terraform & IaC',
    blurb: 'Providers, state, modules and the plan/apply cycle.',
    color: '#7B42BC',
    icon: 'lucide-layers',
    workflows: ['terraform'],
    folders: [
      f('files', 'Files, folders & processes', 'pack/terraform-files-folders-and-processes'),
      f('tiles', 'Terraform tiles', 'pack/terraform'),
      f('iac', 'IaC & config management', 'pack/iac-and-config-management'),
      f('services', 'Infrastructure as Code icons', 'Infrastructure as Code'),
    ],
  },
  {
    id: 'ansible',
    label: 'Ansible',
    blurb: 'Inventory, playbooks, roles, templates and vault.',
    color: '#EE0000',
    icon: 'lucide-settings',
    workflows: ['ansible'],
    folders: [
      f('files', 'Files, folders & processes', 'pack/ansible-files-folders-and-processes'),
      f('tiles', 'Ansible tiles', 'pack/ansible'),
      f('concepts', 'Concept line icons', 'icons/workflow-ansible'),
      f('services', 'Config management icons', 'Config Management'),
    ],
  },
  {
    id: 'network',
    label: 'Networking',
    blurb: 'Addressing, protocols, DNS, routing, NAT, firewalls and devices.',
    color: '#0891B2',
    icon: 'lucide-network',
    workflows: ['network'],
    folders: [
      f('concepts', 'Concepts, messages & daemons', 'pack/networking-concepts-messages-and-daemons'),
      f('protocols', 'Protocols & ports', 'pack/protocols-and-ports'),
      f('tiles', 'Networking tiles', 'pack/networking'),
      f('devices', 'Computers & devices', 'pack/computers-and-devices'),
      f('line', 'Concept line icons', 'icons/workflow-network'),
      f('services', 'Networking icons', 'Networking'),
    ],
  },
  {
    id: 'security',
    label: 'Security',
    blurb: 'Firewalls, keys and certificates, scanners and security testing.',
    color: '#DC2626',
    icon: 'lucide-shield',
    workflows: [],
    folders: [
      f('firewall', 'Firewall & security', 'pack/firewall-and-security'),
      f('files', 'Files, keys & daemons', 'pack/security-files-keys-and-daemons'),
      f('scanning', 'Scanning tools', 'pack/security-and-scanning-tools'),
      f('testing', 'Security testing', 'pack/security-testing'),
      f('services', 'Security & secrets icons', 'Security & Secrets'),
      f('glyphs', 'Security line glyphs', 'pack/glyphs-security'),
    ],
  },
  {
    id: 'data',
    label: 'Databases & storage',
    blurb: 'SQL basics, databases, storage and messaging.',
    color: '#16A34A',
    icon: 'lucide-database',
    workflows: [],
    folders: [
      f('sql', 'SQL & database basics', 'pack/sql-and-database-basics'),
      f('tiles', 'Data & storage tiles', 'pack/data-and-storage'),
      f('services', 'Database, storage & messaging icons', 'Databases, Storage & Messaging'),
    ],
  },
  {
    id: 'observability',
    label: 'Observability',
    blurb: 'Metrics, logs, traces, dashboards and alerting.',
    color: '#0D9488',
    icon: 'lucide-chart-line',
    workflows: [],
    folders: [
      f('alerting', 'Observability & alerting', 'pack/observability-and-alerting'),
      f('files', 'Files, daemons & concepts', 'pack/observability-files-daemons-and-concepts'),
      f('services', 'Monitoring & logging icons', 'Monitoring & Logging'),
    ],
  },
  {
    id: 'testing',
    label: 'Testing & quality',
    blurb: 'Test types, performance and chaos engineering.',
    color: '#DB2777',
    icon: 'lucide-flask-conical',
    workflows: [],
    folders: [
      f('testing', 'Testing', 'pack/testing'),
      f('performance', 'Performance & chaos', 'pack/performance-and-chaos'),
    ],
  },
  {
    id: 'software',
    label: 'Software engineering',
    blurb: 'Practices, design patterns, web and API concepts, data structures.',
    color: '#4F46E5',
    icon: 'lucide-code',
    workflows: [],
    folders: [
      f('practices', 'Engineering practices', 'pack/software-engineering-practices'),
      f('patterns', 'Architecture & design patterns', 'pack/software-architecture-and-design-patterns'),
      f('web', 'Web, API & backend', 'pack/web-api-and-backend-concepts'),
      f('dsa', 'Data structures & algorithms', 'pack/data-structures-and-algorithms'),
      f('internals', 'Teaching concepts & internals', 'Teaching Concepts & Internals'),
    ],
  },
  {
    id: 'status',
    label: 'Status & results',
    blurb: 'Pass/fail, health, progress and status colours.',
    color: '#059669',
    icon: 'lucide-circle-check',
    workflows: [],
    folders: [
      f('results', 'Status & results', 'pack/status-and-results'),
      f('colors', 'Status colours', 'pack/status-colors'),
      f('line', 'Status line icons', 'icons/workflow-status'),
      f('symbols', 'Status symbols', 'icons/status-symbols'),
      f('glyphs', 'Status line glyphs', 'pack/glyphs-status'),
    ],
  },
  {
    id: 'teaching',
    label: 'Teaching & classroom',
    blurb: 'Lesson flow, steps and levels, demos, people and roles.',
    color: '#EA580C',
    icon: 'lucide-graduation-cap',
    workflows: [],
    folders: [
      f('flow', 'Teaching flow, steps & levels', 'pack/teaching-flow-steps-and-levels'),
      f('demo', 'Demo & teaching content', 'pack/demo-and-teaching-content'),
      f('people', 'People & roles', 'pack/people-and-roles'),
      f('education', 'Education icons', 'icons/education'),
      f('collaboration', 'People & collaboration', 'icons/people-collaboration'),
      f('business', 'Business & communication', 'pack/general-business-and-communication'),
      f('office', 'Office & business icons', 'icons/office-business'),
      f('glyphs', 'People & business line glyphs', 'pack/glyphs-people'),
    ],
  },
  {
    id: 'diagrams',
    label: 'Diagramming & general',
    blurb: 'Boundaries, flowcharts, UML, ER, arrows, shapes and everyday icons.',
    color: '#475569',
    icon: 'lucide-shapes',
    workflows: [],
    folders: [
      f('boundaries', 'Architecture boundaries', 'Architecture Boundaries'),
      f('flowchart', 'Flowchart', 'Flowchart'),
      f('uml', 'UML', 'UML'),
      f('er', 'ER diagram', 'ER Diagram'),
      f('arrows', 'Arrows & shapes', 'pack/general-arrows-and-shapes'),
      f('arrow-icons', 'Arrow icons', 'icons/arrows'),
      f('arrow-glyphs', 'Arrow line glyphs', 'pack/glyphs-arrows'),
      f('shape-glyphs', 'Shape line glyphs', 'pack/glyphs-shapes'),
      f('number-glyphs', 'Numbers, labels & symbols', 'pack/glyphs-numbers'),
      f('interface', 'Interface & actions', 'pack/general-interface-and-actions'),
      f('interface-glyphs', 'Interface line glyphs', 'pack/glyphs-interface'),
      f('tech', 'Tech & devices', 'icons/tech-devops'),
      f('tech-glyphs', 'Tech & infrastructure line glyphs', 'pack/glyphs-tech'),
      f('media', 'Media', 'icons/media'),
      f('everyday', 'Everyday & nature', 'pack/general-everyday-and-nature'),
      f('nature', 'Nature & weather', 'icons/nature-weather'),
      f('everyday-glyphs', 'Everyday line glyphs', 'pack/glyphs-everyday'),
      f('math', 'Math & science', 'Math & Science'),
      f('generic', 'Generic shapes', 'Generic'),
    ],
  },
];

export const TOPIC_BY_ID = new Map(LIBRARY_TOPICS.map((t) => [t.id, t]));

// category -> { topicId, folderId }; the first filing wins (the test asserts
// there is never a second one).
const CATEGORY_HOME = new Map();
for (const t of LIBRARY_TOPICS) {
  for (const fo of t.folders) {
    for (const c of fo.categories) {
      if (!CATEGORY_HOME.has(c)) CATEGORY_HOME.set(c, { topicId: t.id, folderId: fo.id });
    }
  }
}

const WORKFLOW_TOPIC = new Map();
for (const t of LIBRARY_TOPICS) for (const w of t.workflows) WORKFLOW_TOPIC.set(w, t.id);

export function classifyCategory(category) {
  return CATEGORY_HOME.get(category) || null;
}

export function matchesLevel(item, level) {
  return !level || (item?.level || 0) === level;
}

export function workflowTopicId(workflow) {
  return WORKFLOW_TOPIC.get(workflow?.topic) || null;
}

// Commands are filed by their own group (lnx*, aws*, k8s, docker, git) —
// their linked teaching icon sometimes lives in a neighbouring topic
// (an AWS security-group command links a generic firewall icon). The mixed
// "iac" group splits on the linked icon: Ansible icons -> Ansible, else
// Terraform. Unknown groups fall back to the linked icon's topic.
const COMMAND_GROUP_TOPIC = [
  [/^lnx/, 'linux'],
  [/^aws/, 'aws'],
  [/^k8s$/, 'k8s'],
  [/^docker$/, 'docker'],
  [/^git$/, 'git'],
];

export function commandTopicId(cmd) {
  const group = String(cmd?.group || '');
  if (group === 'iac') return /^pack\/ansible/.test(cmd?.cat || '') ? 'ansible' : 'terraform';
  for (const [re, id] of COMMAND_GROUP_TOPIC) if (re.test(group)) return id;
  return classifyCategory(cmd?.cat)?.topicId || null;
}

// Stable sort by level (0 = not leveled sorts first, then beginner → expert).
const byLevel = (a, b) => (a.level || 0) - (b.level || 0);

export function buildTopicTree(stencils) {
  const buckets = new Map(); // `${topicId}/${folderId}` -> items
  const unassigned = [];
  for (const s of stencils) {
    const home = classifyCategory(s.category);
    if (!home) {
      unassigned.push(s);
      continue;
    }
    const key = `${home.topicId}/${home.folderId}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  }
  const topics = LIBRARY_TOPICS.map((t) => {
    const folders = t.folders.map((fo) => {
      const items = (buckets.get(`${t.id}/${fo.id}`) || []).slice().sort(byLevel);
      return { id: fo.id, label: fo.label, categories: fo.categories, items };
    });
    return { id: t.id, label: t.label, folders, count: folders.reduce((n, fo) => n + fo.items.length, 0) };
  });
  return { topics, unassigned };
}

// Counts per topic/folder at a level, without loading the pack: static
// stencils are counted directly, pack groups and glyph sets from the index.
export function summarizeTopics({ level = 0 } = {}, { staticStencils = [], workflows = [], packIndex = PACK_INDEX } = {}) {
  const folderCounts = new Map();
  const add = (category, n) => {
    const home = classifyCategory(category);
    if (!home || !n) return;
    const key = `${home.topicId}/${home.folderId}`;
    folderCounts.set(key, (folderCounts.get(key) || 0) + n);
  };
  for (const s of staticStencils) {
    if (String(s.id).startsWith('pk-')) continue; // pack icons are counted from the index
    if (matchesLevel(s, level)) add(s.category, 1);
  }
  for (const g of packIndex.groups || []) add(`pack/${g.slug}`, level ? g.levels?.[level] || 0 : g.count);
  if (!level) for (const g of packIndex.glyphSets || []) add(`pack/${g.slug}`, g.count);

  const commandCounts = new Map();
  for (const [group, cat, lvl, n] of packIndex.commandTally || []) {
    if (level && lvl !== level) continue;
    const id = commandTopicId({ group, cat });
    if (id) commandCounts.set(id, (commandCounts.get(id) || 0) + n);
  }
  const workflowCounts = new Map();
  for (const w of workflows) {
    if (!matchesLevel(w, level)) continue;
    const id = workflowTopicId(w);
    if (id) workflowCounts.set(id, (workflowCounts.get(id) || 0) + 1);
  }

  return LIBRARY_TOPICS.map((t) => {
    const folders = t.folders.map((fo) => ({ id: fo.id, label: fo.label, count: folderCounts.get(`${t.id}/${fo.id}`) || 0 }));
    return {
      id: t.id,
      icons: folders.reduce((n, fo) => n + fo.count, 0),
      commands: commandCounts.get(t.id) || 0,
      workflows: workflowCounts.get(t.id) || 0,
      folders,
    };
  });
}

const tokenize = (q) => String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);

function scoreText(fields, tokens) {
  // fields: [[text, weight], …]; every token must hit at least one field.
  let score = 0;
  for (const t of tokens) {
    let best = 0;
    for (const [text, weight] of fields) {
      const lower = String(text || '').toLowerCase();
      if (!lower.includes(t)) continue;
      const wordHit = lower.split(/[^a-z0-9.+#-]+/).includes(t);
      best = Math.max(best, wordHit ? weight * 2 : weight);
    }
    if (!best) return 0;
    score += best;
  }
  return score;
}

// One search over icons, commands and workflows. Icons come back grouped
// topic › folder in map order (best match first inside a folder); commands
// and workflows as ranked lists. topicId scopes everything to one topic.
export function searchLibrary({ query = '', level = 0, topicId = '' } = {}, { stencils = [], commands = [], workflows = [] } = {}) {
  const tokens = tokenize(query);
  const inTopic = (id) => !topicId || id === topicId;

  const buckets = new Map();
  let iconTotal = 0;
  for (const s of stencils) {
    if (!matchesLevel(s, level)) continue;
    const home = classifyCategory(s.category);
    if (!home || !inTopic(home.topicId)) continue;
    const score = tokens.length ? scoreStencilSearchMatch(s, tokens) : 1;
    if (score <= 0) continue;
    const key = `${home.topicId}/${home.folderId}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ s, score });
    iconTotal += 1;
  }
  const iconGroups = [];
  for (const t of LIBRARY_TOPICS) {
    for (const fo of t.folders) {
      const hits = buckets.get(`${t.id}/${fo.id}`);
      if (!hits) continue;
      hits.sort((a, b) => b.score - a.score || (a.s.level || 0) - (b.s.level || 0));
      iconGroups.push({ topicId: t.id, folderId: fo.id, label: fo.label, items: hits.map((h) => h.s) });
    }
  }

  const rank = (list, fieldsOf, topicOf) =>
    list
      .filter((x) => matchesLevel(x, level) && inTopic(topicOf(x)))
      .map((x) => ({ x, score: tokens.length ? scoreText(fieldsOf(x), tokens) : 1 }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || (a.x.level || 0) - (b.x.level || 0))
      .map((r) => r.x);

  const commandHits = rank(
    commands,
    (c) => [
      [c.title, 30],
      [c.cmd, 20],
      [c.note, 8],
      [c.group, 5],
    ],
    commandTopicId
  );
  const workflowHits = rank(
    workflows,
    (w) => [
      [w.title, 30],
      [w.summary, 10],
      [w.topic, 5],
    ],
    workflowTopicId
  );

  return {
    icons: iconGroups,
    iconTotal,
    commands: commandHits,
    workflows: workflowHits,
    total: iconTotal + commandHits.length + workflowHits.length,
  };
}
