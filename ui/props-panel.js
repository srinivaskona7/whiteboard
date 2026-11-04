// ui/props-panel.js
import { PALETTE_STROKE_COLORS, PALETTE_FILL_COLORS } from '../render/themes.js';
import { escapeXml } from '../render/svg-export.js';
import {
  getConnectorDirectionPreset,
  applyConnectorDirectionPreset,
  getElementContainmentPath,
  getContainerChildren,
  isFrameIncludedInPresentation,
} from '../scene/model.js';
import { resetConnectorRoute } from '../scene/routing.js';
import { ARROW_QUICK_PRESETS, applyArrowQuickPreset } from '../scene/arrow-presets.js';
import { arrowPresetPreview, arrowPresetMatches } from './arrow-preview.js';
import {
  CELL_ALIGNS,
  insertTableRow,
  insertTableCol,
  deleteTableRow,
  deleteTableCol,
  equalizeTableSpans,
  fitTable,
  setCellAlignment,
  setRowAlignment,
  setColAlignment,
  setTableAlignment,
  setCellColor,
  setRowColor,
} from '../scene/table.js';
import { updateConnectorBindings } from '../scene/bindings.js';
import {
  BRUSH_PRESETS,
  getBrushPreset,
  resolveBrush,
  buildStrokeSegments,
  buildGrainPoints,
  strokeOpacity,
} from '../scene/brushes.js';
import { describeIcon, getStencilById } from '../stencils/index.js';

function getSharedProp(elements, getter, fallback) {
  if (!elements || elements.length === 0) {
    return { value: fallback, mixed: false };
  }
  const first = getter(elements[0]);
  for (let i = 1; i < elements.length; i++) {
    if (getter(elements[i]) !== first) {
      return { value: first, mixed: true };
    }
  }
  return { value: first ?? fallback, mixed: false };
}

