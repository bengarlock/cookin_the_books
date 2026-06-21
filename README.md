# Cookin' the Books

Authenticated Next.js dashboard for financial tools backed by
`portfolio_database`.

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
AUTH_COOKIE_NAME=cookinTheBooksToken
AUTH_COOKIE_MAX_AGE_SECONDS=86400
```

`PORTFOLIO_API_BASE_URL` is preferred for server-side requests. Keep secrets
out of variables prefixed with `NEXT_PUBLIC_`; those values are embedded in
browser bundles.

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

The default app port is `6432`. It can be changed in the PM2 environment
without changing application code.

### Reverse proxy

Configure the web server to preserve the `/cookinthebooks` prefix when
forwarding to Next.js. A representative Nginx location is:

```nginx
location /cookinthebooks/ {
    proxy_pass http://127.0.0.1:6432;
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
| `AUTH_COOKIE_NAME` | Name of the HTTP-only backend-token cookie |
| `AUTH_COOKIE_MAX_AGE_SECONDS` | Browser cookie lifetime in seconds |

No production URLs, credentials, or API tokens are committed to the project.
