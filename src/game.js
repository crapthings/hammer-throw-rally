import { chargePower } from './charge.js'
import { createObstacles, moveAircraft, moveBirds, sweep } from './obstacles.js'
import { COURSE, PIT_CLIMB_SECONDS, PIT_ASCENT_START, RESCUE_CATCH_SECONDS } from './course.js'

const { start: TEE, hole: HOLE, length: LENGTH, radius: RADIUS } = COURSE
const GROUND = 0
const GRAVITY = 24
const EDGE = 2.6
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function launchVelocity(x, angle, power) {
  const radians = angle * Math.PI / 180
  const speed = 9 + 37.5 * Math.min(power, 1) + 30 * Math.max(0, power - 1)
  return {
    vx: (x <= HOLE ? 1 : -1) * speed * Math.cos(radians),
    vy: -speed * Math.sin(radians) * 0.68,
  }
}

function forecast(x, angle, power) {
  const { vx, vy } = launchVelocity(x, angle, power)
  const duration = -2 * vy / GRAVITY
  const edge = vx > 0 ? LENGTH - EDGE : EDGE
  const hitTime = (edge - x) / vx
  const at = (t) => ({
    x: t <= hitTime ? x + vx * t : edge - vx * 0.42 * (t - hitTime),
    y: -RADIUS + vy * t + GRAVITY * t * t / 2,
  })
  return { landing: at(duration).x, points: Array.from({ length: 16 }, (_, i) => at(duration * (i + 1) / 17)) }
}

