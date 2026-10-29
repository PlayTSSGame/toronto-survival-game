export type Mood = 'happy' | 'worried' | 'dizzy'

/** Survivor expression follows sanity. */
export function moodFor(sanity: number): Mood {
  return sanity >= 60 ? 'happy' : sanity >= 30 ? 'worried' : 'dizzy'
}
