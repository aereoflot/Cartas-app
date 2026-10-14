import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { AppRoutes } from '@/App'

// A signed-in author, with no backend behind them: enough to drive the form,
// which is what these tests are about.
vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }))
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: { user: { id: 'author-1' } }, pending: false }),
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
})

describe('crear un juego por pasos', () => {
  it('pregunta primero para quién es, y mantiene cerrado el resto', async () => {
    mount('/games/new')

    expect(await screen.findByRole('button', { name: /Para ti o para todos/ }))
      .toBeInTheDocument()
    // the later steps are shut until that is answered
    expect(screen.getByRole('button', { name: /Nombre y de qué va/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Las reglas/ })).toBeDisabled()
  })

  it('en privado basta el nombre, y lo dice', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))

    // choosing opens the next step for you
    await userEvent.type(screen.getByLabelText('Nombre del juego'), 'Burro con sal')

    await userEvent.click(screen.getByRole('button', { name: /Guardar$/ }))
    const save = screen.getByRole('button', { name: 'Guardar solo para mí' })
    expect(save).toBeEnabled()
    expect(screen.getByText(/Se guarda solo para ti/)).toBeInTheDocument()
    // and no list of complaints: an empty box is a choice here
    expect(screen.queryByText(/El resumen necesita al menos una frase/)).not.toBeInTheDocument()
  })

  it('en público exige los mínimos antes de dejar enviarlo', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Para todos/ }))
    await userEvent.type(screen.getByLabelText('Nombre del juego'), 'Burro con sal')

    await userEvent.click(screen.getByRole('button', { name: /Revisar y enviar/ }))
    expect(screen.getByRole('button', { name: 'Enviar a revisión' })).toBeDisabled()
    // each problem is listed behind a bullet, hence the loose match
    expect(screen.getByText(/El resumen necesita al menos una frase/)).toBeInTheDocument()
    expect(screen.getByText(/entra en la cola de revisión/)).toBeInTheDocument()
    // parking it privately is still allowed, with just the name
    expect(screen.getByRole('button', { name: 'Guardar solo para mí' })).toBeEnabled()
  })

  it('marca los pasos a los que les falta algo cuando va a ser público', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Para todos/ }))

    expect(screen.getByRole('button', { name: /Las reglas.*falta algo/ })).toBeInTheDocument()
  })

  it('trae el nombre escrito en el buscador', async () => {
    mount('/games/new?title=burro')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))
    expect(screen.getByLabelText('Nombre del juego')).toHaveValue('burro')
  })
})
