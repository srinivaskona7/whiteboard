// stencils/index.js
import { DEVOPS_CLOUD_STENCILS } from './devops-cloud.js';
import { DEVOPS_INFRA_STENCILS } from './devops-infra.js';
import { DEVOPS_CICD_STENCILS } from './devops-cicd.js';
import { DEVOPS_DATA_SEC_STENCILS } from './devops-data-sec.js';
import { ARCHITECTURE_BOUNDARY_STENCILS, TEACHING_CONCEPT_STENCILS } from './concepts.js';
import { FLOWCHART_STENCILS } from './flowchart.js';
import { CLOUD_STENCILS } from './cloud.js';
import { KUBERNETES_STENCILS } from './kubernetes.js';
import { NETWORK_STENCILS } from './network.js';
import { UML_STENCILS } from './uml.js';
import { ER_STENCILS } from './er.js';
import { GENERIC_STENCILS } from './generic.js';
import { ICON_PACK_SOURCES, getIconProvenance, describeIcon } from './manifest.js';

export { ICON_PACK_SOURCES, getIconProvenance, describeIcon };

export const SEARCH_ALIASES = {
  ec2: ['aws-ec2', 'cloud-vm'],
  aks: ['az-aks'],
  gke: ['gcp-gke'],
  eks: ['aws-eks'],
  s3: ['aws-s3', 'cloud-bucket', 'db-minio'],
  rds: ['aws-rds', 'cloud-db'],
  vpc: ['bnd-aws-vpc', 'aws-vpc', 'gcp-vpc', 'bnd-gcp-vpc'],
  vnet: ['bnd-azure-vnet', 'az-vnet'],
  lb: ['aws-alb', 'az-appgw', 'gcp-lb', 'net-lb'],
  alb: ['aws-alb', 'net-lb'],
  nlb: ['aws-alb', 'net-lb'],
  sg: ['sec-sg', 'bnd-sec-zone'],
  waf: ['sec-waf', 'az-appgw'],
  pvc: ['k8s-pvc', 'k8s-vol'],
  pv: ['k8s-pvc', 'k8s-vol'],
  dns: ['net-dns', 'aws-route53', 'concept-dns'],
  r53: ['aws-route53'],
  iam: ['aws-iam', 'gcp-iam', 'az-entra'],
  k8s: ['bnd-k8s-cluster', 'k8s-cluster', 'k8s-pod', 'k8s-deploy', 'k8s-svc'],
  pod: ['k8s-pod'],
  svc: ['k8s-svc'],
  ing: ['k8s-ingress', 'net-ingress'],
  cm: ['k8s-cm'],
  sts: ['k8s-sts'],
  ds: ['k8s-ds'],
  hpa: ['k8s-hpa'],
  ns: ['bnd-k8s-ns', 'k8s-ns'],
  az: ['bnd-aws-az'],
  tf: ['iac-terraform'],
  tofu: ['iac-opentofu'],
  gha: ['cicd-gha'],
  ci: ['cicd-gha', 'cicd-gitlabci', 'cicd-jenkins'],
  cd: ['cicd-argocd', 'cicd-flux', 'cicd-tekton'],
  otel: ['obs-otel'],
  pg: ['db-postgres'],
  pgsql: ['db-postgres'],
  mq: ['db-rabbitmq', 'db-kafka', 'aws-sqs'],
  tls: ['concept-tls', 'sec-tls', 'sec-certmgr'],
};

export const ALL_STENCILS = [
  ...ARCHITECTURE_BOUNDARY_STENCILS,
  ...DEVOPS_CLOUD_STENCILS,
  ...DEVOPS_INFRA_STENCILS,
  ...DEVOPS_CICD_STENCILS,
  ...DEVOPS_DATA_SEC_STENCILS,
  ...TEACHING_CONCEPT_STENCILS,
  ...FLOWCHART_STENCILS,
  ...UML_STENCILS,
  ...ER_STENCILS,
  ...GENERIC_STENCILS,
  ...CLOUD_STENCILS,
  ...KUBERNETES_STENCILS,
  ...NETWORK_STENCILS,
];

const STENCIL_MAP = new Map(ALL_STENCILS.map((s) => [s.id, s]));

export function getStencilById(id) {
  return STENCIL_MAP.get(id) || ALL_STENCILS[0];
}

export function getAllCategories() {
  const seen = new Set();
  for (const s of ALL_STENCILS) seen.add(s.category);
  return Array.from(seen);
}

export function scoreStencilSearchMatch(stencil, rawTokens) {
  if (!rawTokens || rawTokens.length === 0) return 1;
  const idLower = stencil.id.toLowerCase();
  const nameLower = stencil.name.toLowerCase();
  const badgeLower = (stencil.badge || '').toLowerCase();
  const hay = `${idLower} ${nameLower} ${badgeLower} ${stencil.category.toLowerCase()} ${stencil.tags || ''}`;

  let score = 0;
  for (const t of rawTokens) {
    const aliasTargets = SEARCH_ALIASES[t] || [];
    if (aliasTargets.includes(stencil.id)) {
      score += 50;
      continue;
    }
    if (idLower === t || badgeLower === t || idLower.endsWith(`-${t}`)) {
      score += 40;
      continue;
    }
    if (nameLower.split(/[\s/()-]+/).includes(t)) {
      score += 25;
      continue;
    }
    if (hay.includes(t)) {
      score += 10;
      continue;
    }
    return 0; // All tokens must match either via alias or hay
  }
  return score;
}

export function getStencilsByCategory(arg1 = 'all', arg2 = '') {
  const allCats = getAllCategories();
  const isCategoryName = (val) => {
    if (!val || val === 'all') return false;
    return allCats.some((c) => c === val || c.toLowerCase().endsWith(`— ${val.toLowerCase()}`));
  };

  let category = 'all';
  let searchQuery = '';

  if (arg1 === 'all' || arg1 === '') {
    if (isCategoryName(arg2)) {
      category = arg2;
    } else {
      searchQuery = arg2 || '';
    }
  } else if (isCategoryName(arg1)) {
    category = arg1;
    searchQuery = arg2 || '';
  } else {
    searchQuery = arg1 || '';
    if (isCategoryName(arg2)) category = arg2;
  }

  const q = searchQuery.trim().toLowerCase();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const groups = new Map();

  const matched = [];
  for (const s of ALL_STENCILS) {
    if (category !== 'all') {
      const catMatch =
        s.category === category ||
        s.category.toLowerCase().endsWith(`— ${category.toLowerCase()}`);
      if (!catMatch) continue;
    }
    const score = scoreStencilSearchMatch(s, tokens);
    if (score <= 0) continue;
    matched.push({ s, score });
  }

  if (tokens.length > 0) {
    matched.sort((a, b) => b.score - a.score);
  }

  for (const { s } of matched) {
    const outCat =
      category !== 'all' && s.category.toLowerCase().endsWith(`— ${category.toLowerCase()}`) && category !== s.category
        ? category
        : s.category;
    if (!groups.has(outCat)) {
      groups.set(outCat, []);
    }
    groups.get(outCat).push(s);
  }
  return Array.from(groups.entries()).map(([cat, items]) => ({ category: cat, items }));
}
