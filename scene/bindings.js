// scene/bindings.js
import { findElement } from './model.js';
import {
  getConnectionPorts,
  getPortPoint,
  getNearestPort,
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
      el.type === 'highlighter'
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
        };
      }
    }
  }
  return best;
}

export function bindConnectorEndpoint(connector, which, element, port = null) {
  if (!connector || !element) return;
  const pt =
    which === 'start'
      ? { x: connector.x, y: connector.y }
      : { x: connector.x2, y: connector.y2 };
  const chosenPort = port || getNearestPort(element, pt.x, pt.y)?.port || 'right';
  const portPos = getPortPoint(element, chosenPort);

  const binding = {
    elementId: element.id,
    port: chosenPort,
  };

  if (which === 'start') {
    connector.startBinding = binding;
    connector.x = portPos.x;
    connector.y = portPos.y;
  } else {
    connector.endBinding = binding;
    connector.x2 = portPos.x;
    connector.y2 = portPos.y;
  }
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
      } else if (el.startBinding.port === 'auto') {
        const ref = endShape ? getElementCenter(endShape) : { x: el.x2, y: el.y2 };
        const p = getEdgePointToward(startShape, ref.x, ref.y);
        el.x = p.x;
        el.y = p.y;
      } else {
        const p = getPortPoint(startShape, el.startBinding.port);
        el.x = p.x;
        el.y = p.y;
      }
    }

    if (el.endBinding) {
      if (!endShape) {
        el.endBinding = null;
      } else if (el.endBinding.port === 'auto') {
        const ref = startShape ? getElementCenter(startShape) : { x: el.x, y: el.y };
        const p = getEdgePointToward(endShape, ref.x, ref.y);
        el.x2 = p.x;
        el.y2 = p.y;
      } else {
        const p = getPortPoint(endShape, el.endBinding.port);
        el.x2 = p.x;
        el.y2 = p.y;
      }
    }

    el.w = Math.abs(el.x2 - el.x);
    el.h = Math.abs(el.y2 - el.y);
    getConnectorPoints(el, page);
  }
}
