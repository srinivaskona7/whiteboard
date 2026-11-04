// tests/arch-data.test.js — the Data & AI pack matches the AWS pack's guarantees.
// Imports the pack directly: central registration in templates/index.js happens
// after all parallel packs land, so this suite must not depend on it.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_DATA_TEMPLATES } from '../templates/arch-data.js';
import { ALL_STENCILS } from '../stencils/index.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));

describe('Data & AI teaching templates', () => {
  test('ten templates are provided with unique ids under tpl-data-', () => {
    assert.equal(ARCH_DATA_TEMPLATES.length, 10);
    const ids = ARCH_DATA_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 10);
    for (const id of ids) assert.match(id, /^tpl-data-/);
  });

  test('each diagram is native, editable and has 6-14 components', () => {
    for (const tpl of ARCH_DATA_TEMPLATES) {
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

  test('every template carries provider, description and teaching notes', () => {
    for (const tpl of ARCH_DATA_TEMPLATES) {
      assert.equal(tpl.provider, 'Data & AI');
      assert.equal(tpl.category, 'multicloud');
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 80, `${tpl.id} lacks teaching notes`);
      assert.ok(frame.text, `${tpl.id} has no frame title`);
      assert.match(frame.text, /^Lesson: /, `${tpl.id} frame is not a lesson frame`);
    }
  });

  test('template elements carry the template id so configuration can adopt them', () => {
    for (const tpl of ARCH_DATA_TEMPLATES) {
      const built = tpl.build();
      assert.ok(
        built.every((el) => el.templateId === tpl.id),
        `${tpl.id} has an element without templateId`
      );
    }
  });

  test('connectors are labelled and endpoints are bound to real components', () => {
    for (const tpl of ARCH_DATA_TEMPLATES) {
      const built = tpl.build();
      const nodeIds = new Set(built.filter((e) => e.type === 'stencil').map((e) => e.id));
      const arrows = built.filter((e) => e.type === 'arrow');
      assert.ok(arrows.length >= 5, `${tpl.id} has too few connectors`);
      for (const arrow of arrows) {
        assert.ok(arrow.text, `${tpl.id} has an unlabelled connector`);
        for (const key of ['startBinding', 'endBinding']) {
          const target = arrow[key]?.elementId;
          assert.ok(target && nodeIds.has(target), `${tpl.id} has a loose connector end`);
        }
      }
    }
  });
});
