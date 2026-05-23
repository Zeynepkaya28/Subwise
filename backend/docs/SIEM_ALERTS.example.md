# SIEM Alert Examples (map from `security_audit_logs`)

| `event_type` | Suggested alert |
|--------------|-----------------|
| `login_failure` | Spike per IP / per email hash |
| `refresh_reuse` | High severity — possible token theft |
| `rate_limit` | Abuse / scraping |
| `ingest_failure` | Data quality attack |
| `privacy_erase` | Compliance audit trail |

Ship logs to SIEM via log forwarder; do not include request bodies.
