// render/themes.js

export const THEME_ORDER = ['excalidraw', 'light', 'dark'];

export const THEMES = {
  // Excalidraw-style default: warm white canvas, subtle dot grid, near-black
  // ink, and a violet selection accent — the familiar hand-drawn whiteboard feel.
  excalidraw: {
    name: 'excalidraw',
    canvasBg: '#fdfcf9',
    gridMajor: 'rgba(30, 30, 30, 0.10)',
    gridMinor: 'rgba(30, 30, 30, 0.05)',
    dotsColor: 'rgba(30, 30, 30, 0.16)',
    defaultStroke: '#1e1e1e',
    defaultText: '#1e1e1e',
    selectionStroke: '#6965db',
    selectionFill: 'rgba(105, 101, 219, 0.08)',
    handleFill: '#ffffff',
    handleStroke: '#6965db',
    portFill: '#6965db',
    portHoverFill: '#4c46c4',
    guideStroke: '#e64980',
    frameBg: 'rgba(241, 240, 236, 0.6)',
    frameBorder: '#b8b8b8',
    frameHeaderBg: '#ecebe6',
    frameTitle: '#4a4a4a',
    connectorLabelBg: 'rgba(253, 252, 249, 0.94)',
  },
  light: {
    name: 'light',
    canvasBg: '#f8fafc',
    gridMajor: 'rgba(148, 163, 184, 0.18)',
    gridMinor: 'rgba(148, 163, 184, 0.09)',
    dotsColor: 'rgba(100, 116, 139, 0.24)',
    defaultStroke: '#1e293b',
    defaultText: '#0f172a',
    selectionStroke: '#2563eb',
    selectionFill: 'rgba(37, 99, 235, 0.08)',
    handleFill: '#ffffff',
    handleStroke: '#2563eb',
    portFill: '#3b82f6',
    portHoverFill: '#1d4ed8',
    guideStroke: '#ec4899',
    frameBg: 'rgba(241, 245, 249, 0.72)',
    frameBorder: '#94a3b8',
    frameHeaderBg: '#e2e8f0',
    frameTitle: '#334155',
    connectorLabelBg: 'rgba(255, 255, 255, 0.92)',
  },
  dark: {
    name: 'dark',
    canvasBg: '#0f172a',
    gridMajor: 'rgba(148, 163, 184, 0.12)',
    gridMinor: 'rgba(148, 163, 184, 0.06)',
    dotsColor: 'rgba(148, 163, 184, 0.20)',
    defaultStroke: '#e2e8f0',
    defaultText: '#f8fafc',
    selectionStroke: '#60a5fa',
    selectionFill: 'rgba(96, 165, 250, 0.12)',
    handleFill: '#1e293b',
    handleStroke: '#60a5fa',
    portFill: '#60a5fa',
    portHoverFill: '#93c5fd',
    guideStroke: '#f472b6',
    frameBg: 'rgba(30, 41, 59, 0.65)',
    frameBorder: '#475569',
    frameHeaderBg: '#1e293b',
    frameTitle: '#e2e8f0',
    connectorLabelBg: 'rgba(15, 23, 42, 0.92)',
  },
};

export const FONT_MAP = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  mono: '"JetBrains Mono", "Fira Code", Menlo, Monaco, Consolas, monospace',
  hand: '"Comic Sans MS", "Bradley Hand", "Chalkboard SE", cursive, sans-serif',
};

export const PALETTE_STROKE_COLORS = [
  '#1e293b',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#0891b2',
  '#2563eb',
  '#7c3aed',
  '#db2777',
];

export const PALETTE_FILL_COLORS = [
  'transparent',
  '#ffffff',
  '#fef08a',
  '#fed7aa',
  '#fecaca',
  '#bbf7d0',
  '#bfdbfe',
  '#e9d5ff',
  '#fbcfe8',
];

export function getThemeTokens(themeName = 'excalidraw') {
  return THEMES[themeName] || THEMES.excalidraw;
}

/**
 * Adjusts dark/light stroke or text lightness in dark mode while preserving hue.
 */
export function resolveThemeColor(color, themeName = 'light', role = 'stroke') {
  if (!color || color === 'transparent' || color === 'none') return 'transparent';
  if (themeName !== 'dark') return color;

  const norm = color.trim().toLowerCase();
  // Invert dark slate strokes/text in dark mode
  if (norm === '#1e293b' || norm === '#0f172a' || norm === '#000000' || norm === '#334155') {
    return '#f1f5f9';
  }
  if (norm === '#ffffff' && role === 'fill') {
    return '#1e293b';
  }
  if (norm === '#f8fafc' && role === 'fill') {
    return '#1e293b';
  }
  return color;
}

export function applyThemeToDocument(themeName = 'excalidraw') {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', THEMES[themeName] ? themeName : 'excalidraw');
}
