// scene/workflow-builder.js — turn one workflow (ordered steps with text, commands and output)
// into native whiteboard elements. Pure: no DOM, no timers, so it can be tested in Node.
//
// Every step becomes a colourful card (header band, number badge, icon, explanation, copyable code
// block, output, and — for the hello.txt journey — a four-box "where is my file now?" panel that
// was recorded from a real run). All elements of step N carry revealStep N, so Present mode's
// Next/Previous reveals the flow one step at a time and "Full flow" shows everything.
import { createElement, uid } from './model.js';
import { bindConnectorEndpoint } from './bindings.js';

export const WF_LAYOUT = Object.freeze({ cols: 3, cardW: 440, gapX: 72, gapY: 84, pad: 40, headerH: 128 });
export const LEVEL_NAMES = ['', 'Beginner', 'Intermediate', 'Advanced', 'Expert'];
// [border, background] for the four places a file can be.
export const STATE_COLORS = Object.freeze({
  working: ['#d97706', '#fef3c7'],
  staging: ['#2563eb', '#dbeafe'],
  local: ['#16a34a', '#dcfce7'],
  remote: ['#9333ea', '#f3e8ff'],
});

const CARD_PAD = 14;
const INNER_W = WF_LAYOUT.cardW - 2 * CARD_PAD;
const BOX_W = (INNER_W - 8) / 2;
const TEXT_CHARS = 52; // 14px sans across the card
const CODE_CHARS = 50; // 12px mono across the code box
const STATE_CHARS = 28; // 11px mono inside one state box
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

/** Mix a #rrggbb colour with white. amount 0 = the colour, 1 = white. */
export function tint(hex, amount = 0.85) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return '#f1f5f9';
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const to = (v) => v.toString(16).padStart(2, '0');
  return `#${to(mix((n >> 16) & 255))}${to(mix((n >> 8) & 255))}${to(mix(n & 255))}`;
}

const codeRows = (text, chars) =>
  String(text)
    .split('\n')
    .reduce((n, l) => n + Math.max(1, Math.ceil(l.length / chars)), 0);
const codeHeight = (rows) => Math.round(38 + rows * 17.4 + 8);
const isCardStencil = (id) => !String(id).startsWith('lucide-') && !String(id).startsWith('wf-');
const clip = (s) => (s.length > STATE_CHARS ? `${s.slice(0, STATE_CHARS - 1)}\u2026` : s);

/** The four boxes (working folder, staging, local repo, remote) for one recorded state. */
export function stateBoxes(state) {
  const working = [];
  for (const [name, lines] of state.working) {
    working.push(name);
    lines.slice(0, 4).forEach((l) => working.push(`  ${l}`));
  }
  if (!state.working.length) working.push('(empty folder)');
  state.status.filter(Boolean).slice(0, 2).forEach((l) => working.push(`status: ${l}`));

  const staging = [state.staged.length ? `staged: ${state.staged[0].replace('\t', ' ')}` : 'nothing new staged'];
  for (const [name, lines] of state.staging) {
    staging.push(name);
    if (!lines.length && state.status.some((l) => /^(UU|AA|DU|UD)/.test(l))) staging.push('  (conflict, unmerged)');
    lines.slice(0, 3).forEach((l) => staging.push(`  ${l}`));
  }
  if (!state.staging.length) staging.push('(index is empty)');
  if (state.norepo) staging.splice(0, staging.length, '(no repository yet)', 'run git init first');

  let local = state.local.length ? state.local.slice(0, 7) : [`on ${state.branch || 'main'}: no commits yet`];
  if (state.norepo) local = ['(not a repository yet)', 'git init has not run'];

  let remote;
  if (state.remote === null) remote = ['(no remote yet)'];
  else {
    remote = state.remote.length ? state.remote.slice(0, 4) : ['(remote is empty)'];
    if (state.remoteFile.length) {
      remote.push('main:hello.txt');
      state.remoteFile.slice(0, 3).forEach((l) => remote.push(`  ${l}`));
    }
  }
  const make = (key, title, lines) => ({ key, title, lines: lines.map(clip), color: STATE_COLORS[key][0], tint: STATE_COLORS[key][1] });
  const head = state.hash ? ` HEAD ${state.hash}` : '';
  return [
    make('working', 'Working folder', working),
    make('staging', 'Staging area', staging),
    make('local', `Local repo${head}`, local),
    make('remote', 'Remote server', remote),
  ];
}

