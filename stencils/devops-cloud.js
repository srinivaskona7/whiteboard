// stencils/devops-cloud.js — AWS, Azure & GCP Cloud Provider Service Icons
import { createDevOpsStencil } from './card.js';

const G = {
  // AWS Service Silhouettes
  awsEc2: `<rect x="26" y="14" width="48" height="44" rx="5" fill="none" stroke="currentColor"/><rect x="34" y="22" width="32" height="28" rx="2" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M32 8 V14 M44 8 V14 M56 8 V14 M68 8 V14 M32 58 V64 M44 58 V64 M56 58 V64 M68 58 V64 M18 22 H26 M18 36 H26 M18 50 H26 M74 22 H82 M74 36 H82 M74 50 H82" fill="none" stroke="currentColor"/>`,
  awsLambda: `<rect x="20" y="10" width="60" height="52" rx="8" fill="none" stroke="currentColor"/><path d="M34 52 L48 22 M41 20 H50 L64 52 H70" fill="none" stroke="currentColor"/>`,
  awsEks: `<polygon points="50,8 82,23 82,51 50,66 18,51 18,23" fill="none" stroke="currentColor"/><circle cx="50" cy="37" r="10" fill="none" stroke="currentColor"/><path d="M50 18 V27 M66 28 L58 32 M66 46 L58 42 M50 56 V47 M34 46 L42 42 M34 28 L42 32" fill="none" stroke="currentColor"/>`,
  awsEcs: `<polygon points="50,10 80,24 80,50 50,64 20,50 20,24" fill="none" stroke="currentColor"/><rect x="35" y="26" width="13" height="22" rx="2" fill="none" stroke="currentColor"/><rect x="52" y="26" width="13" height="22" rx="2" fill="none" stroke="currentColor"/>`,
  awsS3: `<path d="M26 18 L32 56 C32 61 68 61 68 56 L74 18 Z" fill="none" stroke="currentColor"/><ellipse cx="50" cy="18" rx="24" ry="7" fill="currentColor" fill-opacity="0.15" stroke="currentColor"/><path d="M26 18 C26 6 74 6 74 18" fill="none" stroke="currentColor"/><circle cx="50" cy="38" r="6" fill="none" stroke="currentColor"/>`,
  awsEbs: `<rect x="24" y="14" width="52" height="44" rx="5" fill="none" stroke="currentColor"/><circle cx="50" cy="34" r="12" fill="none" stroke="currentColor"/><circle cx="50" cy="34" r="3" fill="currentColor"/><line x1="34" y1="51" x2="66" y2="51" stroke="currentColor"/>`,
  awsRds: `<ellipse cx="50" cy="16" rx="24" ry="8" fill="currentColor" fill-opacity="0.15" stroke="currentColor"/><path d="M26 16 V52 C26 57 37 61 50 61 C63 61 74 57 74 52 V16" fill="none" stroke="currentColor"/><path d="M26 28 C26 33 37 37 50 37 C63 37 74 33 74 28 M26 40 C26 45 37 49 50 49 C63 49 74 45 74 40" fill="none" stroke="currentColor"/>`,
  awsDynamodb: `<ellipse cx="44" cy="16" rx="20" ry="7" fill="none" stroke="currentColor"/><path d="M24 16 V50 C24 55 33 59 44 59 C55 59 64 55 64 50 V16" fill="none" stroke="currentColor"/><polygon points="68,16 54,36 66,36 58,56 80,32 68,32" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/>`,
  awsVpc: `<rect x="16" y="12" width="68" height="48" rx="7" fill="none" stroke="currentColor" stroke-dasharray="6,3"/><path d="M36 30 V24 C36 18 52 18 52 24 V30" fill="none" stroke="currentColor"/><rect x="32" y="30" width="24" height="18" rx="3" fill="none" stroke="currentColor"/><circle cx="68" cy="26" r="5" fill="none" stroke="currentColor"/><circle cx="68" cy="46" r="5" fill="none" stroke="currentColor"/><path d="M56 36 L63 26 M56 42 L63 46" fill="none" stroke="currentColor"/>`,
  awsAlb: `<circle cx="24" cy="36" r="8" fill="none" stroke="currentColor"/><rect x="64" y="12" width="16" height="12" rx="2" fill="none" stroke="currentColor"/><rect x="64" y="30" width="16" height="12" rx="2" fill="none" stroke="currentColor"/><rect x="64" y="48" width="16" height="12" rx="2" fill="none" stroke="currentColor"/><path d="M32 36 H48 M48 18 V54 M48 18 H64 M48 36 H64 M48 54 H64" fill="none" stroke="currentColor"/>`,
  awsCf: `<circle cx="50" cy="36" r="24" fill="none" stroke="currentColor"/><ellipse cx="50" cy="36" rx="11" ry="24" fill="none" stroke="currentColor"/><line x1="26" y1="36" x2="74" y2="36" stroke="currentColor"/><circle cx="50" cy="12" r="3.5" fill="currentColor"/><circle cx="74" cy="36" r="3.5" fill="currentColor"/><circle cx="26" cy="36" r="3.5" fill="currentColor"/>`,
  awsR53: `<polygon points="50,10 80,22 72,56 50,64 28,56 20,22" fill="none" stroke="currentColor"/><text x="50" y="42" font-family="sans-serif" font-size="18" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">53</text><path d="M34 26 H66" fill="none" stroke="currentColor"/>`,
  awsIam: `<path d="M50 10 L76 20 V36 C76 50 64 59 50 64 C36 59 24 50 24 36 V20 Z" fill="none" stroke="currentColor"/><circle cx="46" cy="34" r="6" fill="none" stroke="currentColor"/><path d="M52 34 H66 V40 M60 34 V39" fill="none" stroke="currentColor"/>`,
  awsCw: `<circle cx="46" cy="36" r="20" fill="none" stroke="currentColor"/><polyline points="34,42 42,32 48,38 56,26" fill="none" stroke="currentColor"/><line x1="60" y1="50" x2="74" y2="62" stroke="currentColor"/>`,
  awsSqs: `<rect x="16" y="22" width="68" height="28" rx="5" fill="none" stroke="currentColor"/><rect x="24" y="28" width="12" height="16" rx="2" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><rect x="42" y="28" width="12" height="16" rx="2" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><path d="M60 36 H76 M70 30 L76 36 L70 42" fill="none" stroke="currentColor"/>`,
  awsSns: `<circle cx="26" cy="36" r="8" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><circle cx="72" cy="18" r="6" fill="none" stroke="currentColor"/><circle cx="72" cy="36" r="6" fill="none" stroke="currentColor"/><circle cx="72" cy="54" r="6" fill="none" stroke="currentColor"/><path d="M34 32 L66 19 M34 36 H66 M34 40 L66 53" fill="none" stroke="currentColor"/>`,

  // Azure Service Silhouettes
  azVm: `<rect x="22" y="12" width="56" height="36" rx="4" fill="none" stroke="currentColor"/><polygon points="50,18 64,26 64,38 50,44 36,38 36,26" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/><line x1="50" y1="48" x2="50" y2="58" stroke="currentColor"/><line x1="34" y1="58" x2="66" y2="58" stroke="currentColor"/>`,
  azAks: `<polygon points="50,8 80,22 86,50 66,64 34,64 14,50 20,22" fill="none" stroke="currentColor"/><polygon points="50,20 68,30 68,46 50,54 32,46 32,30" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/>`,
  azFunc: `<polygon points="54,10 30,38 48,38 42,62 70,32 52,32" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><path d="M24 22 L14 36 L24 50 M76 22 L86 36 L76 50" fill="none" stroke="currentColor"/>`,
  azBlob: `<rect x="20" y="14" width="60" height="44" rx="6" fill="none" stroke="currentColor"/><rect x="28" y="22" width="18" height="12" rx="2" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><rect x="54" y="22" width="18" height="12" rx="2" fill="none" stroke="currentColor"/><rect x="28" y="38" width="44" height="12" rx="2" fill="none" stroke="currentColor"/>`,
  azSql: `<ellipse cx="50" cy="16" rx="24" ry="8" fill="none" stroke="currentColor"/><path d="M26 16 V52 C26 57 37 61 50 61 C63 61 74 57 74 52 V16" fill="none" stroke="currentColor"/><rect x="34" y="30" width="32" height="16" rx="3" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/>`,
  azCosmos: `<circle cx="50" cy="36" r="14" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><ellipse cx="50" cy="36" rx="32" ry="11" fill="none" stroke="currentColor"/><ellipse cx="50" cy="36" rx="11" ry="26" fill="none" stroke="currentColor"/><circle cx="80" cy="36" r="3.5" fill="currentColor"/><circle cx="50" cy="10" r="3.5" fill="currentColor"/>`,
  azVnet: `<circle cx="26" cy="36" r="7" fill="none" stroke="currentColor"/><circle cx="74" cy="36" r="7" fill="none" stroke="currentColor"/><circle cx="50" cy="18" r="6" fill="none" stroke="currentColor"/><circle cx="50" cy="54" r="6" fill="none" stroke="currentColor"/><path d="M33 36 H67 M31 31 L45 21 M55 21 L69 31 M31 41 L45 51 M55 51 L69 41" fill="none" stroke="currentColor"/>`,
  azAppGw: `<polygon points="50,10 82,36 50,62 18,36" fill="none" stroke="currentColor"/><path d="M34 36 H66 M50 22 V50" fill="none" stroke="currentColor"/>`,
  azEntra: `<polygon points="50,10 80,54 50,62 20,54" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><line x1="50" y1="10" x2="50" y2="62" stroke="currentColor"/>`,
  azMonitor: `<circle cx="50" cy="36" r="24" fill="none" stroke="currentColor"/><path d="M34 44 A18 18 0 1 1 66 44" fill="none" stroke="currentColor"/><line x1="50" y1="36" x2="62" y2="24" stroke="currentColor"/><circle cx="50" cy="36" r="3.5" fill="currentColor"/>`,

  // Google Cloud Service Silhouettes
  gcpHex: (inner) =>
    `<polygon points="32,10 68,10 86,36 68,62 32,62 14,36" fill="currentColor" fill-opacity="0.12" stroke="currentColor"/>${inner}`,
};

