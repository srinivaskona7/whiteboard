// stencils/devops-cicd.js — Git, CI/CD & GitOps, Infrastructure as Code (IaC), and Config Management Icons
import { createDevOpsStencil } from './card.js';

const C = {
  gitBranch: `<circle cx="28" cy="18" r="7" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="28" cy="54" r="7" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="72" cy="28" r="7" fill="none" stroke="currentColor" stroke-width="4"/><line x1="28" y1="25" x2="28" y2="47" stroke="currentColor" stroke-width="4"/><path d="M28,25 C28,38 72,38 72,35" fill="none" stroke="currentColor" stroke-width="4"/>`,
  gitPr: `<circle cx="26" cy="18" r="7" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="26" cy="54" r="7" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="74" cy="54" r="7" fill="none" stroke="currentColor" stroke-width="4"/><line x1="26" y1="25" x2="26" y2="47" stroke="currentColor" stroke-width="4"/><path d="M44,18 H62 C70,18 74,22 74,30 V47" fill="none" stroke="currentColor" stroke-width="4"/><polyline points="50,12 42,18 50,24" fill="none" stroke="currentColor" stroke-width="3.8"/>`,
  octocat: `<circle cx="50" cy="34" r="20" fill="none" stroke="currentColor" stroke-width="4"/><polygon points="34,20 30,8 42,15" fill="currentColor"/><polygon points="66,20 70,8 58,15" fill="currentColor"/><line x1="50" y1="54" x2="50" y2="66" stroke="currentColor" stroke-width="4"/>`,
  fox: `<polygon points="50,58 18,28 28,10 38,26 62,26 72,10 82,28" fill="none" stroke="currentColor" stroke-width="4"/>`,
  pipeline: `<circle cx="20" cy="36" r="8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="36" r="8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="80" cy="36" r="8" fill="none" stroke="currentColor" stroke-width="4"/><line x1="28" y1="36" x2="42" y2="36" stroke="currentColor" stroke-width="4"/><line x1="58" y1="36" x2="72" y2="36" stroke="currentColor" stroke-width="4"/><polyline points="37,31 42,36 37,41" fill="none" stroke="currentColor" stroke-width="3.4"/><polyline points="67,31 72,36 67,41" fill="none" stroke="currentColor" stroke-width="3.4"/>`,
  syncLoop: `<path d="M26,32 A22,22 0 0,1 72,24" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="64,14 74,24 62,28" fill="none" stroke="currentColor" stroke-width="4"/><path d="M74,40 A22,22 0 0,1 28,48" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="36,58 26,48 38,44" fill="none" stroke="currentColor" stroke-width="4"/>`,
  terraform: `<polygon points="20,10 42,22 42,44 20,32" fill="currentColor"/><polygon points="46,24 68,36 68,58 46,46" fill="currentColor"/><polygon points="72,22 86,14 86,36 72,44" fill="none" stroke="currentColor" stroke-width="3.5"/><polygon points="46,49 68,61 46,68" fill="currentColor"/>`,
  blocks: `<rect x="18" y="14" width="26" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="4"/><rect x="56" y="14" width="26" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="4"/><rect x="36" y="42" width="28" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="4"/><line x1="31" y1="34" x2="45" y2="42" stroke="currentColor" stroke-width="3.5"/><line x1="69" y1="34" x2="55" y2="42" stroke="currentColor" stroke-width="3.5"/>`,
  ansible: `<circle cx="50" cy="36" r="24" fill="none" stroke="currentColor" stroke-width="4"/><polygon points="50,18 64,52 38,40" fill="none" stroke="currentColor" stroke-width="4"/>`,
  playbook: `<rect x="24" y="10" width="52" height="52" rx="5" fill="none" stroke="currentColor" stroke-width="4"/><line x1="34" y1="24" x2="66" y2="24" stroke="currentColor" stroke-width="3.6"/><line x1="34" y1="36" x2="66" y2="36" stroke="currentColor" stroke-width="3.6"/><line x1="34" y1="48" x2="54" y2="48" stroke="currentColor" stroke-width="3.6"/>`,
  artifact: `<polygon points="50,10 82,25 82,53 50,66 18,53 18,25" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="18,25 50,39 82,25" fill="none" stroke="currentColor" stroke-width="3.6"/><line x1="50" y1="39" x2="50" y2="66" stroke="currentColor" stroke-width="3.6"/>`,
};

const git = (id, name, badge, defaultText, tags, svgBody, color = '#F05032') =>
  createDevOpsStencil({ id, name, category: 'Git & Source Control', badge, color, defaultText, tags, svgBody });

const cicd = (id, name, badge, defaultText, tags, svgBody, color = '#7C3AED') =>
  createDevOpsStencil({ id, name, category: 'CI/CD & GitOps', badge, color, defaultText, tags, svgBody });

const iac = (id, name, badge, defaultText, tags, svgBody, color = '#7B42BC') =>
  createDevOpsStencil({ id, name, category: 'Infrastructure as Code', badge, color, defaultText, tags, svgBody });

