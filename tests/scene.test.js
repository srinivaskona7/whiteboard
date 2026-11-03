// tests/scene.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEMA_VERSION,
  createElement,
  createPage,
  createScene,
  cloneElementsWithBindings,
  groupElements,
  ungroupElements,
  expandSelectionWithGroups,
  autoGrowShapeForText,
  toggleFrameCollapse,
  reorderElement,
  extractStyle,
} from '../scene/model.js';
import {
  rotatePoint,
  unrotatePoint,
  getElementBounds,
  getConnectionPorts,
  getPortPoint,
  getEdgePointToward,
  snapAngle,
  alignElements,
  distributeElements,
  matchElementSize,
  arrangeElements,
  computeSmartGuides,
} from '../scene/geometry.js';
import {
  hitTestElement,
  hitTestScene,
  hitTestHandle,
  getMultiSelectionHandles,
  hitTestMultiSelectionHandle,
} from '../scene/hit.js';
import {
  computeOrthogonalPath,
  getConnectorPoints,
  getPointAlongConnector,
  sanitizeRoutePoints,
} from '../scene/routing.js';
import {
  bindConnectorEndpoint,
  updateConnectorBindings,
  findHoverPort,
} from '../scene/bindings.js';
import { HistoryManager } from '../scene/history.js';
import { parseMermaidDiagram } from '../scene/mermaid.js';
import { createTableElementData } from '../scene/table.js';
import {
  migrateSceneData,
  serializeScene,
  parseSceneJson,
  exportLibraryJson,
  importLibraryJson,
  encodeSceneToHash,
  decodeSceneFromHash,
  sanitizeSceneForPersistence,
  createDebouncedAutosave,
} from '../scene/storage.js';
import { exportToSvgString, escapeXml } from '../render/svg-export.js';
import { CanvasRenderer } from '../render/canvas.js';
import { ALL_STENCILS, getStencilById, getStencilsByCategory } from '../stencils/index.js';
import { BUILTIN_TEMPLATES, getTemplateById } from '../templates/index.js';

function createMockCanvas(w = 1280, h = 800) {
  const ops = [];
  const ctx = {
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    setTransform: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    beginPath: () => ops.push('beginPath'),
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    roundRect: () => {},
    clip: () => {},
    fill: () => ops.push('fill'),
    stroke: () => ops.push('stroke'),
    fillRect: () => ops.push('fillRect'),
    strokeRect: () => ops.push('strokeRect'),
    clearRect: () => {},
    fillText: (t) => ops.push(`text:${t}`),
    measureText: (t) => ({ width: String(t || '').length * 8 }),
    setLineDash: () => {},
    drawImage: () => ops.push('drawImage'),
  };
  return {
    width: w,
    height: h,
    style: {},
    ops,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
  };
}

describe('Geometry & Edge Points', () => {
  test('rotates and unrotates points accurately', () => {
    const p = rotatePoint(150, 100, 100, 100, Math.PI / 2);
    assert.ok(Math.abs(p.x - 100) < 1e-6);
    assert.ok(Math.abs(p.y - 150) < 1e-6);
    const back = unrotatePoint(p.x, p.y, 100, 100, Math.PI / 2);
    assert.ok(Math.abs(back.x - 150) < 1e-6);
    assert.ok(Math.abs(back.y - 100) < 1e-6);
  });

  test('computes connection ports and edge points for shapes', () => {
    const rect = createElement('rect', { x: 100, y: 200, w: 120, h: 80 });
    const ports = getConnectionPorts(rect);
    assert.equal(ports.length, 4);
    const rightPort = getPortPoint(rect, 'right');
    assert.deepEqual({ x: rightPort.x, y: rightPort.y }, { x: 220, y: 240 });

    const edgeRight = getEdgePointToward(rect, 500, 240);
    assert.ok(Math.abs(edgeRight.x - 220) < 1e-4);
    assert.ok(Math.abs(edgeRight.y - 240) < 1e-4);

    const diamond = createElement('diamond', { x: 0, y: 0, w: 100, h: 100 });
    const topEdge = getEdgePointToward(diamond, 50, -200);
    assert.ok(Math.abs(topEdge.x - 50) < 1e-4);
    assert.ok(Math.abs(topEdge.y - 0) < 1e-4);
  });

  test('aligns, distributes, matches size, and computes smart guides', () => {
    const a = createElement('rect', { x: 10, y: 20, w: 50, h: 40 });
    const b = createElement('rect', { x: 100, y: 80, w: 70, h: 60 });
    const c = createElement('rect', { x: 300, y: 140, w: 50, h: 40 });

    alignElements([a, b], 'left');
    assert.equal(b.x, 10);

    matchElementSize([a, b], 'both');
    assert.equal(b.w, 50);
    assert.equal(b.h, 40);

    b.x = 90;
    distributeElements([a, b, c], 'horizontal');
    assert.ok(Math.abs(b.x - 155) < 1e-4);

    const guides = computeSmartGuides(getElementBounds(a), [c], 20);
    assert.ok(Array.isArray(guides.guides));
  });

  test('snaps angles to 15 degree increments', () => {
    const rad = (28 * Math.PI) / 180;
    const snapped = snapAngle(rad, 15);
    assert.ok(Math.abs(snapped - (30 * Math.PI) / 180) < 1e-6);
  });
});

