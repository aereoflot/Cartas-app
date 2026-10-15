import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { AppRoutes } from '@/App'

/**
 * Three things a reader meets on a game's page: the flag for reporting it, the
 * expert's "we are working on it", and the line that appears when the signal
 * goes. All of them are about saying what is true rather than letting somebody
 * find out by being surprised.
 */

vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }))

let signedIn = true
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    session: signedIn
      ? { user: { id: 'me', email: 'ana@correo.com', user_metadata: {} } }
      : null,
    pending: false,
  }),
}))

const mount = (path: string) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  await i18n.changeLanguage('es')
  signedIn = true
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
})

describe('reportar un juego', () => {
  it('hay una bandera arriba, en la ficha, y no estorba', async () => {
    mount('/games/mus')
    expect(await screen.findByRole('button', { name: 'Reportar este juego' })).toBeInTheDocument()
    // cerrado hasta que se pide: lo normal con un juego es jugarlo
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pregunta qué pasa, con motivos concretos y sitio para contarlo', async () => {
    mount('/games/mus')
    await userEvent.click(await screen.findByRole('button', { name: 'Reportar este juego' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Sobre «Mus»/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Las reglas están mal o incompletas/ }))
      .toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /El texto está copiado/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Cuéntame más/)).toBeInTheDocument()
  })

  it('el detalle es opcional: se puede enviar solo con el motivo', async () => {
    mount('/games/mus')
    await userEvent.click(await screen.findByRole('button', { name: 'Reportar este juego' }))
    expect(screen.getByRole('button', { name: 'Enviar el reporte' })).toBeEnabled()
  })

  it('se cierra sin enviar nada', async () => {
    mount('/games/mus')
    await userEvent.click(await screen.findByRole('button', { name: 'Reportar este juego' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sin cuenta lo dice, y dice por qué, en vez de fallar al enviar', async () => {
    signedIn = false
    mount('/games/mus')
    await userEvent.click(await screen.findByRole('button', { name: 'Reportar este juego' }))

    expect(screen.getByText(/en nombre de otra persona/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar el reporte' })).not.toBeInTheDocument()
  })
})

describe('el experto, mientras esté apagado', () => {
  it('dice que estamos trabajando en ello, y qué hacer entretanto', async () => {
    mount('/ai')
    expect(await screen.findByText('Estamos trabajando en ello.')).toBeInTheDocument()
    expect(screen.getByText(/las reglas de cada juego están completas en su ficha/))
      .toBeInTheDocument()
    // y no un formulario que fallaría siempre
    expect(screen.queryByRole('button', { name: /Preguntar/ })).not.toBeInTheDocument()
  })

  it('no pide cuenta para leer un cartel', async () => {
    signedIn = false
    mount('/ai')
    expect(await screen.findByText('Estamos trabajando en ello.')).toBeInTheDocument()
    expect(screen.queryByText(/Entra con tu correo/)).not.toBeInTheDocument()
  })

  it('la ficha de un juego no ofrece botones del experto mientras no esté', async () => {
    mount('/games/mus')
    await screen.findByRole('heading', { name: 'Mus' })
    expect(screen.queryByRole('link', { name: /Explícamelo/ })).not.toBeInTheDocument()
  })
})

describe('sin conexión', () => {
  it('lo dice, y dice que nada se pierde', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    mount('/games/mus')

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(/Sin conexión/)
    expect(notice).toHaveTextContent(/no se guardan en tu cuenta hasta que vuelva la señal/)
    expect(notice).toHaveTextContent(/Nada se pierde/)
  })

  it('no aparece con conexión', async () => {
    mount('/games/mus')
    await screen.findByRole('heading', { name: 'Mus' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('no se le dice a quien no tiene cuenta: no hay nada que sincronizar', async () => {
    signedIn = false
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    mount('/games/mus')

    await screen.findByRole('heading', { name: 'Mus' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('las reglas en otro idioma', () => {
  it('con la app en inglés, avisa de que las reglas están en español', async () => {
    await i18n.changeLanguage('en')
    mount('/games/mus')

    expect(await screen.findByText(/These rules are written in Spanish/)).toBeInTheDocument()
  })

  it('en español no avisa de nada, porque no hay nada que avisar', async () => {
    mount('/games/mus')
    await screen.findByRole('heading', { name: 'Mus' })
    expect(screen.queryByText(/todavía no hay traducción/)).not.toBeInTheDocument()
  })
})
