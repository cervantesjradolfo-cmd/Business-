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

Open the address Vite prints. The API (`/api/search`, `/api/audit`, `/api/pitch`) runs inside the dev server, so nothing else is needed.

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

Each profile has its own signature details and its own saved leads. Press **Profile details** to change what the client does, their selling points, the customers to search for and who signs the pitches. Choose **+ New client profile…** in the switcher to add another client. Profiles are stored only in your browser, like your saved leads.

Only put true facts in **Selling points**: they go into the pitches as written, and the AI is told not to invent anything beyond them.

## Environment variables

| Name | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Optional. Turns on AI-written pitches. Without it, templates are used. |
| `LEADS_CONTACT_EMAIL` | Set this to your own e-mail. It goes in the User-Agent (and the `email` parameter) sent to OpenStreetMap, which asks for a real contact. When unset, the User-Agent is just `LeadFinder/1.0` with no e-mail, and OpenStreetMap may refuse searches ("OpenStreetMap refused the request"). Never use a placeholder like `@example.com`. |
| `APP_ACCESS_KEY` | Optional but recommended for any public deploy. When set, every API call must send the same value in an `x-access-key` header, otherwise it gets a 401. Enter the key in the app under **Your details**. Leave it unset for local use. |
| `VITE_API_BASE` | Optional. Front-end only. Points the app at an API on another origin. |

## Protect your deployment

The three API endpoints are open to anyone who knows the URL: `/api/pitch` spends your Anthropic credit, `/api/audit` fetches websites from your server, and `/api/search` sends traffic to OpenStreetMap under your contact e-mail. Before you share a deployed URL, do at least one of these:

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

## Outreach rules

Fill in **Your details** (the button in the header) before sending anything, so pitches are signed with your name, business and postal address.

- Identify yourself honestly, with a real subject line and a physical postal address.
- Include a working opt-out and honour it within 10 business days (CAN-SPAM). The templates add an opt-out line for you.
- Only contact businesses, not private individuals.
- Texting and cold calling have stricter rules (TCPA, Do Not Call lists). Check them before you text or call.

This is not legal advice.