const boxHeight = (b) => Math.round(24 + b.lines.length * 14.5 + 8);

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
  if (step.state) {
    const boxes = stateBoxes(step.state);
    const rows = [
      { boxes: boxes.slice(0, 2), h: Math.max(...boxes.slice(0, 2).map(boxHeight)) },
      { boxes: boxes.slice(2), h: Math.max(...boxes.slice(2).map(boxHeight)) },
    ];
    parts.push({ kind: 'state', rows, h: 22 + rows[0].h + 8 + rows[1].h });
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
  // "When do we use this?" panel: 2-3 question/answer pairs, visible from the first slide.
  const qaPairs = Array.isArray(wf.qna) ? wf.qna : [];
  const qaW = frameW - 2 * L.pad;
  const qaChars = Math.max(30, Math.floor((qaW - 40) / 7.1));
  const qaRows = qaPairs.map((p) => ({ q: wrapText(`Q: ${p.q}`, qaChars), a: wrapText(`A: ${p.a}`, qaChars) }));
  const qaBodyH = qaRows.reduce((sum, r) => sum + r.q.length * lineH(14) + r.a.length * lineH(13) + 14, 0);
  const qaH = qaRows.length ? 40 + qaBodyH + 12 : 0;
  const headerTotal = L.headerH + (qaH ? qaH + 24 : 0);

  // Previous / next module strip at the bottom of the board.
  const nav = wf.nav || null;
  const navLines = nav
    ? wrapText(
        `\u25c0 Previous module: ${nav.prev ? nav.prev.title : 'this is the first one'}      Next module \u25b6 ${nav.next ? nav.next.title : 'this is the last one'}`,
        Math.max(40, Math.floor(qaW / 7.6))
      )
    : [];
  const navH = nav ? navLines.length * lineH(15) + 34 : 0;

  const contentH = rowH.reduce((a, b) => a + b, 0) + (rows - 1) * L.gapY;
  const frameH = headerTotal + contentH + L.pad + 24 + navH;
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

  const modulePart = nav ? `Module ${nav.pos} of ${nav.of} \u00b7 ` : '';
  const sub = wrapText(`${modulePart}${topic.name} \u00b7 ${LEVEL_NAMES[wf.level] || 'Beginner'} \u00b7 ${steps.length} steps. ${wf.summary}`, Math.floor((frameW - 2 * L.pad) / 7.6));
  add(createElement('text', { x: origin.x + L.pad, y: origin.y + 52, w: frameW - 2 * L.pad, h: sub.length * lineH(15), text: sub.join('\n'), fontSize: 15, textAlign: 'left', autoGrow: false, textColor: '#475569' }));
  add(createElement('text', { x: origin.x + L.pad, y: origin.y + 52 + sub.length * lineH(15) + 8, w: frameW - 2 * L.pad, h: lineH(13), text: 'Present (F6): Next \u25b6 reveals one step at a time, \u23ed Full flow shows every step. Select any code block and use "Open expanded code editor" to copy.', fontSize: 13, textAlign: 'left', autoGrow: false, textColor: '#64748b' }));

  if (qaH) {
    const qx = origin.x + L.pad;
    let qy = origin.y + L.headerH;
    add(createElement('rounded-rect', { x: qx, y: qy, w: qaW, h: qaH, fill: tint(color, 0.93), stroke: color, strokeWidth: 1.5, text: '' }));
    add(createElement('text', { x: qx + 18, y: qy + 10, w: qaW - 36, h: lineH(15), text: 'When do we use this? Quick questions and answers', fontSize: 15, textAlign: 'left', autoGrow: false, textColor: color }));
    qy += 40;
    qaRows.forEach((r) => {
      const qh = r.q.length * lineH(14);
      const ah = r.a.length * lineH(13);
      add(createElement('text', { x: qx + 18, y: qy, w: qaW - 36, h: qh, text: r.q.join('\n'), fontSize: 14, textAlign: 'left', autoGrow: false, textColor: '#0f172a' }));
      add(createElement('text', { x: qx + 18, y: qy + qh, w: qaW - 36, h: ah, text: r.a.join('\n'), fontSize: 13, textAlign: 'left', autoGrow: false, textColor: '#475569' }));
      qy += qh + ah + 14;
    });
  }

  const backgrounds = [];
  cards.forEach((card, i) => {
    const n = i + 1;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = origin.x + L.pad + col * (L.cardW + L.gapX);
    const cy = origin.y + headerTotal + rowH.slice(0, row).reduce((a, b) => a + b, 0) + row * L.gapY;
    const accent = card.step.risk ? '#d97706' : color;
    const bg = add(createElement('rounded-rect', { x: cx, y: cy, w: L.cardW, h: rowH[row], fill: '#ffffff', stroke: accent, strokeWidth: 2, text: '' }), n);
    backgrounds.push(bg);
    const band = tint(accent, 0.86);
    add(createElement('rounded-rect', { x: cx + 3, y: cy + 3, w: L.cardW - 6, h: CARD_PAD + card.headH + 2, fill: band, stroke: band, strokeWidth: 1, text: '' }), n);
    add(createElement('stamp', { stampKind: 'steps', badgeValue: n, x: cx + CARD_PAD, y: cy + CARD_PAD, w: 40, h: 40 }), n);
    const big = isCardStencil(card.step.icon);
    add(createElement('stencil', { stencilId: card.step.icon, x: cx + CARD_PAD + 48, y: cy + CARD_PAD - (big ? 6 : 0), w: big ? 56 : 44, h: big ? 52 : 44, text: '', stroke: accent }), n);
    add(createElement('text', { x: cx + CARD_PAD + 112, y: cy + CARD_PAD + 4, w: titleW, h: card.titleLines.length * lineH(17), text: card.titleLines.join('\n'), fontSize: 17, textAlign: 'left', autoGrow: false, textColor: '#0f172a' }), n);

    let y = cy + CARD_PAD + card.headH + 8;
    for (const p of card.parts) {
      if (p.kind === 'code' || p.kind === 'out') {
        add(createElement('code', { x: cx + CARD_PAD, y, w: INNER_W, h: p.h, text: p.text, fontSize: 12, codeWrap: true, highlightLines: '', name: p.kind === 'code' ? 'Commands' : 'Output' }), n);
      } else if (p.kind === 'state') {
        add(createElement('text', { x: cx + CARD_PAD, y, w: INNER_W, h: 16, text: 'Where is the file now?  (Remote = GitHub, GitLab or Bitbucket)', fontSize: 11, textAlign: 'left', autoGrow: false, textColor: '#475569' }), n);
        let by = y + 22;
        for (const r of p.rows) {
          r.boxes.forEach((b, ci) => {
            const bx = cx + CARD_PAD + ci * (BOX_W + 8);
            add(createElement('rounded-rect', { x: bx, y: by, w: BOX_W, h: r.h, fill: b.tint, stroke: b.color, strokeWidth: 1.5, text: '' }), n);
            add(createElement('text', { x: bx + 8, y: by + 5, w: BOX_W - 16, h: 16, text: b.title, fontSize: 12, textAlign: 'left', autoGrow: false, textColor: b.color }), n);
            add(createElement('text', { x: bx + 8, y: by + 24, w: BOX_W - 16, h: b.lines.length * 14.5, text: b.lines.join('\n'), fontSize: 11, fontFamily: 'mono', textAlign: 'left', autoGrow: false, textColor: '#1e293b' }), n);
          });
          by += r.h + 8;
        }
      } else {
        const tone = { warn: '#b45309', note: '#64748b', label: '#64748b', viz: '#1d4ed8', text: '#1e293b' }[p.kind];
        add(createElement('text', { x: cx + CARD_PAD, y, w: INNER_W, h: p.h - 4, text: p.lines.join('\n'), fontSize: p.fontSize, textAlign: 'left', autoGrow: false, textColor: tone }), n);
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

  if (nav) {
    const ny = origin.y + headerTotal + contentH + 26;
    add(createElement('rounded-rect', { x: origin.x + L.pad, y: ny - 10, w: qaW, h: navLines.length * lineH(15) + 20, fill: tint(color, 0.92), stroke: color, strokeWidth: 1.5, text: '' }));
    add(createElement('text', { x: origin.x + L.pad + 16, y: ny, w: qaW - 32, h: navLines.length * lineH(15), text: navLines.join('\n'), fontSize: 15, textAlign: 'left', autoGrow: false, textColor: color }));
  }
  return { elements: out, frame, instanceId, maxStep: steps.length, backgrounds, arrows, size: { w: frameW, h: frameH } };
}
