// ui/library-topics-tab.js — the library's default "Topics" tab. Every icon,
// line glyph, command and workflow sits under a topic and a concept folder in
// learning order (stencils/library-topics.js), with one search box and one
// level filter across all of it. The topic list paints from the small static
// index; the 5 MB icon pack and the command set load the first time a topic
// opens or a search runs.
import { ALL_STENCILS, ensureIconPackLoaded, ensurePackCommandsLoaded, getStencilById, isStencilLoaded } from '../stencils/index.js';
import {
  LIBRARY_TOPICS,
  TOPIC_BY_ID,
  LEVEL_LABELS,
  buildTopicTree,
  summarizeTopics,
  searchLibrary,
  commandTopicId,
  workflowTopicId,
  matchesLevel,
} from '../stencils/library-topics.js';
import { WORKFLOW_INDEX } from '../templates/workflows-index.js';
import { escapeXml } from '../render/svg-export.js';

const PAGE = 120; // icons per "show more" step inside a folder
const SEARCH_ICON_CAP = 300; // icons rendered for one search
const PREVIEW_ROWS = 2; // icon rows per folder in a topic overview
const PREVIEW_LIST = 3; // commands / workflows shown in a topic overview

// folderId: '' = topic overview, a folder id, '@commands' or '@workflows'.
export const DEFAULT_TOPICS_STATE = Object.freeze({ topicId: '', folderId: '', q: '', level: 0, limit: PAGE, expanded: [], onlyTopic: false });

// View state survives tab switches and panel re-renders (like the Workflows tab).
const ui = { ...DEFAULT_TOPICS_STATE, expanded: new Set() };

const WORKFLOWS = WORKFLOW_INDEX.workflows;
const WORKFLOW_COLOR = Object.fromEntries(WORKFLOW_INDEX.topics.map((t) => [t.id, t.color]));

let dataReady = false;
let commands = [];
let loadToken = 0;
let treeCache = { size: -1, topics: null };

const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const plural = (n, one) => `${fmt(n)} ${n === 1 ? one : `${one}s`}`;

function loadData() {
  return Promise.all([ensureIconPackLoaded(), ensurePackCommandsLoaded()]).then(([, cmds]) => {
    commands = cmds.PACK_COMMANDS;
    dataReady = true;
  });
}

function topicTree() {
  if (treeCache.size !== ALL_STENCILS.length) {
    treeCache = { size: ALL_STENCILS.length, topics: buildTopicTree(ALL_STENCILS).topics };
  }
  return treeCache.topics;
}

// Folders (filtered to the level, empty ones dropped), commands, workflows and
// the learning path through them, which drives the table of contents and the
// previous/next stepper.
function topicData(topic, env) {
  const { level } = env.st;
  const folders = topicTree()
    .find((t) => t.id === topic.id)
    .folders.map((fo) => ({ id: fo.id, label: fo.label, items: fo.items.filter((s) => matchesLevel(s, level)) }))
    .filter((fo) => fo.items.length);
  const cmds = env.commands.filter((c) => commandTopicId(c) === topic.id && matchesLevel(c, level)).sort((a, b) => a.level - b.level);
  const wfs = WORKFLOWS.filter((w) => workflowTopicId(w) === topic.id && matchesLevel(w, level)).sort((a, b) => a.level - b.level);
  const path = [
    ...folders.map((fo) => ({ id: fo.id, label: fo.label, count: fo.items.length })),
    ...(cmds.length ? [{ id: '@commands', label: 'Commands', count: cmds.length }] : []),
    ...(wfs.length ? [{ id: '@workflows', label: 'Workflows', count: wfs.length }] : []),
  ];
  return { folders, cmds, wfs, path };
}

// ---- markup helpers ----

