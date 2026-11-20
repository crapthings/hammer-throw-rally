import { CHARGE_STAGES, MAX_CHARGE } from './charge.js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n.js'
import { createRoot } from 'react-dom/client'
import { mountGame } from './game.js'
import { COURSE } from './course.js'
import { createScene } from './scene.js'
import { createGameAudio } from './game-audio.js'
import { useSettings } from './settings-store.js'
import './index.css'

const bgmUrl = import.meta.glob('./assets/spring-sports-bgm.mp3', {
  eager: true, query: '?url', import: 'default',
})['./assets/spring-sports-bgm.mp3']

const courseDistance = COURSE.hole - COURSE.start
const markers = [0, 200, 400, 600, 800, 1000, courseDistance]
const mapPosition = (x) => (x / COURSE.length * 92 + 4) + '%'

function App() {
  const { t } = useTranslation()
  const language = useSettings((state) => state.language)
  const setLanguage = useSettings((state) => state.setLanguage)
  const bgm = useRef(null)
  const gameAudio = useRef(null)
  const canvas = useRef(null)
  const game = useRef(null)
  const scene = useRef(null)
  const [screen, setScreen] = useState('loading')
  const [panel, setPanel] = useState(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [flightDebug, setFlightDebug] = useState('normal')
  const volume = useSettings((state) => state.volume)
  const setVolume = useSettings((state) => state.setVolume)
  const [status, setStatus] = useState({ phase: 'ready', score: 0, height: 0, shotDistance: 0, power: 0, angle: 38, strokes: 0, position: COURSE.start, distance: courseDistance })

  useEffect(() => {
    let active = true
    const blockContextMenu = (event) => event.preventDefault()
    function toggleDebug(event) {
      if (event.key.toLowerCase() !== 'u' || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.target?.isContentEditable) return
      if (event.target?.matches?.('input, textarea')) return
      setDebugOpen((open) => !open)
    }
    window.addEventListener('keydown', toggleDebug)
    window.addEventListener('contextmenu', blockContextMenu)
    const sound = typeof AudioContext === 'function' ? createGameAudio() : null
    gameAudio.current = sound
    const audioReady = sound?.ready.catch((error) => console.warn(error))
    createScene(canvas.current, (speed) => gameAudio.current?.playBodyImpact(speed)).then(async (renderer) => {
      if (!active) {
        renderer.destroy()
        return
      }
      scene.current = renderer
      await audioReady
      if (active) setScreen('menu')
    }).catch((reason) => {
      console.error(reason)
      if (active) setScreen('error')
    })
    return () => {
      active = false
      window.removeEventListener('contextmenu', blockContextMenu)
      window.removeEventListener('keydown', toggleDebug)
      game.current?.destroy()
      scene.current?.destroy()
      sound?.close()
    }
  }, [])

  function start() {
    gameAudio.current?.setVolume(volume.master * volume.effects / 10000)
    gameAudio.current?.resume().catch(() => {})
    if (bgm.current) {
      bgm.current.volume = volume.master * volume.music / 10000
      bgm.current.play().catch(() => {})
    }
    game.current = mountGame(canvas.current, setStatus, (frame) => {
      gameAudio.current?.updateSpin(frame.phase === 'charging', frame.spinRate)
      gameAudio.current?.updateFootsteps(frame.phase === 'running', frame.runTime)
      frame.sounds.forEach((sound) => gameAudio.current?.playEventSound(sound))
      const tetherTaut = scene.current.draw(frame)
      gameAudio.current?.updateCarriedScream(frame.phase === 'flying' && frame.dragged, frame.launchTime, scene.current.isPlayerAirborne())
      return tetherTaut
    }, () => gameAudio.current?.playCoin(), () => gameAudio.current?.playThrow(), (speed) => gameAudio.current?.playBirdImpact(speed))
    game.current.setFlightDebug(flightDebug)
    setPanel(null)
    setScreen('playing')
  }

  function menu() {
    game.current?.destroy()
    game.current = null
    gameAudio.current?.stopSpin()
    gameAudio.current?.stopScream()
    bgm.current?.pause()
    setScreen('menu')
  }

  const rawPercent = status.power * 100
  const percent = Math.floor(rawPercent + 1e-9)
  const stage = status.power >= 1.5 ? 'thunderCharge'
    : status.power >= 1.2 ? 'goldenCharge' : status.power > 1 ? 'overload' : 'charge'
  const playing = screen === 'playing'
  const charging = status.phase === 'charging'
  const notice = (status.notice && t(status.notice)) || (status.phase === 'running' ? t('running') : status.phase === 'recovering' ? t('recovering') : '')
  return (
    <main className="game-page">
      {bgmUrl && <audio ref={bgm} src={bgmUrl} loop preload="none" />}
      <section className="cabinet" aria-label={t('hole')} inert={!playing}>
        <div className="field">
          <canvas ref={canvas} width="960" height="456" aria-label={t('field')} />
          {playing && status.phase === 'holed' && (
            <div className="victory">
              <div><strong>{t('victory')}</strong><p>{t('results', { throws: status.strokes, score: status.score })}</p></div>
            </div>
          )}
        </div>
        {playing && <>
          <div className="scoreboard compact-board">
            <dl><dt>{t('remaining')}</dt><dd>{status.distance}<small> m</small></dd></dl>
            <dl><dt>{t('shot')}</dt><dd>{status.shotDistance.toFixed(1)}<small> m</small></dd></dl>
            <dl><dt>{t('height')}</dt><dd>{status.height.toFixed(1)}<small> m</small></dd></dl>
            <dl><dt>{t('throws')}</dt><dd>{status.strokes}</dd></dl>
          </div>
          <dl className="game-score"><dt>{t('score')}</dt><dd>{status.score}</dd></dl>
          {status.slowMotion && (
            <div className="slow-motion-hint" role="status">{t('slowMotion')} <span><kbd>{t('space')}</kbd> {t('skip')}</span></div>
          )}
          <div className="game-actions">
            <button type="button" className="reset" onClick={() => game.current?.reset()}>{t('restart')}</button>
            <button type="button" className="reset" onClick={menu}>{t('menu')}</button>
          </div>
          {debugOpen && (
            <aside className="debug-panel" aria-label={t('debug')}>
              <header><strong>{t('debug')}</strong><button type="button" onClick={() => setDebugOpen(false)} aria-label={t('closeDebug')}>×</button></header>
              <label htmlFor="flight-debug">{t('flight')}</label>
              <select id="flight-debug" value={flightDebug} onChange={(event) => {
                setFlightDebug(event.target.value)
                game.current?.setFlightDebug(event.target.value)
              }}>
                <option value="normal">{t('normal')}</option>
                <option value="ragdoll">{t('ragdoll')}</option>
                <option value="barrel">{t('barrel')}</option>
                <option value="horizontal">{t('horizontal')}</option>
              </select>
              <p>{flightDebug === 'normal' ? t('hideDebug') : t('forceDebug')}</p>
            </aside>
          )}
          {(charging || notice || (status.kickAvailable && !status.slowMotion)) && (
            <div className="console compact-console">
              {charging && (
                <div className="meter" data-stage={stage}>
                  <div className="meter-title">
                    <span>{t(stage)}</span>
                    <strong>{percent}<small>%</small></strong>
                  </div>
                  <div className="meter-track" role="meter" aria-label={t('throwPower')} aria-valuemin={0} aria-valuemax={MAX_CHARGE} aria-valuenow={percent}>
                    {CHARGE_STAGES.map(({ start, end, name }) => (
                      <div key={name} data-zone={name} style={{ flexGrow: end - start }}>
                        <span style={{ width: Math.min(100, Math.max(0, (rawPercent - start) * 100 / (end - start))) + '%' }} />
                      </div>
                    ))}
                  </div>
                  <div className="meter-scale" aria-hidden="true">
                    <span>0</span>
                    {CHARGE_STAGES.map(({ end }) => (
                      <span key={end} style={{ left: end * 100 / MAX_CHARGE + '%' }}>{end}%</span>
                    ))}
                  </div>
                  {status.power >= 0.72 && <div className="timing-hint" data-active={status.sweet}>{t(status.sweet ? 'releaseNow' : 'releaseTiming')}</div>}
                  <div className="meter-aim">{status.angle}° <span>·</span> {t('landing', { distance: Math.abs(status.landing - status.position).toFixed(1) })}</div>
                </div>
              )}
              {status.kickAvailable && !status.slowMotion && <div className="timing-hint" data-active={status.tetherTaut}><kbd>{t('space')}</kbd> {t(status.tetherTaut ? 'kickNow' : 'kickWait')}</div>}
              {notice && <p className="message" role="status">{notice}</p>}
            </div>
          )}
        </>}
      </section>
      {playing && (
      <footer className="minimap" aria-label={t('map')}>
        <div className="map-header"><strong>{t('stage')}</strong><span>{courseDistance} m</span></div>
        <div className="map-track">
          {markers.map((meters) => (
            <div className="map-tick" key={meters} style={{ left: mapPosition(COURSE.start + meters) }}>
              <span>{meters === 0 ? t('startMarker') : meters === courseDistance ? t('finishMarker') : meters + ' m'}</span>
            </div>
          ))}
          {status.landing != null && <div className="map-landing" style={{ left: mapPosition(status.landing) }} title={t('firstLanding')} />}
          <div className="map-ball" style={{ left: mapPosition(status.position) }} title={t('ball')} />
        </div>
      </footer>
      )}
      {!playing && (
        <div className="boot-screen">
          {screen === 'loading' && <div className="boot-card" role="status"><p>{t('loading')}</p><progress aria-label={t('loadingLabel')} /></div>}
          {screen === 'error' && <div className="boot-card" role="alert"><p>{t('loadError')}</p><button className="reset" onClick={() => location.reload()}>{t('retry')}</button></div>}
          {screen === 'menu' && (
            <div className="boot-card title-screen">
              <h1 className="hero-title">{t('title')}<span>{t('bang')}</span></h1>
              <div className="menu-layout">
              <nav aria-label={t('mainMenu')}>
                <button className="reset start-button" onClick={start}>{t('start')}</button>
                <button className="reset" aria-expanded={panel === 'settings'} onClick={() => setPanel(panel === 'settings' ? null : 'settings')}>{t('settings')}</button>
                <button className="reset" aria-expanded={panel === 'help'} onClick={() => setPanel(panel === 'help' ? null : 'help')}>{t('help')}</button>
              </nav>
              {panel === 'settings' && (
                <div className="menu-panel settings-panel">
                  <div className="language-row">
                    <span id="language-label">{t('language')}</span>
                    <div className="language-toggle" role="group" aria-labelledby="language-label">
                      <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
                      <button type="button" lang="zh-CN" aria-pressed={language === 'zh-CN'} onClick={() => setLanguage('zh-CN')}>简体中文</button>
                    </div>
                  </div>
                  {['master', 'effects', 'music'].map((key) => (
                    <label className="volume-row" key={key}>
                      <span>{t(key)}</span>
                      <input type="range" min="0" max="100" value={volume[key]} style={{ '--level': volume[key] + '%' }}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          setVolume(key, value)
                        }} />
                      <output>{volume[key]}%</output>
                    </label>
                  ))}
                </div>
              )}
              {panel === 'help' && (
                <ul className="menu-panel">
                  <li>{t('controlsHelp')}</li>
                  <li>{t('overloadHelp')}</li>
                  <li>{t('carryHelp')}</li>
                  <li>{t('timingHelp')}</li>
                  <li>{t('routeHelp')}</li>
                  <li>{t('trampolineHelp')}</li>
                  <li>{t('kickHelp')}</li>
                  <li>{t('courseHelp')}</li>
                </ul>
              )}
              </div>
              <p className="engine-credit" lang="en">
                Powered by <a href="https://github.com/pixijs/3d" target="_blank" rel="noopener noreferrer">Pixi3D.js</a>
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

createRoot(document.getElementById('root')).render(<App />)
