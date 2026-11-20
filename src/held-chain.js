import { COURSE } from './course.js'

export function createHeldChain(hand, ball, count) {
  const spacing = COURSE.chainLength / count
  const nodes = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count
    const x = hand.x + (ball.x - hand.x) * t
    const y = hand.y + (ball.y - hand.y) * t
    const z = hand.z * (1 - t)
    return { x, y, z, px: x, py: y, pz: z }
  })

  return {
    nodes,
    advance(hand, yaw, direction, spinRate, dt, restingBall) {
      const count = Math.max(1, Math.ceil(dt * 180))
      const step = dt / count
      for (let substep = 0; substep < count; substep++) {
        Object.assign(nodes[0], hand)
        for (let i = 1; i < nodes.length; i++) {
          if (restingBall && i === nodes.length - 1) continue
          const node = nodes[i]
          const { x, y, z } = node
          const pull = Math.min(450, spinRate ** 2 * COURSE.chainLength) * i / (nodes.length - 1)
          node.x += (x - node.px) * 0.94 + direction * Math.cos(yaw) * pull * step ** 2
          node.y += (y - node.py) * 0.94 - 37 * step ** 2
          node.z += (z - node.pz) * 0.94 - direction * Math.sin(yaw) * pull * step ** 2
          Object.assign(node, { px: x, py: y, pz: z })
        }
        for (let iteration = 0; iteration < 20; iteration++) {
          if (restingBall) Object.assign(nodes.at(-1), restingBall)
          for (let i = 1; i < nodes.length; i++) {
            const a = nodes[i - 1]
            const b = nodes[i]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const dz = b.z - a.z
            const distance = Math.hypot(dx, dy, dz)
            if (distance < 1e-6) continue
            const weight = i === 1 ? 0 : i === nodes.length - 1 ? (restingBall ? 1 : 0.8) : 0.5
            const correction = (distance - spacing) / distance
            a.x += dx * correction * weight
            a.y += dy * correction * weight
            a.z += dz * correction * weight
            b.x -= dx * correction * (1 - weight)
            b.y = Math.max(i === nodes.length - 1 ? COURSE.radius : 0.04, b.y - dy * correction * (1 - weight))
            b.z -= dz * correction * (1 - weight)
          }
        }
      }
    },
  }
}
