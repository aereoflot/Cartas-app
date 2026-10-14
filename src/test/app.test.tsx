import { beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { AppRoutes } from '@/App'

/**
 * The catalogue always arrives through React Query, even when it is coming from
 * the bundled sample file, so every data assertion is awaited. A fresh client
 * per mount keeps one test's cache out of the next.
 */
const mount = (path: string) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Start a match from a game page and land in the panel. */
const startMatch = async (slug: string, names: string[] = []) => {
  mount(`/games/${slug}/play`)
  for (const [i, name] of names.entries()) {
    await userEvent.type(await screen.findByPlaceholderText(`Jugador ${i + 1}`), name)
  }
  await userEvent.click(await screen.findByRole('button', { name: 'Empezar' }))
}

beforeEach(async () => {
  window.localStorage.clear()
  // jsdom reports en-US, so pin the language instead of letting detection decide
  await i18n.changeLanguage('es')
})

describe('home', () => {
  it('opens the list as soon as you tap the box, without typing', async () => {
    mount('/')
    expect(screen.getByRole('heading', { name: 'Jugar ahora' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Brisca' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('searchbox', { name: 'Buscar juegos' }))
    expect(await screen.findByRole('heading', { name: 'Brisca' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mus' })).toBeInTheDocument()
    // and still no count of results anywhere
    expect(screen.queryByText(/\d+ juegos?$/)).not.toBeInTheDocument()
  })

  it('narrows the list as you type', async () => {
    mount('/')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar juegos' }), 'bris')
    expect(await screen.findByRole('heading', { name: 'Brisca' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mus' })).not.toBeInTheDocument()
  })

  it('opens the filters in place, in submenus, and never leaves the page', async () => {
    mount('/')
    // a button, not a link to another page
    const filters = screen.getByRole('button', { name: /Filtros/ })
    await userEvent.click(filters)

    expect(screen.getByRole('button', { name: 'Jugadores', expanded: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duración', expanded: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aplicar filtros' })).toBeInTheDocument()
    // still the home screen
    expect(screen.getByRole('heading', { name: 'Jugar ahora' })).toBeInTheDocument()
  })

  it('applies filters, closes the panel and counts them on the button', async () => {
    mount('/')
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Jugadores', expanded: false }))
    await userEvent.click(screen.getByRole('button', { name: '4', pressed: false }))
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    // panel closed, count shown, list filtered
    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('1 filtro aplicado')).toHaveTextContent('1')
    expect(await screen.findByRole('heading', { name: 'Mus' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Solitario (Klondike)' }))
      .not.toBeInTheDocument()
  })

  it('says where favourites will appear while there are none', () => {
    mount('/')
    expect(screen.getByText(/Aquí aparecerán tus juegos favoritos/)).toBeInTheDocument()
    expect(screen.getByText(/Aquí aparecerán tus mazos favoritos/)).toBeInTheDocument()
  })

  it('no longer carries the shared-with-you block or the expert block', () => {
    mount('/')
    expect(screen.queryByText('Compartido contigo')).not.toBeInTheDocument()
    expect(screen.queryByText('Pregunta al experto')).not.toBeInTheDocument()
    // the expert still has its tab at the bottom
    expect(screen.getByRole('link', { name: 'Experto' })).toBeInTheDocument()
  })

  it('has no search tab in the bottom bar', () => {
    mount('/')
    for (const tab of ['Inicio', 'Mazos', 'Amigos', 'Experto']) {
      expect(screen.getByRole('link', { name: tab })).toBeInTheDocument()
    }
    expect(screen.queryByRole('link', { name: 'Buscar' })).not.toBeInTheDocument()
  })
})

describe('search route', () => {
  it('lists results straight away', async () => {
    mount('/search')
    expect(await screen.findByRole('heading', { name: 'Brisca' })).toBeInTheDocument()
  })

  it('filters by player count from the URL and shows the count', async () => {
    mount('/search?players=10')
    expect(await screen.findByRole('heading', { name: 'Póker Texas hold’em' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Brisca' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('1 filtro aplicado')).toBeInTheDocument()
  })

  it('drops games needing a complete deck when the deck is incomplete', async () => {
    mount('/search?incomplete=1')
    expect(
      await screen.findByText('Ningún juego encaja con esos filtros.'),
    ).toBeInTheDocument()
  })
})

describe('buscar sin tildes, y crear lo que falta', () => {
  it('encuentra un juego escrito sin su tilde', async () => {
    mount('/search?q=poker')
    expect(await screen.findByRole('heading', { name: 'Póker Texas hold’em' }))
      .toBeInTheDocument()
  })

  it('encuentra el guiñote sin la ñ y la escoba con una errata', async () => {
    mount('/search?q=guinote')
    expect(await screen.findByRole('heading', { name: 'Guiñote' })).toBeInTheDocument()

    cleanup()
    mount('/search?q=chinchn')
    expect(await screen.findByRole('heading', { name: 'Chinchón' })).toBeInTheDocument()
  })

  it('ofrece crear el juego al final de la lista, con el nombre ya escrito', async () => {
    mount('/search?q=poker')
    await screen.findByRole('heading', { name: 'Póker Texas hold’em' })
    expect(screen.getByRole('link', { name: /Crear «poker»/ }))
      .toHaveAttribute('href', '/games/new?title=poker')
  })

  it('si no hay ninguno con ese nombre, deja solo la opción de crearlo', async () => {
    mount('/search?q=parchis')
    expect(await screen.findByRole('link', { name: /Crear «parchis»/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument()
    // the filters message belongs to a different kind of emptiness
    expect(screen.queryByText('Ningún juego encaja con esos filtros.')).not.toBeInTheDocument()
  })

  it('un filtro que no deja nada conserva su propio mensaje', async () => {
    mount('/search?incomplete=1')
    expect(await screen.findByText('Ningún juego encaja con esos filtros.')).toBeInTheDocument()
  })
})

describe('favourites', () => {
  it('stars a game from the results and shows it on the home screen', async () => {
    mount('/search')
    const star = await screen.findByRole('button', { name: 'Marcar Brisca como favorito' })
    expect(star).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(star)
    expect(star).toHaveAttribute('aria-pressed', 'true')

    cleanup()
    mount('/')
    expect(await screen.findByRole('heading', { name: 'Brisca' })).toBeInTheDocument()
    expect(screen.queryByText(/Aquí aparecerán tus juegos favoritos/)).not.toBeInTheDocument()
  })

  it('tapping the star does not open the game', async () => {
    mount('/search')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Marcar Mus como favorito' }),
    )
    expect(screen.getByRole('searchbox', { name: 'Buscar juegos' })).toBeInTheDocument()
  })

  it('sends a starred deck to the top of the deck list', async () => {
    mount('/decks')
    await userEvent.click(await screen.findByRole('searchbox', { name: 'Buscar mazos' }))

    await userEvent.click(
      await screen.findByRole('button', { name: 'Marcar Tarot (78) como favorito' }),
    )
    expect(screen.getAllByRole('heading', { level: 3 })[0]).toHaveTextContent('Tarot (78)')
  })

  it('shows a starred deck on the home screen', async () => {
    mount('/decks')
    await userEvent.click(await screen.findByRole('searchbox', { name: 'Buscar mazos' }))
    await userEvent.click(
      await screen.findByRole('button', { name: 'Marcar Baraja alemana (32) como favorito' }),
    )

    cleanup()
    mount('/')
    expect(await screen.findByRole('link', { name: 'Baraja alemana (32)' })).toBeInTheDocument()
  })
})

describe('decks tab', () => {
  it('shows three decks at rest, and the rest on demand', async () => {
    mount('/decks')
    const cards = await screen.findAllByRole('heading', { level: 3 })
    expect(cards).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Ver los 5 mazos restantes' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(8)
  })

  it('keeps every favourite listed when there are more than three', async () => {
    mount('/decks')
    await userEvent.click(await screen.findByRole('searchbox', { name: 'Buscar mazos' }))
    for (const name of ['Tarot (78)', 'Mazo tipo Uno (108)', 'Baraja alemana (32)',
                        'Baraja francesa corta (32)']) {
      await userEvent.click(screen.getByRole('button', { name: `Marcar ${name} como favorito` }))
    }

    cleanup()
    mount('/decks')
    // four starred decks, so four shown rather than a three-deck sample
    expect(await screen.findAllByRole('heading', { level: 3 })).toHaveLength(4)
  })

  it('searches decks by name, and applies filters with a button', async () => {
    mount('/decks')
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Buscar mazos' }), 'tarot')
    expect(screen.getByRole('heading', { name: 'Tarot (78)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Baraja alemana (32)' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    await userEvent.click(screen.getByRole('button', { name: 'variante' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    expect(screen.queryByRole('button', { name: 'Aplicar filtros' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('1 filtro aplicado')).toBeInTheDocument()
  })
})

describe('mis mazos y los juegos que puedo jugar', () => {
  it('marks a deck as mine and filters the games I can play with it', async () => {
    mount('/decks')
    await userEvent.click(await screen.findByRole('searchbox', { name: 'Buscar mazos' }))
    // brisca needs the Spanish 40; say I own it
    const [owns] = screen.getAllByRole('button', { name: 'Lo tengo', pressed: false })
    await userEvent.click(owns as HTMLElement)

    cleanup()
    mount('/search')
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Otros' }))
    await userEvent.click(screen.getByRole('button', { name: 'Solo con mis mazos' }))
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    expect(await screen.findByRole('heading', { name: 'Brisca' })).toBeInTheDocument()
    // the poker game needs the French deck, which I have not marked
    expect(screen.queryByRole('heading', { name: 'Póker Texas hold’em' }))
      .not.toBeInTheDocument()
  })

  it('says what to do when no deck is marked as mine', async () => {
    mount('/search')
    await userEvent.click(screen.getByRole('button', { name: /Filtros/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Otros' }))
    await userEvent.click(screen.getByRole('button', { name: 'Solo con mis mazos' }))
    expect(screen.getByText(/no has marcado ningún mazo como tuyo/)).toBeInTheDocument()
  })
})

describe('deck folders', () => {
  it('creates a folder and puts a deck in it', async () => {
    mount('/decks')
    await userEvent.type(await screen.findByLabelText('Crear'), 'los del bar')
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(screen.getByRole('heading', { name: 'los del bar' })).toBeInTheDocument()

    const [addTo] = screen.getAllByRole('button', { name: 'Añadir a una carpeta' })
    await userEvent.click(addTo as HTMLElement)
    const [chip] = screen.getAllByRole('button', { name: 'los del bar', pressed: false })
    await userEvent.click(chip as HTMLElement)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('an empty folder offers to add decks', async () => {
    mount('/decks')
    await userEvent.type(await screen.findByLabelText('Crear'), 'viaje')
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }))
    await userEvent.click(screen.getByRole('button', { name: 'Añadir mazos' }))
    // the button sends you to the searcher, which is now open
    expect(screen.getByRole('searchbox', { name: 'Buscar mazos' })).toHaveFocus()
  })
})

describe('game detail', () => {
  it('leads with what you need, before the rules', async () => {
    mount('/games/brisca')
    const needs = await screen.findByRole('heading', { name: 'Qué necesitas' })
    expect(within(needs.closest('section') as HTMLElement).getByText(/Baraja española/))
      .toBeInTheDocument()
    expect(screen.getByText('Hace falta la baraja completa')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jugar' })).toHaveAttribute(
      'href',
      '/games/brisca/play',
    )
  })

  it('opens the first rules section', async () => {
    mount('/games/brisca')
    expect(await screen.findByText(/Hay 120 puntos en la baraja/)).toBeInTheDocument()
  })

  it('404s an unknown game', async () => {
    mount('/games/no-existe')
    expect(await screen.findByText('404')).toBeInTheDocument()
  })
})

describe('adult advisory', () => {
  it('blocks an 18+ game until acknowledged, then remembers', async () => {
    mount('/games/texas-holdem')
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Para adultos — +18')).toBeInTheDocument()
    // the rules must not be on screen yet
    expect(screen.queryByText(/escalera de color/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Lo entiendo' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Póker Texas hold’em' })).toBeInTheDocument()

    // second visit, same device: no advisory
    cleanup()
    mount('/games/texas-holdem')
    expect(await screen.findByRole('heading', { name: 'Póker Texas hold’em' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not get in the way of an ordinary game', async () => {
    mount('/games/brisca')
    await screen.findByRole('heading', { name: 'Brisca' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('match panel', () => {
  it('starts a match and shows the game and a clock', async () => {
    await startMatch('brisca')

    expect(await screen.findByRole('heading', { name: 'Brisca' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tiempo')).toHaveTextContent(/^\d+:\d{2}$/)
    for (const tool of ['Notas', 'Cuentas', 'Tiempo', 'Reglas', 'Árbitro']) {
      expect(screen.getByRole('button', { name: tool })).toBeInTheDocument()
    }
  })

  it('keeps notes across tool switches and saves them', async () => {
    await startMatch('escoba')

    const notes = await screen.findByPlaceholderText(/Puntos, manos/)
    await userEvent.type(notes, 'Ana 11 - Luis 7')
    await userEvent.click(screen.getByRole('button', { name: 'Reglas' }))
    expect(screen.queryByPlaceholderText(/Puntos, manos/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Notas' }))
    expect(screen.getByPlaceholderText(/Puntos, manos/)).toHaveValue('Ana 11 - Luis 7')

    expect(JSON.stringify(window.localStorage)).toContain('Ana 11 - Luis 7')
  })

  it('adds up a tally per player', async () => {
    await startMatch('chinchon', ['Ana'])
    await userEvent.click(await screen.findByRole('button', { name: 'Cuentas' }))

    const field = screen.getByRole('spinbutton')
    await userEvent.type(field, '23')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir +' }))
    await userEvent.type(field, '8')
    await userEvent.click(screen.getByRole('button', { name: 'Añadir −' }))

    // scope to the totals block: "Ana" is also the name of the selector button
    const totals = within(screen.getByRole('group', { name: 'Total' }))
    expect(totals.getByText('Ana').closest('div')).toHaveTextContent('15')
    expect(totals.getByText('Total').closest('div')).toHaveTextContent('15')
  })

  it('offers an unfinished match on the home screen', async () => {
    await startMatch('brisca')
    await screen.findByRole('heading', { name: 'Brisca' })

    cleanup()
    mount('/')
    expect(await screen.findByRole('heading', { name: 'Reanudar partida' })).toBeInTheDocument()
  })
})

describe('amigos', () => {
  it('shows the friends list and an invite, and no challenge section', async () => {
    mount('/friends')
    expect(await screen.findByRole('heading', { name: 'Tus amigos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invitar a un amigo' })).toBeInTheDocument()
    expect(screen.queryByText(/Retar a un amigo/)).not.toBeInTheDocument()
    // members are names today and real friends later, and the form says so
    expect(screen.getByText(/ser\u00e1n amigos tuyos de verdad/)).toBeInTheDocument()
  })

  it('makes a group and shows the matches played between its members', async () => {
    // a match with Ana and Luis at the table
    mount('/games/brisca/play')
    await userEvent.type(await screen.findByPlaceholderText('Jugador 1'), 'Ana')
    await userEvent.type(screen.getByPlaceholderText('Jugador 2'), 'Luis')
    await userEvent.click(screen.getByRole('button', { name: 'una cerveza' }))
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }))
    await screen.findByRole('heading', { name: 'Brisca' })

    cleanup()
    mount('/friends')
    await userEvent.type(await screen.findByLabelText('Nombre del grupo'), 'Los del bar')
    await userEvent.type(screen.getByLabelText('Integrantes'), 'Ana, Luis')
    await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))

    expect(screen.getByRole('heading', { name: 'Los del bar' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Brisca' })).toBeInTheDocument()
    expect(screen.getByText(/una cerveza/)).toBeInTheDocument()
  })

  it('keeps a note in the group chat', async () => {
    mount('/friends')
    await userEvent.type(await screen.findByLabelText('Nombre del grupo'), 'Familia')
    await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))

    await userEvent.type(screen.getByLabelText('Mensaje para el grupo'), 'Luis debe una cerveza')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.getByText('Luis debe una cerveza')).toBeInTheDocument()
    expect(screen.getByText('Yo')).toBeInTheDocument()
  })
})

describe('partidas de un grupo', () => {
  it('records which group was invited, so another group with the same people does not claim it',
    async () => {
      mount('/friends')
      await userEvent.type(await screen.findByLabelText('Nombre del grupo'), 'Familia')
      await userEvent.type(screen.getByLabelText('Integrantes'), 'Ana, Luis')
      await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))

      cleanup()
      mount('/games/brisca/play')
      await userEvent.click(await screen.findByRole('button', { name: /Familia/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Empezar' }))
      await screen.findByRole('heading', { name: 'Brisca' })

      // a second group with the same members must not inherit that match
      cleanup()
      mount('/friends')
      await userEvent.type(await screen.findByLabelText('Nombre del grupo'), 'Los primos')
      await userEvent.type(screen.getByLabelText('Integrantes'), 'Ana, Luis')
      await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))

      // the whole card is the list item; .closest('div') is only its header row
      const familia = screen.getByRole('heading', { name: 'Familia' }).closest('li')
      const primos = screen.getByRole('heading', { name: 'Los primos' }).closest('li')
      expect(familia).toHaveTextContent('Brisca')
      expect(primos).not.toHaveTextContent('Brisca')
      expect(primos).toHaveTextContent('Aún ninguna')
    })
})

describe('invitar al crear la partida', () => {
  it('fills the player names from a group', async () => {
    mount('/friends')
    await userEvent.type(await screen.findByLabelText('Nombre del grupo'), 'Los del bar')
    await userEvent.type(screen.getByLabelText('Integrantes'), 'Ana, Luis, Marta')
    await userEvent.click(screen.getByRole('button', { name: 'Crear grupo' }))

    cleanup()
    mount('/games/brisca/play')
    await userEvent.click(await screen.findByRole('button', { name: /Los del bar/ }))

    expect(screen.getByDisplayValue('Ana')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Luis')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Marta')).toBeInTheDocument()
    // three members, so three players
    expect(screen.getByRole('button', { name: '3', pressed: true })).toBeInTheDocument()
  })

  it('says groups are the way in when there are none', async () => {
    mount('/games/brisca/play')
    expect(await screen.findByText(/No tienes grupos todav/)).toBeInTheDocument()
  })
})

describe('¿qué nos jugamos?', () => {
  it('is optional: a match starts with no stake at all', async () => {
    await startMatch('brisca')
    await screen.findByRole('heading', { name: 'Brisca' })
    expect(screen.queryByText('una cerveza')).not.toBeInTheDocument()
  })

  it('carries the stake into the panel and the history', async () => {
    mount('/games/mus/play?reto=1')
    await userEvent.click(await screen.findByRole('button', { name: 'una cerveza' }))
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }))

    // visible under the game name for the whole match
    expect(await screen.findByRole('heading', { name: 'Mus' })).toBeInTheDocument()
    expect(screen.getByText('una cerveza')).toBeInTheDocument()

    cleanup()
    mount('/matches')
    expect(await screen.findByText(/una cerveza/)).toBeInTheDocument()
  })

  it('accepts anything typed, not just the suggestions', async () => {
    mount('/games/escoba/play')
    const field = await screen.findByPlaceholderText(/una cerveza, pagar la cena/)
    await userEvent.type(field, 'el último trozo de tortilla')
    await userEvent.click(screen.getByRole('button', { name: 'Empezar' }))
    expect(await screen.findByText('el último trozo de tortilla')).toBeInTheDocument()
  })
})

describe('acceso', () => {
  // With no Supabase configured (how these tests always run), signing in is
  // impossible — and the app has to say so instead of showing a dead form.
  it('says signing in is not possible yet rather than showing a broken form', async () => {
    mount('/login')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText(/Todavía no hay base de datos conectada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mandarme el enlace' })).not.toBeInTheDocument()
  })

  it('shows the profile as signed out, with no sign-in link it cannot honour', async () => {
    mount('/me')
    expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
  })
})

describe('decks', () => {
  it('lays out every suit of the Spanish deck', async () => {
    mount('/decks/espanola-40')
    expect(await screen.findByRole('heading', { name: /Baraja española \(40\)/ }))
      .toBeInTheDocument()
    // "40 cartas" also appears inside the deck's own description, so match the
    // subtitle exactly rather than anywhere on the page
    expect(screen.getByText(/^40 cartas · estándar$/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '4 Palos × 10' })).toBeInTheDocument()
    for (const suit of ['Oros', 'Copas', 'Espadas', 'Bastos']) {
      expect(screen.getByText(new RegExp(suit))).toBeInTheDocument()
    }
    expect(await screen.findByText('Juegos para este mazo')).toBeInTheDocument()
  })
})
