import { useEffect, useRef, useState } from 'react'

/** Counts toward `value` instead of jumping. Always settles on the exact value. */
export function Count({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    const start = from.current
    if (start === value) return
    const slow = document.documentElement.classList.contains('calm')
    const dur = slow ? 0 : 550
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = dur === 0 ? 1 : Math.min(1, (now - t0) / dur)
      const eased = 1 - (1 - p) ** 3
      const v = p === 1 ? value : start + (value - start) * eased
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <>{format(Math.abs(shown - value) < 0.005 ? value : shown)}</>
}
