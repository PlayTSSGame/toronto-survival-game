/**
 * Edge proxy core for TTC service alerts. The public feed (alerts.ttc.ca) sends no CORS
 * headers, so browsers cannot call it directly, and it has no "delay_minutes" field.
 * We derive an estimate from currently-active, unplanned delay alerts on subway/streetcar
 * routes (planned maintenance closures are not live delays and are ignored):
 *
 *   per-alert minutes by severity: Critical 30, Major 20, Minor 10, other 5
 *   result = max alert minutes + 5 per additional active alert, capped at 45
 *
 * This mapping is a documented assumption and needs client sign-off.
 */
export const TTC_ALERTS_URL = 'https://alerts.ttc.ca/api/alerts/live-alerts'

export interface TransitSnapshot {
  delay_minutes: number
  active_alerts: number
  updated: string
}

const SEVERITY_MINUTES: Record<string, number> = { Critical: 30, Major: 20, Minor: 10 }
const MODES = new Set(['Subway', 'Streetcar'])
const DELAY_EFFECTS = new Set(['SIGNIFICANT_DELAYS', 'REDUCED_SERVICE', 'DETOUR', 'NO_SERVICE'])

interface RawAlert {
  routeType?: string
  alertType?: string
  effect?: string
  severity?: string
  activePeriod?: { start?: string; end?: string }
}

function isActive(a: RawAlert, now: number): boolean {
  const start = a.activePeriod?.start ? Date.parse(a.activePeriod.start) : NaN
  const end = a.activePeriod?.end ? Date.parse(a.activePeriod.end) : NaN
  if (Number.isFinite(start) && start > now) return false
  // The feed uses 0001-01-01 as "no end date".
  if (Number.isFinite(end) && end > Date.parse('1971-01-01') && end < now) return false
  return true
}

export function deriveTransit(raw: unknown, now = Date.now()): TransitSnapshot | null {
  const routes = (raw as { routes?: unknown })?.routes
  if (!Array.isArray(routes)) return null
  const active = (routes as RawAlert[]).filter(
    (a) =>
      a && MODES.has(a.routeType ?? '') && a.alertType !== 'Planned' && DELAY_EFFECTS.has(a.effect ?? '') && isActive(a, now),
  )
  const mins = active.map((a) => SEVERITY_MINUTES[a.severity ?? ''] ?? 5)
  const delay = mins.length ? Math.min(45, Math.max(...mins) + 5 * (mins.length - 1)) : 0
  return { delay_minutes: delay, active_alerts: active.length, updated: new Date(now).toISOString() }
}

export async function handleTransit(fetchImpl: typeof fetch = fetch): Promise<Response> {
  const headers = { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' }
  try {
    const res = await fetchImpl(TTC_ALERTS_URL, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const snap = deriveTransit(await res.json())
    if (!snap) throw new Error('unexpected payload')
    return new Response(JSON.stringify(snap), { status: 200, headers })
  } catch {
    return new Response(JSON.stringify({ error: 'transit_unavailable' }), { status: 502, headers })
  }
}
