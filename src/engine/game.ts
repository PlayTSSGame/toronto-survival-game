import type {
  CharacterClass, Choice, Environment, EventsFile, GameEvent, GameState, GameStatus, Stats, Victory,
} from '../types'
import { FALLBACK_ENV, ttcModifier, weatherModifier } from './environment'
import { mulberry32 } from './rng'

export { FALLBACK_ENV }

export const TOTAL_TURNS = 60
export const DAYS_PER_ACT = 10
export const ACT_COUNT = 6
/** No scenario comes back within this many plays. */
export const COOLDOWN_DAYS = 20
/** Used only when too few events are eligible to honour the full cooldown. */
export const MIN_COOLDOWN = 5
/** Share of draws taken from a class's own scenarios when it has some available. */
export const CLASS_EVENT_SHARE = 0.6
/** Shock events start no earlier than this day and then come every 4-5 days. */
export const SHOCK_FIRST_DAY = 4
export const SHOCK_GAP = 4
/** Rent is due on every 15th day: $350, $400, then $450 from day 45 on. */
export const RENT_EVERY = 15
export const STAT_MAX = 100
/** Opening act has no fatal triggers (earlier baseline); vitals floor at 1 through this turn. */
export const ACT1_LAST_TURN = 10
/**
 * Base cost of the progressive daily drain (base × 1.08^turn). The client has not supplied it,
 * so it is 0 (no drain) until confirmed. It is also the "Base Cost" in the negative-cash rule.
 */
export const BASE_DAILY_DRAIN = 0
export const DRAIN_GROWTH = 1.08
export const WEALTH_TARGET = 10_000
export const WEALTH_MIN_TURN = 50
/** Wealth also needs this share of the catalog seen, so an early cash spike cannot end the run on its own. */
export const WEALTH_SEEN_SHARE = 0.8
export const CONDO_BASE_PRICE = 10_000
export const NEGATIVE_CASH_EXTRA_PENALTY = 2

export function dailyDrain(turn: number): number {
  return Math.round(BASE_DAILY_DRAIN * DRAIN_GROWTH ** turn)
}

export function rentForDay(day: number): number {
  if (day < RENT_EVERY || day % RENT_EVERY !== 0) return 0
  return day <= 15 ? 350 : day <= 30 ? 400 : 450
}

/**
 * How much harder a choice hits on a given day. Days 21-40 hit sanity/health 25% harder, days 41-60
 * hit cash 30% harder (that rate carries into endless mode), and every 10 endless days add 10% to both.
 */
export function pressure(turn: number): { vitals: number; cash: number } {
  const steps = turn > TOTAL_TURNS ? 1 + Math.floor((turn - TOTAL_TURNS - 1) / 10) : 0
  const extra = 1 + 0.1 * steps
  return {
    vitals: (turn >= 21 && turn <= 40 ? 1.25 : 1) * extra,
    cash: (turn >= 41 ? 1.3 : 1) * extra,
  }
}

/** Days between shock events: 4 or 5, fixed by the seed so a save replays the same way. */
function shockGap(seed: number, last: number): number {
  return SHOCK_GAP + (mulberry32(seed + last * 131)() < 0.5 ? 0 : 1)
}

export function isShockDay(state: GameState): boolean {
  return state.turn >= SHOCK_FIRST_DAY && state.turn - state.lastShock >= shockGap(state.seed, state.lastShock)
}

