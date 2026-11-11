# GOKUL CONNECT — PHASE 7.1: DEDICATED STAGING DEPLOYMENT READINESS AUDIT

**Audit Date:** `2026-11-07`  
**Platform:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Dedicated Supabase Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`, region: `ap-south-1`)  
**Dedicated Meta Developer App:** `Gokul Connect` (`1102646469266479`, WABA ID: `1153964060437882`)  
**Target File Created:** `docs/PHASE_7_1_STAGING_DEPLOYMENT_READINESS_REPORT.md`  
**Audit Scope:** Next.js deployment configuration, environment variables, webhook architecture, cron security, database isolation, and staging hosting readiness  
**Overall Readiness Verdict:** 🟡 **READY FOR STAGING DEPLOYMENT SUBJECT TO PRE-FLIGHT REQUISITES**

---

## 1. Executive Summary

Phase 6.3 completed successfully with the synchronized database credential rotation and Meta Graph API validation for **Gokul Vivaham**. 

The primary objective of **Phase 7.1** is to perform a rigorous readiness audit of the Gokul Connect codebase to prepare an isolated staging deployment. This deployment is required so that Meta's Cloud API servers can deliver WhatsApp webhooks over a public HTTPS endpoint, enabling live webhook verification and end-to-end inbound/outbound event testing in an isolated staging environment.

### Strict Isolation Constraints Observed
Throughout this audit, the following mandatory isolation requirements were verified:
1. **Dedicated Staging Deployment:** The staging deployment must be a completely dedicated instance. No existing application deployment (such as the existing Render `gai-astrology-backend` service) will be reused.
2. **Credential Isolation:** Supabase database credentials, Meta tokens, and application encryption keys belong exclusively to Gokul Connect.
3. **Preservation of Connection Assignments:** The existing Meta connection for **Gokul Vivaham** (`44444444-4444-4444-4444-444444444444`, Phone Number ID: `1395663896970053`) and unassigned status for **Gokul Astrology** (`11111111-1111-1111-1111-111111111111`) are preserved untouched.
4. **Automations Disabled in Staging:** To prevent unexpected auto-replies or messages during webhook tests, automation rules remain switched off (`is_automation_enabled = false`).
5. **No Outbound Messages Sent:** No outbound WhatsApp messages or API calls were triggered during this audit.
6. **No Premature Deployment:** The audit was completed and halted before provisioning or deploying any hosting services, in strict accordance with the stop directive.

---

## 2. Hosting Platform Evaluation & Recommendation

To receive Meta WhatsApp webhooks, the hosting environment must fulfill four critical requirements:
- **Public HTTPS:** Valid SSL/TLS certificate trusted by Meta.
- **Fast Webhook Response Latency (< 5 seconds, ideally < 1 second):** Meta retries webhook deliveries if the receiver does not return `HTTP 200` within 5 seconds.
- **Node.js Runtime Environment:** Required for Node's built-in `crypto` module (`createHmac`, `timingSafeEqual`, `createCipheriv`, `randomBytes`).
- **Automated Cron / Scheduled Trigger:** To trigger `/api/cron/process-automation-jobs` periodically (every 1-5 minutes).

### Hosting Provider Comparison

| Criteria | Vercel (Recommended) | Render Web Service | Self-Hosted / VPS |
|---|---|---|---|
| **Next.js App Router Support** | Native (Zero configuration, optimized serverless/edge bundle) | Supported (via Docker or Node engine) | Requires manual PM2 / Docker / Nginx setup |
| **Public HTTPS / Custom Domains** | Out-of-the-box automatic Let's Encrypt SSL | Automatic HTTPS on `*.onrender.com` | Requires certbot / reverse-proxy |
| **Cold Start Risk** | Minimal (warm serverless instances ~100-300ms) | ⚠️ **High on Free Tier** (spins down after 15 min; cold starts take 50+ s causing Meta webhooks to time out). Requires paid Starter plan ($7/mo) to stay warm. | Zero cold starts |
| **Scheduled Worker / Cron** | Built-in Vercel Cron via `vercel.json` | Requires separate Render Cron Job or external cron pinger | Native system `crontab` |
| **Staging Isolation** | Independent project (`gokul-connect-staging`) with preview URLs | Can create separate service `gokul-connect-staging` | Can run on dedicated port / domain |
| **Cost for Staging** | Free tier covers staging workloads | Free tier has cold-start timeouts; paid Starter is $7/mo | Variable |

### Recommendation: Vercel (Primary) or Always-On Render (Secondary)
1. **Primary Recommendation — Vercel:**  
   Vercel is the natural and most reliable hosting platform for Next.js App Router applications. It provides instant HTTPS, eliminates cold-start webhook dropouts, integrates seamless environment variable management across Staging (Preview) and Production, and natively supports scheduled cron jobs via `vercel.json`.
2. **Alternative — Render (Paid Starter Web Service):**  
   If the organization prefers keeping all infrastructure consolidated within the existing Render team workspace (`tea-dbbh61eq1p3s73ck0hr0`), a **new, dedicated Web Service** named `gokul-connect-staging` can be created. However, it **must** be deployed on the Starter ($7/mo) plan to disable instance spinning and guarantee that Meta webhooks are received within Meta's 5-second deadline.  
   *(Note: The existing Render service `gai-astrology-backend` (`srv-dbhmt68n74is73efsp2g`) is attached to `Astrology-Website` and must NOT be shared or reused).*

---

## 3. Environment Variable Inventory & Scope Separation

Strict segregation between client-exposed variables (`NEXT_PUBLIC_`) and server-only secrets is enforced across the codebase.

### 3.1 Public Variables (Client & Server Accessible)

These variables are baked into client bundles during build time. They contain non-sensitive endpoints and public anonymous keys protected by PostgreSQL Row Level Security (RLS).

| Variable Name | Purpose | Staging Value Format | Sensitivity |
|---|---|---|:---:|
| `NEXT_PUBLIC_APP_URL` | Canonical origin for redirect URLs, auth callback, and assets | HTTPS URL (e.g., `https://gokul-connect-staging.vercel.app`) | Public |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API Gateway endpoint | `https://ansiwtwqgrfmzfrhkzuu.supabase.co` | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key for client-side queries (RLS enforced) | Standard Supabase Anon JWT | Public |

