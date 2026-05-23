# Data Retention (GDPR-oriented)

| Veri | Varsayılan öneri | Açıklama |
|------|-------------------|----------|
| `financial_payloads` (şifreli ham) | 30–90 gün | Analiz tamamlandıktan sonra sil veya arşivle (şifreli). |
| `security_audit_logs` | 90–365 gün | Güvenlik olayları; kullanıcı silindiğinde PII içermeden tutulabilir. |
| Kullanıcı hesabı | Hesap yaşamı | `POST /privacy/erase` ile kalıcı silme. |

Otomatik TTL job’ları (cron / worker) eklendiğinde bu tablolara `expires_at` sütunu eklenmesi önerilir.
