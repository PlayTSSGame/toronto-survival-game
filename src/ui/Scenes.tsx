import type { GameEvent } from '../types'

/** Flat illustration banners, one per event. Falls back to a themed scene by dependency, then a city scene. */

const I = { stroke: '#121212', strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

const Flakes = ({ n = 14 }: { n?: number }) => (
  <g fill="#fff" opacity=".9">
    {Array.from({ length: n }, (_, i) => <circle key={i} className="flake-bg" style={{ animationDelay: `${(i % 5) * 0.4}s` }} cx={((i * 83) % 340) + 10} cy={((i * 47) % 90) + 8} r={2 + (i % 3)} />)}
  </g>
)

function Streetcar({ x = 90, y = 40 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="170" height="52" rx="14" fill="#FF3B30" {...I} />
      {[14, 54, 94, 128].map((px) => <rect key={px} x={px} y="10" width={px === 128 ? 30 : 28} height="20" rx="4" fill="#B8E8FF" {...I} strokeWidth="2.5" />)}
      <path d="M0 40h170" stroke="#fff" strokeWidth="4" />
      <circle cx="38" cy="56" r="8" fill="#121212" /><circle cx="132" cy="56" r="8" fill="#121212" />
      <path d="M70 0V-14h40" fill="none" {...I} />
    </g>
  )
}

const art: Record<string, { bg: string; node: React.ReactNode }> = {
  blizzard: { bg: '#243B6B', node: <><Flakes n={22} /><circle cx="180" cy="55" r="34" fill="#fff" {...I} /><text x="180" y="66" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="34" fill="#121212">1</text><path d="M148 23l64 64M212 23l-64 64" stroke="#FF3B30" strokeWidth="9" strokeLinecap="round" /><rect x="236" y="62" width="80" height="22" rx="5" fill="#FFD23F" {...I} /><text x="276" y="78" textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="900" fontSize="13" fill="#121212">SUSPENDED</text></> },
  loblaws: { bg: '#2F7D5B', node: <><path d="M120 44h120l-10 56H130z" fill="#FFB86B" {...I} /><path d="M146 44c0-26 68-26 68 0" fill="none" {...I} /><path d="M150 44c-8-22 4-34 14-30" fill="#4CC38A" {...I} /><ellipse cx="206" cy="36" rx="14" ry="10" fill="#FFD23F" {...I} /><rect x="250" y="24" width="64" height="40" rx="6" fill="#fff" {...I} /><text x="282" y="52" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="24" fill="#FF3B30">$52</text></> },
  presto: { bg: '#3A2A6B', node: <><rect x="60" y="38" width="110" height="64" rx="8" fill="#2EE6A6" {...I} /><rect x="72" y="50" width="28" height="20" rx="4" fill="#FFD23F" {...I} strokeWidth="2.5" /><path d="M72 88h60" stroke="#121212" strokeWidth="4" strokeLinecap="round" /><path d="M215 100V50M255 100V50" stroke="#fff" strokeWidth="8" strokeLinecap="round" /><rect x="205" y="34" width="60" height="16" rx="4" fill="#FF3B30" {...I} /><g className="bubble"><path d="M278 30h56v26h-34l-8 8v-8h-14z" fill="#fff" {...I} strokeWidth="2.5" /><text x="305" y="48" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="15" fill="#FF3B30">BEEP!</text></g></> },
  york: { bg: '#4F7CAC', node: <><path d="M20 30h60M10 50h70M30 70h50" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".7" /><rect x="150" y="34" width="170" height="58" rx="12" fill="#FFD23F" {...I} />{[165, 205, 245, 285].map((x) => <rect key={x} x={x} y="44" width="28" height="22" rx="4" fill="#B8E8FF" {...I} strokeWidth="2.5" />)}<circle cx="190" cy="94" r="10" fill="#121212" /><circle cx="285" cy="94" r="10" fill="#121212" />{[108, 124, 140].map((x, i) => <g key={x}><circle cx={x} cy={64 - (i % 2) * 2} r="8" fill="#FFE3B8" {...I} strokeWidth="2.5" /><path d={`M${x} ${72} v20`} stroke="#121212" strokeWidth="5" strokeLinecap="round" /></g>)}</> },
  eaton: { bg: '#8B2E6B', node: <><path d="M148 34l-30 14 12 20 12-7v38h60V61l12 7 12-20-30-14c-4 9-12 13-24 13s-20-4-24-13z" fill="#2EE6A6" {...I} /><path d="M166 56h28v14h-28z" fill="none" {...I} strokeWidth="2.5" /><path d="M180 30V20" {...I} /><circle cx="180" cy="16" r="5" fill="#fff" {...I} strokeWidth="2.5" /><g transform="rotate(10 280 60)"><rect x="236" y="36" width="76" height="40" rx="8" fill="#FF3B30" {...I} /><text x="274" y="64" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="26" fill="#fff">SALE</text></g></> },
  midterm: { bg: '#1B1B3A', node: <><circle cx="300" cy="34" r="20" fill="#FFD23F" {...I} /><circle cx="310" cy="28" r="17" fill="#1B1B3A" /><g fill="#fff">{[[40, 20], [90, 40], [160, 18], [230, 30], [60, 76]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="3" />)}</g><rect x="110" y="70" width="110" height="18" rx="3" fill="#FF6FB5" {...I} /><rect x="120" y="54" width="96" height="16" rx="3" fill="#4CC9F0" {...I} /><rect x="104" y="38" width="100" height="16" rx="3" fill="#FFD23F" {...I} /><rect x="250" y="52" width="26" height="42" rx="6" fill="#121212" stroke="#FFD23F" strokeWidth="3" /><path d="M265 58l-8 14h6l-2 12 10-16h-6z" fill="#FFD23F" /></> },
  tim: { bg: '#B23A3A', node: <><path d="M130 44h80l-8 52h-64z" fill="#fff" {...I} /><path d="M126 44h88v-10h-88z" fill="#FF3B30" {...I} /><path d="M136 62h68v14h-68z" fill="#FF3B30" opacity=".95" /><path className="steam" d="M155 26q-8-12 0-20M175 26q-8-12 0-20M195 26q-8-12 0-20" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" /><circle cx="282" cy="56" r="28" fill="#fff" {...I} /><path d="M282 56V38M282 56l14 8" stroke="#121212" strokeWidth="4" strokeLinecap="round" /></> },
  dundas: { bg: '#2A1B4D', node: <><rect x="30" y="18" width="110" height="60" rx="6" fill="#FF3B30" {...I} /><rect x="150" y="30" width="90" height="46" rx="6" fill="#FFD23F" {...I} /><rect x="250" y="14" width="80" height="64" rx="6" fill="#4CC9F0" {...I} /><g fontFamily="Lilita One, sans-serif" fontSize="22" textAnchor="middle"><text x="85" y="56" fill="#fff">BUY!</text><text x="195" y="60" fill="#121212">SALE</text><text x="290" y="54" fill="#121212">JOIN</text></g><rect x="20" y="80" width="320" height="18" fill="#3A3A5C" {...I} /></> },
  wifi: { bg: '#25446B', node: <><path d="M120 62a60 60 0 0 1 120 0M140 76a34 34 0 0 1 80 0M160 90a10 10 0 0 1 40 0" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" /><circle cx="180" cy="94" r="7" fill="#fff" /><path d="M236 24l40 40M276 24l-40 40" stroke="#FF3B30" strokeWidth="11" strokeLinecap="round" /><circle className="spin" cx="70" cy="60" r="20" fill="none" stroke="#FFD23F" strokeWidth="7" strokeDasharray="30 100" strokeLinecap="round" /></> },
  textbook: { bg: '#6B3A8B', node: <><rect x="90" y="64" width="120" height="22" rx="4" fill="#FF6FB5" {...I} /><rect x="100" y="44" width="104" height="20" rx="4" fill="#4CC9F0" {...I} /><rect x="86" y="24" width="112" height="20" rx="4" fill="#FFD23F" {...I} /><g transform="rotate(-8 270 55)"><rect x="224" y="30" width="92" height="48" rx="8" fill="#fff" {...I} /><text x="270" y="64" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="28" fill="#FF3B30">$125</text></g></> },
  rent: { bg: '#3B5998', node: <><path d="M110 62l70-40 70 40z" fill="#FF3B30" {...I} /><rect x="124" y="62" width="112" height="40" fill="#FFE3B8" {...I} /><rect x="168" y="76" width="24" height="26" fill="#8B5A2B" {...I} strokeWidth="2.5" /><circle cx="282" cy="54" r="22" fill="#FFD23F" {...I} /><path d="M282 42v24M276 48h9a4 4 0 0 1 0 8h-8a4 4 0 0 0 0 8h10" fill="none" stroke="#121212" strokeWidth="3" strokeLinecap="round" /></> },
  ice: { bg: '#2F5D8A', node: <><Flakes n={18} /><path d="M180 18v78M141 40l78 34M141 74l78-34" stroke="#fff" strokeWidth="8" strokeLinecap="round" /><circle cx="180" cy="57" r="9" fill="#B8E8FF" {...I} /></> },
  briefcase: { bg: '#2B6B4F', node: <><path d="M150 36v-8a8 8 0 0 1 8-8h44a8 8 0 0 1 8 8v8" fill="none" {...I} /><rect x="116" y="36" width="128" height="62" rx="10" fill="#FFB86B" {...I} /><path d="M116 62h128" stroke="#121212" strokeWidth="3" /><rect x="170" y="56" width="20" height="14" rx="3" fill="#FFD23F" {...I} strokeWidth="2.5" /><path className="twinkle" d="M290 24l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z" fill="#FFD23F" {...I} strokeWidth="2.5" /></> },
  meal: { bg: '#9A4A2A', node: <><circle cx="180" cy="58" r="42" fill="#fff" {...I} /><circle cx="180" cy="58" r="26" fill="#FF9F43" {...I} strokeWidth="2.5" /><path d="M172 48q8-10 16 0M170 62q10 8 20 0" fill="none" stroke="#121212" strokeWidth="3" strokeLinecap="round" /><path d="M96 20v38M104 20v38M112 20v38M104 58v36M262 20c-10 12-10 30 0 38v36" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" /></> },
  delay: { bg: '#3E4E7A', node: <><Streetcar /><path d="M10 100h340" stroke="#fff" strokeWidth="4" strokeDasharray="14 8" /><circle cx="318" cy="34" r="20" fill="#FFD23F" {...I} /><path d="M318 34V22M318 34l9 5" stroke="#121212" strokeWidth="3.5" strokeLinecap="round" /></> },
  weather: { bg: '#3E5C8A', node: <><Flakes n={12} /><path d="M120 76a20 20 0 0 1-2-40 26 26 0 0 1 50-8 18 18 0 0 1 8 48z" fill="#B8C4DB" {...I} transform="translate(30 0)" /><path d="M190 90l-4 12M210 90l-4 12M230 90l-4 12" stroke="#4CC9F0" strokeWidth="5" strokeLinecap="round" /></> },
  laundry: { bg: '#3A5A8A', node: <><rect x="120" y="22" width="90" height="80" rx="10" fill="#fff" {...I} /><circle cx="165" cy="64" r="26" fill="#4CC9F0" {...I} /><circle className="spin" cx="165" cy="64" r="15" fill="none" stroke="#fff" strokeWidth="5" strokeDasharray="22 60" strokeLinecap="round" /><circle cx="136" cy="36" r="4" fill="#FF3B30" /><rect x="150" y="31" width="40" height="9" rx="3" fill="#B8C4DB" /><path d="M250 38l22-10 22 10-8 10v34h-28V48z" fill="#FF6FB5" {...I} /><path d="M236 100c10-8 20-8 30 0s20 8 30 0" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" /></> },
  crush: { bg: '#3B2A5A', node: <><rect x="0" y="82" width="360" height="28" fill="#4A4A66" {...I} /><path d="M0 84h360" stroke="#FFD23F" strokeWidth="7" />{[40, 78, 116, 154, 192, 230, 268, 306].map((x, i) => <g key={x}><circle cx={x} cy={52 + (i % 2) * 3} r="12" fill={['#FFE3B8', '#F2C28B', '#C98F5B'][i % 3]} {...I} strokeWidth="2.5" /><rect x={x - 11} y="64" width="22" height="22" rx="7" fill={['#FF3B30', '#4CC9F0', '#2EE6A6', '#FFD23F'][i % 4]} {...I} strokeWidth="2.5" /></g>)}<rect x="250" y="8" width="96" height="22" rx="5" fill="#FF3B30" {...I} /><text x="298" y="24" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="15" fill="#fff">FULL</text></> },
  city: { bg: '#2B1E5E', node: <><rect x="40" y="46" width="50" height="56" fill="#4CC9F0" {...I} /><rect x="96" y="30" width="44" height="72" fill="#FF6FB5" {...I} /><path d="M180 102V50h6V22l-3-8h-2l1-6h4l1 6h-2l-3 8v28h6v52z" fill="#FF3B30" {...I} /><ellipse cx="183" cy="48" rx="12" ry="6" fill="#FFD23F" {...I} strokeWidth="2.5" /><rect x="216" y="40" width="50" height="62" fill="#FFD23F" {...I} /><rect x="272" y="60" width="44" height="42" fill="#2EE6A6" {...I} /></> },
}

function pick(e: GameEvent): string {
  const id = e.event_id.toLowerCase()
  const table: [string, string][] = [
    ['blizzard', 'blizzard'], ['loblaws', 'loblaws'], ['presto', 'presto'], ['york', 'york'], ['eaton', 'eaton'],
    ['midterm', 'midterm'], ['tim_hortons', 'tim'], ['dundas', 'dundas'], ['wifi', 'wifi'], ['textbook', 'textbook'], ['slot10', 'textbook'],
    ['rent', 'rent'], ['laundry', 'laundry'], ['crush', 'crush'], ['meal_plan', 'meal'], ['ice_storm', 'ice'], ['ttc_delay', 'delay'], ['opportunity', 'briefcase'], ['final_push', 'meal'],
  ]
  for (const [k, v] of table) if (id.includes(k)) return v
  if (e.api_dependencies?.transit_delay_key) return 'delay'
  if (e.api_dependencies?.weather_severity_key) return 'weather'
  return 'city'
}

/** Banner above the narrative. A client-supplied `image` URL always wins over the drawn scene. */
export function Scene({ event }: { event: GameEvent }) {
  if (event.image) return <img className="scene scene-img" src={event.image} alt="" />
  const s = art[pick(event)]
  return (
    <svg className="scene" viewBox="0 0 360 110" preserveAspectRatio="xMidYMid slice" role="presentation" aria-hidden="true">
      <rect width="360" height="110" fill={s.bg} />
      {s.node}
    </svg>
  )
}
