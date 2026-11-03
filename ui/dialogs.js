// ui/dialogs.js
import { escapeXml, exportToSvgString } from '../render/svg-export.js';
import { parseMermaidDiagram, computeNonOverlappingOrigin } from '../scene/mermaid.js';
import {
  encodeSceneToHash,
  loadRecoverySnapshots,
  saveRecoverySnapshot,
  parseSceneJson,
} from '../scene/storage.js';
import { renderUrlQrSvg } from './qr.js';
import { autoGrowShapeForText, createElement } from '../scene/model.js';
import { pasteTsvIntoTable, fitTable, ensureCellGrid } from '../scene/table.js';
import { TOOL_REGISTRY, SHORTCUT_REFERENCE, formatShortcut } from './registry.js';

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
            `<div class="wb-shortcut-row"><kbd>${escapeXml(formatShortcut(r.key))}</kbd><span>${escapeXml(r.desc)}</span></div>`
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

  function openTableInsertModal(existing = null) {
    const target = existing && existing.type === 'table' ? existing : null;
    if (target?.locked) {
      showToast('Unlock the table before editing its structure.', 'info');
      return;
    }
    const rows0 = target ? target.rows || 3 : 3;
    const cols0 = target ? target.cols || 3 : 3;
    openHtml(
      target ? 'Edit Table Structure' : 'Insert Table',
      `
        <p class="wb-muted">${target ? 'Resize or refill the selected table.' : 'Creates an editable table. Paste tab-separated values from a spreadsheet to fill it in one step.'}</p>
        <div class="wb-modal-options" style="display:flex;gap:12px;flex-wrap:wrap;">
          <label class="wb-prop-row" style="width:120px;"><span>Rows</span>
            <input type="number" id="tbl-rows" min="1" max="${Math.max(50, rows0)}" value="${rows0}" class="wb-input" style="width:64px"/>
          </label>
          <label class="wb-prop-row" style="width:120px;"><span>Columns</span>
            <input type="number" id="tbl-cols" min="1" max="${Math.max(20, cols0)}" value="${cols0}" class="wb-input" style="width:64px"/>
          </label>
          <label class="wb-prop-row" style="width:140px;"><span>Alignment</span>
            <select id="tbl-align">
              <option value="left">Left</option>
              <option value="center" selected>Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>
        <label class="wb-check-row"><input type="checkbox" id="tbl-header" ${!target || target.headerRow !== false ? 'checked' : ''}/> <span>Header row</span></label>
        <label class="wb-check-row"><input type="checkbox" id="tbl-striped" ${target && target.striped ? 'checked' : ''}/> <span>Alternate row shading</span></label>
        <label class="wb-check-row"><input type="checkbox" id="tbl-fit" checked/> <span>Size columns to fit content</span></label>
        <label class="wb-prop-row" style="align-items:flex-start;margin-top:8px;">
          <span>Paste TSV</span>
          <textarea id="tbl-tsv" class="wb-textarea" rows="6" placeholder="name&#9;status&#10;api&#9;running" aria-label="Tab-separated table data"></textarea>
        </label>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn wb-primary" id="btn-table-apply">${target ? 'Apply' : 'Insert Table'}</button>
        </div>
      `,
      (modal) => {
        modal.querySelector('#btn-table-apply')?.addEventListener('click', () => {
          // Never clamp a table smaller than it already is: doing so silently
          // deleted rows that a previous paste had legitimately grown.
          const maxRows = Math.max(50, target ? target.rows || 1 : 1);
          const maxCols = Math.max(20, target ? target.cols || 1 : 1);
          const rows = Math.min(maxRows, Math.max(1, parseInt(modal.querySelector('#tbl-rows')?.value, 10) || 3));
          const cols = Math.min(maxCols, Math.max(1, parseInt(modal.querySelector('#tbl-cols')?.value, 10) || 3));
          const headerRow = modal.querySelector('#tbl-header')?.checked !== false;
          const striped = !!modal.querySelector('#tbl-striped')?.checked;
          const textAlign = modal.querySelector('#tbl-align')?.value || 'center';
          const tsv = modal.querySelector('#tbl-tsv')?.value || '';
          const shouldFit = modal.querySelector('#tbl-fit')?.checked !== false;

          let el = target;
          if (!el) {
            const page = app.getPage();
            const origin = computeNonOverlappingOrigin(page, app.getViewportCenterWorld());
            el = createElement('table', {
              x: origin.x,
              y: origin.y,
              w: cols * 120,
              h: rows * 36,
              rows,
              cols,
              headerRow,
              striped,
              textAlign,
            });
            page.elements.push(el);
            app.selectedIds = new Set([el.id]);
          }
          el.rows = rows;
          el.cols = cols;
          el.headerRow = headerRow;
          el.striped = striped;
          el.textAlign = textAlign;
          const { cells } = ensureCellGrid(el);
          while (cells.length > el.rows) cells.pop();
          if (tsv.trim()) {
            // The pasted grid may be larger than the stated size; growing is
            // better than silently dropping the extra cells.
            pasteTsvIntoTable(el, tsv, 0, 0);
          }
          if (shouldFit) fitTable(app.renderer?.ctx, el);
          else {
            el.colWidths = null;
            el.rowHeights = null;
          }
          app.commitChange();
          app.updateUI();
          app.requestRender();
          close();
          showToast(target ? 'Table updated.' : `Inserted a ${rows} × ${cols} table.`, 'success');
        });
      }
    );
  }

  // Tablet test / calibration. Reports the real pointer stream so a pen that
  // lies about pressure is visible, and states plainly when no pen is attached.
  function openTabletTestModal() {
    openHtml(
      'Tablet Test & Pressure Calibration',
      `
        <p class="wb-muted">Draw in the box with your pen. This reads the browser's pointer stream directly — pressure, tilt and coalesced samples — without altering your board.</p>
        <div class="wb-tablet-stage">
          <canvas id="tablet-test-canvas" width="560" height="260" aria-label="Tablet pressure test area"></canvas>
        </div>
        <div class="wb-tablet-readout" aria-live="polite">
          <span>Input: <strong id="tablet-input-type">waiting</strong></span>
          <span>Pressure: <strong id="tablet-pressure">—</strong></span>
          <span>Range: <strong id="tablet-range">—</strong></span>
          <span>Samples: <strong id="tablet-samples">0</strong></span>
          <span>Tilt: <strong id="tablet-tilt">—</strong></span>
        </div>
        <div id="tablet-status" class="wb-warning-box">No pen has been detected yet. Hardware validation for a specific tablet (for example Huion) is <strong>BLOCKED</strong> until a real device is attached to this machine; the software pressure path is what is being exercised here.</div>
        <div class="wb-modal-options" style="margin-top:8px;">
          <label class="wb-prop-row"><span>Min width <strong id="tablet-min-label">${Math.round((app.brushOverrides?.minWidthRatio ?? 0.45) * 100)}%</strong></span>
            <input type="range" id="tablet-min" min="10" max="90" value="${Math.round((app.brushOverrides?.minWidthRatio ?? 0.45) * 100)}"/>
          </label>
          <label class="wb-prop-row"><span>Max width <strong id="tablet-max-label">${Math.round((app.brushOverrides?.maxWidthRatio ?? 1.35) * 100)}%</strong></span>
            <input type="range" id="tablet-max" min="80" max="200" value="${Math.round((app.brushOverrides?.maxWidthRatio ?? 1.35) * 100)}"/>
          </label>
        </div>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn" id="btn-tablet-clear">Clear</button>
          <button type="button" class="wb-btn wb-primary" id="btn-tablet-apply">Apply to Pressure Ink</button>
        </div>
      `,
      (modal) => {
        const canvas = modal.querySelector('#tablet-test-canvas');
        const ctx = canvas.getContext('2d');
        const typeEl = modal.querySelector('#tablet-input-type');
        const pressureEl = modal.querySelector('#tablet-pressure');
        const rangeEl = modal.querySelector('#tablet-range');
        const samplesEl = modal.querySelector('#tablet-samples');
        const tiltEl = modal.querySelector('#tablet-tilt');
        const statusEl = modal.querySelector('#tablet-status');
        const minEl = modal.querySelector('#tablet-min');
        const maxEl = modal.querySelector('#tablet-max');
        let drawing = false;
        let last = null;
        let samples = 0;
        let lo = Infinity;
        let hi = -Infinity;
        let lastPressure = 0.5;

        const paintBackground = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = 'rgba(148,163,184,0.35)';
          ctx.lineWidth = 1;
          for (let x = 20; x < canvas.width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
        };
        paintBackground();

        const updateReadout = (ev) => {
          const p = typeof ev.pressure === 'number' ? ev.pressure : 0;
          lastPressure = p;
          if (drawing) {
            lo = Math.min(lo, p);
            hi = Math.max(hi, p);
          }
          typeEl.textContent = ev.pointerType || 'unknown';
          pressureEl.textContent = p.toFixed(2);
          rangeEl.textContent = Number.isFinite(lo) ? `${lo.toFixed(2)} – ${hi.toFixed(2)}` : '—';
          samplesEl.textContent = String(samples);
          tiltEl.textContent =
            Number.isFinite(ev.tiltX) && (ev.tiltX || ev.tiltY)
              ? `${ev.tiltX}° / ${ev.tiltY}°`
              : '—';
          if (ev.pointerType === 'pen') {
            statusEl.classList.add('wb-hidden');
          }
        };

        const strokeTo = (x, y, pressure) => {
          const width = 2 + pressure * 16;
          ctx.strokeStyle = '#0ea5e9';
          ctx.lineWidth = width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          if (last) {
            ctx.moveTo(last.x, last.y);
            ctx.lineTo(x, y);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(x, y, width / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#0ea5e9';
            ctx.fill();
          }
          last = { x, y };
        };

        const localPoint = (ev) => {
          const rect = canvas.getBoundingClientRect();
          return {
            x: ((ev.clientX - rect.left) / rect.width) * canvas.width,
            y: ((ev.clientY - rect.top) / rect.height) * canvas.height,
          };
        };

        canvas.addEventListener('pointerdown', (ev) => {
          canvas.setPointerCapture?.(ev.pointerId);
          drawing = true;
          samples = 0;
          lo = Infinity;
          hi = -Infinity;
          last = null;
          const pt = localPoint(ev);
          strokeTo(pt.x, pt.y, ev.pointerType === 'pen' ? ev.pressure : 0.5);
          updateReadout(ev);
        });
        canvas.addEventListener('pointermove', (ev) => {
          if (!drawing) return;
          const events =
            typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [];
          const batch = events.length > 0 ? events : [ev];
          samples += batch.length;
          for (const e of batch) {
            const pt = localPoint(e);
            strokeTo(pt.x, pt.y, e.pointerType === 'pen' ? e.pressure : 0.5);
          }
          updateReadout(ev);
        });
        const end = (ev) => {
          drawing = false;
          last = null;
          updateReadout(ev);
        };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', end);
        canvas.addEventListener('pointerleave', () => {
          last = null;
        });

        minEl?.addEventListener('input', () => {
          modal.querySelector('#tablet-min-label').textContent = `${minEl.value}%`;
        });
        maxEl?.addEventListener('input', () => {
          modal.querySelector('#tablet-max-label').textContent = `${maxEl.value}%`;
        });
        modal.querySelector('#btn-tablet-clear')?.addEventListener('click', () => {
          paintBackground();
          samples = 0;
          lo = Infinity;
          hi = -Infinity;
          samplesEl.textContent = '0';
          rangeEl.textContent = '—';
        });
        modal.querySelector('#btn-tablet-apply')?.addEventListener('click', () => {
          app.setBrushOverrides({
            minWidthRatio: Number(minEl.value) / 100,
            maxWidthRatio: Number(maxEl.value) / 100,
          });
          close();
          showToast('Pressure curve applied to Pressure Ink and Chalk strokes.', 'success');
          if (lastPressure === 0.5 && typeEl.textContent === 'mouse') {
            showToast('Mouse input carries no pressure; this applies to pen input only.', 'warn');
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
          const safeName = (app.getPage().name || 'page')
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, '-');
          app.downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${safeName}.svg`);
          close();
        });
        modal.querySelector('#btn-exp-handout')?.addEventListener('click', () => {
          close();
          const count = app.printHandout();
          app.dialogs.showToast(
            count > 1
              ? `Prepared ${count} pages — choose "Save as PDF" in the print dialog.`
              : 'Prepared the current page for printing.',
            'success'
          );
        });
      }
    );
  }

  async function openShareUrlModal() {
    const healthy = (await app.collab?.checkBackendHealth()) || false;
    const { hash, length } = encodeSceneToHash(app.scene);
    const fallbackUrl = `${window.location.origin}${window.location.pathname}${hash}`;

    let generatedShortUrl = '';
    let generatedLabel = '';
    let generatedAccess = '';
    let generatedExpiry = '';

    const renderModal = () => {
      openHtml(
        'Share Board & Classroom Links',
        `
          ${
            healthy
              ? `<p class="wb-success-note">✓ Collaboration backend connected — creates genuinely short links stored on the server.</p>`
              : `<div class="wb-warning-box">⚠️ No collaboration backend is reachable at <code>${escapeXml(app.collab?.apiBase || window.location.origin)}</code>. Short links and cross-device live rooms are unavailable until the server is started.</div>`
          }
          <div class="wb-prop-row" style="margin-bottom:8px;">
            <span>Expiration</span>
            <select id="share-ttl-select" aria-label="Share Link Expiration">
              <option value="86400000">24 hours</option>
              <option value="604800000">7 days</option>
              <option value="0">Never expire</option>
            </select>
          </div>
          <div class="wb-btn-group" style="flex-wrap:wrap;gap:6px;margin-bottom:10px;">
            <button type="button" class="wb-btn wb-primary" id="btn-share-short-snap" ${!healthy ? 'disabled' : ''}>📸 Create Short Read-Only Snapshot (#/b/…)</button>
            <button type="button" class="wb-btn" id="btn-share-live-student" ${!healthy ? 'disabled' : ''}>🎓 Live Classroom Join Link (#/r/…)</button>
            <button type="button" class="wb-btn" id="btn-share-live-editor" ${!healthy ? 'disabled' : ''}>✏️ Authorized Editor Invite Link</button>
          </div>
          ${
            generatedShortUrl
              ? `<div style="padding:10px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-muted);margin-bottom:10px;">
                  <div style="font-size:12px;font-weight:600;margin-bottom:4px;">${escapeXml(generatedLabel)} · Access: ${escapeXml(generatedAccess)} (${generatedShortUrl.length} chars)</div>
                  ${generatedExpiry ? `<div class="wb-muted" style="font-size:11px;margin-bottom:6px;">Expires: ${escapeXml(generatedExpiry)}</div>` : ''}
                  <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" id="short-share-url-input" class="wb-input" readonly value="${escapeXml(generatedShortUrl)}" aria-label="Short Share URL" />
                  </div>
                  <div style="display:flex;justify-content:center;padding-top:8px;">
                    ${renderUrlQrSvg(generatedShortUrl, 132)}
                  </div>
                </div>`
              : ''
          }
          <details style="margin-top:8px;">
            <summary class="wb-muted" style="cursor:pointer;font-size:12px;">Offline Fallback: Embedded Snapshot URL (${length.toLocaleString()} chars)</summary>
            <div style="padding-top:8px;display:flex;flex-direction:column;gap:6px;">
              ${
                length > 6000
                  ? `<div class="wb-warning-box" style="margin:0;">⚠️ This embedded URL is <strong>${length.toLocaleString()} characters</strong> because it encodes the full board inside the hash. Many chat apps and browsers truncate URLs above 8,000 characters. Use a <strong>Short Read-Only Snapshot (#/b/…)</strong> above or <strong>Save .whiteboard.json</strong> instead.</div>`
                  : `<p class="wb-muted" style="margin:0;">Self-contained URL hash for small boards when no collaboration server is available.</p>`
              }
              <input type="text" id="share-url-input" class="wb-input" readonly value="${escapeXml(length > 32000 ? `${fallbackUrl.slice(0, 256)}… (${length.toLocaleString()} chars)` : fallbackUrl)}" aria-label="Offline Fallback Shareable URL" />
              <div class="wb-btn-group">
                <button type="button" class="wb-btn wb-sm" id="btn-copy-share-url">Copy Offline Fallback Link</button>
                <button type="button" class="wb-btn wb-sm" id="btn-share-download-json">⬇ Save .whiteboard.json</button>
              </div>
            </div>
          </details>
        `,
        (modal) => {
          const getTtl = () => {
            const v = Number(modal.querySelector('#share-ttl-select')?.value || 0);
            return v > 0 ? v : null;
          };

          const handleResult = async (url, label, access, expiresAt) => {
            generatedShortUrl = url;
            generatedLabel = label;
            generatedAccess = access;
            generatedExpiry = expiresAt ? new Date(expiresAt).toLocaleString() : 'Never';
            try {
              await navigator.clipboard.writeText(url);
              showToast(`Copied ${label} (${url.length} chars)!`, 'success');
            } catch {
              showToast(`Created ${label}`, 'info');
            }
            renderModal();
          };

          modal.querySelector('#btn-share-short-snap')?.addEventListener('click', async () => {
            try {
              const snap = await app.collab.createShortSnapshot(getTtl());
              await handleResult(snap.url, 'Read-Only Snapshot', 'Viewer (Read-Only)', snap.expiresAt);
            } catch (err) {
              showToast(err.message);
            }
          });

          modal.querySelector('#btn-share-live-student')?.addEventListener('click', async () => {
            try {
              const room = await app.collab.startOrUpdateLiveRoom({ expiresInMs: getTtl() });
              await handleResult(room.viewerUrl, 'Live Classroom Room', 'Student (Viewer / Point / Q&A)', room.expiresAt);
            } catch (err) {
              showToast(err.message);
            }
          });

          modal.querySelector('#btn-share-live-editor')?.addEventListener('click', async () => {
            try {
              const room = await app.collab.startOrUpdateLiveRoom({ expiresInMs: getTtl() });
              await handleResult(room.editorUrl, 'Authorized Editor Invite', 'Editor (Full Board Edit)', room.expiresAt);
            } catch (err) {
              showToast(err.message);
            }
          });

          modal.querySelector('#btn-copy-share-url')?.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(fallbackUrl);
              showToast('Copied Offline Fallback URL.', 'success');
            } catch {
              showToast('Could not copy to clipboard.');
            }
          });

          modal.querySelector('#btn-share-download-json')?.addEventListener('click', () => {
            app.saveSceneFile();
            close();
          });
        }
      );
    };

    renderModal();
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
                saveRecoverySnapshot(app.scene, 'Before Restore Checkpoint');
                app.scene = parseSceneJson(chosen.sceneJson);
                for (const p of app.scene.pages) app.history.initPage(p);
                app.selectedIds.clear();
                app.scheduleAutosave(app.scene);
                app.collab?.broadcastSceneChange();
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

  function openPromptModal(titleOrOpts, label, initialValue, onConfirm) {
    const isObj = titleOrOpts && typeof titleOrOpts === 'object';
    const modalTitle = isObj ? titleOrOpts.title || 'Prompt' : titleOrOpts;
    const modalLabel = isObj ? titleOrOpts.label || '' : label;
    const initVal = isObj ? titleOrOpts.defaultValue ?? titleOrOpts.initialValue ?? '' : initialValue;
    const confirmText = isObj ? titleOrOpts.confirmLabel || 'Confirm' : 'Confirm';
    const cb = isObj ? titleOrOpts.onConfirm : onConfirm;

    openHtml(
      modalTitle,
      `
        <label class="wb-prop-col">
          <span>${escapeXml(modalLabel)}</span>
          <input type="text" id="wb-prompt-input" class="wb-input" value="${escapeXml(initVal || '')}" />
        </label>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn" id="btn-prompt-cancel">Cancel</button>
          <button type="button" class="wb-btn wb-primary" id="btn-prompt-ok">${escapeXml(confirmText)}</button>
        </div>
      `,
      (modal) => {
        const inp = modal.querySelector('#wb-prompt-input');
        inp?.focus();
        inp?.select();
        const submit = () => {
          const val = inp.value.trim();
          close();
          if (cb) cb(val);
        };
        modal.querySelector('#btn-prompt-ok')?.addEventListener('click', submit);
        modal.querySelector('#btn-prompt-cancel')?.addEventListener('click', close);
        inp?.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
        });
      }
    );
  }

  function openFocusToolsModal(initialPreset = null) {
    let targetPreset = ['teach', 'diagram', 'collaborate'].includes(initialPreset)
      ? initialPreset
      : app.activePreset || 'diagram';

    const renderCustomizeModal = () => {
      const currentList = app.getPinnedTools
        ? app.getPinnedTools(targetPreset)
        : app.focusToolIds || ['select', 'hand', 'pen', 'highlighter', 'eraser', 'laser', 'question'];
      const currentSet = new Set(currentList);

      openHtml(
        'Customize Pinned Workspace Tools',
        `
          <p class="wb-muted" style="margin-bottom:8px;">Choose which tools are pinned to the left dock for each workspace preset. Unpinned tools remain accessible in the <strong>+</strong> menu.</p>
          <div class="wb-btn-group" style="margin-bottom:10px;" role="group" aria-label="Target Preset">
            ${['teach', 'diagram', 'collaborate']
              .map(
                (pid) => `
              <button type="button" class="wb-btn wb-sm ${targetPreset === pid ? 'active wb-primary' : ''}" data-cust-preset="${pid}">
                ${pid === 'teach' ? 'Teach' : pid === 'diagram' ? 'Diagram' : 'Collaborate'}
              </button>
            `
              )
              .join('')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;">
            ${TOOL_REGISTRY.map(
              (t) => `
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
                <input type="checkbox" data-focus-tool="${escapeXml(t.id)}" ${currentSet.has(t.id) ? 'checked' : ''} />
                <span>${escapeXml(t.label)} (${escapeXml(t.shortcut)})</span>
              </label>
            `
            ).join('')}
          </div>
          <div class="wb-modal-actions">
            <button type="button" class="wb-btn" id="btn-focus-tools-reset">Restore Preset Defaults</button>
            <button type="button" class="wb-btn wb-primary" id="btn-focus-tools-save">Save Pinned Tools</button>
          </div>
        `,
        (modal) => {
          modal.querySelectorAll('[data-cust-preset]').forEach((btn) => {
            btn.addEventListener('click', () => {
              targetPreset = btn.dataset.custPreset;
              renderCustomizeModal();
            });
          });
          modal.querySelector('#btn-focus-tools-reset')?.addEventListener('click', () => {
            if (app.resetPresetTools) {
              app.resetPresetTools(targetPreset);
            } else {
              app.setFocusTools(['select', 'hand', 'pen', 'highlighter', 'eraser', 'laser', 'question']);
            }
            close();
            showToast(`Restored default tools for ${targetPreset} preset.`, 'info');
          });
          modal.querySelector('#btn-focus-tools-save')?.addEventListener('click', () => {
            const chosen = [];
            modal.querySelectorAll('[data-focus-tool]').forEach((chk) => {
              if (chk.checked) chosen.push(chk.dataset.focusTool);
            });
            if (chosen.length === 0) chosen.push('select');
            if (app.setPinnedToolsForPreset) {
              app.setPinnedToolsForPreset(targetPreset, chosen);
            } else {
              app.setFocusTools(chosen);
            }
            close();
            showToast(`Saved pinned tools for ${targetPreset} preset.`, 'success');
          });
        }
      );
    };

    renderCustomizeModal();
  }

  function openCodeEditorModal(el = null) {
    if (!el || el.type !== 'code') return;
    const langValue = el.codeLanguage || 'plain';
    openHtml(
      'Code Block Editor',
      `
        <div class="wb-code-editor-head">
          <label class="wb-prop-row" style="margin:0;">
            <span>Language</span>
            <select id="code-lang" aria-label="Code Language">
              ${['plain', 'bash', 'yaml', 'json', 'python']
                .map(
                  (l) =>
                    `<option value="${l}" ${langValue === l ? 'selected' : ''}>${l === 'plain' ? 'Plain text' : l}</option>`
                )
                .join('')}
            </select>
          </label>
          <label class="wb-prop-row" style="margin:0;">
            <span>Font size</span>
            <input type="number" id="code-font-size" min="10" max="28" value="${el.fontSize || 14}" style="width:64px;"/>
          </label>
          <label class="wb-prop-row" style="margin:0;">
            <span>Highlight lines</span>
            <input type="text" id="code-highlight" value="${escapeXml(el.highlightLines || '')}" placeholder="e.g. 2,5-7" style="width:110px;"/>
          </label>
          <label class="wb-check-row" style="margin:0;">
            <input type="checkbox" id="code-wrap" ${el.codeWrap ? 'checked' : ''}/>
            <span>Wrap long lines</span>
          </label>
        </div>
        <div class="wb-code-editor-shell">
          <pre class="wb-code-gutter" id="code-gutter" aria-hidden="true"></pre>
          <textarea id="code-source" class="wb-code-source" spellcheck="false" wrap="${el.codeWrap ? 'soft' : 'off'}" aria-label="Code content">${escapeXml(el.text || '')}</textarea>
        </div>
        <div class="wb-code-editor-foot">
          <span class="wb-muted">Whitespace is stored exactly as typed. No code is executed.</span>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm" id="code-copy">Copy code</button>
            <button type="button" class="wb-btn wb-sm" id="code-outdent" title="Outdent selected lines">⇤</button>
            <button type="button" class="wb-btn wb-sm" id="code-indent" title="Indent selected lines">⇥</button>
          </div>
        </div>
        <div class="wb-modal-actions">
          <button type="button" class="wb-btn" id="code-cancel">Cancel</button>
          <button type="button" class="wb-btn wb-primary" id="code-save">Save Code Block</button>
        </div>
      `,
      (modal) => {
        const ta = modal.querySelector('#code-source');
        const gutter = modal.querySelector('#code-gutter');
        const paintGutter = () => {
          const count = ta.value.split(String.fromCharCode(10)).length;
          gutter.textContent = Array.from({ length: count }, (_, i) => i + 1).join(String.fromCharCode(10));
          gutter.scrollTop = ta.scrollTop;
        };
        paintGutter();
        ta.addEventListener('input', paintGutter);
        ta.addEventListener('scroll', () => {
          gutter.scrollTop = ta.scrollTop;
        });
        const indent = (delta) => {
          const start = ta.selectionStart;
          const end = ta.selectionEnd;
          const value = ta.value;
          const lineStart = value.lastIndexOf(String.fromCharCode(10), start - 1) + 1;
          const before = value.slice(0, lineStart);
          const block = value.slice(lineStart, end);
          const changed = block
            .split(String.fromCharCode(10))
            .map((line) =>
              delta > 0 ? `  ${line}` : line.replace(/^ {1,2}/, '')
            )
            .join(String.fromCharCode(10));
          ta.value = before + changed + value.slice(end);
          ta.selectionStart = lineStart;
          ta.selectionEnd = lineStart + changed.length;
          paintGutter();
        };
        modal.querySelector('#code-indent')?.addEventListener('click', () => indent(1));
        modal.querySelector('#code-outdent')?.addEventListener('click', () => indent(-1));
        ta.addEventListener('keydown', (ev) => {
          if (ev.key === 'Tab') {
            ev.preventDefault();
            indent(ev.shiftKey ? -1 : 1);
          }
        });
        modal.querySelector('#code-copy')?.addEventListener('click', async () => {
          const text =
            ta.selectionStart !== ta.selectionEnd
              ? ta.value.slice(ta.selectionStart, ta.selectionEnd)
              : ta.value;
          try {
            await navigator.clipboard.writeText(text);
            showToast('Code copied to clipboard.', 'success');
          } catch {
            showToast('Clipboard permission denied — select the text and copy manually.');
          }
        });
        modal.querySelector('#code-wrap')?.addEventListener('change', (e) => {
          ta.setAttribute('wrap', e.target.checked ? 'soft' : 'off');
        });
        modal.querySelector('#code-cancel')?.addEventListener('click', close);
        modal.querySelector('#code-save')?.addEventListener('click', () => {
          el.text = ta.value;
          el.codeLanguage = modal.querySelector('#code-lang').value;
          el.highlightLines = modal.querySelector('#code-highlight').value.trim();
          el.codeWrap = Boolean(modal.querySelector('#code-wrap').checked);
          el.fontSize = Math.max(10, Math.min(28, Number(modal.querySelector('#code-font-size').value) || 14));
          autoGrowShapeForText(el, el.text);
          app.commitChange();
          close();
          app.updateUI();
          app.requestRender();
          showToast('Code block saved.', 'success');
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
    openShareModal: openShareUrlModal,
    openRevealTimelineModal,
    openRecoveryModal,
    openHyperlinkModal,
    openPromptModal,
    openFocusToolsModal,
    openCodeEditorModal,
    openTableInsertModal,
    openTabletTestModal,
  };
}
