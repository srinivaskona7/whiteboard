// stencils/manifest.js — Bundled Icon Pack Provenance, Upstream Versions & Attribution Manifest

export const ICON_PACK_SOURCES = {
  aws: {
    provider: 'Amazon Web Services',
    name: 'AWS Architecture Icons',
    upstreamUrl: 'https://aws.amazon.com/architecture/icons/',
    version: '2024.07.31',
    license: 'AWS Architecture Icons Trademark Guidelines (Permitted for architecture diagrams)',
    attribution: 'Amazon Web Services, Inc. or its affiliates. Used for architectural diagramming.',
    usageNotes:
      'Use service icons only to represent AWS services, resource icons for AWS resources, and boundary containers for Accounts, Regions, VPCs, and Subnets. Do not alter icon proportions.',
    reviewedAt: '2026-11-03',
  },
  azure: {
    provider: 'Microsoft Azure',
    name: 'Microsoft Azure Architecture Icons',
    upstreamUrl: 'https://learn.microsoft.com/en-us/azure/architecture/icons/',
    version: 'v20 (2024)',
    license: 'Microsoft Architecture Icons Terms of Use (Permitted for architectural diagrams & training)',
    attribution: 'Microsoft Corporation. Used for Azure architecture diagrams.',
    usageNotes:
      'Maintain original aspect ratio, do not crop or flip icons, and pair with clear service labels.',
    reviewedAt: '2026-11-03',
  },
  gcp: {
    provider: 'Google Cloud',
    name: 'Google Cloud Official Icons',
    upstreamUrl: 'https://cloud.google.com/icons',
    version: '2024.Q2',
    license: 'Google Cloud Architecture Diagramming Guidelines',
    attribution: 'Google LLC. Used for Google Cloud architectural diagrams.',
    usageNotes:
      'Preserve 1:1 aspect ratio and official hexagonal/service silhouette with editable text label.',
    reviewedAt: '2026-11-03',
  },
  kubernetes: {
    provider: 'Kubernetes / CNCF',
    name: 'Kubernetes Community Icons',
    upstreamUrl: 'https://github.com/kubernetes/community/tree/main/icons',
    version: 'v1.30.0',
    license: 'CC-BY-4.0 / Apache-2.0',
    attribution: 'The Kubernetes Authors / Linux Foundation (CNCF).',
    usageNotes:
      'Use Kubernetes heptagon badge and resource symbols (pod, deploy, sts, ds, svc, ing, cm, secret, pvc, hpa) with standard abbreviations.',
    reviewedAt: '2026-11-03',
  },
  cncf: {
    provider: 'Cloud Native Computing Foundation',
    name: 'CNCF Project Artwork',
    upstreamUrl: 'https://github.com/cncf/artwork',
    version: '2024.08',
    license: 'CNCF Trademark & Artwork Guidelines',
    attribution: 'The Linux Foundation / Cloud Native Computing Foundation.',
    usageNotes:
      'Covers Prometheus, Envoy/Istio, Helm, Argo, Flux, OpenTelemetry, Falco, Cilium, etcd, containerd, Rook/Ceph, and NATS.',
    reviewedAt: '2026-11-03',
  },
  devicon: {
    provider: 'Devicon Open Source',
    name: 'Devicon Development & DevOps Tool Icons',
    upstreamUrl: 'https://github.com/devicons/devicon',
    version: 'v2.16.0',
    license: 'MIT License (SVG artwork) / Respective brand trademarks',
    attribution: 'Devicon contributors (https://devicon.dev).',
    usageNotes:
      'Covers Linux distributions (Ubuntu, RHEL, Debian, Alpine), Docker, Git, GitHub Actions, GitLab CI, Jenkins, Terraform, OpenTofu, Ansible, Grafana, Vault, Trivy, PostgreSQL, Redis, Kafka, and RabbitMQ.',
    reviewedAt: '2026-11-03',
  },
  lucide: {
    provider: 'Lucide',
    name: 'Lucide General-Purpose Icon Set',
    upstreamUrl: 'https://github.com/lucide-icons/lucide',
    version: '1.68.0 (lucide-static)',
    license: 'ISC License',
    attribution: 'Lucide Contributors (https://lucide.dev).',
    usageNotes:
      'General-purpose 24x24 stroke icons (education, office, media, arrows, status). Safe for any diagram context; recolour freely — the set has no brand restrictions.',
    reviewedAt: '2026-11-04',
  },
  iconpack: {
    provider: 'DevOps, Cloud & Teaching Icon Pack (user-supplied)',
    name: 'DevOps, Cloud, Networking & Teaching Icon Pack',
    upstreamUrl: 'local://~/Downloads/aws-keys/icons.js (offline pack)',
    version: '2 (2015 icons, 38 groups)',
    license: 'Unstated by the pack author — user-supplied, internal use',
    attribution: 'Anonymous pack author; SVG markup baked in verbatim with per-icon defs namespacing.',
    usageNotes:
      'Full-colour 64x64 icons (gradients, clip paths, text labels) covering AWS, Azure, GCP, Kubernetes, Istio, Docker, Ansible, Terraform, Linux, networking, testing and teaching sets. Overlaps exist with the curated stencil packs (e.g. pk-aws-amazon-ec2 vs aws-ec2) by design — both stay available; the curated pack renders as geometry, this pack renders as rasterized SVG. Canvas rasterizes via Image + data URL; exports embed the markup directly.',
    reviewedAt: '2026-11-04',
  },
  concepts: {
    provider: 'StudioBoard Teaching Symbol Set',
    name: 'Generic Systems & Networking Teaching Concepts',
    upstreamUrl: 'local://stencils/concepts.js',
    version: '2.0.0',
    generation: 'current',
    license: 'MIT License (First-party educational artwork)',
    attribution: 'StudioBoard Educational Vector Pack',
    usageNotes:
      'Vendor-neutral conceptual diagrams for OS processes, sockets, packets, disks, routers, firewalls, DNS, TLS, and Linux kernel/user space.',
    reviewedAt: '2026-11-03',
  },
  legacy: {
    provider: 'StudioBoard Legacy Primitives',
    name: 'StudioBoard v1 Legacy Diagram Stencils',
    upstreamUrl: 'local://stencils/legacy',
    version: '1.0.0-legacy',
    generation: 'legacy',
    license: 'MIT License',
    attribution: 'StudioBoard Legacy Vector Primitives',
    usageNotes:
      'Retained for backward compatibility with v1 documents. Prefer Current Official Cloud, Kubernetes, CNCF, and Devicon packs for new architecture diagrams.',
    reviewedAt: '2026-11-03',
  },
};

