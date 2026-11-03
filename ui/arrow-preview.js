// ui/arrow-preview.js — one miniature renderer for arrow quick presets, shared
// by the dock popover and the Inspector so both show the same thing.
export function arrowPresetPreview(preset, idx = 0) {
  const dashed = preset.apply.strokeStyle === 'dashed';
  const hasStart = preset.apply.startArrow && preset.apply.startArrow !== 'none';
  const hasEnd = preset.apply.endArrow && preset.apply.endArrow !== 'none';
  const filled = preset.apply.endArrow === 'triangle' || preset.apply.startArrow === 'triangle';
  const endId = `ah-end-${idx}`;
  const startId = `ah-start-${idx}`;
  const head = filled
    ? '<path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/>'
    : '<path d="M1,1 L9,5 L1,9" fill="none" stroke="currentColor" stroke-width="1.8"/>';
  return `<svg class="wb-arrow-preview" viewBox="0 0 60 28" aria-hidden="true">
    <defs>
      <marker id="${endId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">${head}</marker>
      <marker id="${startId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">${head}</marker>
    </defs>
    <path d="${preset.previewPath}" fill="none" stroke="currentColor" stroke-width="2"
      ${dashed ? 'stroke-dasharray="4 3"' : ''}
      ${hasEnd ? `marker-end="url(#${endId})"` : ''}
      ${hasStart ? `marker-start="url(#${startId})"` : ''}/>
  </svg>`;
}

export function arrowPresetMatches(el, preset) {
  if (!el || !preset) return false;
  return Object.entries(preset.apply).every(([k, v]) => el[k] === v);
}
