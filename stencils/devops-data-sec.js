// stencils/devops-data-sec.js — Monitoring, Logging, Security, Databases, Storage & Messaging Icons
import { createDevOpsStencil } from './card.js';

const D = {
  flame: `<circle cx="50" cy="36" r="24" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50,16 C60,26 62,38 50,48 C38,38 40,26 50,16 Z" fill="none" stroke="currentColor" stroke-width="4"/><line x1="34" y1="52" x2="66" y2="52" stroke="currentColor" stroke-width="4"/>`,
  gauge: `<path d="M22,48 A28,28 0 1,1 78,48" fill="none" stroke="currentColor" stroke-width="4.5"/><line x1="50" y1="44" x2="66" y2="24" stroke="currentColor" stroke-width="4.2"/><circle cx="50" cy="44" r="5" fill="currentColor"/>`,
  traces: `<line x1="18" y1="20" x2="54" y2="20" stroke="currentColor" stroke-width="5"/><line x1="30" y1="34" x2="78" y2="34" stroke="currentColor" stroke-width="5"/><line x1="44" y1="48" x2="82" y2="48" stroke="currentColor" stroke-width="5"/><line x1="18" y1="12" x2="18" y2="58" stroke="currentColor" stroke-width="3.2"/>`,
  logs: `<rect x="20" y="12" width="60" height="48" rx="5" fill="none" stroke="currentColor" stroke-width="4"/><line x1="30" y1="24" x2="70" y2="24" stroke="currentColor" stroke-width="3.8"/><line x1="30" y1="36" x2="70" y2="36" stroke="currentColor" stroke-width="3.8"/><line x1="30" y1="48" x2="56" y2="48" stroke="currentColor" stroke-width="3.8"/>`,
  bell: `<path d="M32,46 V32 A18,18 0 0,1 68,32 V46 L74,52 H26 Z" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="58" r="4" fill="currentColor"/>`,
  vault: `<polygon points="50,10 84,58 16,58" fill="none" stroke="currentColor" stroke-width="4.2"/><circle cx="50" cy="41" r="7" fill="currentColor"/>`,
  shield: `<path d="M50,8 L80,20 V38 C80,52 66,62 50,66 C34,62 20,52 20,38 V20 Z" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="38,37 47,46 64,28" fill="none" stroke="currentColor" stroke-width="4"/>`,
  scan: `<circle cx="46" cy="34" r="18" fill="none" stroke="currentColor" stroke-width="4.2"/><line x1="59" y1="47" x2="76" y2="62" stroke="currentColor" stroke-width="5"/><line x1="36" y1="34" x2="56" y2="34" stroke="currentColor" stroke-width="3.5"/>`,
  key: `<circle cx="34" cy="36" r="14" fill="none" stroke="currentColor" stroke-width="4.2"/><line x1="48" y1="36" x2="84" y2="36" stroke="currentColor" stroke-width="4.2"/><line x1="70" y1="36" x2="70" y2="48" stroke="currentColor" stroke-width="4.2"/><line x1="80" y1="36" x2="80" y2="45" stroke="currentColor" stroke-width="4.2"/>`,
  db: `<ellipse cx="50" cy="16" rx="26" ry="8" fill="none" stroke="currentColor" stroke-width="4.2"/><path d="M24,16 V52 A26,8 0 0,0 76,52 V16" fill="none" stroke="currentColor" stroke-width="4.2"/><path d="M24,34 A26,8 0 0,0 76,34" fill="none" stroke="currentColor" stroke-width="3.6"/>`,
  leafDb: `<ellipse cx="50" cy="16" rx="26" ry="8" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24,16 V52 A26,8 0 0,0 76,52 V16" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50,24 C60,32 60,44 50,52 C40,44 40,32 50,24 Z" fill="none" stroke="currentColor" stroke-width="3.5"/>`,
  cache: `<polygon points="50,10 82,24 50,38 18,24" fill="none" stroke="currentColor" stroke-width="4"/><polyline points="18,35 50,49 82,35" fill="none" stroke="currentColor" stroke-width="4"/><polyline points="18,46 50,60 82,46" fill="none" stroke="currentColor" stroke-width="4"/>`,
  kafka: `<circle cx="34" cy="36" r="9" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="68" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="72" cy="36" r="7" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="68" cy="56" r="7" fill="none" stroke="currentColor" stroke-width="4"/><line x1="42" y1="31" x2="62" y2="19" stroke="currentColor" stroke-width="3.8"/><line x1="43" y1="36" x2="65" y2="36" stroke="currentColor" stroke-width="3.8"/><line x1="42" y1="41" x2="62" y2="53" stroke="currentColor" stroke-width="3.8"/>`,
  queue: `<rect x="16" y="22" width="18" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="3.8"/><rect x="41" y="22" width="18" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="3.8"/><rect x="66" y="22" width="18" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="3.8"/>`,
  bucket: `<polygon points="22,16 78,16 68,58 32,58" fill="none" stroke="currentColor" stroke-width="4.2"/><ellipse cx="50" cy="16" rx="28" ry="6" fill="none" stroke="currentColor" stroke-width="3.8"/>`,
};

const obs = (id, name, badge, defaultText, tags, svgBody, color = '#E6522C') =>
  createDevOpsStencil({ id, name, category: 'Monitoring & Logging', badge, color, defaultText, tags, svgBody });

const sec = (id, name, badge, defaultText, tags, svgBody, color = '#059669') =>
  createDevOpsStencil({ id, name, category: 'Security & Secrets', badge, color, defaultText, tags, svgBody });

