/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from 'vitest'
import { FALLBACK_ENV } from './environment'
import { fetchEnvironment, parseTransit, parseWeather } from './live'
import { deriveTransit } from '../../server/transit'

const NOW = Date.parse('2026-10-27T12:00:00Z')
const obs = (props: object) => ({ features: [{ properties: { 'date_tm-value': '2026-10-27T11:55:00.000Z', ...props } }] })
const json = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response)

function mem(): Storage {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: () => null, get length() { return m.size } }
}

const goodFetch = ((url: string) =>
  url.includes('weather.gc.ca') ? json(obs({ air_temp: -10, pcpn_amt_pst1hr: 0 })) : json({ delay_minutes: 30 })) as any

describe('parsers', () => {
  it('reads temp and precipitation, skipping null/stale observations', () => {
    expect(parseWeather(obs({ air_temp: 5.2, pcpn_amt_pst1hr: 7 }), NOW)).toEqual({ tempC: 5.2, precipMm: 7 })
    expect(parseWeather({ features: [{ properties: { 'date_tm-value': '2026-10-27T11:55:00Z', air_temp: null } }, ...obs({ air_temp: 1 }).features] }, NOW)?.tempC).toBe(1)
    expect(parseWeather(obs({ air_temp: 5 }), NOW + 4 * 3600_000)).toBeNull()
    expect(parseWeather({ nope: 1 }, NOW)).toBeNull()
  })
  it('validates transit payload', () => {
    expect(parseTransit({ delay_minutes: 20 })).toEqual({ delayMinutes: 20 })
    expect(parseTransit({ delay_minutes: 'x' })).toBeNull()
    expect(parseTransit({ delay_minutes: -1 })).toBeNull()
    expect(parseTransit(null)).toBeNull()
  })
})

describe('fetchEnvironment', () => {
  it('returns live values and caches them', async () => {
    const st = mem()
    const env = await fetchEnvironment({ fetchImpl: goodFetch, storage: st, now: NOW })
    expect(env).toMatchObject({ tempC: -10, delayMinutes: 30, weatherSource: 'live', transitSource: 'live' })
    const again = await fetchEnvironment({ fetchImpl: vi.fn(() => { throw new Error('offline') }) as any, storage: st, now: NOW + 60_000 })
    expect(again).toMatchObject({ tempC: -10, delayMinutes: 30, weatherSource: 'cached', transitSource: 'cached' })
  })
  it('falls back on network error, HTTP error and bad payload without throwing', async () => {
    const down = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as any
    expect(await fetchEnvironment({ fetchImpl: down, storage: mem(), now: NOW })).toMatchObject({ ...FALLBACK_ENV })
    const http = (() => json({}, false, 503)) as any
    expect((await fetchEnvironment({ fetchImpl: http, storage: mem(), now: NOW })).weatherSource).toBe('fallback')
    const junk = (() => json({ hello: 'world' })) as any
    expect((await fetchEnvironment({ fetchImpl: junk, storage: mem(), now: NOW })).transitSource).toBe('fallback')
  })
  it('aborts a slow request at the timeout and still resolves', async () => {
    const hang = ((_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as any
    const t0 = Date.now()
    const env = await fetchEnvironment({ fetchImpl: hang, storage: mem(), now: NOW, timeoutMs: 50 })
    expect(Date.now() - t0).toBeLessThan(500)
    expect(env.weatherSource).toBe('fallback')
  })
  it('uses stale cache within an hour but not beyond', async () => {
    const st = mem()
    await fetchEnvironment({ fetchImpl: goodFetch, storage: st, now: NOW })
    const down = (() => Promise.reject(new Error('x'))) as any
    expect((await fetchEnvironment({ fetchImpl: down, storage: st, now: NOW + 30 * 60_000 })).weatherSource).toBe('cached')
    expect((await fetchEnvironment({ fetchImpl: down, storage: st, now: NOW + 2 * 3600_000 })).weatherSource).toBe('fallback')
  })
  it('works with unavailable storage', async () => {
    const boom = { getItem() { throw new Error('x') }, setItem() { throw new Error('x') } } as unknown as Storage
    expect((await fetchEnvironment({ fetchImpl: goodFetch, storage: boom, now: NOW })).transitSource).toBe('live')
  })
})

describe('transit proxy mapping', () => {
  const alert = (o: object) => ({ routeType: 'Subway', alertType: 'Unplanned', effect: 'SIGNIFICANT_DELAYS', severity: 'Minor', activePeriod: { start: '2026-10-01T00:00:00Z', end: '0001-01-01T00:00:00Z' }, ...o })
  it('maps active alerts to minutes', () => {
    expect(deriveTransit({ routes: [] }, NOW)?.delay_minutes).toBe(0)
    expect(deriveTransit({ routes: [alert({})] }, NOW)?.delay_minutes).toBe(10)
    expect(deriveTransit({ routes: [alert({ severity: 'Critical' }), alert({}), alert({})] }, NOW)?.delay_minutes).toBe(40)
  })
  it('ignores inactive, other modes and caps at 45', () => {
    expect(deriveTransit({ routes: [alert({ routeType: 'Bus' }), alert({ alertType: 'Planned' }), alert({ activePeriod: { start: '2026-12-01T00:00:00Z', end: '0001-01-01T00:00:00Z' } }), alert({ activePeriod: { start: '2026-10-01T00:00:00Z', end: '2026-10-02T00:00:00Z' } })] }, NOW)?.delay_minutes).toBe(0)
    expect(deriveTransit({ routes: Array.from({ length: 20 }, () => alert({ severity: 'Critical' })) }, NOW)?.delay_minutes).toBe(45)
    expect(deriveTransit({ nope: 1 }, NOW)).toBeNull()
  })
})
