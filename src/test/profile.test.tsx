import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { ProfilePage } from '@/features/profile/ProfilePage'

/**
 * The profile as somebody uses it: drawers that say what they hold, an account
 * section with the things that were scattered, and the state of a game you
 * sent for review said in a sentence rather than in one word.
 */

vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }))
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({
    session: { user: { id: 'me', email: 'ana@correo.com', user_metadata: {} } },
    pending: false,
  }),
}))
vi.mock('@/lib/profile', () => ({
  fetchMyProfile: () =>
    Promise.resolve({
      id: 'me',
      username: 'ana_cartas',
      displayName: 'Ana',
      locale: 'es',
      role: 'user',
    }),
  fetchMySettings: () => Promise.resolve({ birthdate: '1990-07-04', hideAdult: false }),
  updateMyProfile: () => Promise.resolve('saved'),
}))
vi.mock('@/lib/gameWrite', () => ({
  listMyGames: () =>
    Promise.resolve([
      { id: '1', slug: 'mi-juego', status: 'pending_review', title: 'Mi juego', reason: null },
      { id: '2', slug: 'otro', status: 'rejected', title: 'Otro', reason: 'Le faltan las reglas.' },
    ]),
}))

const syncState = { status: 'saved' as string, error: null as string | null, failed: null as string | null }
vi.mock('@/hooks/useSync', () => ({
  useSync: () => undefined,
  useSyncState: () => syncState,
}))

const mount = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  await i18n.changeLanguage('es')
  syncState.status = 'saved'
  syncState.error = null
  syncState.failed = null
})

describe('el perfil, en desplegables', () => {
  it('todo está plegado y cada cajón dice lo que guarda', async () => {
    mount()
    for (const name of [
      /^Cuenta/,
      /Mis juegos/,
      /Partidas y amigos/,
      /Privacidad y tus datos/,
    ]) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument()
    }
    // plegado: lo de dentro no está en pantalla hasta que se abre
    expect(screen.queryByLabelText(/Nombre que ven los demás/)).not.toBeInTheDocument()
  })

  it('la casilla de esconder los juegos +18 ya no está aquí', async () => {
    mount()
    await screen.findByRole('button', { name: /^Cuenta/ })
    expect(screen.queryByText(/Esconder los juegos/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ajustes/)).not.toBeInTheDocument()
  })

  it('en Cuenta están el nombre, el usuario, el correo y la contraseña', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /^Cuenta/ }))

    expect(screen.getByLabelText(/Nombre que ven los demás/)).toHaveValue('Ana')
    expect(screen.getByLabelText('Nombre de usuario')).toHaveValue('ana_cartas')
    expect(screen.getByLabelText('Contraseña actual')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
    // el correo, con su aviso de que es lo único que recupera la contraseña
    expect(screen.getByText(/lo único con lo que se puede recuperar/)).toBeInTheDocument()
  })

  it('el usuario se puede cambiar, que antes estaba clavado', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /^Cuenta/ }))

    const box = screen.getByLabelText('Nombre de usuario')
    expect(box).toBeEnabled()
    await userEvent.clear(box)
    await userEvent.type(box, 'ana_la_del_mus')
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('mayúsculas y espacios se arreglan solos, sin regañar a nadie', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /^Cuenta/ }))

    const box = screen.getByLabelText('Nombre de usuario')
    await userEvent.clear(box)
    await userEvent.type(box, 'Ana Con Espacios')
    // se guarda como ana_con_espacios: no hay nada que corregir a mano
    expect(screen.queryByText(/Solo minúsculas sin acentos/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('un usuario con ñ o tildes sí se avisa, porque la columna no lo acepta', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /^Cuenta/ }))

    const box = screen.getByLabelText('Nombre de usuario')
    await userEvent.clear(box)
    await userEvent.type(box, 'añoño')
    expect(screen.getByText(/Solo minúsculas sin acentos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  })

  it('un usuario de dos letras se avisa, que es el mínimo de la columna', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /^Cuenta/ }))

    const box = screen.getByLabelText('Nombre de usuario')
    await userEvent.clear(box)
    await userEvent.type(box, 'an')
    expect(screen.getByText(/mínimo 3 caracteres/)).toBeInTheDocument()
  })

  it('la fecha de nacimiento se ve pero no se toca', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /^Cuenta/ }))

    const label = await screen.findByText('Fecha de nacimiento')
    expect(label).toBeInTheDocument()
    // ni caja ni casilla: solo el dato y para qué sirve
    expect(screen.queryByLabelText('Fecha de nacimiento')).not.toBeInTheDocument()
    expect(screen.getByText(/decidimos si ves los juegos de adultos/)).toBeInTheDocument()
  })
})

describe('el estado de un juego que mandaste a revisión', () => {
  it('el cajón avisa de cuántos esperan, sin abrirlo', async () => {
    mount()
    expect(await screen.findByRole('button', { name: /Mis juegos.*1 en revisión/ }))
      .toBeInTheDocument()
  })

  it('dentro, cada juego dice qué significa su estado y qué tienes que hacer', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Mis juegos/ }))

    expect(screen.getByText('en revisión')).toBeInTheDocument()
    expect(screen.getByText(/Mientras espera sigue siendo tuyo/)).toBeInTheDocument()
    expect(screen.getByText(/No tienes que hacer nada/)).toBeInTheDocument()
  })

  it('un rechazo trae el motivo, que es lo único que sirve', async () => {
    mount()
    await userEvent.click(await screen.findByRole('button', { name: /Mis juegos/ }))

    expect(screen.getByText('rechazado')).toBeInTheDocument()
    expect(screen.getByText('Le faltan las reglas.')).toBeInTheDocument()
    expect(screen.getByText(/arréglalo y vuelve a enviarlo/)).toBeInTheDocument()
  })
})

describe('el aviso de que algo no se ha guardado en la cuenta', () => {
  it('no aparece cuando todo va bien', async () => {
    mount()
    await screen.findByRole('button', { name: /^Cuenta/ })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  /*
   * The old wording blamed favourites for a failure in the match history, which
   * is how a morning went looking for the problem in the wrong half.
   */
  it('dice qué mitad ha fallado, no la que no fue', async () => {
    syncState.status = 'error'
    syncState.failed = 'matches'
    syncState.error = 'null value in column "updated_at" of relation "matches"'
    mount()

    expect(await screen.findByText(/historial de partidas no se ha guardado/))
      .toBeInTheDocument()
    expect(screen.queryByText(/favoritos y carpetas no se han guardado/)).not.toBeInTheDocument()
  })

  it('tranquiliza, esconde la jerga y se puede cerrar', async () => {
    syncState.status = 'error'
    syncState.failed = 'collections'
    syncState.error = 'violates not-null constraint'
    mount()

    expect(await screen.findByText(/No se ha perdido nada/)).toBeInTheDocument()
    // la frase de Postgres está, pero detrás de un pliegue
    expect(screen.getByText('Detalles técnicos')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
