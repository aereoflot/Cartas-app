import { useCallback, useEffect, useState } from 'react'
import { readJson, writeJson } from '@/lib/store'

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'cartas.theme'

function apply(choice: ThemeChoice): void {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (choice !== 'system') root.classList.add(choice)
}

export function useTheme(): [ThemeChoice, (next: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(() =>
    readJson<ThemeChoice>(KEY, 'system'),
  )

  useEffect(() => {
    apply(choice)
  }, [choice])

  const set = useCallback((next: ThemeChoice) => {
    setChoice(next)
    writeJson(KEY, next)
  }, [])

  return [choice, set]
}
