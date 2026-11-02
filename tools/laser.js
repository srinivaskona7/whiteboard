// tools/laser.js

export class LaserTool {
  constructor(app) {
    this.app = app;
    this.isDown = false;
    this.trail = [];
    this.rafId = null;
  }

  onPointerDown(world) {
    this.isDown = true;
    this.trail.push({ x: world.x, y: world.y, t: Date.now() });
    this.startCleanupLoop();
    this.app.requestRender();
  }

  onPointerMove(world) {
    if (!this.isDown) return;
    this.trail.push({ x: world.x, y: world.y, t: Date.now() });
    this.startCleanupLoop();
    this.app.requestRender();
  }

  onPointerUp() {
    this.isDown = false;
  }

  startCleanupLoop() {
    if (this.rafId) return;
    const tick = () => {
      const now = Date.now();
      this.trail = this.trail.filter((pt) => now - pt.t < 900);
      this.app.requestRender();
      if (this.trail.length > 0 || this.isDown) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
