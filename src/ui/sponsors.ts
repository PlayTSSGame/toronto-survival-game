import sponsorsRaw from '../data/sponsors.json'

export interface Sponsor {
  name: string
  text: string
  url?: string
}

export const PLACEHOLDER = "Your GTA Brand Here — Reach 10,000+ Toronto Students • Tap 'Sponsor this game' below"

/** Paid sponsors from src/data/sponsors.json (bad entries are ignored). */
export function loadSponsors(raw: unknown = sponsorsRaw): Sponsor[] {
  const list = (raw as { sponsors?: unknown })?.sponsors
  if (!Array.isArray(list)) return []
  return list.flatMap((s): Sponsor[] => {
    const o = s as Partial<Sponsor> | null
    if (!o || typeof o.name !== 'string' || typeof o.text !== 'string' || !o.name || !o.text) return []
    const url = typeof o.url === 'string' && /^https?:\/\//.test(o.url) ? o.url : undefined
    return [{ name: o.name, text: o.text, url }]
  })
}

