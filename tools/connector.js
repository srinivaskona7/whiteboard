// tools/connector.js
import { createElement } from '../scene/model.js';
import { snapAngle } from '../scene/geometry.js';
import {
  findHoverPort,
  bindConnectorEndpoint,
  unbindConnectorEndpoint,
  updateConnectorBindings,
} from '../scene/bindings.js';

export class ConnectorTool {
  constructor(app) {
    this.app = app;
    this.activeConnector = null;
    this.startedFromPort = null;
  }

  cancel() {
    if (this.activeConnector) {
      const page = this.app.getPage();
      page.elements = page.elements.filter((e) => e.id !== this.activeConnector.id);
      this.activeConnector = null;
      this.startedFromPort = null;
      this.app.connectorPreview = null;
      this.app.requestRender();
    }
  }

  startFromPort(portInfo, world) {
    const page = this.app.getPage();
    const style = this.app.currentStyle;
    const conn = createElement('arrow', {
      x: portInfo.x,
      y: portInfo.y,
      x2: world.x,
      y2: world.y,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      strokeStyle: style.strokeStyle,
      routing: style.routing || 'orthogonal',
      startArrow: style.startArrow || 'none',
      endArrow: style.endArrow || 'arrow',
    });
    bindConnectorEndpoint(conn, 'start', portInfo.element, portInfo.port);
    page.elements.push(conn);
    this.activeConnector = conn;
    this.startedFromPort = portInfo;
    this.app.connectorPreview = { startPort: portInfo, endPort: null };
    this.app.selectedIds = new Set([conn.id]);
    this.app.requestRender();
  }

  onPointerDown(world) {
    const page = this.app.getPage();
    const style = this.app.currentStyle;
    const type = this.app.activeTool === 'line' ? 'line' : 'arrow';
    const portHit = findHoverPort(page, world.x, world.y, 24 / page.camera.zoom);
    this.startedFromPort = null;

    const conn = createElement(type, {
      x: portHit ? portHit.x : world.x,
      y: portHit ? portHit.y : world.y,
      x2: world.x,
      y2: world.y,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      strokeStyle: style.strokeStyle,
      routing: type === 'line' ? 'straight' : style.routing || 'orthogonal',
      startArrow: style.startArrow || 'none',
      endArrow: type === 'line' ? 'none' : style.endArrow || 'arrow',
    });

    if (portHit) {
      bindConnectorEndpoint(
        conn,
        'start',
        portHit.element,
        portHit.isExplicitPort ? portHit.port : 'auto'
      );
    }

    this.app.connectorPreview = { startPort: portHit || null, endPort: null };
    page.elements.push(conn);
    this.activeConnector = conn;
    this.app.selectedIds = new Set([conn.id]);
    this.app.requestRender();
  }

  onPointerMove(world, ev) {
    const page = this.app.getPage();
    if (!this.activeConnector) {
      const portHit = findHoverPort(page, world.x, world.y, 24 / page.camera.zoom);
      this.app.hoveredPort = portHit;
      this.app.hoveredElement = portHit ? portHit.element : null;
      this.app.requestRender();
      return;
    }

    const conn = this.activeConnector;
    const portHit = findHoverPort(page, world.x, world.y, 24 / page.camera.zoom, conn.id);
    this.app.hoveredPort = portHit;
    this.app.hoveredElement = portHit ? portHit.element : null;

    if (portHit && portHit.elementId !== conn.startBinding?.elementId) {
      bindConnectorEndpoint(
        conn,
        'end',
        portHit.element,
        portHit.isExplicitPort ? portHit.port : 'auto'
      );
      this.app.connectorPreview = {
        startPort: this.app.connectorPreview?.startPort || null,
        endPort: portHit,
      };
    } else {
      unbindConnectorEndpoint(conn, 'end');
      this.app.connectorPreview = {
        startPort: this.app.connectorPreview?.startPort || null,
        endPort: null,
      };
      let tx = world.x;
      let ty = world.y;
      if (ev.shiftKey && this.app.scene.settings.snapToAngle) {
        const dx = tx - conn.x;
        const dy = ty - conn.y;
        const dist = Math.hypot(dx, dy);
        const snapped = snapAngle(Math.atan2(dy, dx), 15);
        tx = conn.x + dist * Math.cos(snapped);
        ty = conn.y + dist * Math.sin(snapped);
      }
      conn.x2 = tx;
      conn.y2 = ty;
    }

    updateConnectorBindings(page, [conn.id]);
    this.app.requestRender();
  }

  onPointerUp() {
    if (!this.activeConnector) return;
    const conn = this.activeConnector;
    const fromPort = this.startedFromPort;
    this.activeConnector = null;
    this.startedFromPort = null;
    this.app.connectorPreview = null;
    const page = this.app.getPage();

    if (fromPort && !conn.endBinding && Math.hypot(conn.x2 - conn.x, conn.y2 - conn.y) >= 36) {
      const srcEl = fromPort.element;
      const w = srcEl?.w || 140;
      const h = srcEl?.h || 84;
      const oppositeMap = { right: 'left', left: 'right', bottom: 'top', top: 'bottom' };
      const targetPort = oppositeMap[fromPort.port] || 'left';
      let nx = conn.x2;
      let ny = conn.y2;
      if (targetPort === 'left') ny -= h / 2;
      else if (targetPort === 'right') { nx -= w; ny -= h / 2; }
      else if (targetPort === 'top') nx -= w / 2;
      else if (targetPort === 'bottom') { nx -= w / 2; ny -= h; }

      const newNode = createElement(
        srcEl && ['rect', 'rounded-rect', 'ellipse', 'diamond'].includes(srcEl.type)
          ? srcEl.type
          : 'rounded-rect',
        {
          x: Math.round(nx),
          y: Math.round(ny),
          w,
          h,
          stroke: srcEl?.stroke || this.app.currentStyle.stroke,
          fill: srcEl?.fill || this.app.currentStyle.fill,
          roundness: srcEl?.roundness ?? 14,
          text: 'Next Step',
        }
      );
      page.elements.push(newNode);
      bindConnectorEndpoint(conn, 'end', newNode, targetPort);
      updateConnectorBindings(page, [newNode.id, conn.id]);
      this.app.selectedIds = new Set([newNode.id]);
      this.app.commitChange();
      this.app.updateUI();
      this.app.requestRender();
      return;
    }

    if (Math.hypot(conn.x2 - conn.x, conn.y2 - conn.y) < 8 && !conn.endBinding) {
      conn.x2 = conn.x + 140;
      conn.y2 = conn.y;
    }

    updateConnectorBindings(page, [conn.id]);
    this.app.commitChange();

    if (!this.app.toolLock && this.app.activeTool !== 'select') {
      this.app.setTool('select');
    }
    this.app.updateUI();
    this.app.requestRender();
  }
}
