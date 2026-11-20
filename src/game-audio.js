import explosionUrl from './assets/aircraft-explosion.wav'
import rescueUrl from './assets/rescue-wow.wav'
import rocketUrl from './assets/rocket-launch.wav'
import climbUrl from './assets/pit-climb.wav'
import overloadUrl from './assets/overload-fall.wav'
import pitUrl from './assets/pit-impact.wav'
import bounceUrl from './assets/ball-bounce.wav'
import birdImpactUrl from './assets/bird-impact.wav'
import screamUrl from './assets/carried-scream.wav'
import impactUrl from './assets/body-impact.wav'
import { RUN_STEP_SECONDS } from './course.js'
import throwUrl from './assets/throw-whoosh.wav'
import spinUrl from './assets/charge-spin-loop.wav'
import startUrl from './assets/charge-start.wav'

const urls = Object.values(import.meta.glob('./assets/coin-*.wav', {
  eager: true, query: '?url', import: 'default',
}))

const stepUrls = Object.values(import.meta.glob('./assets/sand-step-*.wav', {
  eager: true, query: '?url', import: 'default',
}))

export function createGameAudio() {
  const context = new AudioContext()
  const volume = context.createGain()
  volume.gain.value = 1
  volume.connect(context.destination)
  let buffers = []
  const eventBuffers = {}
  let steps = []
  let runBeat = 0
  let stepIndex = -1
  let previous = -1
  let lastPlayed = -1
  let voice
  let screamBuffer
  let screamVoice
  let screamed = false
  let lastFlightTime = 0
  let birdImpactBuffer
  let lastBirdImpact = -1
  let impactBuffer
  let lastImpact = -1
  let spinBuffer
  let spinVoice
  let throwBuffer
  let startBuffer
  let startVoice
  const spinBeats = [0, 0.28, 0.51, 0.69, 0.83]
  let startedAt = null
  let beat = 0
  async function decode(url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Game audio failed to load')
    return context.decodeAudioData(await response.arrayBuffer())
  }
  const ready = Promise.all([
    ...Object.entries({ overload: overloadUrl, pit: pitUrl, bounce: bounceUrl, rescue: rescueUrl, rocket: rocketUrl, climb: climbUrl, explosion: explosionUrl }).map(async ([kind, url]) => {
      eventBuffers[kind] = await decode(url)
    }),
    Promise.all(stepUrls.map(decode)).then((decoded) => { steps = decoded }),
    Promise.all(urls.map(decode)).then((decoded) => { buffers = decoded }),
    decode(screamUrl).then((decoded) => { screamBuffer = decoded }),
    decode(birdImpactUrl).then((decoded) => { birdImpactBuffer = decoded }),
    decode(impactUrl).then((decoded) => { impactBuffer = decoded }),
    decode(throwUrl).then((decoded) => { throwBuffer = decoded }),
    decode(startUrl).then((decoded) => { startBuffer = decoded }),
    decode(spinUrl).then((decoded) => { spinBuffer = decoded }),
  ])
  function fadeVoice(voice) {
    if (!voice) return
    const now = context.currentTime
    voice.gain.gain.setTargetAtTime(0, now, 0.024)
    voice.source.stop(now + 0.10)
  }
  function stopSpin() {
    fadeVoice(startVoice)
    fadeVoice(spinVoice)
    startVoice = spinVoice = null
    startedAt = null
    beat = 0
  }
  function startVoicePlayback(buffer, loop, level, rate) {
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    source.loop = loop
    source.playbackRate.value = rate
    gain.gain.value = level
    source.connect(gain).connect(volume)
    const playing = { source, gain }
    source.onended = () => {
      source.disconnect()
      gain.disconnect()
      if (startVoice === playing) startVoice = null
    }
    source.start()
    return playing
  }
  return {
    ready,
    resume: () => context.resume(),
    close: () => context.close(),
    setVolume(level) { volume.gain.value = level },
    stopSpin,
    updateSpin(active, spinRate) {
      if (!active) {
        stopSpin()
        return
      }
      if (!spinBuffer || context.state !== 'running' || !volume.gain.value) return
      const now = context.currentTime
      const speed = Math.min(spinRate / 22, 1)
      startedAt ??= now
      const elapsed = now - startedAt
      if (beat < spinBeats.length && elapsed >= spinBeats[beat]) {
        fadeVoice(startVoice)
        if (startBuffer) {
          startVoice = startVoicePlayback(startBuffer, false, 0.66 + beat * 0.035, 1.04 + beat * 0.24)
        }
        beat++
      }
      if (beat < spinBeats.length || elapsed < 0.96 || spinRate < 8) return
      if (!spinVoice) {
        fadeVoice(startVoice)
        startVoice = null
        spinVoice = startVoicePlayback(spinBuffer, true, 0, 0.78 + speed * 0.82)
      }
      spinVoice.source.playbackRate.setTargetAtTime(0.78 + speed * 0.82, now, 0.04)
      spinVoice.gain.gain.setTargetAtTime(0.28 + speed * 0.61, now, 0.04)
    },
    updateFootsteps(running, runTime) {
      if (!running) {
        runBeat = 0
        return
      }
      const beat = Math.floor(runTime / RUN_STEP_SECONDS)
      if (beat <= runBeat) return
      runBeat = beat
      if (!steps.length || context.state !== 'running' || !volume.gain.value) return
      stepIndex = (stepIndex + 1 + Math.floor(Math.random() * (steps.length - 1))) % steps.length
      startVoicePlayback(steps[stepIndex], false, beat % 2 ? 0.40 : 0.32, 0.96 + Math.random() * 0.1)
    },
    stopScream() {
      fadeVoice(screamVoice)
      screamVoice = null
      screamed = false
      lastFlightTime = 0
    },
    updateCarriedScream(carried, flightTime, airborne) {
      if (!carried || flightTime < lastFlightTime) {
        fadeVoice(screamVoice)
        screamVoice = null
        screamed = false
      }
      lastFlightTime = carried ? flightTime : 0
      if (!carried || screamed || !airborne || flightTime < 0.12) return
      screamed = true
      if (screamBuffer && context.state === 'running' && volume.gain.value) {
        screamVoice = startVoicePlayback(screamBuffer, false, 0.68, 1)
      }
    },
    playBirdImpact(speed) {
      const now = context.currentTime
      if (!birdImpactBuffer || context.state !== 'running' || !volume.gain.value || now - lastBirdImpact < 0.075) return
      const strength = Math.min(1, speed / 40)
      startVoicePlayback(birdImpactBuffer, false, 0.48 + strength * 0.42, 1.06 - strength * 0.12)
      lastBirdImpact = now
    },
    playEventSound({ kind, speed }) {
      const buffer = eventBuffers[kind]
      if (!buffer || context.state !== 'running' || !volume.gain.value) return
      const strength = kind === 'bounce' ? Math.min(1, speed / 22) : 1
      startVoicePlayback(buffer, false, 0.36 + 0.42 * strength, kind === 'bounce' ? 1.12 - strength * 0.16 : 1)
    },
    playBodyImpact(speed) {
      const now = context.currentTime
      if (!impactBuffer || context.state !== 'running' || !volume.gain.value || now - lastImpact < 0.22) return
      fadeVoice(screamVoice)
      screamVoice = null
      const strength = Math.min(1, Math.max(0, (speed - 2) / 12))
      startVoicePlayback(impactBuffer, false, 0.32 + strength * 0.55, 1.08 - strength * 0.16)
      lastImpact = now
    },
    playThrow() {
      stopSpin()
      if (throwBuffer && context.state === 'running' && volume.gain.value) {
        startVoicePlayback(throwBuffer, false, 0.9, 1)
      }
    },
    playCoin() {
      const now = context.currentTime
      if (context.state !== 'running' || !buffers.length || now - lastPlayed < 0.075 || !volume.gain.value) return
      if (voice) {
        voice.gain.gain.setTargetAtTime(0, now, 0.007)
        voice.source.stop(now + 0.025)
      }
      const index = (previous + 1 + Math.floor(Math.random() * (buffers.length - 1))) % buffers.length
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = buffers[index]
      source.connect(gain).connect(volume)
      voice = { source, gain }
      const current = voice
      source.onended = () => {
        source.disconnect()
        gain.disconnect()
        if (voice === current) voice = null
      }
      source.start(now)
      previous = index
      lastPlayed = now
    },
  }
}
