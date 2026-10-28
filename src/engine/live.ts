import type { Environment, FeedSource } from '../types'
import { FALLBACK_ENV } from './environment'

/** Hard per-request limit from the spec. */
export const REQUEST_TIMEOUT_MS = 1200
const FRESH_MS = 5 * 60_000
const STALE_OK_MS = 60 * 60_000
const OBS_MAX_AGE_MS = 3 * 60 * 60_000
const CACHE_KEY = 'tss.env.v1'

/** Environment Canada MSC GeoMet, Toronto City station. Sends CORS `*`. */
export const WEATHER_URL =
  'https://api.weather.gc.ca/collections/swob-realtime/items?f=json&limit=6&sortby=-date_tm-value&stn_nam-value=TORONTO%20CITY'
/** Same-origin serverless proxy; see server/transit.ts. */
export const TRANSIT_URL = import.meta.env.VITE_TRANSIT_URL || '/api/transit'

export interface Weather { tempC: number; precipMm: number }
export interface Transit { delayMinutes: number }
interface Cached<T> { at: number; value: T }
interface CacheShape { weather?: Cached<Weather>; transit?: Cached<Transit> }

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const debug = (...a: unknown[]) => { if (import.meta.env.DEV) console.debug('[tss/env]', ...a) }

/** Rejects (aborts) after `ms`, whatever the fetch implementation does. */
export async function fetchJson(url: string, ms: number, fetchImpl: typeof fetch): Promise<unknown> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), ms)
  try {
    const res = await Promise.race([
      fetchImpl(url, { signal: ctl.signal, headers: { accept: 'application/json' } }),
      new Promise<never>((_, rej) => ctl.signal.addEventListener('abort', () => rej(new Error('timeout')))),
    ])
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Newest recent observation with a usable temperature. */
export function parseWeather(raw: unknown, now = Date.now()): Weather | null {
  const feats = (raw as { features?: unknown })?.features
  if (!Array.isArray(feats)) return null
  for (const f of feats) {
    const p = (f as { properties?: Record<string, unknown> })?.properties
    if (!p) continue
    const t = num(p.air_temp)
    const when = typeof p.date_tm_value === 'string' ? p.date_tm_value : (p['date_tm-value'] as unknown)
    const ts = typeof when === 'string' ? Date.parse(when) : NaN
    if (t === null || !Number.isFinite(ts) || now - ts > OBS_MAX_AGE_MS) continue
    const precip = num(p.pcpn_amt_pst1hr) ?? num(p.rnfl_amt_pst1hr) ?? 0
    return { tempC: t, precipMm: Math.max(0, precip) }
  }
  return null
}

export function parseTransit(raw: unknown): Transit | null {
  const d = num((raw as { delay_minutes?: unknown })?.delay_minutes)
  return d === null || d < 0 || d > 600 ? null : { delayMinutes: d }
}

export function weatherLabel(w: Weather | null, src: FeedSource): string {
  if (!w) return 'Weather: offline'
  const kind = w.precipMm > 5 ? (w.tempC < 0 ? 'Snow' : 'Heavy rain') : w.tempC < 0 ? 'Freezing' : 'Clear'
  return `${Math.round(w.tempC)}°C ${kind}${src === 'cached' ? ' (saved)' : ''}`
}

export function transitLabel(t: Transit | null, src: FeedSource): string {
  if (!t) return 'TTC: offline'
  const base = t.delayMinutes > 15 ? `TTC delays ~${t.delayMinutes} min` : 'TTC running'
  return base + (src === 'cached' ? ' (saved)' : '')
}

function readCache(storage: Storage | undefined): CacheShape {
  try { return storage ? (JSON.parse(storage.getItem(CACHE_KEY) ?? '{}') as CacheShape) : {} } catch { return {} }
}

function writeCache(storage: Storage | undefined, c: CacheShape) {
  try { storage?.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* quota/private mode */ }
}

async function resolveFeed<T>(
  cached: Cached<T> | undefined,
  now: number,
  load: () => Promise<T | null>,
  name: string,
): Promise<{ value: T | null; source: FeedSource; entry?: Cached<T> }> {
  if (cached && now - cached.at < FRESH_MS) return { value: cached.value, source: 'cached', entry: cached }
  try {
    const v = await load()
    if (v) return { value: v, source: 'live', entry: { at: now, value: v } }
    debug(name, 'invalid payload')
  } catch (e) {
    debug(name, 'failed', e instanceof Error ? e.message : e)
  }
  if (cached && now - cached.at < STALE_OK_MS) return { value: cached.value, source: 'cached', entry: cached }
  return { value: null, source: 'fallback' }
}

export interface EnvOptions {
  fetchImpl?: typeof fetch
  storage?: Storage
  now?: number
  timeoutMs?: number
}

/** Never throws and never takes longer than ~timeoutMs; falls back per feed. */
export async function fetchEnvironment(opts: EnvOptions = {}): Promise<Environment> {
  const fetchImpl = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const storage = opts.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  const now = opts.now ?? Date.now()
  const ms = opts.timeoutMs ?? REQUEST_TIMEOUT_MS
  const cache = readCache(storage)

  const [w, t] = await Promise.all([
    resolveFeed(cache.weather, now, async () => parseWeather(await fetchJson(WEATHER_URL, ms, fetchImpl), now), 'weather'),
    resolveFeed(cache.transit, now, async () => parseTransit(await fetchJson(TRANSIT_URL, ms, fetchImpl)), 'transit'),
  ])
  writeCache(storage, { weather: w.entry, transit: t.entry })

  return {
    delayMinutes: t.value?.delayMinutes ?? FALLBACK_ENV.delayMinutes,
    tempC: w.value?.tempC ?? FALLBACK_ENV.tempC,
    precipMm: w.value?.precipMm ?? FALLBACK_ENV.precipMm,
    weatherLabel: weatherLabel(w.value, w.source),
    transitLabel: transitLabel(t.value, t.source),
    weatherSource: w.source,
    transitSource: t.source,
  }
}
