// scene/workflow-builder.js — turn one workflow (ordered steps with text, commands and output)
// into native whiteboard elements. Pure: no DOM, no timers, so it can be tested in Node.
//
// Every step becomes a card (icon, number, title, explanation, copyable code block, output, note).
// All elements of step N carry revealStep N, so Present mode's Next/Previous reveals the flow one
// step at a time and "Full flow" shows everything. Arrows are bound to the cards and appear with
// the step they point at. Everything stays a normal, editable element.
import { createElement, uid } from './model.js';
import { bindConnectorEndpoint } from './bindings.js';

export const WF_LAYOUT = Object.freeze({ cols: 3, cardW: 440, gapX: 72, gapY: 84, pad: 40, headerH: 128 });
export const LEVEL_NAMES = ['', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];

const CARD_PAD = 14;
const TEXT_CHARS = 52; // 14px sans across the card
const CODE_CHARS = 50; // 12px mono across the code box
const MAX_CODE_ROWS = 16;
const MAX_OUT_ROWS = 12;
const lineH = (fontSize) => fontSize * 1.32;

export function wrapText(text, maxChars) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    if (!para) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

const codeRows = (text, chars) =>
  String(text)
    .split('\n')
    .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / chars)), 0);
const codeHeight = (rows) => Math.round(38 + rows * 17.4 + 8);
const isCardStencil = (id) => !String(id).startsWith('lucide-');

function stepParts(step) {
  const parts = [];
  const text = wrapText(step.text, TEXT_CHARS);
  parts.push({ kind: 'text', lines: text, fontSize: 14, h: text.length * lineH(14) + 4 });
  if (step.viz) {
    const lines = wrapText(`Message flow\n${step.viz}`, TEXT_CHARS);
    parts.push({ kind: 'viz', lines, fontSize: 12, h: lines.length * lineH(12) + 4 });
  }
  if (step.cmd) {
    if (step.risk) parts.push({ kind: 'warn', lines: ['Read before running: this can change or remove data.'], fontSize: 12, h: lineH(12) + 4 });
    const rows = Math.min(codeRows(step.cmd, CODE_CHARS), MAX_CODE_ROWS);
    parts.push({ kind: 'code', text: step.cmd, rows, h: codeHeight(rows) });
  }
  if (step.out) {
    const label = step.outKind === 'recorded' ? 'Real output (recorded by running these commands)' : 'Example output (yours will differ)';
    parts.push({ kind: 'label', lines: [label], fontSize: 11, h: lineH(11) + 2 });
    const rows = Math.min(codeRows(step.out, CODE_CHARS), MAX_OUT_ROWS);
    parts.push({ kind: 'out', text: step.out, rows, h: codeHeight(rows) });
  }
  if (step.note) {
    const lines = wrapText(`Note: ${step.note}`, TEXT_CHARS + 4);
    parts.push({ kind: 'note', lines, fontSize: 12, h: lines.length * lineH(12) + 4 });
  }
  return parts;
}

