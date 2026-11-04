// templates/arch-aws-x.js — extra AWS teaching architectures (pack X).
// Conventions mirror templates/aws.js: plain stencil + arrow elements,
// a frame with real teaching notes, and templateId stamped on everything.
// Where no service-specific stencil exists (MediaLive, IoT Core, Timestream,
// AWS Backup) a generic or relabelled stencil carries the service name.
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
  provider: 'AWS',
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

export const ARCH_AWS_X_TEMPLATES = [
  diagram({
    id: 'tpl-awsx-media-streaming',
    name: 'AWSX-01 Live and on-demand media streaming',
    description: 'MediaLive channel → MediaStore/S3 origins → CloudFront distribution for live HLS and VOD playback',
    frameTitle: 'Lesson: live and on-demand media streaming',
    teaching:
      'The live path and the on-demand path share one distribution: MediaLive writes short HLS segments to MediaStore for near-real-time playback, while the transcode pipeline writes longer VOD assets to S3. CloudFront treats each origin as a cache behaviour, so viewers never see which bucket a segment came from.',
    build() {
      const studio = N('cloud-generic', 40, 130, 'Studio contribution feed');
      const medialive = N('flow-process', 250, 130, 'MediaLive channel');
      const mediastore = N('aws-s3', 460, 130, 'MediaStore container (live)');
      const cf = N('aws-cloudfront', 670, 130, 'CloudFront distribution');
      const viewers = N('cloud-generic', 880, 130, 'Viewers (any device)');
      const transcode = N('flow-process', 250, 300, 'Transcode pipeline (VOD)');
      const vod = N('aws-s3', 460, 300, 'S3 VOD archive bucket');
      return [
        TITLE(40, 76, 'One distribution, two origins: live and on-demand'),
        studio,
        medialive,
        mediastore,
        cf,
        viewers,
        transcode,
        vod,
        A(studio, 'right', medialive, 'left', { text: 'RTMP push' }),
        A(medialive, 'right', mediastore, 'left', { text: 'HLS segments' }),
        A(mediastore, 'right', cf, 'left', { text: 'live origin' }),
        A(cf, 'right', viewers, 'left', { text: 'HTTPS playback' }),
        A(mediastore, 'bottom', transcode, 'right', { text: 'archive stream', routing: 'curved' }),
        A(transcode, 'right', vod, 'left', { text: 'renditions' }),
        A(vod, 'right', cf, 'bottom', { text: 'VOD origin', routing: 'curved' }),
        NOTE(40, 560, 'Short TTL on the live origin, long TTL on the VOD origin. MediaStore is for seconds-old segments; S3 is for finished assets.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-payments',
    name: 'AWSX-02 Payment saga with Step Functions',
    description: 'API Gateway → Lambda → Step Functions saga (charge / refund / compensate) → DynamoDB ledger + SQS notifications',
    frameTitle: 'Lesson: a payment flow that can be unwound',
    teaching:
      'A payment spans several services that can each fail independently, so the state machine — not the Lambda — owns the ordering. Every step writes an idempotency-keyed row to the ledger, and compensation runs in reverse order: a failed shipment refunds the charge rather than leaving money captured.',
    build() {
      const client = N('cloud-generic', 40, 130, 'Checkout client');
      const apigw = N('aws-apigw', 250, 130, 'API Gateway /payments');
      const fn = N('aws-lambda', 460, 130, 'Payment Lambda');
      const saga = N('aws-stepfunctions', 670, 130, 'Saga: charge → ship → compensate');
      const ledger = N('aws-dynamodb', 460, 300, 'DynamoDB payments ledger');
      const events = N('aws-sqs', 670, 300, 'Event queue (SQS)');
      const notify = N('aws-lambda', 880, 300, 'Notification Lambda');
      return [
        TITLE(40, 76, 'Charge, and know how to undo the charge'),
        client,
        apigw,
        fn,
        saga,
        ledger,
        events,
        notify,
        A(client, 'right', apigw, 'left', { text: 'POST /charge' }),
        A(apigw, 'right', fn, 'left', { text: 'invoke (idempotency key)' }),
        A(fn, 'right', saga, 'left', { text: 'start execution' }),
        A(saga, 'bottom', ledger, 'top', { text: 'step state + amounts' }),
        A(saga, 'right', events, 'top', { text: 'outcome event', routing: 'curved' }),
        A(events, 'right', notify, 'left', { text: 'receipts, refunds' }),
        A(fn, 'bottom', ledger, 'left', { text: 'PutItem (conditional)', routing: 'curved' }),
        NOTE(40, 560, 'Never retry a payment without an idempotency key: a timeout is not a failure, and a retried charge must not become two charges.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-fraud-detection',
    name: 'AWSX-03 Real-time fraud detection',
    description: 'Kinesis stream → Lambda scoring with DynamoDB account state → SNS alerts to analysts',
    frameTitle: 'Lesson: scoring transactions in flight',
    teaching:
      'The stream decouples scoring speed from event volume: a burst of transactions is buffered in Kinesis shards, not dropped. The scoring function reads the account’s recent history from DynamoDB before it decides, so the alert reflects behaviour — not a single transaction in isolation.',
    build() {
      const events = N('flow-data', 40, 130, 'Transaction events');
      const kinesis = N('aws-kinesis', 250, 130, 'Kinesis data stream');
      const scorer = N('aws-lambda', 460, 130, 'Scoring Lambda (model)');
      const state = N('aws-dynamodb', 670, 130, 'Account state table');
      const alerts = N('aws-sns', 460, 300, 'SNS fraud alert topic');
      const analyst = N('cloud-generic', 670, 300, 'Fraud analyst on-call');
      const cw = N('aws-cloudwatch', 250, 300, 'Scoring metrics + alarms');
      return [
        TITLE(40, 76, 'Decide in milliseconds, alert in context'),
        events,
        kinesis,
        scorer,
        state,
        alerts,
        analyst,
        cw,
        A(events, 'right', kinesis, 'left', { text: 'PutRecords' }),
        A(kinesis, 'right', scorer, 'left', { text: 'batch of records' }),
        A(scorer, 'right', state, 'left', { text: 'recent history (GetItem)' }),
        A(scorer, 'bottom', alerts, 'top', { text: 'score above threshold' }),
        A(alerts, 'right', analyst, 'left', { text: 'page + review queue' }),
        A(scorer, 'bottom', cw, 'right', { text: 'latency + score metrics', routing: 'curved' }),
        NOTE(40, 560, 'Alert on the account pattern, not the transaction: velocity, geography and device change the meaning of one large purchase.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-batch',
    name: 'AWSX-04 Batch processing on spot capacity',
    description: 'S3 inputs → Batch queue on EC2 spot fleet → S3 outputs → SNS completion notifications',
    frameTitle: 'Lesson: cheap compute for work nobody is watching',
    teaching:
      'Batch work tolerates interruption, so it belongs on spot capacity at a fraction of on-demand price: the queue holds the job until a worker is free, and a spot reclaim just means the job runs again. Completion is a notification, not a person polling a dashboard.',
    build() {
      const inputs = N('aws-s3', 40, 130, 'S3 input bucket');
      const queue = N('aws-ecs', 250, 130, 'Batch job queue (Fargate/EC2)');
      const fleet = N('aws-ec2', 460, 130, 'Spot compute fleet');
      const outputs = N('aws-s3', 670, 130, 'S3 results bucket');
      const done = N('aws-sns', 880, 130, 'SNS completion topic');
      const cw = N('aws-cloudwatch', 460, 300, 'Job metrics + retries');
      const ecr = N('aws-ecr', 250, 300, 'Job container image (ECR)');
      return [
        TITLE(40, 76, 'Queue the work, rent the compute by the hour'),
        inputs,
        queue,
        fleet,
        outputs,
        done,
        cw,
        ecr,
        A(inputs, 'right', queue, 'left', { text: 'ObjectCreated trigger' }),
        A(queue, 'right', fleet, 'left', { text: 'place job' }),
        A(fleet, 'right', outputs, 'left', { text: 'write results' }),
        A(outputs, 'right', done, 'left', { text: 'manifest published' }),
        A(fleet, 'bottom', cw, 'top', { text: 'job duration + failures' }),
        A(ecr, 'right', fleet, 'left', { text: 'pull image', routing: 'curved' }),
        NOTE(40, 560, 'Design every job to be restartable from S3: a spot reclaim is a normal event, not an incident. Checkpoint partial work.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-site-vpn',
    name: 'AWSX-05 Site VPN and hybrid network',
    description: 'Client VPN into a VPC, private subnets with NAT egress, Direct Connect for the data-centre lane',
    frameTitle: 'Lesson: two doors into the same VPC',
    teaching:
      'Remote staff and the data centre use different doors on purpose: the VPN door is encrypted over the internet and cheap, while Direct Connect is a private circuit with predictable latency for bulk traffic. Both land in private subnets — nothing user-facing is ever public here, and NAT carries the egress only.',
    build() {
      const staff = N('cloud-generic', 40, 130, 'Remote workforce');
      const vpn = N('net-vpn', 250, 130, 'Client VPN endpoint');
      const vpc = N('aws-vpc', 460, 130, 'VPC (10.0.0.0/16)');
      const apps = N('aws-ec2', 670, 130, 'Internal applications');
      const nat = N('aws-nat', 880, 130, 'NAT gateway (egress)');
      const dx = N('aws-directconnect', 250, 300, 'Direct Connect');
      const dc = N('cloud-vm', 40, 300, 'On-premises data centre');
      return [
        TITLE(40, 76, 'VPN for people, Direct Connect for data'),
        staff,
        vpn,
        vpc,
        apps,
        nat,
        dx,
        dc,
        A(staff, 'right', vpn, 'left', { text: 'mutual TLS (client cert)' }),
        A(vpn, 'right', vpc, 'left', { text: 'tunnel into private subnets' }),
        A(vpn, 'right', apps, 'top', { text: 'route to app tier', routing: 'curved' }),
        A(apps, 'right', nat, 'left', { text: 'patch + package egress' }),
        A(dc, 'right', dx, 'left', { text: 'private circuit (1/10 Gbps)' }),
        A(dx, 'right', vpc, 'bottom', { text: 'BGP into shared VPC', routing: 'curved' }),
        NOTE(40, 560, 'Split the routes: the VPN advertises app subnets only, and Direct Connect advertises the replication lane. Overlapping CIDRs are how hybrid networks die.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-eks-gitops',
    name: 'AWSX-06 EKS platform with GitOps delivery',
    description: 'GitHub commit → CodeBuild image → ECR → EKS, Argo CD syncs manifests and IRSA grants pod permissions',
    frameTitle: 'Lesson: Git is the only way to change the cluster',
    teaching:
      'Two repositories move independently on purpose: an image change flows through build and ECR, while a manifest change flows through the GitOps repo into Argo CD. Nobody runs kubectl by hand — if the cluster drifted, Argo CD reconciles it back to Git, and pods get AWS permissions via IRSA, never baked-in keys.',
    build() {
      const git = N('git-github', 40, 130, 'GitHub: application commit');
      const build = N('aws-cloudformation', 250, 130, 'CodeBuild: build + test');
      const ecr = N('aws-ecr', 460, 130, 'ECR image registry');
      const manifests = N('git-github', 40, 300, 'GitOps repo: manifests');
      const argo = N('cicd-argocd', 250, 300, 'Argo CD sync');
      const eks = N('aws-eks', 460, 300, 'EKS cluster');
      const irsa = N('aws-iam', 670, 300, 'IRSA role (service account)');
      const apps = N('k8s-pod', 670, 130, 'Running workload pods');
      return [
        TITLE(40, 76, 'Image lane and manifest lane, one cluster'),
        git,
        build,
        ecr,
        manifests,
        argo,
        eks,
        irsa,
        apps,
        A(git, 'right', build, 'left', { text: 'push triggers build' }),
        A(build, 'right', ecr, 'left', { text: 'push digest if tests pass' }),
        A(ecr, 'right', apps, 'left', { text: 'digest referenced by tag', routing: 'curved' }),
        A(manifests, 'right', argo, 'left', { text: 'PR merged to main' }),
        A(argo, 'right', eks, 'left', { text: 'sync + self-heal' }),
        A(eks, 'right', irsa, 'left', { text: 'annotate service account' }),
        A(irsa, 'top', apps, 'bottom', { text: 'IAM role for the pod', routing: 'curved' }),
        NOTE(40, 560, 'Pin manifests to a digest, not :latest — GitOps means the repo state and the cluster state must be provably the same.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-iot-telemetry',
    name: 'AWSX-07 IoT telemetry pipeline',
    description: 'IoT Core MQTT → Kinesis stream → Lambda enrichment → DynamoDB time-series store → CloudWatch alarms',
    frameTitle: 'Lesson: from device to dashboard without a server',
    teaching:
      'Devices speak MQTT to the broker because a flaky cellular link must be tolerated: the device keeps the last will and QoS settings. The stream buffers the burst when ten thousand devices report at once, and the store keeps timestamps first-class so a query can ask what happened at 03:00, not just what the latest value was.',
    build() {
      const devices = N('flow-data', 40, 130, 'Fleet devices (MQTT)');
      const core = N('cloud-generic', 250, 130, 'IoT Core message broker');
      const kinesis = N('aws-kinesis', 460, 130, 'Kinesis data stream');
      const enrich = N('aws-lambda', 670, 130, 'Enrichment Lambda');
      const store = N('aws-dynamodb', 880, 130, 'Time-series store (Timestream)');
      const cw = N('aws-cloudwatch', 670, 300, 'CloudWatch metrics + alarms');
      return [
        TITLE(40, 76, 'Telemetry in, alarms out, no servers in between'),
        devices,
        core,
        kinesis,
        enrich,
        store,
        cw,
        A(devices, 'right', core, 'left', { text: 'MQTT publish (QoS 1)' }),
        A(core, 'right', kinesis, 'left', { text: 'rule → stream' }),
        A(kinesis, 'right', enrich, 'left', { text: 'batch of readings' }),
        A(enrich, 'right', store, 'left', { text: 'timestamp + device metadata' }),
        A(enrich, 'bottom', cw, 'top', { text: 'battery, offline, anomalies' }),
        A(devices, 'right', cw, 'bottom', { text: 'device shadows as metrics', routing: 'curved' }),
        NOTE(40, 560, 'Keep the hot path thin: enrich after the buffer, alert from the metrics, and never let one slow device block a shard.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-search',
    name: 'AWSX-08 Managed search and log analytics',
    description: 'SQS + CloudWatch ingestion → Lambda indexer → OpenSearch cluster with S3 snapshots',
    frameTitle: 'Lesson: search is a pipeline, not a database',
    teaching:
      'Documents and logs arrive from two sources, but both queue first so a spike cannot overload the cluster: the indexer drains the queue at a rate OpenSearch can absorb. Snapshots go to S3 on a schedule, because a search index is rebuildable — but rebuilding a week of logs is not the same as restoring them.',
    build() {
      const docs = N('flow-document', 40, 130, 'Documents + log events');
      const queue = N('aws-sqs', 250, 130, 'SQS ingestion queue');
      const indexer = N('aws-lambda', 460, 130, 'Indexer Lambda');
      const cluster = N('aws-opensearch', 670, 130, 'OpenSearch cluster');
      const users = N('cloud-generic', 880, 130, 'Search + dashboard users');
      const snaps = N('aws-s3', 460, 300, 'S3 snapshot bucket');
      const health = N('aws-cloudwatch', 670, 300, 'Cluster health + alarms');
      return [
        TITLE(40, 76, 'Queue first, index second, snapshot always'),
        docs,
        queue,
        indexer,
        cluster,
        users,
        snaps,
        health,
        A(docs, 'right', queue, 'left', { text: 'enqueue batch' }),
        A(queue, 'right', indexer, 'left', { text: 'poll (batch of 10)' }),
        A(indexer, 'right', cluster, 'left', { text: 'bulk API' }),
        A(cluster, 'right', users, 'left', { text: 'query DSL / dashboards' }),
        A(indexer, 'bottom', snaps, 'top', { text: 'daily snapshot', routing: 'curved' }),
        A(cluster, 'bottom', health, 'top', { text: 'shard + JVM metrics' }),
        NOTE(40, 560, 'Size shards for the retention you keep, not the data you have: a queue in front means a slow cluster degrades latency, never loses documents.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-backup-dr',
    name: 'AWSX-09 Backup and disaster recovery',
    description: 'AWS Backup vault → S3 cross-region replication → restore path into a DR VPC',
    frameTitle: 'Lesson: a backup nobody restored is a hope, not a plan',
    teaching:
      'The vault is the policy: one backup plan tags EBS volumes, DynamoDB tables and RDS snapshots on a schedule, and cross-region replication makes the copy survive the loss of the whole region. The restore path matters as much as the copy — rehearse it into the DR VPC, because a restore you have never timed has no RTO.',
    build() {
      const prod = N('aws-ebs', 40, 130, 'Production volumes + tables');
      const vault = N('aws-s3', 250, 130, 'AWS Backup vault (policy)');
      const replica = N('aws-s3', 460, 130, 'S3 cross-region replica');
      const drVpc = N('aws-vpc', 670, 130, 'DR VPC (standby region)');
      const restored = N('aws-ec2', 880, 130, 'Restored instances');
      const rds = N('aws-rds', 460, 300, 'Restored database copy');
      const monitor = N('aws-cloudwatch', 250, 300, 'Backup job monitor');
      return [
        TITLE(40, 76, 'Copy it, replicate it, then practise bringing it back'),
        prod,
        vault,
        replica,
        drVpc,
        restored,
        rds,
        monitor,
        A(prod, 'right', vault, 'left', { text: 'scheduled backup plan' }),
        A(vault, 'right', replica, 'left', { text: 'cross-region copy' }),
        A(replica, 'right', drVpc, 'left', { text: 'restore into standby' }),
        A(drVpc, 'right', restored, 'left', { text: 'point-in-time restore' }),
        A(replica, 'bottom', rds, 'top', { text: 'latest restorable time', routing: 'curved' }),
        A(vault, 'bottom', monitor, 'top', { text: 'job success + retention' }),
        NOTE(40, 560, 'State RPO as the replication lag you measured and RTO as the restore you timed — and encrypt the vault with a key in the target region too.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-awsx-messaging-fanout',
    name: 'AWSX-10 SNS fan-out with worker queues',
    description: 'SNS topic → SQS queues for email, SMS and audit workers, each with a dead-letter queue and Lambda consumers',
    frameTitle: 'Lesson: fan-out without coupling producers to consumers',
    teaching:
      'The topic knows nothing about who subscribes: adding an audit consumer is a new queue subscription, not a change to the producer. Each queue gets its own dead-letter queue, so a broken email worker parks its poison messages instead of blocking the SMS worker behind it — different consumers can fail independently.',
    build() {
      const producer = N('aws-lambda', 40, 130, 'Order service');
      const topic = N('aws-sns', 250, 130, 'SNS topic (order.placed)');
      const emailQ = N('aws-sqs', 460, 130, 'Email queue');
      const smsQ = N('aws-sqs', 670, 130, 'SMS queue');
      const auditQ = N('aws-sqs', 880, 130, 'Audit queue');
      const emailFn = N('aws-lambda', 460, 300, 'Email worker');
      const smsFn = N('aws-lambda', 670, 300, 'SMS worker');
      const dlq = N('aws-sqs', 880, 300, 'DLQ per queue (maxReceive 5)');
      return [
        TITLE(40, 76, 'One publish, many consumers, isolated failures'),
        producer,
        topic,
        emailQ,
        smsQ,
        auditQ,
        emailFn,
        smsFn,
        dlq,
        A(producer, 'right', topic, 'left', { text: 'Publish (at-least-once)' }),
        A(topic, 'right', emailQ, 'left', { text: 'subscription' }),
        A(topic, 'right', smsQ, 'top', { text: 'subscription', routing: 'curved' }),
        A(topic, 'right', auditQ, 'top', { text: 'subscription', routing: 'curved' }),
        A(emailQ, 'bottom', emailFn, 'top', { text: 'poll' }),
        A(smsQ, 'bottom', smsFn, 'top', { text: 'poll' }),
        A(emailQ, 'right', dlq, 'left', { text: 'after 5 receives', routing: 'curved' }),
        A(auditQ, 'bottom', dlq, 'top', { text: 'park + redrive', routing: 'curved' }),
        NOTE(40, 560, 'SQS redrive the DLQ after fixing the bug, and filter subscriptions server-side when consumers only want one event type.'),
      ];
    },
  }),
];
