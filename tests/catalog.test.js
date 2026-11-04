// tests/catalog.test.js — the catalog's size target is a requirement, so it is
// locked here: 150 templates, every pack registered, no duplicate ids.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_TEMPLATES } from '../templates/index.js';
import { ARCH_AWS_X_TEMPLATES } from '../templates/arch-aws-x.js';
import { ARCH_AZ_X_TEMPLATES } from '../templates/arch-az-x.js';
import { ARCH_GCP_X_TEMPLATES } from '../templates/arch-gcp-x.js';
import { ARCH_HYBRID_TEMPLATES } from '../templates/arch-hybrid.js';
import { ARCH_K8S_TEMPLATES } from '../templates/arch-k8s.js';
import { ARCH_OBS_TEMPLATES } from '../templates/arch-obs.js';
import { ARCH_DATA_TEMPLATES } from '../templates/arch-data.js';

const PACKS = [
  ARCH_AWS_X_TEMPLATES,
  ARCH_AZ_X_TEMPLATES,
  ARCH_GCP_X_TEMPLATES,
  ARCH_HYBRID_TEMPLATES,
  ARCH_K8S_TEMPLATES,
  ARCH_OBS_TEMPLATES,
  ARCH_DATA_TEMPLATES,
];

describe('Template catalog', () => {
  test('reaches the 150-template target with unique ids', () => {
    assert.equal(BUILTIN_TEMPLATES.length, 150);
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    assert.equal(new Set(ids).size, 150, 'duplicate template ids');
  });

  test('every architecture pack is registered in BUILTIN_TEMPLATES', () => {
    const registered = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    for (const pack of PACKS) {
      assert.equal(pack.length, 10, `${pack.length} templates in a 10-template pack`);
      for (const tpl of pack) {
        assert.ok(registered.has(tpl.id), `${tpl.id} not registered`);
      }
    }
  });

  test('every template can build without throwing', () => {
    for (const tpl of BUILTIN_TEMPLATES) {
      const built = tpl.build();
      assert.ok(Array.isArray(built), `${tpl.id} did not build an array`);
      // tpl-blank is the deliberate empty canvas; every other template
      // must produce elements.
      if (tpl.id === 'tpl-blank') continue;
      assert.ok(built.length > 0, `${tpl.id} built nothing`);
    }
  });
});
