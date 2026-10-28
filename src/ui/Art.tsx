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

/** One cartoon face per survivor, picked by class id (generic fallback for new classes). */
export function Avatar({ id, size = 64 }: { id: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {id === 'mississauga_commuter' && (
        <>
          {/* tuque */}
          <circle cx="32" cy="36" r="20" {...FACE} />
          <path d="M11 30a21 21 0 0 1 42 0z" fill="#FF3B30" stroke="#121212" strokeWidth="3" strokeLinejoin="round" />
          <rect x="9" y="28" width="46" height="8" rx="4" fill="#fff" stroke="#121212" strokeWidth="3" />
          <circle cx="32" cy="7" r="5" fill="#fff" stroke="#121212" strokeWidth="3" />
        </>
      )}
      {id === 'financial_district_intern' && (
        <>
          <circle cx="32" cy="32" r="20" {...FACE} />
          <path d="M12 26c2-12 10-16 20-16s18 4 20 16c-8-4-12-6-20-6s-12 2-20 6z" fill="#121212" />
          <path d="M26 52l6 10 6-10z" fill="#FF3B30" stroke="#121212" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="23" cy="32" r="6" fill="#fff" fillOpacity=".5" stroke="#121212" strokeWidth="2.5" />
          <circle cx="41" cy="32" r="6" fill="#fff" fillOpacity=".5" stroke="#121212" strokeWidth="2.5" />
          <path d="M29 32h6" stroke="#121212" strokeWidth="2.5" />
        </>
      )}
      {id === 'campus_residence_dweller' && (
        <>
          <path d="M10 34a22 22 0 0 1 44 0" fill="none" stroke="#121212" strokeWidth="5" strokeLinecap="round" />
          <circle cx="32" cy="36" r="19" {...FACE} />
          <rect x="3" y="30" width="10" height="16" rx="5" fill="#4CC38A" stroke="#121212" strokeWidth="3" />
          <rect x="51" y="30" width="10" height="16" rx="5" fill="#4CC38A" stroke="#121212" strokeWidth="3" />
        </>
      )}
      {!['mississauga_commuter', 'financial_district_intern', 'campus_residence_dweller'].includes(id) && (
        <circle cx="32" cy="34" r="20" {...FACE} />
      )}
      <circle cx="24" cy={id === 'financial_district_intern' ? 32 : 38} r="2.8" fill="#121212" />
      <circle cx="40" cy={id === 'financial_district_intern' ? 32 : 38} r="2.8" fill="#121212" />
      <path d={id === 'financial_district_intern' ? 'M25 43q7 5 14 0' : 'M25 46q7 5 14 0'} fill="none" stroke="#121212" strokeWidth="3" strokeLinecap="round" />
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
        {[[14, 74], [28, 74], [14, 90], [28, 90], [60, 54], [72, 54], [60, 70], [72, 70], [100, 82], [114, 82], [212, 62], [226, 62], [212, 78], [226, 78], [290, 50], [304, 50], [290, 66], [304, 66], [328, 78], [342, 78]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="6" height="8" />
        ))}
      </g>
    </svg>
  )
}
