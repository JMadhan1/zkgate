# ZKGate India — project instructions

## Layout

- `circuits/` Circom circuits (Groth16/BN128). Verification keys in `circuits/keys/` are committed; `.zkey`/`.wasm` are build outputs.
- `backend/` FastAPI verifier. Security controls live in `backend/security.py` (headers, body limit, content-type, rate limit, error shape) and `backend/dependencies.py` (API-key auth, admin gate, auth-failure lockout). Security events: `backend/security_log.py` (never pass secrets to it). `ENVIRONMENT=production` flips every default to the restrictive option.
- `sdk/` JS SDK (parse eKYC XML, witness, prove).
- `frontend/` Public site deployed to https://zkgate.net (Vercel, root directory `frontend`). CSP with per-request nonce in `frontend/proxy.ts`; other headers in `frontend/next.config.mjs`. See `docs/DEPLOYMENT.md`.
- `verifier-portal/` Verifier demo UI.

## Checks to run before committing

```bash
npm --workspace frontend run build
(cd sdk && node --test test/*.mjs)
(cd backend && python -m pytest -q)
npm audit --omit=dev --audit-level=high
(cd backend && pip-audit -r requirements.txt)
```

CI (`.github/workflows/security.yml`) runs these plus gitleaks and CodeQL.

## Known, documented exceptions to the rules below

- **Public demo keys**: the demo issuer key in `frontend/lib/prove.ts` and the `demo-bank-key` / `demo-age-key` verifier keys are public by design (see `SECURITY.md`), allowlisted in `.gitleaks.toml`, and not seeded when `ENVIRONMENT=production`. Don't add new ones.
- **No user accounts exist.** Citizens never authenticate (they hold a proof, not a login) and verifiers authenticate with API keys. The password, session, MFA and email rules apply only if accounts are ever added.
- **`style-src 'unsafe-inline'`** is allowed for styles only (React style attributes). Scripts never get `unsafe-inline`/`unsafe-eval`. `wasm-unsafe-eval` is required for the in-browser Groth16 prover and permits WebAssembly compilation only.

---

# SECURITY REQUIREMENTS -- MANDATORY FOR ALL CODE

Every file, function, endpoint, and configuration you generate MUST follow these rules.
These are not suggestions. Violating any rule is a bug that must be fixed immediately.

---

## AUTHENTICATION

- All routes require authentication by default. Only explicitly allowlisted routes (health checks, public landing pages) bypass auth.
- Never trust client-provided identity. Always derive user identity from server-validated session/token.
- Passwords: minimum 12 characters, checked against HaveIBeenPwned breached password API before acceptance.
- Password storage: argon2id or bcrypt only. Never SHA-256, MD5, or any unsalted hash.
- Session tokens: cryptographically random, minimum 256 bits entropy.
- JWT expiry: maximum 15 minutes. Use refresh token rotation (one-time use, revoke on reuse detection).
- Cookies: Secure=true, HttpOnly=true, SameSite=Strict. No exceptions.
- Never store tokens in localStorage or sessionStorage. Use HttpOnly cookies only.
- MFA mandatory for admin/privileged accounts.
- Account lockout: 5 failed attempts = 15 minute lock with progressive delay.
- Rate limit all auth endpoints: login, register, forgot-password, verify-email, reset-password, MFA verify.
- Rate limit formula: 5 attempts per 15 minutes per account, not just per IP.
- Email verification required before any authenticated access.
- Password reset tokens: single-use, expire in 15 minutes, invalidated on password change.
- Self-registration: disabled by default. If enabled, require CAPTCHA + email domain allowlist.
- Never reveal whether an account exists. Login, registration, and forgot-password must return identical responses for existing and non-existing accounts.
- Disable insecure auth flows (USER_PASSWORD_AUTH on Cognito, password grant on OAuth). Use SRP or PKCE.

---

## AUTHORIZATION

