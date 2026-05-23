# Secure Financial Backend

NestJS API implementing the attached security plan: encrypted-at-rest financial payloads, optional client-side envelope storage, JWT access + rotating refresh tokens, OIDC (JWKS) bearer alternative, rate limiting with audit trail, and GDPR export/erase.

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL / Redis)

## Quick start

```bash
cd backend
cp .env.example .env
# Set MASTER_ENCRYPTION_KEY (32 bytes base64) and JWT_ACCESS_SECRET (>=32 chars)
docker compose -f ../docker-compose.yml up -d
npm install
npm run start:dev
```

Health: `GET http://localhost:3000/health`

## Environment

See [.env.example](.env.example). Required:

- `MASTER_ENCRYPTION_KEY` — `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `JWT_ACCESS_SECRET` — long random string

Optional OIDC (when all three set, Bearer tokens are verified via JWKS first):

- `OIDC_ISSUER`
- `OIDC_AUDIENCE`
- `OIDC_JWKS_URI`

## API (summary)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create user + tenant |
| POST | `/auth/login` | No | Issue access + refresh JWT |
| POST | `/auth/refresh` | No | Rotate refresh token |
| POST | `/ingest/server-encrypt` | Bearer | Sanitize + AES-GCM encrypt server-side, store ciphertext |
| POST | `/ingest/envelope` | Bearer | Store client ciphertext (E2EE storage path) |
| GET | `/privacy/export` | Bearer | GDPR data export |
| POST | `/privacy/erase` | Bearer | Permanent user + payload erasure |

## Security notes

- Raw financial JSON is never written to disk unencrypted on the `server-encrypt` path.
- `envelope` path stores opaque ciphertext; analysis requires separate key unwrap flow (KMS) — extend in workers.
- Do not log request bodies in production.

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md).
