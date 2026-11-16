import { describe, expect, it } from 'vitest'
import charactersRaw from '../data/characters.json'
import eventsRaw from '../data/events.json'
import {
  advanceTurn, applyChoice, beginGame, canChoose, continueEndless, isShockDay, newGame, pickEvent, pressure, rentForDay, TOTAL_TURNS,
} from './game'
import { parseCharacters, parseEvents } from './validate'
import type { CharacterClass, GameEvent, GameState } from '../types'

const chars = parseCharacters(charactersRaw).classes
const events = parseEvents(eventsRaw)
const byId = (id: string) => events.events_catalog.find((e) => e.event_id === id)!
const promoter = chars.find((c) => c.class_id === 'CLASS_007_NIGHTLIFE_PROMOTER')!
const dater = chars.find((c) => c.class_id === 'CLASS_008_LUXURY_DATER')!
const commuter = chars[0]
const rich = { cash: 5000, sanity: 100, health: 100 }

function run(c: CharacterClass, seed: number, days = TOTAL_TURNS) {
  let s = beginGame(newGame(c, seed), events)
  const plays: GameEvent[] = []
  for (let i = 0; i < days && s.status === 'playing'; i++) {
    const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
    if (ev) {
      plays.push(ev)
      s = applyChoice({ ...s, stats: rich }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', c)
    }
    s = advanceTurn({ ...s, stats: rich }, events)
  }
  return { s, plays }
}

describe('rent and escalation', () => {
  it('charges $350, $400, $450, $450 on days 15, 30, 45, 60 and keeps charging in endless mode', () => {
    expect([14, 15, 30, 45, 60, 75].map(rentForDay)).toEqual([0, 350, 400, 450, 450, 450])
    const base = { ...newGame(commuter, 1), stipend: 0, turn: 15, stats: { cash: 1000, sanity: 80, health: 80 } }
    const n = advanceTurn(base, events)
    expect(n.stats.cash).toBe(650)
    expect(n.notice).toContain('Rent day: -$350')
    expect(advanceTurn({ ...base, turn: 16 }, events).notice).toBeNull()
  })
  it('stipend is paid before rent, so rent can push cash negative', () => {
    const s = { ...newGame(commuter, 1), stipend: 35, turn: 30, stats: { cash: 100, sanity: 80, health: 80 } }
    const n = advanceTurn(s, events)
    expect(n.stats.cash).toBe(100 + 35 - 400)
    expect(n.stats.sanity).toBe(78) // overdraft penalty
  })
  it('hits vitals 25% harder on days 21-40 and cash 30% harder on days 41-60', () => {
    expect(pressure(20)).toEqual({ vitals: 1, cash: 1 })
    expect(pressure(21).vitals).toBe(1.25)
    expect(pressure(40).vitals).toBe(1.25)
    expect(pressure(41)).toEqual({ vitals: 1, cash: 1.3 })
    const ev = byId('TSS_ACT1_016_UNION_GO_SIGNAL_FAILURE') // A: -48 cash, B: -15 sanity -5 health
    const at = (turn: number, key: 'choice_a' | 'choice_b') => applyChoice({ ...newGame(chars[3], 1), turn, stats: rich }, ev, key, chars[3]).lastResult!.delta
    expect(at(10, 'choice_b')).toMatchObject({ sanity: -15, health: -5 })
    expect(at(25, 'choice_b')).toMatchObject({ sanity: Math.round(-15 * 1.25 * 1), health: Math.round(-5 * 1.25 * 1) })
    expect(at(45, 'choice_a').cash).toBe(Math.round(-48 * 1.3))
    expect(at(25, 'choice_a').cash).toBe(-48)
  })
  it('endless mode adds 10% intensity every 10 days', () => {
    expect(pressure(61)).toEqual({ vitals: 1.1, cash: 1.3 * 1.1 })
    expect(pressure(70).vitals).toBeCloseTo(1.1)
    expect(pressure(71).vitals).toBeCloseTo(1.2)
    expect(pressure(91).cash).toBeCloseTo(1.3 * 1.4)
  })
})

describe('coin-flip choices', () => {
  const kw = byId('TSS_KW_01_BOTTLE_SERVICE_CANCELLATION')
  const ld = byId('TSS_LD_02_CONCERT_TICKET_FLIP')
  it('lands on exactly the win or the lose outcome, never in between', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed < 60; seed++) {
      const s = applyChoice({ ...newGame(promoter, seed), turn: 12, stats: rich }, kw, 'choice_a', promoter)
      const d = s.lastResult!.delta
      expect(s.lastResult!.flip === 'win' ? d : d).toEqual(s.lastResult!.flip === 'win' ? { cash: 220, sanity: 0, health: -12 } : { cash: -110, sanity: -18, health: 0 })
      seen.add(s.lastResult!.flip!)
    }
    expect(seen).toEqual(new Set(['win', 'lose']))
  })
  it('is roughly 50/50 and cannot be re-rolled from the same state', () => {
    let wins = 0
    for (let seed = 1; seed <= 400; seed++) {
      const st = { ...newGame(promoter, seed), turn: 12, stats: rich }
      const a = applyChoice(st, kw, 'choice_a', promoter)
      expect(applyChoice(st, kw, 'choice_a', promoter).lastResult).toEqual(a.lastResult)
      if (a.lastResult!.flip === 'win') wins++
    }
    expect(wins).toBeGreaterThan(160)
    expect(wins).toBeLessThan(240)
  })
  it('the safe choice has no flip', () => {
    const s = applyChoice({ ...newGame(promoter, 1), turn: 12, stats: rich }, kw, 'choice_b', promoter)
    expect(s.lastResult!.flip).toBeUndefined()
    expect(s.lastResult!.delta).toEqual({ cash: -45, sanity: 10, health: 8 })
  })
  it('the Luxury Dater wins 1.5x cash and loses an extra 15 sanity on a failed risk', () => {
    let won = false
    let lost = false
    for (let seed = 1; seed < 80 && !(won && lost); seed++) {
      const st = { ...newGame(dater, seed), turn: 12, stats: rich }
      const r = applyChoice(st, ld, 'choice_a', dater).lastResult!
      const plain = applyChoice(st, ld, 'choice_a', { ...dater, passive_traits: undefined }).lastResult!
      if (r.flip === 'win') { won = true; expect(r.delta.cash).toBe(540); expect(plain.delta.cash).toBe(360); expect(r.delta.sanity).toBe(12) }
      else { lost = true; expect(r.delta.cash).toBe(-120); expect(r.delta.sanity).toBe(-18 - 15); expect(plain.delta.sanity).toBe(-18) }
    }
    expect(won && lost).toBe(true)
  })
  it('every one of the 8 characters can meet a 50/50 choice', () => {
    for (const c of chars) {
      const { plays } = run(c, 5)
      const flips = plays.filter((e) => e.choice_a.gamble || e.choice_b.gamble)
      expect(flips.length, c.display_name).toBeGreaterThan(0)
    }
  })
  it('rejects a malformed gamble', () => {
    const bad = structuredClone(eventsRaw) as { events_catalog: { choice_a: { gamble?: unknown } }[] }
    bad.events_catalog[0].choice_a.gamble = { chance: 2, win: { cash: 1, sanity: 0, health: 0 }, lose: { cash: 0, sanity: 0, health: 0 } }
    expect(() => parseEvents(bad)).toThrow(/gamble.chance/)
  })
})

