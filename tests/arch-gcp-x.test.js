// tests/arch-gcp-x.test.js — the extra GCP pack matches the AWS pack's guarantees.
// Registration in BUILTIN_TEMPLATES happens in templates/index.js later; these
// tests import the pack directly so the pack can land independently.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_GCP_X_TEMPLATES } from '../templates/arch-gcp-x.js';
import { ALL_STENCILS } from '../stencils/index.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));

describe('GCP extra teaching templates', () => {
  test('ten templates with unique ids under tpl-gcpx-', () => {
    assert.equal(ARCH_GCP_X_TEMPLATES.length, 10);
    const ids = ARCH_GCP_X_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 10);
    for (const id of ids) assert.match(id, /^tpl-gcpx-/);
  });

  test('each diagram is native, editable and has 6-14 components', () => {
    for (const tpl of ARCH_GCP_X_TEMPLATES) {
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

  test('every template names GCP and carries teaching notes', () => {
    for (const tpl of ARCH_GCP_X_TEMPLATES) {
      assert.equal(tpl.provider, 'GCP');
      assert.equal(tpl.category, 'multicloud');
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 80, `${tpl.id} lacks teaching notes`);
      assert.ok(frame.text, `${tpl.id} has no frame title`);
    }
  });

  test('every built element carries the template id so configuration can adopt it', () => {
    for (const tpl of ARCH_GCP_X_TEMPLATES) {
      const built = tpl.build();
      assert.ok(
        built.every((el) => el.templateId === tpl.id),
        `${tpl.id} has an element without templateId`
      );
    }
  });

  test('the diagrams use GCP services, not another provider', () => {
    for (const tpl of ARCH_GCP_X_TEMPLATES) {
      const stencils = tpl.build().filter((e) => e.type === 'stencil');
      const providerStencils = stencils.filter((e) => /^(aws|az|gcp)-/.test(e.stencilId));
      assert.ok(providerStencils.length > 0, `${tpl.id} has no provider service`);
      for (const el of providerStencils) {
        assert.match(el.stencilId, /^gcp-/, `${tpl.id} mixes in ${el.stencilId}`);
      }
    }
  });
});