- Every endpoint that accepts a resource ID must verify the requesting user owns or has explicit permission to access that resource.
- Return 404 (not 403) when a user requests a resource they cannot access. Never confirm resource existence to unauthorized users.
- Use UUIDs (v4 or v7) for all resource identifiers. Never sequential integers.
- Multi-tenant: every database query must be scoped to the authenticated user's tenant. Use row-level security or a global query filter. No endpoint should ever return data from another tenant.
- Role-based access: define roles server-side. Never accept role, isAdmin, permissions, or privilege fields from client input.
- Admin endpoints must require additional authentication (re-authentication, MFA step-up, or separate admin session).
- Mass assignment prevention: explicitly define which fields are accepted on every create/update operation. Never pass raw request body to the database.
- Principle of least privilege: every component (DB user, API key, service account, container) gets minimum required permissions only.
- Never use wildcard permissions (*, admin:*, resource:*) in production.

---

## INPUT VALIDATION

- Validate ALL input on the server side. Client-side validation is UX only, never security.
- Use schema validation (Zod, Joi, Pydantic, JSON Schema) on every endpoint. Reject requests that don't match the schema.
- Validate type, length, format, and range on every field.
- Sanitize all user input before: database queries, HTML rendering, shell commands, file paths, log entries, email content.
- SQL injection: use parameterized queries or ORM exclusively. Never concatenate user input into SQL strings.
- NoSQL injection: never pass raw user input as MongoDB/DynamoDB query operators. Reject objects where strings are expected.
- Command injection: never pass user input to exec, spawn, system, or eval. If shell commands are unavoidable, use allowlists for permitted values.
- Path traversal: never use user input in file paths. If filenames are needed, generate server-side UUIDs. Strip ../ and normalize paths.
- SSRF: never make HTTP requests to user-provided URLs without validation. Block private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254, fd00::/8). Use an allowlist of permitted domains where possible.
- XSS: use context-aware output encoding. Never use dangerouslySetInnerHTML, innerHTML, v-html, [innerHTML], or equivalent without sanitization through DOMPurify. Default to text content, not HTML.
- SSTI: never pass user input into server-side template strings. Use template engines with auto-escaping enabled.
- XXE: disable external entity processing in all XML parsers. Prefer JSON over XML.
- File upload: validate MIME type by reading magic bytes (not just Content-Type header). Restrict extensions via allowlist. Generate random filenames server-side. Store outside webroot. Set Content-Disposition: attachment on download. Scan for malware. Limit file size.
- Integer overflow: validate numeric inputs are within expected bounds before arithmetic operations.
- Unicode/encoding: normalize Unicode (NFC) before validation. Reject null bytes. Be aware of double encoding.

---

## API SECURITY

- CORS: strict origin allowlist only. Never reflect the Origin header. Never use Access-Control-Allow-Origin: *. Never combine wildcard with credentials. List only your own production and staging domains.
- Return identical error format for all error codes. Never leak stack traces, SQL errors, internal paths, library versions, or debug information in responses.
- All API responses: remove Server, X-Powered-By, X-AspNet-Version headers. Suppress framework/server version disclosure.
- Routes that don't exist: return 404 with identical format to routes that require auth. Never return 401 or 405 for unauthenticated requests to valid routes (leaks route existence).
- Rate limiting: implement on all endpoints. Use sliding window algorithm. Apply per-user for authenticated endpoints, per-IP for public endpoints. Return 429 with Retry-After header.
- Request size limits: enforce maximum body size (1MB default). Reject oversized payloads before parsing.
- HTTP methods: only allow methods the endpoint supports. Return 405 for others.
- Content-Type validation: reject requests with unexpected Content-Type headers. API endpoints should only accept application/json (or explicitly required types).
- CSRF protection: use anti-CSRF tokens for cookie-authenticated state-changing requests. SameSite=Strict cookies provide baseline protection.
- No sensitive data in URLs or query parameters. Use POST body or headers for tokens, keys, and PII.
- Pagination: enforce maximum page size (100 items). Never allow unlimited result sets.
- Deprecation: never leave old API versions running with weaker security. Decommission deprecated endpoints.
- OpenAPI/Swagger/docs/redoc/metrics/graphql-playground: disabled in production. Never serve API documentation on public endpoints.

---

## DATABASE

