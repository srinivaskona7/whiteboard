// tests/code-snippet.test.js — a library command becomes a board code block.
import test from 'node:test';
import assert from 'node:assert/strict';
import { codeSnippetText, createCodeSnippetElement } from '../scene/code-snippet.js';
import { validateElementsBatch } from '../scene/geometry.js';
import { ensurePackCommandsLoaded } from '../stencils/index.js';

test('the title and note ride along as shell comments above the command', () => {
  assert.equal(
    codeSnippetText({ title: 'List files', code: 'ls -la', note: 'Shows hidden files' }),
    '# List files\n# Shows hidden files\nls -la'
  );
  assert.equal(codeSnippetText({ code: 'pwd' }), 'pwd', 'no title and no note adds no comment lines');
});

test('a risky command keeps its warning, with a fallback when the note is empty', () => {
  const withNote = codeSnippetText({ title: 'Wipe', code: 'rm -rf build', note: 'Deletes the build folder', risky: true });
  assert.match(withNote, /^# Wipe\n# Read before running: Deletes the build folder\nrm -rf build$/);
  const bare = codeSnippetText({ title: 'Wipe', code: 'rm -rf build', risky: true });
  assert.match(bare, /# Read before running: this changes or deletes things/);
});

test('multi-line titles and notes collapse to one comment line each', () => {
  const text = codeSnippetText({ title: 'A\nrm -rf /', code: 'echo hi', note: 'line one\nline   two' });
  assert.equal(text.split('\n').length, 3, 'a newline in the title must not smuggle in a second command line');
  assert.equal(text, '# A rm -rf /\n# line one line two\necho hi');
});

test('no command, no element', () => {
  assert.equal(createCodeSnippetElement({ title: 'x', code: '   ' }), null);
  assert.equal(createCodeSnippetElement({}), null);
  assert.equal(createCodeSnippetElement(), null);
});

test('the element is a wrapped code block at the given origin, sized to its text', () => {
  const el = createCodeSnippetElement({ title: 'List files', code: 'ls -la /var/log && echo done', note: 'Shows hidden files' }, { x: 10, y: 20 });
  assert.equal(el.type, 'code');
  assert.equal(el.codeWrap, true);
  assert.deepEqual([el.x, el.y], [10, 20]);
  assert.equal(el.name, 'List files');
  assert.equal(el.w, 300, 'short text keeps the 300 px minimum width');
  assert.equal(el.h, Math.ceil(3 * 13 * 1.45 + 52), 'three rows at 13 px, 1.45 line height, 52 px of chrome');
});

test('long lines widen the block up to 640 px, then wrap and grow it taller', () => {
  const long = createCodeSnippetElement({ title: 'Long', code: 'a '.repeat(400) }, { x: 0, y: 0 });
  assert.equal(long.w, 640);
  const rows = Math.ceil(800 / Math.floor((640 - 52) / (13 * 0.6)));
  assert.ok(long.h >= Math.ceil((rows + 1) * 13 * 1.45 + 52), `height ${long.h} must hold ${rows} wrapped rows plus the title`);
});

test('an empty title falls back to a readable element name', () => {
  assert.equal(createCodeSnippetElement({ code: 'pwd' }).name, 'Command');
  assert.equal(createCodeSnippetElement({ title: 'x'.repeat(200), code: 'pwd' }).name.length, 80);
});

test('all 183 library commands build valid elements', async () => {
  const { PACK_COMMANDS } = await ensurePackCommandsLoaded();
  assert.equal(PACK_COMMANDS.length, 183);
  for (const c of PACK_COMMANDS) {
    const el = createCodeSnippetElement({ title: c.title, code: c.cmd, note: c.note, risky: c.risky }, { x: 40, y: 40 });
    assert.ok(el, `${c.id} builds an element`);
    const check = validateElementsBatch([el]);
    assert.ok(check.valid, `${c.id}: ${check.reason}`);
    assert.ok(el.text.endsWith(c.cmd.trim()), `${c.id}: the command is the last line, unaltered`);
    if (c.risky) assert.match(el.text, /Read before running/, `${c.id} keeps its warning`);
  }
});
