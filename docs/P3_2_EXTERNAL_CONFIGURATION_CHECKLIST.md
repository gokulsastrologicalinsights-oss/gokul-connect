# GOKUL CONNECT — P3.2: EXTERNAL CONFIGURATION CHECKLIST

**Document ID:** `DOC-P3_2-EXTERNAL-CONFIGURATION-CHECKLIST`  
**Execution Timestamp:** `2026-11-09T20:11:30+05:30`  
**Platform:** **Gokul Connect (Multi-Tenant WhatsApp CRM & Automation Engine)**  
**Auditor:** Independent Antigravity Engineering Agent  
**Status:** **READY FOR PRODUCTION CREDENTIAL INJECTION**  

---

## 1. Meta WhatsApp Cloud API v26.0 Readiness

### 1.1 Status Confirmation
- **Current Token Status:** **EXPIRED** (`OAuthException: 190, subcode: 463` — "Session has expired"). The temporary User Token active in `.env.local` expired on November 6, 2026.
- **Outbound WhatsApp Impact:** Live outbound messaging and media downloads will fail immediately with HTTP 401 until a permanent System User Token is provisioned.
- **Safety Compliance:** Zero live Meta API calls were executed during this audit; zero tokens or secrets were logged or transmitted.

### 1.2 Permanent Meta System User Token Provisioning SOP
To replace the expired temporary token with a permanent, non-expiring System User Token, the Platform Owner must execute the following official Meta Business Manager procedure:

1. **Navigate to Meta Business Manager:**  
   Open [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users).
2. **Create or Select System User:**
   - Click **Add System User**.
   - System User Name: `Gokul Connect Worker`.
   - Role: **Admin** (or Employee with WhatsApp assets assigned).
3. **Assign WhatsApp Assets to System User:**
   - Under **Assigned Assets**, click **Add Assets**.
   - Select **WhatsApp Accounts** -> Choose Gokul Connect WABA (`115396264985557`).
   - Grant **Full Control** (Manage WhatsApp Business Account) and **Partial Access** (Messages).
4. **Generate Permanent Access Token:**
   - Click **Generate New Token**.
   - Select the Gokul Connect App.
   - Token Expiration: **Never** (Permanent System User Token).
   - Select Permissions:
     - `whatsapp_business_messaging` (Required for sending and receiving messages)
     - `whatsapp_business_management` (Required for reading templates and phone numbers)
   - Click **Generate Token**.
5. **Secure Storage & Environment Injection:**
   - Copy the generated token (`EAAG...`) immediately.
   - Inject into production environment variables: `META_ACCESS_TOKEN=<token>`.
   - Update `.env.local` for local staging.
   - **Never commit tokens to version control or paste them into chat transcripts.**

---

## 2. Transactional Email Provider Readiness (Resend)

### 2.1 Current State & Adapter Verification
- **Current Status:** `EMAIL_PROVIDER` is currently absent from `.env.local`. The email adapter (`src/lib/email/adapter.ts`) falls back to `provider: "none"` and honestly returns `{ sent: false, configured: false }`.
- **Adapter Verification:** The Resend delivery adapter has been fully implemented and verified. It includes responsive HTML and plain-text invitation templates, localized IST timestamp formatting, and clean error sanitization.

### 2.2 Resend Configuration Checklist
To activate automated team invitation delivery for Gokul Connect workspaces, complete the following configuration:

