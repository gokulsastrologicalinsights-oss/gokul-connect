# GOKUL CONNECT — PRODUCTION DEPLOYMENT RUNBOOK
## Operational Deployment Guide & Cloud Activation Standard

**Project:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Target Infrastructure:** Dedicated Vercel & Supabase Architecture  
**Target Supabase Project:** `ansiwtwqgrfmzfrhkzuu` (`gokul-connect`, `ap-south-1`)  
**Target Meta App ID:** `1102646469266479` (`Gokul Connect`)  
**Date:** `2026-11-09`  
**Security Classification:** Strict Tenant Isolation / Confidential  

---

## 1. Scope & Objective

This runbook establishes the exact end-to-end procedure for deploying Gokul Connect to dedicated production infrastructure. It coordinates Next.js 15 App Router hosting, PostgreSQL database migrations, environment variable provisioning, Meta WhatsApp Cloud API webhooks, and background queue workers under strict multi-tenant isolation.

---

## 2. Infrastructure Isolation Guardrails

Gokul Connect operates in 100% isolation from all other legacy projects or external databases.

| Resource | Dedicated Production Target | Prohibited Resources (Never Use) |
|---|---|---|
| **Supabase Project** | `ansiwtwqgrfmzfrhkzuu` (`gokul-connect`) in `ap-south-1` | Legacy Astrology app databases, Gokul Vivaham production DBs, personal sandbox DBs |
| **Meta Cloud API App** | App ID `1102646469266479` (`Gokul Connect`) | Unrelated Meta business apps, personal test apps |
| **Hosting Platform** | Dedicated `gokul-connect` Vercel project | Unrelated Vercel team projects, non-isolated edge lambdas |
| **Encryption Vault** | Isolated `APP_ENCRYPTION_SECRET` (AES-256-GCM) | Hardcoded dev keys, shared legacy encryption keys |

---

## 3. Staged Deployment Gates

Deployment proceeds through five explicit approval gates:

1. **Gate 1 — Database Migrations:** Remote ledger audit, schema replay verification, user authorization, transactional execution (016–023).
2. **Gate 2 — Hosting Deployment:** Vercel linking, build verification, environment variable validation, private health checks.
3. **Gate 3 — Meta Webhook & Integration:** Fresh system token validation, public HTTPS webhook challenge, timing-safe HMAC signature verification.
4. **Gate 4 — Background Workers & Cron:** Durable queue activation (`wa_processing_jobs`), scheduled message workers, CRM reminder workers.
5. **Gate 5 — Controlled Live Testing:** Isolated single-recipient message tests, media download checks, visual flow and opt-out verification.

---

## 4. Hosting Platform Setup (Vercel)

### 4.1 Prerequisites
- Vercel CLI installed or Vercel dashboard access.
- Source repository clean with 100% passing tests (744/744) and 0 TypeScript errors.
- Target framework: `Next.js 15.1.0` (App Router).
- Node.js runtime: `20.x` or `22.x`.

### 4.2 Project Configuration (`vercel.json`)
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/cron/process-automation-jobs",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/process-scheduled-messages",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/process-crm-reminders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/process-campaigns",
      "schedule": "*/2 * * * *"
    }
  ]
}
```

### 4.3 Environment Variable Provisioning
Set all required variables in Vercel Project Settings > Environment Variables:
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENCRYPTION_SECRET`
- `META_APP_SECRET`
- `META_APP_ID`
- `META_WEBHOOK_VERIFY_TOKEN`
- `CRON_SECRET`

---

## 5. Verification Checklist

1. [ ] Health check: `GET /api/health` returns `HTTP 200 { status: "healthy" }`.
2. [ ] Liveness probe: `GET /api/health/liveness` returns `HTTP 200`.
3. [ ] Readiness probe: `GET /api/health/readiness` returns `HTTP 200` with DB connection confirmed.
4. [ ] Auth flow: `GET /login` renders securely over HTTPS with zero console errors.
5. [ ] Tenant isolation: Switch between `astrology` and `vivaham` workspaces with verified zero cross-tenant contamination.
