/**
 * Win/loss feasibility checker. Run with `npm run balance`.
 *
 * For every character it reports:
 *  1. Exhaustive search: tries EVERY possible sequence of choices on SEEDS different games
 *     (the seed decides which event appears on which day) and counts how many games have at
 *     least one path that survives all 30 days, plus the furthest day any path reaches and
 *     the most cash ever held (which shows whether wealth/condo wins are reachable).
 *  2. Simulated play: GAMES games each for a random player and a careful player (always picks
 *     the option with the best sanity + health change).
 *  3. Choices that are permanently locked for that character (required item never owned and
 *     no event ever grants items).
 *
 * Options (environment variables): SEEDS=12 GAMES=500 ENV=neutral|bad STRICT=1
 *  ENV=bad uses a 45 min TTC delay and -20°C; STRICT=1 fails if any character cannot win.
 */
import { it } from 'vitest'
import charactersRaw from '../src/data/characters.json'
import eventsRaw from '../src/data/events.json'
import { FALLBACK_ENV } from '../src/engine/environment'
import { advanceTurn, applyChoice, beginGame, canChoose, newGame } from '../src/engine/game'
import { parseCharacters, parseEvents } from '../src/engine/validate'
import type { CharacterClass, Environment, GameState } from '../src/types'

const SEEDS = Number(process.env.SEEDS ?? 12)
const GAMES = Number(process.env.GAMES ?? 500)
const STRICT = process.env.STRICT === '1'
const env: Environment = process.env.ENV === 'bad' ? { ...FALLBACK_ENV, delayMinutes: 45, tempC: -20 } : FALLBACK_ENV

const chars = parseCharacters(charactersRaw).classes
const events = parseEvents(eventsRaw)
const byId = new Map(events.events_catalog.map((e) => [e.event_id, e]))
const KEYS = ['choice_a', 'choice_b'] as const

function exhaustive(c: CharacterClass, seed: number) {
  let wins = 0
  let furthest = 0
  let maxCash = -Infinity
  const victories = new Set<string>()
  const go = (s: GameState) => {
    maxCash = Math.max(maxCash, s.stats.cash)
    if (s.status !== 'playing') {
      furthest = Math.max(furthest, s.turn)
      if (s.status === 'finished') { wins++; if (s.victory) victories.add(s.victory) }
      return
    }
    const ev = s.currentEventId ? byId.get(s.currentEventId) : undefined
    if (!ev) { go(advanceTurn(s, events, env)); return }
    for (const k of KEYS) if (canChoose(s, ev[k])) go(advanceTurn(applyChoice(s, ev, k, c, env), events, env))
  }
  go(beginGame(newGame(c, seed), events))
  return { wins, furthest, maxCash, victories }
}

function simulate(c: CharacterClass, strategy: 'random' | 'careful') {
  const out: Record<string, number> = {}
  let deathDays = 0
  let deaths = 0
  for (let seed = 1; seed <= GAMES; seed++) {
    let s = beginGame(newGame(c, seed), events)
    let r = seed * 7919
    for (let i = 0; i < 40 && s.status === 'playing'; i++) {
      const ev = s.currentEventId ? byId.get(s.currentEventId) : undefined
      if (ev) {
        const opts = KEYS.filter((k) => canChoose(s, ev[k]))
        r = (r * 1103515245 + 12345) % 2147483648
        const score = (k: (typeof KEYS)[number]) => ev[k].metrics_impact.sanity_modifier + ev[k].metrics_impact.health_modifier
        const pick = strategy === 'random' ? opts[r % opts.length] : [...opts].sort((a, b) => score(b) - score(a))[0]
        s = applyChoice(s, ev, pick, c, env)
      }
      s = advanceTurn(s, events, env)
    }
    const key = s.status === 'finished' ? (s.victory ?? 'finished') : 'lost'
    out[key] = (out[key] ?? 0) + 1
    if (s.status === 'lost') { deathDays += s.turn; deaths++ }
  }
  return { out, avgDeathDay: deaths ? (deathDays / deaths).toFixed(1) : '-' }
}

function lockedChoices(c: CharacterClass): string[] {
  const owned = new Set(c.starting_inventory)
  const locked: string[] = []
  for (const e of events.events_catalog) {
    for (const k of KEYS) {
      const need = e[k].required_inventory_item
      if (need && !owned.has(need)) locked.push(`${e.event_id} ${k === 'choice_a' ? 'A' : 'B'} (needs ${need})`)
    }
  }
  return locked
}

it('win/loss feasibility report', () => {
  const lines: string[] = []
  const unwinnable: string[] = []
  lines.push('', `BALANCE REPORT  (environment: ${process.env.ENV === 'bad' ? 'bad weather + TTC delay' : 'neutral'}, ${SEEDS} seeds exhaustive, ${GAMES} simulated games each)`, '')
  for (const c of chars) {
    let winnable = 0
    let furthest = 0
    let maxCash = -Infinity
    const victories = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = exhaustive(c, seed)
      if (r.wins > 0) winnable++
      furthest = Math.max(furthest, r.furthest)
      maxCash = Math.max(maxCash, r.maxCash)
      r.victories.forEach((v) => victories.add(v))
    }
    const rnd = simulate(c, 'random')
    const care = simulate(c, 'careful')
    if (winnable === 0) unwinnable.push(c.class_id)
    lines.push(
      `${c.display_name} (${c.class_id})`,
      `  start: cash ${c.starting_stats.cash}, sanity ${c.starting_stats.sanity}, health ${c.starting_stats.health}, items [${c.starting_inventory.join(', ')}]`,
      `  every-choice search: winnable on ${winnable}/${SEEDS} games; furthest day reached ${furthest}; most cash ever held ${maxCash}`,
      `  victories reachable: ${victories.size ? [...victories].join(', ') : 'none'}`,
      `  careful player: ${JSON.stringify(care.out)}  (avg defeat day ${care.avgDeathDay})`,
      `  random player:  ${JSON.stringify(rnd.out)}  (avg defeat day ${rnd.avgDeathDay})`,
      `  locked choices: ${lockedChoices(c).join('; ') || 'none'}`,
      '',
    )
  }
  lines.push(unwinnable.length ? `UNWINNABLE: ${unwinnable.join(', ')}` : 'All characters can win.', '')
  process.stdout.write(lines.join('\n') + '\n')
  if (STRICT && unwinnable.length) throw new Error(`Unwinnable characters: ${unwinnable.join(', ')}`)
}, 600_000)
