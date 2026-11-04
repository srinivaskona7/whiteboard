// ui/registry.js
import { createElement, uid } from '../scene/model.js';
import { bindConnectorEndpoint } from '../scene/bindings.js';

const svg = (inner) =>
  `<svg class="wb-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export function isMacPlatform() {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
}

export function getShortcutLabel(action) {
  const mac = isMacPlatform();
  const map = {
    undo: mac ? '⌘Z' : 'Ctrl+Z',
    redo: mac ? '⇧⌘Z' : 'Ctrl+Shift+Z',
    palette: mac ? '⌘K' : 'Ctrl+K',
    group: mac ? '⌘G' : 'Ctrl+G',
    ungroup: mac ? '⇧⌘G' : 'Ctrl+Shift+G',
    duplicate: mac ? '⌘D' : 'Ctrl+D',
  };
  return map[action] || '';
}

export const ICONS = {
  select: svg('<path d="M4 3l7 17 2.5-6.5L20 11z"/>'),
  lasso: svg('<path d="M7 22a5 5 0 0 1-2-4"/><path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1"/><circle cx="5" cy="18" r="2"/>'),
  hand: svg('<path d="M18 11V6a2 2 0 0 0-4 0v4"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.4 16.8a2 2 0 0 1 2.8-2.8L8 15.8"/>'),
  pen: svg('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.5 7.5"/>'),
  highlighter: svg('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
  eraser: svg('<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>'),
  rect: svg('<rect x="3" y="5" width="18" height="14" rx="1"/>'),
  'rounded-rect': svg('<rect x="3" y="5" width="18" height="14" rx="4"/>'),
  ellipse: svg('<ellipse cx="12" cy="12" rx="9" ry="7"/>'),
  diamond: svg('<polygon points="12 3 21 12 12 21 3 12"/>'),
  line: svg('<line x1="5" y1="19" x2="19" y2="5"/>'),
  arrow: svg('<line x1="5" y1="19" x2="19" y2="5"/><polyline points="10 5 19 5 19 14"/>'),
  text: svg('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
  sticky: svg('<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><polyline points="15 3 15 9 21 9"/>'),
  frame: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'),
  table: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>'),
  code: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  stamp: svg('<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>'),
  laser: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.9 4.9 2.8 2.8"/><path d="m16.3 16.3 2.8 2.8"/><path d="M2 12h4"/><path d="M18 12h4"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
  plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  library: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  layers: svg('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
  mermaid: svg('<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><line x1="8.7" y1="7.5" x2="12" y2="15"/><line x1="15.3" y1="7.5" x2="12" y2="15"/>'),
  teaching: svg('<path d="M2 3h20v14H2z"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
  spotlight: svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  vote: svg('<circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/>'),
  timer: svg('<circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14.5 14.5"/><line x1="9" y1="2" x2="15" y2="2"/>'),
  present: svg('<polygon points="5 3 19 12 5 21 5 3"/>'),
  save: svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>'),
  open: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  export: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>'),
  sun: svg('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>'),
  moon: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  fullscreen: svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
  palette: svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  settings: svg('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
  history: svg('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><polyline points="12 7 12 12 15 15"/>'),
  pointer: svg('<circle cx="12" cy="10" r="3"/><circle cx="12" cy="10" r="7" stroke-dasharray="3 2"/><path d="M12 17v5"/><path d="M9 20h6"/>'),
  question: svg('<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5"/><circle cx="12" cy="16" r="0.6" fill="currentColor"/>'),
  classroom: svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  logo: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 10h8M8 14h5"/>'),
  undo: svg('<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>'),
  redo: svg('<polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>'),
  sliders: svg('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
  timeline: svg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'),
  annotation: svg('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>'),
  focus: svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
  search: svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  theme: svg('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>'),
  menu: svg('<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>'),
  folder: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  keyboard: svg('<rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="8" y1="16" x2="16" y2="16"/>'),
  lock: svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
};

export const TOOL_REGISTRY = [
  // Primary Visible Dock Tools (clean, uncluttered default toolbar)
  { id: 'select', label: 'Select', shortcut: 'V', group: 'dock', icon: ICONS.select },
  { id: 'hand', label: 'Pan / Hand', shortcut: 'H', group: 'dock', icon: ICONS.hand },
  { id: 'pen', label: 'Freehand Pen', shortcut: 'P', group: 'dock', icon: ICONS.pen },
  { id: 'highlighter', label: 'Highlighter', shortcut: 'M', group: 'dock', icon: ICONS.highlighter },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', group: 'dock', icon: ICONS.eraser },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', group: 'dock', icon: ICONS.rect },
  { id: 'rounded-rect', label: 'Rounded Rect', shortcut: 'U', group: 'dock', icon: ICONS['rounded-rect'] },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O', group: 'dock', icon: ICONS.ellipse },
  { id: 'diamond', label: 'Decision Diamond', shortcut: 'D', group: 'dock', icon: ICONS.diamond },
  { id: 'line', label: 'Line', shortcut: 'L', group: 'dock', icon: ICONS.line },
  { id: 'arrow', label: 'Smart Connector Arrow', shortcut: 'A', group: 'dock', icon: ICONS.arrow },
  { id: 'text', label: 'Text', shortcut: 'T', group: 'dock', icon: ICONS.text },
  { id: 'sticky', label: 'Sticky Note', shortcut: 'N', group: 'dock', icon: ICONS.sticky },
  // Spotlight is a mode, not a drawing tool: clicking it toggles the spotlight
  // instead of entering a placement tool (see setTool). Dot voting likewise.
  { id: 'spotlight', label: 'Spotlight Mode', shortcut: 'F7', group: 'dock', icon: ICONS.spotlight },
  { id: 'vote', label: 'Dot Voting Mode', shortcut: 'Shift+V', group: 'dock', icon: ICONS.vote },
  { id: 'pointer', label: 'Point at Component (Classroom)', shortcut: 'W', group: 'dock', icon: ICONS.pointer },
  { id: 'question', label: 'Pin Question to Board', shortcut: 'Q', group: 'dock', icon: ICONS.question },

  // Secondary Tools under Insert (+) Menu (also directly reachable by keyboard shortcut)
  { id: 'lasso', label: 'Lasso Select', shortcut: 'Shift+L', group: 'insert', icon: ICONS.lasso },
  { id: 'frame', label: 'Frame / Slide Container', shortcut: 'F2', group: 'insert', icon: ICONS.frame },
  { id: 'table', label: 'Editable Table', shortcut: 'B', group: 'insert', icon: ICONS.table },
  { id: 'code', label: 'Code Block', shortcut: 'J', group: 'insert', icon: ICONS.code },
  { id: 'stamp', label: 'Classroom Stamp', shortcut: 'S', group: 'insert', icon: ICONS.stamp },
  { id: 'laser', label: 'Laser Pointer', shortcut: 'K', group: 'teaching', icon: ICONS.laser },
];

export function formatShortcut(shortcut = '', mac = isMacPlatform()) {
  if (!shortcut) return '';
  if (mac) {
    return shortcut
      .replace(/Ctrl\/Cmd\s*\+\s*/gi, '⌘')
      .replace(/Shift\s*\+\s*/gi, '⇧')
      .replace(/Alt\s*\+\s*/gi, '⌥');
  }
  return shortcut.replace(/Ctrl\/Cmd/gi, 'Ctrl');
}

export const SHORTCUT_REFERENCE = [
  ...TOOL_REGISTRY.map((t) => ({ key: t.shortcut, desc: `${t.label} Tool` })),
  { key: 'Shift + Q', desc: 'Toggle Keep Active Tool Locked' },
  { key: 'I', desc: 'Insert Image from File' },
  { key: 'Double-Click', desc: 'Edit Shape, Connector, or Table Cell Text' },
  { key: 'Alt + W', desc: 'Wrap Text into Shape / Unwrap Shape Label' },
  { key: 'Ctrl/Cmd + Z', desc: 'Undo (Isolated per Page)' },
  { key: 'Ctrl/Cmd + Shift + Z', desc: 'Redo (Isolated per Page)' },
  { key: 'Ctrl/Cmd + C / X / V', desc: 'Copy / Cut / Paste (Cascading Offset)' },
  { key: 'Ctrl/Cmd + D / Alt+Drag', desc: 'Duplicate / Clone Selection' },
  { key: 'Ctrl/Cmd + A', desc: 'Select All Elements on Page' },
  { key: 'Ctrl/Cmd + G / Shift+G', desc: 'Group / Ungroup Selection' },
  { key: '[ / ]', desc: 'Send to Back / Bring to Front' },
  { key: 'Arrows / Shift+Arrows', desc: 'Nudge Selection 1px / 10px' },
  { key: 'Shift + Rotate / Line', desc: 'Snap Angle to 15° Increments' },
  { key: 'Space + Drag', desc: 'Pan Canvas Anywhere' },
  { key: '+ / - / 0 / 1', desc: 'Zoom In / Out / 100% / Fit to Content' },
  { key: 'F / Shift+F', desc: 'Toggle Full Screen / Teaching Focus Mode' },
  { key: 'Ctrl/Cmd + K', desc: 'Open Command Palette' },
  { key: '/', desc: 'Cursor Chat — Type at Your Pointer, Enter to Send' },
  { key: 'Esc', desc: 'Close Menu / Dialog, or Exit Spotlight Mode' },
  { key: '?', desc: 'Open Keyboard Shortcuts Reference' },
];

export function buildDevOpsDiagramPacks() {
  const makeFlowPack = (id, name, nodes, edges) => {
    const build = () => {
      const groupId = uid('grp');
      const els = [];
      const map = new Map();
      for (const n of nodes) {
        const el = createElement(n.type || 'rounded-rect', {
          x: n.x,
          y: n.y,
          w: n.w || 156,
          h: n.h || 74,
          text: n.text,
          fill: n.fill || '#eff6ff',
          stroke: n.stroke || '#1e293b',
          stencilId: n.stencilId,
          groupId,
          revealStep: n.revealStep || 0,
        });
        map.set(n.key, el);
        els.push(el);
      }
      for (const [fromKey, toKey, label, fromPort = 'right', toPort = 'left'] of edges) {
        const a = map.get(fromKey);
        const b = map.get(toKey);
        if (!a || !b) continue;
        const conn = createElement('arrow', {
          x: a.x + a.w,
          y: a.y + a.h / 2,
          x2: b.x,
          y2: b.y + b.h / 2,
          text: label || '',
          routing: 'orthogonal',
          groupId,
        });
        bindConnectorEndpoint(conn, 'start', a, fromPort);
        bindConnectorEndpoint(conn, 'end', b, toPort);
        els.push(conn);
      }
      return els;
    };
    return {
      id,
      name,
      build,
      get elements() {
        return build();
      },
    };
  };

  return [
    makeFlowPack(
      'pack-linux-boot',
      'Linux Boot Process (BIOS → systemd)',
      [
        { key: 'bios', x: 80, y: 160, text: `1. BIOS / UEFI
