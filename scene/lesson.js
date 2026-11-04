// scene/lesson.js — derive a teaching track from the diagram's own topology.
//
// The existing "build from reveal steps" path needs the teacher to number every
// element first. This module instead walks the connectors: the entry node is the
// one nothing points at, and the walk follows real edges, so the resulting track
// teaches the diagram that is actually drawn. Pure: it reads a page and returns
// a track description — no timers, no history writes, no collaboration traffic.
import { createTrack } from './animation.js';

const NODE_TYPES = new Set([
  'stencil',
  'rect',
  'rounded-rect',
  'ellipse',
  'diamond',
  'table',
  'code',
  'image',
]);

const EDGE_TYPES = new Set(['arrow', 'line']);

// Timings follow the 2026-11-03 animation research: 400-600 ms per hop with a
// 300-500 ms pause between hops (NN/g duration guidance; segmentation research).
// Longer than this reads as "very slow" and costs more than the extra time buys.
const REVEAL_MS = 500;
const MARKER_MS = 600;
const HOP_PAUSE_MS = 400;

const labelOf = (el) => String(el?.text || '').trim();

function nodeIds(page) {
  return new Set(
    (page?.elements || [])
      .filter((el) => NODE_TYPES.has(el.type) && !el.hidden)
      .map((el) => el.id)
  );
}

function edgeList(page, ids) {
  return (page?.elements || [])
    .filter(
      (el) =>
        EDGE_TYPES.has(el.type) &&
        el.startBinding?.elementId &&
        el.endBinding?.elementId &&
        ids.has(el.startBinding.elementId) &&
        ids.has(el.endBinding.elementId)
    )
    .map((el) => ({
      id: el.id,
      from: el.startBinding.elementId,
      to: el.endBinding.elementId,
      label: labelOf(el),
    }));
}

/**
 * Walk the diagram from its natural entry point.
 * Returns the discovery order plus the edge that led to each node, so callers
 * can animate the path rather than every connector at once.
 */
export function analyzeDiagram(page, options = {}) {
  const ids = nodeIds(page);
  if (ids.size === 0) return { nodes: [], edges: [], entryId: null, order: [] };
  const edges = edgeList(page, ids);

  const incoming = new Map();
  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, 0);
    incoming.set(edge.to, incoming.get(edge.to) + 1);
  }

  // Entry: nothing points at it. Prefer a root that actually starts a flow —
  // a title or legend drawn to the left of the diagram is also a root, and
  // picking it would produce a one-step lesson. Among real roots, the one with
  // the most outgoing connectors wins, then the leftmost.
  const byId = new Map((page.elements || []).map((el) => [el.id, el]));
  const outDegree = new Map();
  for (const edge of edges) outDegree.set(edge.from, (outDegree.get(edge.from) || 0) + 1);
  const roots = [...ids].filter((id) => !incoming.get(id));
  const connectedRoots = roots.filter((id) => (outDegree.get(id) || 0) > 0);
  const pool = connectedRoots.length ? connectedRoots : roots.length ? roots : [...ids];
  const candidates = pool.slice();
  candidates.sort((a, b) => {
    const da = outDegree.get(a) || 0;
    const db = outDegree.get(b) || 0;
    if (da !== db) return db - da;
    const ea = byId.get(a);
    const eb = byId.get(b);
    return (ea?.x ?? 0) - (eb?.x ?? 0) || (ea?.y ?? 0) - (eb?.y ?? 0);
  });
  const entryId = options.entryId && ids.has(options.entryId) ? options.entryId : candidates[0];

  const outgoing = new Map();
  for (const edge of edges) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push(edge);
  }

  const visited = new Set([entryId]);
  const order = [{ nodeId: entryId, viaEdgeId: null, viaLabel: '' }];
  const queue = [entryId];
  while (queue.length) {
    const current = queue.shift();
    const next = (outgoing.get(current) || []).slice().sort((a, b) => {
      const ea = byId.get(a.to);
      const eb = byId.get(b.to);
      return (ea?.x ?? 0) - (eb?.x ?? 0) || (ea?.y ?? 0) - (eb?.y ?? 0);
    });
    for (const edge of next) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      order.push({ nodeId: edge.to, viaEdgeId: edge.id, viaLabel: edge.label });
      queue.push(edge.to);
    }
  }

  return { nodes: [...ids], edges, entryId, order, byId };
}

