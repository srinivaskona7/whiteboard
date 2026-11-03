// templates/azure-gcp.js — native, editable Azure and GCP teaching architectures.
// Authority: provider service names and topology relationships documented for the
// 2026-11 review; every diagram is plain stencil + arrow elements, not an image.
import { createElement } from '../scene/model.js';
import { bindConnectorEndpoint } from '../scene/bindings.js';

const NODE_W = 164;
const NODE_H = 92;

const N = (stencilId, x, y, text, extra = {}) =>
  createElement('stencil', { stencilId, x, y, w: NODE_W, h: NODE_H, text, ...extra });

const A = (a, ap, b, bp, opts = {}) => {
  const arrow = createElement('arrow', { routing: 'orthogonal', endArrow: 'arrow', ...opts });
  bindConnectorEndpoint(arrow, 'start', a, ap);
  bindConnectorEndpoint(arrow, 'end', b, bp);
  return arrow;
};

const TITLE = (x, y, text) => createElement('text', { x, y, text, fontSize: 20, bold: true, w: 620, h: 30 });
const NOTE = (x, y, text) => createElement('text', { x, y, text, fontSize: 14, w: 640, h: 46, fill: '#475569' });

const diagram = (spec) => ({
  id: spec.id,
  name: spec.name,
  description: spec.description,
  category: 'multicloud',
  provider: spec.provider,
  build() {
    const nodes = spec.build();
    const frame = createElement('frame', {
      x: 24,
      y: 48,
      w: spec.w || 1080,
      h: spec.h || 600,
      text: spec.frameTitle,
      teacherNotes: spec.teaching,
      slideOrder: 1,
    });
    // Stamp provenance so the diagram configuration drawer can adopt these
    // components instead of adding a duplicate copy of the same architecture.
    for (const el of [frame, ...nodes]) el.templateId = spec.id;
    return [frame, ...nodes];
  },
});

