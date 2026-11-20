import { COURSE } from './course.js'

export function createObstacles() {
  const pits = []
  const coins = []
  const birds = []
  const rockets = []
  const aircraft = []
  const trampolines = []
  for (let x = COURSE.start + 35 + Math.random() * 12; x < COURSE.hole - 30; x += 43 + Math.random() * 25) {
    pits.push({ x, width: 2.4 + Math.random() * 2.3 })
    if (pits.length % 2 === 1) {
      trampolines.push({ x: x - 8 + Math.random() * 1.5, width: 4.4, lastBounce: -Infinity })
    }
    const lowHeight = 1.35 + Math.random() * 0.6
    for (let i = 0; i < 3; i++) {
      coins.push({ x: x - 14 + i * 3, y: -lowHeight, taken: false, lane: 'low' })
    }
    const highCenter = x + 1 + Math.random() * 3
    const highY = 7 + Math.random() * 3
    for (let i = -4; i <= 4; i++) {
      coins.push({ x: highCenter + i * 1.65, y: -highY + i * i * 0.21, taken: false, lane: 'high' })
    }
    if (rockets.length === 0 || Math.random() < 0.42) {
      const pickupX = highCenter - 9
      rockets.push({ x: pickupX, y: -highY + 4.1, taken: false })
      const planeX = pickupX + 22 + Math.random() * 12
      if (planeX < COURSE.hole - 12) {
        for (const [kind, offset, altitude] of [['plane', 0, 6], ['ufo', 18, 11]]) {
          aircraft.push({ kind, x: planeX + offset, y: -altitude, anchor: planeX + offset,
            height: -altitude - Math.random() * 2, phase: Math.random() * 6.28 })
        }
      }
    }
    for (let i = 0; i < 2 + Number(Math.random() < 0.35); i++) {
      const anchor = highCenter + 3 + i * 7 + Math.random() * 3
      const height = -highY + 1.1 - i * 1.25 - Math.random() * 0.8
      birds.push({
        x: anchor, y: height, anchor, height,
        range: 4 + Math.random() * 5, frequency: 0.55 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2, vx: 0, vy: 0, cooldown: 0,
      })
    }
  }
  return { pits, coins, birds, rockets, aircraft, trampolines, rescues: [] }
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
    const frequency = craft.kind === 'plane' ? 0.45 : 0.7
    const cycle = time * frequency + craft.phase
    craft.x = craft.anchor + 5 * Math.sin(cycle)
    craft.y = craft.height + Math.sin(cycle * 2) * 1.6
    craft.vx = 5 * frequency * Math.cos(cycle)
    craft.vy = 3.2 * frequency * Math.cos(cycle * 2)
  }
}

export function sweep(x0, y0, x, y, target, radius) {
  const dx = x - x0
  const dy = y - y0
  const t = Math.max(0, Math.min(1, ((target.x - x0) * dx + (target.y - y0) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x0 + dx * t - target.x, y0 + dy * t - target.y) <= radius
}
