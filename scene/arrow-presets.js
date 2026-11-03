// scene/arrow-presets.js — documented quick combinations of path, stroke and endpoints.
// Each preset writes only the arrow's own independent settings; nothing is inferred.

export const ARROW_QUICK_PRESETS = [
  {
    id: 'simple-sketch',
    previewPath: 'M6 20 L54 20',
    name: 'Simple Sketch Arrow',
    description: 'Straight, one-way open arrow with a light hand-drawn feel',
    apply: { routing: 'straight', strokeWidth: 2, strokeStyle: 'solid', sloppy: true, startArrow: 'none', endArrow: 'arrow' },
  },
  {
    id: 'clean-technical',
    previewPath: 'M6 20 L54 20',
    name: 'Clean Technical Arrow',
    description: 'Straight, one-way open arrow with crisp geometry',
    apply: { routing: 'straight', strokeWidth: 2, strokeStyle: 'solid', sloppy: false, startArrow: 'none', endArrow: 'arrow' },
  },
  {
    id: 'smooth-curved',
    previewPath: 'M6 22 Q30 2 54 18',
    name: 'Smooth Curved Arrow',
    description: 'Single-curve path with a filled triangle head',
    apply: { routing: 'curved', strokeWidth: 2, strokeStyle: 'solid', sloppy: false, startArrow: 'none', endArrow: 'triangle' },
  },
  {
    id: 'orthogonal-elbow',
    previewPath: 'M6 22 L28 22 L28 8 L54 8',
    name: 'Orthogonal Elbow Arrow',
    description: 'Right-angle route with a filled triangle head',
    apply: { routing: 'orthogonal', strokeWidth: 2, strokeStyle: 'solid', sloppy: false, startArrow: 'none', endArrow: 'triangle' },
  },
  {
    id: 'rounded-elbow',
    previewPath: 'M6 22 L24 22 Q30 22 30 16 L30 8 L54 8',
    name: 'Rounded Elbow Arrow',
    description: 'Right-angle route with rounded corners',
    apply: { routing: 'rounded-elbow', strokeWidth: 2, strokeStyle: 'solid', sloppy: false, cornerRadius: 14, startArrow: 'none', endArrow: 'triangle' },
  },
  {
    id: 'dashed-two-way',
    previewPath: 'M6 20 L54 20',
    name: 'Dashed Two-Way Flow',
    description: 'Dashed straight arrow with heads on both ends',
    apply: { routing: 'straight', strokeWidth: 2, strokeStyle: 'dashed', sloppy: false, startArrow: 'arrow', endArrow: 'arrow' },
  },
];

export function getArrowQuickPreset(id) {
  return ARROW_QUICK_PRESETS.find((p) => p.id === id) || null;
}

export function applyArrowQuickPreset(el, presetId) {
  const preset = getArrowQuickPreset(presetId);
  if (!el || !preset) return false;
  Object.assign(el, preset.apply);
  el.manualRoute = false;
  return true;
}
