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
  getContainerHierarchy,
  syncContainerMemberships,
  isFrameIncludedInPresentation,
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
  getConnectorLabelPosition,
  buildRoundedElbowSvgPath,
  deduplicateCollinear,
  resetConnectorRoute,
} from '../scene/routing.js';
import { DrawTool } from '../tools/draw.js';
import { bindConnectorEndpoint, updateConnectorBindings } from '../scene/bindings.js';
import { computeNonOverlappingOrigin } from '../scene/mermaid.js';
import { computeBatchStencilPlacement, autoLayoutArchitecture } from '../scene/layout.js';
import { HistoryManager } from '../scene/history.js';
import {
  serializeScene,
  parseSceneJson,
  encodeSceneToHash,
  decodeSceneFromHash,
  stripTeacherNotes,
  DEFAULT_PRESET_TOOLS,
  WORKSPACE_PRESETS,
  loadWorkspacePrefs,
  saveWorkspacePrefs,
} from '../scene/storage.js';
import { exportToSvgString } from '../render/svg-export.js';
import { LaserTool } from '../tools/laser.js';
import { SelectTool } from '../tools/select.js';
import { drawSvgBodyToCanvas } from '../stencils/card.js';
import { getShortcutLabel } from '../ui/registry.js';
import {
  ALL_STENCILS,
  getStencilById,
  getStencilsByCategory,
  getIconProvenance,
} from '../stencils/index.js';
import { parseShareRoute } from '../scene/collab-client.js';
import { createStandaloneCollabServer, connectNodeWsClient } from '../server/collab-server.js';

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

