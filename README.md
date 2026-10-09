# Homestead Nigeria

A real estate development starter with a public property catalogue and agent workspace. React + Vite, Node HTTP API, and persistent SQLite storage. Requires Node.js 24 or newer.

## Develop

```sh
npm ci --cache /tmp/estate-npm-cache
npm run dev
```

The server listens on port 3000. Override with `PORT`. Development uses Vite middleware, including hot reload. SQLite data is stored in ignored `data/homestead.sqlite`; override the directory with `DATA_DIR`. Sample listings are seeded only on the first run.

## Validate and run the production build

```sh
npm test
npm run build
npm start
```

## Features

- Filter public listings by sale/rent, city, property type, budget and text; sort by price.
- Property details and enquiries stored in SQLite.
- Add, edit and delete property listings.
- Track lead status and schedule viewings in Nigeria time (WAT).
- Responsive layouts and accessible modal keyboard navigation.

## Before public deployment

This is a development demo, not a production service. The agent workspace and management API have no authentication or authorization. Do not expose it publicly or enter real customer information. Add secure agent accounts, authorization for every private API, privacy/consent handling, rate limiting, input hardening, backups and hosting configuration before launch. Listing photos and details are illustrative; they are not verified available properties. Deleting a property also deletes its associated leads and viewings.

External images use images.unsplash.com; optional fonts use fonts.googleapis.com and fonts.gstatic.com. The app works with fallback fonts. No email, WhatsApp or SMS notifications are sent.
