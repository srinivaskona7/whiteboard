// ui/dialogs.js
import { escapeXml, exportToSvgString } from '../render/svg-export.js';
import { parseMermaidDiagram, computeNonOverlappingOrigin } from '../scene/mermaid.js';
import {
  encodeSceneToHash,
  loadRecoverySnapshots,
  saveRecoverySnapshot,
  parseSceneJson,
} from '../scene/storage.js';
import { SHORTCUT_REFERENCE } from './registry.js';

export function initDialogs(app) {
  const backdrop = document.getElementById('wb-modal-backdrop');
  const box = document.getElementById('wb-modal-box');
  const toasts = document.getElementById('wb-toast-container');

  function isOpen() {
    return backdrop && !backdrop.classList.contains('wb-hidden');
  }

  function close() {
    if (!backdrop) return;
    backdrop.classList.add('wb-hidden');
    if (box) box.innerHTML = '';
  }

  function openHtml(title, bodyHtml, onMount = null) {
    if (!backdrop || !box) return;
    backdrop.classList.remove('wb-hidden');
    box.innerHTML = `
      <div class="wb-modal-header">
        <h2 class="wb-modal-title">${escapeXml(title)}</h2>
        <button type="button" class="wb-icon-btn" id="wb-modal-close" aria-label="Close Dialog" title="Close Dialog">✕</button>
      </div>
      <div class="wb-modal-body">${bodyHtml}</div>
    `;
    box.querySelector('#wb-modal-close')?.addEventListener('click', close);
    if (onMount) onMount(box);
  }

  backdrop?.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });

  function showToast(message, type = 'info', duration = 3400) {
    if (!toasts) return;
    const item = document.createElement('div');
    item.className = `wb-toast wb-toast-${type}`;
    item.textContent = message;
    toasts.appendChild(item);
    setTimeout(() => {
      item.classList.add('wb-toast-fade');
      setTimeout(() => item.remove(), 260);
    }, duration);
  }

  function openShortcutsModal() {
    openHtml(
      'Keyboard Shortcuts (?)',
      `<div class="wb-shortcuts-grid">
        ${SHORTCUT_REFERENCE.map(
          (r) =>
            `<div class="wb-shortcut-row"><kbd>${escapeXml(r.key)}</kbd><span>${escapeXml(r.desc)}</span></div>`
        ).join('')}
      </div>`
    );
  }

  function openMermaidModal() {
    const sample = [
      'flowchart TD',
      '  Start[Start Lesson] --> Check{Students Ready?}',
      '  Check -->|Yes| Lab[Hands-on K8s Lab]',
      '  Check -->|No| Review[Quick Recap]',
      '  Review --> Lab',
    ].join(String.fromCharCode(10));

    const hasExisting = (app.getPage()?.elements || []).some((e) => !e.hidden);

    openHtml(
      'Import Mermaid Diagram (Offline Parser)',
      `
        <p class="wb-muted">Supports <code>flowchart TD/LR</code> and <code>sequenceDiagram</code>. Automatically places in empty space so existing objects are never overlapped.</p>
        <textarea id="mermaid-input" class="wb-textarea" rows="8" aria-label="Mermaid Diagram Source">${escapeXml(sample)}</textarea>
        <div class="wb-modal-options" style="margin-top:8px;">
          <label class="wb-check-row">
            <input type="checkbox" id="mermaid-new-page" ${hasExisting ? '' : ''} />
            <span>Create on a new page (instead of placing beside existing elements)</span>
          </label>
        </div>
        <div id="mermaid-warnings" class="wb-warning-box wb-hidden"></div>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn" id="btn-mermaid-seq">Load Sequence Sample</button>
          <button type="button" class="wb-btn wb-primary" id="btn-mermaid-insert">Generate Editable Diagram</button>
        </div>
      `,
      (modal) => {
        const input = modal.querySelector('#mermaid-input');
        const warnEl = modal.querySelector('#mermaid-warnings');
        const newPageCheck = modal.querySelector('#mermaid-new-page');

        modal.querySelector('#btn-mermaid-seq')?.addEventListener('click', () => {
          input.value = [
            'sequenceDiagram',
            '  participant Client as Web Browser',
            '  participant API as API Gateway',
            '  participant DB as Postgres',
            '  Client->>API: POST /login',
            '  API->>DB: SELECT user',
            '  DB-->>API: User row',
            '  API-->>Client: 200 OK (JWT)',
          ].join(String.fromCharCode(10));
        });

        modal.querySelector('#btn-mermaid-insert')?.addEventListener('click', () => {
          if (newPageCheck?.checked) {
            app.addPage(`Mermaid ${app.scene.pages.length + 1}`);
          }
          const page = app.getPage();
          const origin = computeNonOverlappingOrigin(page, app.getViewportCenterWorld());
          const { elements, warnings } = parseMermaidDiagram(input.value, origin.x, origin.y);
          if (warnings.length > 0) {
            warnEl.classList.remove('wb-hidden');
            warnEl.innerHTML = warnings.map((w) => `<div>⚠️ ${escapeXml(w)}</div>`).join('');
          } else {
            warnEl.classList.add('wb-hidden');
          }
          if (elements.length > 0) {
            page.elements.push(...elements);
            app.selectedIds = new Set(elements.map((e) => e.id));
            app.commitChange();
            app.fitToContent();
            app.updateUI();
            app.requestRender();
            if (warnings.length === 0) {
              close();
              showToast(`Imported ${elements.length} Mermaid elements without overlapping.`, 'success');
            } else {
              showToast(
                `Imported ${elements.length} elements with ${warnings.length} syntax notice(s).`,
                'warn'
              );
            }
          }
        });
      }
    );
  }

  function openExportModal() {
    const hasSel = app.selectedIds.size > 0;
    openHtml(
      'Export Diagram or Student Handout',
      `
        <div class="wb-export-options">
          <label class="wb-prop-row">
            <span>PNG Scale</span>
            <select id="exp-scale" aria-label="Export PNG Scale">
              <option value="1">1x (Standard)</option>
              <option value="2" selected>2x (Retina / High-DPI)</option>
              <option value="3">3x (Ultra Print)</option>
            </select>
          </label>
          <label class="wb-check-row">
            <input type="checkbox" id="exp-transparent" />
            <span>Transparent Background</span>
          </label>
          <label class="wb-check-row">
            <input type="checkbox" id="exp-selection" ${hasSel ? '' : 'disabled'} />
            <span>Selection Only (${app.selectedIds.size} selected)</span>
          </label>
        </div>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn wb-primary" id="btn-exp-png">⬇ Download PNG</button>
          <button type="button" class="wb-btn" id="btn-exp-copy">📋 Copy PNG</button>
          <button type="button" class="wb-btn" id="btn-exp-svg">⬇ Download SVG</button>
          <button type="button" class="wb-btn" id="btn-exp-handout">🖨 Student Handout (PDF)</button>
        </div>
      `,
      (modal) => {
        const getOpts = () => ({
          scale: Number(modal.querySelector('#exp-scale').value) || 2,
          transparent: modal.querySelector('#exp-transparent').checked,
          selectionOnly: modal.querySelector('#exp-selection').checked,
          selectedIds: app.selectedIds,
        });

        modal.querySelector('#btn-exp-png')?.addEventListener('click', () => {
          app.exportPngDownload(getOpts());
          close();
        });
        modal.querySelector('#btn-exp-copy')?.addEventListener('click', async () => {
          await app.copyPngToClipboard(getOpts());
          close();
        });
        modal.querySelector('#btn-exp-svg')?.addEventListener('click', () => {
          const opts = getOpts();
          const svg = exportToSvgString(app.scene, app.getPage(), opts);
          app.downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${app.getPage().name}.svg`);
          close();
        });
        modal.querySelector('#btn-exp-handout')?.addEventListener('click', () => {
          close();
          app.fitToContent();
          setTimeout(() => window.print(), 120);
        });
      }
    );
  }

  function openShareUrlModal() {
    const { hash, length, warnLarge } = encodeSceneToHash(app.scene);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    openHtml(
      'Share Scene by URL (No Server)',
      `
        <p class="wb-muted">Encodes the scene into the URL hash (<code>#scene=...</code>) for serverless sharing.</p>
        ${
          warnLarge
            ? `<div class="wb-warning-box">⚠️ Size Warning: This URL is ${length.toLocaleString()} characters long. For large boards or embedded images, use <strong>Save (.whiteboard.json)</strong> instead.</div>`
            : `<p class="wb-success-note">✓ Compact URL (${length.toLocaleString()} chars) ready to share.</p>`
        }
        <input type="text" id="share-url-input" class="wb-input" readonly value="${escapeXml(fullUrl)}" aria-label="Shareable URL" />
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn wb-primary" id="btn-copy-share-url">Copy Share Link</button>
        </div>
      `,
      (modal) => {
        modal.querySelector('#btn-copy-share-url')?.addEventListener('click', async () => {
          const inp = modal.querySelector('#share-url-input');
          inp.select();
          try {
            await navigator.clipboard.writeText(fullUrl);
            window.history.replaceState(null, '', hash);
            showToast('Share URL copied to clipboard!', 'success');
          } catch {
            showToast('Updated browser URL bar with #scene hash.', 'info');
            window.history.replaceState(null, '', hash);
          }
          close();
        });
      }
    );
  }

  function openRevealTimelineModal() {
    const page = app.getPage();
    const steps = new Map();
    for (const el of page.elements) {
      if (el.hidden) continue;
      const s = el.revealStep || 0;
      if (!steps.has(s)) steps.set(s, []);
      steps.get(s).push(el);
    }
    const sortedSteps = [...steps.keys()].sort((a, b) => a - b);

    openHtml(
      'Step-by-Step Reveal Timeline',
      `
        <p class="wb-muted">Preview how elements appear step-by-step in Presentation Mode.</p>
        <div class="wb-timeline-list">
          ${sortedSteps
            .map((stepNum) => {
              const items = steps.get(stepNum) || [];
              const label = stepNum === 0 ? 'Always Visible (Step 0)' : `Reveal Step ${stepNum}`;
              return `
                <div class="wb-timeline-row">
                  <div>
                    <strong>${escapeXml(label)}</strong>
                    <div class="wb-muted">${items.length} element(s): ${escapeXml(
                      items
                        .slice(0, 4)
                        .map((i) => i.text || i.name || i.type)
                        .join(', ')
                    )}</div>
                  </div>
                  <button type="button" class="wb-btn wb-sm" data-preview-step="${stepNum}">Preview up to Step ${stepNum}</button>
                </div>
              `;
            })
            .join('')}
        </div>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn wb-primary" id="btn-timeline-present">▶ Launch Presentation</button>
        </div>
      `,
      (modal) => {
        modal.querySelectorAll('[data-preview-step]').forEach((b) => {
          b.addEventListener('click', () => {
            const s = Number(b.dataset.previewStep);
            close();
            app.presentUI.enter();
            app.presentState.revealStep = s;
            app.presentUI.renderBar();
            app.requestRender();
          });
        });
        modal.querySelector('#btn-timeline-present')?.addEventListener('click', () => {
          close();
          app.presentUI.enter();
        });
      }
    );
  }

  function openRecoveryModal() {
    const renderSnapshots = () => {
      const snaps = loadRecoverySnapshots();
      openHtml(
        'Recovery History & Checkpoints',
        `
          <p class="wb-muted">Create a manual checkpoint or restore an earlier board version.</p>
          <div class="wb-modal-actions" style="justify-content:flex-start;margin-bottom:10px;">
            <button type="button" class="wb-btn wb-primary" id="btn-create-checkpoint">+ Save Checkpoint Now</button>
          </div>
          <div class="wb-timeline-list">
            ${
              snaps.length === 0
                ? `<div class="wb-muted">No recovery snapshots saved yet.</div>`
                : snaps
                    .map(
                      (s, idx) => `
                  <div class="wb-timeline-row">
                    <div>
                      <strong>${escapeXml(s.label)} — ${escapeXml(s.title)}</strong>
                      <div class="wb-muted">${new Date(s.timestamp).toLocaleTimeString()} · ${s.pageCount} page(s) · ${s.elementCount} objects</div>
                    </div>
                    <button type="button" class="wb-btn wb-sm" data-restore-idx="${idx}" aria-label="Restore snapshot ${idx + 1}">Restore</button>
                  </div>
                `
                    )
                    .join('')
            }
          </div>
        `,
        (modal) => {
          modal.querySelector('#btn-create-checkpoint')?.addEventListener('click', () => {
            saveRecoverySnapshot(app.scene, 'Manual Checkpoint');
            showToast('Checkpoint saved locally.', 'success');
            renderSnapshots();
          });
          modal.querySelectorAll('[data-restore-idx]').forEach((b) => {
            b.addEventListener('click', () => {
              const chosen = snaps[Number(b.dataset.restoreIdx)];
              if (chosen?.sceneJson) {
                app.scene = parseSceneJson(chosen.sceneJson);
                for (const p of app.scene.pages) app.history.initPage(p);
                app.selectedIds.clear();
                app.scheduleAutosave(app.scene);
                app.updateUI();
                app.requestRender();
                close();
                showToast(`Restored "${chosen.label}".`, 'success');
              }
            });
          });
        }
      );
    };
    renderSnapshots();
  }

  function openHyperlinkModal() {
    const selected = app.getSelectedElements();
    if (selected.length === 0) return;
    const current = selected[0].link || '';
    openHtml(
      'Attach Hyperlink to Element',
      `
        <p class="wb-muted">Ctrl/Cmd+Click the element (or click its top-right ↗ badge) to open the link.</p>
        <input type="url" id="link-url-input" class="wb-input" placeholder="https://example.com" value="${escapeXml(current)}" aria-label="Hyperlink URL" />
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn" id="btn-link-clear">Remove Link</button>
          <button type="button" class="wb-btn wb-primary" id="btn-link-save">Save Link</button>
        </div>
      `,
      (modal) => {
        const inp = modal.querySelector('#link-url-input');
        inp?.focus();
        modal.querySelector('#btn-link-save')?.addEventListener('click', () => {
          const val = inp.value.trim();
          for (const el of selected) el.link = val;
          app.commitChange();
          app.requestRender();
          close();
        });
        modal.querySelector('#btn-link-clear')?.addEventListener('click', () => {
          for (const el of selected) el.link = '';
          app.commitChange();
          app.requestRender();
          close();
        });
      }
    );
  }

  function openPromptModal(title, label, initialValue, onConfirm) {
    openHtml(
      title,
      `
        <label class="wb-prop-col">
          <span>${escapeXml(label)}</span>
          <input type="text" id="wb-prompt-input" class="wb-input" value="${escapeXml(initialValue || '')}" />
        </label>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn" id="btn-prompt-cancel">Cancel</button>
          <button type="button" class="wb-btn wb-primary" id="btn-prompt-ok">Confirm</button>
        </div>
      `,
      (modal) => {
        const inp = modal.querySelector('#wb-prompt-input');
        inp?.focus();
        inp?.select();
        const submit = () => {
          const val = inp.value.trim();
          close();
          if (val) onConfirm(val);
        };
        modal.querySelector('#btn-prompt-ok')?.addEventListener('click', submit);
        modal.querySelector('#btn-prompt-cancel')?.addEventListener('click', close);
        inp?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') submit();
        });
      }
    );
  }

  return {
    isOpen,
    close,
    showToast,
    openShortcutsModal,
    openMermaidModal,
    openExportModal,
    openShareUrlModal,
    openRevealTimelineModal,
    openRecoveryModal,
    openHyperlinkModal,
    openPromptModal,
  };
}
