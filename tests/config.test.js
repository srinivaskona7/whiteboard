// tests/config.test.js — typed diagram configuration with atomic, id-preserving updates.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG_PATTERNS,
  getConfigPattern,
  defaultValues,
  validateValues,
  applyArchitectureConfig,
} from '../scene/architecture-config.js';
import { createScene, createElement } from '../scene/model.js';
import { getTemplateById } from '../templates/index.js';
import { serializeScene, parseSceneJson } from '../scene/storage.js';
import { HistoryManager } from '../scene/history.js';

const pattern = getConfigPattern('azure-three-tier');
const pageWith = () => {
  const scene = createScene();
  return scene.pages[0];
};

describe('Diagram configuration', () => {
  test('every pattern exposes typed parameters with defaults', () => {
    assert.ok(CONFIG_PATTERNS.length >= 4);
    for (const p of CONFIG_PATTERNS) {
      const values = defaultValues(p);
      for (const param of p.params) {
        assert.ok(['select', 'number', 'boolean', 'text'].includes(param.type), param.id);
        assert.equal(typeof values[param.id], param.type === 'number' ? 'number' : param.type === 'boolean' ? 'boolean' : 'string');
      }
      assert.deepEqual(validateValues(p, values).errors, {});
    }
  });

  test('invalid combinations are blocked with a field-level message', () => {
    const values = defaultValues(pattern);
    values.replicas = 1;
    const result = validateValues(pattern, values);
    assert.equal(result.ok, false);
    assert.match(result.errors.replicas, /at least 2/);

    values.replicas = 2;
    values.port = 70000;
    assert.match(validateValues(pattern, values).errors.port, /65535/);

    values.port = '443';
    values.connectivity = 'private-endpoint';
    values.environment = 'dev';
    assert.match(validateValues(pattern, values).errors.connectivity, /dev/);
  });

  test('applying is atomic and preserves ids across a second apply', () => {
    const page = pageWith();
    applyArchitectureConfig(page, pattern, defaultValues(pattern));
    const firstIds = page.elements.map((e) => e.id);
    assert.ok(firstIds.length >= 8);
    assert.equal(new Set(firstIds).size, firstIds.length);

    applyArchitectureConfig(page, pattern, defaultValues(pattern));
    assert.deepEqual(page.elements.map((e) => e.id).sort(), firstIds.sort());
  });

  test('manual positions survive reconfiguration unless a full relayout is requested', () => {
    const page = pageWith();
    applyArchitectureConfig(page, pattern, defaultValues(pattern));
    const app = page.elements.find((e) => e.configKey === 'app');
    app.x = 1234;
    app.y = 567;
    const values = defaultValues(pattern);
    values.replicas = 3;
    applyArchitectureConfig(page, pattern, values);
    const after = page.elements.find((e) => e.configKey === 'app');
    assert.equal(after.x, 1234);
    assert.equal(after.y, 567);
    assert.match(after.text, /3/);

    applyArchitectureConfig(page, pattern, values, { relayout: 'full' });
    const relaid = page.elements.find((e) => e.configKey === 'app');
    assert.notEqual(relaid.x, 1234);
  });

  test('optional services add and remove their nodes and edges cleanly', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    applyArchitectureConfig(page, pattern, values);
    const baseCount = page.elements.length;

    values.queue = true;
    values.cache = true;
    applyArchitectureConfig(page, pattern, values);
    assert.ok(page.elements.length > baseCount);
    assert.ok(page.elements.some((e) => e.configKey === 'queue'));
    assert.ok(page.elements.some((e) => e.configEdge === 'app->queue'));

    values.queue = false;
    values.cache = false;
    applyArchitectureConfig(page, pattern, values);
    assert.equal(page.elements.length, baseCount);
    assert.ok(!page.elements.some((e) => e.configKey === 'queue'));
    assert.ok(!page.elements.some((e) => e.configEdge === 'app->queue'));
  });

  test('different patterns do not overwrite each other', () => {
    const page = pageWith();
    applyArchitectureConfig(page, pattern, defaultValues(pattern));
    const aks = getConfigPattern('azure-aks');
    applyArchitectureConfig(page, aks, defaultValues(aks));
    assert.ok(page.elements.some((e) => e.configPattern === 'azure-three-tier'));
    assert.ok(page.elements.some((e) => e.configPattern === 'azure-aks'));
  });
});

