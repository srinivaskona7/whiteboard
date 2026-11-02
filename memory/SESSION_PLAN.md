# Session Plan: DevOps Architecture Library, Smart Connectors, Live Classroom & UI Polish

## User Requirements & Scope
1. **Comprehensive, Searchable DevOps Icon Library**:
   - Professionally designed DevOps icons covering:
     1. **AWS** (EC2, S3, Lambda, RDS, EKS, ECS, Fargate, VPC, IAM, Route 53, CloudFront, API Gateway, SQS, SNS, DynamoDB, CloudWatch, ALB)
     2. **Azure** (Virtual Machines, AKS, Functions, Blob Storage, Azure SQL, Cosmos DB, Virtual Network, Entra ID, App Service, Application Gateway, Key Vault, Service Bus, Azure Monitor)
     3. **GCP** (Compute Engine, GKE, Cloud Run, Cloud Functions, Cloud Storage, Cloud SQL, BigQuery, VPC Network, Cloud IAM, Pub/Sub, Cloud Load Balancing, Cloud Armor)
     4. **Linux** (Linux Kernel / Tux, systemd, Bash / Shell, Cron, cgroups / Namespaces, iptables / nftables, SSHD, Filesystem / LVM, Package Manager)
     5. **Docker & Containers** (Docker Engine, Container, Dockerfile / Image, Docker Compose, Container Registry / OCI, containerd, Podman, Helm)
     6. **Kubernetes** (Cluster, Node, Namespace, Pod, Deployment, StatefulSet, DaemonSet, ReplicaSet, Service, Ingress, ConfigMap, Secret, PVC, PV, HPA, Job / CronJob, Service Mesh / Istio, etcd, kube-apiserver, kubelet)
     7. **Networking** (Load Balancer, NGINX / Reverse Proxy, Envoy, HAProxy, Firewall / WAF, DNS / CoreDNS, VPN / WireGuard, Subnet / CIDR, Router / BGP, NAT Gateway, CDN, API Gateway, mTLS / Cert, User, Browser, Mobile, Internet)
     8. **Git & Source Control** (Git, GitHub, GitLab, Bitbucket, Gitea, Pull Request / Merge, Branch / Tag)
     9. **CI/CD & GitOps** (GitHub Actions, GitLab CI, Jenkins, Argo CD, Flux CD, Tekton, Build Pipeline, Artifact Repo)
     10. **Infrastructure as Code (IaC)** (Terraform, OpenTofu, Pulumi, CloudFormation, Crossplane, Packer)
     11. **Configuration Management** (Ansible, Puppet, Chef, SaltStack, Cloud-Init)
     12. **Monitoring & Logging** (Prometheus, Grafana, OpenTelemetry, Elasticsearch, Kibana, Loki, Fluent Bit / Fluentd, Jaeger / Tempo, Datadog, Alertmanager / PagerDuty)
     13. **Security & Governance** (HashiCorp Vault, Trivy Scanner, OPA / Kyverno, Falco, Let's Encrypt / PKI, OAuth2 / OIDC, WAF / Shield, Secret Manager, SIEM)
     14. **Databases, Storage & Messaging** (PostgreSQL, MySQL, MongoDB, Redis, Cassandra, Apache Kafka, RabbitMQ, NATS, MinIO / Object Store, Block / NFS Storage, Consul)
   - Official brand colors and recognizable vector silhouettes where permitted, paired with a consistent visual card + vector glyph style on both Canvas and SVG export.
   - Searchable by name, category, badge, or keyword tags, with category filter chips.
2. **Drag-and-Drop Single Icons + Multi-Select Bulk Insertion + Resize, Label, Group, Align & Arrange**:
   - Drag and drop individual icons onto exact canvas coordinates, or click to insert.
   - Multi-select checkboxes/mode in the Library Panel allowing teachers to select multiple icons across categories and insert them together as a Grid, Horizontal Row, Vertical Stack, or Connected Architecture Flow without overlapping existing diagram elements.
   - Support 8-handle resizing for both individual elements and multi-element / grouped selections, with accurate grid snapping and aspect ratio handling.
   - Provide 1-click Arrange tools (Row, Column, Grid, Auto-Connect Flow) alongside Align, Distribute, Group/Ungroup, and inline/inspector labeling.
3. **Connectors: Solid, Dashed, Dotted + Colors, Thickness, Arrowheads, Labels, Snapping & Routing**:
   - Support `solid`, `dashed`, and `dotted` connectors with configurable stroke color, thickness, start/end arrowheads (`none`, `arrow`, `triangle`, `diamond`, `circle`, `bar`), and inline/inspector text labels.
   - Snap connectors to component ports OR anywhere on component bodies (auto-resolving nearest port), remain attached when components move, resize, rotate, align, or arrange, and offer Straight, Curved, and Right-Angle (`orthogonal`) routing.
4. **App Refinements & Bug Fixes**:
   - Fix selection & resizing bugs (west/north handle grid snap drift, multi-select bounding box resize, connector binding updates during align/distribute/arrange/group-resize).
   - Prevent overlapping imports for templates, diagram packs, Mermaid diagrams, and multi-icon insertions using `computeNonOverlappingOrigin`.
   - Fix text wrapping & spacing (`wrapShapeTextLines` width calculation so short labels like `"Hello <World>"` don't split prematurely; crisp badge/icon/label spacing on DevOps cards).
   - Simplify toolbars, repair mobile layouts (`390 × 844`), and make drawing, dragging, zooming, and connecting smooth and precise.
5. **Shareable Classroom Links, Student Join with Name, Component Pointing, and Location-Attached Questions**:
   - Shareable classroom links (`#classroom=1&...&scene=...`) so students can join with their names.
   - Students can point/ping specific components or coordinates on the board (rendering a live named pointer beacon on the component/board and syncing via `BroadcastChannel` + URL state).
   - Students can attach questions (`question` pins) to exact locations or specific components on the board; pins move with their attached component, display student name & question badge on the canvas, and appear in an interactive Classroom Q&A panel where teachers/students can jump to the exact component/location, reply, and mark resolved.
6. **Unique Logo & Polished Live-Teaching Identity**:
   - Custom multi-layered SVG StudioBoard logo in top bar and document favicon, refined theme tokens, and polished teaching controls.

## Step-by-Step Execution Checklist
- [x] Step 1: Audit codebase, run baseline unit tests, and record checklist in `memory/SESSION_PLAN.md`.
- [x] Step 2: Create `stencils/card.js` and the comprehensive DevOps icon library (`stencils/devops-cloud.js`, `stencils/devops-infra.js`, `stencils/devops-cicd.js`, `stencils/devops-data-sec.js`) with 140+ searchable icons, brand colors, and Canvas `Path2D`/SVG rendering, and wire into `stencils/index.js`.
- [x] Step 3: Upgrade `ui/library-panel.js` with keyword/category search, category filter chips, drag-and-drop placement, and Multi-Select Icon Tray ("Insert Grid", "Insert Row", "Insert Connected Flow") with non-overlapping placement.
- [x] Step 4: Refine selection, single & multi-element resizing (`tools/select.js`, `scene/hit.js`, `scene/geometry.js`, `render/canvas.js`), smart connector snapping & routing (`tools/connector.js`, `scene/bindings.js`, `scene/routing.js`), text spacing (`scene/model.js`, `render/shapes.js`), and Inspector arrangement/connector controls (`ui/props-panel.js`).
- [x] Step 5: Implement `ui/classroom.js` for Shareable Classroom Links, Student Name Join, Component Pointer/Ping tool, and Location/Component-Attached Question Pins + Q&A Drawer, integrated with `main.js`, `render/canvas.js`, `ui/toolbar.js`, and `ui/dialogs.js`.
- [x] Step 6: Complete brand identity (unique SVG logo, favicon, simplified toolbar, mobile layout polish in `index.html` and `styles.css`) while keeping all modules under 600 lines.
- [x] Step 7: Expand `tests/scene.test.js` to cover the DevOps icon catalog, multi-select insertion, multi-element resize, connector snapping/routing, text wrapping, and classroom question/pointer features; verify `npm test` and `npm run build` pass with zero errors.
