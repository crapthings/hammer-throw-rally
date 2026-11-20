import { Container, Graphics, Text } from 'pixi.js'

export function createParticles(stage) {
  const layer = new Container()
  stage.addChild(layer)
  const particles = []
  function burst(kind, x, y, speed = 6) {
    const blood = kind === 'bird'
    const fire = kind === 'explosion' || kind === 'rocket'
    const count = fire ? 40 : blood ? 32 : Math.min(24, 6 + Math.round(speed))
    for (let i = 0; i < count; i++) {
      const feather = blood && i % 4 === 0
      const color = fire ? [0xffd363, 0xe89147, 0xe45c43, 0x626575][i % 4] : blood ? (feather ? 0xf4f0e2 : [0xbb373b, 0xd94b45, 0x7f2837][i % 3]) : [0xd9c6a4, 0xebd7b5, 0xc4ad8a][i % 3]
      const graphic = new Graphics().rect(-0.5, -0.5, feather ? 2 : 1, 1).fill(color)
      layer.addChild(graphic)
      const angle = Math.random() * Math.PI * 2
      const energy = fire ? 2 + Math.random() * 11 : blood ? 2 + Math.random() * Math.min(9, speed * 0.3) : 0.8 + Math.random() * Math.min(5, speed * 0.28)
      particles.push({
        graphic, x, y, vx: Math.cos(angle) * energy,
        vy: blood || fire ? Math.sin(angle) * energy : -Math.abs(Math.sin(angle) * energy) - 0.4,
        age: 0, life: 0.45 + Math.random() * (feather ? 1.3 : 0.55),
        size: blood ? 0.04 + Math.random() * 0.06 : 0.07 + Math.random() * 0.11,
        gravity: feather ? 1.5 : blood || fire ? 11 : 0.8, dust: !blood && !fire,
      })
    }
    while (particles.length > 260) particles.shift().graphic.destroy()
  }
  function showScore({ x, y, points }) {
    const graphic = new Text({
      text: '+' + points,
      style: { fontFamily: 'monospace', fontWeight: '900', fontSize: 24, fill: 0xffdd75, stroke: { color: 0x382a36, width: 4 }, align: 'center' },
    })
    graphic.anchor.set(0.5)
    layer.addChild(graphic)
    particles.push({ graphic, x, y, age: 0, life: 0.85, score: true })
  }
  function showHelp({ x, y }) {
    const graphic = new Container()
    const burst = new Graphics()
      .poly([-51, -8, -39, -14, -43, -24, -23, -21, -13, -34, 1, -24, 18, -32, 25, -21, 46, -24, 42, -12, 54, -4, 43, 5, 48, 17, 27, 15, 19, 24, 5, 17, -8, 29, -13, 16, -37, 20, -35, 10, -53, 6])
      .fill(0xffedd1).stroke({ color: 0x33293a, width: 3, join: 'round' })
    const caption = new Text({
      text: 'HELP!',
      style: { fontFamily: 'monospace', fontStyle: 'italic', fontWeight: '900', fontSize: 24, fill: 0xb6323a },
    })
    caption.anchor.set(0.5)
    graphic.addChild(burst, caption)
    layer.addChild(graphic)
    particles.push({ graphic, x, y, age: 0, life: 1.4, score: true, help: true })
  }
  function clear() {
    particles.splice(0).forEach((particle) => particle.graphic.destroy())
  }
  return {
    burst, clear, showScore, showHelp,
    draw(dt, center, cameraHeight, scale, width, height) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.age += dt
        if (p.age >= p.life) {
          p.graphic.destroy()
          particles.splice(i, 1)
          continue
        }
        if (p.score) {
          // Project the pickup once, then animate entirely in screen space.
          p.screenX ??= width / 2 + (p.x - center) * scale
          p.screenY ??= height / 2 + (cameraHeight + p.y) * scale * 0.993
          const marginX = Math.min(p.help ? 57 : 42, width / 2)
          const marginY = Math.min(p.help ? 35 : 22, height / 2)
          const anchorX = Math.max(marginX, Math.min(width - marginX, p.screenX))
          const anchorY = Math.max(marginY, Math.min(height - marginY, p.screenY))
          p.graphic.position.set(Math.round(anchorX), Math.round(Math.max(marginY, anchorY - (p.help ? 39 : 52) * p.age)))
          const pop = Math.min(1, p.age / 0.12)
          p.graphic.scale.set(0.72 + 0.28 * pop + Math.sin(pop * Math.PI) * 0.30)
          p.graphic.alpha = Math.min(p.help ? p.age / 0.25 : 1, (p.life - p.age) / (p.help ? 0.4 : 0.25))
          continue
        }
        p.vy += p.gravity * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= Math.exp(-dt * 1.3)
        p.graphic.position.set(Math.round(width / 2 + (p.x - center) * scale), Math.round(height / 2 + (cameraHeight + p.y) * scale * 0.993))
        p.graphic.scale.set(p.size * scale * (p.dust ? 1 + p.age * 2 : 1))
        p.graphic.rotation += dt * (p.dust ? 0.3 : 7)
        p.graphic.alpha = (1 - p.age / p.life) * (p.dust ? 0.62 : 1)
      }
    },
  }
}
