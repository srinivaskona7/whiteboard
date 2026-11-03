// scene/architecture-config.js — typed diagram configuration without a deployment engine.
// A pattern declares parameters, constraints and a render binding. Applying a
// configuration mutates the existing graph atomically and preserves stable ids
// and manual positions unless a relayout is explicitly requested.
import { createElement, handleAnchorDeletion, autoGrowShapeForText } from './model.js';
import { bindConnectorEndpoint } from './bindings.js';

export const CONFIG_LABEL = 'Diagram configuration';

const ENVIRONMENTS = ['dev', 'test', 'prod'];
const AZ_REGIONS = ['westeurope', 'northeurope', 'eastus', 'eastus2'];
const GCP_REGIONS = ['europe-west1', 'europe-west2', 'us-central1', 'us-east1'];
const AWS_REGIONS = ['eu-west-1', 'eu-central-1', 'us-east-1', 'us-west-2'];

const select = (id, label, choices, def, help = '') => ({
  id, label, type: 'select', choices, default: def, help,
});
const number = (id, label, def, min, max, help = '') => ({
  id, label, type: 'number', default: def, min, max, help,
});
const bool = (id, label, def, help = '') => ({ id, label, type: 'boolean', default: def, help });
const text = (id, label, def, help = '') => ({ id, label, type: 'text', default: def, help });

const regionChoice = (provider) => {
  if (provider === 'GCP') return { choices: GCP_REGIONS, def: 'europe-west1' };
  if (provider === 'AWS') return { choices: AWS_REGIONS, def: 'eu-west-1' };
  return { choices: AZ_REGIONS, def: 'westeurope' };
};

const commonParams = (provider) => {
  const region = regionChoice(provider);
  return [
    select('variant', 'Variant', ['standard', 'high-availability'], 'standard', 'Changes which managed services are bound.'),
    select('environment', 'Environment', ENVIRONMENTS, 'prod'),
    select('region', 'Region', region.choices, region.def),
    number('replicas', 'Application replicas', 2, 1, 10),
    bool('identity', 'Managed identity / workload identity', true),
    bool('observability', 'Monitoring and logging', true),
    bool('cache', 'Cache tier', false),
    bool('queue', 'Queue / event tier', false),
    bool('recovery', 'Secondary region recovery', false),
    select('connectivity', 'Connectivity', ['public', 'private-endpoint', 'hybrid'], 'private-endpoint'),
    text('namePrefix', 'Resource name prefix', 'classroom'),
    text('cidr', 'VNet / subnet CIDR', '10.0.0.0/16', 'Private address range for the application subnet.'),
    text('port', 'Application port', '443'),
    select('releaseStrategy', 'Release strategy', ['rolling', 'blue-green', 'canary'], 'rolling'),
    bool('showExplanation', 'Show teaching explanation on the board', true),
    select('detail', 'Diagram detail', ['overview', 'internals'], 'overview'),
  ];
};

const baseValidate = (values) => {
  const errors = {};
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = 'Port must be a whole number between 1 and 65535.';
  const replicas = Number(values.replicas);
  if (!Number.isInteger(replicas) || replicas < 1 || replicas > 10) errors.replicas = 'Replicas must be between 1 and 10.';
  if (values.environment === 'prod' && replicas < 2) errors.replicas = 'Production needs at least 2 replicas.';
  if (values.recovery && values.environment !== 'prod') errors.recovery = 'Secondary-region recovery is only allowed in production.';
  if (values.variant === 'high-availability' && replicas < 2) errors.replicas = 'High availability needs at least 2 replicas.';
  if (values.connectivity === 'private-endpoint' && values.environment === 'dev') {
    errors.connectivity = 'Private endpoints are not offered in the dev variant; choose public or hybrid.';
  }
  if (!/^[a-z][a-z0-9-]{1,20}$/.test(String(values.namePrefix || ''))) {
    errors.namePrefix = 'Prefix must start with a letter and contain only lowercase letters, digits and dashes.';
  }
  // IPv4 CIDR with a /16–/28 prefix: wide enough for a teaching subnet, narrow
  // enough that the diagram's addressing story stays honest.
  const cidr = String(values.cidr || '').trim();
  const cidrMatch = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(cidr);
  const octetOk = cidrMatch && cidrMatch.slice(1, 5).every((o) => Number(o) >= 0 && Number(o) <= 255);
  const prefix = cidrMatch ? Number(cidrMatch[5]) : NaN;
  if (!cidrMatch || !octetOk || !Number.isInteger(prefix) || prefix < 16 || prefix > 28) {
    errors.cidr = 'CIDR must look like 10.0.0.0/16 with a prefix between /16 and /28.';
  }
  return errors;
};

