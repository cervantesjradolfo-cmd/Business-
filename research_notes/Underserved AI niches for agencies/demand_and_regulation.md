# Demand Evidence (Missed Calls / Speed-to-Lead) and Regulatory Guardrails for AI Receptionist, AI Calling and SMS Follow-up (US, as of Oct 2026)

Not legal advice. Most regulatory findings come from law-firm client alerts and secondary summaries gathered via web search on 2026-10-17; items marked [BK] come from the researcher's background knowledge of long-standing rules and were not re-fetched this session. Verify them against primary text before relying on them.

## 1. What share of calls to small businesses go unanswered (overall and by sector)?

### Takeaway
Credible recent benchmarks put the unanswered rate at about 44% of all inbound calls (Invoca, July 2026, 70M+ calls), with home services among the worst at roughly 48% unanswered. CallRail's Jan 2025 SMB benchmark shows lower but still material miss rates (healthcare 32%, legal 28%, home services 14%). The widely quoted "62% of calls go unanswered" figure comes from a small 2016 study and should not be used.

### Cited Findings
- **Invoca 2026 Lead Conversion Benchmarks Report (published July 2026):** this covers 70M+ calls and 600M+ conversation minutes across 10 industries and 7 marketing channels, averaged across Invoca customers. 56% of all inbound calls were answered by a person, 65% of calls longer than 15 seconds, and 71% of calls longer than 30 seconds. 38% of answered calls were leads and 42% of those leads converted on the call. — [Invoca report](https://www.invoca.com/reports/the-invoca-lead-conversion-benchmarks-report-2026)
- **Invoca 2026 answer rates by industry** (taken from an Invoca blog table; I could not see them in the report text): Travel 64%, Consumer Services 60%, Automotive 58%, Financial Services 57%, Healthcare 54%, Senior Care 53%, DTC Ecommerce 53%, Home Services 52%, Telecom 51%. That implies about 48% unanswered in home services and about 46% in healthcare. — [Invoca blog table](https://www.invoca.com/blog/table-test); summarized in [JustCall](https://justcall.io/blog/missed-call-statistics.html)
- **Methodology caveat for Invoca:** the sample is Invoca's customers, mostly larger marketers running paid campaigns, not a random sample of SMBs. Short calls (15 seconds or less) include spam and misdials, which pulls the "all calls" answer rate down. — [Invoca report](https://www.invoca.com/reports/the-invoca-lead-conversion-benchmarks-report-2026)
- **CallRail SMB benchmark (Jan 14–15, 2025, 1.1M leads):** missed-call rates were healthcare 32% (the highest), legal 28%, home services 14% and real estate 9%. The same report cites "up to 85% of customers whose calls go unanswered will not call back," a secondary statistic of unclear origin. — [BusinessWire / CallRail](https://www.businesswire.com/news/home/20250114793850/en/CallRail-Releases-Report-Benchmarking-Marketing-Efforts-for-Small-Businesses)
- **CallRail and Invoca disagree on home services (14% missed vs about 48% unanswered)** because they use different datasets, filters and definitions of "missed." — [Stealth Agents summary](https://stealthagents.com/research/home-services-missed-call-revenue-statistics-2026)
- **Legal, Clio Legal Trends secret-shopper study (2024):** the share of law firms answering a prospective-client call fell from 56% (2019) to 40% (2024). 48% of firms were unreachable by phone, meaning they neither answered nor returned the call, and only 33% replied to an email inquiry. — [Oklahoma Bar Journal, Sept 2025, citing Clio](https://www.okbar.org/obj/2025/september/84); [OK Bar practice article](https://www.okbar.org/lpt_articles/answering-the-call-why-responsiveness-is-critical-for-law-firm-success/)
- **Legal, single-agency sample:** 6,801 PPC calls to one marketing firm's law-firm clients showed about 13.5% missed. — [FWD Lawyer Marketing](https://fwd-lawyermarketing.com/law-firm-ppc-one-missed-call-is-too-many/)
- **Home services, vendor study:** GetNextPhone reviewed 130,175 calls from 45 contractors over 7 months and found 74.1% unanswered. This is self-selected marketing material and its sample likely skews toward businesses that already have a problem. — [GetNextPhone](https://www.getnextphone.com/blog/ai-receptionist-missed-calls-solution)
- **The "62% unanswered" statistic** traces to a 30-day study of 85 businesses across 58 industries (2016) that counted voicemail as unanswered. The often-paired "$126,000/yr lost" figure has no identifiable primary source. — [Search synthesis of Medium/schedulingkit/usecarly summaries](https://medium.com/@jtgrahamm/the-silent-profit-killer-why-62-of-your-business-calls-go-unanswered-and-what-its-costing-you-7619af72cce4)

### Inferences
- A defensible pitch line is: "Industry benchmarks show roughly 4 in 10 calls to service businesses aren't answered by a person (Invoca 2026). In home services it's about half, and in legal fewer than half of firms pick up for a new client (Clio 2024)." Cite the date and method.
- Healthcare and legal show up as high-miss sectors in both CallRail and Clio/Invoca, and home services is high in Invoca. These overlap with the sectors where the value of a single customer is high.
- Revenue lost per missed call is best calculated per client: missed calls × lead rate (about 38% per Invoca) × close rate × average job value. No credible universal dollar figure exists.

### Gaps
- I found no reliable sector-specific missed-call data for auto repair, dental or medical practices specifically, or for restaurants, apart from Invoca's "Automotive" (likely dealerships) and "Healthcare."
- I could not reach primary studies from 411 Locals, Numa, Ruby, Marchex or ServiceTitan this session. ServiceTitan and Marchex call studies are often cited but were not verified.
- I found no academic (peer-reviewed) study of SMB missed-call rates.

## 2. Lead response time, and callers who won't leave voicemail or call back

### Takeaway
The best-documented evidence is HBR 2011: firms that responded within an hour were about 7x more likely to qualify a lead, and 23% of firms never responded. The famous "21x at 5 minutes" figure comes from a 2007 InsideSales.com/Oldroyd study that is often miscredited to MIT, so treat it as directional. Most callers do not leave voicemail: only 42% say they do (CallRail 2025 consumer survey).

### Cited Findings
- **HBR "The Short Life of Online Sales Leads" (2011):** an audit of 2,241 US companies found 37% responded within 1 hour, 16% within 1–24 hours, 24% took more than 24 hours and 23% never responded. Firms that contacted leads within an hour were nearly 7x more likely to qualify them than firms that waited longer. Secondary sources disagree on the underlying lead count (1.25M vs 2.24M). — [Ainora summary of studies](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026); [Rework](https://resources.rework.com/vi/libraries/lead-management/lead-response-time)
- **InsideSales.com / Dr. James Oldroyd Lead Response Management study (2007):** this covered 6 companies, more than 15,000 leads and over 100,000 call attempts. Odds of qualifying a lead were 21x higher when contacted within 5 minutes than within 30 minutes, and the study also reports a 100x figure for contact. It was presented at a summit, not published in a peer-reviewed journal, and is commonly miscredited to MIT or Harvard. — [Original PDF hosted by Mortech](https://www.mortech.com/hs-fs/hub/25649/file-13535879-pdf/docs/mit_study.pdf); [Ainora](https://ainora.lt/blog/lead-response-time-statistics-every-study-2026)
- **Conversion on answered calls (2026):** 38% of answered calls are leads and 42% of those convert on the call (Invoca). — [Invoca](https://www.invoca.com/reports/the-invoca-lead-conversion-benchmarks-report-2026)
- **Voicemail:** a 2025 CallRail survey of 1,000 US consumers found only 42% leave a voicemail when a business doesn't answer. — [Search summary citing CallRail](https://answeringservicecare.com/blog/callers-leave-no-voicemail/)
- **Voicemail, older:** Moneypenny's 2016 Small Business Call Report (300 micro businesses plus call data from 10,000 businesses) found 69% of callers who reached voicemail hung up without leaving a message. This is UK-based. — [Moneypenny](https://moneypenny.com/us/resources/news/small-business-call-report/)
- **Callbacks:** "Up to 85% of callers whose calls go unanswered will not call back" is cited in CallRail's 2025 release, but its primary source is unclear. — [BusinessWire/CallRail](https://www.businesswire.com/news/home/20250114793850/en/CallRail-Releases-Report-Benchmarking-Marketing-Efforts-for-Small-Businesses)
- **Legal:** 48% of firms neither answered nor returned a prospective client's call (Clio 2024). — [OK Bar Journal](https://www.okbar.org/obj/2025/september/84)

### Inferences
- Recommended hierarchy for citing: HBR 2011 (most rigorous), Invoca 2026 (most recent and largest), then Oldroyd 2007 (label it "InsideSales 2007," not MIT).
- A "missed-call text-back within 60 seconds" plus AI pickup addresses the roughly 58% of callers who won't leave voicemail.

### Gaps
- I found no peer-reviewed post-2020 speed-to-lead study specific to SMBs.
- The 85% won't-call-back figure is unverified at its source.

## 3. AI acceptance: consumer attitudes and small-business AI adoption by sector

### Takeaway
Consumers accept AI service when a human is reachable: 61% are comfortable with AI customer service (Adobe, Nov 2025), and 87% say a path to a human is essential (Gartner 2026). Formal AI adoption among US businesses is still low, at about 18–24% (Census BTOS 2026), and lowest among micro firms and physical, trade and retail sectors. Retail is about 14% and construction rose to about 15%. That gap is the agency opportunity. Self-reported surveys of engaged owners show much higher numbers (Goldman 76%), but only 14% have AI embedded in core operations.

### Cited Findings
- **Adobe Express survey (Nov 2025, 1,005 US consumers):** 61% are comfortable conversing with AI customer service such as chatbots and voice assistants, but only 46% of Gen Z say so. — [Adobe](https://www.adobe.com/express/learn/blog/future-of-conversational-marketing)
- **Invoca B2C survey (2025, 1,000 consumers making complex purchases):** 77% are comfortable with AI if they can also reach a human, and 67% prefer a person for harder problems. — [search summary](https://cxm.world/customer-experience/ai-gains-ground-in-purchases-but-phone-calls-still-rule-for-help/)
- **SurveyMonkey (2025):** 79% of Americans strongly prefer interacting with a human over an AI agent. — [SurveyMonkey](https://www.surveymonkey.com/curiosity/customer-service-statistics/)
- **Gartner (2026, 3,566 customers):** 87% say an option to reach a human agent is essential when a company uses generative AI. — [search summary via getmacha](https://www.getmacha.com/blog/customer-trust-ai-customer-service-statistics)
- **Census BTOS (Dec 14, 2025 to May 3, 2026):** AI use was 17–20% of businesses, 19.8% nationally as of May 3, 2026, and 20–23% expect to use it within 6 months. Use was 37% among firms with 250+ employees and 32% among those with 100–249. Use rose among firms with 20+ employees but showed no significant change for firms under 20, and firms with 4 or fewer employees were below 20%. By sector, Information was 39.7%, Finance and Insurance 33.9%, and Retail Trade about 14% (the lowest the Census page names). — [Census, May 2026](https://census.gov/library/stories/2026/05/ai-use-businesses.html)
- **BTOS question change:** on Nov 17, 2025 the question changed from AI use "in producing goods or services" to "in any business function" across 15 functions, so trends are not comparable across that break. — [Census](https://census.gov/library/stories/2026/05/ai-use-businesses.html)
- **BTOS later data (secondary, unverified against Census):** 23.8% used AI in Aug 24–Sep 6, 2026, up from 17.7% at the start of 2026. Construction rose from 8.3% to 15.4%. — [startbusinessbystate](https://startbusinessbystate.com/small-business-ai-use-by-state/)
- **National Academies presentation (Apr 2026):** adoption is highest in knowledge-intensive sectors (Information, Professional/Scientific/Technical, Finance) and lags in physical-output and trade sectors (Manufacturing, Retail, Wholesale). — [National Academies](https://www.nationalacademies.org/cdn/materials/a1eded24-0175-4cdc-bcfc-31ad03581297)
- **Goldman Sachs 10,000 Small Businesses Voices (early 2026, 1,256 owners):** 76% use AI but only 14% have it fully embedded in core operations, and 93% of users report a positive impact. Barriers are data privacy and security (50%), lack of expertise (49%) and difficulty choosing tools (48%). — [Goldman Sachs](https://www.goldmansachs.com/community-impact/10000-small-businesses-voices/insights/ai-presents-a-major-opportunity-for-small-businesses)
- **US Chamber (2025):** 58% of small businesses use generative AI, up from 40% in 2024. This is a secondary summary. — [Delaware Inc summary](https://www.delawareinc.com/blog/ai-adoption-small-business/)

### Inferences
- Pitch AI receptionists as "AI answers instantly, with a human handoff/callback," since the consumer data strongly favors a visible human escape hatch.
- The lowest adopters by Census data are trades, construction, retail and micro firms under 5 employees, which are also high-miss-rate home services. That points to a whitespace for done-for-you setup, since lack of expertise and tool choice are the top barriers (Goldman).
- Goldman's 76% vs Census's about 20% gap reflects sample and question differences: Goldman surveys program alumni and asks about any use including ChatGPT, while Census asks about business-function use in a national probability sample.

### Gaps
- I did not find the full BTOS sector table (construction, health care, other services, accommodation/food) on the Census page. Pull it from the BTOS data download.
- NFIB AI-use figures were not found this session.
- I found no survey specifically on consumer comfort with AI *phone/voice* agents, as opposed to chat.

## 4. Regulation and a practical compliance checklist (inbound AI receptionist vs outbound AI calling vs SMS)

### Takeaway
Outbound AI voice calls count as "artificial or prerecorded voice" calls under the TCPA (FCC, Feb 2024). They need prior express consent, and written consent for marketing, plus ID and opt-out. The 2024 one-to-one consent rule was vacated (11th Cir., Jan 2025) and deleted, but consent-revocation rules are live: honor revocation by any reasonable means within 10 business days, with the "revocation-all" piece delayed to Jan 31, 2027. Inbound AI answering is far lower TCPA risk. The main inbound risks are all-party call-recording consent (CA CIPA suits against AI vendors), state AI-disclosure/chatbot laws (CA, UT, NY, ME in force; CO, CT, OR, WA from Jan 1, 2027), HIPAA for health niches, and attorney ethics rules for legal intake. Business SMS requires A2P 10DLC registration.

### Cited Findings
**TCPA / FCC**
- **FCC Declaratory Ruling (Feb 2024, FCC 24-17):** calls using AI-generated voices are "artificial or prerecorded voice" calls under the TCPA. They require prior express consent (prior express *written* consent for telemarketing), identification and disclosure, and opt-out mechanisms, absent an emergency or exemption. — [Kelley Drye](https://www.kelleydrye.com/viewpoints/blogs/ad-law-access/fcc-proposes-new-tcpa-rules-for-ai-calls-and-texts); [Perkins Coie](https://perkinscoie.com/insights/update/fcc-proposes-new-rules-ai-generated-content-calls-and-texts)
- **FCC AI NPRM/NOI (adopted Aug 7, 2024):** proposes defining "AI-generated call" for outbound calls only, explicitly to avoid burdening inbound customer-service tech. It would require AI disclosure in consent requests and an up-front disclosure at the start of AI-voice calls. Comments were due Oct 10 / Oct 25, 2024. **Final status as of Oct 2026 was not confirmed**; I found no source showing adoption. — [Wiley](https://wiley.law/alert-FCC-Proposes-New-Rules-for-AI-Generated-Calls-and-Texts); [Wiley deadlines](https://wiley.law/alert-FCC-Sets-October-Comment-Deadlines-on-NPRM-for-AI-Generated-Calls-and-Texts)
- **One-to-one consent rule:** vacated by the 11th Circuit in *Insurance Marketing Coalition v. FCC* on Jan 24, 2025. The court struck both the single-seller consent and the "logically and topically associated" requirements and remanded. The FCC had postponed the effective date the same day, and the pre-existing prior-express-written-consent rules remain. — [MoFo](https://www.mofo.com/resources/insights/250130-eleventh-circuit-vacates-fcc-s-tcpa-one-to-one-consent-rule); [Venable](https://www.venable.com/insights/publications/2025/01/eleventh-circuit-overrules-fccs-one-to-one)
- **The FCC formally deleted the one-to-one rule** from its regulations around Sept 2025; sources vary on the exact date. — [Mondaq](https://admin.mondaq.com/unitedstates/telecoms-mobile-cable-communications/1654600/fcc-deletes-deletes-deletes-one-to-one-consent-tcpa-rule); [ActiveProspect](https://activeprospect.com/blog/fcc-one-to-one-consent/)
- **Consent revocation:** in effect since Apr 11, 2025. Consumers may revoke by any reasonable means, and revocations must be honored within 10 business days. The "revocation-all" provision (one opt-out applies to all message types from a sender) was delayed first to Apr 11, 2026, then by a Jan 2026 order to Jan 31, 2027 (secondary sources). An Oct 2025 FNPRM may revise the revocation rules further. — [ActiveProspect](https://activeprospect.com/blog/fcc-tcpa/); [Krieg DeVault](https://www.kriegdevault.com/insights/fcc-delays-compliance-date-for-part-of-new-tcpa-consent-revocation-rule/pdf); [compliancehub](https://compliancehub.wiki/tcpa-2026-consent-revocation-one-to-one-rule-vacated-compliance/)
- [BK] **TCPA texting:** texts are "calls" under the TCPA. Marketing texts sent with an autodialer need prior express written consent. Quiet hours run 8am–9pm in the recipient's local time, National DNC applies, and statutory damages are $500–$1,500 per message. Several states have stricter "mini-TCPA" laws (FL, OK, MD and others) with narrower hours and broader autodialer definitions. — [FCC TCPA consumer guide](https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts) (background, not fetched)

**A2P 10DLC (business SMS)**
- US carriers require businesses texting from local 10-digit numbers to register their brand and campaign with The Campaign Registry (TCR). — [Bandwidth](https://www.bandwidth.com/blog/how-to-register-with-10dlc-to-avoid-unnecessary-costs-in-2022/)
- **Sole-proprietor brand** is only for businesses with no EIN. It is limited to 1 campaign, 1 number and 1 message per second. A business with an EIN must register as Low-Volume Standard or Standard. — [Twilio docs](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/collect-business-info.md)
- **Fees vary by provider.** Examples: Twilio lists a $4 brand fee, $15 campaign vetting and $2/month sole-prop campaign. Another provider lists a $9 brand fee, $20/month for a standard campaign or $4/month for sole prop. — [Twilio pricing summary (Sociocs)](https://www.sociocs.com/post/twilio-10dlc-explained/); [Twilio support](https://support.twilio.com/hc/en-us/articles/9550596959643-)
- **Unregistered traffic** gets surcharges, filtering or blocking, and can fail silently. AT&T is reported as the most aggressive at blocking. — [Bandwidth](https://www.bandwidth.com/blog/how-to-register-with-10dlc-to-avoid-unnecessary-costs-in-2022/); [Zernio docs](https://docs.zernio.com/platforms/sms/registration)
- **Agency implication:** for GoHighLevel and similar resold platforms, each client sub-account needs its own brand and campaign registration. — [Ecosire GHL guide](https://ecosire.com/hi/blog/gohighlevel-a2p-10dlc-compliance-guide)

**Call recording and AI "eavesdropping"**
- Federal law is one-party consent, but California (CIPA) and several other states require all-party consent. — [The Lyon Firm](https://www.thelyonfirm.com/blog/ai-call-monitoring-lawsuits-tcpa)
- [BK] **All-party-consent states** commonly listed: California, Delaware, Florida, Illinois, Maryland, Massachusetts, Montana, Nevada, New Hampshire, Oregon (in-person conversations), Pennsylvania, Washington. Michigan and Connecticut are nuanced. Verify per state. — [Justia 50-state survey](https://www.justia.com/50-state-surveys/recording-phone-calls-and-conversations/) (background, not fetched)
- **Live litigation theory:** plaintiffs argue AI vendors are third-party "eavesdroppers" under CIPA if they have the *capability* to use call data for their own purposes, and deploying businesses may face aiding-and-abetting claims. Cases include Navy Federal/Verint and Home Depot/Google (2024), and a 2025 class action against Sharp HealthCare over ambient AI recording. Generic "this call may be monitored" notices may not suffice. There is no controlling ruling on the capability theory yet. — [Fisher Phillips](https://www.fisherphillips.com/en/insights/insights/new-class-action-targets-healthcare-ai-recordings); [Fisher Phillips, AI call monitoring](https://www.fisherphillips.com/print/v2/content/41622/ai-call-monitoring-lawsuits-are-heating-up.pdf); [NoJitter](https://www.nojitter.com/contact-center-customer-experience/why-recent-ai-linked-lawsuits-will-impact-your-contact-center)

**State AI disclosure / chatbot laws**
- **California:** SB 1001 (Bot Disclosure Law, in force since 2019) makes it unlawful to use a bot to mislead someone about its artificial identity to incentivize a sale. SB 243 ("companion chatbot" safety and disclosure, effective Jan 1, 2026) mainly targets companion platforms. — [Miller Nash](https://www.millernash.com/industry-news/from-colorado-to-texas-how-states-are-rewriting-ai-laws); [Vaquill](https://www.vaquill.ai/blog/ai-chatbot-and-ai-disclosure-laws-by-state)
- **Utah AI Policy Act (as amended):** disclosure is required when a consumer clearly asks whether they are talking to AI, and proactively in "high-risk" interactions involving health, financial or biometric data, and for regulated occupations. — [Beancount guide, Jul 2026](https://beancount.io/blog/2026/07/19/ai-chatbot-human-disclosure-laws-state-guide)
- **Colorado:** the original AI Act (SB 24-205) was delayed by SB 25B-004, then repealed and replaced by **SB 26-189** (signed May 14, 2026). The replacement is a notice-and-disclosure regime for automated decision-making, effective Jan 1, 2027, pending AG rulemaking. The xAI suit (filed Apr 2026, with DOJ intervening) is effectively paused until after rulemaking. Separately, **HB 26-1263** (signed May 29, 2026, effective Jan 1, 2027) reportedly requires public-facing conversational AI to disclose that it is AI. — [McDermott](https://www.mcdermottlaw.com/insights/colorado-ai-law-in-flux-comprehensive-replacement-bill-signed-after-federal-court-blocks-predecessors-enforcement/); [DWT](https://www.dwt.com/blogs/privacy--security-law-blog/2026/05/colorado-ai-act-repeal-new-transparency-law); [Beancount](https://beancount.io/blog/2026/07/19/ai-chatbot-human-disclosure-laws-state-guide)
- **Status roll-up (secondary, Oct 2026 guide):** chatbot disclosure laws are in force in CA, UT, NY and ME. Signed but not yet in force are CO, CT, OR and WA (Jan 1, 2027) and ID and GA (Jul 1, 2027). Treat this as unverified against statutes. — [Entagl](https://www.entagl.com/blog/us-ai-chatbot-disclosure-laws-2026); [Vaquill](https://www.vaquill.ai/blog/ai-chatbot-and-ai-disclosure-laws-by-state)
- **Federal preemption push:** EO 14365 (Dec 11, 2025) directed a DOJ AI Litigation Task Force, formalized Jan 9, 2026, to challenge state AI laws. It also directed a Commerce review that may affect BEAD funds and FTC guidance on preemption. It carves out child-safety laws. Congress has *not* enacted preemption: the Senate voted 99-1 in 2025 to strip a 10-year moratorium, and the language was not included in the FY26 NDAA. State laws therefore remain enforceable unless enjoined. — [McDermott Will & Emery](https://mwe.com/insights/white-house-eo-moves-to-restrict-state-ai-legislation); [Manatt](https://www.manatt.com/insights/newsletters/client-alert/trump-executive-order-targets-state-ai-laws-raising-questions-and-risks); [MWC](https://mwcllc.com/2026/01/20/executive-order-targets-state-ai-regulation-through-federal-preemption/)

**Legal intake (attorney ethics)**
- **Oregon State Bar Formal Op. 2026-208 (Feb 2026):** lawyers may use chatbots and AI agents for marketing and intake. AI agents need greater supervision than rule-based bots, and autonomous actions such as sending an engagement letter should require lawyer approval. The opinion flags RPC 7.3(a)'s ban on soliciting people whose emotional or mental state impairs their judgment. — [OSB opinion PDF](https://www.osbar.org/_docs/ethics/2026-208.pdf)
- **ABA Formal Op. 506 (2023):** nonlawyers may do intake under Rule 5.3 supervision, but prospective clients must be able to discuss fees and scope with a lawyer. **ABA Formal Op. 512 (2024):** the existing Model Rules apply to generative AI. — [Indiana Lawyer](https://theindianalawyer.com/?p=211737); [Clio](https://www.clio.com/resources/ai-for-lawyers/ethics-ai-law/)
- [BK] **Model Rule 7.3** bars *live person-to-person* solicitation for pecuniary gain. Whether AI outbound calls count as "live" is unsettled, and outbound AI cold-calling of accident victims is high-risk under both TCPA and ethics rules. Rule 7.1 also bars misleading communications, which counts against an AI that implies it is a lawyer.

**HIPAA (healthcare-adjacent niches)**
- [BK] A vendor that creates, receives or transmits PHI for a covered entity (medical, dental, chiro, PT) is a business associate. A signed BAA is required with the agency *and* each downstream subprocessor (voice AI platform, LLM, telephony, SMS, CRM), with safeguards under the Security Rule. Many consumer-tier AI and SMS tools will not sign BAAs. Appointment-reminder texts are generally permissible treatment communications, but marketing uses of PHI need authorization. — [HHS business associates guidance](https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/business-associates/index.html) (background, not fetched)
- Ambient and AI recording in healthcare is already drawing CIPA class actions (Sharp, 2025). — [Fisher Phillips](https://www.fisherphillips.com/en/insights/insights/new-class-action-targets-healthcare-ai-recordings)

**CAN-SPAM (email follow-up)**
- [BK] CAN-SPAM requires: no false or misleading headers or subject lines, identifying the message as an ad (for commercial email), a valid physical postal address, a clear opt-out honored within 10 business days, and responsibility for vendors who send on your behalf. Penalties can exceed $50,000 per email (inflation-adjusted). CAN-SPAM is opt-out, not opt-in, but Gmail and Yahoo bulk-sender rules (2024) add SPF, DKIM and DMARC requirements, one-click unsubscribe and spam-rate thresholds. — [FTC CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) (background, not fetched)

### Practical compliance checklist (synthesized; not legal advice)

**A. Inbound AI receptionist (lowest risk)**
1. Open with a disclosure such as "You've reached [Business]'s AI assistant; this call is recorded." This covers all-party-consent states (CA, FL, IL, PA, WA, etc.) and AI-disclosure laws (UT high-risk, CA SB 1001, CO/CT/OR/WA from 2027). Always answer truthfully if a caller asks whether it is AI.
2. Offer a human handoff or callback path, which is consistent with the 87% Gartner finding.
3. Vendor contract: confirm the voice AI and LLM vendors do not train on or reuse call data, which reduces CIPA "capability" exposure. Put a DPA in place and set retention limits.
4. Health niches: get BAAs across the chain, use a minimum-necessary PHI script, and avoid ambient recording without explicit consent.
5. Legal niches: no legal advice, no fee quotes, no "I'm an attorney" implication, conflict-check data handling, lawyer approval before engagement, and supervision under Rules 5.3 and 5.1.
6. Getting consent during the inbound call for follow-up texts ("Can we text you about this request?") creates TCPA consent for later SMS. Log it.

**B. Outbound AI calling (highest risk)**
1. Treat every AI-voice call as an artificial/prerecorded-voice call (FCC 2024). Marketing calls need prior express *written* consent, and informational calls need at least prior express consent. No cold AI calls to cell phones or residential lines.
2. Disclose the caller's identity at the start, give a callback number, provide an automated opt-out (the interactive opt-out mechanism the TCPA requires for artificial-voice telemarketing), and disclose AI up front, as proposed in the FCC NPRM and required under several state laws.
3. Scrub National DNC, state DNC lists and internal DNC lists. Respect calling hours (8am–9pm local, stricter under state mini-TCPAs). Honor revocations by any reasonable means within 10 business days.
4. Keep consent records (timestamp, form text, IP, seller name). One-to-one consent is no longer federally required, but naming the specific seller remains best practice for defensibility.
5. Do not use outbound AI calls for legal solicitation (Rule 7.3 risk) or for health marketing without HIPAA authorization.

**C. SMS follow-up / missed-call text-back**
1. Register an A2P 10DLC brand and campaign for each client business, using a Standard or Low-Volume brand if the client has an EIN. Budget roughly 1–2 weeks and small registration fees.
2. A missed-call text-back replying to an inbound call is generally treated as responsive or informational, but it should contain no marketing. Get express consent before any marketing texts, and written consent for automated marketing.
3. Every message should identify the business and include "Reply STOP to opt out." Honor STOP, and any reasonable opt-out wording, promptly. Observe quiet hours and state mini-TCPAs (e.g., FL).
4. Health: no PHI beyond the minimum in texts, and the SMS vendor must sign a BAA.

**D. Email follow-up:** follow CAN-SPAM (address, opt-out, honest subject line) and Gmail/Yahoo sender authentication.

### Inferences
- An inbound-first offer (AI receptionist plus missed-call text-back) avoids most TCPA exposure and is the safer product for a solo agency. Outbound AI dialing raises statutory-damages class-action risk that the agency may share as the "maker" or a vicarious party.
- Building an AI disclosure and recording notice into every greeting now future-proofs against the CO/CT/OR/WA 2027 effective dates and CIPA claims.
- Federal preemption (EO 14365) is a litigation strategy, not enacted law. Plan for state compliance.

### Gaps
- Final status of the FCC's Aug 2024 AI-call NPRM as of Oct 2026 is unconfirmed.
- Exact Federal Register citation for the Jan 2026 revocation-all delay to Jan 31, 2027 is unconfirmed (secondary sources only).
- Text and obligations of Colorado HB 26-1263 and the CT/OR/WA/ID/GA chatbot laws were not verified against enacted bills.
- No court ruling yet on the CIPA "capability" theory for AI vendors.
- Current 2026 10DLC carrier fee schedules were not verified; most fee data is from 2023–2025.
- No ABA opinion directly addresses AI outbound calls under Rule 7.3.