/** The element that best represents a deployment target, for a rollout step. */
function rolloutTarget(page, analysis) {
  // Compute/deployment nouns. Lambda and bare "app"/"application" were missing,
  // which left four of the ten AWS templates with no canary beat at all.
  const wanted =
    /lambda|function|cluster|aks|gke|eks|container apps|app service|application|\bapp\b|auto scaling|scaling group|instance|deployment|fleet|service|pod|task definition/i;
  // Network and security furniture that also matches the words above
  // ("services VPC", "service mesh gateway") but is not something you roll out.
  const rejected =
    /vpc|subnet|network|firewall|waf|security group|route|gateway|transit|endpoint|zone|bucket|table|queue|topic|bucket|registry/i;
  for (const { nodeId } of analysis.order) {
    const el = analysis.byId.get(nodeId);
    const label = labelOf(el);
    if (wanted.test(label) && !rejected.test(label)) return nodeId;
  }
  return null;
}

/**
 * Build the step list for a lesson track.
 * options: entryId, includeFailure, failureNodeId, includeRollout, maxSteps
 */
export function buildLessonSteps(page, options = {}) {
  const analysis = analyzeDiagram(page, options);
  if (!analysis.entryId) return [];
  const { includeFailure = true, includeRollout = false, maxSteps = 60 } = options;

  const steps = [];
  const push = (step) => {
    if (steps.length < maxSteps) steps.push(step);
  };

  const entry = analysis.byId.get(analysis.entryId);
  push({
    id: `lesson-entry-${analysis.entryId}`,
    action: 'reveal',
    targetId: analysis.entryId,
    duration: REVEAL_MS,
    narration: labelOf(entry) || 'Start of the flow',
  });

  for (let i = 1; i < analysis.order.length; i++) {
    const hop = analysis.order[i];
    const el = analysis.byId.get(hop.nodeId);
    if (hop.viaEdgeId) {
      push({
        id: `lesson-hop-${hop.viaEdgeId}`,
        action: 'request',
        edgeId: hop.viaEdgeId,
        // A short beat between hops: the marker for this hop starts after the
        // previous node has settled, so two hops never move at once.
        delay: HOP_PAUSE_MS,
        duration: MARKER_MS,
        narration: hop.viaLabel || `Traffic reaches ${labelOf(el) || 'the next service'}`,
      });
    }
    push({
      id: `lesson-reveal-${hop.nodeId}`,
      action: 'reveal',
      targetId: hop.nodeId,
      duration: REVEAL_MS,
      narration: labelOf(el) || '',
    });
  }

  // Failure teaching beats only fire where there is a real hop to fail on.
  const failureHop =
    analysis.order.length > 1
      ? analysis.order.find((h) => h.nodeId === options.failureNodeId) ||
        analysis.order[analysis.order.length - 1]
      : null;
  if (includeFailure && failureHop && failureHop.viaEdgeId) {
    const el = analysis.byId.get(failureHop.nodeId);
    push({
      id: `lesson-failure-${failureHop.nodeId}`,
      action: 'failure',
      targetId: failureHop.nodeId,
      duration: 1100,
      count: 1,
      narration: `${labelOf(el) || 'The dependency'} is unreachable — what does the user see?`,
    });
    push({
      id: `lesson-retry-${failureHop.nodeId}`,
      action: 'retry',
      edgeId: failureHop.viaEdgeId,
      targetId: failureHop.nodeId,
      duration: MARKER_MS,
      count: 3,
      narration: 'The client retries with backoff before the error surfaces',
    });
    push({
      id: `lesson-pulse-${failureHop.nodeId}`,
      action: 'pulse',
      targetId: failureHop.nodeId,
      duration: 1000,
      narration: 'Health check turns green — the path is healthy again',
    });
  }

  if (includeRollout) {
    const target = options.rolloutNodeId || rolloutTarget(page, analysis);
    if (target) {
      for (const pct of [10, 50, 100]) {
        push({
          id: `lesson-rollout-${target}-${pct}`,
          action: 'rollout',
          targetId: target,
          duration: 1200,
          count: pct,
          narration: `Canary at ${pct}% of traffic`,
        });
      }
    }
  }

  return steps;
}

export function buildLessonTrack(page, options = {}) {
  const steps = buildLessonSteps(page, options);
  if (steps.length === 0) return null;
  return createTrack({
    id: options.id || `track-${page?.id || 'page'}-lesson`,
    name: options.name || 'Diagram walkthrough',
    steps,
  });
}
