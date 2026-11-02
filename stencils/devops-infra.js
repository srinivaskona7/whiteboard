// stencils/devops-infra.js — Linux, Docker & Containers, Kubernetes, and Networking Icons
import { createDevOpsStencil } from './card.js';

const I = {
  tux: `<ellipse cx="50" cy="40" rx="18" ry="22" fill="none" stroke="currentColor" stroke-width="4.2"/><circle cx="50" cy="18" r="11" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="46" cy="16" r="2" fill="currentColor"/><circle cx="54" cy="16" r="2" fill="currentColor"/><polygon points="46,21 54,21 50,26" fill="currentColor"/><ellipse cx="40" cy="62" rx="6" ry="3" fill="none" stroke="currentColor" stroke-width="3.5"/><ellipse cx="60" cy="62" rx="6" ry="3" fill="none" stroke="currentColor" stroke-width="3.5"/>`,
  gear: `<circle cx="50" cy="36" r="12" fill="none" stroke="currentColor" stroke-width="4.2"/><line x1="50" y1="12" x2="50" y2="20" stroke="currentColor" stroke-width="4.5"/><line x1="50" y1="52" x2="50" y2="60" stroke="currentColor" stroke-width="4.5"/><line x1="26" y1="36" x2="34" y2="36" stroke="currentColor" stroke-width="4.5"/><line x1="66" y1="36" x2="74" y2="36" stroke="currentColor" stroke-width="4.5"/><line x1="33" y1="19" x2="39" y2="25" stroke="currentColor" stroke-width="4.2"/><line x1="61" y1="47" x2="67" y2="53" stroke="currentColor" stroke-width="4.2"/><line x1="67" y1="19" x2="61" y2="25" stroke="currentColor" stroke-width="4.2"/><line x1="39" y1="47" x2="33" y2="53" stroke="currentColor" stroke-width="4.2"/>`,
  terminal: `<rect x="14" y="12" width="72" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="26,26 38,36 26,46" fill="none" stroke="currentColor" stroke-width="4.2"/><line x1="44" y1="46" x2="64" y2="46" stroke="currentColor" stroke-width="4.2"/>`,
  clock: `<circle cx="50" cy="36" r="22" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="50,22 50,36 62,42" fill="none" stroke="currentColor" stroke-width="4"/>`,
  cgroup: `<rect x="14" y="14" width="72" height="44" rx="6" fill="none" stroke="currentColor" stroke-width="3.8"/><rect x="22" y="22" width="24" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><rect x="54" y="22" width="24" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/>`,
  whale: `<path d="M16,42 H76 C84,42 88,32 84,26 C78,26 74,30 72,34 H16 C16,50 30,58 48,58 C66,58 76,50 76,42 Z" fill="none" stroke="currentColor" stroke-width="4"/><rect x="26" y="22" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.4"/><rect x="38" y="22" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.4"/><rect x="50" y="22" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.4"/><rect x="38" y="10" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3.4"/>`,
  box3d: `<polygon points="50,10 82,25 82,53 50,66 18,53 18,25" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="18,25 50,39 82,25" fill="none" stroke="currentColor" stroke-width="3.6"/><line x1="50" y1="39" x2="50" y2="66" stroke="currentColor" stroke-width="3.6"/>`,
  layers: `<polygon points="50,10 84,24 50,38 16,24" fill="none" stroke="currentColor" stroke-width="4"/><polyline points="16,36 50,50 84,36" fill="none" stroke="currentColor" stroke-width="4"/><polyline points="16,48 50,62 84,48" fill="none" stroke="currentColor" stroke-width="4"/>`,
  wheel: `<polygon points="50,8 78,21 84,49 64,66 36,66 16,49 22,21" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="39" r="9" fill="none" stroke="currentColor" stroke-width="3.5"/><line x1="50" y1="8" x2="50" y2="30" stroke="currentColor" stroke-width="3"/><line x1="78" y1="21" x2="58" y2="34" stroke="currentColor" stroke-width="3"/><line x1="22" y1="21" x2="42" y2="34" stroke="currentColor" stroke-width="3"/><line x1="84" y1="49" x2="59" y2="42" stroke="currentColor" stroke-width="3"/><line x1="16" y1="49" x2="41" y2="42" stroke="currentColor" stroke-width="3"/>`,
  pod: `<rect x="22" y="16" width="56" height="40" rx="8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="38" cy="36" r="7" fill="none" stroke="currentColor" stroke-width="3.5"/><circle cx="62" cy="36" r="7" fill="none" stroke="currentColor" stroke-width="3.5"/>`,
  svc: `<circle cx="24" cy="36" r="7" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="76" cy="20" r="6" fill="none" stroke="currentColor" stroke-width="3.6"/><circle cx="76" cy="36" r="6" fill="none" stroke="currentColor" stroke-width="3.6"/><circle cx="76" cy="52" r="6" fill="none" stroke="currentColor" stroke-width="3.6"/><line x1="31" y1="36" x2="70" y2="20" stroke="currentColor" stroke-width="3.4"/><line x1="31" y1="36" x2="70" y2="36" stroke="currentColor" stroke-width="3.4"/><line x1="31" y1="36" x2="70" y2="52" stroke="currentColor" stroke-width="3.4"/>`,
  ingress: `<polyline points="14,36 44,36" fill="none" stroke="currentColor" stroke-width="4.2"/><polyline points="34,26 44,36 34,46" fill="none" stroke="currentColor" stroke-width="4"/><rect x="48" y="14" width="36" height="44" rx="5" fill="none" stroke="currentColor" stroke-width="4"/>`,
  disk: `<ellipse cx="50" cy="18" rx="26" ry="8" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24,18 V52 A26,8 0 0,0 76,52 V18" fill="none" stroke="currentColor" stroke-width="4"/>`,
  lock: `<rect x="28" y="32" width="44" height="30" rx="5" fill="none" stroke="currentColor" stroke-width="4"/><path d="M36,32 V22 A14,14 0 0,1 64,22 V32" fill="none" stroke="currentColor" stroke-width="4"/>`,
  mesh: `<circle cx="30" cy="22" r="6" fill="currentColor"/><circle cx="70" cy="22" r="6" fill="currentColor"/><circle cx="50" cy="54" r="6" fill="currentColor"/><polygon points="30,22 70,22 50,54" fill="none" stroke="currentColor" stroke-width="3.8"/><line x1="30" y1="22" x2="50" y2="38" stroke="currentColor" stroke-width="3"/><line x1="70" y1="22" x2="50" y2="38" stroke="currentColor" stroke-width="3"/>`,
  firewall: `<rect x="16" y="14" width="68" height="44" rx="4" fill="none" stroke="currentColor" stroke-width="4.2"/><line x1="16" y1="28" x2="84" y2="28" stroke="currentColor" stroke-width="3.5"/><line x1="16" y1="42" x2="84" y2="42" stroke="currentColor" stroke-width="3.5"/><line x1="50" y1="14" x2="50" y2="28" stroke="currentColor" stroke-width="3.5"/><line x1="34" y1="28" x2="34" y2="42" stroke="currentColor" stroke-width="3.5"/><line x1="66" y1="28" x2="66" y2="42" stroke="currentColor" stroke-width="3.5"/>`,
  router: `<circle cx="50" cy="36" r="22" fill="none" stroke="currentColor" stroke-width="4"/><line x1="50" y1="18" x2="50" y2="54" stroke="currentColor" stroke-width="3.6"/><line x1="32" y1="36" x2="68" y2="36" stroke="currentColor" stroke-width="3.6"/><polyline points="44,24 50,18 56,24" fill="none" stroke="currentColor" stroke-width="3.4"/><polyline points="62,30 68,36 62,42" fill="none" stroke="currentColor" stroke-width="3.4"/>`,
  globe: `<circle cx="50" cy="36" r="22" fill="none" stroke="currentColor" stroke-width="4"/><ellipse cx="50" cy="36" rx="10" ry="22" fill="none" stroke="currentColor" stroke-width="3.4"/><line x1="28" y1="36" x2="72" y2="36" stroke="currentColor" stroke-width="3.4"/>`,
  user: `<circle cx="50" cy="24" r="11" fill="none" stroke="currentColor" stroke-width="4.2"/><path d="M26,58 C26,42 74,42 74,58" fill="none" stroke="currentColor" stroke-width="4.2"/>`,
  browser: `<rect x="14" y="12" width="72" height="46" rx="5" fill="none" stroke="currentColor" stroke-width="4.2"/><line x1="14" y1="24" x2="86" y2="24" stroke="currentColor" stroke-width="3.5"/><circle cx="22" cy="18" r="2" fill="currentColor"/><circle cx="30" cy="18" r="2" fill="currentColor"/>`,
  mobile: `<rect x="32" y="8" width="36" height="54" rx="6" fill="none" stroke="currentColor" stroke-width="4.2"/><line x1="45" y1="55" x2="55" y2="55" stroke="currentColor" stroke-width="4"/>`,
  cloud: `<path d="M26,48 H74 A14,14 0 0,0 74,22 A18,18 0 0,0 36,20 A14,14 0 0,0 26,48 Z" fill="none" stroke="currentColor" stroke-width="4.2"/>`,
};

