// tests/arch-aws-x.test.js — the extra AWS pack (ARCH_AWS_X_TEMPLATES) keeps the
// same guarantees as the base AWS pack, without requiring central registration.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_AWS_X_TEMPLATES } from '../templates/arch-aws-x.js';
import { ALL_STENCILS } from '../stencils/index.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));

describe('AWS X teaching templates', () => {
  test('ten templates with unique ids under tpl-awsx-', () => {
    assert.equal(ARCH_AWS_X_TEMPLATES.length, 10);
    const ids = ARCH_AWS_X_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 10);
    for (const id of ids) assert.match(id, /^tpl-awsx-/);
  });

  test('each diagram is native, editable and has 6-14 components', () => {
    for (const tpl of ARCH_AWS_X_TEMPLATES) {
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

  test('every template names AWS and carries teaching notes', () => {
    for (const tpl of ARCH_AWS_X_TEMPLATES) {
      assert.equal(tpl.provider, 'AWS');
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 80, `${tpl.id} lacks teaching notes`);
      assert.ok(frame.text, `${tpl.id} has no frame title`);
    }
  });

  test('template elements carry the template id so configuration can adopt them', () => {
    for (const tpl of ARCH_AWS_X_TEMPLATES) {
      const built = tpl.build();
      assert.ok(
        built.every((el) => el.templateId === tpl.id),
        `${tpl.id} has an element without templateId`
      );
    }
  });

  test('the AWS X diagrams use AWS services, not another provider', () => {
    for (const tpl of ARCH_AWS_X_TEMPLATES) {
      const stencils = tpl.build().filter((e) => e.type === 'stencil');
      const providerStencils = stencils.filter((e) => /^(aws|az|gcp)-/.test(e.stencilId));
      assert.ok(providerStencils.length > 0, `${tpl.id} has no provider service`);
      for (const el of providerStencils) {
        assert.match(el.stencilId, /^aws-/, `${tpl.id} mixes in ${el.stencilId}`);
      }
    }
  });
});