export function initPropsPanel(app) {
  const container = document.getElementById('wb-props-panel');
  if (!container) return { update() {} };

  // Where the table style buttons (alignment / fill colour) apply. 'cell' only
  // makes sense with a last-edited cell; without one it falls back to 'table'.
  let tableStyleScope = 'table';

  function isStudentRestrictedRole() {
    const role = app.collab?.role;
    return (
      (app.collab?.status === 'live' || app.collab?.status === 'connecting' || app.collab?.status === 'readonly-snapshot') &&
      (role === 'viewer' || role === 'questioner')
    );
  }

  function activeBrushId(selected) {
    const freehand = selected.filter((e) => e.type === 'pen' || e.type === 'highlighter');
    if (freehand.length > 0) return resolveBrush(freehand[0]).id;
    return app.currentBrush || 'technical';
  }

  function brushContextSection(selected) {
    const isInkTool = app.activeTool === 'pen' || app.activeTool === 'highlighter';
    const freehand = selected.filter((e) => e.type === 'pen' || e.type === 'highlighter');
    if (!isInkTool && freehand.length === 0) return '';
    const brushId = activeBrushId(selected);
    const preset = getBrushPreset(brushId) || BRUSH_PRESETS[0];
    const ref = freehand[0];
    const width = ref?.strokeWidth ?? app.brushOverrides?.strokeWidth ?? preset.strokeWidth;
    const opacity = Math.round(
      (ref?.opacity ?? app.brushOverrides?.opacity ?? preset.opacity) * 100
    );
    const smoothing = app.brushSmoothing || preset.smoothing || 'adaptive';
    return `
      <div class="wb-prop-section">
        <div class="wb-prop-row" style="margin-top:0;">
          <span class="wb-prop-title" style="margin:0;">Drawing Preset</span>
          <span class="wb-muted" style="font-size:10px;">${freehand.length ? 'selected stroke' : 'new strokes'}</span>
        </div>
        <div class="wb-brush-grid" role="radiogroup" aria-label="Drawing Preset">
          ${BRUSH_PRESETS.map(
            (p) => `
            <button type="button" class="wb-brush-card ${p.id === brushId ? 'active' : ''}"
              data-brush="${p.id}" role="radio" aria-checked="${p.id === brushId}"
              title="${escapeXml(p.description)}">
              <canvas class="wb-brush-preview" data-brush-preview="${p.id}" width="72" height="26" aria-hidden="true"></canvas>
              <span class="wb-brush-name">${escapeXml(p.name)}</span>
            </button>`
          ).join('')}
        </div>
        <div class="wb-color-grid" role="group" aria-label="Ink Colour">
          ${(preset.kind === 'highlighter'
            ? ['#facc15', '#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa']
            : PALETTE_STROKE_COLORS
          )
            .map(
              (c) =>
                `<button type="button" class="wb-color-swatch ${(ref?.stroke || app.currentStyle?.stroke) === c ? 'active' : ''}" style="background:${c}" data-brush-color="${c}" aria-label="Ink colour ${c}"></button>`
            )
            .join('')}
          <input type="color" id="prop-brush-color" value="${ref?.stroke || app.currentStyle?.stroke || '#1e293b'}" aria-label="Custom ink colour"/>
        </div>
        <label class="wb-prop-row">
          <span>Size (${Math.round(width)}px)</span>
          <input type="range" id="prop-brush-size" min="1" max="40" value="${Math.round(width)}"/>
        </label>
        <label class="wb-prop-row">
          <span>Opacity (${opacity}%)</span>
          <input type="range" id="prop-brush-opacity" min="5" max="100" value="${opacity}"/>
        </label>
        <label class="wb-prop-row">
          <span>Stabilization</span>
          <select id="prop-brush-smoothing" aria-label="Stroke Stabilization">
            <option value="off" ${smoothing === 'off' ? 'selected' : ''}>Off</option>
            <option value="adaptive" ${smoothing === 'adaptive' ? 'selected' : ''}>Adaptive</option>
            <option value="stabilizer" ${smoothing === 'stabilizer' ? 'selected' : ''}>Stabilizer</option>
          </select>
        </label>
        <div class="wb-btn-group">
          <button type="button" class="wb-btn wb-sm" id="btn-brush-apply" ${freehand.length ? '' : 'disabled'} title="Apply this preset to the selected strokes">Apply to Selected</button>
          <button type="button" class="wb-btn wb-sm" id="btn-brush-reset" title="Reset the tool to this preset's tuning">Reset Tool</button>
          <button type="button" class="wb-btn wb-sm" id="btn-tablet-test" title="Test pen pressure and calibrate the width curve">Tablet Test…</button>
        </div>
      </div>
    `;
  }

  function eraserContextSection() {
    if (app.activeTool !== 'eraser') return '';
    const s = app.eraserSettings || { size: 12, mode: 'object', scope: 'all' };
    return `
      <div class="wb-prop-section">
        <div class="wb-prop-title">Eraser</div>
        <label class="wb-prop-row">
          <span>Size (${Math.round(s.size)}px)</span>
          <input type="range" id="prop-eraser-size" min="4" max="60" value="${Math.round(s.size)}"/>
        </label>
        <label class="wb-prop-row">
          <span>Mode</span>
          <select id="prop-eraser-mode" aria-label="Eraser Mode">
            <option value="object" ${s.mode === 'object' ? 'selected' : ''}>Whole Object</option>
            <option value="stroke" ${s.mode === 'stroke' ? 'selected' : ''}>Trim Ink</option>
          </select>
        </label>
        <label class="wb-prop-row">
          <span>Scope</span>
          <select id="prop-eraser-scope" aria-label="Eraser Scope">
            <option value="all" ${s.scope === 'all' ? 'selected' : ''}>All Objects</option>
            <option value="ink" ${s.scope === 'ink' ? 'selected' : ''}>Freehand Ink Only</option>
            <option value="objects" ${s.scope === 'objects' ? 'selected' : ''}>Objects Only</option>
          </select>
        </label>
        <div class="wb-eraser-preview-row">
          <span class="wb-eraser-dot" style="width:${Math.round(s.size)}px;height:${Math.round(s.size)}px;" aria-hidden="true"></span>
          <span class="wb-muted">Erase radius shown at 100% zoom</span>
        </div>
      </div>
    `;
  }

  function drawBrushPreviews() {
    container.querySelectorAll('[data-brush-preview]').forEach((canvas) => {
      const preset = getBrushPreset(canvas.dataset.brushPreview);
      if (!preset) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const sample = {
        id: `preview-${preset.id}`,
        createdAt: 1,
        type: preset.kind,
        brush: preset.id,
        strokeWidth: Math.min(preset.strokeWidth, 10),
        opacity: preset.opacity,
        points: Array.from({ length: 14 }, (_, i) => ({
          x: 5 + (i / 13) * (w - 10),
          y: h / 2 + Math.sin(i / 2.1) * 5,
          p: 0.3 + (i / 13) * 0.7,
        })),
      };
      const stroke = preset.kind === 'highlighter' ? '#facc15' : '#1e293b';
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.fillStyle = stroke;
      ctx.globalAlpha = strokeOpacity(sample);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const segments = buildStrokeSegments(sample);
      for (const s of segments) {
        ctx.lineWidth = preset.nib ? Math.max(1, s.width * preset.nib.aspect) : s.width;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
      for (const g of buildGrainPoints(sample, segments)) {
        ctx.globalAlpha = strokeOpacity(sample) * g.a;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function bindToolContext() {
    drawBrushPreviews();
    container.querySelector('#btn-pin-props')?.addEventListener('click', () => {
      app.togglePropsPinned();
    });
    container.querySelectorAll('[data-brush]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hasInk = app
          .getPage()
          .elements.some(
            (el) =>
              app.selectedIds.has(el.id) && (el.type === 'pen' || el.type === 'highlighter')
          );
        app.setBrushPreset(btn.dataset.brush, { applyToSelection: hasInk });
      });
    });
    const setInkColor = (color) => {
      if (!color) return;
      const freehand = app.getPage().elements.filter(
        (el) => app.selectedIds.has(el.id) && (el.type === 'pen' || el.type === 'highlighter') && !el.locked
      );
      if (freehand.length > 0) {
        for (const el of freehand) el.stroke = color;
        app.commitChange();
      }
      app.currentStyle = { ...app.currentStyle, stroke: color };
      app.requestRender();
    };
    container.querySelectorAll('[data-brush-color]').forEach((btn) => {
      btn.addEventListener('click', () => setInkColor(btn.dataset.brushColor));
    });
    container.querySelector('#prop-brush-color')?.addEventListener('input', (e) => setInkColor(e.target.value));
    container.querySelector('#prop-brush-size')?.addEventListener('input', (e) => {
      const v = Number(e.target.value) || 2;
      app.setBrushOverrides?.({ strokeWidth: v }, { silent: true });
      const freehand = app.getPage().elements.filter(
        (el) => app.selectedIds.has(el.id) && (el.type === 'pen' || el.type === 'highlighter')
      );
      if (freehand.length > 0 && !freehand[0].locked) {
        for (const el of freehand) el.strokeWidth = v;
        app.commitChange();
      }
      const label = e.target.closest('.wb-prop-row')?.querySelector('span');
      if (label) label.textContent = `Size (${Math.round(v)}px)`;
      app.requestRender();
    });
    container.querySelector('#prop-brush-opacity')?.addEventListener('input', (e) => {
      const pct = Number(e.target.value) || 100;
      const v = Math.max(0.05, pct / 100);
      app.setBrushOverrides?.({ opacity: v }, { silent: true });
      const freehand = app.getPage().elements.filter(
        (el) => app.selectedIds.has(el.id) && (el.type === 'pen' || el.type === 'highlighter')
      );
      if (freehand.length > 0 && !freehand[0].locked) {
        for (const el of freehand) el.opacity = v;
        app.commitChange();
      }
      const label = e.target.closest('.wb-prop-row')?.querySelector('span');
      if (label) label.textContent = `Opacity (${pct}%)`;
      app.requestRender();
    });
    container.querySelector('#prop-brush-smoothing')?.addEventListener('change', (e) => {
      app.setBrushSmoothing(e.target.value);
    });
    container.querySelector('#btn-brush-apply')?.addEventListener('click', () => {
      // Apply the preset currently shown as active in the panel, not the one the
      // selection already had (which would make the button a no-op).
      app.setBrushPreset(app.currentBrush || 'technical', { applyToSelection: true });
    });
    container.querySelector('#btn-brush-reset')?.addEventListener('click', () => {
      app.setBrushOverrides({ strokeWidth: null, opacity: null, minWidthRatio: null, maxWidthRatio: null }, { silent: true });
      app.setBrushPreset(activeBrushId([]));
    });
    container.querySelector('#btn-tablet-test')?.addEventListener('click', () => {
      app.dialogs?.openTabletTestModal?.();
    });
    container.querySelector('#prop-eraser-size')?.addEventListener('input', (e) => {
      const v = Number(e.target.value) || 12;
      app.setEraserSetting('size', v, { silent: true });
      const label = e.target.closest('.wb-prop-row')?.querySelector('span');
      if (label) label.textContent = `Size (${Math.round(v)}px)`;
      const dot = container.querySelector('.wb-eraser-dot');
      if (dot) {
        dot.style.width = `${Math.round(v)}px`;
        dot.style.height = `${Math.round(v)}px`;
      }
    });
    container.querySelector('#prop-eraser-mode')?.addEventListener('change', (e) => {
      app.setEraserSetting('mode', e.target.value);
    });
    container.querySelector('#prop-eraser-scope')?.addEventListener('change', (e) => {
      app.setEraserSetting('scope', e.target.value);
    });
  }

  function render() {
    const page = app.getPage();
    const selected = page.elements.filter((e) => app.selectedIds.has(e.id));
    const tool = app.activeTool;

    const shouldShow = app.propsContextVisible
      ? app.propsContextVisible()
      : Boolean(app.propsDrawerOpen);

    if (!shouldShow) {
      container.classList.add('wb-hidden');
      return;
    }
    const prevScroll = container.scrollTop;
    container.classList.remove('wb-hidden');

    const canEdit = app.collab ? app.collab.canEditBoard() : true;
    if (!canEdit) {
      const isSnap = app.collab?.status === 'snapshot';
      const roleTitle = isSnap
        ? 'Read-Only Snapshot'
        : `Live Classroom (${app.collab?.role || 'viewer'})`;
      const el = selected[0] || null;
      const hierarchy = el ? getElementContainmentPath(page, el) : [];
      container.innerHTML = `
        <div class="wb-panel-header" style="padding:0 0 8px 0;margin-bottom:8px;">
          <strong>${escapeXml(roleTitle)}</strong>
          <button type="button" class="wb-icon-btn" id="btn-close-props" aria-label="Close Inspector Panel" title="Close Inspector Panel">✕</button>
        </div>
        <div class="wb-prop-section">
          <div class="wb-prop-title">Viewer Navigation & Export</div>
          <p class="wb-muted" style="margin-bottom:6px;">
            ${
              isSnap
                ? 'This is an immutable read-only board snapshot. You can pan, zoom, inspect components, and export diagrams.'
                : 'You are connected as a classroom participant. Board editing is locked to the teacher/editors, while pointing and Q&A are enabled.'
            }
          </p>
          <div class="wb-btn-group" style="flex-wrap:wrap;gap:4px;">
            <button type="button" class="wb-btn wb-sm" id="btn-ro-fit">Fit Board</button>
            <button type="button" class="wb-btn wb-sm" id="btn-ro-zoom100">100% Zoom</button>
            <button type="button" class="wb-btn wb-sm" id="btn-ro-export">Export PNG/SVG</button>
          </div>
        </div>
        ${
          !isSnap
            ? `<div class="wb-prop-section">
                <div class="wb-prop-title">Classroom Participation</div>
                <div class="wb-btn-group" style="flex-wrap:wrap;gap:4px;">
                  <button type="button" class="wb-btn wb-sm ${app.activeTool === 'pointer' ? 'active' : ''}" id="btn-ro-pointer">🎯 Point (W)</button>
                  <button type="button" class="wb-btn wb-sm ${app.activeTool === 'question' ? 'active' : ''}" id="btn-ro-question">❓ Pin Question (Q)</button>
                  <button type="button" class="wb-btn wb-sm ${app.collab?.handRaised ? 'active wb-primary' : ''}" id="btn-ro-hand">✋ ${app.collab?.handRaised ? 'Lower Hand' : 'Raise Hand'}</button>
                </div>
              </div>`
            : ''
        }
        ${
          el
            ? `<div class="wb-prop-section">
                <div class="wb-prop-title">Selected Component</div>
                <div class="wb-prop-row"><span>Name</span><strong>${escapeXml(el.text || el.name || el.type)}</strong></div>
                <div class="wb-prop-row"><span>Type</span><span>${escapeXml(el.category || el.type)}</span></div>
                ${
                  hierarchy.length > 1
                    ? `<div class="wb-breadcrumbs" id="wb-container-breadcrumbs">
                        ${hierarchy
                          .map(
                            (item, idx) =>
                              `<button type="button" class="wb-breadcrumb-chip ${idx === hierarchy.length - 1 ? 'active' : ''}" data-breadcrumb-id="${escapeXml(item.id)}">${escapeXml(item.name)}</button>`
                          )
                          .join('<span class="wb-breadcrumb-sep">›</span>')}
                      </div>`
                    : ''
                }
                ${
                  el.link
                    ? `<button type="button" class="wb-btn wb-sm wb-primary" id="btn-ro-open-link" style="margin-top:6px;">🔗 Open Attached Link</button>`
                    : ''
                }
              </div>`
            : ''
        }
      `;
      container.querySelector('#btn-close-props')?.addEventListener('click', () => {
        app.setPropsDrawerOpen(false);
      });
      container.querySelector('#btn-ro-fit')?.addEventListener('click', () => app.fitToContent());
      container.querySelector('#btn-ro-zoom100')?.addEventListener('click', () => app.resetZoom());
      container.querySelector('#btn-ro-export')?.addEventListener('click', () => app.dialogs.openExportModal());
      container.querySelector('#btn-ro-pointer')?.addEventListener('click', () => app.setTool('pointer'));
      container.querySelector('#btn-ro-question')?.addEventListener('click', () => app.setTool('question'));
      container.querySelector('#btn-ro-hand')?.addEventListener('click', () => {
        app.collab?.toggleHandRaised();
        render();
      });
      container.querySelector('#btn-ro-open-link')?.addEventListener('click', () => {
        if (el?.link) window.open(el.link, '_blank', 'noopener,noreferrer');
      });
      container.querySelectorAll('[data-breadcrumb-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetId = btn.dataset.breadcrumbId;
          if (targetId && page.elements.some((e) => e.id === targetId)) {
            app.selectedIds = new Set([targetId]);
            app.updateUI();
            app.requestRender();
          }
        });
      });
      return;
    }

    const sections = [
      `<div class="wb-panel-header" style="padding:0 0 8px 0;margin-bottom:8px;">
        <strong>${selected.length > 0 ? `Inspector (${selected.length})` : 'Canvas & Tool Style'}</strong>
        <span style="display:flex;gap:2px;">
          <button type="button" class="wb-icon-btn ${app.propsPinned ? 'active' : ''}" id="btn-pin-props" aria-pressed="${Boolean(app.propsPinned)}" aria-label="Pin Inspector" title="${app.propsPinned ? 'Unpin Inspector' : 'Pin Inspector open'}">📌</button>
          <button type="button" class="wb-icon-btn" id="btn-close-props" aria-label="Close Inspector Panel" title="Close Inspector Panel">✕</button>
        </span>
      </div>`,
      brushContextSection(selected),
      eraserContextSection(),
    ];

    // 1. Page & Canvas Context when nothing is selected and Select/Hand tool is active
    if (selected.length === 0 && (tool === 'select' || tool === 'hand')) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Canvas & Grid</div>
          <label class="wb-prop-row">
            <span>Background</span>
            <select id="prop-bg-type" aria-label="Background Pattern">
              <option value="plain" ${page.background === 'plain' ? 'selected' : ''}>Plain</option>
              <option value="grid" ${page.background === 'grid' ? 'selected' : ''}>Grid</option>
              <option value="dots" ${page.background === 'dots' ? 'selected' : ''}>Dots</option>
            </select>
          </label>
          <label class="wb-prop-row">
            <span>Snap to Grid</span>
            <input type="checkbox" id="prop-snap-grid" ${app.scene.settings.snapToGrid ? 'checked' : ''}/>
          </label>
          <label class="wb-prop-row">
            <span>Smart Guides</span>
            <input type="checkbox" id="prop-snap-obj" ${app.scene.settings.snapToObjects ? 'checked' : ''}/>
          </label>
          <div class="wb-prop-subtitle">Math & Science Overlays</div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" data-math="ruler">📏 Ruler</button>
            <button type="button" class="wb-btn wb-sm" data-math="protractor">📐 Protractor</button>
            <button type="button" class="wb-btn wb-sm" data-math="axes">➕ Axes</button>
            <button type="button" class="wb-btn wb-sm" data-math="number-line">↔ NumLine</button>
          </div>
        </div>
      `);
      if (!isStudentRestrictedRole()) {
        sections.push(`
          <div class="wb-prop-section">
            <div class="wb-prop-title">Teacher Notes (Page)</div>
            <p class="wb-muted" style="margin-bottom:4px;">Visible only to the teacher. Excluded from student links, snapshots & handouts.</p>
            <textarea id="prop-page-teacher-notes" class="wb-textarea" rows="3" placeholder="Lesson talking points, solutions, or timing cues for ${escapeXml(page.name || 'this page')}..." aria-label="Page Teacher Notes">${escapeXml(page.teacherNotes || '')}</textarea>
          </div>
        `);
      }
      container.innerHTML = sections.join('');
      bindToolContext();
      bindEvents(selected);
      return;
    }

    // 1b. Container Breadcrumbs & Element Classification when 1 element is selected
    if (selected.length === 1) {
      const el = selected[0];
      const hierarchy = getElementContainmentPath(page, el);
      const isContainerEl = Boolean(el.type === 'frame' || el.isContainer || el.isBoundary);
      const children = isContainerEl ? getContainerChildren(page, el.id) : [];
      const kindBadge =
        el.type === 'frame'
          ? 'Presentation Frame'
          : el.isContainer || el.isBoundary
            ? 'Architectural Container'
            : el.groupId
              ? `Group (${el.groupId.slice(-4)})`
              : el.type === 'line' || el.type === 'arrow'
                ? 'Connector'
                : 'Component';

      if (hierarchy.length > 1 || isContainerEl || el.groupId) {
        sections.push(`
          <div class="wb-prop-section">
            <div class="wb-prop-row" style="margin-top:0;">
              <span class="wb-prop-title" style="margin:0;">Hierarchy</span>
              <span class="wb-kind-badge" data-kind="${escapeXml(kindBadge)}">${escapeXml(kindBadge)}</span>
            </div>
            <div class="wb-breadcrumbs" id="wb-container-breadcrumbs" role="navigation" aria-label="Container Breadcrumbs">
              ${hierarchy
                .map((item, idx) => {
                  const isCurrent = idx === hierarchy.length - 1;
                  return `<button type="button" class="wb-breadcrumb-chip ${isCurrent ? 'active' : ''}" data-breadcrumb-id="${escapeXml(item.id)}" ${item.groupId ? `data-breadcrumb-group="${escapeXml(item.groupId)}"` : ''} title="Select ${escapeXml(item.name)} (${escapeXml(item.kind)})">${escapeXml(item.name)}</button>`;
                })
                .join('<span class="wb-breadcrumb-sep">›</span>')}
            </div>
            ${
              isContainerEl
                ? `<div class="wb-btn-group" style="margin-top:6px;">
                    <button type="button" class="wb-btn wb-sm" id="btn-select-container-children" ${children.length === 0 ? 'disabled' : ''} title="Navigate inside container and select its child components">↳ Select Children (${children.length})</button>
                  </div>`
                : ''
            }
          </div>
        `);
      }
      if (el.type === 'stencil') {
        const info = describeIcon(getStencilById(el.stencilId));
        if (info) {
          sections.push(`
            <div class="wb-prop-section wb-icon-info">
              <div class="wb-prop-title">Icon reference</div>
              <p><strong>What it is:</strong> ${escapeXml(info.whatItIs)}</p>
              <p><strong>Role here:</strong> ${escapeXml(info.roleHere)}</p>
              <p><strong>Example interaction:</strong> ${escapeXml(info.exampleInteraction)}</p>
              <p class="wb-muted">Source: ${escapeXml(info.source.provider || 'Original illustration')} · ${escapeXml(
                info.source.license || 'project license'
              )} · version ${escapeXml(info.source.version || 'n/a')} · reviewed ${escapeXml(
                info.source.reviewedAt || 'n/a'
              )}</p>
              ${info.source.attribution ? `<p class="wb-muted">${escapeXml(info.source.attribution)}</p>` : ''}
            </div>
          `);
        }
      }
    } else if (selected.length > 1) {
      const uniqueGroups = new Set(selected.map((e) => e.groupId).filter(Boolean));
      sections.push(`
        <div class="wb-prop-section" style="padding-bottom:6px;">
          <div class="wb-prop-row" style="margin:0;">
            <span class="wb-muted">Multi-selection (${selected.length} items)</span>
            ${uniqueGroups.size === 1 ? `<span class="wb-kind-badge">Grouped</span>` : `<span class="wb-mixed-badge">Mixed Selection</span>`}
          </div>
        </div>
      `);
    }

    // 2. Stamp tool selector when stamp tool is active
    if (tool === 'stamp') {
      const sk = app.stampTool.stampKind;
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Classroom Stamp</div>
          <div class="wb-btn-group">
            ${[
              ['tick', '✓ Tick'],
              ['cross', '✕ Cross'],
              ['star', '★ Star'],
              ['question', '? Question'],
              ['arrow-up', '↑ Up'],
              ['badge', `#${app.stampTool.badgeValue} Badge`],
              ['steps', `№ ${app.stampTool.stepValue} Steps`],
            ]
              .map(
                ([k, label]) =>
                  `<button type="button" class="wb-btn wb-sm ${sk === k ? 'active' : ''}" data-stamp-kind="${k}" title="${k === 'steps' ? 'Numbered step bubble — re-pick to restart at 1' : k}">${label}</button>`
              )
              .join('')}
          </div>
          ${
            sk === 'steps'
              ? `<div class="wb-btn-group" style="margin-top:6px;">
                  <button type="button" class="wb-btn wb-sm" id="btn-steps-restart" title="Restart the step numbering at 1">↺ Restart at 1</button>
                </div>`
              : ''
          }
        </div>
      `);
    }

    // 3. Annotation mode controls if active
    if (app.annotationMode) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Live Annotation</div>
          <label class="wb-prop-row">
            <span>Auto-fading Ink (3s)</span>
            <input type="checkbox" id="prop-fading-ink" ${app.fadingInk ? 'checked' : ''}/>
          </label>
        </div>
      `);
    }

    // 4. Spotlight / Magnifier controls if active
    if (app.spotlight.active) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Spotlight & Lens</div>
          <label class="wb-prop-row">
            <span>Magnifier Lens (2x)</span>
            <input type="checkbox" id="prop-magnifier" ${app.spotlight.magnifier ? 'checked' : ''}/>
          </label>
        </div>
      `);
    }

    const ref = selected[0] || app.currentStyle;
    const types = new Set(selected.map((e) => e.type));
    const isConnector =
      tool === 'line' || tool === 'arrow' || types.has('line') || types.has('arrow');
    const isShape =
      ['rect', 'rounded-rect', 'ellipse', 'diamond', 'stencil', 'sticky', 'frame', 'table'].includes(
        tool
      ) ||
      selected.some((e) =>
        ['rect', 'rounded-rect', 'ellipse', 'diamond', 'stencil', 'sticky', 'frame', 'table'].includes(
          e.type
        )
      );
    const hasText =
      tool === 'text' ||
      isShape ||
      isConnector ||
      selected.some((e) => e.type === 'text' || e.type === 'code');
    const isImage = selected.some((e) => e.type === 'image');
    // Ink and eraser have their own canonical controls; the generic stroke/fill
    // block under them was a duplicate (and showed dash styles a pen cannot use).
    const inkSelection = selected.filter((e) => e.type === 'pen' || e.type === 'highlighter');
    const inkContext = tool === 'pen' || tool === 'highlighter' || inkSelection.length > 0;
    const eraserContext = tool === 'eraser';
    const codeOnlySelection = types.has('code') && !isShape && !isConnector;
    const showStrokeSection = !isImage && !inkContext && !eraserContext && !codeOnlySelection;
    const showStrokeGeometry = isShape || isConnector;

    const strokeMeta = getSharedProp(selected, (e) => e.stroke, ref.stroke || '#1e293b');
    const swMeta = getSharedProp(selected, (e) => e.strokeWidth || 2, ref.strokeWidth || 2);
    const ssMeta = getSharedProp(selected, (e) => e.strokeStyle || 'solid', ref.strokeStyle || 'solid');
    const fillMeta = getSharedProp(selected, (e) => e.fill || 'transparent', ref.fill || 'transparent');
    const opacityMeta = getSharedProp(selected, (e) => e.opacity ?? 1, ref.opacity ?? 1);
    const opacityPct = Math.round((Number.isFinite(opacityMeta.value) ? opacityMeta.value : 1) * 100);

    // Table controls placed at top of Inspector when a table is selected
    if (types.has('table') && selected.length === 1) {
      const tbl = selected[0];
      // The last cell the inline editor touched is the "active cell": the
      // anchor that cell/row/column styling applies around.
      const activeCell =
        app.lastTableCell && app.lastTableCell.elId === tbl.id ? app.lastTableCell : null;
      const scope = activeCell ? tableStyleScope : 'table';
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Table (${tbl.rows} × ${tbl.cols})</div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="btn-table-add-row">+ Row</button>
            <button type="button" class="wb-btn wb-sm" id="btn-table-del-row">− Row</button>
            <button type="button" class="wb-btn wb-sm" id="btn-table-add-col">+ Col</button>
            <button type="button" class="wb-btn wb-sm" id="btn-table-del-col">− Col</button>
          </div>
          <div class="wb-prop-subtitle">
            Cell Styling${activeCell ? ` · active cell ${activeCell.row + 1},${activeCell.col + 1}` : ' · whole table'}
          </div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="btn-table-select-all" title="Target the whole table: alignment and colour then apply to every cell">▣ Select all cells</button>
          </div>
          <div class="wb-btn-group" role="group" aria-label="Style Target">
            ${[
              ['cell', 'Cell'],
              ['row', 'Row'],
              ['col', 'Column'],
              ['table', 'Table'],
            ]
              .map(
                ([id, label]) =>
                  `<button type="button" class="wb-btn wb-sm ${scope === id ? 'active' : ''}" data-table-scope="${id}" ${id === 'cell' && !activeCell ? 'disabled' : ''}>${label}</button>`
              )
              .join('')}
          </div>
          <label class="wb-prop-row">
            <span>Alignment</span>
            <div class="wb-btn-group" role="group" aria-label="Cell Alignment">
              ${CELL_ALIGNS.map(
                (al) =>
                  `<button type="button" class="wb-btn wb-sm" data-table-align="${al}" title="Align ${al}">${al}</button>`
              ).join('')}
            </div>
          </label>
          <div class="wb-prop-row">
            <span>Fill colour</span>
            <div class="wb-color-grid" role="group" aria-label="Cell Fill Colour">
              ${PALETTE_FILL_COLORS.map(
                (c) =>
                  `<button type="button" class="wb-color-swatch ${c === 'transparent' ? 'wb-swatch-clear' : ''}" style="background:${c === 'transparent' ? 'transparent' : c}" data-table-color="${c}" aria-label="Cell fill ${c}"></button>`
              ).join('')}
            </div>
          </div>
          <label class="wb-check-row">
            <input type="checkbox" id="prop-table-header" ${tbl.headerRow === false ? '' : 'checked'}/>
            <span>Header row (bold, tinted)</span>
          </label>
          <label class="wb-check-row">
            <input type="checkbox" id="prop-table-striped" ${tbl.striped ? 'checked' : ''}/>
            <span>Alternate row shading</span>
          </label>
          <label class="wb-prop-row">
            <span>Cell alignment</span>
            <select id="prop-table-align" aria-label="Table Cell Alignment">
              <option value="left" ${tbl.textAlign === 'left' ? 'selected' : ''}>Left</option>
              <option value="center" ${!tbl.textAlign || tbl.textAlign === 'center' ? 'selected' : ''}>Center</option>
              <option value="right" ${tbl.textAlign === 'right' ? 'selected' : ''}>Right</option>
            </select>
          </label>
          <label class="wb-prop-row">
            <span>Vertical alignment</span>
            <select id="prop-table-valign" aria-label="Table Cell Vertical Alignment">
              <option value="top" ${tbl.valign === 'top' ? 'selected' : ''}>Top</option>
              <option value="middle" ${!tbl.valign || tbl.valign === 'middle' ? 'selected' : ''}>Middle</option>
              <option value="bottom" ${tbl.valign === 'bottom' ? 'selected' : ''}>Bottom</option>
            </select>
          </label>
          <label class="wb-prop-row">
            <span>Cell padding (${Math.round(tbl.cellPadding ?? 6)}px)</span>
            <input type="range" id="prop-table-padding" min="0" max="20" value="${Math.round(tbl.cellPadding ?? 6)}" aria-label="Table Cell Padding"/>
          </label>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="btn-table-fit">⤢ Fit to content</button>
            <button type="button" class="wb-btn wb-sm" id="btn-table-equal">Equal columns</button>
            <button type="button" class="wb-btn wb-sm" id="btn-table-structure">⋯ Structure / TSV…</button>
          </div>
        </div>
      `);
    }

    // Code block controls placed at top of Inspector when a code block is selected
    if (types.has('code') && selected.length === 1) {
      const cd = selected[0];
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Code Highlight</div>
          <label class="wb-prop-row">
            <span>Lines (e.g. 1,3-4)</span>
            <input type="text" id="prop-code-hl" value="${escapeXml(cd.highlightLines || '')}" style="width:90px"/>
          </label>
          <button type="button" class="wb-btn wb-sm" id="btn-open-code-editor">⤢ Open Expanded Editor</button>
        </div>
      `);
    }

    // Frame / Boundary Container controls placed near top of Inspector
    if (
      selected.length === 1 &&
      (types.has('frame') || selected[0].isContainer || selected[0].isBoundary)
    ) {
      const fr = selected[0];
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">${fr.type === 'frame' ? 'Presentation Frame / Slide' : 'Architecture Boundary Container'}</div>
          <label class="wb-prop-row">
            <span>Move Contents Together</span>
            <input type="checkbox" id="prop-move-children" ${fr.moveChildren !== false ? 'checked' : ''}/>
          </label>
          ${
            fr.type === 'frame'
              ? `<label class="wb-prop-row">
                  <span>Include in Presentation</span>
                  <input type="checkbox" id="prop-frame-include-pres" ${isFrameIncludedInPresentation(fr) ? 'checked' : ''}/>
                </label>
                <label class="wb-prop-row">
                  <span>Slide Order #</span>
                  <input type="number" id="prop-slide-order" min="1" max="99" value="${fr.slideOrder || 1}" style="width:60px"/>
                </label>
                <label class="wb-prop-row">
                  <span>Clip Children</span>
                  <input type="checkbox" id="prop-frame-clip" ${fr.clip ? 'checked' : ''}/>
                </label>
                <button type="button" class="wb-btn wb-sm" id="btn-frame-collapse">${fr.collapsed ? 'Expand Frame' : 'Collapse Frame'}</button>`
              : ''
          }
          ${
            !isStudentRestrictedRole()
              ? `<div class="wb-prop-subtitle" style="margin-top:8px;">Teacher Notes (Private)</div>
                 <textarea id="prop-el-teacher-notes" class="wb-textarea" rows="3" placeholder="Private speaker notes for this frame/section (never sent to students)..." aria-label="Frame Teacher Notes">${escapeXml(fr.teacherNotes || '')}</textarea>`
              : ''
          }
        </div>
      `);
    }

    // Stroke & Fill
    if (showStrokeSection) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-row" style="margin-top:0;">
            <span class="wb-prop-title" style="margin:0;">Stroke</span>
            ${strokeMeta.mixed || swMeta.mixed || ssMeta.mixed ? `<span class="wb-mixed-badge">Mixed</span>` : ''}
          </div>
          <div class="wb-color-grid">
            ${PALETTE_STROKE_COLORS.map(
              (c) =>
                `<button type="button" class="wb-color-swatch ${!strokeMeta.mixed && strokeMeta.value === c ? 'active' : ''}" style="background:${c}" data-stroke="${c}" aria-label="Stroke ${c}"></button>`
            ).join('')}
            <input type="color" id="prop-stroke-custom" value="${strokeMeta.value && String(strokeMeta.value).startsWith('#') ? strokeMeta.value : '#1e293b'}" aria-label="Custom stroke color"/>
          </div>
          ${
            showStrokeGeometry
              ? `<label class="wb-prop-row">
            <span>Width (${swMeta.mixed ? 'Mixed' : `${swMeta.value}px`})</span>
            <input type="range" id="prop-stroke-width" min="1" max="24" value="${swMeta.value || 2}"/>
          </label>
          <div class="wb-btn-group">
            ${['solid', 'dashed', 'dotted']
              .map(
                (st) =>
                  `<button type="button" class="wb-btn wb-sm ${!ssMeta.mixed && ssMeta.value === st ? 'active' : ''}" data-stroke-style="${st}">${st}</button>`
              )
              .join('')}
          </div>`
              : ''
          }
          <label class="wb-prop-row">
            <span>Opacity (${opacityMeta.mixed ? 'Mixed' : `${opacityPct}%`})</span>
            <input type="range" id="prop-opacity" min="5" max="100" value="${opacityMeta.mixed ? 100 : opacityPct}"/>
          </label>
        </div>
      `);
    }

    if (isShape) {
      const patternMeta = getSharedProp(selected, (e) => e.fillPattern || 'solid', 'solid');
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-row" style="margin-top:0;">
            <span class="wb-prop-title" style="margin:0;">Fill & Shape Style</span>
            ${fillMeta.mixed ? `<span class="wb-mixed-badge">Mixed</span>` : ''}
          </div>
          <div class="wb-color-grid">
            ${PALETTE_FILL_COLORS.map(
              (c) =>
                `<button type="button" class="wb-color-swatch ${!fillMeta.mixed && fillMeta.value === c ? 'active' : ''} ${c === 'transparent' ? 'wb-swatch-clear' : ''}" style="background:${c === 'transparent' ? 'transparent' : c}" data-fill="${c}" aria-label="Fill ${c}"></button>`
            ).join('')}
            <input type="color" id="prop-fill-custom" value="${fillMeta.value && String(fillMeta.value).startsWith('#') ? fillMeta.value : '#ffffff'}" aria-label="Custom fill color"/>
          </div>
          <div class="wb-prop-row">
            <span>Fill Pattern</span>
            <div class="wb-btn-group" role="group" aria-label="Fill pattern">
              ${[
                ['solid', 'Solid'],
                ['hachure', 'Hachure'],
                ['cross-hatch', 'Cross-hatch'],
              ]
                .map(
                  ([id, label]) =>
                    `<button type="button" class="wb-btn wb-sm ${!patternMeta.mixed && patternMeta.value === id ? 'wb-primary' : ''}" data-fill-pattern="${id}" aria-pressed="${!patternMeta.mixed && patternMeta.value === id}">${label}</button>`
                )
                .join('')}
            </div>
          </div>
          <label class="wb-prop-row">
            <span>Corner Roundness</span>
            <input type="range" id="prop-roundness" min="0" max="32" value="${ref.roundness || 0}"/>
          </label>
          <label class="wb-prop-row">
            <span>Hand-drawn (Sloppy)</span>
            <input type="checkbox" id="prop-sloppy" ${ref.sloppy ? 'checked' : ''}/>
          </label>
          <label class="wb-prop-row">
            <span>Auto-grow for Text</span>
            <input type="checkbox" id="prop-autogrow" ${ref.autoGrow !== false ? 'checked' : ''}/>
          </label>
        </div>
      `);
    }

    // Connector Routing, Direction Presets, Rounded-Elbow Corner Radius & Source/Middle/Dest Labels
    if (isConnector) {
      const connEls = selected.filter((e) => e.type === 'line' || e.type === 'arrow');
      const routeMeta = getSharedProp(connEls, (e) => e.routing || 'orthogonal', ref.routing || 'orthogonal');
      const arrowTypes = [
        ['none', 'No arrowhead'],
        ['arrow', 'Open'],
        ['triangle', 'Filled triangle'],
        ['triangle-outline', 'Outline triangle'],
        ['diamond', 'Diamond'],
        ['circle', 'Circle'],
        ['bar', 'Bar'],
      ];
      const routingModes = [
        ['auto', 'Auto Clean'],
        ['straight', 'Straight'],
        ['orthogonal', 'Right-Angle'],
        ['rounded-elbow', 'Rounded-Elbow'],
        ['curved', 'Curved'],
      ];
      const dirPreset = getConnectorDirectionPreset(ref);
      const dirPresets = [
        ['plain', 'No arrowheads'],
        ['one-way', '→ One-Way'],
        ['two-way', '↔ Two-Way'],
      ];
      const quickLabels = ['HTTPS', 'TCP 443', 'DNS', 'gRPC', 'replication'];
      const portOpts = ['auto', 'top', 'right', 'bottom', 'left'];
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-row" style="margin-top:0;">
            <span class="wb-prop-title" style="margin:0;">Connector Route & Labels</span>
            ${routeMeta.mixed ? `<span class="wb-mixed-badge">Mixed</span>` : ''}
          </div>
          <div class="wb-btn-group" role="group" aria-label="Connector Routing Mode">
            ${routingModes
              .map(
                ([rt, label]) =>
                  `<button type="button" class="wb-btn wb-sm ${!routeMeta.mixed && routeMeta.value === rt ? 'active' : ''}" data-routing="${rt}">${label}</button>`
              )
              .join('')}
          </div>
          ${
            (ref.routing || 'orthogonal') === 'rounded-elbow'
              ? `<label class="wb-prop-row">
                  <span>Elbow Radius (${ref.cornerRadius || 14}px)</span>
                  <input type="range" id="prop-corner-radius" min="4" max="36" value="${ref.cornerRadius || 14}" aria-label="Rounded Elbow Corner Radius"/>
                </label>`
              : ''
          }
          <div class="wb-btn-group" role="group" aria-label="Connector Direction Preset">
            ${dirPresets
              .map(
                ([dp, label]) =>
                  `<button type="button" class="wb-btn wb-sm ${dirPreset === dp ? 'active' : ''}" data-dir-preset="${dp}">${label}</button>`
              )
              .join('')}
          </div>
          ${
            selected.length === 1
              ? `<div class="wb-prop-title" style="margin-top:6px;">Arrow Quick Presets</div>
                 <div class="wb-arrow-preset-grid" role="group" aria-label="Arrow Quick Presets">
                   ${ARROW_QUICK_PRESETS.map(
                     (p, i) => `<button type="button"
                        class="wb-btn wb-sm wb-arrow-card ${arrowPresetMatches(ref, p) ? 'active' : ''}"
                        data-arrow-quick="${p.id}"
                        title="${escapeXml(p.description)}">
                        ${arrowPresetPreview(p, i)}<span>${escapeXml(p.name)}</span>
                      </button>`
                   ).join('')}
                 </div>`
              : ''
          }
          ${
            selected.length === 1
              ? `<label class="wb-prop-row">
                  <span>Source Label</span>
                  <input type="text" id="prop-start-label" class="wb-input" style="width:128px;padding:3px 6px;" placeholder="e.g. client / out" value="${escapeXml(ref.startLabel || '')}" aria-label="Connector Source Label"/>
                </label>
                <label class="wb-prop-row">
                  <span>Middle Label</span>
                  <input type="text" id="prop-label-text" class="wb-input" style="width:128px;padding:3px 6px;" placeholder="e.g. HTTPS / gRPC" value="${escapeXml(ref.text || '')}" aria-label="Connector Middle Label"/>
                </label>
                <label class="wb-prop-row">
                  <span>Dest Label</span>
                  <input type="text" id="prop-end-label" class="wb-input" style="width:128px;padding:3px 6px;" placeholder="e.g. :443 / target" value="${escapeXml(ref.endLabel || '')}" aria-label="Connector Destination Label"/>
                </label>
                <div class="wb-btn-group" style="flex-wrap:wrap;gap:3px;">
                  ${quickLabels
                    .map(
                      (ql) =>
                        `<button type="button" class="wb-btn wb-sm ${ref.text === ql ? 'active' : ''}" style="font-size:10px;padding:2px 5px;" data-quick-label="${ql}">${ql}</button>`
                    )
                    .join('')}
                </div>
                <label class="wb-prop-row">
                  <span>Mid Label Pos (${Math.round((ref.labelT ?? 0.5) * 100)}%)</span>
                  <input type="range" id="prop-label-t" min="10" max="90" value="${Math.round((ref.labelT ?? 0.5) * 100)}" aria-label="Connector Label Position"/>
                </label>`
              : ''
          }
          <label class="wb-prop-row">
            <span>Line roughness</span>
            <div class="wb-btn-group" role="group" aria-label="Connector Roughness">
              ${[
                [0, 'Clean'],
                [1, 'Sketch'],
                [2, 'Rough'],
              ]
                .map(
                  ([n, label]) =>
                    `<button type="button" class="wb-btn wb-sm ${(Number.isFinite(ref.roughness) ? Math.round(ref.roughness) : ref.sloppy ? 1 : 0) === n ? 'active' : ''}" data-roughness="${n}">${label}</button>`
                )
                .join('')}
            </div>
          </label>
          <label class="wb-prop-row">
            <span>Start Cap</span>
            <select id="prop-start-arrow" aria-label="Start Arrowhead">
              ${arrowTypes
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${ref.startArrow === value ? 'selected' : ''}>${label}</option>`
                )
                .join('')}
            </select>
          </label>
          <label class="wb-prop-row">
            <span>End Cap</span>
            <select id="prop-end-arrow" aria-label="End Arrowhead">
              ${arrowTypes
                .map(
                  ([value, label]) =>
                    `<option value="${value}" ${ref.endArrow === value ? 'selected' : ''}>${label}</option>`
                )
                .join('')}
            </select>
          </label>
          ${
            selected.length === 1 && (ref.startBinding || ref.endBinding)
              ? `<div class="wb-prop-row" style="gap:4px;">
                  ${
                    ref.startBinding
                      ? `<label style="display:flex;align-items:center;gap:4px;font-size:11px;">Start Port <select id="prop-start-port" aria-label="Start Port">${portOpts
                          .map(
                            (p) =>
                              `<option value="${p}" ${(ref.startBinding.port || 'auto') === p ? 'selected' : ''}>${p}</option>`
                          )
                          .join('')}</select></label>`
                      : ''
                  }
                  ${
                    ref.endBinding
                      ? `<label style="display:flex;align-items:center;gap:4px;font-size:11px;">End Port <select id="prop-end-port" aria-label="End Port">${portOpts
                          .map(
                            (p) =>
                              `<option value="${p}" ${(ref.endBinding.port || 'auto') === p ? 'selected' : ''}>${p}</option>`
                          )
                          .join('')}</select></label>`
                      : ''
                  }
                </div>`
              : ''
          }
          ${
            selected.length >= 1
              ? `<button type="button" class="wb-btn wb-sm" id="btn-reset-route" title="Reset manual bend/elbow adjustments and recompute automatic route">↺ Reset Route</button>`
              : ''
          }
        </div>
      `);
    }

    // Typography
    if (hasText) {
      const fontMeta = getSharedProp(selected, (e) => e.fontFamily || 'sans', ref.fontFamily || 'sans');
      const sizeMeta = getSharedProp(selected, (e) => e.fontSize || 18, ref.fontSize || 18);
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-row" style="margin-top:0;">
            <span class="wb-prop-title" style="margin:0;">Label & Typography</span>
            ${fontMeta.mixed || sizeMeta.mixed ? `<span class="wb-mixed-badge">Mixed</span>` : ''}
          </div>
          ${
            selected.length === 1 && !isConnector
              ? selected[0].type === 'code'
                ? `<label class="wb-prop-row" style="align-items:flex-start;">
                    <span style="padding-top:4px;">Code</span>
                    <textarea id="prop-label-text" class="wb-textarea wb-code-input" rows="8" spellcheck="false" placeholder="Paste a script or command block…" aria-label="Code Block Content">${escapeXml(ref.text || '')}</textarea>
                  </label>
                  <div class="wb-prop-row" style="font-size:10px;color:var(--text-secondary);">
                    Newlines and indentation are preserved exactly. Enter inserts a new line.
                  </div>`
                : `<label class="wb-prop-row">
                    <span>Label</span>
                    <input type="text" id="prop-label-text" class="wb-input" style="width:128px;padding:3px 6px;" placeholder="Component label..." value="${escapeXml(ref.text || '')}" aria-label="Component Label"/>
                  </label>`
              : ''
          }
          <label class="wb-prop-row">
            <span>Font</span>
            <select id="prop-font-family" aria-label="Font Family">
              ${fontMeta.mixed ? `<option value="__mixed__" selected disabled>— Mixed —</option>` : ''}
              <option value="sans" ${!fontMeta.mixed && fontMeta.value === 'sans' ? 'selected' : ''}>Sans-serif</option>
              <option value="serif" ${!fontMeta.mixed && fontMeta.value === 'serif' ? 'selected' : ''}>Serif</option>
              <option value="mono" ${!fontMeta.mixed && fontMeta.value === 'mono' ? 'selected' : ''}>Monospace</option>
              <option value="hand" ${!fontMeta.mixed && fontMeta.value === 'hand' ? 'selected' : ''}>Hand-drawn</option>
            </select>
          </label>
          <label class="wb-prop-row">
            <span>Size (${sizeMeta.mixed ? 'Mixed' : `${sizeMeta.value}px`})</span>
            <input type="range" id="prop-font-size" min="10" max="64" value="${sizeMeta.value || 18}"/>
          </label>
          <label class="wb-prop-row">
            <span>Text Color</span>
            <input type="color" id="prop-text-color" value="${(ref.textColor || ref.stroke || '#1e293b').startsWith('#') ? (ref.textColor || ref.stroke) : '#1e293b'}" aria-label="Text Color"/>
          </label>
          <div class="wb-btn-group">
            ${['left', 'center', 'right']
              .map(
                (al) =>
                  `<button type="button" class="wb-btn wb-sm ${(ref.textAlign || 'center') === al ? 'active' : ''}" data-align="${al}">${al}</button>`
              )
              .join('')}
          </div>
        </div>
      `);
    }

    // Image controls
    if (isImage && selected.length === 1) {
      const imgEl = selected[0];
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Image Options</div>
          <label class="wb-prop-row">
            <span>Lock Aspect Ratio</span>
            <input type="checkbox" id="prop-img-aspect" ${imgEl.lockAspectRatio !== false ? 'checked' : ''}/>
          </label>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="btn-img-crop">${app.cropState ? 'Apply Crop' : '✂ Crop Image'}</button>
            ${imgEl.crop ? `<button type="button" class="wb-btn wb-sm" id="btn-img-reset-crop">Reset Crop</button>` : ''}
            <button type="button" class="wb-btn wb-sm" id="btn-img-bg">${imgEl.isBackground ? 'Unlock BG' : 'Lock as BG'}</button>
          </div>
        </div>
      `);
    }

    // Multi-selection Alignment & Distribution
    if (selected.length >= 2) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Align & Distribute (${selected.length})</div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" data-align-el="left" title="Align Left">⇤</button>
            <button type="button" class="wb-btn wb-sm" data-align-el="center" title="Align Center">⇹</button>
            <button type="button" class="wb-btn wb-sm" data-align-el="right" title="Align Right">⇥</button>
            <button type="button" class="wb-btn wb-sm" data-align-el="top" title="Align Top">⇡</button>
            <button type="button" class="wb-btn wb-sm" data-align-el="middle" title="Align Middle">⇳</button>
            <button type="button" class="wb-btn wb-sm" data-align-el="bottom" title="Align Bottom">⇣</button>
          </div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" data-dist="horizontal">Distribute H</button>
            <button type="button" class="wb-btn wb-sm" data-dist="vertical">Distribute V</button>
            <button type="button" class="wb-btn wb-sm" id="btn-match-size">Match Size</button>
          </div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" data-arrange="row" title="Arrange in Horizontal Row">→ Row</button>
            <button type="button" class="wb-btn wb-sm" data-arrange="column" title="Arrange in Vertical Column">↓ Col</button>
            <button type="button" class="wb-btn wb-sm" data-arrange="grid" title="Arrange in Balanced Grid">⊞ Grid</button>
            <button type="button" class="wb-btn wb-sm" id="btn-auto-connect" title="Connect Selected Components in Sequence">⛓ Connect</button>
          </div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="btn-auto-layout-lr" title="Auto-Layout Architecture Left-to-Right">⇄ Auto-Layout LR</button>
            <button type="button" class="wb-btn wb-sm" id="btn-auto-layout-tb" title="Auto-Layout Architecture Top-to-Bottom">⇅ Auto-Layout TB</button>
          </div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="btn-group">Group (⌘G)</button>
            <button type="button" class="wb-btn wb-sm" id="btn-ungroup">Ungroup</button>
          </div>
        </div>
      `);
    }

    // Common Selection Actions (Reveal Step, Hyperlink, Format Painter, Library, Z-order, Lock)
    if (selected.length > 0) {
      const revMeta = getSharedProp(selected, (e) => e.revealStep || 0, ref.revealStep || 0);
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-row" style="margin-top:0;">
            <span class="wb-prop-title" style="margin:0;">Element Actions</span>
            ${revMeta.mixed ? `<span class="wb-mixed-badge">Mixed</span>` : ''}
          </div>
          <label class="wb-prop-row">
            <span>Reveal Step</span>
            <select id="prop-reveal-step" aria-label="Presentation Reveal Step">
              ${revMeta.mixed ? `<option value="__mixed__" selected disabled>— Mixed —</option>` : ''}
              <option value="0" ${!revMeta.mixed && revMeta.value === 0 ? 'selected' : ''}>Always Visible</option>
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
                .map(
                  (s) =>
                    `<option value="${s}" ${!revMeta.mixed && revMeta.value === s ? 'selected' : ''}>Step ${s}</option>`
                )
                .join('')}
            </select>
          </label>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="btn-copy-style" title="Copy Style (Format Painter)">🖌 Copy Style</button>
            <button type="button" class="wb-btn wb-sm" id="btn-add-to-lib" title="Save Selection to Reusable Library">➕ To Library</button>
            <button type="button" class="wb-btn wb-sm" id="btn-edit-link" title="Attach Hyperlink URL">🔗 Link</button>
          </div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" data-z="front" title="Bring to Front (])">Front</button>
            <button type="button" class="wb-btn wb-sm" data-z="back" title="Send to Back ([)">Back</button>
            <button type="button" class="wb-btn wb-sm" id="btn-lock-el">${ref.locked ? '🔓 Unlock' : '🔒 Lock'}</button>
            <button type="button" class="wb-btn wb-sm wb-danger" id="btn-delete-el" aria-label="Delete selected elements" title="Delete selected elements">🗑</button>
          </div>
        </div>
      `);
    }

    container.innerHTML = sections.join('');
    container.scrollTop = prevScroll;
    bindToolContext();
    bindEvents(selected);
  }

  function bindEvents(selected) {
    container.querySelector('#btn-close-props')?.addEventListener('click', () => {
      if (app.setPropsDrawerOpen) {
        app.setPropsDrawerOpen(false);
      } else {
        app.propsDrawerOpen = false;
        container.classList.add('wb-hidden');
        app.toolbarUI?.update();
      }
    });

    const onPageNotesUpdate = (e) => {
      const page = app.getPage();
      page.teacherNotes = e.target.value;
      app.scheduleAutosave(app.scene);
      app.presentUI?.renderBar?.();
    };
    container.querySelector('#prop-page-teacher-notes')?.addEventListener('input', onPageNotesUpdate);
    container.querySelector('#prop-page-teacher-notes')?.addEventListener('change', onPageNotesUpdate);

    container.querySelectorAll('[data-breadcrumb-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const page = app.getPage();
        const grpId = btn.dataset.breadcrumbGroup;
        if (grpId) {
          const grpMembers = page.elements.filter((e) => e.groupId === grpId && !e.hidden).map((e) => e.id);
          if (grpMembers.length > 0) {
            app.selectedIds = new Set(grpMembers);
            app.updateUI();
            app.requestRender();
          }
          return;
        }
        const targetId = btn.dataset.breadcrumbId;
        if (targetId && page.elements.some((e) => e.id === targetId)) {
          app.selectedIds = new Set([targetId]);
          app.updateUI();
          app.requestRender();
        }
      });
    });

    container.querySelector('#btn-select-container-children')?.addEventListener('click', () => {
      if (selected.length === 1) {
        const page = app.getPage();
        const children = getContainerChildren(page, selected[0].id);
        if (children.length > 0) {
          app.selectedIds = new Set(children.map((c) => c.id));
          app.updateUI();
          app.requestRender();
        }
      }
    });

    const applyProp = (mutator) => {
      mutator(app.currentStyle);
      for (const el of selected) {
        if (!el.locked) mutator(el);
      }
      if (selected.length > 0) app.commitChange();
      app.requestRender();
      render();
    };

    container.querySelectorAll('[data-stroke]').forEach((b) => {
      b.addEventListener('click', () =>
        applyProp((t) => {
          t.stroke = b.dataset.stroke;
          if (t.type === 'text') t.textColor = b.dataset.stroke;
        })
      );
    });
    container.querySelector('#prop-stroke-custom')?.addEventListener('input', (e) => {
      applyProp((t) => {
        t.stroke = e.target.value;
        if (t.type === 'text') t.textColor = e.target.value;
      });
    });
    container.querySelector('#prop-stroke-width')?.addEventListener('change', (e) => applyProp((t) => (t.strokeWidth = Number(e.target.value))));
    container.querySelector('#prop-opacity')?.addEventListener('input', (e) =>
      applyProp((t) => (t.opacity = Math.max(0.05, Math.min(1, Number(e.target.value) / 100))))
    );
    container.querySelectorAll('[data-stroke-style]').forEach((b) => b.addEventListener('click', () => applyProp((t) => (t.strokeStyle = b.dataset.strokeStyle))));
    container.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => applyProp((t) => (t.fill = b.dataset.fill))));
    container.querySelector('#prop-fill-custom')?.addEventListener('input', (e) => applyProp((t) => (t.fill = e.target.value)));
    container.querySelectorAll('[data-fill-pattern]').forEach((b) =>
      b.addEventListener('click', () => applyProp((t) => (t.fillPattern = b.dataset.fillPattern)))
    );
    container.querySelector('#prop-roundness')?.addEventListener('change', (e) => applyProp((t) => (t.roundness = Number(e.target.value))));
    container.querySelector('#prop-sloppy')?.addEventListener('change', (e) => applyProp((t) => (t.sloppy = e.target.checked)));
    container.querySelector('#prop-autogrow')?.addEventListener('change', (e) => applyProp((t) => (t.autoGrow = e.target.checked)));
    container.querySelectorAll('[data-routing]').forEach((b) =>
      b.addEventListener('click', () =>
        applyProp((t) => {
          t.routing = b.dataset.routing;
          if (t.id) updateConnectorBindings(app.getPage(), [t.id]);
        })
      )
    );
    container.querySelector('#prop-corner-radius')?.addEventListener('input', (e) => {
      applyProp((t) => {
        t.cornerRadius = Math.max(4, Math.min(36, Number(e.target.value) || 14));
      });
    });
    container.querySelectorAll('[data-dir-preset]').forEach((b) =>
      b.addEventListener('click', () =>
        applyProp((t) => applyConnectorDirectionPreset(t, b.dataset.dirPreset))
      )
    );
    container.querySelectorAll('[data-arrow-quick]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.arrowQuick;
        applyProp((t) => applyArrowQuickPreset(t, id));
      })
    );
    container.querySelectorAll('[data-roughness]').forEach((b) =>
      b.addEventListener('click', () => {
        const level = Math.max(0, Math.min(2, Number(b.dataset.roughness) || 0));
        applyProp((t) => {
          t.roughness = level;
          t.sloppy = level >= 1;
        });
      })
    );
    container.querySelector('#prop-start-label')?.addEventListener('change', (e) => {
      if (selected[0] && !selected[0].locked) {
        selected[0].startLabel = e.target.value;
        app.commitChange();
        app.requestRender();
      }
    });
    container.querySelector('#prop-start-label')?.addEventListener('input', (e) => {
      if (selected[0] && !selected[0].locked) {
        selected[0].startLabel = e.target.value;
        app.requestRender();
      }
    });
    container.querySelector('#prop-end-label')?.addEventListener('change', (e) => {
      if (selected[0] && !selected[0].locked) {
        selected[0].endLabel = e.target.value;
        app.commitChange();
        app.requestRender();
      }
    });
    container.querySelector('#prop-end-label')?.addEventListener('input', (e) => {
      if (selected[0] && !selected[0].locked) {
        selected[0].endLabel = e.target.value;
        app.requestRender();
      }
    });
    container.querySelectorAll('[data-quick-label]').forEach((b) =>
      b.addEventListener('click', () => {
        if (selected[0] && !selected[0].locked) {
          selected[0].text = selected[0].text === b.dataset.quickLabel ? '' : b.dataset.quickLabel;
          app.commitChange();
          app.requestRender();
          render();
        }
      })
    );
    container.querySelector('#prop-label-t')?.addEventListener('input', (e) => {
      if (selected[0] && !selected[0].locked) {
        selected[0].labelT = Number(e.target.value) / 100;
        app.commitChange();
        app.requestRender();
        render();
      }
    });
    container.querySelector('#prop-start-port')?.addEventListener('change', (e) => {
      if (selected[0]?.startBinding) {
        selected[0].startBinding.port = e.target.value;
        updateConnectorBindings(app.getPage(), [selected[0].id]);
        app.commitChange();
        app.requestRender();
      }
    });
    container.querySelector('#prop-end-port')?.addEventListener('change', (e) => {
      if (selected[0]?.endBinding) {
        selected[0].endBinding.port = e.target.value;
        updateConnectorBindings(app.getPage(), [selected[0].id]);
        app.commitChange();
        app.requestRender();
      }
    });
    container.querySelector('#btn-reset-route')?.addEventListener('click', () => {
      const page = app.getPage();
      for (const el of selected) {
        if (el.type === 'line' || el.type === 'arrow') {
          resetConnectorRoute(el, page);
          updateConnectorBindings(page, [el.id]);
        }
      }
      app.commitChange();
      app.requestRender();
      render();
    });
    container.querySelector('#prop-start-arrow')?.addEventListener('change', (e) => applyProp((t) => (t.startArrow = e.target.value)));
    container.querySelector('#prop-end-arrow')?.addEventListener('change', (e) => applyProp((t) => (t.endArrow = e.target.value)));
    container.querySelector('#prop-font-family')?.addEventListener('change', (e) => applyProp((t) => (t.fontFamily = e.target.value)));
    container.querySelector('#prop-font-size')?.addEventListener('change', (e) => applyProp((t) => (t.fontSize = Number(e.target.value))));
    container.querySelector('#prop-text-color')?.addEventListener('input', (e) => applyProp((t) => (t.textColor = e.target.value)));
    const onMidLabelUpdate = (e) => {
      if (selected[0] && !selected[0].locked) {
        selected[0].text = e.target.value;
        app.commitChange();
        app.requestRender();
      }
    };
    container.querySelector('#prop-label-text')?.addEventListener('input', onMidLabelUpdate);
    container.querySelector('#prop-label-text')?.addEventListener('change', onMidLabelUpdate);
    container.querySelectorAll('[data-align]').forEach((b) => b.addEventListener('click', () => applyProp((t) => (t.textAlign = b.dataset.align))));
    container.querySelector('#prop-bg-type')?.addEventListener('change', (e) => app.setBackground(e.target.value));
    container.querySelector('#prop-snap-grid')?.addEventListener('change', (e) => { app.scene.settings.snapToGrid = e.target.checked; app.scheduleAutosave(app.scene); });
    container.querySelector('#prop-snap-obj')?.addEventListener('change', (e) => { app.scene.settings.snapToObjects = e.target.checked; app.scheduleAutosave(app.scene); });
    container.querySelectorAll('[data-math]').forEach((b) => b.addEventListener('click', () => app.insertMathOverlay(b.dataset.math)));
    container.querySelectorAll('[data-stamp-kind]').forEach((b) =>
      b.addEventListener('click', () => {
        // selectKind restarts step numbering at 1 when the steps bubble is picked.
        app.stampTool.selectKind(b.dataset.stampKind);
        render();
      })
    );
    container.querySelector('#btn-steps-restart')?.addEventListener('click', () => {
      app.stampTool.resetSteps();
      render();
    });
    container.querySelector('#prop-fading-ink')?.addEventListener('change', (e) => (app.fadingInk = e.target.checked));
    container.querySelector('#prop-magnifier')?.addEventListener('change', (e) => { app.spotlight.magnifier = e.target.checked; app.requestRender(); });

    // Table actions
    if (selected.length === 1 && selected[0].type === 'table') {
      const tbl = selected[0];
      const lockedToast = () => {
        app.dialogs?.showToast?.('Unlock the table before changing its structure.');
        render();
      };
      const applyTable = () => {
        if (tbl.locked) return lockedToast();
        app.commitChange();
        app.updateUI();
        app.requestRender();
      };
      const restructure = (fn) => {
        if (tbl.locked) return lockedToast();
        fn();
        // Re-measure so a new row/column never clips existing content.
        fitTable(app.renderer?.ctx, tbl);
        applyTable();
        render();
      };
      container.querySelector('#btn-table-add-row')?.addEventListener('click', () => restructure(() => insertTableRow(tbl, 1)));
      container.querySelector('#btn-table-del-row')?.addEventListener('click', () => restructure(() => deleteTableRow(tbl, 1)));
      container.querySelector('#btn-table-add-col')?.addEventListener('click', () => restructure(() => insertTableCol(tbl, 1)));
      container.querySelector('#btn-table-del-col')?.addEventListener('click', () => restructure(() => deleteTableCol(tbl, 1)));

      // Cell / row / column / whole-table styling. Without an active cell every
      // button degrades to the whole table, matching "select all" semantics.
      const activeCell = () =>
        app.lastTableCell && app.lastTableCell.elId === tbl.id ? app.lastTableCell : null;
      const styleScope = () => (activeCell() ? tableStyleScope : 'table');
      container.querySelectorAll('[data-table-scope]').forEach((b) =>
        b.addEventListener('click', () => {
          tableStyleScope = b.dataset.tableScope;
          render();
        })
      );
      container.querySelector('#btn-table-select-all')?.addEventListener('click', () => {
        // Selection is element-level in this app, so "select all cells" means:
        // own the table selection and drop the per-cell style target.
        app.lastTableCell = null;
        tableStyleScope = 'table';
        app.selectedIds = new Set([tbl.id]);
        app.dialogs?.showToast?.('Whole table targeted — alignment and colour now apply to every cell.', 'info');
        app.updateUI();
        app.requestRender();
        render();
      });
      container.querySelectorAll('[data-table-align]').forEach((b) =>
        b.addEventListener('click', () => {
          if (tbl.locked) return lockedToast();
          const align = b.dataset.tableAlign;
          const cell = activeCell();
          const scope = styleScope();
          if (!cell || scope === 'table') setTableAlignment(tbl, align);
          else if (scope === 'row') setRowAlignment(tbl, cell.row, align);
          else if (scope === 'col') setColAlignment(tbl, cell.col, align);
          else setCellAlignment(tbl, cell.row, cell.col, align);
          applyTable();
          render();
        })
      );
      container.querySelectorAll('[data-table-color]').forEach((b) =>
        b.addEventListener('click', () => {
          if (tbl.locked) return lockedToast();
          const color = b.dataset.tableColor === 'transparent' ? '' : b.dataset.tableColor;
          const cell = activeCell();
          const scope = styleScope();
          if (!cell || scope === 'table') {
            tbl.fill = color || 'transparent';
            // Whole-table fill replaces the per-cell overrides, exactly like
            // whole-table alignment clears them — leaving cellColors behind
            // made the new fill look like it didn't apply.
            tbl.cellColors = null;
          } else if (scope === 'row') {
            setRowColor(tbl, cell.row, color);
          } else if (scope === 'col') {
            for (let r = 0; r < (tbl.rows || 1); r++) setCellColor(tbl, r, cell.col, color);
          } else {
            setCellColor(tbl, cell.row, cell.col, color);
          }
          applyTable();
          render();
        })
      );
      container.querySelector('#prop-table-header')?.addEventListener('change', (e) => {
        if (tbl.locked) return lockedToast();
        tbl.headerRow = e.target.checked;
        applyTable();
      });
      container.querySelector('#prop-table-striped')?.addEventListener('change', (e) => {
        if (tbl.locked) return lockedToast();
        tbl.striped = e.target.checked;
        applyTable();
      });
      container.querySelector('#prop-table-align')?.addEventListener('change', (e) => {
        if (tbl.locked) { render(); return; }
        tbl.textAlign = e.target.value;
        applyTable();
      });
      container.querySelector('#prop-table-valign')?.addEventListener('change', (e) => {
        if (tbl.locked) { render(); return; }
        tbl.valign = e.target.value;
        applyTable();
      });
      container.querySelector('#prop-table-padding')?.addEventListener('input', (e) => {
        if (tbl.locked) { render(); return; }
        tbl.cellPadding = Number(e.target.value);
        const label = e.target.closest('.wb-prop-row')?.querySelector('span');
        if (label) label.textContent = `Cell padding (${tbl.cellPadding}px)`;
        app.requestRender();
      });
      container.querySelector('#prop-table-padding')?.addEventListener('change', () => applyTable());
      container.querySelector('#btn-table-fit')?.addEventListener('click', () => {
        if (tbl.locked) return lockedToast();
        fitTable(app.renderer?.ctx, tbl);
        applyTable();
      });
      container.querySelector('#btn-table-equal')?.addEventListener('click', () => {
        if (tbl.locked) return lockedToast();
        equalizeTableSpans(tbl);
        applyTable();
      });
      container.querySelector('#btn-table-structure')?.addEventListener('click', () => {
        if (tbl.locked) return lockedToast();
        app.dialogs?.openTableInsertModal(tbl);
      });
    }

    if (selected.length === 1 && selected[0].type === 'code') {
      container.querySelector('#btn-open-code-editor')?.addEventListener('click', () => {
        app.dialogs?.openCodeEditorModal(selected[0]);
      });
    }

    // Code highlight & Frame / Boundary Container options
    container.querySelector('#prop-move-children')?.addEventListener('change', (e) => {
      if (selected[0]) {
        selected[0].moveChildren = e.target.checked;
        app.commitChange();
      }
    });
    container.querySelector('#prop-frame-include-pres')?.addEventListener('change', (e) => {
      if (selected[0]) {
        const included = Boolean(e.target.checked);
        selected[0].includeInPresentation = included;
        selected[0].excludeFromPresentation = !included;
        app.commitChange();
        app.presentUI?.renderBar?.();
        app.requestRender();
      }
    });
    const onFrameNotesUpdate = (e) => {
      if (selected[0]) {
        selected[0].teacherNotes = e.target.value;
        app.commitChange();
        app.presentUI?.renderBar?.();
      }
    };
    const onFrameNotesInput = (e) => {
      if (selected[0]) {
        selected[0].teacherNotes = e.target.value;
        app.scheduleAutosave(app.scene);
        app.presentUI?.renderBar?.();
      }
    };
    container.querySelector('#prop-el-teacher-notes')?.addEventListener('input', onFrameNotesInput);
    container.querySelector('#prop-el-teacher-notes')?.addEventListener('change', onFrameNotesUpdate);
    container.querySelector('#prop-code-hl')?.addEventListener('input', (e) => {
      if (selected[0]) { selected[0].highlightLines = e.target.value; app.commitChange(); app.requestRender(); }
    });
    container.querySelector('#prop-slide-order')?.addEventListener('change', (e) => {
      if (selected[0]) { selected[0].slideOrder = Math.max(1, Number(e.target.value) || 1); app.commitChange(); app.requestRender(); }
    });
    container.querySelector('#prop-frame-clip')?.addEventListener('change', (e) => {
      if (selected[0]) { selected[0].clip = e.target.checked; app.commitChange(); app.requestRender(); }
    });
    container.querySelector('#btn-frame-collapse')?.addEventListener('click', () => { if (selected[0]) app.toggleFrame(selected[0].id); });

    // Image options
    container.querySelector('#prop-img-aspect')?.addEventListener('change', (e) => {
      if (selected[0]) { selected[0].lockAspectRatio = e.target.checked; app.commitChange(); }
    });
    container.querySelector('#btn-img-crop')?.addEventListener('click', () => { if (selected[0]) app.toggleImageCrop(selected[0]); });
    container.querySelector('#btn-img-reset-crop')?.addEventListener('click', () => {
      if (selected[0]) { selected[0].crop = null; app.commitChange(); app.requestRender(); render(); }
    });
    container.querySelector('#btn-img-bg')?.addEventListener('click', () => { if (selected[0]) app.toggleImageBackgroundLock(selected[0]); });

    // Alignment, Arrangement & Distribution
    container.querySelectorAll('[data-align-el]').forEach((b) => b.addEventListener('click', () => app.alignSelection(b.dataset.alignEl)));
    container.querySelectorAll('[data-dist]').forEach((b) => b.addEventListener('click', () => app.distributeSelection(b.dataset.dist)));
    container.querySelectorAll('[data-arrange]').forEach((b) => b.addEventListener('click', () => app.arrangeSelection(b.dataset.arrange)));
    container.querySelector('#btn-auto-connect')?.addEventListener('click', () => app.connectSelectionFlow());
    container.querySelector('#btn-auto-layout-lr')?.addEventListener('click', () => app.autoLayoutSelection('LR'));
    container.querySelector('#btn-auto-layout-tb')?.addEventListener('click', () => app.autoLayoutSelection('TB'));
    container.querySelector('#btn-match-size')?.addEventListener('click', () => app.matchSelectionSize());
    container.querySelector('#btn-group')?.addEventListener('click', () => app.groupSelection());
    container.querySelector('#btn-ungroup')?.addEventListener('click', () => app.ungroupSelection());

    // Element actions
    container.querySelector('#prop-reveal-step')?.addEventListener('change', (e) => {
      const val = Number(e.target.value);
      for (const el of selected) el.revealStep = val;
      app.commitChange(); app.requestRender();
    });
    container.querySelector('#btn-copy-style')?.addEventListener('click', () => app.copySelectedStyle());
    container.querySelector('#btn-add-to-lib')?.addEventListener('click', () => app.addSelectionToLibrary());
    container.querySelector('#btn-edit-link')?.addEventListener('click', () => app.dialogs.openHyperlinkModal());
    container.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => app.reorderSelection(b.dataset.z)));
    container.querySelector('#btn-lock-el')?.addEventListener('click', () => app.toggleLockSelection());
    container.querySelector('#btn-delete-el')?.addEventListener('click', () => app.deleteSelection());
  }

  return { update: render };
}
