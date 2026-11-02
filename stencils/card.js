// stencils/card.js — Shared DevOps & Cloud Architecture Stencil Card Renderer

export function createDevOpsStencil({
  id,
  name,
  category,
  badge,
  color = '#2563eb',
  defaultText,
  tags = '',
  svgBody,
  canvasDraw = null,
}) {
  const label = defaultText || name;
  // Build rich library thumbnail SVG with brand accent badge & colored glyph
  const iconSvg = `<svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="92" height="62" rx="10" fill="${color}14" stroke="${color}" stroke-width="2.5"/>
    <rect x="10" y="9" width="28" height="13" rx="4" fill="${color}"/>
    <text x="24" y="18.5" font-family="Inter, sans-serif" font-size="7.5" font-weight="700" fill="#ffffff" text-anchor="middle">${badge}</text>
    <g color="${color}" stroke="${color}" fill="none" transform="translate(16, 6) scale(0.76)">
      ${svgBody}
    </g>
  </svg>`;

  return {
    id,
    name,
    category,
    badge,
    color,
    tags: `${name} ${category} ${badge} ${tags}`.toLowerCase(),
    defaultW: 152,
    defaultH: 98,
    defaultText: label,
    isCard: true,
    iconSvg,
    draw(ctx, x, y, w, h) {
      // Card background & border
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();

      // Top brand accent bar
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 1, Math.max(8, w - 2), 5, [9, 9, 0, 0]);
      ctx.fill();

      // Top-left brand badge pill
      const badgeW = Math.max(26, Math.min(54, badge.length * 6.2 + 10));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x + 8, y + 10, badgeW, 15, 4);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge, x + 8 + badgeW / 2, y + 17.5);
      ctx.restore();

      // Center-top vector glyph
      ctx.save();
      const iconBoxH = Math.max(24, h * 0.46);
      const scale = Math.min((w * 0.44) / 100, iconBoxH / 70);
      const gx = x + w / 2 - 50 * scale;
      const gy = y + 8 + (iconBoxH - 70 * scale) * 0.5;
      ctx.translate(gx, gy);
      ctx.scale(scale, scale);
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (canvasDraw) {
        canvasDraw(ctx, color);
      } else {
        drawSvgPrimitivesOnCanvas(ctx, svgBody, color);
      }
      ctx.restore();

      // Subtle divider line above label area
      ctx.save();
      ctx.strokeStyle = `${color}33`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 10, y + h * 0.57);
      ctx.lineTo(x + w - 10, y + h * 0.57);
      ctx.stroke();
      ctx.restore();
    },
    toSvg(x, y, w, h, attrs) {
      const badgeW = Math.max(26, Math.min(54, badge.length * 6.2 + 10));
      const iconBoxH = Math.max(24, h * 0.46);
      const scale = Math.min((w * 0.44) / 100, iconBoxH / 70);
      const gx = (x + w / 2 - 50 * scale).toFixed(1);
      const gy = (y + 8 + (iconBoxH - 70 * scale) * 0.5).toFixed(1);
      const sc = scale.toFixed(3);
      return [
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" ${attrs}/>`,
        `<rect x="${x + 8}" y="${y + 10}" width="${badgeW}" height="15" rx="4" fill="${color}"/>`,
        `<text x="${x + 8 + badgeW / 2}" y="${y + 18}" font-family="sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${badge}</text>`,
        `<g transform="translate(${gx},${gy}) scale(${sc})" color="${color}" stroke="${color}" fill="none">${svgBody}</g>`,
      ].join('');
    },
  };
}

