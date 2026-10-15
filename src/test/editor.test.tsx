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

/** Open a step by its heading. */
const openStep = async (name: RegExp) =>
  userEvent.click(screen.getByRole('button', { name }))

describe('crear un juego, los cinco pasos', () => {
  it('pregunta primero para quién es, y mantiene cerrado el resto', async () => {
    mount('/games/new')

    expect(await screen.findByRole('button', { name: /Para ti o para todos/ }))
      .toBeInTheDocument()
    // the later steps are shut until that is answered
    expect(screen.getByRole('button', { name: /^Nombre/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Descripción/ })).toBeDisabled()
  })

  it('son cinco pasos y se llaman como lo que piden', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))

    for (const step of [
      /^Nombre/,
      /Breve descripción/,
      /^Descripción/,
      /Qué se necesita/,
      /^Notas/,
    ]) {
      expect(screen.getByRole('button', { name: step })).toBeEnabled()
    }
    // y ni rastro de los pasos que se fueron
    expect(screen.queryByRole('button', { name: /Las reglas/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Jugadores/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Con qué se juega/ })).not.toBeInTheDocument()
  })

  it('cada paso dice si está completo, si falta algo o si es opcional', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Para todos/ }))

    // nothing written yet: the name is missing and says so on its own row
    expect(screen.getByRole('button', { name: /^Nombre.*falta algo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Notas.*opcional/ })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Nombre del juego/), 'Burro con sal')
    await openStep(/Breve descripción/)

    expect(screen.getByRole('button', { name: /^Nombre.*completo/ })).toBeInTheDocument()
  })

  it('el paso abierto explica qué le falta, con el límite real', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Para todos/ }))
    await openStep(/Breve descripción/)

    expect(screen.getByText(/El resumen necesita entre 10 y 600/)).toBeInTheDocument()
    // y cuenta lo que queda mientras se escribe
    await userEvent.type(screen.getByLabelText(/Resumen/), 'Corto')
    expect(screen.getByText(/Te faltan 5 caracteres/)).toBeInTheDocument()
  })

  it('en privado pide el nombre y la frase, que es lo que exige la base de datos', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))
    await userEvent.type(screen.getByLabelText(/Nombre del juego/), 'Burro con sal')

    await openStep(/^Guardar/)
    // con solo el nombre no se puede: game_texts exige un resumen de 10 caracteres
    expect(screen.getByRole('button', { name: 'Guardar solo para mí' })).toBeDisabled()

    await openStep(/Breve descripción/)
    await userEvent.type(
      screen.getByLabelText(/Resumen/),
      'Lo que me contó mi abuela en la cocina.',
    )
    await openStep(/^Guardar/)

    expect(screen.getByRole('button', { name: 'Guardar solo para mí' })).toBeEnabled()
    expect(screen.getByText(/Se guarda solo para ti/)).toBeInTheDocument()
    // y no pide baraja, ni cómo se juega, ni la casilla del texto propio
    expect(screen.queryByText(/Falta elegir la baraja/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Falta contar cómo se juega/)).not.toBeInTheDocument()
    expect(screen.queryByText(/el texto es tuyo/)).not.toBeInTheDocument()
  })

  it('en público pide además cómo se juega y la baraja, y nada más', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Para todos/ }))
    await userEvent.type(screen.getByLabelText(/Nombre del juego/), 'Burro con sal')
    await openStep(/Breve descripción/)
    await userEvent.type(
      screen.getByLabelText(/Resumen/),
      'Un juego rápido para toda la familia.',
    )

    await openStep(/Revisar y enviar/)
    expect(screen.getByRole('button', { name: 'Enviar a revisión' })).toBeDisabled()
    expect(screen.getByText(/Falta contar cómo se juega/)).toBeInTheDocument()
    expect(screen.getByText(/Marca la casilla de que el texto es tuyo/)).toBeInTheDocument()
    // aparcarlo en privado sí se puede: el nombre y la frase ya están
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled()

    // escribir cómo se juega y marcar la casilla es todo lo que queda
    await openStep(/^Descripción/)
    await userEvent.type(
      screen.getByLabelText(/Cómo se juega/),
      'Se reparten tres cartas a cada uno y gana quien se queda sin ninguna.',
    )
    await openStep(/Revisar y enviar/)
    await userEvent.click(screen.getByRole('checkbox', { name: /no he copiado el texto/ }))

    expect(screen.getByRole('button', { name: 'Enviar a revisión' })).toBeEnabled()
  })

  it('los apartados de más están plegados y no estorban', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))
    await openStep(/^Descripción/)

    // the one box is there, the rest are behind a line you have to ask for
    expect(screen.getByLabelText(/Cómo se juega/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Puntuación')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Añadir apartados/ }))
    expect(screen.getByLabelText('Puntuación')).toBeInTheDocument()
    expect(screen.getByLabelText('Objetivo')).toBeInTheDocument()
  })

  it('«qué se necesita» reúne jugadores, baraja, duración y dificultad', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))
    await openStep(/Qué se necesita/)

    expect(screen.getByLabelText('Mínimo')).toBeInTheDocument()
    expect(screen.getByLabelText('Baraja')).toBeInTheDocument()
    expect(screen.getByLabelText('Duración mínima (min)')).toBeInTheDocument()
    expect(screen.getByText('Dificultad')).toBeInTheDocument()
    expect(screen.getByText('Edad mínima')).toBeInTheDocument()
  })

  it('la edad va por botones, así que el 0 que rompía el guardado no se puede escribir', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))
    await openStep(/Qué se necesita/)

    expect(screen.getByText('Todas las edades').closest('button')).toBeInTheDocument()
    // ya no hay caja de número donde escribir un 0
    const ageField = screen.getByText('Edad mínima').closest('label')
    expect(ageField?.querySelector('input')).toBeNull()

    const twelve = screen.getByText('12+').closest('button') as HTMLElement
    await userEvent.click(twelve)
    expect(twelve).toHaveAttribute('aria-pressed', 'true')
  })

  it('ajusta un número imposible en vez de dejar que lo rechace la base de datos', async () => {
    mount('/games/new')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))
    await openStep(/Qué se necesita/)

    const max = screen.getByLabelText('Máximo')
    await userEvent.clear(max)
    await userEvent.type(max, '200')
    await userEvent.tab()
    // 64 es el techo de la columna: se queda ahí solo
    expect(max).toHaveValue(64)
  })

  it('trae el nombre escrito en el buscador', async () => {
    mount('/games/new?title=burro')
    await userEvent.click(await screen.findByRole('button', { name: /Solo para mí/ }))
    expect(screen.getByLabelText(/Nombre del juego/)).toHaveValue('burro')
  })
})