const data = (id, name, badge, defaultText, tags, svgBody, color = '#0284C7') =>
  createDevOpsStencil({ id, name, category: 'Databases, Storage & Messaging', badge, color, defaultText, tags, svgBody });

export const DEVOPS_DATA_SEC_STENCILS = [
  // Monitoring, Logging & Observability
  obs('obs-prometheus', 'Prometheus', 'PROM', 'Prometheus TSDB', 'metrics scrape alert promql monitoring', D.flame, '#E6522C'),
  obs('obs-grafana', 'Grafana', 'GRAFANA', 'Grafana Dashboard', 'visualization dashboard panels observability', D.gauge, '#F46800'),
  obs('obs-otel', 'OpenTelemetry', 'OTEL', 'OTel Collector', 'telemetry traces metrics logs instrumentation', D.traces, '#425CC7'),
  obs('obs-elastic', 'Elasticsearch / OpenSearch', 'ELASTIC', 'Elasticsearch', 'elk search index log analytics', D.scan, '#005571'),
  obs('obs-kibana', 'Kibana', 'KIBANA', 'Kibana UI', 'elk log search visualization', D.gauge, '#E8478B'),
  obs('obs-loki', 'Grafana Loki', 'LOKI', 'Loki Log Store', 'log aggregation promtail logql', D.logs, '#F46800'),
  obs('obs-fluentd', 'Fluentd / Fluent Bit', 'FLUENT', 'Fluent Bit Agent', 'log forwarder daemonset parser', D.logs, '#0E83CD'),
  obs('obs-jaeger', 'Jaeger / Tempo', 'TRACES', 'Distributed Tracing', 'spans traces jaeger tempo zipkin', D.traces, '#0D9488'),
  obs('obs-datadog', 'Datadog APM', 'DATADOG', 'Datadog Agent', 'apm monitoring cloud observability', D.gauge, '#632CA6'),
  obs('obs-alertmanager', 'Alertmanager / PagerDuty', 'ALERTS', 'Alertmanager', 'incident oncall paging webhook slack', D.bell, '#DC2626'),

  // Security, Governance & Secrets
  sec('sec-vault', 'HashiCorp Vault', 'VAULT', 'HashiCorp Vault', 'secrets encryption dynamic credentials kms', D.vault, '#334155'),
  sec('sec-trivy', 'Trivy / Vulnerability Scan', 'TRIVY', 'Trivy Scanner', 'sbom cve container image security scan', D.scan, '#1904DA'),
  sec('sec-opa', 'OPA / Kyverno Policy', 'POLICY', 'OPA Gatekeeper', 'policy as code admission rego kyverno', D.shield, '#059669'),
  sec('sec-falco', 'Falco Runtime Security', 'FALCO', 'Falco eBPF Sensor', 'runtime threat detection syscall audit', D.shield, '#00AEC7'),
  sec('sec-pki', 'Cert-Manager / PKI', 'PKI', 'Let’s Encrypt PKI', 'x509 tls certificate authority acme', D.key, '#003A70'),
  sec('sec-oidc', 'OAuth2 / OIDC Provider', 'OIDC', 'OIDC / Keycloak', 'sso jwt authentication identity', D.key, '#4F46E5'),
  sec('sec-waf', 'WAF & DDoS Shield', 'WAF', 'Edge WAF Shield', 'owasp firewall rate limit ddos', D.shield, '#DC2626'),
  sec('sec-siem', 'SIEM / Audit Log', 'SIEM', 'Security SIEM', 'compliance soc audit event correlation', D.logs, '#0F766E'),

  // Databases, Storage & Messaging
  data('db-postgres', 'PostgreSQL', 'PGSQL', 'PostgreSQL DB', 'relational sql acid database postgres', D.db, '#336791'),
  data('db-mysql', 'MySQL / MariaDB', 'MYSQL', 'MySQL Database', 'relational sql database innodb', D.db, '#00758F'),
  data('db-mongodb', 'MongoDB', 'MONGO', 'MongoDB Cluster', 'nosql document bson collection', D.leafDb, '#47A248'),
  data('db-redis', 'Redis', 'REDIS', 'Redis Cache', 'in-memory cache pubsub key value', D.cache, '#DC382D'),
  data('db-cassandra', 'Apache Cassandra', 'CASSANDRA', 'Cassandra Ring', 'wide column distributed nosql', D.db, '#1287B1'),
  data('msg-kafka', 'Apache Kafka', 'KAFKA', 'Kafka Broker', 'event streaming topic partition consumer', D.kafka, '#231F20'),
  data('msg-rabbitmq', 'RabbitMQ', 'RABBITMQ', 'RabbitMQ Broker', 'amqp message queue exchange routing', D.queue, '#FF6600'),
  data('msg-nats', 'NATS JetStream', 'NATS', 'NATS Messaging', 'cloud native messaging pubsub', D.kafka, '#27AAE1'),
  data('stg-minio', 'MinIO Object Storage', 'MINIO', 'MinIO S3 Store', 's3 compatible object storage bucket', D.bucket, '#C72C48'),
  data('stg-nfs', 'Ceph / NFS / Block Store', 'STORAGE', 'Block / NFS Volume', 'san nas ceph rook block storage', D.db, '#475569'),
  data('db-consul', 'HashiCorp Consul', 'CONSUL', 'Consul Discovery', 'service discovery kv health check', D.kafka, '#CA2171'),
];
