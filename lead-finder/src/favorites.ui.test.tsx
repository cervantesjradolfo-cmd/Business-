import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const jsonRes = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
let calls: { path: string; body: any }[]
beforeEach(() => {
  window.localStorage.clear()
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ path: url, body: init?.body ? JSON.parse(init.body as string) : undefined })
    if (url.endsWith('/api/search')) return jsonRes({ center: { lat: 1, lon: 1, displayName: 'X' }, leads: [], source: 'overpass' })
    return new Response('x', { status: 500 })
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('favorite categories', () => {
  it('lists the underserved niches first, starred, and remembers changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    const select = screen.getByLabelText('Category') as HTMLSelectElement
    const fav = within(select).getByRole('group', { name: '★ Favorites' })
    const names = within(fav).getAllByRole('option').map((o) => o.textContent)
    expect(names).toHaveLength(16)
    expect(names.slice(0, 3)).toEqual(['★ Garage door repair', '★ Fence contractors', '★ Concrete, flatwork & epoxy floors'])

    await user.selectOptions(select, 'locksmiths')
    await user.type(screen.getByLabelText('Location'), 'Phoenix, AZ')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(calls.find((c) => c.path.endsWith('/api/search'))!.body).toMatchObject({ location: 'Phoenix, AZ', category: 'locksmiths' })

    // Unstar it: it moves to All categories, and that sticks.
    await user.click(screen.getByRole('button', { name: 'Remove from favorites' }))
    expect(within(within(select).getByRole('group', { name: '★ Favorites' })).queryByRole('option', { name: '★ Locksmiths' })).toBeNull()
    expect(JSON.parse(window.localStorage.getItem('leadfinder:favoriteCategories')!)).not.toContain('locksmiths')
    // Star a regular category.
    await user.selectOptions(select, 'dentists')
    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))
    expect(within(within(select).getByRole('group', { name: '★ Favorites' })).getByRole('option', { name: '★ Dentists' })).toBeTruthy()
    cleanup()
    render(<App />)
    expect(within(within(screen.getByLabelText('Category')).getByRole('group', { name: '★ Favorites' })).getByRole('option', { name: '★ Dentists' })).toBeTruthy()
  })
})
