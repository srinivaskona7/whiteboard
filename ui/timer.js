// ui/timer.js

export function initTimerUI(app) {
  const widget = document.getElementById('wb-timer-widget');
  if (!widget) return { toggle() {} };

  let remainingSec = 300;
  let running = false;
  let intervalId = null;

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function playGentleChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 chord arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 0.95);
      });
    } catch {
      // Ignore audio errors when muted/blocked
    }
  }

  function broadcastIfLive() {
    app.collab?.broadcastTimerState?.({
      running,
      remainingSec,
      mode: 'countdown',
    });
  }

  function startTimer(syncRemote = true) {
    if (running) return;
    running = true;
    intervalId = setInterval(() => {
      if (remainingSec > 0) {
        remainingSec -= 1;
        render();
        if (remainingSec === 0) {
          stopTimer(false);
          playGentleChime();
          app.dialogs?.showToast('⏰ Classroom Timer Finished!', 'info');
        }
      }
    }, 1000);
    render();
    if (syncRemote) broadcastIfLive();
  }

  function stopTimer(syncRemote = true) {
    running = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    render();
    if (syncRemote) broadcastIfLive();
  }

  function applyRemoteTimerState(timerState) {
    if (!timerState || typeof timerState !== 'object') return;
    const nextSec = Math.max(0, Number(timerState.remainingSec) || 0);
    remainingSec = nextSec;
    if (timerState.running) {
      widget.classList.remove('wb-hidden');
      startTimer(false);
    } else {
      stopTimer(false);
    }
  }

  function render() {
    widget.innerHTML = `
      <div class="wb-timer-header">
        <strong>⏱ Classroom Timer</strong>
        <button type="button" class="wb-icon-btn" id="btn-timer-close" aria-label="Close Timer">✕</button>
      </div>
      <div class="wb-timer-display" id="wb-timer-readout">${formatTime(remainingSec)}</div>
      <div class="wb-btn-group">
        <button type="button" class="wb-btn wb-sm" data-preset="60">1m</button>
        <button type="button" class="wb-btn wb-sm" data-preset="180">3m</button>
        <button type="button" class="wb-btn wb-sm" data-preset="300">5m</button>
        <button type="button" class="wb-btn wb-sm" data-preset="600">10m</button>
      </div>
      <div class="wb-timer-controls">
        <input type="number" id="timer-custom-min" class="wb-input" min="1" max="120" placeholder="Min" style="width:62px" aria-label="Custom Minutes"/>
        <button type="button" class="wb-btn wb-sm" id="btn-timer-set">Set</button>
        <button type="button" class="wb-btn wb-sm wb-primary" id="btn-timer-toggle">${running ? 'Pause' : 'Start'}</button>
      </div>
    `;

    widget.querySelector('#btn-timer-close')?.addEventListener('click', () => {
      stopTimer();
      widget.classList.add('wb-hidden');
    });

    widget.querySelectorAll('[data-preset]').forEach((b) => {
      b.addEventListener('click', () => {
        stopTimer(false);
        remainingSec = Number(b.dataset.preset);
        render();
        broadcastIfLive();
      });
    });

    widget.querySelector('#btn-timer-set')?.addEventListener('click', () => {
      const val = Number(widget.querySelector('#timer-custom-min')?.value);
      if (val > 0) {
        stopTimer(false);
        remainingSec = Math.round(val * 60);
        render();
        broadcastIfLive();
      }
    });

    widget.querySelector('#btn-timer-toggle')?.addEventListener('click', () => {
      if (running) stopTimer(true);
      else startTimer(true);
    });
  }

  function toggle() {
    widget.classList.toggle('wb-hidden');
    render();
  }

  render();
  return { toggle, applyRemoteTimerState };
}
