// stencils/kubernetes.js

function createK8sStencil(id, name, badge, defaultText, iconGlyph) {
  return {
    id,
    name,
    category: 'Kubernetes',
    defaultW: 145,
    defaultH: 96,
    defaultText,
    badge,
    iconSvg: `<svg viewBox="0 0 100 70"><polygon points="50,5 90,22 80,62 20,62 10,22" fill="none" stroke="currentColor" stroke-width="4.5"/>${iconGlyph}</svg>`,
    draw(ctx, x, y, w, h) {
      // Rounded card with original heptagon Kubernetes-style badge in top-left
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();

      // Draw mini heptagon wheel in top-left corner
      const bx = x + 22;
      const by = y + 20;
      const r = 11;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const ang = (i * 2 * Math.PI) / 7 - Math.PI / 2;
        const px = bx + r * Math.cos(ang);
        const py = by + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.save();
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(badge, x + 38, y + 20);
      ctx.restore();
    },
    toSvg(x, y, w, h, attrs) {
      const bx = x + 22;
      const by = y + 20;
      const r = 11;
      const pts = [];
      for (let i = 0; i < 7; i++) {
        const ang = (i * 2 * Math.PI) / 7 - Math.PI / 2;
        pts.push(`${(bx + r * Math.cos(ang)).toFixed(1)},${(by + r * Math.sin(ang)).toFixed(1)}`);
      }
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ${attrs}/><polygon points="${pts.join(' ')}" fill="none" ${attrs}/><text x="${x + 38}" y="${y + 23}" font-family="sans-serif" font-size="10" font-weight="bold" fill="currentColor">${badge}</text>`;
    },
  };
}

export const KUBERNETES_STENCILS = [
  createK8sStencil(
    'k8s-cluster',
    'Cluster',
    'CLUSTER',
    'k8s-cluster',
    `<circle cx="50" cy="36" r="11" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-node',
    'Node',
    'NODE',
    'worker-node-1',
    `<rect x="34" y="25" width="32" height="22" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-namespace',
    'Namespace',
    'NS',
    'ns: production',
    `<rect x="32" y="24" width="36" height="24" stroke-dasharray="4,3" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-pod',
    'Pod',
    'POD',
    'app-pod',
    `<rect x="36" y="26" width="28" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-deployment',
    'Deployment',
    'DEPLOY',
    'api-deploy',
    `<path d="M35,42 H65 M50,24 V48" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-service',
    'Service',
    'SVC',
    'ClusterIP :80',
    `<path d="M34,44 L50,24 L66,44" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-ingress',
    'Ingress',
    'ING',
    'ingress-nginx',
    `<path d="M28,36 H68 M56,26 L68,36 L56,46" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-configmap',
    'ConfigMap',
    'CM',
    'app-config',
    `<line x1="36" y1="30" x2="64" y2="30" stroke="currentColor" stroke-width="4"/><line x1="36" y1="42" x2="64" y2="42" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-secret',
    'Secret',
    'SECRET',
    'tls-secret',
    `<rect x="38" y="34" width="24" height="16" fill="none" stroke="currentColor" stroke-width="4"/><path d="M43,34 V28 A7,7 0 0,1 57,28 V34" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-pvc',
    'PVC',
    'PVC',
    'data-pvc 20Gi',
    `<ellipse cx="50" cy="28" rx="16" ry="6" fill="none" stroke="currentColor" stroke-width="4"/><path d="M34,28 V44 A16,6 0 0,0 66,44 V28" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-hpa',
    'HPA',
    'HPA',
    'HPA (2..10)',
    `<path d="M32,36 H68 M38,28 L30,36 L38,44 M62,28 L70,36 L62,44" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-job',
    'Job',
    'JOB',
    'batch-job',
    `<polyline points="36,36 46,46 64,26" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-api-gateway',
    'API Gateway',
    'GW',
    'API Gateway',
    `<path d="M36,24 V48 M64,24 V48 M36,36 H64" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
  createK8sStencil(
    'k8s-service-mesh',
    'Service Mesh',
    'MESH',
    'Service Mesh',
    `<circle cx="40" cy="30" r="4" fill="currentColor"/><circle cx="60" cy="30" r="4" fill="currentColor"/><circle cx="50" cy="46" r="4" fill="currentColor"/><polygon points="40,30 60,30 50,46" fill="none" stroke="currentColor" stroke-width="3.5"/>`
  ),
];
