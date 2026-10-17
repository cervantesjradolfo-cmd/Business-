# Underserved US Specialty-Trade and Field-Service Niches for a Solo AI Front-Office Agency (as of October 2026)

Scope: US niches outside the core of ServiceTitan, Jobber and Housecall Pro (HVAC, plumbing, electrical) where a solo agency selling an AI receptionist, missed-call text-back, website chat, quote follow-up and review requests could win. Research date: 2026-10-17.

How to read this file:
- **VERIFIED** means a primary-source number. Establishment counts are from the US Census County Business Patterns 2023 national file (cbp23us.txt, released 2025, the latest CBP year available). I downloaded and parsed it directly from https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23us.zip. CBP counts **employer establishments only**. Nonemployer sole proprietors, of which there are many in pressure washing, detailing, junk removal and handyman-type trades, are not included, so the true number of businesses is higher.
- **ESTIMATE** means vendor marketing, a cost guide, or my own inference.
- Many NAICS codes are broader than the niche itself. The mapping is flagged in each row.

---

## Q1. How big is each niche (number of US establishments) and how small are the firms?

### Takeaway
Several non-core niches have 4,000 to 43,000 employer establishments each, and 50 to 75% of them have fewer than 5 employees. These are owner-operator shops with no front office, which is the profile that buys an AI receptionist. The largest addressable pools outside HVAC, plumbing and electrical are janitorial (67.8k), "all other specialty trade" (42.7k, which includes fencing), concrete (23.4k), drywall (20.8k), car wash/detailing (19.8k), other services to buildings (18.1k, which includes pressure washing, chimney and duct cleaning), and flooring (18.0k).

### Cited Findings (all VERIFIED, CBP 2023, US totals, all legal forms) — [Census CBP 2023 national file](https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23us.zip)

| NAICS | Census label / niche mapping | Employer establishments | Employees | Est. with <5 employees | % <5 emp |
|---|---|---|---|---|---|
| 561720 | Janitorial services (commercial cleaning, window cleaning) | 67,799 | 1,088,193 | 41,548 | 61% |
| 238990 | All other specialty trade contractors (includes **fencing**, paving/driveway sealing, etc.) | 42,748 | 309,293 | 28,627 | 67% |
| 238110 | Poured concrete foundation and structure (**concrete/flatwork**) | 23,350 | 272,692 | 13,738 | 59% |
| 238310 | Drywall and insulation contractors | 20,760 | 250,758 | 12,592 | 61% |
| 811192 | Car washes (includes **auto detailing**) | 19,807 | 172,644 | 10,352 | 52% |
| 561790 | Other services to buildings and dwellings (**pressure washing, chimney sweeps, gutter/duct cleaning**) | 18,069 | 90,169 | 13,290 | 74% |
| 238330 | Flooring contractors (includes **epoxy flooring**) | 17,989 | 84,998 | 13,809 | 77% |
| 238140 | Masonry contractors | 18,258 | 139,844 | 12,550 | 69% |
| 561710 | Exterminating and pest control (comparison only; GorillaDesk/PestPac own it) | 16,535 | 139,150 | 9,415 | 57% |
| 811490 | Other personal and household goods repair (includes **boat repair, small engine repair**) | 11,482 | 40,317 | 9,145 | 80% |
| 562111 | Solid waste collection (includes **junk removal** plus large haulers) | 10,982 | 238,764 | 4,785 | 44% |
| 237110 | Water and sewer line construction (includes **water well drilling**) | 10,841 | 166,727 | 5,085 | 47% |
| 488410 | Motor vehicle **towing** | 10,566 | 73,320 | 6,395 | 61% |
| 484210 | Used household and office goods moving (**movers**) | 9,436 | 102,745 | 5,054 | 54% |
| 238170 | Siding contractors (includes many **gutter installers**) | 9,142 | 41,885 | 6,866 | 75% |
| 238290 | Other building equipment contractors (includes **garage door installation**, elevators, etc.) | 8,107 | 150,522 | 3,728 | 46% |
| 238390 | Other building finishing contractors (includes **acoustic ceilings**) | 8,076 | 84,342 | 4,779 | 59% |
| 811122 | Automotive glass replacement shops (adjacent to **window tint**) | 7,201 | 36,983 | 4,708 | 65% |
| 238150 | Glass and glazing contractors | 6,945 | 68,694 | 3,599 | 52% |
| 561740 | Carpet and upholstery cleaning | 6,673 | 36,157 | 4,829 | 72% |
| 339950 | Sign manufacturing (**sign companies**) | 5,895 | 75,898 | 3,024 | 51% |
| 562910 | Remediation services (includes **mold/asbestos**; water restoration is partly elsewhere) | 5,826 | 91,239 | 2,741 | 47% |
| 811412 | Appliance repair and maintenance | 5,595 | 24,621 | 4,449 | 80% |
| 811198 | All other automotive repair (includes some RV/undercoating/specialty) | 5,368 | 22,057 | 4,227 | 79% |
| 562991 | Septic tank and related services | 4,054 | 32,666 | 2,385 | 59% |
| 561622 | **Locksmiths** | 3,961 | 16,123 | 2,922 | 74% |
| 562119 | Other waste collection (some junk/dumpster) | 1,571 | 14,188 | 1,012 | 64% |
| — | Comparison: 238220 Plumbing/HVAC (titan core) | 111,207 | 1,214,761 | 64,871 | 58% |
| — | Comparison: 238210 Electrical (titan core) | 83,342 | 1,015,983 | 48,799 | 59% |
| — | Comparison: 561730 Landscaping (includes **tree service**) | 117,969 | 802,899 | 83,241 | 71% |

