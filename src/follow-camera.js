// World-space offsets for screen edges at 1/6 and 4/5 of the viewport width.
export function horizontalCameraEdges(halfWidth) {
  return { left: halfWidth * 2 / 3, right: halfWidth * 3 / 5 }
}

export function followDeadzone(center, target, halfZone, right = halfZone) {
  const offset = target - center
  return center + Math.min(0, offset + halfZone) + Math.max(0, offset - right)
}

// Transfer tracking between objects without applying the gap between them in one frame.
export function createCameraHandoff(duration = 0.24) {
  let mode
  let age
  let offsetX
  let offsetY
  let previous
  return {
    reset() { previous = undefined },
    update(nextMode, x, y, dt) {
      if (!previous || mode !== nextMode) {
        offsetX = previous ? previous.x - x : 0
        offsetY = previous ? previous.y - y : 0
        mode = nextMode
        age = 0
      } else {
        age = Math.min(duration, age + dt)
      }
      const progress = age / duration
      const remaining = 1 - progress * progress * (3 - 2 * progress)
      previous = { x: x + offsetX * remaining, y: y + offsetY * remaining }
      return previous
    },
  }
}
