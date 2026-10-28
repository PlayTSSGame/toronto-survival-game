import { useState } from 'react'
import { actForTurn, canChoose, TOTAL_TURNS, timeLabel } from './engine/game'
import { computeRank, copyText, outcomeTitle, shareText } from './engine/rank'
import type { CharacterClass, Environment, FeedSource, GameState } from './types'
import { Avatar, Bolt, Coin, Heart, Skyline } from './ui/Art'
import { useGame } from './ui/useGame'
import './App.css'

const SPONSOR_URL = import.meta.env.VITE_SPONSOR_URL || 'https://forms.google.com'

/** Each survivor owns a colour that tints their cards. */
const THEME: Record<string, string> = {
  mississauga_commuter: '#4CC9F0',
  financial_district_intern: '#FFD23F',
  campus_residence_dweller: '#2EE6A6',
}
const SPARE = ['#FF6FB5', '#FF9F43']
const themeOf = (id: string, i = 0) => THEME[id] ?? SPARE[i % SPARE.length]

const ACTS = [
  { name: 'Act 1', note: 'Settling in', color: '#2EE6A6' },
  { name: 'Act 2', note: 'The squeeze', color: '#FFD23F' },
  { name: 'Act 3', note: 'Survival', color: '#FF3B30' },
]

const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-CA', { maximumFractionDigits: 2 })}`
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '') + Math.abs(n)
const signedMoney = (n: number) => (n > 0 ? '+' : '') + money(n)
const tone = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat')

function Track({ turn }: { turn: number }) {
  return (
    <ol className="track" aria-label={`Day ${turn} of ${TOTAL_TURNS}`}>
      {Array.from({ length: TOTAL_TURNS }, (_, i) => {
        const day = i + 1
        const act = ACTS[actForTurn(day) - 1]
        return (
          <li
            key={day}
            className={`dot ${day < turn ? 'done' : day === turn ? 'now' : ''}`}
            style={{ '--c': act.color } as React.CSSProperties}
          />
        )
      })}
    </ol>
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

function Chip({ label, text, src, bad }: { label: string; text: string; src: FeedSource; bad: boolean }) {
  return (
    <span className={`chip${bad ? ' bad' : ''}`} title={src === 'live' ? 'Live data' : src === 'cached' ? 'Saved data' : 'Offline fallback'}>
      <i className={`pip ${src}`} aria-hidden="true" />
      <b>{label}</b> {text.replace(/^(Weather|TTC):? ?/, '').replace(/ \(saved\)$/, '')}
    </span>
  )
}

function Hud({ state, char, env, place, index }: { state: GameState; char: CharacterClass; env: Environment; place: string; index: number }) {
  const day = Math.min(state.turn, TOTAL_TURNS)
  const act = ACTS[actForTurn(state.turn) - 1]
  const { cash, sanity, health } = state.stats
  const theme = themeOf(char.class_id, index)
  return (
    <header className="hud" style={{ '--theme': theme } as React.CSSProperties}>
      <div className="hud-top">
        <div className="face"><Avatar id={char.class_id} size={46} /></div>
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
            <b>{money(cash)}</b>
            {cash < 0 && <small>OVERDRAFT</small>}
          </div>
        </div>
        <div className="stat">
          <Bolt size={26} />
          <div><b>{sanity}</b><Segs value={sanity} color="#4CC9F0" /></div>
        </div>
        <div className="stat">
          <Heart size={26} />
          <div><b>{health}</b><Segs value={health} color="#FF6FB5" /></div>
        </div>
      </div>

      <div className="meta">
        <span className="act" style={{ background: act.color }}>{act.name} · {act.note}</span>
        <span className="week">{timeLabel(state.turn)}</span>
        <Track turn={state.turn} />
      </div>
      <div className="chips">
        <Chip label="Weather" text={env.weatherLabel} src={env.weatherSource} bad={env.tempC < 0 || env.precipMm > 5} />
        <Chip label="TTC" text={env.transitLabel} src={env.transitSource} bad={env.delayMinutes > 15} />
      </div>
    </header>
  )
}

function EndCard({ state, onReset }: { state: GameState; onReset: () => void }) {
  const [msg, setMsg] = useState('')
  const lost = state.status === 'lost'
  const share = async () => {
    const text = shareText(state, window.location.origin + window.location.pathname)
    setMsg((await copyText(text)) === 'copied' ? 'Copied! Go brag.' : 'Could not copy. Select and copy this instead:\n' + text)
  }
  return (
    <section className={`end ${lost ? 'lost' : 'won'}`}>
      <p className="banner">{lost ? 'Game over' : 'You made it!'}</p>
      <p className="ranklab">Your rank</p>
      <h2 className="rank">{computeRank(state)}</h2>
      <p className="outcome">{outcomeTitle(state)}</p>
      {lost && <p className="reason">{state.lossReason}</p>}
      <div className="final">
        <span><Coin size={22} /> {money(state.stats.cash)}</span>
        <span><Bolt size={22} /> {state.stats.sanity}</span>
        <span><Heart size={22} /> {state.stats.health}</span>
      </div>
      <button className="key key-red wide" onClick={onReset}>{lost ? 'Try again' : 'Play again'}</button>
      <button className="key key-sky wide" onClick={share}>Copy result</button>
      {msg && <p className="toast" role="status">{msg}</p>}
    </section>
  )
}

export default function App() {
  const { error, characters, state, char, event, env, start, choose, next, reset } = useGame()
  const index = char ? characters.findIndex((c) => c.class_id === char.class_id) : 0
  const days = event && state?.lastResult ? event[state.lastResult.choiceKey].metrics_impact.turns_consumed : 1

  return (
    <div className="app">
      {state && char && <Hud state={state} char={char} env={env} place={event?.location ?? char.home_location} index={index} />}

      <main className="main">
        {error && <p role="alert" className="notice">Game content failed to load: {error}</p>}

        {!error && !state && (
          <section className="intro">
            <div className="hero">
              <Skyline />
              <h1>
                <span className="w1">Toronto</span>
                <span className="w2">Survival</span>
                <span className="w3">Simulator</span>
              </h1>
            </div>
            <p className="sub">30 days. Rent, rush hour and a -15° wind. Who are you?</p>
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

        {(state?.status === 'lost' || state?.status === 'finished') && <EndCard state={state} onReset={reset} />}

        {state?.status === 'playing' && (
          <section className="event" key={`${state.turn}-${state.lastResult ? 'r' : 'q'}`}>
            {event ? (
              <>
                <div className="card">
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
                    <button className="key key-red wide" onClick={next}>{days > 1 ? `Skip ${days} days` : 'Next day'} »</button>
                  </>
                ) : (
                  <div className="choices">
                    {(['choice_a', 'choice_b'] as const).map((k) => {
                      const c = event[k]
                      const ok = canChoose(state, c)
                      return (
                        <button key={k} className={`key choice ${k === 'choice_a' ? 'key-yellow' : 'key-mint'}`} disabled={!ok} onClick={() => choose(k)}>
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
                <button className="key key-red wide" onClick={next}>Next day »</button>
              </>
            )}
          </section>
        )}

        {state?.status === 'playing' && (
          <div className="foot-row">
            <p className="bag"><b>Bag:</b> {state.inventory.length ? state.inventory.map((i) => <span key={i} className="item">{i}</span>) : 'empty'}</p>
            <button className="link" onClick={reset}>Quit run</button>
          </div>
        )}
      </main>

      <footer className="footer">
        <a href={SPONSOR_URL} target="_blank" rel="noopener noreferrer">Sponsor this game</a>
      </footer>
    </div>
  )
}