const LEGACY_CATEGORIES = new Set(['Cloud', 'Kubernetes', 'Network', 'Flowchart', 'UML', 'ER', 'Classroom & Math']);

export function computeStencilAssetHash(stencil = {}) {
  const svgSample =
    typeof stencil.toSvg === 'function'
      ? stencil.toSvg(0, 0, stencil.defaultW || 130, stencil.defaultH || 104, '')
      : '';
  const payload = `${stencil.id || ''}|${stencil.name || ''}|${stencil.category || ''}|${svgSample}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv1a_${(h >>> 0).toString(16).padStart(8, '0')}`;
}

export function inferCollectionGroup(stencil = {}) {
  const id = String(stencil.id || '');
  const cat = String(stencil.category || '');
  if (stencil.isBoundary || id.startsWith('bnd-') || cat === 'Architecture Boundaries') {
    return 'boundaries';
  }
  if (id.startsWith('aws-') || id.startsWith('az-') || id.startsWith('gcp-') || cat.includes('Cloud —')) {
    return 'cloud-icons';
  }
  if (id.startsWith('k8s-') || cat.includes('Kubernetes')) {
    return 'kubernetes-symbols';
  }
  if (id.startsWith('concept-') || cat.includes('Teaching Concepts')) {
    return 'teaching-illustrations';
  }
  if (id.startsWith('linux-') || id.startsWith('net-') || cat.includes('Linux') || cat.includes('Networking')) {
    return 'networking-linux';
  }
  if (LEGACY_CATEGORIES.has(cat)) {
    return 'diagram-primitives';
  }
  return 'devops-logos';
}