// Lightweight synchronous SVG primitive renderer for Canvas (zero async image flicker, works in Node & Browser)
function drawSvgPrimitivesOnCanvas(ctx, svgBody, color) {
  if (!svgBody) return;
  const tagRegex = /<(path|circle|rect|ellipse|line|polygon|polyline)\b([^>]*)\/?>/gi;
  let match;
  while ((match = tagRegex.exec(svgBody)) !== null) {
    const tag = match[1].toLowerCase();
    const attrStr = match[2];
    const getAttr = (name) => {
      const m = new RegExp(`\b${name}="([^"]*)"`, 'i').exec(attrStr);
      return m ? m[1] : null;
    };
    const fillAttr = getAttr('fill');
    const strokeAttr = getAttr('stroke');
    const sw = Number(getAttr('stroke-width')) || 4;
    ctx.lineWidth = sw;
    const shouldFill = fillAttr && fillAttr !== 'none';
    const shouldStroke = strokeAttr !== 'none' && (!shouldFill || Boolean(strokeAttr));
    ctx.fillStyle = fillAttr === 'currentColor' || !fillAttr ? color : fillAttr;
    ctx.strokeStyle = strokeAttr === 'currentColor' || !strokeAttr ? color : strokeAttr;

    if (tag === 'circle') {
      const cx = Number(getAttr('cx')) || 50;
      const cy = Number(getAttr('cy')) || 35;
      const r = Number(getAttr('r')) || 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (shouldFill) ctx.fill();
      if (shouldStroke) ctx.stroke();
    } else if (tag === 'ellipse') {
      const cx = Number(getAttr('cx')) || 50;
      const cy = Number(getAttr('cy')) || 35;
      const rx = Number(getAttr('rx')) || 20;
      const ry = Number(getAttr('ry')) || 10;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (shouldFill) ctx.fill();
      if (shouldStroke) ctx.stroke();
    } else if (tag === 'rect') {
      const rx = Number(getAttr('rx')) || 0;
      const x = Number(getAttr('x')) || 0;
      const y = Number(getAttr('y')) || 0;
      const w = Number(getAttr('width')) || 20;
      const h = Number(getAttr('height')) || 20;
      ctx.beginPath();
      if (rx > 0 && ctx.roundRect) ctx.roundRect(x, y, w, h, rx);
      else ctx.rect(x, y, w, h);
      if (shouldFill) ctx.fill();
      if (shouldStroke) ctx.stroke();
    } else if (tag === 'line') {
      ctx.beginPath();
      ctx.moveTo(Number(getAttr('x1')) || 0, Number(getAttr('y1')) || 0);
      ctx.lineTo(Number(getAttr('x2')) || 0, Number(getAttr('y2')) || 0);
      ctx.stroke();
    } else if (tag === 'polygon' || tag === 'polyline') {
      const pts = (getAttr('points') || '')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (pts.length >= 4) {
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length - 1; i += 2) {
          ctx.lineTo(pts[i], pts[i + 1]);
        }
        if (tag === 'polygon') ctx.closePath();
        if (shouldFill) ctx.fill();
        if (shouldStroke) ctx.stroke();
      }
    } else if (tag === 'path') {
      const d = getAttr('d');
      if (d && typeof Path2D !== 'undefined') {
        const p2d = new Path2D(d);
        if (shouldFill) ctx.fill(p2d);
        if (shouldStroke) ctx.stroke(p2d);
      } else if (d) {
        // Fallback simple M/L/H/V/Z path drawing for environments without Path2D
        ctx.beginPath();
        const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) || [];
        let i = 0;
        let cx = 0;
        let cy = 0;
        while (i < tokens.length) {
          const cmd = tokens[i++];
          if (cmd === 'M') {
            cx = Number(tokens[i++]) || 0;
            cy = Number(tokens[i++]) || 0;
            ctx.moveTo(cx, cy);
          } else if (cmd === 'L') {
            cx = Number(tokens[i++]) || 0;
            cy = Number(tokens[i++]) || 0;
            ctx.lineTo(cx, cy);
          } else if (cmd === 'H') {
            cx = Number(tokens[i++]) || 0;
            ctx.lineTo(cx, cy);
          } else if (cmd === 'V') {
            cy = Number(tokens[i++]) || 0;
            ctx.lineTo(cx, cy);
          } else if (cmd === 'Z' || cmd === 'z') {
            ctx.closePath();
          }
        }
        if (shouldFill) ctx.fill();
        if (shouldStroke) ctx.stroke();
      }
    }
  }
}
