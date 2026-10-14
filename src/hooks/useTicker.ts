import { useEffect, useState } from 'react'

/** Re-renders every `ms` while `active`, for clocks. */
export function useTicker(active: boolean, ms = 1000): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setTick((t) => t + 1), ms)
    return () => window.clearInterval(id)
  }, [active, ms])

  return tick
}
