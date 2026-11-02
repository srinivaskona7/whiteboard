// templates/index.js
import { createElement } from '../scene/model.js';
import { bindConnectorEndpoint } from '../scene/bindings.js';
import { buildDevOpsDiagramPacks } from '../ui/registry.js';

const DEVOPS_PACK_TEMPLATES = [
  {
    id: 'tpl-linux-boot',
    packId: 'pack-linux-boot',
    name: 'Linux Boot Sequence',
    description: 'Progressive 4-step reveal: BIOS/UEFI → GRUB2 → Kernel + initramfs → systemd (PID 1)',
    frameTitle: 'Lesson: Linux Boot Process',
    teacherNotes: 'Step 1: POST & UEFI firmware. Step 2: GRUB2 loads vmlinuz. Step 3: initramfs mounts rootfs. Step 4: systemd starts default.target.',
  },
  {
    id: 'tpl-dns-resolution',
    packId: 'pack-dns-flow',
    name: 'DNS Resolution Hierarchy',
    description: 'Recursive lookup across Stub Resolver, Recursive ISP Resolver, Root (.), TLD (.com), and Authoritative NS',
    frameTitle: 'Lesson: DNS Recursive Resolution',
    teacherNotes: 'Highlight caching TTL at the recursive resolver after step 4 completes.',
  },
  {
    id: 'tpl-tcp-tls',
    packId: 'pack-tcp-tls',
    name: 'TCP 3-Way + TLS 1.3 Handshake',
    description: 'Step-by-step packet walkthrough of SYN, SYN-ACK, ACK + ClientHello, and 1-RTT TLS 1.3',
    frameTitle: 'Lesson: TCP & TLS 1.3 Handshake',
    teacherNotes: 'Compare TLS 1.2 (2-RTT) vs TLS 1.3 (1-RTT key share in ClientHello).',
  },
  {
    id: 'tpl-docker-lifecycle',
    packId: 'pack-docker-lifecycle',
    name: 'Docker Image & Container Lifecycle',
    description: 'Dockerfile → OCI layered image build → Container Registry → containerd runtime execution',
    frameTitle: 'Lesson: Container Build & Runtime Lifecycle',
    teacherNotes: 'Explain copy-on-write (OverlayFS) between read-only image layers and the writable container layer.',
  },
  {
    id: 'tpl-cicd-gitops',
    packId: 'pack-cicd-gitops',
    name: 'CI/CD & GitOps Delivery Pipeline',
    description: 'Git commit → GitHub Actions CI → Signed OCI Registry → Argo CD Kubernetes reconciliation',
    frameTitle: 'Lesson: CI/CD & Pull-Based GitOps',
    teacherNotes: 'Contrast push-based CI deployment with pull-based Argo CD drift reconciliation.',
  },
  {
    id: 'tpl-cloud-network',
    packId: 'pack-cloud-network',
    name: 'Cloud Network Architecture (VPC HA)',
    description: 'Route 53 DNS → Public ALB → Private EC2 Compute Tier → Multi-AZ RDS Database',
    frameTitle: 'Lesson: High-Availability Cloud VPC',
    teacherNotes: 'Discuss Security Group chaining: ALB SG allows 443 from 0.0.0.0/0; App SG allows 8080 only from ALB SG.',
  },
  {
    id: 'tpl-monitoring-incident',
    packId: 'pack-monitoring-incident',
    name: 'Monitoring & Incident Response',
    description: 'OpenTelemetry Collector → Prometheus TSDB → Grafana SLO Dashboard → On-Call Pager & Runbook',
    frameTitle: 'Lesson: Observability & Incident Response',
    teacherNotes: 'Walk through Golden Signals (Latency, Traffic, Errors, Saturation) and error budget burn alerts.',
  },
].map((spec) => ({
  id: spec.id,
  name: spec.name,
  description: spec.description,
  category: 'devops-lesson',
  build() {
    const packs = buildDevOpsDiagramPacks();
    const found = packs.find((p) => p.id === spec.packId);
    const frame = createElement('frame', {
      x: 40,
      y: 60,
      w: 840,
      h: 320,
      text: spec.frameTitle,
      slideOrder: 1,
      teacherNotes: spec.teacherNotes,
    });
    const inner = found ? found.build() : [];
    return [frame, ...inner];
  },
}));