describe('Hit-Testing', () => {
  test('hits rectangles, ellipses, diamonds, connectors, and handles', () => {
    const page = createPage('Test');
    const rect = createElement('rect', { x: 50, y: 50, w: 100, h: 80 });
    const diamond = createElement('diamond', { x: 250, y: 50, w: 100, h: 100 });
    const arrow = createElement('arrow', { x: 150, y: 90, x2: 250, y2: 90, routing: 'straight' });
    page.elements.push(rect, diamond, arrow);

    assert.equal(hitTestElement(rect, 100, 90, page), true);
    assert.equal(hitTestElement(rect, 10, 10, page), false);
    assert.equal(hitTestElement(diamond, 300, 100, page, 0), true);
    assert.equal(hitTestElement(diamond, 255, 55, page, 0), false);
    assert.equal(hitTestElement(arrow, 200, 90, page), true);
    assert.equal(hitTestScene(page, 100, 90)?.id, rect.id);

    const seHandle = hitTestHandle(rect, 150, 130, 1, page);
    assert.equal(seHandle?.id, 'se');
  });
});

describe('Orthogonal Routing & Smart Connector Bindings', () => {
  test('routes orthogonally around an obstacle between two shapes', () => {
    const page = createPage('Routing');
    const s1 = createElement('rect', { x: 100, y: 200, w: 100, h: 80 });
    const obstacle = createElement('rect', { x: 260, y: 180, w: 100, h: 120 });
    const s2 = createElement('rect', { x: 440, y: 200, w: 100, h: 80 });
    const conn = createElement('arrow', { routing: 'orthogonal' });
    page.elements.push(s1, obstacle, s2, conn);

    bindConnectorEndpoint(conn, 'start', s1, 'right');
    bindConnectorEndpoint(conn, 'end', s2, 'left');
    updateConnectorBindings(page);

    const pts = computeOrthogonalPath(conn, s1, s2, [obstacle]);
    assert.ok(pts.length >= 4, 'Orthogonal path should have multiple waypoints');

    for (let i = 0; i < pts.length - 1; i++) {
      const dx = Math.abs(pts[i + 1].x - pts[i].x);
      const dy = Math.abs(pts[i + 1].y - pts[i].y);
      assert.ok(dx < 1 || dy < 1, `Segment ${i} must be orthogonal`);
    }

    const obsBox = getElementBounds(obstacle);
    for (let i = 1; i < pts.length - 2; i++) {
      const a = pts[i], b = pts[i + 1];
      if (Math.abs(a.y - b.y) < 1) {
        const y = a.y, minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
        const cuts = y > obsBox.minY && y < obsBox.maxY && maxX > obsBox.minX && minX < obsBox.maxX;
        assert.equal(cuts, false, 'Horizontal segment should route around obstacle');
      }
    }
  });

  test('persists bindings when bound shapes move, resize, or rotate', () => {
    const page = createPage('Bindings');
    const boxA = createElement('rect', { x: 100, y: 100, w: 120, h: 80 });
    const boxB = createElement('rect', { x: 400, y: 100, w: 120, h: 80 });
    const arrow = createElement('arrow', { routing: 'orthogonal' });
    page.elements.push(boxA, boxB, arrow);

    const hover = findHoverPort(page, 220, 140);
    assert.equal(hover?.element.id, boxA.id);
    assert.equal(hover?.portId, 'right');

    bindConnectorEndpoint(arrow, 'start', boxA, 'right');
    bindConnectorEndpoint(arrow, 'end', boxB, 'left');
    updateConnectorBindings(page);
    assert.deepEqual({ x: arrow.x, y: arrow.y }, { x: 220, y: 140 });
    assert.deepEqual({ x: arrow.x2, y: arrow.y2 }, { x: 400, y: 140 });

    boxA.x = 140;
    boxA.y = 120;
    updateConnectorBindings(page, [boxA.id]);
    assert.deepEqual({ x: arrow.x, y: arrow.y }, { x: 260, y: 160 });

    boxB.x = 450;
    boxB.h = 100;
    updateConnectorBindings(page, [boxB.id]);
    assert.deepEqual({ x: arrow.x2, y: arrow.y2 }, { x: 450, y: 150 });

    boxA.rotation = Math.PI / 2;
    updateConnectorBindings(page, [boxA.id]);
    assert.ok(Math.abs(arrow.x - 200) < 1e-4);
    assert.ok(Math.abs(arrow.y - 220) < 1e-4);

    const clones = cloneElementsWithBindings([boxA, boxB, arrow], { x: 50, y: 50 });
    const clonedArrow = clones.find((c) => c.type === 'arrow');
    assert.equal(clonedArrow.startBinding.elementId, clones[0].id);
  });
});

