// tests/arch-obs.test.js — the observability pack matches the AWS pack's guarantees.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_OBS_TEMPLATES } from '../templates/arch-obs.js';
import { ALL_STENCILS } from '../stencils/index.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));

describe('Observability teaching templates', () => {
  test('ten observability templates with unique ids under tpl-obs-', () => {
    assert.equal(ARCH_OBS_TEMPLATES.length, 10);
    const ids = ARCH_OBS_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 10);
    for (const id of ids) assert.match(id, /^tpl-obs-/);
  });

  test('each diagram is native, editable and has 6-14 components', () => {
    for (const tpl of ARCH_OBS_TEMPLATES) {
      const built = tpl.build();
      const components = built.filter((e) => e.type === 'stencil');
      assert.ok(components.length >= 6 && components.length <= 14, `${tpl.id}: ${components.length}`);
      assert.ok(built.some((e) => e.type === 'arrow'), `${tpl.id} has no connectors`);
      assert.ok(built.some((e) => e.type === 'frame'), `${tpl.id} has no frame`);
      for (const el of components) {
        assert.ok(stencilIds.has(el.stencilId), `${tpl.id} uses unknown stencil ${el.stencilId}`);
        assert.ok(el.text, `${tpl.id} has an unlabelled component`);
      }
    }
  });

  test('every template carries real teaching notes and a frame title', () => {
    for (const tpl of ARCH_OBS_TEMPLATES) {
      assert.equal(tpl.category, 'multicloud');
      assert.equal(tpl.provider, 'Observability');
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 80, `${tpl.id} lacks teaching notes`);
      assert.ok(frame.text, `${tpl.id} has no frame title`);
    }
  });

  test('template elements carry the template id so configuration can adopt them', () => {
    for (const tpl of ARCH_OBS_TEMPLATES) {
      const built = tpl.build();
      assert.ok(
        built.every((el) => el.templateId === tpl.id),
        `${tpl.id} has an element without templateId`
      );
    }
  });
});
