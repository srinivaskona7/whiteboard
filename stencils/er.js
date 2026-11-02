// stencils/er.js

export const ER_STENCILS = [
  {
    id: 'er-entity',
    name: 'Entity',
    category: 'ER Diagram',
    defaultW: 150,
    defaultH: 80,
    defaultText: 'Entity',
    iconSvg: `<svg viewBox="0 0 100 70"><rect x="10" y="14" width="80" height="42" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/>`;
    },
  },
  {
    id: 'er-weak-entity',
    name: 'Weak Entity',
    category: 'ER Diagram',
    defaultW: 160,
    defaultH: 86,
    defaultText: 'Weak Entity',
    iconSvg: `<svg viewBox="0 0 100 70"><rect x="8" y="10" width="84" height="50" fill="none" stroke="currentColor" stroke-width="4.5"/><rect x="15" y="17" width="70" height="36" fill="none" stroke="currentColor" stroke-width="3.5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const pad = 6;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(x + pad, y + pad, Math.max(4, w - pad * 2), Math.max(4, h - pad * 2));
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const pad = 6;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/><rect x="${x + pad}" y="${y + pad}" width="${Math.max(4, w - pad * 2)}" height="${Math.max(4, h - pad * 2)}" fill="none" ${attrs}/>`;
    },
  },
  {
    id: 'er-attribute',
    name: 'Attribute',
    category: 'ER Diagram',
    defaultW: 140,
    defaultH: 74,
    defaultText: 'attribute',
    iconSvg: `<svg viewBox="0 0 100 70"><ellipse cx="50" cy="35" rx="40" ry="22" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${attrs}/>`;
    },
  },
  {
    id: 'er-relationship',
    name: 'Relationship',
    category: 'ER Diagram',
    defaultW: 150,
    defaultH: 94,
    defaultText: 'has / belongs',
    iconSvg: `<svg viewBox="0 0 100 70"><polygon points="50,8 92,35 50,62 8,35" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
      return `<polygon points="${pts}" ${attrs}/>`;
    },
  },
];