### 3.2 Server-Only Secrets (Strictly Server-Side)

These variables **must never** be exposed to browser bundles, client components, or public git repositories. They must be injected directly into the hosting platform's secure environment settings.

| Secret Name | Purpose & Consumer | Required in Staging? | Exposure Risk if Leaked |
|---|---|:---:|:---:|
| `SUPABASE_SERVICE_ROLE_KEY` | Used by `src/lib/supabase/admin.ts` to bypass RLS for webhook ingestion, queue management, and cron maintenance. | **YES** | **Critical:** Complete administrative access to the PostgreSQL database. |
| `APP_ENCRYPTION_SECRET` | 32-byte master encryption key (64 hex characters) used by `src/lib/crypto/encryption.ts` for AES-256-GCM encryption/decryption of stored Meta tokens. | **YES** | **Critical:** Compromises encrypted Meta Access Tokens in `wa_credentials`. |
| `META_APP_SECRET` | Used by `src/app/api/webhooks/whatsapp/route.ts` to verify inbound `X-Hub-Signature-256` HMAC-SHA256 signatures. | **YES** | **High:** Allows attackers to forge fake WhatsApp inbound webhook payloads. |
| `META_APP_ID` | Meta App identifier (`1102646469266479`) used for Graph API token inspection and debug calls. | **YES** | **Medium:** Identifies the developer application. |
| `META_WEBHOOK_VERIFY_TOKEN` | Secret token used by Meta during the `GET /api/webhooks/whatsapp` subscription handshake (`hub.verify_token`). | **YES** | **Medium:** Allows unauthorized subscription confirmations. |
| `CRON_SECRET` | Bearer authorization token to restrict access to `/api/cron/process-automation-jobs`. | **YES** | **High:** Allows unauthenticated callers to trigger background queue processing. |
| `META_TEST_ACCESS_TOKEN` | Local development and staging fallback token for Meta Graph API calls. | Optional (Vault preferred) | **High:** Direct access to WhatsApp Cloud API sending capabilities. |
| `META_TEST_PHONE_NUMBER_ID` | Default test phone number identifier (`1395663896970053`). | Optional / Dev | Low |
| `META_TEST_WABA_ID` | Meta WhatsApp Business Account ID (`1153964060437882`). | Optional / Dev | Low |

### 3.3 Missing Variables & Gap Analysis

