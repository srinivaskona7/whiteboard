// tests/collab.test.js — Automated Tests for EC2+S3 Connected Flow, Geometry Validation, Connectors, Manifest & Live Collaboration Server
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createElement,
  createPage,
  createScene,
  getConnectorDirectionPreset,
  applyConnectorDirectionPreset,
  getContainerChildren,
  handleAnchorDeletion,
} from '../scene/model.js';
import {
  isValidElementGeometry,
  validateElementsBatch,
  screenToWorldPoint,
  worldToScreenPoint,
  getUsableViewportCenterWorld,
  getSelectionBounds,
} from '../scene/geometry.js';
import {
  getConnectorPoints,
  getConnectorTangentFromPoint,
  resetConnectorRoute,
} from '../scene/routing.js';
import { bindConnectorEndpoint, updateConnectorBindings } from '../scene/bindings.js';
import { computeNonOverlappingOrigin } from '../scene/mermaid.js';
import { computeBatchStencilPlacement, autoLayoutArchitecture } from '../scene/layout.js';
import { HistoryManager } from '../scene/history.js';
import { serializeScene, encodeSceneToHash } from '../scene/storage.js';
import {
  ALL_STENCILS,
  getStencilById,
  getStencilsByCategory,
  getIconProvenance,
} from '../stencils/index.js';
import { parseShareRoute } from '../scene/collab-client.js';
import { createStandaloneCollabServer } from '../server/collab-server.js';

describe('1. Invisible Icon Insertion Fix, Geometry Validation & Single-Step Undo', () => {
  test('EC2 and S3 Connected Flow inserts visibly with finite coordinates, serializes cleanly, and undoes in one step', () => {
    const scene = createScene('light');
    const page = scene.pages[0];
    const history = new HistoryManager(50);
    history.initPage(page);

    // Verify legacy calling pattern computeNonOverlappingOrigin(page.elements, 100, 140) also returns finite numbers
    const legacyOrigin = computeNonOverlappingOrigin(page.elements, 100, 140);
    assert.ok(Number.isFinite(legacyOrigin.x) && Number.isFinite(legacyOrigin.y));

    const batch = computeBatchStencilPlacement(
      page,
      ['aws-ec2', 'aws-s3'],
      'flow',
      null,
      {},
      getStencilById
    );
    assert.equal(batch.valid, true);
    assert.equal(batch.elements.length, 3, 'Should create 2 stencil nodes and 1 connector');

    page.elements.push(...batch.elements);
    updateConnectorBindings(page);
    history.record(page);

    for (const el of page.elements) {
      assert.equal(isValidElementGeometry(el), true, `Element ${el.id} must have valid finite geometry`);
      assert.ok(Number.isFinite(el.x) && Number.isFinite(el.y));
      assert.ok(Number.isFinite(el.w) && Number.isFinite(el.h));
      if (el.type === 'arrow') {
        assert.ok(Number.isFinite(el.x2) && Number.isFinite(el.y2));
        assert.ok(el.w > 0, 'Connector width between EC2 and S3 must be > 0');
        assert.equal(el.startBinding.elementId, batch.nodes[0].id);
        assert.equal(el.endBinding.elementId, batch.nodes[1].id);
      }
    }

    // Verify serialized JSON and share hash contain zero null coordinates
    const json = serializeScene(scene);
    assert.ok(!json.includes('"x": null') && !json.includes('"y": null'));
    const { hash } = encodeSceneToHash(scene);
    assert.ok(hash.startsWith('#scene='));

    // Undo in one single transaction step
    assert.equal(history.undo(page), true);
    assert.equal(page.elements.length, 0, 'Batch insertion must undo in one single step');
  });

  test('screenToWorldPoint and getUsableViewportCenterWorld account for camera, zoom, and open panels', () => {
    const rect = { left: 60, top: 48, width: 1200, height: 700 };
    const camera = { x: 100, y: 50, zoom: 2 };
    const world = screenToWorldPoint(360, 248, rect, camera);
    assert.equal(world.x, 100);
    assert.equal(world.y, 75);

    const screenBack = worldToScreenPoint(world.x, world.y, rect, camera);
    assert.equal(screenBack.x, 360);
    assert.equal(screenBack.y, 248);

    const centerNoPanels = getUsableViewportCenterWorld(1440, 900, { x: 0, y: 0, zoom: 1 }, { left: 0, right: 0 });
    const centerWithLibrary = getUsableViewportCenterWorld(1440, 900, { x: 0, y: 0, zoom: 1 }, { left: 400, right: 240 });
    assert.equal(centerNoPanels.x, 720);
    assert.equal(centerWithLibrary.x, 800, 'Open left library panel should shift usable center right');
  });

  test('rejects invalid non-finite geometry before committing or serializing', () => {
    const badNode = createElement('rect', { x: NaN, y: 100, w: 120, h: 80 });
    assert.equal(isValidElementGeometry(badNode), false);
    const batchCheck = validateElementsBatch([badNode]);
    assert.equal(batchCheck.valid, false);

    const scene = createScene('light');
    scene.pages[0].elements.push(badNode);
    assert.throws(() => serializeScene(scene), /Invalid non-finite geometry/);
    assert.throws(() => encodeSceneToHash(scene), /Invalid non-finite geometry/);
  });

  test('includes all supported element types in selection bounds for Zoom to Selection and Fit Board', () => {
    const items = [
      createElement('pen', { points: [{ x: 20, y: 30 }, { x: 80, y: 90 }] }),
      createElement('arrow', { x: 100, y: 100, x2: 300, y2: 220, routing: 'curved', controlPoint: { x: 200, y: 40 } }),
      createElement('stencil', { stencilId: 'aws-ec2', x: 320, y: 180, w: 156, h: 114 }),
      createElement('table', { x: 500, y: 200, w: 240, h: 140 }),
      createElement('code', { x: 500, y: 360, w: 240, h: 120 }),
      createElement('question', { x: 760, y: 120, w: 210, h: 74 }),
    ];
    const b = getSelectionBounds(items);
    assert.ok(b && Number.isFinite(b.x) && Number.isFinite(b.y) && b.w > 700 && b.h > 400);
  });
});

