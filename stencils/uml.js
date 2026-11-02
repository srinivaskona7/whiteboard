// stencils/uml.js

export const UML_STENCILS = [
  {
    id: 'uml-class',
    name: 'Class Box',
    category: 'UML',
    defaultW: 180,
    defaultH: 130,
    defaultText: `ClassName
+ id: string
+ save(): void`,
    iconSvg: `<svg viewBox="0 0 100 70"><rect x="10" y="8" width="80" height="54" fill="none" stroke="currentColor" stroke-width="5"/><line x1="10" y1="24" x2="90" y2="24" stroke="currentColor" stroke-width="4"/><line x1="10" y1="44" x2="90" y2="44" stroke="currentColor" stroke-width="4"/></svg>`,
    draw(ctx, x, y, w, h) {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + Math.min(34, h * 0.28));
      ctx.lineTo(x + w, y + Math.min(34, h * 0.28));
      ctx.moveTo(x, y + Math.min(72, h * 0.62));
      ctx.lineTo(x + w, y + Math.min(72, h * 0.62));
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const y1 = y + Math.min(34, h * 0.28);
      const y2 = y + Math.min(72, h * 0.62);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${attrs}/><line x1="${x}" y1="${y1}" x2="${x + w}" y2="${y1}" ${attrs}/><line x1="${x}" y1="${y2}" x2="${x + w}" y2="${y2}" ${attrs}/>`;
    },
  },
  {
    id: 'uml-interface',
    name: 'Interface',
    category: 'UML',
    defaultW: 180,
    defaultH: 115,
    defaultText: `«interface»
IRepository
+ find(id)`,
    iconSvg: `<svg viewBox="0 0 100 70"><rect x="10" y="8" width="80" height="54" rx="4" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="6,4"/><line x1="10" y1="28" x2="90" y2="28" stroke="currentColor" stroke-width="4"/></svg>`,
    draw(ctx, x, y, w, h) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + Math.min(38, h * 0.35));
      ctx.lineTo(x + w, y + Math.min(38, h * 0.35));
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const y1 = y + Math.min(38, h * 0.35);
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ${attrs}/><line x1="${x}" y1="${y1}" x2="${x + w}" y2="${y1}" ${attrs}/>`;
    },
  },
  {
    id: 'uml-actor',
    name: 'Actor',
    category: 'UML',
    defaultW: 90,
    defaultH: 130,
    defaultText: 'Actor',
    iconSvg: `<svg viewBox="0 0 100 70"><circle cx="50" cy="15" r="9" fill="none" stroke="currentColor" stroke-width="4.5"/><line x1="50" y1="24" x2="50" y2="46" stroke="currentColor" stroke-width="4.5"/><line x1="30" y1="32" x2="70" y2="32" stroke="currentColor" stroke-width="4.5"/><line x1="50" y1="46" x2="34" y2="64" stroke="currentColor" stroke-width="4.5"/><line x1="50" y1="46" x2="66" y2="64" stroke="currentColor" stroke-width="4.5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const cx = x + w / 2;
      const headR = Math.min(w, h) * 0.14;
      const headY = y + headR + 4;
      const bodyTop = headY + headR;
      const bodyBot = y + h * 0.58;
      const armY = bodyTop + (bodyBot - bodyTop) * 0.35;
      const footY = y + h * 0.82;
      ctx.beginPath();
      ctx.arc(cx, headY, headR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, bodyTop);
      ctx.lineTo(cx, bodyBot);
      ctx.moveTo(cx - w * 0.32, armY);
      ctx.lineTo(cx + w * 0.32, armY);
      ctx.moveTo(cx, bodyBot);
      ctx.lineTo(cx - w * 0.28, footY);
      ctx.moveTo(cx, bodyBot);
      ctx.lineTo(cx + w * 0.28, footY);
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const cx = x + w / 2;
      const headR = Math.min(w, h) * 0.14;
      const headY = y + headR + 4;
      const bodyTop = headY + headR;
      const bodyBot = y + h * 0.58;
      const armY = bodyTop + (bodyBot - bodyTop) * 0.35;
      const footY = y + h * 0.82;
      return `<circle cx="${cx}" cy="${headY}" r="${headR}" ${attrs}/><path d="M ${cx} ${bodyTop} L ${cx} ${bodyBot} M ${cx - w * 0.32} ${armY} L ${cx + w * 0.32} ${armY} M ${cx} ${bodyBot} L ${cx - w * 0.28} ${footY} M ${cx} ${bodyBot} L ${cx + w * 0.28} ${footY}" ${attrs}/>`;
    },
  },
  {
    id: 'uml-lifeline',
    name: 'Lifeline',
    category: 'UML',
    defaultW: 130,
    defaultH: 220,
    defaultText: ':Service',
    iconSvg: `<svg viewBox="0 0 100 70"><rect x="18" y="6" width="64" height="22" fill="none" stroke="currentColor" stroke-width="4.5"/><line x1="50" y1="28" x2="50" y2="66" stroke="currentColor" stroke-width="4.5" stroke-dasharray="6,5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const boxH = Math.min(44, h * 0.26);
      ctx.beginPath();
      ctx.rect(x, y, w, boxH);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + boxH);
      ctx.lineTo(x + w / 2, y + h);
      ctx.stroke();
      ctx.restore();
    },
    toSvg(x, y, w, h, attrs) {
      const boxH = Math.min(44, h * 0.26);
      return `<rect x="${x}" y="${y}" width="${w}" height="${boxH}" ${attrs}/><line x1="${x + w / 2}" y1="${y + boxH}" x2="${x + w / 2}" y2="${y + h}" stroke-dasharray="6,6" ${attrs}/>`;
    },
  },
  {
    id: 'uml-note',
    name: 'Note',
    category: 'UML',
    defaultW: 150,
    defaultH: 95,
    defaultText: 'UML Note',
    iconSvg: `<svg viewBox="0 0 100 70"><path d="M12,8 H72 L88,24 V62 H12 Z M72,8 V24 H88" fill="none" stroke="currentColor" stroke-width="4.5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const fold = 18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w - fold, y);
      ctx.lineTo(x + w, y + fold);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w - fold, y);
      ctx.lineTo(x + w - fold, y + fold);
      ctx.lineTo(x + w, y + fold);
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const fold = 18;
      const d = `M ${x} ${y} H ${x + w - fold} L ${x + w} ${y + fold} V ${y + h} H ${x} Z M ${x + w - fold} ${y} V ${y + fold} H ${x + w}`;
      return `<path d="${d}" ${attrs}/>`;
    },
  },
  {
    id: 'uml-package',
    name: 'Package',
    category: 'UML',
    defaultW: 170,
    defaultH: 115,
    defaultText: 'package.core',
    iconSvg: `<svg viewBox="0 0 100 70"><path d="M10,22 H46 V10 H10 Z M10,22 H90 V62 H10 Z" fill="none" stroke="currentColor" stroke-width="4.5"/></svg>`,
    draw(ctx, x, y, w, h) {
      const tabW = Math.min(72, w * 0.45);
      const tabH = 20;
      ctx.beginPath();
      ctx.rect(x, y, tabW, tabH);
      ctx.rect(x, y + tabH, w, h - tabH);
      ctx.fill();
      ctx.stroke();
    },
    toSvg(x, y, w, h, attrs) {
      const tabW = Math.min(72, w * 0.45);
      const tabH = 20;
      return `<rect x="${x}" y="${y}" width="${tabW}" height="${tabH}" ${attrs}/><rect x="${x}" y="${y + tabH}" width="${w}" height="${h - tabH}" ${attrs}/>`;
    },
  },
];