1. **`CRON_SECRET`:**  
   - Consumed in `src/app/api/cron/process-automation-jobs/route.ts` line 22.  
   - **Status:** Missing from `.env.local` and not documented in `.env.example`.  
   - **Remediation:** Must be generated (high-entropy 32+ character random secret) and set in both staging hosting environment variables and local `.env.local`.
2. **`.env.example` Completeness:**  
   - `APP_ENCRYPTION_SECRET` and `CRON_SECRET` are not listed in `.env.example`.  
   - **Remediation:** Update `.env.example` with sanitized template entries so team members configure all required secrets.

---

## 4. Database & Credential Isolation Verification

### 4.1 Supabase Project Exclusivity
- **Project ID:** `ansiwtwqgrfmzfrhkzuu`  
- **Project Name:** `gokul-connect`  
- **Region:** `ap-south-1` (AWS Mumbai)  
- **Organization:** `ivrxvliiersocuyqxmqh`  
- **Isolation Check:** Verified via Supabase Management API. The project `ansiwtwqgrfmzfrhkzuu` contains exclusively Gokul Connect tables (`businesses`, `wa_connections`, `wa_credentials`, `wa_messages`, `wa_automation_rules`, `wa_processing_jobs`, etc.). No foreign tables or applications share this project.

### 4.2 Credential Protection & RLS Enforcement
- The `public.wa_credentials` table holds encrypted Meta access tokens.
- **Row Level Security:** Strict RLS policies restrict all SELECT, INSERT, UPDATE, and DELETE operations on `wa_credentials` to the `service_role` only. Anonymous and standard authenticated users receive zero rows.
- **Encryption Standard:** AES-256-GCM with randomized 12-byte IVs and 16-byte authentication tags. No raw tokens exist in the database.
- **Source Selection Priority:** Verified in Phase 6.3 that `getDecryptedConnectionCredentials` prioritizes the encrypted database vault over environment variable fallbacks.

### 4.3 Multi-Business Assignment Isolation
- **Gokul Vivaham (`vivaham`):** Assigned Connection ID `44444444-4444-4444-4444-444444444444` connected to verified Phone Number ID `1395663896970053`.
- **Gokul Astrology (`astrology`):** Maintained in cleanly unassigned state (`is_connected = false`, `phone_number_id = null`).
- Neither connection assignment will be altered during staging deployment.

---

## 5. Webhook Route Compatibility & Architectural Audit

### 5.1 Route Handler Inspection (`src/app/api/webhooks/whatsapp/route.ts`)

#### 1. Handshake Endpoint (`GET`)
```typescript
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = rateLimitWebhookHandshake(clientIp);
  ...
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new Response("Verification token mismatch", { status: 403 });
}
```
- **Compliance:** Returns challenge as plain text with `HTTP 200`, as strictly required by Meta.
- **Security:** Rate limits handshake requests by client IP (token-bucket limiter) to prevent brute-force token enumeration.

#### 2. Event Receiver Endpoint (`POST`)
- **HMAC Signature Validation:**
  ```typescript
  const signatureHeader = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();
  const isValid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
  ```
- **Integrity Check:** `request.text()` is read directly **before** JSON parsing, guaranteeing byte-level accuracy for the HMAC calculation.
- **Timing-Safe Comparison:** `verifyMetaWebhookSignature` in `src/lib/whatsapp/crypto-signature.ts` uses `crypto.timingSafeEqual` over raw UTF-8 buffers to prevent timing side-channel attacks.
- **Fail-Closed Guarantee:** If `META_APP_SECRET` is unset, the handler immediately aborts with `HTTP 500`. If the signature is forged or invalid, it returns `HTTP 401` and throttles the caller IP.

### 5.2 Webhook Response Time & Queue Latency Findings (Task 10)

During code inspection of `POST /api/webhooks/whatsapp`, the following architectural flow was identified:

```
[Meta Inbound Webhook]
       │
       ▼
HMAC-SHA256 Verification (Fast, ~1ms)
       │
       ▼
Atomically ingest via RPC `ingest_wa_inbound_message` (Fast, ~25ms)
       │
       ▼
Inline Evaluation: `processInboundAutomation(supabase, ctx)`
  ├── Read contacts, conversations, settings, rules (Promise.all)
  ├── Evaluate rule conditions
  └── If action delay == 0 (Immediate Action):
        └── Synchronously invokes `sendWhatsAppTextMessage(...)`
            (External HTTP request to Meta Graph API)
       │
       ▼
Return `HTTP 200 { success: true }` to Meta
```