POST & Boot Device`, fill: '#fef9c3', revealStep: 1 },
        { key: 'grub', x: 290, y: 160, text: `2. GRUB2
Loads vmlinuz`, fill: '#dbeafe', revealStep: 2 },
        { key: 'kern', x: 500, y: 160, text: `3. Linux Kernel
+ initramfs`, fill: '#dcfce7', revealStep: 3 },
        { key: 'sysd', x: 710, y: 160, text: `4. systemd (PID 1)
default.target`, fill: '#f3e8ff', revealStep: 4 },
      ],
      [
        ['bios', 'grub', 'MBR/GPT'],
        ['grub', 'kern', 'initrd'],
        ['kern', 'sysd', 'pivot_root'],
      ]
    ),
    makeFlowPack(
      'pack-dns-flow',
      'DNS Resolution Flow (Recursive Lookup)',
      [
        { key: 'client', x: 80, y: 180, text: `Client Stub
Resolver`, fill: '#f1f5f9', revealStep: 1 },
        { key: 'rec', x: 290, y: 180, text: `Recursive
Resolver (ISP/8.8.8.8)`, fill: '#dbeafe', revealStep: 1 },
        { key: 'root', x: 540, y: 70, text: `1. Root (.)
Nameserver`, fill: '#fef9c3', revealStep: 2 },
        { key: 'tld', x: 540, y: 180, text: `2. TLD (.com)
