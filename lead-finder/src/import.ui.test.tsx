import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

const jsonRes = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
let calls: { path: string; body: any }[]

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem('leadfinder:sender', JSON.stringify({ name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }))
  window.localStorage.setItem('leadfinder:profiles', '[]')
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ path: url, body })
    if (url.endsWith('/api/audit')) {
      return jsonRes({ results: body.leads.map((l: { id: string }) => ({ id: l.id, status: 'ok', gaps: [], emails: ['hello@beta.example.com'], checkedAt: new Date().toISOString() })) })
    }
    throw new Error('down')
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('CSV import', () => {
  it('maps the columns, saves the leads, adds those with an email to outreach and checks websites for more emails', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Outreach/ }))
    const panel = screen.getByRole('region', { name: 'Import leads' })
    const csv = 'Company,Email,Website\nCorner Cafe,owner@corner.example.com,\nBeta Bakery,,beta.example.com\n,orphan@x.example.com,\n'
    await user.upload(within(panel).getByLabelText('CSV file'), new File([csv], 'leads.csv', { type: 'text/csv' }))

    expect(await within(panel).findByText('leads.csv: 3 rows. Check which column is which:')).toBeTruthy()
    expect((within(panel).getByLabelText('Business name (needed)') as HTMLSelectElement).value).toBe('0')
    expect(within(panel).getByText(/2 leads ready, 1 with an email\. 1 rows have no business name/)).toBeTruthy()
    await user.click(within(panel).getByRole('button', { name: 'Import 2 leads' }))
    expect(within(panel).getByRole('status').textContent).toBe('Imported 2 new leads, added 1 to outreach, checking 1 websites for emails.')

    const saved = JSON.parse(window.localStorage.getItem('leadfinder:saved')!)
    expect(Object.values(saved).map((s: any) => s.lead.name).sort()).toEqual(['Beta Bakery', 'Corner Cafe'])
    expect(screen.getByRole('button', { name: /Saved \(2\)/ })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'In outreach' })).getByText('owner@corner.example.com')).toBeTruthy()

    // The website check finds Beta Bakery's email, so it can be added too.
    await waitFor(() => expect(Object.values(JSON.parse(window.localStorage.getItem('leadfinder:saved')!)).some((s: any) => s.audit?.emails?.[0] === 'hello@beta.example.com')).toBe(true))
    expect(calls.find((c) => c.path.endsWith('/api/audit'))!.body.leads).toEqual([{ id: expect.stringMatching(/^csv:/), website: 'beta.example.com' }])
    await user.click(screen.getByRole('button', { name: 'Add all saved leads with an email' }))
    expect(within(screen.getByRole('region', { name: 'In outreach' })).getByText('hello@beta.example.com')).toBeTruthy()

    // An imported lead opens without a map distance.
    await user.click(screen.getByRole('button', { name: /Saved \(2\)/ }))
    await user.click(screen.getByText('Beta Bakery'))
    expect(await screen.findByText(/imported from a CSV/)).toBeTruthy()
  })

  it('refuses a file without leads', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /^Outreach/ }))
    const panel = screen.getByRole('region', { name: 'Import leads' })
    await user.upload(within(panel).getByLabelText('CSV file'), new File(['Company\n'], 'empty.csv', { type: 'text/csv' }))
    expect(await within(panel).findByRole('alert')).toBeTruthy()
  })
})
