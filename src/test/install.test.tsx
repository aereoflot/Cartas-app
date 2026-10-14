import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import i18n from '@/i18n'
import { InstallInvite } from '@/components/InstallInvite'

// A backend exists but nobody is signed in: the state the sheet is written for.
// Mocked rather than configured so the catalogue stays on the sample file.
vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }))

const show = () =>
  render(
    <MemoryRouter>
      <InstallInvite enabled />
    </MemoryRouter>,
  )

/** jsdom has no service worker, and without one the app is not installable. */
const browserThatCanInstall = () => {
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: {},
    configurable: true,
  })
}

/** What Chrome hands over, reduced to the two things the module touches. */
const chromeOffers = () => {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'accepted' as const })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

/** Past the settle delay, so the sheet has decided to show itself. */
const settle = () => act(() => vi.advanceTimersByTime(900))

beforeEach(async () => {
  window.localStorage.clear()
  vi.useFakeTimers()
  await i18n.changeLanguage('es')
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(window.navigator, 'serviceWorker')
  // the captured offer lives in the module, so retire it between tests
  window.dispatchEvent(new Event('appinstalled'))
})

describe('invitación a instalar', () => {
  it('no interrumpe en un navegador que no puede instalar', () => {
    show()
    settle()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('el botón está siempre, también sin oferta del navegador', () => {
    browserThatCanInstall()
    show()
    settle()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Instalar la app' })).toBeInTheDocument()
    // the instructions wait behind a link rather than taking the button's place
    expect(screen.queryByText('Abre el menú de tu navegador.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver cómo se instala' })).toBeInTheDocument()
  })

  it('sin oferta, pulsar el botón abre las instrucciones en el sitio', async () => {
    browserThatCanInstall()
    show()
    settle()

    fireEvent.click(screen.getByRole('button', { name: 'Instalar la app' }))
    await act(async () => undefined)
    expect(screen.getByText('Abre el menú de tu navegador.')).toBeInTheDocument()
    // and the sheet is still there: nothing was closed out from under them
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('con oferta, el botón abre el diálogo del navegador', async () => {
    browserThatCanInstall()
    const offer = chromeOffers()
    show()
    settle()

    fireEvent.click(screen.getByRole('button', { name: 'Instalar la app' }))
    expect(offer.prompt).toHaveBeenCalledOnce()
    await act(async () => undefined)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // The bug this replaced: a timer swapped the button for instructions a second
  // after the sheet opened, so the button moved while you reached for it.
  it('la oferta nunca sustituye el botón por instrucciones', () => {
    browserThatCanInstall()
    chromeOffers()
    show()
    settle()
    settle()

    expect(screen.getByRole('button', { name: 'Instalar la app' })).toBeInTheDocument()
    expect(screen.queryByText('Abre el menú de tu navegador.')).not.toBeInTheDocument()
    expect(screen.queryByText('Toca Compartir en la barra de Safari.')).not.toBeInTheDocument()
  })

  it('pregunta por la cuenta en la misma hoja, con el invitado como respuesta válida', () => {
    browserThatCanInstall()
    show()
    settle()

    expect(screen.getByText('¿Con cuenta o como invitado?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seguir como invitado' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('un no se recuerda, y no vuelve a preguntar en la siguiente visita', () => {
    browserThatCanInstall()
    show()
    settle()
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    cleanup()
    show()
    settle()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
