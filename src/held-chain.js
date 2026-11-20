import { COURSE } from './course.js'

const STEP = 1 / 180
const DAMPING = Math.exp(-11.14 * STEP)
const STEP_TOLERANCE = 1e-9

export function createHeldChain(hand, ball, count) {
  const spacing = COURSE.chainLength / count
  const nodes = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count
    const x = hand.x + (ball.x - hand.x) * t
    const y = hand.y + (ball.y - hand.y) * t
    const z = hand.z * (1 - t)
    return { x, y, z, px: x, py: y, pz: z }
  })

  let remainder = 0
  let previousHand = { ...hand }
  let previousYaw

  return {
    nodes,
    advance(hand, yaw, direction, spinRate, dt, restingBall) {
      if (dt <= 0) return
      previousYaw ??= yaw
      for (let elapsed = STEP - remainder; elapsed <= dt + STEP_TOLERANCE; elapsed += STEP) {
        const blend = Math.min(1, elapsed / dt)
        const anchor = nodes[0]
        anchor.x = previousHand.x + (hand.x - previousHand.x) * blend
        anchor.y = previousHand.y + (hand.y - previousHand.y) * blend
        anchor.z = previousHand.z + (hand.z - previousHand.z) * blend
        const angle = previousYaw + (yaw - previousYaw) * blend
        const pull = Math.min(450, spinRate ** 2 * COURSE.chainLength) * STEP ** 2 / (nodes.length - 1)
        const pullX = direction * Math.cos(angle) * pull
        const pullZ = -direction * Math.sin(angle) * pull
        for (let i = 1; i < nodes.length; i++) {
          if (restingBall && i === nodes.length - 1) continue
          const node = nodes[i]
          const { x, y, z } = node
          node.x += (x - node.px) * DAMPING + pullX * i
          node.y += (y - node.py) * DAMPING - 37 * STEP ** 2
          node.z += (z - node.pz) * DAMPING + pullZ * i
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
      const total = remainder + dt
      remainder = Math.max(0, total - Math.floor((total + STEP_TOLERANCE) / STEP) * STEP)
      previousHand = { ...hand }
      previousYaw = yaw
    },
  }
}
