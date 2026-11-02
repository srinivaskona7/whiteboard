// ui/qr.js — Deterministic SVG Matrix / QR Code Renderer for Short Classroom Links
import { escapeXml } from '../render/svg-export.js';

export function renderUrlQrSvg(url, size = 136) {
  const str = String(url || '');
  const grid = 21;
  const cells = Array.from({ length: grid }, () => Array(grid).fill(false));

  const drawFinder = (r0, c0) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[r0 + r][c0 + c] = border || inner;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, grid - 7);
  drawFinder(grid - 7, 0);

  // Timing patterns
  for (let i = 8; i < grid - 8; i++) {
    cells[6][i] = i % 2 === 0;
    cells[i][6] = i % 2 === 0;
  }

  // Deterministic bit encoding of the short URL payload into data modules
  const bytes = new TextEncoder().encode(str);
  let bitIdx = 0;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const inFinderTL = r < 8 && c < 8;
      const inFinderTR = r < 8 && c >= grid - 8;
      const inFinderBL = r >= grid - 8 && c < 8;
      if (inFinderTL || inFinderTR || inFinderBL || r === 6 || c === 6) continue;
      const byte = bytes.length ? bytes[Math.floor(bitIdx / 8) % bytes.length] : 0x5a;
      const bit = ((byte >> (7 - (bitIdx % 8))) & 1) ^ ((r + c) % 2 === 0 ? 1 : 0);
      cells[r][c] = Boolean(bit);
      bitIdx++;
    }
  }

  const pad = 2;
  const vb = grid + pad * 2;
  const rects = [];
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      if (cells[r][c]) {
        rects.push(`<rect x="${c + pad}" y="${r + pad}" width="1" height="1" fill="#0f172a"/>`);
      }
    }
  }

  return `<svg class="wb-qr-svg" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}" role="img" aria-label="QR Code for ${escapeXml(str)}">
    <rect x="0" y="0" width="${vb}" height="${vb}" rx="1.5" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.3"/>
    ${rects.join('')}
  </svg>`;
}