#### Key Findings & Safeguards:
1. **Webhook Timeout Risk:** If an immediate automation rule performs an external HTTP request to Meta Graph API synchronously inside the webhook handler, any latency spike from Meta or database queries could delay the HTTP 200 response past Meta's 5-second deadline.
2. **Staging Isolation Safeguard:**  
   In staging, **automations must be disabled** (`business_settings.automation_settings.is_automation_enabled = false`).  
   When automations are disabled, `processInboundAutomation` skips rule execution (`evalResult.matched = false`, `skipReason = 'workspace_automation_disabled'`), completely bypassing outbound HTTP calls.  
   The response time to Meta will remain under **100ms** (well within the 5000ms threshold).
3. **Delayed Jobs Queue:** For actions with `delay_seconds > 0`, the dispatcher properly queues the job into `public.wa_processing_jobs` (`status = 'pending'`), achieving zero-latency background execution.

---

## 6. Cron & Scheduled Automation Worker Audit

### 6.1 Route Inspection (`src/app/api/cron/process-automation-jobs/route.ts`)
- **Methods:** Supports both `GET` and `POST`.
- **Dynamic Config:** `export const dynamic = "force-dynamic"`.
- **Functions Performed:**
  1. `processQueueBatch(15, workerId)`: Claims up to 15 pending jobs with concurrency locking (`reclaim_stuck_wa_jobs`).
  2. `supabase.rpc("prune_stale_automation_records")`: Prunes execution logs older than 14 days and completed jobs older than 7 days.

### 6.2 Security Vulnerability Identified: Unauthenticated Open Cron
Lines 20–26 of the cron route handler state:
```typescript
// Optional Bearer token authorization if CRON_SECRET is configured
const authHeader = request.headers.get("authorization");
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```
> [!WARNING]
> **Vulnerability Finding:** If `CRON_SECRET` is undefined or empty in the environment, the condition `if (cronSecret && ...)` evaluates to `false`. As a result, the endpoint becomes **publicly accessible without authentication**, allowing any external party to trigger queue processing and database pruning RPCs.

