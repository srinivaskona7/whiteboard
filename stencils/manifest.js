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
  },
  concepts: {
    provider: 'StudioBoard Teaching Symbol Set',
    name: 'Generic Systems & Networking Teaching Concepts',
    upstreamUrl: 'local://stencils/concepts.js',
    version: '2.0.0',
    license: 'MIT License (First-party educational artwork)',
    attribution: 'StudioBoard Educational Vector Pack',
    usageNotes:
      'Vendor-neutral conceptual diagrams for OS processes, sockets, packets, disks, routers, firewalls, DNS, TLS, and Linux kernel/user space.',
  },
};

export function inferIconPackKey(stencil = {}) {
  const id = String(stencil.id || '');
  const cat = String(stencil.category || '');
  if (id.startsWith('aws-') || cat.includes('AWS')) return 'aws';
  if (id.startsWith('az-') || cat.includes('Azure')) return 'azure';
  if (id.startsWith('gcp-') || cat.includes('GCP')) return 'gcp';
  if (id.startsWith('k8s-') || id.startsWith('k8s') || cat.includes('Kubernetes')) return 'kubernetes';
  if (id.startsWith('concept-') || cat.includes('Teaching Concepts')) return 'concepts';
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
  return {
    stencilId: stencil.id,
    name: stencil.name,
    iconKind: stencil.isBoundary ? 'boundary' : stencil.iconKind || 'service',
    packKey: key,
    provider: pack.provider,
    upstreamSource: pack.upstreamUrl,
    version: pack.version,
    license: pack.license,
    attribution: pack.attribution,
    usageNotes: pack.usageNotes,
    preservesAspectRatio: true,
  };
}
