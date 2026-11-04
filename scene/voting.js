// scene/voting.js — dot-voting tally logic shared by the board and the collab server.
// Votes live ON the element (`el.votes`) so they flow through the same
// history/autosave/collab paths as every other element edit — state stored
// anywhere else escapes undo and preview.

export const MAX_VOTES_PER_ELEMENT = 3;

// Add one vote to an element, capped per element. Returns the new count,
// which stays unchanged when the cap was already reached.
export function castVote(el, { perElementCap = MAX_VOTES_PER_ELEMENT } = {}) {
  if (!el) return 0;
  const current = Number.isFinite(el.votes) ? el.votes : 0;
  const cap = Number.isFinite(Number(perElementCap)) ? Math.max(1, Number(perElementCap)) : MAX_VOTES_PER_ELEMENT;
  el.votes = Math.min(current + 1, cap);
  return el.votes;
}

// Zero every element's votes. Returns how many elements carried votes.
export function clearVotes(elements = []) {
  let cleared = 0;
  for (const el of elements || []) {
    if (!el) continue;
    if (el.votes > 0) cleared += 1;
    el.votes = 0;
  }
  return cleared;
}

export function totalVotes(elements = []) {
  let total = 0;
  for (const el of elements || []) {
    if (el && el.votes > 0) total += el.votes;
  }
  return total;
}

// Leaderboard of the elements that carry votes, highest first. Ties keep the
// page order so the same board always announces the same winners. The label is
// the element's first text line, trimmed for the results announcement.
export function tally(elements = []) {
  const rows = [];
  (elements || []).forEach((el, idx) => {
    if (!el || !(el.votes > 0)) return;
    const firstLine = String(el.text || '').trim().split('\n')[0];
    rows.push({ id: el.id, text: firstLine || el.name || el.id, votes: el.votes, idx });
  });
  rows.sort((a, b) => b.votes - a.votes || a.idx - b.idx);
  return rows.map(({ id, text, votes }) => ({ id, text, votes }));
}