describe('Configuration parameters take effect', () => {
  test('CIDR is validated before the page is touched', () => {
    const values = defaultValues(pattern);
    for (const bad of ['10.0.0.0/8', '300.1.1.1/16', 'not-a-cidr', '']) {
      values.cidr = bad;
      assert.match(validateValues(pattern, values).errors.cidr, /CIDR/, bad);
    }
    values.cidr = '10.20.0.0/20';
    assert.deepEqual(validateValues(pattern, values).errors, {});
  });

  test('the CIDR appears on the board boundary and private data path', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.cidr = '10.42.0.0/16';
    values.connectivity = 'private-endpoint';
    applyArchitectureConfig(page, pattern, values);
    assert.ok(page.elements.some((e) => /10\.42\.0\.0\/16/.test(e.text || '')));
    const dataEdge = page.elements.find((e) => e.configEdge && /->data$/.test(e.configEdge));
    assert.match(dataEdge.label || dataEdge.text || '', /1433 private/);
  });

  test('public connectivity is not drawn as the private path', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.connectivity = 'public';
    applyArchitectureConfig(page, pattern, values);
    const dataEdge = page.elements.find((e) => e.configEdge && /->data$/.test(e.configEdge));
    assert.match(dataEdge.label || dataEdge.text || '', /1433 public/);
  });

  test('detail: internals adds teaching nodes and removes them cleanly', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    applyArchitectureConfig(page, pattern, values);
    const base = page.elements.length;

    values.detail = 'internals';
    applyArchitectureConfig(page, pattern, values);
    assert.ok(page.elements.length > base);
    assert.ok(page.elements.some((e) => e.configKey === 'internals-socket'));
    assert.ok(page.elements.some((e) => e.configEdge === 'app->internals-process'));

    values.detail = 'overview';
    applyArchitectureConfig(page, pattern, values);
    assert.equal(page.elements.length, base);
    assert.ok(!page.elements.some((e) => e.configKey === 'internals-socket'));
  });

  test('variant: high-availability adds a second instance for the host node', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.replicas = 2;
    applyArchitectureConfig(page, pattern, values);
    const standard = page.elements.length;

    values.variant = 'high-availability';
    applyArchitectureConfig(page, pattern, values);
    assert.ok(page.elements.length > standard);
    const zone2 = page.elements.find((e) => /-z2$/.test(e.configKey || ''));
    assert.ok(zone2, 'no second zone node');
    const link = page.elements.find((e) => e.configEdge && e.configEdge.includes(zone2.configKey));
    assert.ok(link, 'second zone is not connected');
    assert.match(link.text || '', /zone-redundant/);
  });

  test('showExplanation writes and removes a teaching text block', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.showExplanation = true;
    applyArchitectureConfig(page, pattern, values);
    const explanation = page.elements.find((e) => e.configExplanation);
    assert.ok(explanation, 'no explanation element');
    assert.match(explanation.text, /10\.0\.0\.0\/16/);

    values.showExplanation = false;
    applyArchitectureConfig(page, pattern, values);
    assert.ok(!page.elements.some((e) => e.configExplanation));
  });

  test('relayout: group restores the configured nodes but leaves foreign objects alone', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    applyArchitectureConfig(page, pattern, values);
    const foreign = createElement('text', { x: 5000, y: 5000, text: 'my note' });
    page.elements.push(foreign);
    const app = page.elements.find((e) => e.configKey === 'app');
    app.x = 1234;

    applyArchitectureConfig(page, pattern, values, { relayout: 'group' });
    assert.notEqual(page.elements.find((e) => e.configKey === 'app').x, 1234);
    assert.deepEqual([foreign.x, foreign.y], [5000, 5000]);
  });

  test('applying a configuration to its own template adopts instead of duplicating', () => {
    const page = pageWith();
    const template = getTemplateById('tpl-az-01-three-tier-vm');
    page.elements = template.build();
    const built = page.elements.filter((e) => e.type === 'stencil').length;

    const res = applyArchitectureConfig(page, pattern, defaultValues(pattern));
    assert.equal(res.ok, true);
    assert.ok(res.adopted > 0, 'nothing was adopted');
    const after = page.elements.filter((e) => e.type === 'stencil').length;
    assert.ok(after < built * 2, `duplicated the diagram: ${built} -> ${after}`);
  });
  test('applied settings are stored on the page so the drawer can reopen with them', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.detail = 'internals';
    values.variant = 'high-availability';
    values.cidr = '10.42.0.0/16';
    applyArchitectureConfig(page, pattern, values);
    assert.equal(page.architectureConfigs[pattern.id].detail, 'internals');

    // The values must survive a save/reload round trip.
    const scene = createScene();
    scene.pages[0] = page;
    const reloaded = parseSceneJson(serializeScene(scene));
    assert.equal(reloaded.pages[0].architectureConfigs[pattern.id].cidr, '10.42.0.0/16');
  });
  test('adoption never rewrites an unmatched template stencil', () => {
    const page = pageWith();
    page.elements = getTemplateById('tpl-az-01-three-tier-vm').build();
    const dns = page.elements.find((e) => /Azure DNS zone/.test(e.text || ''));
    applyArchitectureConfig(page, pattern, defaultValues(pattern));
    // The generated monitor node has no template counterpart: it must be added,
    // never substituted for the DNS zone.
    assert.equal(dns.stencilId, 'az-dns');
    assert.equal(dns.text, 'Azure DNS zone');
    assert.ok(page.elements.some((e) => e.stencilId === 'az-monitor'));
  });

  test('undo restores the stored configuration with the elements', () => {
    const page = pageWith();
    const history = new HistoryManager();
    const first = defaultValues(pattern);
    first.cidr = '10.1.0.0/16';
    applyArchitectureConfig(page, pattern, first);
    history.initPage(page);

    const second = defaultValues(pattern);
    second.cidr = '10.77.0.0/24';
    applyArchitectureConfig(page, pattern, second);
    history.commit(page);
    assert.equal(page.architectureConfigs[pattern.id].cidr, '10.77.0.0/24');

    history.undo(page);
    assert.equal(page.architectureConfigs[pattern.id].cidr, '10.1.0.0/16');
  });
});

describe('Configuration hardening', () => {
  test('invalid values are rejected before touching the page', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.replicas = 1;
    const res = applyArchitectureConfig(page, pattern, values);
    assert.equal(res.ok, false);
    assert.equal(page.elements.length, 0);
  });

  test('removing an optional node unbinds a user connector from it', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.cache = true;
    applyArchitectureConfig(page, pattern, values);
    const cache = page.elements.find((e) => e.configKey === 'cache');
    const userArrow = createElement('arrow', { x: 0, y: 0, x2: 10, y2: 10 });
    userArrow.startBinding = { elementId: cache.id, port: 'right' };
    page.elements.push(userArrow);
    values.cache = false;
    const res = applyArchitectureConfig(page, pattern, values);
    assert.equal(res.ok, true);
    assert.ok(res.removedIds.includes(cache.id));
    assert.equal(userArrow.startBinding, null);
    assert.ok(page.elements.includes(userArrow));
  });
});
