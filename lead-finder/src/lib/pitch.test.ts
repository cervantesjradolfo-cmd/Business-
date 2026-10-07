import { describe, expect, it } from 'vitest'
import { OPT_OUT_EMAIL, OPT_OUT_SMS, buildTemplatePitch, emailSignature, finalizeAiPitch } from './pitch'
import type { PitchRequest } from './types'

const sender = { name: 'Sam', business: 'Sam Web', email: 's@x.com', phone: '', address: '1 Main St', website: '' }
const req: PitchRequest = {
  lead: { name: 'Joe & "Sons" Dental', category: 'Dentist', city: 'Austin' },
  gaps: ['no_chat_widget', 'no_website', 'no_online_booking', 'no_hours_listed'],
  services: ['website', 'online_booking', 'review_collection'],
  sender,
}

describe('buildTemplatePitch', () => {
  const p = buildTemplatePitch(req)
  it('names the business in all three', () => {
    for (const t of [p.email.body, p.sms, p.phoneOpener, p.email.subject]) expect(t).toContain('Joe & "Sons" Dental')
    expect(p.source).toBe('template')
  })
  it('uses the top three gap phrases', () => {
    expect(p.email.body).toContain("- You don't have a website customers can find")
    expect(p.email.body).toContain("- There's no way to book online")
    expect(p.email.body).toContain("- There's no chat to answer visitors' questions")
    expect(p.email.body).not.toContain('opening hours')
    expect(p.email.body).toContain('dentists in Austin')
    expect(p.phoneOpener).toContain("noticed you don't have a website customers can find, there's no way to book online and")
  })
  it('sms is short and ends with STOP', () => {
    expect(p.sms.length).toBeLessThanOrEqual(320)
    expect(p.sms.endsWith(OPT_OUT_SMS)).toBe(true)
    const long = buildTemplatePitch({ ...req, lead: { ...req.lead, name: 'N'.repeat(300) } })
    expect(long.sms.length).toBeLessThanOrEqual(320)
    expect(long.sms.endsWith(OPT_OUT_SMS)).toBe(true)
  })
  it('email ends with opt-out and includes the signature', () => {
    expect(p.email.body.endsWith(OPT_OUT_EMAIL)).toBe(true)
    expect(p.email.body).toContain('Sam\nSam Web\ns@x.com\n1 Main St')
  })
  it('uses placeholders for a blank sender', () => {
    const b = buildTemplatePitch({ ...req, sender: { ...sender, name: '', business: '' } })
    expect(b.sms).toContain('[Your name]')
    expect(b.phoneOpener).toContain('[Your business]')
    expect(b.email.body).toContain('[Your name]')
  })
  it('works with zero gaps', () => {
    const z = buildTemplatePitch({ ...req, gaps: [], services: [] })
    expect(z.email.body).toContain('looks solid')
    expect(z.email.body).not.toContain('\n- ')
    expect(z.email.body).toContain('review collection and AI chat assistant')
    expect(z.sms).toContain('win more customers online')
    expect(z.phoneOpener).not.toContain('noticed')
  })
})

describe('finalizeAiPitch', () => {
  const ai = { subject: 'Hi', emailBody: 'Hi Joe & "Sons" Dental team', sms: 'Hi Joe & "Sons" Dental', phoneOpener: 'Is this Joe & "Sons" Dental?' }
  it('appends signature and opt-outs', () => {
    const p = finalizeAiPitch(ai, req)!
    expect(p.source).toBe('ai')
    expect(p.email.body.endsWith(OPT_OUT_EMAIL)).toBe(true)
    expect(p.email.body).toContain(emailSignature(sender))
    expect(p.sms.endsWith(OPT_OUT_SMS)).toBe(true)
  })
  it('rejects output without the name or with empty fields', () => {
    expect(finalizeAiPitch({ ...ai, sms: 'Hello there' }, req)).toBeNull()
    expect(finalizeAiPitch({ ...ai, subject: ' ' }, req)).toBeNull()
  })
})