describe('6. Workspace Presets, Rounded-Elbow Connectors, Labels, Container Breadcrumbs, Teacher Notes & Facilitation', () => {
  test('persists Teach, Diagram, and Collaborate workspace presets and custom pinned tools separately from document content', () => {
    const store = new Map();
    const mockStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    };

    assert.ok(WORKSPACE_PRESETS.teach && WORKSPACE_PRESETS.diagram && WORKSPACE_PRESETS.collaborate);
    const initial = loadWorkspacePrefs(mockStorage);
    assert.equal(initial.preset, 'diagram');
    assert.deepEqual(initial.pinnedToolsByPreset.teach, DEFAULT_PRESET_TOOLS.teach);

    saveWorkspacePrefs(
      {
        preset: 'teach',
        pinnedToolsByPreset: {
          teach: ['select', 'pen', 'laser', 'question'],
        },
      },
      mockStorage
    );
    const updated = loadWorkspacePrefs(mockStorage);
    assert.equal(updated.preset, 'teach');
    assert.deepEqual(updated.pinnedToolsByPreset.teach, ['select', 'pen', 'laser', 'question']);
    assert.deepEqual(updated.pinnedToolsByPreset.diagram, DEFAULT_PRESET_TOOLS.diagram);
  });

  test('routes rounded-elbow connectors with clamped corner radius and exports source, middle, and destination labels', () => {
    const scene = createScene('light');
    const page = scene.pages[0];
    const nodeA = createElement('stencil', { stencilId: 'aws-ec2', x: 80, y: 80, w: 156, h: 114, text: 'EC2' });
    const nodeB = createElement('stencil', { stencilId: 'aws-rds', x: 420, y: 280, w: 156, h: 114, text: 'RDS' });
    const conn = createElement('arrow', {
      x: 236,
      y: 137,
      x2: 420,
      y2: 337,
      routing: 'rounded-elbow',
      cornerRadius: 18,
      startLabel: 'app:out',
      text: 'TLS 1.3',
      endLabel: ':5432',
    });
    bindConnectorEndpoint(conn, 'start', nodeA, 'auto');
    bindConnectorEndpoint(conn, 'end', nodeB, 'auto');
    page.elements.push(nodeA, nodeB, conn);
    updateConnectorBindings(page);

    const pts = getConnectorPoints(conn, page);
    assert.ok(pts.length >= 3, 'Rounded-elbow route should produce orthogonal elbow bends');
    const svgPath = buildRoundedElbowSvgPath(pts, conn.cornerRadius);
    assert.ok(svgPath.includes('Q '), 'Rounded-elbow SVG path should include quadratic corner arcs');

    const startPos = getConnectorLabelPosition(conn, 'start', page);
    const midPos = getConnectorLabelPosition(conn, 'middle', page);
    const endPos = getConnectorLabelPosition(conn, 'end', page);
    assert.ok(Math.hypot(startPos.x - pts[0].x, startPos.y - pts[0].y) >= 20, 'Start label should stay clear of start arrowhead/boundary');
    assert.ok(Math.hypot(endPos.x - pts[pts.length - 1].x, endPos.y - pts[pts.length - 1].y) >= 20, 'End label should stay clear of end arrowhead/boundary');
    assert.ok(midPos.t > startPos.t && midPos.t < endPos.t);

    const svgStr = exportToSvgString(scene, page);
    assert.ok(svgStr.includes('app:out'));
    assert.ok(svgStr.includes('TLS 1.3'));
    assert.ok(svgStr.includes(':5432'));

    // Round-trip save & reopen preserves cornerRadius and all 3 labels
    const reopened = parseSceneJson(serializeScene(scene));
    const savedConn = reopened.pages[0].elements.find((e) => e.id === conn.id);
    assert.equal(savedConn.routing, 'rounded-elbow');
    assert.equal(savedConn.cornerRadius, 18);
    assert.equal(savedConn.startLabel, 'app:out');
    assert.equal(savedConn.text, 'TLS 1.3');
    assert.equal(savedConn.endLabel, ':5432');
  });

  test('computes nested container breadcrumbs, updates membership on move, and excludes hidden/opted-out frames from presentation', () => {
    const page = createPage('Architecture');
    const vpc = createElement('stencil', {
      stencilId: 'bnd-vpc',
      x: 40,
      y: 40,
      w: 600,
      h: 420,
      text: 'Production VPC',
      isBoundary: true,
      isContainer: true,
    });
    const subnet = createElement('stencil', {
      stencilId: 'bnd-private-subnet',
      x: 80,
      y: 90,
      w: 480,
      h: 300,
      text: 'Private Subnet',
      isBoundary: true,
      isContainer: true,
      containerId: vpc.id,
    });
    const pod = createElement('stencil', {
      stencilId: 'k8s-pod',
      x: 140,
      y: 150,
      w: 156,
      h: 114,
      text: 'API Pod',
      containerId: subnet.id,
    });
    const slide1 = createElement('frame', { x: 700, y: 40, w: 400, h: 300, text: 'Slide 1', slideOrder: 1, includeInPresentation: true });
    const slide2 = createElement('frame', { x: 1140, y: 40, w: 400, h: 300, text: 'Draft Scratchpad', slideOrder: 2, includeInPresentation: false });
    page.elements.push(vpc, subnet, pod, slide1, slide2);

    const crumbs = getContainerHierarchy(page, pod);
    assert.deepEqual(
      crumbs.map((c) => c.name),
      ['Production VPC', 'Private Subnet', 'API Pod']
    );

    // Move pod outside all containers and sync membership
    pod.x = 900;
    pod.y = 500;
    pod.containerId = null;
    syncContainerMemberships(page, [pod]);
    assert.equal(pod.containerId, null);

    // Verify frame presentation inclusion filter
    assert.equal(isFrameIncludedInPresentation(slide1), true);
    assert.equal(isFrameIncludedInPresentation(slide2), false);
  });

  test('persists teacher notes locally but strips them from student share hashes, snapshots, and non-teacher room payloads', async () => {
    const scene = createScene('light');
    scene.pages[0].teacherNotes = 'Secret grading rubric: check IAM least privilege';
    const frame = createElement('frame', {
      x: 100,
      y: 100,
      w: 480,
      h: 320,
      text: 'Architecture Exercise',
      teacherNotes: 'Answer key: S3 bucket needs VPC Endpoint',
    });
    scene.pages[0].elements.push(frame);

    // 1. Local serialization preserves teacherNotes
    const localReloaded = parseSceneJson(serializeScene(scene));
    assert.equal(localReloaded.pages[0].teacherNotes, 'Secret grading rubric: check IAM least privilege');
    assert.equal(localReloaded.pages[0].elements[0].teacherNotes, 'Answer key: S3 bucket needs VPC Endpoint');

    // 2. stripTeacherNotes & encodeSceneToHash exclude teacherNotes
    const stripped = stripTeacherNotes(scene);
    assert.equal(stripped.pages[0].teacherNotes, undefined);
    assert.equal(stripped.pages[0].elements[0].teacherNotes, undefined);

    const hashResult = encodeSceneToHash(scene);
    const fromStudentHash = decodeSceneFromHash(hashResult.hash);
    assert.ok(!fromStudentHash.pages[0].teacherNotes, 'Student hash must not contain page teacherNotes');
    assert.ok(!fromStudentHash.pages[0].elements[0].teacherNotes, 'Student hash must not contain frame teacherNotes');

    // 3. Server snapshots & non-teacher room state exclude teacherNotes, while teacher token retains them
    const srv = createStandaloneCollabServer({ port: 0 });
    try {
      const snapRes = await srv.request('/api/boards', {
        method: 'POST',
        body: JSON.stringify({ title: 'Handout', scene }),
      });
      const snapCreated = await snapRes.json();
      const snapFetch = await (await srv.request(`/api/boards/${snapCreated.id}`)).json();
      assert.equal(snapFetch.scene.pages[0].teacherNotes, undefined);
      assert.equal(snapFetch.scene.pages[0].elements[0].teacherNotes, undefined);

      const roomRes = await srv.request('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'Live Class', scene }),
      });
      const roomCreated = await roomRes.json();

      // Student questioner role fetch
      const studentState = await (await srv.request(`/api/rooms/${roomCreated.roomId}?role=questioner`)).json();
      assert.equal(studentState.role, 'questioner');
      assert.equal(studentState.scene.pages[0].teacherNotes, undefined);
      assert.equal(studentState.scene.pages[0].elements[0].teacherNotes, undefined);

      // Teacher token fetch
      const teacherState = await (
        await srv.request(`/api/rooms/${roomCreated.roomId}?token=${roomCreated.teacherToken}`)
      ).json();
      assert.equal(teacherState.role, 'teacher');
      assert.equal(teacherState.scene.pages[0].teacherNotes, 'Secret grading rubric: check IAM least privilege');
      assert.equal(teacherState.scene.pages[0].elements[0].teacherNotes, 'Answer key: S3 bucket needs VPC Endpoint');

      // Facilitation: questioner can send reaction & reopen question, but cannot delete elements; teacher can sync timer
      const rxRes = await srv.request(`/api/rooms/${roomCreated.roomId}/ops`, {
        method: 'POST',
        body: JSON.stringify({ type: 'reaction:send', emoji: '💡', authorName: 'Maya', roleHint: 'questioner' }),
      });
      assert.equal(rxRes.status, 200);

      const timerRes = await srv.request(`/api/rooms/${roomCreated.roomId}/ops`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'timer:sync',
          token: roomCreated.teacherToken,
          timerState: { running: true, remainingSec: 180, mode: 'countdown' },
        }),
      });
      assert.equal(timerRes.status, 200);
    } finally {
      await srv.stop();
    }
  });

  test('LaserTool.prune interface is consistent across render loop and pointer events', () => {
    const laser = new LaserTool({ requestRender() {} }, { lifetimeMs: 1000 });
    laser.onPointerDown({ x: 10, y: 20 }, 1000);
    laser.onPointerMove({ x: 30, y: 40 }, 1200);
    laser.onPointerUp(1250);
    assert.equal(laser.prune(1500).length, 2);
    assert.equal(laser.hasActiveTrail(1500), true);
    assert.equal(laser.prune(2500).length, 0);
    assert.equal(laser.hasActiveTrail(2500), false);
  });

  test('synchronizes two independent WebSocket clients across roles, cursors, hand-raise, reactions, questions, timer, and reconnect', async () => {
    const srv = createStandaloneCollabServer({ port: 0 });
    const port = await srv.start();
    if (!port) return; // Skip only if OS sandbox blocks loopback listen

    try {
      const scene = createScene('light');
      scene.pages[0].teacherNotes = 'Instructor private note';
      const ec2 = createElement('stencil', { stencilId: 'aws-ec2', x: 120, y: 120, w: 156, h: 114, text: 'EC2' });
      scene.pages[0].elements.push(ec2);

      const createRes = await fetch(`http://127.0.0.1:${port}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Live WebSocket Class', scene }),
      });
      assert.equal(createRes.status, 201);
      const room = await createRes.json();

      const connectClient = (queryObj) => {
        const qs = new URLSearchParams(queryObj).toString();
        return connectNodeWsClient(`ws://127.0.0.1:${port}/ws?${qs}`);
      };

      const teacher = await connectClient({
        roomId: room.roomId,
        token: room.teacherToken,
        clientId: 'cli_teacher',
        name: 'Prof. Lin',
        color: '#2563eb',
      });
      const teacherWelcome = await teacher.waitFor((m) => m.type === 'room:welcome');
      assert.equal(teacherWelcome.role, 'teacher');
      assert.equal(teacherWelcome.scene.pages[0].teacherNotes, 'Instructor private note');

      const student = await connectClient({
        roomId: room.roomId,
        role: 'questioner',
        clientId: 'cli_student',
        name: 'Alex',
        color: '#059669',
      });
      const studentWelcome = await student.waitFor((m) => m.type === 'room:welcome');
      assert.equal(studentWelcome.role, 'questioner');
      assert.equal(studentWelcome.scene.pages[0].teacherNotes, undefined);

      // Verify both participants appear in presence:list
      const presenceBoth = await teacher.waitFor(
        (m) => m.type === 'presence:list' && m.participants.length === 2
      );
      assert.equal(presenceBoth.participants.length, 2);

      // Student raises hand & moves cursor
      student.ws.send(
        JSON.stringify({
          type: 'presence:update',
          name: 'Alex',
          pageId: scene.pages[0].id,
          handRaised: true,
          cursor: { x: 180, y: 160 },
        })
      );
      const presenceHand = await teacher.waitFor(
        (m) =>
          m.type === 'presence:list' &&
          m.participants.some((p) => p.clientId === 'cli_student' && p.handRaised === true && p.cursor?.x === 180)
      );
      assert.ok(presenceHand);

      // Student sends reaction
      student.ws.send(JSON.stringify({ type: 'reaction:send', emoji: '👏', authorName: 'Alex' }));
      const rxBurst = await teacher.waitFor((m) => m.type === 'reaction:burst');
      assert.equal(rxBurst.reaction.emoji, '👏');

      // Student asks question, teacher replies & resolves, student reopens
      const qEl = createElement('question', {
        x: 200,
        y: 100,
        text: 'Why is this in a private subnet?',
        authorName: 'Alex',
        targetElementId: ec2.id,
      });
      student.ws.send(JSON.stringify({ type: 'question:add', pageId: scene.pages[0].id, question: qEl }));
      const qAdded = await teacher.waitFor((m) => m.type === 'question:added');
      assert.equal(qAdded.question.id, qEl.id);

      teacher.ws.send(
        JSON.stringify({
          type: 'question:update',
          pageId: scene.pages[0].id,
          questionId: qEl.id,
          reply: 'To prevent direct public internet ingress.',
          resolved: true,
        })
      );
      const qResolved = await student.waitFor(
        (m) => m.type === 'question:updated' && m.question.resolved === true
      );
      assert.equal(qResolved.question.reply, 'To prevent direct public internet ingress.');

      student.ws.send(
        JSON.stringify({
          type: 'question:update',
          pageId: scene.pages[0].id,
          questionId: qEl.id,
          resolved: false,
        })
      );
      const qReopened = await teacher.waitFor(
        (m) => m.type === 'question:updated' && m.question.resolved === false
      );
      assert.equal(qReopened.question.resolved, false);

      // Student attempts forbidden delete over WebSocket
      student.ws.send(JSON.stringify({ type: 'elements:delete', ids: [ec2.id] }));
      const errMsg = await student.waitFor((m) => m.type === 'error' && m.code === 403);
      assert.equal(errMsg.code, 403);

      // Teacher broadcasts camera & shared timer
      teacher.ws.send(
        JSON.stringify({
          type: 'teacher:camera',
          pageId: scene.pages[0].id,
          camera: { x: -120, y: -80, zoom: 1.5 },
        })
      );
      const camMsg = await student.waitFor((m) => m.type === 'teacher:camera');
      assert.equal(camMsg.camera.zoom, 1.5);

      teacher.ws.send(
        JSON.stringify({
          type: 'timer:sync',
          timerState: { running: true, remainingSec: 240, mode: 'countdown' },
        })
      );
      const timerMsg = await student.waitFor((m) => m.type === 'timer:synced');
      assert.equal(timerMsg.timerState.remainingSec, 240);

      // Disconnect student and verify stale presence cleanup
      student.ws.close();
      const presenceAfterLeave = await teacher.waitFor(
        (m) => m.type === 'presence:list' && m.participants.length === 1
      );
      assert.equal(presenceAfterLeave.participants[0].clientId, 'cli_teacher');
      teacher.ws.close();
    } finally {
      await srv.stop();
    }
  });

  test('a viewer receives its own vote:cast echo — the server owns the count', async () => {
    // Viewers never mutate locally (no optimistic dot), so the caster's own
    // screen only updates from the server's authoritative broadcast. If the
    // WS route excludes the sender's socket, the student clicks and nothing
    // happens on their own board until an unrelated full sync.
    const srv = createStandaloneCollabServer({ port: 0 });
    const port = await srv.start();
    if (!port) return; // Skip only if OS sandbox blocks loopback listen

    try {
      const scene = createScene('light');
      const sticky = createElement('sticky', { x: 120, y: 120, w: 200, h: 120, text: 'Best idea' });
      scene.pages[0].elements.push(sticky);

      const createRes = await fetch(`http://127.0.0.1:${port}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Vote echo room', scene }),
      });
      const room = await createRes.json();

      const connectClient = (queryObj) => {
        const qs = new URLSearchParams(queryObj).toString();
        return connectNodeWsClient(`ws://127.0.0.1:${port}/ws?${qs}`);
      };
      const teacher = await connectClient({
        roomId: room.roomId,
        token: room.teacherToken,
        clientId: 'cli_teacher',
        name: 'Prof. Lin',
        color: '#2563eb',
      });
      await teacher.waitFor((m) => m.type === 'room:welcome');
      const student = await connectClient({
        roomId: room.roomId,
        role: 'questioner',
        clientId: 'cli_student',
        name: 'Alex',
        color: '#059669',
      });
      await student.waitFor((m) => m.type === 'room:welcome');

      teacher.ws.send(JSON.stringify({ type: 'vote:session', active: true }));
      const sessionOpen = await student.waitFor((m) => m.type === 'vote:session' && m.session.active === true);
      assert.ok(sessionOpen, 'the student sees the session open');

      student.ws.send(
        JSON.stringify({ type: 'vote:cast', pageId: scene.pages[0].id, elementId: sticky.id, votes: 999 })
      );

      // The caster must hear its own authoritative count back — the payload's
      // 999 is ignored and the server's recomputed count is what lands.
      const ownEcho = await student.waitFor(
        (m) => m.type === 'vote:cast' && m.elementId === sticky.id && m.votes === 1
      );
      assert.equal(ownEcho.senderClientId, 'cli_student');
      const teacherEcho = await teacher.waitFor(
        (m) => m.type === 'vote:cast' && m.elementId === sticky.id && m.votes === 1
      );
      assert.ok(teacherEcho);

      // A second cast on the same element still reaches both.
      student.ws.send(
        JSON.stringify({ type: 'vote:cast', pageId: scene.pages[0].id, elementId: sticky.id })
      );
      await teacher.waitFor((m) => m.type === 'vote:cast' && m.elementId === sticky.id && m.votes === 2);

      teacher.ws.close();
      student.ws.close();
    } finally {
      await srv.stop();
    }
  });

  test('renders recognizable non-zero SVG artwork onto Canvas for EC2, S3, RDS, and Route 53 stencils and guards idle SelectTool pointerup', () => {
    const drawnOps = [];
    const mockCtx = {
      save() {},
      restore() {},
      beginPath() {},
      closePath() {},
      fill() {
        drawnOps.push({ op: 'fill' });
      },
      stroke() {
        drawnOps.push({ op: 'stroke' });
      },
      roundRect(x, y, w, h, r) {
        drawnOps.push({ op: 'roundRect', x, y, w, h, r });
      },
      arc(cx, cy, r) {
        drawnOps.push({ op: 'arc', cx, cy, r });
      },
      ellipse(cx, cy, rx, ry) {
        drawnOps.push({ op: 'ellipse', cx, cy, rx, ry });
      },
      moveTo(x, y) {
        drawnOps.push({ op: 'moveTo', x, y });
      },
      lineTo(x, y) {
        drawnOps.push({ op: 'lineTo', x, y });
      },
      quadraticCurveTo(cx, cy, x, y) {
        drawnOps.push({ op: 'quad', cx, cy, x, y });
      },
      bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
        drawnOps.push({ op: 'bezier', c1x, c1y, c2x, c2y, x, y });
      },
      fillText(text, x, y) {
        drawnOps.push({ op: 'fillText', text, x, y });
      },
    };

    const ec2 = getStencilById('aws-ec2');
    const s3 = getStencilById('aws-s3');
    const r53 = getStencilById('aws-route53');
    drawSvgBodyToCanvas(mockCtx, ec2.svgBody, 10, 10, 100, 72, '#ea580c');
    const ec2Rects = drawnOps.filter((d) => d.op === 'roundRect' && d.w > 10 && d.h > 10);
    assert.ok(ec2Rects.length >= 2, 'EC2 stencil must draw non-zero chip rectangles onto Canvas');

    drawnOps.length = 0;
    drawSvgBodyToCanvas(mockCtx, s3.svgBody, 10, 10, 100, 72, '#ea580c');
    const s3Ellipses = drawnOps.filter((d) => d.op === 'ellipse' && d.rx > 10 && d.ry > 4);
    assert.ok(s3Ellipses.length >= 1, 'S3 stencil must draw non-zero bucket ellipse onto Canvas');

    drawnOps.length = 0;
    drawSvgBodyToCanvas(mockCtx, r53.svgBody, 10, 10, 100, 72, '#ea580c');
    const r53Texts = drawnOps.filter((d) => d.op === 'fillText' && d.text === '53');
    assert.equal(r53Texts.length, 1, 'Route 53 stencil must draw "53" text onto Canvas');

    // Verify SelectTool.onPointerUp does NOT call app.updateUI() when no canvas drag/click started (mode === null)
    let updateUICalled = 0;
    const selTool = new SelectTool({
      getPage: () => createPage('P1'),
      updateUI: () => {
        updateUICalled += 1;
      },
      requestRender: () => {},
    });
    selTool.onPointerUp();
    assert.equal(updateUICalled, 0, 'Idle SelectTool.onPointerUp must not call updateUI() and destroy DOM buttons');

    // Verify unified shortcut helper
    assert.ok(getShortcutLabel('undo').includes('Z'));
    assert.ok(getShortcutLabel('redo').includes('Z'));

    // Verify collinear segment deduplication removes zero-length and redundant bends
    const rawPts = [
      { x: 10, y: 10 },
      { x: 10, y: 10.2 },
      { x: 10, y: 80 },
      { x: 10, y: 140 },
      { x: 120, y: 140 },
    ];
    const deduped = deduplicateCollinear(rawPts);
    assert.equal(deduped.length, 3);
    assert.deepEqual(deduped[1], { x: 10, y: 140 });

    // Verify DrawTool stylus pressure capture & palm rejection during pen stroke
    const drawPage = createPage('Stylus');
    const drawTool = new DrawTool({
      activeTool: 'pen',
      currentStyle: { stroke: '#1e293b', strokeWidth: 3, opacity: 1 },
      scene: { settings: { snapToGrid: false } },
      getPage: () => drawPage,
      requestRender: () => {},
    });
    drawTool.onPointerDown({ x: 50, y: 60 }, { pointerType: 'pen', pressure: 0.78 });
    assert.equal(drawPage.elements.length, 1);
    assert.equal(drawPage.elements[0].points[0].p, 0.78);
    // Simulate accidental palm touch while pen stroke is active
    drawTool.onPointerDown({ x: 200, y: 200 }, { pointerType: 'touch', pressure: 0.5 });
    assert.equal(drawPage.elements.length, 1, 'Palm touch during active pen stroke must be rejected');
  });

  test('revokes snapshot and classroom room links with 410 Gone and enforces teacher token for room revocation', async () => {
    const srv = createStandaloneCollabServer({ port: 0 });
    try {
      const scene = createScene('light');
      const snapRes = await srv.request('/api/boards', {
        method: 'POST',
        body: JSON.stringify({ title: 'Revocable Snapshot', scene }),
      });
      const snap = await snapRes.json();
      const delSnap = await srv.request(`/api/boards/${snap.id}`, { method: 'DELETE' });
      assert.equal(delSnap.status, 200);
      const getRevokedSnap = await srv.request(`/api/boards/${snap.id}`);
      assert.equal(getRevokedSnap.status, 410);

      const roomRes = await srv.request('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ title: 'Revocable Room', scene }),
      });
      const room = await roomRes.json();

      // Viewer cannot revoke room
      const forbiddenRevoke = await srv.request(`/api/rooms/${room.roomId}?token=wrong`, {
        method: 'DELETE',
      });
      assert.equal(forbiddenRevoke.status, 403);

      // Teacher can revoke room
      const okRevoke = await srv.request(
        `/api/rooms/${room.roomId}?token=${encodeURIComponent(room.teacherToken)}`,
        { method: 'DELETE' }
      );
      assert.equal(okRevoke.status, 200);
      const getRevokedRoom = await srv.request(`/api/rooms/${room.roomId}`);
      assert.equal(getRevokedRoom.status, 410);
    } finally {
      await srv.stop();
    }
  });
});


