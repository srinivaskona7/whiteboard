// stencils/flowchart.js

export const FLOWCHART_STENCILS = [
  {
    id: 'flow-process',
    name: 'Process',
    category: 'Flowchart',
    defaultW: 150,
    defaultH: 80,
    defaultText: 'Process',
    iconSvg: `<svg viewBox="0 0 100 70"><rect x="8" y="10" width="84" height="50" rx="4" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ${attrs}/>`;
    },
  },
  {
    id: 'flow-decision',
    name: 'Decision',
    category: 'Flowchart',
    defaultW: 150,
    defaultH: 100,
    defaultText: 'Decision?',
    iconSvg: `<svg viewBox="0 0 100 70"><polygon points="50,6 94,35 50,64 6,35" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
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
  {
    id: 'flow-terminator',
    name: 'Terminator',
    category: 'Flowchart',
    defaultW: 150,
    defaultH: 70,
    defaultText: 'Start / End',
    iconSvg: `<svg viewBox="0 0 100 70"><rect x="8" y="14" width="84" height="42" rx="21" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const r = Math.min(w, h) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const r = Math.min(w, h) / 2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${attrs}/>`;
    },
  },
  {
    id: 'flow-data',
    name: 'Data (I/O)',
    category: 'Flowchart',
    defaultW: 160,
    defaultH: 80,
    defaultText: 'Data I/O',
    iconSvg: `<svg viewBox="0 0 100 70"><polygon points="22,12 92,12 78,58 8,58" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const skew = Math.min(28, w * 0.18);
      ctx.beginPath();
      ctx.moveTo(x + skew, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - skew, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const skew = Math.min(28, w * 0.18);
      const pts = `${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`;
      return `<polygon points="${pts}" ${attrs}/>`;
    },
  },
  {
    id: 'flow-document',
    name: 'Document',
    category: 'Flowchart',
    defaultW: 150,
    defaultH: 95,
    defaultText: 'Document',
    iconSvg: `<svg viewBox="0 0 100 70"><path d="M10,10 H90 V52 Q70,64 50,52 T10,52 Z" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const waveH = h * 0.14;
      const baseH = h - waveH;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + baseH);
      ctx.quadraticCurveTo(x + w * 0.75, y + h + waveH * 0.6, x + w * 0.5, y + baseH);
      ctx.quadraticCurveTo(x + w * 0.25, y + baseH - waveH * 0.8, x, y + baseH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const waveH = h * 0.14;
      const baseH = y + h - waveH;
      const d = `M ${x} ${y} H ${x + w} V ${baseH} Q ${x + w * 0.75} ${y + h + waveH * 0.6} ${x + w * 0.5} ${baseH} Q ${x + w * 0.25} ${baseH - waveH * 0.8} ${x} ${baseH} Z`;
      return `<path d="${d}" ${attrs}/>`;
    },
  },
  {
    id: 'flow-database',
    name: 'Database',
    category: 'Flowchart',
    defaultW: 130,
    defaultH: 110,
    defaultText: 'Database',
    iconSvg: `<svg viewBox="0 0 100 70"><ellipse cx="50" cy="16" rx="36" ry="10" fill="none" stroke="currentColor" stroke-width="5"/><path d="M14,16 V52 A36,10 0 0,0 86,52 V16" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const ry = Math.min(20, h * 0.16);
      const rx = w / 2;
      const cx = x + rx;
      ctx.beginPath();
      ctx.moveTo(x, y + ry);
      ctx.lineTo(x, y + h - ry);
      ctx.ellipse(cx, y + h - ry, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(x + w, y + ry);
      ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const ry = Math.min(20, h * 0.16);
      const rx = w / 2;
      const cx = x + rx;
      const topY = y + ry;
      const botY = y + h - ry;
      const body = `M ${x} ${topY} V ${botY} A ${rx} ${ry} 0 0 0 ${x + w} ${botY} V ${topY} A ${rx} ${ry} 0 0 0 ${x} ${topY} Z`;
      return `<path d="${body}" ${attrs}/><ellipse cx="${cx}" cy="${topY}" rx="${rx}" ry="${ry}" fill="none" ${attrs}/>`;
    },
  },
  {
    id: 'flow-connector',
    name: 'Connector',
    category: 'Flowchart',
    defaultW: 72,
    defaultH: 72,
    defaultText: 'A',
    iconSvg: `<svg viewBox="0 0 100 70"><circle cx="50" cy="35" r="24" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
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
];