describe('History Manager (Per-Page Undo/Redo)', () => {
  test('commits only when elements change and isolates history per page', () => {
    const history = new HistoryManager();
    const p1 = createPage('Page 1');
    const p2 = createPage('Page 2');
    history.initPage(p1);
    history.initPage(p2);

    assert.equal(history.commit(p1), false);
    assert.equal(history.canUndo(p1), false);

    p1.elements.push(createElement('rect', { x: 10, y: 10 }));
    assert.equal(history.commit(p1), true);
    assert.equal(history.canUndo(p1), true);
    assert.equal(history.canUndo(p2), false);

    p2.elements.push(createElement('ellipse', { x: 50, y: 50 }));
    history.commit(p2);

    history.undo(p1);
    assert.equal(p1.elements.length, 0);
    assert.equal(p2.elements.length, 1);

    history.redo(p1);
    assert.equal(p1.elements.length, 1);
  });
});

describe('Mermaid Offline Parser', () => {
  test('parses flowchart TD and sequenceDiagram and reports unsupported lines', () => {
    const flowRes = parseMermaidDiagram(`
      flowchart TD
      A[Start] --> B{Is Valid?}
      B -- Yes --> C(Process)
      subgraph UnsupportedBlock
    `);
    assert.ok(flowRes.elements.length >= 5);
    assert.equal(flowRes.warnings.length, 1);
    assert.match(flowRes.warnings[0], /Unsupported flowchart directive/i);

    const seqRes = parseMermaidDiagram(`
      sequenceDiagram
      participant Alice
      participant Bob
      Alice->>Bob: Hello Bob
      Bob-->>Alice: Hi Alice!
    `);
    assert.ok(seqRes.elements.length >= 6);
    assert.equal(seqRes.warnings.length, 0);
  });
});