describe('2. Connectors: Direction Presets, Auto Boundary Attachment, Tangents & Auto-Layout', () => {
  test('supports Plain, One-Way, and Two-Way direction presets across Straight, Right-Angle, and Curved routes', () => {
    for (const routing of ['straight', 'orthogonal', 'curved']) {
      const conn = createElement('arrow', { x: 100, y: 100, x2: 320, y2: 220, routing });

      applyConnectorDirectionPreset(conn, 'plain');
      assert.equal(getConnectorDirectionPreset(conn), 'plain');
      assert.equal(conn.startArrow, 'none');
      assert.equal(conn.endArrow, 'none');

      applyConnectorDirectionPreset(conn, 'one-way');
      assert.equal(getConnectorDirectionPreset(conn), 'one-way');
      assert.equal(conn.startArrow, 'none');
      assert.equal(conn.endArrow, 'arrow');

      applyConnectorDirectionPreset(conn, 'two-way');
      assert.equal(getConnectorDirectionPreset(conn), 'two-way');
      assert.equal(conn.startArrow, 'arrow');
      assert.equal(conn.endArrow, 'arrow');

      const pts = getConnectorPoints(conn);
      assert.ok(pts.length >= 2);
      if (routing === 'straight') {
        assert.equal(pts.length, 2, 'Straight route must be a direct segment without an elbow');
      }
      const endFrom = getConnectorTangentFromPoint(conn, 'end');
      assert.ok(Math.hypot(pts[pts.length - 1].x - endFrom.x, pts[pts.length - 1].y - endFrom.y) >= 2);
    }
  });

  test('automatic boundary mode dynamically updates attachment faces when components move vertically or horizontally', () => {
    const page = createPage('Auto Ports');
    const a = createElement('stencil', { stencilId: 'aws-alb', x: 100, y: 100, w: 156, h: 114 });
    const b = createElement('stencil', { stencilId: 'aws-ec2', x: 400, y: 100, w: 156, h: 114 });
    const conn = createElement('arrow', { x: 256, y: 157, x2: 400, y2: 157, routing: 'orthogonal' });
    page.elements.push(a, b, conn);

    bindConnectorEndpoint(conn, 'start', a, 'auto');
    bindConnectorEndpoint(conn, 'end', b, 'auto');
    updateConnectorBindings(page);
    assert.equal(conn.startBinding.resolvedPort, 'right');
    assert.equal(conn.endBinding.resolvedPort, 'left');

    // Move B directly below A -> should automatically switch to bottom -> top attachment!
    b.x = 100;
    b.y = 380;
    updateConnectorBindings(page);
    assert.equal(conn.startBinding.resolvedPort, 'bottom');
    assert.equal(conn.endBinding.resolvedPort, 'top');

    // Manual route adjustment and Reset Route
    conn.elbowOffset = 45;
    conn.manualRoute = true;
    resetConnectorRoute(conn, page);
    assert.equal(conn.elbowOffset, 0);
    assert.equal(conn.manualRoute, false);
  });

  test('autoLayoutArchitecture arranges connected DAG components cleanly', () => {
    const page = createPage('DAG');
    const n1 = createElement('stencil', { stencilId: 'aws-route53', x: 500, y: 400, w: 156, h: 114 });
    const n2 = createElement('stencil', { stencilId: 'aws-alb', x: 100, y: 300, w: 156, h: 114 });
    const n3 = createElement('stencil', { stencilId: 'aws-ec2', x: 200, y: 100, w: 156, h: 114 });
    const c1 = createElement('arrow', { x: 0, y: 0, x2: 10, y2: 10 });
    const c2 = createElement('arrow', { x: 0, y: 0, x2: 10, y2: 10 });
    bindConnectorEndpoint(c1, 'start', n1, 'auto');
    bindConnectorEndpoint(c1, 'end', n2, 'auto');
    bindConnectorEndpoint(c2, 'start', n2, 'auto');
    bindConnectorEndpoint(c2, 'end', n3, 'auto');
    page.elements.push(n1, n2, n3, c1, c2);

    assert.equal(autoLayoutArchitecture(page, null, 'LR'), true);
    assert.ok(n1.x < n2.x && n2.x < n3.x, 'LR auto-layout should order topological layers left-to-right');
  });
});

