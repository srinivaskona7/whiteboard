// ui/props-panel.js
import { PALETTE_STROKE_COLORS, PALETTE_FILL_COLORS } from '../render/themes.js';
import { escapeXml } from '../render/svg-export.js';

export function initPropsPanel(app) {
  const container = document.getElementById('wb-props-panel');
  if (!container) return { update() {} };

  function render() {
    const page = app.getPage();
    const selected = page.elements.filter((e) => app.selectedIds.has(e.id));
    const tool = app.activeTool;

    const sections = [];

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
      container.innerHTML = sections.join('');
      bindEvents(selected);
      return;
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
            ]
              .map(
                ([k, label]) =>
                  `<button type="button" class="wb-btn wb-sm ${sk === k ? 'active' : ''}" data-stamp-kind="${k}">${label}</button>`
              )
              .join('')}
          </div>
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

    // Stroke & Fill
    if (!isImage) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Stroke</div>
          <div class="wb-color-grid">
            ${PALETTE_STROKE_COLORS.map(
              (c) =>
                `<button type="button" class="wb-color-swatch ${ref.stroke === c ? 'active' : ''}" style="background:${c}" data-stroke="${c}" aria-label="Stroke ${c}"></button>`
            ).join('')}
            <input type="color" id="prop-stroke-custom" value="${ref.stroke && ref.stroke.startsWith('#') ? ref.stroke : '#1e293b'}" aria-label="Custom stroke color"/>
          </div>
          <label class="wb-prop-row">
            <span>Width (${ref.strokeWidth || 2}px)</span>
            <input type="range" id="prop-stroke-width" min="1" max="24" value="${ref.strokeWidth || 2}"/>
          </label>
          <div class="wb-btn-group">
            ${['solid', 'dashed', 'dotted']
              .map(
                (st) =>
                  `<button type="button" class="wb-btn wb-sm ${(ref.strokeStyle || 'solid') === st ? 'active' : ''}" data-stroke-style="${st}">${st}</button>`
              )
              .join('')}
          </div>
        </div>
      `);
    }

    if (isShape) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Fill & Shape Style</div>
          <div class="wb-color-grid">
            ${PALETTE_FILL_COLORS.map(
              (c) =>
                `<button type="button" class="wb-color-swatch ${ref.fill === c ? 'active' : ''} ${c === 'transparent' ? 'wb-swatch-clear' : ''}" style="background:${c === 'transparent' ? 'transparent' : c}" data-fill="${c}" aria-label="Fill ${c}"></button>`
            ).join('')}
            <input type="color" id="prop-fill-custom" value="${ref.fill && ref.fill.startsWith('#') ? ref.fill : '#ffffff'}" aria-label="Custom fill color"/>
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

    // Connector Routing & Arrowheads
    if (isConnector) {
      const arrowTypes = ['none', 'arrow', 'triangle', 'diamond', 'circle', 'bar'];
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Connector Routing</div>
          <div class="wb-btn-group">
            ${['straight', 'orthogonal', 'curved']
              .map(
                (rt) =>
                  `<button type="button" class="wb-btn wb-sm ${(ref.routing || 'orthogonal') === rt ? 'active' : ''}" data-routing="${rt}">${rt}</button>`
              )
              .join('')}
          </div>
          <label class="wb-prop-row">
            <span>Start Cap</span>
            <select id="prop-start-arrow" aria-label="Start Arrowhead">
              ${arrowTypes
                .map(
                  (a) => `<option value="${a}" ${ref.startArrow === a ? 'selected' : ''}>${a}</option>`
                )
                .join('')}
            </select>
          </label>
          <label class="wb-prop-row">
            <span>End Cap</span>
            <select id="prop-end-arrow" aria-label="End Arrowhead">
              ${arrowTypes
                .map(
                  (a) => `<option value="${a}" ${ref.endArrow === a ? 'selected' : ''}>${a}</option>`
                )
                .join('')}
            </select>
          </label>
        </div>
      `);
    }

    // Typography
    if (hasText) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Typography</div>
          <label class="wb-prop-row">
            <span>Font</span>
            <select id="prop-font-family" aria-label="Font Family">
              <option value="sans" ${ref.fontFamily === 'sans' ? 'selected' : ''}>Sans-serif</option>
              <option value="serif" ${ref.fontFamily === 'serif' ? 'selected' : ''}>Serif</option>
              <option value="mono" ${ref.fontFamily === 'mono' ? 'selected' : ''}>Monospace</option>
              <option value="hand" ${ref.fontFamily === 'hand' ? 'selected' : ''}>Hand-drawn</option>
            </select>
          </label>
          <label class="wb-prop-row">
            <span>Size (${ref.fontSize || 18}px)</span>
            <input type="range" id="prop-font-size" min="10" max="64" value="${ref.fontSize || 18}"/>
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

    // Table controls
    if (types.has('table') && selected.length === 1) {
      const tbl = selected[0];
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Table (${tbl.rows} × ${tbl.cols})</div>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="btn-table-add-row">+ Row</button>
            <button type="button" class="wb-btn wb-sm" id="btn-table-del-row">− Row</button>
            <button type="button" class="wb-btn wb-sm" id="btn-table-add-col">+ Col</button>
            <button type="button" class="wb-btn wb-sm" id="btn-table-del-col">− Col</button>
          </div>
        </div>
      `);
    }

    // Code block controls
    if (types.has('code') && selected.length === 1) {
      const cd = selected[0];
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Code Highlight</div>
          <label class="wb-prop-row">
            <span>Lines (e.g. 1,3-4)</span>
            <input type="text" id="prop-code-hl" value="${escapeXml(cd.highlightLines || '')}" style="width:90px"/>
          </label>
        </div>
      `);
    }

    // Frame controls
    if (types.has('frame') && selected.length === 1) {
      const fr = selected[0];
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Frame / Slide</div>
          <label class="wb-prop-row">
            <span>Slide Order #</span>
            <input type="number" id="prop-slide-order" min="1" max="99" value="${fr.slideOrder || 1}" style="width:60px"/>
          </label>
          <label class="wb-prop-row">
            <span>Clip Children</span>
            <input type="checkbox" id="prop-frame-clip" ${fr.clip ? 'checked' : ''}/>
          </label>
          <button type="button" class="wb-btn wb-sm" id="btn-frame-collapse">${fr.collapsed ? 'Expand Frame' : 'Collapse Frame'}</button>
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
            <button type="button" class="wb-btn wb-sm" id="btn-group">Group (⌘G)</button>
            <button type="button" class="wb-btn wb-sm" id="btn-ungroup">Ungroup</button>
          </div>
        </div>
      `);
    }

    // Common Selection Actions (Reveal Step, Hyperlink, Format Painter, Library, Z-order, Lock)
    if (selected.length > 0) {
      sections.push(`
        <div class="wb-prop-section">
          <div class="wb-prop-title">Element Actions</div>
          <label class="wb-prop-row">
            <span>Reveal Step</span>
            <select id="prop-reveal-step" aria-label="Presentation Reveal Step">
              <option value="0" ${(ref.revealStep || 0) === 0 ? 'selected' : ''}>Always Visible</option>
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
                .map(
                  (s) =>
                    `<option value="${s}" ${ref.revealStep === s ? 'selected' : ''}>Step ${s}</option>`
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
            <button type="button" class="wb-btn wb-sm wb-danger" id="btn-delete-el">🗑</button>
          </div>
        </div>
      `);
    }

    container.innerHTML = sections.join('');
    bindEvents(selected);
  }

  function bindEvents(selected) {
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
    container.querySelector('#prop-stroke-width')?.addEventListener('change', (e) => {
      applyProp((t) => (t.strokeWidth = Number(e.target.value)));
    });
    container.querySelectorAll('[data-stroke-style]').forEach((b) => {
      b.addEventListener('click', () => applyProp((t) => (t.strokeStyle = b.dataset.strokeStyle)));
    });
    container.querySelectorAll('[data-fill]').forEach((b) => {
      b.addEventListener('click', () => applyProp((t) => (t.fill = b.dataset.fill)));
    });
    container.querySelector('#prop-fill-custom')?.addEventListener('input', (e) => {
      applyProp((t) => (t.fill = e.target.value));
    });
    container.querySelector('#prop-roundness')?.addEventListener('change', (e) => {
      applyProp((t) => (t.roundness = Number(e.target.value)));
    });
    container.querySelector('#prop-sloppy')?.addEventListener('change', (e) => {
      applyProp((t) => (t.sloppy = e.target.checked));
    });
    container.querySelector('#prop-autogrow')?.addEventListener('change', (e) => {
      applyProp((t) => (t.autoGrow = e.target.checked));
    });
    container.querySelectorAll('[data-routing]').forEach((b) => {
      b.addEventListener('click', () => applyProp((t) => (t.routing = b.dataset.routing)));
    });
    container.querySelector('#prop-start-arrow')?.addEventListener('change', (e) => {
      applyProp((t) => (t.startArrow = e.target.value));
    });
    container.querySelector('#prop-end-arrow')?.addEventListener('change', (e) => {
      applyProp((t) => (t.endArrow = e.target.value));
    });
    container.querySelector('#prop-font-family')?.addEventListener('change', (e) => {
      applyProp((t) => (t.fontFamily = e.target.value));
    });
    container.querySelector('#prop-font-size')?.addEventListener('change', (e) => {
      applyProp((t) => (t.fontSize = Number(e.target.value)));
    });
    container.querySelector('#prop-text-color')?.addEventListener('input', (e) => {
      applyProp((t) => (t.textColor = e.target.value));
    });
    container.querySelectorAll('[data-align]').forEach((b) => {
      b.addEventListener('click', () => applyProp((t) => (t.textAlign = b.dataset.align)));
    });

    // Canvas & Grid
    container.querySelector('#prop-bg-type')?.addEventListener('change', (e) => {
      app.setBackground(e.target.value);
    });
    container.querySelector('#prop-snap-grid')?.addEventListener('change', (e) => {
      app.scene.settings.snapToGrid = e.target.checked;
      app.scheduleAutosave(app.scene);
    });
    container.querySelector('#prop-snap-obj')?.addEventListener('change', (e) => {
      app.scene.settings.snapToObjects = e.target.checked;
      app.scheduleAutosave(app.scene);
    });
    container.querySelectorAll('[data-math]').forEach((b) => {
      b.addEventListener('click', () => app.insertMathOverlay(b.dataset.math));
    });

    // Stamp kind
    container.querySelectorAll('[data-stamp-kind]').forEach((b) => {
      b.addEventListener('click', () => {
        app.stampTool.stampKind = b.dataset.stampKind;
        render();
      });
    });

    // Annotation & Spotlight
    container.querySelector('#prop-fading-ink')?.addEventListener('change', (e) => {
      app.fadingInk = e.target.checked;
    });
    container.querySelector('#prop-magnifier')?.addEventListener('change', (e) => {
      app.spotlight.magnifier = e.target.checked;
      app.requestRender();
    });

    // Table actions
    if (selected.length === 1 && selected[0].type === 'table') {
      const tbl = selected[0];
      container.querySelector('#btn-table-add-row')?.addEventListener('click', () => {
        tbl.rows += 1;
        tbl.cells.push(Array.from({ length: tbl.cols }, () => ''));
        tbl.h += 36;
        app.commitChange();
        app.requestRender();
        render();
      });
      container.querySelector('#btn-table-del-row')?.addEventListener('click', () => {
        if (tbl.rows > 1) {
          tbl.rows -= 1;
          tbl.cells.pop();
          app.commitChange();
          app.requestRender();
          render();
        }
      });
      container.querySelector('#btn-table-add-col')?.addEventListener('click', () => {
        tbl.cols += 1;
        tbl.cells.forEach((r) => r.push(''));
        tbl.w += 90;
        app.commitChange();
        app.requestRender();
        render();
      });
      container.querySelector('#btn-table-del-col')?.addEventListener('click', () => {
        if (tbl.cols > 1) {
          tbl.cols -= 1;
          tbl.cells.forEach((r) => r.pop());
          app.commitChange();
          app.requestRender();
          render();
        }
      });
    }

    // Code highlight
    container.querySelector('#prop-code-hl')?.addEventListener('input', (e) => {
      if (selected[0]) {
        selected[0].highlightLines = e.target.value;
        app.commitChange();
        app.requestRender();
      }
    });

    // Frame options
    container.querySelector('#prop-slide-order')?.addEventListener('change', (e) => {
      if (selected[0]) {
        selected[0].slideOrder = Math.max(1, Number(e.target.value) || 1);
        app.commitChange();
        app.requestRender();
      }
    });
    container.querySelector('#prop-frame-clip')?.addEventListener('change', (e) => {
      if (selected[0]) {
        selected[0].clip = e.target.checked;
        app.commitChange();
        app.requestRender();
      }
    });
    container.querySelector('#btn-frame-collapse')?.addEventListener('click', () => {
      if (selected[0]) app.toggleFrame(selected[0].id);
    });

    // Image options
    container.querySelector('#prop-img-aspect')?.addEventListener('change', (e) => {
      if (selected[0]) {
        selected[0].lockAspectRatio = e.target.checked;
        app.commitChange();
      }
    });
    container.querySelector('#btn-img-crop')?.addEventListener('click', () => {
      if (selected[0]) app.toggleImageCrop(selected[0]);
    });
    container.querySelector('#btn-img-reset-crop')?.addEventListener('click', () => {
      if (selected[0]) {
        selected[0].crop = null;
        app.commitChange();
        app.requestRender();
        render();
      }
    });
    container.querySelector('#btn-img-bg')?.addEventListener('click', () => {
      if (selected[0]) app.toggleImageBackgroundLock(selected[0]);
    });

    // Alignment & Distribution
    container.querySelectorAll('[data-align-el]').forEach((b) => {
      b.addEventListener('click', () => app.alignSelection(b.dataset.alignEl));
    });
    container.querySelectorAll('[data-dist]').forEach((b) => {
      b.addEventListener('click', () => app.distributeSelection(b.dataset.dist));
    });
    container.querySelector('#btn-match-size')?.addEventListener('click', () => app.matchSelectionSize());
    container.querySelector('#btn-group')?.addEventListener('click', () => app.groupSelection());
    container.querySelector('#btn-ungroup')?.addEventListener('click', () => app.ungroupSelection());

    // Element actions
    container.querySelector('#prop-reveal-step')?.addEventListener('change', (e) => {
      const val = Number(e.target.value);
      for (const el of selected) el.revealStep = val;
      app.commitChange();
      app.requestRender();
    });
    container.querySelector('#btn-copy-style')?.addEventListener('click', () => app.copySelectedStyle());
    container.querySelector('#btn-add-to-lib')?.addEventListener('click', () => app.addSelectionToLibrary());
    container.querySelector('#btn-edit-link')?.addEventListener('click', () => app.dialogs.openHyperlinkModal());
    container.querySelectorAll('[data-z]').forEach((b) => {
      b.addEventListener('click', () => app.reorderSelection(b.dataset.z));
    });
    container.querySelector('#btn-lock-el')?.addEventListener('click', () => app.toggleLockSelection());
    container.querySelector('#btn-delete-el')?.addEventListener('click', () => app.deleteSelection());
  }

  return { update: render };
}
