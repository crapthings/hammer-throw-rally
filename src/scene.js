import { createParticles } from './particles.js'
import { createHeldChain } from './held-chain.js'
import { createRagdoll, initRagdollPhysics } from './ragdoll.js'
import { COURSE, RUN_STEP_SECONDS, PIT_CLIMB_SECONDS, PIT_ASCENT_START, RESCUE_CATCH_SECONDS } from './course.js'
import { createRiverbank } from './riverbank.js'
import { Application } from 'pixi.js'
import { Container3D, CubeGeometry, DirectionalLight, Material3D, Mesh3D, SphereGeometry, TorusGeometry, View3D } from '@pixi/3d'

const palette = {
  blue: 0x619dc6,
  sky: 0xa6c8e2,
  paper: 0xf4f0e2,
  peach: 0xf4baa3,
  ink: 0x233b50,
  deepBlue: 0x315e80,
  clay: 0xb97764,
}

export async function createScene(canvas, onBodyImpact = () => {}) {
  await initRagdollPhysics()
  const app = new Application()
  await app.init({ canvas, width: 960, height: 456, preference: 'webgl', antialias: true, autoStart: false, background: palette.sky })

  const drawRiverbank = createRiverbank(app.stage, COURSE.length)

  const view = new View3D({ autoResize: true, environment: { skyColor: palette.paper, groundColor: palette.sky } })
  app.stage.addChild(view)
  const particles = createParticles(app.stage)
  view.camera.mode = 'orthographic'
  const sun = new DirectionalLight({ intensity: 2.5 })
  sun.position.set(-12, 20, 16)
  view.root.addChild(sun)
  sun.lookAt({ x: 0, y: 0, z: 0 })

  const cube = new CubeGeometry()
  const sphere = new SphereGeometry({ radius: 0.5, widthSegments: 12, heightSegments: 8 })
  const materials = new Map()
  function mesh(color, x, y, z, width, height, depth, geometry = cube) {
    if (!materials.has(color)) materials.set(color, new Material3D({ baseColor: color, roughness: 0.86 }))
    const object = new Mesh3D({ geometry, material: materials.get(color) })
    object.position.set(x, y, z)
    object.scale.set(width, height, depth)
    view.root.addChild(object)
    return object
  }

  function model(parent, pieces) {
    const group = new Container3D()
    parent.addChild(group)
    for (const piece of pieces) group.addChild(mesh(...piece))
    return group
  }

  const rocketPieces = [
    [0xf4eee0, -0.03, 0, 0, 1.18, 0.45, 0.44, sphere],
    [0xda5541, 0.40, 0, 0, 0.58, 0.34, 0.35, sphere],
    [0x487c9c, 0.16, 0.06, 0.21, 0.25, 0.19, 0.05, sphere],
    [0xda5541, -0.40, -0.18, 0, 0.30, 0.22, 0.40],
    [0xda5541, -0.40, 0.18, 0, 0.30, 0.22, 0.40],
  ]
  const rocket = model(view.root, rocketPieces)
  const flame = mesh(0xffaa45, -0.85, 0, 0, 0.65, 0.24, 0.24, sphere)
  rocket.addChild(flame)

  const { hole, start, length, radius } = COURSE
  const cup = 0.6
  mesh(palette.peach, hole, -0.1, -1.75, cup * 2, 0.2, 2.5)
  mesh(palette.peach, hole, -0.1, 1.75, cup * 2, 0.2, 2.5)
  mesh(palette.ink, hole, -0.19, 0, cup * 2, 0.05, 1)
  mesh(palette.paper, hole, 1.3, -0.6, 0.05, 2.6, 0.05)
  const flag = mesh(palette.deepBlue, hole + 0.53, 2.3, -0.6, 1.05, 0.5, 0.05)
  mesh(palette.paper, start, 0.012, 0, 0.08, 0.025, 5.5)

  const playerScale = 0.45
  const parts = [
    [-0.48, 0.47, 0, 0.65, 0.94, 0.7, palette.deepBlue],
    [0.48, 0.47, 0, 0.65, 0.94, 0.7, palette.deepBlue],
    [0, 1.43, 0, 1.8, 1.28, 1.04, palette.paper],
    [0.14, 2.86, 0, 2.04, 1.7, 1.42, palette.peach],
    [0.03, 3.65, 0, 2.13, 0.48, 1.49, palette.ink],
    [0.05, 3.33, 0, 2.17, 0.24, 1.52, palette.clay],
    [0.04, 2.98, 0.74, 0.15, 0.25, 0.1, palette.ink],
    [0.63, 2.98, 0.74, 0.15, 0.25, 0.1, palette.ink],
    [0.53, 2.62, 0.75, 0.34, 0.16, 0.1, palette.clay],
    [1.01, 1.57, 0.29, 0.64, 0.49, 0.65, palette.peach],
  ].map(([x, y, z, w, h, d, color]) => ({ x: x * playerScale, y: y * playerScale, z: z * playerScale, object: mesh(color, 0, 0, 0, w * playerScale, h * playerScale, d * playerScale) }))

  const hairSpikes = Array.from({ length: 5 }, (_, i) => {
    const spike = mesh(i % 2 ? 0xffb52f : 0xffe262, 0, 0, 0, 0.15, 0.52 - Math.abs(i - 2) * 0.09, 0.26)
    spike.visible = false
    return spike
  })
  const aura = Array.from({ length: 16 }, (_, i) => {
    const spark = mesh(i % 2 ? 0xffa421 : 0xffe570, 0, 0, 0, 0.09, 0.36, 0.09)
    spark.visible = false
    return spark
  })
  const lightning = Array.from({ length: 8 }, (_, i) => {
    const bolt = mesh(i % 2 ? 0xffd34f : 0xfff4c7, 0, 0, 0, 0.065, 1, 0.07)
    bolt.visible = false
    return bolt
  })
  const pulse = mesh(0xffd35e, 0, 0, 0, 1, 1, 1,
    new TorusGeometry({ radius: 0.5, tube: 0.012, radialSegments: 5, tubularSegments: 32 }))
  pulse.visible = false

  const throwingHand = parts.at(-1)
  const ball = mesh(palette.ink, 0, 0, 0, 2 * radius, 2 * radius, 2 * radius, sphere)
  const glint = mesh(palette.paper, 0, 0, 0, radius * 0.35, radius * 0.5, radius * 0.16, sphere)
  const chain = new Container3D()
  view.root.addChild(chain)
  const linkGeometry = new TorusGeometry({ radius: 0.042, tube: 0.019, radialSegments: 6, tubularSegments: 10 })
  const links = Array.from({ length: 24 }, (_, index) => {
    const joint = new Container3D()
    chain.addChild(joint)
    const link = mesh(index % 2 ? palette.ink : palette.deepBlue, 0, 0, 0, 1, 1, 1, linkGeometry)
    joint.addChild(link)
    link.rotation.z = index % 2 ? Math.PI / 2 : 0
    return joint
  })
  const landingMarker = mesh(0xd86b29, 0, 0.015, 0, 0.75, 0.04, 0.75, sphere)
  const stars = Array.from({ length: 3 }, () => mesh(palette.paper, 0, 0, 0, 0.28, 0.28, 0.13))
  const dots = Array.from({ length: 16 }, () => mesh(0xffcc63, 0, 0, 0, 0.17, 0.17, 0.14))

  const dotOutlines = dots.map(() => mesh(0x63382d, 0, 0, 0, 0.23, 0.23, 0.11))

  const limbs = [
    ['chest', 'elbow', palette.paper], ['elbow', 'grip', palette.peach],
    ['chest', 'freeElbow', palette.paper], ['freeElbow', 'freeHand', palette.peach],
    ['hips', 'kneeA', palette.deepBlue], ['kneeA', 'footA', palette.deepBlue],
    ['hips', 'kneeB', palette.deepBlue], ['kneeB', 'footB', palette.deepBlue],
  ].map(([a, b, color]) => ({ a, b, object: mesh(color, 0, 0, 0, 0.16, 1, 0.20) }))
  let ragdoll
  let ragdollTime = 0
  let cameraLift = 0
  let shakeTime = 0
  let cameraCenter
  let recoverPose
  let wasRecovering = false
  let heldChain
  let heldOrigin
  let renderedObstacles
  const courseMeshes = new Container3D()
  view.root.addChild(courseMeshes)

  function populateCourse(obstacles) {
    courseMeshes.removeChildren().forEach((object) => object.destroy({ children: true }))
    const add = (...args) => {
      const object = mesh(...args)
      courseMeshes.addChild(object)
      return object
    }
    let edge = 0
    for (const gap of [...obstacles.pits, { x: hole, width: cup * 2 }]) {
      const left = gap.x - gap.width / 2
      add(palette.peach, (edge + left) / 2, -0.1, 0, left - edge, 0.2, 6)
      if (gap.x !== hole) {
        const rimWidth = 0.18
        const interiorWidth = gap.width - 2 * rimWidth
        add(0x8e6750, gap.x, -0.675, -2.8, interiorWidth, 1.35, 0.3)
        add(0x694e40, gap.x, -1.45, 0, interiorWidth, 0.2, 5.92)
        for (let rock = 0; rock < 5; rock++) {
          add(rock % 2 ? 0xb08a66 : 0x987459, gap.x - gap.width * 0.35 + rock * gap.width * 0.17, -1.26, 0.4, 0.30, 0.16, 0.27, sphere)
        }
        for (const side of [-1, 1]) {
          const lip = gap.x + side * gap.width / 2
          // The wall stays inside the opening and its front face sits behind the lane.
          add(0xb18b65, lip - side * rimWidth / 2, -0.685, 0, rimWidth, 1.33, 5.96)
          add(0xe5a845, lip + side * 0.23, 0.017, 2.3, 0.19, 0.026, 1.15)
        }
      }
      edge = gap.x + gap.width / 2
    }
    add(palette.peach, (edge + length) / 2, -0.1, 0, length - edge, 0.2, 6)
    for (let meter = 25; meter < hole - start; meter += 25) {
      const markX = start + meter
      if (obstacles.pits.some((pit) => Math.abs(markX - pit.x) < pit.width / 2 + 0.4)) continue
      add(palette.paper, markX, 0.017, 2, 0.12, 0.026, 1.5)
    }
    return {
      rockets: obstacles.rockets.map(() => model(courseMeshes, rocketPieces)),
      aircraft: obstacles.aircraft.map(({ kind }) => model(courseMeshes, kind === 'plane' ? [
        [0xf0c982, -0.05, -0.02, 0, 2.38, 0.44, 0.52, sphere],
        [0xf8e6ba, 0.12, -0.12, 0, 1.72, 0.25, 0.44, sphere],
        [0xc9523e, 0.88, -0.01, 0, 0.55, 0.49, 0.55, sphere],
        [0x43657d, 0.31, 0.20, 0, 0.62, 0.32, 0.40, sphere],
        [0x9ac4ce, 0.44, 0.26, 0.13, 0.30, 0.19, 0.18, sphere],
        [0xc9523e, 0.00, 0.55, 0, 1.13, 0.12, 1.60, sphere],
        [0xc9523e, -0.05, -0.19, 0, 1.03, 0.11, 1.43, sphere],
        [0xf9e7bf, -0.28, 0.19, -0.49, 0.055, 0.72, 0.055],
        [0xf9e7bf, 0.29, 0.19, -0.49, 0.055, 0.72, 0.055],
        [0xf9e7bf, -0.28, 0.19, 0.49, 0.055, 0.72, 0.055],
        [0xf9e7bf, 0.29, 0.19, 0.49, 0.055, 0.72, 0.055],
        [0xb74639, -0.94, 0.22, 0, 0.48, 0.52, 0.15, sphere],
        [0xd6654d, -0.91, 0.02, 0, 0.47, 0.08, 0.68, sphere],
        [0x514a4a, 0.21, -0.41, -0.30, 0.27, 0.27, 0.13, sphere],
        [0x514a4a, 0.21, -0.41, 0.30, 0.27, 0.27, 0.13, sphere],
        [0xf1d5a2, 0.21, -0.41, 0.37, 0.11, 0.11, 0.04, sphere],
        [0xf1d5a2, 1.13, 0, 0, 0.19, 0.19, 0.19, sphere],
        [0x493c45, 1.19, 0, 0, 0.064, 0.98, 0.14, sphere],
      ] : [
        [0x738caf, 0, 0, 0, 1.87, 0.29, 1.15, sphere],
        [0xa7dfbd, 0, 0.18, 0, 0.82, 0.48, 0.64, sphere],
        [0xffd76f, -0.52, -0.03, 0.46, 0.16, 0.10, 0.12, sphere],
        [0xffd76f, 0, -0.03, 0.53, 0.16, 0.10, 0.12, sphere],
        [0xffd76f, 0.52, -0.03, 0.46, 0.16, 0.10, 0.12, sphere],
      ])),
      rescues: [],
      coins: obstacles.coins.map(() => add(0xffc644, 0, 0, 0, 0.64, 0.64, 0.16, sphere)),
      birds: obstacles.birds.map((_, index) => {
        const bird = new Container3D()
        courseMeshes.addChild(bird)
        function part(parent, ...args) {
          const object = add(...args)
          parent.addChild(object)
          return object
        }
        const feather = index % 3 === 0 ? 0x777d92 : 0x4b6579
        part(bird, feather, -0.06, 0, 0, 0.76, 0.38, 0.38, sphere)
        part(bird, palette.paper, 0.09, -0.08, 0.12, 0.51, 0.24, 0.24, sphere)
        part(bird, palette.paper, 0.29, 0.12, 0, 0.32, 0.30, 0.30, sphere)
        part(bird, palette.ink, 0.36, 0.15, 0.13, 0.047, 0.047, 0.045, sphere)
        part(bird, 0xf3a844, 0.48, 0.09, 0, 0.20, 0.085, 0.095, sphere)
        part(bird, feather, -0.42, 0.04, 0, 0.37, 0.09, 0.22)
        const wings = [-1, 1].map((side) => {
          const wing = new Container3D()
          wing.position.set(-0.06, 0.07, side * 0.14)
          bird.addChild(wing)
          part(wing, feather, -0.08, 0, side * 0.20, 0.40, 0.09, 0.48, sphere)
          part(wing, palette.ink, -0.17, 0, side * 0.40, 0.28, 0.065, 0.27, sphere)
          return wing
        })
        return { bird, wings }
      }),
    }
  }
  let props

  function draw({ x, y, camera, phase, power, origin, trail, preview, obstacles, effects, dt, cameraDt = dt, planeReplay, time, spin, spinRate, fallTime, dragged, orbitAxis, launchTime, runTime, recoveryTime, pitReturn, rocketTime, vx, vy }) {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    if (app.screen.width !== width || app.screen.height !== height) app.renderer.resize(width, height)
    const size = Math.min(24, width / height * 6.5)
    view.camera.orthographicSize = size
    const throwing = phase === 'flying'
    const charging = phase === 'charging'
    const fallen = phase === 'fallen'
    const idle = phase === 'ready'
    const running = phase === 'running'
    const recovering = phase === 'recovering'
    const pitRecovery = phase === 'pitRecovery'
    if (recovering && !wasRecovering) {
      recoverPose = parts.map(({ object }) => ({
        x: object.position.x, y: object.position.y, z: object.position.z,
        rotation: object.rotation.z,
      }))
    }
    wasRecovering = recovering
    const carried = throwing && dragged
    const base = throwing ? origin : x
    const direction = base <= hole ? 1 : -1
    const ballHeight = -y
    const stanceX = base - direction * (COURSE.chainLength + 0.20)
    const progress = Math.min(1, runTime / 1.05)
    const entryX = Math.min((cameraCenter ?? camera) - size - 0.6, stanceX)
    const ease = (t) => {
      const p = Math.max(0, Math.min(1, t))
      return p * p * (3 - 2 * p)
    }
    let pivotX = running ? entryX + (stanceX - entryX) * progress : stanceX
    let stride = running ? Math.sin(runTime * Math.PI / RUN_STEP_SECONDS) * Math.sin(progress * Math.PI) : 0
    let pivotY = fallen ? 0.26 : Math.abs(stride) * 0.13
    let climbing = false
    if (pitRecovery && pitReturn) {
      const climbTime = recoveryTime * 1.65 / PIT_CLIMB_SECONDS
      const wallX = pitReturn.left + 0.52
      const approach = ease((climbTime - 0.15) / 0.30)
      const rise = ease((recoveryTime - PIT_ASCENT_START) / (0.60 * PIT_CLIMB_SECONDS / 1.65))
      const pullOver = ease((climbTime - 0.91) / 0.28)
      const walk = ease((climbTime - 1.19) / 0.46)
      pivotX = pitReturn.x + (wallX - pitReturn.x) * approach - 1.03 * pullOver
      pivotX += (stanceX - pivotX) * walk
      pivotY = -pitReturn.depth * (1 - rise)
      climbing = climbTime >= 0.37 && climbTime < 1.19
      stride = Math.sin(climbTime * 20) * Math.sin(Math.PI * ease(climbTime / 1.65))
      if (climbing) pivotY += Math.abs(stride) * 0.18
    }
    const yaw = charging ? spin : 0
    const wobble = recovering && recoveryTime > 0.75 && recoveryTime < 1.22
      ? Math.sin((recoveryTime - 0.75) * 24) * (1.22 - recoveryTime) * 0.82
      : 0
    const roll = recovering ? wobble - direction * 0.38 * Math.max(0, 1 - Math.abs(recoveryTime - 2.24) / 0.45) : fallen ? Math.min(fallTime * 8, Math.PI / 2) : 0
    if (carried && (!ragdoll || launchTime < ragdollTime)) {
      ragdoll?.destroy()
      ragdoll = createRagdoll(pivotX, direction, throwingHand.object.position, length, base, (speed, impactX) => {
        particles.burst('dust', impactX, 0, speed)
        onBodyImpact(speed)
      })
      ragdollTime = 0
    }
    if (carried) {
      ragdoll.advance(launchTime - ragdollTime, x, ballHeight)
      ragdollTime = launchTime
    } else if (ragdoll) {
      ragdoll.destroy()
      ragdoll = null
    }
    const turn = Math.max(0, Math.min(1, (launchTime - 0.10) / 0.83))
    const orbiting = carried && orbitAxis && ragdoll && turn > 0 && turn < 1
    const poseWeight = orbiting ? Math.min(1, turn * 6, (1 - turn) * 6, Math.max(0, ballHeight - 0.25) / 0.9) : 0
    const flightPose = orbitAxis === 'y' ? {
      head: [-0.40, 0.46], chest: [-0.20, 0.22], hips: [0, 0],
      kneeA: [-0.45, -0.26], footA: [-0.80, -0.34],
      kneeB: [-0.28, -0.45], footB: [-0.60, -0.61],
      elbow: [0.16, 0.32], grip: [0.50, 0.25],
      freeElbow: [-0.35, 0.03], freeHand: [-0.57, 0.20],
    } : {
      head: [0.06, 0.78], chest: [0, 0.47], hips: [0, 0],
      kneeA: [-0.24, -0.28], footA: [-0.42, -0.59],
      kneeB: [0.22, -0.18], footB: [0.39, -0.42],
      elbow: [0.32, 0.45], grip: [0.64, 0.36],
      freeElbow: [-0.34, 0.31], freeHand: [-0.57, 0.48],
    }

    let nodes = ragdoll?.nodes
    if (orbiting) {
      const hips = nodes.hips
      nodes = Object.fromEntries(Object.entries(flightPose).map(([name, [offsetX, offsetY]]) => {
        const point = nodes[name]
        return [name, {
          x: point.x + (hips.x + direction * offsetX - point.x) * poseWeight,
          y: point.y + (hips.y + offsetY - point.y) * poseWeight,
        }]
      }))
    }
    const segmentAngle = (lower, upper) => Math.atan2(lower.x - upper.x, upper.y - lower.y)
    limbs.forEach(({ a, b, object }) => {
      object.visible = carried
      if (!nodes) return
      const start = nodes[a]
      const end = nodes[b]
      object.position.set((start.x + end.x) / 2, (start.y + end.y) / 2, 0)
      object.scale.y = Math.hypot(start.x - end.x, start.y - end.y) + 0.12
      object.rotation.set(0, 0, segmentAngle(start, end))
    })
    const breathing = idle ? 0.045 * (1 + Math.sin(time * 4)) : 0
    const blinking = idle && time % 3.4 > 3.27
    const picking = recovering ? Math.max(0, 1 - Math.abs(recoveryTime - 2.24) / 0.45) : 0
    const dusting = recovering && recoveryTime > 1.15 && recoveryTime < 1.9
    if (recovering && [1.32, 1.62, 1.84].some((beat) => recoveryTime - dt < beat && recoveryTime >= beat)) {
      particles.burst('dust', pivotX, -0.75, 2)
    }
    const squat = charging ? 0.08 + power * 0.12 + Math.sin(spin * 2) * 0.06 : picking * 0.5
    parts.forEach((part, index) => {
      if (nodes) {
        const node = [nodes.footA, nodes.footB, nodes.chest][index] ?? (part === throwingHand ? nodes.grip : nodes.head)
        const tilt = index === 0 ? segmentAngle(nodes.footA, nodes.kneeA)
          : index === 1 ? segmentAngle(nodes.footB, nodes.kneeB)
            : index === 2 ? segmentAngle(nodes.hips, nodes.chest)
              : segmentAngle(nodes.chest, nodes.head)
        const faceX = node === nodes.head ? part.x - parts[3].x : 0
        const faceY = node === nodes.head ? part.y - parts[3].y : 0
        part.object.visible = true
        part.object.position.set(node.x + faceX * Math.cos(tilt) - faceY * Math.sin(tilt), node.y + faceX * Math.sin(tilt) + faceY * Math.cos(tilt), node === nodes.grip ? 0 : part.z)
        part.object.rotation.set(0, 0, tilt)
        return
      }
      const armSwing = idle && part === throwingHand ? Math.sin(time * 4) * 0.075 : 0
      const legSwing = index === 0 ? stride : index === 1 ? -stride : 0
      const handReach = part === throwingHand ? picking * 0.46 + (dusting ? Math.sin(recoveryTime * 32) * 0.24 : 0) : 0
      const px = (part.x + armSwing + handReach + legSwing * 0.53) * (pitRecovery ? -1 : running ? 1 : direction)
      const py = part.y - (index > 1 ? squat + breathing : 0) + Math.max(0, legSwing) * 0.24
        + (climbing && part === throwingHand ? 0.63 + stride * 0.16 : 0)
      const pz = part.z
      const rx = px * Math.cos(roll) - py * Math.sin(roll)
      const ry = px * Math.sin(roll) + py * Math.cos(roll)
      part.object.visible = phase !== 'holed'
      if (index === 6 || index === 7) part.object.scale.y = (blinking ? 0.055 : 0.25) * playerScale
      part.object.position.set(
        pivotX + rx * Math.cos(yaw) + pz * Math.sin(yaw),
        pivotY + ry,
        pz * Math.cos(yaw) - rx * Math.sin(yaw),
      )
      part.object.rotation.set(0, yaw, roll - legSwing * 0.6)
      if (recovering && recoverPose) {
        const t = Math.max(0, Math.min(1, (recoveryTime - 0.25) / 0.85))
        const blend = t * t * (3 - 2 * t)
        const pose = recoverPose[index]
        const target = part.object.position
        target.set(pose.x + (target.x - pose.x) * blend, pose.y + (target.y - pose.y) * blend, pose.z + (target.z - pose.z) * blend)
        part.object.rotation.z = pose.rotation * (1 - blend) + roll * blend
      }
    })
    const golden = charging && power >= 1.2
    const thunder = charging && power >= 1.5
    const head = parts[4].object.position
    for (const [i, spike] of hairSpikes.entries()) {
      spike.visible = golden
      if (!golden) continue
      const offset = (i - 2) * 0.15
      spike.position.set(head.x + offset * Math.cos(yaw), head.y + 0.24, head.z - offset * Math.sin(yaw))
      spike.rotation.set(0, yaw, -offset * 1.8 + roll)
    }
    for (const [i, spark] of aura.entries()) {
      spark.visible = golden
      if (!golden) continue
      const rise = (time * (thunder ? 2.6 : 1.55) + i * 0.38197) % 1
      const angle = i * 2.39996 + time * 2
      const spread = 0.65 + Math.sin(rise * Math.PI) * 0.37
      spark.position.set(pivotX + Math.cos(angle) * spread, pivotY + rise * 2.25, Math.sin(angle) * spread)
      spark.scale.y = (thunder ? 0.60 : 0.40) * (1 - rise) + 0.07
      spark.rotation.z = -Math.cos(angle) * 0.35
    }
    for (const [i, bolt] of lightning.entries()) {
      bolt.visible = thunder
      if (!thunder) continue
      const side = i < 4 ? -1 : 1
      const segment = i % 4
      const beat = Math.floor(time * 11)
      const boltX = (j) => side * (0.94 + Math.sin((j + beat) * 2.4 + side) * 0.24)
      const ax = boltX(segment)
      const bx = boltX(segment + 1)
      bolt.position.set(pivotX + (ax + bx) / 2, pivotY + 0.25 + (segment + 0.5) * 0.50, 0.63)
      bolt.scale.y = Math.hypot(bx - ax, 0.50) + 0.035
      bolt.rotation.z = Math.atan2(ax - bx, 0.50)
    }
    pulse.visible = thunder
    if (thunder) {
      const wave = (time * 2.3) % 1
      pulse.position.set(pivotX, pivotY + 0.10 + wave * 0.27, 0)
      pulse.rotation.x = Math.PI / 2
      pulse.scale.set(1.18 + 2.4 * wave, 1.18 + 2.4 * wave, 1 - 0.75 * wave)
    }
    ball.visible = phase !== 'holed'
    const courseChanged = renderedObstacles !== obstacles
    if (courseChanged) {
      particles.clear()
      renderedObstacles = obstacles
      props = populateCourse(obstacles)
      heldChain = null
    }
    const stretch = poseWeight * (orbitAxis === 'y' ? 0.88 : 0.72)
    const orbitAngle = orbiting ? direction * Math.PI * 2 * turn * turn * (3 - 2 * turn) : 0
    const centerX = orbiting ? (x + nodes.hips.x) / 2 : x
    const centerY = orbiting ? (ballHeight + nodes.hips.y) / 2 : ballHeight
    const cosine = Math.cos(orbitAngle)
    const sine = Math.sin(orbitAngle)

    // Both poses orbit a common pivot that travels with the shot.
    function orbitPose(px, py, pz, separation) {
      const dx = px - centerX + separation
      if (orbitAxis === 'y') {
        const depth = pz * cosine - dx * sine
        return { x: centerX + dx * cosine + pz * sine, y: py + depth * 0.37 * poseWeight, z: depth }
      }
      const dy = py - centerY
      return { x: centerX + dx * cosine - dy * sine, y: centerY + dx * sine + dy * cosine, z: pz }
    }
    if (orbiting && turn > 0 && turn < 1) {
      const bodyObjects = [...parts.map((part) => part.object), ...limbs.map((limb) => limb.object)]
      for (const object of bodyObjects) {
        const { x: px, y: py, z: pz } = object.position
        const rolled = orbitPose(px, py, pz, -direction * stretch)
        object.position.set(rolled.x, rolled.y, rolled.z)
        if (orbitAxis === 'y') object.rotation.y += orbitAngle
        else object.rotation.z += orbitAngle
      }
    }
    const grip = throwingHand.object.position
    const hand = { x: grip.x, y: grip.y, z: grip.z }
    if (idle || charging) {
      if (!heldChain || heldOrigin !== x) heldChain = createHeldChain(hand, { x, y: ballHeight }, links.length)
      heldOrigin = x
      heldChain.advance(hand, yaw, direction, charging ? spinRate : 0, dt, idle ? { x, y: ballHeight, z: 0 } : null)
    } else {
      heldChain = null
    }
    const tip = heldChain?.nodes.at(-1)
    const ballPose = orbiting && turn > 0 && turn < 1 ? orbitPose(x, ballHeight, 0, direction * stretch)
      : charging ? tip : { x, y: ballHeight, z: 0 }
    const { x: bx, y: by, z: bz } = ballPose
    const torso = parts[2].object.position
    const normalCenter = camera + size * 0.56
    const recoveryFollow = recovering ? Math.max(0, 1 - recoveryTime / 1.35) : 0
    const bodyCenter = torso.x + (bx - torso.x) * 0.30
    const desiredCenter = pitRecovery ? torso.x - size * 0.12 : carried ? bodyCenter : normalCenter + (bodyCenter - normalCenter) * recoveryFollow
    const replayWeight = planeReplay ? Math.min(1, planeReplay.remaining / 0.36) : 0
    const replayCenter = planeReplay ? desiredCenter + (planeReplay.x - desiredCenter) * replayWeight : desiredCenter
    const targetCenter = Math.min(length - size, Math.max(size, replayCenter))
    const resetCamera = courseChanged || dt === 0
    if (resetCamera) {
      cameraCenter = targetCenter
      cameraLift = 0
      shakeTime = 0
    }
    cameraCenter += (targetCenter - cameraCenter) * (1 - Math.exp(-(planeReplay ? 12 : carried ? 18 : 5) * cameraDt))
    if (effects.some((effect) => effect.kind === 'bird' || effect.kind === 'explosion')) shakeTime = 0.19
    const shake = shakeTime / 0.19
    shakeTime = Math.max(0, shakeTime - dt)
    const center = cameraCenter + Math.sin(shakeTime * 114) * shake * 0.075
    const shakeY = Math.cos(shakeTime * 92) * shake * 0.043
    const verticalRoom = height * size / width
    const headHeight = parts[3].object.position.y
    const followHeight = carried ? Math.max(by, torso.y + 0.55, headHeight + 0.4) : -y
    const normalLift = Math.max(0, followHeight - 3.4 - verticalRoom * (carried ? 0.30 : 0.62))
    const replayLift = planeReplay ? Math.max(0, planeReplay.height - 3.9) : normalLift
    const liftTarget = normalLift + (replayLift - normalLift) * replayWeight
    cameraLift += (liftTarget - cameraLift) * (1 - Math.exp(-(carried ? 18 : 15) * cameraDt))
    const pixelsPerMeter = width / (2 * size)
    const openingCenter = Math.max(size, start + size * 0.56)
    const groundLine = height / 2 + 3.4 * pixelsPerMeter * 0.993
    drawRiverbank(center, openingCenter, pixelsPerMeter / 16, groundLine, (cameraLift + shakeY) * pixelsPerMeter * 0.993, time)
    view.camera.position.set(center, 9.3 + cameraLift + shakeY, 48)
    view.camera.lookAt({ x: center, y: 3.4 + cameraLift + shakeY, z: 0 })
    obstacles.rockets.forEach((pickup, index) => {
      const object = props.rockets[index]
      object.visible = !pickup.taken && Math.abs(pickup.x - center) < size + 2
      object.position.set(pickup.x, -pickup.y, 0)
      object.rotation.y = Math.sin(time * 2.4) * 0.48
      object.rotation.z = 0.35 + Math.sin(time * 3) * 0.18
    })
    obstacles.aircraft.forEach((craft, index) => {
      const object = props.aircraft[index]
      object.visible = !craft.dead && Math.abs(craft.x - center) < size + 3
      object.position.set(craft.x, -craft.y, 0)
      object.rotation.z = Math.sin(time * 3 + index) * 0.11
      if (craft.kind === 'plane') {
        object.rotation.y = -0.32
        object.children.at(-1).rotation.x = time * 28
      }
    })
    obstacles.rescues.forEach((rescue, index) => {
      let rig = props.rescues[index]
      if (!rig) {
        const passenger = model(courseMeshes, [
          [0xeec4a3, 0, 0.22, 0, 0.28, 0.26, 0.23],
          [0xd28352, 0, 0.34, 0, 0.32, 0.11, 0.25],
          [0x343f53, 0, 0.248, 0.12, 0.25, 0.066, 0.045],
          [0xa9d6e1, -0.062, 0.25, 0.15, 0.075, 0.040, 0.025],
          [0xa9d6e1, 0.062, 0.25, 0.15, 0.075, 0.040, 0.025],
          [0x538597, 0, -0.05, 0, 0.25, 0.27, 0.21],
          [0x345769, 0, -0.02, -0.12, 0.20, 0.23, 0.11],
          [0xc79860, -0.064, -0.035, 0.117, 0.036, 0.22, 0.025],
          [0xc79860, 0.064, -0.035, 0.117, 0.036, 0.22, 0.025],
          [0x538597, -0.174, 0.06, 0.01, 0.095, 0.19, 0.10],
          [0x538597, 0.174, 0.06, 0.01, 0.095, 0.19, 0.10],
          [0xeec4a3, -0.188, 0.17, 0.04, 0.094, 0.085, 0.11],
          [0xeec4a3, 0.188, 0.17, 0.04, 0.094, 0.085, 0.11],
          [0x303a59, -0.073, -0.245, 0, 0.10, 0.17, 0.14],
          [0x303a59, 0.073, -0.245, 0, 0.10, 0.17, 0.14],
          [0x40343b, -0.078, -0.332, 0.04, 0.12, 0.075, 0.20],
          [0x40343b, 0.078, -0.332, 0.04, 0.12, 0.075, 0.20],
        ])
        const guide = rescue.parachute ? model(courseMeshes, [
          [0xe7866a, 0, 0.85, 0, 1.04, 0.32, 0.58, sphere],
          [0xf9d4a0, 0, 0.87, 0.01, 0.38, 0.32, 0.60, sphere],
          [0xf6e2b9, -0.188, 0.46, 0.04, 0.017, 0.59, 0.017],
          [0xf6e2b9, 0.188, 0.46, 0.04, 0.017, 0.59, 0.017],
        ]) : model(courseMeshes, [
          [0xf0bf93, 0.47, 0.19, 0, 0.28, 0.29, 0.25],
          [0x27334b, 0.43, 0.32, 0, 0.29, 0.12, 0.26],
          [0x29435f, 0.53, 0.22, 0.13, 0.075, 0.045, 0.025],
          [0x2869be, 0.13, 0.04, 0, 0.57, 0.32, 0.32],
          [0xe8b24d, 0.23, 0.07, 0.17, 0.13, 0.13, 0.025],
          [0xd6323c, -0.15, 0.018, 0, 0.24, 0.29, 0.30],
          [0x2869be, -0.42, 0, -0.075, 0.44, 0.12, 0.12],
          [0x2869be, -0.40, -0.09, 0.09, 0.43, 0.12, 0.13],
          [0xd6323c, -0.67, 0, -0.075, 0.22, 0.15, 0.14],
          [0xd6323c, -0.65, -0.09, 0.09, 0.21, 0.15, 0.15],
          [0x2869be, 0.59, 0.05, 0.18, 0.55, 0.12, 0.13],
          [0xf0bf93, 0.91, 0.05, 0.18, 0.16, 0.14, 0.15],
          [0x22569f, -0.02, -0.10, -0.16, 0.42, 0.12, 0.13],
          [0xf0bf93, -0.22, -0.10, -0.16, 0.12, 0.13, 0.13],
          [0xca2637, -0.28, 0.19, -0.20, 0.92, 0.06, 0.48],
          [0xe1444a, -0.68, 0.23, -0.20, 0.28, 0.047, 0.48],
        ])
        passenger.scale.set(2.3, 2.3, 2.3)
        const guideScale = rescue.parachute ? 2.3 : 1.65
        guide.scale.set(guideScale, guideScale, guideScale)
        rig = { passenger, guide }
        props.rescues[index] = rig
      }
      const t = rescue.age
      const caught = Math.max(0, t - RESCUE_CATCH_SECONDS)
      const fall = Math.min(t, RESCUE_CATCH_SECONDS)
      const floor = 0.85
      const descent = Math.max(0, Math.min(t, (-rescue.y - floor - 0.42) / 1.5))
      const px = rescue.x + (rescue.parachute ? -0.6 * descent + Math.sin(descent * 2.7) * 0.21 : caught * 7.8)
      const py = Math.max(floor, -rescue.y - (rescue.parachute ? 0.42 + t * 1.5 : 4 * fall ** 2 - caught * 3.4))
      rig.passenger.visible = rescue.parachute ? t < descent + 0.85 : t < 4
      rig.guide.visible = rig.passenger.visible && (rescue.parachute ? t > 0.18 && py > floor : t > 0.2)
      const sway = rescue.parachute && py > floor ? Math.sin(t * 3.8) * 0.12 : 0
      rig.passenger.rotation.z = sway
      rig.passenger.position.set(px, py, 0.35)
      const approach = rescue.parachute ? 0 : Math.max(0, RESCUE_CATCH_SECONDS - t) * 10
      rig.guide.rotation.z = rescue.parachute ? sway : 0.12 + Math.sin(t * 5) * 0.04
      if (!rescue.parachute) {
        rig.guide.children.at(-1).rotation.z = Math.sin(t * 20) * 0.26
      }
      rig.guide.position.set(px - approach, py + (rescue.parachute ? 0 : 0.23 - approach * 0.35), 0.35)
    })
    obstacles.coins.forEach((coin, i) => {
      const object = props.coins[i]
      object.visible = !coin.taken && Math.abs(coin.x - center) < size + 2
      object.position.set(coin.x, -coin.y, 0)
      object.rotation.y = time * 4 + i * 0.4
    })
    obstacles.birds.forEach((obstacle, i) => {
      const { bird, wings } = props.birds[i]
      bird.visible = !obstacle.dead && Math.abs(obstacle.x - center) < size + 2
        && Math.abs(-obstacle.y - 3.4 - cameraLift) < height / pixelsPerMeter / 2 + 2
      if (!bird.visible) return
      bird.position.set(obstacle.x, -obstacle.y, 0)
      bird.scale.x = obstacle.vx < 0 ? -1 : 1
      const startled = obstacle.cooldown > 0.48
      bird.rotation.z = Math.max(-0.25, Math.min(0.25, -obstacle.vy * 0.20))
      const flap = Math.sin(time * (startled ? 24 : 12) + i * 1.7)
      wings.forEach((wing, side) => {
        const sign = side === 0 ? -1 : 1
        wing.rotation.x = sign * (flap * 0.9 - 0.28)
        wing.rotation.y = sign * 0.36
      })
    })
    const boosted = throwing && rocketTime > 0
    rocket.visible = boosted
    if (boosted) {
      rocket.position.set(bx, by, bz)
      rocket.rotation.z = Math.atan2(-vy, vx)
      flame.scale.x = 0.52 + 0.23 * Math.sin(time * 56)
    }
    ball.visible = ball.visible && !boosted
    ball.position.set(bx, by, bz)
    ball.rotation.z = -x / 5
    glint.visible = ball.visible
    glint.position.set(bx - radius * 0.42, by + radius * 0.42, bz + radius * 0.79)
    chain.visible = ball.visible || boosted
    if (chain.visible) {
      const loose = (throwing && !carried) || running || (recovering && recoveryTime < 2.2)
      const swing = Math.sin(launchTime * 17)
      let anchor = (running || recovering || pitRecovery) ? { x: bx - direction * 1.42, y: 0.05, z: 0.16 } : loose ? {
        x: bx - direction * COURSE.chainLength * (0.84 + 0.12 * Math.cos(launchTime * 14)),
        y: Math.max(Math.min(0.05, by), by + 0.14 + 0.46 * swing),
        z: 0.32 * Math.sin(launchTime * 12),
      } : fallen ? { x: bx - direction * 1.4, y: 0.05, z: 0.1 } : hand
      if (recovering || pitRecovery) {
        const grab = pitRecovery ? ease((recoveryTime - (PIT_CLIMB_SECONDS - 0.25)) / 0.25)
          : ease((recoveryTime - 2.2) / 0.45)
        anchor = {
          x: anchor.x + (hand.x - anchor.x) * grab,
          y: anchor.y + (hand.y - anchor.y) * grab,
          z: anchor.z + (hand.z - anchor.z) * grab,
        }
      }
      const distance = Math.hypot(bx - anchor.x, by - anchor.y, bz - anchor.z)
      const slack = Math.sqrt(Math.max(0, COURSE.chainLength ** 2 - distance ** 2)) * 0.36
      const point = (t) => {
        const curve = Math.sin(Math.PI * t)
        return {
          x: anchor.x + (bx - anchor.x) * t,
          y: Math.max(Math.min(0.045, by, anchor.y), anchor.y + (by - anchor.y) * t - curve * slack
            + (loose && !running ? 0.23 * curve * Math.sin(launchTime * 21 - t * 7) : 0)),
          z: anchor.z + (bz - anchor.z) * t,
        }
      }
      links.forEach((joint, index) => {
        const a = heldChain?.nodes[index]
        const b = heldChain?.nodes[index + 1]
        const position = heldChain
          ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
          : point((index + 0.5) / links.length)
        joint.position.set(position.x, position.y, position.z)
        joint.lookAt(heldChain ? b : point((index + 1) / links.length))
      })
    }
    stars.forEach((star, index) => {
      star.visible = fallen
      const orbitAngle = time * 7 + index * Math.PI * 2 / stars.length
      star.position.set(pivotX - 1.2 + Math.cos(orbitAngle) * 0.45, 0.95 + Math.sin(orbitAngle) * 0.2, 0.55)
      star.rotation.z = orbitAngle
    })
    flag.rotation.y = Math.sin(time * 6) * 0.32

    landingMarker.visible = Boolean(preview)
    if (preview) landingMarker.position.x = preview.landing
    dots.forEach((dot, index) => {
      const point = throwing ? trail[index] : preview?.points[index]
      const outline = dotOutlines[index]
      dot.visible = outline.visible = Boolean(point)
      if (point) outline.position.set(throwing ? point[0] : point.x, throwing ? -point[1] : -point.y, 0)
      if (point) dot.position.set(throwing ? point[0] : point.x, throwing ? -point[1] : -point.y, 0.10)
    })
    effects.forEach((effect) => {
      if (effect.kind === 'score') particles.showScore(effect)
      else if (effect.kind === 'help') particles.showHelp(effect)
      else particles.burst(effect.kind, effect.x, effect.y, effect.speed)
    })
    particles.draw(dt, center, 3.4 + cameraLift + shakeY, pixelsPerMeter, width, height)
    app.render()
  }

  return {
    draw,
    isPlayerAirborne() {
      return Boolean(ragdoll && ragdoll.nodes.hips.y > 0.65 && ragdoll.nodes.footA.y > 0.23 && ragdoll.nodes.footB.y > 0.23)
    },
    destroy() {
      ragdoll?.destroy()
      app.destroy(false, { children: true })
    },
  }
}
