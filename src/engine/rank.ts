import type { GameState } from '../types'

/**
 * Comedic Toronto rank. Precedence (first match wins):
 *  0. endless run (after day 60) -> Endless Legend
 *  1. lost on health            -> Frozen Sub-Way Dweller
 *  2. lost on sanity            -> Streetcar Casualty
 *  3. wealth victory            -> Bay Street Executive
 *  4. asset victory             -> Condo Conqueror
 *  5. endurance, cash < 0       -> Overdraft Legend
 *  6. endurance, sanity >= 50   -> Commuter Master
 *  7. endurance otherwise       -> Tim's Coffee Survivor
 * Only three rank names come from the client's earlier spec; the rest and the order are
 * proposals awaiting confirmation.
 */
export function computeRank(s: GameState): string {
  if (s.endless) return 'Endless Legend'
  if (s.status === 'lost') return s.stats.health <= 0 ? 'Frozen Sub-Way Dweller' : 'Streetcar Casualty'
  if (s.victory === 'wealth') return 'Bay Street Executive'
  if (s.victory === 'asset') return 'Condo Conqueror'
  if (s.stats.cash < 0) return 'Overdraft Legend'
  if (s.stats.sanity >= 50) return 'Commuter Master'
  return "Tim's Coffee Survivor"
}

export function outcomeTitle(s: GameState): string {
  if (s.endless) return s.status === 'lost' ? `Endless run over: survived ${Math.max(0, s.turn - 1)} days` : `Endless mode: day ${s.turn}`
  if (s.status === 'lost') return `Defeated on day ${s.turn}`
  if (s.victory === 'wealth') return 'Wealth victory'
  if (s.victory === 'asset') return 'Asset victory: you bought the condo'
  return 'Endurance victory'
}

export function shareText(s: GameState, url: string): string {
  const { cash, sanity, health } = s.stats
  const cashText = `${cash < 0 ? '-' : ''}$${Math.abs(cash).toLocaleString('en-CA')}`
  return [
    `Toronto Survival Simulator: ${computeRank(s)}`,
    `${outcomeTitle(s)}`,
    `Cash ${cashText} · Sanity ${sanity}% · Health ${health}%`,
    `Can you survive Toronto? ${url}`,
  ].join('\n')
}

export type ShareResult = 'copied' | 'failed'

/** Clipboard API first, then a hidden-textarea fallback for older/blocked contexts. */
export async function copyText(text: string): Promise<ShareResult> {
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok ? 'copied' : 'failed'
    } catch {
      return 'failed'
    }
  }
}
