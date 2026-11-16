export interface Stats {
  cash: number
  sanity: number
  health: number
}

export interface PassiveModifiers {
  ttc_delay_multiplier: number
  weather_drain_multiplier: number
}

/** Per-class rules that go beyond the passive multipliers. */
export interface PassiveTraits {
  /** Paid on the days whose (turn % 7) is in `weekdays`, e.g. [6, 0] for every 6th and 7th day. */
  bonus_days?: { weekdays: number[]; cash: number; sanity: number; health: number }
  /** Multiplies cash won on a lucky coin-flip choice. */
  risk_cash_multiplier?: number
  /** Extra sanity lost when a coin-flip choice goes wrong. */
  failed_risk_sanity?: number
}

export interface CharacterClass {
  class_id: string
  display_name: string
  starting_stats: Stats
  passive_modifiers: PassiveModifiers
  passive_traits?: PassiveTraits
  starting_inventory: string[]
  /** Flat cash earned on every completed day (client's daily stipend rule). 0 if not supplied. */
  daily_stipend: number
  /** Where the character begins; shown in the header until an event sets another location. */
  home_location: string
  description: string
}

export interface CharactersFile {
  project_name: string
  data_type: string
  classes: CharacterClass[]
}

export interface MetricsImpact {
  cash_modifier: number
  sanity_modifier: number
  health_modifier: number
  turns_consumed: number
}

/** One side of a coin flip. */
export interface Outcome {
  cash: number
  sanity: number
  health: number
}

/** A high-stakes choice: a seeded coin flip between a jackpot and a setback. */
export interface Gamble {
  chance: number
  win: Outcome
  lose: Outcome
}

export interface Choice {
  action_text: string
  metrics_impact: MetricsImpact
  required_inventory_item: string | null
  /** When set, the outcome is the coin flip below and metrics_impact only supplies turns_consumed. */
  gamble?: Gamble
}

export interface ApiDependencies {
  weather_severity_key?: string
  transit_delay_key?: string
}

export interface GameEvent {
  event_id: string
  act_tier: 1 | 2 | 3 | 4 | 5 | 6
  min_turn: number
  max_turn: number
  /** Optional place name shown in the header while this event is active. */
  location?: string
  /** Optional illustration URL (e.g. /art/blizzard.png). Replaces the drawn scene. */
  image?: string
  /** Only these classes can draw this event. Omitted means every class. */
  class_ids?: string[]
  /** Curveball that appears every 4-5 days on its own schedule, with a countdown. */
  shock?: boolean
  /** Choice taken automatically when the shock countdown runs out. Defaults to choice_b. */
  timeout_choice?: 'choice_a' | 'choice_b'
  scenario_text: string
  api_dependencies: ApiDependencies
  choice_a: Choice
  choice_b: Choice
}

export interface EventsFile {
  project_name: string
  build_version: string
  events_catalog: GameEvent[]
}

export type FeedSource = 'live' | 'cached' | 'fallback'

/** Normalized weather and TTC inputs, with a label and source (live, cached or fallback) per feed. */
export interface Environment {
  /** Raw normalized readings; modifiers are derived in engine/environment.ts. */
  delayMinutes: number
  tempC: number
  precipMm: number
  weatherLabel: string
  transitLabel: string
  weatherSource: FeedSource
  transitSource: FeedSource
}

export type Victory = 'wealth' | 'asset' | 'endurance'

export type GameStatus = 'playing' | 'lost' | 'finished'

export interface LastResult {
  eventId: string
  choiceKey: 'choice_a' | 'choice_b'
  delta: Stats
  /** Set for coin-flip choices: how the flip landed. */
  flip?: 'win' | 'lose'
}

export interface GameState {
  characterId: string
  seed: number
  turn: number
  /** Cash added on every completed day; copied from the character at game start. */
  stipend: number
  stats: Stats
  inventory: string[]
  flags: Record<string, boolean>
  processedEvents: string[]
  currentEventId: string | null
  /** Set after a choice is made, until the player advances the turn. */
  lastResult: LastResult | null
  status: GameStatus
  lossReason: string | null
  /** Highest victory achieved when the run finishes (wealth > asset > endurance). */
  victory: Victory | null
  /** True once the player chose "Keep Surviving" after day 60: no day cap, events recycle. */
  endless: boolean
  /** The last 20 scenario ids played (oldest first): none of them can come back within 20 days. */
  recentScenarioIds: string[]
  /** Day the last shock event was drawn (0 = none yet). Drives the 4-5 day shock schedule. */
  lastShock: number
  /** One-line message about what happened overnight (rent, promoter payday), shown on the next day. */
  notice: string | null
  /** Copied from the character at game start (the engine's day-by-day rules need it without the class). */
  traits: PassiveTraits | null
}
