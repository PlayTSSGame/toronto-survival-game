import { useEffect, useRef, useState } from 'react'
import { actForTurn, canChoose, DAYS_PER_ACT, timeLabel, TOTAL_TURNS } from './engine/game'
import { daysSurvived, loadBest, recordBest } from './engine/highscore'
import { computeRank, copyText, outcomeTitle, shareText } from './engine/rank'
import type { CharacterClass, Environment, FeedSource, GameState } from './types'
import { Avatar, Bolt, Coin, Heart, HeroLife, Skyline } from './ui/Art'
import { Count } from './ui/Count'
import { Doors } from './ui/Doors'
import { makeResultPng, saveOrShare } from './ui/shareImage'
import { SettingsPanel } from './ui/SettingsPanel'
import { useSettings } from './ui/settings'
import { playNextDay, playSfx, preloadSfx, vibrate } from './ui/sound'
import { moodFor } from './ui/mood'
import { kindOf, type Kind } from './ui/kinds'
import { RankBadge } from './ui/Badges'
import { CityMap } from './ui/CityMap'
import { Backdrop, Burst, Confetti, Sky } from './ui/Fx'
import { ItemIcon } from './ui/Items'
import { Scene } from './ui/Scenes'
import { TrainIcon, WeatherIcon } from './ui/Weather'
import { useGame } from './ui/useGame'
import './App.css'

const SPONSOR_URL = import.meta.env.VITE_SPONSOR_URL || 'https://google.com'
const REPORT_URL = `mailto:${import.meta.env.VITE_REPORT_EMAIL || 'playtssgame@gmail.com'}`

/** Live Toronto date and time, e.g. "Mon, Nov 9, 2026 • 12:30 PM". Shown on the home banner. */
function TorontoClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(id)
  }, [])
  const tz = 'America/Toronto'
  const date = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const time = now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  return <time className="clock" dateTime={now.toISOString()}><span>{date}</span><i aria-hidden="true"> • </i><span>{time}</span></time>
}

/** Each survivor owns a colour that tints their cards. */
const THEME: Record<Kind, string> = { commuter: '#4CC9F0', intern: '#FFD23F', campus: '#2EE6A6', newcomer: '#FF6FB5', courier: '#FF9F43', hustler: '#A78BFA', other: '' }
const SPARE = ['#FF6FB5', '#FF9F43']
const themeOf = (id: string, i = 0) => THEME[kindOf(id)] || SPARE[i % SPARE.length]

const ACTS = [
  { name: 'Act 1', note: 'Settling in', color: '#2EE6A6' },
  { name: 'Act 2', note: 'The squeeze', color: '#FFD23F' },
  { name: 'Act 3', note: 'Rock bottom', color: '#FF3B30' },
  { name: 'Act 4', note: 'Hustle mode', color: '#FF6FB5' },
  { name: 'Act 5', note: 'Second wind', color: '#4CC9F0' },
  { name: 'Act 6', note: 'Final stretch', color: '#A78BFA' },
]

const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-CA', { maximumFractionDigits: 2 })}`
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '') + Math.abs(n)
const signedMoney = (n: number) => (n > 0 ? '+' : '') + money(n)
const tone = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat')

/** One bar segment per act, filling as the days pass. */
function Track({ turn }: { turn: number }) {
  const endless = turn > TOTAL_TURNS
  return (
    <div className="track" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_TURNS} aria-valuenow={Math.min(turn, TOTAL_TURNS)} aria-label={endless ? `Day ${turn}, endless mode` : `Day ${turn} of ${TOTAL_TURNS}`}>
      {ACTS.map((act, i) => {
        const fill = Math.max(0, Math.min(1, (turn - i * DAYS_PER_ACT) / DAYS_PER_ACT))
        return <i key={act.name} className={fill > 0 && fill < 1 ? 'now' : ''} style={{ '--c': act.color, '--f': fill } as React.CSSProperties} />
      })}
    </div>
  )
}