export const AZURE_GCP_TEMPLATES = [
  diagram({
    id: 'tpl-az-01-three-tier-vm',
    name: 'AZ-01 Three-tier VM application',
    description: 'Internet → App Gateway (WAF) → VM scale set → Azure SQL with private endpoints',
    provider: 'Azure',
    frameTitle: 'Lesson: Azure three-tier application',
    teaching:
      'App Gateway terminates TLS and runs WAF before traffic reaches the web tier. The web and app tiers sit in separate subnets and talk only through NSG rules; Azure SQL has no public endpoint.',
    build() {
      const user = N('cloud-generic', 60, 130, 'Internet user');
      const dns = N('az-dns', 280, 130, 'Azure DNS zone');
      const agw = N('az-appgw', 500, 130, 'App Gateway (WAF)');
      const web = N('az-vm', 500, 300, 'Web tier VMSS');
      const app = N('az-vm', 740, 300, 'App tier VMSS');
      const sql = N('az-sql', 740, 470, 'Azure SQL (private)');
      const kv = N('az-entra', 980, 470, 'Key Vault');
      return [
        TITLE(60, 76, 'Three-tier application on Azure IaaS'),
        user,
        dns,
        agw,
        web,
        app,
        sql,
        kv,
        A(user, 'right', dns, 'left', { text: 'resolve' }),
        A(dns, 'right', agw, 'left', { text: 'HTTPS 443' }),
        A(agw, 'bottom', web, 'top', { text: '8080' }),
        A(web, 'right', app, 'left', { text: 'internal API' }),
        A(app, 'bottom', sql, 'top', { text: '1433 from app subnet' }),
        A(app, 'right', kv, 'left', { text: 'secret ref' }),
        NOTE(60, 560, 'Each tier has its own subnet and NSG. Private endpoints remove the database from the public internet.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-02-aks-platform',
    name: 'AZ-02 AKS microservices platform',
    description: 'ACR image pull, AKS ingress, service-to-service calls and managed backing services',
    provider: 'Azure',
    frameTitle: 'Lesson: AKS microservices platform',
    teaching:
      'The ingress controller is the only public entry; pods reach Azure Cache and Cosmos DB over private endpoints. ACR pull uses a managed identity, never a stored password.',
    build() {
      const users = N('cloud-generic', 40, 130, 'Client applications');
      const ingress = N('az-appgw', 250, 130, 'Ingress + WAF');
      const aks = N('az-aks', 470, 130, 'AKS cluster');
      const api = N('flow-process', 470, 300, 'api pod');
      const worker = N('flow-process', 680, 300, 'worker pod');
      const acr = N('az-acr', 890, 130, 'Container Registry');
      const cosmos = N('az-cosmos', 890, 300, 'Cosmos DB');
      const cache = N('flow-database', 890, 470, 'Azure Cache');
      const mon = N('az-monitor', 680, 470, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Container platform with managed Azure services'),
        users,
        ingress,
        aks,
        api,
        worker,
        acr,
        cosmos,
        cache,
        mon,
        A(users, 'right', ingress, 'left', { text: 'HTTPS' }),
        A(ingress, 'right', aks, 'left', { text: 'route to ingress' }),
        A(aks, 'bottom', api, 'top'),
        A(api, 'right', worker, 'left', { text: 'queue work' }),
        A(acr, 'bottom', aks, 'right', { text: 'pull (managed identity)', routing: 'curved' }),
        A(api, 'right', cosmos, 'left', { text: 'save document' }),
        A(api, 'bottom', cache, 'top', { text: 'read-through' }),
        A(worker, 'bottom', mon, 'top', { text: 'traces', routing: 'curved' }),
        NOTE(40, 560, 'AKS pulls images from ACR with a managed identity. Workloads talk to Cosmos DB and Cache through private endpoints.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-03-serverless-events',
    name: 'AZ-03 Serverless event-driven flow',
    description: 'Blob upload → Event Grid → Functions → Service Bus → downstream consumer',
    provider: 'Azure',
    frameTitle: 'Lesson: Serverless event flow on Azure',
    teaching:
      'Blob Storage raises an event, Event Grid filters by subject, and a Function handles it. Service Bus decouples the slow consumer and gives retries with a dead-letter queue.',
    build() {
      const app = N('cloud-generic', 40, 130, 'Uploading app');
      const blob = N('az-blob', 250, 130, 'Blob container');
      const grid = N('az-eventgrid', 470, 130, 'Event Grid');
      const fn = N('az-functions', 470, 300, 'Function: validate');
      const bus = N('az-servicebus', 690, 300, 'Service Bus queue');
      const worker = N('az-functions', 900, 300, 'Function: process');
      const dead = N('az-servicebus', 900, 470, 'Dead-letter queue');
      const mon = N('az-monitor', 690, 470, 'Monitor + alerts');
      return [
        TITLE(40, 76, 'Event-driven serverless pipeline'),
        app,
        blob,
        grid,
        fn,
        bus,
        worker,
        dead,
        mon,
        A(app, 'right', blob, 'left', { text: 'PUT document' }),
        A(blob, 'right', grid, 'left', { text: 'BlobCreated' }),
        A(grid, 'bottom', fn, 'top', { text: 'subject filter' }),
        A(fn, 'right', bus, 'left', { text: 'enqueue job' }),
        A(bus, 'right', worker, 'left', { text: 'peek-lock' }),
        A(worker, 'bottom', dead, 'top', { text: 'after N retries', routing: 'curved' }),
        A(fn, 'bottom', mon, 'right', { text: 'metrics', routing: 'curved' }),
        NOTE(40, 560, 'Event Grid delivers at least once, so the Function must be idempotent. Failed Service Bus messages go to the dead-letter queue.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-04-hub-spoke',
    name: 'AZ-04 Hub-and-spoke network',
    description: 'Shared hub with firewall and gateway, peered to application and data spokes',
    provider: 'Azure',
    frameTitle: 'Lesson: Azure hub-and-spoke topology',
    teaching:
      'The hub owns shared connectivity: Azure Firewall inspects east-west traffic and the VPN/ExpressRoute gateway reaches on-premises. Spokes peer to the hub only, never to each other, which keeps blast radius small.',
    build() {
      const onprem = N('cloud-vm', 40, 130, 'On-premises network');
      const gw = N('az-vnet', 250, 130, 'VPN / ExpressRoute GW');
      const fw = N('az-firewall', 250, 300, 'Azure Firewall');
      const hub = N('az-vnet', 470, 210, 'Hub VNet');
      const spokes = N('az-vnet', 700, 130, 'App spoke');
      const dataSpoke = N('az-vnet', 700, 300, 'Data spoke');
      const web = N('az-vm', 910, 130, 'App workload');
      const sql = N('az-sql', 910, 300, 'Data workload');
      return [
        TITLE(40, 76, 'Hub-and-spoke network with central inspection'),
        onprem,
        gw,
        fw,
        hub,
        spokes,
        dataSpoke,
        web,
        sql,
        A(onprem, 'right', gw, 'left', { text: 'private circuit' }),
        A(gw, 'bottom', fw, 'top'),
        A(fw, 'right', hub, 'left', { text: 'UDR forced' }),
        A(hub, 'right', spokes, 'left', { text: 'peering' }),
        A(hub, 'bottom', dataSpoke, 'left', { text: 'peering', routing: 'curved' }),
        A(spokes, 'right', web, 'left'),
        A(dataSpoke, 'right', sql, 'left'),
        NOTE(40, 560, 'User-defined routes send spoke traffic through the firewall. Spokes are not peered to one another.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-05-identity-secrets',
    name: 'AZ-05 Identity and secrets',
    description: 'Entra ID sign-in, managed identity to Key Vault, and audit to Azure Monitor',
    provider: 'Azure',
    frameTitle: 'Lesson: Identity and secret handling',
    teaching:
      'Users authenticate with Entra ID and receive a token. The application uses a managed identity to fetch secrets from Key Vault, so no credential is stored in configuration. Every access is audited.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Teacher / student');
      const entra = N('az-entra', 250, 130, 'Microsoft Entra ID');
      const app = N('az-appservice', 470, 130, 'App Service');
      const mi = N('az-entra', 470, 300, 'System-assigned MI');
      const kv = N('az-entra', 700, 300, 'Key Vault');
      const mon = N('az-monitor', 700, 470, 'Audit log');
      const sql = N('az-sql', 910, 300, 'Azure SQL');
      return [
        TITLE(40, 76, 'Authentication, authorisation and secrets'),
        user,
        entra,
        app,
        mi,
        kv,
        mon,
        sql,
        A(user, 'right', entra, 'left', { text: 'sign-in' }),
        A(entra, 'right', app, 'left', { text: 'OIDC token' }),
        A(app, 'bottom', mi, 'top', { text: 'identity' }),
        A(mi, 'right', kv, 'left', { text: 'secret get' }),
        A(app, 'right', sql, 'left', { text: 'token auth', routing: 'curved' }),
        A(kv, 'bottom', mon, 'top', { text: 'audit event' }),
        NOTE(40, 560, 'No secret is stored in app settings. The managed identity is granted only the Key Vault role it needs.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-06-messaging',
    name: 'AZ-06 Messaging and integration',
    description: 'API Management in front of Service Bus topics feeding order and billing subscribers',
    provider: 'Azure',
    frameTitle: 'Lesson: Brokered messaging on Azure',
    teaching:
      'API Management applies quotas and keys. Service Bus topics fan one message out to independent subscriptions, so a billing outage cannot block order processing.',
    build() {
      const clients = N('cloud-generic', 40, 130, 'Client apps');
      const apim = N('az-appgw', 250, 130, 'API Management');
      const topic = N('az-servicebus', 470, 130, 'Service Bus topic');
      const orders = N('az-functions', 700, 130, 'Order subscription');
      const billing = N('az-functions', 700, 300, 'Billing subscription');
      const sql = N('az-sql', 910, 130, 'Orders DB');
      const dead = N('az-servicebus', 470, 470, 'Dead-letter queue');
      const mon = N('az-monitor', 700, 470, 'Delivery metrics');
      return [
        TITLE(40, 76, 'Fan-out messaging with independent subscribers'),
        clients,
        apim,
        topic,
        orders,
        billing,
        sql,
        dead,
        mon,
        A(clients, 'right', apim, 'left', { text: 'HTTPS' }),
        A(apim, 'right', topic, 'left', { text: 'publish' }),
        A(topic, 'right', orders, 'left', { text: 'subscription A' }),
        A(topic, 'bottom', billing, 'left', { text: 'subscription B', routing: 'curved' }),
        A(orders, 'right', sql, 'left'),
        A(billing, 'bottom', mon, 'top', { text: 'lag + errors', routing: 'curved' }),
        A(topic, 'bottom', dead, 'top', { text: 'poison message', routing: 'curved' }),
        NOTE(40, 560, 'Each subscription has its own lock and retry policy. Poison messages land in the dead-letter queue.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-07-data-platform',
    name: 'AZ-07 Data platform',
    description: 'Blob landing zone → Data Factory → SQL warehouse → Power BI, governed by Purview',
    provider: 'Azure',
    frameTitle: 'Lesson: Batch data platform',
    teaching:
      'Files land in a blob container, Data Factory orchestrates the copy and transform, and Azure SQL serves the reporting layer. Purview records lineage so students can see where a number came from.',
    build() {
      const sources = N('cloud-generic', 40, 130, 'Source systems');
      const adls = N('az-blob', 250, 130, 'Landing container');
      const adf = N('az-devops', 470, 130, 'Data Factory');
      const sql = N('az-sql', 700, 130, 'SQL warehouse');
      const bi = N('cloud-generic', 910, 130, 'Power BI report');
      const lake = N('az-blob', 700, 300, 'Curated zone');
      const purview = N('az-monitor', 700, 470, 'Purview lineage');
      return [
        TITLE(40, 76, 'Batch ingest, transform and report'),
        sources,
        adls,
        adf,
        sql,
        bi,
        lake,
        purview,
        A(sources, 'right', adls, 'left', { text: 'export' }),
        A(adls, 'right', adf, 'left', { text: 'trigger' }),
        A(adf, 'right', sql, 'left', { text: 'load' }),
        A(sql, 'right', bi, 'left', { text: 'dataset' }),
        A(adf, 'bottom', lake, 'top', { text: 'curated write' }),
        A(lake, 'bottom', purview, 'top', { text: 'lineage', routing: 'curved' }),
        NOTE(40, 560, 'Landing is immutable; transformation writes to a curated zone. Lineage links report field back to landing file.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-08-observability',
    name: 'AZ-08 Observability and operations',
    description: 'Workload telemetry into Log Analytics, alert rules to Action Groups, workbook for SLOs',
    provider: 'Azure',
    frameTitle: 'Lesson: Operating an Azure workload',
    teaching:
      'Application Insights and platform diagnostics flow into Log Analytics. Alert rules query that store and call an Action Group; a workbook turns the same signals into an SLO view.',
    build() {
      const app = N('az-appservice', 40, 130, 'App Service');
      const aks = N('az-aks', 40, 300, 'AKS cluster');
      const ai = N('az-monitor', 250, 130, 'Application Insights');
      const diag = N('az-monitor', 250, 300, 'Resource diagnostics');
      const la = N('az-monitor', 470, 210, 'Log Analytics');
      const alerts = N('az-monitor', 700, 130, 'Alert rules');
      const action = N('cloud-generic', 910, 130, 'Action Group');
      const wb = N('cloud-generic', 700, 300, 'SLO workbook');
      const oncall = N('cloud-generic', 910, 300, 'On-call engineer');
      return [
        TITLE(40, 76, 'Telemetry, alerting and on-call'),
        app,
        aks,
        ai,
        diag,
        la,
        alerts,
        action,
        wb,
        oncall,
        A(app, 'right', ai, 'left', { text: 'SDK traces' }),
        A(aks, 'right', diag, 'left', { text: 'control plane logs' }),
        A(ai, 'right', la, 'left', { text: 'workspace' }),
        A(diag, 'right', la, 'left', { text: 'workspace', routing: 'curved' }),
        A(la, 'right', alerts, 'left', { text: 'scheduled query' }),
        A(alerts, 'right', action, 'left', { text: 'fire' }),
        A(action, 'right', oncall, 'left', { text: 'page' }),
        A(la, 'bottom', wb, 'top', { text: 'same signals', routing: 'curved' }),
        NOTE(40, 560, 'Alerts query Log Analytics, not the live resource. The workbook reuses the alert queries for its SLO view.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-09-cicd',
    name: 'AZ-09 CI/CD and container delivery',
    description: 'Azure Repos → Pipelines → ACR → AKS deployment with approvals',
    provider: 'Azure',
    frameTitle: 'Lesson: Delivery pipeline on Azure',
    teaching:
      'Azure Pipelines builds and tests on every pull request, pushes a tagged image to ACR, and deploys to AKS only after the environment approval gateway is satisfied.',
    build() {
      const dev = N('cloud-generic', 40, 130, 'Developer commit');
      const repo = N('az-devops', 250, 130, 'Azure Repos');
      const pipe = N('az-devops', 470, 130, 'Pipelines build + test');
      const acr = N('az-acr', 700, 130, 'Container Registry');
      const aks = N('az-aks', 910, 130, 'AKS deployment');
      const approve = N('cloud-generic', 700, 300, 'Environment approval');
      const mon = N('az-monitor', 910, 300, 'Release health');
      return [
        TITLE(40, 76, 'Build, publish and deploy'),
        dev,
        repo,
        pipe,
        acr,
        aks,
        approve,
        mon,
        A(dev, 'right', repo, 'left', { text: 'push branch' }),
        A(repo, 'right', pipe, 'left', { text: 'trigger' }),
        A(pipe, 'right', acr, 'left', { text: 'push image tag' }),
        A(acr, 'right', aks, 'left', { text: 'deploy' }),
        A(pipe, 'bottom', approve, 'top', { text: 'gate' }),
        A(approve, 'right', aks, 'bottom', { text: 'release', routing: 'curved' }),
        A(aks, 'bottom', mon, 'top', { text: 'health probes' }),
        NOTE(40, 560, 'Images are immutable: deploy a digest or immutable tag, never latest. Approval is an environment check, not a human in chat.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-az-10-recovery',
    name: 'AZ-10 Recovery design',
    description: 'Primary region, paired region replica, Backup vault and a documented failover path',
    provider: 'Azure',
    frameTitle: 'Lesson: Recovery and failover on Azure',
    teaching:
      'The primary region serves traffic while Azure SQL replicates asynchronously to the paired region. Recovery Services vault holds backups; failover is a documented, tested runbook, not an automatic assumption.',
    build() {
      const users = N('cloud-generic', 40, 130, 'Users');
      const tm = N('az-dns', 250, 130, 'Traffic Manager');
      const primary = N('az-vm', 470, 130, 'Primary region app');
      const secondary = N('az-vm', 470, 300, 'Secondary region app');
      const sqlP = N('az-sql', 700, 130, 'SQL primary');
      const sqlS = N('az-sql', 700, 300, 'SQL geo-replica');
      const vault = N('az-backup', 700, 470, 'Recovery vault');
      const mon = N('az-monitor', 910, 210, 'Health probes');
      return [
        TITLE(40, 76, 'Active-passive regional recovery'),
        users,
        tm,
        primary,
        secondary,
        sqlP,
        sqlS,
        vault,
        mon,
        A(users, 'right', tm, 'left', { text: 'DNS' }),
        A(tm, 'right', primary, 'left', { text: 'active endpoint' }),
        A(tm, 'bottom', secondary, 'left', { text: 'standby', routing: 'curved' }),
        A(primary, 'right', sqlP, 'left'),
        A(sqlP, 'bottom', sqlS, 'top', { text: 'async replication' }),
        A(sqlS, 'bottom', vault, 'top', { text: 'backup copy' }),
        A(mon, 'left', tm, 'right', { text: 'probe', routing: 'curved' }),
        NOTE(40, 560, 'Recovery point and recovery time objectives are design inputs. Failback is a second, separately tested runbook.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-01-compute-engine',
    name: 'GCP-01 Compute Engine application',
    description: 'Global external load balancer → regional managed instance group → Cloud SQL in a VPC',
    provider: 'GCP',
    frameTitle: 'Lesson: Compute Engine three-tier application',
    teaching:
      'A global external Application Load Balancer fronts a regional managed instance group. Cloud SQL uses a private IP inside the same VPC, so the database is never publicly reachable.',
    build() {
      const users = N('cloud-generic', 40, 130, 'Internet user');
      const dns = N('gcp-dns', 250, 130, 'Cloud DNS');
      const lb = N('gcp-lb', 470, 130, 'Global external ALB');
      const mig = N('gcp-gce', 700, 130, 'Managed instance group');
      const sql = N('gcp-cloudsql', 910, 130, 'Cloud SQL private IP');
      const vpc = N('gcp-vpc', 700, 330, 'VPC + subnets');
      const mon = N('gcp-monitoring', 910, 330, 'Cloud Monitoring');
      const bucket = N('gcp-gcs', 470, 330, 'Static assets bucket');
      return [
        TITLE(40, 76, 'Regional application on Compute Engine'),
        users,
        dns,
        lb,
        mig,
        sql,
        vpc,
        mon,
        bucket,
        A(users, 'right', dns, 'left', { text: 'resolve' }),
        A(dns, 'right', lb, 'left', { text: 'HTTPS' }),
        A(lb, 'right', mig, 'left', { text: 'backend service' }),
        A(mig, 'right', sql, 'left', { text: 'private IP 3306' }),
        A(mig, 'bottom', vpc, 'top', { text: 'instance NIC' }),
        A(mig, 'bottom', mon, 'right', { text: 'agent metrics', routing: 'curved' }),
        A(lb, 'bottom', bucket, 'top', { text: 'CDN backend' }),
        NOTE(40, 560, 'Instances have no external IP. Cloud SQL private IP keeps database traffic inside the VPC.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-02-gke-platform',
    name: 'GCP-02 GKE platform',
    description: 'Private GKE cluster pulling from Artifact Registry, backed by Cloud SQL and Pub/Sub',
    provider: 'GCP',
    frameTitle: 'Lesson: Private GKE platform',
    teaching:
      'The GKE control plane is reachable only through authorised networks and nodes have no external IPs. Workloads pull from Artifact Registry over Private Google Access and use Workload Identity for Google APIs.',
    build() {
      const users = N('cloud-generic', 40, 130, 'Clients');
      const lb = N('gcp-lb', 250, 130, 'Cloud Load Balancing');
      const gke = N('gcp-gke', 470, 130, 'Private GKE cluster');
      const api = N('flow-process', 470, 320, 'api deployment');
      const worker = N('flow-process', 680, 320, 'worker deployment');
      const ar = N('gcp-artifact', 890, 130, 'Artifact Registry');
      const sql = N('gcp-cloudsql', 890, 320, 'Cloud SQL');
      const pubsub = N('gcp-pubsub', 680, 500, 'Pub/Sub topic');
      return [
        TITLE(40, 76, 'Private cluster with managed backing services'),
        users,
        lb,
        gke,
        api,
        worker,
        ar,
        sql,
        pubsub,
        A(users, 'right', lb, 'left', { text: 'HTTPS' }),
        A(lb, 'right', gke, 'left', { text: 'ingress' }),
        A(gke, 'bottom', api, 'top'),
        A(api, 'right', worker, 'left', { text: 'async job' }),
        A(ar, 'bottom', gke, 'right', { text: 'image pull' }),
        A(api, 'right', sql, 'left', { text: 'private IP' }),
        A(worker, 'bottom', pubsub, 'top', { text: 'publish' }),
        NOTE(40, 560, 'Workload Identity maps Kubernetes service accounts to Google service accounts; no key files are mounted.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-03-cloud-run',
    name: 'GCP-03 Cloud Run serverless',
    description: 'Cloud Run service, Pub/Sub push trigger, Firestore and Secret Manager',
    provider: 'GCP',
    frameTitle: 'Lesson: Serverless containers on Cloud Run',
    teaching:
      'Cloud Run scales to zero between requests and injects secrets from Secret Manager at revision start. A Pub/Sub push subscription invokes the service without a puller to operate.',
    build() {
      const clients = N('cloud-generic', 40, 130, 'Clients');
      const lb = N('gcp-lb', 250, 130, 'External ALB');
      const run = N('gcp-cloudrun', 470, 130, 'Cloud Run service');
      const pubsub = N('gcp-pubsub', 470, 330, 'Pub/Sub topic');
      const secret = N('gcp-secret', 700, 130, 'Secret Manager');
      const store = N('flow-database', 700, 330, 'Firestore');
      const mon = N('gcp-monitoring', 910, 330, 'Cloud Monitoring');
      const bucket = N('gcp-gcs', 910, 130, 'Cloud Storage');
      return [
        TITLE(40, 76, 'Request and event driven Cloud Run'),
        clients,
        lb,
        run,
        pubsub,
        secret,
        store,
        mon,
        bucket,
        A(clients, 'right', lb, 'left', { text: 'HTTPS' }),
        A(lb, 'right', run, 'left', { text: 'serverless NEG' }),
        A(pubsub, 'top', run, 'bottom', { text: 'push subscription' }),
        A(run, 'right', secret, 'left', { text: 'revision env' }),
        A(run, 'right', store, 'left', { text: 'read/write', routing: 'curved' }),
        A(run, 'bottom', mon, 'left', { text: 'request logs', routing: 'curved' }),
        A(run, 'right', bucket, 'left', { text: 'signed upload', routing: 'curved' }),
        NOTE(40, 560, 'Cloud Run requests time out, so long work belongs on Pub/Sub with idempotent handlers.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-04-shared-vpc',
    name: 'GCP-04 Shared VPC network',
    description: 'Host project owns subnets; service projects attach workloads; Cloud Router reaches on-premises',
    provider: 'GCP',
    frameTitle: 'Lesson: Shared VPC and hybrid connectivity',
    teaching:
      'The host project owns the VPC and subnets, service projects attach workloads to them, and IAM controls which project can use which subnet. Cloud Router plus Interconnect provides the on-premises path.',
    build() {
      const onprem = N('cloud-vm', 40, 130, 'On-premises datacentre');
      const ic = N('gcp-interconnect', 250, 130, 'Cloud Interconnect');
      const router = N('gcp-router', 250, 330, 'Cloud Router + NAT');
      const host = N('gcp-vpc', 470, 210, 'Host project VPC');
      const svcA = N('gcp-gce', 700, 130, 'Service project A');
      const svcB = N('gcp-gke', 700, 330, 'Service project B');
      const fw = N('gcp-vpc', 910, 130, 'Firewall policies');
      return [
        TITLE(40, 76, 'Central network, delegated workloads'),
        onprem,
        ic,
        router,
        host,
        svcA,
        svcB,
        fw,
        A(onprem, 'right', ic, 'left', { text: 'Dedicated VLAN' }),
        A(ic, 'bottom', router, 'top', { text: 'BGP session' }),
        A(router, 'right', host, 'left', { text: 'default route' }),
        A(host, 'right', svcA, 'left', { text: 'subnet attachment' }),
        A(host, 'bottom', svcB, 'left', { text: 'subnet attachment', routing: 'curved' }),
        A(host, 'right', fw, 'left', { text: 'policy', routing: 'curved' }),
        NOTE(40, 560, 'Service projects cannot create their own VPC networks in the shared VPC model; they consume host subnets.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-05-identity-secrets',
    name: 'GCP-05 Identity and secrets',
    description: 'Google Identity sign-in, service account with Workload Identity, Secret Manager and audit logs',
    provider: 'GCP',
    frameTitle: 'Lesson: Google Cloud identity and secrets',
    teaching:
      'End users sign in with Google Identity; workloads authenticate with a service account through Workload Identity. Secret Manager holds credentials and Cloud Audit Logs records every read.',
    build() {
      const user = N('cloud-generic', 40, 130, 'User');
      const idp = N('cloud-generic', 250, 130, 'Google Identity');
      const run = N('gcp-cloudrun', 470, 130, 'Cloud Run service');
      const sa = N('gcp-iam', 470, 330, 'Service account');
      const secret = N('gcp-secret', 700, 330, 'Secret Manager');
      const audit = N('gcp-monitoring', 700, 500, 'Cloud Audit Logs');
      const sql = N('gcp-cloudsql', 910, 330, 'Cloud SQL');
      return [
        TITLE(40, 76, 'Identity, least privilege and secret access'),
        user,
        idp,
        run,
        sa,
        secret,
        audit,
        sql,
        A(user, 'right', idp, 'left', { text: 'OIDC' }),
        A(idp, 'right', run, 'left', { text: 'ID token' }),
        A(run, 'bottom', sa, 'top', { text: 'workload identity' }),
        A(sa, 'right', secret, 'left', { text: 'secretAccessor' }),
        A(sa, 'right', sql, 'left', { text: 'cloudsql.client', routing: 'curved' }),
        A(secret, 'bottom', audit, 'top', { text: 'data access log' }),
        NOTE(40, 560, 'Grant the narrowest predefined role on the specific secret, not project-wide Editor.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-06-pubsub-pipeline',
    name: 'GCP-06 Pub/Sub event pipeline',
    description: 'Publisher → Pub/Sub topic → push and pull subscribers → Dataflow and BigQuery',
    provider: 'GCP',
    frameTitle: 'Lesson: Event streaming on Pub/Sub',
    teaching:
      'One topic feeds two independent subscriptions. Dataflow consumes the streaming subscription into BigQuery, while Cloud Run handles the low-latency path; neither blocks the other.',
    build() {
      const app = N('cloud-generic', 40, 130, 'Publisher app');
      const topic = N('gcp-pubsub', 250, 130, 'Pub/Sub topic');
      const subA = N('gcp-pubsub', 470, 130, 'Push subscription');
      const subB = N('gcp-pubsub', 470, 330, 'Streaming subscription');
      const run = N('gcp-cloudrun', 700, 130, 'Cloud Run handler');
      const dataflow = N('gcp-dataflow', 700, 330, 'Dataflow job');
      const bq = N('gcp-bigquery', 910, 330, 'BigQuery dataset');
      const dead = N('gcp-pubsub', 910, 130, 'Dead-letter topic');
      return [
        TITLE(40, 76, 'Fan-out with independent subscribers'),
        app,
        topic,
        subA,
        subB,
        run,
        dataflow,
        bq,
        dead,
        A(app, 'right', topic, 'left', { text: 'publish' }),
        A(topic, 'right', subA, 'left', { text: 'subscription A' }),
        A(topic, 'bottom', subB, 'left', { text: 'subscription B', routing: 'curved' }),
        A(subA, 'right', run, 'left', { text: 'push' }),
        A(subB, 'right', dataflow, 'left', { text: 'pull' }),
        A(dataflow, 'right', bq, 'left', { text: 'streaming insert' }),
        A(run, 'right', dead, 'left', { text: 'after retries' }),
        NOTE(40, 560, 'Delivery is at least once. Subscribers must deduplicate; dead-letter requires a retry policy.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-07-data-analytics',
    name: 'GCP-07 Data analytics',
    description: 'Cloud Storage landing → Dataflow → BigQuery → Looker Studio, catalogued in Dataplex',
    provider: 'GCP',
    frameTitle: 'Lesson: Analytics pipeline on Google Cloud',
    teaching:
      'Batch files land in Cloud Storage, Dataflow transforms them, and BigQuery stores the modelled tables that Looker Studio reads. Dataplex records the lineage.',
    build() {
      const src = N('cloud-generic', 40, 130, 'Source exports');
      const gcs = N('gcp-gcs', 250, 130, 'Landing bucket');
      const flow = N('gcp-dataflow', 470, 130, 'Dataflow transform');
      const bq = N('gcp-bigquery', 700, 130, 'BigQuery modelled');
      const bi = N('cloud-generic', 910, 130, 'Looker Studio');
      const raw = N('gcp-bigquery', 700, 330, 'BigQuery raw');
      const cat = N('gcp-monitoring', 700, 500, 'Dataplex lineage');
      return [
        TITLE(40, 76, 'Ingest, transform, model, visualise'),
        src,
        gcs,
        flow,
        bq,
        bi,
        raw,
        cat,
        A(src, 'right', gcs, 'left', { text: 'upload' }),
        A(gcs, 'right', flow, 'left', { text: 'batch read' }),
        A(flow, 'right', bq, 'left', { text: 'write modelled' }),
        A(bq, 'right', bi, 'left', { text: 'SQL query' }),
        A(flow, 'bottom', raw, 'top', { text: 'write raw' }),
        A(raw, 'bottom', cat, 'top', { text: 'lineage', routing: 'curved' }),
        NOTE(40, 560, 'Keep raw and modelled datasets separate so a bad transform can be replayed without re-ingesting.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-08-observability',
    name: 'GCP-08 Observability and operations',
    description: 'Cloud Logging and Monitoring fed by GKE and Cloud Run, alerting policy to a notification channel',
    provider: 'GCP',
    frameTitle: 'Lesson: Observability on Google Cloud',
    teaching:
      'Logs and metrics share the Cloud Operations suite. An alerting policy evaluates a metric threshold and notifies a channel; uptime checks test the external endpoint from outside.',
    build() {
      const run = N('gcp-cloudrun', 40, 130, 'Cloud Run service');
      const gke = N('gcp-gke', 40, 330, 'GKE workloads');
      const logging = N('gcp-monitoring', 250, 130, 'Cloud Logging');
      const metrics = N('gcp-monitoring', 250, 330, 'Cloud Monitoring');
      const alert = N('gcp-monitoring', 470, 210, 'Alerting policy');
      const channel = N('cloud-generic', 700, 130, 'Notification channel');
      const uptime = N('cloud-generic', 700, 330, 'Uptime check');
      const oncall = N('cloud-generic', 910, 210, 'On-call');
      return [
        TITLE(40, 76, 'Logs, metrics, alerts and uptime'),
        run,
        gke,
        logging,
        metrics,
        alert,
        channel,
        uptime,
        oncall,
        A(run, 'right', logging, 'left', { text: 'stdout' }),
        A(gke, 'right', metrics, 'left', { text: 'agent' }),
        A(logging, 'right', metrics, 'left', { text: 'log-based metric', routing: 'curved' }),
        A(metrics, 'right', alert, 'left', { text: 'threshold' }),
        A(alert, 'right', channel, 'left', { text: 'notify' }),
        A(uptime, 'right', channel, 'left', { text: 'failure', routing: 'curved' }),
        A(channel, 'right', oncall, 'left'),
        NOTE(40, 560, 'Log-based metrics turn a specific log line into a signal; alert policies should reference them, not raw log volume.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-09-cicd',
    name: 'GCP-09 CI/CD and artifact delivery',
    description: 'Cloud Source Repositories → Cloud Build → Artifact Registry → GKE rollout with binary auth',
    provider: 'GCP',
    frameTitle: 'Lesson: Delivery pipeline on Google Cloud',
    teaching:
      'Cloud Build runs tests, builds an image and pushes it to Artifact Registry. GKE pulls through node service accounts with the reader role; deployment is a rollout with health checks.',
    build() {
      const dev = N('cloud-generic', 40, 130, 'Developer commit');
      const repo = N('gcp-build', 250, 130, 'Cloud Source Repos');
      const build = N('gcp-build', 470, 130, 'Cloud Build');
      const ar = N('gcp-artifact', 700, 130, 'Artifact Registry');
      const gke = N('gcp-gke', 910, 130, 'GKE rollout');
      const approve = N('cloud-generic', 700, 330, 'Approval gate');
      const mon = N('gcp-monitoring', 910, 330, 'Rollout health');
      return [
        TITLE(40, 76, 'Build, publish and roll out'),
        dev,
        repo,
        build,
        ar,
        gke,
        approve,
        mon,
        A(dev, 'right', repo, 'left', { text: 'push' }),
        A(repo, 'right', build, 'left', { text: 'trigger' }),
        A(build, 'right', ar, 'left', { text: 'docker push' }),
        A(ar, 'right', gke, 'left', { text: 'pull digest' }),
        A(build, 'bottom', approve, 'top', { text: 'deploy gate' }),
        A(approve, 'right', gke, 'bottom', { text: 'rollout', routing: 'curved' }),
        A(gke, 'bottom', mon, 'top', { text: 'rollout status' }),
        NOTE(40, 560, 'Pin the deployed digest, not a mutable tag, so a rerun deploys exactly the tested image.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcp-10-recovery',
    name: 'GCP-10 Recovery design',
    description: 'Dual-region deployment, Cloud SQL replica, multi-region bucket and documented failover',
    provider: 'GCP',
    frameTitle: 'Lesson: Recovery and failover on Google Cloud',
    teaching:
      'A global load balancer shifts traffic between regional backends. Cloud SQL has a cross-region replica and Cloud Storage uses a multi-region bucket; the failover runbook is exercised separately.',
    build() {
      const users = N('cloud-generic', 40, 130, 'Users');
      const lb = N('gcp-lb', 250, 130, 'Global load balancer');
      const primary = N('gcp-cloudrun', 470, 130, 'Region A service');
      const secondary = N('gcp-cloudrun', 470, 330, 'Region B service');
      const sqlP = N('gcp-cloudsql', 700, 130, 'Cloud SQL primary');
      const sqlS = N('gcp-cloudsql', 700, 330, 'Cloud SQL replica');
      const bucket = N('gcp-gcs', 910, 330, 'Multi-region bucket');
      const mon = N('gcp-monitoring', 910, 130, 'Uptime + alerts');
      return [
        TITLE(40, 76, 'Active-passive multi-region recovery'),
        users,
        lb,
        primary,
        secondary,
        sqlP,
        sqlS,
        bucket,
        mon,
        A(users, 'right', lb, 'left', { text: 'HTTPS' }),
        A(lb, 'right', primary, 'left', { text: 'primary backend' }),
        A(lb, 'bottom', secondary, 'left', { text: 'failover backend', routing: 'curved' }),
        A(primary, 'right', sqlP, 'left'),
        A(sqlP, 'bottom', sqlS, 'top', { text: 'cross-region replica' }),
        A(sqlS, 'right', bucket, 'left', { text: 'durable export' }),
        A(mon, 'left', lb, 'right', { text: 'uptime check', routing: 'curved' }),
        NOTE(40, 560, 'Promote the replica before shifting traffic; the runbook states the acceptance check for each step.'),
      ];
    },
  }),
];
