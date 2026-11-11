# GOKUL CONNECT — ENVIRONMENT CONFIGURATION CHECKLIST
## Production & Local Environment Variable Standards

**Project:** Gokul Connect  
**Date:** `2026-11-09`  
**Classification:** Confidential / Zero-Secrets-in-Logs Standard  

---

## 1. Inventory & Classification Matrix

| Environment Variable | Scope | Purpose | Criticality | Verification Standard |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public / Browser | Canonical URL for webhook generation, signed URLs, and email links | High | Must use `https://` in production |
| `NEXT_PUBLIC_SUPABASE_URL` | Public / Browser | Supabase API Gateway URL | Critical | Exactly `https://ansiwtwqgrfmzfrhkzuu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public / Browser | PostgREST public key with RLS enforcement | Critical | Non-empty JWT, RLS enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | Admin operations, background queue workers, and cron RPC execution | Critical | Strict server-side only; never leaked to client bundles |
| `APP_ENCRYPTION_SECRET` | Server-Only | 32-byte hex key for AES-256-GCM credential vaulting (`wa_credentials`) | Critical | Must NOT be changed or rotated without credential re-encryption |
| `META_APP_SECRET` | Server-Only | HMAC-SHA256 signature verification for inbound WhatsApp webhooks | Critical | Timing-safe fail-closed verification in production |
| `META_APP_ID` | Server-Only / Public | Meta App ID (`1102646469266479`) | High | Matches Gokul Connect application |
| `META_WEBHOOK_VERIFY_TOKEN` | Server-Only | Shared secret for Meta Webhook GET challenge verification | High | Cryptographically secure random token |
| `CRON_SECRET` | Server-Only | Bearer token for securing background worker cron endpoints | High | Constant-time comparison on `/api/cron/*` |
| `EMAIL_PROVIDER` | Server-Only | Transactional email provider (`console`, `resend`, `smtp`) | Medium | Configured for team invitation delivery |

---

## 2. Security & Redaction Rules

1. **Zero Hardcoded Secrets:** No secrets in source code or `.env.example`.
2. **Zero Terminal Logging:** Secrets must be masked or omitted in all CLI scripts (`sanitizeMetaLog`, `maskToken`).
3. **Fail-Closed Production Vault:** Production throws a fatal error if `APP_ENCRYPTION_SECRET` is missing or invalid.
4. **Encryption Key Continuity:** The encryption key must match the key used to encrypt existing records in `public.wa_credentials`.
