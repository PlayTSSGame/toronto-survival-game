/**
 * Privacy-friendly play statistics. The game sends one tiny anonymous event per milestone
 * (visit, run start, run finish, endless mode, sponsor click) with the visitor's ?ref= campus code.
 * No cookies for players, no IP addresses and no personal data are stored, only daily counters.
 *
 * Storage is behind a small interface so the same logic runs on Netlify Blobs in production,
 * in memory under `npm run dev` / `npm run preview`, and in the tests.
 */
import { loginPage, renderReport } from './statsPage.ts'

export const METRICS = ['visit', 'start', 'finish', 'win', 'loss', 'endless', 'sponsor_click'] as const
export type Metric = (typeof METRICS)[number]
type Counts = Record<Metric, number>

export interface Bucket {
  totals: Counts
  refs: Record<string, Counts>
  classes: Record<string, number>
  outcomes: Record<string, number>
  sponsors: Record<string, number>
}

export interface BucketStore {
  read(key: string): Promise<{ data: Bucket | null; etag?: string }>
  /** Returns false if another write got there first (so the caller re-reads and retries). */
  write(key: string, data: Bucket, etag?: string): Promise<boolean>
}

export type TrackEvent = 'visit' | 'start' | 'finish' | 'endless' | 'sponsor_click'
const EVENTS = new Set<string>(['visit', 'start', 'finish', 'endless', 'sponsor_click'])
const OUTCOMES = new Set(['endurance', 'asset', 'wealth', 'lost'])

export interface Hit {
  event: TrackEvent
  ref: string | null
  cls?: string
  kind?: string
  name?: string
}

const zero = (): Counts => Object.fromEntries(METRICS.map((m) => [m, 0])) as Counts
export const emptyBucket = (): Bucket => ({ totals: zero(), refs: {}, classes: {}, outcomes: {}, sponsors: {} })

/** A campus referral code: lowercase letters, digits, dash, underscore, at most 32 characters. */
export function sanitizeRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  return /^[a-z0-9_-]{1,32}$/.test(v) ? v : null
}

/** Accepts only the shapes the game sends. Anything else is dropped. */
export function parseHit(body: unknown): Hit | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  if (typeof b.event !== 'string' || !EVENTS.has(b.event)) return null
  const hit: Hit = { event: b.event as TrackEvent, ref: sanitizeRef(b.ref) }
  if (typeof b.cls === 'string' && /^CLASS_\d{3}_[A-Z_]{1,40}$/.test(b.cls)) hit.cls = b.cls
  if (typeof b.kind === 'string' && OUTCOMES.has(b.kind)) hit.kind = b.kind
  if (typeof b.name === 'string' && /^[\w .&'-]{1,40}$/.test(b.name)) hit.name = b.name
  if (hit.event === 'finish' && !hit.kind) return null
  return hit
}

const bump = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1 }

export function applyHit(bucket: Bucket, hit: Hit): Bucket {
  const b: Bucket = structuredClone(bucket)
  const metrics: Metric[] =
    hit.event === 'finish' ? ['finish', hit.kind === 'lost' ? 'loss' : 'win'] : [hit.event]
  const ref = hit.ref ?? 'direct'
  b.refs[ref] ??= zero()
  for (const m of metrics) { b.totals[m]++; b.refs[ref][m]++ }
  if (hit.event === 'start' && hit.cls) bump(b.classes, hit.cls)
  if (hit.event === 'finish' && hit.kind) bump(b.outcomes, hit.kind)
  if (hit.event === 'sponsor_click' && hit.name) bump(b.sponsors, hit.name)
  return b
}

export const dayKey = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(d)

/** A day's counters are spread over a few shards so a burst of players doesn't fight over one record. */
const SHARDS = 4
const shardKeys = (d: Date) => Array.from({ length: SHARDS }, (_, i) => `d:${dayKey(d)}:${i}`)

function mergeBuckets(a: Bucket, b: Bucket): Bucket {
  const out = structuredClone(a)
  for (const m of METRICS) out.totals[m] += b.totals[m] ?? 0
  for (const [r, c] of Object.entries(b.refs)) {
    out.refs[r] ??= zero()
    for (const m of METRICS) out.refs[r][m] += c[m] ?? 0
  }
  for (const k of ['classes', 'outcomes', 'sponsors'] as const) {
    for (const [name, v] of Object.entries(b[k])) out[k][name] = (out[k][name] ?? 0) + v
  }
  return out
}

/** Records one anonymous hit. Retries (with a different shard) when another player wrote at the same moment. */
export async function recordHit(store: BucketStore, hit: Hit, now = new Date()): Promise<boolean> {
  const keys = shardKeys(now)
  for (let i = 0; i < 12; i++) {
    const key = keys[Math.floor(Math.random() * SHARDS)]
    const { data, etag } = await store.read(key)
    if (await store.write(key, applyHit(data ?? emptyBucket(), hit), data ? etag : undefined)) return true
  }
  return false
}

export async function handleTrack(req: Request, store: BucketStore, now = new Date()): Promise<Response> {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })
  try {
    const text = await req.text()
    if (text.length > 1024) return new Response(null, { status: 204 })
    const hit = parseHit(JSON.parse(text))
    if (hit) await recordHit(store, hit, now)
  } catch { /* analytics must never break the game */ }
  return new Response(null, { status: 204 })
}

