// stencils/devops-cloud.js — AWS, Azure & GCP Cloud Provider Icons
import { createDevOpsStencil } from './card.js';

const G = {
  cube: `<polygon points="50,10 82,25 82,53 50,66 18,53 18,25" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="18,25 50,39 82,25" fill="none" stroke="currentColor" stroke-width="3.6"/><line x1="50" y1="39" x2="50" y2="66" stroke="currentColor" stroke-width="3.6"/>`,
  cpu: `<rect x="26" y="16" width="48" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="4.2"/><rect x="36" y="25" width="28" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="3.2"/><line x1="36" y1="8" x2="36" y2="16" stroke="currentColor" stroke-width="3.5"/><line x1="50" y1="8" x2="50" y2="16" stroke="currentColor" stroke-width="3.5"/><line x1="64" y1="8" x2="64" y2="16" stroke="currentColor" stroke-width="3.5"/><line x1="36" y1="56" x2="36" y2="64" stroke="currentColor" stroke-width="3.5"/><line x1="50" y1="56" x2="50" y2="64" stroke="currentColor" stroke-width="3.5"/><line x1="64" y1="56" x2="64" y2="64" stroke="currentColor" stroke-width="3.5"/>`,
  bucket: `<polygon points="22,16 78,16 68,58 32,58" fill="none" stroke="currentColor" stroke-width="4.2"/><ellipse cx="50" cy="16" rx="28" ry="6" fill="none" stroke="currentColor" stroke-width="3.8"/><path d="M26,24 C36,36 64,36 74,24" fill="none" stroke="currentColor" stroke-width="3.2"/>`,
  lambda: `<polygon points="28,12 46,12 72,58 58,58 45,34 32,58 18,58 38,24 28,24" fill="none" stroke="currentColor" stroke-width="3.8"/>`,
  bolt: `<polygon points="56,8 26,38 48,38 42,64 74,32 52,32" fill="none" stroke="currentColor" stroke-width="4"/>`,
  db: `<ellipse cx="50" cy="16" rx="26" ry="8" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24,16 V52 A26,8 0 0,0 76,52 V16" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24,34 A26,8 0 0,0 76,34" fill="none" stroke="currentColor" stroke-width="3.5"/>`,
  k8sWheel: `<polygon points="50,8 78,21 84,49 64,66 36,66 16,49 22,21" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="39" r="9" fill="none" stroke="currentColor" stroke-width="3.5"/><line x1="50" y1="8" x2="50" y2="30" stroke="currentColor" stroke-width="3"/><line x1="78" y1="21" x2="58" y2="34" stroke="currentColor" stroke-width="3"/><line x1="22" y1="21" x2="42" y2="34" stroke="currentColor" stroke-width="3"/>`,
  containers: `<rect x="16" y="20" width="28" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="4"/><rect x="56" y="20" width="28" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="4"/><line x1="44" y1="36" x2="56" y2="36" stroke="currentColor" stroke-width="3.8"/>`,
  vpc: `<path d="M24,46 H76 A13,13 0 0,0 76,22 A17,17 0 0,0 34,20 A13,13 0 0,0 24,46 Z" fill="none" stroke="currentColor" stroke-width="4"/><rect x="38" y="34" width="24" height="22" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="50" cy="45" r="3" fill="currentColor"/>`,
  shield: `<path d="M50,8 L80,20 V38 C80,52 66,62 50,66 C34,62 20,52 20,38 V20 Z" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="38,37 47,46 64,28" fill="none" stroke="currentColor" stroke-width="4"/>`,
  dns: `<circle cx="50" cy="36" r="24" fill="none" stroke="currentColor" stroke-width="4"/><ellipse cx="50" cy="36" rx="11" ry="24" fill="none" stroke="currentColor" stroke-width="3.4"/><line x1="26" y1="36" x2="74" y2="36" stroke="currentColor" stroke-width="3.4"/>`,
  cdn: `<circle cx="50" cy="36" r="14" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="10" r="5" fill="currentColor"/><circle cx="80" cy="36" r="5" fill="currentColor"/><circle cx="50" cy="62" r="5" fill="currentColor"/><circle cx="20" cy="36" r="5" fill="currentColor"/><line x1="50" y1="15" x2="50" y2="22" stroke="currentColor" stroke-width="3.5"/><line x1="64" y1="36" x2="75" y2="36" stroke="currentColor" stroke-width="3.5"/><line x1="50" y1="50" x2="50" y2="57" stroke="currentColor" stroke-width="3.5"/><line x1="25" y1="36" x2="36" y2="36" stroke="currentColor" stroke-width="3.5"/>`,
  api: `<rect x="34" y="14" width="32" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="4"/><line x1="14" y1="28" x2="34" y2="28" stroke="currentColor" stroke-width="4"/><line x1="14" y1="44" x2="34" y2="44" stroke="currentColor" stroke-width="4"/><line x1="66" y1="28" x2="86" y2="28" stroke="currentColor" stroke-width="4"/><line x1="66" y1="44" x2="86" y2="44" stroke="currentColor" stroke-width="4"/>`,
  queue: `<rect x="16" y="22" width="18" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="3.8"/><rect x="41" y="22" width="18" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="3.8"/><rect x="66" y="22" width="18" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="3.8"/>`,
  pubsub: `<circle cx="24" cy="36" r="9" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="76" cy="18" r="7" fill="none" stroke="currentColor" stroke-width="3.8"/><circle cx="76" cy="36" r="7" fill="none" stroke="currentColor" stroke-width="3.8"/><circle cx="76" cy="54" r="7" fill="none" stroke="currentColor" stroke-width="3.8"/><line x1="33" y1="33" x2="69" y2="19" stroke="currentColor" stroke-width="3.4"/><line x1="33" y1="36" x2="69" y2="36" stroke="currentColor" stroke-width="3.4"/><line x1="33" y1="39" x2="69" y2="53" stroke="currentColor" stroke-width="3.4"/>`,
  chart: `<polyline points="16,54 36,36 52,44 78,16" fill="none" stroke="currentColor" stroke-width="4.5"/><polyline points="64,16 78,16 78,30" fill="none" stroke="currentColor" stroke-width="4"/><line x1="16" y1="60" x2="84" y2="60" stroke="currentColor" stroke-width="3.5"/>`,
  lb: `<circle cx="22" cy="36" r="8" fill="none" stroke="currentColor" stroke-width="4"/><rect x="68" y="12" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="3.6"/><rect x="68" y="30" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="3.6"/><rect x="68" y="48" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="3.6"/><line x1="30" y1="34" x2="68" y2="18" stroke="currentColor" stroke-width="3.2"/><line x1="30" y1="36" x2="68" y2="36" stroke="currentColor" stroke-width="3.2"/><line x1="30" y1="38" x2="68" y2="54" stroke="currentColor" stroke-width="3.2"/>`,
  key: `<circle cx="34" cy="36" r="14" fill="none" stroke="currentColor" stroke-width="4.2"/><line x1="48" y1="36" x2="84" y2="36" stroke="currentColor" stroke-width="4.2"/><line x1="70" y1="36" x2="70" y2="48" stroke="currentColor" stroke-width="4.2"/><line x1="80" y1="36" x2="80" y2="45" stroke="currentColor" stroke-width="4.2"/>`,
};

