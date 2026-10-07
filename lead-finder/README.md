# Lead Finder

Lead Finder finds local businesses that are missing the things you build (a website, online booking, an AI chat assistant, online payments, review collection), scores them as sales leads, and writes the first outreach message for you.

## What it does

1. You enter a town (or ZIP or address), pick a category and a radius.
2. It lists businesses from OpenStreetMap, then checks each business's website homepage for gaps (no website, not mobile-friendly, no online booking, no chat, outdated, slow and more).
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

Open the address Vite prints. The API (`/api/search`, `/api/audit`, `/api/pitch`, `/api/projects`, `/api/send`) runs inside the dev server, so nothing else is needed.

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

## Client profiles

Lead Finder can also find customers for your clients. Pick a profile in **Finding leads for** at the top:

- **My agency** (the default) finds businesses that are missing websites, booking and so on, and pitches your services.
- **A client profile** (for example **Asher Construction**, which does drywall, metal framing and acoustic ceilings) searches the kinds of businesses that hire that client, such as general contractors and builders, property managers and architects. The pitch is an introduction written as the client. Website checks, scores and deal values are not used. Leads are ranked by how many ways there are to reach them (phone, email, website), then by distance.

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

## Environment variables

| Name | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Optional. Turns on AI-written pitches. Without it, templates are used. |
| `LEADS_CONTACT_EMAIL` | Set this to your own e-mail. It goes in the User-Agent (and the `email` parameter) sent to OpenStreetMap, which asks for a real contact. When unset, the User-Agent is just `LeadFinder/1.0` with no e-mail, and OpenStreetMap may refuse searches ("OpenStreetMap refused the request"). Never use a placeholder like `@example.com`. |
| `APP_ACCESS_KEY` | Optional but recommended for any public deploy. When set, every API call must send the same value in an `x-access-key` header, otherwise it gets a 401. Enter the key in the app under **Your details**. Leave it unset for local use. |
| `SOCRATA_APP_TOKEN` | Optional. An app token for the Chicago data portal, used by Active projects. Only needed if permit searches get throttled. |
| `VITE_API_BASE` | Optional. Front-end only. Points the app at an API on another origin. |

## Protect your deployment

The API endpoints are open to anyone who knows the URL: `/api/pitch` spends your Anthropic credit, `/api/audit` fetches websites from your server, `/api/search` sends traffic to OpenStreetMap under your contact e-mail, and `/api/send` sends mail through whatever mailbox the caller supplies (it cannot read your mailbox, but anyone can use your server to send mail from their own). Before you share a deployed URL, do at least one of these:

- Set `APP_ACCESS_KEY` in Vercel (Settings, Environment Variables) and redeploy. Open the app, press **Your details**, and paste the same key into "Access key". The key is stored only in your browser. Without it the app shows "Access key required".
- Turn on **Vercel Deployment Protection** (Settings, Deployment Protection, for example Vercel Authentication or Password Protection) so only people you allow can reach the site at all.

## Data sources and their limits

- **Nominatim (OpenStreetMap geocoder).** At most 1 request per second (the app enforces this), an identifying User-Agent is required, and no bulk geocoding. Attribution is required: "© OpenStreetMap contributors" (ODbL). The app shows it in the footer. If you export or republish the data, keep the attribution.
- **Overpass API (OpenStreetMap business data).** Public instances are fair-use (around 10,000 queries a day) and can be slow or busy, so keep queries small. The app tries overpass-api.de, overpass.kumi.systems and maps.mail.ru in that order. If all fail, it falls back to a simpler Nominatim search (using OSM "special phrase" terms from `nominatimTerms` in `src/data/categories.ts`, one request per term) and says that results may be incomplete. Law offices and party & event rentals have no working Nominatim phrase, so those two categories give a "servers are busy" error instead when Overpass is down. Drywall, ceilings & framing has no phrase either, but it also searches business names (`nameSearchTerms` in `src/data/categories.ts`) with Nominatim inside the search area on every search, because many drywall firms are only tagged as a generic company. Those name results are used on their own when Overpass is down.
- **OpenStreetMap coverage varies.** Some businesses have no phone, hours or website listed. A missing website in the map data does not always mean the business has none, so check before you pitch.
- **Chains and franchises** (businesses with a `brand` tag, or the same name 3+ times in the results) are hidden by default so they do not crowd the top of the list. Tick "Show chains" to see them.
- **Website audits** fetch only the homepage (8 second timeout, 4 at a time). The server connects only to public addresses it has checked itself, and re-checks every redirect. Some sites block automated checks. Those show as "Website not checked" or "review it by hand".
- **AI pitches** cost a fraction of a cent per lead.

