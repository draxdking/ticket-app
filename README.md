# Homestead Nigeria

A Nigerian real estate website with a public catalogue and an authenticated agent workspace. React + Vite, Node HTTP API, persistent SQLite and locally stored photos. Requires Node.js 24 or newer.

## Development

```sh
npm ci --cache /tmp/estate-npm-cache
npm run dev
```

Open the app on port 3000. `PORT` overrides the port. Development includes Vite hot reload. Accounts, sessions and records are stored in ignored `data/homestead.sqlite`; photos live in `data/uploads/`. `DATA_DIR` overrides that directory. Preserve and back up the entire directory.

Select **Agent workspace → Create account**. Visitors can browse without an account. Each agent manages only their own listings, enquiries and viewings. The six original sample properties are marked as demos, with enquiries disabled until an administrator assigns an agent. New accounts never automatically claim existing records.

## Administrator setup

First register your own account in the website. On the server, from this repository directory, promote that account:

```sh
node scripts/create-admin.js your-email@example.com
```

This requires local server access. There is no public endpoint to become an administrator. The password is unchanged. Administrators can manage all listings, assign listing agents, and suspend/reactivate agent accounts. Suspension invalidates sessions immediately and hides the agent's public listings. Administrator accounts cannot be suspended through the dashboard.

To create an administrator without prior registration, supply a strong `ADMIN_PASSWORD` securely in the shell environment and run `node scripts/create-admin.js EMAIL "Full name" NIGERIAN_MOBILE_NUMBER`. Never commit or share that value. Clear it from the environment afterward. No default passwords are supplied.

## Features

- Public property search by sale/rent, city, type, budget and neighbourhood, with price sorting.
- Agent sign-up/sign-in, HTTP-only sessions, scrypt password hashes, ownership checks and sign-out.
- Upload up to 12 JPEG/PNG/WebP photos; choose a cover and reorder photos. Browser resizing and server-side image decoding/re-encoding reduce size and strip metadata. Inputs are limited to 25 megapixels; the browser accepts files up to 15 MB and uploads compressed files under 5 MB. Server output is JPEG up to 1600 × 1600.
- Swipe thumbnails or use gallery controls to browse listing photos.
- WhatsApp links use the assigned agent's Nigerian mobile number and a prepared property-specific message. Opening the link does not send the message automatically. Agents can update their number under **Profile**.
- Agency, legal/agreement, caution-deposit and service charges have amounts, frequencies and refundability. The initial total includes the property price/annual rent plus the first payment of each listed additional charge. Recurring charges are clearly labelled; rates are entered by the agent, not assumed.
- Enquiries require contact-sharing consent and are visible only to the listing's agent and administrators.
- Track lead status and schedule viewings in Nigeria time (WAT).
- Archiving hides a listing and disables new enquiries but preserves client history. Edit an archived listing to restore it.

## Tests and production build

```sh
npm test
npm run build
```

The integration test uses an isolated temporary database. It checks access control, account/session lifecycle, image validation and resizing, ownership, fees, persistence after restart, suspension and archiving. It does not alter the development database.

## Deployment configuration

Run the production build behind an HTTPS reverse proxy:

```sh
APP_ORIGIN=https://your-domain.example NODE_ENV=production node server.js
```

- `APP_ORIGIN`: exact public origin without a trailing slash, used to validate the Origin header on every modifying request.
- `NODE_ENV=production`: serves `dist/`, sets secure session cookies. `npm start` sets this automatically.
- `COOKIE_SECURE=false`: only for isolated HTTP tests; never set this on a public production deployment.
- `DATA_DIR`: persistent disk shared by the database and uploaded files. Do not use ephemeral hosting storage. This implementation is intended for one Node server; multiple instances need shared database/object storage.
- `SEED_DEMO=false`: prevents demo seeding on the first start of a new database. Existing demos should be archived through the admin workspace before launch; this setting does not delete existing data.
- `PORT`: HTTP port, default 3000.

Uploaded photos work without external image services. Legacy sample photos use images.unsplash.com; optional fonts use fonts.googleapis.com and fonts.gstatic.com. WhatsApp links open wa.me in the visitor's browser. WhatsApp does not require an API key.

## Remaining launch work

This is an improved development starter, not an already deployed service. Set up hosting, HTTPS, disk/database backups and a privacy policy before using real client information. Email verification and password recovery are not implemented yet; agents should keep their credentials safely. Account sign-up does not verify agent credentials or property ownership. Rate limits are per socket IP in one process and reset on restart; configure a persistent, proxy-aware limit at your hosting edge for production. Uploaded files removed from a gallery remain on disk so existing listings are never broken; add a retention cleanup job before operating at scale. No automatic email, SMS or appointment notifications are sent. Property availability, documents and charges must be verified independently.

## Search engines and sharing

Public pages are served with readable HTML before JavaScript runs. Every public listing has a stable `/properties/PROPERTY_ID` URL, its own location/type title and description, social sharing tags, and (for real listings) Schema.org RealEstateListing data. The homepage and agent-information page are public; the authenticated workspace remains private. Removed/archived listings and unknown URLs return HTTP 404. `/index.html` and trailing slashes redirect to the preferred URL.

When hosting, set `SITE_URL` to your actual public HTTPS origin, for example `https://your-domain.example`, without a path or trailing slash. An HTTPS `APP_ORIGIN` is used as the default if `SITE_URL` is not supplied. This generates absolute canonical, sharing and sitemap URLs. Do not use the example domain on your live site. Local development has no canonical domain and is marked `noindex`; its robots file blocks crawling.

`/sitemap.xml` lists public pages and active, real property listings. Demo properties, archived listings, suspended-agent listings and private pages are excluded. `/robots.txt` supplies the sitemap location on configured public sites and blocks API/workspace crawling. Demo detail pages remain `noindex` even when assigned to an agent. No ranking, review or ownership-verification claims are fabricated in structured data.

After deploying real listings, verify your domain in Google Search Console and submit `https://YOUR_DOMAIN/sitemap.xml`. Check pages with Google's URL Inspection and structured-data tools. Search indexing/rankings are not guaranteed by these changes; keep availability, prices, photographs and property descriptions accurate. No Search Console verification or submission has been performed by this project.
