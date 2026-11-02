// ui/dialogs.js
import { escapeXml, exportToSvgString } from '../render/svg-export.js';
import { parseMermaidDiagram } from '../scene/mermaid.js';
import { encodeSceneToHash } from '../scene/storage.js';

export function initDialogs(app) {
  const modalBackdrop = document.getElementById('wb-modal-backdrop');
  const modalBox = document.getElementById('wb-modal-box');
  const toastContainer = document.getElementById('wb-toast-container');

  function isOpen() {
    return Boolean(modalBackdrop && !modalBackdrop.classList.contains('wb-hidden'));
  }

  function close() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.add('wb-hidden');
    modalBox.innerHTML = '';
  }

  modalBackdrop?.addEventListener('click', (ev) => {
    if (ev.target === modalBackdrop) close();
  });

  function showToast(message, kind = 'info', duration = 3200) {
    if (!toastContainer) return;
    const item = document.createElement('div');
    item.className = `wb-toast wb-toast-${kind}`;
    item.setAttribute('role', 'status');
    item.textContent = message;
    toastContainer.appendChild(item);
    setTimeout(() => {
      item.remove();
    }, duration);
  }

  function openShortcutsModal() {
    const shortcuts = [
      ['V', 'Select Tool'],
      ['H / Space+Drag', 'Hand / Pan Canvas'],
      ['P', 'Freehand Pen'],
      ['M', 'Highlighter'],
      ['E', 'Eraser'],
      ['R / U / O / D', 'Rect / Rounded / Ellipse / Diamond'],
      ['L / A', 'Line / Smart Arrow'],
      ['T', 'Text Tool (or Double-click shape)'],
      ['N', 'Sticky Note'],
      ['I', 'Insert Image'],
      ['K', 'Laser Pointer (fading trail)'],
      ['S', 'Classroom Stamp'],
      ['Ctrl/Cmd + Z / Y', 'Undo / Redo'],
      ['Ctrl/Cmd + C / X / V / D', 'Copy / Cut / Paste / Duplicate'],
      ['Alt + Drag', 'Clone Selection'],
      ['Ctrl/Cmd + G / Shift+G', 'Group / Ungroup'],
      ['[ / ]', 'Send to Back / Bring to Front'],
      ['+ / - / 0 / 1', 'Zoom In / Out / 100% / Fit Content'],
      ['F', 'Toggle Full Screen'],
      ['Ctrl/Cmd + K', 'Command Palette'],
      ['?', 'Keyboard Shortcuts Help'],
      ['Esc', 'Cancel / Exit Present or Dialog'],
    ];

    modalBox.innerHTML = `
      <div class="wb-modal-header">
        <h2>Keyboard Shortcuts</h2>
        <button type="button" class="wb-icon-btn" id="modal-close">✕</button>
      </div>
      <div class="wb-modal-body">
        <div class="wb-shortcuts-grid">
          ${shortcuts
            .map(
              ([k, desc]) => `
            <div class="wb-shortcut-row">
              <kbd>${escapeXml(k)}</kbd>
              <span>${escapeXml(desc)}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
    modalBackdrop.classList.remove('wb-hidden');
    modalBox.querySelector('#modal-close')?.addEventListener('click', close);
  }

  function openMermaidModal() {
    const sample = `flowchart TD
  A[Start Lesson] --> B{Students Ready?}
  B -- Yes --> C[Interactive Lab]
  B -- No --> D(Warmup Quiz)`;
    modalBox.innerHTML = `
      <div class="wb-modal-header">
        <h2>Import Mermaid Diagram (Offline Parser)</h2>
        <button type="button" class="wb-icon-btn" id="modal-close">✕</button>
      </div>
      <div class="wb-modal-body">
        <p class="wb-muted">Supports <code>flowchart TD/LR</code> and <code>sequenceDiagram</code> subsets.</p>
        <textarea id="mermaid-input" class="wb-textarea" rows="8">${escapeXml(sample)}</textarea>
        <div id="mermaid-warnings" class="wb-warnings"></div>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn" id="btn-mermaid-seq-sample">Load Sequence Sample</button>
          <button type="button" class="wb-btn wb-primary" id="btn-mermaid-insert">Generate Editable Diagram</button>
        </div>
      </div>
    `;
    modalBackdrop.classList.remove('wb-hidden');
    modalBox.querySelector('#modal-close')?.addEventListener('click', close);

    const ta = modalBox.querySelector('#mermaid-input');
    const warnBox = modalBox.querySelector('#mermaid-warnings');

    modalBox.querySelector('#btn-mermaid-seq-sample')?.addEventListener('click', () => {
      ta.value = `sequenceDiagram
  participant Teacher
  participant Student
  Teacher->>Student: Pose Problem
  Student-->>Teacher: Submit Solution`;
    });

    modalBox.querySelector('#btn-mermaid-insert')?.addEventListener('click', () => {
      const center = app.getViewportCenterWorld();
      const { elements, warnings } = parseMermaidDiagram(
        ta.value,
        Math.round(center.x - 200),
        Math.round(center.y - 140)
      );
      if (warnings.length > 0) {
        warnBox.innerHTML = warnings
          .map((w) => `<div class="wb-warn-item">⚠️ ${escapeXml(w)}</div>`)
          .join('');
      } else {
        warnBox.innerHTML = '';
      }
      if (elements.length > 0) {
        const page = app.getPage();
        page.elements.push(...elements);
        app.selectedIds = new Set(elements.map((e) => e.id));
        app.commitChange();
        app.updateUI();
        app.requestRender();
        showToast(
          `Imported ${elements.length} Mermaid elements${warnings.length ? ` (${warnings.length} warning)` : ''}.`,
          warnings.length ? 'warn' : 'success'
        );
        if (warnings.length === 0) close();
      }
    });
  }

  function openExportModal() {
    const hasSelection = app.selectedIds.size > 0;
    modalBox.innerHTML = `
      <div class="wb-modal-header">
        <h2>Export Whiteboard</h2>
        <button type="button" class="wb-icon-btn" id="modal-close">✕</button>
      </div>
      <div class="wb-modal-body">
        <label class="wb-prop-row">
          <span>PNG Scale</span>
          <select id="exp-scale">
            <option value="1">1x (Standard)</option>
            <option value="2" selected>2x (HiDPI)</option>
            <option value="3">3x (Ultra Print)</option>
          </select>
        </label>
        <label class="wb-prop-row">
          <span>Transparent Background</span>
          <input type="checkbox" id="exp-transparent"/>
        </label>
        <label class="wb-prop-row">
          <span>Selection Only (${app.selectedIds.size} selected)</span>
          <input type="checkbox" id="exp-selection" ${hasSelection ? '' : 'disabled'}/>
        </label>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn wb-primary" id="btn-exp-png">⬇ Download PNG</button>
          <button type="button" class="wb-btn" id="btn-exp-copy-png">📋 Copy PNG</button>
          <button type="button" class="wb-btn wb-primary" id="btn-exp-svg">⬇ Download SVG</button>
          <button type="button" class="wb-btn" id="btn-exp-preview-svg">👁 Preview SVG</button>
          <button type="button" class="wb-btn" id="btn-exp-print">🖨 Print / PDF</button>
        </div>
        <div id="exp-svg-preview" class="wb-svg-preview-box wb-hidden"></div>
      </div>
    `;
    modalBackdrop.classList.remove('wb-hidden');
    modalBox.querySelector('#modal-close')?.addEventListener('click', close);

    const getOpts = () => ({
      scale: Number(modalBox.querySelector('#exp-scale').value) || 2,
      transparent: modalBox.querySelector('#exp-transparent').checked,
      selectionOnly: modalBox.querySelector('#exp-selection').checked,
      selectedIds: app.selectedIds,
    });

    modalBox.querySelector('#btn-exp-png')?.addEventListener('click', () => {
      app.exportPng(getOpts());
      showToast('PNG downloaded.', 'success');
    });

    modalBox.querySelector('#btn-exp-copy-png')?.addEventListener('click', async () => {
      const ok = await app.copyPngToClipboard(getOpts());
      showToast(ok ? 'PNG copied to clipboard.' : 'Clipboard PNG copy prepared.', 'info');
    });

    modalBox.querySelector('#btn-exp-svg')?.addEventListener('click', () => {
      app.exportSvg(getOpts());
      showToast('SVG downloaded.', 'success');
    });

    modalBox.querySelector('#btn-exp-preview-svg')?.addEventListener('click', () => {
      const svgStr = exportToSvgString(app.scene, app.getPage(), getOpts());
      const preview = modalBox.querySelector('#exp-svg-preview');
      preview.classList.remove('wb-hidden');
      preview.innerHTML = svgStr;
    });

    modalBox.querySelector('#btn-exp-print')?.addEventListener('click', () => {
      close();
      window.print();
    });
  }

  function openShareUrlModal() {
    const { hash, length, warnLarge } = encodeSceneToHash(app.scene);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    modalBox.innerHTML = `
      <div class="wb-modal-header">
        <h2>Share by URL (No Server)</h2>
        <button type="button" class="wb-icon-btn" id="modal-close">✕</button>
      </div>
      <div class="wb-modal-body">
        <p class="wb-muted">Scene encoded directly in the URL hash (${length.toLocaleString()} chars).</p>
        ${
          warnLarge
            ? `<div class="wb-warn-item">⚠️ Size Warning: This URL is ${length.toLocaleString()} characters long and may exceed some browser/chat URL limits. Consider saving a <code>.whiteboard.json</code> file for large diagrams.</div>`
            : ''
        }
        <input type="text" class="wb-input" id="share-url-input" readonly value="${escapeXml(fullUrl)}"/>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn wb-primary" id="btn-apply-hash">Copy & Set URL Hash</button>
        </div>
      </div>
    `;
    modalBackdrop.classList.remove('wb-hidden');
    modalBox.querySelector('#modal-close')?.addEventListener('click', close);
    modalBox.querySelector('#btn-apply-hash')?.addEventListener('click', () => {
      window.history.replaceState(null, '', hash);
      navigator.clipboard?.writeText(fullUrl).catch(() => {});
      showToast('Shareable URL hash applied and copied!', 'success');
      close();
    });
  }

  function openHyperlinkModal() {
    const page = app.getPage();
    const sel = page.elements.find((e) => app.selectedIds.has(e.id));
    if (!sel) return;
    modalBox.innerHTML = `
      <div class="wb-modal-header">
        <h2>Attach Hyperlink</h2>
        <button type="button" class="wb-icon-btn" id="modal-close">✕</button>
      </div>
      <div class="wb-modal-body">
        <label class="wb-prop-row">
          <span>URL</span>
          <input type="url" class="wb-input" id="link-url-input" placeholder="https://example.org" value="${escapeXml(sel.link || '')}"/>
        </label>
        <p class="wb-muted">Ctrl/Cmd+Click the element or click its ↗ badge to open.</p>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn wb-primary" id="btn-save-link">Save Link</button>
        </div>
      </div>
    `;
    modalBackdrop.classList.remove('wb-hidden');
    modalBox.querySelector('#modal-close')?.addEventListener('click', close);
    modalBox.querySelector('#btn-save-link')?.addEventListener('click', () => {
      sel.link = modalBox.querySelector('#link-url-input').value.trim();
      app.commitChange();
      app.requestRender();
      close();
    });
  }

  function openPromptModal(title, label, initialValue, onConfirm) {
    modalBox.innerHTML = `
      <div class="wb-modal-header">
        <h2>${escapeXml(title)}</h2>
        <button type="button" class="wb-icon-btn" id="modal-close">✕</button>
      </div>
      <div class="wb-modal-body">
        <label class="wb-prop-row">
          <span>${escapeXml(label)}</span>
          <input type="text" class="wb-input" id="prompt-modal-input" value="${escapeXml(initialValue || '')}"/>
        </label>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn wb-primary" id="btn-prompt-ok">OK</button>
        </div>
      </div>
    `;
    modalBackdrop.classList.remove('wb-hidden');
    const inp = modalBox.querySelector('#prompt-modal-input');
    inp?.focus();
    modalBox.querySelector('#modal-close')?.addEventListener('click', close);
    modalBox.querySelector('#btn-prompt-ok')?.addEventListener('click', () => {
      const val = inp.value;
      close();
      onConfirm(val);
    });
  }

  return {
    isOpen,
    close,
    showToast,
    openShortcutsModal,
    openMermaidModal,
    openExportModal,
    openShareUrlModal,
    openHyperlinkModal,
    openPromptModal,
  };
}