## Where to edit what

| To change | Edit |
|---|---|
| Your prices and the deal value estimates | `src/data/pricing.ts` |
| The business categories and their OpenStreetMap tags | `src/data/categories.ts` |
| Gap labels, weights, services and detection lists | `src/lib/gaps.ts` |
| Template emails, texts and call openers | `src/lib/pitch.ts` |
| The AI prompt and model | `server/ai.ts` |
| The demo dataset | `src/data/demo.ts` |
| The client profiles that exist on first run | `src/data/profiles.ts` |
| The client-profile pitch template | `buildClientPitch` in `src/lib/pitch.ts` |
| The default follow-up emails and mailbox presets | `src/lib/outreach.ts` |

## Outreach (cold email)

The **Outreach** tab sends your pitch emails and follow-ups from your own mailbox, and keeps track of who is due next. It works per profile, so each client keeps its own sequence, mailbox and list of unsubscribed addresses.

### How it works

1. Save a lead, open it, type an address under **Email for outreach** (OpenStreetMap leads with an email are prefilled) and press **Add to outreach**. Or use **Add all saved leads with an email** on the Outreach tab.
2. The sequence is step 1 (the lead's pitch email from the Pitch panel, sent as written) and up to 2 follow-ups. Edit the follow-up wording and delays under **Sequence**. Follow-ups are sent as replies to the first email.
3. **Due now** lists every email that is ready. **Send due emails** sends them one by one, waiting the number of seconds you set between emails and stopping at your daily limit. The rest stay due until tomorrow.
4. **Auto-send while this tab is open** checks every minute and sends what is due. Nothing is sent while the app is closed.
5. When a lead is sent to, its status becomes Contacted. Set it to Replied, Won or Lost, or press **Unsubscribed**, and its sequence stops for good.
6. Without a mailbox the tab runs in manual mode: **Open in email app** opens your mail program with the email filled in, then press **Mark as sent**.

If the app is closed while an email is being sent, that lead shows "Send result unknown, check your Sent folder". Press **Mark as sent** or **Retry**. It is never sent twice automatically.

### Connect a mailbox

Open the **Mailbox** section on the Outreach tab, pick a provider, enter your username and an app password, press **Save mailbox**, then **Send test email to myself**.

- **Gmail / Google Workspace:** turn on 2-Step Verification, create an app password (Google Account, Security, App passwords), and use host `smtp.gmail.com`, port 465. Workspace admins may need to allow app passwords or SMTP access.
- **Outlook / Microsoft 365:** host `smtp.office365.com`, port 587. SMTP AUTH must be enabled for the mailbox (an admin can do this), and you need an app password if you use multi-factor authentication.
- **Zoho Mail:** host `smtp.zoho.com`, port 465.

The SMTP password is kept only in this browser. It is sent to your own server with each email, used for that one send, and never stored or logged. The server refuses private and local addresses as mail servers.

### Send safely

- Start small, around 20 emails a day per mailbox, and raise it slowly over a few weeks. Keep the gap between emails at 45 seconds or more.
- Use a separate domain and mailbox for cold email, so a spam complaint cannot hurt your main address.
- Use your real name and address as the sender, and keep your postal address in the signature (the app adds your signature and an opt-out line to every email).
- Honour opt-outs within 10 business days. Press **Unsubscribed** when someone asks, and the address is never emailed again from that profile.
- Only email businesses, not private individuals.

This is not legal advice.

### Not built yet

Sending while the app is closed (needs a database and Vercel Cron), reply detection through IMAP (for now, set the status to Replied yourself), open and click tracking, finding email addresses, and SMS.

## Outreach rules

Fill in **Your details** (the button in the header) before sending anything, so pitches are signed with your name, business and postal address.

- Identify yourself honestly, with a real subject line and a physical postal address.
- Include a working opt-out and honour it within 10 business days (CAN-SPAM). The templates add an opt-out line for you.
- Only contact businesses, not private individuals.
- Texting and cold calling have stricter rules (TCPA, Do Not Call lists). Check them before you text or call.

This is not legal advice.