export const BUILTIN_TEMPLATES = [
  ...DEVOPS_PACK_TEMPLATES,
  {
    id: 'tpl-blank',
    name: 'Blank Canvas',
    description: 'Clean slate with grid snapping',
    build() {
      return [];
    },
  },
  {
    id: 'tpl-kanban',
    name: 'Kanban Board',
    description: 'To Do, In Progress, and Done columns with sticky notes',
    build() {
      const f1 = createElement('frame', { x: 80, y: 80, w: 300, h: 460, text: 'To Do', slideOrder: 1 });
      const f2 = createElement('frame', { x: 410, y: 80, w: 300, h: 460, text: 'In Progress', slideOrder: 2 });
      const f3 = createElement('frame', { x: 740, y: 80, w: 300, h: 460, text: 'Done', slideOrder: 3 });
      const s1 = createElement('sticky', { x: 110, y: 150, w: 240, h: 120, text: 'Lesson Hook & Warm-up', fill: '#fef08a' });
      const s2 = createElement('sticky', { x: 110, y: 290, w: 240, h: 120, text: 'Group Lab Activity', fill: '#bfdbfe' });
      const s3 = createElement('sticky', { x: 440, y: 150, w: 240, h: 120, text: 'Guided Walkthrough', fill: '#bbf7d0' });
      const s4 = createElement('sticky', { x: 770, y: 150, w: 240, h: 120, text: 'Syllabus Overview', fill: '#fbcfe8' });
      return [f1, f2, f3, s1, s2, s3, s4];
    },
  },
  {
    id: 'tpl-mindmap',
    name: 'Mind Map',
    description: 'Central concept connected to 4 topic branches',
    build() {
      const center = createElement('rounded-rect', {
        x: 420,
        y: 240,
        w: 200,
        h: 90,
        text: 'Central Topic',
        fill: '#dbeafe',
        stroke: '#1d4ed8',
        roundness: 24,
      });
      const b1 = createElement('rounded-rect', { x: 120, y: 100, w: 170, h: 72, text: 'Key Idea 1', fill: '#fef9c3' });
      const b2 = createElement('rounded-rect', { x: 750, y: 100, w: 170, h: 72, text: 'Key Idea 2', fill: '#dcfce7' });
      const b3 = createElement('rounded-rect', { x: 120, y: 390, w: 170, h: 72, text: 'Examples', fill: '#fce7f3' });
      const b4 = createElement('rounded-rect', { x: 750, y: 390, w: 170, h: 72, text: 'Questions', fill: '#f3e8ff' });
      const arrows = [
        [center, 'left', b1, 'right'],
        [center, 'right', b2, 'left'],
        [center, 'left', b3, 'right'],
        [center, 'right', b4, 'left'],
      ].map(([s, sp, e, ep]) => {
        const a = createElement('arrow', { routing: 'curved', endArrow: 'arrow' });
        bindConnectorEndpoint(a, 'start', s, sp);
        bindConnectorEndpoint(a, 'end', e, ep);
        return a;
      });
      return [center, b1, b2, b3, b4, ...arrows];
    },
  },
  {
    id: 'tpl-flowchart',
    name: 'Flowchart Starter',
    description: 'Start, process, decision, and outcome nodes',
    build() {
      const n1 = createElement('stencil', { stencilId: 'flow-terminator', x: 420, y: 60, w: 160, h: 66, text: 'Start', fill: '#dcfce7' });
      const n2 = createElement('stencil', { stencilId: 'flow-process', x: 420, y: 180, w: 160, h: 80, text: 'Read Input', fill: '#f8fafc' });
      const n3 = createElement('stencil', { stencilId: 'flow-decision', x: 410, y: 320, w: 180, h: 110, text: 'Valid?', fill: '#fef9c3' });
      const n4 = createElement('stencil', { stencilId: 'flow-process', x: 420, y: 490, w: 160, h: 80, text: 'Save Record', fill: '#dbeafe' });
      const n5 = createElement('stencil', { stencilId: 'flow-process', x: 680, y: 335, w: 160, h: 80, text: 'Show Error', fill: '#fee2e2' });

      const a1 = createElement('arrow', { routing: 'orthogonal' });
      bindConnectorEndpoint(a1, 'start', n1, 'bottom');
      bindConnectorEndpoint(a1, 'end', n2, 'top');

      const a2 = createElement('arrow', { routing: 'orthogonal' });
      bindConnectorEndpoint(a2, 'start', n2, 'bottom');
      bindConnectorEndpoint(a2, 'end', n3, 'top');

      const a3 = createElement('arrow', { routing: 'orthogonal', text: 'Yes' });
      bindConnectorEndpoint(a3, 'start', n3, 'bottom');
      bindConnectorEndpoint(a3, 'end', n4, 'top');

      const a4 = createElement('arrow', { routing: 'orthogonal', text: 'No' });
      bindConnectorEndpoint(a4, 'start', n3, 'right');
      bindConnectorEndpoint(a4, 'end', n5, 'left');

      return [n1, n2, n3, n4, n5, a1, a2, a3, a4];
    },
  },
  {
    id: 'tpl-k8s',
    name: 'Kubernetes Architecture Starter',
    description: 'Ingress, Service, Deployment, Pods, and PVC inside a Cluster frame',
    build() {
      const cluster = createElement('frame', { x: 100, y: 70, w: 860, h: 460, text: 'Kubernetes Cluster (prod-ns)', slideOrder: 1 });
      const ing = createElement('stencil', { stencilId: 'k8s-ingress', x: 150, y: 230, w: 150, h: 96, text: 'Ingress', fill: '#f0fdf4' });
      const svc = createElement('stencil', { stencilId: 'k8s-service', x: 370, y: 230, w: 150, h: 96, text: 'API Service', fill: '#eff6ff' });
      const pod1 = createElement('stencil', { stencilId: 'k8s-pod', x: 600, y: 140, w: 150, h: 96, text: 'api-pod-1', fill: '#eff6ff' });
      const pod2 = createElement('stencil', { stencilId: 'k8s-pod', x: 600, y: 310, w: 150, h: 96, text: 'api-pod-2', fill: '#eff6ff' });
      const pvc = createElement('stencil', { stencilId: 'k8s-pvc', x: 790, y: 230, w: 145, h: 96, text: 'data-pvc', fill: '#fefce8' });

      const c1 = createElement('arrow', { routing: 'orthogonal' });
      bindConnectorEndpoint(c1, 'start', ing, 'right');
      bindConnectorEndpoint(c1, 'end', svc, 'left');

      const c2 = createElement('arrow', { routing: 'orthogonal' });
      bindConnectorEndpoint(c2, 'start', svc, 'right');
      bindConnectorEndpoint(c2, 'end', pod1, 'left');

      const c3 = createElement('arrow', { routing: 'orthogonal' });
      bindConnectorEndpoint(c3, 'start', svc, 'right');
      bindConnectorEndpoint(c3, 'end', pod2, 'left');

      const c4 = createElement('arrow', { routing: 'orthogonal', strokeStyle: 'dashed' });
      bindConnectorEndpoint(c4, 'start', pod1, 'right');
      bindConnectorEndpoint(c4, 'end', pvc, 'top');

      return [cluster, ing, svc, pod1, pod2, pvc, c1, c2, c3, c4];
    },
  },
  {
    id: 'tpl-sequence',
    name: 'Sequence Diagram Starter',
    description: 'Client, API Gateway, and Database lifelines with request/response messages',
    build() {
      const p1 = createElement('rounded-rect', { x: 140, y: 80, w: 140, h: 56, text: 'Client', fill: '#eff6ff' });
      const p2 = createElement('rounded-rect', { x: 420, y: 80, w: 140, h: 56, text: 'API Server', fill: '#eff6ff' });
      const p3 = createElement('rounded-rect', { x: 700, y: 80, w: 140, h: 56, text: 'Database', fill: '#eff6ff' });
      const l1 = createElement('line', { x: 210, y: 136, x2: 210, y2: 460, strokeStyle: 'dashed', routing: 'straight' });
      const l2 = createElement('line', { x: 490, y: 136, x2: 490, y2: 460, strokeStyle: 'dashed', routing: 'straight' });
      const l3 = createElement('line', { x: 770, y: 136, x2: 770, y2: 460, strokeStyle: 'dashed', routing: 'straight' });
      const m1 = createElement('arrow', { x: 210, y: 200, x2: 490, y2: 200, text: 'GET /items', routing: 'straight' });
      const m2 = createElement('arrow', { x: 490, y: 270, x2: 770, y2: 270, text: 'SELECT * FROM items', routing: 'straight' });
      const m3 = createElement('arrow', { x: 770, y: 340, x2: 490, y2: 340, text: 'rows[]', routing: 'straight', strokeStyle: 'dashed' });
      const m4 = createElement('arrow', { x: 490, y: 400, x2: 210, y2: 400, text: '200 OK (JSON)', routing: 'straight', strokeStyle: 'dashed' });
      return [p1, p2, p3, l1, l2, l3, m1, m2, m3, m4];
    },
  },
  {
    id: 'tpl-kwl',
    name: 'KWL Chart',
    description: 'What I Know, What I Want to Know, What I Learned',
    build() {
      const k = createElement('frame', { x: 80, y: 80, w: 300, h: 440, text: 'K — What I Know', slideOrder: 1 });
      const w = createElement('frame', { x: 400, y: 80, w: 300, h: 440, text: 'W — What I Want to Know', slideOrder: 2 });
      const l = createElement('frame', { x: 720, y: 80, w: 300, h: 440, text: 'L — What I Learned', slideOrder: 3 });
      const n1 = createElement('sticky', { x: 110, y: 150, w: 240, h: 110, text: 'Prior knowledge item...', fill: '#fef08a' });
      const n2 = createElement('sticky', { x: 430, y: 150, w: 240, h: 110, text: 'Curious question...', fill: '#bfdbfe' });
      const n3 = createElement('sticky', { x: 750, y: 150, w: 240, h: 110, text: 'Key takeaway...', fill: '#bbf7d0' });
      return [k, w, l, n1, n2, n3];
    },
  },
  {
    id: 'tpl-venn',
    name: 'Venn Diagram',
    description: 'Two overlapping circles for comparing concepts',
    build() {
      const c1 = createElement('ellipse', {
        x: 180,
        y: 110,
        w: 380,
        h: 360,
        text: `Concept A


`,
        fill: 'rgba(59, 130, 246, 0.16)',
        stroke: '#2563eb',
      });
      const c2 = createElement('ellipse', {
        x: 420,
        y: 110,
        w: 380,
        h: 360,
        text: `Concept B


`,
        fill: 'rgba(234, 179, 8, 0.18)',
        stroke: '#ca8a04',
      });
      const both = createElement('text', {
        x: 445,
        y: 270,
        w: 100,
        h: 40,
        text: 'Shared',
        textAlign: 'center',
      });
      return [c1, c2, both];
    },
  },
  {
    id: 'tpl-2x2',
    name: '2x2 Matrix',
    description: 'Four-quadrant prioritization / analysis matrix',
    build() {
      const q1 = createElement('rect', { x: 180, y: 90, w: 300, h: 210, text: 'High Impact / Low Effort', fill: '#dcfce7' });
      const q2 = createElement('rect', { x: 480, y: 90, w: 300, h: 210, text: 'High Impact / High Effort', fill: '#dbeafe' });
      const q3 = createElement('rect', { x: 180, y: 300, w: 300, h: 210, text: 'Low Impact / Low Effort', fill: '#fef9c3' });
      const q4 = createElement('rect', { x: 480, y: 300, w: 300, h: 210, text: 'Low Impact / High Effort', fill: '#fee2e2' });
      return [q1, q2, q3, q4];
    },
  },
  {
    id: 'tpl-number-line',
    name: 'Number Line',
    description: 'Interactive classroom number line (-5 to +5)',
    build() {
      return [
        createElement('stencil', {
          stencilId: 'math-number-line',
          x: 160,
          y: 240,
          w: 680,
          h: 90,
          text: '',
        }),
      ];
    },
  },
  {
    id: 'tpl-axes',
    name: 'Coordinate Axes',
    description: '2D Cartesian coordinate plane with grid snapping',
    build() {
      return [
        createElement('stencil', {
          stencilId: 'math-axes',
          x: 240,
          y: 80,
          w: 480,
          h: 480,
          text: '',
        }),
      ];
    },
  },
];

export function getTemplateById(id) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) || BUILTIN_TEMPLATES[0];
}
