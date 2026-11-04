// ui/cursor-chat.js — FigJam-style cursor chat: press /, type, Enter to send.
// Presentation only for the input itself; the bubble is applied and drawn by
// CollabClient + render/canvas.js like any remote participant's bubble.

export function initCursorChatUI(app) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'wb-cursor-chat-input wb-hidden';
  input.maxLength = 140;
  input.placeholder = 'Say it at your cursor… (Enter to send · Esc to cancel)';
  input.setAttribute('aria-label', 'Cursor chat message');
  document.body.appendChild(input);

  const isOpen = () => !input.classList.contains('wb-hidden');

  function close() {
    if (!isOpen()) return;
    input.classList.add('wb-hidden');
    input.value = '';
    // Return focus to the canvas wrapper so keyboard shortcuts keep working.
    (app.canvasWrap || app.canvas)?.focus?.({ preventScroll: true });
  }

  function open() {
    // Position at the last canvas pointer position, clamped on screen. Falls
    // back to the canvas centre on first load (no pointer seen yet).
    const rect = app.canvas.getBoundingClientRect();
    const pt = app._lastCanvasPointer || {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    input.classList.remove('wb-hidden');
    input.style.left = `${Math.min(Math.max(8, pt.x), window.innerWidth - 256)}px`;
    input.style.top = `${Math.min(Math.max(8, pt.y), window.innerHeight - 44)}px`;
    input.focus();
    input.select();
  }

  function submit() {
    const text = input.value.trim();
    const pt = app._lastCanvasPointer;
    close();
    if (!text || !pt) return null;
    const world = app.screenToWorld(pt.x, pt.y);
    return app.collab.broadcastCursorChat(text, app.getPage().id, world);
  }

  input.addEventListener('keydown', (ev) => {
    // The app-level handler must never react to keys typed into this input
    // ('/' included) — the input owns Enter and Escape itself.
    ev.stopPropagation();
    if (ev.key === 'Enter') {
      ev.preventDefault();
      submit();
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
    }
  });
  input.addEventListener('blur', () => close());

  return { open, close, isOpen, submit };
}