const node = (key, x, y, stencilId, text, group = null) => ({ key, x, y, stencilId, text, group });
const edge = (from, to, label = '', fromPort = 'right', toPort = 'left') => ({ from, to, label, fromPort, toPort });
const dataPathLabel = (values) => `1433 ${values.connectivity === 'public' ? 'public' : 'private'}`;

// The entry path is the one edge every pattern draws, so connectivity is
// labelled there. Leaving it unread made the drawer offer a control that did
// nothing on AKS and GKE.
const connectivityLabel = (values) =>
  values.connectivity === 'public'
    ? 'public'
    : values.connectivity === 'hybrid'
      ? 'hybrid ExpressRoute'
      : 'private endpoint';

/**
 * Apply variant/detail/CIDR to a generated graph. Keeping this in one place
 * means every pattern reacts the same way to the same parameters instead of
 * each generator quietly ignoring them.
 */
function augmentGraph(nodes, edges, values) {
  const applied = [];
  const host =
    nodes.find((n) => ['app', 'api', 'mig'].includes(n.key)) ||
    nodes.find((n) => n.stencilId && n.stencilId !== 'cloud-generic');
  if (values.cidr) {
    const boundary = nodes.find((n) => ['entry', 'ingress', 'lb'].includes(n.key));
    if (boundary) boundary.text = `${boundary.text} · ${values.cidr}`;
    applied.push('CIDR');
  }
  if (values.variant === 'high-availability' && host) {
    const key = `${host.key}-z2`;
    nodes.push(node(key, host.x, host.y + 150, host.stencilId, `${host.text} · zone 2`, host.group));
    edges.push(edge(host.key, key, 'zone-redundant'));
    applied.push('high availability');
  }
  if (values.detail === 'internals' && host) {
    const ix = host.x + 230;
    const iy = host.y + 250;
    nodes.push(node('internals-process', ix, iy, 'concept-process', 'Process / thread'));
    nodes.push(node('internals-socket', ix + 190, iy, 'concept-socket', 'Listening socket'));
    nodes.push(node('internals-kernel', ix, iy + 120, 'concept-kernel-user', 'Syscall boundary'));
    edges.push(edge(host.key, 'internals-process', 'runs', 'bottom', 'top'));
    edges.push(edge(host.key, 'internals-socket', 'accepts', 'bottom', 'top'));
    edges.push(edge(host.key, 'internals-kernel', 'syscalls', 'bottom', 'top'));
    applied.push('internals');
  }
  return applied;
}

function azureThreeTier(values) {
  const prefix = values.namePrefix;
  const nodes = [
    node('client', 40, 130, 'cloud-generic', 'Client browsers'),
    node('entry', 260, 130, 'az-appgw', `${prefix}-appgw`),
    node('app', 480, 130, 'az-vm', `${prefix}-app (${values.replicas})`),
    node('data', 700, 130, 'az-sql', `${prefix}-sql`),
  ];
  const edges = [
    edge('client', 'entry', `HTTPS ${values.port}`),
    edge('entry', 'app', 'backend pool'),
    edge('app', 'data', dataPathLabel(values)),
  ];
  if (values.identity) {
    nodes.push(node('identity', 700, 330, 'az-entra', `${prefix}-identity`));
    edges.push(edge('app', 'identity', 'managed identity'));
  }
  if (values.cache) {
    nodes.push(node('cache', 480, 330, 'flow-database', `${prefix}-cache`));
    edges.push(edge('app', 'cache', 'read-through'));
  }
  if (values.queue) {
    nodes.push(node('queue', 260, 330, 'az-servicebus', `${prefix}-queue`));
    edges.push(edge('app', 'queue', 'enqueue'));
  }
  if (values.observability) {
    nodes.push(node('monitor', 700, 470, 'az-monitor', `${prefix}-monitor`));
    edges.push(edge('app', 'monitor', 'traces & metrics'));
  }
  if (values.recovery) {
    nodes.push(node('secondary', 480, 470, 'az-vm', `${prefix}-secondary`));
    edges.push(edge('data', 'secondary', 'geo-replica'));
  }
  if (values.connectivity === 'hybrid') {
    nodes.push(node('onprem', 40, 330, 'cloud-vm', 'On-premises'));
    edges.push(edge('onprem', 'entry', 'ExpressRoute'));
  }
  return { nodes, edges };
}

