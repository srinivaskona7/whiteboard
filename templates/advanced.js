// templates/advanced.js — the advanced pack: 14 deep-dive cloud architectures
// plus 20 classroom / methodology boards (arch packs and retro boards have
// since grown the catalog past 150).
// Same contract as the AWS and Azure/GCP packs: plain stencil + arrow elements,
// a lesson frame with teacherNotes on every cloud diagram, and templateId stamped
// on every built element so the configuration drawer adopts instead of duplicating.
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
const TXT = (x, y, w, h, text, extra = {}) =>
  createElement('text', { x, y, w, h, text, fontSize: 14, fill: '#475569', ...extra });

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

const board = (spec) => ({
  id: spec.id,
  name: spec.name,
  description: spec.description,
  build() {
    const els = spec.build();
    for (const el of els) el.templateId = spec.id;
    return els;
  },
});

const CLOUD_DIAGRAMS = [
  diagram({
    id: 'tpl-adv-zero-trust-aws',
    name: 'ADV-01 Zero-trust three-tier (AWS)',
    description: 'Cognito identity → Verified Access + WAF → private EC2 tiers → Aurora over PrivateLink, IAM least privilege',
    provider: 'AWS',
    frameTitle: 'Lesson: zero-trust three-tier on AWS',
    teaching:
      'Zero trust removes the "trusted internal network" assumption: every request is authenticated (Cognito), authorised per application (Verified Access) and filtered (WAF) before it touches a private subnet. IAM roles stay per-service so one compromised pod can only do its own job.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Remote user + device');
      const idp = N('aws-cognito', 250, 130, 'Cognito user pool');
      const va = N('aws-waf', 460, 130, 'Verified Access + WAF');
      const web = N('aws-ec2', 460, 300, 'Web tier (private)');
      const app = N('aws-ec2', 670, 300, 'App tier');
      const db = N('aws-rds', 880, 300, 'Aurora Multi-AZ');
      const pl = N('aws-privatelink', 670, 470, 'PrivateLink shared API');
      const iam = N('aws-iam', 880, 470, 'IAM per-service roles');
      return [
        TITLE(40, 76, 'Zero-trust perimeter around a three-tier core'),
        user,
        idp,
        va,
        web,
        app,
        db,
        pl,
        iam,
        A(user, 'right', idp, 'left', { text: 'sign-in + MFA' }),
        A(idp, 'right', va, 'left', { text: 'verified session token' }),
        A(va, 'bottom', web, 'top', { text: 'app-level access only' }),
        A(web, 'right', app, 'left', { text: 'internal 8080' }),
        A(app, 'right', db, 'left', { text: '3306 private subnet' }),
        A(app, 'bottom', pl, 'top', { text: 'private service call' }),
        A(db, 'bottom', iam, 'top', { text: 'role, not root', routing: 'curved' }),
        NOTE(40, 590, 'No security group rule allows 0.0.0.0/0 except the Verified Access/WAF entry point. Everything else is reached through identity, not network location.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-ml-pipeline-aws',
    name: 'ADV-02 ML training pipeline (AWS)',
    description: 'S3 raw data → Glue catalog → SageMaker training → real-time endpoint → inference Lambda',
    provider: 'AWS',
    frameTitle: 'Lesson: ML training pipeline on AWS',
    teaching:
      'Data quality is decided in the bronze layer, not the model: Glue gives one catalogued schema so training and inference read the same features. The training job produces a versioned model; the endpoint serves it, and CloudWatch watches both data drift and latency.',
    build() {
      const s3 = N('aws-s3', 40, 130, 'S3 raw data lake');
      const glue = N('aws-glue', 250, 130, 'Glue catalog + ETL');
      const train = N('aws-ec2', 460, 130, 'SageMaker training job');
      const ep = N('aws-lambda', 670, 130, 'Real-time endpoint');
      const inv = N('aws-lambda', 880, 130, 'Inference Lambda');
      const feats = N('aws-dynamodb', 460, 300, 'Feature store');
      const cw = N('aws-cloudwatch', 670, 300, 'Drift + latency metrics');
      return [
        TITLE(40, 76, 'From raw objects to a served prediction'),
        s3,
        glue,
        train,
        ep,
        inv,
        feats,
        cw,
        A(s3, 'right', glue, 'left', { text: 'crawl + schema' }),
        A(glue, 'right', train, 'left', { text: 'training dataset' }),
        A(train, 'right', ep, 'left', { text: 'register + deploy model' }),
        A(ep, 'right', inv, 'left', { text: 'Invoke 200 OK' }),
        A(feats, 'top', train, 'bottom', { text: 'consistent features' }),
        A(train, 'bottom', cw, 'top', { text: 'training metrics', routing: 'curved' }),
        A(inv, 'bottom', cw, 'right', { text: 'p99 latency' }),
        NOTE(40, 590, 'Training and serving share the Glue schema and the feature store, so a model is never surprised by a feature the pipeline never saw.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-hybrid-aws',
    name: 'ADV-03 Hybrid hub-and-spoke (AWS)',
    description: 'On-premises ↔ Direct Connect ↔ Transit Gateway hub with spoke VPCs and PrivateLink shared services',
    provider: 'AWS',
    frameTitle: 'Lesson: hybrid hub-and-spoke networking',
    teaching:
      'One Direct Connect attachment into a Transit Gateway beats a full mesh: every spoke VPC reaches on-prem and every other spoke through one hop, and route tables decide which spokes may talk. Shared services are consumed over PrivateLink so nothing is exposed past the hub.',
    build() {
      const onprem = N('cloud-generic', 40, 130, 'On-premises data centre');
      const dx = N('aws-directconnect', 250, 130, 'Direct Connect 1 Gbps');
      const tgw = N('aws-tgw', 460, 130, 'Transit Gateway (hub)');
      const spokeA = N('aws-vpc', 460, 300, 'Spoke VPC: workloads');
      const spokeB = N('aws-vpc', 670, 300, 'Spoke VPC: analytics');
      const pl = N('aws-privatelink', 670, 470, 'PrivateLink shared services');
      const rds = N('aws-rds', 880, 470, 'Shared services host');
      return [
        TITLE(40, 76, 'Hub-and-spoke hybrid connectivity'),
        onprem,
        dx,
        tgw,
        spokeA,
        spokeB,
        pl,
        rds,
        A(onprem, 'right', dx, 'left', { text: 'private VIF' }),
        A(dx, 'right', tgw, 'left', { text: 'transit attachment' }),
        A(tgw, 'bottom', spokeA, 'top', { text: 'attachment' }),
        A(tgw, 'right', spokeB, 'top', { text: 'attachment', routing: 'curved' }),
        A(spokeA, 'right', pl, 'left', { text: 'private endpoint' }),
        A(pl, 'right', rds, 'left', { text: 'service behind the endpoint' }),
        NOTE(40, 590, 'The hub never sees the internet. Spoke-to-spoke traffic is optional per route table, so one compromised spoke cannot enumerate its neighbours.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-microservices-aws',
    name: 'ADV-04 Microservices with sagas (AWS)',
    description: 'API Gateway → ECS services, EventBridge choreography and a Step Functions saga over DynamoDB',
    provider: 'AWS',
    frameTitle: 'Lesson: choreography plus an explicit saga',
    teaching:
      'Choreography (EventBridge) keeps services decoupled for ordinary events, but a multi-step business transaction needs one explicit saga in Step Functions so compensation is visible and testable. Each service owns its table; nothing shares a database.',
    build() {
      const gw = N('aws-apigw', 40, 130, 'API Gateway (REST)');
      const orders = N('aws-ecs', 250, 130, 'Orders ECS service');
      const saga = N('aws-stepfunctions', 460, 130, 'Step Functions saga');
      const ddb = N('aws-dynamodb', 670, 130, 'Orders table');
      const bus = N('aws-eventbridge', 460, 300, 'EventBridge bus');
      const pay = N('aws-ecs', 250, 300, 'Payments ECS service');
      const sqs = N('aws-sqs', 670, 300, 'Payments queue');
      return [
        TITLE(40, 76, 'Decoupled services with one visible transaction'),
        gw,
        orders,
        saga,
        ddb,
        bus,
        pay,
        sqs,
        A(gw, 'right', orders, 'left', { text: 'POST /orders' }),
        A(orders, 'right', saga, 'left', { text: 'start checkout saga' }),
        A(orders, 'bottom', ddb, 'left', { text: 'own table', routing: 'curved' }),
        A(orders, 'bottom', bus, 'top', { text: 'emit OrderPlaced' }),
        A(saga, 'bottom', pay, 'top', { text: 'compensatable task' }),
        A(bus, 'right', sqs, 'left', { text: 'rule → target queue' }),
        A(sqs, 'left', pay, 'right', { text: 'poll' }),
        NOTE(40, 590, 'The saga state machine shows every retry and compensation step on one diagram — that auditability is exactly what pure event choreography lacks.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-edge-iot-aws',
    name: 'ADV-05 Edge IoT telemetry (AWS)',
    description: 'IoT Core → Kinesis → transform Lambda → Timestream and DynamoDB → QuickSight dashboards',
    provider: 'AWS',
    frameTitle: 'Lesson: IoT telemetry at the edge',
    teaching:
      'Devices speak MQTT to IoT Core, which scales past any hand-built broker; Kinesis absorbs the burst so a slow consumer never back-pressures the fleet. Time series go to Timestream, the latest state per device goes to DynamoDB, and QuickSight reads both without a moving part of its own.',
    build() {
      const fleet = N('cloud-generic', 40, 130, 'IoT Core: device gateway');
      const kinesis = N('aws-kinesis', 250, 130, 'Kinesis streams');
      const fn = N('aws-lambda', 460, 130, 'Edge transform Lambda');
      const ts = N('aws-dynamodb', 670, 130, 'Timestream (time series)');
      const qs = N('aws-athena', 880, 130, 'QuickSight dashboards');
      const ddb = N('aws-dynamodb', 460, 300, 'DynamoDB device registry');
      return [
        TITLE(40, 76, 'From device telemetry to a classroom dashboard'),
        fleet,
        kinesis,
        fn,
        ts,
        qs,
        ddb,
        A(fleet, 'right', kinesis, 'left', { text: 'MQTT batches' }),
        A(kinesis, 'right', fn, 'left', { text: 'shard consumer' }),
        A(fn, 'right', ts, 'left', { text: 'store samples' }),
        A(ts, 'right', qs, 'left', { text: 'SQL over the timeline' }),
        A(fn, 'bottom', ddb, 'top', { text: 'upsert last known state' }),
        NOTE(40, 590, 'Kinesis retains the stream for hours, so a bug in the transform Lambda can be fixed and the window replayed — the fleet never knows.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-zero-trust-az',
    name: 'ADV-06 Zero-trust around AKS (Azure)',
    description: 'Entra conditional access → Azure Firewall → private AKS, Bastion admin plane, Private Endpoint SQL',
    provider: 'Azure',
    frameTitle: 'Lesson: zero-trust around AKS',
    teaching:
      'Entra conditional access decides before the network does: device compliance and phishing-resistant MFA come first, Azure Firewall inspects what is left, and the AKS API server is private. Admins enter through Bastion, never through a public jump box, and SQL is reached only via Private Endpoint.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Hybrid workforce');
      const entra = N('az-entra', 250, 130, 'Entra conditional access');
      const fw = N('az-firewall', 460, 130, 'Azure Firewall');
      const aks = N('az-aks', 670, 130, 'AKS (private cluster)');
      const bastion = N('az-bastion', 250, 300, 'Bastion admin plane');
      const pe = N('az-private-endpoint', 670, 300, 'Private endpoints');
      const sql = N('az-sql', 880, 300, 'Azure SQL (no public endpoint)');
      return [
        TITLE(40, 76, 'Identity-first perimeter around a private cluster'),
        user,
        entra,
        fw,
        aks,
        bastion,
        pe,
        sql,
        A(user, 'right', entra, 'left', { text: 'phishing-resistant MFA' }),
        A(entra, 'right', fw, 'left', { text: 'compliant device required' }),
        A(fw, 'right', aks, 'left', { text: 'inspected L7 traffic' }),
        A(bastion, 'bottom', aks, 'left', { text: 'SSH/RDP never exposed', routing: 'curved' }),
        A(aks, 'bottom', pe, 'top', { text: 'private traffic only' }),
        A(pe, 'right', sql, 'left', { text: 'private IP' }),
        NOTE(40, 590, 'Nothing in this topology trusts the source IP: trust comes from the Entra token and the device state, and every control plane has its own door.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-ml-az',
    name: 'ADV-07 ML pipeline (Azure)',
    description: 'Blob → Data Factory → ML workspace training → AKS inference, App Insights on drift',
    provider: 'Azure',
    frameTitle: 'Lesson: ML pipeline on Azure',
    teaching:
      'Data Factory moves and curates the data, the ML workspace trains and registers a versioned model, and AKS serves it with autoscaling GPUs. App Insights closes the loop: it records inference latency and prediction distributions so retraining is triggered by evidence, not by a calendar.',
    build() {
      const blob = N('az-blob', 40, 130, 'Blob raw data');
      const adf = N('az-logicapps', 250, 130, 'Data Factory pipelines');
      const ml = N('az-aks', 460, 130, 'ML workspace (training)');
      const aks = N('az-aks', 670, 130, 'AKS inference cluster');
      const ai = N('az-appinsights', 880, 130, 'App Insights');
      const meta = N('az-sql', 460, 300, 'Experiment tracking store');
      return [
        TITLE(40, 76, 'Curated data in, monitored predictions out'),
        blob,
        adf,
        ml,
        aks,
        ai,
        meta,
        A(blob, 'right', adf, 'left', { text: 'ingest + transform' }),
        A(adf, 'right', ml, 'left', { text: 'curated dataset' }),
        A(ml, 'right', aks, 'left', { text: 'register + deploy model' }),
        A(aks, 'right', ai, 'left', { text: 'inference telemetry' }),
        A(ml, 'bottom', meta, 'top', { text: 'runs, params, metrics' }),
        NOTE(40, 590, 'The workspace tracks every experiment in the SQL store, so "which model are we serving and why" always has an auditable answer.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-hybrid-az',
    name: 'ADV-08 Hybrid hub-and-spoke (Azure)',
    description: 'On-premises ↔ ExpressRoute ↔ hub vWAN with Azure Firewall, spokes and Private Endpoints',
    provider: 'Azure',
    frameTitle: 'Lesson: hybrid hub-and-spoke on Azure',
    teaching:
      'ExpressRoute gives a private circuit into the hub virtual WAN, and the hub firewall is the single place egress and spoke-to-spoke traffic are inspected — so routing and security policy are written once, not per spoke. Private Endpoints keep the databases out of public DNS entirely.',
    build() {
      const onprem = N('cloud-generic', 40, 130, 'On-premises network');
      const er = N('az-expressroute', 250, 130, 'ExpressRoute circuit');
      const hub = N('az-vnet', 460, 130, 'Hub virtual WAN');
      const fw = N('az-firewall', 460, 300, 'Azure Firewall (hub)');
      const spokeA = N('az-vnet', 670, 300, 'Spoke: applications');
      const spokeB = N('az-vnet', 880, 130, 'Spoke: data platform');
      const pe = N('az-private-endpoint', 670, 470, 'Private endpoints');
      const sql = N('az-sql', 880, 470, 'Azure SQL (private)');
      return [
        TITLE(40, 76, 'One hub, many spokes, one firewall policy'),
        onprem,
        er,
        hub,
        fw,
        spokeA,
        spokeB,
        pe,
        sql,
        A(onprem, 'right', er, 'left', { text: 'BGP peering' }),
        A(er, 'right', hub, 'left', { text: 'private circuit' }),
        A(hub, 'bottom', fw, 'top', { text: 'route via hub firewall' }),
        A(fw, 'right', spokeA, 'left', { text: 'inspected flow' }),
        A(hub, 'right', spokeB, 'left', { text: 'peering', routing: 'curved' }),
        A(spokeA, 'bottom', pe, 'top', { text: 'private service traffic' }),
        A(pe, 'right', sql, 'left', { text: 'private IP' }),
        NOTE(40, 590, 'Peering spokes through the hub means one route table change reaches every spoke — the operational win of a hub-and-spoke over a mesh.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-apim-az',
    name: 'ADV-09 API management with events (Azure)',
    description: 'APIM → Logic Apps and Functions microservices, Service Bus commands, Event Grid notifications',
    provider: 'Azure',
    frameTitle: 'Lesson: API management and eventing on Azure',
    teaching:
      'APIM is the contract: partners get keys, quotas and policies at the edge while Logic Apps and Functions stay swappable behind it. Commands flow through Service Bus so bursts queue instead of failing, and Event Grid fans out what happened to whoever cares.',
    build() {
      const client = N('cloud-generic', 40, 130, 'Partner + mobile clients');
      const apim = N('az-apim', 250, 130, 'APIM (policies, keys)');
      const la = N('az-logicapps', 460, 130, 'Logic Apps workflows');
      const eg = N('az-eventgrid', 670, 130, 'Event Grid');
      const fn = N('az-functions', 460, 300, 'Functions (HTTP)');
      const sb = N('az-servicebus', 670, 300, 'Service Bus topics');
      return [
        TITLE(40, 76, 'Front-door API with queued commands and events'),
        client,
        apim,
        la,
        eg,
        fn,
        sb,
        A(client, 'right', apim, 'left', { text: 'subscribe + key' }),
        A(apim, 'right', la, 'left', { text: 'validate + forward' }),
        A(apim, 'bottom', fn, 'top', { text: 'route by operation' }),
        A(la, 'right', eg, 'left', { text: 'publish events' }),
        A(fn, 'right', sb, 'left', { text: 'queue commands' }),
        A(eg, 'bottom', sb, 'top', { text: 'fan-out to subscribers', routing: 'curved' }),
        NOTE(40, 590, 'Nothing calls a downstream service by URL except APIM: the integration contract lives in one place and versioning happens at the front door.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-zero-trust-gcp',
    name: 'ADV-10 Zero-trust around GKE (GCP)',
    description: 'IAP + Access Context → Cloud Armor → private GKE, PSC services, Workload Identity per pod',
    provider: 'GCP',
    frameTitle: 'Lesson: zero-trust around GKE',
    teaching:
      'Identity-Aware Proxy verifies the user and device before Cloud Armor even sees the request, so the GKE cluster needs no public ingress at all. Pods get their own identity through Workload Identity — one pod, one service account, no shared key files.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Workforce + devices');
      const iap = N('gcp-iam', 250, 130, 'IAP + Access Context');
      const armor = N('gcp-armor', 460, 130, 'Cloud Armor edge policy');
      const gke = N('gcp-gke', 670, 130, 'GKE (private nodes)');
      const psc = N('gcp-psc', 670, 300, 'Private Service Connect');
      const sql = N('gcp-cloudsql', 880, 300, 'Cloud SQL');
      const wi = N('gcp-iam', 250, 300, 'Workload Identity');
      return [
        TITLE(40, 76, 'BeyondCorp-style access to a private cluster'),
        user,
        iap,
        armor,
        gke,
        psc,
        sql,
        wi,
        A(user, 'right', iap, 'left', { text: 'verified session' }),
        A(iap, 'right', armor, 'left', { text: 'identity-aware request' }),
        A(armor, 'right', gke, 'left', { text: 'filtered L7 only' }),
        A(gke, 'bottom', psc, 'top', { text: 'private service path' }),
        A(psc, 'right', sql, 'left', { text: 'private IP' }),
        A(gke, 'left', wi, 'top', { text: 'one service account per workload', routing: 'curved' }),
        NOTE(40, 590, 'IAP makes the perimeter the identity, not the network: no VPN, no bastion host, and no node with a public address.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-ml-gcp',
    name: 'ADV-11 ML pipeline (GCP)',
    description: 'GCS → Dataflow → Vertex AI pipeline → model registry → Cloud Run inference',
    provider: 'GCP',
    frameTitle: 'Lesson: ML pipeline on GCP',
    teaching:
      'Dataflow does the streaming and batch ETL once, and the Vertex AI pipeline is code: every training run is a versioned DAG whose artifacts land in the model registry. Cloud Run serves the picked version so a rollback is just pointing at the previous revision.',
    build() {
      const gcs = N('gcp-gcs', 40, 130, 'GCS raw data');
      const df = N('gcp-dataflow', 250, 130, 'Dataflow pipelines');
      const vtx = N('gcp-build', 460, 130, 'Vertex AI pipeline');
      const reg = N('gcp-artifact', 460, 300, 'Model registry');
      const run = N('gcp-cloudrun', 670, 130, 'Cloud Run inference');
      const mon = N('gcp-monitoring', 880, 130, 'Cloud Monitoring');
      return [
        TITLE(40, 76, 'One pipeline from lake to serving'),
        gcs,
        df,
        vtx,
        reg,
        run,
        mon,
        A(gcs, 'right', df, 'left', { text: 'batch + stream ETL' }),
        A(df, 'right', vtx, 'left', { text: 'training dataset' }),
        A(vtx, 'bottom', reg, 'top', { text: 'trained model version' }),
        A(reg, 'right', run, 'bottom', { text: 'deploy revision', routing: 'curved' }),
        A(run, 'right', mon, 'left', { text: 'latency + drift alerts' }),
        NOTE(40, 590, 'The registry is the contract between training and serving: the serving revision always names the exact model version it loaded.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-hybrid-gcp',
    name: 'ADV-12 Hybrid hub-and-spoke (GCP)',
    description: 'On-premises ↔ Cloud VPN and Interconnect ↔ hub VPC with Cloud Router, spokes, Cloud NAT and PSC',
    provider: 'GCP',
    frameTitle: 'Lesson: hybrid hub-and-spoke on GCP',
    teaching:
      'Interconnect is the primary private circuit and Cloud VPN is the encrypted failover, both terminating in one hub VPC with Cloud Router exchanging routes. Spokes peer through the hub; Cloud NAT is their only egress, and Private Service Connect reaches managed services privately.',
    build() {
      const onprem = N('cloud-generic', 40, 130, 'On-premises data centre');
      const ic = N('gcp-interconnect', 40, 300, 'Dedicated Interconnect');
      const vpn = N('gcp-vpn', 250, 130, 'Cloud VPN (failover)');
      const hub = N('gcp-router', 250, 300, 'Hub VPC + Cloud Router');
      const spokeA = N('gcp-vpc', 460, 300, 'Spoke: app VPC');
      const spokeB = N('gcp-vpc', 460, 470, 'Spoke: data VPC');
      const nat = N('gcp-nat', 670, 300, 'Cloud NAT (egress)');
      const psc = N('gcp-psc', 670, 470, 'PSC endpoints');
      return [
        TITLE(40, 76, 'Primary circuit, encrypted failover, one hub'),
        onprem,
        ic,
        vpn,
        hub,
        spokeA,
        spokeB,
        nat,
        psc,
        A(onprem, 'right', vpn, 'top', { text: 'encrypted tunnel', routing: 'curved' }),
        A(onprem, 'bottom', ic, 'top', { text: 'private circuit' }),
        A(ic, 'right', hub, 'left', { text: 'BGP routes' }),
        A(vpn, 'bottom', hub, 'top', { text: 'failover path' }),
        A(hub, 'right', spokeA, 'left', { text: 'VPC peering' }),
        A(hub, 'bottom', spokeB, 'left', { text: 'peering', routing: 'curved' }),
        A(spokeA, 'right', nat, 'left', { text: 'egress only' }),
        A(spokeB, 'right', psc, 'left', { text: 'private service access' }),
        NOTE(40, 590, 'The Cloud Router swaps routes dynamically, so losing the Interconnect fails over to VPN without anyone editing a route by hand.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-multicloud-ingress',
    name: 'ADV-13 Multicloud ingress and failover',
    description: 'Route 53 latency routing → CloudFront on AWS and Front Door on Azure, with origins in both clouds',
    provider: 'Cross-cloud',
    frameTitle: 'Lesson: one front door across two clouds',
    teaching:
      'DNS is the failover switch: Route 53 latency-routes healthy users to the nearer CDN, and health checks demote a whole cloud when it degrades. Keeping an origin in each cloud means the failover is a routing decision, not a migration.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Global users');
      const r53 = N('aws-route53', 250, 130, 'Route 53 latency routing');
      const cf = N('aws-cloudfront', 460, 130, 'CloudFront edge (AWS)');
      const fd = N('az-frontdoor', 460, 300, 'Front Door (Azure)');
      const awsOrigin = N('aws-alb', 670, 130, 'AWS origin: ALB + ECS');
      const azOrigin = N('az-appservice', 670, 300, 'Azure origin: App Service');
      return [
        TITLE(40, 76, 'Two clouds, one name'),
        user,
        r53,
        cf,
        fd,
        awsOrigin,
        azOrigin,
        A(user, 'right', r53, 'left', { text: 'resolve app.example.com' }),
        A(r53, 'right', cf, 'left', { text: 'primary (latency)' }),
        A(r53, 'bottom', fd, 'top', { text: 'failover (health check)', routing: 'curved' }),
        A(cf, 'right', awsOrigin, 'left', { text: 'cache miss to origin' }),
        A(fd, 'right', azOrigin, 'left', { text: 'origin pool' }),
        NOTE(40, 590, 'Failover is a TTL expiry away: lower the TTL before planned work in one cloud and DNS moves users before they notice.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-adv-data-lakehouse',
    name: 'ADV-14 Cross-cloud data lakehouse',
    description: 'Ingestion → bronze/silver/gold zones → Redshift and BigQuery warehouses → Athena and dashboards',
    provider: 'Cross-cloud',
    frameTitle: 'Lesson: medallion lakehouse, vendor-neutral',
    teaching:
      'The medallion pattern is the portable part: bronze keeps raw immutable truth, silver cleans and conforms, gold aggregates for business questions. Because each layer is just bucketed files, both Redshift and BigQuery can query the same gold zone without rewriting the pipeline.',
    build() {
      const ingest = N('flow-process', 40, 130, 'Ingestion: batch + stream');
      const bronze = N('cloud-bucket', 250, 130, 'Bronze: raw, immutable');
      const silver = N('cloud-bucket', 460, 130, 'Silver: cleansed');
      const gold = N('cloud-bucket', 670, 130, 'Gold: business-ready');
      const rs = N('aws-redshift', 880, 130, 'Warehouse: Redshift');
      const bq = N('gcp-bigquery', 880, 300, 'Warehouse: BigQuery');
      const bi = N('aws-athena', 670, 300, 'Athena + dashboards');
      return [
        TITLE(40, 76, 'Bronze, silver, gold — then two warehouses read the same gold'),
        ingest,
        bronze,
        silver,
        gold,
        rs,
        bq,
        bi,
        A(ingest, 'right', bronze, 'left', { text: 'land as-is' }),
        A(bronze, 'right', silver, 'left', { text: 'clean + conform' }),
        A(silver, 'right', gold, 'left', { text: 'aggregate' }),
        A(gold, 'right', rs, 'left', { text: 'load' }),
        A(gold, 'bottom', bi, 'top', { text: 'query in place' }),
        A(rs, 'bottom', bq, 'top', { text: 'federated query', routing: 'curved' }),
        NOTE(40, 590, 'Bronze is never edited — reprocessing always starts from raw, which is what makes "fix the bug and rebuild silver" a safe operation.'),
      ];
    },
  }),
];

const CLASSROOM_BOARDS = [
  board({
    id: 'tpl-adv-retro',
    name: 'Sprint Retrospective Board',
    description: 'Mad / Sad / Glad columns with dot-voting on the top action',
    build() {
      const f1 = createElement('frame', { x: 80, y: 80, w: 300, h: 440, text: 'Mad', slideOrder: 1 });
      const f2 = createElement('frame', { x: 410, y: 80, w: 300, h: 440, text: 'Sad', slideOrder: 2 });
      const f3 = createElement('frame', { x: 740, y: 80, w: 300, h: 440, text: 'Glad', slideOrder: 3 });
      const s1 = createElement('sticky', { x: 110, y: 150, w: 240, h: 110, text: 'Staging is flaky again', fill: '#fee2e2' });
      const s2 = createElement('sticky', { x: 110, y: 280, w: 240, h: 110, text: 'Release cut at 6pm Friday', fill: '#fee2e2' });
      const s3 = createElement('sticky', { x: 440, y: 150, w: 240, h: 110, text: 'Two PRs open for a week', fill: '#bfdbfe' });
      const s4 = createElement('sticky', { x: 770, y: 150, w: 240, h: 110, text: 'Zero-downtime deploy', fill: '#bbf7d0' });
      const s5 = createElement('sticky', { x: 770, y: 280, w: 240, h: 110, text: 'New on-call rota works', fill: '#bbf7d0' });
      const voted = createElement('sticky', { x: 110, y: 560, w: 640, h: 90, text: 'Dot votes: "Staging is flaky" (5). Top action: make staging match prod config.', fill: '#fef08a' });
      return [f1, f2, f3, s1, s2, s3, s4, s5, voted];
    },
  }),

  // Start / Stop / Continue: the action-oriented retro format. The action
  // candidates carry el.votes so the LIVE dot-voting feature renders counts
  // on them the moment the teacher opens a session (Secret voting first,
  // reveal after — the facilitation note below spells out the flow).
  board({
    id: 'tpl-adv-retro-ssc',
    name: 'Retro: Start / Stop / Continue',
    description: 'Action-oriented retro with live dot-voting on next-sprint actions',
    build() {
      const f1 = createElement('frame', { x: 80, y: 80, w: 300, h: 420, text: '▶ Start', slideOrder: 1 });
      const f2 = createElement('frame', { x: 410, y: 80, w: 300, h: 420, text: '■ Stop', slideOrder: 2 });
      const f3 = createElement('frame', { x: 740, y: 80, w: 300, h: 420, text: '→ Continue', slideOrder: 3 });
      const s1 = createElement('sticky', { x: 110, y: 150, w: 240, h: 110, text: 'Rotate the on-call handover', fill: '#bbf7d0' });
      const s2 = createElement('sticky', { x: 440, y: 150, w: 240, h: 110, text: 'Friday-evening release cuts', fill: '#fee2e2' });
      const s3 = createElement('sticky', { x: 770, y: 150, w: 240, h: 110, text: 'Demo every sprint review', fill: '#bfdbfe' });
      // Vote candidates for the next sprint's top action — pre-seeded with a
      // tie so the live voting feature has something to reveal.
      const a1 = createElement('sticky', { x: 110, y: 560, w: 300, h: 90, text: 'Action: staging config parity with prod', fill: '#fef08a', votes: 3 });
      const a2 = createElement('sticky', { x: 450, y: 560, w: 300, h: 90, text: 'Action: pair-review every security change', fill: '#fef08a', votes: 3 });
      const howto = TXT(80, 670, 660, 60,
        'Facilitation: 5 min silent notes → read out → 🙈 Secret dot voting on the two actions → reveal → top action becomes a sprint item.');
      return [f1, f2, f3, s1, s2, s3, a1, a2, howto];
    },
  }),

  // 4Ls (Liked / Learned / Lacked / Longed For): the debrief format for
  // workshops and post-incident reviews.
  board({
    id: 'tpl-adv-retro-4ls',
    name: 'Retro: 4Ls Debrief',
    description: 'Liked / Learned / Lacked / Longed For — workshop and incident debrief',
    build() {
      const cols = [
        ['Liked', 80, '#bbf7d0', 'Zero-downtime deploy worked first try'],
        ['Learned', 410, '#bfdbfe', 'PrivateLink beats peering for Aurora'],
        ['Lacked', 740, '#fee2e2', 'No runbook for the failover path'],
        ['Longed For', 1070, '#f5d0fe', 'One-click prod-like environments'],
      ];
      const els = cols.map(([label, x, fill, sample], i) => [
        createElement('frame', { x, y: 80, w: 300, h: 420, text: label, slideOrder: i + 1 }),
        createElement('sticky', { x: x + 30, y: 150, w: 240, h: 110, text: sample, fill }),
      ]).flat();
      els.push(
        TXT(80, 560, 700, 60,
          'Debrief flow: each person adds one sticky per column → cluster duplicates → dot-vote the biggest lack → owner volunteers before the meeting ends.'),
        createElement('text', { x: 80, y: 30, w: 620, h: 30, text: '4Ls debrief — what we liked, learned, lacked and longed for', fontSize: 20, bold: true })
      );
      return els;
    },
  }),

  board({
    id: 'tpl-adv-estimation',
    name: 'Planning Poker Board',
    description: 'Story list table plus Fibonacci cards the team can drag onto a story',
    build() {
      const title = TXT(80, 40, 620, 30, 'Planning poker: reveal, discuss, re-vote', { fontSize: 20, bold: true, fill: '#0f172a' });
      const stories = createElement('table', {
        x: 80,
        y: 90,
        w: 560,
        h: 300,
        rows: 5,
        cols: 2,
        cells: [
          ['Story', 'Notes'],
          ['Login rate limit', '3 attempts, then lockout'],
          ['Export to CSV', 'streaming, up to 1M rows'],
          ['Dark mode', 'theme hook, no logic change'],
          ['Search filters', 'server-side, indexed'],
        ],
      });
      const cards = [1, 2, 3, 5, 8, 13].map((v, i) =>
        createElement('rect', {
          x: 80 + i * 110,
          y: 430,
          w: 90,
          h: 120,
          text: String(v),
          fill: i % 2 === 0 ? '#dbeafe' : '#dcfce7',
          textAlign: 'center',
        })
      );
      const note = TXT(80, 580, 640, 46, 'Each picker drags a card onto the story row; split anything the table cannot agree on after two rounds.');
      return [title, stories, ...cards, note];
    },
  }),

  board({
    id: 'tpl-adv-swot',
    name: 'SWOT Analysis',
    description: 'Strengths / Weaknesses / Opportunities / Threats 2x2 with axis labels',
    build() {
      const helpful = TXT(180, 60, 300, 24, 'Helpful', { fontSize: 14, bold: true, textAlign: 'center' });
      const harmful = TXT(480, 60, 300, 24, 'Harmful', { fontSize: 14, bold: true, textAlign: 'center' });
      const internal = TXT(30, 180, 130, 24, 'Internal', { fontSize: 14, bold: true });
      const external = TXT(30, 390, 130, 24, 'External', { fontSize: 14, bold: true });
      const s = createElement('rect', { x: 180, y: 90, w: 300, h: 210, text: 'Strengths', fill: '#dcfce7' });
      const w = createElement('rect', { x: 480, y: 90, w: 300, h: 210, text: 'Weaknesses', fill: '#fee2e2' });
      const o = createElement('rect', { x: 180, y: 300, w: 300, h: 210, text: 'Opportunities', fill: '#dbeafe' });
      const t = createElement('rect', { x: 480, y: 300, w: 300, h: 210, text: 'Threats', fill: '#fef9c3' });
      return [helpful, harmful, internal, external, s, w, o, t];
    },
  }),

  board({
    id: 'tpl-adv-fishbone',
    name: 'Fishbone (Ishikawa) Diagram',
    description: 'Spine, six category bones and an effect head for cause-and-effect analysis',
    build() {
      const title = TXT(80, 40, 620, 30, 'Cause and effect: why is the defect rate up 12%?', { fontSize: 20, bold: true, fill: '#0f172a' });
      const head = createElement('rect', { x: 880, y: 300, w: 200, h: 120, text: 'Effect:\ndefect rate up 12%', fill: '#fee2e2' });
      const spine = createElement('line', { x: 100, y: 360, x2: 880, y2: 360, strokeWidth: 3, routing: 'straight' });
      const bone = (x1, y1, x2, y2) =>
        createElement('line', { x: x1, y: y1, x2: x2, y2: y2, strokeWidth: 2, routing: 'straight' });
      const cat = (x, y, label, fill) =>
        createElement('rect', { x, y, w: 150, h: 46, text: label, fill });
      const cats = [
        [140, 150, 'People', '#dbeafe', 320, 358],
        [400, 150, 'Process', '#dcfce7', 520, 358],
        [660, 150, 'Machines', '#fef9c3', 720, 358],
        [140, 520, 'Materials', '#f3e8ff', 320, 362],
        [400, 520, 'Measurement', '#fce7f3', 520, 362],
        [660, 520, 'Environment', '#e0f2fe', 720, 362],
      ];
      const els = [title, head, spine];
      for (const [x, y, label, fill, bx, by] of cats) {
        els.push(cat(x, y, label, fill));
        els.push(bone(x + 75, y + (y < 360 ? 46 : 0), bx, by));
      }
      return els;
    },
  }),

  board({
    id: 'tpl-adv-user-journey',
    name: 'User Journey Map',
    description: 'Five journey stages with actions, thoughts and emotions swimlanes',
    build() {
      const stages = ['Discover', 'Evaluate', 'Buy', 'Onboard', 'Advocate'];
      const headers = stages.map((label, i) =>
        createElement('rounded-rect', { x: 80 + i * 210, y: 70, w: 190, h: 56, text: label, fill: '#eff6ff', roundness: 14 })
      );
      const lanes = [
        ['Actions', 150, '#f8fafc'],
        ['Thoughts', 310, '#f8fafc'],
        ['Emotions', 470, '#f8fafc'],
      ].map(([label, y, fill]) =>
        createElement('frame', { x: 80, y, w: 1040, h: 140, text: label })
      );
      const rows = [
        ['Sees a search ad', 'Compares plans', 'Starts checkout', 'Gets welcome email', 'Refers a friend', '#dbeafe'],
        ['Is this for me?', 'Is it worth the price?', 'Will it arrive on time?', 'Am I doing this right?', 'Should others know?', '#fef9c3'],
        ['Curious', 'Sceptical', 'Anxious', 'Relieved', 'Proud', '#fce7f3'],
      ];
      const stickies = [];
      rows.forEach((row, r) => {
        for (let i = 0; i < 5; i++) {
          stickies.push(
            createElement('sticky', {
              x: 92 + i * 210,
              y: 185 + r * 160,
              w: 176,
              h: 88,
              text: row[i],
              fill: row[5],
            })
          );
        }
      });
      return [...headers, ...lanes, ...stickies];
    },
  }),

  board({
    id: 'tpl-adv-timeline',
    name: 'Project Timeline',
    description: 'Horizontal milestone timeline with six labelled checkpoints',
    build() {
      const title = TXT(80, 40, 620, 30, 'Project timeline', { fontSize: 20, bold: true, fill: '#0f172a' });
      const axis = createElement('arrow', { x: 100, y: 300, x2: 1020, y2: 300, endArrow: 'arrow', routing: 'straight', strokeWidth: 3 });
      const labels = ['Kickoff', 'Design done', 'Alpha', 'Beta', 'Launch', 'Review'];
      const els = [title, axis];
      labels.forEach((label, i) => {
        const cx = 150 + i * 160;
        els.push(createElement('ellipse', { x: cx - 30, y: 270, w: 60, h: 60, text: `M${i + 1}`, fill: '#dbeafe' }));
        els.push(TXT(cx - 80, i % 2 === 0 ? 350 : 200, 160, 24, label, { textAlign: 'center', bold: true }));
      });
      return els;
    },
  }),

  board({
    id: 'tpl-adv-erd',
    name: 'ER Diagram Starter',
    description: 'Four entities with PK/FK attribute tables and 1..N labelled relationships',
    build() {
      const title = TXT(80, 40, 620, 30, 'Library ER diagram (crow-foot labels 1 : N)', { fontSize: 20, bold: true, fill: '#0f172a' });
      const entity = (x, label, attrs, fill) => [
        createElement('rect', { x, y: 90, w: 180, h: 50, text: label, fill, bold: true }),
        createElement('table', {
          x,
          y: 140,
          w: 180,
          h: 40 * attrs.length + 8,
          rows: attrs.length,
          cols: 1,
          headerRow: false,
          cells: attrs.map((a) => [a]),
        }),
      ];
      const [authorHead, authorTable] = entity(360, 'Author', [['id (PK)'], ['name'], ['bio']], '#dcfce7');
      const [bookHead, bookTable] = entity(80, 'Book', [['id (PK)'], ['title'], ['author_id (FK)'], ['copies']], '#dbeafe');
      const [loanHead, loanTable] = entity(640, 'Loan', [['id (PK)'], ['book_id (FK)'], ['member_id (FK)'], ['due_date']], '#fef9c3');
      const [memberHead, memberTable] = entity(920, 'Member', [['id (PK)'], ['name'], ['email']], '#fce7f3');
      return [
        title,
        bookHead,
        bookTable,
        authorHead,
        authorTable,
        loanHead,
        loanTable,
        memberHead,
        memberTable,
        A(authorHead, 'left', bookHead, 'right', { text: 'writes 1 : N' }),
        A(bookHead, 'right', loanHead, 'left', { text: 'borrowed in 1 : N' }),
        A(memberHead, 'left', loanHead, 'right', { text: 'makes 1 : N' }),
      ];
    },
  }),

  board({
    id: 'tpl-adv-state-machine',
    name: 'State Machine Diagram',
    description: 'Document lifecycle: initial pseudo-state, states and event [guard] transitions',
    build() {
      const title = TXT(80, 40, 620, 30, 'Document lifecycle state machine', { fontSize: 20, bold: true, fill: '#0f172a' });
      const initial = createElement('ellipse', { x: 90, y: 160, w: 44, h: 44, text: '', fill: '#0f172a' });
      const draft = createElement('rounded-rect', { x: 180, y: 140, w: 160, h: 80, text: 'Draft', fill: '#f8fafc', roundness: 18 });
      const review = createElement('rounded-rect', { x: 430, y: 140, w: 160, h: 80, text: 'In review', fill: '#fef9c3', roundness: 18 });
      const rejected = createElement('rounded-rect', { x: 430, y: 320, w: 160, h: 80, text: 'Changes requested', fill: '#fee2e2', roundness: 18 });
      const published = createElement('rounded-rect', { x: 680, y: 140, w: 160, h: 80, text: 'Published', fill: '#dcfce7', roundness: 18 });
      const archived = createElement('rounded-rect', { x: 680, y: 320, w: 160, h: 80, text: 'Archived', fill: '#e0f2fe', roundness: 18 });
      return [
        title,
        initial,
        draft,
        review,
        rejected,
        published,
        archived,
        A(initial, 'right', draft, 'left', { text: 'create' }),
        A(draft, 'right', review, 'left', { text: 'submit [sections complete]' }),
        A(review, 'right', published, 'left', { text: 'approve' }),
        A(review, 'bottom', rejected, 'top', { text: 'request changes' }),
        A(rejected, 'left', draft, 'bottom', { text: 'revise', routing: 'curved' }),
        A(published, 'bottom', archived, 'top', { text: 'archive [retention reached]' }),
      ];
    },
  }),

  board({
    id: 'tpl-adv-swimlane-flow',
    name: 'Swimlane Process Flow',
    description: 'Refund request across Customer, Support agent and Billing system lanes',
    build() {
      const lane1 = createElement('frame', { x: 80, y: 80, w: 1040, h: 170, text: 'Customer' });
      const lane2 = createElement('frame', { x: 80, y: 270, w: 1040, h: 170, text: 'Support agent' });
      const lane3 = createElement('frame', { x: 80, y: 460, w: 1040, h: 170, text: 'Billing system' });
      const start = createElement('stencil', { stencilId: 'flow-terminator', x: 120, y: 130, w: 150, h: 64, text: 'Report issue', fill: '#dcfce7' });
      const closed = createElement('stencil', { stencilId: 'flow-terminator', x: 700, y: 130, w: 150, h: 64, text: 'Confirmation email', fill: '#dcfce7' });
      const triage = createElement('stencil', { stencilId: 'flow-process', x: 120, y: 315, w: 150, h: 80, text: 'Triage ticket', fill: '#f8fafc' });
      const decision = createElement('stencil', { stencilId: 'flow-decision', x: 350, y: 295, w: 170, h: 120, text: 'Refund due?', fill: '#fef9c3' });
      const refund = createElement('stencil', { stencilId: 'flow-process', x: 600, y: 505, w: 160, h: 80, text: 'Process refund', fill: '#f8fafc' });
      const ledger = createElement('stencil', { stencilId: 'flow-database', x: 820, y: 505, w: 160, h: 80, text: 'Billing ledger', fill: '#dbeafe' });
      return [
        lane1,
        lane2,
        lane3,
        start,
        closed,
        triage,
        decision,
        refund,
        ledger,
        A(start, 'bottom', triage, 'top', { text: 'opens ticket' }),
        A(triage, 'right', decision, 'left'),
        A(decision, 'bottom', refund, 'top', { text: 'Yes' }),
        A(decision, 'right', closed, 'bottom', { text: 'No', routing: 'curved' }),
        A(refund, 'right', ledger, 'left', { text: 'post entry' }),
        A(refund, 'top', closed, 'bottom', { text: 'notify', routing: 'curved' }),
      ];
    },
  }),

  board({
    id: 'tpl-adv-story-map',
    name: 'User Story Map',
    description: 'Activity backbone, step stickies and two release-priority rows',
    build() {
      const title = TXT(80, 40, 620, 30, 'User story map', { fontSize: 20, bold: true, fill: '#0f172a' });
      const activities = ['Search', 'Compare', 'Buy', 'Track', 'Return'];
      const backbone = activities.map((label, i) =>
        createElement('rounded-rect', { x: 80 + i * 210, y: 90, w: 180, h: 60, text: label, fill: '#dbeafe', roundness: 14 })
      );
      const steps = [
        'keyword + filter',
        'side-by-side',
        'guest checkout',
        'status email',
        'prepaid label',
      ].map((label, i) =>
        createElement('sticky', { x: 84 + i * 210, y: 170, w: 172, h: 76, text: label, fill: '#fef9c3' })
      );
      const r1 = createElement('frame', { x: 80, y: 290, w: 1040, h: 130, text: 'Release 1 — walking skeleton' });
      const r2 = createElement('frame', { x: 80, y: 450, w: 1040, h: 130, text: 'Release 2 — depth' });
      const r1Items = ['Search: keyword only', 'Buy: card payments', 'Track: order page'];
      const r2Items = ['Compare: saved lists', 'Buy: wallets', 'Return: self-service'];
      const r1Stickies = r1Items.map((label, i) =>
        createElement('sticky', { x: 110 + i * 330, y: 340, w: 300, h: 66, text: label, fill: '#bbf7d0' })
      );
      const r2Stickies = r2Items.map((label, i) =>
        createElement('sticky', { x: 110 + i * 330, y: 500, w: 300, h: 66, text: label, fill: '#bfdbfe' })
      );
      return [title, ...backbone, ...steps, r1, r2, ...r1Stickies, ...r2Stickies];
    },
  }),

  board({
    id: 'tpl-adv-gantt',
    name: 'Gantt Chart',
    description: 'Eight tasks as bars over a ten-week table grid',
    build() {
      const title = TXT(80, 40, 620, 30, 'Gantt: 10-week plan', { fontSize: 20, bold: true, fill: '#0f172a' });
      const header = ['Task', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'];
      const taskNames = ['Planning', 'Design', 'API build', 'UI build', 'Integration', 'Testing', 'Docs', 'Launch'];
      const cells = [header, ...taskNames.map((name) => [name, '', '', '', '', '', '', '', '', '', ''])];
      const grid = createElement('table', {
        x: 80,
        y: 90,
        w: 960,
        h: 420,
        rows: 9,
        cols: 11,
        cells,
        colWidths: [160, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
      });
      // [task row 1-8, start week, end week, fill]
      const bars = [
        [1, 1, 2, '#bfdbfe'],
        [2, 2, 4, '#bfdbfe'],
        [3, 3, 6, '#bbf7d0'],
        [4, 4, 7, '#bbf7d0'],
        [5, 6, 8, '#fef08a'],
        [6, 7, 9, '#fef08a'],
        [7, 8, 9, '#f3e8ff'],
        [8, 10, 10, '#fee2e2'],
      ].map(([row, start, end, fill]) =>
        createElement('rect', {
          x: 80 + 160 + (start - 1) * 80,
          y: 90 + row * 46 + 8,
          w: (end - start + 1) * 80 - 8,
          h: 26,
          text: '',
          fill,
        })
      );
      return [title, grid, ...bars];
    },
  }),

  board({
    id: 'tpl-adv-raci',
    name: 'RACI Matrix',
    description: 'Task rows against Responsible / Accountable / Consulted / Informed roles',
    build() {
      const title = TXT(80, 40, 620, 30, 'RACI matrix', { fontSize: 20, bold: true, fill: '#0f172a' });
      const matrix = createElement('table', {
        x: 80,
        y: 90,
        w: 820,
        h: 320,
        rows: 6,
        cols: 5,
        cells: [
          ['Task', 'Responsible', 'Accountable', 'Consulted', 'Informed'],
          ['Design API', 'Ada', 'Grace', 'Security', 'Everyone'],
          ['Run migration', 'Linus', 'Ada', 'DBA team', 'Support'],
          ['Write docs', 'Grace', 'Ada', '—', 'Everyone'],
          ['Pen test', 'External', 'Sam', 'Platform team', 'Security'],
          ['Release', 'Sam', 'Ada', 'All teams', 'Exec'],
        ],
        colWidths: [220, 150, 150, 150, 150],
      });
      const legend = TXT(80, 440, 820, 46, 'Exactly one Accountable per row. Responsible does the work, Consulted gives input before, Informed hears after.');
      return [title, matrix, legend];
    },
  }),

  board({
    id: 'tpl-adv-affinity',
    name: 'Affinity Mapping Board',
    description: 'Four theme frames with scattered observation stickies to sort',
    build() {
      const title = TXT(80, 40, 620, 30, 'Affinity mapping: sort the observations', { fontSize: 20, bold: true, fill: '#0f172a' });
      const t1 = createElement('frame', { x: 80, y: 90, w: 420, h: 260, text: 'Onboarding' });
      const t2 = createElement('frame', { x: 540, y: 90, w: 420, h: 260, text: 'Performance' });
      const t3 = createElement('frame', { x: 80, y: 380, w: 420, h: 260, text: 'Pricing' });
      const t4 = createElement('frame', { x: 540, y: 380, w: 420, h: 260, text: 'Support' });
      const sticky = (x, y, text, fill) =>
        createElement('sticky', { x, y, w: 180, h: 90, text, fill });
      const s1 = sticky(110, 160, 'Signed up in 2 minutes', '#bbf7d0');
      const s2 = sticky(300, 230, 'Could not find the import button', '#fef08a');
      const s3 = sticky(570, 160, 'Dashboard loads in 4s', '#bbf7d0');
      const s4 = sticky(760, 240, 'Search times out on big boards', '#fef08a');
      const s5 = sticky(110, 450, 'Per-seat pricing fits us', '#bbf7d0');
      const s6 = sticky(300, 540, 'Wanted a student tier', '#fef08a');
      const s7 = sticky(570, 450, 'Chat answered in 3 minutes', '#bbf7d0');
      const s8 = sticky(770, 530, 'No docs for the API', '#fef08a');
      const loose1 = sticky(500, 660, 'Unsorted: mentions both pricing and support', '#bfdbfe');
      return [title, t1, t2, t3, t4, s1, s2, s3, s4, s5, s6, s7, s8, loose1];
    },
  }),

  board({
    id: 'tpl-adv-eisenhower',
    name: 'Eisenhower Decision Matrix',
    description: 'Do now / Schedule / Delegate / Delete quadrants by urgency and importance',
    build() {
      const urgent = TXT(180, 60, 300, 24, 'Urgent', { fontSize: 14, bold: true, textAlign: 'center' });
      const notUrgent = TXT(480, 60, 300, 24, 'Not urgent', { fontSize: 14, bold: true, textAlign: 'center' });
      const important = TXT(30, 180, 130, 24, 'Important', { fontSize: 14, bold: true });
      const notImportant = TXT(30, 390, 130, 24, 'Not important', { fontSize: 14, bold: true });
      const doNow = createElement('rect', { x: 180, y: 90, w: 300, h: 210, text: 'Do now', fill: '#fee2e2' });
      const schedule = createElement('rect', { x: 480, y: 90, w: 300, h: 210, text: 'Schedule', fill: '#dbeafe' });
      const delegate = createElement('rect', { x: 180, y: 300, w: 300, h: 210, text: 'Delegate', fill: '#fef9c3' });
      const del = createElement('rect', { x: 480, y: 300, w: 300, h: 210, text: 'Delete', fill: '#f8fafc' });
      return [urgent, notUrgent, important, notImportant, doNow, schedule, delegate, del];
    },
  }),

  board({
    id: 'tpl-adv-site-reliability',
    name: 'SRE Golden Signals Dashboard',
    description: 'Latency, traffic, errors and saturation panels with an SLO and error-budget table',
    build() {
      const title = TXT(80, 40, 620, 30, 'Golden signals: latency, traffic, errors, saturation', { fontSize: 20, bold: true, fill: '#0f172a' });
      const panels = [
        ['Latency', 80, 80, '#dbeafe', 62, 84, 71],
        ['Traffic', 600, 80, '#dcfce7', 40, 55, 66],
        ['Errors', 80, 320, '#fee2e2', 30, 18, 44],
        ['Saturation', 600, 320, '#fef9c3', 80, 96, 88],
      ];
      const els = [title];
      for (const [label, x, y, fill, h1, h2, h3] of panels) {
        els.push(createElement('frame', { x, y, w: 480, h: 200, text: label }));
        els.push(createElement('rect', { x: x + 60, y: y + 190 - h1, w: 60, h: h1, text: '', fill }));
        els.push(createElement('rect', { x: x + 160, y: y + 190 - h2, w: 60, h: h2, text: '', fill }));
        els.push(createElement('rect', { x: x + 260, y: y + 190 - h3, w: 60, h: h3, text: '', fill }));
      }
      const slos = createElement('table', {
        x: 80,
        y: 560,
        w: 1000,
        h: 150,
        rows: 4,
        cols: 4,
        cells: [
          ['SLO', 'Target', 'This month', 'Budget left'],
          ['Availability', '99.9%', '99.95%', '115%'],
          ['p99 latency', '< 300 ms', '312 ms', '79%'],
          ['Error rate', '< 0.1%', '0.06%', '140%'],
        ],
      });
      return [...els, slos];
    },
  }),

  board({
    id: 'tpl-adv-threat-model',
    name: 'STRIDE Threat Model',
    description: 'Internet / DMZ / trusted-internal trust boundaries with components and threat stickies',
    build() {
      const title = TXT(80, 40, 620, 30, 'STRIDE: model the boundaries, then the threats', { fontSize: 20, bold: true, fill: '#0f172a' });
      const internet = createElement('frame', { x: 80, y: 80, w: 320, h: 420, text: 'Internet (untrusted)' });
      const dmz = createElement('frame', { x: 440, y: 80, w: 320, h: 420, text: 'DMZ' });
      const internal = createElement('frame', { x: 800, y: 80, w: 320, h: 420, text: 'Trusted internal' });
      const visitor = createElement('stencil', { stencilId: 'net-user', x: 120, y: 150, w: 140, h: 80, text: 'Anonymous visitor', fill: '#f8fafc' });
      const waf = createElement('stencil', { stencilId: 'sec-waf', x: 480, y: 150, w: 150, h: 80, text: 'WAF', fill: '#f8fafc' });
      const api = createElement('rect', { x: 480, y: 270, w: 150, h: 70, text: 'Public API', fill: '#dbeafe' });
      const svc = createElement('rect', { x: 840, y: 270, w: 150, h: 70, text: 'Order service', fill: '#dcfce7' });
      const db = createElement('stencil', { stencilId: 'db-postgres', x: 840, y: 380, w: 150, h: 80, text: 'Customer DB', fill: '#f8fafc' });
      const t1 = createElement('sticky', { x: 130, y: 400, w: 220, h: 80, text: 'Spoofing: forged admin tokens', fill: '#fee2e2' });
      const t2 = createElement('sticky', { x: 480, y: 360, w: 220, h: 80, text: 'Tampering: SQLi at login', fill: '#fee2e2' });
      const t3 = createElement('sticky', { x: 110, y: 530, w: 240, h: 70, text: 'Info disclosure: data exfil via export', fill: '#fef08a' });
      return [
        title,
        internet,
        dmz,
        internal,
        visitor,
        waf,
        api,
        svc,
        db,
        t1,
        t2,
        t3,
        A(visitor, 'right', waf, 'left', { text: 'requests' }),
        A(waf, 'bottom', api, 'top', { text: 'filtered' }),
        A(api, 'right', svc, 'left', { text: 'validated call' }),
        A(svc, 'bottom', db, 'top', { text: 'least-privilege role' }),
      ];
    },
  }),

  board({
    id: 'tpl-adv-incident-postmortem',
    name: 'Incident Postmortem Timeline',
    description: 'Detect / triage / mitigate / resolve phases with an action-items section',
    build() {
      const title = TXT(80, 40, 620, 30, 'Incident timeline: read-only for blame-free writing', { fontSize: 20, bold: true, fill: '#0f172a' });
      const detect = createElement('frame', { x: 80, y: 80, w: 240, h: 300, text: 'Detect', slideOrder: 1 });
      const triage = createElement('frame', { x: 350, y: 80, w: 240, h: 300, text: 'Triage', slideOrder: 2 });
      const mitigate = createElement('frame', { x: 620, y: 80, w: 240, h: 300, text: 'Mitigate', slideOrder: 3 });
      const resolve = createElement('frame', { x: 890, y: 80, w: 240, h: 300, text: 'Resolve', slideOrder: 4 });
      const phaseNote = (frame, i, text, fill) =>
        createElement('sticky', { x: frame.x + 20, y: 150 + i * 100, w: 200, h: 80, text, fill });
      const d1 = phaseNote(detect, 0, '01:02 alert: p99 > 2s', '#fee2e2');
      const d2 = phaseNote(detect, 1, '01:05 customer reports spike', '#fee2e2');
      const t1 = phaseNote(triage, 0, '01:09 pinned to deploy 4f21', '#fef08a');
      const t2 = phaseNote(triage, 1, '01:14 bad index migration', '#fef08a');
      const m1 = phaseNote(mitigate, 0, '01:18 rollback prod', '#bfdbfe');
      const r1 = phaseNote(resolve, 0, '02:01 error budget restored', '#bbf7d0');
      const actions = createElement('frame', { x: 80, y: 420, w: 1050, h: 200, text: 'Action items (owner + date)' });
      const a1 = createElement('sticky', { x: 110, y: 490, w: 300, h: 90, text: 'Canary stage on every deploy — Sam, 11/07', fill: '#dbeafe' });
      const a2 = createElement('sticky', { x: 440, y: 490, w: 300, h: 90, text: 'Alert on deploy error-rate delta — Priya, 11/10', fill: '#dbeafe' });
      const a3 = createElement('sticky', { x: 770, y: 490, w: 300, h: 90, text: 'Migration dry-run in staging — Lee, 11/14', fill: '#dbeafe' });
      return [
        title,
        detect,
        triage,
        mitigate,
        resolve,
        d1,
        d2,
        t1,
        t2,
        m1,
        r1,
        actions,
        a1,
        a2,
        a3,
        A(detect, 'right', triage, 'left', {}),
        A(triage, 'right', mitigate, 'left', {}),
        A(mitigate, 'right', resolve, 'left', {}),
      ];
    },
  }),

  board({
    id: 'tpl-adv-quiz',
    name: 'Classroom Quiz Layout',
    description: 'Two question frames with A-D option cards and a teacher answer key',
    build() {
      const q1 = createElement('frame', { x: 80, y: 80, w: 480, h: 400, text: 'Q1: What does NAT stand for?' });
      const q2 = createElement('frame', { x: 620, y: 80, w: 480, h: 400, text: 'Q2: Which queue holds failed messages?' });
      const option = (frame, row, col, label, fill) =>
        createElement('rect', {
          x: frame.x + 30 + col * 220,
          y: 170 + row * 90,
          w: 200,
          h: 70,
          text: label,
          fill,
        });
      const o1 = option(q1, 0, 0, 'A) Network Address Table', '#f8fafc');
      const o2 = option(q1, 0, 1, 'B) Network Address Translation', '#f8fafc');
      const o3 = option(q1, 1, 0, 'C) National Access Tier', '#f8fafc');
      const o4 = option(q1, 1, 1, 'D) New Active Tunnel', '#f8fafc');
      const p1 = option(q2, 0, 0, 'A) Source queue', '#f8fafc');
      const p2 = option(q2, 0, 1, 'B) Dead-letter queue', '#f8fafc');
      const p3 = option(q2, 1, 0, 'C) Priority queue', '#f8fafc');
      const p4 = option(q2, 1, 1, 'D) Delay queue', '#f8fafc');
      const key = createElement('text', {
        x: 80,
        y: 520,
        w: 640,
        h: 40,
        text: 'Answer key: Q1 — B, Q2 — B. Reveal after voting.',
        fontSize: 14,
        bold: true,
        fill: '#475569',
      });
      return [q1, q2, o1, o2, o3, o4, p1, p2, p3, p4, key];
    },
  }),
];

export const ADVANCED_TEMPLATES = [...CLOUD_DIAGRAMS, ...CLASSROOM_BOARDS];
