import { kindOf } from './kinds'
import type { Mood } from './mood'

/** Hand-built vector art: icons, survivor avatars and the skyline. All flat shapes, no gradients. */

export function Coin({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill="#FFD23F" stroke="#121212" strokeWidth="3" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#C99700" strokeWidth="2" />
      <path d="M17.5 10.5h-3.2a2.3 2.3 0 0 0 0 4.6h1.4a2.3 2.3 0 0 1 0 4.6h-3.4M16 8.5v15" fill="none" stroke="#121212" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function Bolt({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M19 2 6 18h8l-2 12 14-18h-8z" fill="#4CC9F0" stroke="#121212" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export function Heart({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 28S3 20 3 11.5A6.5 6.5 0 0 1 16 9a6.5 6.5 0 0 1 13 2.5C29 20 16 28 16 28z" fill="#FF3B30" stroke="#121212" strokeWidth="3" strokeLinejoin="round" />
      <path d="M8.5 12a3 3 0 0 1 3-3" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </svg>
  )
}

const FACE = { fill: '#FFE3B8', stroke: '#121212', strokeWidth: 3 }

function Eye({ x, y, mood }: { x: number; y: number; mood: Mood }) {
  if (mood === 'dizzy') {
    return (
      <g fill="none" stroke="#121212" strokeWidth="2" strokeLinecap="round">
        <circle cx={x} cy={y} r="4.6" />
        <path d={`M${x - 2.4} ${y}a2.4 2.4 0 1 1 2.4 2.4`} />
      </g>
    )
  }
  return <circle cx={x} cy={y} r={mood === 'worried' ? 3.2 : 2.8} fill="#121212" />
}

/** One cartoon face per survivor. Mood follows sanity; `hurt` (low health) adds a bandage. */
export function Avatar({ id, size = 64, mood = 'happy', hurt = false }: { id: string; size?: number; mood?: Mood; hurt?: boolean }) {
  const kind = kindOf(id)
  const intern = kind === 'intern'
  const eyeY = intern ? 32 : 38
  const mouthY = intern ? 43 : 46
  const mouth =
    mood === 'happy' ? `M25 ${mouthY}q7 5 14 0` : mood === 'worried' ? `M26 ${mouthY + 3}q6-3 12 0` : `M25 ${mouthY + 2}q3.5-4 7 0t7 0`
  return (
    <svg className="av" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {kind === 'commuter' && (
        <>
          <circle cx="32" cy="36" r="20" {...FACE} />
          <path d="M11 30a21 21 0 0 1 42 0z" fill="#FF3B30" stroke="#121212" strokeWidth="3" strokeLinejoin="round" />
          <rect x="9" y="28" width="46" height="8" rx="4" fill="#fff" stroke="#121212" strokeWidth="3" />
          <circle cx="32" cy="7" r="5" fill="#fff" stroke="#121212" strokeWidth="3" />
        </>
      )}
      {intern && (
        <>
          <circle cx="32" cy="32" r="20" {...FACE} />
          <path d="M12 26c2-12 10-16 20-16s18 4 20 16c-8-4-12-6-20-6s-12 2-20 6z" fill="#121212" />
          <path d="M26 52l6 10 6-10z" fill="#FF3B30" stroke="#121212" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="23" cy="32" r="6" fill="#fff" fillOpacity=".5" stroke="#121212" strokeWidth="2.5" />
          <circle cx="41" cy="32" r="6" fill="#fff" fillOpacity=".5" stroke="#121212" strokeWidth="2.5" />
          <path d="M29 32h6" stroke="#121212" strokeWidth="2.5" />
        </>
      )}
      {kind === 'campus' && (
        <>
          <path d="M10 34a22 22 0 0 1 44 0" fill="none" stroke="#121212" strokeWidth="5" strokeLinecap="round" />
          <circle cx="32" cy="36" r="19" {...FACE} />
          <rect x="3" y="30" width="10" height="16" rx="5" fill="#4CC38A" stroke="#121212" strokeWidth="3" />
          <rect x="51" y="30" width="10" height="16" rx="5" fill="#4CC38A" stroke="#121212" strokeWidth="3" />
        </>
      )}
      {kind === 'other' && (
        <circle cx="32" cy="34" r="20" {...FACE} />
      )}
      <g className={`eyes ${mood}`}>
        <Eye x={24} y={eyeY} mood={mood} />
        <Eye x={40} y={eyeY} mood={mood} />
      </g>
      {mood !== 'happy' && <path className="sweat" d="M52 24q-4.5 6.5 0 9.5t0-9.5z" fill="#4CC9F0" stroke="#121212" strokeWidth="1.6" />}
      {mood === 'worried' && <path d={`M19 ${eyeY - 7}l9 3M45 ${eyeY - 7}l-9 3`} stroke="#121212" strokeWidth="2.5" strokeLinecap="round" />}
      <path d={mouth} fill="none" stroke="#121212" strokeWidth="3" strokeLinecap="round" />
      {mood === 'dizzy' && <path d="M50 14l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z" fill="#FFD23F" stroke="#121212" strokeWidth="1.5" />}
      {hurt && (
        <g transform="rotate(-25 44 44)">
          <rect x="37" y="40" width="14" height="7" rx="2" fill="#FFB86B" stroke="#121212" strokeWidth="2" />
          <path d="M42 43.5h4" stroke="#121212" strokeWidth="1.4" />
        </g>
      )}
    </svg>
  )
}

/** Chunky flat skyline with the CN Tower. */
export function Skyline() {
  return (
    <svg className="skyline" viewBox="0 0 360 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <g stroke="#121212" strokeWidth="3" strokeLinejoin="round">
        <rect x="6" y="64" width="40" height="56" fill="#4CC9F0" />
        <rect x="52" y="44" width="34" height="76" fill="#FF6FB5" />
        <rect x="92" y="72" width="38" height="48" fill="#2EE6A6" />
        <path d="M176 120V58h8V20l-4-10h-4l2-8h4l2 8h-4l-4 10v38h8v62z" fill="#FF3B30" />
        <ellipse cx="180" cy="56" rx="13" ry="7" fill="#FFD23F" />
        <rect x="204" y="52" width="36" height="68" fill="#FFD23F" />
        <rect x="246" y="76" width="30" height="44" fill="#4CC9F0" />
        <rect x="282" y="40" width="34" height="80" fill="#2EE6A6" />
        <rect x="320" y="68" width="34" height="52" fill="#FF6FB5" />
      </g>
      <g fill="#121212" opacity=".75">
        {[[14, 74], [28, 74], [14, 90], [28, 90], [60, 54], [72, 54], [60, 70], [72, 70], [100, 82], [114, 82], [212, 62], [226, 62], [212, 78], [226, 78], [290, 50], [304, 50], [290, 66], [304, 66], [328, 78], [342, 78]].map(([x, y], i) => (
          <rect key={`${x}-${y}`} className="win-lit" style={{ animationDelay: `${(i * 0.37) % 3}s` }} x={x} y={y} width="6" height="8" />
        ))}
      </g>
    </svg>
  )
}

/** Falling snow and a streetcar rolling along the bottom of the hero. */
export function HeroLife() {
  return (
    <>
      <div className="hero-snow" aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `-${(i * 0.7) % 6}s`, animationDuration: `${4 + (i % 4)}s`, width: 4 + (i % 3) * 2, height: 4 + (i % 3) * 2 }} />
        ))}
      </div>
      <svg className="hero-tram" viewBox="0 0 90 40" aria-hidden="true">
        <rect x="2" y="6" width="80" height="22" rx="7" fill="#FF3B30" stroke="#121212" strokeWidth="3" />
        {[10, 30, 50, 66].map((x) => <rect key={x} x={x} y="11" width="12" height="9" rx="2" fill="#B8E8FF" stroke="#121212" strokeWidth="2" />)}
        <path d="M2 24h80" stroke="#fff" strokeWidth="2.5" />
        <circle cx="20" cy="31" r="4.5" fill="#121212" /><circle cx="64" cy="31" r="4.5" fill="#121212" />
        <path d="M40 6V1h14" fill="none" stroke="#121212" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </>
  )
}
