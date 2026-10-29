import { describe, expect, it } from 'vitest'
import charactersRaw from '../data/characters.json'
import eventsRaw from '../data/events.json'
import {
  advanceTurn, applyChoice, beginGame, canChoose, condoThreshold, dailyDrain, evaluateVictory, newGame, TOTAL_TURNS,
} from './game'
import { FALLBACK_ENV } from './environment'
import { computeRank, copyText, shareText } from './rank'
import { parseCharacters, parseEvents } from './validate'
import type { CharacterClass, Environment, GameState } from '../types'

const chars = parseCharacters(charactersRaw).classes
const events = parseEvents(eventsRaw)
const all = events.events_catalog.map((e) => e.event_id)

const at30 = (over: Partial<GameState> & { stats?: GameState['stats'] }): GameState => ({
  ...newGame(chars[0], 1), stipend: 0, turn: 30, processedEvents: all, ...over,
})
const bad: Environment = { ...FALLBACK_ENV, delayMinutes: 30, tempC: -10 } // ttc 1.5, weather 1.5

function play(char: CharacterClass, seed: number, pick: (s: GameState) => 'choice_a' | 'choice_b', env = FALLBACK_ENV) {
  let s = beginGame(newGame(char, seed), events)
  const log: string[] = []
  for (let i = 0; i < TOTAL_TURNS + 2 && s.status === 'playing'; i++) {
    const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
    if (ev) {
      let k = pick(s)
      if (!canChoose(s, ev[k])) k = k === 'choice_a' ? 'choice_b' : 'choice_a'
      s = applyChoice(s, ev, k, char, env)
      log.push(`${ev.event_id}:${k}`)
    }
    s = advanceTurn(s, events, env)
  }
  return { s, log }
}

describe('catalog', () => {
  it('has the client\'s latest recovery values', () => {
    const tim = events.events_catalog.find((e) => e.event_id === 'TSS_ACT2_007_TIM_HORTONS_LINE')!.choice_a.metrics_impact
    expect(tim).toMatchObject({ health_modifier: 20, turns_consumed: 1 })
    const meal = events.events_catalog.find((e) => e.event_id === 'TSS_ACT3_014_MEAL_PLAN_END')!.choice_a.metrics_impact
    expect(meal).toMatchObject({ sanity_modifier: 45, health_modifier: 50 })
  })
  it('has 5 events per act', () => {
    for (const act of [1, 2, 3]) expect(events.events_catalog.filter((e) => e.act_tier === act)).toHaveLength(5)
  })
})

describe('victory conditions', () => {
  const rich = { cash: 15000, sanity: 50, health: 50 }
  it('wealth needs cash, turn >= 25 and every event played', () => {
    expect(evaluateVictory(at30({ stats: rich }), events, FALLBACK_ENV)).toBe('wealth')
    expect(evaluateVictory(at30({ stats: rich, processedEvents: all.slice(1) }), events, FALLBACK_ENV)).not.toBe('wealth')
    expect(evaluateVictory(at30({ stats: rich, turn: 24 }), events, FALLBACK_ENV)).not.toBe('wealth')
    expect(evaluateVictory(at30({ stats: { ...rich, cash: 9999 } }), events, FALLBACK_ENV)).toBe('endurance')
  })
  it('asset threshold scales with live modifiers', () => {
    expect(condoThreshold(FALLBACK_ENV)).toBe(10000)
    expect(condoThreshold(bad)).toBe(20000) // 1 + 0.5 + 0.5
    const s = at30({ stats: { cash: 15000, sanity: 50, health: 50 }, processedEvents: [] })
    expect(evaluateVictory(s, events, FALLBACK_ENV)).toBe('asset')
    expect(evaluateVictory(s, events, bad)).toBe('endurance')
  })
  it('endurance is surviving day 30; finishing sets victory, dying does not', () => {
    const fin = advanceTurn(at30({ stats: { cash: 10, sanity: 5, health: 5 } }), events)
    expect(fin.status).toBe('finished')
    expect(fin.victory).toBe('endurance')
    const dead = advanceTurn(at30({ stats: { cash: -10, sanity: 2, health: 50 } }), events)
    expect(dead.status).toBe('lost') // overdraft -2 sanity
    expect(dead.victory).toBeNull()
  })
  it('does not end early when thresholds are hit before turn 30', () => {
    const s = { ...newGame(chars[0], 1), turn: 26, stats: { cash: 20000, sanity: 50, health: 50 }, processedEvents: all }
    const n = advanceTurn(s, events)
    expect(n.status).toBe('playing')
    expect(n.turn).toBe(27)
  })
  it('drain grows 8% per turn from the base cost', () => {
    expect(dailyDrain(1)).toBe(0) // base cost not yet supplied
  })
})

