// tests/arch-k8s.test.js — the Kubernetes internals pack matches the AWS pack's guarantees.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_K8S_TEMPLATES } from '../templates/arch-k8s.js';
import { ALL_STENCILS } from '../stencils/index.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));

describe('Kubernetes teaching templates', () => {
  test('ten Kubernetes templates with unique ids under tpl-k8s-', () => {
    assert.equal(ARCH_K8S_TEMPLATES.length, 10);
    const ids = ARCH_K8S_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 10);
    for (const id of ids) assert.match(id, /^tpl-k8s-/);
  });

  test('each diagram is native, editable and has 6-14 components', () => {
    for (const tpl of ARCH_K8S_TEMPLATES) {
      const built = tpl.build();
      const components = built.filter((e) => e.type === 'stencil');
      assert.ok(components.length >= 6 && components.length <= 14, `${tpl.id}: ${components.length}`);
      assert.ok(built.some((e) => e.type === 'arrow'), `${tpl.id} has no connectors`);
      assert.ok(built.some((e) => e.type === 'frame'), `${tpl.id} has no frame`);
      for (const el of components) {
        assert.ok(stencilIds.has(el.stencilId), `${tpl.id} uses unknown stencil ${el.stencilId}`);
        assert.ok(el.text, `${tpl.id} has an unlabelled component`);
      }
      // Connectors must be bound to real elements, not floating.
      for (const el of built.filter((e) => e.type === 'arrow')) {
        assert.ok(el.startBinding && el.startBinding.elementId, `${tpl.id} has an arrow without a start binding`);
        assert.ok(el.endBinding && el.endBinding.elementId, `${tpl.id} has an arrow without an end binding`);
        assert.ok(el.text, `${tpl.id} has an unlabelled arrow`);
      }
    }
  });

  test('every template is a Kubernetes multicloud lesson with teaching notes', () => {
    for (const tpl of ARCH_K8S_TEMPLATES) {
      assert.equal(tpl.provider, 'Kubernetes');
      assert.equal(tpl.category, 'multicloud');
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 80, `${tpl.id} lacks teaching notes`);
      assert.ok(frame.text, `${tpl.id} has no frame title`);
    }
  });

  test('template elements carry the template id so configuration can adopt them', () => {
    for (const tpl of ARCH_K8S_TEMPLATES) {
      const built = tpl.build();
      assert.ok(
        built.every((el) => el.templateId === tpl.id),
        `${tpl.id} has an element without templateId`
      );
    }
  });

  test('the diagrams teach Kubernetes internals, not another provider', () => {
    for (const tpl of ARCH_K8S_TEMPLATES) {
      const stencils = tpl.build().filter((e) => e.type === 'stencil');
      const providerStencils = stencils.filter((e) => /^(aws|az|gcp)-/.test(e.stencilId));
      assert.equal(providerStencils.length, 0, `${tpl.id} mixes in ${providerStencils[0] && providerStencils[0].stencilId}`);
      const k8sStencils = stencils.filter((e) => /^(k8s|bnd-k8s|net-|docker-)/.test(e.stencilId));
      assert.ok(k8sStencils.length > 0, `${tpl.id} has no container-ecosystem stencil`);
    }
  });
});