export function inferIconPackKey(stencil = {}) {
  const id = String(stencil.id || '');
  const cat = String(stencil.category || '');
  if (LEGACY_CATEGORIES.has(cat) && !stencil.isCard && !stencil.isBoundary) {
    return 'legacy';
  }
  if (id.startsWith('aws-') || cat.includes('AWS')) return 'aws';
  if (id.startsWith('az-') || cat.includes('Azure')) return 'azure';
  if (id.startsWith('gcp-') || cat.includes('GCP')) return 'gcp';
  if (id.startsWith('k8s-') || id.startsWith('k8s') || cat.includes('Kubernetes')) return 'kubernetes';
  if (id.startsWith('concept-') || cat.includes('Teaching Concepts')) return 'concepts';
  if (id.startsWith('lucide-') || cat.startsWith('icons/')) return 'lucide';
  if (id.startsWith('pk-') || cat.startsWith('pack/')) return 'iconpack';
  if (
    /^(cicd-argocd|cicd-flux|cicd-tekton|cnt-helm|cnt-containerd|obs-prometheus|obs-otel|obs-jaeger|obs-fluent|sec-opa|sec-falco|sec-certmgr|db-nats|db-ceph)/.test(
      id
    )
  ) {
    return 'cncf';
  }
  return 'devicon';
}

export function getIconProvenance(stencil) {
  if (!stencil) return ICON_PACK_SOURCES.concepts;
  const key = stencil.packKey || inferIconPackKey(stencil);
  const pack = ICON_PACK_SOURCES[key] || ICON_PACK_SOURCES.devicon;
  const isLegacy = Boolean(key === 'legacy' || LEGACY_CATEGORIES.has(stencil.category));
  const defaultWidth = Number(stencil.defaultW) || (stencil.isBoundary ? 380 : stencil.isCard ? 130 : 140);
  const defaultHeight = Number(stencil.defaultH) || (stencil.isBoundary ? 240 : stencil.isCard ? 104 : 90);
  const rawTags = String(stencil.tags || '')
    .split(/\s+/)
    .filter(Boolean);

  return {
    stencilId: stencil.id,
    name: stencil.name,
    iconKind: stencil.isBoundary ? 'boundary' : stencil.iconKind || (isLegacy ? 'legacy-primitive' : 'service'),
    collection: inferCollectionGroup(stencil),
    packKey: key,
    provider: pack.provider,
    upstreamSource: pack.upstreamUrl,
    version: pack.version,
    generation: isLegacy ? 'legacy' : pack.generation || 'current',
    isLegacy,
    license: pack.license,
    reviewedAt: pack.reviewedAt || null,
    attribution: pack.attribution,
    usageNotes: pack.usageNotes,
    usageRequirements: pack.usageNotes,
    tags: rawTags,
    aliases: stencil.badge ? [String(stencil.badge).toLowerCase()] : [],
    dimensions: {
      defaultWidth,
      defaultHeight,
      aspectRatio: Number((defaultWidth / defaultHeight).toFixed(3)),
    },
    assetHash: computeStencilAssetHash(stencil),
    preservesAspectRatio: true,
  };
}

/** Teaching metadata: what it is, its role, and a safe interaction example. */
export function describeIcon(stencil) {
  if (!stencil) return null;
  const provenance = getIconProvenance(stencil);
  const kind = provenance.iconKind;
  const isConcept = provenance.collection === 'teaching-illustrations';
  const what = isConcept
    ? `${stencil.name} is a conceptual systems symbol, not a provider service.`
    : `${stencil.name} represents the ${provenance.provider} service in an architecture diagram.`;
  const role = stencil.defaultText
    ? `the labelled component "${stencil.defaultText}"`
    : kind === 'boundary'
      ? 'groups and scopes the components inside it'
      : 'a component in the drawn flow';
  const example = isConcept
    ? 'an arrow into or out of this symbol shows a local process or data path'
    : 'connect it with an arrow to show a request, event or data dependency';
  return {
    whatItIs: what,
    roleHere: role,
    exampleInteraction: example,
    source: {
      provider: provenance.provider,
      version: provenance.version,
      license: provenance.license,
      attribution: provenance.attribution,
      reviewedAt: provenance.reviewedAt,
    },
  };
}