const aws = (id, name, defaultText, tags, svgBody, color = '#FF9900', iconKind = 'service') =>
  createDevOpsStencil({
    id,
    name,
    category: 'AWS',
    badge: 'AWS',
    color,
    defaultText,
    tags: `aws amazon cloud ${tags}`,
    svgBody,
    iconKind,
    packKey: 'aws',
  });

const azure = (id, name, defaultText, tags, svgBody, color = '#0078D4', iconKind = 'service') =>
  createDevOpsStencil({
    id,
    name,
    category: 'Azure',
    badge: 'AZURE',
    color,
    defaultText,
    tags: `azure microsoft cloud ${tags}`,
    svgBody,
    iconKind,
    packKey: 'azure',
  });

const gcp = (id, name, defaultText, tags, svgBody, color = '#1A73E8', iconKind = 'service') =>
  createDevOpsStencil({
    id,
    name,
    category: 'GCP',
    badge: 'GCP',
    color,
    defaultText,
    tags: `gcp google cloud ${tags}`,
    svgBody,
    iconKind,
    packKey: 'gcp',
  });

const genericCloud = (id, name, defaultText, tags, svgBody, color = '#475569') =>
  createDevOpsStencil({
    id,
    name,
    category: 'Teaching Concepts & Internals',
    badge: 'CLOUD',
    color,
    defaultText,
    tags: `generic cloud vendor neutral ${tags}`,
    svgBody,
    iconKind: 'concept',
    packKey: 'concepts',
  });

