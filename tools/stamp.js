// tools/stamp.js
import { createElement } from '../scene/model.js';

// 'steps' is the numbered step bubble: a round accent bubble whose number
// auto-increments 1,2,3,… on every placement (unbounded, unlike 'badge' which
// cycles 1-9). The current number rides in `badgeValue` so it round-trips
// through storage and export with no extra field.
export const STAMP_KINDS = ['tick', 'cross', 'star', 'question', 'arrow-up', 'badge', 'steps'];

export class StampTool {
  constructor(app) {
    this.app = app;
    this.stampKind = 'tick'; // any of STAMP_KINDS
    this.badgeValue = 1;
    this.stepValue = 1;
  }

  // Kind selection from the Inspector. Picking the steps kind (again) restarts
  // the numbering at 1, the same way re-arming the tool starts a new sequence.
  selectKind(kind) {
    if (!STAMP_KINDS.includes(kind)) return;
    this.stampKind = kind;
    if (kind === 'steps') this.stepValue = 1;
  }

  resetSteps() {
    this.stepValue = 1;
  }

  onPointerDown(world) {
    const page = this.app.getPage();
    const el = createElement('stamp', {
      x: world.x - 28,
      y: world.y - 28,
      w: 56,
      h: 56,
      stampKind: this.stampKind,
      badgeValue: this.stampKind === 'steps' ? this.stepValue : this.badgeValue,
    });
    page.elements.push(el);
    this.app.selectedIds = new Set([el.id]);

    if (this.stampKind === 'badge') {
      this.badgeValue = (this.badgeValue % 9) + 1;
    } else if (this.stampKind === 'steps') {
      this.stepValue += 1;
    }

    this.app.commitChange();
    this.app.updateUI();
    this.app.requestRender();
  }

  onPointerMove() {}
  onPointerUp() {}
}
