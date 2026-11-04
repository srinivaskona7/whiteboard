// templates/arch-data.js — data, AI and ML teaching architectures.
// Authority: the pattern write-ups behind the 2026-11 architecture pack; every
// diagram is plain stencil + arrow elements, not an image. Parity with the
// AWS/Azure/GCP packs: ten diagrams, one teaching lesson each, ids tpl-data-.
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
  provider: 'Data & AI',
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

export const ARCH_DATA_TEMPLATES = [
  diagram({
    id: 'tpl-data-lambda-kappa',
    name: 'Lambda and Kappa architectures compared',
    description: 'Lambda reprocesses batch history on a schedule; Kappa serves the same events from one stream',
    frameTitle: 'Lesson: Lambda (batch) vs Kappa (streaming)',
    teaching:
      'Lambda answers questions from a copy of history, so it is always consistent but minutes or hours stale; Kappa answers from the live log, so it is seconds fresh but must handle events arriving twice or out of order. Kappa wins when the same code can replay the whole retained log for a rebuild — that retention window is the real design decision.',
    build() {
      const events = N('flow-data', 40, 130, 'Application events');
      const lake = N('aws-s3', 250, 130, 'S3 raw event lake');
      const batch = N('aws-glue', 460, 130, 'Glue batch job (hourly)');
      const warehouse = N('aws-redshift', 670, 130, 'Redshift modelled tables');
      const stream = N('msg-kafka', 250, 330, 'Kafka log (retained)');
      const proc = N('gcp-dataflow', 460, 330, 'Stream processor');
      const serving = N('db-redis', 670, 330, 'Serving views');
      const bi = N('obs-grafana', 880, 130, 'Dashboards');
      return [
        TITLE(40, 76, 'Two paths for the same events'),
        events,
        lake,
        batch,
        warehouse,
        stream,
        proc,
        serving,
        bi,
        A(events, 'right', lake, 'left', { text: 'batch import (hours)' }),
        A(lake, 'right', batch, 'left', { text: 'scheduled reprocess' }),
        A(batch, 'right', warehouse, 'left', { text: 'load modelled tables' }),
        A(warehouse, 'right', bi, 'left', { text: 'SQL reports' }),
        A(events, 'bottom', stream, 'left', { text: 'same events, streamed', routing: 'curved' }),
        A(stream, 'right', proc, 'left', { text: 'consume + replay' }),
        A(proc, 'right', serving, 'left', { text: 'materialise view' }),
        A(serving, 'right', bi, 'bottom', { text: 'live dashboards', routing: 'curved' }),
        NOTE(40, 560, 'Kappa needs only the stream if the processor can replay the retained log from offset 0. Keep both only when a report genuinely needs years of history the log cannot hold.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-cqrs-es',
    name: 'CQRS with event sourcing',
    description: 'Commands validated against an aggregate are stored as events; projections rebuild every read model',
    frameTitle: 'Lesson: CQRS and event sourcing',
    teaching:
      'Writes are commands: the aggregate validates each one, then appends an immutable event — it never overwrites a row. The event store is therefore the source of truth, and every read model is a rebuildable projection of it. That is the trade: you buy perfect audit and replay by paying for asynchronous, eventually-consistent reads.',
    build() {
      const client = N('net-user', 40, 130, 'Client');
      const cmdApi = N('flow-process', 250, 130, 'Command API (writes)');
      const aggregate = N('flow-process', 460, 130, 'Domain aggregate (validate)');
      const store = N('flow-database', 670, 130, 'Event store (append-only)');
      const projections = N('aws-lambda', 670, 330, 'Projection workers');
      const readModel = N('db-postgres', 460, 330, 'Read model: order history');
      const queryApi = N('flow-process', 250, 330, 'Query API (reads)');
      return [
        TITLE(40, 76, 'One write path, many rebuildable read paths'),
        client,
        cmdApi,
        aggregate,
        store,
        projections,
        readModel,
        queryApi,
        A(client, 'right', cmdApi, 'left', { text: 'command' }),
        A(cmdApi, 'right', aggregate, 'left', { text: 'validate' }),
        A(aggregate, 'right', store, 'left', { text: 'append event v42' }),
        A(store, 'bottom', projections, 'top', { text: 'subscribe' }),
        A(projections, 'left', readModel, 'right', { text: 'project' }),
        A(queryApi, 'right', readModel, 'left', { text: 'SELECT' }),
        A(client, 'bottom', queryApi, 'top', { text: 'query', routing: 'curved' }),
        NOTE(40, 560, 'The store never answers queries. If a read model is corrupted you replay its events from offset 0 rather than running a repair script against production data.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-cdc-pipeline',
    name: 'CDC pipeline from OLTP to warehouse',
    description: 'Log-based change capture feeds the warehouse and invalidates the cache from the same stream',
    frameTitle: 'Lesson: change data capture without dual writes',
    teaching:
      'The CDC connector reads the database write-ahead log, so capturing a change costs the application nothing — no dual writes that can drift apart. The same change stream does two jobs: upserting the warehouse and evicting stale cache keys. Idempotent consumers matter, because the log delivers each change at least once.',
    build() {
      const oltp = N('db-postgres', 40, 130, 'Orders database (OLTP)');
      const cdc = N('flow-process', 250, 130, 'CDC connector (log-based)');
      const stream = N('msg-kafka', 460, 130, 'Change log topic');
      const warehouse = N('az-synapse', 670, 130, 'Warehouse (upsert marts)');
      const bi = N('obs-grafana', 880, 130, 'Analytics dashboards');
      const evictor = N('aws-lambda', 670, 330, 'Invalidation consumer');
      const cache = N('db-redis', 460, 330, 'Product cache');
      const app = N('cloud-generic', 250, 330, 'Reader application');
      return [
        TITLE(40, 76, 'One log, two consumers'),
        oltp,
        cdc,
        stream,
        warehouse,
        bi,
        evictor,
        cache,
        app,
        A(oltp, 'right', cdc, 'left', { text: 'read WAL / binlog' }),
        A(cdc, 'right', stream, 'left', { text: 'change events' }),
        A(stream, 'right', warehouse, 'left', { text: 'MERGE upserts' }),
        A(warehouse, 'right', bi, 'left', { text: 'nightly marts' }),
        A(stream, 'bottom', evictor, 'top', { text: 'same events', routing: 'curved' }),
        A(evictor, 'left', cache, 'right', { text: 'DELETE changed keys' }),
        A(app, 'right', cache, 'left', { text: 'reads (cache hit)' }),
        NOTE(40, 560, 'Never write the same row to two stores from application code — capture the change from the log instead. Order the stream by primary key or concurrent updates will arrive out of sequence.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-feature-store',
    name: 'Feature store for training and serving',
    description: 'One feature pipeline fills an offline store for training and an online store for low-latency serving',
    frameTitle: 'Lesson: training-serving skew, closed',
    teaching:
      'Both stores are filled by the same pipeline, so the feature a model trains on is bit-for-bit the feature it serves — that closes training-serving skew. The offline store supports point-in-time joins so labels never leak from the future, and the online store answers in single-digit milliseconds at request time.',
    build() {
      const sources = N('cloud-bucket', 40, 130, 'Raw event logs + tables');
      const pipeline = N('aws-glue', 250, 130, 'Feature pipeline (Spark)');
      const offline = N('gcp-bigquery', 460, 130, 'Offline store (training)');
      const online = N('db-redis', 460, 330, 'Online store (<10 ms)');
      const training = N('aws-ec2', 670, 130, 'Training jobs');
      const model = N('generic-hexagon', 880, 130, 'Trained model');
      const serving = N('flow-process', 670, 330, 'Serving API');
      const user = N('net-user', 40, 330, 'Prediction request');
      return [
        TITLE(40, 76, 'Same features at train time and serve time'),
        sources,
        pipeline,
        offline,
        online,
        training,
        model,
        serving,
        user,
        A(sources, 'right', pipeline, 'left', { text: 'batch read' }),
        A(pipeline, 'right', offline, 'left', { text: 'batch features' }),
        A(pipeline, 'bottom', online, 'top', { text: 'latest values', routing: 'curved' }),
        A(offline, 'right', training, 'left', { text: 'point-in-time join' }),
        A(training, 'right', model, 'left', { text: 'fit' }),
        A(model, 'bottom', serving, 'top', { text: 'load weights' }),
        A(online, 'right', serving, 'left', { text: 'lookup <10 ms' }),
        A(user, 'bottom', serving, 'top', { text: 'features by key', routing: 'curved' }),
        NOTE(40, 560, 'A feature defined in two places is two features. Register the definition once, compute it once, and let both stores consume the pipeline output.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-rag',
    name: 'Retrieval-augmented generation',
    description: 'Query embedding, vector retrieval, prompt assembly, LLM inference and a grounding check before answering',
    frameTitle: 'Lesson: RAG — the model answers from your documents',
    teaching:
      'Retrieval, not training, is what keeps answers current: the same index can be rebuilt every night without touching model weights. The grounding check is the honest step — an answer that cites no retrieved chunk is a guess and should be refused, not smoothed over. Quality lives in chunking and retrieval before it lives in the prompt.',
    build() {
      const user = N('net-user', 40, 130, 'Question');
      const embed = N('flow-process', 250, 130, 'Embed query');
      const vectors = N('aws-opensearch', 460, 130, 'Vector index (top-k)');
      const prompt = N('flow-process', 670, 130, 'Prompt: context + question');
      const llm = N('aws-ec2', 880, 130, 'LLM inference');
      const ground = N('flow-decision', 880, 330, 'Grounding check');
      const docs = N('flow-document', 40, 330, 'Knowledge base');
      const chunk = N('flow-process', 250, 330, 'Chunk + embed documents');
      return [
        TITLE(40, 76, 'Answer the question with retrieved evidence'),
        user,
        embed,
        vectors,
        prompt,
        llm,
        ground,
        docs,
        chunk,
        A(user, 'right', embed, 'left', { text: 'ask' }),
        A(embed, 'right', vectors, 'left', { text: 'kNN, top-k = 5' }),
        A(vectors, 'right', prompt, 'left', { text: 'retrieved chunks' }),
        A(prompt, 'right', llm, 'left', { text: 'one completion call' }),
        A(llm, 'bottom', ground, 'top', { text: 'answer + citations' }),
        A(ground, 'left', docs, 'bottom', { text: 'ungrounded → refuse', routing: 'curved' }),
        A(docs, 'right', chunk, 'left', { text: 'split 512 tokens' }),
        A(chunk, 'right', vectors, 'bottom', { text: 'index upserts', routing: 'curved' }),
        NOTE(40, 560, 'Chunking decides retrieval quality: too small loses context, too large drowns it. Re-embed documents when the embedding model changes — old vectors live in a different space.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-mlops-registry',
    name: 'MLOps loop with a model registry',
    description: 'Train, gate on evaluation, register, deploy through staging to production, monitor drift, retrain',
    frameTitle: 'Lesson: a model is a deployed artifact with a loop',
    teaching:
      'A model is promoted like a container image, never hand-carried: the registry is the only door to production, and it records weights, metrics and lineage for every version. Monitoring closes the loop — inputs drift, and a model that was right at training time silently rots. Wire the drift alarm to a new training run or the loop is decoration.',
    build() {
      const data = N('aws-s3', 40, 330, 'Training data (versioned)');
      const trainer = N('aws-ec2', 40, 130, 'Training job');
      const gates = N('flow-decision', 250, 130, 'Evaluation gates');
      const registry = N('cicd-artifact', 460, 130, 'Model registry');
      const staging = N('k8s-cluster', 670, 130, 'Staging (shadow traffic)');
      const prod = N('k8s-cluster', 880, 130, 'Production endpoint');
      const monitor = N('obs-prometheus', 670, 330, 'Monitoring: drift + latency');
      const trigger = N('aws-lambda', 460, 330, 'Retrain trigger');
      return [
        TITLE(40, 76, 'From training run to supervised production model'),
        data,
        trainer,
        gates,
        registry,
        staging,
        prod,
        monitor,
        trigger,
        A(data, 'right', trainer, 'left', { text: 'versioned snapshot', routing: 'curved' }),
        A(trainer, 'right', gates, 'left', { text: 'candidate model' }),
        A(gates, 'right', registry, 'left', { text: 'promote on pass' }),
        A(registry, 'right', staging, 'left', { text: 'deploy v1.4' }),
        A(staging, 'right', prod, 'left', { text: 'canary 5%' }),
        A(prod, 'bottom', monitor, 'top', { text: 'metrics + drift' }),
        A(monitor, 'left', trigger, 'right', { text: 'drift alarm' }),
        A(trigger, 'top', trainer, 'bottom', { text: 'new training run', routing: 'curved' }),
        NOTE(40, 560, 'Pin serving to a registry version, not to "latest". When a regression lands, the rollback is redeploying the previous registry entry — if you cannot name the version, you cannot roll back.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-mesh',
    name: 'Data mesh by domain ownership',
    description: 'Three domain data products on one self-serve platform, joined by a catalog and federated policies',
    frameTitle: 'Lesson: data ownership moves to the domain',
    teaching:
      'The domain team that produces the data owns it as a product — contract, quality bar and all — instead of shipping tickets to a central team. The platform is self-serve so publishing is an hour, not a quarter, and governance is federated: global policies computed as code, applied by the domain, with the catalog as the only discovery point.',
    build() {
      const orders = N('flow-data', 40, 130, 'Orders data product');
      const customers = N('flow-data', 40, 290, 'Customer data product');
      const shipments = N('flow-data', 40, 450, 'Shipments data product');
      const platform = N('k8s-cluster', 250, 290, 'Self-serve data platform');
      const gov = N('sec-opa', 460, 130, 'Federated governance (policy as code)');
      const catalog = N('generic-hexagon', 460, 290, 'Global catalog + lineage');
      const consumers = N('obs-grafana', 670, 290, 'Downstream consumers');
      return [
        TITLE(40, 76, 'Domains own products; the platform and catalog are shared'),
        orders,
        customers,
        shipments,
        platform,
        gov,
        catalog,
        consumers,
        A(orders, 'right', platform, 'top', { text: 'publish', routing: 'curved' }),
        A(customers, 'right', platform, 'left', { text: 'publish' }),
        A(shipments, 'right', platform, 'bottom', { text: 'publish', routing: 'curved' }),
        A(platform, 'right', catalog, 'left', { text: 'register metadata' }),
        A(gov, 'bottom', catalog, 'top', { text: 'policies computed centrally' }),
        A(catalog, 'right', consumers, 'left', { text: 'discover + access' }),
        NOTE(40, 560, 'A data product without a contract is just a table someone exports. The contract — schema, freshness, owner, SLO — is what lets consumers build on it without a meeting.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-streaming-lakehouse',
    name: 'Streaming lakehouse with medallion zones',
    description: 'Kafka stream lands in bronze, is refined to silver and gold, and serves warehouse marts and BI',
    frameTitle: 'Lesson: medallion zones and exactly-once',
    teaching:
      'Bronze is raw and immutable — it is the replayable truth, so nothing downstream is unrecoverable. Silver deduplicates and conforms; gold holds the business aggregates marts and BI read. Exactly-once comes from the checkpoint store: offsets commit only after the write succeeds, so a restarted job resumes rather than double-counts.',
    build() {
      const producers = N('flow-data', 40, 130, 'App + IoT events');
      const kafka = N('msg-kafka', 250, 130, 'Kafka event stream');
      const bronze = N('cloud-bucket', 460, 130, 'Bronze: raw, immutable');
      const silver = N('aws-glue', 460, 300, 'Silver: validate + dedupe');
      const gold = N('gcp-bigquery', 670, 300, 'Gold: business aggregates');
      const marts = N('aws-redshift', 880, 300, 'Warehouse marts');
      const checkpoints = N('aws-s3', 460, 440, 'Checkpoint + offset store');
      const bi = N('obs-grafana', 880, 130, 'BI + notebooks');
      return [
        TITLE(40, 76, 'One pipeline from raw events to served aggregates'),
        producers,
        kafka,
        bronze,
        silver,
        gold,
        marts,
        checkpoints,
        bi,
        A(producers, 'right', kafka, 'left', { text: 'produce' }),
        A(kafka, 'right', bronze, 'left', { text: 'streaming ingest' }),
        A(bronze, 'bottom', silver, 'top', { text: 'structured transform' }),
        A(silver, 'right', gold, 'left', { text: 'curated tables' }),
        A(gold, 'right', marts, 'left', { text: 'aggregate export' }),
        A(marts, 'top', bi, 'bottom', { text: 'SQL dashboards', routing: 'curved' }),
        A(silver, 'bottom', checkpoints, 'top', { text: 'write offsets' }),
        A(checkpoints, 'right', kafka, 'bottom', { text: 'commit after write', routing: 'curved' }),
        NOTE(40, 560, 'Treat bronze as append-only: reprocessing silver from bronze is a normal operation, not an incident. A job that mutates bronze destroys the replay guarantee the lakehouse is built on.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-vector-search',
    name: 'Vector search with metadata filters',
    description: 'Documents are chunked and embedded into a vector index; the search API filters by tenant and access',
    frameTitle: 'Lesson: similarity search that respects boundaries',
    teaching:
      'Embeddings make chunks comparable by meaning, but the nearest neighbours must still pass the metadata filters — tenant, ACL, freshness — or one customer reads another\'s documents. The API is the single door: filters are attached server-side at query time, never baked into the index where a rewrite would leak data.',
    build() {
      const docs = N('flow-document', 40, 130, 'Document sources');
      const chunk = N('flow-process', 250, 130, 'Chunking (overlap)');
      const embed = N('flow-process', 460, 130, 'Embedding model');
      const vdb = N('aws-opensearch', 670, 130, 'Vector DB (ANN index)');
      const app = N('net-user', 40, 300, 'Client application');
      const api = N('aws-apigw', 250, 300, 'Similarity search API');
      const filters = N('sec-opa', 460, 300, 'Metadata + ACL filters');
      return [
        TITLE(40, 76, 'Index by meaning, gate by metadata'),
        docs,
        chunk,
        embed,
        vdb,
        app,
        api,
        filters,
        A(docs, 'right', chunk, 'left', { text: 'split + clean' }),
        A(chunk, 'right', embed, 'left', { text: 'text → vector' }),
        A(embed, 'right', vdb, 'left', { text: 'upsert vector + metadata' }),
        A(app, 'right', api, 'left', { text: 'query + tenant scope' }),
        A(api, 'right', filters, 'left', { text: 'attach server-side filters' }),
        A(filters, 'right', vdb, 'bottom', { text: 'filtered kNN', routing: 'curved' }),
        NOTE(40, 560, 'Store the metadata next to the vector at ingest time. Filtering after retrieval leaks neighbours from other tenants; filtering inside the query keeps the search honest.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-data-training-cluster',
    name: 'Distributed GPU training topology',
    description: 'Scheduler shards a job across GPU workers; gradients reduce on a parameter server, checkpoints land in object storage',
    frameTitle: 'Lesson: what a distributed training job actually needs',
    teaching:
      'The scheduler owns placement — co-locating workers on high-bandwidth links matters more than raw FLOPS, because all-reduce time is the usual bottleneck. The parameter server accumulates gradients from every shard each step, so one slow worker stalls the step for all. Checkpoints in object storage make a preempted spot GPU a retry, not a lost night.',
    build() {
      const submitter = N('net-user', 40, 130, 'ML engineer');
      const scheduler = N('k8s-cluster', 250, 130, 'GPU scheduler (queue + placement)');
      const param = N('cloud-server', 460, 130, 'Parameter server (weights)');
      const store = N('aws-s3', 670, 130, 'Checkpoints (object storage)');
      const worker1 = N('aws-ec2', 250, 300, 'GPU worker 0 (8× A100)');
      const worker2 = N('aws-ec2', 460, 300, 'GPU worker 1 (8× A100)');
      const metrics = N('obs-prometheus', 670, 300, 'GPU utilisation metrics');
      return [
        TITLE(40, 76, 'Sharded training with a shared parameter server'),
        submitter,
        scheduler,
        param,
        store,
        worker1,
        worker2,
        metrics,
        A(submitter, 'right', scheduler, 'left', { text: 'job spec' }),
        A(scheduler, 'bottom', worker1, 'top', { text: 'assign shard 0' }),
        A(scheduler, 'right', worker2, 'top', { text: 'assign shard 1', routing: 'curved' }),
        A(worker1, 'right', param, 'bottom', { text: 'gradients (all-reduce)', routing: 'curved' }),
        A(worker2, 'top', param, 'bottom', { text: 'gradients' }),
        A(param, 'right', store, 'left', { text: 'checkpoint every N steps' }),
        A(store, 'bottom', metrics, 'top', { text: 'resume after preemption', routing: 'curved' }),
        A(worker2, 'right', metrics, 'left', { text: 'GPU telemetry' }),
        NOTE(40, 560, 'Checkpoint step and data-order state together — a checkpoint without the sampler position restarts on data a worker already saw. Prefer spot GPUs only once resume is measured in minutes.'),
      ];
    },
  }),
];
