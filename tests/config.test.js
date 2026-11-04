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
import { ALL_STENCILS } from '../stencils/index.js';
import { boundsOf, areaRatio, overlaps } from '../scene/layout-metrics.js';

const ALL_STENCIL_IDS = new Set(ALL_STENCILS.map((s) => s.id));
const AWS_REGIONS = ['eu-west-1', 'eu-central-1', 'us-east-1', 'us-west-2'];

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

  test('the explanation wraps and its box is sized to the wrapped text', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.showExplanation = true;
    applyArchitectureConfig(page, pattern, values);
    const explanation = page.elements.find((e) => e.configExplanation);
    const longest = Math.max(...explanation.text.split('\n').map((l) => l.length));
    assert.ok(longest <= 96, `line of ${longest} chars was not wrapped`);
    assert.ok(explanation.autoGrow, 'explanation is not auto-sized');
    // Text elements do not wrap when rendered, so the box must cover the text.
    assert.ok(explanation.w >= longest * 14 * 0.62, `box w=${explanation.w} clips the text`);
  });

  test('the explanation follows the group on relayout instead of staying behind', () => {
    const page = pageWith();
    const values = defaultValues(pattern);
    values.showExplanation = true;
    applyArchitectureConfig(page, pattern, values);
    const explanation = page.elements.find((e) => e.configExplanation);
    explanation.x = 9999;
    explanation.y = 9999;

    applyArchitectureConfig(page, pattern, values, { relayout: 'group' });
    const moved = page.elements.find((e) => e.configExplanation);
    assert.notEqual(moved.x, 9999, 'explanation kept its stale position');
    const groupBottom = Math.max(
      ...page.elements.filter((e) => e.configKey).map((e) => e.y + (e.h || 92))
    );
    assert.ok(moved.y >= groupBottom, 'explanation is not below the diagram');
  });

  test('a first application lands clear of unrelated board content', () => {
    const page = pageWith();
    const foreign = createElement('rect', { x: 0, y: 0, w: 600, h: 420, text: 'Existing lesson' });
    page.elements.push(foreign);

    const values = defaultValues(pattern);
    applyArchitectureConfig(page, pattern, values);
    const configured = page.elements.filter((e) => e.configKey);
    assert.ok(configured.length > 0);
    const overlaps = configured.filter(
      (el) =>
        el.x < foreign.x + foreign.w &&
        el.x + (el.w || 164) > foreign.x &&
        el.y < foreign.y + foreign.h &&
        el.y + (el.h || 92) > foreign.y
    );
    assert.equal(overlaps.length, 0, `${overlaps.length} configured nodes overlap existing content`);
    assert.deepEqual([foreign.x, foreign.y], [0, 0], 'existing content was moved instead of the new diagram');
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

describe('Additional cloud and delivery patterns', () => {
  const ids = ['aws-three-tier', 'aws-serverless', 'azure-multiregion', 'devops-platform'];

  test('all four patterns exist with typed defaults', () => {
    for (const id of ids) {
      const p = getConfigPattern(id);
      assert.ok(p, `${id} missing`);
      const values = defaultValues(p);
      for (const param of p.params) assert.notEqual(values[param.id], undefined, `${id}.${param.id}`);
    }
  });

  test('each pattern generates only known stencils and applies cleanly', () => {
    for (const id of ids) {
      const p = getConfigPattern(id);
      const page = pageWith();
      const res = applyArchitectureConfig(page, p, defaultValues(p));
      assert.equal(res.ok, true, `${id}: ${res.errors}`);
      const nodes = page.elements.filter((e) => e.configKey);
      assert.ok(nodes.length >= 4, `${id} generated ${nodes.length} nodes`);
      for (const el of nodes) {
        assert.ok(
          ALL_STENCIL_IDS.has(el.stencilId) || ['cloud-generic', 'cloud-vm'].includes(el.stencilId),
          `${id} uses unknown stencil ${el.stencilId}`
        );
      }
    }
  });

  test('AWS patterns default to AWS regions', () => {
    const values = defaultValues(getConfigPattern('aws-three-tier'));
    assert.ok(AWS_REGIONS.includes(values.region), `default region ${values.region} is not an AWS region`);
    const azure = defaultValues(getConfigPattern('azure-multiregion'));
    assert.ok(!AWS_REGIONS.includes(azure.region));
  });

  test('the multi-region pattern always draws a standby path', () => {
    const page = pageWith();
    const p = getConfigPattern('azure-multiregion');
    applyArchitectureConfig(page, p, defaultValues(p));
    assert.ok(page.elements.some((e) => e.configKey === 'standby'));
    assert.ok(page.elements.some((e) => e.configKey === 'standby-data'));
    assert.ok(page.elements.some((e) => e.configEdge === 'entry->standby'));
    assert.ok(page.elements.some((e) => e.configEdge === 'data->standby-data'));
  });

  test('the delivery pattern refuses a production single replica', () => {
    const p = getConfigPattern('devops-platform');
    const values = defaultValues(p);
    values.environment = 'prod';
    values.replicas = 1;
    assert.equal(validateValues(p, values).ok, false);
    values.replicas = 2;
    assert.equal(validateValues(p, values).ok, true);
  });

  test('every pattern has an explanation that mentions a real value', () => {
    for (const p of CONFIG_PATTERNS) {
      const values = defaultValues(p);
      const text = p.explanation(values);
      assert.ok(text.length > 60, `${p.id} explanation too thin`);
      assert.ok(!/undefined|NaN/.test(text), `${p.id} explanation leaked a missing value: ${text}`);
    }
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

describe('Layout metrics', () => {
  const el = (x, y, w, h) => ({ x, y, w, h });

  test('boundsOf measures the used bounding box, defaulting missing sizes', () => {
    // el(40, 130) has no size, so it defaults to 164 x 92.
    assert.deepEqual(
      boundsOf([el(40, 130), el(300, 200, 50, 40)]),
      { minX: 40, minY: 130, maxX: 350, maxY: 240, w: 310, h: 110 }
    );
    assert.deepEqual(
      boundsOf([el(40, 130)]),
      { minX: 40, minY: 130, maxX: 204, maxY: 222, w: 164, h: 92 }
    );
    assert.deepEqual(boundsOf([]), { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 });
  });

  test('areaRatio is the used share of the canvas, rounded to 4 dp', () => {
    // 800 x 470 used on a 3200 x 2400 canvas = 376000 / 7680000 = 0.0490.
    assert.equal(areaRatio([el(100, 200, 800, 470)], 3200, 2400), 0.049);
    // A single default-sized node: 164 x 92 / 7680000 = 0.0020.
    assert.equal(areaRatio([el(40, 130)]), 0.002);
    assert.equal(areaRatio([]), 0);
  });

  test('overlaps is a strict AABB test: touching boxes do not overlap', () => {
    assert.equal(overlaps(el(0, 0), el(100, 50)), true);
    assert.equal(overlaps(el(0, 0), el(164, 0)), false);
    assert.equal(overlaps(el(0, 0), el(0, 92)), false);
    assert.equal(overlaps(el(0, 0), el(200, 200)), false);
    assert.equal(overlaps(null, el(0, 0)), false);
  });
});

describe('Extended pattern catalog', () => {
  const NEW_PATTERN_IDS = [
    'aws-microservices',
    'azure-event-driven',
    'gcp-ml-pipeline',
    'zero-trust-access',
    'data-lakehouse',
    'hybrid-connectivity',
  ];

  test('all fourteen patterns are registered with unique ids', () => {
    assert.equal(CONFIG_PATTERNS.length, 14);
    assert.equal(new Set(CONFIG_PATTERNS.map((p) => p.id)).size, 14);
    for (const id of NEW_PATTERN_IDS) assert.ok(getConfigPattern(id), `${id} missing`);
  });

  test('each new pattern generates a connected graph of known stencils', () => {
    for (const id of NEW_PATTERN_IDS) {
      const p = getConfigPattern(id);
      const { nodes, edges } = p.generate(defaultValues(p));
      assert.ok(nodes.length >= 4, `${id} produced only ${nodes.length} nodes`);
      assert.ok(edges.length >= 3, `${id} produced only ${edges.length} edges`);
      const keys = new Set(nodes.map((n) => n.key));
      assert.equal(keys.size, nodes.length, `${id} has duplicate node keys`);
      for (const e of edges) {
        assert.ok(keys.has(e.from), `${id}: edge leaves unknown key ${e.from}`);
        assert.ok(keys.has(e.to), `${id}: edge enters unknown key ${e.to}`);
      }
      for (const n of nodes) {
        assert.ok(
          ALL_STENCIL_IDS.has(n.stencilId) || ['cloud-generic', 'cloud-vm'].includes(n.stencilId),
          `${id} uses unknown stencil ${n.stencilId}`
        );
      }
    }
  });

  test('each new pattern explains itself with the chosen values and prefix', () => {
    for (const id of NEW_PATTERN_IDS) {
      const p = getConfigPattern(id);
      const values = defaultValues(p);
      const text = p.explanation(values);
      assert.ok(text.length > 60, `${id} explanation too thin`);
      assert.ok(!/undefined|NaN/.test(text), `${id} explanation leaked a missing value: ${text}`);
      assert.ok(text.includes(values.namePrefix), `${id} explanation omits the prefix`);
    }
  });

  test('each new pattern lays its generated nodes out without overlaps', () => {
    for (const id of NEW_PATTERN_IDS) {
      const p = getConfigPattern(id);
      const { nodes } = p.generate(defaultValues(p));
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          assert.equal(
            overlaps(nodes[i], nodes[j]),
            false,
            `${id}: ${nodes[i].key} overlaps ${nodes[j].key}`
          );
        }
      }
    }
  });

  test('each new pattern reacts to at least three of its parameters', () => {
    const cases = [
      ['aws-microservices', { cache: false, observability: false, identity: false }],
      ['azure-event-driven', { queue: false, observability: false, identity: false }],
      ['gcp-ml-pipeline', { identity: false, observability: true, queue: true }],
      ['zero-trust-access', { strict: false, observability: false, identityModel: 'aws-iam' }],
      ['data-lakehouse', { zones: 'raw-curated', warehouse: 'gcp-bigquery', governance: false }],
      ['hybrid-connectivity', { cloud: 'Azure', redundant: true, egress: false }],
    ];
    for (const [id, changed] of cases) {
      const p = getConfigPattern(id);
      const base = p.generate(defaultValues(p));
      const values = defaultValues(p);
      Object.assign(values, changed);
      const next = p.generate(values);
      assert.ok(next.nodes.length !== base.nodes.length || next.edges.length !== base.edges.length,
        `${id} did not react to ${JSON.stringify(changed)}`);
    }
  });

  test('generated diagrams stay inside the 5% canvas-area target', () => {
    // areaRatio of generate(defaultValues).nodes for every registered pattern,
    // measured on the 3200 x 2400 teaching canvas.
    const expected = {
      'azure-three-tier': 0.0464,
      'azure-aks': 0.0389,
      'gcp-compute': 0.0464,
      'gcp-gke': 0.0389,
      'aws-three-tier': 0.0378,
      'aws-serverless': 0.0378,
      // azure-multiregion and devops-platform were relaid out on 2026-11-04
      // (three compact rows instead of a sprawl to y=470): they measured
      // 0.0559 before and 0.0481 after, bringing every pattern under target.
      'azure-multiregion': 0.0481,
      'devops-platform': 0.0481,
      'aws-microservices': 0.0413,
      'azure-event-driven': 0.0413,
      'gcp-ml-pipeline': 0.0413,
      'zero-trust-access': 0.0486,
      'data-lakehouse': 0.0329,
      'hybrid-connectivity': 0.0329,
    };
    for (const p of CONFIG_PATTERNS) {
      const { nodes } = p.generate(defaultValues(p));
      const ratio = areaRatio(nodes, 3200, 2400);
      assert.equal(ratio, expected[p.id], `${p.id} layout area drifted`);
      // Every pattern, old and new, must stay inside the 5 % target now that
      // the two historical violations have been relaid out.
      assert.ok(ratio < 0.05, `${p.id} exceeds the 5% canvas-area target`);
    }
  });

  test('each new pattern applies cleanly to an empty page', () => {
    for (const id of NEW_PATTERN_IDS) {
      const p = getConfigPattern(id);
      const page = pageWith();
      const res = applyArchitectureConfig(page, p, defaultValues(p));
      assert.equal(res.ok, true, `${id}: ${res.errors}`);
      assert.ok(page.elements.some((e) => e.configPattern === id), `${id} left no owned elements`);
    }
  });
});
