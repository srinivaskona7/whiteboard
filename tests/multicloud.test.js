// tests/multicloud.test.js — Azure/GCP teaching templates stay native, editable and complete.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_TEMPLATES, getTemplateById } from '../templates/index.js';
import { AZURE_GCP_TEMPLATES } from '../templates/azure-gcp.js';
import { ALL_STENCILS } from '../stencils/index.js';
import { DEVOPS_CLOUD_STENCILS } from '../stencils/devops-cloud.js';

const stencilIds = new Set(ALL_STENCILS.map((s) => s.id));

describe('Multicloud teaching templates', () => {
  test('twenty Azure and GCP templates are registered with unique ids', () => {
    assert.equal(AZURE_GCP_TEMPLATES.length, 20);
    const ids = AZURE_GCP_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 20);
    const registered = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    for (const id of ids) assert.ok(registered.has(id), `${id} not in BUILTIN_TEMPLATES`);
  });

  test('each diagram is native, editable and has 6-14 components', () => {
    for (const tpl of AZURE_GCP_TEMPLATES) {
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

  test('every template carries a teaching sentence and provider label', () => {
    for (const tpl of AZURE_GCP_TEMPLATES) {
      assert.ok(tpl.provider === 'Azure' || tpl.provider === 'GCP');
      assert.ok(tpl.description.length > 30, `${tpl.id} description too thin`);
      const frame = tpl.build().find((e) => e.type === 'frame');
      assert.ok((frame.teacherNotes || '').length > 40, `${tpl.id} lacks teaching notes`);
    }
  });

  test('provider stencils cover the services the templates use', () => {
    assert.ok(DEVOPS_CLOUD_STENCILS.length >= 58);
    const required = ['az-appservice', 'az-containerapps', 'az-servicebus', 'az-eventgrid', 'az-devops',
      'az-firewall', 'az-dns', 'az-acr', 'az-backup', 'gcp-pubsub', 'gcp-eventarc', 'gcp-build',
      'gcp-artifact', 'gcp-router', 'gcp-interconnect', 'gcp-dns', 'gcp-dataflow', 'gcp-monitoring',
      'gcp-secret'];
    const ids = new Set(DEVOPS_CLOUD_STENCILS.map((s) => s.id));
    for (const id of required) assert.ok(ids.has(id), `missing stencil ${id}`);
  });
});
