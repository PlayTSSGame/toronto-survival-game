/** One medal per rank, drawn in the same flat style. */

const I = { stroke: '#121212', strokeWidth: 3.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

const MEDALS: Record<string, { ring: string; face: string; art: React.ReactNode }> = {
  'Frozen Sub-Way Dweller': { ring: '#B8E8FF', face: '#3E6FA8', art: <path d="M50 22v56M26 36l48 28M26 64l48-28M42 26l8 8 8-8M42 74l8-8 8 8" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> },
  'Streetcar Casualty': { ring: '#FF9F43', face: '#7A2A2A', art: <><rect x="24" y="38" width="52" height="26" rx="8" fill="#FF3B30" {...I} /><rect x="32" y="44" width="12" height="10" rx="2" fill="#B8E8FF" /><rect x="56" y="44" width="12" height="10" rx="2" fill="#B8E8FF" /><path d="M30 24l4 8M50 18v10M70 24l-4 8" stroke="#FFD23F" strokeWidth="5" strokeLinecap="round" /></> },
  'Bay Street Executive': { ring: '#FFD23F', face: '#1F6B4A', art: <><path d="M32 26h36v20a18 18 0 0 1-36 0z" fill="#FFD23F" {...I} /><path d="M32 32H20c0 12 6 16 14 16M68 32h12c0 12-6 16-14 16" fill="none" {...I} /><path d="M44 66h12M38 76h24" {...I} /></> },
  'Condo Conqueror': { ring: '#4CC9F0', face: '#4B3B8C', art: <><rect x="30" y="24" width="40" height="54" fill="#FF6FB5" {...I} />{[34, 46, 58].map((y) => <g key={y}><rect x="37" y={y} width="9" height="8" fill="#fff" /><rect x="54" y={y} width="9" height="8" fill="#fff" /></g>)}<circle cx="74" cy="30" r="9" fill="#FFD23F" {...I} /></> },
  'Overdraft Legend': { ring: '#FF3B30', face: '#3A1F1F', art: <><circle cx="50" cy="50" r="26" fill="#FFD23F" {...I} /><path d="M36 50h28" stroke="#121212" strokeWidth="7" strokeLinecap="round" /></> },
  'Commuter Master': { ring: '#2EE6A6', face: '#25546B', art: <><path d="M26 66l-6-34 18 14 12-22 12 22 18-14-6 34z" fill="#FFD23F" {...I} /><circle cx="50" cy="52" r="4.5" fill="#FF3B30" /></> },
  'Endless Legend': { ring: '#A78BFA', face: '#2B1E5E', art: <><path d="M26 50c0-12 10-18 24-6s24 6 24-6M26 50c0 12 10 18 24 6s24-6 24 6" transform="translate(-12 0) scale(.84 .84) translate(12 8)" fill="none" stroke="#FFD23F" strokeWidth="7" strokeLinecap="round" /><circle cx="50" cy="26" r="5" fill="#fff" {...I} /></> },
  "Tim's Coffee Survivor": { ring: '#FF6FB5', face: '#7A3A1F', art: <><path d="M32 40h36l-5 34H37z" fill="#fff" {...I} /><path d="M30 40h40v-9H30z" fill="#FF3B30" {...I} /><path d="M44 24q-5-7 0-12M56 24q-5-7 0-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" /></> },
}

export function RankBadge({ rank, size = 130 }: { rank: string; size?: number }) {
  const m = MEDALS[rank] ?? MEDALS['Commuter Master']
  return (
    <svg className="medal" width={size} height={size} viewBox="0 0 100 112" aria-hidden="true">
      <path d="M30 70L20 108l14-7 8 9 6-32zM70 70l10 38-14-7-8 9-6-32z" fill="#FF3B30" {...I} strokeWidth="3" />
      <circle cx="50" cy="48" r="44" fill={m.ring} {...I} />
      <circle cx="50" cy="48" r="34" fill={m.face} stroke="#121212" strokeWidth="3" />
      {m.art}
    </svg>
  )
}