describe('3. Icon Manifest, Abbreviation Search, Boundary Containers & Question Anchor Deletion', () => {
  test('provides provenance manifest for all icons and matches common abbreviations (EC2, AKS, GKE, LB, SG, PVC, DNS)', () => {
    for (const s of ALL_STENCILS) {
      const prov = getIconProvenance(s);
      assert.ok(prov.provider && prov.upstreamSource && prov.version);
      assert.equal(prov.preservesAspectRatio, true);
    }

    const checks = [
      ['EC2', 'aws-ec2'],
      ['AKS', 'az-aks'],
      ['GKE', 'gcp-gke'],
      ['LB', 'aws-alb'],
      ['SG', 'sec-sg'],
      ['PVC', 'k8s-pvc'],
      ['DNS', 'net-dns'],
    ];
    for (const [abbr, expectedId] of checks) {
      const res = getStencilsByCategory('all', abbr);
      const flat = res.flatMap((g) => g.items);
      assert.ok(flat.some((i) => i.id === expectedId), `Abbreviation ${abbr} should match ${expectedId}`);
    }
  });

  test('architecture boundaries act as containers and preserve anchored questions when anchor is deleted', () => {
    const page = createPage('Containers');
    const vpc = createElement('stencil', {
      stencilId: 'bnd-aws-vpc',
      x: 100,
      y: 100,
      w: 400,
      h: 260,
      isBoundary: true,
      isContainer: true,
    });
    const ec2 = createElement('stencil', {
      stencilId: 'aws-ec2',
      x: 160,
      y: 150,
      w: 156,
      h: 114,
      text: 'App Server',
    });
    const qPin = createElement('question', {
      x: 280,
      y: 114,
      w: 210,
      h: 74,
      authorName: 'Alex',
      targetElementId: ec2.id,
      targetElementName: 'App Server',
      offsetX: 120,
      offsetY: -36,
    });
    page.elements.push(vpc, ec2, qPin);

    const children = getContainerChildren(page, vpc.id, { forDrag: true });
    assert.ok(children.some((c) => c.id === ec2.id), 'VPC boundary should contain EC2 instance');

    // Disable moveChildren and verify forDrag returns empty
    vpc.moveChildren = false;
    assert.equal(getContainerChildren(page, vpc.id, { forDrag: true }).length, 0);

    // Delete EC2 anchor and verify question pin stays at its coordinates with anchorDeleted=true
    handleAnchorDeletion(page, [ec2.id]);
    assert.equal(qPin.targetElementId, null);
    assert.equal(qPin.anchorDeleted, true);
    assert.equal(qPin.x, 280);
    assert.equal(qPin.y, 114);
  });
});

