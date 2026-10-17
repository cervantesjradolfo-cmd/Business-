# Lead Finder

Lead Finder finds local businesses that are missing the things you build (a website, online booking, an AI chat assistant, online payments, review collection), scores them as sales leads, and writes the first outreach message for you.

## What it does

1. You enter a town (or ZIP or address), pick a category and a radius.
2. It lists businesses from OpenStreetMap, then checks each business's website homepage for gaps (no website, not mobile-friendly, no online booking, no chat, outdated, slow and more). The same check looks for the business's email address on the homepage, or on its contact or about page when the homepage has none.
3. Each lead gets an opportunity score from 0 to 100 (no website scores highest), a list of gaps in plain words, recommended services and an estimated deal value.
4. For each lead you get a cold email, a text message and a phone opener. Templates are the default. With an Anthropic API key they are written by Claude.
5. You can set a status (New, Contacted, Replied, Won, Lost), add notes, save leads across searches and export to CSV.

The score and the deal value are estimates, not promises.

## Run it locally

```bash
cd lead-finder
npm install
npm run dev
```

Open the address Vite prints. The API (`/api/search`, `/api/audit`, `/api/pitch`, `/api/projects`, `/api/send`, `/api/followup`, `/api/inbox`, `/api/reply`) runs inside the dev server, so nothing else is needed.

Other commands: `npm run build`, `npm test`, `npm run lint`.

Optional: copy `.env.example` to `.env.local` and fill it in.

## Deploy to Vercel

1. Import the repository in Vercel.
2. Set the **Root Directory** to `lead-finder`.
3. Add the environment variables below. Set `APP_ACCESS_KEY` (or turn on Vercel Deployment Protection) before you share the URL, see "Protect your deployment".
4. Deploy. The functions in `api/` are picked up automatically (`vercel.json` allows up to 60 seconds per call).

### Private deploy in one command

`npm run deploy:private` deploys to Vercel so that only you can open the site. It turns on
Vercel Authentication (visitors must be signed in to your Vercel account), sets an
`APP_ACCESS_KEY` as a second lock on the API, deploys to production, and checks that a
signed-out request is refused. It needs these environment variables:

| Variable | Needed | What for |
| --- | --- | --- |
| `VERCEL_TOKEN` | yes | A token from https://vercel.com/account/tokens |
| `LEADS_CONTACT_EMAIL` | recommended | Your e-mail, sent to OpenStreetMap as they ask |
| `APP_ACCESS_KEY` | recommended | Your own access key; if unset, one is generated and printed once |
| `ANTHROPIC_API_KEY` | optional | AI-written pitches |
| `VERCEL_SCOPE` / `VERCEL_TEAM_ID` | optional | Deploy into a Vercel team instead of your personal account |

Re-run it after code changes to redeploy. Enter the access key in the app under "Your details".

## Search many places at once

Business searches have **One place** and **Many places**. With **Many places**, type or paste places one per line (cities, ZIP codes or addresses), or use **Fill with** to load the 50 largest US cities or a state's biggest cities (`src/data/places.ts`). The app searches each place in turn with the same category, radius and **Max per place**, adds new leads to one list (a business found from two places is listed once) and checks their websites as it goes. A place that can't be searched is skipped and named at the end. **Stop** ends the run and keeps what was found. Each place takes about 5 to 30 seconds, so keep the tab open for long lists (up to 100 places).

## Client profiles

Lead Finder can also find customers for your clients. Pick a profile in **Finding leads for** at the top:

- **My agency** (the default) finds businesses that are missing websites, booking and so on, and pitches your services.
- **A client profile** (for example **Asher Construction**, which does drywall, metal framing and acoustic ceilings) searches the kinds of businesses that hire that client, such as general contractors and builders, property managers and architects. The pitch is an introduction written as the client. Scores, website gaps and deal values are not used, but websites are still checked to find email addresses. Leads are ranked by how many ways there are to reach them (phone, email, website), then by distance.

### Active projects (Chicago building permits)

