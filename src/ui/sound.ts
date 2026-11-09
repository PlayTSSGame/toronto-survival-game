import { getSettings } from './settings'

/** Tiny synthesized sound effects (no audio files) and haptics. Both honour the Settings toggles. */

type Sfx = 'click' | 'coin' | 'good' | 'hit' | 'win' | 'lose'

let ctx: AudioContext | null = null
/** Everything routes through a gentle low-pass so nothing is piercing on phone speakers. */
let out: AudioNode | null = null

function master(c: AudioContext): AudioNode {
  if (out) return out
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 4200
  f.Q.value = 0.5
  f.connect(c.destination)
  out = f
  return f
}

function audio(): AudioContext | null {
  if (ctx) return ctx
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    ctx = Ctor ? new Ctor() : null
  } catch {
    ctx = null
  }
  return ctx
}

function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, vol = 0.12, endFreq?: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, at + dur)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(master(c))
  o.start(at)
  o.stop(at + dur + 0.02)
}

/** Client-supplied sounds (public/*.mp3). Fetched once, decoded, replayed from memory. */
const NEXT_DAY_URL = '/next-day.mp3'
const HIT_URL = '/hit.mp3'
const buffers = new Map<string, Promise<AudioBuffer | null>>()

function load(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  let p = buffers.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .catch(() => { buffers.delete(url); return null }) // offline or undecodable: stay silent, retry next time
    buffers.set(url, p)
  }
  return p
}

/** Warm the cache so the first tap has no delay. Safe to call before any user gesture. */
export function preloadSfx() {
  const c = audio()
  if (c) { void load(c, NEXT_DAY_URL); void load(c, HIT_URL) }
}

function playFile(url: string) {
  if (!getSettings().sound) return
  const c = audio()
  if (!c) return
  try {
    if (c.state === 'suspended') void c.resume()
    void load(c, url).then((buf) => {
      if (!buf) return
      const src = c.createBufferSource()
      src.buffer = buf
      src.connect(c.destination)
      src.start()
    })
  } catch { /* audio blocked: stay silent */ }
}

/** The supplied mp3 for the Next Day button. */
export const playNextDay = () => playFile(NEXT_DAY_URL)

export function playSfx(name: Sfx) {
  if (name === 'hit') return playFile(HIT_URL) // client's custom sound replaces the low buzz
  if (!getSettings().sound) return
  const c = audio()
  if (!c) return
  try {
    if (c.state === 'suspended') void c.resume()
    const t = c.currentTime
    switch (name) {
      // Soft sine chimes: a short tick with a quiet octave overtone, and a gentle rising two-note "ring".
      case 'click': tone(c, 700, t, 0.11, 'sine', 0.09); tone(c, 1400, t, 0.07, 'sine', 0.025); break
      case 'coin': tone(c, 988, t, 0.09, 'triangle', 0.07); tone(c, 1319, t + 0.08, 0.2, 'triangle', 0.07); break
      case 'good': [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.07, 0.14, 'triangle', 0.13)); break
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, f, t + i * 0.11, 0.25, 'triangle', 0.14)); break
      case 'lose': [392, 349, 311, 233].forEach((f, i) => tone(c, f, t + i * 0.2, 0.34, 'sawtooth', 0.1)); break
    }
  } catch { /* audio blocked: stay silent */ }
}

export function vibrate(pattern: number | number[]) {
  if (!getSettings().vibration) return
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}
