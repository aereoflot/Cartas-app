import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  canInstallAtAll,
  canPromptInstall,
  isStandalone,
  manualRoute,
  promptInstall,
  subscribeInstall,
  type InstallOutcome,
} from '@/lib/install'
import { readJson, writeJson } from '@/lib/store'

const KEY = 'cartas.installInvite'
const ASK_AGAIN_DAYS = 30
/** Long enough for the first paint, short enough to still feel like "on open". */
const SETTLE_MS = 600

interface Answered {
  at: string
}

/** Remember the answer: a pop-up on every visit is what people uninstall over. */
export function rememberInstallAnswer(): void {
  writeJson(KEY, { at: new Date().toISOString() })
}

function answeredRecently(): boolean {
  const answer = readJson<Answered | null>(KEY, null)
  if (answer === null) return false
  const days = (Date.now() - new Date(answer.at).getTime()) / 86_400_000
  return Number.isFinite(days) && days < ASK_AGAIN_DAYS
}

export interface InstallOffer {
  /** True when the browser has a dialog ready, so the button opens it in one tap. */
  ready: boolean
  /** Which by-hand instructions to show when there is no dialog. */
  route: 'ios' | 'other'
  /** Always callable. 'unavailable' means: show the instructions instead. */
  install: () => Promise<InstallOutcome>
}

/**
 * The install button's state, wherever it appears. The button is always live:
 * if the browser handed over a dialog it opens it, and if it did not the caller
 * falls back to instructions. Nothing here ever takes the button away, because
 * a button that turns into a paragraph while somebody is reaching for it is
 * worse than either on its own.
 */
export function useInstallOffer(): InstallOffer {
  const ready = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false)
  const [route] = useState<'ios' | 'other'>(() => {
    try {
      return manualRoute()
    } catch {
      return 'other'
    }
  })

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const outcome = await promptInstall()
    // Accepted or declined, the question has been put; only 'unavailable'
    // leaves it open, and that is answered by the instructions.
    if (outcome !== 'unavailable') rememberInstallAnswer()
    return outcome
  }, [])

  return { ready, route, install }
}

/**
 * Whether to interrupt with the welcome sheet at all: not when the app is
 * already installed, not where it could never be installed, and not if this
 * device answered within the last month.
 */
export function useInstallInvite(enabled: boolean): { offered: boolean; dismiss: () => void } {
  const [offered, setOffered] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let live = true
    try {
      if (!canInstallAtAll() || answeredRecently()) return
    } catch {
      return
    }

    const timer = window.setTimeout(() => {
      if (live && !isStandalone()) setOffered(true)
    }, SETTLE_MS)

    // installed from the browser's own menu while the sheet was up
    const unsubscribe = subscribeInstall(() => {
      if (live && isStandalone()) setOffered(false)
    })

    return () => {
      live = false
      window.clearTimeout(timer)
      unsubscribe()
    }
  }, [enabled])

  const dismiss = useCallback(() => {
    rememberInstallAnswer()
    setOffered(false)
  }, [])

  return { offered, dismiss }
}
