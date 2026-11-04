// tests/arch-hybrid.test.js — the cross-cloud pack matches the AWS pack's guarantees.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_HYBRID_TEMPLATES } from '../templates/arch-hybrid.js';
import { ALL_STENCILS } from '../stencils/index.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));

const EXPECTED_IDS = [
  'tpl-hyb-multicloud-dr',
  'tpl-hyb-landing-zone',
  'tpl-hyb-identity-federation',
  'tpl-hyb-data-replication',
  'tpl-hyb-service-mesh',
  'tpl-hyb-gitops-multicluster',
  'tpl-hyb-edge-computing',
  'tpl-hyb-network-migration',
  'tpl-hyb-cost-observability',
  'tpl-hyb-zero-trust-perimeter',
];

const providersOf = (stencils) =>
  new Set(stencils.map((e) => e.stencilId.match(/^(aws|az|gcp)-/)?.[1]).filter(Boolean));

describe('Hybrid cross-cloud teaching templates', () => {
  test('ten hybrid templates with unique ids under tpl-hyb-', () => {
    assert.equal(ARCH_HYBRID_TEMPLATES.length, 10);
    const ids = ARCH_HYBRID_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 10);
    for (const id of ids) assert.match(id, /^tpl-hyb-/);
    assert.deepEqual(ids, EXPECTED_IDS);
  });

  test('each diagram is native, editable and has 6-14 components', () => {
    for (const tpl of ARCH_HYBRID_TEMPLATES) {
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

  test('every arrow carries a label so the lesson can be read off the diagram', () => {
    for (const tpl of ARCH_HYBRID_TEMPLATES) {
      const arrows = tpl.build().filter((e) => e.type === 'arrow');
      assert.ok(arrows.length > 0, `${tpl.id} has no arrows`);
      for (const arrow of arrows) {
        assert.ok(arrow.text, `${tpl.id} has an unlabelled arrow`);
      }
    }
  });

  test('every template is Cross-cloud and carries teaching notes', () => {
    for (const tpl of ARCH_HYBRID_TEMPLATES) {
      assert.equal(tpl.provider, 'Cross-cloud');
      assert.equal(tpl.category, 'multicloud');
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 80, `${tpl.id} lacks teaching notes`);
      assert.ok(frame.text, `${tpl.id} has no frame title`);
    }
  });

  test('template elements carry the template id so configuration can adopt them', () => {
    for (const tpl of ARCH_HYBRID_TEMPLATES) {
      const built = tpl.build();
      assert.ok(
        built.every((el) => el.templateId === tpl.id),
        `${tpl.id} has an element without templateId`
      );
    }
  });

  test('each diagram spans at least two clouds or a cloud plus flow stencils', () => {
    for (const tpl of ARCH_HYBRID_TEMPLATES) {
      const stencils = tpl.build().filter((e) => e.type === 'stencil');
      const providers = providersOf(stencils);
      const hasFlow = stencils.some((e) => /^flow-/.test(e.stencilId));
      assert.ok(
        providers.size >= 2 || (providers.size >= 1 && hasFlow),
        `${tpl.id} is not cross-cloud (${[...providers].join(',') || 'no provider stencils'})`
      );
    }
  });
});
