# Threat Model & Trust Boundaries

## Trust Boundaries

| Boundary | Inside | Outside | Controls |
|----------|--------|---------|----------|
| **User device** | UI, optional client-side envelope crypto | Internet | OS security, app hardening |
| **Edge / CDN** | TLS termination, WAF (when deployed) | Raw HTTP | TLS 1.3, HSTS, certificate pinning (mobile) |
| **API Gateway** | Auth, rate limits, request validation | Untrusted clients | JWT validation, throttling, schema validation |
| **Application tier** | Business logic, transient decrypt for processing | Other services | Least privilege, no plaintext logs |
| **Data tier** | PostgreSQL (metadata, ciphertext only), Redis (ephemeral) | App tier only | Network policies, encryption at rest |
| **Object storage** | Encrypted blobs (optional) | Public internet | Pre-signed URLs, IAM, SSE-KMS pattern |

## Data Classification

| Class | Examples | Storage | Retention |
|-------|----------|---------|-----------|
| **Critical** | Raw transactions, account identifiers | Encrypted blob + envelope metadata only | Short (policy-driven) |
| **Sensitive** | Email, name (if collected) | DB encrypted-at-rest + column minimization | Account lifetime |
| **Internal** | Tenant IDs, job IDs | DB | Operational |
| **Public** | API version, docs | CDN | Indefinite |

## STRIDE Summary

- **Spoofing**: Mitigated by JWT + optional OIDC + refresh rotation.
- **Tampering**: TLS + signed payloads where applicable; DB integrity constraints.
- **Repudiation**: Immutable-style audit log for security events (append-only table).
- **Information disclosure**: No financial plaintext in logs; encrypted columns/blobs.
- **Denial of service**: Rate limiting + payload size limits.
- **Elevation of privilege**: RBAC + tenant-scoped queries enforced in services.

## Assumptions

- Production uses managed KMS/HSM for master key material (env-based key in dev only).
- Analysis workers run in isolated network segment with same encryption rules.
