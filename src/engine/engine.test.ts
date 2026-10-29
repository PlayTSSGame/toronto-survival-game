/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest'
import charactersRaw from '../data/characters.json'
import eventsRaw from '../data/events.json'
import { ttcModifier, weatherModifier } from './environment'
import { actForTurn, advanceTurn, applyChoice, beginGame, canChoose, newGame, pickEvent, timeLabel, TOTAL_TURNS } from './game'
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
    expect(chars).toHaveLength(3)
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
    expect(chars.map((c) => c.class_id)).toEqual(['CLASS_001_COMMUTER', 'CLASS_002_INTERN', 'CLASS_003_CAMPUS_RES'])
    expect(chars[0].starting_stats).toMatchObject({ cash: 40, sanity: 85, health: 90 })
    expect(chars[0].starting_inventory).toEqual(['Presto Card', 'Meal Plan Voucher'])
    expect(chars[1].starting_inventory).toEqual(['Corporate Lanyard', 'Surge Espresso', 'Meal Plan Voucher'])
    expect(chars[2].starting_inventory).toEqual(['Meal Plan Voucher'])
    expect(chars.map((c) => c.daily_stipend)).toEqual([350, 600, 200])
    expect(chars.map((c) => c.passive_modifiers.ttc_delay_multiplier)).toEqual([1.25, 1, 0.5])
    expect(chars.map((c) => c.passive_modifiers.weather_drain_multiplier)).toEqual([1, 1.15, 0.75])
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
    expect(pickEvent({ ...s, turn: 11 }, events)?.act_tier).toBe(2)
    expect(pickEvent({ ...s, turn: 25 }, events)?.act_tier).toBe(3)
    expect(pickEvent({ ...s, turn: 25, processedEvents: events.events_catalog.map((e) => e.event_id) }, events)).toBeNull()
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
    const over = { ...s, turn: 29 }
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
    st.setItem(SAVE_KEY, JSON.stringify({ version: 4, state: bad, checksum: checksum(bad) }))
    expect(loadGame(st)).toBeNull()
  })
  it('rejects saves whose win/loss state contradicts the vitals or turn', () => {
    const st = memStorage()
    const s = newGame(commuter, 5)
    const put = (o: object) => { const x = { ...s, ...o } as typeof s; st.setItem(SAVE_KEY, JSON.stringify({ version: 4, state: x, checksum: checksum(x) })); return loadGame(st) }
    expect(put({})).not.toBeNull()
    expect(put({ status: 'lost' })).toBeNull() // lost with live vitals
    expect(put({ status: 'finished', victory: 'wealth' })).toBeNull() // finished before turn 30
    expect(put({ turn: 31 })).toBeNull()
    expect(put({ stats: { cash: 0, sanity: 150, health: 10 } })).toBeNull()
    expect(put({ processedEvents: ['a', 'a'], turn: 3 })).toBeNull()
  })
  it('survives a throwing storage', () => {
    const boom = { ...memStorage(), setItem() { throw new Error('quota') }, getItem() { throw new Error('x') } } as Storage
    expect(saveGame(newGame(commuter, 1), boom)).toBe(false)
    expect(loadGame(boom)).toBeNull()
  })
})

describe('frozen client rules', () => {
  it('maps turns to acts and time labels', () => {
    expect([1, 10, 11, 20, 21, 30].map(actForTurn)).toEqual([1, 1, 2, 2, 3, 3])
    expect([1, 7, 8, 14, 15, 21, 22, 28, 29, 30].map(timeLabel)).toEqual(
      ['Week 1', 'Week 1', 'Week 2', 'Week 2', 'Week 3', 'Week 3', 'Week 4', 'Week 4', 'Month End', 'Month End'])
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
  it('never repeats an event and finishes after turn 30', () => {
    let s = beginGame(newGame(commuter, 9), events)
    const seen = new Set<string>()
    for (let i = 0; i < TOTAL_TURNS && s.status === 'playing'; i++) {
      const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
      if (ev) {
        expect(seen.has(ev.event_id)).toBe(false)
        seen.add(ev.event_id)
        s = applyChoice(s, ev, canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b', commuter)
      }
      s = advanceTurn(s, events)
    }
    expect(s.status === 'finished' || s.status === 'lost').toBe(true)
    if (s.status === 'finished') expect(s.turn).toBe(30)
  })
})
