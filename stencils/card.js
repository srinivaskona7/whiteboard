// stencils/card.js — Aspect-Ratio-Preserving DevOps Icon Card & Architecture Boundary Renderer
import { getIconProvenance } from './manifest.js';

export function createBoundaryStencil({
  id,
  name,
  category,
  badge = 'VPC',
  color = '#2563eb',
  defaultText,
  tags = '',
  svgBody = '',
  defaultW = 380,
  defaultH = 250,
  dash = [8, 5],
}) {
  const stencil = {
    id,
    name,
    category,
    badge,
    color,
    defaultText: defaultText || name,
    tags: `${name} ${badge || ''} ${category} boundary container group ${tags}`.toLowerCase(),
    isCard: false,
    isBoundary: true,
    isContainer: true,
    iconKind: 'boundary',
    defaultW,
    defaultH,
    boundaryFill: `${color}0a`,
    draw(ctx, x, y, w, h) {
      ctx.save();
      ctx.fillStyle = `${color}0a`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 10);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      // Top-left provider/boundary badge tile (uniform 24x24 square)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x + 8, y + 6, 24, 24, 5);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px Inter, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(badge).slice(0, 4), x + 20, y + 18);
      ctx.restore();
    },
    toSvg(x, y, w, h) {
      const dashAttr = dash?.length ? `stroke-dasharray="${dash.join(',')}"` : '';
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${color}0d" stroke="${color}" stroke-width="2" ${dashAttr}/>`;
      out += `<rect x="${x + 8}" y="${y + 6}" width="24" height="24" rx="5" fill="${color}"/>`;
      out += `<text x="${x + 20}" y="${y + 18.5}" font-family="sans-serif" font-size="8" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${String(badge).slice(0, 4)}</text>`;
      if (svgBody && w < 120) {
        const s = Math.min((w - 16) / 100, (h - 16) / 72);
        const ox = x + (w - 100 * s) / 2;
        const oy = y + (h - 72 * s) / 2;
        out += `<g transform="translate(${ox.toFixed(1)},${oy.toFixed(1)}) scale(${s.toFixed(3)})" color="${color}">${svgBody}</g>`;
      }
      return out;
    },
  };
  stencil.provenance = getIconProvenance(stencil);
  return stencil;
}

