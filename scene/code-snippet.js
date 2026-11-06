// scene/code-snippet.js — a library command as a board code block. The title
// and note ride along as shell comments, so the block still explains itself
// once it is on the board; risky commands keep their "read before running"
// warning.
import { createElement, autoGrowShapeForText } from './model.js';

const FONT_SIZE = 13;
const MIN_W = 300;
const MAX_W = 640;

const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export function codeSnippetText({ title = '', code = '', note = '', risky = false } = {}) {
  const cmd = String(code || '').trim();
  if (!cmd) return '';
  const comments = [];
  if (oneLine(title)) comments.push(`# ${oneLine(title)}`);
  if (risky) comments.push(`# Read before running: ${oneLine(note) || 'this changes or deletes things'}`);
  else if (oneLine(note)) comments.push(`# ${oneLine(note)}`);
  return [...comments, cmd].join('\n');
}

// A wrapped code element at (x, y): width follows the longest line (0.6em per
// monospace character, 300–640 px), height comes from the model's own
// wrapped-code fit. Returns null when there is no command.
export function createCodeSnippetElement(snippet = {}, { x = 0, y = 0 } = {}) {
  const text = codeSnippetText(snippet);
  if (!text) return null;
  const longest = Math.max(...text.split('\n').map((l) => l.length));
  const w = Math.min(MAX_W, Math.max(MIN_W, Math.ceil(longest * FONT_SIZE * 0.6) + 60));
  const el = createElement('code', {
    x,
    y,
    w,
    h: 60,
    text,
    fontSize: FONT_SIZE,
    codeWrap: true,
    highlightLines: '',
    name: oneLine(snippet.title).slice(0, 80) || 'Command',
  });
  autoGrowShapeForText(el, text);
  return el;
}
