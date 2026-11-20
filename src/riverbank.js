import { Graphics } from 'pixi.js'

// Artwork grid: 16 pixels per world metre, with the running surface at y = 0.
export function createRiverbank(stage, length) {
  let seed = 17
  function random(n) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return Math.floor(seed / 4294967296 * n)
  }
  const layers = []
  const windsocks = []
  function layer(speed, lift) {
    const g = new Graphics()
    stage.addChild(g)
    layers.push({ g, speed, lift })
    return g
  }
  const box = (g, x, y, w, h, color) => g.rect(x, y, w, h).fill(color)
  const poly = (g, points, color) => g.poly(points).fill(color)
  const end = Math.ceil(length * 16)
  const sky = layer(0.09, 0.15)
  box(sky,-800,-1400,end+1600,1500,0xa6c8e2)
  const clouds = new Graphics()
  sky.addChild(clouds)
  for (let x = -280; x < end * 0.09 + 800; x += 80 + random(120)) {
    const y = -95 - random(80)
    for (let i = 0; i < 6; i++) box(clouds,x+i*8,y-random(7),16+random(15),5+random(7),0xf4f0e2)
  }
  const hills = layer(0.19, 0.28)
  for (let band = 0; band < 2; band++) {
    const contour = [-800, 15]
    for (let x = -800; x < end * 0.19 + 1000; x += 4) {
      const y = Math.round(-53 + band*17 + 10*Math.sin(x/53+band) + 6*Math.sin(x/21))
      contour.push(x,y,x+4,y)
    }
    contour.push(contour.at(-2),15)
    poly(hills,contour,band ? 0x83aab4 : 0x92b6d0)
  }
  const landmarkSpeed = 0.28
  const landmarks = layer(landmarkSpeed, 0.37)
  const windmills = []
  const plaster = 0xd6d1b6
  const roof = 0x596e88
  const timber = 0xa57871

  function building(x, y, width, height) {
    box(landmarks, x, y - height, width, height, plaster)
    poly(landmarks, [x - 4, y - height, x + 4, y - height - 7,
      x + width - 4, y - height - 7, x + width + 4, y - height], roof)
    for (let windowX = x + 4; windowX < x + width - 3; windowX += 8) {
      box(landmarks, windowX, y - height + 4, 4, 5, 0x8198aa)
    }
  }

  const sites = [
    [42, 'village'], [125, 'shrine'], [225, 'school'], [337, 'mill'],
    [432, 'village'], [540, 'rail'], [646, 'shrine'], [752, 'lighthouse'],
    [849, 'school'], [954, 'mill'], [1050, 'rail'], [1150, 'lighthouse'],
  ]
  for (const [metres, kind] of sites) {
    if (metres >= length) continue
    const x = Math.round(metres * 16 * landmarkSpeed + 150)
    const y = -26
    box(landmarks, x - 12, y - 2, kind === 'rail' ? 91 : 70, 4, 0x789b92)
    if (kind === 'village') {
      building(x, y, 19, 13)
      building(x + 23, y, 23, 21)
      building(x + 49, y, 13, 11)
    } else if (kind === 'shrine') {
      for (let tier = 0; tier < 3; tier++) {
        const w = 31 - tier * 6
        const deckY = y - tier * 11
        box(landmarks, x + 18 - w / 2, deckY - 10, w, 10, timber)
        poly(landmarks, [x + 13 - w / 2, deckY - 10, x + 18 - w / 2, deckY - 15,
          x + 18 + w / 2, deckY - 15, x + 23 + w / 2, deckY - 10], roof)
      }
      box(landmarks, x + 17, y - 43, 2, 7, timber)
    } else if (kind === 'school') {
      building(x, y, 45, 19)
      building(x + 31, y, 17, 32)
      box(landmarks, x + 36, y - 27, 7, 7, 0xf2e3c9)
      box(landmarks, x + 39, y - 26, 1, 4, roof)
    } else if (kind === 'mill') {
      building(x, y, 19, 28)
      const blades = new Graphics()
      landmarks.addChild(blades)
      blades.position.set(x + 9, y - 24)
      for (const direction of [-1, 1]) {
        box(blades, -1, Math.min(0, direction * 18), 3, 18, 0xac877c)
        box(blades, Math.min(0, direction * 18), -1, 18, 3, 0xac877c)
      }
      box(blades, -2, -2, 5, 5, plaster)
      windmills.push(blades)
    } else if (kind === 'rail') {
      building(x + 4, y, 28, 13)
      box(landmarks, x - 4, y - 6, 76, 3, roof)
      box(landmarks, x + 34, y - 14, 31, 9, 0xb28a77)
      for (let i = 0; i < 4; i++) box(landmarks, x + 37 + i * 6, y - 13, 4, 4, plaster)
    } else {
      poly(landmarks, [x + 6, y, x + 9, y - 32, x + 20, y - 32, x + 24, y], plaster)
      box(landmarks, x + 7, y - 36, 15, 6, roof)
      box(landmarks, x + 10, y - 35, 9, 4, 0xf6d3a2)
      poly(landmarks, [x + 5, y - 36, x + 14, y - 43, x + 24, y - 36], timber)
      box(landmarks, x + 8, y - 19, 14, 4, timber)
    }
  }
  const water = layer(0.36, 0.45)
  box(water,-800,-26,end+1600,200,0x78b7d2)
  const ripples = new Graphics()
  water.addChild(ripples)
  for (let x = -500; x < end*0.36+800; x += 5+random(12)) {
    box(ripples,x,-24+random(23),3+random(9),1,0xb9dbe1)
  }
  for (let x = 150; x < end*0.36+600; x += 310+random(240)) {
    for (let i = 0; i < 4; i++) {
      const p=x+i*22
      box(water,p,-30,23,3,0x567f94)
      water.moveTo(p,-30).lineTo(p+6,-40).lineTo(p+16,-40).lineTo(p+22,-30).stroke({color:0x5e879f,width:2})
      if (i%2===0) box(water,p,-27,3,9,0xb2b8ac)
    }
  }
  const bank = layer(0.74, 0.85)
  box(bank,-800,-6,end+1600,200,0x93ae79)
  function cherry(x) {
    box(bank,x,-29,5,24,0x846c63)
    poly(bank,[x+2,-19,x-10,-30,x-7,-31,x+4,-24,x+14,-34,x+16,-32,x+4,-18],0x846c63)
    for(let i=0;i<25;i++) {
      const dx=random(36)-18
      const y=-33-Math.round((18-Math.abs(dx))*0.35)-random(6)
      box(bank,x+dx,y,7+random(8),6+random(5),[0xe7b9b9,0xf4cfcb,0xf5ded6][random(3)])
    }
  }
  for(let x=85;x<end*0.74+700;x+=70+random(140)) cherry(x)
  // A single start tent and three carp windsocks.
  for(const x of [10,49]) box(bank,x,-22,1,17,0x536d78)
  poly(bank,[5,-22,17,-33,44,-33,54,-22],0xf4f0e2)
  box(bank,5,-22,49,2,0xd9b998)
  box(bank,6,-64,1,58,0x627e86)
  for(let i=0;i<3;i++) {
    const y=-61+i*9
    const c=[0x568bb2,0xd88979,0x719eba][i]
    const fish = new Graphics()
    bank.addChild(fish)
    fish.position.set(7,y)
    poly(fish,[0,0,13,1,22,2,20,4,22,6,10,5,0,4],c)
    box(fish,2,1,2,2,0xf4f0e2)
    box(fish,7,2,2,1,0xf4f0e2)
    windsocks.push(fish)
  }
  const turf = layer(1, 1)
  box(turf,-800,-2,end+1600,550,0x91ad73)
  box(turf,-800,4,end+1600,3,0xc29b76)
  box(turf,-800,7,end+1600,2,0xb6c681)
  // Longer brush strokes follow the embankment; the near edge carries deeper shadows.
  for (let band = 0; band < 3; band++) {
    const points = [-800, 560]
    for (let x = -800; x <= end + 900; x += 8) {
      const y = Math.round(16 + band * 13 + Math.sin(x / 38 + band) * 2 + Math.sin(x / 86) * 3)
      points.push(x, y, x + 8, y)
    }
    points.push(points.at(-2), 560)
    poly(turf, points, [0x9bb178, 0x8da56e, 0x80976a][band])
  }
  for (let x = -400; x < end + 500; x += 5 + random(10)) {
    const y = 10 + random(62)
    const green = random(2) ? 0xacc48b : 0x728f60
    poly(turf, [x,y,x+2,y-2,x+2,y,x+5,y-1,x+4,y+1,x,y+1], green)
    if (random(14) === 0) box(turf,x+2,y-2,1,1,0xf4e4b6)
  }
  return (center, startCenter, scale, ground, lift, time) => {
    windmills.forEach((blades, i) => { blades.rotation = time * 0.7 + i })
    clouds.x = Math.round(12 * Math.sin(time * 0.055))
    ripples.x = Math.round(2 * Math.sin(time * 1.4))
    ripples.alpha = 0.75 + 0.2 * Math.sin(time * 1.8)
    windsocks.forEach((fish, i) => {
      fish.rotation = 0.05 * Math.sin(time * 3 + i)
      fish.scale.x = 0.94 + 0.06 * Math.sin(time * 2.3 + i)
    })
    for (const {g,speed,lift: vertical} of layers) {
      g.scale.set(scale)
      g.position.set(Math.round(-(center-startCenter)*16*scale*speed),Math.round(ground+lift*vertical))
    }
  }
}
