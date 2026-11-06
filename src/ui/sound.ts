import { getSettings } from './settings'

/** Tiny synthesized sound effects (no audio files) and haptics. Both honour the Settings toggles. */

type Sfx = 'click' | 'tap' | 'coin' | 'good' | 'hit' | 'doors' | 'win' | 'lose'

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

function whoosh(c: AudioContext, at: number) {
  const len = Math.floor(c.sampleRate * 0.45)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (((i * 7919) % 2000) / 1000 - 1) * (1 - i / len)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.setValueAtTime(400, at)
  f.frequency.exponentialRampToValueAtTime(1800, at + 0.4)
  const g = c.createGain()
  g.gain.value = 0.18
  src.connect(f).connect(g).connect(master(c))
  src.start(at)
}

export function playSfx(name: Sfx) {
  if (!getSettings().sound) return
  const c = audio()
  if (!c) return
  try {
    if (c.state === 'suspended') void c.resume()
    const t = c.currentTime
    switch (name) {
      // Soft sine chimes: a short tick with a quiet octave overtone, and a gentle rising two-note "ring".
      case 'click': tone(c, 700, t, 0.11, 'sine', 0.09); tone(c, 1400, t, 0.07, 'sine', 0.025); break
      case 'tap': tone(c, 523, t, 0.1, 'sine', 0.08); tone(c, 784, t + 0.055, 0.16, 'sine', 0.08); tone(c, 1568, t + 0.055, 0.1, 'sine', 0.02); break
      case 'coin': tone(c, 988, t, 0.09, 'triangle', 0.07); tone(c, 1319, t + 0.08, 0.2, 'triangle', 0.07); break
      case 'good': [523, 659, 784].forEach((f, i) => tone(c, f, t + i * 0.07, 0.14, 'triangle', 0.13)); break
      case 'hit': tone(c, 240, t, 0.3, 'sawtooth', 0.14, 70); tone(c, 120, t, 0.25, 'square', 0.08, 50); break
      case 'doors': whoosh(c, t); break
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, f, t + i * 0.11, 0.25, 'triangle', 0.14)); break
      case 'lose': [392, 349, 311, 233].forEach((f, i) => tone(c, f, t + i * 0.2, 0.34, 'sawtooth', 0.1)); break
    }
  } catch { /* audio blocked: stay silent */ }
}

export function vibrate(pattern: number | number[]) {
  if (!getSettings().vibration) return
  try { navigator.vibrate?.(pattern) } catch { /* unsupported */ }
}
