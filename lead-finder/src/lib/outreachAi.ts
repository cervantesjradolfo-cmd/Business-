// AI drafts for Outreach steps. Step 1 reuses the pitch AI (/api/pitch); follow-ups use /api/followup.
// Returns null when AI isn't set up on the server, so the caller keeps the current wording.
import { fetchFollowUp, fetchPitch } from './api'
import { buildStepEmail, stripFooter } from './outreach'
import { pitchRequestFor } from './pitch'
import { scoreLead } from './scoring'
import type { Campaign, ClientProfile, Draft, Enrollment, Pitch, SavedLead, Sender } from './types'

export async function aiDraftFor(a: {
  saved: SavedLead
  enrollment: Enrollment
  step: number
  sender: Sender
  profile?: ClientProfile
  pitch: Pitch // the lead's current pitch (what step 1 sends without a draft)
  campaign: Campaign
}): Promise<Draft | null> {
  const { saved, enrollment, step, sender, profile, pitch, campaign } = a
  const lead = scoreLead(saved.lead, saved.audit)
  if (step === 0) {
    const p = await fetchPitch(pitchRequestFor(lead, sender, profile))
    if (p.source !== 'ai') return null
    return { subject: p.email.subject, body: stripFooter(p.email.body, sender), source: 'ai' }
  }
  // The follow-up refers back to step 1 as it was (or will be) sent.
  const first = buildStepEmail({ enrollment: { ...enrollment, nextStep: 0 }, saved, pitch, campaign, sender })
  const previousSubject = enrollment.subject ?? (first.ok ? first.subject : pitch.email.subject)
  const previousBody = stripFooter(first.ok ? first.body : pitch.email.body, sender)
  const body = await fetchFollowUp({
    lead: { name: lead.name, category: lead.category, city: lead.city },
    sender: { name: sender.name, business: sender.business },
    step,
    previousSubject,
    previousBody,
    ...(profile ? { offer: { services: profile.offer, sellingPoints: profile.sellingPoints } } : {}),
    ...(lead.project ? { project: { address: lead.project.address, description: lead.project.description, issued: lead.project.issued } } : {}),
  })
  return body ? { body, source: 'ai' } : null
}
