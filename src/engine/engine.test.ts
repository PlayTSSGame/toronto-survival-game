/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import charactersRaw from '../data/characters.json'
import eventsRaw from '../data/events.json'
import { ttcModifier, weatherModifier } from './environment'
import { actForTurn, advanceTurn, applyChoice, beginGame, canChoose, continueEndless, newGame, pickEvent, timeLabel, TOTAL_TURNS } from './game'
import { computeRank } from './rank'
import { checksum, clearSave, loadGame, saveGame, SAVE_KEY } from './persistence'
import { parseCharacters, parseEvents } from './validate'

const chars = parseCharacters(charactersRaw).classes
const events = parseEvents(eventsRaw)
const commuter = chars[0]
const byId = (id: string) => events.events_catalog.find((e) => e.event_id === id)!

function memStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k), clear: () => m.clear(),
    key: () => null, get length() { return m.size },
  }
}

describe('validation', () => {
  it('accepts the bundled content', () => {
    expect(chars).toHaveLength(6)
    expect(events.events_catalog).toHaveLength(33)
    expect(events.events_catalog.length).toBeGreaterThan(0)
  })
  it('rejects malformed events with a path', () => {
    const bad = structuredClone(eventsRaw) as any
    delete bad.events_catalog[0].choice_a.metrics_impact.cash_modifier
    expect(() => parseEvents(bad)).toThrow(/choice_a.metrics_impact.cash_modifier/)
  })
  it('rejects duplicate ids and bad ranges', () => {
    const dup = structuredClone(eventsRaw) as any
    dup.events_catalog.push(dup.events_catalog[0])
    expect(() => parseEvents(dup)).toThrow(/duplicate/)
    const rng = structuredClone(eventsRaw) as any
    rng.events_catalog[0].max_turn = 0
    expect(() => parseEvents(rng)).toThrow(/min_turn/)
  })
})

describe('characters.json as delivered', () => {
  it('reads inventory from starting_stats and ttc_delay_impact', () => {
    expect(chars.slice(0, 3).map((c) => c.class_id)).toEqual(['CLASS_001_COMMUTER', 'CLASS_002_INTERN', 'CLASS_003_CAMPUS_RES'])
    expect(chars[0].starting_stats).toMatchObject({ cash: 40, sanity: 85, health: 90 })
    expect(chars[0].starting_inventory).toEqual(['Presto Card', 'Meal Plan Voucher'])
    expect(chars[1].starting_inventory).toEqual(['Corporate Lanyard', 'Surge Espresso', 'Meal Plan Voucher'])
    expect(chars[2].starting_inventory).toEqual(['Meal Plan Voucher'])
    expect(chars.slice(3).map((c) => c.starting_stats)).toEqual([
      { cash: 120, sanity: 70, health: 85 }, { cash: 60, sanity: 60, health: 75 }, { cash: 180, sanity: 55, health: 80 }])
    expect(chars.slice(3).map((c) => c.display_name)).toEqual([
      'The Newcomer / International Student', 'The Downtown Gig & Uber Courier', 'The North York Startup Hustler'])
    expect(chars.map((c) => c.daily_stipend)).toEqual([35, 65, 15, 25, 45, 50])
    expect(chars.slice(0, 3).map((c) => c.passive_modifiers.ttc_delay_multiplier)).toEqual([1.25, 1, 0.5])
    expect(chars.slice(0, 3).map((c) => c.passive_modifiers.weather_drain_multiplier)).toEqual([1, 1.15, 0.75])
  })
  it('still accepts the legacy field names', () => {
    const legacy = structuredClone(charactersRaw) as any
    legacy.classes[0].starting_inventory = ['X']
    legacy.classes[0].passive_modifiers = { ttc_delay_multiplier: 2, weather_drain_multiplier: 1 }
    const c = parseCharacters(legacy).classes[0]
    expect(c.starting_inventory).toEqual(['X'])
    expect(c.passive_modifiers.ttc_delay_multiplier).toBe(2)
  })
})

