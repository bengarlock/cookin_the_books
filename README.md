# Cookin' the Books

Personal finance dashboard that reads receipts with the Codex API and tags them onto bank transactions. Next.js, Django REST Framework, PostgreSQL, Plaid.

The app uses:

- Next.js 16 with the App Router and TypeScript
- Tailwind CSS
- A fixed Next.js `basePath` of `/cookinthebooks`
- The existing `portfolio_database` token login and verification endpoints
- An HTTP-only cookie for the backend token
- Server-side session verification before dashboard content renders

## Authentication flow

1. The browser submits the username and password to
   `/cookinthebooks/api/auth/login`.
2. The Next.js route exchanges those credentials with
   `portfolio_database` at `/api/v1/login/`.
3. The returned backend token is stored in an HTTP-only, same-site cookie.
4. Protected dashboard layouts verify the token against
   `/api/v1/login/verify-token/`.
5. The browser never stores the backend token in `localStorage` or exposes it
   to client-side JavaScript.

The Next.js proxy performs a fast cookie-presence redirect, while the
dashboard layout performs the secure backend verification. Future financial
API routes should follow the same server-side proxy pattern.

## Local development

### Prerequisites

- Node.js 20.19+, 22.13+, or 24+
- npm
- A running `portfolio_database` instance

### Setup

```bash
cd /Users/bgarlock/WebstormProjects/cookin_the_books
npm install
cp .env.example .env.local
```

Update `.env.local` for the local backend:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
PORTFOLIO_API_BASE_URL=http://127.0.0.1:8000
PORTFOLIO_WEBSOCKET_BASE_URL=ws://127.0.0.1:8000
AUTH_COOKIE_NAME=cookinTheBooksToken
AUTH_COOKIE_MAX_AGE_SECONDS=86400
```

`PORTFOLIO_API_BASE_URL` is preferred for server-side requests. Keep secrets
out of variables prefixed with `NEXT_PUBLIC_`; those values are embedded in
browser bundles.

`npm run dev` validates that both configured backend targets are loopback
addresses before starting. `npm start` performs the inverse production check:
it refuses loopback targets and requires HTTPS/WSS. This prevents a local
backend URL from surviving a production deployment while keeping environment
selection outside the committed application bundle.

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/cookinthebooks
```

The root route redirects unauthenticated users to
`/cookinthebooks/login`. Successful login redirects to
`/cookinthebooks/dashboard`.

## Validation

```bash
npm run lint
npm run build
```

## Future Jabba deployment

The expected server checkout is:

```text
/home/deploy/Projects/cookin_the_books
```

### Install and build

```bash
cd /home/deploy/Projects/cookin_the_books
npm ci
cp .env.example .env.production.local
```

Edit `.env.production.local` with the Jabba-accessible
`portfolio_database` URL. Do not commit this file.

```bash
npm run build
```

### Run with PM2

An `ecosystem.config.cjs` file is included:

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

The default app port is `6433`. It can be changed in the PM2 environment
without changing application code.

### Reverse proxy

Configure the web server to preserve the `/cookinthebooks` prefix when
forwarding to Next.js. A representative Nginx location is:

```nginx
location /cookinthebooks/ {
    proxy_pass http://127.0.0.1:6433;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The `proxy_pass` line intentionally has no trailing path component, allowing
Next.js to receive the configured base path.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Optional public API base URL for future direct browser requests |
| `PORTFOLIO_API_BASE_URL` | Preferred server-only base URL for `portfolio_database` |
| `AUTH_COOKIE_SECURE` | Optional cookie security override; defaults to `true` in production |
| `AUTH_COOKIE_DOMAIN` | Optional cookie domain override; set empty for host-only staging cookies |
| `PORTFOLIO_WEBSOCKET_BASE_URL` | Optional Channels/Daphne WebSocket origin; derived from the API URL when omitted |
| `AUTH_COOKIE_NAME` | Name of the HTTP-only backend-token cookie |
| `AUTH_COOKIE_MAX_AGE_SECONDS` | Browser cookie lifetime in seconds |
| `DEMO_USERNAME` / `DEMO_PASSWORD` | Optional demo account credentials; `/cookinthebooks/demo` returns 404 unless both are set |

No production URLs, credentials, or API tokens are committed to the project.

## Public demo

`https://bengarlock.com/cookinthebooks/demo` signs visitors into a demo account
with generated sample data and drops them on the dashboard. The route handler
(`src/app/demo/route.ts`) logs in with `DEMO_USERNAME` / `DEMO_PASSWORD` on the
server, so the credentials never reach the browser. Treat them as public
anyway: anyone can copy the session token out of their own browser.

The protections live in `portfolio_database`, not here:

- Users in the `demo` group can only reach `/api/v1/cookin_the_books/`. Every
  other app, the shared `bank-info` table, the server-management websocket,
  and realtime events reject them.
- Plaid, the receipt mailbox, file imports and OpenAI categorization are
  read-only or disabled for demo users, and reminder emails are never sent.
- `manage.py seed_demo_account` builds the account (it needs
  `DEMO_ACCOUNT_PASSWORD` the first time), and the Celery beat task
  `reset_cookin_books_demo_account` rebuilds it nightly, undoing visitor edits.

In this app, `verify-token`'s `is_demo` flag shows the demo banner and disables
the Plaid and receipt-mailbox controls. A `cookinTheBooksDemo` marker cookie
sends visitors whose demo session expired back through `/demo` instead of the
login form. Signing out clears the marker. Visiting `/demo` replaces any real
session in that browser, because the session cookie is shared across
`bengarlock.com`.

## Live snapshot updates

The overview loads the newest authenticated bank-value snapshot from
`portfolio_database`, then requests a short-lived WebSocket ticket through the
Next.js server. Browser JavaScript receives only that temporary ticket—not the
long-lived portfolio token.

The dashboard subscribes to:

```text
/ws/cookin-the-books/bank-value-snapshots/
```

When a new snapshot is accepted by the backend, Django Channels publishes it
to the authenticated user's private channel group. The dashboard updates
without a browser refresh and reconnects automatically after interruptions.
