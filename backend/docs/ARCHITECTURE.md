# Secure Financial Backend — Architecture

```
┌─────────────┐     TLS 1.3      ┌──────────────────┐
│ Web/Mobile  │ ───────────────► │ API (NestJS)     │
│ Client      │                  │ - JWT guard      │
└──────┬──────┘                  │ - Throttle       │
       │                         │ - Sanitization   │
       │ optional E2EE envelope └────────┬─────────┘
       │                                 │
       └────────────────────────────────►│
                                         ▼
                              ┌────────────────────┐
                              │ EncryptionService  │
                              │ AES-256-GCM at rest│
                              └─────────┬──────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
             ┌────────────┐      ┌────────────┐     ┌─────────────┐
             │ PostgreSQL│      │ Redis      │     │ Audit log   │
             │ metadata  │      │ rate/JTI   │     │ (append)    │
             │ ciphertext│      │ cache      │     └─────────────┘
             └────────────┘      └────────────┘
```

## GDPR / Privacy Flow

- **Export**: `GET /privacy/export` — JSON snapshot of user-owned metadata + encrypted payload references (no server-side plaintext of raw finance unless user provides decryption in future).
- **Delete all**: `POST /privacy/erase` — async job marks tenant/user rows deleted; crypto erase via key version invalidation + row purge.

See `README.md` for API and environment variables.