- Use parameterized queries or ORM for every database operation. Zero exceptions.
- Application connects with a least-privilege database user. Never connect as postgres, root, admin, or sa.
- Separate database users for read vs write operations where possible.
- Encrypt sensitive fields at rest: PII (name, email, phone, address), financial data, health data. Use AES-256-GCM with unique IV per record. Store encryption key in a secret manager, not in code or environment variables.
- Hash API keys and tokens before storage. Show plaintext only once at creation.
- Enable TLS for all database connections. Reject unencrypted connections.
- Database in a private subnet. No public IP. Security group allows connections only from application servers.
- Enable audit logging on sensitive tables (users, payments, roles, permissions).
- Backups: encrypted, tested monthly, stored in a separate account/region.
- Migrations: review for data exposure before running. Never log sensitive data during migrations.

---

## FRONTEND

- Content Security Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self' https://api.yourdomain.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; Adjust per your CDN and third-party needs but never allow unsafe-eval or unsafe-inline for scripts.
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
- Never embed secrets, API keys, admin paths, internal URLs, or feature flag names in client-side code. Anything in the JS bundle is public.
- Environment variables prefixed with NEXT_PUBLIC_, VITE_, or REACT_APP_ are public. Never put secrets there.
- Subresource Integrity (SRI): add integrity attributes to all third-party script/style tags.
- Do not trust data from: URL parameters, hash fragments, postMessage events, localStorage, cookies readable by JS, or any client-controlled source without server validation.
- Use text content methods by default. Only use HTML insertion with DOMPurify sanitization.

---

## SECRETS MANAGEMENT

- Never commit secrets to version control. Not in code, config files, Dockerfiles, CI scripts, comments, or documentation. Not even "temporarily."
- .env files: always in .gitignore. Use .env.example with placeholder values for documentation.
- Use a pre-commit hook (gitleaks, detect-secrets, trufflehog) to block secret commits. This is mandatory, not optional.
- Production secrets: stored in a secret manager (Vault, AWS Secrets Manager, GCP Secret Manager, Doppler, Infisical). Injected at runtime. Never baked into container images.
- API keys: generate with high entropy (minimum 256 bits). Hash before storage. Prefix with your product name for identifiability (e.g., myapp_sk_live_...).
- Key rotation: every 90 days for all secrets. Automated where possible.
- If a secret is exposed: rotate immediately, audit access logs, revoke the old secret. Treat it as an incident.
- Never log secrets. Mask sensitive fields in log output. Filter Authorization headers, password fields, and token values from all logs.
- Client-side keys (PostHog, Sentry, analytics): these are intentionally public. Restrict them by domain allowlist and read-only permissions at the provider.

---

## INFRASTRUCTURE

- Dev/staging environments: never publicly accessible. VPN only (Tailscale, WireGuard, AWS VPN). No public DNS records for dev/staging.
- Never expose dev servers (Vite, webpack-dev-server, Next.js dev mode) to the internet. Use localhost + SSH tunnel for remote development.
- Internal tools (GitLab, ArgoCD, Grafana, SonarQube, Jenkins, admin panels): VPN-only access. No public DNS. No public load balancer.
- Self-registration on internal tools: disabled. Admin-creates-user only.
- Containers: run as non-root user. Read-only filesystem. Drop all capabilities. No privilege escalation.
- Network segmentation: public LB -> app (private) -> DB (private). Each tier in separate subnet. Security groups allow only required traffic.
- HTTPS everywhere. TLS 1.2 minimum, TLS 1.3 preferred. HSTS with preload. No mixed content.
- DNS: no wildcard records. Remove records for decommissioned services immediately. Audit for dangling CNAMEs monthly.
- Cloud provider: enable GuardDuty/Security Hub (AWS), Defender (Azure), Security Command Center (GCP). Enable CloudTrail/audit logging on all accounts.
- S3/GCS/Azure Blob: Block Public Access enabled by default. No public buckets ever.
- Load balancer/CDN in front of all public services. Never expose origin IPs or ELB DNS names directly.
- Firewall: deny all inbound by default. Allow only 80/443 on public LB. SSH/RDP: VPN only, never public.
- Server headers: suppress version disclosure. nginx: server_tokens off. Express: app.disable('x-powered-by').

