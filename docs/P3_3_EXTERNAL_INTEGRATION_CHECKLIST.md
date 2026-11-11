# GOKUL CONNECT — P3.3: EXTERNAL INTEGRATION CONFIGURATION & READINESS CHECKLIST

**Document ID:** `DOC-P3_3-EXTERNAL-INTEGRATION-CHECKLIST`  
**Execution Timestamp:** `2026-11-09T20:36:00+05:30`  
**Platform:** **Gokul Connect (Multi-Tenant WhatsApp CRM & Automation Engine)**  
**Auditor:** Independent Antigravity Evidence Verification Engine  
**Status:** **AUDITED — PENDING OPERATOR CREDENTIAL PROVISIONING**  

---

## 1. Executive Summary

This checklist specifies the exact external integrations, cloud service prerequisites, and environment variable requirements necessary for transitioning Gokul Connect from local verification to production deployment.

In strict compliance with safety directives:
- Zero live Meta Cloud API calls were executed.
- Zero test emails or live WhatsApp messages were dispatched.
- Zero sensitive credentials or tokens were logged or exposed.

---

## 2. Integration Readiness & Verification Status

| Integration Domain | Target Provider / Asset | Readiness Status | Action Required Prior to P4 Live Traffic |
|:---|:---|:---:|:---|
| **Database** | Dedicated Supabase Project (`ansiwtwqgrfmzfrhkzuu`, Mumbai) | **READY (Baseline 015)** | Execute pending migrations 016–024 after pre-migration backup. |
| **Outbound WhatsApp**| Meta WhatsApp Cloud API v26.0 | ⚠️ **EXTERNAL (Token Expired)** | Provision permanent Meta System User Token; update `META_ACCESS_TOKEN`. |
| **Inbound Webhook** | Meta App Dashboard Webhook Receiver | **READY (Code & Routes)** | Register production URL `/api/webhooks/whatsapp` and subscribe to `messages`. |
| **Transactional Email**| Resend API | ⚠️ **EXTERNAL (Unconfigured)** | Provision Resend API key, verify sending domain DNS, and set `EMAIL_PROVIDER=resend`. |
| **Media Storage** | Supabase Storage (`whatsapp-media` bucket) | **READY (Code & RPCs)** | Verify private storage bucket exists on remote Supabase instance. |
| **Background Scheduler**| Vercel Cron Functions | ⚠️ **EXTERNAL (Hosting Plan)** | Ensure Vercel Pro subscription (or configure external cron runner for sub-daily schedules). |

---

## 3. Detailed Component Provisioning Protocols

### 3.1 Meta WhatsApp Cloud API v26.0 (Permanent System User Token)
- **Problem Statement:** The active `META_ACCESS_TOKEN` expired on November 6, 2026 (`OAuthException 190, subcode 463`).
- **Provisioning Protocol (Platform Owner):**
  1. Navigate to **Meta Business Manager** -> **System Users** ([business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)).
  2. Select system user `Gokul Connect Worker`.
  3. Under **Assigned Assets**, ensure WhatsApp Business Account `115396264985557` is assigned with **Full Control**.
  4. Click **Generate New Token**.
  5. Select Gokul Connect Meta App.
  6. Expiration: **Never** (Permanent System User Token).
  7. Check permissions: `whatsapp_business_messaging` and `whatsapp_business_management`.
  8. Click **Generate Token** and copy the resulting string (`EAAG...`).
  9. Add to production environment variables as `META_ACCESS_TOKEN`.

### 3.2 Transactional Email Delivery (Resend)
- **Current State:** `EMAIL_PROVIDER` is absent from `.env.local`; email adapter safely returns `{ sent: false, configured: false }`.
- **Provisioning Protocol:**
  1. Create account at [resend.com](https://resend.com) and generate an API key (`re_...`).
  2. Navigate to **Domains** -> **Add Domain** (`gokulconnect.com` or your verified domain).
  3. Configure DNS records at your registrar:
     - SPF: `v=spf1 include:resend.com ~all` (TXT)
     - DKIM: `resend._domainkey` -> `dkim.resend.com` (CNAME)
     - DMARC: `v=DMARC1; p=none;` (TXT)
  4. Wait for domain status to become **Verified**.
  5. Configure environment variables:
     ```bash
     EMAIL_PROVIDER="resend"
     RESEND_API_KEY="re_..."
     EMAIL_FROM="Gokul Connect <noreply@gokulconnect.com>"
     NEXT_PUBLIC_APP_URL="https://your-production-domain.com"
     ```

### 3.3 Serverless Cron Scheduling & Hosting Plan Compatibility
- **Vercel Hobby Plan Restriction:** Vercel Hobby strictly limits cron schedules to **once per day**. Sub-daily schedules (`*/2`, `*/5`, `*/10`, `*/15`) will fail deployment or trigger plan upgrade warnings.
- **Vercel Pro Plan ($20/mo):** Sub-daily cron execution down to 1 minute is officially supported, with serverless execution limits up to 300 seconds.
- **Alternative (Zero-Cost External Scheduler):** If hosting on Vercel Hobby, external cron services (e.g., Upstash QStash, cron-job.org, AWS EventBridge) can trigger the HTTP endpoints on schedule using the header:
  `Authorization: Bearer <CRON_SECRET>`

---

## 4. Master Production Environment Configuration Checklist

| Variable Name | Description | Visibility | Injected Status |
|:---|:---|:---:|:---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Dedicated Supabase URL (`https://ansiwtwqgrfmzfrhkzuu.supabase.co`) | Public | ✅ Present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key | Public | ✅ Present |
| `SUPABASE_SERVICE_ROLE_KEY` | Administrative service role key | **Secret** | ✅ Present |
| `CRON_SECRET` | Secret token for authenticating background cron triggers | **Secret** | ✅ Present |
| `ENCRYPTION_SECRET` | 64-character hex secret for AES-256 credential vault | **Secret** | ✅ Present |
| `META_ACCESS_TOKEN` | Permanent Meta Cloud API System User Token | **Secret** | ⚠️ **EXPIRED (Update Required)** |
| `META_APP_SECRET` | Meta App Secret for HMAC-SHA256 signature verification | **Secret** | ✅ Present |
| `META_WEBHOOK_VERIFY_TOKEN` | Custom token for Meta webhook handshake challenge | **Secret** | ✅ Present |
| `EMAIL_PROVIDER` | Email driver (`resend`) | Config | ⚠️ **Unset (Configure)** |
| `RESEND_API_KEY` | Resend API key (`re_...`) | **Secret** | ⚠️ **Unset (Configure)** |
| `EMAIL_FROM` | Sender address (`Gokul Connect <noreply@domain.com>`) | Config | ⚠️ **Unset (Configure)** |
| `NEXT_PUBLIC_APP_URL` | Canonical production domain URL | Public | ✅ Present |
