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


  azAppSvc: `<rect x="18" y="16" width="64" height="42" rx="5" fill="none" stroke="currentColor"/><rect x="18" y="16" width="64" height="10" rx="3" fill="currentColor" fill-opacity="0.18"/><circle cx="26" cy="21" r="2" fill="currentColor"/><path d="M30 34 H66 M30 42 H54" stroke="currentColor"/>`,
  azContApps: `<rect x="16" y="14" width="24" height="20" rx="3" fill="none" stroke="currentColor"/><rect x="44" y="14" width="24" height="20" rx="3" fill="none" stroke="currentColor"/><rect x="72" y="14" width="12" height="20" rx="3" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/><rect x="16" y="40" width="68" height="20" rx="3" fill="none" stroke="currentColor"/><path d="M24 50 H60" stroke="currentColor"/>`,
  azSvcBus: `<rect x="16" y="20" width="68" height="32" rx="5" fill="none" stroke="currentColor"/><path d="M24 28 H44 M24 36 H44 M24 44 H44" stroke="currentColor"/><path d="M52 28 H76 M70 22 L76 28 L70 34 M52 44 H76 M70 38 L76 44 L70 50" fill="none" stroke="currentColor"/>`,
  azEventGrid: `<rect x="18" y="18" width="26" height="20" rx="3" fill="none" stroke="currentColor"/><rect x="56" y="18" width="26" height="20" rx="3" fill="none" stroke="currentColor"/><rect x="37" y="44" width="26" height="18" rx="3" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/><path d="M44 38 L50 44 M56 38 L50 44 M31 38 V52 H37" fill="none" stroke="currentColor"/>`,
  azDevOps: `<circle cx="50" cy="36" r="24" fill="none" stroke="currentColor"/><path d="M38 36 H58 M52 28 L62 36 L52 44" fill="none" stroke="currentColor"/><circle cx="34" cy="26" r="4" fill="none" stroke="currentColor"/><circle cx="66" cy="48" r="4" fill="none" stroke="currentColor"/>`,
  azFirewall: `<rect x="20" y="12" width="60" height="48" rx="4" fill="none" stroke="currentColor"/><path d="M20 26 H80 M20 40 H80 M40 12 V60 M60 12 V60" stroke="currentColor"/><path d="M28 18 H36 M48 18 H56" stroke="currentColor"/>`,
  azDns: `<circle cx="50" cy="36" r="24" fill="none" stroke="currentColor"/><ellipse cx="50" cy="36" rx="10" ry="24" fill="none" stroke="currentColor"/><line x1="26" y1="36" x2="74" y2="36" stroke="currentColor"/><path d="M62 48 L74 60" stroke="currentColor"/>`,
  azAcr: `<rect x="20" y="14" width="60" height="16" rx="3" fill="none" stroke="currentColor"/><rect x="20" y="34" width="60" height="16" rx="3" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M30 22 H44 M30 42 H44 M52 22 H70 M52 42 H70" stroke="currentColor"/>`,
  azBackup: `<path d="M50 12 L78 24 V44 C78 56 66 62 50 66 C34 62 22 56 22 44 V24 Z" fill="none" stroke="currentColor"/><path d="M38 38 A12 12 0 1 1 42 48 M38 32 V40 H46" fill="none" stroke="currentColor"/>`,

  // Google Cloud Service Silhouettes

  gcpPubSub: `<rect x="16" y="16" width="30" height="40" rx="6" fill="none" stroke="currentColor"/><path d="M24 26 H38 M24 36 H38 M24 46 H38" stroke="currentColor"/><circle cx="68" cy="26" r="7" fill="none" stroke="currentColor"/><circle cx="68" cy="46" r="7" fill="none" stroke="currentColor"/><path d="M46 26 H61 M46 46 H61" stroke="currentColor"/>`,
  gcpEventarc: `<circle cx="26" cy="36" r="9" fill="none" stroke="currentColor"/><path d="M35 36 C45 20 55 52 70 30" fill="none" stroke="currentColor"/><rect x="64" y="22" width="22" height="18" rx="3" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/>`,
  gcpBuild: `<path d="M30 26 L44 36 L30 46 Z" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><rect x="18" y="16" width="64" height="40" rx="6" fill="none" stroke="currentColor"/><path d="M52 30 H70 M52 42 H64" stroke="currentColor"/>`,
  gcpArtifact: `<rect x="22" y="14" width="56" height="44" rx="5" fill="none" stroke="currentColor"/><path d="M22 24 H78" stroke="currentColor"/><path d="M50 30 L62 36 V48 L50 54 L38 48 V36 Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/>`,
  gcpRouter: `<circle cx="50" cy="36" r="14" fill="none" stroke="currentColor"/><path d="M50 14 V22 M50 50 V58 M28 36 H36 M64 36 H72" stroke="currentColor"/><path d="M44 30 L56 42 M56 30 L44 42" stroke="currentColor"/>`,
  gcpInterconnect: `<path d="M14 26 H40 M14 46 H40 M60 26 H86 M60 46 H86" stroke="currentColor"/><rect x="40" y="20" width="20" height="32" rx="4" fill="none" stroke="currentColor"/><circle cx="26" cy="36" r="3" fill="currentColor"/><circle cx="74" cy="36" r="3" fill="currentColor"/>`,
  gcpDns: `<circle cx="50" cy="36" r="22" fill="none" stroke="currentColor"/><path d="M50 14 C38 24 38 48 50 58 M50 14 C62 24 62 48 50 58 M28 36 H72" fill="none" stroke="currentColor"/>`,
  gcpDataflow: `<path d="M16 22 H34 L44 36 L34 50 H16" fill="none" stroke="currentColor"/><path d="M84 22 H66 L56 36 L66 50 H84" fill="none" stroke="currentColor"/><circle cx="50" cy="36" r="8" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/>`,
  gcpMonitoring: `<rect x="18" y="16" width="64" height="40" rx="4" fill="none" stroke="currentColor"/><polyline points="26,46 36,36 44,42 56,26 66,34 74,28" fill="none" stroke="currentColor"/><circle cx="56" cy="26" r="2.5" fill="currentColor"/>`,
  gcpSecret: `<rect x="30" y="26" width="40" height="30" rx="4" fill="none" stroke="currentColor"/><path d="M38 26 V20 A12 12 0 0 1 62 20 V26" fill="none" stroke="currentColor"/><circle cx="50" cy="40" r="4" fill="currentColor"/><path d="M50 44 V50" stroke="currentColor"/>`,

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

  // Expanded Azure services
  azure('az-appservice', 'Azure App Service', 'App Service', 'appservice web app paas', G.azAppSvc, '#0078D4'),
  azure('az-containerapps', 'Azure Container Apps', 'Container Apps', 'containerapps serverless container', G.azContApps, '#0078D4'),
  azure('az-servicebus', 'Azure Service Bus', 'Service Bus', 'servicebus queue topic messaging', G.azSvcBus, '#0078D4'),
  azure('az-eventgrid', 'Azure Event Grid', 'Event Grid', 'eventgrid events pubsub', G.azEventGrid, '#0078D4'),
  azure('az-devops', 'Azure DevOps', 'Azure Pipelines', 'devops pipelines cicd build release', G.azDevOps, '#0078D4'),
  azure('az-firewall', 'Azure Firewall', 'Azure Firewall', 'firewall waf security network', G.azFirewall, '#0078D4'),
  azure('az-dns', 'Azure DNS', 'Azure DNS', 'dns zone domain resolver', G.azDns, '#0078D4'),
  azure('az-acr', 'Azure Container Registry', 'ACR', 'acr registry container image', G.azAcr, '#0078D4'),
  azure('az-backup', 'Azure Backup / Site Recovery', 'Azure Backup', 'backup dr recovery vault', G.azBackup, '#0078D4'),

  // Expanded GCP services
  gcp('gcp-pubsub', 'Google Cloud Pub/Sub', 'Pub/Sub', 'pubsub queue topic messaging', G.gcpHex(`${G.gcpPubSub}`), '#1A73E8'),
  gcp('gcp-eventarc', 'Eventarc', 'Eventarc', 'eventarc events triggers', G.gcpHex(`${G.gcpEventarc}`), '#1A73E8'),
  gcp('gcp-build', 'Cloud Build', 'Cloud Build', 'build cicd pipeline', G.gcpHex(`${G.gcpBuild}`), '#1A73E8'),
  gcp('gcp-artifact', 'Artifact Registry', 'Artifact Registry', 'artifact registry container image', G.gcpHex(`${G.gcpArtifact}`), '#1A73E8'),
  gcp('gcp-router', 'Cloud Router', 'Cloud Router', 'router bgp nat network', G.gcpHex(`${G.gcpRouter}`), '#1A73E8'),
  gcp('gcp-interconnect', 'Cloud Interconnect', 'Interconnect', 'interconnect hybrid network link', G.gcpHex(`${G.gcpInterconnect}`), '#1A73E8'),
  gcp('gcp-dns', 'Cloud DNS', 'Cloud DNS', 'dns zone domain', G.gcpHex(`${G.gcpDns}`), '#1A73E8'),
  gcp('gcp-dataflow', 'Dataflow', 'Dataflow', 'dataflow stream batch pipeline', G.gcpHex(`${G.gcpDataflow}`), '#1A73E8'),
  gcp('gcp-monitoring', 'Cloud Monitoring', 'Cloud Monitoring', 'monitoring logs metrics observability', G.gcpHex(`${G.gcpMonitoring}`), '#1A73E8'),
  gcp('gcp-secret', 'Secret Manager', 'Secret Manager', 'secret manager kms credentials', G.gcpHex(`${G.gcpSecret}`), '#1A73E8'),

  // Requirement-driven services (2026-11 review of the providers' own reference
  // architectures). Same silhouette language as the rest of the pack: 100×72
  // viewBox, currentColor strokes, tinted fills of at most 0.2 opacity.
  aws('aws-apigw', 'Amazon API Gateway', 'API Gateway', 'api gateway rest http websocket ingress', `<rect x="16" y="20" width="68" height="32" rx="6" fill="none" stroke="currentColor"/><text x="50" y="41" font-family="sans-serif" font-size="14" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">API</text><path d="M8 30 H16 M8 42 H16 M84 30 H92 M84 42 H92" stroke="currentColor"/>`, '#8C4FFF'),
  aws('aws-stepfunctions', 'AWS Step Functions', 'Step Functions', 'step functions workflow state machine orchestration', `<circle cx="22" cy="36" r="7" fill="none" stroke="currentColor"/><circle cx="50" cy="20" r="7" fill="none" stroke="currentColor"/><circle cx="50" cy="52" r="7" fill="none" stroke="currentColor"/><rect x="70" y="28" width="14" height="16" rx="3" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/><path d="M29 33 L43 23 M29 39 L43 49 M57 22 H70 V32 M57 50 H70 V40" fill="none" stroke="currentColor"/>`, '#CD2264'),
  aws('aws-eventbridge', 'Amazon EventBridge', 'EventBridge', 'eventbridge events bus rules routing', `<polygon points="50,12 76,26 76,46 50,60 24,46 24,26" fill="none" stroke="currentColor"/><circle cx="50" cy="36" r="7" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><path d="M50 12 V20 M50 52 V60 M24 26 L32 31 M68 41 L76 46 M76 26 L68 31 M32 41 L24 46" stroke="currentColor"/>`, '#E7157B'),
  aws('aws-kinesis', 'Amazon Kinesis', 'Kinesis Stream', 'kinesis stream shards firehose realtime', `<path d="M22 16 H54 L78 26 H46 Z" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M22 30 H54 L78 40 H46 Z" fill="none" stroke="currentColor"/><path d="M22 44 H54 L78 54 H46 Z" fill="none" stroke="currentColor"/><path d="M34 22 H50 M34 36 H50 M34 50 H50" stroke="currentColor"/>`, '#8C4FFF'),
  aws('aws-glue', 'AWS Glue', 'Glue ETL', 'glue etl catalog spark transform', `<ellipse cx="28" cy="22" rx="12" ry="5" fill="none" stroke="currentColor"/><path d="M16 22 V42 C16 46 22 48 28 48 C34 48 40 46 40 42 V22" fill="none" stroke="currentColor"/><ellipse cx="72" cy="22" rx="12" ry="5" fill="none" stroke="currentColor"/><path d="M60 22 V42 C60 46 66 48 72 48 C78 48 84 46 84 42 V22" fill="none" stroke="currentColor"/><path d="M40 35 H60 M54 29 L60 35 L54 41" fill="none" stroke="currentColor"/>`, '#8C4FFF'),
  aws('aws-athena', 'Amazon Athena', 'Athena Query', 'athena query s3 sql analytics', `<rect x="18" y="18" width="48" height="36" rx="3" fill="none" stroke="currentColor"/><path d="M18 28 H66 M18 38 H66 M34 18 V54 M50 18 V54" stroke="currentColor"/><circle cx="66" cy="46" r="12" fill="none" stroke="currentColor"/><path d="M74 55 L84 64" stroke="currentColor"/>`, '#8C4FFF'),
  aws('aws-redshift', 'Amazon Redshift', 'Redshift DW', 'redshift warehouse analytics columnar', `<rect x="18" y="14" width="64" height="14" rx="3" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><rect x="18" y="32" width="64" height="12" rx="3" fill="none" stroke="currentColor"/><rect x="18" y="48" width="64" height="12" rx="3" fill="none" stroke="currentColor"/><path d="M30 14 V60 M50 14 V60 M70 14 V60" stroke="currentColor" stroke-dasharray="3,3"/>`, '#8C4FFF'),
  aws('aws-ecr', 'Amazon ECR', 'ECR Registry', 'ecr registry container image push pull', `<rect x="20" y="16" width="60" height="40" rx="5" fill="none" stroke="currentColor"/><rect x="28" y="24" width="18" height="10" rx="2" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/><rect x="54" y="24" width="18" height="10" rx="2" fill="none" stroke="currentColor"/><rect x="28" y="39" width="44" height="10" rx="2" fill="none" stroke="currentColor"/><path d="M50 8 V16" stroke="currentColor"/>`, '#ED7100'),
  aws('aws-secrets', 'AWS Secrets Manager', 'Secrets Manager', 'secrets manager kms credentials rotation', `<rect x="30" y="28" width="40" height="28" rx="4" fill="none" stroke="currentColor"/><path d="M38 28 V20 A12 12 0 0 1 62 20 V28" fill="none" stroke="currentColor"/><circle cx="50" cy="40" r="4" fill="currentColor"/><path d="M50 44 V52" stroke="currentColor"/><path d="M22 24 L16 20 M22 48 L16 52" stroke="currentColor"/>`, '#DD344C'),
  aws('aws-cloudtrail', 'AWS CloudTrail', 'CloudTrail Audit', 'cloudtrail audit logs compliance trail', `<rect x="26" y="12" width="48" height="50" rx="4" fill="none" stroke="currentColor"/><path d="M34 24 H58 M34 32 H58 M34 40 H48" stroke="currentColor"/><path d="M36 50 L43 57 L62 38" fill="none" stroke="currentColor"/><path d="M74 22 H84 M74 36 H84 M74 50 H84" stroke="currentColor" stroke-dasharray="3,3"/>`, '#DD344C'),
  aws('aws-nat', 'AWS NAT Gateway', 'NAT Gateway', 'nat gateway egress outbound internet', `<rect x="30" y="24" width="40" height="24" rx="4" fill="none" stroke="currentColor"/><text x="50" y="40" font-family="sans-serif" font-size="11" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">NAT</text><path d="M10 36 H30 M22 30 L30 36 L22 42 M70 36 H90 M78 30 L70 36 L78 42" fill="none" stroke="currentColor"/>`, '#8C4FFF'),
  aws('aws-tgw', 'AWS Transit Gateway', 'Transit Gateway', 'transit gateway hub spoke network peering', `<circle cx="50" cy="36" r="12" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><circle cx="18" cy="18" r="6" fill="none" stroke="currentColor"/><circle cx="18" cy="54" r="6" fill="none" stroke="currentColor"/><circle cx="82" cy="18" r="6" fill="none" stroke="currentColor"/><circle cx="82" cy="54" r="6" fill="none" stroke="currentColor"/><path d="M23 21 L41 31 M23 51 L41 41 M59 31 L77 21 M59 41 L77 51" fill="none" stroke="currentColor"/>`, '#8C4FFF'),
  aws('aws-elasticache', 'Amazon ElastiCache', 'ElastiCache', 'elasticache redis memcached cache', `<ellipse cx="50" cy="20" rx="22" ry="7" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M28 20 V46 C28 51 38 54 50 54 C62 54 72 51 72 46 V20" fill="none" stroke="currentColor"/><path d="M28 32 C28 37 38 40 50 40 C62 40 72 37 72 32" fill="none" stroke="currentColor"/><path d="M58 22 L48 36 H56 L46 50" fill="none" stroke="currentColor"/>`, '#3B48CC'),
  aws('aws-opensearch', 'Amazon OpenSearch', 'OpenSearch', 'opensearch elasticsearch search logs index', `<circle cx="44" cy="32" r="18" fill="none" stroke="currentColor"/><path d="M32 28 H56 M32 36 H56" stroke="currentColor"/><path d="M57 45 L76 62" stroke="currentColor"/><path d="M68 20 L76 14 M74 26 H84" stroke="currentColor" stroke-dasharray="3,3"/>`, '#3B48CC'),
  aws('aws-waf', 'AWS WAF / Shield', 'AWS WAF', 'waf shield firewall ddos rules', `<path d="M50 10 L76 20 V38 C76 52 64 60 50 64 C36 60 24 52 24 38 V20 Z" fill="none" stroke="currentColor"/><path d="M34 24 H66 M34 34 H66 M34 44 H54" stroke="currentColor"/><circle cx="62" cy="44" r="5" fill="currentColor" fill-opacity="0.25" stroke="currentColor"/>`, '#DD344C'),
  aws('aws-directconnect', 'AWS Direct Connect', 'Direct Connect', 'direct connect hybrid onprem private link', `<rect x="14" y="26" width="20" height="20" rx="3" fill="none" stroke="currentColor"/><path d="M34 36 H62" stroke="currentColor" stroke-dasharray="4,3"/><path d="M62 30 L70 36 L62 42" fill="none" stroke="currentColor"/><path d="M70 18 H86 V54 H70" fill="none" stroke="currentColor"/><path d="M20 26 V16 M28 26 V16" stroke="currentColor"/>`, '#8C4FFF'),
  aws('aws-cognito', 'Amazon Cognito', 'Cognito', 'cognito identity users auth signin', `<circle cx="40" cy="26" r="9" fill="none" stroke="currentColor"/><path d="M24 54 C24 44 56 44 56 54" fill="none" stroke="currentColor"/><rect x="60" y="30" width="26" height="20" rx="3" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M66 30 V24 A7 7 0 0 1 80 24 V30" fill="none" stroke="currentColor"/>`, '#DD344C'),
  aws('aws-efs', 'Amazon EFS', 'EFS', 'efs file system shared storage nfs', `<path d="M18 22 H42 L48 30 H82 V54 H18 Z" fill="none" stroke="currentColor"/><path d="M26 40 H74 M26 46 H62" stroke="currentColor"/><path d="M58 18 H76" stroke="currentColor" stroke-dasharray="4,3"/>`, '#3F8624'),
  aws('aws-cloudformation', 'AWS CloudFormation / CDK', 'CloudFormation', 'cloudformation cdk iac template stack', `<path d="M50 12 L80 26 L50 40 L20 26 Z" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M20 36 L50 50 L80 36" fill="none" stroke="currentColor"/><path d="M20 46 L50 60 L80 46" fill="none" stroke="currentColor"/>`, '#E7157B'),

  azure('az-apim', 'Azure API Management', 'APIM', 'apim api management gateway rest', `<rect x="14" y="18" width="72" height="36" rx="5" fill="none" stroke="currentColor"/><text x="50" y="41" font-family="sans-serif" font-size="13" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">API</text><path d="M38 14 V18 M62 14 V18 M38 54 V58 M62 54 V58" stroke="currentColor"/>`, '#0078D4'),
  azure('az-frontdoor', 'Azure Front Door', 'Front Door', 'frontdoor cdn waf global load balancer', `<circle cx="50" cy="36" r="22" fill="none" stroke="currentColor"/><ellipse cx="50" cy="36" rx="9" ry="22" fill="none" stroke="currentColor"/><line x1="28" y1="36" x2="72" y2="36" stroke="currentColor"/><path d="M14 22 L24 22 M76 22 L86 22" stroke="currentColor"/><path d="M86 22 L80 18 M86 22 L80 26" fill="none" stroke="currentColor"/>`, '#0078D4'),
  azure('az-bastion', 'Azure Bastion', 'Bastion', 'bastion jump host ssh rdp secure', `<rect x="26" y="12" width="48" height="38" rx="4" fill="none" stroke="currentColor"/><path d="M34 22 H54 M34 30 H48" stroke="currentColor"/><path d="M34 40 L40 46 L54 32" fill="none" stroke="currentColor"/><path d="M30 58 H70 M50 50 V58" stroke="currentColor"/>`, '#0078D4'),
  azure('az-private-endpoint', 'Azure Private Endpoint', 'Private Endpoint', 'private endpoint privatelink subnet nic', `<rect x="16" y="26" width="34" height="20" rx="4" fill="none" stroke="currentColor"/><rect x="56" y="22" width="28" height="28" rx="4" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M50 36 H56" stroke="currentColor"/><circle cx="70" cy="34" r="3.5" fill="currentColor"/><path d="M70 37 V42" stroke="currentColor"/><path d="M26 22 V16 M40 22 V16" stroke="currentColor"/>`, '#0078D4'),
  azure('az-eventhubs', 'Azure Event Hubs', 'Event Hubs', 'eventhubs stream ingestion kafka', `<rect x="16" y="20" width="68" height="32" rx="5" fill="none" stroke="currentColor"/><path d="M24 28 C34 22 44 34 54 28 C64 22 74 34 84 28" fill="none" stroke="currentColor"/><path d="M24 44 C34 38 44 50 54 44 C64 38 74 50 84 44" fill="none" stroke="currentColor"/>`, '#0078D4'),
  azure('az-redis', 'Azure Cache for Redis', 'Azure Cache', 'redis cache memory low latency', `<ellipse cx="50" cy="20" rx="22" ry="7" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M28 20 V46 C28 51 38 54 50 54 C62 54 72 51 72 46 V20" fill="none" stroke="currentColor"/><path d="M28 32 C28 37 38 40 50 40 C62 40 72 37 72 32" fill="none" stroke="currentColor"/><path d="M60 24 L50 36 H58 L48 48" fill="none" stroke="currentColor"/>`, '#0078D4'),
  azure('az-synapse', 'Azure Synapse Analytics', 'Synapse', 'synapse analytics warehouse spark sql', `<rect x="16" y="44" width="10" height="16" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><rect x="30" y="34" width="10" height="26" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><rect x="44" y="24" width="10" height="36" fill="currentColor" fill-opacity="0.2" stroke="currentColor"/><ellipse cx="74" cy="22" rx="14" ry="5" fill="none" stroke="currentColor"/><path d="M60 22 V46 C60 50 66 52 74 52 C82 52 88 50 88 46 V22" fill="none" stroke="currentColor"/>`, '#0078D4'),
  azure('az-staticweb', 'Azure Static Web Apps', 'Static Web App', 'static web apps spa jamstack functions', `<rect x="18" y="16" width="64" height="40" rx="4" fill="none" stroke="currentColor"/><path d="M18 26 H82" stroke="currentColor"/><circle cx="25" cy="21" r="1.8" fill="currentColor"/><circle cx="32" cy="21" r="1.8" fill="currentColor"/><path d="M40 34 H70 M40 42 H58" stroke="currentColor"/><circle cx="68" cy="42" r="5" fill="none" stroke="currentColor"/>`, '#0078D4'),

  gcp('gcp-functions', 'Cloud Functions', 'Cloud Function', 'functions faas serverless event', G.gcpHex(`<path d="M40 24 L34 36 L44 36 L38 50" fill="none" stroke="currentColor"/><circle cx="58" cy="28" r="6" fill="none" stroke="currentColor"/><path d="M52 46 C52 38 64 38 64 46" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-appengine', 'App Engine', 'App Engine', 'appengine paas web application', G.gcpHex(`<rect x="34" y="24" width="32" height="24" rx="3" fill="none" stroke="currentColor"/><path d="M34 32 H66 M42 24 V48" stroke="currentColor"/><circle cx="50" cy="40" r="4" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-armor', 'Cloud Armor', 'Cloud Armor', 'armor waf ddos firewall security', G.gcpHex(`<path d="M50 18 L62 23 V34 C62 41 56 45 50 48 C44 45 38 41 38 34 V23 Z" fill="none" stroke="currentColor"/><path d="M44 33 L48 37 L57 28" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-apigw', 'API Gateway (GCP)', 'API Gateway', 'api gateway endpoints openapi', G.gcpHex(`<rect x="32" y="24" width="36" height="24" rx="4" fill="none" stroke="currentColor"/><text x="50" y="40" font-family="sans-serif" font-size="10" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">API</text>`), '#1A73E8'),
  gcp('gcp-memorystore', 'Memorystore', 'Memorystore', 'memorystore redis memcached cache', G.gcpHex(`<ellipse cx="50" cy="26" rx="14" ry="4.5" fill="none" stroke="currentColor"/><path d="M36 26 V44 C36 47 42 49 50 49 C58 49 64 47 64 44 V26" fill="none" stroke="currentColor"/><path d="M36 35 C36 38 42 40 50 40 C58 40 64 38 64 35" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-dataproc', 'Dataproc', 'Dataproc', 'dataproc spark hadoop batch cluster', G.gcpHex(`<circle cx="40" cy="28" r="5" fill="none" stroke="currentColor"/><circle cx="60" cy="28" r="5" fill="none" stroke="currentColor"/><circle cx="50" cy="45" r="5" fill="none" stroke="currentColor"/><path d="M45 28 H55 M43 33 L47 41 M57 33 L53 41" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-dataplex', 'Dataplex / Dataplex Universal Catalog', 'Dataplex', 'dataplex catalog lake governance metadata', G.gcpHex(`<path d="M30 28 H70 M30 36 H70 M30 44 H70" stroke="currentColor"/><path d="M38 24 L44 48 M62 24 L56 48" stroke="currentColor" stroke-dasharray="3,3"/>`), '#1A73E8'),
  gcp('gcp-cdn', 'Cloud CDN', 'Cloud CDN', 'cdn edge cache content delivery', G.gcpHex(`<circle cx="50" cy="36" r="12" fill="none" stroke="currentColor"/><path d="M50 24 C44 30 44 42 50 48 M50 24 C56 30 56 42 50 48 M38 36 H62" fill="none" stroke="currentColor"/><circle cx="32" cy="22" r="2.5" fill="currentColor"/><circle cx="68" cy="50" r="2.5" fill="currentColor"/>`), '#1A73E8'),

  // Services the reference-architecture ranking (2026-11-03) still found missing.
  aws('aws-privatelink', 'AWS PrivateLink', 'PrivateLink', 'privatelink private endpoint vpc endpoint saas', `<rect x="14" y="26" width="26" height="20" rx="4" fill="none" stroke="currentColor"/><rect x="60" y="22" width="26" height="28" rx="4" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M40 32 H54 M40 40 H54" stroke="currentColor" stroke-dasharray="4,3"/><circle cx="57" cy="32" r="2.5" fill="currentColor"/><circle cx="57" cy="40" r="2.5" fill="currentColor"/>`, '#8C4FFF'),
  aws('aws-xray', 'AWS X-Ray', 'X-Ray traces', 'xray tracing distributed trace latency spans', `<circle cx="24" cy="36" r="7" fill="none" stroke="currentColor"/><circle cx="50" cy="36" r="7" fill="currentColor" fill-opacity="0.18" stroke="currentColor"/><circle cx="76" cy="36" r="7" fill="none" stroke="currentColor"/><path d="M31 36 H43 M57 36 H69" stroke="currentColor"/><path d="M40 20 L44 30 M60 42 L64 52" stroke="currentColor" stroke-dasharray="3,3"/>`, '#DD344C'),
  azure('az-logicapps', 'Azure Logic Apps', 'Logic Apps', 'logic apps workflow orchestration integration', `<rect x="16" y="22" width="30" height="28" rx="4" fill="none" stroke="currentColor"/><rect x="54" y="22" width="30" height="12" rx="3" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><rect x="54" y="38" width="30" height="12" rx="3" fill="none" stroke="currentColor"/><path d="M46 30 L50 36 L46 42" fill="none" stroke="currentColor"/>`, '#0078D4'),
  azure('az-nat', 'Azure NAT Gateway', 'NAT Gateway', 'nat gateway egress outbound spoke internet', `<rect x="30" y="24" width="40" height="24" rx="4" fill="none" stroke="currentColor"/><text x="50" y="40" font-family="sans-serif" font-size="11" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">NAT</text><path d="M10 36 H30 M22 30 L30 36 L22 42 M70 36 H90 M78 30 L70 36 L78 42" fill="none" stroke="currentColor"/>`, '#0078D4'),
  azure('az-lb', 'Azure Load Balancer', 'Load Balancer', 'load balancer l4 tcp layer 4 traffic', `<circle cx="24" cy="36" r="8" fill="none" stroke="currentColor"/><path d="M32 36 H46 M46 20 V52 M46 20 H66 M46 36 H66 M46 52 H66" fill="none" stroke="currentColor"/><rect x="66" y="14" width="18" height="12" rx="2" fill="none" stroke="currentColor"/><rect x="66" y="30" width="18" height="12" rx="2" fill="none" stroke="currentColor"/><rect x="66" y="46" width="18" height="12" rx="2" fill="none" stroke="currentColor"/>`, '#0078D4'),
  azure('az-appinsights', 'Application Insights', 'App Insights', 'application insights apm tracing telemetry distributed', `<circle cx="50" cy="36" r="22" fill="none" stroke="currentColor"/><polyline points="32,44 42,32 48,38 58,24 68,30" fill="none" stroke="currentColor"/><circle cx="58" cy="24" r="3" fill="currentColor"/><path d="M50 14 V22" stroke="currentColor" stroke-dasharray="3,3"/>`, '#0078D4'),
  azure('az-expressroute', 'Azure ExpressRoute / VPN Gateway', 'ExpressRoute', 'expressroute vpn gateway hybrid onprem circuit', `<rect x="12" y="28" width="20" height="18" rx="3" fill="none" stroke="currentColor"/><path d="M32 37 H54" stroke="currentColor" stroke-dasharray="4,3"/><circle cx="62" cy="37" r="9" fill="none" stroke="currentColor"/><path d="M62 37 L86 22 M62 37 L86 52" fill="none" stroke="currentColor"/><path d="M18 28 V18 M26 28 V18" stroke="currentColor"/>`, '#0078D4'),
  gcp('gcp-nat', 'Cloud NAT', 'Cloud NAT', 'cloud nat egress private vm gke outbound', G.gcpHex(`<rect x="30" y="26" width="40" height="22" rx="4" fill="none" stroke="currentColor"/><text x="50" y="41" font-family="sans-serif" font-size="10" font-weight="700" fill="currentColor" stroke="none" text-anchor="middle">NAT</text><path d="M28 36 H30 M70 36 H72" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-psc', 'Private Service Connect', 'Private Service Connect', 'private service connect psc endpoint producer consumer', G.gcpHex(`<rect x="26" y="26" width="20" height="20" rx="3" fill="none" stroke="currentColor"/><rect x="54" y="26" width="20" height="20" rx="3" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M46 32 H54 M46 40 H54" stroke="currentColor" stroke-dasharray="3,2"/><circle cx="50" cy="32" r="2" fill="currentColor"/><circle cx="50" cy="40" r="2" fill="currentColor"/>`), '#1A73E8'),
  gcp('gcp-tasks', 'Cloud Tasks', 'Cloud Tasks', 'cloud tasks queue async workqueue retry', G.gcpHex(`<rect x="30" y="22" width="40" height="12" rx="3" fill="none" stroke="currentColor"/><rect x="30" y="38" width="40" height="12" rx="3" fill="currentColor" fill-opacity="0.16" stroke="currentColor"/><path d="M36 28 H44 M36 44 H44" stroke="currentColor"/><circle cx="64" cy="28" r="2.5" fill="none" stroke="currentColor"/><circle cx="64" cy="44" r="2.5" fill="none" stroke="currentColor"/>`), '#1A73E8'),
  gcp('gcp-logging', 'Cloud Logging', 'Cloud Logging', 'cloud logging logs sinks audit centralised', G.gcpHex(`<rect x="30" y="22" width="40" height="26" rx="3" fill="none" stroke="currentColor"/><path d="M36 30 H58 M36 36 H58 M36 42 H48" stroke="currentColor"/><path d="M30 52 H70" stroke="currentColor" stroke-dasharray="3,3"/>`), '#1A73E8'),
  gcp('gcp-vpn', 'Cloud VPN', 'Cloud VPN', 'cloud vpn hybrid onprem tunnel ipsec', G.gcpHex(`<rect x="28" y="28" width="18" height="16" rx="3" fill="none" stroke="currentColor"/><rect x="54" y="28" width="18" height="16" rx="3" fill="none" stroke="currentColor"/><path d="M46 36 H54" stroke="currentColor" stroke-dasharray="3,2"/><path d="M34 28 V22 A7 7 0 0 1 48 22 V28" fill="none" stroke="currentColor"/>`), '#1A73E8'),

  // Vendor-neutral Cloud Teaching Concepts (explicitly badged CLOUD, never AWS)
  genericCloud('cloud-generic', 'Public Cloud Region', 'Cloud Region', 'multi cloud hybrid region zone', `<path d="M30 52 H70 A12 12 0 0 0 72 28 A18 18 0 0 0 36 24 A14 14 0 0 0 30 52 Z" fill="none" stroke="currentColor"/>`, '#0284C7'),
  genericCloud('cloud-vm', 'Cloud Compute Instance', 'Compute VM', 'vm server instance', G.awsEc2, '#475569'),
  genericCloud('cloud-db', 'Managed Database', 'Managed DB', 'database sql storage', G.awsRds, '#475569'),
  genericCloud('cloud-bucket', 'Object Storage Bucket', 'Object Bucket', 'bucket blob s3', G.awsS3, '#475569'),
];