A client profile with permit keywords (Asher Construction has them) opens on **Active projects**. It searches the City of Chicago's public building-permit data for recent permits whose description mentions the client's kind of work (for Asher: drywall, framing, acoustic, ceiling, partition, build-out, interior alteration or renovation, gut rehab, new construction). Permits that are only one trade's work (electrical, plumbing, roofing, solar, fences and so on) are left out.

Each permit becomes a lead for the **general contractor running the job**, because that's who hires subcontractors. The lead shows the job site, the work, the permit date, the reported cost and the architect. The pitch names the job and offers to bid that scope. Leads are listed newest first, then by job size.

- **Chicago only for now.** Searches centred more than about 19 miles (30 km) from Chicago get a note instead of results. Other cities publish permits too and can be added in `server/permits.ts`.
- **No phone or email.** Permits don't list the contractor's contact details. Use **Look up** on the lead to find them.
- **Owners are never shown,** because they can be private homeowners.
- **Optional:** set `SOCRATA_APP_TOKEN` (free from the Chicago data portal) if searches get throttled. It isn't needed for normal use.
- Edit the keywords under **Profile details**, "Work to look for in building permits". Leave the field empty to turn project search off for that profile.

Each profile has its own signature details and its own saved leads. Press **Profile details** to change what the client does, their selling points, the customers to search for and who signs the pitches. Choose **+ New client profile…** in the switcher to add another client. Profiles are stored only in your browser, like your saved leads.

Only put true facts in **Selling points**: they go into the pitches as written, and the AI is told not to invent anything beyond them.

## Alerts and CRM sync

Set these in Vercel (Settings, Environment Variables) and redeploy. The Outreach tab's **Alerts and CRM** section shows what's connected.

