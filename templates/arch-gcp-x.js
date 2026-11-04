// templates/arch-gcp-x.js — ten extra GCP teaching architectures.
// Authority: GCP service names and topology relationships documented for the
// 2026-11 review; every diagram is plain stencil + arrow elements, not an image.
// Parity with the AWS pack: ten diagrams, one teaching sentence each.
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
  provider: 'GCP',
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

export const ARCH_GCP_X_TEMPLATES = [
  diagram({
    id: 'tpl-gcpx-recommendations',
    name: 'GCP-X1 Real-time recommendations',
    description: 'Pub/Sub click stream → Dataflow features → BigQuery training table → Vertex AI model → Cloud Run serving',
    frameTitle: 'Lesson: real-time recommendations on GCP',
    teaching:
      'Clicks land in Pub/Sub the moment they happen, Dataflow turns them into windowed features, and BigQuery is both the training table and the audit copy. The trained model is an artifact with a version, served from Cloud Run behind an endpoint, so a bad model is a rollback, not a redeploy.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Web / mobile users');
      const ps = N('gcp-pubsub', 250, 130, 'Pub/Sub click topic');
      const flow = N('gcp-dataflow', 460, 130, 'Dataflow features');
      const bq = N('gcp-bigquery', 460, 300, 'BigQuery training data');
      const model = N('flow-process', 670, 300, 'Vertex AI model');
      const run = N('gcp-cloudrun', 880, 300, 'Cloud Run serving');
      const mon = N('gcp-monitoring', 670, 130, 'Prediction monitoring');
      return [
        TITLE(40, 76, 'From click stream to served recommendation'),
        user,
        ps,
        flow,
        bq,
        model,
        run,
        mon,
        A(user, 'right', ps, 'left', { text: 'clicks + impressions' }),
        A(ps, 'right', flow, 'left', { text: 'streaming subscription' }),
        A(flow, 'bottom', bq, 'top', { text: 'windowed aggregates' }),
        A(bq, 'right', model, 'left', { text: 'training table' }),
        A(model, 'right', run, 'left', { text: 'versioned model artifact' }),
        A(run, 'left', mon, 'bottom', { text: 'drift + latency metrics', routing: 'curved' }),
        NOTE(40, 560, 'Serve the model as a versioned artifact, never a retrained-in-place binary. When CTR drops, monitoring tells you whether it is drift or a serving regression.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-video-pipeline',
    name: 'GCP-X2 Video transcoding pipeline',
    description: 'Cloud Storage uploads → transcode jobs → Pub/Sub notifications → Bigtable metadata → Cloud CDN delivery',
    frameTitle: 'Lesson: media ingest to edge delivery',
    teaching:
      'Upload and processing are decoupled: the object-change event starts the transcode job, Pub/Sub carries the completion notice, and the metadata store maps each video to its rendition paths. The CDN serves the finished renditions, so viewers never wait on the transcode path.',
    build() {
      const uploader = N('cloud-generic', 40, 130, 'Creator upload');
      const gcs = N('gcp-gcs', 250, 130, 'Cloud Storage uploads');
      const job = N('flow-process', 460, 130, 'Transcode jobs');
      const ps = N('gcp-pubsub', 670, 130, 'Pub/Sub notifications');
      const meta = N('flow-database', 880, 130, 'Bigtable metadata');
      const cdn = N('gcp-cdn', 460, 300, 'Cloud CDN delivery');
      const viewer = N('cloud-generic', 670, 300, 'Viewers worldwide');
      return [
        TITLE(40, 76, 'Event-driven media pipeline'),
        uploader,
        gcs,
        job,
        ps,
        meta,
        cdn,
        viewer,
        A(uploader, 'right', gcs, 'left', { text: 'multipart upload' }),
        A(gcs, 'right', job, 'left', { text: 'ObjectCreated event' }),
        A(job, 'right', ps, 'left', { text: 'job complete' }),
        A(job, 'bottom', meta, 'top', { text: 'write rendition metadata' }),
        A(ps, 'bottom', cdn, 'top', { text: 'publish manifest' }),
        A(cdn, 'right', viewer, 'left', { text: 'edge cache hit' }),
        NOTE(40, 560, 'Never transcode on the request path: ingest events drive the jobs, and the CDN only ever serves finished renditions whose metadata row is already committed.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-gaming-global',
    name: 'GCP-X3 Global multiplayer game backend',
    description: 'Cloud DNS → global external LB → Game Servers on GKE → Memorystore sessions → Spanner player state',
    frameTitle: 'Lesson: a global game backend',
    teaching:
      'One anycast load balancer fronts game fleets in several regions, so the player hits the closest one. Session tokens live in Memorystore for sub-millisecond reads, while durable player state goes to a multi-region database whose writes replicate across continents — losing a region drops a match, not an account.',
    build() {
      const players = N('cloud-generic', 40, 130, 'Players worldwide');
      const dns = N('gcp-dns', 250, 130, 'Cloud DNS');
      const lb = N('gcp-lb', 460, 130, 'Global external LB');
      const gke = N('gcp-gke', 670, 130, 'Game Servers on GKE');
      const mem = N('gcp-memorystore', 460, 300, 'Memorystore sessions');
      const spanner = N('gcp-cloudsql', 670, 300, 'Spanner player state');
      const fleet = N('flow-process', 880, 130, 'Agones fleet autoscaling');
      return [
        TITLE(40, 76, 'Latency-first global topology'),
        players,
        dns,
        lb,
        gke,
        mem,
        spanner,
        fleet,
        A(players, 'right', dns, 'left', { text: 'resolve game endpoint' }),
        A(dns, 'right', lb, 'left', { text: 'anycast IP' }),
        A(lb, 'right', gke, 'left', { text: 'nearest region' }),
        A(gke, 'bottom', mem, 'top', { text: 'session tokens' }),
        A(gke, 'bottom', spanner, 'right', { text: 'durable writes', routing: 'curved' }),
        A(gke, 'right', fleet, 'left', { text: 'scale on queue depth' }),
        NOTE(40, 560, 'Keep sessions in memory but never the account. Spanner replication makes the player inventory survive a regional outage; the in-memory session simply restarts.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-banking-gke',
    name: 'GCP-X4 Regulated banking on GKE',
    description: 'Cloud Armor + LB → private GKE → Cloud SQL over Private Service Connect, with Secret Manager and Cloud KMS',
    frameTitle: 'Lesson: private paths for a regulated workload',
    teaching:
      'Cloud Armor strips obvious attacks before requests reach the load balancer, and the GKE nodes have no public addresses at all. The database is reached through Private Service Connect, so no packet ever crosses the public internet, and every credential is a Secret Manager reference decrypted with a KMS key.',
    build() {
      const net = N('cloud-generic', 40, 130, 'Internet banking traffic');
      const armor = N('gcp-armor', 250, 130, 'Cloud Armor WAF');
      const lb = N('gcp-lb', 460, 130, 'External LB');
      const gke = N('gcp-gke', 670, 130, 'Private GKE cluster');
      const sql = N('gcp-cloudsql', 880, 130, 'Cloud SQL (private IP)');
      const psc = N('gcp-psc', 670, 300, 'Private Service Connect');
      const secret = N('gcp-secret', 460, 300, 'Secret Manager');
      const kms = N('gcp-secret', 250, 300, 'Cloud KMS key');
      return [
        TITLE(40, 76, 'Defense in depth for a bank workload'),
        net,
        armor,
        lb,
        gke,
        sql,
        psc,
        secret,
        kms,
        A(net, 'right', armor, 'left', { text: 'OWASP + L7 rules' }),
        A(armor, 'right', lb, 'left', { text: 'clean requests only' }),
        A(lb, 'right', gke, 'left', { text: 'HTTPS backend service' }),
        A(gke, 'bottom', psc, 'top', { text: 'private endpoint' }),
        A(psc, 'right', sql, 'bottom', { text: 'service attachment', routing: 'curved' }),
        A(gke, 'left', secret, 'top', { text: 'fetch at boot', routing: 'curved' }),
        A(secret, 'left', kms, 'right', { text: 'envelope decryption' }),
        NOTE(40, 560, 'No public IP on the nodes, no database on a public subnet, no plaintext credential in a manifest. Each layer fails independently, which is what an auditor actually asks for.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-streaming-analytics',
    name: 'GCP-X5 Streaming analytics pipeline',
    description: 'Pub/Sub → Dataflow streaming → BigQuery + Cloud Logging, with log-based Cloud Monitoring alerts',
    frameTitle: 'Lesson: streaming analytics with real alerting',
    teaching:
      'Dataflow computes over the stream as it arrives and lands the rows in BigQuery — nothing is batch-loaded hours later. The same pipeline emits its own logs and metrics, so a metric on the log entries pages the on-call engineer when the pipeline itself is the thing that is broken.',
    build() {
      const events = N('flow-data', 40, 130, 'Device + app events');
      const ps = N('gcp-pubsub', 250, 130, 'Pub/Sub topic');
      const flow = N('gcp-dataflow', 460, 130, 'Dataflow streaming');
      const bq = N('gcp-bigquery', 670, 130, 'BigQuery landing');
      const logging = N('gcp-logging', 460, 300, 'Cloud Logging');
      const mon = N('gcp-monitoring', 670, 300, 'Cloud Monitoring alert');
      const oncall = N('sec-oidc', 880, 300, 'On-call engineer');
      return [
        TITLE(40, 76, 'Continuous ingest, continuous query'),
        events,
        ps,
        flow,
        bq,
        logging,
        mon,
        oncall,
        A(events, 'right', ps, 'left', { text: 'publish' }),
        A(ps, 'right', flow, 'left', { text: 'subscription' }),
        A(flow, 'right', bq, 'left', { text: 'streaming insert' }),
        A(flow, 'bottom', logging, 'top', { text: 'pipeline logs' }),
        A(logging, 'right', mon, 'left', { text: 'log-based metric' }),
        A(mon, 'right', oncall, 'left', { text: 'alert policy pages' }),
        NOTE(40, 560, 'Alert on data freshness, not just CPU: a pipeline that silently stops inserting rows is green on compute graphs and wrong in every dashboard downstream.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-datalake',
    name: 'GCP-X6 Lakehouse data platform',
    description: 'Cloud Storage raw/curated zones → Dataproc batch → BigQuery marts → Looker dashboards',
    frameTitle: 'Lesson: zones keep half-parsed data away from analysts',
    teaching:
      'Raw is immutable — exactly what landed, forever. Curated is cleaned and conformed by the Dataproc batch jobs, and only then is it modelled into BigQuery marts that Looker queries. Analysts get the marts, never the raw zone, so a bad parser cannot poison a board-level number.',
    build() {
      const sources = N('cloud-generic', 40, 130, 'Source systems');
      const raw = N('gcp-gcs', 250, 130, 'Raw zone');
      const curated = N('gcp-gcs', 460, 130, 'Curated zone');
      const proc = N('gcp-dataproc', 670, 130, 'Dataproc batch');
      const bq = N('gcp-bigquery', 460, 300, 'BigQuery marts');
      const looker = N('flow-data', 670, 300, 'Looker dashboards');
      const audit = N('gcp-dataplex', 250, 300, 'Dataplex catalog');
      return [
        TITLE(40, 76, 'Lake zones to governed marts'),
        sources,
        raw,
        curated,
        proc,
        bq,
        looker,
        audit,
        A(sources, 'right', raw, 'left', { text: 'daily loads' }),
        A(raw, 'right', curated, 'left', { text: 'clean + conform' }),
        A(curated, 'right', proc, 'left', { text: 'Spark batch' }),
        A(proc, 'bottom', bq, 'top', { text: 'modelled marts' }),
        A(bq, 'right', looker, 'left', { text: 'governed queries' }),
        A(audit, 'right', bq, 'left', { text: 'schema + lineage', routing: 'curved' }),
        NOTE(40, 560, 'Replay is only possible because raw never changes. The catalog is the contract that makes curated trustworthy; without it a mart is just a query somebody wrote once.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-hybrid-anthos',
    name: 'GCP-X7 Hybrid Anthos fleet',
    description: 'On-premises ↔ Cloud VPN / Interconnect ↔ Cloud Router → GKE fleet with Cloud NAT and Config Sync',
    frameTitle: 'Lesson: one control plane over two worlds',
    teaching:
      'The VPN carries the encrypted traffic, the Interconnect carries the predictable heavy traffic, and Cloud Router exchanges the routes over BGP — nothing is statically pinned. Config Sync pushes the same policy manifests to every cluster in the fleet, so an on-prem cluster and a cloud cluster are configured by the same commit.',
    build() {
      const onprem = N('cloud-vm', 40, 130, 'On-premises vSphere');
      const vpn = N('gcp-vpn', 250, 130, 'Cloud VPN');
      const ic = N('gcp-interconnect', 250, 300, 'Dedicated Interconnect');
      const router = N('gcp-router', 460, 130, 'Cloud Router (BGP)');
      const gke = N('gcp-gke', 670, 130, 'GKE fleet');
      const nat = N('gcp-nat', 880, 130, 'Cloud NAT egress');
      const sync = N('flow-process', 670, 300, 'Config Sync');
      return [
        TITLE(40, 76, 'Hybrid connectivity under one fleet'),
        onprem,
        vpn,
        ic,
        router,
        gke,
        nat,
        sync,
        A(onprem, 'right', vpn, 'left', { text: 'encrypted tunnel' }),
        A(onprem, 'bottom', ic, 'left', { text: 'private circuit', routing: 'curved' }),
        A(vpn, 'right', router, 'left', { text: 'advertise routes' }),
        A(ic, 'right', router, 'bottom', { text: 'high bandwidth', routing: 'curved' }),
        A(router, 'right', gke, 'left', { text: 'dynamic routing' }),
        A(gke, 'right', nat, 'left', { text: 'controlled egress' }),
        A(sync, 'top', gke, 'bottom', { text: 'git-ops policies' }),
        NOTE(40, 560, 'BGP over a tunnel beats a static route table: paths fail and return on their own. The fleet only stays consistent if policy comes from git, not from per-cluster kubectl sessions.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-security-command',
    name: 'GCP-X8 Security Command Center flow',
    description: 'Assets → Cloud Logging → Security Command Center findings, with IAM and Cloud Armor response paths',
    frameTitle: 'Lesson: from raw log to automated response',
    teaching:
      'Every asset writes its audit and configuration logs; SCC turns them into findings with severity and asset context. The response is as automatic as the detection: a least-privilege IAM change or a WAF rule ships without a human copy-pasting between consoles, and high-severity findings still page a person.',
    build() {
      const assets = N('cloud-generic', 40, 130, 'Projects + assets');
      const logging = N('gcp-logging', 250, 130, 'Cloud Logging');
      const scc = N('flow-process', 460, 130, 'Security Command Center');
      const iam = N('gcp-iam', 670, 130, 'IAM remediation');
      const armor = N('gcp-armor', 670, 300, 'Cloud Armor rule');
      const queue = N('flow-data', 250, 300, 'Findings triage queue');
      const oncall = N('sec-oidc', 880, 130, 'Security on-call');
      return [
        TITLE(40, 76, 'Detect, prioritise, respond — same platform'),
        assets,
        logging,
        scc,
        iam,
        armor,
        queue,
        oncall,
        A(assets, 'right', logging, 'left', { text: 'audit + config logs' }),
        A(logging, 'right', scc, 'left', { text: 'log-based finding' }),
        A(scc, 'right', iam, 'left', { text: 'least-privilege fix' }),
        A(scc, 'bottom', armor, 'top', { text: 'blocklisted source' }),
        A(scc, 'bottom', queue, 'left', { text: 'triage by severity', routing: 'curved' }),
        A(iam, 'right', oncall, 'left', { text: 'page on critical' }),
        NOTE(40, 560, 'A finding nobody responds to is a report, not a control. Wire each severity class to a concrete action — IAM change, WAF rule, or a human page — before the incident, not during it.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-serverless-web',
    name: 'GCP-X9 Serverless web application',
    description: 'Static hosting + CDN on Cloud Storage → Cloud Run APIs → Firestore, with Memorystore cache and auth',
    frameTitle: 'Lesson: a web app with no servers to patch',
    teaching:
      'The browser loads the SPA from edge-cached static storage and only the data calls reach Cloud Run, which scales to zero between requests. Firestore gives per-user documents without a schema migration, Memorystore absorbs the hot reads, and the ID token issued at sign-in is verified on every API call.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Visitor');
      const hosting = N('flow-process', 250, 130, 'Static hosting');
      const assets = N('gcp-gcs', 40, 300, 'Asset bucket + CDN');
      const auth = N('gcp-iam', 250, 300, 'Identity provider');
      const run = N('gcp-cloudrun', 460, 130, 'Cloud Run APIs');
      const fs = N('flow-database', 670, 130, 'Firestore');
      const mem = N('gcp-memorystore', 670, 300, 'Memorystore');
      return [
        TITLE(40, 76, 'Zero-ops request path'),
        user,
        hosting,
        assets,
        auth,
        run,
        fs,
        mem,
        A(user, 'right', hosting, 'left', { text: 'HTTPS GET /' }),
        A(assets, 'right', hosting, 'left', { text: 'edge-cached SPA', routing: 'curved' }),
        A(hosting, 'right', run, 'left', { text: '/api data calls' }),
        A(user, 'bottom', auth, 'left', { text: 'sign-in', routing: 'curved' }),
        A(auth, 'right', run, 'bottom', { text: 'verified ID token', routing: 'curved' }),
        A(run, 'right', fs, 'left', { text: 'document read/write' }),
        A(run, 'bottom', mem, 'top', { text: 'hot-read cache' }),
        NOTE(40, 560, 'Scale-to-zero also means cold starts: keep the API image small and the token check in-process. The cache absorbs the reads that would otherwise wake the container on every visit.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-gcpx-ml-mlops',
    name: 'GCP-X10 MLOps on Vertex AI',
    description: 'Dataflow prep → Vertex AI train/eval pipeline → model registry → Cloud Run inference + Model Monitoring',
    frameTitle: 'Lesson: a model is a pipeline, not a notebook',
    teaching:
      'The same pipeline that produced the model can replay it: Dataflow builds the features, the train and eval steps gate on a metric, and only a passing candidate is registered. Monitoring watches live drift and its alert feeds the next training run, which is what makes this MLOps rather than a script.',
    build() {
      const prep = N('gcp-dataflow', 40, 130, 'Dataflow prep');
      const train = N('flow-process', 250, 130, 'Vertex AI train');
      const evalStep = N('flow-process', 460, 130, 'Eval + gating');
      const reg = N('flow-data', 670, 130, 'Model registry');
      const run = N('gcp-cloudrun', 880, 130, 'Cloud Run inference');
      const mon = N('gcp-monitoring', 670, 300, 'Model Monitoring');
      const bq = N('gcp-bigquery', 40, 300, 'Feature warehouse');
      return [
        TITLE(40, 76, 'Trained, gated, registered, monitored'),
        prep,
        train,
        evalStep,
        reg,
        run,
        mon,
        bq,
        A(prep, 'right', train, 'left', { text: 'versioned dataset' }),
        A(train, 'right', evalStep, 'left', { text: 'candidate model' }),
        A(evalStep, 'right', reg, 'left', { text: 'promote if metric holds' }),
        A(reg, 'right', run, 'left', { text: 'pinned model version' }),
        A(run, 'bottom', mon, 'top', { text: 'drift + skew metrics' }),
        A(mon, 'left', train, 'bottom', { text: 'drift → retrain', routing: 'curved' }),
        A(bq, 'right', prep, 'top', { text: 'source tables', routing: 'curved' }),
        NOTE(40, 560, 'The registry entry is the contract between training and serving: the endpoint names a version, so a regression is a pin rollback, and every retrain is an experiment you can diff.'),
      ];
    },
  }),
];
