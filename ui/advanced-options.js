// ui/advanced-options.js
// Advanced Options — one place for every power feature plus transparent storage
// details and safe cleanup (only StudioBoard-owned data is removed).

import {
  loadRecoverySnapshots,
  clearRecoverySnapshots,
  serializeScene,
} from '../scene/storage.js';
import {
  getBoardInfo,
  listBackups,
  clearAllBackups,
  clearBoardFromIDB,
  saveBoardToIDB,
  loadBoardFromIDB,
} from '../scene/indexeddb-backup.js';

export function initAdvancedOptions(app) {
  const dialogs = app.dialogs;

  function fmt(bytes) {
    return app.formatBytes(bytes || 0);
  }

  async function storageHtml() {
    const { usage, quota } = await app.getStorageEstimate();
    let boardBytes = 0;
    try { boardBytes = new TextEncoder().encode(serializeScene(app.scene)).byteLength; } catch { /* ignore */ }
    const info = await getBoardInfo();
    if (info.bytes) boardBytes = Math.max(boardBytes, info.bytes);
    let recoveryBytes = 0;
    try { recoveryBytes = new TextEncoder().encode(localStorage.getItem('classroom_whiteboard_recovery_v1') || '').byteLength; } catch { /* ignore */ }
    const backups = await listBackups();
    recoveryBytes += backups.reduce((sum, b) => sum + (b.bytes || 0), 0);
    const localSnapshots = loadRecoverySnapshots().length;
    const pct = quota ? Math.round((usage / quota) * 100) : null;
    const last = app._lastSaveInfo?.at ? new Date(app._lastSaveInfo.at).toLocaleString() : 'None yet';

    return `
      <p class="wb-muted" style="margin:0 0 8px;font-size:12px;line-height:1.5;">
        Board data saves to <strong>IndexedDB</strong> (large quota). Small preferences stay in localStorage.
        The overall site estimate below does <strong>not</strong> limit board saves.
      </p>
      <div class="wb-storage-grid">
        <div class="wb-storage-card">
          <div class="wb-storage-card-label">Board data</div>
          <div class="wb-storage-card-value">${fmt(boardBytes)}</div>
          <div class="wb-storage-card-sub">IndexedDB · authoritative</div>
        </div>
        <div class="wb-storage-card">
          <div class="wb-storage-card-label">Recovery history</div>
          <div class="wb-storage-card-value">${fmt(recoveryBytes)}</div>
          <div class="wb-storage-card-sub">${localSnapshots} snapshots · ${backups.length} checkpoints</div>
        </div>
        <div class="wb-storage-card">
          <div class="wb-storage-card-label">Overall site storage</div>
          <div class="wb-storage-card-value">${pct != null ? `${pct}%` : fmt(usage)}</div>
          <div class="wb-storage-card-sub">${fmt(usage)} / ${quota ? fmt(quota) : 'unknown'}</div>
        </div>
      </div>
      <div class="wb-storage-meta">Last successful save: <strong>${last}</strong>${app._lastSaveInfo?.backend ? ` · ${app._lastSaveInfo.backend}` : ''}</div>
      <div class="wb-popover-sep"></div>
      <div class="wb-storage-actions">
        <button type="button" class="wb-btn wb-sm" id="wb-adv-backup">⬇ Download backup</button>
        <button type="button" class="wb-btn wb-sm" id="wb-adv-clear-board">🗑 Clear current board</button>
        <button type="button" class="wb-btn wb-sm wb-danger" id="wb-adv-clear-recovery">🧹 Clear recovery history</button>
      </div>
      <p class="wb-muted" style="font-size:11px;margin:8px 0 0;">
        Downloading a backup preserves your data but does not free space. Clearing recovery history does.
        Only StudioBoard-owned snapshots and checkpoints are removed.
      </p>
    `;
  }

  function featuresHtml() {
    const features = [
      ['⚡ Teaching Quick-Action Bar', 'One-tap mark correct/incorrect, hide/reveal, page nav', () => app.toggleTeachingQuickbar()],
      ['📑 Page Thumbnail Navigator', 'Visual page strip with thumbnails', () => app.togglePageNavigator()],
      ['🎨 Style Presets', 'Apply teaching colors to selection', () => app.toggleTeachingQuickbar()],
      ['🖊 Image Upload', 'Paste or drop images onto the board', () => document.getElementById('wb-file-image')?.click()],
      ['⏱ Timer Presets', 'Class countdown timer with presets', () => app.timerUI?.toggle()],
      ['🔦 Spotlight', 'Focus lens / magnifier', () => app.toggleSpotlight(false)],
      ['📐 Laser Pointer', 'Ephemeral pointer trail', () => app.setTool('laser')],
      ['🗳 Dot Voting', 'Classroom voting session', () => app.votingUI?.toggle()],
      ['📜 Version History', 'Board snapshots you can restore', () => app.dialogs?.openVersionHistoryModal()],
      ['🕘 Recent Boards', 'Recently saved boards', () => app.dialogs?.openRecentBoardsModal()],
      ['🖊 Laser Colors', 'Change laser pointer color', () => app.openLaserColorPicker?.()],
      ['🔦 Spotlight Sizes', 'Small / medium / large / xlarge', () => app.openSpotlightPicker?.()],
      ['📄 Duplicate Page + Template', 'Notes / discussion / answers', () => app.openDuplicatePagePicker?.()],
      ['🖥 Fullscreen', 'Hide browser chrome', () => app.toggleFullscreen()],
      ['📄 Export Handout', 'Print / Save as PDF', () => app.exportLessonHandout()],
      ['🗑 Clear Board', 'Wipe the active page', () => app.clearBoard()],
    ];
    app._advFeatures = features;
    return `
      <p class="wb-muted" style="margin:0 0 8px;font-size:12px;">Every advanced feature is enabled. Tap to open it.</p>
      <div class="wb-adv-feature-grid">
        ${features.map(([name, desc], i) => `
          <button type="button" class="wb-adv-feature" data-adv-feature="${i}" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px;border:1px solid var(--border-color);border-radius:8px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;text-align:left;min-height:56px;">
            <span style="font-weight:600;font-size:12px;">${name}</span>
            <span class="wb-muted" style="font-size:10px;">${desc}</span>
          </button>`).join('')}
      </div>
    `;
  }

  function bindStorageActions(box) {
    box.querySelector('#wb-adv-backup')?.addEventListener('click', () => {
      app.saveSceneFile();
    });
    box.querySelector('#wb-adv-clear-board')?.addEventListener('click', () => {
      dialogs.close();
      app.clearBoard();
    });
    box.querySelector('#wb-adv-clear-recovery')?.addEventListener('click', async () => {
      const ok = await dialogs.openConfirmModal(
        'Clear Recovery History',
        'This removes all StudioBoard recovery snapshots and IndexedDB checkpoints. Your current board is NOT deleted. Continue?',
        { confirmLabel: 'Clear history', cancelLabel: 'Cancel', danger: true }
      );
      if (!ok) return;
      clearRecoverySnapshots();
      await clearAllBackups();
      dialogs.showToast('Recovery history cleared. Current board is safe.', 'success');
      open('storage');
    });
  }

  async function open(section = 'features') {
    const isStorage = section === 'storage';
    const body = isStorage ? await storageHtml() : featuresHtml();
    dialogs.openHtml(
      'Advanced Options',
      `
        <div class="wb-btn-group" style="margin-bottom:10px;">
          <button type="button" class="wb-btn wb-sm ${!isStorage ? 'active wb-primary' : ''}" data-adv-tab="features">Features</button>
          <button type="button" class="wb-btn wb-sm ${isStorage ? 'active wb-primary' : ''}" data-adv-tab="storage">Storage & Cleanup</button>
        </div>
        <div id="wb-adv-body">${body}</div>
      `,
      (box) => {
        box.querySelectorAll('[data-adv-tab]').forEach((btn) => {
          btn.addEventListener('click', () => open(btn.dataset.advTab));
        });
        box.querySelectorAll('[data-adv-feature]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const feature = app._advFeatures?.[Number(btn.dataset.advFeature)];
            if (feature) { dialogs.close(); feature[2](); }
          });
        });
        if (isStorage) bindStorageActions(box);
      }
    );
  }

  return { open };
}
