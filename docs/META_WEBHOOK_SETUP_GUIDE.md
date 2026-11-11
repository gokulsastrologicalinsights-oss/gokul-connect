# GOKUL CONNECT — META WEBHOOK SETUP GUIDE
## Meta WhatsApp Cloud API Live Integration & Webhook Guide

**Project:** Gokul Connect  
**Meta App ID:** `1102646469266479` (`Gokul Connect`)  
**Target Webhook Endpoint:** `https://<production-domain>/api/webhooks/whatsapp`  
**API Version:** `v26.0`  

---

## 1. Webhook Handshake (GET Verification)

When registering the webhook in the Meta App Dashboard:

1. **Callback URL:** `https://<production-domain>/api/webhooks/whatsapp`
2. **Verify Token:** Value of `META_WEBHOOK_VERIFY_TOKEN`
3. **Verification Logic:**
   - Meta sends: `hub.mode=subscribe`, `hub.challenge=<random_string>`, `hub.verify_token=<token>`
   - Endpoint verifies `hub.mode === 'subscribe'` and `hub.verify_token === META_WEBHOOK_VERIFY_TOKEN`.
   - Returns: Plaintext `<hub.challenge>` with HTTP 200.

---

## 2. Event Ingestion (POST Verification)

1. **Cryptographic Signature Verification:**
   - Header: `X-Hub-Signature-256: sha256=<hmac_hash>`
   - Generated using: `HMAC-SHA256(raw_body, META_APP_SECRET)`
   - Timing-safe comparison (`crypto.timingSafeEqual`).
   - If invalid or missing: Return HTTP 401 immediately.
2. **Non-Blocking Atomic Ingestion:**
   - Ingests inbound message atomically via `ingest_wa_inbound_message_v2` RPC.
   - Enqueues event into `wa_processing_jobs` for background execution.
   - Returns: HTTP 200 within < 100ms.
3. **Event Fields to Subscribe on Meta App Dashboard:**
   - `messages` (Inbound messages, delivery status, read receipts)
   - `message_template_status_update` (Template approvals/rejections)

---

## 3. Pre-Activation Checklist

- [ ] Meta App ID is confirmed as `1102646469266479`.
- [ ] Fresh Meta System User Access Token is configured in `.env.local` or hosting provider settings (never logged).
- [ ] Webhook URL is public HTTPS with valid SSL certificate.
- [ ] HMAC signature verification is active in fail-closed mode.