Nameserver`, fill: '#fed7aa', revealStep: 3 },
        { key: 'auth', x: 540, y: 290, text: `3. Authoritative
Nameserver`, fill: '#dcfce7', revealStep: 4 },
      ],
      [
        ['client', 'rec', 'A? app.com'],
        ['rec', 'root', 'Query .'],
        ['rec', 'tld', 'Query .com'],
        ['rec', 'auth', 'IP Record'],
      ]
    ),
    makeFlowPack(
      'pack-tcp-tls',
      'TCP 3-Way + TLS 1.3 Handshake',
      [
        { key: 'syn', x: 90, y: 150, text: `1. TCP SYN
Client → Server`, fill: '#dbeafe', revealStep: 1 },
        { key: 'synack', x: 300, y: 150, text: `2. TCP SYN-ACK
Server → Client`, fill: '#dcfce7', revealStep: 2 },
        { key: 'ack', x: 510, y: 150, text: `3. ACK + ClientHello
Key Share`, fill: '#fef9c3', revealStep: 3 },
        { key: 'tls', x: 720, y: 150, text: `4. ServerHello + Cert
Encrypted App Data`, fill: '#f3e8ff', revealStep: 4 },
      ],
      [
        ['syn', 'synack', 'RTT 1'],
        ['synack', 'ack', 'Established'],
        ['ack', 'tls', 'TLS 1.3 (1-RTT)'],
      ]
    ),
    makeFlowPack(
      'pack-docker-lifecycle',
      'Docker Image & Container Lifecycle',
      [
        // These ids once pointed at stencils that were never registered, so the
        // cards silently rendered the fallback stencil (ALL_STENCILS[0]). The
        // registry's own equivalents carry the right art for each step.
        { key: 'df', type: 'stencil', stencilId: 'docker-image', x: 80, y: 150, w: 130, h: 104, text: '1. Dockerfile', revealStep: 1 },
        { key: 'img', type: 'stencil', stencilId: 'docker-container', x: 280, y: 150, w: 130, h: 104, text: '2. OCI Image Layers', revealStep: 2 },
        { key: 'reg', type: 'stencil', stencilId: 'docker-registry', x: 480, y: 150, w: 130, h: 104, text: '3. Container Registry', revealStep: 3 },
        { key: 'rt', type: 'stencil', stencilId: 'docker-containerd', x: 680, y: 150, w: 130, h: 104, text: '4. containerd Runtime', revealStep: 4 },
      ],
      [
        ['df', 'img', 'docker build'],
        ['img', 'reg', 'docker push'],
        ['reg', 'rt', 'pull & run'],
      ]
    ),
    makeFlowPack(
      'pack-k8s-flow',
      'Kubernetes Request Flow (Ingress → PVC)',
      [
        { key: 'ing', type: 'stencil', stencilId: 'k8s-ingress', x: 80, y: 150, w: 130, h: 104, text: '1. Ingress Controller', revealStep: 1 },
        { key: 'svc', type: 'stencil', stencilId: 'k8s-svc', x: 280, y: 150, w: 130, h: 104, text: '2. ClusterIP Service', revealStep: 2 },
        { key: 'pod', type: 'stencil', stencilId: 'k8s-pod', x: 480, y: 150, w: 130, h: 104, text: '3. App Pod', revealStep: 3 },
        { key: 'pvc', type: 'stencil', stencilId: 'k8s-pvc', x: 680, y: 150, w: 130, h: 104, text: '4. PersistentVolumeClaim', revealStep: 4 },
      ],
      [
        ['ing', 'svc', 'HTTPS / L7'],
        ['svc', 'pod', 'Endpoints'],
        ['pod', 'pvc', 'Mount /data'],
      ]
    ),
    makeFlowPack(
      'pack-cicd-gitops',
      'CI/CD & GitOps Delivery Pipeline',
      [
        { key: 'git', type: 'stencil', stencilId: 'git-repo', x: 70, y: 150, w: 130, h: 104, text: '1. Git Commit', revealStep: 1 },
        { key: 'gha', type: 'stencil', stencilId: 'cicd-gh-actions', x: 260, y: 150, w: 130, h: 104, text: '2. GitHub Actions CI', revealStep: 2 },
        { key: 'reg', type: 'stencil', stencilId: 'docker-registry', x: 450, y: 150, w: 130, h: 104, text: '3. OCI Registry', revealStep: 3 },
        { key: 'argo', type: 'stencil', stencilId: 'cicd-argocd', x: 640, y: 150, w: 130, h: 104, text: '4. Argo CD Sync', revealStep: 4 },
      ],
      [
        ['git', 'gha', 'PR / Push'],
        ['gha', 'reg', 'Signed Image'],
        ['reg', 'argo', 'Reconcile K8s'],
      ]
    ),
    makeFlowPack(
      'pack-cloud-network',
      'Cloud Network Architecture (VPC + ALB + EC2 + RDS)',
      [
        { key: 'r53', type: 'stencil', stencilId: 'aws-route53', x: 70, y: 150, w: 130, h: 104, text: '1. Route 53 DNS', revealStep: 1 },
        { key: 'alb', type: 'stencil', stencilId: 'aws-alb', x: 260, y: 150, w: 130, h: 104, text: '2. Public ALB', revealStep: 2 },
        { key: 'ec2', type: 'stencil', stencilId: 'aws-ec2', x: 450, y: 150, w: 130, h: 104, text: '3. Private EC2 Tier', revealStep: 3 },
        { key: 'rds', type: 'stencil', stencilId: 'aws-rds', x: 640, y: 150, w: 130, h: 104, text: '4. Multi-AZ RDS', revealStep: 4 },
      ],
      [
        ['r53', 'alb', 'TLS 443'],
        ['alb', 'ec2', 'HTTP 8080'],
        ['ec2', 'rds', 'TCP 5432'],
      ]
    ),
    makeFlowPack(
      'pack-monitoring-incident',
      'Monitoring, Observability & Incident Response',
      [
        { key: 'otel', type: 'stencil', stencilId: 'obs-otel', x: 70, y: 150, w: 130, h: 104, text: '1. OTel Collector', revealStep: 1 },
        { key: 'prom', type: 'stencil', stencilId: 'obs-prometheus', x: 260, y: 150, w: 130, h: 104, text: '2. Prometheus TSDB', revealStep: 2 },
        { key: 'graf', type: 'stencil', stencilId: 'obs-grafana', x: 450, y: 150, w: 130, h: 104, text: '3. Grafana SLO Dash', revealStep: 3 },
        { key: 'inc', x: 640, y: 165, w: 156, h: 74, text: `4. Pager Alert &
Incident Runbook`, fill: '#fee2e2', stroke: '#dc2626', revealStep: 4 },
      ],
      [
        ['otel', 'prom', 'Scrape / OTLP'],
        ['prom', 'graf', 'PromQL'],
        ['graf', 'inc', 'Alert Firing'],
      ]
    ),
  ];
}