export function createDevOpsStencil({
  id,
  name,
  category,
  badge,
  color = '#2563eb',
  defaultText,
  tags = '',
  svgBody,
  canvasDraw,
  iconKind = 'service',
  packKey,
}) {
  const stencil = {
    id,
    name,
    category,
    badge,
    color,
    defaultText: defaultText || name,
    tags: `${name} ${badge || ''} ${category} ${tags}`.toLowerCase(),
    isCard: true,
    isBoundary: false,
    iconKind,
    packKey,
    draw(ctx, x, y, w, h) {
      const r = Math.min(12, w * 0.08, h * 0.08);
      ctx.save();

      // Card container with neutral high-contrast backplate
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.stroke();

      // Top accent bar
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, Math.max(8, w - 4), Math.max(4, Math.min(6, h * 0.055)), [
        r,
        r,
        0,
        0,
      ]);
      ctx.fill();
      ctx.restore();

      // Provider/Tool Badge pill in top-right when card is large enough
      if (badge && w >= 90 && h >= 68) {
        ctx.save();
        const badgeFont = Math.max(8, Math.min(10, Math.round(h * 0.095)));
        ctx.font = `700 ${badgeFont}px Inter, -apple-system, sans-serif`;
        const bw = ctx.measureText(badge).width + 10;
        const bh = badgeFont + 5;
        const bx = x + w - bw - 6;
        const by = y + 9;
        ctx.fillStyle = `${color}1f`;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 4);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badge, bx + bw / 2, by + bh / 2 + 0.5);
        ctx.restore();
      }

      // Icon artwork region: preserve 100:72 aspect ratio with uniform scale (never stretch!)
      const availX = x + w * 0.1;
      const availY = y + h * 0.11;
      const availW = Math.max(16, w * 0.8);
      const availH = Math.max(14, h * 0.48);
      const uniformScale = Math.min(availW / 100, availH / 72);
      const iw = 100 * uniformScale;
      const ih = 72 * uniformScale;
      const ix = availX + (availW - iw) / 2;
      const iy = availY + (availH - ih) / 2;

      // Subtle neutral icon backplate for contrast in both light & dark themes
      if (w >= 72 && h >= 56) {
        ctx.save();
        ctx.fillStyle = `${color}12`;
        ctx.beginPath();
        const plateSize = Math.min(availW * 0.72, availH * 0.96);
        ctx.roundRect(
          availX + (availW - plateSize) / 2,
          availY + (availH - plateSize) / 2,
          plateSize,
          plateSize,
          8
        );
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = Math.max(1.6, Math.min(2.6, Math.min(w, h) * 0.022));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (canvasDraw) {
        canvasDraw(ctx, ix, iy, iw, ih, color);
      } else {
        drawSvgBodyToCanvas(ctx, svgBody, ix, iy, iw, ih, color);
      }
      ctx.restore();

      // Subtle divider above editable caption zone
      if (h >= 68) {
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x + 8, y + h * 0.63);
        ctx.lineTo(x + w - 8, y + h * 0.63);
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    },
    toSvg(x, y, w, h, attrs) {
      const r = Math.min(12, w * 0.08, h * 0.08);
      const availX = x + w * 0.1;
      const availY = y + h * 0.11;
      const availW = Math.max(16, w * 0.8);
      const availH = Math.max(14, h * 0.48);
      const s = Math.min(availW / 100, availH / 72);
      const ix = availX + (availW - 100 * s) / 2;
      const iy = availY + (availH - 72 * s) / 2;
      const divY = y + h * 0.63;
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${attrs}/>`;
      out += `<rect x="${x + 2}" y="${y + 2}" width="${Math.max(8, w - 4)}" height="5" rx="3" fill="${color}" stroke="none"/>`;
      if (badge && w >= 90) {
        const bw = Math.max(24, badge.length * 6 + 10);
        const bx = x + w - bw - 6;
        out += `<rect x="${bx}" y="${y + 8}" width="${bw}" height="14" rx="3" fill="${color}" fill-opacity="0.14" stroke="none"/>`;
        out += `<text x="${bx + bw / 2}" y="${y + 15.5}" font-family="sans-serif" font-size="8.5" font-weight="700" fill="${color}" stroke="none" text-anchor="middle" dominant-baseline="central">${badge}</text>`;
      }
      out += `<line x1="${x + 8}" y1="${divY}" x2="${x + w - 8}" y2="${divY}" stroke="rgba(148,163,184,0.28)" stroke-width="1"/>`;
      out += `<g transform="translate(${ix.toFixed(2)},${iy.toFixed(2)}) scale(${s.toFixed(3)})" stroke="${color}" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" color="${color}">${svgBody}</g>`;
      return out;
    },
  };
  stencil.provenance = getIconProvenance(stencil);
  return stencil;
}

