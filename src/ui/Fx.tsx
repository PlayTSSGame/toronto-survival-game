/** Decorative motion: drifting background shapes, outcome bursts and win confetti. Deterministic (no Math.random in render). */

const COLORS = ['#FFD23F', '#2EE6A6', '#4CC9F0', '#FF6FB5', '#FF3B30']
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return x - Math.floor(x)
}
type CSS = React.CSSProperties & Record<`--${string}`, string | number>

function Shape({ kind }: { kind: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  switch (kind % 5) {
    case 0: return <svg viewBox="0 0 40 40"><path {...p} fill="currentColor" d="M20 3l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z" /></svg>
    case 1: return <svg viewBox="0 0 40 40"><circle {...p} cx="20" cy="20" r="13" /></svg>
    case 2: return <svg viewBox="0 0 40 40"><path {...p} d="M20 6v28M6 20h28" /></svg>
    case 3: return <svg viewBox="0 0 40 40"><path {...p} d="M3 24q6-14 12 0t12 0 10-6" /></svg>
    default: return <svg viewBox="0 0 40 40"><path {...p} fill="currentColor" d="M20 5l16 28H4z" /></svg>
  }
}

export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="bd"
          style={{
            left: `${Math.round(rnd(i, 1) * 96)}%`,
            top: `${Math.round(rnd(i, 2) * 94)}%`,
            width: 22 + Math.round(rnd(i, 3) * 30),
            color: COLORS[i % COLORS.length],
            '--d': `${9 + Math.round(rnd(i, 4) * 9)}s`,
            '--delay': `-${Math.round(rnd(i, 5) * 9)}s`,
            '--rot': `${Math.round(rnd(i, 6) * 120 - 60)}deg`,
          } as CSS}
        >
          <Shape kind={i} />
        </span>
      ))}
    </div>
  )
}

function CrackedHeart() {
  return (
    <svg viewBox="0 0 64 64" width="84" height="84">
      <path d="M32 58S6 42 6 23A13 13 0 0 1 32 18a13 13 0 0 1 26 5C58 42 32 58 32 58z" fill="#FF3B30" stroke="#121212" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 18l-6 10 8 6-7 10 5 8" fill="none" stroke="#121212" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function CrackedBolt() {
  return (
    <svg viewBox="0 0 64 64" width="84" height="84">
      <path d="M38 4 12 36h16l-4 24 28-36H36z" fill="#4CC9F0" stroke="#121212" strokeWidth="4" strokeLinejoin="round" />
      <path d="M44 14l-8 8 6 4-6 8" fill="none" stroke="#121212" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** One-shot particle burst. `loss` shows red shards and a cracked icon; gains show sparkles. */
export function Burst({ gain, loss, hurtHealth }: { gain: boolean; loss: boolean; hurtHealth: boolean }) {
  const n = 18
  return (
    <div className="burst" aria-hidden="true">
      {loss && <div className="crack">{hurtHealth ? <CrackedHeart /> : <CrackedBolt />}</div>}
      {Array.from({ length: n }, (_, i) => {
        const ang = (i / n) * Math.PI * 2 + rnd(i, 7)
        const dist = 90 + rnd(i, 8) * 110
        const isLoss = loss && (!gain || i % 2 === 0)
        return (
          <i
            key={i}
            className={isLoss ? 'shard' : 'spark'}
            style={{
              '--dx': `${Math.round(Math.cos(ang) * dist)}px`,
              '--dy': `${Math.round(Math.sin(ang) * dist)}px`,
              '--rot': `${Math.round(rnd(i, 9) * 540)}deg`,
              '--s': `${10 + Math.round(rnd(i, 10) * 14)}px`,
              '--c': isLoss ? (i % 3 ? '#FF3B30' : '#FF9F43') : COLORS[i % 4],
            } as CSS}
          />
        )
      })}
    </div>
  )
}

export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 46 }, (_, i) => (
        <i
          key={i}
          style={{
            left: `${Math.round(rnd(i, 11) * 100)}%`,
            '--c': COLORS[i % COLORS.length],
            '--d': `${2.6 + rnd(i, 12) * 2.4}s`,
            '--delay': `${(rnd(i, 13) * 1.6).toFixed(2)}s`,
            '--sway': `${Math.round(rnd(i, 14) * 80 - 40)}px`,
            '--w': `${7 + Math.round(rnd(i, 15) * 8)}px`,
            borderRadius: i % 3 === 0 ? '50%' : '2px',
          } as CSS}
        />
      ))}
    </div>
  )
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const SKY: [number, string, string][] = [
  [0, '#FF9F43', '#FFD9A0'], [0.3, '#4CC9F0', '#B8E8FF'], [0.62, '#FF6FB5', '#FFB86B'], [1, '#14143A', '#3A2A6B'],
]
function skyAt(t: number): [string, string] {
  let i = 0
  while (i < SKY.length - 2 && t > SKY[i + 1][0]) i++
  const [t0, a0, b0] = SKY[i]
  const [t1, a1, b1] = SKY[i + 1]
  const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))
  const mix = (x: string, y: string) => `rgb(${hex(x).map((v, j) => Math.round(lerp(v, hex(y)[j], k))).join(',')})`
  return [mix(a0, a1), mix(b0, b1)]
}

/** Thin sky banner: dawn on day 1, night by the last day (60). The sun crosses and becomes the moon. */
export function Sky({ day }: { day: number }) {
  const t = Math.min(1, (day - 1) / 59)
  const [top, bottom] = skyAt(t)
  const night = t > 0.72
  return (
    <div className="sky" style={{ background: `linear-gradient(${top}, ${bottom})` }} role="img" aria-label={night ? 'Night' : t > 0.55 ? 'Dusk' : t < 0.15 ? 'Dawn' : 'Daytime'}>
      {night && [12, 30, 52, 70, 88].map((x, i) => <i key={x} className="star" style={{ left: `${x}%`, top: `${20 + (i % 3) * 22}%`, animationDelay: `${i * 0.4}s` }} />)}
      <span className={`orb ${night ? 'moon' : 'sun'}`} style={{ left: `${6 + t * 82}%`, top: `${64 - Math.sin(Math.PI * Math.min(1, t * 1.05)) * 52}%` }} />
      <svg className="skyline-mini" viewBox="0 0 360 14" preserveAspectRatio="none"><path d="M0 14V8h14V4h10v4h12V2h6v6h16v4h14V6h10v8zM196 14V9h10V3l3-3 3 3v6h12V5h14v9h26V7h16v7h24V4h12v10h44V8h14v6z" fill="#121212" opacity=".55" /></svg>
    </div>
  )
}