function azureAks(values) {
  const prefix = values.namePrefix;
  const nodes = [
    node('client', 40, 130, 'cloud-generic', 'Client applications'),
    node('ingress', 260, 130, 'az-appgw', `${prefix}-ingress`),
    node('cluster', 480, 130, 'az-aks', `${prefix}-aks`),
    node('api', 480, 330, 'flow-process', `api x${values.replicas}`),
    node('worker', 700, 330, 'flow-process', 'worker'),
  ];
  const edges = [
    edge('client', 'ingress', `HTTPS ${values.port} · ${connectivityLabel(values)}`),
    edge('ingress', 'cluster', 'ingress route'),
    edge('cluster', 'api', 'deployment'),
    edge('api', 'worker', 'async job'),
  ];
  if (values.cache) {
    nodes.push(node('cache', 700, 130, 'flow-database', `${prefix}-cache`));
    edges.push(edge('api', 'cache', 'cache hit'));
  }
  if (values.queue) {
    nodes.push(node('queue', 480, 500, 'az-servicebus', `${prefix}-queue`));
    edges.push(edge('worker', 'queue', 'publish'));
  }
  if (values.observability) {
    nodes.push(node('monitor', 900, 330, 'az-monitor', `${prefix}-monitor`));
    edges.push(edge('api', 'monitor', 'telemetry'));
  }
  if (values.recovery) {
    nodes.push(node('secondary', 900, 130, 'az-aks', `${prefix}-aks-dr`));
    edges.push(edge('cluster', 'secondary', 'paired region'));
  }
  return { nodes, edges };
}

function gcpCompute(values) {
  const prefix = values.namePrefix;
  const nodes = [
    node('client', 40, 130, 'cloud-generic', 'Internet user'),
    node('lb', 260, 130, 'gcp-lb', `${prefix}-alb`),
    node('mig', 480, 130, 'gcp-gce', `${prefix}-mig (${values.replicas})`),
    node('sql', 700, 130, 'gcp-cloudsql', `${prefix}-sql`),
  ];
  const edges = [
    edge('client', 'lb', `HTTPS ${values.port}`),
    edge('lb', 'mig', 'backend service'),
    edge('mig', 'sql', values.connectivity === 'public' ? 'public IP' : `private IP · ${values.cidr}`),
  ];
  if (values.identity) {
    nodes.push(node('identity', 700, 330, 'gcp-iam', `${prefix}-service-account`));
    edges.push(edge('mig', 'identity', 'workload identity'));
  }
  if (values.cache) {
    nodes.push(node('cache', 480, 330, 'flow-database', `${prefix}-cache`));
    edges.push(edge('mig', 'cache', 'read-through'));
  }
  if (values.queue) {
    nodes.push(node('queue', 260, 330, 'gcp-pubsub', `${prefix}-topic`));
    edges.push(edge('mig', 'queue', 'publish'));
  }
  if (values.observability) {
    nodes.push(node('monitor', 700, 470, 'gcp-monitoring', `${prefix}-monitoring`));
    edges.push(edge('mig', 'monitor', 'agent metrics'));
  }
  if (values.recovery) {
    nodes.push(node('secondary', 480, 470, 'gcp-gce', `${prefix}-dr`));
    edges.push(edge('sql', 'secondary', 'cross-region replica'));
  }
  return { nodes, edges };
}

function gcpGke(values) {
  const prefix = values.namePrefix;
  const nodes = [
    node('client', 40, 130, 'cloud-generic', 'Clients'),
    node('lb', 260, 130, 'gcp-lb', `${prefix}-lb`),
    node('cluster', 480, 130, 'gcp-gke', `${prefix}-gke`),
    node('api', 480, 330, 'flow-process', `api x${values.replicas}`),
    node('worker', 700, 330, 'flow-process', 'worker'),
  ];
  const edges = [
    edge('client', 'lb', `HTTPS ${values.port} · ${connectivityLabel(values)}`),
    edge('lb', 'cluster', 'ingress'),
    edge('cluster', 'api', 'deployment'),
    edge('api', 'worker', 'job'),
  ];
  if (values.queue) {
    nodes.push(node('queue', 480, 500, 'gcp-pubsub', `${prefix}-topic`));
    edges.push(edge('worker', 'queue', 'publish'));
  }
  if (values.identity) {
    nodes.push(node('identity', 900, 330, 'gcp-iam', `${prefix}-ksa`));
    edges.push(edge('api', 'identity', 'workload identity'));
  }
  if (values.cache) {
    nodes.push(node('cache', 700, 130, 'flow-database', `${prefix}-cache`));
    edges.push(edge('api', 'cache', 'cache hit'));
  }
  if (values.observability) {
    nodes.push(node('monitor', 900, 130, 'gcp-monitoring', `${prefix}-monitoring`));
    edges.push(edge('cluster', 'monitor', 'logs + metrics'));
  }
  if (values.recovery) {
    nodes.push(node('secondary', 900, 500, 'gcp-gke', `${prefix}-gke-dr`));
    edges.push(edge('cluster', 'secondary', 'regional failover', 'bottom', 'top'));
  }
  return { nodes, edges };
}