const MAX_DAYS = 60

export interface Report {
  days: number
  from: string
  to: string
  totals: Counts
  today: Counts
  refs: Record<string, Counts>
  classes: Record<string, number>
  outcomes: Record<string, number>
  sponsors: Record<string, number>
  daily: { day: string; counts: Counts }[]
}

function addCounts(a: Counts, b: Counts): Counts {
  const out = zero()
  for (const m of METRICS) out[m] = (a[m] ?? 0) + (b[m] ?? 0)
  return out
}

export async function buildReport(store: BucketStore, days: number, now = new Date()): Promise<Report> {
  const n = Math.min(MAX_DAYS, Math.max(1, Math.floor(days) || 30))
  const keys = Array.from({ length: n }, (_, i) => new Date(now.getTime() - i * 86_400_000))
  const report: Report = {
    days: n, from: dayKey(keys[n - 1]), to: dayKey(keys[0]), totals: zero(), today: zero(),
    refs: {}, classes: {}, outcomes: {}, sponsors: {}, daily: [],
  }
  const buckets = await Promise.all(keys.map(async (d) => {
    const parts = (await Promise.all(shardKeys(d).map((k) => store.read(k)))).map((r) => r.data).filter((x): x is Bucket => !!x)
    return { day: dayKey(d), data: parts.length ? parts.reduce(mergeBuckets) : null }
  }))
  for (const { day, data } of buckets) {
    if (!data) continue
    report.totals = addCounts(report.totals, data.totals)
    if (day === report.to) report.today = data.totals
    for (const [r, c] of Object.entries(data.refs)) report.refs[r] = addCounts(report.refs[r] ?? zero(), c)
    for (const [k, v] of Object.entries(data.classes)) report.classes[k] = (report.classes[k] ?? 0) + v
    for (const [k, v] of Object.entries(data.outcomes)) report.outcomes[k] = (report.outcomes[k] ?? 0) + v
    for (const [k, v] of Object.entries(data.sponsors)) report.sponsors[k] = (report.sponsors[k] ?? 0) + v
    report.daily.push({ day, counts: data.totals })
  }
  return report
}

/** Compares without bailing out at the first different character. */
function sameText(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

const COOKIE = 'tss_stats'
const COOKIE_DAYS = 30

/** Stateless login token: a keyed hash of the password, so changing the password logs everyone out. */
async function loginToken(password: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('tss-stats-v1')))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

function cookieValue(req: Request, name: string): string {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return ''
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * GET /stats shows the numbers to someone with the login cookie, otherwise a one-field password page.
 * A correct password (POST) sets a 30-day cookie. Wrong guesses are slowed down by half a second.
 */
export async function handleStats(req: Request, store: BucketStore, password: string | undefined, now = new Date(), delayMs = 500): Promise<Response> {
  if (!password) return new Response('Stats are not set up yet: add a STATS_PASSWORD environment variable in Netlify and redeploy.', { status: 503 })
  const url = new URL(req.url)
  const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }
  const html = (body: string, status = 200, extra: Record<string, string> = {}) =>
    new Response(body, { status, headers: { ...headers, ...extra, 'content-type': 'text/html; charset=utf-8' } })
  const token = await loginToken(password)

  if (req.method === 'POST') {
    let given = ''
    try { given = String((await req.formData()).get('password') ?? '') } catch { /* not a form */ }
    if (given && sameText(given, password)) {
      const cookie = `${COOKIE}=${token}; Max-Age=${COOKIE_DAYS * 86400}; Path=/stats; HttpOnly; SameSite=Strict${url.protocol === 'https:' ? '; Secure' : ''}`
      return new Response(null, { status: 303, headers: { ...headers, location: '/stats', 'set-cookie': cookie } })
    }
    await wait(delayMs)
    return html(loginPage(true), 401)
  }
  if (req.method !== 'GET') return new Response('Not allowed', { status: 405 })
  if (url.searchParams.has('logout')) {
    return new Response(null, { status: 303, headers: { ...headers, location: '/stats', 'set-cookie': `${COOKIE}=; Max-Age=0; Path=/stats; HttpOnly; SameSite=Strict` } })
  }
  if (!sameText(cookieValue(req, COOKIE), token)) return html(loginPage(false), 401)

  const report = await buildReport(store, Number(url.searchParams.get('days') ?? 30), now)
  if (url.searchParams.get('format') === 'json') return Response.json(report, { headers })
  return html(renderReport(report))
}

/** In-memory store for local development and tests. */
export function memoryStore(): BucketStore & { dump(): Record<string, Bucket> } {
  const m = new Map<string, { data: Bucket; v: number }>()
  return {
    async read(key) {
      const e = m.get(key)
      return { data: e ? structuredClone(e.data) : null, etag: e ? String(e.v) : undefined }
    },
    async write(key, data, etag) {
      const e = m.get(key)
      if (etag !== undefined && (!e || String(e.v) !== etag)) return false
      if (etag === undefined && e) return false
      m.set(key, { data: structuredClone(data), v: (e?.v ?? 0) + 1 })
      return true
    },
    dump: () => Object.fromEntries([...m].map(([k, v]) => [k, v.data])),
  }
}
