import type { GameState } from '../types'

const KEY = 'tss.best.v1'

export interface Best {
  /** Most days survived in any run (endless mode included). */
  days: number
  /** Most cash held at any moment in any run. */
  cash: number
}

const EMPTY: Best = { days: 0, cash: 0 }

export function loadBest(storage: Storage = localStorage): Best {
  try {
    const b = JSON.parse(storage.getItem(KEY) ?? 'null') as Partial<Best> | null
    if (b && Number.isFinite(b.days) && Number.isFinite(b.cash)) return { days: b.days as number, cash: b.cash as number }
  } catch { /* fall through */ }
  return EMPTY
}

/** Days fully lived through: today does not count until it is over (a finished run completed its last day). */
export function daysSurvived(s: GameState): number {
  return s.status === 'finished' ? s.turn : Math.max(0, s.turn - 1)
}

/** Folds the run into the saved bests. Returns the new bests (unchanged object if nothing improved). */
export function recordBest(s: GameState, storage: Storage = localStorage): Best {
  const cur = loadBest(storage)
  const next: Best = { days: Math.max(cur.days, daysSurvived(s)), cash: Math.max(cur.cash, Math.round(s.stats.cash)) }
  if (next.days === cur.days && next.cash === cur.cash) return cur
  try { storage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: skip */ }
  return next
}