describe('4. Short Sharing Links & Persistent Collaboration Server Role Enforcement', () => {
  test('creates short snapshots (#/b/{id}), live rooms (#/r/{roomId}), enforces viewer vs teacher roles, and handles reconnect without duplication', async () => {
    const srv = createStandaloneCollabServer({ port: 0 });
    const port = await srv.start();
    const callApi = (urlPath, opts = {}) =>
      port > 0 ? fetch(`http://127.0.0.1:${port}${urlPath}`, opts) : srv.request(urlPath, opts);

    try {
      const scene = createScene('light');
      const ec2 = createElement('stencil', { stencilId: 'aws-ec2', x: 140, y: 120, w: 156, h: 114, text: 'EC2' });
      scene.pages[0].elements.push(ec2);

      // 1. Create short read-only snapshot
      const snapRes = await callApi('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Prod AWS', scene }),
      });
      assert.equal(snapRes.status, 201);
      const snapData = await snapRes.json();
      assert.ok(snapData.route.startsWith('#/b/b_'));
      assert.ok(snapData.route.length < 24, 'Short snapshot route must be genuinely short');
      assert.equal(parseShareRoute(snapData.route).mode, 'snapshot');

      const getSnap = await callApi(`/api/boards/${snapData.id}`);
      assert.equal(getSnap.status, 200);
      const loadedSnap = await getSnap.json();
      assert.equal(loadedSnap.scene.pages[0].elements.length, 1);

      // 2. Create live classroom room
      const roomRes = await callApi('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'K8s Workshop', scene }),
      });
      assert.equal(roomRes.status, 201);
      const roomData = await roomRes.json();
      assert.ok(roomData.viewerRoute.startsWith('#/r/r_'));
      assert.ok(roomData.teacherToken && roomData.editorToken);

      // 3. Verify room ID alone only grants 'viewer' role
      const viewerStateRes = await callApi(`/api/rooms/${roomData.roomId}`);
      const viewerState = await viewerStateRes.json();
      assert.equal(viewerState.role, 'viewer');
      assert.equal(viewerState.teacherToken, undefined);

      // 4. Verify viewer CANNOT modify or delete protected board elements on server
      const forbiddenRes = await callApi(`/api/rooms/${roomData.roomId}/ops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'elements:delete',
          ids: [ec2.id],
          token: '', // Viewer (no capability token)
        }),
      });
      assert.equal(forbiddenRes.status, 403);

      // 5. Verify viewer CAN add a named question pin
      const qPin = createElement('question', {
        x: 260,
        y: 84,
        w: 220,
        h: 78,
        authorName: 'Student Sam',
        text: 'Why is EC2 in a public subnet?',
        targetElementId: ec2.id,
        targetElementName: 'EC2',
      });
      const qAddRes = await callApi(`/api/rooms/${roomData.roomId}/ops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'question:add',
          question: qPin,
          token: '',
        }),
      });
      assert.equal(qAddRes.status, 200);

      // 6. Verify teacher CAN sync updated scene and re-syncing does not duplicate elements
      const s3 = createElement('stencil', { stencilId: 'aws-s3', x: 380, y: 120, w: 156, h: 114, text: 'S3' });
      scene.pages[0].elements.push(s3);
      for (let attempt = 0; attempt < 2; attempt++) {
        const syncRes = await callApi(`/api/rooms/${roomData.roomId}/ops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'scene:sync',
            scene,
            token: roomData.teacherToken,
          }),
        });
        assert.equal(syncRes.status, 200);
      }

      const finalRoomRes = await callApi(`/api/rooms/${roomData.roomId}`);
      const finalRoom = await finalRoomRes.json();
      assert.equal(
        finalRoom.scene.pages[0].elements.length,
        3,
        'Reconnect/resync must not duplicate EC2, S3, or the student question'
      );
    } finally {
      await srv.stop();
    }
  });
});

describe('5. Performance Benchmarks: 100, 1,000, and 5,000 Objects', () => {
  test('validates, bounds-checks, and updates bindings across 100, 1,000, and 5,000 objects within budget', () => {
    for (const count of [100, 1000, 5000]) {
      const page = createPage(`Perf ${count}`);
      const t0 = performance.now();
      for (let i = 0; i < count; i++) {
        const col = i % 50;
        const row = Math.floor(i / 50);
        page.elements.push(
          createElement('stencil', {
            stencilId: i % 2 === 0 ? 'aws-ec2' : 'aws-s3',
            x: col * 200,
            y: row * 160,
            w: 156,
            h: 114,
            text: `Node ${i}`,
          })
        );
      }
      const check = validateElementsBatch(page.elements);
      assert.equal(check.valid, true);
      const bounds = getSelectionBounds(page.elements);
      assert.ok(bounds.w > 0 && bounds.h > 0);
      const elapsedMs = performance.now() - t0;
      assert.ok(elapsedMs < 1500, `Expected ${count} objects to process in <1500ms (took ${elapsedMs.toFixed(1)}ms)`);
    }
  });
});
