// tests/fixtures.js — Comprehensive Test Fixtures for Legacy/v1, Multi-Page, Stencils, Connectors, Code, Questions & Freehand
import { createScene, createPage, createElement, SCHEMA_VERSION } from '../scene/model.js';
import { bindConnectorEndpoint } from '../scene/bindings.js';

/**
 * Legacy v1 schema document (missing version=2, activePageId, files, settings, and newer element fields)
 */
export function createLegacyV1Fixture() {
  return {
    version: 1,
    title: 'Legacy Architecture v1',
    theme: 'light',
    pages: [
      {
        id: 'legacy_page_1',
        name: 'Legacy Main',
        elements: [
          {
            id: 'leg_rect_1',
            type: 'rect',
            x: 100,
            y: 120,
            w: 160,
            h: 90,
            text: 'Legacy Ingress',
            stroke: '#1e293b',
            fill: '#bfdbfe',
          },
          {
            id: 'leg_arrow_1',
            type: 'arrow',
            x: 260,
            y: 165,
            x2: 420,
            y2: 165,
            stroke: '#1e293b',
          },
          {
            id: 'leg_pen_1',
            type: 'pen',
            x: 120,
            y: 260,
            points: [
              { x: 120, y: 260 },
              { x: 180, y: 280 },
              { x: 240, y: 255 },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Rich multi-page board containing stencils, bound connectors, images, code blocks, tables, question pins, and large freehand strokes
 */
export function createComprehensiveBoardFixture() {
  const scene = createScene('light');
  scene.title = 'DevOps Reference & Teaching Board';

  const page1 = scene.pages[0];
  page1.name = '1. Cloud & K8s';

  const ec2 = createElement('stencil', {
    id: 'fix_ec2',
    stencilId: 'aws-ec2',
    category: 'AWS Architecture',
    name: 'Amazon EC2',
    text: 'Amazon EC2',
    x: 120,
    y: 140,
    w: 156,
    h: 114,
  });

  const s3 = createElement('stencil', {
    id: 'fix_s3',
    stencilId: 'aws-s3',
    category: 'AWS Architecture',
    name: 'Amazon S3',
    text: 'Amazon S3',
    x: 380,
    y: 140,
    w: 156,
    h: 114,
  });

  const conn = createElement('arrow', {
    id: 'fix_conn_1',
    x: 276,
    y: 197,
    x2: 380,
    y2: 197,
    routing: 'orthogonal',
    startArrow: 'none',
    endArrow: 'arrow',
    strokeStyle: 'solid',
    text: 'HTTPS 443',
  });
  bindConnectorEndpoint(conn, 'start', ec2, 'auto');
  bindConnectorEndpoint(conn, 'end', s3, 'auto');

  const codeBlock = createElement('code', {
    id: 'fix_code_1',
    x: 120,
    y: 310,
    w: 340,
    h: 160,
    text: 'apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api',
    highlightLines: '2,4',
  });

  const questionPin = createElement('question', {
    id: 'fix_question_1',
    x: 490,
    y: 104,
    w: 210,
    h: 74,
    authorName: 'Maya',
    text: 'Does S3 replication use IAM roles?',
    targetElementId: s3.id,
    targetElementName: s3.name,
    offsetX: 110,
    offsetY: -36,
    reply: 'Yes, via bucket replication IAM policy.',
    resolved: false,
  });

  // Large freehand stroke (250 points)
  const largePoints = [];
  for (let i = 0; i < 250; i++) {
    largePoints.push({
      x: 120 + i * 2.2,
      y: 520 + Math.round(Math.sin(i * 0.15) * 24),
    });
  }
  const largeStroke = createElement('pen', {
    id: 'fix_large_stroke',
    points: largePoints,
    strokeWidth: 4,
    stroke: '#2563eb',
  });

  // Embedded SVG data URL image
  const fileId = 'file_arch_badge';
  scene.files[fileId] = {
    id: fileId,
    mimeType: 'image/svg+xml',
    width: 120,
    height: 80,
    dataUrl:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" rx="8" fill="#dbeafe"/><text x="60" y="45" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#1e40af">VPC Diagram</text></svg>'
      ),
  };
  const imgEl = createElement('image', {
    id: 'fix_image_1',
    fileId,
    x: 520,
    y: 310,
    w: 160,
    h: 110,
  });

  page1.elements.push(ec2, s3, conn, codeBlock, questionPin, largeStroke, imgEl);

  const page2 = createPage('2. Incident Runbook', 'fix_page_2');
  const sticky = createElement('sticky', {
    id: 'fix_sticky_2',
    x: 160,
    y: 140,
    w: 200,
    h: 180,
    text: 'Step 1: Check Prometheus alerts
Step 2: Inspect pod logs',
  });
  page2.elements.push(sticky);
  scene.pages.push(page2);

  return scene;
}