function awsThreeTier(values) {
  const prefix = values.namePrefix;
  const nodes = [
    node('client', 40, 130, 'cloud-generic', 'Internet user'),
    node('dns', 240, 130, 'aws-route53', `${prefix}-zone`),
    node('entry', 450, 130, 'aws-alb', `${prefix}-alb`),
    node('app', 660, 130, 'aws-ec2', `${prefix}-app (${values.replicas})`),
    node('data', 870, 130, 'aws-rds', `${prefix}-aurora`),
  ];
  const edges = [
    edge('client', 'dns', 'resolve'),
    edge('dns', 'entry', 'alias record'),
    edge('entry', 'app', `target group :${values.port}`),
    edge('app', 'data', dataPathLabel(values)),
  ];
  if (values.identity) {
    nodes.push(node('identity', 660, 330, 'aws-iam', `${prefix}-task-role`));
    edges.push(edge('app', 'identity', 'task role'));
  }
  if (values.cache) {
    nodes.push(node('cache', 450, 330, 'aws-elasticache', `${prefix}-cache`));
    edges.push(edge('app', 'cache', 'read-through'));
  }
  if (values.queue) {
    nodes.push(node('queue', 240, 330, 'aws-sqs', `${prefix}-queue`));
    edges.push(edge('app', 'queue', 'enqueue'));
  }
  if (values.observability) {
    nodes.push(node('monitor', 870, 330, 'aws-cloudwatch', `${prefix}-monitor`));
    edges.push(edge('app', 'monitor', 'metrics + logs'));
  }
  if (values.recovery) {
    nodes.push(node('secondary', 660, 470, 'aws-rds', `${prefix}-aurora-replica`));
    edges.push(edge('data', 'secondary', 'cross-region replica'));
  }
  if (values.connectivity === 'hybrid') {
    nodes.push(node('onprem', 40, 330, 'cloud-vm', 'On-premises'));
    edges.push(edge('onprem', 'entry', 'Direct Connect'));
  }
  return { nodes, edges };
}

function awsServerless(values) {
  const prefix = values.namePrefix;
  const nodes = [
    node('client', 40, 130, 'cloud-generic', 'Client application'),
    node('entry', 240, 130, 'aws-apigw', `${prefix}-api`),
    node('app', 450, 130, 'aws-lambda', `${prefix}-fn (${values.replicas})`),
    node('data', 660, 130, 'aws-dynamodb', `${prefix}-table`),
  ];
  const edges = [
    edge('client', 'entry', `HTTPS ${values.port}`),
    edge('entry', 'app', 'invoke'),
    edge('app', 'data', values.connectivity === 'public' ? 'public endpoint' : 'private endpoint'),
  ];
  if (values.queue) {
    nodes.push(node('queue', 450, 330, 'aws-sqs', `${prefix}-jobs`));
    nodes.push(node('worker', 660, 330, 'aws-lambda', `${prefix}-worker`));
    edges.push(edge('app', 'queue', 'enqueue'));
    edges.push(edge('queue', 'worker', 'poll'));
  }
  if (values.cache) {
    nodes.push(node('cache', 660, 470, 'aws-elasticache', `${prefix}-cache`));
    edges.push(edge('app', 'cache', 'read-through'));
  }
  if (values.identity) {
    nodes.push(node('identity', 240, 330, 'aws-iam', `${prefix}-exec-role`));
    edges.push(edge('app', 'identity', 'execution role'));
  }
  if (values.observability) {
    nodes.push(node('monitor', 870, 330, 'aws-cloudwatch', `${prefix}-monitor`));
    edges.push(edge('app', 'monitor', 'logs + traces'));
  }
  if (values.recovery) {
    nodes.push(node('secondary', 870, 470, 'aws-dynamodb', `${prefix}-global-table`));
    edges.push(edge('data', 'secondary', 'global table replica'));
  }
  return { nodes, edges };
}

