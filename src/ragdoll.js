import { COURSE } from './course.js'
import Rapier from '@dimforge/rapier3d-compat'

let initialization
export function initRagdollPhysics() {
  initialization ??= Rapier.init()
  return initialization
}

// Planar collision bounds in the side-scrolling plane, measured in metres.
const body = {
  head: [0.06, 1.34, 0.46],
  chest: [0, 0.87, 0.36],
  hips: [0, 0.52, 0.24],
  kneeA: [-0.19, 0.34, 0.14],
  kneeB: [0.19, 0.34, 0.14],
  footA: [-0.22, 0.16, 0.15],
  footB: [0.22, 0.16, 0.15],
  elbow: [0.29, 0.84, 0.10],
  grip: [0.46, 0.71, 0.12],
  freeElbow: [-0.35, 0.84, 0.10],
  freeHand: [-0.50, 0.66, 0.11],
}

const joints = [
  ['head', 'chest', 0.75], ['chest', 'hips', 0.65],
  ['hips', 'kneeA', 1.65], ['kneeA', 'footA', 1.8],
  ['hips', 'kneeB', 1.65], ['kneeB', 'footB', 1.8],
  ['chest', 'elbow', 2.2], ['elbow', 'grip', 1.9],
  ['chest', 'freeElbow', 2.2], ['freeElbow', 'freeHand', 1.9],
]

export function createRagdoll(origin, direction, grip, courseLength, ballOrigin = origin + direction * 0.88, onImpact = () => {}) {
  const world = new Rapier.World({ x: 0, y: -17, z: 0 })
  const step = 1 / 120
  world.timestep = step
  world.numSolverIterations = 16
  const halfLength = courseLength / 2
  world.createCollider(Rapier.ColliderDesc.cuboid(halfLength + 1, 1, 2).setTranslation(halfLength, -1, 0).setFriction(0.75).setCollisionGroups(0x0001ffff))
  for (const edge of [-0.5, courseLength + 0.5]) {
    world.createCollider(Rapier.ColliderDesc.cuboid(0.5, 100, 2).setTranslation(edge, 100, 0).setCollisionGroups(0x0001ffff))
  }

  const bodies = {}
  const nodes = {}
  for (const [name, [localX, localY, radius]] of Object.entries(body)) {
    const x = name === 'grip' ? grip.x : origin + localX * direction
    const y = Math.max(radius, name === 'grip' ? grip.y : localY)
    const rigidBody = world.createRigidBody(Rapier.RigidBodyDesc.dynamic()
      .setTranslation(x, y, 0).enabledTranslations(true, true, false).setLinearDamping(0.24).setAngularDamping(0.5))
    world.createCollider(Rapier.ColliderDesc.ball(radius)
      .setMass(name === 'head' || name === 'chest' ? 2 : 1).setCollisionGroups(0x00020001).setFriction(0.65).setRestitution(0.15), rigidBody)
    bodies[name] = rigidBody
    nodes[name] = { x, y }
  }
  for (const [a, b, limit] of joints) {
    const dx = (nodes[b].x - nodes[a].x) / 2
    const dy = (nodes[b].y - nodes[a].y) / 2
    const joint = world.createImpulseJoint(
      Rapier.JointData.revolute({ x: dx, y: dy, z: 0 }, { x: -dx, y: -dy, z: 0 }, { x: 0, y: 0, z: 1 }),
      bodies[a], bodies[b], true,
    )
    joint.setLimits(-limit, limit)
  }

  let lastX = ballOrigin
  let lastY = COURSE.radius
  let remainder = 0
  let impactCooldown = 0
  const touching = Object.fromEntries(Object.keys(body).map((name) => [name, true]))
  const fixedStepTolerance = 1e-9
  const ball = world.createRigidBody(Rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(lastX, lastY, 0))
  world.createImpulseJoint(
    Rapier.JointData.rope(COURSE.chainLength, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
    ball, bodies.grip, true,
  )

  return {
    nodes,
    kick(direction) {
      bodies.footA.applyImpulse({ x: direction * 2, y: 1.6, z: 0 }, true)
      bodies.footB.applyImpulse({ x: direction * 1.3, y: 2.4, z: 0 }, true)
    },
    advance(dt, x, y) {
      if (dt <= 0) return
      for (let elapsed = step - remainder; elapsed <= dt + fixedStepTolerance; elapsed += step) {
        const fraction = Math.min(1, elapsed / dt)
        ball.setNextKinematicTranslation({ x: lastX + (x - lastX) * fraction, y: lastY + (y - lastY) * fraction, z: 0 })
        const downwardSpeeds = Object.fromEntries(Object.entries(bodies).map(([name, rigidBody]) => [name, -rigidBody.linvel().y]))
        world.step()
        impactCooldown = Math.max(0, impactCooldown - step)
        let impact = 0
        let impactX = 0
        for (const [name, rigidBody] of Object.entries(bodies)) {
          const bottom = rigidBody.translation().y - body[name][2]
          const contact = bottom <= 0.025
          if (contact && !touching[name] && downwardSpeeds[name] > impact) {
            impact = downwardSpeeds[name]
            impactX = rigidBody.translation().x
          }
          if (contact) touching[name] = true
          else if (bottom > 0.09) touching[name] = false
        }
        if (impact > 2 && impactCooldown === 0) {
          onImpact(impact, impactX)
          impactCooldown = 0.22
        }
      }
      remainder = Math.max(0, remainder + dt - Math.floor((remainder + dt + fixedStepTolerance) / step) * step)
      lastX = x
      lastY = y
      for (const name of Object.keys(nodes)) nodes[name] = bodies[name].translation()
    },
    destroy() {
      world.free()
    },
  }
}