describe('turn engine', () => {
  it('picks events deterministically and only within turn range', () => {
    const s = newGame(commuter, 42)
    expect(pickEvent(s, events)?.event_id).toBe(pickEvent(s, events)?.event_id)
    for (const turn of [1, 11, 25, 40, 55, 75]) {
      const e = pickEvent({ ...s, turn }, events)!
      expect(e.min_turn).toBeLessThanOrEqual(turn)
      expect(e.max_turn).toBeGreaterThanOrEqual(turn)
    }
    // Everything seen: the pool recycles instead of going quiet, skipping what was drawn lately.
    const seenAll = events.events_catalog.map((e) => e.event_id)
    const again = pickEvent({ ...s, turn: 25, processedEvents: seenAll, recent: seenAll.slice(-5) }, events)!
    expect(again).toBeTruthy()
    expect(seenAll.slice(-5)).not.toContain(again.event_id)
    // Only a day no event covers is quiet.
    expect(pickEvent({ ...s, turn: 25 }, { ...events, events_catalog: [] })).toBeNull()
  })
  it('applies a choice, then advances only on explicit next', () => {
    let s = beginGame(newGame(commuter, 1), events)
    const ev = pickEvent(s, events)!
    s = applyChoice(s, ev, 'choice_b', commuter)
    expect(s.turn).toBe(1)
    expect(s.stats.cash).toBeCloseTo(commuter.starting_stats.cash + ev.choice_b.metrics_impact.cash_modifier, 2)
    expect(s.processedEvents).toEqual([ev.event_id])
    s = advanceTurn(s, events)
    expect(s.turn).toBe(1 + ev.choice_b.metrics_impact.turns_consumed)
    expect(s.lastResult).toBeNull()
  })
  it('does not advance while an event is unanswered', () => {
    const s = beginGame(newGame(commuter, 1), events)
    expect(advanceTurn(s, events).turn).toBe(1)
  })
  it('gates choices on required inventory', () => {
    const ev = byId('TSS_ACT2_006_MIDTERM_CRUNCH')
    const intern = chars[1] // starts with Surge Espresso
    const without = { ...newGame(intern, 1), inventory: [] as string[], turn: 12 }
    expect(canChoose(newGame(intern, 1), ev.choice_a)).toBe(true)
    expect(canChoose(newGame(commuter, 1), ev.choice_a)).toBe(false) // Surge Espresso: commuter has none
    expect(canChoose(without, ev.choice_a)).toBe(false)
    expect(applyChoice(without, ev, 'choice_a', intern)).toBe(without)
  })
  it('never kills the player during act 1', () => {
    const ev = structuredClone(events.events_catalog[0])
    ev.choice_a.metrics_impact.health_modifier = -9999
    const s = applyChoice(beginGame(newGame(commuter, 1), events), ev, 'choice_a', commuter)
    expect(s.status).toBe('playing')
    expect(s.stats.health).toBe(1)
  })
  it('can lose after act 1', () => {
    const ev = structuredClone(events.events_catalog[1])
    ev.choice_a.metrics_impact.health_modifier = -9999
    const s = applyChoice({ ...newGame(commuter, 1), turn: 12 }, ev, 'choice_a', commuter)
    expect(s.status).toBe('lost')
  })
  it('scales drains by passive multipliers on api-dependent events', () => {
    const ev = byId('TSS_ACT1_001_TTC_BLIZZARD') // choice_b sanity -25, both api deps
    const a = applyChoice(newGame(commuter, 1), ev, 'choice_b', commuter) // 1.5 x 1.0
    const c = applyChoice(newGame(chars[2], 1), ev, 'choice_b', chars[2]) // 0.8 x 0.8
    expect(a.lastResult!.delta.sanity).toBe(Math.round(-25 * 1.25 * 1.0)) // commuter ttc 1.25, weather 1.0
    expect(c.lastResult!.delta.sanity).toBe(Math.round(-25 * 0.5 * 0.75)) // campus ttc 0.5, weather 0.75
  })
  it('charges the cost of every day a choice consumes', () => {
    const ev = byId('TSS_ACT1_001_TTC_BLIZZARD')
    let s = beginGame(newGame(commuter, 1), events)
    s = applyChoice(s, ev, 'choice_b', commuter)
    expect(advanceTurn(s, events).turn).toBe(3)
    const over = { ...s, turn: 59 }
    expect(advanceTurn(over, events).status).toBe('finished')
  })
})

