import type {
  CharacterClass, Choice, Environment, EventsFile, GameEvent, GameState, GameStatus, Stats, Victory,
} from '../types'
import { FALLBACK_ENV, ttcModifier, weatherModifier } from './environment'
import { mulberry32 } from './rng'

export { FALLBACK_ENV }

export const TOTAL_TURNS = 30
export const STAT_MAX = 100
/** Opening act has no fatal triggers (earlier baseline); vitals floor at 1 through this turn. */
export const ACT1_LAST_TURN = 10
/**
 * Base cost of the progressive daily drain (base × 1.15^turn). The client has not supplied it,
 * so it is 0 (no drain) until confirmed. It is also the "Base Cost" in the negative-cash rule.
 */
export const BASE_DAILY_DRAIN = 0
export const DRAIN_GROWTH = 1.15
export const WEALTH_TARGET = 100_000
export const WEALTH_MIN_TURN = 25
export const CONDO_BASE_PRICE = 100_000
export const NEGATIVE_CASH_EXTRA_PENALTY = 5

export function dailyDrain(turn: number): number {
  return Math.round(BASE_DAILY_DRAIN * DRAIN_GROWTH ** turn)
}

/** Condo target = base × (1 + extra TTC impact + extra weather impact), i.e. modifiers above 1.00. */
export function condoThreshold(env: Environment): number {
  const extra = (ttcModifier(env.delayMinutes) - 1) + (weatherModifier(env.tempC, env.precipMm) - 1)
  return Math.round(CONDO_BASE_PRICE * (1 + extra))
}

/**
 * Evaluated once, when turn 30 completes with vitals above zero.
 * Wealth needs every catalog event played so an early cash spike cannot end the run on its own.
 */
export function evaluateVictory(state: GameState, events: EventsFile, env: Environment): Victory | null {
  if (state.status === 'lost' || state.stats.health <= 0 || state.stats.sanity <= 0) return null
  const allPlayed = state.processedEvents.length === events.events_catalog.length
  if (state.stats.cash >= WEALTH_TARGET && state.turn >= WEALTH_MIN_TURN && allPlayed) return 'wealth'
  if (state.stats.cash >= condoThreshold(env)) return 'asset'
  return 'endurance'
}

export function actForTurn(turn: number): 1 | 2 | 3 {
  return turn <= 10 ? 1 : turn <= 20 ? 2 : 3
}

export function timeLabel(turn: number): string {
  if (turn <= 7) return 'Week 1'
  if (turn <= 14) return 'Week 2'
  if (turn <= 21) return 'Week 3'
  if (turn <= 28) return 'Week 4'
  return 'Month End'
}

export function newGame(char: CharacterClass, seed: number): GameState {
  return {
    characterId: char.class_id,
    seed: seed >>> 0,
    turn: 1,
    stats: { ...char.starting_stats },
    inventory: [...char.starting_inventory],
    flags: {},
    processedEvents: [],
    currentEventId: null,
    lastResult: null,
    status: 'playing',
    lossReason: null,
    victory: null,
  }
}

/** Events for the current act that have not been drawn yet. */
export function eligibleEvents(state: GameState, events: EventsFile): GameEvent[] {
  const act = actForTurn(state.turn)
  return events.events_catalog.filter(
    (e) => e.act_tier === act && !state.processedEvents.includes(e.event_id),
  )
}

/** Deterministic for a given (seed, turn, processed set). Null means a quiet day. */
export function pickEvent(state: GameState, events: EventsFile): GameEvent | null {
  const pool = eligibleEvents(state, events)
  if (pool.length === 0) return null
  const rng = mulberry32(state.seed + state.turn * 7919)
  return pool[Math.floor(rng() * pool.length)]
}

