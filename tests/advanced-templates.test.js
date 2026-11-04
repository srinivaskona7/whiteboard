// tests/advanced-templates.test.js — the advanced pack matches the AWS and
// Azure/GCP packs' guarantees, and completes the 80-template catalog.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_TEMPLATES, getTemplateById } from '../templates/index.js';
import { ADVANCED_TEMPLATES } from '../templates/advanced.js';
import { ALL_STENCILS } from '../stencils/index.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));
const cloudTemplates = ADVANCED_TEMPLATES.filter((t) => t.provider);
const classroomTemplates = ADVANCED_TEMPLATES.filter((t) => !t.provider);

describe('Advanced teaching templates', () => {
  test('32 advanced templates are registered with unique ids under tpl-adv-', () => {
    assert.equal(ADVANCED_TEMPLATES.length, 32);
    assert.equal(cloudTemplates.length, 14);
    assert.equal(classroomTemplates.length, 18);
    const ids = ADVANCED_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 32);
    for (const id of ids) assert.match(id, /^tpl-adv-/);
    const registered = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    for (const id of ids) assert.ok(registered.has(id), `${id} not in BUILTIN_TEMPLATES`);
  });

  test('the built-in catalog includes the advanced pack and reaches 80 templates', () => {
    // The advanced pack took the catalog from 48 to exactly 80. Later arch-*
    // packs have since pushed the total further, so pin the floor and the
    // pack's own registration rather than the absolute catalog size.
    assert.ok(BUILTIN_TEMPLATES.length >= 80, `catalog is only ${BUILTIN_TEMPLATES.length}`);
    assert.ok(
      BUILTIN_TEMPLATES.length - ADVANCED_TEMPLATES.length >= 48,
      'the pre-existing 48-template catalog was dropped'
    );
  });

  test('each cloud diagram is native, editable and has 6-14 components', () => {
    for (const tpl of cloudTemplates) {
      const built = getTemplateById(tpl.id).build();
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

  test('every cloud diagram carries a lesson frame with real teaching notes', () => {
    for (const tpl of cloudTemplates) {
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 80, `${tpl.id} lacks teaching notes`);
      assert.ok(frame.text, `${tpl.id} has no frame title`);
      assert.ok(/Lesson:/.test(frame.text), `${tpl.id} frame title is not a lesson`);
    }
  });

  test('every built element of every advanced template carries the template id', () => {
    for (const tpl of ADVANCED_TEMPLATES) {
      const built = tpl.build();
      assert.ok(
        built.every((el) => el.templateId === tpl.id),
        `${tpl.id} has an element without templateId`
      );
    }
  });

  test('provider stencils match the declared provider', () => {
    const prefixByProvider = { AWS: /^aws-/, Azure: /^az-/, GCP: /^gcp-/ };
    for (const tpl of cloudTemplates) {
      const stencils = tpl.build().filter((e) => e.type === 'stencil');
      const providerStencils = stencils.filter((e) => /^(aws|az|gcp)-/.test(e.stencilId));
      assert.ok(providerStencils.length > 0, `${tpl.id} has no provider service`);
      const prefix = prefixByProvider[tpl.provider];
      if (!prefix) continue; // Cross-cloud templates may mix providers
      for (const el of providerStencils) {
        assert.match(el.stencilId, prefix, `${tpl.id} mixes in ${el.stencilId}`);
      }
    }
  });

  test('cloud templates declare a known provider', () => {
    const known = ['AWS', 'Azure', 'GCP', 'Cross-cloud'];
    for (const tpl of cloudTemplates) assert.ok(known.includes(tpl.provider), `${tpl.id}: ${tpl.provider}`);
  });

  test('classroom boards build non-empty with only known stencils', () => {
    for (const tpl of classroomTemplates) {
      const built = tpl.build();
      assert.ok(Array.isArray(built) && built.length >= 3, `${tpl.id} is too thin`);
      for (const el of built.filter((e) => e.type === 'stencil')) {
        assert.ok(stencilIds.has(el.stencilId), `${tpl.id} uses unknown stencil ${el.stencilId}`);
      }
    }
  });
});