| Variable | What it does |
|---|---|
| `SLACK_WEBHOOK_URL` | A Slack incoming webhook (`https://hooks.slack.com/...`). Posts a message when a lead replies (with the AI's label and summary) or books. |
| `ALERT_WEBHOOK_URL` | Any `https://` webhook (Zapier, Make, n8n). Gets the same alerts as JSON: `event` (`reply` or `booked`), `lead`, `from`, `intent`, `summary`, `text`. |
| `HUBSPOT_TOKEN` | A HubSpot private app token with the CRM contacts write scope. Leads with an email become contacts (company, website, phone, city, address) with a lead status: Contacted is Attempted to contact, Replied is Connected, Meeting booked and Won are Open deal, Lost is Unqualified. |
| `GHL_TOKEN` and `GHL_LOCATION_ID` | A GoHighLevel private integration token and the sub-account (location) id. Leads with an email or phone become contacts tagged `lead-finder` and `lead-finder-<status>`. |

When they're set:

- a real reply sends an alert and updates that lead in the CRM (opt-outs and auto-replies don't);
- **Meeting booked** sends a booking alert and updates the CRM;
- changing a saved lead's status in the lead panel updates the CRM;
- **Send all saved leads to CRM** sends everything you've saved, 25 at a time.

The tokens and webhook addresses stay on the server (`GET /api/integrations` only says yes or no for each), and the API can't be pointed anywhere else.

## Environment variables

| Name | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Optional. Turns on AI-written pitches. Without it, templates are used. |
| `LEADS_CONTACT_EMAIL` | Set this to your own e-mail. It goes in the User-Agent (and the `email` parameter) sent to OpenStreetMap, which asks for a real contact. When unset, the User-Agent is just `LeadFinder/1.0` with no e-mail, and OpenStreetMap may refuse searches ("OpenStreetMap refused the request"). Never use a placeholder like `@example.com`. |
| `APP_ACCESS_KEY` | Optional but recommended for any public deploy. When set, every API call must send the same value in an `x-access-key` header, otherwise it gets a 401. Enter the key in the app under **Your details**. Leave it unset for local use. |
| `SOCRATA_APP_TOKEN` | Optional. An app token for the Chicago data portal, used by Active projects. Only needed if permit searches get throttled. |
| `VITE_API_BASE` | Optional. Front-end only. Points the app at an API on another origin. |
| `SLACK_WEBHOOK_URL`, `ALERT_WEBHOOK_URL`, `HUBSPOT_TOKEN`, `GHL_TOKEN`, `GHL_LOCATION_ID` | Optional. Alerts and CRM sync, see "Alerts and CRM sync". |

## Protect your deployment

The API endpoints are open to anyone who knows the URL: `/api/pitch` spends your Anthropic credit, `/api/audit` fetches websites from your server, `/api/search` sends traffic to OpenStreetMap under your contact e-mail, `/api/send` sends mail through whatever mailbox the caller supplies (anyone can use your server to send mail from their own), and `/api/inbox` reads the inbox of whatever mailbox the caller supplies. Before you share a deployed URL, do at least one of these:

- Set `APP_ACCESS_KEY` in Vercel (Settings, Environment Variables) and redeploy. Open the app, press **Your details**, and paste the same key into "Access key". The key is stored only in your browser. Without it the app shows "Access key required".
- Turn on **Vercel Deployment Protection** (Settings, Deployment Protection, for example Vercel Authentication or Password Protection) so only people you allow can reach the site at all.

## Data sources and their limits

- **Nominatim (OpenStreetMap geocoder).** At most 1 request per second (the app enforces this), an identifying User-Agent is required, and no bulk geocoding. Attribution is required: "© OpenStreetMap contributors" (ODbL). The app shows it in the footer. If you export or republish the data, keep the attribution.
- **Overpass API (OpenStreetMap business data).** Public instances are fair-use (around 10,000 queries a day) and can be slow or busy, so keep queries small. The app asks overpass-api.de, overpass.kumi.systems, maps.mail.ru and overpass.private.coffee in that order, moving on to the next one as soon as one fails or after 4 seconds without an answer (each gets up to 25 seconds), and uses the first good answer. If all fail, it falls back to a simpler Nominatim search (using OSM "special phrase" terms from `nominatimTerms` in `src/data/categories.ts`, one request per term) and says that results may be incomplete. Law offices and party & event rentals have no working Nominatim phrase, so those two categories give a "servers are busy" error instead when Overpass is down. Drywall, ceilings & framing has no phrase either, but it also searches business names (`nameSearchTerms` in `src/data/categories.ts`) with Nominatim inside the search area on every search, because many drywall firms are only tagged as a generic company. Those name results are used on their own when Overpass is down.
- **OpenStreetMap coverage varies.** Some businesses have no phone, hours or website listed. A missing website in the map data does not always mean the business has none, so check before you pitch.
- **Chains and franchises** (businesses with a `brand` tag, or the same name 3+ times in the results) are hidden by default so they do not crowd the top of the list. Tick "Show chains" to see them.
- **Website audits** fetch the homepage, plus up to two contact or about pages on the same site when the homepage shows no email address (8 seconds in total, 4 sites at a time). Found addresses skip error-tracker, site-builder and placeholder addresses; the business's own domain and inboxes like info@ and contact@ come first. Check a found address before you rely on it. The server connects only to public addresses it has checked itself, and re-checks every redirect. Some sites block automated checks. Those show as "Website not checked" or "review it by hand".
- **AI pitches** cost a fraction of a cent per lead.

## Where to edit what

| To change | Edit |
|---|---|
| Your prices and the deal value estimates | `src/data/pricing.ts` |
| The business categories and their OpenStreetMap tags | `src/data/categories.ts` |
| Gap labels, weights, services and detection lists | `src/lib/gaps.ts` |
| Template emails, texts and call openers | `src/lib/pitch.ts` |
| The AI prompts (pitches, follow-ups, reply drafts) and model | `server/ai.ts` |
| Opt-out phrases and how replies are matched to leads | `src/lib/replies.ts` |
| The demo dataset | `src/data/demo.ts` |
| The client profiles that exist on first run | `src/data/profiles.ts` |
| The client-profile pitch template | `buildClientPitch` in `src/lib/pitch.ts` |
| The default follow-up emails and mailbox presets | `src/lib/outreach.ts` |

## Outreach (cold email)

The **Outreach** tab sends your pitch emails and follow-ups from your own mailbox, and keeps track of who is due next. It works per profile, so each client keeps its own sequence, mailbox and list of unsubscribed addresses.

### How it works

1. Save a lead, open it, type an address under **Email for outreach** (prefilled with the OpenStreetMap email, or else the one found on their website) and press **Add to outreach**. Or use **Add all saved leads with an email** on the Outreach tab.
2. The sequence is step 1 (the lead's pitch email from the Pitch panel, sent as written) and up to 2 follow-ups. Edit the follow-up wording and delays under **Sequence**. Follow-ups are sent as replies to the first email.
3. **Due now** lists every email that is ready. **Send due emails** sends them one by one, waiting the number of seconds you set between emails and stopping at your daily limit. The rest stay due until tomorrow.
4. **Auto-send while this tab is open** checks every minute and sends what is due. Nothing is sent while the app is closed.
5. When a lead is sent to, its status becomes Contacted. Set it to Replied, Won or Lost, or press **Unsubscribed**, and its sequence stops for good.
6. Without a mailbox the tab runs in manual mode: **Open in email app** opens your mail program with the email filled in, then press **Mark as sent**.

### Preview, AI and edits

Every queued email has a **Preview** link (on its Due now row, or under In outreach before it is due) that shows the exact subject and text that will be sent, signature and opt-out line included, with a label: Template, Written by AI or Edited.

- **Write with AI** rewrites that one email. Step 1 uses the same AI as the Pitch panel; a follow-up is written fresh, as a short reply to the first email (`POST /api/followup`). It needs `ANTHROPIC_API_KEY`; without it the app says so and keeps the current wording.
- **Edit** changes the subject (step 1 only) and the message. Your signature, postal address and opt-out line are always added back, so they can't be removed by accident.
- **Undo changes** goes back to the pitch or the Sequence template.
- **Send due emails**, auto-send and **Open in email app** all send exactly what the preview shows. While an email is being sent, its wording is locked.

If the app is closed while an email is being sent, that lead shows "Send result unknown, check your Sent folder". Press **Mark as sent** or **Retry**. It is never sent twice automatically.

### Import leads from a CSV

On the Outreach tab, **Import leads from a CSV** takes a list from a spreadsheet, a CRM export or a lead database (comma, semicolon or tab separated, up to 2,000 rows and 5 MB). Lead Finder guesses which column is the business name, email, website, phone, address, city, category and notes; check the guesses, then press **Import**.

- Each row becomes a saved lead (rows without a business name are skipped). Importing the same file again updates those leads instead of adding copies.
- **Add the ones with an email to outreach now** puts them straight into the sequence (unsubscribed addresses are still skipped).
- Their websites are checked afterwards, which can find emails the file didn't have. Use **Add all saved leads with an email** to add those.
- Imported leads have no map position, so they show "Imported" instead of a distance.

### Replies

The **Replies** section at the top of the Outreach tab reads your mailbox for answers to your outreach emails (`POST /api/inbox`, over IMAP on port 993), using the same username and app password as sending.

- Press **Check for replies**, or turn on **Auto-send while this tab is open** and replies are checked every 5 minutes too.
- A reply is matched to its lead by the address you emailed, or by the email it answers when they write back from another address. The lead is set to **Replied**, so its follow-ups stop.
- Out-of-office and other automatic replies are skipped and don't stop the sequence.
- Every email says to reply "no thanks" to stop, so a "no thanks", "not interested" or unsubscribe reply adds the address to **Unsubscribed addresses** right away, even without AI. It needs no answer.
- With `ANTHROPIC_API_KEY`, the AI sorts each reply (Interested, Has a question, Not now, Not interested, Unsubscribe, Auto-reply, Other), says in one line what they want, and drafts your answer (`POST /api/reply`). It uses only your services and the price ranges in `src/data/pricing.ts` (or a client profile's offer and selling points), and is told never to invent anything else.
- **Booking:** add your scheduling page (Calendly, Cal.com, Google Calendar) as **Booking link** under Your details. The AI offers it as the next step to interested replies, **Add booking link** puts it into any answer, and follow-ups can use `{{booking_link}}`. When they book, press **Meeting booked**: the lead becomes **Meeting booked** and its follow-ups stop.
- **Nothing is sent without you.** Read and edit the draft, then press **Send answer**. It goes from your mailbox as a reply in the same thread, with your signature, the opt-out line and their message quoted. **Open in email app**, **Mark as answered** and **No answer needed** are there too.
- Without AI, write the answer yourself in the same box.
- Only your inbox is read, only messages from the last 45 days (and since your first outreach email), and at most the newest 400 of those. The password is used for that one check and never stored or logged.

### Connect a mailbox

Open the **Mailbox** section on the Outreach tab, pick a provider, enter your username and an app password, press **Save mailbox**, then **Send test email to myself**. Picking a provider also fills in the incoming mail server (IMAP) that Replies uses.

- **Gmail / Google Workspace:** turn on 2-Step Verification, create an app password (Google Account, Security, App passwords), and use host `smtp.gmail.com`, port 465, IMAP `imap.gmail.com`. Workspace admins may need to allow app passwords, SMTP and IMAP access.
- **Outlook / Microsoft 365:** host `smtp.office365.com`, port 587, IMAP `outlook.office365.com`. SMTP AUTH and IMAP must be enabled for the mailbox (an admin can do this), and you need an app password if you use multi-factor authentication.
- **Zoho Mail:** host `smtp.zoho.com`, port 465, IMAP `imap.zoho.com`. Turn on IMAP access in Zoho Mail settings.

The SMTP password is kept only in this browser. It is sent to your own server with each email, used for that one send, and never stored or logged. The server refuses private and local addresses as mail servers.

### Sending hours and warm-up

Under **Mailbox**, **When to send** sets the days and hours Lead Finder may send (Monday to Friday, 9:00 to 17:00 by default, in your browser's time zone when you save). Outside them, due emails wait and the Outreach tab says when sending starts again. Answers to replies, and emails you open in your email app, aren't limited.

**Warm up a new mailbox** (on by default) sends at most 10 emails a day in the mailbox's first week, then 5 more a day each week until your daily limit. The warm-up starts with the first email Lead Finder sends from that profile. Turn it off for a mailbox that has been sending for a while.

### Compliance check

Every email is checked right before it goes out, whether it's sent by Lead Finder, opened in your email app or sent as an answer to a reply. An email that fails isn't sent; the reason shows on its row and in its preview, which also says when it passes. It checks that:

- your name, business and postal address are filled in, and the address is in the email;
- the opt-out line is in the email;
- a first email doesn't start its subject with "Re:" or "Fwd:", or say you've already spoken ("as discussed", "following up on our call" and similar);
- nothing is left over to fill in, such as [Your name] or {{business}};
- the address hasn't unsubscribed.

The server (`/api/send`) repeats the checks it can make from the email alone, so nothing skips them. The rules are in `src/lib/compliance.ts`.

### Send safely

- Start small and raise the volume slowly over a few weeks (the warm-up does this for you). Keep the gap between emails at 45 seconds or more.
- Use a separate domain and mailbox for cold email, so a spam complaint cannot hurt your main address.
- Use your real name and address as the sender, and keep your postal address in the signature (the app adds your signature and an opt-out line to every email).
- Honour opt-outs within 10 business days. Press **Unsubscribed** when someone asks, and the address is never emailed again from that profile.
- Only email businesses, not private individuals.

This is not legal advice.

### Not built yet

Sending and checking replies while the app is closed (needs a database and Vercel Cron), open and click tracking, finding email addresses, and SMS.

## Outreach rules

Fill in **Your details** (the button in the header) before sending anything, so pitches are signed with your name, business and postal address.

- Identify yourself honestly, with a real subject line and a physical postal address.
- Include a working opt-out and honour it within 10 business days (CAN-SPAM). The templates add an opt-out line for you.
- Only contact businesses, not private individuals.
- Texting and cold calling have stricter rules (TCPA, Do Not Call lists). Check them before you text or call.

This is not legal advice.
