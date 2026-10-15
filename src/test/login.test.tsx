import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import i18n from '@/i18n'
import { LoginPage } from '@/features/auth/LoginPage'

// Configured, so the form is shown; no client behind it, so nothing is sent.
vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }))

const mount = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )

const signUpTab = () => screen.getByRole('button', { name: /No tienes cuenta/ })

beforeEach(async () => {
  window.localStorage.clear()
  await i18n.changeLanguage('es')
})

describe('acceso con usuario y contraseña', () => {
  it('entra con correo y contraseña, sin pedir el usuario', () => {
    mount()
    expect(screen.getByLabelText('Correo')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    // the handle belongs to signing up, not to coming back
    expect(screen.queryByLabelText('Nombre de usuario')).not.toBeInTheDocument()
    // and nothing is emailed anywhere: no link, no confirmation
    expect(screen.queryByRole('button', { name: 'Mandarme el enlace' })).not.toBeInTheDocument()
  })

  it('deja ver la contraseña, porque escribirla a ciegas en el móvil es el problema', async () => {
    mount()
    const box = screen.getByLabelText('Contraseña')
    expect(box).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(box).toHaveAttribute('type', 'text')
  })

  it('al crear cuenta pide usuario y dice que no hay que verificar nada', async () => {
    mount()
    await userEvent.click(signUpTab())
    expect(screen.getByLabelText('Nombre de usuario')).toBeInTheDocument()
    expect(screen.getByLabelText('Repite la contraseña')).toBeInTheDocument()
    expect(screen.getByText(/No te mandamos ningún correo/)).toBeInTheDocument()
  })

  it('no deja entrar ni crear cuenta con un correo a medias', async () => {
    mount()
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'cuarentaycuatro')
    expect(screen.getByText('Escribe el correo completo, con @ y dominio.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('no deja crear la cuenta si las contraseñas no coinciden', async () => {
    mount()
    await userEvent.click(signUpTab())
    await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'anacarta')
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@correo.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'cuarentaycuatro')
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'cuarentaycinco')

    expect(screen.getByText('Las dos contraseñas no coinciden.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  it('no deja crear la cuenta con una contraseña corta o de las obvias', async () => {
    mount()
    await userEvent.click(signUpTab())
    await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'anacarta')
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@correo.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'corta')
    expect(screen.getByText('Mínimo 8 caracteres.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Contraseña'))
    await userEvent.type(screen.getByLabelText('Contraseña'), 'password')
    expect(screen.getByText(/de las primeras que alguien probaría/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  it('comprueba si el usuario está libre mientras se escribe', async () => {
    mount()
    await userEvent.click(signUpTab())
    await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'anacarta')
    expect(await screen.findByText('Libre, es tuyo.')).toBeInTheDocument()
  })

  it('avisa de un usuario mal formado antes de pedir nada más', async () => {
    mount()
    await userEvent.click(signUpTab())
    await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'a')
    expect(screen.getByText(/mínimo 3 caracteres/i)).toBeInTheDocument()
  })
})

describe('la fecha de nacimiento, que es la que decide los juegos de adultos', () => {
  const fill = async () => {
    await userEvent.click(signUpTab())
    await userEvent.type(screen.getByLabelText('Nombre de usuario'), 'ana_cartas')
    await userEvent.type(screen.getByLabelText('Correo'), 'ana@correo.com')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'unaBuena2026')
    await userEvent.type(screen.getByLabelText('Repite la contraseña'), 'unaBuena2026')
  }

  it('se pide al crear la cuenta, y explica para qué', async () => {
    mount()
    await userEvent.click(signUpTab())
    expect(screen.getByLabelText('Fecha de nacimiento')).toBeInTheDocument()
    expect(screen.getByText(/solo para saber si puedes ver los juegos de adultos/))
      .toBeInTheDocument()
    expect(screen.getByText(/se desbloquean solos/)).toBeInTheDocument()
  })

  it('no se pide al entrar: eso ya está contestado', () => {
    mount()
    expect(screen.queryByLabelText('Fecha de nacimiento')).not.toBeInTheDocument()
  })

  it('sin fecha no deja crear la cuenta', async () => {
    mount()
    await fill()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()
  })

  it('con una fecha normal sí', async () => {
    mount()
    await fill()
    await userEvent.type(screen.getByLabelText('Fecha de nacimiento'), '1990-07-04')
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled()
  })

  it('una fecha del futuro o de alguien de tres años se dice con palabras', async () => {
    mount()
    await fill()
    const box = screen.getByLabelText('Fecha de nacimiento')

    await userEvent.type(box, '2030-01-01')
    expect(screen.getByText('Esa fecha es del futuro.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled()

    await userEvent.clear(box)
    await userEvent.type(box, '2024-01-01')
    expect(screen.getByText(/al menos 6 años/)).toBeInTheDocument()
  })
})

describe('contraseña perdida', () => {
  it('hay una salida donde la busca quien la necesita: bajo la contraseña', () => {
    mount()
    expect(screen.getByRole('button', { name: /Has olvidado la contraseña/ }))
      .toBeInTheDocument()
  })

  it('pide solo el correo, y avisa de lo del navegador antes de mandarlo', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /Has olvidado la contraseña/ }))

    expect(screen.getByLabelText('Correo')).toBeInTheDocument()
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    expect(screen.getByText(/se abre en el navegador que elija tu aplicación de correo/))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mandarme el enlace' })).toBeInTheDocument()
  })

  it('se puede volver a entrar con la contraseña', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: /Has olvidado la contraseña/ }))
    await userEvent.click(screen.getByRole('button', { name: /Volver a entrar con mi contraseña/ }))
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })
})