### Inferences
- Tree service has no NAICS code of its own. It sits inside 561730 Landscaping (118k). The tree-specific count is an unknown share of that, and I found no TCIA census.
- Garage doors: 238290 mixes elevator and other equipment contractors, so garage-door-specific employer establishments are probably a fraction of 8.1k. Many garage door firms are also coded 238350 or 444 retail. Treat 8.1k as an upper bound for the code, not a niche count.
- Junk removal: 562111 is dominated by large municipal and commercial haulers (median firm is bigger). The small junk-removal operators are underrepresented here and mostly nonemployers or franchises (1-800-GOT-JUNK, College Hunks, Junk King).
- Pressure washing, window cleaning and mobile detailing are heavily nonemployer businesses. CBP undercounts them badly, and the true number of operators is probably several times the employer count. This is an inference; I did not pull Nonemployer Statistics.
- "Under 5 employees" share is highest in appliance repair (80%), small engine/boat repair (80%), flooring (77%), gutters/siding (75%), services to buildings (74%) and locksmiths (74%). These are the shops least likely to have a dedicated CSR.

### Gaps
- Nonemployer Statistics (NES) counts were not retrieved. The Census API now requires a key (the request returned "Missing Key"). Running the NES bulk file would add the solo-operator counts.
- No NAICS-level count exists for tree service, fencing, epoxy, gutters-only, chimney, pressure washing, window tint, RV repair, solar O&M or foundation repair specifically.
- Solar maintenance and foundation repair were not mapped (foundation repair falls mostly in 238110/238190; solar O&M in 238220/238210).

---

## Q2. Which niches have their own vertical software, and does it bundle AI calling/chat yet?

### Takeaway
By October 2026 the "titan" problem has spread beyond HVAC, plumbing and electrical. Pools (Skimmer AI Phone, April 2026), pest (GorillaDesk AI Agents, 2025), moving (SmartMoving "Smart Scout", Nov 2025) and Jobber/Housecall Pro users (both now sell AI receptionists) already have a native AI option. Towing (Towbook "Towbi") and tree care (ArboStar "RAI") have announced AI but have no confirmed live voice agent. Septic (ServiceCore) showed no AI. The most open ground is in niches with no dominant vertical tool at all, such as fencing, concrete, drywall, junk removal, locksmiths, chimney, pressure washing, garage door, appliance repair, small engine/marine and sign shops.

