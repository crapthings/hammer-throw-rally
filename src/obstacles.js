import { COURSE } from './course.js'

export function createObstacles() {
  const pits = []
  const coins = []
  const birds = []
  const rockets = []
  const aircraft = []
  for (let x = COURSE.start + 35 + Math.random() * 12; x < COURSE.hole - 30; x += 43 + Math.random() * 25) {
    pits.push({ x, width: 2.4 + Math.random() * 2.3 })
    const laneHeight = 2.5 + Math.random() * 2
    for (let i = -3; i <= 3; i++) {
      coins.push({ x: x + i * 1.8, y: -laneHeight + i * i * 0.12, taken: false })
    }
    if (rockets.length === 0 || Math.random() < 0.42) {
      const pickupX = x - 8 + Math.random() * 4
      rockets.push({ x: pickupX, y: -laneHeight - 0.6, taken: false })
      const planeX = pickupX + 22 + Math.random() * 12
      if (planeX < COURSE.hole - 12) {
        for (const [kind, offset, altitude] of [['plane', 0, 6], ['ufo', 18, 11]]) {
          aircraft.push({ kind, x: planeX + offset, y: -altitude, anchor: planeX + offset,
            height: -altitude - Math.random() * 2, phase: Math.random() * 6.28 })
        }
      }
    }
    const highCenter = x + 14 + Math.random() * 8
    const highY = 7 + Math.random() * 6
    for (let i = -2; i <= 2; i++) {
      coins.push({ x: highCenter + i * 2.1, y: -highY + i * i * 0.24, taken: false })
    }
    for (let i = 0; i < 2 + Number(Math.random() < 0.35); i++) {
      const anchor = x + 7 + i * 10 + Math.random() * 4
      const height = -(1.8 + i * 3.8 + Math.random() * 3)
      birds.push({
        x: anchor, y: height, anchor, height,
        range: 4 + Math.random() * 5, frequency: 0.55 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2, vx: 0, vy: 0, cooldown: 0,
      })
    }
  }
  return { pits, coins, birds, rockets, aircraft, rescues: [] }
}

export function moveBirds(birds, time, dt) {
  for (const bird of birds) {
    if (bird.dead) continue
    const phase = time * bird.frequency + bird.phase
    bird.x = bird.anchor + bird.range * Math.sin(phase)
    bird.y = bird.height + 0.63 * Math.sin(phase * 2)
    bird.vx = bird.range * bird.frequency * Math.cos(phase)
    bird.vy = 1.26 * bird.frequency * Math.cos(phase * 2)
    bird.cooldown = Math.max(0, bird.cooldown - dt)
  }
}

export function moveAircraft(aircraft, time) {
  for (const craft of aircraft) {
    if (craft.dead) continue
    const cycle = time * (craft.kind === 'plane' ? 0.45 : 0.7) + craft.phase
    craft.x = craft.anchor + 5 * Math.sin(cycle)
    craft.y = craft.height + Math.sin(cycle * 2) * 1.6
  }
}

export function sweep(x0, y0, x, y, target, radius) {
  const dx = x - x0
  const dy = y - y0
  const t = Math.max(0, Math.min(1, ((target.x - x0) * dx + (target.y - y0) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x0 + dx * t - target.x, y0 + dy * t - target.y) <= radius
}