1. **Create Resend Account & API Key:**
   - Sign up at [resend.com](https://resend.com).
   - In the Resend Dashboard, navigate to **API Keys** -> **Create API Key**.
   - Permission: **Full Access** or **Sending Access**.
   - Note the API key (`re_...`).
2. **Domain Verification (DNS Records):**
   - In the Resend Dashboard, navigate to **Domains** -> **Add Domain** (`gokulconnect.com` or your registered domain).
   - Add the generated DNS records at your domain registrar:
     - **TXT (SPF):** `v=spf1 include:resend.com ~all`
     - **DKIM (CNAME):** `resend._domainkey` -> `dkim.resend.com`
     - **DMARC (TXT):** `v=DMARC1; p=none;`
   - Wait for domain verification to report **Verified** in Resend.
3. **Environment Variables Configuration:**
   Add the following variables to production hosting and `.env.local`:
   ```bash
   EMAIL_PROVIDER="resend"
   RESEND_API_KEY="re_YourSecretApiKeyHere"
   EMAIL_FROM="Gokul Connect <noreply@gokulconnect.com>"
   NEXT_PUBLIC_APP_URL="https://your-production-domain.com"
   ```
4. **Delivery Verification Procedure:**
   - Send a test team invitation from Workspace Settings -> Team.
   - Check the Resend Dashboard **Emails** tab to verify HTTP 200 delivery and recipient receipt.

---

## 3. Hosting & Serverless Scheduler Readiness (Vercel)

### 3.1 Plan Compatibility Assessment
- **Vercel Hobby Plan:** Supports at most **1 cron run per day** and a default function timeout of 10–60 seconds.
- **Vercel Pro Plan:** Supports **sub-daily cron intervals** (`*/2`, `*/5`, `*/10`, `*/15` minutes) and function execution limits up to 300 seconds.
- **Requirement:** Because Gokul Connect relies on frequent cron processing for automation queues (`*/2 min`), scheduled messages (`*/5 min`), campaigns (`*/10 min`), and CRM reminders (`*/15 min`), **Vercel Pro (or an external cron runner such as Upstash / cron-job.org) is strictly mandatory**.

### 3.2 Vercel Configuration Summary
1. `vercel.json` contains:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "crons": [
       { "path": "/api/cron/process-automation-jobs", "schedule": "*/2 * * * *" },
       { "path": "/api/cron/process-scheduled-messages", "schedule": "*/5 * * * *" },
       { "path": "/api/cron/process-campaigns", "schedule": "*/10 * * * *" },
       { "path": "/api/cron/process-crm-reminders", "schedule": "*/15 * * * *" }
     ],
     "functions": {
       "src/app/api/cron/**/route.ts": {
         "maxDuration": 60
       }
     }
   }
   ```
2. Each route file in `src/app/api/cron/` exports `export const maxDuration = 60;`.
3. Secret `CRON_SECRET` must be set in Vercel Project Settings -> Environment Variables. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` with each scheduled invocation.

---

## 4. Master Production Environment Variables Checklist

| Environment Variable | Description | Security Classification | Required For Production |
|:---|:---|:---:|:---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Remote Supabase project URL (`https://ansiwtwqgrfmzfrhkzuu.supabase.co`) | Public | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Public API Key | Public | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key | **Secret** (Server-only) | ✅ Yes |
| `CRON_SECRET` | Secret Bearer token for authenticating background cron triggers | **Secret** (Server-only) | ✅ Yes |
| `ENCRYPTION_SECRET` | 64-character hex key for AES-256-GCM credential vault | **Secret** (Server-only) | ✅ Yes |
| `META_ACCESS_TOKEN` | Permanent Meta Cloud API System User Token (`EAAG...`) | **Secret** (Server-only) | ✅ Yes |
| `META_APP_SECRET` | Meta App Secret for HMAC-SHA256 webhook signature validation | **Secret** (Server-only) | ✅ Yes |
| `META_WEBHOOK_VERIFY_TOKEN` | Custom verification token for Meta webhook subscription handshake | **Secret** (Server-only) | ✅ Yes |
| `EMAIL_PROVIDER` | Email driver: `"resend"` | Config | ✅ Yes |
| `RESEND_API_KEY` | Resend API Key (`re_...`) | **Secret** (Server-only) | ✅ Yes |
| `EMAIL_FROM` | Verified sender address: `"Gokul Connect <noreply@domain.com>"` | Config | ✅ Yes |
| `NEXT_PUBLIC_APP_URL` | Canonical production domain URL | Public | ✅ Yes |
