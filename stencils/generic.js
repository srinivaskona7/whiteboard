// stencils/generic.js

export const GENERIC_STENCILS = [
  {
    id: 'math-axes',
    name: 'Coordinate Plane',
    category: 'Math & Science',
    defaultW: 260,
    defaultH: 260,
    defaultText: '',
    iconSvg: `<svg viewBox="0 0 100 70"><line x1="12" y1="35" x2="88" y2="35" stroke="currentColor" stroke-width="4"/><line x1="50" y1="6" x2="50" y2="64" stroke="currentColor" stroke-width="4"/><polyline points="80,29 88,35 80,41" fill="none" stroke="currentColor" stroke-width="3.5"/><polyline points="44,14 50,6 56,14" fill="none" stroke="currentColor" stroke-width="3.5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      const step = 20;
      for (let gx = x + step; gx < x + w; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, y);
        ctx.lineTo(gx, y + h);
        ctx.stroke();
      }
      for (let gy = y + step; gy < y + h; gy += step) {
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + w, gy);
        ctx.stroke();
      }
      ctx.restore();

      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + 8, cy);
      ctx.lineTo(x + w - 8, cy);
      ctx.moveTo(cx, y + 8);
      ctx.lineTo(cx, y + h - 8);
      // Arrows
      ctx.moveTo(x + w - 16, cy - 6);
      ctx.lineTo(x + w - 8, cy);
      ctx.lineTo(x + w - 16, cy + 6);
      ctx.moveTo(cx - 6, y + 16);
      ctx.lineTo(cx, y + 8);
      ctx.lineTo(cx + 6, y + 16);
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" ${attrs}/><line x1="${x + 8}" y1="${cy}" x2="${x + w - 8}" y2="${cy}" ${attrs}/><line x1="${cx}" y1="${y + 8}" x2="${cx}" y2="${y + h - 8}" ${attrs}/>`;
    },
  },
  {
    id: 'math-number-line',
    name: 'Number Line',
    category: 'Math & Science',
    defaultW: 420,
    defaultH: 70,
    defaultText: '',
    iconSvg: `<svg viewBox="0 0 100 70"><line x1="8" y1="35" x2="92" y2="35" stroke="currentColor" stroke-width="4.5"/><line x1="25" y1="26" x2="25" y2="44" stroke="currentColor" stroke-width="3.5"/><line x1="50" y1="24" x2="50" y2="46" stroke="currentColor" stroke-width="4"/><line x1="75" y1="26" x2="75" y2="44" stroke="currentColor" stroke-width="3.5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const cy = y + h / 2;
      ctx.beginPath();
      ctx.moveTo(x + 10, cy);
      ctx.lineTo(x + w - 10, cy);
      // Arrow tips
      ctx.moveTo(x + 18, cy - 6);
      ctx.lineTo(x + 10, cy);
      ctx.lineTo(x + 18, cy + 6);
      ctx.moveTo(x + w - 18, cy - 6);
      ctx.lineTo(x + w - 10, cy);
      ctx.lineTo(x + w - 18, cy + 6);
      const ticks = 10;
      const span = w - 48;
      for (let i = 0; i <= ticks; i++) {
        const tx = x + 24 + (span * i) / ticks;
        ctx.moveTo(tx, cy - 8);
        ctx.lineTo(tx, cy + 8);
      }
      ctx.stroke();
      ctx.save();
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ctx.strokeStyle;
      for (let i = 0; i <= ticks; i++) {
        const tx = x + 24 + (span * i) / ticks;
        ctx.fillText(String(i - 5), tx, cy + 22);
      }
      ctx.restore();
    },
    toSvg(x, y, w, h, attrs) {
      const cy = y + h / 2;
      const ticks = 10;
      const span = w - 48;
      let tickMarkup = '';
      for (let i = 0; i <= ticks; i++) {
        const tx = x + 24 + (span * i) / ticks;
        tickMarkup += `<line x1="${tx}" y1="${cy - 8}" x2="${tx}" y2="${cy + 8}" ${attrs}/><text x="${tx}" y="${cy + 22}" font-family="sans-serif" font-size="11" text-anchor="middle" fill="currentColor">${i - 5}</text>`;
      }
      return `<line x1="${x + 10}" y1="${cy}" x2="${x + w - 10}" y2="${cy}" ${attrs}/>${tickMarkup}`;
    },
  },
  {
    id: 'generic-hexagon',
    name: 'Hexagon',
    category: 'Generic',
    defaultW: 140,
    defaultH: 100,
    defaultText: 'Hexagon',
    iconSvg: `<svg viewBox="0 0 100 70"><polygon points="26,8 74,8 94,35 74,62 26,62 6,35" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const inset = w * 0.22;
      ctx.beginPath();
      ctx.moveTo(x + inset, y);
      ctx.lineTo(x + w - inset, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - inset, y + h);
      ctx.lineTo(x + inset, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const inset = w * 0.22;
      const pts = `${x + inset},${y} ${x + w - inset},${y} ${x + w},${y + h / 2} ${x + w - inset},${y + h} ${x + inset},${y + h} ${x},${y + h / 2}`;
      return `<polygon points="${pts}" ${attrs}/>`;
    },
  },
  {
    id: 'generic-callout',
    name: 'Callout Bubble',
    category: 'Generic',
    defaultW: 160,
    defaultH: 105,
    defaultText: 'Callout',
    iconSvg: `<svg viewBox="0 0 100 70"><path d="M10,10 H90 V46 H42 L22,64 V46 H10 Z" fill="none" stroke="currentColor" stroke-width="5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const bh = h * 0.76;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + bh);
      ctx.lineTo(x + w * 0.42, y + bh);
      ctx.lineTo(x + w * 0.22, y + h);
      ctx.lineTo(x + w * 0.22, y + bh);
      ctx.lineTo(x, y + bh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const bh = h * 0.76;
      const d = `M ${x} ${y} H ${x + w} V ${y + bh} H ${x + w * 0.42} L ${x + w * 0.22} ${y + h} V ${y + bh} H ${x} Z`;
      return `<path d="${d}" ${attrs}/>`;
    },
  },
];