### Cited Findings
**General FSM platforms (the competition for any niche that uses them):**
- Jobber Receptionist is described as a $29/month AI add-on that handles calls and texts 24/7 and books visits; Housecall Pro "CSR AI"/AI Team answers and books 24/7 as a paid add-on; ServiceTitan Contact Center Pro has AI Virtual Agents for overflow/after-hours. ESTIMATE (third-party comparison, prices checked Sept 2026) — [sagnikbhattacharya.com comparison](https://sagnikbhattacharya.com/blog/jobber-housecall-pro-servicetitan-ai); [Stork comparison](https://www.stork.ai/compare/housecall-pro-ai-team-vs-jobber-ai-receptionist)
- ServiceTitan states its Contact Center Pro AI Virtual Agents "help you book jobs 24/7, handling overflow and after-hours calls." VERIFIED (vendor page) — [ServiceTitan Contact Center Pro](https://www.servicetitan.com/features/pro/contact-center/manager-assist)

**Niche vertical software:**
- **Pools – Skimmer:** "AI Phone" announced April 22, 2026 as live for all paying customers. It gives 24/7 AI call answering and costs $99/month at launch price. VERIFIED (vendor) — [Skimmer announcement](https://thepooldeck.getskimmer.com/news-trends-training-3/introducing-ai-phone-now-live-for-all-skimmer-customers-1302); [Skimmer AI Phone FAQ](https://help.getskimmer.com/article/322-ai-phone-faq)
- **Pest – GorillaDesk:** AI Agents, including a "VOIP Phone Agent" ("never miss a call again"), were added in 2025. VERIFIED (vendor) — [GorillaDesk AI Agents](https://gorilladesk.com/features/ai-agents); [Contractor Mag, Sept 2025](https://www.contractormag.com/technology/article/55316038/innovative-ai-solutions-transforming-business-operations-and-customer-interactions)
- **Moving – SmartMoving:** "Smart Scout" AI phone assistant logs leads into SmartMoving in real time (blog dated Nov 6, 2025). VERIFIED (vendor) — [SmartMoving blog](https://www.smartmoving.com/blog/this-ai-assistant-has-your-phones-covered). Supermove and MoveitPro: I found no native AI phone product. Third parties say they connect via Zapier — [NextPhone movers page](https://www.getnextphone.com/answering-service-for-movers)
- **Towing – Towbook:** The "Towbi" AI layer (AI call intake, automated status updates, impound lookup) is announced as upcoming with no launch date. VERIFIED that it is announced, NOT verified as live — [Towbook Towbi page](https://future.towbook.com/). Third-party AI answering services already integrate with Towbook, such as AgentZap (from $109/mo, vendor claim) and NextPhone — [AgentZap Towbook integration](https://agentzap.ai/integrations/towbook); [NextPhone Towbook](https://www.getnextphone.com/integrations/towbook)
- **Tree care – ArboStar:** "RAI" AI assistants announced in beta. I found no evidence that RAI includes voice/phone answering. SingleOps had no AI voice agent in the results — [ArboStar RAI press release](https://www.accessnewswire.com/newsroom/en/computers-technology-and-internet/arbostar-announces-rai-the-worlds-first-ai-built-by-arborists-for-1084347)
- **Septic/portable toilets – ServiceCore:** Routing, dispatch, invoicing and QuickBooks; Capterra 4.0/5 (51 reviews). No AI features found — [Capterra ServiceCore](https://capterra.com/p/158918/ServiceCore/reviews/)
- **Water/mold restoration:** A crowded field of AI intake tools exists, including FieldCamp 24/7 AI intake, QuoteIQ AI receptionist (from $29.99/mo), Proof AI, Trillet ($49/mo backup line) and Smith.ai hybrid. Restoration is therefore NOT underserved for AI intake. ESTIMATE (vendor pages) — [FieldCamp restoration](https://fieldcamp.ai/sg/water-damage-restoration/); [Trillet](https://trillet.ai/blogs/ai-answering-service-for-water-damage-restoration)

**Horizontal AI-receptionist competitors already targeting these niches:** AgentZap, NextPhone, My AI Front Desk, Ciela and SchedulingKit all publish niche landing pages (movers, towing, etc.) — [My AI Front Desk movers](https://www.myaifrontdesk.com/features/ai-receptionist-for-moving-companies); [Ciela movers](https://ciela.ai/agents/ai-receptionist-for-moving-companies)

### Inferences
- The defensible gap for a solo agency is not "no AI exists". Cheap self-serve AI receptionists ($29–$109/mo) exist for almost every niche. The gap is **done-for-you setup, integration and ongoing tuning** in niches whose owners won't configure software themselves, and **bundling** the AI receptionist with text-back, quote follow-up and review requests.
- Avoid or deprioritize: pools (Skimmer bundles it), pest (GorillaDesk/PestPac), restoration (crowded), and any niche where most shops already run Jobber or Housecall Pro, since the vendor's $29 add-on undercuts you. Moving is contested now that SmartMoving bundles AI, but Supermove and spreadsheet-run movers are still open.
- Towing is a timing window. Towbi is announced but not live, so an agency could sign Towbook users now. The risk is that Towbook ships native AI within 12 months.
- Niches with no dominant vertical tool, where owners use generic tools (Jobber/HCP for some; QuickBooks, Google Voice, paper and spreadsheets for many), are the best fit. These include fencing, concrete/flatwork, drywall/acoustic subs, epoxy, gutters, chimney, pressure washing, window cleaning, junk removal (independents), garage door (independents), locksmiths, appliance repair, small engine/marine/RV, sign shops and well drilling. This is an inference from the absence of AI-native verticals in searches, not a survey.

### Gaps
- I did not verify AI features for Supermove, ResponsiBid (window/pressure washing), Urable/Mobile Tech RX (detailing), DockMaster (marine), ShopVOX (signs), Swept/CleanGuru (janitorial), or locksmith- and garage-door-specific tools. Searches returned nothing on Urable or Swept.
- I found no survey of software adoption rates by niche.

---

## Q3. Evidence of missed calls / slow lead response, and where the phone is still the main channel

### Takeaway
The best 2026 figure is Invoca's July 2026 benchmark: only 52% of inbound home-services calls are answered by a person (65% excluding calls of 15 seconds or less). The rate varies widely by sub-trade, from 34% for HVAC to 74% for plumbing. The often-quoted "62% unanswered" figure is a 2016 study. Emergency, phone-first niches (towing, locksmith, garage door, water damage, septic backups, tree emergencies after storms) have the highest stakes on an unanswered call.

### Cited Findings
- Invoca 2026 Home Services Lead Conversion Benchmarks (July 2026): 52% of calls answered by a person; 65% for calls over 15s; 73% for calls over 30s. By sub-industry: plumbing 74%, pest 73%, carpeting 65%, HVAC 34%, construction 32%. VERIFIED headline, but the sub-industry numbers come only from a secondary summary and the sample size is not disclosed — [Invoca report page](https://invoca.com/reports/the-invoca-home-services-lead-conversion-benchmarks-report-2026); [PPC Land summary](https://ppc.land/invoca-packages-ai-agents-as-google-bills-missed-lsa-calls-over-20-seconds/)
- PPC Land reports that Google bills missed Local Services Ads calls over 20 seconds. That means owners pay for leads they don't answer, which makes a direct ROI argument for AI answering — [PPC Land](https://ppc.land/invoca-packages-ai-agents-as-google-bills-missed-lsa-calls-over-20-seconds/)
- CallRail (Jan 2025 SMB benchmark): home services missed 14% of calls (lead-based measure). A CallRail 2025 consumer survey found 78% of consumers have abandoned a business after an unanswered call, and only 42% leave a voicemail. Reported via a secondary summary; I did not fetch the primary page — [JustCall missed-call stats](https://justcall.io/blog/missed-call-statistics.html); [Zadarma research summary](https://zadarma.com/en/blog/missed-calls-cost-research/)
- The "62% of calls to small businesses go unanswered" figure traces to 411 Locals, a 2016 30-day study of 85 businesses that counted voicemail as unanswered. It is DATED. — [JustCall](https://justcall.io/blog/missed-call-statistics.html)
- Vendor claims such as "74.1% of calls unanswered across 45 contractors" and "67% of moving calls go unanswered" (AgentZap) are unverified marketing figures — [Stealth Agents](https://stealthagents.com/research/home-services-missed-call-revenue-statistics-2026); [AgentZap SmartMoving page](https://agentzap.ai/integrations/smartmoving)
- Towing: AgentZap's Towbook material centers on 24/7 dispatch phones, motor-club calls and accident intake, which shows towing is phone-first and around the clock (vendor source) — [AgentZap: stop missing tow calls](https://agentzap.ai/blog/how-to-stop-missing-tow-calls-in-towbook-2026)
- Locksmiths: Google Maps has long been flooded with fake locksmith lead-gen listings that route to call centers, and Google has required Advanced Verification for US locksmith advertisers since 2018. Legitimate shops lose calls to these operators. Coverage is mostly 2016–2018 and DATED — [Wikipedia: Locksmith scam](https://en.wikipedia.org/wiki/Locksmith_scam); [Search Engine Land](https://searchengineland.com/googles-fake-locksmith-problem-once-again-hits-the-new-york-times-241473)

### Inferences (channel profile per niche; ESTIMATE based on the nature of the work)
- **Emergency / phone-first, after-hours critical:** towing, locksmiths, garage door (stuck door or broken spring), water/mold restoration, septic backups, tree service after storms, glass/glazing (broken storefront), appliance repair (refrigerator down). The first business to answer usually wins the job, so a missed after-hours call is lost revenue.
- **Phone plus web-form quote requests, slow follow-up is the problem:** fencing, concrete/flatwork, epoxy, gutters, foundation repair, pressure washing, window cleaning, junk removal, moving, sign companies. The value here is in quote follow-up and speed-to-lead more than in 24/7 answering.
- **B2B / GC-driven (weaker fit for an AI receptionist):** drywall and acoustic ceiling subs and commercial janitorial get work through GC bid invitations (BuildingConnected, etc.) and relationships rather than consumer calls. Review requests and missed-call text-back are low value there. Better fit: bid follow-up automation.

### Gaps
- I found no niche-specific, independent missed-call study for towing, locksmith, fencing and similar trades. Every per-niche "X% missed" number found was vendor marketing.
- I did not fetch the Invoca PDF itself, which is gated.

---

## Q4. Ticket value, ability to pay, seasonality and regulatory issues by niche

### Takeaway
High-ticket, project-based niches (fencing ~$3.8k, concrete, foundation, epoxy, garage door replacement ~$1.2k–$2.5k) can easily justify $300–$800/month for automation from one recovered job. Low-ticket, high-volume emergency niches (lockouts, tows, junk loads ~$209–$234) justify it through call volume. Regulation is light in most of these niches. The main exposure is TCPA/FCC consent for AI voice and texts, plus state licensing for locksmiths (about 13 states) and towing (state and municipal rules).

### Cited Findings — ticket values (ESTIMATE; cost guides, mostly dated)
- Fence repair costs $302–$922 (national average $594); a vinyl fence install averages about $3,800 (archived Angi data) — [Bob Vila fence repair](https://www.bobvila.com/articles/fence-repair-cost.md); [Angi archive](https://webcf.waybackmachine.org/web/20220926234856/https://www.angi.com/articles/cost)
- Garage door repairs cost $150–$600, a torsion spring $200–$600 and a replacement $800–$2,500+ (Housecall Pro 2026). Bob Vila conflicts with itself, giving both a $1,200 average and a $2,500 average for replacement — [Housecall Pro garage door guide](https://www.housecallpro.com/resources/garage-door-price-guide/); [Bob Vila garage door](https://www.bobvila.com/articles/garage-door-replacement-cost.md)
- Tree removal averages $750 (range $200–$2,000; Angi, 2022 snapshot, DATED) — [Angi archive](https://webcf.waybackmachine.org/web/20221217024526/https://www.angi.com/articles/cost)
- Septic pumping averages $400 (Angi, 2022 snapshot, DATED) — [Angi archive](https://webcf.waybackmachine.org/web/20221011100611/https://www.angi.com/articles/cost?page=5)
- Junk removal averages $234 per load (Method) or $209.10 (Plyrium, unsourced); a standard pickup is $150–$350 and a cleanout $450–$800+ (Housecall Pro). The sources conflict slightly — [Method](https://www.method.me/pricing-guides/how-much-to-charge-for-junk-removal/); [Plyrium](https://www.plyrium.com/academy/junk-removal/how-to-start-from-scratch); [Housecall Pro junk pricing](https://www.housecallpro.com/resources/junk-removal-pricing/)
- Fake-locksmith call centers quote $35–$90 and then inflate the price on site, which indicates legitimate lockout pricing sits above that (DATED) — [Wikipedia: Locksmith scam](https://en.wikipedia.org/wiki/Locksmith_scam)
- Payroll intensity from CBP 2023 (VERIFIED, annual payroll ÷ establishments) is a rough ability-to-pay proxy. Computed from [CBP 2023](https://www2.census.gov/programs-surveys/cbp/datasets/2023/cbp23us.zip):
  - Garage door / other equipment (238290): $13.6B / 8,107 ≈ $1.68M per establishment
  - Remediation (562910): ≈ $1.21M
  - Water/sewer/well (237110): ≈ $1.24M
  - Drywall (238310): ≈ $805k
  - Concrete (238110): ≈ $824k
  - Glass/glazing (238150): ≈ $689k
  - Sign manufacturing (339950): ≈ $753k
  - Septic (562991): ≈ $494k
  - Moving (484210): ≈ $497k
  - Specialty trade incl. fencing (238990): ≈ $513k
  - Towing (488410): ≈ $358k
  - Flooring (238330): ≈ $287k
  - Services to buildings (561790): ≈ $241k
  - Appliance repair (811412): ≈ $207k
  - Locksmiths (561622): ≈ $209k
  - Small engine/boat/other repair (811490): ≈ $160k

### Cited Findings — regulatory
- FCC Declaratory Ruling (Feb 8, 2024, FCC 24-17): AI-generated voices count as "artificial" voices under the TCPA. Outbound AI voice calls require prior express consent, and the ruling also reaches AI robotexting. Inbound AI answering is not the target, but outbound quote follow-up calls and texts need consent. I found no 2026 change. VERIFIED (law-firm analyses) — [Brownstein: FCC Declares AI-Generated Calls Subject to TCPA](https://www.bhfs.com/insight/fcc-declares-ai-generated-calls-subject-to-tcpa/); [Wiley alert](https://wiley.law/alert-FCC-Extends-Regulatory-Reach-Over-AI-Announces-TCPA-Restrictions-Cover-AI-Generated-Voices-in-Outbound-Calls)
- Locksmith licensing: 13 states require it (AL, CA, CT, IL, LA, MD, NV, NJ, NC, OK, OR, TX, VA), plus local rules in NYC, Nassau County, Miami and Hillsborough County. Nebraska and Tennessee reportedly repealed theirs in 2021 (some conflict on TN) — [Locksmith Ledger state review](https://www.locksmithledger.com/home/article/21254499/locksmith-licensing-a-statebystate-review); [Best Key Supply 2026 guide](https://www.bestkeysupply.com/blogs/tips-tricks-and-field-notes/which-states-require-a-locksmith-license-2026-state-by-state-guide)
- Google requires Advanced Verification for US locksmith advertisers, since 2018 — [Wikipedia: Locksmith scam](https://en.wikipedia.org/wiki/Locksmith_scam)

### Inferences — niche scorecard (my synthesis; ESTIMATE)
Scale: H = high, M = medium, L = low.

| Niche | Ticket | Lead channel | After-hours urgency | Vertical-AI threat (Oct 2026) | Ability to pay | Seasonality | Regulatory notes | Agency fit |
|---|---|---|---|---|---|---|---|---|
| Garage door repair | $150–$600 repair; $0.8–2.5k replace | Phone, emergency | H | M (many use HCP/ServiceTitan/Jobber) | H | Low; spring breaks year-round | Light; consumer contracts | **Strong** (focus on independents not on HCP/ST) |
| Fencing | ~$600 repair; ~$3.8k install | Web form + phone, quote follow-up | L | L | H | Spring–fall peak | HOA/permits; light | **Strong** (quote follow-up) |
| Concrete / flatwork / epoxy | Multi-$k | Phone + form, estimates | L | L | H | Strongly seasonal in North | Light | **Strong** |
| Towing | $100s per tow; motor-club volume | Phone, 24/7 | H | M–H (Towbi announced, third-party integrations exist) | M | Winter spikes | State/municipal tow rules, rate caps in some cities | Good, but time-limited window |
| Locksmiths | Low–mid; high volume | Phone, emergency, Google Maps | H | L | M–L | Low | Licensing in ~13 states; Google verification | Good (mostly 1–4 person shops) |
| Septic / well | ~$400 pump; well jobs $k | Phone, emergency backups | H | L (ServiceCore has no AI) | M–H | Spring–fall pumping | EPA/state wastewater rules; light for front office | **Strong** (rural, phone-first, low tech) |
| Tree service | ~$750 avg; storm work higher | Phone, storm surges | M–H | L–M (ArboStar RAI in beta, no confirmed voice) | M–H | Storm-driven; spring–fall | Light; ISA cert optional | **Strong** |
| Junk removal (independents) | ~$209–$234 per load | Phone, web, SMS | L–M | L–M (franchises have call centers) | M | Spring–summer | Light; disposal rules | Good |
| Moving | $1k+ local | Phone + web quote requests | M | **H** (SmartMoving Smart Scout) | M | Summer peak | FMCSA/state household-goods rules | Medium; target Supermove and spreadsheet movers |
| Pressure washing / window cleaning | $200–$800 | Web + phone | L | L–M (Jobber is common) | L–M | Spring–fall | Light | Medium (low ticket, many nonemployers) |
| Chimney sweep | Low–mid; repairs higher | Phone | L | L | M | Fall/winter peak | Light | Medium |
| Appliance repair | Low–mid | Phone, urgent | M | L | L–M (~$207k payroll per est.) | Low | Light | Medium |
| Glass / glazing | Mid–high | Phone, emergency board-up | M | L | H | Low | Light | Good |
| Sign companies | Mid–high B2B | Web/phone, quotes | L | L | M–H | Low | Permits | Medium (quote follow-up) |
| Small engine / marine / RV repair | Low–mid; marine higher | Phone, seasonal backlog | L | L | L–M | Very seasonal | Light | Medium–low |
| Drywall / acoustic ceilings | Project/GC | GC bid invites | L | L | M–H | Low | Light | **Weak** for AI receptionist; fits bid follow-up instead |
| Commercial janitorial | Recurring contracts | B2B RFPs | L | L | M | Low | Light | Weak–medium |
| Mold / water restoration | High (insurance) | Phone, 24/7 | H | **H** (crowded AI-intake market) | H | Storm/weather | IICRC, state mold licensing in some states | Avoid unless a differentiated offer |
| Pools / pest (for contrast) | — | — | — | **H** (Skimmer, GorillaDesk) | — | — | — | Avoid |

Other inferences:
- **Shortlist ranking for a solo agency:** garage door (independents), fencing, concrete/flatwork/epoxy, septic/well, tree service, locksmiths, towing (now, before Towbi), glass/glazing and junk removal (independents). These combine phone-first or quote-heavy leads, no bundled AI from the vertical's own software, small owner-run shops (55–75% under 5 employees), and enough ticket value to pay $200–$600/month.
- Seasonal niches (concrete, fencing, tree, septic, marine, chimney) suggest either seasonal pricing or a pitch around "capture the peak-season overflow."

### Gaps
- I found no niche-specific owner survey of tech adoption or willingness to pay. The ability-to-pay figures are a payroll proxy only.
- I found no current ticket values for towing, locksmith, epoxy, concrete, chimney, appliance, sign or marine from a reliable 2026 source.
- I could not retrieve trade association data (AMSA, TCIA, ALOA, TRAA) within the research budget. These are worth a follow-up for owner pain-point surveys.
- I did not research towing rate regulation by state, mold licensing by state, or FMCSA household-goods rules for movers.
- I did not mine Reddit or trade forums for owner pain points in this pass.