describe('persistence', () => {
  it('round-trips state', () => {
    const st = memStorage()
    const s = beginGame(newGame(commuter, 5), events)
    expect(saveGame(s, st)).toBe(true)
    expect(loadGame(st)).toEqual(s)
    clearSave(st)
    expect(loadGame(st)).toBeNull()
  })
  it('rejects edited, corrupt and incoherent saves', () => {
    const st = memStorage()
    const s = newGame(commuter, 5)
    saveGame(s, st)
    const env = JSON.parse(st.getItem(SAVE_KEY)!)
    env.state.stats.cash = 999999
    st.setItem(SAVE_KEY, JSON.stringify(env))
    expect(loadGame(st)).toBeNull()
    st.setItem(SAVE_KEY, '{nope')
    expect(loadGame(st)).toBeNull()
    const bad = { ...s, stats: { ...s.stats, cash: NaN } }
    st.setItem(SAVE_KEY, JSON.stringify({ version: 5, state: bad, checksum: checksum(bad) }))
    expect(loadGame(st)).toBeNull()
  })
  it('rejects saves whose win/loss state contradicts the vitals or turn', () => {
    const st = memStorage()
    const s = newGame(commuter, 5)
    const put = (o: object) => { const x = { ...s, ...o } as typeof s; st.setItem(SAVE_KEY, JSON.stringify({ version: 5, state: x, checksum: checksum(x) })); return loadGame(st) }
    expect(put({})).not.toBeNull()
    expect(put({ status: 'lost' })).toBeNull() // lost with live vitals
    expect(put({ status: 'finished', victory: 'wealth' })).toBeNull() // finished before day 60
    expect(put({ turn: 61 })).toBeNull() // past day 60 only in endless mode
    expect(put({ turn: 61, endless: true })).not.toBeNull()
    expect(put({ stats: { cash: 0, sanity: 150, health: 10 } })).toBeNull()
    expect(put({ processedEvents: ['a', 'b', 'c'], turn: 2 })).toBeNull() // more events than days
  })
  it('survives a throwing storage', () => {
    const boom = { ...memStorage(), setItem() { throw new Error('quota') }, getItem() { throw new Error('x') } } as Storage
    expect(saveGame(newGame(commuter, 1), boom)).toBe(false)
    expect(loadGame(boom)).toBeNull()
  })
})

describe('frozen client rules', () => {
  it('maps turns to acts and time labels', () => {
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41, 50, 51, 60, 61, 200].map(actForTurn)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 6, 6])
    expect([1, 7, 8, 14, 22, 28, 56, 57, 60, 61].map(timeLabel)).toEqual(
      ['Week 1', 'Week 1', 'Week 2', 'Week 2', 'Week 4', 'Week 4', 'Week 8', 'Final stretch', 'Final stretch', 'Endless'])
  })
  it('computes TTC and weather modifiers', () => {
    expect(ttcModifier(0)).toBe(1)
    expect(ttcModifier(15)).toBe(1)
    expect(ttcModifier(30)).toBe(1.5)
    expect(weatherModifier(-10, 0)).toBe(1.5)
    expect(weatherModifier(5, 6)).toBe(1.25)
    expect(weatherModifier(5, 5)).toBe(1)
  })
  it('applies live modifiers to harm', () => {
    const ev = byId('TSS_ACT1_001_TTC_BLIZZARD')
    const s = applyChoice(newGame(chars[1], 1), ev, 'choice_b', chars[1], {
      delayMinutes: 30, tempC: 10, precipMm: 0, weatherLabel: '', transitLabel: '', weatherSource: 'live', transitSource: 'live' })
    expect(s.lastResult!.delta.sanity).toBe(Math.round(-25 * 1.0 * 1.15 * 1.5)) // intern passives (ttc 1.0, weather 1.15) x TTC 1.5
  })
  it('caps sanity/health at 100 and lets cash go negative without game over', () => {
    const ev = structuredClone(events.events_catalog[1])
    ev.choice_a.metrics_impact = { cash_modifier: -5000, sanity_modifier: 500, health_modifier: 500, turns_consumed: 1 }
    const s = applyChoice({ ...newGame(commuter, 1), turn: 12 }, ev, 'choice_a', commuter)
    expect(s.stats.sanity).toBe(100)
    expect(s.stats.health).toBe(100)
    expect(s.stats.cash).toBeLessThan(0)
    expect(s.status).toBe('playing')
  })
  it('charges extra sanity each day while cash is negative', () => {
    const s = { ...newGame(commuter, 1), stipend: 0, turn: 12, stats: { cash: -1, sanity: 50, health: 50 } }
    expect(advanceTurn(s, events).stats.sanity).toBe(48) // overdraft penalty is 2
  })
  it('consumes the required inventory item exactly once', () => {
    const ev = byId('TSS_ACT2_006_MIDTERM_CRUNCH')
    const s = applyChoice({ ...newGame(chars[1], 1), turn: 12 }, ev, 'choice_a', chars[1])
    expect(s.inventory).not.toContain('Surge Espresso')
    expect(s.inventory).toContain('Corporate Lanyard')
  })
  it('plays each event once before any repeat, and finishes after day 60', () => {
    let s = beginGame(newGame(commuter, 9), events)
    const seen = new Set<string>()
    let repeated = false
    for (let i = 0; i < TOTAL_TURNS && s.status === 'playing'; i++) {
      const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
      if (ev) {
        // A repeat is only allowed once every event that can appear today has already been seen.
        if (seen.has(ev.event_id)) {
          repeated = true
          const fresh = events.events_catalog.filter((e) => e.min_turn <= s.turn && s.turn <= e.max_turn && !seen.has(e.event_id))
          expect(fresh).toHaveLength(0)
        }
        seen.add(ev.event_id)
        s = applyChoice({ ...s, stats: { cash: 500, sanity: 100, health: 100 } }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', commuter)
      }
      s = advanceTurn(s, events)
    }
    expect(repeated || seen.size > 0).toBe(true)
    expect(s.status).toBe('finished')
    expect(s.turn).toBe(60)
  })
  it('has an event every day for 60 days (no quiet days)', () => {
    let s = beginGame(newGame(commuter, 4), events)
    for (let i = 0; i < TOTAL_TURNS && s.status === 'playing'; i++) {
      expect(s.currentEventId).not.toBeNull()
      const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)!
      s = advanceTurn(applyChoice({ ...s, stats: { cash: 500, sanity: 100, health: 100 } }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', commuter), events)
    }
  })
})