function azureMultiRegion(values) {
  const prefix = values.namePrefix;
  const nodes = [
    node('client', 40, 130, 'cloud-generic', 'Users'),
    node('entry', 240, 130, 'az-frontdoor', `${prefix}-frontdoor`),
    node('app', 450, 130, 'az-vm', `${prefix}-app (${values.replicas})`),
    node('data', 660, 130, 'az-sql', `${prefix}-sql-primary`),
  ];
  const edges = [
    edge('client', 'entry', `HTTPS ${values.port}`),
    edge('entry', 'app', 'origin group'),
    edge('app', 'data', dataPathLabel(values)),
  ];
  nodes.push(node('standby', 450, 330, 'az-vm', `${prefix}-app-standby`));
  nodes.push(node('standby-data', 660, 330, 'az-sql', `${prefix}-sql-secondary`));
  nodes.push(node('health', 870, 330, 'az-monitor', `${prefix}-health`));
  edges.push(edge('entry', 'standby', 'failover origin', 'bottom', 'top'));
  edges.push(edge('data', 'standby-data', 'geo-replica'));
  edges.push(edge('health', 'entry', 'probe', 'top', 'bottom'));
  if (values.identity) {
    nodes.push(node('identity', 870, 130, 'az-entra', `${prefix}-identity`));
    edges.push(edge('app', 'identity', 'managed identity'));
  }
  if (values.observability) {
    nodes.push(node('monitor', 660, 470, 'az-monitor', `${prefix}-monitor`));
    edges.push(edge('app', 'monitor', 'traces'));
  }
  return { nodes, edges };
}

const devopsParams = [
  select('environment', 'Environment', ENVIRONMENTS, 'prod'),
  select('releaseStrategy', 'Release strategy', ['rolling', 'blue-green', 'canary'], 'canary'),
  number('replicas', 'Application replicas', 2, 1, 10),
  bool('identity', 'Workload identity for the pipeline', true),
  bool('observability', 'Metrics and traces', true),
  bool('showExplanation', 'Show teaching explanation on the board', true),
  text('namePrefix', 'Resource name prefix', 'delivery'),
];

const devopsValidate = (values) => {
  const errors = {};
  if (!/^[a-z][a-z0-9-]{1,20}$/.test(String(values.namePrefix || ''))) {
    errors.namePrefix = 'Prefix must start with a letter and contain only lowercase letters, digits and dashes.';
  }
  if (values.environment === 'prod' && (Number(values.replicas) || 0) < 2) {
    errors.replicas = 'Production needs at least 2 replicas.';
  }
  return errors;
};

function devopsPlatform(values) {
  const prefix = values.namePrefix;
  const nodes = [
    node('source', 40, 130, 'cloud-generic', 'Developer commit'),
    node('build', 240, 130, 'cicd-jenkins', `${prefix}-build`),
    node('scan', 450, 130, 'sec-trivy', `${prefix}-scan`),
    node('registry', 660, 130, 'cicd-artifact', `${prefix}-registry`),
    node('gitops', 870, 130, 'cicd-argocd', `${prefix}-gitops`),
    node('app', 870, 330, 'k8s-cluster', `${prefix}-cluster`),
  ];
  const edges = [
    edge('source', 'build', 'push'),
    edge('build', 'scan', 'build image'),
    edge('scan', 'registry', 'push if clean'),
    edge('registry', 'gitops', 'image digest'),
    edge('gitops', 'app', `sync · ${values.releaseStrategy}`),
  ];
  if (values.identity) {
    nodes.push(node('identity', 660, 330, 'sec-vault', `${prefix}-secrets`));
    edges.push(edge('app', 'identity', 'secret ref', 'bottom', 'top'));
  }
  nodes.push(node('policy', 450, 330, 'sec-opa', `${prefix}-policy`));
  edges.push(edge('scan', 'policy', 'policy check', 'bottom', 'top'));
  edges.push(edge('policy', 'gitops', 'admission', 'right', 'bottom'));
  if (values.observability) {
    nodes.push(node('monitor', 660, 470, 'obs-prometheus', `${prefix}-metrics`));
    edges.push(edge('app', 'monitor', 'scrape'));
  }
  return { nodes, edges };
}

