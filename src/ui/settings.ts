import { useEffect, useState } from 'react'

export interface Settings {
  sound: boolean
  vibration: boolean
  large: boolean
  calm: boolean
  contrast: boolean
}

const KEY = 'tss.settings.v1'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function defaults(): Settings {
  return { sound: true, vibration: true, large: false, calm: prefersReducedMotion(), contrast: false }
}

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null
    return { ...defaults(), ...(raw && typeof raw === 'object' ? raw : {}) }
  } catch {
    return defaults()
  }
}

/** Module-level copy so non-React code (sound, haptics) can read the current settings. */
let current: Settings = load()
export const getSettings = () => current

function apply(s: Settings) {
  const cl = document.documentElement.classList
  cl.toggle('large', s.large)
  cl.toggle('calm', s.calm)
  cl.toggle('contrast', s.contrast)
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(current)
  useEffect(() => {
    current = s
    apply(s)
    try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* private mode */ }
  }, [s])
  return [s, (patch) => setS((prev) => ({ ...prev, ...patch }))]
}
