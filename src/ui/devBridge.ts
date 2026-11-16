import type { GameState } from '../types'

/** Lets the dev-only test panel read and replace the game state. Only ever set under `npm run dev`. */
export interface DevBridge {
  state: GameState | null
  setState: (next: GameState | null) => void
}

declare global {
  interface Window { __tss?: DevBridge }
}

export function publishDev(bridge: DevBridge): void {
  if (import.meta.env.DEV) window.__tss = bridge
}
