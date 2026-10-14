/**
 * Installing the app, and the facts needed to offer it honestly.
 *
 * Chrome fires `beforeinstallprompt` once, within a moment of the page loading,
 * and the event is the only handle on its install dialog. A component that
 * mounts later — the profile tab, say — would never see it, so it is caught here
 * at module load and kept. That is also why this is a module and not a hook.
 *
 * iOS Safari never fires it and never will, so there the only honest offer is to
 * point at the share sheet. Everything else gets pointed at its own menu.
 */

/** Not in TypeScript's DOM library: a Chromium extension to the standard. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function announce(): void {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Preventing the default is what stops Chrome's own mini-infobar and hands
    // the timing to us; it also means this event is now the only way in.
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    announce()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    announce()
  })
}

/** For useSyncExternalStore: fires when the browser's offer arrives or expires. */
export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** True when the browser has handed over a dialog we can open on demand. */
export function canPromptInstall(): boolean {
  return deferred !== null
}

/**
 * Open the browser's install dialog. Returns 'unavailable' when there is none,
 * which is the caller's cue to show instructions instead — on iOS, and on any
 * browser that simply never made the offer.
 */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred
  if (event === null) return 'unavailable'
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    // good for one use, whatever the answer
    deferred = null
    announce()
    return outcome
  } catch {
    deferred = null
    announce()
    return 'unavailable'
  }
}

/** Already installed: running from the home screen, so there is nothing to offer. */
export function isStandalone(): boolean {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    // iOS predates the media query and reports it here instead
    return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

/** Which set of by-hand instructions applies. */
export function manualRoute(): 'ios' | 'other' {
  const ua = window.navigator.userAgent
  // iPadOS 13+ claims to be a Mac and gives itself away by the touch points
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  return ios ? 'ios' : 'other'
}

/**
 * Whether installing is possible at all. Chrome requires a service worker
 * before it will offer, so without support there is nothing to promise.
 */
export function canInstallAtAll(): boolean {
  return 'serviceWorker' in navigator && !isStandalone()
}