describe('class passives', () => {
  it('the promoter is paid +$65, -10 sanity, -8 health on every 6th and 7th day', () => {
    const base = (turn: number): GameState => ({ ...newGame(promoter, 1), stipend: 0, turn, stats: { cash: 100, sanity: 80, health: 80 } })
    const day6 = advanceTurn(base(20), events) // 20 % 7 = 6
    expect(day6.stats).toEqual({ cash: 165, sanity: 70, health: 72 })
    expect(day6.notice).toContain('+$65')
    expect(advanceTurn(base(21), events).stats).toEqual({ cash: 165, sanity: 70, health: 72 }) // 21 % 7 = 0
    expect(advanceTurn(base(22), events).stats).toEqual({ cash: 100, sanity: 80, health: 80 })
    expect(advanceTurn({ ...base(20), traits: null }, events).stats.cash).toBe(100)
  })
})

describe('shock events', () => {
  it('first lands on day 4 or 5, then every 4-5 days, for every class', () => {
    for (const c of chars) {
      let s = beginGame(newGame(c, 3), events)
      const days: number[] = []
      for (let i = 0; i < 60 && s.status === 'playing'; i++) {
        const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)!
        if (ev.shock) days.push(s.turn)
        s = advanceTurn(applyChoice({ ...s, stats: rich }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', c), events)
      }
      expect(days[0]).toBeGreaterThanOrEqual(4)
      expect(days[0]).toBeLessThanOrEqual(5)
      days.slice(1).forEach((d, i) => { expect(d - days[i]).toBeGreaterThanOrEqual(4); expect(d - days[i]).toBeLessThanOrEqual(5) })
      expect(days.length).toBeGreaterThanOrEqual(10)
    }
  })
  it('only ever draws shocks on shock days and never on ordinary days', () => {
    let s = beginGame(newGame(commuter, 8), events)
    for (let i = 0; i < 60 && s.status === 'playing'; i++) {
      const ev = byId(s.currentEventId!)
      expect(!!ev.shock).toBe(isShockDay({ ...s, lastShock: s.lastShock }) || !!ev.shock && s.lastShock === s.turn)
      s = advanceTurn(applyChoice({ ...s, stats: rich }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', commuter), events)
    }
  })
  it('every shock has a timeout choice the player is forced into', () => {
    const shocks = events.events_catalog.filter((e) => e.shock)
    expect(shocks.length).toBeGreaterThanOrEqual(8)
    for (const e of shocks) expect(e.timeout_choice).toBe('choice_b')
  })
})

describe('anti-repetition', () => {
  it('no scenario repeats within 20 days for any class, in the campaign or endless mode', () => {
    for (const c of chars) {
      for (const seed of [1, 2, 3]) {
        let s = beginGame(newGame(c, seed), events)
        const plays: string[] = []
        for (let i = 0; i < 100 && (s.status === 'playing' || s.status === 'finished'); i++) {
          if (s.status === 'finished') s = continueEndless(s, events)
          const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
          if (ev) {
            expect(plays.slice(-20), `${c.display_name} day ${s.turn}`).not.toContain(ev.event_id)
            plays.push(ev.event_id)
            s = applyChoice({ ...s, stats: rich }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', c)
          }
          s = advanceTurn({ ...s, stats: rich }, events)
        }
        expect(plays.length).toBeGreaterThan(90)
      }
    }
  })
  it('stores the last 20 scenario ids on the game state', () => {
    const { s } = run(commuter, 4, 40)
    expect(s.recentScenarioIds).toHaveLength(20)
    expect(new Set(s.recentScenarioIds).size).toBe(20)
  })
})

describe('class-specific scenarios', () => {
  it('only the matching class sees them', () => {
    for (const c of chars) {
      const { plays } = run(c, 6)
      for (const e of plays) if (e.class_ids) expect(e.class_ids).toContain(c.class_id)
    }
    const k = run(promoter, 6).plays.map((e) => e.event_id)
    expect(k.some((id) => id.startsWith('TSS_LD_'))).toBe(false)
    expect(run(commuter, 6).plays.some((e) => e.class_ids)).toBe(false)
  })
  it('take about 60% of days while one is available', () => {
    let own = 0
    let total = 0
    for (let seed = 1; seed <= 30; seed++) {
      const s = { ...newGame(promoter, seed), turn: 25, lastShock: 24 } // not a shock day, all six unlocked, none seen
      const e = pickEvent(s, events)!
      total++
      if (e.class_ids) own++
    }
    expect(own / total).toBeGreaterThan(0.4)
    expect(own / total).toBeLessThan(0.8)
  })
  it('respects each scenario\'s first day', () => {
    const early = { ...newGame(promoter, 1), turn: 3, lastShock: 3 }
    for (let seed = 1; seed < 30; seed++) {
      const e = pickEvent({ ...early, seed }, events)!
      expect(e.min_turn).toBeLessThanOrEqual(3)
    }
    expect(byId('TSS_KW_01_BOTTLE_SERVICE_CANCELLATION').min_turn).toBe(6)
  })
})

describe('v1.2 content', () => {
  it('has the 12 client scenarios with the right numbers', () => {
    const m = (id: string, k: 'choice_a' | 'choice_b') => byId(id)[k].metrics_impact
    expect(m('TSS_KW_02_LECTURE_AFTER_CLOSE', 'choice_a')).toMatchObject({ cash_modifier: -12, health_modifier: -14, sanity_modifier: 12 })
    expect(m('TSS_KW_05_AFTER_HOURS_DJ_SET', 'choice_a')).toMatchObject({ cash_modifier: 190, health_modifier: -18, sanity_modifier: -10 })
    expect(m('TSS_KW_04_DOOR_GUY_CUT', 'choice_a').cash_modifier).toBe(55) // +$95 less the $40 cut
    expect(m('TSS_LD_05_DESIGNER_GIFT_VS_RENT', 'choice_a')).toMatchObject({ cash_modifier: 380, sanity_modifier: -8 })
    expect(byId('TSS_LD_01_TASTING_MENU_VS_MIDTERM').choice_a.gamble).toEqual({
      chance: 0.5, win: { cash: 260, sanity: 0, health: -14 }, lose: { cash: 150, sanity: -22, health: -10 } })
    expect(byId('TSS_KW_03_RIVAL_PROMOTER_POACHING').choice_a.gamble!.win).toEqual({ cash: 180, sanity: 10, health: 0 })
    expect(byId('TSS_LD_04_SNEAKER_DROP_QUEEN_WEST').choice_a.gamble!.lose).toEqual({ cash: -30, sanity: -15, health: 0 })
    expect(events.events_catalog.filter((e) => e.class_ids?.includes('CLASS_007_NIGHTLIFE_PROMOTER'))).toHaveLength(6)
    expect(events.events_catalog.filter((e) => e.class_ids?.includes('CLASS_008_LUXURY_DATER'))).toHaveLength(6)
  })
  it('every class can play a full 60-day run', () => {
    for (const c of chars) expect(run(c, 2).s.status).toBe('finished')
  })
})