describe('Save/Load Migration, SVG Export & URL Hash Sharing', () => {
  test('migrates v1 flat scene to v2 multi-page schema', () => {
    const v1Doc = {
      version: 1,
      title: 'Legacy Board',
      background: 'dots',
      camera: { x: 40, y: 60, zoom: 1.5 },
      elements: [{ id: 'r1', type: 'rect', x: 10, y: 20, w: 100, h: 60, text: 'Hello <World>' }],
    };

    const migrated = migrateSceneData(v1Doc);
    assert.equal(migrated.version, SCHEMA_VERSION);
    assert.equal(migrated.pages.length, 1);
    assert.equal(migrated.pages[0].name, 'Legacy Board');
    assert.equal(migrated.pages[0].background, 'dots');
    assert.equal(migrated.pages[0].camera.zoom, 1.5);
    assert.equal(migrated.pages[0].elements[0].text, 'Hello <World>');

    const svg = exportToSvgString(migrated, migrated.pages[0]);
    assert.ok(svg.includes('Hello &lt;World&gt;'));
    assert.equal(escapeXml(`<script>"&'`), '&lt;script&gt;&quot;&amp;&#39;');
  });

  test('round-trips .whiteboard.json, .library.json, and URL hash encoding', () => {
    const scene = createScene('dark');
    const page = scene.pages[0];
    const shape = createElement('rounded-rect', { x: 50, y: 60, w: 120, h: 80, text: 'Node 1' });
    autoGrowShapeForText(shape, 'A much longer multi-word label inside shape');
    assert.ok(shape.w > 120);
    page.elements.push(shape);

    scene.files['file_1'] = {
      id: 'file_1',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      width: 1,
      height: 1,
    };

    const json = serializeScene(scene);
    const reloaded = parseSceneJson(json);
    assert.equal(reloaded.theme, 'dark');
    assert.ok(reloaded.files['file_1']);
    assert.equal(reloaded.pages[0].elements[0].id, shape.id);

    const { hash } = encodeSceneToHash(scene);
    const fromHash = decodeSceneFromHash(hash);
    assert.equal(fromHash.pages[0].elements.length, 1);

    const libJson = exportLibraryJson([{ id: 'lib1', name: 'Item 1', elements: [shape] }]);
    const libLoaded = importLibraryJson(libJson);
    assert.equal(libLoaded.length, 1);
    assert.equal(libLoaded[0].name, 'Item 1');
  });

  test('groups, ungroups, reorders z-index, extracts styles, and collapses frames', () => {
    const page = createPage('Groups');
    const r1 = createElement('rect', { x: 100, y: 100, w: 80, h: 60, sloppy: true });
    const r2 = createElement('rect', { x: 200, y: 100, w: 80, h: 60 });
    const frame = createElement('frame', { x: 50, y: 50, w: 300, h: 200 });
    page.elements.push(frame, r1, r2);

    const style = extractStyle(r1);
    assert.equal(style.sloppy, true);

    reorderElement(page, frame.id, 'front');
    assert.equal(page.elements[page.elements.length - 1].id, frame.id);
    reorderElement(page, frame.id, 'back');
    assert.equal(page.elements[0].id, frame.id);

    const gid = groupElements(page, [r1.id, r2.id]);
    assert.ok(gid);
    assert.equal(expandSelectionWithGroups(page, [r1.id]).length, 2);

    ungroupElements(page, [r1.id]);
    assert.equal(r1.groupId, null);

    assert.equal(toggleFrameCollapse(page, frame.id), true);
    assert.equal(r1.hidden, true);
    assert.equal(toggleFrameCollapse(page, frame.id), false);
    assert.equal(r1.hidden, false);
  });
});

