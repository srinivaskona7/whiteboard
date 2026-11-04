// ui/voting.js — Miro-style dot voting: a teacher-controlled classroom mode.
// The mode lives here (like the timer's running state); the votes themselves
// live on `el.votes` so they persist with the board.
import { castVote, clearVotes, totalVotes, tally, MAX_VOTES_PER_ELEMENT } from '../scene/voting.js';

export function initVotingUI(app) {
  let active = false;

  // Students (viewer/questioner in a live room) may cast dots while voting is
  // open, but never start/stop/reset the session itself (see timer.js canControl).
  function canControl() {
    const collab = app.collab;
    if (!collab) return true;
    const isStudent =
      ['live', 'connecting', 'readonly-snapshot'].includes(collab.status) &&
      (collab.role === 'viewer' || collab.role === 'questioner');
    if (isStudent) return false;
    return collab.canEditBoard ? collab.canEditBoard() : true;
  }

  function start() {
    if (active) return;
    if (!canControl()) {
      app.dialogs?.showToast('The teacher controls dot voting.', 'info');
      return;
    }
    active = true;
    app.collab?.broadcastVoteSession?.(true);
    app.dialogs?.showToast('Voting open — click items to vote', 'info');
    app.updateUI();
    app.requestRender();
  }

  function stop() {
    if (!active) return;
    if (!canControl()) {
      app.dialogs?.showToast('The teacher controls dot voting.', 'info');
      return;
    }
    active = false;
    app.collab?.broadcastVoteSession?.(false);
    // The session is room-wide and a student may have voted on any page, so
    // the results tally every page — otherwise page-2 dots vanish from the
    // announcement and never get cleared.
    const allElements = (app.scene?.pages || []).flatMap((p) => p.elements);
    const top = tally(allElements).slice(0, 3);
    if (top.length === 0) {
      app.dialogs?.showToast('Voting closed — no votes were cast.', 'info');
    } else {
      const results = top.map((r, i) => `${i + 1}. ${r.text} (${r.votes})`).join(' · ');
      app.dialogs?.showToast(`📊 Voting results — ${results}`, 'success');
    }
    app.updateUI();
    app.requestRender();
  }

  function reset() {
    if (!canControl()) {
      app.dialogs?.showToast('The teacher controls dot voting.', 'info');
      return;
    }
    const page = app.getPage();
    if (!page) return;
    const dots = totalVotes(page.elements);
    if (dots === 0) {
      app.dialogs?.showToast('No votes to clear on this page.', 'info');
      return;
    }
    clearVotes(page.elements);
    // Clearing is a board edit like any other: undoable, autosaved, broadcast.
    app.commitChange();
    app.dialogs?.showToast(`Cleared ${dots} vote${dots === 1 ? '' : 's'} on this page.`, 'info');
    app.requestRender();
  }

  function toggle() {
    if (active) stop();
    else start();
  }

  // One dot on one element, entered from the canvas pointerdown route.
  function castVoteOn(el) {
    if (!active || !el) return false;
    const before = el.votes || 0;
    const votes = castVote(el);
    if (votes === before) {
      app.dialogs?.showToast(
        `"${String(el.text || '').trim().split('\n')[0] || el.name || 'item'}" already has the maximum of ${MAX_VOTES_PER_ELEMENT} votes.`,
        'info'
      );
      return false;
    }
    if (app.collab ? app.collab.canEditBoard() : true) {
      // Board owners commit through the shared element pipeline: history, autosave, collab.
      app.commitChange();
    } else {
      // Viewers cannot scene-sync; their dot travels on its own channel instead.
      app.collab?.broadcastVoteCast?.(app.getPage().id, el.id, el.votes);
    }
    app.requestRender();
    return true;
  }

  // Remote session toggles from the teacher arrive through the collab client.
  function applyRemoteSession(session) {
    if (!session || typeof session !== 'object') return;
    const next = Boolean(session.active);
    if (next === active) return;
    active = next;
    app.dialogs?.showToast(next ? 'Voting open — click items to vote' : 'Voting closed.', 'info');
    app.updateUI();
    app.requestRender();
  }

  // A remote participant's dot: apply the authoritative count from the server.
  function applyRemoteVote(pageId, elementId, votes) {
    const page = app.scene.pages.find((p) => p.id === pageId);
    const el = page?.elements.find((e) => e.id === elementId);
    if (!el) return;
    el.votes = Math.max(0, Number(votes) || 0);
    // A remote dot is board state like a local one. Without a history record
    // the vote lives only in memory: a teacher undoing their own last stroke
    // would restore a pre-vote snapshot and broadcast the erasure of the
    // class's votes to everyone.
    if (page === app.getPage()) {
      app.commitChange();
    } else {
      // commitChange records the active page; a vote on another page still
      // needs its own history entry plus autosave. The scene sync carries
      // every page, so one broadcast suffices.
      app.history?.record?.(page);
      app.scheduleAutosave?.(app.scene);
      app.collab?.broadcastSceneChange?.();
    }
    app.requestRender();
  }

  return {
    toggle,
    start,
    stop,
    reset,
    castVoteOn,
    applyRemoteSession,
    applyRemoteVote,
    canControl,
    isActive: () => active,
  };
}