function hashText(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Condo target = base × (1 + extra TTC impact + extra weather impact), i.e. modifiers above 1.00. */
export function condoThreshold(env: Environment): number {
  const extra = (ttcModifier(env.delayMinutes) - 1) + (weatherModifier(env.tempC, env.precipMm) - 1)
  return Math.round(CONDO_BASE_PRICE * (1 + extra))
}

/**
 * Evaluated once, when day 60 completes with vitals above zero.
 * Wealth needs most of the catalog seen (events can repeat in a long run, so it counts distinct ids).
 */
export function evaluateVictory(state: GameState, events: EventsFile, env: Environment): Victory | null {
  if (state.status === 'lost' || state.stats.health <= 0 || state.stats.sanity <= 0) return null
  const seen = new Set(state.processedEvents).size >= Math.ceil(events.events_catalog.length * WEALTH_SEEN_SHARE)
  if (state.stats.cash >= WEALTH_TARGET && state.turn >= WEALTH_MIN_TURN && seen) return 'wealth'
  if (state.stats.cash >= condoThreshold(env)) return 'asset'
  return 'endurance'
}

/** Six acts of ten days. Endless mode stays in act 6. */
export function actForTurn(turn: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return Math.min(ACT_COUNT, Math.max(1, Math.ceil(turn / DAYS_PER_ACT))) as 1 | 2 | 3 | 4 | 5 | 6
}

export function timeLabel(turn: number): string {
  if (turn > TOTAL_TURNS) return 'Endless'
  const week = Math.ceil(turn / 7)
  return week >= 9 ? 'Final stretch' : `Week ${week}`
}

export function newGame(char: CharacterClass, seed: number): GameState {
  return {
    characterId: char.class_id,
    seed: seed >>> 0,
    turn: 1,
    stipend: char.daily_stipend,
    stats: { ...char.starting_stats },
    inventory: [...char.starting_inventory],
    flags: {},
    processedEvents: [],
    currentEventId: null,
    lastResult: null,
    status: 'playing',
    lossReason: null,
    victory: null,
    endless: false,
    recentScenarioIds: [],
    lastShock: 0,
    notice: null,
    traits: char.passive_traits ?? null,
  }
}

/** Draws from `list`: events outside the cooldown first, then ones not seen yet. Relaxes only if the list is tiny. */
function poolFrom(list: GameEvent[], state: GameState): GameEvent[] {
  const rested = list.filter((e) => !state.recentScenarioIds.includes(e.event_id))
  const fresh = rested.filter((e) => !state.processedEvents.includes(e.event_id))
  if (fresh.length) return fresh
  if (rested.length) return rested
  const lately = state.recentScenarioIds.slice(-MIN_COOLDOWN)
  const loose = list.filter((e) => !lately.includes(e.event_id))
  return loose.length ? loose : list
}

/** Events this class can see today (unlocked, its own or general), split into shock, class-only and general. */
function visible(state: GameState, events: EventsFile) {
  const mine = events.events_catalog.filter(
    (e) => e.min_turn <= state.turn && (!e.class_ids || e.class_ids.includes(state.characterId)),
  )
  return {
    shock: mine.filter((e) => e.shock),
    own: mine.filter((e) => !e.shock && e.class_ids),
    general: mine.filter((e) => !e.shock && !e.class_ids),
  }
}

/** The pool pickEvent draws from for this day (a shock day draws only shock events). */
export function eligibleEvents(state: GameState, events: EventsFile): GameEvent[] {
  const v = visible(state, events)
  if (isShockDay(state) && v.shock.length) return poolFrom(v.shock, state)
  const own = v.own.filter((e) => !state.recentScenarioIds.includes(e.event_id))
  return [...poolFrom(v.general, state), ...own]
}

/**
 * Deterministic for a given (seed, turn, history). Class-specific scenarios take 60% of draws while
 * one is off cooldown; shock events take over every 4-5 days. Null only if nothing is unlocked.
 */
export function pickEvent(state: GameState, events: EventsFile): GameEvent | null {
  const v = visible(state, events)
  const rng = mulberry32(state.seed + state.turn * 7919)
  const roll = rng()
  const draw = (pool: GameEvent[]) => pool[Math.floor(rng() * pool.length)] ?? null
  if (isShockDay(state) && v.shock.length) return draw(poolFrom(v.shock, state))
  const own = poolFrom(v.own, state).filter((e) => !state.recentScenarioIds.includes(e.event_id))
  if (own.length && roll < CLASS_EVENT_SHARE) return draw(own)
  if (v.general.length) return draw(poolFrom(v.general, state))
  return draw(own)
}

/** Draws today's event and records it if it is a shock. */
function withEvent(state: GameState, events: EventsFile): GameState {
  const ev = pickEvent(state, events)
  return { ...state, currentEventId: ev?.event_id ?? null, lastShock: ev?.shock ? state.turn : state.lastShock }
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
  let delta: Stats
  let flip: 'win' | 'lose' | undefined
  if (choice.gamble) {
    // Seeded by run, day and scenario, so reloading the page cannot re-roll the flip.
    const roll = mulberry32((state.seed ^ Math.imul(state.turn, 2654435761) ^ hashText(event.event_id)) >>> 0)()
    flip = roll < choice.gamble.chance ? 'win' : 'lose'
    const o = flip === 'win' ? choice.gamble.win : choice.gamble.lose
    const t = char.passive_traits
    delta = {
      cash: flip === 'win' && o.cash > 0 && t?.risk_cash_multiplier ? Math.round(o.cash * t.risk_cash_multiplier) : o.cash,
      sanity: o.sanity - (flip === 'lose' ? t?.failed_risk_sanity ?? 0 : 0),
      health: o.health,
    }
  } else {
    let scale = 1
    if (event.api_dependencies.transit_delay_key) {
      scale *= char.passive_modifiers.ttc_delay_multiplier * ttcModifier(env.delayMinutes)
    }
    if (event.api_dependencies.weather_severity_key) {
      scale *= char.passive_modifiers.weather_drain_multiplier * weatherModifier(env.tempC, env.precipMm)
    }
    const hard = pressure(state.turn)
    const vitals = (v: number) => (v < 0 ? Math.round(v * scale * hard.vitals) : v)
    delta = {
      cash: m.cash_modifier < 0 ? Math.round(m.cash_modifier * hard.cash) : m.cash_modifier,
      sanity: vitals(m.sanity_modifier),
      health: vitals(m.health_modifier),
    }
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
    recentScenarioIds: [...state.recentScenarioIds, event.event_id].slice(-COOLDOWN_DAYS),
    notice: null,
    lastResult: { eventId: event.event_id, choiceKey: key, delta, ...(flip ? { flip } : {}) },
    status,
    lossReason: reason,
    flags: { ...state.flags, [`played:${event.event_id}`]: true },
  }
}

/**
 * Player-initiated "Next Day". A choice may consume more than one day (`turns_consumed`);
 * each consumed day charges the progressive drain, plus the overdraft penalty while cash < 0.
 * Passing day 60 finishes the run (unless endless mode is on).
 */
export function advanceTurn(state: GameState, events: EventsFile, env: Environment = FALLBACK_ENV): GameState {
  if (state.status !== 'playing') return state
  // A pending event must be answered first; a quiet day (no eligible event) just passes.
  if (state.currentEventId && !state.lastResult) return state

  const last = state.lastResult
  const ev = last && events.events_catalog.find((e) => e.event_id === last.eventId)
  const spent = ev && last ? ev[last.choiceKey].metrics_impact.turns_consumed : 1
  const days = state.endless ? spent : Math.min(spent, TOTAL_TURNS - state.turn + 1)

  let stats = state.stats
  const notes: string[] = []
  for (let d = 0; d < days; d++) {
    const day = state.turn + d
    const floor0 = day <= ACT1_LAST_TURN ? 1 : 0
    // Daily stipend is paid as each day completes, before rent and the overdraft check.
    if (state.stipend > 0) stats = { ...stats, cash: Math.round((stats.cash + state.stipend) * 100) / 100 }
    const bonus = state.traits?.bonus_days
    if (bonus && bonus.weekdays.includes(day % 7)) {
      stats = {
        cash: stats.cash + bonus.cash,
        sanity: clamp(stats.sanity + bonus.sanity, floor0, STAT_MAX),
        health: clamp(stats.health + bonus.health, floor0, STAT_MAX),
      }
      notes.push(`Payday from the door: +$${bonus.cash}, ${bonus.sanity} sanity, ${bonus.health} health`)
    }
    const rent = rentForDay(day)
    if (rent > 0) {
      stats = { ...stats, cash: Math.round((stats.cash - rent) * 100) / 100 }
      notes.push(`Rent day: -$${rent}`)
    }
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
  const notice = notes.length ? notes.join(' · ') : null
  const base: GameState = { ...state, stats, lastResult: null, currentEventId: null, notice }
  if (!state.endless && state.turn + spent > TOTAL_TURNS) {
    const done: GameState = { ...base, turn: TOTAL_TURNS, status: 'finished' }
    return { ...done, victory: evaluateVictory(done, events, env) }
  }

  return withEvent({ ...base, turn: state.turn + spent }, events)
}

/** Starts the first event of a fresh game. */
export function beginGame(state: GameState, events: EventsFile): GameState {
  return withEvent(state, events)
}

/** "Keep Surviving": continues a finished run past day 60 with no end date. */
export function continueEndless(state: GameState, events: EventsFile): GameState {
  if (state.status !== 'finished') return state
  return withEvent({ ...state, status: 'playing', endless: true, victory: null, turn: TOTAL_TURNS + 1, lastResult: null, notice: null }, events)
}