**Mandatory Remediation for Staging & Production:**
The cron route must be updated to **fail-closed**:
```typescript
if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## 7. Build, Lint, and Test Suite Validation

### 7.1 Production Build (`npm run build`)
The production build was executed in PowerShell. Output confirmed clean compilation:
- **Next.js Version:** `15.5.29` (React 19)
- **Compilation Time:** `11.9s`
- **TypeScript & ESLint:** Zero type errors, zero lint warnings.
- **Route Distribution:**
  - `○ (Static)`: `/`, `/_not-found`, `/forgot-password`, `/icon`, `/login`
  - `ƒ (Dynamic)`:
    - `/api/auth/signout`
    - `/api/cron/process-automation-jobs`
    - `/api/webhooks/whatsapp`
    - `/select-business`
    - `/workspace/[businessSlug]/automations`
    - `/workspace/[businessSlug]/connections`
    - `/workspace/[businessSlug]/dashboard`
    - `/workspace/[businessSlug]/inbox`
    - `/workspace/[businessSlug]/settings`

### 7.2 Automated Test Suite (`npm test`)
The Vitest automated test suite was executed across all domains:
- **Test Files:** 19 passed (19 total)
- **Tests Passed:** 211 passed (211 total)
- **Duration:** 19.00 seconds
- **Suites Verified:**
  - `tests/phase5-automation-engine.test.ts` (30 tests)
  - `tests/phase3f-end-to-end-validation.test.ts` (11 tests)
  - `tests/phase3i-performance-optimization.test.ts` (7 tests)
  - `tests/phase4-inbox.test.ts` (14 tests)
  - `tests/p0-3-environment-configuration.test.ts` (11 tests)
  - `tests/phase2-security-patches.test.ts` (6 tests)
  - `tests/phase3-webhooks.test.ts` (6 tests)
  - `tests/p0-4-dynamic-tenant-validation.test.ts` (17 tests)
  - `tests/phase5-pruning-rpc.test.ts` (7 tests)
  - `tests/phase3-whatsapp-architecture.test.ts` (10 tests)
  - `tests/phase2-persistence.test.ts` (6 tests)
  - `tests/phase2-server-authorization.test.ts` (6 tests)
  - `tests/phase4b-chat.test.ts` (17 tests)
  - `tests/tenant-isolation.test.ts` (7 tests)
  - `tests/phase2-credential-security.test.ts` (8 tests)
  - `tests/phase4a2-ui-stabilization.test.ts` (10 tests)
  - `tests/phase2-connections.test.ts` (9 tests)
  - `tests/phase2-authenticated-rls.test.ts` (10 tests)
  - `tests/phase3h-security-remediation.test.ts` (19 tests)

---

## 8. Deployment Configuration Checklist

When provisioning the dedicated staging instance, apply the following configuration:

| Configuration Item | Required Setting | Rationale |
|---|---|---|
| **Framework Preset** | Next.js | Automatically configures build command `next build` and output dir `.next` |
| **Node.js Runtime** | Node 20.x or 18.x LTS | Standard LTS runtime supporting Node `crypto` and `Buffer` |
| **Build Command** | `npm run build` | Validated to build cleanly with zero errors |
| **Output Directory** | `.next` | Next.js App Router default |
| **Root Directory** | `./` | Root of repository |
| **Environment Variables** | Injected via Host Dashboard | Server-only secrets never committed to Git |
| **Public HTTPS** | Enabled (SSL/TLS) | Prerequisite for Meta Webhook configuration |
| **Staging Subdomain** | Dedicated (e.g. `gokul-connect-staging.vercel.app`) | Isolated from any production or legacy URL |

---

## 9. Blockers & Pre-Deployment Action Items

Before deploying the staging application, the following four items must be addressed:

| Item | Description | Severity | Owner Action |
|:---:|---|:---:|---|
| **Blocker 1** | **Git Remote Origin Missing:** Local git repository currently has no configured remote origin (`git remote -v` returned empty). A dedicated GitHub repository (e.g., `github.com/gokul.../gokul-connect`) is needed to link with Vercel or Render. | **HIGH** | Create dedicated GitHub repository and push current `master` branch. |
| **Blocker 2** | **Fail-Closed Cron Route Patch:** `/api/cron/process-automation-jobs` allows unauthenticated access if `CRON_SECRET` is unset. | **MEDIUM** | Apply fail-closed guard to require `CRON_SECRET` unconditionally. |
| **Blocker 3** | **Generate `CRON_SECRET`:** A high-entropy secret must be generated for cron invocation. | **LOW** | Generate random 32-char hex string and set in environment variables. |
| **Blocker 4** | **Explicit Staging Creation Approval:** Staging project creation requires explicit owner confirmation. | **MANDATORY** | User must approve Phase 7.2 deployment execution. |

---

## 10. Exact Next Steps (Phase 7.2 Roadmap)

Following owner review and approval, the rollout plan is:

1. **Step 1: Apply Minor Code Hardening**
   - Update `src/app/api/cron/process-automation-jobs/route.ts` to enforce fail-closed authentication (`!cronSecret || authHeader !== Bearer ...`).
   - Update `.env.example` with template fields for `APP_ENCRYPTION_SECRET` and `CRON_SECRET`.
2. **Step 2: Commit & Push to Dedicated GitHub Repository**
   - Stage and commit tracked code files.
   - Verify `.env.local` and `scripts/backup/` remain completely ignored and untracked.
   - Push to dedicated repository: `origin/main`.
3. **Step 3: Provision Dedicated Staging Project on Hosting Platform**
   - Connect the dedicated repository to Vercel (or Render Starter Web Service).
   - Inject the verified environment variables into the host's encrypted secrets dashboard.
   - Deploy staging build.
4. **Step 4: Verify Public Webhook Handshake with Meta**
   - Obtain public HTTPS domain (e.g. `https://gokul-connect-staging.vercel.app`).
   - Perform automated `GET /api/webhooks/whatsapp` test simulating Meta challenge handshake.
   - Verify that test returns `HTTP 200` with the plain-text challenge.
5. **Step 5: Configure Meta Developer App Webhook**
   - Enter staging callback URL `https://gokul-connect-staging.vercel.app/api/webhooks/whatsapp` in Meta App Dashboard.
   - Enter `META_WEBHOOK_VERIFY_TOKEN`.
   - Subscribe to the `messages` field.

---

> [!NOTE]
> **Audit Status:** COMPLETE. All tasks (1–12) inspected. Production build and all 211 tests verified passing. Execution halted as required by the instruction: *"STOP after producing the report. Do not create or deploy the hosting project."*
