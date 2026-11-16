/**
 * Test panel for `npm run dev` only (never in a production build). Jump to any class, day, event or
 * stat, and run a one-click self-check of the v1.2 rules for every character.
 */
import { useState } from 'react'
import charactersRaw from '../data/characters.json'
import eventsRaw from '../data/events.json'
import {
  advanceTurn, applyChoice, beginGame, canChoose, continueEndless, newGame, rentForDay, TOTAL_TURNS,
} from '../engine/game'
import { parseCharacters, parseEvents } from '../engine/validate'
import type { CharacterClass, GameState } from '../types'

const chars = parseCharacters(charactersRaw).classes
const events = parseEvents(eventsRaw)
const byId = new Map(events.events_catalog.map((e) => [e.event_id, e]))
const RICH = { cash: 5000, sanity: 100, health: 100 }

function set(next: GameState | null) { window.__tss?.setState(next) }
const cur = () => window.__tss?.state ?? null

/** Plays 60 days (stats topped up every day so the run survives) and reports on the rules. */
function selfCheck(c: CharacterClass, seed = 123) {
  let s = beginGame(newGame(c, seed), events)
  const plays: string[] = []
  const shocks: number[] = []
  let flips = 0, own = 0, repeats = 0, rents = 0, paydays = 0
  for (let i = 0; i < TOTAL_TURNS && s.status === 'playing'; i++) {
    const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
    if (ev) {
      if (plays.slice(-20).includes(ev.event_id)) repeats++
      plays.push(ev.event_id)
      if (ev.shock) shocks.push(s.turn)
      if (ev.choice_a.gamble || ev.choice_b.gamble) flips++
      if (ev.class_ids) own++
      s = applyChoice({ ...s, stats: RICH }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', c)
    }
    s = advanceTurn({ ...s, stats: RICH }, events)
    if (s.notice?.includes('Rent')) rents++
    if (s.notice?.includes('Payday')) paydays++
  }
  const gaps = shocks.slice(1).map((d, i) => d - shocks[i])
  return {
    name: c.display_name.replace(/^The /, ''),
    days: plays.length, repeats, flips, own,
    shockFirst: shocks[0], shockGaps: gaps.length ? `${Math.min(...gaps)}-${Math.max(...gaps)}` : '-', shocks: shocks.length,
    rents, paydays, finished: s.status === 'finished',
  }
}

export default function DevPanel() {
  const [open, setOpen] = useState(false)
  const [cls, setCls] = useState(chars[0].class_id)
  const [seed, setSeed] = useState('')
  const [day, setDay] = useState('15')
  const [cash, setCash] = useState('500')
  const [sanity, setSanity] = useState('80')
  const [health, setHealth] = useState('80')
  const [eventId, setEventId] = useState(events.events_catalog[0].event_id)
  const [report, setReport] = useState<ReturnType<typeof selfCheck>[] | null>(null)
  const [msg, setMsg] = useState('')

  const klass = chars.find((c) => c.class_id === cls)!
  const say = (m: string) => setMsg(m)

  const start = () => {
    const sd = seed ? Number(seed) : Date.now()
    set(beginGame(newGame(klass, sd), events)); say(`Started ${klass.display_name} (seed ${sd})`)
  }
  const goDay = (d: number) => {
    const s = cur() ?? newGame(klass, seed ? Number(seed) : 1)
    const turn = Math.max(1, Math.floor(d))
    set(beginGame({ ...s, status: 'playing', victory: null, endless: turn > TOTAL_TURNS, turn, lastResult: null, notice: null, recentScenarioIds: [], processedEvents: [], lastShock: Math.max(0, turn - 2) }, events))
    say(`Jumped to day ${turn}`)
  }
  const applyStats = () => {
    const s = cur(); if (!s) return say('Start a run first')
    set({ ...s, stats: { cash: Number(cash), sanity: Number(sanity), health: Number(health) } }); say('Stats set')
  }
  const showEvent = () => {
    const s = cur() ?? beginGame(newGame(klass, 1), events)
    const ev = byId.get(eventId)!
    set({ ...s, characterId: s.characterId, turn: Math.max(s.turn, ev.min_turn), status: 'playing', lastResult: null, currentEventId: ev.event_id })
    say(`Showing ${ev.event_id}`)
  }
  const finishRun = () => {
    const s = cur() ?? beginGame(newGame(klass, 1), events)
    const last = { ...s, turn: TOTAL_TURNS, status: 'playing' as const, endless: false, victory: null, lastResult: null, currentEventId: null, stats: { ...RICH, cash: 800 } }
    set(advanceTurn(last, events)); say('Finished day 60: win screen (tap Keep Surviving to test endless)')
  }
  const endless = () => {
    const s = cur(); if (!s || s.status !== 'finished') return say('Finish a run first (Finish day 60)')
    set(continueEndless(s, events)); say('Endless mode on')
  }
  const nextRent = () => {
    const s = cur() ?? newGame(klass, 1)
    const due = Math.ceil((s.turn + 1) / 15) * 15
    goDay(due); say(`Day ${due}: answer the event, tap Next day, rent $${rentForDay(due)} is charged overnight`)
  }

  return (
    <aside style={{ position: 'fixed', left: 8, bottom: 8, zIndex: 9999, font: '12px/1.35 system-ui,sans-serif', color: '#fff' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ background: '#FF3B30', color: '#fff', border: '2px solid #fff', borderRadius: 8, padding: '4px 10px', fontWeight: 800, cursor: 'pointer' }}>{open ? 'Close DEV' : 'DEV'}</button>
      {open && (
        <div style={{ marginTop: 6, width: 'min(360px, 92vw)', maxHeight: '74vh', overflow: 'auto', background: '#000d', border: '2px solid #fff', borderRadius: 12, padding: 10, display: 'grid', gap: 8 }}>
          <b>Test panel (dev only)</b>
          {msg && <div style={{ color: '#FFD23F' }}>{msg}</div>}

          <label>Class <select value={cls} onChange={(e) => setCls(e.target.value)} style={{ width: '100%' }}>{chars.map((c) => <option key={c.class_id} value={c.class_id}>{c.display_name}</option>)}</select></label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input placeholder="seed (optional)" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ flex: 1 }} />
            <button onClick={start}>Start run</button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input value={day} onChange={(e) => setDay(e.target.value)} style={{ width: 60 }} aria-label="Day" />
            <button onClick={() => goDay(Number(day))}>Go to day</button>
            <button onClick={nextRent}>Rent night</button>
            <button onClick={() => goDay(60)}>Day 60</button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <input value={cash} onChange={(e) => setCash(e.target.value)} style={{ width: 62 }} aria-label="Cash" />
            <input value={sanity} onChange={(e) => setSanity(e.target.value)} style={{ width: 46 }} aria-label="Sanity" />
            <input value={health} onChange={(e) => setHealth(e.target.value)} style={{ width: 46 }} aria-label="Health" />
            <button onClick={applyStats}>Set cash/sanity/health</button>
          </div>

          <label>Show an event
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ width: '100%' }}>
              {events.events_catalog.map((e) => (
                <option key={e.event_id} value={e.event_id}>{e.shock ? '⚡ ' : ''}{e.choice_a.gamble || e.choice_b.gamble ? '🎲 ' : ''}{e.event_id.replace(/^TSS_/, '')}</option>
              ))}
            </select>
          </label>
          <button onClick={showEvent}>Show event (pick its class first for class-only ones)</button>

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={finishRun}>Finish day 60 (win screen)</button>
            <button onClick={endless}>Endless</button>
            <button onClick={() => { set(null); say('Back to menu') }}>Menu</button>
          </div>

          <button onClick={() => setReport(chars.map((c) => selfCheck(c)))} style={{ background: '#2EE6A6', fontWeight: 800 }}>Self-check all {chars.length} classes</button>
          {report && (
            <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
              <thead><tr>{['Class', 'Days', 'Repeats<20', 'Flips', 'Own', 'Shock 1st', 'Gaps', 'Shocks', 'Rents', 'Paydays', 'Done'].map((h) => <th key={h} style={{ textAlign: 'left', padding: '1px 4px', borderBottom: '1px solid #fff6' }}>{h}</th>)}</tr></thead>
              <tbody>{report.map((r) => (
                <tr key={r.name} style={{ color: r.repeats === 0 && r.finished && r.flips > 0 ? '#2EE6A6' : '#FF6B60' }}>
                  <td style={{ padding: '1px 4px' }}>{r.name.slice(0, 18)}</td><td>{r.days}</td><td>{r.repeats}</td><td>{r.flips}</td><td>{r.own}</td><td>{r.shockFirst}</td><td>{r.shockGaps}</td><td>{r.shocks}</td><td>{r.rents}</td><td>{r.paydays}</td><td>{r.finished ? 'yes' : 'no'}</td>
                </tr>))}</tbody>
            </table>
          )}
          <small style={{ opacity: 0.8 }}>Expect: Repeats 0, Flips 8+, Shock 1st 4-5, Gaps 4-5, Shocks 13, Rents 4, Paydays 16 for the Promoter only, Done yes.</small>
        </div>
      )}
    </aside>
  )
}