---

## EMAIL

- SPF: publish on day one. Use -all (hardfail), not ~all (softfail).
- DKIM: sign all outbound email. Rotate keys annually.
- DMARC: p=reject from day one. Monitor with rua reports.
- Never send secrets, passwords, or tokens in email body. Use one-time links with server-validated tokens.
- Transactional emails: use a dedicated service (SendGrid, Resend, SES). Authenticate the sending domain.

---

## CI/CD PIPELINE

- Pin all dependencies and GitHub Actions by SHA hash, not semver tag or branch name.
- Dependency audit: run on every PR. Fail the build on high/critical vulnerabilities.
- SAST scan: run on every PR (Semgrep, CodeQL, or ESLint security plugin).
- Secret scan: run on every PR (gitleaks, trufflehog). Fail on detection.
- Container scan: scan images for vulnerabilities before deployment (Trivy, Grype).
- Branch protection: require PR reviews, require status checks (tests + security scan), no force push, no bypass for anyone.
- Signed commits: preferred for all contributors.
- Self-hosted runners: harden. Never allow PRs from forks to run on self-hosted runners.
- Build artifacts: do not include source maps, .env files, node_modules, or test fixtures in production builds.
- Deployment: use immutable artifacts. Never deploy by pulling latest from git on a server.

---

## LOGGING AND MONITORING

- Log: every authentication attempt (success and failure), every authorization failure, every admin action, every data export, every account creation/deletion/modification, every payment event, every rate limit trigger.
- Every log entry: timestamp (UTC ISO 8601), user ID, IP address, action, resource, result (success/failure), request ID for correlation.
- Never log: passwords, tokens, session IDs, full credit card numbers, raw PII (mask to last 4 digits), encryption keys, or request bodies containing sensitive data.
- Alert on: 10+ failed logins per account in 5 minutes, login from new country, privilege escalation, bulk data access (100+ records), 4xx spike (fuzzing detection), new subdomain in DNS, deployment without PR approval.
- Retain logs for minimum 90 days. Store in append-only/immutable storage.
- Error tracking (Sentry): strip PII from error reports. Never send full request bodies or auth headers to error tracking.
- Uptime monitoring on all public endpoints. Alert on 5xx spike.
- Monthly: review access logs, audit admin accounts, verify backup restoration, check for leaked secrets on GitHub.

---

## SECURITY TESTING

- Run OWASP ZAP or Burp Suite scan before every major release.
- Penetration test annually (external firm) or after major architecture changes.
- Dependency updates: weekly automated PRs (Dependabot, Renovate). Merge within 48 hours for security patches.
- security.txt: publish at /.well-known/security.txt with contact email, preferred language, encryption key, and policy URL.
- Bug bounty or VDP: launch when the product reaches GA. Define scope, rules, and response SLAs.

---

## WHAT NEVER TO GENERATE

Never generate code that:
- Uses eval(), exec(), Function(), child_process.exec() with user input
- Concatenates user input into SQL, shell commands, HTML, or template strings
- Disables TLS verification (rejectUnauthorized: false, verify=False, -k in production)
- Uses Math.random() for security-sensitive values (use crypto.randomBytes/crypto.randomUUID)
- Hardcodes credentials, API keys, tokens, or secrets
- Stores passwords in plaintext or reversible encryption
- Trusts client-provided role, permission, admin, or privilege fields
- Returns different error messages for existing vs non-existing accounts
- Exposes stack traces, SQL errors, or internal paths in API responses
- Uses wildcard CORS (Access-Control-Allow-Origin: *)
- Runs containers as root
- Commits .env files to git
- Logs sensitive data (passwords, tokens, PII)
- Uses MD5, SHA1, or SHA256 for password hashing
- Sends secrets in URL query parameters
- Uses HTTP (not HTTPS) for any external communication
- Trusts X-Forwarded-For or Origin headers without validation
- Accepts file uploads without type validation and size limits

When in doubt, choose the more restrictive option.