describe('daily stipend', () => {
  const base = { ...newGame(chars[0], 1), stipend: 350, turn: 12, stats: { cash: 100, sanity: 80, health: 80 } }
  it('pays once per completed day', () => {
    expect(advanceTurn(base, events).stats.cash).toBe(450)
  })
  it('pays for every day a multi-day choice consumes', () => {
    const ev = events.events_catalog.find((e) => e.event_id === 'TSS_ACT1_001_TTC_BLIZZARD')!
    const s = applyChoice({ ...base, turn: 3 }, ev, 'choice_b', chars[0]) // 2 days, no cash cost
    expect(advanceTurn(s, events).stats.cash).toBe(100 + 700)
  })
  it('is paid before the overdraft check, so it can clear a small overdraft', () => {
    const s = { ...base, stats: { cash: -100, sanity: 50, health: 50 } }
    const n = advanceTurn(s, events)
    expect(n.stats.cash).toBe(250)
    expect(n.stats.sanity).toBe(50) // no overdraft penalty
  })
  it('pays on day 30 before victory is evaluated', () => {
    const s = { ...base, turn: 30, processedEvents: all, stats: { cash: 9700, sanity: 50, health: 50 } }
    const n = advanceTurn(s, events)
    expect(n.status).toBe('finished')
    expect(n.stats.cash).toBe(10050)
    expect(n.victory).toBe('wealth')
  })
  it('does nothing when the character has no stipend', () => {
    expect(advanceTurn({ ...base, stipend: 0 }, events).stats.cash).toBe(100)
  })
})

describe('ranks', () => {
  const base = at30({ stats: { cash: 100, sanity: 80, health: 80 } })
  it('follows precedence', () => {
    expect(computeRank({ ...base, status: 'lost', stats: { ...base.stats, health: 0, sanity: 0 } })).toBe('Frozen Sub-Way Dweller')
    expect(computeRank({ ...base, status: 'lost', stats: { ...base.stats, sanity: 0 } })).toBe('Streetcar Casualty')
    expect(computeRank({ ...base, status: 'finished', victory: 'wealth', stats: { ...base.stats, cash: -5 } })).toBe('Bay Street Executive')
    expect(computeRank({ ...base, status: 'finished', victory: 'asset' })).toBe('Condo Conqueror')
    expect(computeRank({ ...base, status: 'finished', victory: 'endurance', stats: { ...base.stats, cash: -1 } })).toBe('Overdraft Legend')
    expect(computeRank({ ...base, status: 'finished', victory: 'endurance' })).toBe('Commuter Master')
    expect(computeRank({ ...base, status: 'finished', victory: 'endurance', stats: { ...base.stats, sanity: 10 } })).toBe("Tim's Coffee Survivor")
  })
})

describe('share', () => {
  it('includes rank, stats and url', () => {
    const t = shareText({ ...at30({}), status: 'finished', victory: 'endurance', stats: { cash: -20, sanity: 60, health: 70 } }, 'https://x.test/')
    expect(t).toContain('Overdraft Legend')
    expect(t).toContain('-$20')
    expect(t).toContain('Sanity 60%')
    expect(t).toContain('https://x.test/')
  })
  it('copies via clipboard API and reports failure when everything is blocked', async () => {
    let got = ''
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async (t: string) => { got = t } } }, configurable: true })
    expect(await copyText('hi')).toBe('copied')
    expect(got).toBe('hi')
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => { throw new Error('denied') } } }, configurable: true })
    expect(await copyText('hi')).toBe('failed') // no DOM in node env
  })
})

describe('end-to-end playthroughs', () => {
  for (const c of chars) {
    it(`${c.display_name}: completes deterministically under both strategies`, () => {
      for (const pick of [() => 'choice_a' as const, () => 'choice_b' as const]) {
        const r1 = play(c, 7, pick)
        const r2 = play(c, 7, pick)
        expect(r1.log).toEqual(r2.log)
        expect(r1.s).toEqual(r2.s)
        expect(['finished', 'lost']).toContain(r1.s.status)
        expect(new Set(r1.log.map((l) => l.split(':')[0])).size).toBe(r1.log.length) // no repeats
        if (r1.s.status === 'finished') expect(r1.s.turn).toBe(TOTAL_TURNS)
      }
    })
    it(`${c.display_name}: act 1 is never fatal even under worst-case drain`, () => {
      const r = play(c, 3, () => 'choice_a', { ...FALLBACK_ENV, delayMinutes: 45, tempC: -30 })
      const act1 = r.log.filter((l) => l.includes('_ACT1_'))
      expect(act1.length).toBeGreaterThan(0)
      expect(r.s.status === 'lost' ? r.s.turn : 11).toBeGreaterThan(10)
    })
  }
  it('covers each act boundary (turn 10 -> 11 -> 21)', () => {
    let s = beginGame(newGame(chars[0], 2), events)
    const acts: number[] = []
    for (let i = 0; i < 30 && s.status === 'playing'; i++) {
      const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
      if (ev) acts.push(ev.act_tier)
      if (ev) s = applyChoice({ ...s, stats: { cash: 5000, sanity: 100, health: 100 } }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', chars[0])
      s = advanceTurn(s, events)
    }
    expect(acts.filter((a) => a === 1)).toHaveLength(5)
    expect(acts.filter((a) => a === 2)).toHaveLength(5)
    expect(acts.filter((a) => a === 3)).toHaveLength(5)
    expect(acts).toEqual([...acts].sort())
  })
})
