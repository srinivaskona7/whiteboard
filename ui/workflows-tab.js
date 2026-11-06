// ui/workflows-tab.js — the "Workflows" tab of the library panel: browse, filter and insert
// step-by-step workflows. The heavy data (templates/workflows-data.js) is loaded only when a
// workflow is inserted; this tab runs on the small index.
import { WORKFLOW_INDEX } from '../templates/workflows-index.js';
import { escapeXml } from '../render/svg-export.js';
import { LEVEL_NAMES } from '../scene/workflow-builder.js';

const ui = { topic: 'all', level: 0, q: '' };

export function filterWorkflows({ topic = 'all', level = 0, q = '' } = {}) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return WORKFLOW_INDEX.workflows.filter((w) => {
    if (topic !== 'all' && w.topic !== topic) return false;
    if (level && w.level !== level) return false;
    const hay = `${w.title} ${w.summary} ${w.topic}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

// Estimated minutes per workflow step; capped for readability.
export const EST_MIN_PER_STEP = 3;
export const EST_MIN_MIN = 5;
export const EST_MIN_MAX = 30;

export function estimateDuration(steps) {
  const minutes = Math.min(EST_MIN_MAX, Math.max(EST_MIN_MIN, steps * EST_MIN_PER_STEP));
  return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} hr`;
}

export function renderWorkflowsTab(content, app) {
  const topics = WORKFLOW_INDEX.topics;
  const topicColor = Object.fromEntries(topics.map((t) => [t.id, t.color]));
  const total = WORKFLOW_INDEX.workflows.length;

  function list() {
    return filterWorkflows(ui)
      .map(
        (w) => `
        <div class="wb-topic-wf" data-wf-card="${escapeXml(w.id)}">
          <div class="wb-wf-head">
            <span class="wb-wf-dot" style="background:${escapeXml(topicColor[w.topic] || '#2563eb')}" aria-hidden="true"></span>
            <div class="wb-wf-body">
              <div class="wb-wf-title">${escapeXml(w.title)}</div>
              <div class="wb-wf-meta">
                <span class="wb-wf-level" style="color:${escapeXml(topicColor[w.topic] || '#2563eb')}">${escapeXml(LEVEL_NAMES[w.level] || 'Beginner')}</span>
                <span class="wb-wf-separator" aria-hidden="true">\u00b7</span>
                <span class="wb-wf-duration">${escapeXml(estimateDuration(w.steps))}</span>
                <span class="wb-wf-separator" aria-hidden="true">\u00b7</span>
                <span class="wb-wf-steps">${w.steps} step${w.steps === 1 ? '' : 's'}</span>
              </div>
              <div class="wb-wf-outcome">${escapeXml(w.summary)}</div>
            </div>
          </div>
          <div class="wb-wf-actions">
            <button type="button" class="wb-btn wb-sm wb-primary" data-wf-insert="${escapeXml(w.id)}">Insert</button>
            <button type="button" class="wb-btn wb-sm" data-wf-present="${escapeXml(w.id)}" title="Insert, then start step-by-step presentation">Insert &amp; present</button>
          </div>
        </div>`
      )
      .join('');
  }

  function paint() {
    const shown = filterWorkflows(ui).length;
    content.innerHTML = `
      <p class="wb-muted">${total} step-by-step workflows. Each step appears one at a time in Present mode, with a Full flow button. You can also right-click the canvas and choose <em>Insert workflow here</em>.</p>
      <div class="wb-lib-controls">
        <div class="wb-lib-search-row"><input type="search" id="wf-search" class="wb-input" placeholder="Search workflows: boot, merge, inventory, subnet\u2026" value="${escapeXml(ui.q)}" aria-label="Search workflows"/></div>
        <div class="wb-cat-pills" role="group" aria-label="Workflow topics">
          <button type="button" class="wb-cat-pill ${ui.topic === 'all' ? 'active' : ''}" data-wf-topic="all">All (${total})</button>
          ${topics.map((t) => `<button type="button" class="wb-cat-pill ${ui.topic === t.id ? 'active' : ''}" data-wf-topic="${escapeXml(t.id)}" title="${escapeXml(t.tagline)}">${escapeXml(t.name)} (${t.count})</button>`).join('')}
        </div>
        <div class="wb-cat-pills" role="group" aria-label="Workflow level">
          ${[0, 1, 2, 3, 4].map((l) => `<button type="button" class="wb-cat-pill ${ui.level === l ? 'active' : ''}" data-wf-level="${l}">${l ? LEVEL_NAMES[l] : 'Any level'}</button>`).join('')}
        </div>
      </div>
      <p class="wb-muted" id="wf-count">${shown} shown</p>
      <div class="wb-template-list" id="wf-list">${list()}</div>`;
    wire();
  }

  function refreshList() {
    content.querySelector('#wf-list').innerHTML = list();
    content.querySelector('#wf-count').textContent = `${filterWorkflows(ui).length} shown`;
    wireCards();
  }

  function wireCards() {
    content.querySelectorAll('[data-wf-insert]').forEach((b) => b.addEventListener('click', () => app.insertWorkflow(b.dataset.wfInsert)));
    content.querySelectorAll('[data-wf-present]').forEach((b) => b.addEventListener('click', () => app.insertWorkflow(b.dataset.wfPresent, { present: true })));
  }

  function wire() {
    content.querySelector('#wf-search')?.addEventListener('input', (e) => {
      ui.q = e.target.value;
      refreshList();
    });
    content.querySelectorAll('[data-wf-topic]').forEach((b) => b.addEventListener('click', () => { ui.topic = b.dataset.wfTopic; paint(); }));
    content.querySelectorAll('[data-wf-level]').forEach((b) => b.addEventListener('click', () => { ui.level = Number(b.dataset.wfLevel); paint(); }));
    wireCards();
  }

  paint();
}
