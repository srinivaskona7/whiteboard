// ui/voting.js — Miro-style dot voting: a teacher-controlled classroom mode.
// The mode lives here (like the timer's running state); the votes themselves
// live on `el.votes` so they persist with the board.
import { castVote, clearVotes, totalVotes, tally, voteVisibility, MAX_VOTES_PER_ELEMENT } from '../scene/voting.js';

export function initVotingUI(app) {
  let active = false;
  let secret = false;

  // The renderer (and the banner) query the counts-hidden flag through the
  // shared scene/voting.js holder — render must not import ui/.
  const syncVisibility = () => {
    voteVisibility.countsHidden = active && secret;
  };

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
    app.collab?.broadcastVoteSession?.(true, secret);
    syncVisibility();
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
    // Closing the session is also the reveal: results are announced below
    // and the badges reappear for everyone.
    secret = false;
    syncVisibility();
    app.collab?.broadcastVoteSession?.(false, false);
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

  // FigJam-style vote secrecy: while secret, live counts are hidden from
  // everyone; Reveal shows them without closing the session.
  function setSecret(next) {
    const wanted = Boolean(next);
    if (!canControl()) {
      app.dialogs?.showToast('The teacher controls dot voting.', 'info');
      return;
    }
    if (!active || wanted === secret) return;
    secret = wanted;
    syncVisibility();
    app.collab?.broadcastVoteSession?.(true, secret);
    app.dialogs?.showToast(secret ? '🙈 Votes hidden — reveal them when ready.' : '👁 Votes revealed.', 'info');
    app.updateUI();
    app.requestRender();
  }

  // One dot on one element, entered from the canvas pointerdown route.
  function castVoteOn(el) {
    if (!active || !el) return false;
    if (app.collab ? !app.collab.canEditBoard() : false) {
      // The local count is the server's last broadcast, so it is the right
      // thing to warn from even though the server stays authoritative —
      // except during a secret session, when announcing "at the maximum"
      // would leak count information the room is hiding (the server caps
      // silently).
      if (voteVisibility.countsHidden !== true && (el.votes || 0) >= MAX_VOTES_PER_ELEMENT) {
        app.dialogs?.showToast(
          `"${String(el.text || '').trim().split('\n')[0] || el.name || 'item'}" already has the maximum of ${MAX_VOTES_PER_ELEMENT} votes.`,
          'info'
        );
        return false;
      }
      // Viewers never mutate locally: the server owns the count and its
      // authoritative broadcast brings the dot up for everyone, sender
      // included. An optimistic dot would linger after a rejection (the
      // teacher can close the session mid-flight) with nothing to roll it
      // back until the next full sync.
      app.collab?.broadcastVoteCast?.(app.getPage().id, el.id, el.votes || 0);
      return true;
    }
    const before = el.votes || 0;
    const votes = castVote(el);
    if (votes === before) {
      app.dialogs?.showToast(
        `"${String(el.text || '').trim().split('\n')[0] || el.name || 'item'}" already has the maximum of ${MAX_VOTES_PER_ELEMENT} votes.`,
        'info'
      );
      return false;
    }
    // Board owners commit through the shared element pipeline: history, autosave, collab.
    app.commitChange();
    app.requestRender();
    return true;
  }

  // Remote session toggles from the teacher arrive through the collab client.
  function applyRemoteSession(session) {
    if (!session || typeof session !== 'object') return;
    const next = Boolean(session.active);
    secret = next ? Boolean(session.secret) : false;
    const changed = next !== active || voteVisibility.countsHidden !== (next && secret);
    active = next;
    syncVisibility();
    if (changed) {
      app.dialogs?.showToast(next ? 'Voting open — click items to vote' : 'Voting closed.', 'info');
    }
    // The reveal payload: the server held the only live counts during the
    // secret phase; rebuild them locally now the session shows them.
    if (Array.isArray(session.counts)) {
      for (const c of session.counts) {
        const page = app.scene.pages.find((p) => p.id === c.pageId);
        const el = page?.elements.find((e) => e.id === c.elementId);
        if (el) el.votes = Math.max(0, Number(c.votes) || 0);
      }
      app.updateUI();
      app.requestRender();
    }
    if (!changed) return;
    app.updateUI();
    app.requestRender();
  }

  // A remote participant's dot: apply the authoritative count from the server.
  function applyRemoteVote(pageId, elementId, votes) {
    const page = app.scene.pages.find((p) => p.id === pageId);
    const el = page?.elements.find((e) => e.id === elementId);
    if (!el) return;
    // null = counted but hidden (secret session): the count stays with the
    // server until the reveal; nothing to apply locally.
    if (votes === null || votes === undefined) return;
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
    setSecret,
    castVoteOn,
    applyRemoteSession,
    applyRemoteVote,
    canControl,
    isActive: () => active,
    isSecret: () => secret,
    areCountsHidden: () => voteVisibility.countsHidden,
  };
}
