// stencils/network.js

function createNetStencil(id, name, badge, defaultText, iconInner) {
  return {
    id,
    name,
    category: 'Cloud & Network',
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

export const NETWORK_STENCILS = [
  createNetStencil(
    'net-lb',
    'Load Balancer',
    'LB',
    'Load Balancer',
    `<circle cx="24" cy="35" r="8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="76" cy="18" r="6" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="76" cy="35" r="6" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="76" cy="52" r="6" fill="none" stroke="currentColor" stroke-width="4"/><path d="M32,35 L70,18 M32,35 L70,35 M32,35 L70,52" stroke="currentColor" stroke-width="3.5"/>`
  ),
  createNetStencil(
    'net-firewall',
    'Firewall',
    'FW',
    'WAF / Firewall',
    `<rect x="16" y="14" width="68" height="42" fill="none" stroke="currentColor" stroke-width="4.5"/><line x1="16" y1="28" x2="84" y2="28" stroke="currentColor" stroke-width="3.5"/><line x1="16" y1="42" x2="84" y2="42" stroke="currentColor" stroke-width="3.5"/><line x1="50" y1="14" x2="50" y2="28" stroke="currentColor" stroke-width="3.5"/><line x1="34" y1="28" x2="34" y2="42" stroke="currentColor" stroke-width="3.5"/><line x1="66" y1="28" x2="66" y2="42" stroke="currentColor" stroke-width="3.5"/>`
  ),
  createNetStencil(
    'net-user',
    'User',
    'USER',
    'Client User',
    `<circle cx="50" cy="24" r="11" fill="none" stroke="currentColor" stroke-width="4.5"/><path d="M26,58 C26,42 74,42 74,58" fill="none" stroke="currentColor" stroke-width="4.5"/>`
  ),
  createNetStencil(
    'net-browser',
    'Browser',
    'WEB',
    'Web Browser',
    `<rect x="14" y="12" width="72" height="46" rx="5" fill="none" stroke="currentColor" stroke-width="4.5"/><line x1="14" y1="24" x2="86" y2="24" stroke="currentColor" stroke-width="3.5"/><circle cx="22" cy="18" r="2" fill="currentColor"/><circle cx="30" cy="18" r="2" fill="currentColor"/>`
  ),
  createNetStencil(
    'net-mobile',
    'Mobile',
    'MOBILE',
    'Mobile App',
    `<rect x="32" y="8" width="36" height="54" rx="6" fill="none" stroke="currentColor" stroke-width="4.5"/><line x1="45" y1="55" x2="55" y2="55" stroke="currentColor" stroke-width="4"/>`
  ),
  createNetStencil(
    'net-internet',
    'Internet',
    'INTERNET',
    'Public Internet',
    `<path d="M28,48 H72 A14,14 0 0,0 72,22 A18,18 0 0,0 36,20 A14,14 0 0,0 28,48 Z" fill="none" stroke="currentColor" stroke-width="4.5"/>`
  ),
];
