# Daymark Login

A responsive React login page with an Express mock-auth API and a small interactive dashboard.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

```sh
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173` and proxies `/api` requests to Express on port `4000`.

## Demo credentials

- Email: `hello@daymark.app`
- Password: `daymark2026`

Create an account with your name, any valid email address, and a password of at least 8 characters. Your account is stored locally in `server/data/users.json` with a salted scrypt password hash, and you can sign in with it later. Existing accounts cannot be registered twice.

The static demo account above also remains available. The frontend validates required fields, email format, and password length. Successful signup or login opens `/dashboard`; sign-out returns to the login screen. The dashboard task rows can be toggled to update the daily progress summary.

Authentication is intended for local demonstration: session tokens are stored in browser storage, user records are stored in a local JSON file, and there is no email verification, password recovery, or production session management. Do not deploy it as production authentication.

## Vercel deployment

Vercel serves the API through the functions in `api/`; the standalone Express server is for local development. The static demo account can sign in without extra services. To make signup and registered-account login persist across Vercel function invocations, connect Upstash Redis to the Vercel project for Production and Preview. The handlers accept these Upstash variables:

- `UPSTASH_REDIS_REST_KV_REST_API_URL`
- `UPSTASH_REDIS_REST_KV_REST_API_TOKEN`

The Upstash integration injects these values when linked; redeploy after connecting it. Accounts saved in local `server/data/users.json` are not automatically copied to Upstash; users must register again on the deployed app.

If the deployment URL redirects to `vercel.com/login` before Daymark loads, disable or adjust **Deployment Protection** for the production deployment in the Vercel project settings. That Vercel access gate is separate from this app's login form.

## Tests

```sh
npm test
```

## Production build

```sh
npm run build
```