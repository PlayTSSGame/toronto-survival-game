import type { GameState, Stats } from '../types'
import { STAT_MAX, TOTAL_TURNS } from './game'

export const SAVE_KEY = 'tss.save.v4'
const VERSION = 4

interface Envelope {
  version: number
  state: GameState
  checksum: string
}

/** Detects accidental or casual edits; not tamper-proof (client-side only). */
export function checksum(state: GameState): string {
  const s = JSON.stringify(state)
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

function coherent(s: GameState): boolean {
  const st = s.stats as Stats | undefined
  if (!st || !isNum(st.cash) || !isNum(st.sanity) || !isNum(st.health)) return false
  if (!Number.isInteger(s.turn) || s.turn < 1 || s.turn > TOTAL_TURNS) return false
  if (typeof s.characterId !== 'string') return false
  if (!isNum(s.stipend) || s.stipend < 0) return false
  if (!Array.isArray(s.inventory) || s.inventory.some((i) => typeof i !== 'string')) return false
  if (!Array.isArray(s.processedEvents) || s.processedEvents.length > s.turn) return false
  if (new Set(s.processedEvents).size !== s.processedEvents.length) return false
  if (st.sanity > STAT_MAX || st.health > STAT_MAX || st.sanity < 0 || st.health < 0) return false
  const dead = st.sanity <= 0 || st.health <= 0
  // Win/loss prerequisites must agree with the vitals and the turn counter.
  if (s.status === 'playing') return !dead && s.victory === null
  if (s.status === 'lost') return dead && s.victory === null
  if (s.status === 'finished') return !dead && s.turn === TOTAL_TURNS && s.victory !== null
  return false
}

export function saveGame(state: GameState, storage: Storage = localStorage): boolean {
  try {
    const env: Envelope = { version: VERSION, state, checksum: checksum(state) }
    storage.setItem(SAVE_KEY, JSON.stringify(env))
    return true
  } catch {
    return false // private mode / quota: game keeps running unsaved
  }
}

/** Returns null for missing, corrupt, edited, or incoherent saves. */
export function loadGame(storage: Storage = localStorage): GameState | null {
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (!raw) return null
    const env = JSON.parse(raw) as Envelope
    if (env.version !== VERSION || !env.state) return null
    if (env.checksum !== checksum(env.state) || !coherent(env.state)) return null
    return env.state
  } catch {
    return null
  }
}

export function clearSave(storage: Storage = localStorage): void {
  try { storage.removeItem(SAVE_KEY) } catch { /* ignore */ }
}