describe('Stencils, Templates, CanvasRenderer & Full Feature E2E Suite', () => {
  test('renders all stencils, all built-in templates, and all element types to Canvas & SVG', () => {
    assert.ok(ALL_STENCILS.length >= 35, 'Should include comprehensive stencils across 7 categories');
    const categories = getStencilsByCategory('');
    assert.ok(categories.length >= 6);
    const k8sFiltered = getStencilsByCategory('pod');
    assert.ok(k8sFiltered.some((g) => g.items.some((i) => i.id === 'k8s-pod')));

    // Verify every built-in template (general + DevOps packs + Azure/GCP) builds valid elements
    assert.ok(BUILTIN_TEMPLATES.length >= 38, 'Azure and GCP packs must stay registered');
    for (const tpl of BUILTIN_TEMPLATES) {
      const built = getTemplateById(tpl.id).build();
      assert.ok(Array.isArray(built));
    }

    const scene = createScene('light');
    const page = scene.pages[0];
    page.background = 'grid';

    // Populate page with every element type + stencils
    page.elements.push(
      createElement('pen', { points: [{ x: 10, y: 10 }, { x: 40, y: 30 }, { x: 80, y: 20 }] }),
      createElement('highlighter', { points: [{ x: 10, y: 50 }, { x: 90, y: 50 }] }),
      createElement('rect', { x: 100, y: 100, w: 120, h: 80, text: 'Rect', sloppy: true }),
      createElement('rounded-rect', { x: 240, y: 100, w: 120, h: 80, text: 'Rounded', link: 'https://example.com' }),
      createElement('ellipse', { x: 380, y: 100, w: 120, h: 80, text: 'Ellipse', sloppy: true }),
      createElement('diamond', { x: 520, y: 100, w: 120, h: 80, text: 'Diamond' }),
      createElement('sticky', { x: 660, y: 100, w: 160, h: 120, text: 'Sticky note auto wrap text' }),
      createElement('frame', { x: 80, y: 240, w: 400, h: 220, text: 'Slide 1', clip: true }),
      createElement('table', { x: 500, y: 240, w: 240, h: 140, rows: 3, cols: 3 }),
      createElement('code', { x: 760, y: 240, w: 260, h: 140, text: 'const x = 1;\nconsole.log(x);', highlightLines: '1-2' }),
      createElement('stamp', { x: 100, y: 480, w: 48, h: 48, stampKind: 'tick' }),
      createElement('stamp', { x: 160, y: 480, w: 48, h: 48, stampKind: 'star' }),
      createElement('stamp', { x: 220, y: 480, w: 48, h: 48, stampKind: 'badge', badgeValue: 3 }),
      createElement('math', { x: 300, y: 480, w: 300, h: 50, mathKind: 'ruler' }),
      createElement('math', { x: 620, y: 480, w: 220, h: 120, mathKind: 'protractor' }),
      createElement('arrow', {
        x: 220, y: 140, x2: 380, y2: 140,
        routing: 'curved', startArrow: 'circle', endArrow: 'triangle',
        strokeStyle: 'dashed', text: 'calls',
      }),
    );

    // Add one stencil from each category
    for (const st of ALL_STENCILS) {
      const stEl = getStencilById(st.id);
      page.elements.push(createElement('stencil', {
        stencilId: stEl.id, x: 120, y: 120, w: stEl.defaultW, h: stEl.defaultH, text: stEl.defaultText,
      }));
    }

    const mockCanvas = createMockCanvas(1440, 900);
    const renderer = new CanvasRenderer(mockCanvas);
    renderer.resize(1440, 900, 2);

    renderer.render({
      scene,
      page,
      selectedIds: new Set([page.elements[2].id]),
      hoveredElement: page.elements[2],
      hoveredPort: 'right',
      marqueeBox: { x: 10, y: 10, w: 50, h: 50 },
      smartGuides: [{ type: 'vertical', x: 100, y1: 0, y2: 500 }],
      laserTrail: [{ x: 50, y: 50, time: Date.now() }, { x: 90, y: 80, time: Date.now() }],
      spotlight: { active: true, magnifier: false, x: 400, y: 300, radius: 120 },
      presentState: { active: false, slideIndex: 0, revealStep: 0, maxRevealStep: 0 },
      cropState: null,
      editingElementId: null,
    });
    assert.ok(mockCanvas.ops.length > 100, 'CanvasRenderer should execute drawing commands for all elements');

    const svgStr = exportToSvgString(scene, page, { background: true });
    assert.ok(svgStr.startsWith('<svg'));
    assert.ok(svgStr.includes('Sticky note'));
    assert.ok(svgStr.includes('const x = 1;'));
  });
});

import { getAllCategories } from '../stencils/index.js';
import {
  buildClassroomShareHash,
  parseClassroomHash,
  pointAtBoardLocation,
  attachQuestionToBoard,
} from '../ui/classroom.js';

