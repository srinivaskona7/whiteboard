// tools/math-tools.js
import { createElement } from '../scene/model.js';

export function insertMathHelper(app, kind = 'ruler') {
  const page = app.getPage();
  const centerWorld = app.getViewportCenterWorld();

  if (kind === 'axes' || kind === 'number-line') {
    const stencilId = kind === 'axes' ? 'math-axes' : 'math-number-line';
    const w = kind === 'axes' ? 320 : 420;
    const h = kind === 'axes' ? 320 : 80;
    const el = createElement('stencil', {
      stencilId,
      category: 'Math & Science',
      x: Math.round(centerWorld.x - w / 2),
      y: Math.round(centerWorld.y - h / 2),
      w,
      h,
      text: '',
    });
    page.elements.push(el);
    app.selectedIds = new Set([el.id]);
    app.commitChange();
    app.setTool('select');
    app.updateUI();
    app.requestRender();
    return el;
  }

  const w = kind === 'ruler' ? 380 : 260;
  const h = kind === 'ruler' ? 64 : 140;
  const el = createElement('math', {
    mathKind: kind,
    name: kind === 'ruler' ? 'Ruler Overlay' : 'Protractor Overlay',
    x: Math.round(centerWorld.x - w / 2),
    y: Math.round(centerWorld.y - h / 2),
    w,
    h,
  });
  page.elements.push(el);
  app.selectedIds = new Set([el.id]);
  app.commitChange();
  app.setTool('select');
  app.updateUI();
  app.requestRender();
  return el;
}
