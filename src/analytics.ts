/**
 * Anonymous play statistics (see server/stats.ts). Fire-and-forget: it never blocks or breaks the game.
 * The campus referral code comes from `?ref=` and is remembered, so a visitor who arrives through a
 * creator's link is still credited when they start a run later.
 */
const ENDPOINT = '/api/track'
const REF_KEY = 'tss.ref'

export type TrackEvent = 'visit' | 'start' | 'finish' | 'endless' | 'sponsor_click'

/** A campus referral code: lowercase letters, digits, dash, underscore, at most 32 characters. */
export function cleanRef(raw: string | null): string | null {
  const v = (raw ?? '').trim().toLowerCase()
  return /^[a-z0-9_-]{1,32}$/.test(v) ? v : null
}

/** Reads `?ref=` once and keeps the first one seen. Returns the active code, if any. */
export function currentRef(): string | null {
  try {
    const fromUrl = cleanRef(new URLSearchParams(window.location.search).get('ref'))
    const saved = cleanRef(localStorage.getItem(REF_KEY))
    if (fromUrl && !saved) localStorage.setItem(REF_KEY, fromUrl)
    return saved ?? fromUrl
  } catch {
    return cleanRef(new URLSearchParams(window.location.search).get('ref'))
  }
}

export function track(event: TrackEvent, extra: { cls?: string; kind?: string; name?: string } = {}): void {
  if (import.meta.env.DEV && !import.meta.env.VITE_TRACK_IN_DEV) return
  try {
    const body = JSON.stringify({ event, ref: currentRef(), ...extra })
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))) return
    void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {})
  } catch { /* analytics must never break the game */ }
}

/** One "visit" per browser session. */
export function trackVisit(): void {
  try {
    if (sessionStorage.getItem('tss.visit')) return
    sessionStorage.setItem('tss.visit', '1')
  } catch { /* count it anyway */ }
  track('visit')
}
