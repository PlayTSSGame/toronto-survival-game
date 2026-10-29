/** Inventory icons, matched by the item's display name. */
export function ItemIcon({ name, size = 26 }: { name: string; size?: number }) {
  const n = name.toLowerCase()
  const ink = { stroke: '#121212', strokeWidth: 3, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {n.includes('presto') ? (
        <>
          <rect x="2" y="7" width="28" height="19" rx="4" fill="#2EE6A6" {...ink} />
          <rect x="6" y="11" width="8" height="6" rx="1.5" fill="#FFD23F" stroke="#121212" strokeWidth="2" />
          <path d="M6 22h14M24 14v8" stroke="#121212" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : n.includes('espresso') || n.includes('surge') ? (
        <>
          <rect x="9" y="3" width="14" height="26" rx="4" fill="#121212" stroke="#FFD23F" strokeWidth="3" />
          <path d="M17 8l-5 8h4l-1 7 6-9h-4z" fill="#FFD23F" />
        </>
      ) : n.includes('lanyard') ? (
        <>
          <path d="M9 2l7 12 7-12" fill="none" stroke="#4CC9F0" strokeWidth="4" strokeLinejoin="round" />
          <rect x="9" y="14" width="14" height="16" rx="3" fill="#fff" {...ink} />
          <rect x="12" y="18" width="8" height="5" rx="1" fill="#4CC9F0" />
        </>
      ) : n.includes('meal') ? (
        <>
          <circle cx="16" cy="17" r="11" fill="#fff" {...ink} />
          <circle cx="16" cy="17" r="6" fill="#FF9F43" stroke="#121212" strokeWidth="2" />
          <path d="M3 4v8M5.5 4v8M8 4v8M5.5 12v8" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <rect x="4" y="9" width="24" height="18" rx="3" fill="#FFB86B" {...ink} />
          <path d="M4 15h24M16 9v6" stroke="#121212" strokeWidth="2.5" />
        </>
      )}
    </svg>
  )
}