describe('DevOps Icon Library, Arrangement, Multi-Resize & Live Classroom', () => {
  test('provides comprehensive DevOps categories and multi-token search', () => {
    const categories = getAllCategories();
    const expected = [
      'AWS',
      'Azure',
      'GCP',
      'Linux',
      'Docker & Containers',
      'Kubernetes',
      'Networking',
      'Git & Source Control',
      'CI/CD & GitOps',
      'Infrastructure as Code',
      'Config Management',
      'Monitoring & Logging',
      'Security & Secrets',
      'Databases, Storage & Messaging',
    ];
    for (const cat of expected) {
      assert.ok(categories.includes(cat), `Missing category: ${cat}`);
    }
    assert.ok(ALL_STENCILS.length >= 130, `Expected 130+ stencils, got ${ALL_STENCILS.length}`);

    const awsSearch = getStencilsByCategory('aws eks');
    assert.ok(awsSearch.some((g) => g.items.some((i) => i.id === 'aws-eks')));

    const tfSearch = getStencilsByCategory('terraform hcl');
    assert.ok(tfSearch.some((g) => g.items.some((i) => i.id === 'iac-terraform')));

    const azureOnly = getStencilsByCategory('', 'Azure');
    assert.equal(azureOnly.length, 1);
    assert.equal(azureOnly[0].category, 'Azure');
  });

  test('arranges multiple components in row, column, and grid and exposes multi-selection resize handles', () => {
    const a = createElement('stencil', { stencilId: 'aws-ec2', x: 500, y: 400, w: 152, h: 98 });
    const b = createElement('stencil', { stencilId: 'aws-rds', x: 100, y: 120, w: 152, h: 98 });
    const c = createElement('stencil', { stencilId: 'aws-s3', x: 300, y: 260, w: 152, h: 98 });
    const items = [a, b, c];

    arrangeElements(items, 'row', 40, 40);
    assert.equal(a.y, b.y);
    assert.equal(b.y, c.y);
    assert.ok(a.x < b.x && b.x < c.x);

    arrangeElements(items, 'column', 40, 40);
    assert.equal(a.x, b.x);
    assert.ok(a.y < b.y && b.y < c.y);

    const handles = getMultiSelectionHandles({ x: 100, y: 120, w: 300, h: 200 });
    assert.equal(handles.length, 8);
    const seHit = hitTestMultiSelectionHandle({ x: 100, y: 120, w: 300, h: 200 }, 400, 320, 1);
    assert.equal(seHit?.id, 'se');
  });

  test('snaps connectors in auto mode when hovering inside a component body and explicit port on port dot', () => {
    const page = createPage('Snap Page');
    const eks = createElement('stencil', { stencilId: 'aws-eks', x: 200, y: 200, w: 152, h: 98, text: 'EKS Cluster' });
    page.elements.push(eks);

    // Hover near right side inside component body -> automatic boundary mode ('auto') with resolvedPort 'right'
    const bodySnap = findHoverPort(page, 330, 248, 18);
    assert.ok(bodySnap, 'Should snap when pointer is inside component body');
    assert.equal(bodySnap.elementId, eks.id);
    assert.equal(bodySnap.port, 'auto');
    assert.equal(bodySnap.resolvedPort, 'right');

    // Hover directly on top port dot -> explicit port ('top')
    const topPortSnap = findHoverPort(page, 276, 200, 18);
    assert.equal(topPortSnap.port, 'top');
    assert.equal(topPortSnap.isExplicitPort, true);
  });

  test('encodes shareable classroom links, points at components, and keeps question pins attached on move and anchor deletion', () => {
    const scene = createScene('light');
    const page = scene.pages[0];
    const k8sPod = createElement('stencil', {
      stencilId: 'k8s-pod',
      x: 300,
      y: 250,
      w: 152,
      h: 98,
      text: 'Payment Pod',
    });
    page.elements.push(k8sPod);

    // 1. Point at component
    const ping = pointAtBoardLocation(page, { x: 350, y: 280 }, { authorName: 'Maya Lin' });
    assert.equal(ping.authorName, 'Maya Lin');
    assert.equal(ping.targetElementId, k8sPod.id);
    assert.equal(ping.targetElementName, 'Payment Pod');

    // 2. Attach question pin to component
    const qPin = attachQuestionToBoard(
      page,
      { x: 350, y: 280 },
      { authorName: 'Maya Lin', questionText: 'How does HPA scale this pod?' }
    );
    assert.equal(qPin.type, 'question');
    assert.equal(qPin.targetElementId, k8sPod.id);
    assert.equal(qPin.targetElementName, 'Payment Pod');

    // 3. Move component and verify attached question pin moves with it
    const initialPinX = qPin.x;
    const initialPinY = qPin.y;
    k8sPod.x += 120;
    k8sPod.y += 60;
    updateConnectorBindings(page, [k8sPod.id]);
    assert.equal(qPin.x, initialPinX + 120);
    assert.equal(qPin.y, initialPinY + 60);

    // 4. Shareable classroom link round-trip
    const { hash } = buildClassroomShareHash(scene, 'K8S-LAB');
    assert.ok(hash.startsWith('#classroom=1&room=K8S-LAB&scene='));
    const parsed = parseClassroomHash(hash);
    assert.equal(parsed.isClassroom, true);
    assert.equal(parsed.room, 'K8S-LAB');
    assert.equal(parsed.scene.pages[0].elements.length, 2);
  });
});


