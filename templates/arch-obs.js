// templates/arch-obs.js — observability and SRE teaching architectures.
// Authority: OpenTelemetry, Prometheus, ELK and SRE practice (Google SRE
// workbook: golden signals, error budgets, incident command) as documented
// for the 2026-11 review; every diagram is plain stencil + arrow elements,
// not an image. Parity with the AWS pack: ten diagrams, teaching notes each.
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
  provider: 'Observability',
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

export const ARCH_OBS_TEMPLATES = [
  diagram({
    id: 'tpl-obs-otel-pipeline',
    name: 'OpenTelemetry collection pipeline',
    description: 'Instrumented apps → OTel Collector (receive, process, export) → Prometheus, Jaeger and Loki backends',
    frameTitle: 'Lesson: OpenTelemetry collection pipeline',
    teaching:
      'The OTel Collector decouples apps from backends: instrumentation emits one format (OTLP), and the collector fans it out to metrics, trace and log stores. Swap a backend by changing an exporter config line, never by re-instrumenting every service.',
    build() {
      const app = N('flow-process', 40, 130, 'Instrumented service');
      const sdk = N('flow-data', 250, 130, 'OTel SDK / auto-instrument');
      const receiver = N('obs-otel', 460, 130, 'Collector: receive');
      const processor = N('obs-otel', 670, 130, 'Processors (batch, tail-sample)');
      const metrics = N('obs-prometheus', 460, 330, 'Prometheus (metrics)');
      const traces = N('obs-jaeger', 670, 330, 'Jaeger (traces)');
      const logs = N('obs-loki', 880, 330, 'Loki (logs)');
      const grafana = N('obs-grafana', 880, 130, 'Grafana queries');
      return [
        TITLE(40, 76, 'One wire format, three signal backends'),
        app,
        sdk,
        receiver,
        processor,
        metrics,
        traces,
        logs,
        grafana,
        A(app, 'right', sdk, 'left', { text: 'spans + metrics' }),
        A(sdk, 'right', receiver, 'left', { text: 'OTLP gRPC :4317' }),
        A(receiver, 'right', processor, 'left', { text: 'pipeline' }),
        A(processor, 'bottom', traces, 'top', { text: 'export: otlp' }),
        A(processor, 'left', metrics, 'top', { text: 'export: prometheus', routing: 'curved' }),
        A(processor, 'right', logs, 'top', { text: 'export: loki', routing: 'curved' }),
        A(metrics, 'right', grafana, 'bottom', { text: 'dashboard queries', routing: 'curved' }),
        A(traces, 'right', grafana, 'bottom', { text: 'trace IDs', routing: 'curved' }),
        NOTE(40, 560, 'Tail sampling happens after the collector sees a full trace, so slow or erroring requests are kept and healthy ones are dropped cheaply.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-prometheus-arch',
    name: 'Prometheus scraping and alerting',
    description: 'Scrape targets → Prometheus TSDB → recording rules → Alertmanager routing → on-call receiver',
    frameTitle: 'Lesson: Prometheus scraping and alerting',
    teaching:
      'Prometheus pulls metrics on a scrape interval and stores them in a local time series database; recording rules precompute expensive expressions so dashboards stay fast. Alertmanager owns routing, grouping, silences and deduplication — Prometheus only decides that a rule is firing.',
    build() {
      const target = N('k8s-pod', 40, 130, 'Exporter targets');
      const prom = N('obs-prometheus', 250, 130, 'Prometheus TSDB');
      const rules = N('flow-process', 460, 130, 'Recording rules');
      const alerts = N('obs-alertmanager', 670, 130, 'Alertmanager');
      const receiver = N('sec-oidc', 880, 130, 'PagerDuty-style receiver');
      const grafana = N('obs-grafana', 460, 330, 'Grafana dashboards');
      const sd = N('k8s-apiserver', 250, 330, 'Service discovery');
      return [
        TITLE(40, 76, 'Pull-based metrics and the alert routing chain'),
        target,
        prom,
        rules,
        alerts,
        receiver,
        grafana,
        sd,
        A(target, 'right', prom, 'left', { text: 'scrape /metrics 15s' }),
        A(prom, 'right', rules, 'left', { text: 'evaluate 1m' }),
        A(rules, 'right', alerts, 'left', { text: 'firing rules' }),
        A(alerts, 'right', receiver, 'left', { text: 'route + group' }),
        A(rules, 'bottom', grafana, 'top', { text: 'precomputed series' }),
        A(sd, 'right', grafana, 'left', { text: 'target list', routing: 'curved' }),
        A(sd, 'top', prom, 'bottom', { text: 'discovery refresh', routing: 'curved' }),
        NOTE(40, 560, 'Prometheus pulls; exporters never push. Grouping in Alertmanager matters more than the threshold — one incident should wake one person once, not eight people eight times.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-elk-stack',
    name: 'ELK log stack',
    description: 'Beats shippers → Logstash pipeline → Elasticsearch cluster → Kibana dashboards',
    frameTitle: 'Lesson: the ELK log pipeline',
    teaching:
      'Beats are lightweight shippers that tail files locally; Logstash is where parsing, enrichment and filtering happen, because a centralized pipeline fixes a bad parser once instead of on every host. Elasticsearch indexes for search; Kibana is only the reading surface.',
    build() {
      const app = N('flow-process', 40, 130, 'App servers');
      const beats = N('obs-fluentd', 250, 130, 'Beats shippers (filebeat)');
      const logstash = N('obs-fluentd', 460, 130, 'Logstash pipeline');
      const es = N('obs-elastic', 670, 130, 'Elasticsearch cluster');
      const kibana = N('obs-kibana', 880, 130, 'Kibana dashboards');
      const index = N('flow-database', 670, 330, 'Index lifecycle policy');
      const archive = N('stg-nfs', 880, 330, 'Snapshot / archive');
      return [
        TITLE(40, 76, 'Ship, parse, index, then read'),
        app,
        beats,
        logstash,
        es,
        kibana,
        index,
        archive,
        A(app, 'right', beats, 'left', { text: 'log files' }),
        A(beats, 'right', logstash, 'left', { text: 'ship :5044' }),
        A(logstash, 'right', es, 'left', { text: 'grok parse + enrich' }),
        A(es, 'right', kibana, 'left', { text: 'search API' }),
        A(es, 'bottom', index, 'top', { text: 'rotate hot → warm' }),
        A(index, 'right', archive, 'left', { text: 'old indices', routing: 'curved' }),
        NOTE(40, 560, 'Parse once, centrally: a broken grok pattern in Logstash is a one-line fix, the same bug in per-app logging config is a hundred deploys.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-distributed-tracing',
    name: 'Distributed tracing model',
    description: 'Client → services A, B, C exchanging spans → collector → trace backend, with trace/span/parent IDs',
    frameTitle: 'Lesson: how a trace is assembled',
    teaching:
      'A trace is one request\'s journey; each hop contributes a span. Every span carries a trace ID shared by the whole request and a parent span ID pointing at its caller, so the backend can rebuild the call tree — including the two services that ran in parallel under B.',
    build() {
      const client = N('net-user', 40, 130, 'Client request');
      const svcA = N('flow-process', 250, 130, 'Service A (root span)');
      const svcB = N('flow-process', 460, 130, 'Service B');
      const svcC = N('flow-process', 460, 330, 'Service C (parallel)');
      const db = N('db-redis', 670, 330, 'Cache / DB call');
      const collector = N('obs-otel', 670, 130, 'OTel collector');
      const backend = N('obs-jaeger', 880, 130, 'Trace backend');
      return [
        TITLE(40, 76, 'One trace ID, many spans, one call tree'),
        client,
        svcA,
        svcB,
        svcC,
        db,
        collector,
        backend,
        A(client, 'right', svcA, 'left', { text: 'trace id born here' }),
        A(svcA, 'right', svcB, 'left', { text: 'child span: parent=A' }),
        A(svcB, 'bottom', svcC, 'top', { text: 'parent=B' }),
        A(svcC, 'right', db, 'left', { text: 'span kind: client' }),
        A(svcB, 'right', collector, 'left', { text: 'export spans', routing: 'curved' }),
        A(svcA, 'bottom', collector, 'top', { text: 'export spans', routing: 'curved' }),
        A(collector, 'right', backend, 'left', { text: 'assemble tree' }),
        NOTE(40, 560, 'Propagation is the hard part: if one service forgets to forward the trace headers, the trace is cut in two and the slow hop becomes invisible.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-slo-burn',
    name: 'SLO error-budget burn alerts',
    description: 'SLI measurement → fast and slow burn-rate alerts → policy actions when the budget runs out',
    frameTitle: 'Lesson: burning the error budget',
    teaching:
      'An SLI is the good-events ratio; the error budget is 100% minus the SLO target. Burn-rate alerts compare consumption against a budget window: a fast window (1h) catches sudden outages, a slow window (6h) catches steady decay — so the pager fires on the rate, not on raw thresholds.',
    build() {
      const users = N('net-user', 40, 130, 'User requests');
      const sli = N('flow-data', 250, 130, 'SLI: good / total events');
      const prom = N('obs-prometheus', 460, 130, 'SLO store (rules)');
      const fast = N('flow-decision', 670, 130, 'Fast burn (1h window)');
      const slow = N('flow-decision', 670, 330, 'Slow burn (6h window)');
      const page = N('sec-oidc', 880, 130, 'Page on-call');
      const ticket = N('flow-document', 880, 330, 'Ticket + freeze releases');
      const grafana = N('obs-grafana', 250, 330, 'Budget dashboard');
      return [
        TITLE(40, 76, 'Alert on how fast the budget burns, not on a threshold'),
        users,
        sli,
        prom,
        fast,
        slow,
        page,
        ticket,
        grafana,
        A(users, 'right', sli, 'left', { text: 'success / total' }),
        A(sli, 'right', prom, 'left', { text: 'ingest SLI events' }),
        A(prom, 'right', fast, 'left', { text: 'burn rate > 14.4' }),
        A(prom, 'bottom', slow, 'top', { text: 'burn rate > 3', routing: 'curved' }),
        A(fast, 'right', page, 'left', { text: 'page now' }),
        A(slow, 'right', ticket, 'left', { text: 'act this week' }),
        A(prom, 'bottom', grafana, 'top', { text: 'budget remaining', routing: 'curved' }),
        NOTE(40, 560, 'When the budget is spent, reliability work outranks features by pre-agreed policy — that agreement is the real product of an SLO, not the dashboard.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-incident-command',
    name: 'Incident command structure',
    description: 'Incident commander, comms lead and ops lead with escalation lanes and a public status page',
    frameTitle: 'Lesson: incident command roles',
    teaching:
      'The incident commander coordinates and decides but does not touch keyboards; ops works the mitigation; comms talks to users and management on a fixed cadence. Separating the three roles is what keeps an incident from stalling while everyone debugs and nobody tells users anything.',
    build() {
      const alert = N('obs-alertmanager', 40, 130, 'Alert fires');
      const ic = N('sec-oidc', 250, 130, 'Incident commander');
      const ops = N('flow-process', 460, 130, 'Ops lead (mitigation)');
      const comms = N('flow-process', 460, 330, 'Comms lead');
      const status = N('flow-document', 670, 330, 'Public status page');
      const escalate = N('flow-decision', 670, 130, 'Severity decision');
      const exec = N('sec-oidc', 880, 130, 'Exec / management escalation');
      const review = N('flow-document', 880, 330, 'Postmortem (blameless)');
      return [
        TITLE(40, 76, 'Roles, lanes and a blameless postmortem'),
        alert,
        ic,
        ops,
        comms,
        status,
        escalate,
        exec,
        review,
        A(alert, 'right', ic, 'left', { text: 'declares incident' }),
        A(ic, 'right', ops, 'left', { text: 'directs, does not type' }),
        A(ic, 'bottom', comms, 'left', { text: 'owns comms lane', routing: 'curved' }),
        A(ops, 'right', escalate, 'left', { text: 'not recovering?' }),
        A(escalate, 'right', exec, 'left', { text: 'sev-1 escalation' }),
        A(comms, 'right', status, 'left', { text: 'update every 30 min' }),
        A(escalate, 'bottom', review, 'top', { text: 'after: action items', routing: 'curved' }),
        NOTE(40, 560, 'The postmortem is blameless on purpose: it asks what system property let one person’s action cause an outage, because punishment teaches people to hide the next one.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-oncall-routing',
    name: 'On-call rotation and escalation',
    description: 'Alert → rotation schedule → primary, then secondary escalation → runbook handoff',
    frameTitle: 'Lesson: an alert finds one person',
    teaching:
      'An alert should resolve to exactly one human through the rotation, with a secondary as a timed fallback if the primary does not acknowledge. Every routed alert must carry a runbook link — paging someone without the steps to act is just a loud noise at 3am.',
    build() {
      const alert = N('obs-alertmanager', 40, 130, 'Firing alert');
      const schedule = N('flow-decision', 250, 130, 'Rotation schedule');
      const primary = N('net-user', 460, 130, 'Primary on-call');
      const secondary = N('net-user', 460, 330, 'Secondary on-call');
      const runbook = N('flow-document', 670, 130, 'Runbook link (in alert)');
      const ack = N('flow-terminator', 670, 330, 'Acknowledge or auto-escalate');
      const manager = N('sec-oidc', 880, 330, 'Management escalation');
      return [
        TITLE(40, 76, 'One alert, one owner, one fallback'),
        alert,
        schedule,
        primary,
        secondary,
        runbook,
        ack,
        manager,
        A(alert, 'right', schedule, 'left', { text: 'route by service+severity' }),
        A(schedule, 'right', primary, 'left', { text: 'who is on now' }),
        A(schedule, 'bottom', secondary, 'top', { text: 'after 5 min unacked', routing: 'curved' }),
        A(primary, 'right', runbook, 'left', { text: 'follow first steps' }),
        A(primary, 'bottom', ack, 'top', { text: 'ack within SLA', routing: 'curved' }),
        A(secondary, 'right', ack, 'left', { text: 'ack' }),
        A(ack, 'right', manager, 'left', { text: 'still unacked: page up' }),
        NOTE(40, 560, 'The unacknowledged path is the part teams forget: test that the secondary and the management escalation actually fire before you need them.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-ebpf',
    name: 'eBPF kernel observability',
    description: 'eBPF sensors in the kernel → metrics, traces and network events without app instrumentation',
    frameTitle: 'Lesson: observability without touching the app',
    teaching:
      'eBPF loads small, verified programs into the kernel, so metrics, traces and network flows are captured at the syscall and socket level with zero application code changes. The trade-off: what you get is uniform but generic, so app-level semantics still need OTel instrumentation on top.',
    build() {
      const app = N('k8s-pod', 40, 130, 'App pods (unmodified)');
      const kernel = N('linux-kernel', 250, 130, 'Kernel: eBPF programs');
      const falco = N('sec-falco', 250, 330, 'Security sensors (runtime)');
      const collector = N('obs-otel', 460, 130, 'Agent / collector');
      const flows = N('flow-data', 460, 330, 'Network flow events');
      const prom = N('obs-prometheus', 670, 130, 'Metrics backend');
      const trace = N('obs-jaeger', 670, 330, 'Trace store');
      const grafana = N('obs-grafana', 880, 130, 'Unified dashboards');
      return [
        TITLE(40, 76, 'Sensors in the kernel, not in the app'),
        app,
        kernel,
        falco,
        collector,
        flows,
        prom,
        trace,
        grafana,
        A(app, 'bottom', kernel, 'top', { text: 'syscalls, sockets' }),
        A(kernel, 'right', collector, 'left', { text: 'perf events / ring buffer' }),
        A(kernel, 'bottom', falco, 'top', { text: 'same probes, security rules' }),
        A(falco, 'right', flows, 'left', { text: 'flow + syscall events' }),
        A(collector, 'right', prom, 'left', { text: 'metrics export' }),
        A(flows, 'right', trace, 'left', { text: 'correlate with traces', routing: 'curved' }),
        A(prom, 'right', grafana, 'left', { text: 'dashboard' }),
        NOTE(40, 560, 'One eBPF agent per node replaces per-app metric libraries for infrastructure signals; keep OTel for business-level spans it cannot infer.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-log-aggregation',
    name: 'Log aggregation and retention',
    description: 'Multi-source logs → parsing and normalization → hot, warm and cold retention tiers → audit trail',
    frameTitle: 'Lesson: logs live a lifecycle',
    teaching:
      'Every source is normalized at ingestion into one schema — timestamp, level, service, trace ID — because mixed formats make correlation impossible. Retention is tiered by cost and by need: hot for this week\'s debugging, cold for the compliance window, and the audit stream is append-only.',
    build() {
      const apps = N('flow-process', 40, 130, 'Applications');
      const infra = N('linux-kernel', 40, 330, 'Infra / kernel logs');
      const shipper = N('obs-fluentd', 250, 130, 'Shipping agents');
      const parse = N('obs-fluentd', 460, 130, 'Parse + normalize (schema)');
      const hot = N('obs-loki', 670, 130, 'Hot tier: 7 days');
      const warm = N('obs-elastic', 880, 130, 'Warm tier: 90 days');
      const cold = N('stg-nfs', 670, 330, 'Cold tier: archive');
      const audit = N('sec-siem', 880, 330, 'Immutable audit trail');
      return [
        TITLE(40, 76, 'Normalize once, retain by tier, audit separately'),
        apps,
        infra,
        shipper,
        parse,
        hot,
        warm,
        cold,
        audit,
        A(apps, 'right', shipper, 'left', { text: 'structured logs' }),
        A(infra, 'right', shipper, 'left', { text: 'syslog', routing: 'curved' }),
        A(shipper, 'right', parse, 'left', { text: 'ship' }),
        A(parse, 'right', hot, 'left', { text: 'index + label' }),
        A(hot, 'right', warm, 'left', { text: 'age out (ILM)' }),
        A(hot, 'bottom', cold, 'top', { text: 'compressed snapshots', routing: 'curved' }),
        A(parse, 'bottom', audit, 'left', { text: 'security events split out', routing: 'curved' }),
        NOTE(40, 560, 'Stamp every log line with the trace ID at normalization time; that single field is what lets you jump from a slow dashboard panel to the exact log lines.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-obs-golden-signals',
    name: 'The four golden signals',
    description: 'Latency, traffic, errors and saturation collectors feeding one dashboard per service',
    frameTitle: 'Lesson: the four questions of every dashboard',
    teaching:
      'Latency asks how long, traffic asks how much, errors ask how many failed, saturation asks how full the box is. If a service dashboard cannot answer all four, it cannot localize an incident; if it answers everything else too, nobody finds the four that matter.',
    build() {
      const app = N('flow-process', 40, 130, 'Service under watch');
      const latency = N('flow-data', 250, 130, 'Latency (p50 / p99)');
      const traffic = N('flow-data', 250, 300, 'Traffic (req/s)');
      const errors = N('flow-data', 460, 130, 'Errors (5xx rate)');
      const saturation = N('flow-data', 460, 300, 'Saturation (CPU, mem, queue)');
      const prom = N('obs-prometheus', 670, 130, 'Metrics store');
      const grafana = N('obs-grafana', 880, 130, 'One dashboard per service');
      const alert = N('obs-alertmanager', 670, 300, 'Alert on symptom panels');
      return [
        TITLE(40, 76, 'Four signals, one place, no more'),
        app,
        latency,
        traffic,
        errors,
        saturation,
        prom,
        grafana,
        alert,
        A(app, 'right', latency, 'left', { text: 'duration histogram' }),
        A(app, 'bottom', traffic, 'left', { text: 'request counter', routing: 'curved' }),
        A(latency, 'right', errors, 'left', { text: 'success vs failure' }),
        A(traffic, 'right', saturation, 'left', { text: 'work vs capacity' }),
        A(errors, 'right', prom, 'left', { text: 'store series' }),
        A(saturation, 'right', alert, 'left', { text: 'thresholds', routing: 'curved' }),
        A(prom, 'right', grafana, 'left', { text: 'four panels, top row' }),
        NOTE(40, 560, 'Percentiles, not averages: an average latency of 200ms is compatible with every request over two seconds — p99 is what the slowest real users felt.'),
      ];
    },
  }),
];
