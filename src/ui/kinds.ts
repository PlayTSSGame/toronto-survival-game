export type Kind = 'commuter' | 'intern' | 'campus' | 'other'

/** Maps a class_id (e.g. CLASS_001_COMMUTER) to the look it gets in the UI. */
export function kindOf(id: string): Kind {
  const s = id.toLowerCase()
  if (s.includes('commuter')) return 'commuter'
  if (s.includes('intern')) return 'intern'
  if (s.includes('campus')) return 'campus'
  return 'other'
}