export const CONFIG_PATTERNS = [  {
    id: 'azure-three-tier',
    name: 'Three-tier application',
    provider: 'Azure',
    templateId: 'tpl-az-01-three-tier-vm',
    params: commonParams('Azure'),
    generate: azureThreeTier,
    validate: baseValidate,
    explanation: (values) =>
      `Traffic enters through App Gateway on ${values.port} and reaches ${values.replicas} app instance(s) in the ${values.region} region over ${values.cidr}. The database is reached over a ${values.connectivity} path${values.variant === 'high-availability' ? ' with a second zone-redundant instance' : ''}.`,
  },
  {
    id: 'azure-aks',
    name: 'AKS microservices',
    provider: 'Azure',
    templateId: 'tpl-az-02-aks-platform',
    params: commonParams('Azure'),
    generate: azureAks,
    validate: baseValidate,
    explanation: (values) =>
      `A private AKS cluster runs ${values.replicas} api replica(s) in ${values.cidr} with a ${values.releaseStrategy} release${values.variant === 'high-availability' ? ' and a second zone-redundant replica set' : ''}. Images and backing services stay inside the ${values.region} region.`,
  },
  {
    id: 'gcp-compute',
    name: 'Compute Engine application',
    provider: 'GCP',
    templateId: 'tpl-gcp-01-compute-engine',
    params: commonParams('GCP'),
    generate: gcpCompute,
    validate: baseValidate,
    explanation: (values) =>
      `A global load balancer fronts ${values.replicas} instance(s) in ${values.region}; Cloud SQL is reached on a private IP.`,
  },
  {
    id: 'gcp-gke',
    name: 'GKE platform',
    provider: 'GCP',
    templateId: 'tpl-gcp-02-gke-platform',
    params: commonParams('GCP'),
    generate: gcpGke,
    validate: baseValidate,
    explanation: (values) =>
      `A private GKE cluster runs ${values.replicas} api replica(s) in ${values.region} with ${values.releaseStrategy} releases and workload identity.`,
  },
  {
    id: 'aws-three-tier',
    name: 'Three-tier application (AWS)',
    provider: 'AWS',
    templateId: 'tpl-aws-01-three-tier-web',
    params: commonParams('AWS'),
    generate: awsThreeTier,
    validate: baseValidate,
    explanation: (values) =>
      `Route 53 resolves the name, the ALB in the public subnets forwards ${values.port} to ${values.replicas} app instance(s), and Aurora is reached over a ${values.connectivity} path inside ${values.cidr}${values.variant === 'high-availability' ? ' with a second zone-redundant instance' : ''}.`,
  },
  {
    id: 'aws-serverless',
    name: 'Serverless event-driven (AWS)',
    provider: 'AWS',
    templateId: 'tpl-aws-03-serverless-events',
    params: commonParams('AWS'),
    generate: awsServerless,
    validate: baseValidate,
    explanation: (values) =>
      `API Gateway invokes ${values.replicas} Lambda function(s) that write to DynamoDB over a ${values.connectivity} path; slow work is handed to a queue so the synchronous answer stays short.`,
  },
  {
    id: 'azure-multiregion',
    name: 'Multi-region recovery (Azure)',
    provider: 'Azure',
    templateId: 'tpl-az-10-recovery',
    params: commonParams('Azure'),
    generate: azureMultiRegion,
    validate: baseValidate,
    explanation: (values) =>
      `Front Door sends ${values.port} traffic to the ${values.region} origin with a warm standby behind it; Azure SQL replicates to the secondary region, so RPO is bounded by replication lag and RTO by the failover path.`,
  },
  {
    id: 'devops-platform',
    name: 'CI/CD delivery platform',
    provider: 'Cross-cloud',
    templateId: 'tpl-aws-09-cicd',
    params: devopsParams,
    generate: devopsPlatform,
    validate: devopsValidate,
    explanation: (values) =>
      `Every change is built once, scanned, and pushed by digest to the registry. GitOps reconciles that digest into the ${values.releaseStrategy} release, and a policy gate sits between the scan and admission so a critical finding stops before production.`,
  },
];

export function getConfigPattern(id) {
  return CONFIG_PATTERNS.find((p) => p.id === id) || null;
}

export function defaultValues(pattern) {
  const values = {};
  for (const p of pattern.params) values[p.id] = p.default;
  return values;
}

export function validateValues(pattern, values) {
  const errors = {};
  for (const p of pattern.params) {
    const value = values[p.id];
    if (p.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) errors[p.id] = `${p.label} must be a number.`;
      else if (p.min != null && n < p.min) errors[p.id] = `${p.label} must be at least ${p.min}.`;
      else if (p.max != null && n > p.max) errors[p.id] = `${p.label} must be at most ${p.max}.`;
    } else if (p.type === 'select') {
      if (!p.choices.includes(value)) errors[p.id] = `${p.label} has an unsupported value.`;
    }
  }
  const cross = pattern.validate ? pattern.validate(values) : {};
  return { ok: Object.keys({ ...errors, ...cross }).length === 0, errors: { ...errors, ...cross } };
}

/**
 * Apply a configuration to a page atomically.
 * Elements created by the engine carry configPattern + configKey, so a later
 * apply updates them in place and keeps their ids and manual positions.
 */