// A line icon in the current text colour (the topic colour comes from CSS).
function lineIcon(stencilId, px) {
  const s = isStencilLoaded(stencilId) ? getStencilById(stencilId) : null;
  if (!s?.svgInner) return '';
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.svgInner}</svg>`;
}

// Same three preview paths as the other library tabs: pack tiles and glyphs
// carry a full <svg>, line icons inner 24x24 markup, cards render via toSvg.
function stencilPreview(s, px) {
  if (typeof s.svgInner === 'string' && s.svgInner.startsWith('<svg')) {
    return s.svgInner.replace('<svg ', `<svg width="${px}" height="${px}" aria-hidden="true" `);
  }
  if (typeof s.svgInner === 'string' && s.svgInner) {
    return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g color="#1e293b">${s.svgInner}</g></svg>`;
  }
  const box = px - 8;
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g color="#1e293b">${s.toSvg(4, 4, box, box, 'fill="#ffffff" stroke="#334155" stroke-width="1.5"')}</g></svg>`;
}

const levelChip = (level) => (level ? `<span class="wb-level-chip" data-level="${level}">${LEVEL_LABELS[level]}</span>` : '');

function iconCard(s, env) {
  const fav = env.favorites.has(s.id);
  const level = s.level ? ` · ${LEVEL_LABELS[s.level]}` : '';
  return `
    <div class="wb-stencil-item" role="option" tabindex="0" draggable="true" data-stencil="${escapeXml(s.id)}" title="${escapeXml(s.name)}${level} — click to place, drag onto the canvas">
      <button type="button" class="wb-fav-star ${fav ? 'active' : ''}" data-fav-stencil="${escapeXml(s.id)}" aria-label="${fav ? 'Remove from favorites' : 'Add to favorites'}">${fav ? '★' : '☆'}</button>
      ${stencilPreview(s, env.layout.size)}
      <span>${escapeXml(s.name)}</span>
    </div>`;
}

const iconGrid = (items, env, label) =>
  `<div class="wb-stencil-grid ${env.layout.gridClass}" role="listbox" aria-label="${escapeXml(label)}">${items.map((s) => iconCard(s, env)).join('')}</div>`;

function commandCard(c) {
  const icon = c.icon && isStencilLoaded(c.icon) ? getStencilById(c.icon) : null;
  const note = c.risky
    ? `<p class="wb-risky" role="note">⚠ Read before running: ${escapeXml(c.note || 'this changes or deletes things.')}</p>`
    : c.note
      ? `<p class="wb-muted">${escapeXml(c.note)}</p>`
      : '';
  return `
    <div class="wb-cmd-card">
      <div class="wb-cmd-head">
        ${icon ? `<button type="button" class="wb-cmd-icon" data-stencil="${escapeXml(icon.id)}" title="Place the linked icon: ${escapeXml(icon.name)}" aria-label="Place icon ${escapeXml(icon.name)}">${stencilPreview(icon, 28)}</button>` : ''}
        <div class="wb-cmd-title"><strong>${escapeXml(c.title)}</strong>${levelChip(c.level)}</div>
      </div>
      ${note}
      <pre class="wb-cmd-code"><code>${escapeXml(c.cmd)}</code></pre>
      <div class="wb-cmd-actions">
        <button type="button" class="wb-btn wb-sm" data-cmd-copy="${escapeXml(c.id)}">Copy</button>
        <button type="button" class="wb-btn wb-sm wb-primary" data-cmd-insert="${escapeXml(c.id)}" title="Add as a code block on the board">Insert on board</button>
      </div>
    </div>`;
}

// Matches the Workflows tab card, so the dot colour means the same thing.
function workflowCard(w) {
  return `
    <div class="wb-template-card wb-topic-wf">
      <div>
        <strong>${escapeXml(w.title)}</strong>
        <p class="wb-muted"><span style="color:${escapeXml(WORKFLOW_COLOR[w.topic] || '#2563eb')}">●</span> ${escapeXml(LEVEL_LABELS[w.level] || '')} · ${plural(w.steps, 'step')}</p>
        <p class="wb-muted">${escapeXml(w.summary)}</p>
      </div>
      <div class="wb-topic-wf-actions">
        <button type="button" class="wb-btn wb-sm wb-primary" data-wf-insert="${escapeXml(w.id)}">Insert</button>
        <button type="button" class="wb-btn wb-sm" data-wf-present="${escapeXml(w.id)}" title="Insert, then present it step by step">Insert &amp; present</button>
      </div>
    </div>`;
}

const linkButton = (attr, value, label) => `<button type="button" class="wb-topic-link" ${attr}="${escapeXml(value)}">${escapeXml(label)}</button>`;

// A section header; when `folderId` is given the title opens that folder.
function sectionHead(label, count, { num = 0, folderId = '', more = '' } = {}) {
  const title = `${num ? `<span class="wb-topic-num">${num}</span>` : ''}<span>${escapeXml(label)}</span>`;
  return `
    <div class="wb-lib-category-header wb-topic-section-head">
      ${folderId ? `<button type="button" class="wb-topic-section-title" data-folder="${escapeXml(folderId)}">${title}</button>` : `<span class="wb-topic-section-title">${title}</span>`}
      <span class="wb-topic-section-side"><span class="wb-topic-count">${fmt(count)}</span>${more}</span>
    </div>`;
}

// Items grouped by level (0 = not leveled), ascending.
function byLevelGroups(items) {
  const groups = new Map();
  for (const it of items) {
    const l = it.level || 0;
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(it);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]);
}

function topicMeta(s) {
  const parts = [s.icons ? plural(s.icons, 'icon') : '', s.commands ? plural(s.commands, 'command') : '', s.workflows ? plural(s.workflows, 'workflow') : ''];
  return parts.filter(Boolean).join(' · ') || 'Nothing at this level';
}

const atLevel = (level) => (level ? ` at ${LEVEL_LABELS[level].toLowerCase()} level` : '');

function crumb(topic, folderLabel = '') {
  const parts = [`<button type="button" data-topic-home>‹ All topics</button>`];
  if (topic && folderLabel) {
    parts.push(`<button type="button" data-topic="${escapeXml(topic.id)}">${escapeXml(topic.label)}</button>`);
    parts.push(`<span aria-current="page">${escapeXml(folderLabel)}</span>`);
  } else if (topic) {
    parts.push(`<span aria-current="page">${escapeXml(topic.label)}</span>`);
  }
  return `<nav class="wb-topic-crumb" aria-label="Library location">${parts.join('<span class="wb-topic-sep" aria-hidden="true">/</span>')}</nav>`;
}

// ---- views ----

function homeView(env) {
  const { level } = env.st;
  const summary = summarizeTopics({ level }, { staticStencils: ALL_STENCILS, workflows: WORKFLOWS });
  const total = summary.reduce((t, s) => ({ icons: t.icons + s.icons, commands: t.commands + s.commands, workflows: t.workflows + s.workflows }), {
    icons: 0,
    commands: 0,
    workflows: 0,
  });
  return `
    <p class="wb-muted wb-topic-intro">${LIBRARY_TOPICS.length} topics in learning order${atLevel(level)}: ${plural(total.icons, 'icon')}, ${plural(total.commands, 'command')} and ${plural(total.workflows, 'workflow')}. Each topic runs from the basics to expert material.</p>
    <ol class="wb-topic-list" aria-label="Topics in learning order">
      ${LIBRARY_TOPICS.map((t, i) => {
        const s = summary[i];
        const empty = s.icons + s.commands + s.workflows === 0;
        return `
        <li><button type="button" class="wb-topic-row${empty ? ' wb-topic-empty' : ''}" data-topic="${escapeXml(t.id)}" style="--topic-color:${escapeXml(t.color)}" title="${escapeXml(t.blurb)}">
          <span class="wb-topic-num">${i + 1}</span>
          <span class="wb-topic-icon">${lineIcon(t.icon, 18)}</span>
          <span class="wb-topic-text"><strong>${escapeXml(t.label)}</strong><span class="wb-topic-meta">${topicMeta(s)}</span></span>
          <span class="wb-topic-chevron" aria-hidden="true">›</span>
        </button></li>`;
      }).join('')}
    </ol>`;
}

function topicHero(topic, meta) {
  return `
    <div class="wb-topic-hero" style="--topic-color:${escapeXml(topic.color)}">
      <span class="wb-topic-icon">${lineIcon(topic.icon, 22)}</span>
      <div>
        <h3 tabindex="-1" data-focus-first>${escapeXml(topic.label)}</h3>
        <p class="wb-muted">${escapeXml(topic.blurb)}</p>
        <p class="wb-topic-meta">${meta}</p>
      </div>
    </div>`;
}

function topicOverview(topic, env) {
  const { level } = env.st;
  const { folders, cmds, wfs, path } = topicData(topic, env);
  const preview = env.layout.cols * PREVIEW_ROWS;
  const icons = folders.reduce((n, fo) => n + fo.items.length, 0);
  const meta = topicMeta({ icons, commands: cmds.length, workflows: wfs.length }) + (level ? ` · ${LEVEL_LABELS[level]}` : '');
  if (!path.length) {
    return `${crumb(topic)}${topicHero(topic, meta)}<p class="wb-muted">Nothing in ${escapeXml(topic.label)}${atLevel(level)}. Choose another level above.</p>`;
  }
  const num = (id) => path.findIndex((p) => p.id === id) + 1;
  const allLink = (id, n, limit) => (n > limit ? linkButton('data-folder', id, `All ${fmt(n)} ›`) : '');
  return `
    ${crumb(topic)}
    ${topicHero(topic, meta)}
    <ol class="wb-topic-toc" aria-label="${escapeXml(topic.label)} in learning order">
      ${path
        .map(
          (p, i) => `
        <li><button type="button" data-folder="${escapeXml(p.id)}">
          <span class="wb-topic-num">${i + 1}</span><span class="wb-topic-toc-label">${escapeXml(p.label)}</span><span class="wb-topic-count">${fmt(p.count)}</span>
        </button></li>`
        )
        .join('')}
    </ol>
    ${folders
      .map(
        (fo) => `
      <section class="wb-lib-category-section">
        ${sectionHead(fo.label, fo.items.length, { num: num(fo.id), folderId: fo.id, more: allLink(fo.id, fo.items.length, preview) })}
        ${iconGrid(fo.items.slice(0, preview), env, fo.label)}
      </section>`
      )
      .join('')}
    ${
      cmds.length
        ? `<section class="wb-lib-category-section">
        ${sectionHead('Commands', cmds.length, { num: num('@commands'), folderId: '@commands', more: allLink('@commands', cmds.length, PREVIEW_LIST) })}
        <div class="wb-cmd-list">${cmds.slice(0, PREVIEW_LIST).map(commandCard).join('')}</div>
      </section>`
        : ''
    }
    ${
      wfs.length
        ? `<section class="wb-lib-category-section">
        ${sectionHead('Workflows', wfs.length, { num: num('@workflows'), folderId: '@workflows', more: allLink('@workflows', wfs.length, PREVIEW_LIST) })}
        <div class="wb-template-list">${wfs.slice(0, PREVIEW_LIST).map(workflowCard).join('')}</div>
      </section>`
        : ''
    }`;
}

function folderView(topic, env) {
  const { folderId, level, limit } = env.st;
  const { folders, cmds, wfs, path } = topicData(topic, env);
  const at = path.findIndex((p) => p.id === folderId);
  const fallbackLabel =
    folderId === '@commands' ? 'Commands' : folderId === '@workflows' ? 'Workflows' : topic.folders.find((fo) => fo.id === folderId)?.label || 'Folder';
  const here = at >= 0 ? path[at] : { id: folderId, label: fallbackLabel, count: 0 };
  const prev = at > 0 ? path[at - 1] : null;
  const next = at >= 0 && at < path.length - 1 ? path[at + 1] : null;
  const stepper = `
    <div class="wb-topic-stepper">
      ${prev ? `<button type="button" class="wb-btn wb-sm" data-folder="${escapeXml(prev.id)}" title="Previous: ${escapeXml(prev.label)}">‹ ${escapeXml(prev.label)}</button>` : '<span></span>'}
      ${next ? `<button type="button" class="wb-btn wb-sm" data-folder="${escapeXml(next.id)}" title="Next: ${escapeXml(next.label)}">${escapeXml(next.label)} ›</button>` : '<span></span>'}
    </div>`;

  let body;
  if (at < 0) {
    body = `<p class="wb-muted">Nothing in ${escapeXml(here.label)}${atLevel(level)}.</p>`;
  } else if (folderId === '@commands') {
    body = byLevelGroups(cmds)
      .map(([l, list]) => `${sectionHead(LEVEL_LABELS[l] || 'General', list.length)}<div class="wb-cmd-list">${list.map(commandCard).join('')}</div>`)
      .join('');
  } else if (folderId === '@workflows') {
    body = byLevelGroups(wfs)
      .map(([l, list]) => `${sectionHead(LEVEL_LABELS[l] || 'General', list.length)}<div class="wb-template-list">${list.map(workflowCard).join('')}</div>`)
      .join('');
  } else {
    const items = folders.find((fo) => fo.id === folderId).items;
    const shown = items.slice(0, limit);
    const groups = byLevelGroups(shown);
    const leveled = groups.some(([l]) => l > 0);
    body =
      groups.map(([l, list]) => `${leveled ? sectionHead(LEVEL_LABELS[l] || 'General', list.length) : ''}${iconGrid(list, env, here.label)}`).join('') +
      (items.length > shown.length
        ? `<button type="button" class="wb-btn wb-sm wb-topic-more" data-more>Show ${fmt(Math.min(PAGE, items.length - shown.length))} more (${fmt(items.length - shown.length)} left)</button>`
        : '');
  }
  return `
    ${crumb(topic, here.label)}
    <div class="wb-topic-folder-head" style="--topic-color:${escapeXml(topic.color)}">
      <h3 tabindex="-1" data-focus-first>${escapeXml(here.label)}</h3>
      <span class="wb-muted">${at >= 0 ? `${at + 1} of ${path.length} · ${fmt(here.count)}` : ''}</span>
    </div>
    ${path.length > 1 ? stepper : ''}
    ${body}
    ${path.length > 1 && at >= 0 ? stepper : ''}`;
}

function searchView(env) {
  const { q, level, topicId, onlyTopic, expanded } = env.st;
  const topic = topicId ? TOPIC_BY_ID.get(topicId) : null;
  const scoped = Boolean(topic && onlyTopic);
  const r = searchLibrary({ query: q, level, topicId: scoped ? topic.id : '' }, { stencils: ALL_STENCILS, commands: env.commands, workflows: WORKFLOWS });
  // Inside a topic, its own results come first; the rest keep map order.
  const iconGroups = topic && !scoped ? [...r.icons.filter((g) => g.topicId === topic.id), ...r.icons.filter((g) => g.topicId !== topic.id)] : r.icons;
  const scopeLine = topic
    ? `<p class="wb-muted wb-topic-scope">${
        scoped
          ? `Only ${escapeXml(topic.label)} · ${linkButton('data-scope', 'all', 'Search all topics')}`
          : `All topics · ${linkButton('data-scope', 'topic', `Only ${topic.label}`)}`
      }</p>`
    : '';
  if (r.total === 0) {
    return `${scopeLine}<p class="wb-muted" role="status">No icons, commands or workflows match “${escapeXml(q.trim())}”${atLevel(level)}.</p>`;
  }

  const perGroup = env.layout.cols * PREVIEW_ROWS;
  let rendered = 0;
  const groupHtml = [];
  for (const g of iconGroups) {
    if (rendered >= SEARCH_ICON_CAP) break;
    const key = `${g.topicId}/${g.folderId}`;
    const open = expanded.has(key);
    const take = Math.min(open ? g.items.length : perGroup, SEARCH_ICON_CAP - rendered);
    rendered += take;
    const label = `${TOPIC_BY_ID.get(g.topicId).label} › ${g.label}`;
    const more = g.items.length > take && !open ? linkButton('data-expand', key, `+${fmt(g.items.length - take)} more`) : '';
    groupHtml.push(`
      <section class="wb-lib-category-section">
        ${sectionHead(label, g.items.length, { more })}
        ${iconGrid(g.items.slice(0, take), env, label)}
      </section>`);
  }
  const cmds = expanded.has('@commands') ? r.commands : r.commands.slice(0, 4);
  const wfs = expanded.has('@workflows') ? r.workflows : r.workflows.slice(0, 4);
  return `
    ${scopeLine}
    <p class="wb-muted" role="status">${plural(r.iconTotal, 'icon')} · ${plural(r.commands.length, 'command')} · ${plural(r.workflows.length, 'workflow')} for “${escapeXml(q.trim())}”${level ? ` · ${LEVEL_LABELS[level]}` : ''}</p>
    ${groupHtml.join('')}
    ${rendered < r.iconTotal ? `<p class="wb-muted">Showing ${fmt(rendered)} of ${fmt(r.iconTotal)} icons. Add a word or pick a level to narrow the search.</p>` : ''}
    ${
      r.commands.length
        ? `<section class="wb-lib-category-section">
        ${sectionHead('Commands', r.commands.length, { more: r.commands.length > cmds.length ? linkButton('data-expand', '@commands', 'Show all') : '' })}
        <div class="wb-cmd-list">${cmds.map(commandCard).join('')}</div>
      </section>`
        : ''
    }
    ${
      r.workflows.length
        ? `<section class="wb-lib-category-section">
        ${sectionHead('Workflows', r.workflows.length, { more: r.workflows.length > wfs.length ? linkButton('data-expand', '@workflows', 'Show all') : '' })}
        <div class="wb-template-list">${wfs.map(workflowCard).join('')}</div>
      </section>`
        : ''
    }`;
}

// The body markup for one view state — pure, so tests can render every view
// without a DOM. `commands` is the loaded command list ([] before it loads).
export function renderTopicsView({ state = {}, commands: cmds = [], layout, favorites = new Set() } = {}) {
  const st = { ...DEFAULT_TOPICS_STATE, ...state };
  st.expanded = new Set(st.expanded);
  const env = { st, commands: cmds, layout, favorites };
  const topic = st.topicId ? TOPIC_BY_ID.get(st.topicId) : null;
  if (st.q.trim()) return searchView(env);
  if (topic && st.folderId) return folderView(topic, env);
  if (topic) return topicOverview(topic, env);
  return homeView(env);
}

// ---- clipboard ----

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied or not a secure origin: fall through to the selection fallback.
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

// ---- tab ----

// ctx: { app, layout (iconSizeLayout), favorites, toggleFavorite, recordRecent }
export function renderTopicsTab(content, ctx) {
  const { app } = ctx;
  content.innerHTML = `
    <div class="wb-topic-controls">
      <input type="search" id="topic-search" class="wb-input" placeholder="Search icons, commands, workflows…" value="${escapeXml(ui.q)}" aria-label="Search icons, commands and workflows" autocomplete="off"/>
      <div class="wb-level-pills" role="group" aria-label="Filter by level">
        ${LEVEL_LABELS.map(
          (label, l) =>
            `<button type="button" class="wb-level-pill ${ui.level === l ? 'active' : ''}" data-level-pill="${l}" data-level="${l}" aria-pressed="${ui.level === l}">${l ? escapeXml(label) : 'All'}</button>`
        ).join('')}
      </div>
    </div>
    <div id="topic-body" class="wb-topic-body wb-density-${ctx.layout.densityClass}"></div>`;

  const controls = content.querySelector('.wb-topic-controls');
  const body = content.querySelector('#topic-body');
  const input = content.querySelector('#topic-search');
  const scroller = content.closest('.wb-side-panel');

  function paint() {
    const needsData = ui.q.trim() || ui.topicId;
    if (needsData && !dataReady) {
      const token = ++loadToken;
      body.innerHTML = '<p class="wb-muted" role="status">Loading the icon pack and commands (first time only)…</p>';
      loadData().then(
        () => {
          if (token === loadToken && body.isConnected) paint();
        },
        (err) => {
          if (token === loadToken && body.isConnected) {
            body.innerHTML = `<p class="wb-muted" role="alert">The icon pack failed to load: ${escapeXml(String(err?.message || err))}. Choose the topic again to retry.</p>`;
          }
        }
      );
      return;
    }
    loadToken++; // a load still in flight must not repaint over this view
    body.innerHTML = renderTopicsView({ state: ui, commands, layout: ctx.layout, favorites: ctx.favorites });
  }

  // Bring the top of the new view under the sticky controls, but only when the
  // user had scrolled past it — at the top, the tabs stay in view.
  function revealTop() {
    if (!scroller) return;
    const anchor = Math.max(0, body.offsetTop - controls.offsetHeight - 4);
    if (scroller.scrollTop > anchor) scroller.scrollTop = anchor;
  }

  function go({ topicId = ui.topicId, folderId = '' } = {}) {
    const hadFocus = body.contains(document.activeElement);
    ui.topicId = topicId;
    ui.folderId = folderId;
    ui.limit = PAGE;
    if (!topicId) ui.onlyTopic = false;
    if (ui.q) {
      // A click in search results opens that place rather than more results.
      ui.q = '';
      input.value = '';
    }
    ui.expanded.clear();
    paint();
    revealTop();
    if (hadFocus) (body.querySelector('[data-focus-first]') || body.querySelector('button'))?.focus({ preventScroll: true });
  }

  function place(id) {
    ctx.recordRecent(id);
    app.placeStencil(id);
  }

  let searchTimer = 0;
  const runSearch = () => {
    clearTimeout(searchTimer);
    ui.q = input.value;
    ui.expanded.clear();
    paint();
    revealTop();
  };
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 120);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && input.value) {
      ev.preventDefault();
      ev.stopPropagation();
      input.value = '';
      runSearch();
    } else if (ev.key === 'Enter') {
      runSearch();
    }
  });

  controls.querySelectorAll('[data-level-pill]').forEach((b) =>
    b.addEventListener('click', () => {
      ui.level = Number(b.dataset.levelPill);
      ui.limit = PAGE;
      controls.querySelectorAll('[data-level-pill]').forEach((p) => {
        const on = Number(p.dataset.levelPill) === ui.level;
        p.classList.toggle('active', on);
        p.setAttribute('aria-pressed', String(on));
      });
      paint();
    })
  );

  body.addEventListener('click', async (ev) => {
    const t = ev.target.closest('button, [data-stencil]');
    if (!t || !body.contains(t)) return;
    const d = t.dataset;
    if (d.favStencil) {
      ev.stopPropagation();
      ctx.toggleFavorite(d.favStencil);
      const on = ctx.favorites.has(d.favStencil);
      t.classList.toggle('active', on);
      t.textContent = on ? '★' : '☆';
      t.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
      return;
    }
    if (t.hasAttribute('data-topic-home')) return go({ topicId: '' });
    if (d.topic) return go({ topicId: d.topic });
    if (d.folder) return go({ folderId: d.folder });
    if (t.hasAttribute('data-more')) {
      ui.limit += PAGE;
      return paint();
    }
    if (d.expand) {
      ui.expanded.add(d.expand);
      return paint();
    }
    if (d.scope) {
      ui.onlyTopic = d.scope === 'topic';
      return paint();
    }
    if (d.wfInsert) return app.insertWorkflow(d.wfInsert);
    if (d.wfPresent) return app.insertWorkflow(d.wfPresent, { present: true });
    if (d.cmdInsert) {
      const c = commands.find((x) => x.id === d.cmdInsert);
      if (c) app.insertCodeSnippet({ title: c.title, code: c.cmd, note: c.note, risky: c.risky });
      return;
    }
    if (d.cmdCopy) {
      const c = commands.find((x) => x.id === d.cmdCopy);
      if (!c) return;
      const ok = await copyText(c.cmd);
      t.textContent = ok ? 'Copied ✓' : 'Copy failed';
      if (!ok) app.dialogs?.showToast?.('Copying is blocked here: select the command text and press Ctrl/⌘+C.');
      setTimeout(() => {
        if (t.isConnected) t.textContent = 'Copy';
      }, 1500);
      return;
    }
    if (d.stencil) place(d.stencil);
  });

  body.addEventListener('keydown', (ev) => {
    const card = ev.target.closest?.('.wb-stencil-item[data-stencil]');
    if (!card || ev.target !== card) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      place(card.dataset.stencil);
      return;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: ctx.layout.focusStep, ArrowUp: -ctx.layout.focusStep }[ev.key];
    if (!step) return;
    ev.preventDefault();
    const cards = Array.from(card.parentElement.children);
    cards[cards.indexOf(card) + step]?.focus();
  });

  body.addEventListener('dragstart', (ev) => {
    const card = ev.target.closest?.('[data-stencil]');
    if (!card) return;
    ctx.recordRecent(card.dataset.stencil);
    ev.dataTransfer?.setData('text/plain', `stencil:${card.dataset.stencil}`);
  });

  paint();
}
