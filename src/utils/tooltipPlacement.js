// Places a tooltip beside the pointer and keeps all of it inside the viewport.
// Preferred spot: right of and below the pointer. It flips to the left when the
// right side is too tight, flips above when the bottom is too tight, and is
// finally clamped so no edge ever leaves the viewport.
export function placeTooltip(pointer, size, viewport, gap = 14, margin = 8) {
  const fit = (value, length, limit) =>
    Math.max(margin, Math.min(value, limit - margin - length))

  let left = pointer.x + gap
  if (left + size.width > viewport.width - margin) left = pointer.x - gap - size.width

  let top = pointer.y + gap
  if (top + size.height > viewport.height - margin) top = pointer.y - gap - size.height

  return {
    left: fit(left, size.width, viewport.width),
    top: fit(top, size.height, viewport.height),
  }
}