export function canChoose(state: GameState, choice: Choice): boolean {
  return !choice.required_inventory_item || state.inventory.includes(choice.required_inventory_item)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function vitalsOutcome(stats: Stats): { status: GameStatus; reason: string | null } {
  if (stats.health <= 0) return { status: 'lost', reason: 'Your health hit zero.' }
  if (stats.sanity <= 0) return { status: 'lost', reason: 'Your sanity hit zero.' }
  return { status: 'playing', reason: null }
}

/**
 * Applies a choice. Negative sanity/health deltas on events with api_dependencies are scaled
 * by the character's passive multiplier and the live TTC / weather modifier. Cash is uncapped
 * and may go negative; sanity/health clip to 0–100. A used inventory item is consumed.
 */
export function applyChoice(
  state: GameState,
  event: GameEvent,
  key: 'choice_a' | 'choice_b',
  char: CharacterClass,
  env: Environment = FALLBACK_ENV,
): GameState {
  const choice = event[key]
  if (state.status !== 'playing' || state.lastResult) return state
  if (!canChoose(state, choice)) return state

  const m = choice.metrics_impact
  let scale = 1
  if (event.api_dependencies.transit_delay_key) {
    scale *= char.passive_modifiers.ttc_delay_multiplier * ttcModifier(env.delayMinutes)
  }
  if (event.api_dependencies.weather_severity_key) {
    scale *= char.passive_modifiers.weather_drain_multiplier * weatherModifier(env.tempC, env.precipMm)
  }
  const scaled = (v: number) => (v < 0 ? Math.round(v * scale) : v)

  const delta: Stats = {
    cash: m.cash_modifier,
    sanity: scaled(m.sanity_modifier),
    health: scaled(m.health_modifier),
  }
  const floor = state.turn <= ACT1_LAST_TURN ? 1 : 0
  const stats: Stats = {
    cash: Math.round((state.stats.cash + delta.cash) * 100) / 100,
    sanity: clamp(state.stats.sanity + delta.sanity, floor, STAT_MAX),
    health: clamp(state.stats.health + delta.health, floor, STAT_MAX),
  }
  const { status, reason } = vitalsOutcome(stats)
  const used = choice.required_inventory_item
  const inventory = used
    ? (() => { const i = state.inventory.indexOf(used); return state.inventory.filter((_, j) => j !== i) })()
    : state.inventory

  return {
    ...state,
    stats,
    inventory,
    processedEvents: [...state.processedEvents, event.event_id],
    lastResult: { eventId: event.event_id, choiceKey: key, delta },
    status,
    lossReason: reason,
    flags: { ...state.flags, [`played:${event.event_id}`]: true },
  }
}

/**
 * Player-initiated "Next Day". A choice may consume more than one day (`turns_consumed`);
 * each consumed day charges the progressive drain, plus the overdraft penalty while cash < 0.
 * Passing day 30 finishes the run.
 */
export function advanceTurn(state: GameState, events: EventsFile, env: Environment = FALLBACK_ENV): GameState {
  if (state.status !== 'playing') return state
  // A pending event must be answered first; a quiet day (no eligible event) just passes.
  if (state.currentEventId && !state.lastResult) return state

  const last = state.lastResult
  const ev = last && events.events_catalog.find((e) => e.event_id === last.eventId)
  const spent = ev && last ? ev[last.choiceKey].metrics_impact.turns_consumed : 1
  const days = Math.min(spent, TOTAL_TURNS - state.turn + 1)

  let stats = state.stats
  for (let d = 0; d < days; d++) {
    const day = state.turn + d
    const penalty = dailyDrain(day) + (stats.cash < 0 ? NEGATIVE_CASH_EXTRA_PENALTY : 0)
    if (penalty > 0) {
      const floor = day <= ACT1_LAST_TURN ? 1 : 0
      stats = { ...stats, sanity: clamp(stats.sanity - penalty, floor, STAT_MAX) }
    }
    const out = vitalsOutcome(stats)
    if (out.status === 'lost') {
      return { ...state, stats, turn: day, lastResult: null, currentEventId: null, status: 'lost', lossReason: out.reason }
    }
  }
  const base: GameState = { ...state, stats, lastResult: null, currentEventId: null }
  if (state.turn + spent > TOTAL_TURNS) {
    const done: GameState = { ...base, turn: TOTAL_TURNS, status: 'finished' }
    return { ...done, victory: evaluateVictory(done, events, env) }
  }

  const next = { ...base, turn: state.turn + spent }
  return { ...next, currentEventId: pickEvent(next, events)?.event_id ?? null }
}

/** Starts the first event of a fresh game. */
export function beginGame(state: GameState, events: EventsFile): GameState {
  return { ...state, currentEventId: pickEvent(state, events)?.event_id ?? null }
}