describe('24. Cursor chat and anchored emotes over live sockets', () => {
  const setupChatRoom = async () => {
    const srv = createStandaloneCollabServer({ port: 0 });
    const port = await srv.start();
    if (!port) return null; // Skip only if OS sandbox blocks loopback listen

    const scene = createScene('light');
    const sticky = createElement('sticky', { x: 120, y: 120, w: 200, h: 120, text: 'Chat anchor' });
    scene.pages[0].elements.push(sticky);
    const createRes = await fetch(`http://127.0.0.1:${port}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Cursor chat room', scene }),
    });
    const room = await createRes.json();

    const connectClient = (queryObj) => {
      const qs = new URLSearchParams(queryObj).toString();
      return connectNodeWsClient(`ws://127.0.0.1:${port}/ws?${qs}`);
    };
    const teacher = await connectClient({
      roomId: room.roomId,
      token: room.teacherToken,
      clientId: 'cli_teacher',
      name: 'Prof. Lin',
      color: '#2563eb',
    });
    await teacher.waitFor((m) => m.type === 'room:welcome');
    const student = await connectClient({
      roomId: room.roomId,
      clientId: 'cli_student',
      name: 'Alex',
      color: '#059669',
    });
    await student.waitFor((m) => m.type === 'room:welcome');

    return { srv, teacher, student, sticky, scene, pageId: scene.pages[0].id };
  };

  test('a viewer cursor chat reaches the teacher with the full bubble payload', async () => {
    const ctx = await setupChatRoom();
    if (!ctx) return;
    const { srv, teacher, student, pageId } = ctx;
    try {
      student.ws.send(
        JSON.stringify({
          type: 'chat:cursor',
          text: 'Look at the left box please!',
          authorName: 'Alex',
          color: '#059669',
          x: 140,
          y: 180,
        })
      );
      const got = await teacher.waitFor((m) => m.type === 'chat:cursor');
      assert.equal(got.chat.text, 'Look at the left box please!');
      assert.equal(got.chat.name, 'Alex');
      assert.equal(got.chat.color, '#059669');
      assert.equal(got.chat.clientId, 'cli_student');
      assert.equal(got.chat.pageId, pageId);
      assert.equal(got.chat.x, 140);
      assert.equal(got.chat.y, 180);
      assert.ok(got.chat.id && Number.isFinite(got.chat.at));
    } finally {
      await srv.stop();
    }
  });

  test("the sender's socket never receives its own chat:cursor — the optimistic pairing", async () => {
    // chat:cursor broadcasts exclude the sender's socket: the sender already
    // applied its own bubble optimistically on send, so an echo would draw the
    // same bubble twice. vote:cast is the deliberate counter-example (the
    // viewer never mutates locally, so the caster needs its own echo) — that
    // pairing rule is what this test pins for chat.
    const ctx = await setupChatRoom();
    if (!ctx) return;
    const { srv, teacher, student } = ctx;
    try {
      student.ws.send(
        JSON.stringify({
          type: 'chat:cursor',
          text: 'anyone else see this?',
          authorName: 'Alex',
          x: 50,
          y: 60,
        })
      );
      // The teacher got it — the message really did broadcast.
      await teacher.waitFor((m) => m.type === 'chat:cursor' && m.chat.clientId === 'cli_student');
      // Wait out the delivery window, then prove the sender heard no echo.
      await new Promise((r) => setTimeout(r, 300));
      assert.equal(
        student.inbox.filter((m) => m.type === 'chat:cursor').length,
        0,
        'the sender must apply its own bubble optimistically, not from an echo'
      );
    } finally {
      await srv.stop();
    }
  });

  test('an anchored emote round-trips its elementId over the socket', async () => {
    const ctx = await setupChatRoom();
    if (!ctx) return;
    const { srv, teacher, student, sticky } = ctx;
    try {
      student.ws.send(
        JSON.stringify({
          type: 'reaction:send',
          emoji: '🎉',
          authorName: 'Alex',
          elementId: sticky.id,
          x: 220,
          y: 96,
        })
      );
      const got = await teacher.waitFor((m) => m.type === 'reaction:burst');
      assert.equal(got.reaction.emoji, '🎉');
      assert.equal(got.reaction.elementId, sticky.id);
      assert.equal(got.reaction.x, 220);
      assert.equal(got.reaction.y, 96);
    } finally {
      await srv.stop();
    }
  });
});