export function applyArchitectureConfig(page, pattern, values, options = {}) {
  // relayout: 'preserve' keeps every manual position, 'group' moves only the
  // elements this configuration owns, 'full' additionally shifts the whole
  // configured group clear of unrelated board content.
  const { relayout = 'preserve' } = options;
  if (!page || !Array.isArray(page.elements)) {
    return { ok: false, errors: ['No active page to configure.'] };
  }
  const check = validateValues(pattern, values);
  if (!check.ok) return { ok: false, errors: Object.values(check.errors) };

  const generated = pattern.generate(values);
  const nodes = generated.nodes.map((n) => ({ ...n }));
  const edges = generated.edges.map((e) => ({ ...e }));
  const applied = augmentGraph(nodes, edges, values);

  // Snapshot so a mid-apply failure cannot leave a half-configured board.
  const backup = JSON.parse(JSON.stringify(page.elements));
  try {
    const existingNodes = new Map();
    for (const el of page.elements) {
      if (el.configPattern === pattern.id && el.configKey) existingNodes.set(el.configKey, el);
    }
    const existingEdges = new Map();
    for (const el of page.elements) {
      if (el.configPattern === pattern.id && el.configEdge) existingEdges.set(el.configEdge, el);
    }

    // A board built from the matching template already contains this diagram.
    // Adopt its components instead of stacking a second copy on top.
    let adopted = 0;
    if (existingNodes.size === 0 && pattern.templateId) {
      const templateStencils = page.elements.filter(
        (el) => el.type === 'stencil' && el.templateId === pattern.templateId
      );
      const claimed = new Set();
      for (const spec of nodes) {
        // Only an exact stencil match may be adopted. A generic "any unclaimed
        // stencil" fallback silently rewrites one service into another (the DNS
        // zone became the monitor node) and strands the real component.
        const match = templateStencils.find((el) => !claimed.has(el) && el.stencilId === spec.stencilId);
        if (!match) continue;
        claimed.add(match);
        match.configPattern = pattern.id;
        match.configKey = spec.key;
        existingNodes.set(spec.key, match);
        adopted++;
      }
      const templateArrows = page.elements.filter(
        (el) => el.type === 'arrow' && el.templateId === pattern.templateId
      );
      // Arrows are adopted positionally up to the number the template drew;
      // any generated edge beyond that becomes a new connector rather than
      // stealing one from a different part of the diagram.
      edges.forEach((e, idx) => {
        const arrow = templateArrows[idx];
        if (!arrow) return;
        const edgeKey = `${e.from}->${e.to}`;
        if (existingEdges.has(edgeKey)) return;
        arrow.configPattern = pattern.id;
        arrow.configEdge = edgeKey;
        existingEdges.set(edgeKey, arrow);
        adopted++;
      });
    }

    const desiredKeys = new Set(nodes.map((n) => n.key));
    let added = 0;
    let updated = 0;
    let removed = 0;
    const byKey = new Map();

    for (const spec of nodes) {
      const el = existingNodes.get(spec.key);
      if (el) {
        el.stencilId = spec.stencilId;
        el.text = spec.text;
        if (!el.w) el.w = 164;
        if (!el.h) el.h = 92;
        el.configPattern = pattern.id;
        el.configGroup = spec.group || pattern.id;
        if (relayout === 'group' || relayout === 'full') {
          el.x = spec.x;
          el.y = spec.y;
        }
        byKey.set(spec.key, el);
        updated++;
      } else {
        const created = createElement('stencil', {
          stencilId: spec.stencilId,
          x: spec.x,
          y: spec.y,
          w: 164,
          h: 92,
          text: spec.text,
        });
        created.configPattern = pattern.id;
        created.configKey = spec.key;
        created.configGroup = spec.group || pattern.id;
        page.elements.push(created);
        byKey.set(spec.key, created);
        added++;
      }
    }

    const removedIds = [];
    for (const [key, el] of existingNodes) {
      if (desiredKeys.has(key)) continue;
      const idx = page.elements.indexOf(el);
      if (idx >= 0) page.elements.splice(idx, 1);
      removedIds.push(el.id);
      removed++;
    }
    if (removedIds.length) {
      // User-drawn connectors must not keep a binding to an element that is gone.
      handleAnchorDeletion(page, removedIds);
    }

    // Edges are rebuilt per pattern but keep ids when the same key pair survives.
    const desiredEdges = new Set(edges.map((e) => `${e.from}->${e.to}`));
    for (const e of edges) {
      const start = byKey.get(e.from);
      const end = byKey.get(e.to);
      if (!start || !end) continue;
      const edgeKey = `${e.from}->${e.to}`;
      let arrow = existingEdges.get(edgeKey);
      if (!arrow) {
        arrow = createElement('arrow', { routing: 'orthogonal', endArrow: 'arrow', text: e.label });
        arrow.configPattern = pattern.id;
        arrow.configEdge = edgeKey;
        page.elements.push(arrow);
      }
      arrow.text = e.label;
      bindConnectorEndpoint(arrow, 'start', start, e.fromPort);
      bindConnectorEndpoint(arrow, 'end', end, e.toPort);
    }

    for (const [edgeKey, arrow] of existingEdges) {
      if (desiredEdges.has(edgeKey)) continue;
      const idx = page.elements.indexOf(arrow);
      if (idx >= 0) page.elements.splice(idx, 1);
    }

    // The teaching explanation is board content, not a comment: it obeys the
    // visibility parameter and is removed when the teacher turns it off.
    let explanationEl = page.elements.find(
      (el) => el.configPattern === pattern.id && el.configExplanation
    );
    if (values.showExplanation) {
      const configEls = page.elements.filter(
        (el) => el.configPattern === pattern.id && (el.configKey || el.configEdge)
      );
      const bounds = configEls.reduce(
        (acc, el) => ({
          minX: Math.min(acc.minX, el.x ?? 0),
          maxY: Math.max(acc.maxY, (el.y ?? 0) + (el.h || 92)),
        }),
        { minX: Infinity, maxY: -Infinity }
      );
      // The explanation is a plain text element, and text does not wrap at
      // render time — an unwrapped sentence ran off the board edge. Wrap it
      // here and let autoGrow size the box to the wrapped content.
      const text = wrapExplanation(pattern.explanation(values));
      const x = Number.isFinite(bounds.minX) ? bounds.minX : 40;
      const y = Number.isFinite(bounds.maxY) ? bounds.maxY + 40 : 640;
      if (!explanationEl) {
        explanationEl = createElement('text', {
          x,
          y,
          w: 720,
          h: 64,
          text,
          fontSize: 14,
          fill: '#475569',
          autoGrow: true,
        });
        explanationEl.configPattern = pattern.id;
        explanationEl.configExplanation = true;
        page.elements.push(explanationEl);
      } else {
        explanationEl.text = text;
        // Follow the group when a relayout (or the clear-of-content shift)
        // moves it, so the explanation never sits over another diagram.
        if (relayout !== 'preserve') {
          explanationEl.x = x;
          explanationEl.y = y;
        }
      }
      autoGrowShapeForText(explanationEl, explanationEl.text);
    } else if (explanationEl) {
      const idx = page.elements.indexOf(explanationEl);
      if (idx >= 0) page.elements.splice(idx, 1);
    }

    // A first application that lands on top of existing board content is a
    // placement bug, not a preference: 'preserve' protects the manual positions
    // of this configuration's own elements, and a fresh group has none yet.
    if (relayout === 'full' || (existingNodes.size === 0 && existingEdges.size === 0)) {
      shiftConfiguredGroupClear(page, pattern.id);
    }

    // Keep the applied settings with the page so reopening the drawer shows the
    // configuration that is actually on the board instead of silently resetting
    // internals, high availability or the CIDR back to defaults.
    if (!page.architectureConfigs || typeof page.architectureConfigs !== 'object') {
      page.architectureConfigs = {};
    }
    page.architectureConfigs[pattern.id] = { ...values };

    return {
      ok: true,
      added,
      updated,
      removed,
      adopted,
      applied,
      removedIds,
      affectedKey: pattern.id,
      values: { ...values },
    };
  } catch (err) {
    page.elements = backup;
    return { ok: false, errors: [err?.message || 'Configuration failed and was rolled back.'] };
  }
}

