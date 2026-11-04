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

describe('AWS templates teach AWS', () => {
  // A lesson titled "AWS observability" must not show a LOKI or GRAFANA badge
  // next to a node labelled CloudWatch — the artwork contradicts the label.
  test('no AWS template dresses an AWS service in third-party observability art', () => {
    for (const tpl of AWS_TEMPLATES) {
      const thirdParty = tpl.build().filter((el) => el.type === 'stencil' && /^obs-/.test(el.stencilId));
      assert.deepEqual(thirdParty.map((el) => `${el.stencilId} (${el.text})`), [], `${tpl.id}`);
    }
  });

  test('the observability template uses the AWS tracing icon', () => {
    const built = getTemplateById('tpl-aws-08-observability').build();
    const xray = built.find((el) => /X-Ray/.test(el.text || ''));
    assert.ok(xray, 'no X-Ray node');
    assert.equal(xray.stencilId, 'aws-xray');
  });

  // The reference-architecture research surfaced two operator-level risks that
  // the diagrams cannot show. They live in the teaching notes, so this pins
  // them against a well-meaning trim.
  test('teaching notes name the dead-letter and replication traps', () => {
    const notes = (id) =>
      getTemplateById(id).build().find((e) => e.type === 'frame').teacherNotes;
    assert.match(notes('tpl-aws-06-messaging'), /dead-letter/i);
    assert.match(notes('tpl-aws-06-messaging'), /silently lost/i);
    assert.match(notes('tpl-aws-10-recovery'), /not backup/i);
  });
});

describe('Services the reference-architecture ranking found missing', () => {
  // Added after the 2026-11-03 icon research. Without this test a renamed or
  // deleted stencil would leave the ranking silently unsatisfied again.
  const REQUIRED = [
    'aws-privatelink',
    'aws-xray',
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
