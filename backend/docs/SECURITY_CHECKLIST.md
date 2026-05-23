# Security Checklist (Production)

- [ ] TLS 1.3 only at edge; HSTS enabled.
- [ ] `MASTER_ENCRYPTION_KEY` from KMS/secret manager; rotation playbook ready.
- [ ] `JWT_ACCESS_SECRET` strong; prefer RS256 via IdP for access tokens.
- [ ] `OIDC_*` configured; local password auth disabled if not needed.
- [ ] `TYPEORM_SYNC=false`; use migrations only.
- [ ] Database/network policies: DB not publicly reachable.
- [ ] WAF + bot protection in front of API.
- [ ] Centralized logging without financial plaintext; PII redaction.
- [ ] SIEM alerts for `REFRESH_REUSE`, `RATE_LIMIT`, brute-force patterns.
- [ ] GDPR: privacy policy versioned; consent records; DPA with subprocessors.
- [ ] Backup retention + cryptographic erasure propagation documented.
- [ ] Pen-test + dependency scanning (SAST/DAST) in CI.
