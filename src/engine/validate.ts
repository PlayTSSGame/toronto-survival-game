import type { CharactersFile, Choice, EventsFile, GameEvent, Stats } from '../types'

type Obj = Record<string, unknown>

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function fail(path: string, msg: string): never {
  throw new Error(`${path}: ${msg}`)
}

function str(o: Obj, k: string, path: string): string {
  if (typeof o[k] !== 'string' || o[k] === '') fail(`${path}.${k}`, 'expected non-empty string')
  return o[k] as string
}

function num(o: Obj, k: string, path: string): number {
  if (!isNum(o[k])) fail(`${path}.${k}`, 'expected finite number')
  return o[k] as number
}

function obj(o: Obj, k: string, path: string): Obj {
  if (!isObj(o[k])) fail(`${path}.${k}`, 'expected object')
  return o[k] as Obj
}

function arr(o: Obj, k: string, path: string): unknown[] {
  if (!Array.isArray(o[k])) fail(`${path}.${k}`, 'expected array')
  return o[k] as unknown[]
}

export function parseStats(o: Obj, path: string): Stats {
  return { cash: num(o, 'cash', path), sanity: num(o, 'sanity', path), health: num(o, 'health', path) }
}

export function parseCharacters(raw: unknown): CharactersFile {
  if (!isObj(raw)) fail('characters', 'expected object')
  const classes = arr(raw, 'classes', 'characters').map((c, i) => {
    const p = `characters.classes[${i}]`
    if (!isObj(c)) fail(p, 'expected object')
    const pm = obj(c, 'passive_modifiers', p)
    // Delivered schema keeps the inventory inside starting_stats; a top-level starting_inventory is also accepted.
    const ss = obj(c, 'starting_stats', p)
    const inv = c.starting_inventory ?? ss.inventory ?? []
    if (!Array.isArray(inv) || inv.some((x) => typeof x !== 'string')) fail(`${p}.starting_stats.inventory`, 'expected string[]')
    return {
      class_id: str(c, 'class_id', p),
      display_name: str(c, 'display_name', p),
      starting_stats: parseStats(ss, `${p}.starting_stats`),
      passive_modifiers: {
        // Delivered name is ttc_delay_impact; ttc_delay_multiplier is the legacy alias.
        ttc_delay_multiplier: num(pm, pm.ttc_delay_impact !== undefined ? 'ttc_delay_impact' : 'ttc_delay_multiplier', `${p}.passive_modifiers`),
        weather_drain_multiplier: num(pm, 'weather_drain_multiplier', `${p}.passive_modifiers`),
      },
      starting_inventory: inv as string[],
      daily_stipend: c.daily_stipend === undefined ? 0 : num(c, 'daily_stipend', p),
      home_location: typeof c.home_location === 'string' && c.home_location ? c.home_location : 'Toronto',
      description: str(c, 'description', p),
    }
  })
  if (classes.length === 0) fail('characters.classes', 'must not be empty')
  return {
    project_name: str(raw, 'project_name', 'characters'),
    data_type: str(raw, 'data_type', 'characters'),
    classes,
  }
}

function parseChoice(c: unknown, path: string): Choice {
  if (!isObj(c)) fail(path, 'expected object')
  const m = obj(c, 'metrics_impact', path)
  const mp = `${path}.metrics_impact`
  const turns = num(m, 'turns_consumed', mp)
  if (!Number.isInteger(turns) || turns < 1) fail(`${mp}.turns_consumed`, 'expected integer >= 1')
  const req = c.required_inventory_item ?? null
  if (req !== null && typeof req !== 'string') fail(`${path}.required_inventory_item`, 'expected string or null')
  return {
    action_text: str(c, 'action_text', path),
    metrics_impact: {
      cash_modifier: num(m, 'cash_modifier', mp),
      sanity_modifier: num(m, 'sanity_modifier', mp),
      health_modifier: num(m, 'health_modifier', mp),
      turns_consumed: turns,
    },
    required_inventory_item: req,
  }
}

function parseEvent(e: unknown, i: number): GameEvent {
  const p = `events_catalog[${i}]`
  if (!isObj(e)) fail(p, 'expected object')
  const tier = num(e, 'act_tier', p)
  if (tier !== 1 && tier !== 2 && tier !== 3) fail(`${p}.act_tier`, 'expected 1, 2 or 3')
  const min = num(e, 'min_turn', p)
  const max = num(e, 'max_turn', p)
  if (min < 1 || max < min) fail(p, 'invalid min_turn/max_turn range')
  const deps = e.api_dependencies ?? {}
  if (!isObj(deps)) fail(`${p}.api_dependencies`, 'expected object')
  for (const k of ['weather_severity_key', 'transit_delay_key']) {
    if (deps[k] !== undefined && typeof deps[k] !== 'string') fail(`${p}.api_dependencies.${k}`, 'expected string')
  }
  return {
    event_id: str(e, 'event_id', p),
    act_tier: tier,
    min_turn: min,
    max_turn: max,
    image: typeof e.image === 'string' && e.image ? e.image : undefined,
    location: typeof e.location === 'string' && e.location ? e.location : undefined,
    scenario_text: str(e, 'scenario_text', p),
    api_dependencies: deps,
    choice_a: parseChoice(e.choice_a, `${p}.choice_a`),
    choice_b: parseChoice(e.choice_b, `${p}.choice_b`),
  }
}

export function parseEvents(raw: unknown): EventsFile {
  if (!isObj(raw)) fail('events', 'expected object')
  const events = arr(raw, 'events_catalog', 'events').map(parseEvent)
  const ids = new Set<string>()
  for (const e of events) {
    if (ids.has(e.event_id)) fail('events_catalog', `duplicate event_id ${e.event_id}`)
    ids.add(e.event_id)
  }
  return {
    project_name: str(raw, 'project_name', 'events'),
    build_version: str(raw, 'build_version', 'events'),
    events_catalog: events,
  }
}
