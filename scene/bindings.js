// scene/bindings.js
import { findElement } from './model.js';
import {
  getConnectionPorts,
  getPortPoint,
  getNearestPort,
  chooseBestCardinalPort,
  getEdgePointToward,
  getElementCenter,
} from './geometry.js';
import { getConnectorPoints } from './routing.js';

export function findHoverPort(page, px, py, radius = 16, excludeId = null) {
  let best = null;
  let bestDist = radius;

  for (let i = page.elements.length - 1; i >= 0; i--) {
    const el = page.elements[i];
    if (
      el.hidden ||
      el.id === excludeId ||
      el.type === 'line' ||
      el.type === 'arrow' ||
      el.type === 'pen' ||
      el.type === 'highlighter' ||
      el.type === 'question'
    ) {
      continue;
    }
    const ports = getConnectionPorts(el);
    for (const p of ports) {
      const d = Math.hypot(p.x - px, p.y - py);
      if (d <= bestDist) {
        bestDist = d;
        best = {
          elementId: el.id,
          port: p.port,
          portId: p.port,
          x: p.x,
          y: p.y,
          element: el,
          isExplicitPort: true,
        };
      }
    }
  }
  if (best) return best;

  // Component body hover: snap in automatic boundary mode ('auto')
  const bodyPad = Math.min(12, radius * 0.6);
  for (let i = page.elements.length - 1; i >= 0; i--) {
    const el = page.elements[i];
    if (
      el.hidden ||
      el.id === excludeId ||
      el.type === 'line' ||
      el.type === 'arrow' ||
      el.type === 'pen' ||
      el.type === 'highlighter' ||
      el.type === 'frame' ||
      el.isBoundary ||
      el.type === 'question'
    ) {
      continue;
    }
    if (
      px >= el.x - bodyPad &&
      px <= el.x + el.w + bodyPad &&
      py >= el.y - bodyPad &&
      py <= el.y + el.h + bodyPad
    ) {
      const nearest = getNearestPort(el, px, py);
      const edgePt = getEdgePointToward(el, px, py);
      return {
        elementId: el.id,
        port: 'auto',
        resolvedPort: nearest?.port || 'right',
        portId: 'auto',
        x: nearest ? nearest.x : edgePt.x,
        y: nearest ? nearest.y : edgePt.y,
        element: el,
        isExplicitPort: false,
      };
    }
  }
  return null;
}

export function bindConnectorEndpoint(
  connector,
  which,
  element,
  port = null,
  customRatio = null
) {
  if (!connector || !element) return;
  const oppositePt =
    which === 'start'
      ? { x: connector.x2 ?? element.x + element.w + 80, y: connector.y2 ?? element.y + element.h / 2 }
      : { x: connector.x ?? element.x - 80, y: connector.y ?? element.y + element.h / 2 };

  const chosenPort = port || 'auto';
  const resolvedCardinal =
    chosenPort === 'auto'
      ? chooseBestCardinalPort(element, oppositePt.x, oppositePt.y)
      : chosenPort;

  const portPos =
    chosenPort === 'custom' && customRatio
      ? getPortPoint(element, 'custom', customRatio)
      : chosenPort === 'auto' && connector.routing === 'straight'
        ? getEdgePointToward(element, oppositePt.x, oppositePt.y)
        : getPortPoint(element, resolvedCardinal);

  const binding = {
    elementId: element.id,
    port: chosenPort,
    resolvedPort: resolvedCardinal,
  };
  if (chosenPort === 'custom' && customRatio) {
    binding.rx = customRatio.rx;
    binding.ry = customRatio.ry;
  }

  if (which === 'start') {
    connector.startBinding = binding;
    connector.x = portPos.x;
    connector.y = portPos.y;
  } else {
    connector.endBinding = binding;
    connector.x2 = portPos.x;
    connector.y2 = portPos.y;
  }
  connector.w = Math.abs(connector.x2 - connector.x);
  connector.h = Math.abs(connector.y2 - connector.y);
}

export function unbindConnectorEndpoint(connector, which) {
  if (!connector) return;
  if (which === 'start') connector.startBinding = null;
  if (which === 'end') connector.endBinding = null;
}

