// scene/history.js

// A snapshot covers every page-level field an edit can change. Elements were
// the only one for a long time; diagram configuration now lives beside them, so
// undoing an apply must restore the settings too or the drawer reports values
// that are no longer on the board.
const snapshotOf = (page) =>
  JSON.stringify({
    elements: page.elements || [],
    architectureConfigs: page.architectureConfigs || {},
    animationTrack: page.animationTrack || null,
  });

const applySnapshot = (page, raw) => {
  const parsed = JSON.parse(raw);
  page.elements = parsed.elements || [];
  if (parsed.architectureConfigs && Object.keys(parsed.architectureConfigs).length) {
    page.architectureConfigs = parsed.architectureConfigs;
  } else {
    delete page.architectureConfigs;
  }
  if (parsed.animationTrack) page.animationTrack = parsed.animationTrack;
  else delete page.animationTrack;
};

export class HistoryManager {
  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
    // pageId -> { undoStack: string[], redoStack: string[], currentSnapshot: string }
    this.stacks = new Map();
  }

  _ensurePage(pageOrId) {
    if (!pageOrId) return null;
    if (typeof pageOrId === 'string') {
      return this.stacks.get(pageOrId) || null;
    }
    if (!pageOrId.id) return null;
    if (!this.stacks.has(pageOrId.id)) {
      this.initPage(pageOrId);
    }
    return this.stacks.get(pageOrId.id);
  }

  initPage(page) {
    if (!page || !page.id) return;
    this.stacks.set(page.id, {
      undoStack: [],
      redoStack: [],
      currentSnapshot: snapshotOf(page),
    });
  }

  commit(page) {
    const state = this._ensurePage(page);
    if (!state) return false;
    const nextSnap = snapshotOf(page);
    if (nextSnap === state.currentSnapshot) {
      return false; // No change -> do not pollute undo stack
    }
    state.undoStack.push(state.currentSnapshot);
    if (state.undoStack.length > this.maxDepth) {
      state.undoStack.shift();
    }
    state.currentSnapshot = nextSnap;
    state.redoStack = [];
    return true;
  }

  record(page) {
    return this.commit(page);
  }

  canUndo(page) {
    const state = this._ensurePage(page);
    return Boolean(state && state.undoStack.length > 0);
  }

  canRedo(page) {
    const state = this._ensurePage(page);
    return Boolean(state && state.redoStack.length > 0);
  }

  undo(page) {
    const state = this._ensurePage(page);
    if (!state || state.undoStack.length === 0) return false;
    state.redoStack.push(state.currentSnapshot);
    const prevSnap = state.undoStack.pop();
    state.currentSnapshot = prevSnap;
    applySnapshot(page, prevSnap);
    return true;
  }

  redo(page) {
    const state = this._ensurePage(page);
    if (!state || state.redoStack.length === 0) return false;
    state.undoStack.push(state.currentSnapshot);
    const nextSnap = state.redoStack.pop();
    state.currentSnapshot = nextSnap;
    applySnapshot(page, nextSnap);
    return true;
  }

  removePage(pageId) {
    this.stacks.delete(pageId);
  }

  duplicatePageHistory(sourcePageId, targetPage) {
    this.initPage(targetPage);
  }
}
