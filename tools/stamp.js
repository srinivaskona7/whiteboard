// tools/stamp.js
import { createElement } from '../scene/model.js';

export class StampTool {
  constructor(app) {
    this.app = app;
    this.stampKind = 'tick'; // 'tick' | 'cross' | 'star' | 'question' | 'arrow-up' | 'badge'
    this.badgeValue = 1;
  }

  onPointerDown(world) {
    const page = this.app.getPage();
    const el = createElement('stamp', {
      x: world.x - 28,
      y: world.y - 28,
      w: 56,
      h: 56,
      stampKind: this.stampKind,
      badgeValue: this.badgeValue,
    });
    page.elements.push(el);
    this.app.selectedIds = new Set([el.id]);

    if (this.stampKind === 'badge') {
      this.badgeValue = (this.badgeValue % 9) + 1;
    }

    this.app.commitChange();
    this.app.updateUI();
    this.app.requestRender();
  }

  onPointerMove() {}
  onPointerUp() {}
}
