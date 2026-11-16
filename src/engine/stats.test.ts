import { describe, expect, it } from 'vitest'
import { applyHit, buildReport, emptyBucket, handleStats, handleTrack, memoryStore, parseHit, recordHit, sanitizeRef } from '../../server/stats'
import { cleanRef } from '../analytics'

const post = (body: unknown) => new Request('http://x.test/api/track', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
const NOW = new Date('2026-11-16T18:00:00Z')

describe('referral codes', () => {
  it('accepts short lowercase codes and rejects everything else', () => {
    expect(sanitizeRef('UofT-2026')).toBe('uoft-2026')
    expect(sanitizeRef(' tmu_creator ')).toBe('tmu_creator')
    expect(sanitizeRef('a'.repeat(33))).toBeNull()
    expect(sanitizeRef('<script>')).toBeNull()
    expect(sanitizeRef('has space')).toBeNull()
    expect(sanitizeRef(5)).toBeNull()
    expect(cleanRef('York_U')).toBe('york_u')
    expect(cleanRef('x/y')).toBeNull()
  })
})

describe('hit parsing', () => {
  it('only lets the known events and shapes through', () => {
    expect(parseHit({ event: 'visit', ref: 'tmu' })).toEqual({ event: 'visit', ref: 'tmu' })
    expect(parseHit({ event: 'start', ref: null, cls: 'CLASS_007_NIGHTLIFE_PROMOTER' })?.cls).toBe('CLASS_007_NIGHTLIFE_PROMOTER')
    expect(parseHit({ event: 'start', cls: 'drop table' })?.cls).toBeUndefined()
    expect(parseHit({ event: 'finish', kind: 'lost' })?.kind).toBe('lost')
    expect(parseHit({ event: 'finish' })).toBeNull() // finish needs a result
    expect(parseHit({ event: 'finish', kind: 'hacked' })).toBeNull()
    expect(parseHit({ event: 'delete' })).toBeNull()
    expect(parseHit('x')).toBeNull()
    expect(parseHit([])).toBeNull()
  })
})

describe('counters', () => {
  it('counts per referral code, class and outcome', () => {
    let b = emptyBucket()
    b = applyHit(b, { event: 'visit', ref: 'tmu' })
    b = applyHit(b, { event: 'visit', ref: null })
    b = applyHit(b, { event: 'start', ref: 'tmu', cls: 'CLASS_001_COMMUTER' })
    b = applyHit(b, { event: 'finish', ref: 'tmu', kind: 'endurance' })
    b = applyHit(b, { event: 'finish', ref: 'tmu', kind: 'lost' })
    b = applyHit(b, { event: 'sponsor_click', ref: null, name: 'Acme' })
    expect(b.totals).toMatchObject({ visit: 2, start: 1, finish: 2, win: 1, loss: 1, sponsor_click: 1 })
    expect(b.refs.tmu).toMatchObject({ visit: 1, start: 1, finish: 2, win: 1, loss: 1 })
    expect(b.refs.direct.visit).toBe(1)
    expect(b.classes).toEqual({ CLASS_001_COMMUTER: 1 })
    expect(b.outcomes).toEqual({ endurance: 1, lost: 1 })
    expect(b.sponsors).toEqual({ Acme: 1 })
  })
  it('does not lose counts when two players write at once', async () => {
    const store = memoryStore()
    await Promise.all(Array.from({ length: 25 }, () => recordHit(store, { event: 'visit', ref: 'tmu' }, NOW)))
    const r = await buildReport(store, 7, NOW)
    expect(r.totals.visit).toBe(25)
    expect(r.refs.tmu.visit).toBe(25)
  })
})

describe('endpoints', () => {
  it('track: stores valid hits, ignores junk, never errors', async () => {
    const store = memoryStore()
    expect((await handleTrack(post({ event: 'visit', ref: 'tmu' }), store, NOW)).status).toBe(204)
    expect((await handleTrack(post('{not json'), store, NOW)).status).toBe(204)
    expect((await handleTrack(post({ event: 'nope' }), store, NOW)).status).toBe(204)
    expect((await handleTrack(post('x'.repeat(2000)), store, NOW)).status).toBe(204)
    expect((await handleTrack(new Request('http://x.test/api/track'), store, NOW)).status).toBe(405)
    expect((await buildReport(store, 1, NOW)).totals.visit).toBe(1)
  })
  it('stats: asks for a password, then keeps you logged in with a cookie', async () => {
    const store = memoryStore()
    await recordHit(store, { event: 'visit', ref: 'tmu' }, NOW)
    const req = (method: string, init: { cookie?: string; password?: string; q?: string } = {}) => {
      const headers: Record<string, string> = {}
      if (init.cookie) headers.cookie = init.cookie
      const body = init.password !== undefined ? new URLSearchParams({ password: init.password }) : undefined
      return new Request(`https://x.test/stats${init.q ?? ''}`, { method, headers, body })
    }
    const go = (r: Request, pw: string | null = 's3cret') => handleStats(r, store, pw ?? undefined, NOW, 0)

    expect((await go(req('GET'), null)).status).toBe(503) // no password configured
    const login = await go(req('GET'))
    expect(login.status).toBe(401)
    const form = await login.text()
    expect(form).toContain('type="password"')
    expect(form).not.toContain('username')
    expect(form).not.toContain('tmu') // no numbers before logging in

    const bad = await go(req('POST', { password: 'nope' }))
    expect(bad.status).toBe(401)
    expect(await bad.text()).toContain('Wrong password')
    expect((await go(req('POST', { password: '' }))).status).toBe(401)

    const good = await go(req('POST', { password: 's3cret' }))
    expect(good.status).toBe(303)
    const cookie = good.headers.get('set-cookie')!
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Strict/)
    expect(cookie).toMatch(/Secure/)
    expect(cookie).not.toContain('s3cret') // the password itself is never stored in the cookie
    const jar = cookie.split(';')[0]

    const page = await go(req('GET', { cookie: jar }))
    expect(page.status).toBe(200)
    const html = await page.text()
    expect(html).toContain('Campus referrals')
    expect(html).toContain('tmu')
    const json = await (await go(req('GET', { cookie: jar, q: '?format=json&days=7' }))).json() as { totals: { visit: number }; days: number }
    expect(json.totals.visit).toBe(1)
    expect(json.days).toBe(7)

    expect((await go(req('GET', { cookie: 'tss_stats=forged' }))).status).toBe(401)
    expect((await go(req('GET', { cookie: jar }), 'a-new-password')).status).toBe(401) // changing the password logs everyone out
    expect((await go(req('PUT', { cookie: jar }))).status).toBe(405)
    const out = await go(req('GET', { cookie: jar, q: '?logout=1' }))
    expect(out.status).toBe(303)
    expect(out.headers.get('set-cookie')).toMatch(/Max-Age=0/)
  })
  it('aggregates across days and clamps the range', async () => {
    const store = memoryStore()
    await recordHit(store, { event: 'visit', ref: 'a' }, NOW)
    await recordHit(store, { event: 'visit', ref: 'a' }, new Date(NOW.getTime() - 2 * 86_400_000))
    expect((await buildReport(store, 1, NOW)).totals.visit).toBe(1)
    expect((await buildReport(store, 7, NOW)).totals.visit).toBe(2)
    expect((await buildReport(store, 9999, NOW)).days).toBe(60)
  })
})