export function updateConnectorBindings(page, changedElementIds = null) {
  if (!page || !Array.isArray(page.elements)) return;
  const filterSet = changedElementIds ? new Set(changedElementIds) : null;

  for (const el of page.elements) {
    if (el.type !== 'line' && el.type !== 'arrow') continue;
    if (!el.startBinding && !el.endBinding) continue;

    const startShape = el.startBinding ? findElement(page, el.startBinding.elementId) : null;
    const endShape = el.endBinding ? findElement(page, el.endBinding.elementId) : null;

    if (
      filterSet &&
      !filterSet.has(el.id) &&
      (!startShape || !filterSet.has(startShape.id)) &&
      (!endShape || !filterSet.has(endShape.id))
    ) {
      continue;
    }

    if (el.startBinding) {
      if (!startShape) {
        el.startBinding = null;
      } else if (el.startBinding.port === 'custom') {
        const p = getPortPoint(startShape, 'custom', {
          rx: el.startBinding.rx ?? 0.5,
          ry: el.startBinding.ry ?? 0.5,
        });
        el.x = p.x;
        el.y = p.y;
      } else if (el.startBinding.port === 'auto') {
        const ref = endShape ? getElementCenter(endShape) : { x: el.x2, y: el.y2 };
        const bestPort = chooseBestCardinalPort(startShape, ref.x, ref.y);
        el.startBinding.resolvedPort = bestPort;
        if (el.routing === 'straight') {
          const p = getEdgePointToward(startShape, ref.x, ref.y);
          el.x = p.x;
          el.y = p.y;
        } else {
          const p = getPortPoint(startShape, bestPort);
          el.x = p.x;
          el.y = p.y;
        }
      } else {
        el.startBinding.resolvedPort = el.startBinding.port;
        const p = getPortPoint(startShape, el.startBinding.port);
        el.x = p.x;
        el.y = p.y;
      }
    }

    if (el.endBinding) {
      if (!endShape) {
        el.endBinding = null;
      } else if (el.endBinding.port === 'custom') {
        const p = getPortPoint(endShape, 'custom', {
          rx: el.endBinding.rx ?? 0.5,
          ry: el.endBinding.ry ?? 0.5,
        });
        el.x2 = p.x;
        el.y2 = p.y;
      } else if (el.endBinding.port === 'auto') {
        const ref = startShape ? getElementCenter(startShape) : { x: el.x, y: el.y };
        const bestPort = chooseBestCardinalPort(endShape, ref.x, ref.y);
        el.endBinding.resolvedPort = bestPort;
        if (el.routing === 'straight') {
          const p = getEdgePointToward(endShape, ref.x, ref.y);
          el.x2 = p.x;
          el.y2 = p.y;
        } else {
          const p = getPortPoint(endShape, bestPort);
          el.x2 = p.x;
          el.y2 = p.y;
        }
      } else {
        el.endBinding.resolvedPort = el.endBinding.port;
        const p = getPortPoint(endShape, el.endBinding.port);
        el.x2 = p.x;
        el.y2 = p.y;
      }
    }

    el.w = Math.abs(el.x2 - el.x);
    el.h = Math.abs(el.y2 - el.y);
    getConnectorPoints(el, page);
  }

  // Keep attached student question pins anchored to their target component
  for (const el of page.elements) {
    if (el.type === 'question' && el.targetElementId) {
      const target = findElement(page, el.targetElementId);
      if (target) {
        if (!filterSet || filterSet.has(target.id) || filterSet.has(el.id)) {
          if (typeof el.anchorRx === 'number' && typeof el.anchorRy === 'number' && el.offsetX === undefined) {
            el.x = Math.round(target.x + target.w * el.anchorRx);
            el.y = Math.round(target.y + target.h * el.anchorRy - 36);
          } else {
            el.x = target.x + (el.offsetX ?? Math.max(0, target.w - 30));
            el.y = target.y + (el.offsetY ?? -36);
          }
        }
      } else {
        // Target component was deleted: preserve question at last valid position
        el.targetElementId = null;
        el.anchorDeleted = true;
      }
    }
  }
}
