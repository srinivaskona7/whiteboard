// stencils/cloud.js

function createCardStencil(id, name, category, badge, defaultText, iconInner) {
  return {
    id,
    name,
    category,
    defaultW: 145,
    defaultH: 92,
    defaultText,
    badge,
    iconSvg: `<svg viewBox="0 0 100 70">${iconInner}</svg>`,
    draw(ctx, x, y, w, h) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fillText(badge, x + 10, y + 8);
      ctx.restore();
    },
    toSvg(x, y, w, h, attrs) {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ${attrs}/><text x="${x + 10}" y="${y + 18}" font-family="sans-serif" font-size="10" font-weight="bold" fill="currentColor">${badge}</text>`;
    },
  };
}

export const CLOUD_STENCILS = [
  createCardStencil(
    'cloud-server',
    'Server',
    'Cloud & Network',
    'SRV',
    'App Server',
    `<rect x="14" y="12" width="72" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="4.5"/><rect x="14" y="38" width="72" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="4.5"/><circle cx="24" cy="21" r="2.5" fill="currentColor"/><circle cx="24" cy="47" r="2.5" fill="currentColor"/>`
  ),
  createCardStencil(
    'cloud-database',
    'Cloud Database',
    'Cloud & Network',
    'DB',
    'Primary DB',
    `<ellipse cx="50" cy="18" rx="30" ry="9" fill="none" stroke="currentColor" stroke-width="4.5"/><path d="M20,18 V50 A30,9 0 0,0 80,50 V18" fill="none" stroke="currentColor" stroke-width="4.5"/>`
  ),
  createCardStencil(
    'cloud-queue',
    'Message Queue',
    'Cloud & Network',
    'QUEUE',
    'Event Queue',
    `<rect x="12" y="20" width="76" height="30" rx="15" fill="none" stroke="currentColor" stroke-width="4.5"/><line x1="36" y1="20" x2="36" y2="50" stroke="currentColor" stroke-width="4"/><line x1="64" y1="20" x2="64" y2="50" stroke="currentColor" stroke-width="4"/>`
  ),
  createCardStencil(
    'cloud-cache',
    'Cache',
    'Cloud & Network',
    'CACHE',
    'Redis Cache',
    `<polygon points="54,8 26,38 48,38 44,62 74,30 52,30" fill="none" stroke="currentColor" stroke-width="4.5"/>`
  ),
  createCardStencil(
    'cloud-cdn',
    'CDN',
    'Cloud & Network',
    'CDN',
    'Edge CDN',
    `<circle cx="50" cy="35" r="24" fill="none" stroke="currentColor" stroke-width="4.5"/><ellipse cx="50" cy="35" rx="11" ry="24" fill="none" stroke="currentColor" stroke-width="3.5"/><line x1="26" y1="35" x2="74" y2="35" stroke="currentColor" stroke-width="3.5"/>`
  ),
  createCardStencil(
    'cloud-bucket',
    'Storage Bucket',
    'Cloud & Network',
    'S3 / BUCKET',
    'Object Bucket',
    `<polygon points="22,16 78,16 68,58 32,58" fill="none" stroke="currentColor" stroke-width="4.5"/><ellipse cx="50" cy="16" rx="28" ry="6" fill="none" stroke="currentColor" stroke-width="4"/>`
  ),
];