const linux = (id, name, defaultText, tags, svgBody, color = '#D97706') =>
  createDevOpsStencil({ id, name, category: 'Linux', badge: 'LINUX', color, defaultText, tags, svgBody });

const docker = (id, name, defaultText, tags, svgBody, color = '#2496ED') =>
  createDevOpsStencil({ id, name, category: 'Docker & Containers', badge: 'DOCKER', color, defaultText, tags, svgBody });

const k8s = (id, name, badge, defaultText, tags, svgBody, color = '#326CE5') =>
  createDevOpsStencil({ id, name, category: 'Kubernetes', badge, color, defaultText, tags, svgBody });

const net = (id, name, badge, defaultText, tags, svgBody, color = '#0D9488') =>
  createDevOpsStencil({ id, name, category: 'Networking', badge, color, defaultText, tags, svgBody });

export const DEVOPS_INFRA_STENCILS = [
  // Linux & OS
  linux('linux-kernel', 'Linux Kernel (Tux)', 'Linux Kernel', 'os tux kernel vmlinuz ubuntu rhel debian', I.tux, '#D97706'),
  linux('linux-systemd', 'systemd (PID 1)', 'systemd Unit', 'service daemon init systemctl target', I.gear, '#D97706'),
  linux('linux-bash', 'Bash / Shell Script', 'Bash Shell', 'terminal cli sh zsh script', I.terminal, '#334155'),
  linux('linux-cron', 'Cron / Timer', 'Cron Job', 'schedule crontab timer batch', I.clock, '#D97706'),
  linux('linux-cgroups', 'cgroups & Namespaces', 'cgroups / NS', 'isolation kernel resource limits', I.cgroup, '#D97706'),
  linux('linux-iptables', 'iptables / nftables / eBPF', 'netfilter / eBPF', 'packet filter firewall kernel nat', I.firewall, '#B45309'),
  linux('linux-sshd', 'OpenSSH / SSHD', 'SSH Bastion', 'ssh remote access port 22 key', I.lock, '#334155'),
  linux('linux-fs', 'Filesystem / LVM', 'Mount / ext4 / XFS', 'disk mount volume inode storage', I.disk, '#D97706'),
  linux('linux-pkg', 'Package Manager (apt/dnf)', 'Package Repo', 'apt yum dnf rpm deb package', I.box3d, '#D97706'),

  // Docker & Containers
  docker('docker-engine', 'Docker Engine', 'Docker Engine', 'whale daemon dockerd runtime', I.whale, '#2496ED'),
  docker('docker-container', 'Container Instance', 'Container', 'app container workload oci', I.box3d, '#2496ED'),
  docker('docker-image', 'Dockerfile / Image', 'OCI Image', 'dockerfile layers build image', I.layers, '#0284C7'),
  docker('docker-compose', 'Docker Compose', 'Compose Stack', 'multi-container compose yaml', I.cgroup, '#2496ED'),
  docker('docker-registry', 'Container Registry', 'OCI Registry', 'dockerhub ecr acr gcr harbor ghcr', I.disk, '#0284C7'),
  docker('docker-containerd', 'containerd / CRI', 'containerd', 'runtime cri runc oci', I.gear, '#334155'),
  docker('docker-podman', 'Podman', 'Podman Engine', 'rootless daemonless container', I.box3d, '#892CA0'),
  docker('docker-helm', 'Helm Chart', 'Helm Release', 'kubernetes package manager chart tiller', I.wheel, '#0F1689'),

  // Kubernetes (preserving all existing k8s-* IDs + new control plane icons)
  k8s('k8s-cluster', 'Kubernetes Cluster', 'CLUSTER', 'K8s Cluster', 'kubernetes cluster control plane', I.wheel),
  k8s('k8s-node', 'Worker / Control Node', 'NODE', 'K8s Node', 'kubelet worker master vm node', I.cgroup),
  k8s('k8s-ns', 'Namespace', 'NS', 'Namespace', 'virtual cluster scope quota', I.layers),
  k8s('k8s-pod', 'Pod', 'POD', 'Pod', 'container group workload', I.pod),
  k8s('k8s-deploy', 'Deployment', 'DEPLOY', 'Deployment', 'replicaset rollout stateless', I.layers),
  k8s('k8s-sts', 'StatefulSet', 'STS', 'StatefulSet', 'stateful ordered sticky identity', I.disk),
  k8s('k8s-ds', 'DaemonSet', 'DS', 'DaemonSet', 'node agent log collector', I.pod),
  k8s('k8s-svc', 'Service (ClusterIP/LB)', 'SVC', 'Service', 'clusterip nodeport loadbalancer kube-proxy', I.svc),
  k8s('k8s-ing', 'Ingress', 'ING', 'Ingress', 'http routing tls ingress controller', I.ingress),
  k8s('k8s-cm', 'ConfigMap', 'CM', 'ConfigMap', 'configuration env properties', I.terminal),
  k8s('k8s-secret', 'Secret', 'SECRET', 'Secret', 'credentials tls token base64', I.lock),
  k8s('k8s-pvc', 'PersistentVolumeClaim', 'PVC', 'PVC Storage', 'volume storage csi pv pvc', I.disk),
  k8s('k8s-hpa', 'HorizontalPodAutoscaler', 'HPA', 'HPA Autoscaler', 'autoscale cpu memory replicas', I.gear),
  k8s('k8s-job', 'Job / CronJob', 'JOB', 'Batch Job', 'batch cronjob run to completion', I.clock),
  k8s('k8s-apigw', 'API Gateway', 'API-GW', 'API Gateway', 'gateway api httproute north-south', I.ingress),
  k8s('k8s-mesh', 'Service Mesh (Istio)', 'MESH', 'Service Mesh', 'istio linkerd envoy sidecar mtls', I.mesh),
  k8s('k8s-etcd', 'etcd Store', 'ETCD', 'etcd Quorum', 'raft key value cluster state', I.disk),
  k8s('k8s-apiserver', 'kube-apiserver', 'API', 'kube-apiserver', 'control plane rest api admission', I.wheel),

  // Networking (preserving all existing net-* IDs + DevOps proxy/mesh/network tools)
  net('net-lb', 'Load Balancer', 'LB', 'Load Balancer', 'l4 l7 alb nlb traffic distribution', I.svc, '#0D9488'),
  net('net-nginx', 'NGINX Reverse Proxy', 'NGINX', 'NGINX Proxy', 'web server reverse proxy ingress', I.ingress, '#009639'),
  net('net-envoy', 'Envoy Proxy', 'ENVOY', 'Envoy Proxy', 'sidecar service proxy l7 xds', I.mesh, '#AC6199'),
  net('net-haproxy', 'HAProxy', 'HAPROXY', 'HAProxy LB', 'tcp http high availability load balancer', I.svc, '#0284C7'),
  net('net-firewall', 'Firewall / WAF', 'FW', 'WAF / Firewall', 'security acl security group filtering', I.firewall, '#DC2626'),
  net('net-dns', 'DNS / CoreDNS', 'DNS', 'CoreDNS / DNS', 'domain name resolution a cname record', I.globe, '#0D9488'),
  net('net-vpn', 'VPN / WireGuard', 'VPN', 'VPN Tunnel', 'ipsec wireguard encrypted tunnel', I.lock, '#0D9488'),
  net('net-subnet', 'Subnet / CIDR', 'SUBNET', 'Private Subnet', 'cidr vlan network segment', I.cgroup, '#0D9488'),
  net('net-router', 'Router / BGP', 'ROUTER', 'BGP Router', 'routing table ospf bgp gateway', I.router, '#0D9488'),
  net('net-nat', 'NAT Gateway', 'NAT', 'NAT Gateway', 'egress masquerade outbound ip', I.ingress, '#0D9488'),
  net('net-cdn', 'Edge CDN', 'CDN', 'Edge CDN', 'cloudflare fastly akamai cache', I.globe, '#F59E0B'),
  net('net-tls', 'TLS / mTLS Cert', 'TLS', 'TLS Certificate', 'https ssl x509 cert-manager', I.lock, '#059669'),
  net('net-user', 'User / Client', 'USER', 'Client User', 'end user actor customer', I.user, '#475569'),
  net('net-browser', 'Web Browser', 'WEB', 'Web Browser', 'spa frontend client http', I.browser, '#2563EB'),
  net('net-mobile', 'Mobile App', 'MOBILE', 'Mobile App', 'ios android client app', I.mobile, '#7C3AED'),
  net('net-internet', 'Public Internet', 'WAN', 'Public Internet', 'wan cloud internet external', I.cloud, '#0284C7'),
];