export const DEVOPS_CLOUD_STENCILS = [
  // AWS Services & Resources
  aws('aws-ec2', 'AWS EC2 Instance', 'EC2 Instance', 'ec2 compute vm server instance', G.awsEc2, '#ED7100', 'resource'),
  aws('aws-lambda', 'AWS Lambda', 'Lambda Function', 'lambda serverless function faas', G.awsLambda, '#ED7100'),
  aws('aws-eks', 'Amazon EKS', 'EKS Cluster', 'eks kubernetes k8s container cluster', G.awsEks, '#ED7100'),
  aws('aws-ecs', 'Amazon ECS / Fargate', 'ECS Fargate', 'ecs fargate container task service', G.awsEcs, '#ED7100'),
  aws('aws-s3', 'Amazon S3 Bucket', 'S3 Bucket', 's3 storage object bucket', G.awsS3, '#3F8624', 'resource'),
  aws('aws-ebs', 'Amazon EBS Volume', 'EBS Volume', 'ebs block storage disk volume', G.awsEbs, '#3F8624', 'resource'),
  aws('aws-rds', 'Amazon RDS / Aurora', 'RDS Database', 'rds aurora sql postgres mysql database', G.awsRds, '#3B48CC'),
  aws('aws-dynamodb', 'Amazon DynamoDB', 'DynamoDB Table', 'dynamodb nosql key value table', G.awsDynamodb, '#3B48CC'),
  aws('aws-vpc', 'Amazon VPC Gateway', 'VPC Network', 'vpc network subnet cidr igw nat', G.awsVpc, '#8C4FFF'),
  aws('aws-alb', 'AWS ALB / ELB', 'App Load Balancer', 'alb elb nlb load balancer ingresslb', G.awsAlb, '#8C4FFF'),
  aws('aws-cloudfront', 'Amazon CloudFront', 'CloudFront CDN', 'cloudfront cdn edge cache', G.awsCf, '#8C4FFF'),
  aws('aws-route53', 'Amazon Route 53', 'Route 53 DNS', 'route53 dns domain routing', G.awsR53, '#8C4FFF'),
  aws('aws-iam', 'AWS IAM / KMS', 'IAM Role / Policy', 'iam kms security role policy auth', G.awsIam, '#DD344C'),
  aws('aws-cloudwatch', 'Amazon CloudWatch', 'CloudWatch Logs', 'cloudwatch logs metrics alarms observability', G.awsCw, '#E7157B'),
  aws('aws-sqs', 'Amazon SQS Queue', 'SQS Queue', 'sqs queue messaging async', G.awsSqs, '#E7157B'),
  aws('aws-sns', 'Amazon SNS Topic', 'SNS Pub/Sub', 'sns pubsub notification topic', G.awsSns, '#E7157B'),

  // Microsoft Azure Services
  azure('az-vm', 'Azure Virtual Machine', 'Azure VM', 'vm compute instance server', G.azVm, '#0078D4', 'resource'),
  azure('az-aks', 'Azure Kubernetes Service', 'AKS Cluster', 'aks kubernetes k8s cluster', G.azAks, '#0078D4'),
  azure('az-functions', 'Azure Functions', 'Azure Function', 'functions serverless faas', G.azFunc, '#0078D4'),
  azure('az-blob', 'Azure Blob Storage', 'Blob Storage', 'blob storage account container object', G.azBlob, '#0078D4', 'resource'),
  azure('az-sql', 'Azure SQL Database', 'Azure SQL', 'sql database rdbms', G.azSql, '#0078D4'),
  azure('az-cosmos', 'Azure Cosmos DB', 'Cosmos DB', 'cosmos nosql document database', G.azCosmos, '#0078D4'),
  azure('az-vnet', 'Azure Virtual Network', 'Azure VNet', 'vnet network subnet peering', G.azVnet, '#0078D4'),
  azure('az-appgw', 'Azure App Gateway / LB', 'App Gateway', 'appgw load balancer waf ingress lb', G.azAppGw, '#0078D4'),
  azure('az-entra', 'Microsoft Entra ID / Key Vault', 'Entra ID / KV', 'entra aad keyvault iam identity security', G.azEntra, '#0078D4'),
  azure('az-monitor', 'Azure Monitor / Log Analytics', 'Azure Monitor', 'monitor log analytics insights metrics', G.azMonitor, '#0078D4'),

  // Google Cloud Platform (GCP) Services
  gcp('gcp-gce', 'GCP Compute Engine', 'Compute Engine', 'gce vm compute instance', G.gcpHex(`<rect x="36" y="24" width="28" height="24" rx="3" fill="none" stroke="currentColor"/><rect x="42" y="30" width="16" height="12" fill="currentColor"/>`), '#1A73E8', 'resource'),
  gcp('gcp-gke', 'Google Kubernetes Engine', 'GKE Cluster', 'gke kubernetes k8s cluster', G.gcpHex(`<circle cx="50" cy="36" r="13" fill="none" stroke="currentColor"/><path d="M50 19 V26 M50 46 V53 M33 36 H40 M60 36 H67" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-cloudrun', 'GCP Cloud Run / Functions', 'Cloud Run', 'cloudrun serverless container function', G.gcpHex(`<polygon points="44,24 62,36 44,48" fill="currentColor"/><line x1="32" y1="30" x2="40" y2="30" stroke="currentColor"/><line x1="32" y1="42" x2="40" y2="42" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-gcs', 'Google Cloud Storage', 'GCS Bucket', 'gcs bucket object storage', G.gcpHex(`<rect x="34" y="24" width="32" height="24" rx="3" fill="none" stroke="currentColor"/><line x1="34" y1="36" x2="66" y2="36" stroke="currentColor"/><circle cx="42" cy="30" r="2" fill="currentColor"/><circle cx="42" cy="42" r="2" fill="currentColor"/>`), '#1A73E8', 'resource'),
  gcp('gcp-cloudsql', 'Google Cloud SQL / Spanner', 'Cloud SQL', 'cloudsql spanner database postgres', G.gcpHex(`<ellipse cx="50" cy="26" rx="14" ry="5" fill="none" stroke="currentColor"/><path d="M36 26 V46 C36 49 42 52 50 52 C58 52 64 49 64 46 V26" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-bigquery', 'Google BigQuery', 'BigQuery DW', 'bigquery analytics warehouse data', G.gcpHex(`<circle cx="47" cy="34" r="11" fill="none" stroke="currentColor"/><rect x="43" y="30" width="3" height="8" fill="currentColor"/><rect x="48" y="27" width="3" height="11" fill="currentColor"/><line x1="55" y1="42" x2="63" y2="50" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-vpc', 'Google Cloud VPC', 'GCP VPC', 'vpc network subnet firewall', G.gcpHex(`<circle cx="38" cy="36" r="4" fill="currentColor"/><circle cx="62" cy="26" r="4" fill="currentColor"/><circle cx="62" cy="46" r="4" fill="currentColor"/><path d="M42 35 L58 27 M42 37 L58 45" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-lb', 'Cloud Load Balancing', 'Cloud LB', 'lb load balancer ingress cdn', G.gcpHex(`<circle cx="50" cy="24" r="4" fill="currentColor"/><circle cx="36" cy="46" r="4" fill="currentColor"/><circle cx="64" cy="46" r="4" fill="currentColor"/><path d="M50 28 V36 M36 36 H64 M36 36 V42 M64 36 V42" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-iam', 'Google Cloud IAM', 'Cloud IAM', 'iam security service account auth', G.gcpHex(`<circle cx="50" cy="30" r="6" fill="none" stroke="currentColor"/><path d="M38 48 C38 41 62 41 62 48" fill="none" stroke="currentColor"/>`), '#1A73E8'),

  // Vendor-neutral Cloud Teaching Concepts (explicitly badged CLOUD, never AWS)
  genericCloud('cloud-generic', 'Public Cloud Region', 'Cloud Region', 'multi cloud hybrid region zone', `<path d="M30 52 H70 A12 12 0 0 0 72 28 A18 18 0 0 0 36 24 A14 14 0 0 0 30 52 Z" fill="none" stroke="currentColor"/>`, '#0284C7'),
  genericCloud('cloud-vm', 'Cloud Compute Instance', 'Compute VM', 'vm server instance', G.awsEc2, '#475569'),
  genericCloud('cloud-db', 'Managed Database', 'Managed DB', 'database sql storage', G.awsRds, '#475569'),
  genericCloud('cloud-bucket', 'Object Storage Bucket', 'Object Bucket', 'bucket blob s3', G.awsS3, '#475569'),
];