/** Ten chunky segments, game-style. */
function Segs({ value, color }: { value: number; color: string }) {
  const filled = Math.ceil(Math.max(0, Math.min(100, value)) / 10)
  return (
    <div className={`segs${value <= 30 ? ' low' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} style={i < filled ? { background: value <= 30 ? '#FF3B30' : color } : undefined} />
      ))}
    </div>
  )
}

function Chip({ icon, label, text, src, bad }: { icon: React.ReactNode; label: string; text: string; src: FeedSource; bad: boolean }) {
  return (
    <span className={`chip${bad ? ' bad' : ''}`} title={src === 'live' ? 'Live data' : src === 'cached' ? 'Saved data' : 'Offline fallback'}>
      {icon}
      <i className={`pip ${src}`} aria-hidden="true" />
      <span className="sr">{label} </span>{text.replace(/^(Weather|TTC):? ?/, '').replace(/ \(saved\)$/, '')}
    </span>
  )
}

function Hud({ state, char, env, place, index }: { state: GameState; char: CharacterClass; env: Environment; place: string; index: number }) {
  const day = state.turn
  const act = ACTS[actForTurn(state.turn) - 1]
  const { cash, sanity, health } = state.stats
  const theme = themeOf(char.class_id, index)
  return (
    <header className="hud" style={{ '--theme': theme } as React.CSSProperties}>
      <Sky day={day} />
      <div className="hud-top">
        <div className="face"><Avatar id={char.class_id} size={46} mood={moodFor(sanity)} hurt={health < 30} /></div>
        <div className="who">
          <strong>{char.display_name}</strong>
          <span>{place}</span>
        </div>
        <div className="daytag" aria-label={`Day ${day}`}>
          <small>DAY</small>
          <b>{day}</b>
        </div>
      </div>

      <div className="stats">
        <div className={`stat cash${cash < 0 ? ' neg' : ''}`}>
          <Coin size={26} />
          <div>
            <b><Count value={cash} format={money} /></b>
            {cash < 0 ? <small>OVERDRAFT</small> : state.stipend > 0 && <small className="pay">+{money(state.stipend)}/day</small>}
          </div>
        </div>
        <div className={`stat${sanity <= 20 ? ' jitter' : ''}`}>
          <Bolt size={26} />
          <div><b><Count value={sanity} format={(n) => String(Math.round(n))} /></b><Segs value={sanity} color="#4CC9F0" /></div>
        </div>
        <div className={`stat${health <= 20 ? ' beat' : ''}`}>
          <Heart size={26} />
          <div><b><Count value={health} format={(n) => String(Math.round(n))} /></b><Segs value={health} color="#FF6FB5" /></div>
        </div>
      </div>

      <div className="meta">
        <span className="act" style={{ background: act.color }}>{state.endless ? 'Endless mode' : `${act.name} · ${act.note}`}</span>
        <span className="week">{timeLabel(state.turn)}</span>
        <Track turn={state.turn} />
      </div>
      <div className="chips">
        <Chip icon={<WeatherIcon tempC={env.tempC} precipMm={env.precipMm} />} label="Weather" text={env.weatherLabel} src={env.weatherSource} bad={env.tempC < 0 || env.precipMm > 5} />
        <Chip icon={<TrainIcon delayed={env.delayMinutes > 15} />} label="TTC" text={env.transitLabel} src={env.transitSource} bad={env.delayMinutes > 15} />
      </div>
    </header>
  )
}

/** Bests are recorded by the effect in App as the run changes; the end screen only reads them. */
const loadBestNow = () => loadBest()

function EndCard({ state, onReset, onEndless }: { state: GameState; onReset: () => void; onEndless: () => void }) {
  const [msg, setMsg] = useState('')
  const saveImage = async () => {
    try {
      const blob = await makeResultPng(state, computeRank(state), outcomeTitle(state), window.location.origin + window.location.pathname)
      setMsg((await saveOrShare(blob)) === 'shared' ? 'Shared!' : 'Image saved.')
    } catch {
      setMsg('Could not create the image on this browser.')
    }
  }
  const lost = state.status === 'lost'
  const best = loadBestNow()
  const share = async () => {
    const text = shareText(state, window.location.origin + window.location.pathname)
    setMsg((await copyText(text)) === 'copied' ? 'Copied! Go brag.' : 'Could not copy. Select and copy this instead:\n' + text)
  }
  return (
    <section className={`end ${lost ? 'lost' : 'won'}`}>
      {!lost && <Confetti />}
      <p className="banner">{lost ? 'Game over' : 'You made it!'}</p>
      <RankBadge rank={computeRank(state)} />
      <p className="ranklab">Your rank</p>
      <h2 className="rank">{computeRank(state)}</h2>
      <p className="outcome">{outcomeTitle(state)}</p>
      {lost && <p className="reason">{state.lossReason}</p>}
      {(state.endless || best.days > TOTAL_TURNS) && (
        <p className="best">Endless record: {Math.max(best.days, daysSurvived(state))} days · peak {money(Math.max(best.cash, state.stats.cash))}</p>
      )}
      <div className="final">
        <span><Coin size={22} /> {money(state.stats.cash)}</span>
        <span><Bolt size={22} /> {state.stats.sanity}</span>
        <span><Heart size={22} /> {state.stats.health}</span>
      </div>
      {!lost && !state.endless && <button className="key key-yellow wide" onClick={onEndless}>Keep Surviving (Endless Mode)</button>}
      <button className="key key-red wide" onClick={onReset}>{lost ? 'Try again' : 'Play again'}</button>
      <button className="key key-sky wide" onClick={share}>Copy result</button>
      <button className="key key-mint wide" onClick={saveImage}>Save image</button>
      {msg && <p className="toast" role="status">{msg}</p>}
    </section>
  )
}

export default function App() {
  const { error, characters, state, char, event, env, start, choose, next, reset, keepSurviving } = useGame()
  const index = char ? characters.findIndex((c) => c.class_id === char.class_id) : 0
  const [showMap, setShowMap] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, updateSettings] = useSettings()
  const act = state ? ACTS[actForTurn(state.turn) - 1] : ACTS[1]
  const res = state?.lastResult?.delta
  const loss = !!res && (res.sanity < 0 || res.health < 0)
  const gain = !!res && (res.sanity > 0 || res.health > 0 || res.cash > 0)
  const place = event?.location ?? char?.home_location ?? ''
  const status = state?.status
  const lowVitals = !!state && state.status === 'playing' && (state.stats.sanity <= 20 || state.stats.health <= 20)

  useEffect(() => { preloadSfx() }, [])

  // Keep the personal bests (most days, most cash) up to date as the run changes.
  useEffect(() => { if (state) recordBest(state) }, [state])

  // Sound and haptics follow what just happened.
  const lastResult = state?.lastResult
  useEffect(() => {
    if (!lastResult) return
    const d = lastResult.delta
    if (d.sanity < 0 || d.health < 0) { playSfx('hit'); vibrate([80, 40, 80]) }
    else if (d.cash > 0) { playSfx('coin'); vibrate(30) }
    else if (d.sanity > 0 || d.health > 0) { playSfx('good'); vibrate(30) }
  }, [lastResult])
  useEffect(() => {
    if (status === 'finished') { playSfx('win'); vibrate([60, 40, 60, 40, 140]) }
    if (status === 'lost') { playSfx('lose'); vibrate(220) }
  }, [status])

  // Hardware back / swipe-back during a run returns to the menu instead of leaving the app
  // or leaving the UI in a half-state. One history entry is pushed per run.
  const inRun = !!state
  const resetRef = useRef(reset)
  useEffect(() => { resetRef.current = reset })
  useEffect(() => {
    if (!inRun) return
    window.history.pushState({ tssRun: true }, '')
    const onPop = () => { setShowMap(false); setShowSettings(false); resetRef.current() }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [inRun])

  const days = event && state?.lastResult ? event[state.lastResult.choiceKey].metrics_impact.turns_consumed : 1

  return (
    <div className="app" data-act={state ? actForTurn(state.turn) : 0} style={{ '--act': act.color } as React.CSSProperties}>
      <Backdrop />
      {state && <Doors key={`${state.turn}-${state.characterId}`} />}
      {lowVitals && <div className="vignette" aria-hidden="true" />}
      {state && char && <Hud state={state} char={char} env={env} place={place} index={index} />}

      <main className="main">
        {error && <p role="alert" className="notice">Game content failed to load: {error}</p>}

        {!error && !state && (
          <section className="intro">
            <div className="hero">
              <TorontoClock />
              <Skyline />
              <HeroLife />
              <h1>
                <span className="w1">Toronto</span>
                <span className="w2">Survival</span>
                <span className="w3">Simulator</span>
              </h1>
            </div>
            <p className="sub">60 days. Rent, rush hour and a -15° wind. Who are you?</p>
            <ul className="classes">
              {characters.map((c, i) => (
                <li key={c.class_id}>
                  <button className="pick" style={{ '--theme': themeOf(c.class_id, i) } as React.CSSProperties} onClick={() => start(c.class_id)}>
                    <span className="pick-face"><Avatar id={c.class_id} size={66} /></span>
                    <span className="pick-body">
                      <strong>{c.display_name}</strong>
                      <span className="desc">{c.description.replace(/^PLACEHOLDER:\s*/, '')}</span>
                      <span className="vitals">
                        <span><Coin size={18} />{c.starting_stats.cash.toLocaleString('en-CA')}</span>
                        <span><Bolt size={18} />{c.starting_stats.sanity}</span>
                        <span><Heart size={18} />{c.starting_stats.health}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(state?.status === 'lost' || state?.status === 'finished') && <EndCard state={state} onReset={reset} onEndless={keepSurviving} />}

        {state?.status === 'playing' && (
          <section className={`event${state.lastResult && loss ? ' hit' : ''}`} key={`${state.turn}-${state.lastResult ? 'r' : 'q'}`}>
            {state.lastResult && (loss || gain) && <Burst gain={gain} loss={loss} hurtHealth={!!res && res.health < 0} />}
            {event ? (
              <>
                <div className="card">
                  <Scene event={event} />
                  <p className="narrative">{event.scenario_text.replace(/^PLACEHOLDER:\s*/, '')}</p>
                  {(event.api_dependencies?.transit_delay_key || event.api_dependencies?.weather_severity_key) && (
                    <p className="affects">
                      Live data matters here: {[event.api_dependencies?.transit_delay_key && 'TTC delays', event.api_dependencies?.weather_severity_key && 'weather'].filter(Boolean).join(' + ')}
                    </p>
                  )}
                </div>
                {state.lastResult ? (
                  <>
                    <div className="deltas" aria-label="Outcome">
                      <span className={`pop ${tone(state.lastResult.delta.cash)}`}><Coin size={22} />{signedMoney(state.lastResult.delta.cash)}</span>
                      <span className={`pop ${tone(state.lastResult.delta.sanity)}`}><Bolt size={22} />{signed(state.lastResult.delta.sanity)}</span>
                      <span className={`pop ${tone(state.lastResult.delta.health)}`}><Heart size={22} />{signed(state.lastResult.delta.health)}</span>
                    </div>
                    <button className="key key-red wide" onClick={() => { playNextDay(); next() }}>{days > 1 ? `Skip ${days} days` : 'Next day'} »</button>
                  </>
                ) : (
                  <div className="choices">
                    {(['choice_a', 'choice_b'] as const).map((k) => {
                      const c = event[k]
                      const ok = canChoose(state, c)
                      return (
                        <button key={k} className={`key choice ${k === 'choice_a' ? 'key-yellow' : 'key-mint'}`} disabled={!ok} onClick={() => { playSfx('click'); choose(k) }}>
                          <b className="letter">{k === 'choice_a' ? 'A' : 'B'}</b>
                          <span className="ctext">
                            {c.action_text}
                            {c.metrics_impact.turns_consumed > 1 && <small>Takes {c.metrics_impact.turns_consumed} days</small>}
                            {c.required_inventory_item && <small>{ok ? 'Uses' : 'Needs'}: {c.required_inventory_item}</small>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="card"><p className="narrative">Quiet day. Nothing goes wrong. Suspicious.</p></div>
                <button className="key key-red wide" onClick={() => { playNextDay(); next() }}>Next day »</button>
              </>
            )}
          </section>
        )}

        {state?.status === 'playing' && (
          <div className="foot-row">
            <p className="bag"><b>Bag:</b> {state.inventory.length ? state.inventory.map((i) => <span key={i} className="item"><ItemIcon name={i} size={20} />{i}</span>) : 'empty'}</p>
            <span className="tools">
              <button className="link" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>{showMap ? 'Hide map' : 'Map'}</button>
              <button className="link" onClick={reset}>Quit run</button>
            </span>
          </div>
        )}

        {state?.status === 'playing' && showMap && <CityMap place={place} />}

      </main>

      <footer className="footer">
        <button className="link" onClick={() => setShowSettings(true)}>Settings</button>
        <span aria-hidden="true"> · </span>
        <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer">Sponsor this game</a>
        <span aria-hidden="true"> · </span>
        <a href={REPORT_URL}>Report issue</a>
      </footer>
      {showSettings && <SettingsPanel settings={settings} onChange={updateSettings} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
