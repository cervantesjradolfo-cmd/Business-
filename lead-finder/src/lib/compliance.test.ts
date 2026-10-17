import { describe, expect, it } from 'vitest'
import { complianceProblems, emailProblems } from './compliance'
import { emailFooter } from './pitch'
import type { Sender } from './types'

const sender: Sender = { name: 'Sam', business: 'Acme Web', email: 'sam@acme.example.com', phone: '', address: '1 Main St, Austin TX', website: '' }
const body = (text: string) => text + emailFooter(sender)
const first = (subject: string, text: string) => ({ kind: 'first' as const, to: 'owner@corner.example.com', subject, body: body(text) })

describe('complianceProblems', () => {
  it('passes an honest first email with your details and the opt-out line', () => {
    expect(complianceProblems(first('A faster site for Corner Cafe', 'Hi Corner Cafe team, ...'), sender, [])).toEqual([])
  })
  it('blocks a first email that pretends to be a reply or a forward', () => {
    expect(complianceProblems(first('Re: your website', 'Hi'), sender, []).join(' ')).toMatch(/Re:/)
    expect(complianceProblems(first('Fwd: quote', 'Hi'), sender, []).join(' ')).toMatch(/Fwd:/)
    // follow-ups and answers are real replies, so "Re:" is fine there
    expect(complianceProblems({ ...first('Re: A faster site', 'Hi'), kind: 'followup' }, sender, [])).toEqual([])
  })
  it('blocks a first email that suggests you have already spoken', () => {
    for (const t of ['As discussed, here is the quote.', 'Following up on our call yesterday.', 'Great talking with you!', 'Per our conversation, ...']) {
      expect(complianceProblems(first('Website', t), sender, []).join(' ')).toMatch(/already spoken/)
    }
  })
  it('blocks leftover placeholders', () => {
    expect(complianceProblems(first('Hi {{business}}', 'Hi'), sender, []).join(' ')).toMatch(/placeholder/)
    expect(complianceProblems(first('Website', 'Hi [Business name], ...'), sender, []).join(' ')).toMatch(/placeholder/)
  })
  it('needs your name, business and postal address, in the email', () => {
    const noAddress = { ...sender, address: '' }
    expect(complianceProblems(first('Website', 'Hi'), noAddress, []).join(' ')).toMatch(/postal address/)
    expect(complianceProblems({ ...first('Website', 'Hi'), body: 'Hi\n\nSam' }, sender, []).join(' ')).toMatch(/postal address is missing.*opt-out line is missing/)
    expect(complianceProblems(first('Website', 'Hi'), { ...sender, name: '' }, []).join(' ')).toMatch(/name and business/)
  })
  it('blocks unsubscribed addresses', () => {
    expect(complianceProblems(first('Website', 'Hi'), sender, ['owner@corner.example.com']).join(' ')).toMatch(/unsubscribed/)
  })
  it('lets a test email to yourself through without the opt-out line', () => {
    expect(emailProblems({ kind: 'test', to: 'sam@acme.example.com', subject: 'Test', body: 'Test' })).toEqual([])
  })
})