const aws = (id, name, defaultText, tags, svgBody, color = '#FF9900') =>
  createDevOpsStencil({ id, name, category: 'AWS', badge: 'AWS', color, defaultText, tags, svgBody });

const azure = (id, name, defaultText, tags, svgBody, color = '#0078D4') =>
  createDevOpsStencil({ id, name, category: 'Azure', badge: 'AZURE', color, defaultText, tags, svgBody });

const gcp = (id, name, defaultText, tags, svgBody, color = '#4285F4') =>
  createDevOpsStencil({ id, name, category: 'GCP', badge: 'GCP', color, defaultText, tags, svgBody });

export const DEVOPS_CLOUD_STENCILS = [
  // AWS Icons
  aws('aws-ec2', 'AWS EC2', 'EC2 Instance', 'compute vm server instance elastic', G.cpu, '#ED7100'),
  aws('aws-s3', 'AWS S3', 'S3 Bucket', 'storage bucket object simple', G.bucket, '#3F8624'),
  aws('aws-lambda', 'AWS Lambda', 'Lambda Function', 'serverless function faas compute', G.lambda, '#ED7100'),
  aws('aws-rds', 'AWS RDS', 'RDS Database', 'sql database relational postgres mysql aurora', G.db, '#3B48CC'),
  aws('aws-eks', 'AWS EKS', 'EKS Cluster', 'kubernetes k8s container cluster', G.k8sWheel, '#ED7100'),
  aws('aws-ecs', 'AWS ECS / Fargate', 'ECS Fargate', 'container task docker serverless', G.containers, '#ED7100'),
  aws('aws-vpc', 'AWS VPC', 'AWS VPC', 'network virtual private cloud subnet', G.vpc, '#8C4FFF'),
  aws('aws-iam', 'AWS IAM', 'IAM Role / Policy', 'security identity auth access policy', G.shield, '#DD344C'),
  aws('aws-route53', 'AWS Route 53', 'Route 53 DNS', 'dns domain routing network', G.dns, '#8C4FFF'),
  aws('aws-cloudfront', 'AWS CloudFront', 'CloudFront CDN', 'cdn edge cache distribution', G.cdn, '#8C4FFF'),
  aws('aws-apigw', 'AWS API Gateway', 'API Gateway', 'rest http websocket api proxy', G.api, '#E7157B'),
  aws('aws-sqs', 'AWS SQS', 'SQS Queue', 'queue messaging async decoupling', G.queue, '#E7157B'),
  aws('aws-sns', 'AWS SNS', 'SNS Topic', 'pubsub notification topic fanout', G.pubsub, '#E7157B'),
  aws('aws-dynamodb', 'AWS DynamoDB', 'DynamoDB Table', 'nosql key value database table', G.db, '#3B48CC'),
  aws('aws-cloudwatch', 'AWS CloudWatch', 'CloudWatch Metrics', 'monitoring logs alarms observability', G.chart, '#E7157B'),
  aws('aws-alb', 'AWS ALB / ELB', 'App Load Balancer', 'load balancer ingress traffic', G.lb, '#8C4FFF'),
  aws('cloud-aws', 'AWS Cloud', 'AWS Cloud', 'amazon cloud region account', G.vpc, '#FF9900'),

  // Azure Icons
  azure('azure-vm', 'Azure Virtual Machine', 'Azure VM', 'compute vm instance server', G.cpu, '#0078D4'),
  azure('azure-aks', 'Azure AKS', 'AKS Cluster', 'kubernetes k8s cluster container', G.k8sWheel, '#0078D4'),
  azure('azure-functions', 'Azure Functions', 'Azure Function', 'serverless faas event compute', G.bolt, '#0078D4'),
  azure('azure-blob', 'Azure Blob Storage', 'Blob Storage', 'object storage bucket container', G.bucket, '#0089D6'),
  azure('azure-sql', 'Azure SQL Database', 'Azure SQL', 'database relational sql managed', G.db, '#0078D4'),
  azure('azure-cosmos', 'Azure Cosmos DB', 'Cosmos DB', 'nosql global database document', G.cdn, '#0078D4'),
  azure('azure-vnet', 'Azure Virtual Network', 'Azure VNet', 'network subnet peering vpn', G.vpc, '#0078D4'),
  azure('azure-entra', 'Microsoft Entra ID', 'Entra ID (AD)', 'identity active directory sso iam auth', G.shield, '#0078D4'),
  azure('azure-appservice', 'Azure App Service', 'App Service', 'web app hosting paas', G.api, '#0078D4'),
  azure('azure-appgw', 'Azure App Gateway', 'App Gateway / WAF', 'load balancer waf ingress', G.lb, '#0078D4'),
  azure('azure-keyvault', 'Azure Key Vault', 'Key Vault', 'secrets keys certificates security', G.key, '#0078D4'),
  azure('azure-servicebus', 'Azure Service Bus', 'Service Bus', 'messaging queue enterprise broker', G.queue, '#0078D4'),
  azure('azure-monitor', 'Azure Monitor', 'Azure Monitor', 'observability metrics logs insights', G.chart, '#0078D4'),
  azure('cloud-azure', 'Azure Cloud', 'Azure Cloud', 'microsoft cloud subscription', G.vpc, '#0078D4'),

  // GCP Icons
  gcp('gcp-gce', 'GCP Compute Engine', 'Compute Engine', 'vm instance compute server', G.cpu, '#4285F4'),
  gcp('gcp-gke', 'GCP GKE', 'GKE Cluster', 'kubernetes k8s container google', G.k8sWheel, '#4285F4'),
  gcp('gcp-cloudrun', 'GCP Cloud Run', 'Cloud Run', 'serverless container knative http', G.containers, '#4285F4'),
  gcp('gcp-functions', 'GCP Cloud Functions', 'Cloud Function', 'serverless faas event', G.bolt, '#Fbbc04'),
  gcp('gcp-gcs', 'GCP Cloud Storage', 'Cloud Storage', 'gcs bucket object storage', G.bucket, '#34A853'),
  gcp('gcp-cloudsql', 'GCP Cloud SQL', 'Cloud SQL', 'relational database postgres mysql', G.db, '#4285F4'),
  gcp('gcp-bigquery', 'GCP BigQuery', 'BigQuery DW', 'analytics data warehouse sql olap', G.chart, '#4285F4'),
  gcp('gcp-vpc', 'GCP VPC Network', 'GCP VPC', 'network global subnet routing', G.vpc, '#34A853'),
  gcp('gcp-iam', 'GCP Cloud IAM', 'Cloud IAM', 'security service account policy', G.shield, '#EA4335'),
  gcp('gcp-pubsub', 'GCP Cloud Pub/Sub', 'Cloud Pub/Sub', 'messaging stream event bus', G.pubsub, '#4285F4'),
  gcp('gcp-lb', 'GCP Load Balancing', 'Cloud Load Balancer', 'anycast global load balancer', G.lb, '#4285F4'),
  gcp('gcp-armor', 'GCP Cloud Armor', 'Cloud Armor WAF', 'security ddos waf firewall', G.shield, '#EA4335'),
  gcp('cloud-gcp', 'Google Cloud', 'Google Cloud', 'gcp project region', G.vpc, '#4285F4'),

  // Legacy generic cloud aliases for backwards compatibility
  aws('cloud-vm', 'Compute VM', 'Compute VM', 'vm server instance', G.cpu, '#475569'),
  aws('cloud-db', 'Managed Database', 'Managed DB', 'database sql storage', G.db, '#475569'),
  aws('cloud-bucket', 'Object Bucket', 'Object Bucket', 'bucket blob s3', G.bucket, '#475569'),
];
