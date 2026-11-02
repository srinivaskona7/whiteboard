// tools/laser.js — Ephemeral Laser Trail Tool with Unified Clock & Prune Contract

export const LASER_LIFETIME_MS = 1200;

export class LaserTool {
  constructor(app, options = {}) {
    this.app = app;
    this.lifetimeMs = Number(options.lifetimeMs) > 0 ? Number(options.lifetimeMs) : LASER_LIFETIME_MS;
    this.isDown = false;
    this.trail = [];
  }

  onPointerDown(world, evOrNow, now = Date.now()) {
    if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
    const ts = typeof evOrNow === 'number' ? evOrNow : now;
    this.isDown = true;
    this.prune(ts);
    this.trail.push({ x: world.x, y: world.y, t: ts });
    this.app?.requestRender?.();
  }

  onPointerMove(world, evOrNow, now = Date.now()) {
    if (!this.isDown) return;
    if (!world || !Number.isFinite(world.x) || !Number.isFinite(world.y)) return;
    const ts = typeof evOrNow === 'number' ? evOrNow : now;
    this.prune(ts);
    this.trail.push({ x: world.x, y: world.y, t: ts });
    this.app?.requestRender?.();
  }

  onPointerUp(worldOrNow, evOrNow, now = Date.now()) {
    const ts =
      typeof worldOrNow === 'number'
        ? worldOrNow
        : typeof evOrNow === 'number'
          ? evOrNow
          : now;
    this.isDown = false;
    this.prune(ts);
    this.app?.requestRender?.();
  }

  prune(now = Date.now()) {
    const cutoff = now - this.lifetimeMs;
    if (this.trail.length > 0) {
      this.trail = this.trail.filter(
        (pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y) && now - pt.t < this.lifetimeMs && pt.t > cutoff
      );
    }
    return this.trail;
  }

  getActiveTrail(now = Date.now()) {
    return this.prune(now);
  }

  hasActiveTrail(now = Date.now()) {
    return Boolean(this.isDown || this.prune(now).length > 0);
  }

  cancel() {
    this.isDown = false;
    this.trail = [];
  }
}