// Renders normalized 100x72 SVG primitives onto Canvas with uniform aspect-ratio scaling
export function drawSvgBodyToCanvas(ctx, svgBody, ix, iy, iw, ih, color) {
  if (!svgBody) return;
  const s = Math.min(iw / 100, ih / 72);
  const ox = ix + (iw - 100 * s) / 2;
  const oy = iy + (ih - 72 * s) / 2;

  const tagRe = /<(rect|circle|ellipse|line|polyline|polygon|path)\b([^>]*)\/?>/gi;
  let match;
  while ((match = tagRe.exec(svgBody)) !== null) {
    const tag = match[1].toLowerCase();
    const attrStr = match[2];
    const getAttr = (name) => {
      const m = new RegExp(`\b${name}="([^"]*)"`, 'i').exec(attrStr);
      return m ? m[1] : null;
    };
    const num = (name, def = 0) => {
      const v = getAttr(name);
      return v !== null ? parseFloat(v) : def;
    };

    const fillAttr = getAttr('fill');
    const strokeAttr = getAttr('stroke');
    const fillOpacity = num('fill-opacity', 1);
    const shouldFill = fillAttr && fillAttr !== 'none';
    const shouldStroke = strokeAttr !== 'none';

    ctx.save();
    if (shouldFill) {
      ctx.fillStyle = fillAttr === 'currentColor' ? color : fillAttr;
      if (fillOpacity < 1) ctx.globalAlpha *= fillOpacity;
    }
    if (shouldStroke) {
      ctx.strokeStyle = !strokeAttr || strokeAttr === 'currentColor' ? color : strokeAttr;
    }

    if (tag === 'rect') {
      const rx = ox + num('x') * s;
      const ry = oy + num('y') * s;
      const rw = num('width') * s;
      const rh = num('height') * s;
      const rr = num('rx') * s;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, rr);
      if (shouldFill) ctx.fill();
      if (shouldStroke) ctx.stroke();
    } else if (tag === 'circle') {
      const cx = ox + num('cx') * s;
      const cy = oy + num('cy') * s;
      const r = num('r') * s;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(0.5, r), 0, Math.PI * 2);
      if (shouldFill) ctx.fill();
      if (shouldStroke) ctx.stroke();
    } else if (tag === 'ellipse') {
      const cx = ox + num('cx') * s;
      const cy = oy + num('cy') * s;
      const rx = num('rx') * s;
      const ry = num('ry') * s;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
      if (shouldFill) ctx.fill();
      if (shouldStroke) ctx.stroke();
    } else if (tag === 'line') {
      ctx.beginPath();
      ctx.moveTo(ox + num('x1') * s, oy + num('y1') * s);
      ctx.lineTo(ox + num('x2') * s, oy + num('y2') * s);
      if (shouldStroke) ctx.stroke();
    } else if (tag === 'polyline' || tag === 'polygon') {
      const ptsRaw = (getAttr('points') || '').trim().split(/[\s,]+/);
      if (ptsRaw.length >= 4) {
        ctx.beginPath();
        for (let i = 0; i < ptsRaw.length - 1; i += 2) {
          const px = ox + parseFloat(ptsRaw[i]) * s;
          const py = oy + parseFloat(ptsRaw[i + 1]) * s;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        if (tag === 'polygon') ctx.closePath();
        if (shouldFill) ctx.fill();
        if (shouldStroke) ctx.stroke();
      }
    } else if (tag === 'path') {
      const d = getAttr('d') || '';
      if (typeof Path2D !== 'undefined' && typeof ctx.scale === 'function') {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.scale(s, s);
        ctx.lineWidth = (ctx.lineWidth || 2) / Math.max(0.1, s);
        const p2d = new Path2D(d);
        if (shouldFill) ctx.fill(p2d);
        if (shouldStroke) ctx.stroke(p2d);
        ctx.restore();
      } else {
        const tokens = d.match(/[MLCQZHVmlcqzhv]|-?\d*\.?\d+/g) || [];
        ctx.beginPath();
        let idx = 0;
        let cx = ox;
        let cy = oy;
        while (idx < tokens.length) {
          const cmd = tokens[idx++];
          if (cmd === 'M') {
            cx = ox + parseFloat(tokens[idx++]) * s;
            cy = oy + parseFloat(tokens[idx++]) * s;
            ctx.moveTo(cx, cy);
          } else if (cmd === 'L') {
            cx = ox + parseFloat(tokens[idx++]) * s;
            cy = oy + parseFloat(tokens[idx++]) * s;
            ctx.lineTo(cx, cy);
          } else if (cmd === 'H') {
            cx = ox + parseFloat(tokens[idx++]) * s;
            ctx.lineTo(cx, cy);
          } else if (cmd === 'V') {
            cy = oy + parseFloat(tokens[idx++]) * s;
            ctx.lineTo(cx, cy);
          } else if (cmd === 'Q') {
            const qx = ox + parseFloat(tokens[idx++]) * s;
            const qy = oy + parseFloat(tokens[idx++]) * s;
            cx = ox + parseFloat(tokens[idx++]) * s;
            cy = oy + parseFloat(tokens[idx++]) * s;
            ctx.quadraticCurveTo(qx, qy, cx, cy);
          } else if (cmd === 'C') {
            const c1x = ox + parseFloat(tokens[idx++]) * s;
            const c1y = oy + parseFloat(tokens[idx++]) * s;
            const c2x = ox + parseFloat(tokens[idx++]) * s;
            const c2y = oy + parseFloat(tokens[idx++]) * s;
            cx = ox + parseFloat(tokens[idx++]) * s;
            cy = oy + parseFloat(tokens[idx++]) * s;
            ctx.bezierCurveTo(c1x, c1y, c2x, c2y, cx, cy);
          } else if (cmd === 'Z' || cmd === 'z') {
            ctx.closePath();
          }
        }
        if (shouldFill) ctx.fill();
        if (shouldStroke) ctx.stroke();
      }
    }
    ctx.restore();
  }
}
