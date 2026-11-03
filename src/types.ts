export interface Stats {
  cash: number
  sanity: number
  health: number
}

export interface PassiveModifiers {
  ttc_delay_multiplier: number
  weather_drain_multiplier: number
}

export interface CharacterClass {
  class_id: string
  display_name: string
  starting_stats: Stats
  passive_modifiers: PassiveModifiers
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

export interface Choice {
  action_text: string
  metrics_impact: MetricsImpact
  required_inventory_item: string | null
}

export interface ApiDependencies {
  weather_severity_key?: string
  transit_delay_key?: string
}

export interface GameEvent {
  event_id: string
  act_tier: 1 | 2 | 3
  min_turn: number
  max_turn: number
  /** Optional place name shown in the header while this event is active. */
  location?: string
  /** Optional illustration URL (e.g. /art/blizzard.png). Replaces the drawn scene. */
  image?: string
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
}
