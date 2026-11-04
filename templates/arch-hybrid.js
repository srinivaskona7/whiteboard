// templates/arch-hybrid.js — cross-cloud / hybrid teaching architectures.
// Authority: hybrid topology relationships documented for the 2026-11 pack;
// every diagram is plain stencil + arrow elements, not an image.
// Parity with the AWS/Azure/GCP packs: ten diagrams, one teaching sentence each.
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
  provider: 'Cross-cloud',
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
    for (const el of [frame, ...nodes]) el.templateId = spec.id;
    return [frame, ...nodes];
  },
});

export const ARCH_HYBRID_TEMPLATES = [
  diagram({
    id: 'tpl-hyb-multicloud-dr',
    name: 'HYB-01 Multicloud disaster recovery',
    description: 'Route 53 latency + failover between an AWS region and an Azure region with cross-cloud data replication',
    frameTitle: 'Lesson: cross-cloud disaster recovery',
    teaching:
      'Cross-cloud DR trades cheap for resilient: the second cloud only pays off if its stack is warm and its data is current. State RTO (how long until traffic flips) and RPO (how much replication lag you can lose) before choosing the replication link, not after.',
    h: 660,
    build() {
      const users = N('cloud-generic', 40, 130, 'Global users');
      const r53 = N('aws-route53', 250, 130, 'Route 53 latency + failover');
      const health = N('aws-cloudwatch', 250, 300, 'Health checks (both regions)');
      const awsLb = N('aws-alb', 460, 130, 'AWS region: ALB');
      const awsApp = N('aws-ec2', 460, 300, 'EC2 Auto Scaling');
      const aurora = N('aws-rds', 460, 470, 'Aurora primary');
      const azLb = N('az-appgw', 670, 130, 'Azure region: App Gateway');
      const azApp = N('az-vm', 670, 300, 'VM scale set');
      const azSql = N('az-sql', 670, 470, 'Azure SQL target');
      return [
        TITLE(40, 76, 'Active stack on AWS, warm standby on Azure'),
        users,
        r53,
        health,
        awsLb,
        awsApp,
        aurora,
        azLb,
        azApp,
        azSql,
        A(users, 'right', r53, 'left', { text: 'DNS query' }),
        A(r53, 'right', awsLb, 'left', { text: 'primary record' }),
        A(r53, 'right', azLb, 'left', { text: 'failover record', routing: 'curved' }),
        A(health, 'top', r53, 'bottom', { text: 'route unhealthy' }),
        A(awsLb, 'bottom', awsApp, 'top', { text: 'target group' }),
        A(awsApp, 'bottom', aurora, 'top', { text: 'read/write' }),
        A(azLb, 'bottom', azApp, 'top', { text: 'backend pool' }),
        A(azApp, 'bottom', azSql, 'top', { text: 'read/write' }),
        A(aurora, 'right', azSql, 'left', { text: 'cross-cloud replication (RPO)' }),
        NOTE(40, 620, 'The failover record is worthless if the standby is cold. Keep the Azure stack sized and the replication lag measured — rehearse the cutover quarterly.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-landing-zone',
    name: 'HYB-02 Enterprise landing zone',
    description: 'Management groups and Organizations on top, shared identity, network hubs, guardrails and central logging below',
    frameTitle: 'Lesson: a landing zone both clouds can share',
    teaching:
      'A landing zone is scaffolding before workloads: identity first, network second, guardrails third. Mirror the structure per cloud — management groups for Azure, Organizations for AWS — but keep exactly one identity source and one log store so audits do not fork.',
    build() {
      const mgmt = N('flow-process', 40, 130, 'Azure management groups');
      const org = N('flow-process', 250, 130, 'AWS Organizations (accounts)');
      const entra = N('az-entra', 40, 300, 'Entra ID tenant');
      const iam = N('aws-iam', 250, 300, 'IAM Identity Center');
      const tgw = N('aws-tgw', 460, 130, 'AWS network hub (TGW)');
      const hubVnet = N('az-vnet', 670, 130, 'Azure hub VNet + firewall');
      const policy = N('sec-opa', 460, 300, 'Guardrails (SCP + policy)');
      const logs = N('obs-loki', 670, 300, 'Central log store');
      const trail = N('aws-cloudtrail', 880, 300, 'CloudTrail');
      const azmon = N('az-monitor', 880, 130, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Shared scaffolding: identity, network, guardrails, logs'),
        mgmt,
        org,
        entra,
        iam,
        tgw,
        hubVnet,
        policy,
        logs,
        trail,
        azmon,
        A(mgmt, 'right', org, 'left', { text: 'subscription → account mapping' }),
        A(mgmt, 'bottom', entra, 'top', { text: 'delegated identity' }),
        A(org, 'bottom', iam, 'top', { text: 'SCPs bound to accounts' }),
        A(entra, 'right', iam, 'left', { text: 'federated administrators' }),
        A(tgw, 'right', hubVnet, 'left', { text: 'cross-cloud transit' }),
        A(iam, 'right', policy, 'left', { text: 'identity guardrails' }),
        A(tgw, 'bottom', policy, 'top', { text: 'network guardrails' }),
        A(trail, 'left', logs, 'right', { text: 'audit events' }),
        A(azmon, 'bottom', logs, 'top', { text: 'diagnostics', routing: 'curved' }),
        NOTE(40, 560, 'Tenants are cheap; sprawl is not. One identity source, one log store, and guardrails that both clouds inherit — otherwise every new team re-invents the landing zone.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-identity-federation',
    name: 'HYB-03 Cross-cloud identity federation',
    description: 'On-premises AD synced into Entra ID, SAML-federated to AWS IAM, with workload identity mapped via OIDC',
    frameTitle: 'Lesson: one identity source, many clouds',
    teaching:
      'Users sign in once: AD syncs into Entra ID, Entra ID issues a SAML assertion, and AWS IAM turns that assertion into a short-lived role session. Workloads skip users entirely — the pod proves its own identity through OIDC federation. No password ever crosses a cloud boundary.',
    build() {
      const ad = N('cloud-vm', 40, 130, 'On-premises Active Directory');
      const entra = N('az-entra', 250, 130, 'Entra ID (IdP)');
      const iam = N('aws-iam', 460, 130, 'AWS IAM SAML provider');
      const role = N('aws-iam', 670, 130, 'IAM role (assumed)');
      const console = N('net-browser', 880, 130, 'AWS console / CLI');
      const sync = N('flow-process', 40, 300, 'AD Connect sync');
      const oidc = N('sec-oidc', 250, 300, 'OIDC federation');
      const workload = N('k8s-pod', 460, 300, 'Workload (pod identity)');
      return [
        TITLE(40, 76, 'Federated people, federated workloads'),
        ad,
        entra,
        iam,
        role,
        console,
        sync,
        oidc,
        workload,
        A(ad, 'right', entra, 'left', { text: 'directory sync' }),
        A(entra, 'right', iam, 'left', { text: 'SAML 2.0 assertion' }),
        A(iam, 'right', role, 'left', { text: 'AssumeRoleWithSAML' }),
        A(role, 'right', console, 'left', { text: 'temporary credentials' }),
        A(ad, 'bottom', sync, 'top', { text: 'password hash sync' }),
        A(sync, 'right', oidc, 'left', { text: 'one identity source' }),
        A(entra, 'bottom', oidc, 'top', { text: 'OIDC token issuer' }),
        A(oidc, 'right', workload, 'left', { text: 'workload identity federation' }),
        NOTE(40, 560, 'Every arrow ends in a short-lived credential. If a diagram shows a cloud holding a long-lived password, that is the design error to fix first.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-data-replication',
    name: 'HYB-04 Cross-cloud data replication',
    description: 'DynamoDB global tables bridged to Cosmos DB through Functions and change feeds, with conflict resolution',
    frameTitle: 'Lesson: replicating data across clouds',
    teaching:
      'Two clouds agreeing on one row is a consistency problem, not a plumbing problem. The change feed moves the data, but someone must decide what happens when both sides edit the same key — last-writer-wins is a business decision dressed up as a config flag.',
    build() {
      const ddb = N('aws-dynamodb', 40, 130, 'DynamoDB global table');
      const ddbStream = N('flow-data', 250, 130, 'DynamoDB stream');
      const bridge = N('az-functions', 460, 130, 'Functions change bridge');
      const cosmos = N('az-cosmos', 670, 130, 'Cosmos DB (multi-region)');
      const feed = N('flow-data', 460, 300, 'Cosmos change feed');
      const conflict = N('flow-decision', 670, 300, 'Conflict resolution (LWW)');
      const back = N('aws-lambda', 250, 300, 'Lambda write-back');
      const monitor = N('aws-cloudwatch', 880, 300, 'Replication lag monitor');
      return [
        TITLE(40, 76, 'Change feed out, change feed back'),
        ddb,
        ddbStream,
        bridge,
        cosmos,
        feed,
        conflict,
        back,
        monitor,
        A(ddb, 'right', ddbStream, 'left', { text: 'stream records' }),
        A(ddbStream, 'right', bridge, 'left', { text: 'poll shards' }),
        A(bridge, 'right', cosmos, 'left', { text: 'write (eventual)' }),
        A(bridge, 'bottom', feed, 'top', { text: 'change feed' }),
        A(feed, 'right', conflict, 'left', { text: 'concurrent edit?' }),
        A(feed, 'left', back, 'right', { text: 'reverse sync' }),
        A(back, 'left', ddb, 'bottom', { text: 'merged writes', routing: 'curved' }),
        A(conflict, 'right', monitor, 'left', { text: 'lag + conflict metrics' }),
        NOTE(40, 560, 'Measure the lag, then choose: eventual consistency for carts, strong for payments. A silent conflict-resolution rule is how two clouds quietly disagree about an order.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-service-mesh',
    name: 'HYB-05 Cross-cloud service mesh',
    description: 'Istio-style mesh spanning EKS and AKS: shared gateways, mTLS workload identity, traffic policy and telemetry',
    frameTitle: 'Lesson: one mesh, two clouds',
    teaching:
      'The mesh makes the network honest: every call between clusters is mTLS with a workload identity, so a compromised pod cannot impersonate its neighbour. The control plane stays per-cluster — only the root of trust and the policy are shared, which keeps a cloud outage from taking out the mesh too.',
    h: 660,
    build() {
      const users = N('net-user', 40, 130, 'Clients');
      const gw = N('net-envoy', 250, 130, 'East-west gateway');
      const eks = N('aws-eks', 460, 130, 'EKS cluster (AWS)');
      const aks = N('az-aks', 670, 130, 'AKS cluster (Azure)');
      const mesh = N('k8s-mesh', 250, 300, 'Istio control plane');
      const podA = N('k8s-pod', 460, 300, 'pod: checkout svc');
      const podB = N('k8s-pod', 670, 300, 'pod: payments svc');
      const tls = N('concept-tls', 460, 470, 'mTLS workload identity');
      const policy = N('sec-opa', 880, 130, 'Traffic policy');
      const prom = N('obs-prometheus', 880, 300, 'Mesh telemetry');
      return [
        TITLE(40, 76, 'East-west traffic with a shared root of trust'),
        users,
        gw,
        eks,
        aks,
        mesh,
        podA,
        podB,
        tls,
        policy,
        prom,
        A(users, 'right', gw, 'left', { text: 'HTTPS' }),
        A(gw, 'right', eks, 'left', { text: 'ingress (AWS)' }),
        A(gw, 'right', aks, 'left', { text: 'ingress (Azure)', routing: 'curved' }),
        A(mesh, 'right', podA, 'left', { text: 'pilot config (EKS)' }),
        A(mesh, 'bottom', podB, 'top', { text: 'pilot config (AKS)', routing: 'curved' }),
        A(eks, 'bottom', podA, 'top', { text: 'sidecar inject' }),
        A(aks, 'bottom', podB, 'top', { text: 'sidecar inject' }),
        A(podA, 'right', podB, 'left', { text: 'mTLS call' }),
        A(podA, 'bottom', tls, 'top', { text: 'SVID certificates' }),
        A(aks, 'right', policy, 'left', { text: 'policy decisions' }),
        A(podB, 'right', prom, 'left', { text: 'golden signals' }),
        NOTE(40, 620, 'Retries and timeouts live in the mesh, not in the code. Set a retry budget per route, or a flaky dependency multiplies its own traffic.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-gitops-multicluster',
    name: 'HYB-06 Multicluster GitOps',
    description: 'Git overlays → CI build → registries (ECR, ACR, Artifact Registry) → Argo CD fleet reconciling EKS, AKS and GKE',
    frameTitle: 'Lesson: one repo, one fleet, three clouds',
    teaching:
      'Build once, promote a digest: the same image lands in every registry and every cluster pulls by digest, so a deploy can never drift from what was tested. Argo CD reconciles instead of pushing — a cluster that was offline comes back and converges on its own.',
    h: 660,
    build() {
      const dev = N('cloud-generic', 40, 130, 'Platform engineers');
      const git = N('git-repo', 250, 130, 'Git: environment overlays');
      const ci = N('cicd-gh-actions', 460, 130, 'CI: build + test');
      const argo = N('cicd-argocd', 250, 300, 'Argo CD fleet control');
      const policy = N('flow-decision', 40, 300, 'Rollout policy (canary)');
      const ecr = N('aws-ecr', 460, 300, 'ECR registry (AWS)');
      const acr = N('az-acr', 670, 300, 'ACR registry (Azure)');
      const art = N('gcp-artifact', 880, 300, 'Artifact Registry (GCP)');
      const eks = N('aws-eks', 250, 470, 'EKS workloads');
      const aks = N('az-aks', 460, 470, 'AKS workloads');
      const gke = N('gcp-gke', 670, 470, 'GKE workloads');
      return [
        TITLE(40, 76, 'Reconcile the fleet from one repository'),
        dev,
        git,
        ci,
        argo,
        policy,
        ecr,
        acr,
        art,
        eks,
        aks,
        gke,
        A(dev, 'right', git, 'left', { text: 'push' }),
        A(git, 'right', ci, 'left', { text: 'pipeline trigger' }),
        A(git, 'bottom', argo, 'top', { text: 'watch env overlays' }),
        A(ci, 'bottom', ecr, 'top', { text: 'push image digest' }),
        A(ecr, 'right', acr, 'left', { text: 'replication rule' }),
        A(acr, 'right', art, 'left', { text: 'replication rule' }),
        A(policy, 'right', argo, 'left', { text: 'canary gate' }),
        A(argo, 'bottom', eks, 'top', { text: 'sync' }),
        A(argo, 'bottom', aks, 'top', { text: 'sync', routing: 'curved' }),
        A(argo, 'bottom', gke, 'top', { text: 'sync', routing: 'curved' }),
        NOTE(40, 620, 'Fleet drift is detected, not prevented: Argo shows every cluster that is not at the desired revision. That report is the morning standup.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-edge-computing',
    name: 'HYB-07 Multicloud edge delivery',
    description: 'Latency DNS steering CloudFront and Front Door edges into regional hubs and multi-cloud origins',
    frameTitle: 'Lesson: the edge is the first line of scaling',
    teaching:
      'Every cache hit never touches an origin, so hit ratio is the cheapest scaling lever there is. TTL and stale-while-revalidate decide how stale a answer may be — that is a per-URL business decision, and the eviction policy should differ for dashboards and deployments.',
    h: 660,
    build() {
      const users = N('net-user', 40, 130, 'Global users');
      const steering = N('aws-route53', 250, 130, 'Latency-based DNS');
      const cf = N('aws-cloudfront', 460, 130, 'CloudFront edge (AWS)');
      const fd = N('az-frontdoor', 670, 130, 'Front Door edge (Azure)');
      const hubA = N('aws-alb', 460, 300, 'AWS regional hub');
      const hubB = N('az-lb', 670, 300, 'Azure regional hub');
      const originA = N('aws-s3', 460, 470, 'S3 origin (static)');
      const originB = N('az-blob', 670, 470, 'Blob origin');
      const gcs = N('gcp-gcs', 880, 470, 'GCS archive tier');
      return [
        TITLE(40, 76, 'Serve from the closest cache, origin only on miss'),
        users,
        steering,
        cf,
        fd,
        hubA,
        hubB,
        originA,
        originB,
        gcs,
        A(users, 'right', steering, 'left', { text: 'resolve nearest' }),
        A(steering, 'right', cf, 'left', { text: 'latency record' }),
        A(steering, 'right', fd, 'left', { text: 'latency record', routing: 'curved' }),
        A(cf, 'bottom', hubA, 'top', { text: 'cache miss' }),
        A(fd, 'bottom', hubB, 'top', { text: 'cache miss' }),
        A(hubA, 'bottom', originA, 'top', { text: 'origin pull' }),
        A(hubB, 'bottom', originB, 'top', { text: 'origin pull' }),
        A(originB, 'right', gcs, 'left', { text: 'lifecycle archive' }),
        NOTE(40, 620, 'Watch two numbers: hit ratio and origin latency. When hit ratio drops, users pay the full round trip — and so does the cloud bill.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-network-migration',
    name: 'HYB-08 Phased migration waves',
    description: 'Wave 1 stateless lift, wave 2 data replication, wave 3 DNS cutover — with a rehearsed rollback lane',
    frameTitle: 'Lesson: migrate in waves, keep a rollback lane',
    teaching:
      'Waves exist to shrink the blast radius: stateless first because it can be re-pointed in minutes, data second because replication must prove its lag, cutover last because DNS is the moment users notice. The rollback lane is rehearsed before it is needed, never after.',
    h: 660,
    build() {
      const start = N('flow-terminator', 40, 130, 'Discovery + dependency map');
      const wave1 = N('flow-process', 250, 130, 'Wave 1: stateless (lift)');
      const wave2 = N('flow-process', 460, 130, 'Wave 2: data (replicate)');
      const wave3 = N('flow-process', 670, 130, 'Wave 3: cutover');
      const dns = N('net-dns', 880, 130, 'DNS switch (low TTL)');
      const runbook = N('flow-document', 40, 300, 'Cutover runbook + comms');
      const vm = N('cloud-vm', 250, 300, 'Rehosted VMs (target)');
      const repl = N('aws-dynamodb', 460, 300, 'Replica sync (CDC)');
      const gate = N('flow-decision', 670, 300, 'Validation passed?');
      const done = N('flow-terminator', 880, 300, 'Decommission source');
      const rollback = N('flow-process', 670, 470, 'Rollback lane (revert DNS)');
      return [
        TITLE(40, 76, 'Three waves and the lane you hope not to use'),
        start,
        wave1,
        wave2,
        wave3,
        dns,
        runbook,
        vm,
        repl,
        gate,
        done,
        rollback,
        A(start, 'right', wave1, 'left', { text: 'wave plan approved' }),
        A(wave1, 'right', wave2, 'left', { text: 'stateless layer stable' }),
        A(wave2, 'right', wave3, 'left', { text: 'replica lag under RPO' }),
        A(wave3, 'right', dns, 'left', { text: 'switch records' }),
        A(wave1, 'bottom', vm, 'top', { text: 'rehost onto target' }),
        A(wave2, 'bottom', repl, 'top', { text: 'seed + change capture' }),
        A(wave3, 'bottom', gate, 'top', { text: 'smoke test suite' }),
        A(gate, 'right', done, 'left', { text: 'pass: decommission' }),
        A(gate, 'bottom', rollback, 'top', { text: 'fail: revert DNS' }),
        A(runbook, 'right', vm, 'left', { text: 'checklist per wave' }),
        NOTE(40, 620, 'Lower the DNS TTL a day before cutover, not during it. Clients cache for the old TTL, which is exactly how a "finished" migration serves the old site.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-cost-observability',
    name: 'HYB-09 Multicloud cost observability',
    description: 'CloudWatch, Azure Monitor and Cloud Monitoring feeds normalized into one FinOps dashboard with tag enforcement',
    frameTitle: 'Lesson: one bill per team, not per cloud',
    teaching:
      'Cost data without a tag schema is noise: three clouds, three currencies of telemetry, no way to say what a team spent. Enforce the cost-centre tag at deploy time, normalize the exports into one model, and alert on the anomaly — not on the month-end total.',
    h: 660,
    build() {
      const cw = N('aws-cloudwatch', 40, 130, 'CloudWatch (AWS spend)');
      const azmon = N('az-monitor', 250, 130, 'Azure Monitor (cost)');
      const gmon = N('gcp-monitoring', 460, 130, 'Cloud Monitoring (GCP)');
      const tags = N('sec-opa', 40, 300, 'Tagging policy: cost centre');
      const norm = N('flow-process', 250, 300, 'Usage + billing export');
      const lake = N('gcp-bigquery', 40, 470, 'Billing data lake (BigQuery)');
      const fin = N('obs-grafana', 460, 300, 'Cross-cloud FinOps dashboard');
      const alerts = N('obs-alertmanager', 670, 300, 'Budget + anomaly alerts');
      const owner = N('sec-oidc', 880, 300, 'Budget owner per team');
      return [
        TITLE(40, 76, 'Every cloud reports to the same cost model'),
        cw,
        azmon,
        gmon,
        tags,
        norm,
        lake,
        fin,
        alerts,
        owner,
        A(cw, 'bottom', norm, 'top', { text: 'cost metrics', routing: 'curved' }),
        A(azmon, 'bottom', norm, 'top', { text: 'usage export' }),
        A(gmon, 'bottom', norm, 'top', { text: 'billing export', routing: 'curved' }),
        A(tags, 'right', norm, 'left', { text: 'tag schema enforced' }),
        A(norm, 'bottom', lake, 'left', { text: 'raw exports', routing: 'curved' }),
        A(norm, 'right', fin, 'left', { text: 'normalized cost model' }),
        A(fin, 'right', alerts, 'left', { text: 'threshold breach' }),
        A(alerts, 'right', owner, 'left', { text: 'weekly showback' }),
        NOTE(40, 620, 'An untagged resource is invisible cost: charge it back to the deploying team at 1x until tagged, and tagging suddenly happens.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-hyb-zero-trust-perimeter',
    name: 'HYB-10 Cross-cloud zero trust',
    description: 'Identity brokers, per-request policy enforcement and microsegmentation between clouds — no implicit network trust',
    frameTitle: 'Lesson: trust is evaluated, never inherited',
    teaching:
      'A VPN into a cloud grants the network; zero trust grants the request. Identity is brokered per session, the policy enforcement point re-checks every call, and microsegmentation means a compromised pod in cloud A still cannot reach cloud B without an explicit allow.',
    build() {
      const user = N('net-user', 40, 130, 'Any user / device');
      const idp = N('az-entra', 250, 130, 'Identity broker (Entra ID)');
      const iam = N('aws-iam', 460, 130, 'AWS IAM (workload roles)');
      const tls = N('concept-tls', 670, 130, 'mTLS service identity');
      const siem = N('sec-siem', 880, 130, 'Cross-cloud SIEM');
      const device = N('flow-decision', 40, 300, 'Device posture check');
      const pep = N('sec-opa', 250, 300, 'Policy enforcement (OPA)');
      const sg = N('sec-sg', 460, 300, 'Microsegmentation');
      const wA = N('k8s-pod', 670, 300, 'Service: cloud A');
      const wB = N('az-containerapps', 880, 300, 'Service: cloud B');
      return [
        TITLE(40, 76, 'Every request is checked, no network is trusted'),
        user,
        idp,
        iam,
        tls,
        siem,
        device,
        pep,
        sg,
        wA,
        wB,
        A(user, 'right', idp, 'left', { text: 'sign-in (MFA)' }),
        A(user, 'bottom', device, 'top', { text: 'device posture' }),
        A(device, 'right', pep, 'left', { text: 'compliant device token' }),
        A(idp, 'right', iam, 'left', { text: 'federated claim' }),
        A(idp, 'bottom', pep, 'top', { text: 'access token + claims' }),
        A(iam, 'bottom', sg, 'top', { text: 'role-scoped session' }),
        A(pep, 'right', sg, 'left', { text: 'allow / deny per request' }),
        A(sg, 'right', wA, 'left', { text: 'segment: app tier' }),
        A(tls, 'bottom', wA, 'top', { text: 'workload SVID' }),
        A(wA, 'right', wB, 'left', { text: 'mTLS, no implicit trust' }),
        A(iam, 'right', siem, 'left', { text: 'decision logs', routing: 'curved' }),
        NOTE(40, 560, 'Log the deny, not just the allow: the denied-call log is the earliest signal that someone is probing the boundary between the clouds.'),
      ];
    },
  }),
];
