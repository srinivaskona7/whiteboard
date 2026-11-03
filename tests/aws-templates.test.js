// tests/aws-templates.test.js — the AWS pack matches the Azure/GCP pack's guarantees.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_TEMPLATES, getTemplateById } from '../templates/index.js';
import { AWS_TEMPLATES } from '../templates/aws.js';
import { ALL_STENCILS } from '../stencils/index.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));

describe('AWS teaching templates', () => {
  test('ten AWS templates are registered with unique ids under tpl-aws-', () => {
    assert.equal(AWS_TEMPLATES.length, 10);
    const ids = AWS_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 10);
    for (const id of ids) assert.match(id, /^tpl-aws-/);
    const registered = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    for (const id of ids) assert.ok(registered.has(id), `${id} not in BUILTIN_TEMPLATES`);
  });

  test('each diagram is native, editable and has 6-14 components', () => {
    for (const tpl of AWS_TEMPLATES) {
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

  test('every template names AWS and carries teaching notes', () => {
    for (const tpl of AWS_TEMPLATES) {
      assert.equal(tpl.provider, 'AWS');
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 80, `${tpl.id} lacks teaching notes`);
      assert.ok(frame.text, `${tpl.id} has no frame title`);
    }
  });

  test('template elements carry the template id so configuration can adopt them', () => {
    for (const tpl of AWS_TEMPLATES) {
      const built = tpl.build();
      assert.ok(
        built.every((el) => el.templateId === tpl.id),
        `${tpl.id} has an element without templateId`
      );
    }
  });

  test('the AWS diagrams use AWS services, not another provider', () => {    for (const tpl of AWS_TEMPLATES) {
      const stencils = tpl.build().filter((e) => e.type === 'stencil');
      const providerStencils = stencils.filter((e) => /^(aws|az|gcp)-/.test(e.stencilId));
      assert.ok(providerStencils.length > 0, `${tpl.id} has no provider service`);
      for (const el of providerStencils) {
        assert.match(el.stencilId, /^aws-/, `${tpl.id} mixes in ${el.stencilId}`);
      }
    }
  });
});

describe('Services the reference-architecture ranking found missing', () => {
  // Added after the 2026-11-03 icon research. Without this test a renamed or
  // deleted stencil would leave the ranking silently unsatisfied again.
  const REQUIRED = [
    'aws-privatelink',
    'az-logicapps',
    'az-nat',
    'az-lb',
    'az-appinsights',
    'az-expressroute',
    'gcp-nat',
    'gcp-psc',
    'gcp-tasks',
    'gcp-logging',
    'gcp-vpn',
  ];

  test('all eleven researched services are registered', () => {
    const missing = REQUIRED.filter((id) => !stencilIds.has(id));
    assert.deepEqual(missing, []);
  });

  test('each carries provider art, a label and searchable keywords', () => {
    for (const id of REQUIRED) {
      const stencil = ALL_STENCILS.find((s) => s.id === id);
      assert.ok(stencil, id);
      assert.ok(stencil.svgBody && stencil.svgBody.length > 60, `${id} has no art`);
      assert.ok(stencil.defaultText, `${id} has no default label`);
      assert.ok(stencil.tags && stencil.tags.length > 10, `${id} is not searchable`);
    }
  });
});