export function mountGame(canvas, onChange, draw, onCoin = () => {}, onThrow = () => {}, onBirdHit = () => {}) {
  let frame
  let previous = 0
  let visualTime = 0
  let pointer = null
  let camera = 0
  let phase, x, y, vx, vy, power, angle, strokes, origin, trail, trailClock, chargeTime, spin, spinRate, fallTime, dragged, launchTime, runTime

  let preview = null
  let effects = []
  let sounds = []
  let hitStop = 0
  let planeReplay = null
  let rocketTime = 0
  let orbitAxis = null
  let flightDebug = 'normal'
  let recoveryTime = 0
  let pitReturn
  let enteredPit
  let obstacles, score, elapsed, notice, noticeTime

  function shotSettings() {
    return flightDebug === 'normal' ? { angle, power }
      : { angle: Math.max(32, angle), power: Math.max(0.65, power) }
  }

  function publish() {
    const shot = shotSettings()
    preview = phase === 'charging' ? forecast(x, shot.angle, shot.power) : null
    onChange({ phase, slowMotion: Boolean(planeReplay), score, notice, dragged, power, angle, strokes, landing: preview?.landing, position: x, height: Math.max(0, -y - RADIUS), shotDistance: Math.abs(x - origin), distance: Math.ceil(Math.abs(HOLE - x)) })
  }

  function reset() {
    phase = 'ready'
    effects = []
    sounds = []
    hitStop = 0
    planeReplay = null
    rocketTime = 0
    obstacles = createObstacles()
    enteredPit = null
    recoveryTime = 0
    pitReturn = null
    score = elapsed = noticeTime = 0
    notice = ''
    x = origin = TEE
    y = GROUND - RADIUS
    vx = vy = power = strokes = 0
    angle = 38
    trail = []
    trailClock = chargeTime = spin = spinRate = fallTime = launchTime = runTime = 0
    dragged = false
    orbitAxis = null
    camera = TEE
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer)
    pointer = null
    publish()
  }

  function aim(event) {
    const { top, height } = canvas.getBoundingClientRect()
    angle = Math.round(clamp(72 - ((event.clientY - top) / height) * 68, 8, 72))
    publish()
  }

  function down(event) {
    if (event.button !== 0 || phase !== 'ready' || planeReplay) return
    event.preventDefault()
    pointer = event.pointerId
    try {
      canvas.setPointerCapture(pointer)
    } catch {
      // The window still receives releases when capture is unavailable.
    }
    phase = 'charging'
    power = chargeTime = spin = spinRate = 0
    notice = ''
    noticeTime = 0
    aim(event)
  }

  function move(event) {
    if (phase === 'charging' && pointer === event.pointerId && !(event.buttons & 1)) {
      up(event)
      return
    }
    if (phase === 'ready' || pointer === event.pointerId) aim(event)
  }

  function up(event) {
    if (phase !== 'charging' || pointer !== event.pointerId || (event.buttons & 1)) return
    aim(event)
    pointer = null
    const forced = flightDebug !== 'normal'
    const carryChance = power >= 1.5
      ? 0.65 + (power - 1.5) * 0.6
      : Math.min(power, 1.2) * 0.17
    dragged = forced || (chargeTime > 0.7 && Math.random() < carryChance)
    orbitAxis = null
    if (dragged) {
      const motion = forced ? flightDebug : ['ragdoll', 'barrel', 'horizontal'][Math.floor(Math.random() * 3)]
      orbitAxis = motion === 'barrel' ? 'z' : motion === 'horizontal' ? 'y' : null
    }
    launchTime = 0
    rocketTime = 0
    origin = x
    enteredPit = null
    const shot = shotSettings()
    const velocity = launchVelocity(x, shot.angle, shot.power)
    vx = velocity.vx
    vy = velocity.vy
    strokes++
    trail = []
    trailClock = 0
    phase = 'flying'
    onThrow()
    publish()
  }

  function fall() {
    const captured = pointer
    pointer = null
    phase = 'fallen'
    fallTime = 0
    announce('overloadFall')
    if (captured !== null && canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured)
    publish()
  }

  function mouseRelease(event) {
    if (event.button === 0 && pointer !== null) {
      up({ pointerId: pointer, clientY: event.clientY, buttons: event.buttons })
    }
  }

  function cancel(event) {
    if (phase !== 'charging' || (event.type === 'pointercancel' && event.pointerId !== pointer)) return
    const captured = pointer
    pointer = null
    if (canvas.hasPointerCapture(captured)) canvas.releasePointerCapture(captured)
    announce('chargeCancelled')
    power = 0
    phase = 'ready'
    publish()
  }

  function announce(message) {
    notice = message
    noticeTime = 2
  }

  function advance(dt) {
    elapsed += dt
    moveBirds(obstacles.birds, elapsed, dt)
    moveAircraft(obstacles.aircraft, elapsed)
    obstacles.rescues.forEach((rescue) => {
      const previousAge = rescue.age
      rescue.age += dt
      if (!rescue.parachute && previousAge < RESCUE_CATCH_SECONDS && rescue.age >= RESCUE_CATCH_SECONDS) {
        sounds.push({ kind: 'rescue' })
      }
    })
    if (noticeTime > 0 && (noticeTime -= dt) <= 0) {
      notice = ''
      publish()
    }
    if (phase === 'charging') {
      chargeTime += dt
      power = chargePower(chargeTime)
      spinRate = 2 + 12 * power + 4 * Math.min(chargeTime, 2.5)
      spin += dt * spinRate
      const fallRate = power > 1 ? 0.015 + 0.04 * (power - 1) ** 2 : 0
      if (flightDebug === 'normal' && fallRate > 0 && Math.random() < 1 - Math.exp(-fallRate * dt)) fall()
      publish()
    }
    if (phase === 'fallen') {
      const previousFallTime = fallTime
      fallTime += dt
      if (previousFallTime < 0.18 && fallTime >= 0.18) sounds.push({ kind: 'overload' })
      if (fallTime >= 1.45) {
        phase = 'ready'
        power = 0
        publish()
      }
    }
    if (phase === 'recovering') {
      recoveryTime += dt
      if (recoveryTime >= 2.8) {
        phase = 'ready'
        publish()
      }
    }
    if (phase === 'pitRecovery') {
      const previousRecoveryTime = recoveryTime
      recoveryTime += dt
      if (previousRecoveryTime < PIT_ASCENT_START && recoveryTime >= PIT_ASCENT_START) sounds.push({ kind: 'climb' })
      if (recoveryTime >= PIT_CLIMB_SECONDS) {
        pitReturn = null
        phase = 'ready'
      }
      publish()
    }
    if (phase === 'running') {
      runTime += dt
      if (runTime >= 1.05) {
        phase = 'ready'
        publish()
      }
    }
    if (phase === 'flying') {
      launchTime += dt
      const powered = rocketTime > 0 && !enteredPit
      rocketTime = Math.max(0, rocketTime - dt)
      if (powered && y < -RADIUS) {
        vx += Math.sign(vx) * Math.max(0, 76 - Math.abs(vx)) * dt
        vy -= 9 * dt
      }
      const oldX = x
      const oldY = y
      const floor = GROUND - RADIUS
      if (y < floor || vy !== 0) {
        y += vy * dt + GRAVITY * dt * dt / 2
        vy += GRAVITY * dt
      }
      x += vx * dt
      trailClock += dt
      if (trailClock >= 0.045 && y < floor) {
        trail.push([x, y])
        if (trail.length > 16) trail.shift()
        trailClock = 0
      }
      if (x < EDGE || x > LENGTH - EDGE) {
        x = clamp(x, EDGE, LENGTH - EDGE)
        vx *= -0.42
      }
      for (const coin of obstacles.coins) {
        if (!coin.taken && sweep(oldX, oldY, x, y, coin, RADIUS + 0.32)) {
          coin.taken = true
          score += 100
          effects.push({ kind: 'score', x: coin.x, y: coin.y, points: 100 })
          onCoin()
          announce('coin')
        }
      }
      for (const pickup of obstacles.rockets) {
        if (pickup.taken || !sweep(oldX, oldY, x, y, pickup, RADIUS + 0.55)) continue
        pickup.taken = true
        rocketTime = 1.15
        sounds.push({ kind: 'rocket' })
        vx = (Math.sign(vx) || Math.sign(HOLE - x) || 1) * Math.min(76, Math.abs(vx) + 20)
        vy = Math.min(vy - 5, -8)
        effects.push({ kind: 'rocket', x: pickup.x, y: pickup.y, speed: 14 })
        announce('rocket')
      }
      for (const craft of obstacles.aircraft) {
        if (craft.dead || !sweep(oldX, oldY, x, y, craft, RADIUS + (craft.kind === 'plane' ? 1.0 : 0.78))) continue
        craft.dead = true
        effects.push({ kind: 'explosion', x: craft.x, y: craft.y, speed: 25 })
        sounds.push({ kind: 'explosion' })
        vx *= rocketTime > 0 ? 0.86 : 0.67
        vy -= 2
        if (craft.kind === 'plane') {
          planeReplay = { x: craft.x, height: -craft.y, remaining: 2.2 }
          obstacles.rescues.push({ x: craft.x - 0.65, y: craft.y, age: 0, parachute: true })
          obstacles.rescues.push({ x: craft.x + 0.65, y: craft.y, age: 0, parachute: false })
          effects.push({ kind: 'help', x: craft.x + 0.65, y: craft.y - 0.65 })
          announce('plane')
        } else {
          announce('ufo')
        }
        hitStop = craft.kind === 'plane' ? 0.115 : 0.095
        publish()
        return
      }
      for (const bird of obstacles.birds) {
        if (bird.dead || bird.cooldown || !sweep(oldX + bird.vx * dt, oldY + bird.vy * dt, x, y, bird, RADIUS + 0.42)) continue
        bird.dead = true
        effects.push({ kind: 'bird', x: bird.x, y: bird.y, speed: Math.hypot(vx - bird.vx, vy - bird.vy) })
        const offset = clamp((y - bird.y) / 0.55, -1, 1)
        const relativeSpeed = Math.hypot(vx - bird.vx, vy - bird.vy)
        onBirdHit(relativeSpeed)
        vx = vx * (0.55 + Math.abs(offset) * 0.19) + bird.vx * 0.24
        vy = vy * 0.64 + bird.vy * 0.24
          + (offset < 0 ? -1 : 1) * Math.min(8, relativeSpeed * (0.10 + Math.abs(offset) * 0.08))
        announce('bird')
        hitStop = 0.065
        publish()
        return
      }
      const overPit = obstacles.pits.find((pit) => Math.abs(x - pit.x) < pit.width / 2 - RADIUS)
      if (y >= floor && (overPit || enteredPit)) {
        enteredPit ??= overPit
        x = clamp(x, enteredPit.x - enteredPit.width / 2 + RADIUS, enteredPit.x + enteredPit.width / 2 - RADIUS)
        if (vy === 0) vy = GRAVITY * dt
        if (y > 1.2) {
          y = 1.2
          effects.push({ kind: 'dust', x, y, speed: vy })
          sounds.push({ kind: 'pit' })
          const left = enteredPit.x - enteredPit.width / 2
          rocketTime = 0
          pitReturn = { x, left, depth: y + RADIUS }
          x = left - 2.5
          y = floor
          enteredPit = null
          power = vx = vy = 0
          trail = []
          recoveryTime = 0
          phase = 'pitRecovery'
          announce('pit')
        }
        camera += (x - camera) * Math.min(1, dt * 5)
        publish()
        return
      }
      const overHole = Math.abs(x - HOLE) <= 0.6 || (oldX - HOLE) * (x - HOLE) < 0
      if (y >= floor && overHole && Math.abs(vx) < 10.5 && vy < 18) {
        phase = 'holed'
        x = HOLE
        y = GROUND + 0.2
      } else if (y >= floor && vy >= 0) {
        rocketTime = 0
        if (vy > 2) effects.push({ kind: 'dust', x, y: 0, speed: vy })
        y = floor
        if (vy > 4.5) {
          sounds.push({ kind: 'bounce', speed: vy })
          vy *= -0.36
          vx *= 0.72
        } else {
          vy = 0
          vx *= Math.exp(-2.5 * dt)
          if (Math.abs(vx) < 0.9) {
            phase = dragged ? 'recovering' : 'running'
            recoveryTime = 0
            runTime = 0
            power = 0
            trail = []
          }
        }
      }
      publish()
    }
    camera += (x - camera) * Math.min(1, dt * 5)
  }

  function render(time, dt = 0, cameraDt = dt) {
    draw({ x, y, camera, phase, power, angle, origin, trail, preview, obstacles, effects, sounds, dt, cameraDt, planeReplay, time, spin, spinRate, fallTime, dragged, orbitAxis, launchTime, runTime, recoveryTime, pitReturn, rocketTime, vx, vy })
    effects = []
    sounds = []
  }

  function tick(now) {
    const dt = previous ? Math.min((now - previous) / 1000, 0.032) : 0
    previous = now
    if (hitStop > 0) {
      hitStop = Math.max(0, hitStop - dt)
      render(visualTime, 0, 0)
      frame = requestAnimationFrame(tick)
      return
    }
    if (planeReplay) {
      planeReplay.remaining -= dt
      if (planeReplay.remaining <= 0) {
        planeReplay = null
        publish()
      }
    }
    const simulationDt = planeReplay ? dt * 0.40 : dt
    advance(simulationDt)
    visualTime += dt
    render(visualTime, hitStop > 0 ? 0 : simulationDt, hitStop > 0 ? 0 : dt)
    frame = requestAnimationFrame(tick)
  }

  function skipSlowMotion(event) {
    if (!planeReplay || event.code !== 'Space') return
    event.preventDefault()
    if (event.repeat) return
    planeReplay = null
    publish()
  }

  const listeners = { pointerdown: down, pointermove: move }
  const windowListeners = { pointerup: up, mouseup: mouseRelease, pointercancel: cancel, blur: cancel, keydown: skipSlowMotion }
  Object.entries(windowListeners).forEach(([name, handler]) => window.addEventListener(name, handler, true))
  Object.entries(listeners).forEach(([name, handler]) => canvas.addEventListener(name, handler))
  reset()
  render(0)
  frame = requestAnimationFrame(tick)
  return {
    reset,
    setFlightDebug(mode) {
      flightDebug = mode
      publish()
    },
    destroy() {
      cancelAnimationFrame(frame)
      Object.entries(windowListeners).forEach(([name, handler]) => window.removeEventListener(name, handler, true))
      Object.entries(listeners).forEach(([name, handler]) => canvas.removeEventListener(name, handler))
    },
  }
}
