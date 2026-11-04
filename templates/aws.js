// templates/aws.js — native, editable AWS teaching architectures.
// Authority: AWS service names and topology relationships documented for the
// 2026-11 review; every diagram is plain stencil + arrow elements, not an image.
// Parity with the Azure/GCP pack: ten diagrams, one teaching sentence each.
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

export const AWS_TEMPLATES = [
  diagram({
    id: 'tpl-aws-01-three-tier-web',
    name: 'AWS-01 Three-tier web application',
    description: 'Route 53 → CloudFront + WAF → ALB → EC2 Auto Scaling → Aurora with Multi-AZ',
    frameTitle: 'Lesson: AWS three-tier web application',
    teaching:
      'Route 53 answers the name, CloudFront serves the edge copy and blocks obvious attacks, and the ALB is the only thing the internet reaches in the VPC. App servers live in private subnets and leave through a NAT gateway; Aurora is Multi-AZ, so losing one Availability Zone does not lose the database.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Internet user');
      const dns = N('aws-route53', 250, 130, 'Route 53 hosted zone');
      const cf = N('aws-cloudfront', 460, 130, 'CloudFront + WAF');
      const alb = N('aws-alb', 670, 130, 'ALB (public subnets)');
      const asg = N('aws-ec2', 670, 300, 'EC2 Auto Scaling');
      const nat = N('aws-nat', 460, 300, 'NAT gateway');
      const rds = N('aws-rds', 880, 300, 'Aurora Multi-AZ');
      return [
        TITLE(40, 76, 'Three-tier application on AWS'),
        user,
        dns,
        cf,
        alb,
        asg,
        nat,
        rds,
        A(user, 'right', dns, 'left', { text: 'resolve' }),
        A(dns, 'right', cf, 'left', { text: 'alias record' }),
        A(cf, 'right', alb, 'left', { text: 'HTTPS 443' }),
        A(alb, 'bottom', asg, 'top', { text: 'target group :8080' }),
        A(asg, 'right', rds, 'left', { text: '3306 private subnets' }),
        A(asg, 'left', nat, 'right', { text: 'egress for patches', routing: 'curved' }),
        NOTE(40, 560, 'The ALB sits in public subnets; app servers and Aurora sit in private subnets. NAT is only for egress, never for inbound traffic.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-02-eks-platform',
    name: 'AWS-02 EKS microservices platform',
    description: 'ALB ingress → EKS pods → DynamoDB and ElastiCache, images pulled from ECR by IRSA',
    frameTitle: 'Lesson: EKS microservices platform',
    teaching:
      'The AWS Load Balancer Controller turns an Ingress into an ALB, so no second load balancer is hand-built. Pods get AWS permissions through IRSA — a service account role — never a static access key baked into the image.',
    build() {
      const users = N('cloud-generic', 40, 130, 'Client applications');
      const alb = N('aws-alb', 250, 130, 'ALB ingress');
      const eks = N('aws-eks', 460, 130, 'EKS cluster');
      const api = N('flow-process', 460, 300, 'api pod');
      const worker = N('flow-process', 670, 300, 'worker pod');
      const ecr = N('aws-ecr', 880, 130, 'ECR repository');
      const ddb = N('aws-dynamodb', 880, 300, 'DynamoDB table');
      const cache = N('aws-elasticache', 880, 470, 'ElastiCache');
      const cw = N('aws-cloudwatch', 670, 470, 'CloudWatch + X-Ray');
      return [
        TITLE(40, 76, 'Container platform with managed AWS services'),
        users,
        alb,
        eks,
        api,
        worker,
        ecr,
        ddb,
        cache,
        cw,
        A(users, 'right', alb, 'left', { text: 'HTTPS' }),
        A(alb, 'right', eks, 'left', { text: 'Ingress → target group' }),
        A(eks, 'bottom', api, 'top'),
        A(api, 'right', worker, 'left', { text: 'SQS work item' }),
        A(ecr, 'bottom', eks, 'right', { text: 'image pull (IRSA)', routing: 'curved' }),
        A(api, 'right', ddb, 'left', { text: 'GetItem / PutItem' }),
        A(api, 'bottom', cache, 'top', { text: 'session cache' }),
        A(worker, 'bottom', cw, 'top', { text: 'logs + traces', routing: 'curved' }),
        NOTE(40, 560, 'IRSA maps a Kubernetes service account to an IAM role. No long-lived access keys belong in the image or the manifest.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-03-serverless-events',
    name: 'AWS-03 Serverless event-driven flow',
    description: 'API Gateway → Lambda → DynamoDB, plus S3 → EventBridge → Lambda → SQS with a dead-letter queue',
    frameTitle: 'Lesson: serverless event-driven flow',
    teaching:
      'The synchronous path (API Gateway → Lambda) answers the user; the asynchronous path (EventBridge → SQS) absorbs bursts. A dead-letter queue is what stops one poisoned message from blocking every consumer behind it.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Client application');
      const api = N('aws-apigw', 250, 130, 'API Gateway');
      const fn = N('aws-lambda', 460, 130, 'Order Lambda');
      const ddb = N('aws-dynamodb', 670, 130, 'Orders table');
      const s3 = N('aws-s3', 40, 330, 'Upload bucket');
      const bus = N('aws-eventbridge', 250, 330, 'EventBridge bus');
      const fn2 = N('aws-lambda', 460, 330, 'Process Lambda');
      const sqs = N('aws-sqs', 670, 330, 'Work queue');
      const dlq = N('aws-sqs', 880, 330, 'DLQ (after 3 tries)');
      return [
        TITLE(40, 76, 'Serverless path plus asynchronous event path'),
        user,
        api,
        fn,
        ddb,
        s3,
        bus,
        fn2,
        sqs,
        dlq,
        NOTE(40, 560, 'Keep the synchronous answer short and hand slow work to the queue. Always give the queue a dead-letter queue and a maximum receive count.'),
        A(user, 'right', api, 'left', { text: 'POST /orders' }),
        A(api, 'right', fn, 'left', { text: 'invoke' }),
        A(fn, 'right', ddb, 'left', { text: 'PutItem' }),
        A(s3, 'right', bus, 'left', { text: 'ObjectCreated' }),
        A(bus, 'right', fn2, 'left', { text: 'rule match' }),
        A(fn2, 'right', sqs, 'left', { text: 'enqueue batch' }),
        A(sqs, 'right', dlq, 'left', { text: 'maxReceiveCount 3' }),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-04-hub-spoke-network',
    name: 'AWS-04 Hub-and-spoke network',
    description: 'Transit Gateway joins a shared-services VPC, two workload VPCs and an on-premises link',
    frameTitle: 'Lesson: hub-and-spoke networking',
    teaching:
      'Transit Gateway is the hub: every VPC attaches once instead of being meshed pairwise. Shared services (DNS, inspection, NAT) live in the hub VPC, so a new spoke is an attachment plus route table entries, not a new firewall.',
    build() {
      const onprem = N('cloud-vm', 40, 130, 'On-premises data centre');
      const dx = N('aws-directconnect', 250, 130, 'Direct Connect');
      const tgw = N('aws-tgw', 460, 130, 'Transit Gateway');
      const hub = N('aws-vpc', 460, 330, 'Shared services VPC');
      const prod = N('aws-vpc', 670, 330, 'Production VPC');
      const dev = N('aws-vpc', 880, 330, 'Development VPC');
      const nat = N('aws-nat', 250, 330, 'Egress NAT');
      return [
        TITLE(40, 76, 'Hub-and-spoke connectivity'),
        onprem,
        dx,
        tgw,
        hub,
        prod,
        dev,
        nat,
        A(onprem, 'right', dx, 'left', { text: 'private circuit' }),
        A(dx, 'right', tgw, 'left', { text: 'BGP session' }),
        A(tgw, 'bottom', hub, 'top', { text: 'attachment' }),
        A(tgw, 'right', prod, 'top', { text: 'route table: prod', routing: 'curved' }),
        A(tgw, 'right', dev, 'top', { text: 'route table: dev', routing: 'curved' }),
        A(hub, 'left', nat, 'right', { text: 'central egress' }),
        NOTE(40, 560, 'One attachment per VPC, then route tables decide who may talk to whom. Segregate prod and dev with separate route tables, not trust.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-05-identity-secrets',
    name: 'AWS-05 Identity and secrets',
    description: 'Cognito for users, IAM roles for workloads, Secrets Manager and KMS for data, CloudTrail for audit',
    frameTitle: 'Lesson: identity, secrets and audit',
    teaching:
      'Cognito authenticates people; IAM roles authenticate workloads. Both end up with a short-lived credential, which is the whole point: Secrets Manager rotates the database password, KMS encrypts what it protects, and CloudTrail records who used which role.',
    build() {
      const user = N('cloud-generic', 40, 130, 'End user');
      const cognito = N('aws-cognito', 250, 130, 'Cognito user pool');
      const app = N('aws-ec2', 460, 130, 'Application');
      const iam = N('aws-iam', 670, 130, 'IAM role (task)');
      const secrets = N('aws-secrets', 460, 330, 'Secrets Manager');
      const kms = N('aws-iam', 670, 330, 'KMS key');
      const rds = N('aws-rds', 880, 330, 'Aurora');
      const trail = N('aws-cloudtrail', 880, 130, 'CloudTrail');
      return [
        TITLE(40, 76, 'Who is allowed to do what, and how do we know?'),
        user,
        cognito,
        app,
        iam,
        secrets,
        kms,
        rds,
        trail,
        A(user, 'right', cognito, 'left', { text: 'sign in (OIDC)' }),
        A(cognito, 'right', app, 'left', { text: 'ID + access token' }),
        A(app, 'right', iam, 'left', { text: 'assume role' }),
        A(app, 'bottom', secrets, 'top', { text: 'GetSecretValue' }),
        A(secrets, 'right', kms, 'left', { text: 'decrypt' }),
        A(secrets, 'right', rds, 'left', { text: 'rotated credential' }),
        A(iam, 'right', trail, 'left', { text: 'every API call' }),
        NOTE(40, 560, 'A rotated secret plus a short-lived role beats a stored password. CloudTrail is the evidence trail when someone asks who changed the bucket policy.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-06-messaging',
    name: 'AWS-06 Messaging and orchestration',
    description: 'SNS fan-out to SQS queues, EventBridge routing and a Step Functions long-running workflow',
    frameTitle: 'Lesson: fan-out, routing and orchestration',
    teaching:
      'SNS fans one event out to many queues; EventBridge routes by content rule; Step Functions keeps a long, multi-step process visible as a state machine. Choose by shape: one-to-many broadcast, rule-based routing, or a workflow with retries and human approval. Every queue here needs a dead-letter queue: without one a poison message is retried until its retention expires and the event is silently lost.',
    build() {
      const producer = N('aws-lambda', 40, 130, 'Order service');
      const sns = N('aws-sns', 250, 130, 'SNS topic (orders)');
      const billing = N('aws-sqs', 460, 130, 'Billing queue');
      const email = N('aws-sqs', 460, 300, 'Notification queue');
      const fnB = N('aws-lambda', 670, 130, 'Billing consumer');
      const fnE = N('aws-lambda', 670, 300, 'Notification consumer');
      const bus = N('aws-eventbridge', 250, 470, 'EventBridge bus');
      const sfn = N('aws-stepfunctions', 670, 470, 'Step Functions workflow');
      return [
        TITLE(40, 76, 'Three ways to connect producers to consumers'),
        producer,
        sns,
        billing,
        email,
        fnB,
        fnE,
        bus,
        sfn,
        A(producer, 'right', sns, 'left', { text: 'Publish' }),
        A(sns, 'right', billing, 'left', { text: 'subscription' }),
        A(sns, 'bottom', email, 'left', { text: 'subscription', routing: 'curved' }),
        A(billing, 'right', fnB, 'left', { text: 'poll' }),
        A(email, 'right', fnE, 'left', { text: 'poll' }),
        A(producer, 'bottom', bus, 'left', { text: 'PutEvents' }),
        A(bus, 'right', sfn, 'left', { text: 'start execution' }),
        NOTE(40, 560, 'SNS is broadcast, EventBridge is content routing, Step Functions is a workflow with state. A queue alone cannot express a multi-step saga.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-07-data-platform',
    name: 'AWS-07 Streaming data platform',
    description: 'Kinesis ingestion → S3 lake → Glue catalog and ETL → Athena and Redshift consumers',
    frameTitle: 'Lesson: streaming ingestion to a governed lake',
    teaching:
      'Kinesis buffers the firehose of events, S3 is the durable source of truth, and the Glue catalog is what makes the lake queryable. Athena reads the lake directly for ad-hoc questions; Redshift is for repeated, join-heavy reporting.',
    build() {
      const events = N('flow-data', 40, 130, 'Application events');
      const kinesis = N('aws-kinesis', 250, 130, 'Kinesis data stream');
      const s3 = N('aws-s3', 460, 130, 'S3 data lake');
      const glue = N('aws-glue', 670, 130, 'Glue ETL + catalog');
      const athena = N('aws-athena', 460, 330, 'Athena (ad-hoc)');
      const redshift = N('aws-redshift', 670, 330, 'Redshift (BI)');
      const bi = N('sec-oidc', 880, 330, 'Analyst / BI tool');
      return [
        TITLE(40, 76, 'From event stream to queried table'),
        events,
        kinesis,
        s3,
        glue,
        athena,
        redshift,
        bi,
        A(events, 'right', kinesis, 'left', { text: 'PutRecords' }),
        A(kinesis, 'right', s3, 'left', { text: 'Firehose micro-batch' }),
        A(s3, 'right', glue, 'left', { text: 'crawl + transform' }),
        A(glue, 'left', athena, 'top', { text: 'table definitions', routing: 'curved' }),
        A(glue, 'bottom', redshift, 'top', { text: 'COPY modelled tables' }),
        A(athena, 'right', bi, 'left', { text: 'SQL over lake', routing: 'curved' }),
        A(redshift, 'right', bi, 'left', { text: 'BI queries' }),
        NOTE(40, 560, 'The catalog is the contract: without it S3 is just files. Raw, cleaned and modelled zones keep analysts from querying half-parsed data.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-08-observability',
    name: 'AWS-08 Observability and alerting',
    description: 'CloudWatch metrics and logs, X-Ray traces, alarms routed through SNS to on-call',
    frameTitle: 'Lesson: what an on-call engineer actually sees',
    teaching:
      'Metrics tell you something is wrong, logs tell you where, and traces tell you which hop was slow. Alarms should be tied to a symptom the user feels (latency, error rate), not to a CPU graph that nobody can act on.',
    build() {
      const alb = N('aws-alb', 40, 130, 'ALB');
      const app = N('aws-ec2', 250, 130, 'Application fleet');
      const cw = N('aws-cloudwatch', 460, 130, 'CloudWatch metrics');
      // AWS-native art: this lesson is about what an AWS on-call sees, so a
      // third-party badge (LOKI / GRAFANA) contradicts the label and the notes.
      const logs = N('aws-cloudwatch', 460, 330, 'CloudWatch Logs');
      const xray = N('aws-xray', 670, 130, 'X-Ray traces');
      const alarm = N('aws-sns', 670, 330, 'Alarm → SNS');
      const oncall = N('sec-oidc', 880, 330, 'On-call rotation');
      const dash = N('aws-cloudwatch', 880, 130, 'CloudWatch dashboard');
      return [
        TITLE(40, 76, 'Metrics, logs, traces and the alarm that wakes someone'),
        alb,
        app,
        cw,
        logs,
        xray,
        alarm,
        oncall,
        dash,
        A(alb, 'right', app, 'left', { text: 'requests' }),
        A(app, 'right', cw, 'left', { text: 'put-metric-data' }),
        A(app, 'bottom', logs, 'top', { text: 'structured JSON' }),
        A(app, 'right', xray, 'left', { text: 'segments', routing: 'curved' }),
        A(cw, 'bottom', alarm, 'top', { text: 'threshold breach' }),
        A(alarm, 'right', oncall, 'left', { text: 'SNS → page' }),
        A(cw, 'right', dash, 'left', { text: 'query', routing: 'curved' }),
        NOTE(40, 560, 'Alert on symptoms (p99 latency, 5xx rate), not on causes. Every alarm needs an owner and a runbook, or it will be muted within a month.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-09-cicd',
    name: 'AWS-09 CI/CD delivery pipeline',
    description: 'Git → build → ECR image → deploy to ECS/EKS, with approval gated by a security scan',
    frameTitle: 'Lesson: from commit to running container',
    teaching:
      'Each stage fails closed: a failing unit test or a critical Trivy finding stops the pipeline before the image reaches a registry. Deployment is a separate privilege from building, so a compromised build cannot push to production by itself.',
    build() {
      const dev = N('cicd-pipeline', 40, 130, 'Developer commit');
      const repo = N('cloud-generic', 250, 130, 'Git repository');
      const build = N('cicd-jenkins', 460, 130, 'Build + unit tests');
      const scan = N('sec-trivy', 670, 130, 'Image scan');
      const ecr = N('aws-ecr', 880, 130, 'ECR registry');
      const iac = N('iac-terraform', 460, 330, 'Infrastructure change');
      const deploy = N('cicd-argocd', 670, 330, 'Deploy to EKS');
      const cluster = N('k8s-cluster', 880, 330, 'EKS cluster');
      const approval = N('sec-oidc', 250, 330, 'Approval gate');
      return [
        TITLE(40, 76, 'A pipeline that fails closed'),
        dev,
        repo,
        build,
        scan,
        ecr,
        iac,
        deploy,
        cluster,
        approval,
        A(dev, 'right', repo, 'left', { text: 'push' }),
        A(repo, 'right', build, 'left', { text: 'trigger' }),
        A(build, 'right', scan, 'left', { text: 'build image' }),
        A(scan, 'right', ecr, 'left', { text: 'push if clean' }),
        A(scan, 'bottom', approval, 'top', { text: 'critical finding?', routing: 'curved' }),
        A(ecr, 'bottom', deploy, 'top', { text: 'image digest' }),
        A(deploy, 'right', cluster, 'left', { text: 'apply manifest' }),
        A(iac, 'right', deploy, 'left', { text: 'planned change' }),
        NOTE(40, 560, 'Build once, promote the same digest. Rebuilding at deploy time means the artifact you tested is not the artifact you shipped.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-aws-10-recovery',
    name: 'AWS-10 Multi-region recovery',
    description: 'Route 53 failover, Aurora Global Database and S3 Cross-Region Replication to a standby region',
    frameTitle: 'Lesson: what actually happens in a regional failure',
    teaching:
      'Recovery is a chain, not a button: DNS must flip, the standby region must already have data, and the compute capacity must exist before the traffic arrives. RTO is how long the chain takes, RPO is how much data the replication lag allows you to lose — state both. Replication is not backup: it faithfully copies a corrupted or deleted row into the replica in seconds, so a separate, restore-tested backup is still required.',
    build() {
      const users = N('cloud-generic', 40, 130, 'Users');
      const r53 = N('aws-route53', 250, 130, 'Route 53 failover');
      const primary = N('aws-ec2', 460, 130, 'Primary region app');
      const aurora = N('aws-rds', 670, 130, 'Aurora primary');
      const s3a = N('aws-s3', 880, 130, 'S3 primary bucket');
      const standby = N('aws-ec2', 460, 330, 'Standby region app');
      const auroraDr = N('aws-rds', 670, 330, 'Aurora secondary');
      const s3b = N('aws-s3', 880, 330, 'S3 replica bucket');
      const health = N('aws-cloudwatch', 250, 330, 'Health check');
      return [
        TITLE(40, 76, 'Failover path across two regions'),
        users,
        r53,
        primary,
        aurora,
        s3a,
        standby,
        auroraDr,
        s3b,
        health,
        A(users, 'right', r53, 'left', { text: 'DNS query' }),
        A(r53, 'right', primary, 'left', { text: 'primary record' }),
        A(primary, 'right', aurora, 'left', { text: 'read/write' }),
        A(aurora, 'right', s3a, 'left', { text: 'backups' }),
        A(r53, 'bottom', standby, 'top', { text: 'failover record', routing: 'curved' }),
        A(aurora, 'bottom', auroraDr, 'top', { text: 'global replication' }),
        A(s3a, 'bottom', s3b, 'top', { text: 'cross-region replica' }),
        A(health, 'right', r53, 'top', { text: 'health check', routing: 'curved' }),
        NOTE(40, 560, 'DNS failover only works if the standby can serve. Warm the capacity, replicate the data, and rehearse the cutover — otherwise RTO is a guess.'),
      ];
    },
  }),
];