const cfg = (id, name, badge, defaultText, tags, svgBody, color = '#EE0000') =>
  createDevOpsStencil({ id, name, category: 'Config Management', badge, color, defaultText, tags, svgBody });

export const DEVOPS_CICD_STENCILS = [
  // Git & Source Control
  git('git-repo', 'Git Repository', 'GIT', 'Git Repo', 'git version control commit clone', C.gitBranch, '#F05032'),
  git('git-branch', 'Git Branch / Tag', 'BRANCH', 'Feature Branch', 'branch checkout tag commit tree', C.gitBranch, '#F05032'),
  git('git-pr', 'Pull / Merge Request', 'PR/MR', 'Pull Request', 'code review merge request diff', C.gitPr, '#2563EB'),
  git('git-github', 'GitHub', 'GITHUB', 'GitHub Repo', 'github octocat repo source control', C.octocat, '#24292F'),
  git('git-gitlab', 'GitLab', 'GITLAB', 'GitLab Repo', 'gitlab devsecops repo mr', C.fox, '#FC6D26'),
  git('git-bitbucket', 'Bitbucket', 'BITBUCKET', 'Bitbucket Repo', 'atlassian bitbucket git', C.playbook, '#0052CC'),
  git('git-gitea', 'Gitea / Forgejo', 'GITEA', 'Self-Hosted Git', 'gitea forgejo git server', C.gitBranch, '#609926'),

  // CI/CD & GitOps
  cicd('cicd-gh-actions', 'GitHub Actions', 'ACTIONS', 'GitHub Actions', 'workflow runner yaml ci cd', C.pipeline, '#2088FF'),
  cicd('cicd-gitlab-ci', 'GitLab CI/CD', 'GITLAB-CI', 'GitLab Runner', 'gitlab-ci pipeline runner stage', C.fox, '#FC6D26'),
  cicd('cicd-jenkins', 'Jenkins', 'JENKINS', 'Jenkins Pipeline', 'jenkinsfile groovy automation controller agent', C.pipeline, '#D33833'),
  cicd('cicd-argocd', 'Argo CD', 'ARGOCD', 'Argo CD GitOps', 'gitops kubernetes sync controller argo', C.syncLoop, '#EF7B4D'),
  cicd('cicd-flux', 'Flux CD', 'FLUX', 'Flux GitOps', 'gitops kustomize helm reconcile', C.syncLoop, '#5468FF'),
  cicd('cicd-tekton', 'Tekton Pipelines', 'TEKTON', 'Tekton TaskRun', 'cloud native pipeline kubernetes tekton', C.blocks, '#FD495C'),
  cicd('cicd-pipeline', 'Build & Test Stage', 'STAGE', 'CI Build / Test', 'compile lint unit test stage', C.pipeline, '#7C3AED'),
  cicd('cicd-artifact', 'Artifact Repository', 'ARTIFACT', 'Nexus / Artifactory', 'jfrog artifactory nexus maven npm binary', C.artifact, '#16A34A'),

  // Infrastructure as Code (IaC)
  iac('iac-terraform', 'Terraform', 'TF', 'Terraform IaC', 'hashicorp hcl state plan apply module', C.terraform, '#7B42BC'),
  iac('iac-opentofu', 'OpenTofu', 'TOFU', 'OpenTofu IaC', 'opentofu linux foundation hcl state', C.terraform, '#D97706'),
  iac('iac-pulumi', 'Pulumi', 'PULUMI', 'Pulumi Stack', 'typescript python go infrastructure as code', C.blocks, '#8A3391'),
  iac('iac-cloudformation', 'AWS CloudFormation', 'CFN', 'CloudFormation', 'aws stack template yaml cdk', C.playbook, '#E7157B'),
  iac('iac-crossplane', 'Crossplane', 'XPLANE', 'Crossplane XRD', 'kubernetes control plane composition', C.syncLoop, '#326CE5'),
  iac('iac-packer', 'HashiCorp Packer', 'PACKER', 'Packer Golden AMI', 'machine image builder ami vhd', C.artifact, '#02A8EF'),

  // Configuration Management
  cfg('cfg-ansible', 'Red Hat Ansible', 'ANSIBLE', 'Ansible Playbook', 'automation playbook inventory ssh agentless yaml', C.ansible, '#EE0000'),
  cfg('cfg-puppet', 'Puppet', 'PUPPET', 'Puppet Agent', 'manifest catalog desired state', C.blocks, '#D97706'),
  cfg('cfg-chef', 'Chef Infra', 'CHEF', 'Chef Cookbook', 'recipe cookbook ruby infra', C.playbook, '#F09820'),
  cfg('cfg-salt', 'SaltStack', 'SALT', 'Salt Master/Minion', 'event driven remote execution pillar', C.artifact, '#0D9488'),
  cfg('cfg-cloudinit', 'cloud-init', 'INIT', 'cloud-init UserData', 'bootstrap metadata first boot', C.playbook, '#475569'),
];
