import { describe, expect, it } from 'vitest'
import charactersRaw from '../data/characters.json'
import eventsRaw from '../data/events.json'
import { advanceTurn, applyChoice, beginGame, canChoose, newGame, rentForDay } from './game'
import { FALLBACK_ENV } from './environment'
import { parseCharacters, parseEvents } from './validate'

const events = parseEvents(eventsRaw)
const commuter = parseCharacters(charactersRaw).classes.find((c) => c.class_id === 'CLASS_001_COMMUTER')!

describe('cash is an additive ledger', () => {
  it('each day: new cash = old cash + choice cash change + one flat stipend', () => {
    let s = beginGame(newGame(commuter, 7), events)
    for (let i = 0; i < 60 && s.status === 'playing'; i++) {
      const ev = events.events_catalog.find((e) => e.event_id === s.currentEventId)
      if (!ev) break
      const key = canChoose(s, ev.choice_a) ? 'choice_a' : 'choice_b'
      const chosen = applyChoice(s, ev, key, commuter, FALLBACK_ENV)
      if (chosen.status !== 'playing') break
      const days = ev[key].metrics_impact.turns_consumed
      const next = advanceTurn(chosen, events, FALLBACK_ENV)
      let rent = 0
      for (let d = 0; d < days; d++) rent += rentForDay(s.turn + d)
      expect(next.stats.cash).toBeCloseTo(chosen.stats.cash + days * commuter.daily_stipend - rent, 2)
      s = next
    }
  })
})
