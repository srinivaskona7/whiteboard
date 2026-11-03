// scene/animation.js — declarative, allowlisted teaching animation tracks.
// Pure state machine: no timers, no history writes, no collaboration traffic.
import { getPointAlongConnector } from './routing.js';

export const ANIMATION_ACTIONS = [
  'reveal',
  'hide',
  'highlight',
  'dim',
  'trace',
  'marker',
  'request',
  'response',
  'failure',
  'retry',
  'backlog',
  'camera',
];

const DEFAULT_DURATION = 1400;

export function createTrack({ id, name = 'Teaching track', steps = [] }) {
  return { id, name, steps: normalizeSteps(steps) };
}

export function normalizeSteps(steps) {
  return steps.map((step, index) => {
    if (!ANIMATION_ACTIONS.includes(step.action)) {
      throw new Error(`Unknown animation action "${step.action}" at step ${index + 1}`);
    }
    return {
      id: step.id || `step-${index + 1}`,
      action: step.action,
      targetId: step.targetId || null,
      edgeId: step.edgeId || null,
      duration: Math.max(200, Math.min(20000, Number(step.duration) || DEFAULT_DURATION)),
      delay: Math.max(0, Number(step.delay) || 0),
      narration: step.narration || '',
      reverse: Boolean(step.reverse),
      // Used by failure/retry/backlog so the badge can carry a real number.
      count: Number.isFinite(Number(step.count)) ? Math.max(1, Math.round(Number(step.count))) : 1,
    };
  });
}

export function validateTrack(track, page) {
  const errors = [];
  const ids = new Set();
  const known = new Set((page?.elements || []).map((e) => e.id));
  for (const step of track?.steps || []) {
    if (ids.has(step.id)) errors.push(`Duplicate step id "${step.id}".`);
    ids.add(step.id);
    if (!ANIMATION_ACTIONS.includes(step.action)) errors.push(`Action "${step.action}" is not allowlisted.`);
    if (step.targetId && !known.has(step.targetId)) errors.push(`Step "${step.id}" targets a missing element.`);
    if (step.edgeId && !known.has(step.edgeId)) errors.push(`Step "${step.id}" targets a missing connector.`);
    if (!Number.isFinite(step.duration) || step.duration <= 0) errors.push(`Step "${step.id}" has an invalid duration.`);
    if (
      ['marker', 'trace', 'request', 'response', 'failure', 'retry', 'backlog'].includes(step.action) &&
      !step.edgeId &&
      !step.targetId
    ) {
      errors.push(`Step "${step.id}" needs an edge or element target.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function trackDuration(track) {
  return (track?.steps || []).reduce((sum, s) => sum + s.delay + s.duration, 0);
}

export function stepStartMs(track, index) {
  let total = 0;
  for (let i = 0; i < index && i < (track?.steps || []).length; i++) {
    total += track.steps[i].delay + track.steps[i].duration;
  }
  return total + (track?.steps?.[index]?.delay || 0);
}

/**
 * Sample the track at one clock value. The caller owns the clock; this function
 * is deterministic so it can be tested and replayed.
 */
export function sampleTrack(track, elapsedMs, options = {}) {
  const { reducedMotion = false, page = null } = options;
  const steps = track?.steps || [];
  const duration = trackDuration(track);
  const time = Math.max(0, Math.min(duration, elapsedMs));

  const state = {
    time,
    duration,
    visible: new Set(),
    hidden: new Set(),
    highlighted: new Set(),
    dimmed: new Set(),
    traces: new Set(),
    effects: new Map(),
    // failure / retry / backlog draw a marker and a count, not just a colour.
    badges: [],
    markers: [],
    camera: null,
    narration: '',
    revealMode: (track?.steps || []).some((s) => s.action === 'reveal'),
    revealPending: new Set(
      (track?.steps || []).filter((s) => s.action === 'reveal' && s.targetId).map((s) => s.targetId)
    ),
    stepIndex: -1,
    stepId: null,
    finished: time >= duration,
  };

  let cursor = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const start = cursor + step.delay;
    const end = start + step.duration;
    cursor = end;
    const active = time >= start;
    const progress = reducedMotion ? (active ? 1 : 0) : Math.max(0, Math.min(1, (time - start) / step.duration));
    if (!active) continue;
    state.stepIndex = i;
    state.stepId = step.id;
    state.narration = step.narration || state.narration;

    switch (step.action) {
      case 'reveal':
        if (step.targetId) {
          // Revealing is the inverse of hiding: an element shown again must not
          // stay suppressed by an earlier hide step.
          state.hidden.delete(step.targetId);
          state.visible.add(step.targetId);
        }
        break;
      case 'hide':
        if (step.targetId) {
          state.hidden.add(step.targetId);
          state.visible.delete(step.targetId);
        }
        break;
      case 'highlight':
        if (step.targetId) state.highlighted.add(step.targetId);
        break;
      case 'dim':
        if (step.targetId) state.dimmed.add(step.targetId);
        break;
      case 'trace':
        if (step.edgeId || step.targetId) state.traces.add(step.edgeId || step.targetId);
        break;
      case 'marker':
      case 'request':
      case 'response': {
        const edgeId = step.edgeId || step.targetId;
        if (edgeId) {
          const direction = step.action === 'response' || step.reverse ? -1 : 1;
          const t = direction === 1 ? progress : 1 - progress;
          // Only the newest marker step is drawn; earlier markers must not pile up.
          state.markers = [{ edgeId, t, action: step.action, progress, stepId: step.id }];
        }
        break;
      }
      case 'failure':
      case 'retry':
      case 'backlog':
        if (step.targetId) {
          state.highlighted.add(step.targetId);
          state.effects.set(step.targetId, step.action);
          const existing = state.badges.find((b) => b.targetId === step.targetId);
          if (existing) {
            existing.action = step.action;
            existing.count = step.count;
            existing.progress = progress;
          } else {
            state.badges.push({
              targetId: step.targetId,
              action: step.action,
              count: step.count,
              progress,
              stepId: step.id,
            });
          }
        }
        break;
      case 'camera':
        state.camera = step.targetId || null;
        break;
      default:
        break;
    }
  }
  for (const id of state.visible) state.revealPending.delete(id);
  return state;
}

/** World point for a marker at parameter t along a connector. */
export function markerPoint(edge, t, page = null) {
  if (!edge) return null;
  try {
    return getPointAlongConnector(edge, t, page);
  } catch {
    return null;
  }
}

export function stepTargetsStep(track, elapsedMs) {
  const state = sampleTrack(track, elapsedMs);
  return state.stepIndex;
}