/** Build the elements of one workflow with its frame's top-left corner at (x, y). */
export function buildWorkflow(wf, topic, origin = { x: 0, y: 0 }) {
  const L = WF_LAYOUT;
  const instanceId = uid('wf');
  const tag = { workflowId: wf.id, wfInstance: instanceId };
  const color = topic.color || '#2563eb';
  const steps = wf.steps;
  const cols = Math.min(L.cols, Math.max(1, steps.length));
  const rows = Math.ceil(steps.length / cols);
  const titleW = L.cardW - 2 * CARD_PAD - 116;

  const cards = steps.map((step) => {
    const titleLines = wrapText(step.title, 28).slice(0, 2);
    const headH = Math.max(48, titleLines.length * lineH(17) + 12);
    const parts = stepParts(step);
    const bodyH = parts.reduce((s, p) => s + p.h + 8, 0);
    return { step, titleLines, headH, parts, h: CARD_PAD + headH + 8 + bodyH + CARD_PAD - 8 };
  });
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(...cards.slice(r * cols, r * cols + cols).map((c) => c.h)));

  const frameW = L.pad * 2 + cols * L.cardW + (cols - 1) * L.gapX;
  const frameH = L.headerH + rowH.reduce((a, b) => a + b, 0) + (rows - 1) * L.gapY + L.pad + 24;
  const frame = createElement('frame', {
    ...tag,
    x: origin.x,
    y: origin.y,
    w: frameW,
    h: frameH,
    text: wf.title,
    slideOrder: 1,
    teacherNotes: `${wf.summary}\n\nSteps:\n${steps.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}`,
  });
  const out = [frame];
  const add = (el, stepNo = 0) => {
    el.revealStep = stepNo;
    Object.assign(el, tag, stepNo ? { wfStep: stepNo } : {});
    out.push(el);
    return el;
  };

  const sub = wrapText(`${topic.name} \u00b7 ${LEVEL_NAMES[wf.level] || 'Beginner'} \u00b7 ${steps.length} steps. ${wf.summary}`, Math.floor((frameW - 2 * L.pad) / 7.6));
  add(createElement('text', { x: origin.x + L.pad, y: origin.y + 52, w: frameW - 2 * L.pad, h: sub.length * lineH(15), text: sub.join('\n'), fontSize: 15, textAlign: 'left', autoGrow: false, textColor: '#475569' }));
  add(createElement('text', { x: origin.x + L.pad, y: origin.y + 52 + sub.length * lineH(15) + 8, w: frameW - 2 * L.pad, h: lineH(13), text: 'Present (F6): Next \u25b6 reveals one step at a time, \u23ed Full flow shows every step. Select any code block and use "Open expanded code editor" to copy.', fontSize: 13, textAlign: 'left', autoGrow: false, textColor: '#64748b' }));

  const backgrounds = [];
  cards.forEach((card, i) => {
    const n = i + 1;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = origin.x + L.pad + col * (L.cardW + L.gapX);
    const cy = origin.y + L.headerH + rowH.slice(0, row).reduce((a, b) => a + b, 0) + row * L.gapY;
    const bg = add(createElement('rounded-rect', { x: cx, y: cy, w: L.cardW, h: rowH[row], fill: '#ffffff', stroke: card.step.risk ? '#d97706' : color, strokeWidth: 2, text: '' }), n);
    backgrounds.push(bg);
    add(createElement('stamp', { stampKind: 'steps', badgeValue: n, x: cx + CARD_PAD, y: cy + CARD_PAD, w: 40, h: 40 }), n);
    const big = isCardStencil(card.step.icon);
    add(createElement('stencil', { stencilId: card.step.icon, x: cx + CARD_PAD + 48, y: cy + CARD_PAD - (big ? 6 : 0), w: big ? 56 : 44, h: big ? 52 : 44, text: '', stroke: color }), n);
    add(createElement('text', { x: cx + CARD_PAD + 112, y: cy + CARD_PAD + 4, w: titleW, h: card.titleLines.length * lineH(17), text: card.titleLines.join('\n'), fontSize: 17, textAlign: 'left', autoGrow: false, textColor: '#0f172a' }), n);

    let y = cy + CARD_PAD + card.headH + 8;
    const innerW = L.cardW - 2 * CARD_PAD;
    for (const p of card.parts) {
      if (p.kind === 'code' || p.kind === 'out') {
        add(createElement('code', { x: cx + CARD_PAD, y, w: innerW, h: p.h, text: p.text, fontSize: 12, codeWrap: true, highlightLines: '', name: p.kind === 'code' ? 'Commands' : 'Output' }), n);
      } else {
        const tone = { warn: '#b45309', note: '#64748b', label: '#64748b', viz: '#1d4ed8', text: '#1e293b' }[p.kind];
        add(createElement('text', { x: cx + CARD_PAD, y, w: innerW, h: p.h - 4, text: p.lines.join('\n'), fontSize: p.fontSize, textAlign: 'left', autoGrow: false, textColor: tone }), n);
      }
      y += p.h + 8;
    }
  });

  const arrows = [];
  for (let i = 0; i + 1 < backgrounds.length; i++) {
    const sameRow = Math.floor(i / cols) === Math.floor((i + 1) / cols);
    const arrow = createElement('arrow', { routing: 'orthogonal', endArrow: 'arrow', stroke: color, strokeWidth: 2.5, text: '' });
    bindConnectorEndpoint(arrow, 'start', backgrounds[i], sameRow ? 'right' : 'bottom');
    bindConnectorEndpoint(arrow, 'end', backgrounds[i + 1], sameRow ? 'left' : 'top');
    add(arrow, i + 2);
    arrows.push(arrow);
  }
  return { elements: out, frame, instanceId, maxStep: steps.length, backgrounds, arrows, size: { w: frameW, h: frameH } };
}
