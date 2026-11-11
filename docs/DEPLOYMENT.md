# Deploying the site to zkgate.net (Vercel)

The public site is the **`frontend/`** Next.js app: the landing page at `/` and
the citizen proof demo at `/prove`. It deploys to Vercel as a monorepo project.

## 1. Create the Vercel project

1. In Vercel, choose **Add New… → Project** and import `JMadhan1/zkgate`.
2. Set **Root Directory** to `frontend`. Leave "Include files outside the root
   directory" switched on, because the app imports the `sdk/` workspace.
3. The framework is detected as **Next.js**. `frontend/vercel.json` already sets
   the install command (`cd .. && npm ci`, which installs the npm workspaces from
   the repo root) and the build command, so leave those fields as they are.
4. **Node.js version:** 20.x or newer (Project → Settings → General).
5. Deploy.

### Environment variables (optional)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap and OG tags. Defaults to `https://zkgate.net`. |
| `NEXT_PUBLIC_API_URL` | URL of a running FastAPI verifier (`backend/`). It must be `https://`: its origin is added to the CSP `connect-src` automatically. If it isn't set, the "Send to Demo Bank" step explains that no verifier is connected. Deploy the backend with `ENVIRONMENT=production`, a strong `ADMIN_TOKEN` from your secret manager, and `CORS_ORIGINS` set to the site's origins. |

## 2. Point zkgate.net at it

zkgate.net is currently attached to a **different** Vercel project (the older
HashKey Chain build). A domain can belong to only one project, so:

1. In the **old** project: Settings → Domains → remove `zkgate.net` and
   `www.zkgate.net`.
2. In the **new** project: Settings → Domains → add `zkgate.net`, then add
   `www.zkgate.net` and set it to redirect to `zkgate.net`.
3. If both projects are in the same Vercel account, DNS needs no changes. If the
   domain uses external DNS, use the records Vercel shows on that page.

## 3. Enable live proving (circuit artifacts)

Parsing and the claim preview run anywhere. Generating a proof also needs the
compiled circuits served from `/circuits/<name>.wasm` and `/circuits/<name>.zkey`.
These are build outputs and are git-ignored, so the page shows a clear
"proving keys aren't published" notice until they're provided.

```bash
npm run build:circuits   # needs circom; writes frontend/public/circuits/<name>.{wasm,zkey}
```

Note that `build:circuits` runs a fresh trusted setup and rewrites
`circuits/keys/*_verification_key.json`. Each `.zkey` **must** match the committed `circuits/keys/*_verification_key.json`,
or the backend will reject the proofs. Use the zkeys from the same setup that
produced the committed verification keys, or commit the regenerated keys and
fixtures together (`npm run regenerate:fixtures`). To ship the artifacts, either commit them (and relax the
`frontend/public/circuits/*` rules in `.gitignore`) or host them on a CDN and
proxy `/circuits/*` to it.

## Security headers

`frontend/proxy.ts` sets a strict Content-Security-Policy with a fresh nonce on
every request, so pages render dynamically rather than as static HTML.
`frontend/next.config.mjs` adds HSTS (with preload), `X-Frame-Options: DENY`,
`nosniff`, a Referrer-Policy, a Permissions-Policy and COOP/COEP. The
vulnerability contact is published at `/.well-known/security.txt` (see
`SECURITY.md`). Once the domain is live, you can submit it at hstspreload.org.

## Local preview

```bash
npm ci
npm --workspace frontend run build
npm --workspace frontend run start   # http://localhost:3000
```