describe('client profile pitch (template)', () => {
  const asher = { name: 'Asher', business: 'Asher Construction', email: 'a@asher.example.com', phone: '555-0100', address: '9 Oak St', website: '' }
  const clientReq: PitchRequest = {
    lead: { name: 'Summit Construction', category: 'General contractor', city: 'Denver' },
    gaps: ['no_website'],
    services: ['website'],
    sender: asher,
    offer: { services: 'drywall, metal framing and acoustic ceilings', sellingPoints: 'Licensed and insured.' },
  }
  const p = buildTemplatePitch(clientReq)
  it('introduces the client and what they do, not website gaps', () => {
    expect(p.email.subject).toBe('Drywall, metal framing and acoustic ceilings for your next project')
    expect(p.email.body).toContain("I'm Asher with Asher Construction. We do drywall, metal framing and acoustic ceilings, and I'm reaching out to general contractors in Denver")
    expect(p.email.body).toContain('Licensed and insured.')
    expect(p.email.body).not.toMatch(/website customers can find/)
    for (const t of [p.email.body, p.sms, p.phoneOpener]) expect(t).toContain('Summit Construction')
    expect(p.phoneOpener).toContain('for general contractors around Denver')
  })
  it('keeps the signature, opt-outs and SMS length', () => {
    expect(p.email.body).toContain(emailSignature(asher))
    expect(p.email.body.endsWith(OPT_OUT_EMAIL)).toBe(true)
    expect(p.sms.endsWith(OPT_OUT_SMS)).toBe(true)
    const long = buildTemplatePitch({ ...clientReq, lead: { ...clientReq.lead, name: 'N'.repeat(300) } })
    expect(long.sms.length).toBeLessThanOrEqual(320)
    expect(long.sms).toContain('…')
    const wordy = buildTemplatePitch({ ...clientReq, offer: { services: 'w'.repeat(300) } })
    expect(wordy.sms.length).toBeLessThanOrEqual(320)
    expect(wordy.sms).toContain("We're taking on projects in Denver")
  })
  it('leaves out empty selling points and fills blanks with placeholders', () => {
    const bare = buildTemplatePitch({ ...clientReq, sender: { ...asher, name: '', business: '' }, offer: { services: '' }, lead: { name: 'Ridge', category: 'Architect' } })
    expect(bare.email.body).toContain("I'm [Your name] with [Your business]. We do [what you do], and I'm reaching out to architects in the area")
    expect(bare.email.body).not.toContain('\n\n\n')
  })
})

describe('client pitch for a permit project', () => {
  const sender = { name: 'Asher', business: 'Asher Construction', email: '', phone: '', address: '9 Oak St', website: '' }
  const p = buildTemplatePitch({
    lead: { name: 'Redmond Construction Corp.', category: 'General contractor', city: 'Chicago' },
    gaps: [], services: [], sender,
    offer: { services: 'drywall, metal framing and acoustic ceilings' },
    project: { address: '225 W Randolph St', issued: '2026-10-06', description: 'Interior alterations to existing office floors 10 through 16 for buildout of golub capital office space. As per plans' },
  })
  it('names the job, the permit date and offers to bid that scope', () => {
    expect(p.email.subject).toBe('Drywall, metal framing and acoustic ceilings for 225 W Randolph St')
    expect(p.email.body).toContain('I saw the permit issued Oct 6 for the work at 225 W Randolph St (interior alterations to existing office floors 10 through 16 for buildout of golub…).')
    expect(p.email.body).toContain("we'd like to bid that scope if you're still lining up subs")
    expect(p.sms).toContain('Saw your permit at 225 W Randolph St.')
    expect(p.sms.length).toBeLessThanOrEqual(320)
    expect(p.phoneOpener).toContain('I saw your permit for the job at 225 W Randolph St')
    expect(p.email.body.endsWith(OPT_OUT_EMAIL)).toBe(true)
  })
})