describe('endless mode', () => {
  const finished = () => {
    let s = beginGame(newGame(commuter, 11), events)
    for (let i = 0; i < 80 && s.status === 'playing'; i++) {
      const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
      if (ev) s = applyChoice({ ...s, stats: { cash: 500, sanity: 100, health: 100 } }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', commuter)
      s = advanceTurn(s, events)
    }
    return s
  }
  it('continues past day 60 only from a finished run', () => {
    const f = finished()
    expect(f.status).toBe('finished')
    const e = continueEndless(f, events)
    expect(e).toMatchObject({ status: 'playing', endless: true, turn: 61 })
    expect(e.currentEventId).not.toBeNull()
    const playing = beginGame(newGame(commuter, 1), events)
    expect(continueEndless(playing, events)).toBe(playing)
  })
  it('has no day cap and can still be lost', () => {
    let s = continueEndless(finished(), events)
    for (let i = 0; i < 20 && s.status === 'playing'; i++) {
      const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)!
      s = advanceTurn(applyChoice({ ...s, stats: { cash: 500, sanity: 100, health: 100 } }, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', commuter), events)
    }
    expect(s.status).toBe('playing')
    expect(s.turn).toBeGreaterThan(70)
    const dead = advanceTurn({ ...s, currentEventId: null, stats: { cash: -10, sanity: 2, health: 50 }, stipend: 0 }, events)
    expect(dead.status).toBe('lost')
    expect(computeRank(dead)).toBe('Endless Legend')
  })
  it('saves and reloads an endless run', () => {
    const st = memStorage()
    const e = continueEndless(finished(), events)
    saveGame(e, st)
    expect(loadGame(st)).toEqual(e)
  })
})

describe('new content', () => {
  const ids = (n: number) => events.events_catalog.filter((e) => e.act_tier === n).map((e) => e.event_id)
  it('adds the 18 events, 3 for each of the six acts', () => {
    const added = events.events_catalog.filter((e) => Number(e.event_id.split('_')[2]) >= 16)
    expect(added).toHaveLength(18)
    for (let act = 1; act <= 6; act++) expect(added.filter((e) => e.act_tier === act)).toHaveLength(3)
    expect(ids(6).length).toBeGreaterThan(0)
  })
  it("uses the client's numbers", () => {
    const m = (id: string, k: 'choice_a' | 'choice_b') => byId(id)[k].metrics_impact
    expect(m('TSS_ACT1_016_UNION_GO_SIGNAL_FAILURE', 'choice_a')).toMatchObject({ cash_modifier: -48, sanity_modifier: 5, health_modifier: 0 })
    expect(m('TSS_ACT1_016_UNION_GO_SIGNAL_FAILURE', 'choice_b')).toMatchObject({ cash_modifier: 0, sanity_modifier: -15, health_modifier: -5 })
    expect(m('TSS_ACT6_032_HIGH_PARK_CHERRY_BLOSSOMS', 'choice_b')).toMatchObject({ cash_modifier: 40, sanity_modifier: -12 })
    expect(m('TSS_ACT5_028_DENTAL_CLEANING_COPAY', 'choice_a')).toMatchObject({ cash_modifier: -95, health_modifier: 10 })
  })
  it('every new class can play a full run', () => {
    for (const c of chars.slice(3)) {
      let s = beginGame(newGame(c, 3), events)
      for (let i = 0; i < 70 && s.status === 'playing'; i++) {
        const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
        if (ev) s = applyChoice(s, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', c)
        s = advanceTurn(s, events)
      }
      expect(['finished', 'lost']).toContain(s.status)
    }
  })
})