// ---------------------------------------------------------------------------
// Notebook / persistence regression suite (Stage A reliability + Stage C view)
// ---------------------------------------------------------------------------
describe('Notes Persistence, Page Geometry & Route Sanitization', () => {
  test('page notes persist including an explicitly cleared empty value', () => {
    const scene = createScene();
    const page = scene.pages[0];
    page.teacherNotes = 'Marker: chapter 4 recap';
    let clean = sanitizeSceneForPersistence(scene);
    assert.equal(clean.pages[0].teacherNotes, 'Marker: chapter 4 recap');

    page.teacherNotes = '';
    clean = sanitizeSceneForPersistence(scene);
    assert.ok(
      Object.prototype.hasOwnProperty.call(clean.pages[0], 'teacherNotes'),
      'cleared notes must persist as an explicit empty string, not a missing field'
    );
    assert.equal(clean.pages[0].teacherNotes, '');

    // Student/room serialization still never carries teacher notes.
    const student = sanitizeSceneForPersistence(scene, { stripNotes: true });
    assert.equal(student.pages[0].teacherNotes, undefined);
  });

  test('pages carry durable teaching dimensions through save and migration', () => {
    const scene = createScene();
    scene.pages[0].width = 1600;
    scene.pages[0].height = 900;
    const roundTripped = parseSceneJson(serializeScene(scene));
    assert.equal(roundTripped.pages[0].width, 1600);
    assert.equal(roundTripped.pages[0].height, 900);

    const legacy = migrateSceneData({ version: 2, pages: [{ id: 'p1', name: 'Old', elements: [] }] });
    assert.equal(legacy.pages[0].width, 1280);
    assert.equal(legacy.pages[0].height, 720);
  });

  test('debounced autosave flush persists a pending edit inside the debounce window', () => {
    const store = new Map();
    const previous = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    try {
      const scene = createScene();
      scene.pages[0].teacherNotes = 'typed but not yet flushed';
      const schedule = createDebouncedAutosave(600, null, null);
      schedule(scene);
      assert.equal(schedule.hasPending(), true);
      assert.equal(store.get('classroom_whiteboard_scene_v2'), undefined);
      schedule.flush();
      assert.equal(schedule.hasPending(), false);
      const written = store.get('classroom_whiteboard_scene_v2');
      assert.ok(written, 'flush must write synchronously');
      assert.match(written, /typed but not yet flushed/);
    } finally {
      if (previous === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previous;
    }
  });

  test('route sanitization removes NaN, duplicate and collinear points', () => {
    const pts = sanitizeRoutePoints(
      [
        { x: 0, y: 0 },
        { x: NaN, y: 10 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 80 },
      ],
      { x: 0, y: 0 }
    );
    assert.deepEqual(pts, [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 80 },
    ]);
    for (const p of pts) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  });

  test('aligned bound connectors stay straight with no zigzag bends', () => {
    const scene = createScene();
    const page = scene.pages[0];
    const a = createElement('rect', { x: 100, y: 100, w: 120, h: 80, text: 'A' });
    const b = createElement('rect', { x: 400, y: 100, w: 120, h: 80, text: 'B' });
    page.elements.push(a, b);
    const conn = createElement('arrow', {
      x: a.x + a.w,
      y: a.y + a.h / 2,
      x2: b.x,
      y2: b.y + b.h / 2,
      routing: 'orthogonal',
      startBinding: { elementId: a.id, port: 'right', resolvedPort: 'right' },
      endBinding: { elementId: b.id, port: 'left', resolvedPort: 'left' },
    });
    const pts = getConnectorPoints(conn, page);
    assert.equal(pts.length, 2, 'aligned connectors should be a single straight segment');
  });

  test('auto routing keeps a clear path straight and bends around an obstacle without NaN', () => {
    const scene = createScene();
    const page = scene.pages[0];
    const connClear = createElement('arrow', { x: 0, y: 0, x2: 200, y2: 0, routing: 'auto' });
    const clearPts = getConnectorPoints(connClear, page);
    assert.equal(clearPts.length, 2, 'auto routing should not add bends to an unobstructed path');

    page.elements.push(createElement('rect', { x: 80, y: -40, w: 60, h: 80, text: 'blocker' }));
    const blockedPts = getConnectorPoints(connClear, page);
    assert.ok(blockedPts.length > 2, 'auto routing should detour around an obstacle');
    for (const p of blockedPts) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'route points must stay finite');
    }
  });
});

describe('Table element factory', () => {
  test('createTableElementData clamps rows and columns', () => {
    const data = createTableElementData({ rows: 3, cols: 4 });
    assert.equal(data.rows, 3);
    assert.equal(data.cols, 4);
    assert.equal(data.cells.length, 3);
    assert.equal(data.cells[0].length, 4);
    assert.equal(createTableElementData({ rows: 0, cols: 0 }).rows, 3);
    assert.equal(createTableElementData({ rows: 1e9 }).rows, 200);
  });
});
