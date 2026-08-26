export function calendarDragPreviewPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  pointerType = "mouse",
) {
  const margin = 8;
  const gap = 16;
  const width = Math.min(240, Math.max(0, viewportWidth - margin * 2));
  const height = 96;
  const left = Math.max(margin, Math.min(x + gap, viewportWidth - width - margin));
  // Keep touch previews above the finger, and flip mouse previews near the bottom.
  const above = pointerType === "touch" || y + gap + height > viewportHeight - margin;
  const top = Math.max(margin, Math.min(
    above ? y - height - gap : y + gap,
    viewportHeight - height - margin,
  ));
  return { left, top, width, height };
}