/**
 * Wrap a teaching explanation at a readable width. Text elements do not wrap
 * at render time, so an unwrapped paragraph stretches past the board edge.
 */
function wrapExplanation(text, maxChars = 96) {
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Move the configured graph below any unrelated board content it collides with. */
function shiftConfiguredGroupClear(page, patternId) {
  const isOwned = (el) =>
    el.configPattern === patternId && (el.configKey || el.configEdge || el.configExplanation);
  const owned = page.elements.filter(isOwned);
  const others = page.elements.filter((el) => !isOwned(el));
  if (!owned.length || !others.length) return;
  const box = owned.reduce(
    (acc, el) => ({
      minX: Math.min(acc.minX, el.x ?? 0),
      maxX: Math.max(acc.maxX, (el.x ?? 0) + (el.w || 164)),
      minY: Math.min(acc.minY, el.y ?? 0),
      maxY: Math.max(acc.maxY, (el.y ?? 0) + (el.h || 92)),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );
  const collides = others.some(
    (el) =>
      el.x < box.maxX &&
      el.x + (el.w || 164) > box.minX &&
      el.y < box.maxY &&
      el.y + (el.h || 92) > box.minY
  );
  if (!collides) return;
  const bottom = others.reduce((max, el) => Math.max(max, (el.y ?? 0) + (el.h || 92)), 0);
  const dy = bottom + 60 - box.minY;
  const dx = 0 - box.minX;
  for (const el of owned) {
    el.x = (el.x ?? 0) + dx;
    el.y = (el.y ?? 0) + dy;
  }
}
