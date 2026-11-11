# Phase 11.2 — Independent Security Audit Report

**Project:** Gokul Connect (`E:\GAI\Whatsapp Automation`)  
**Audit Date:** `2026-11-07`  
**Auditor:** Independent Security & Quality Engineering Lead  
**Audit Scope:** Full Application Security Review (Auth, Multi-Tenant Isolation, RLS, Cryptography, Webhooks, Automations, CRM, Analytics, Templates, APIs, Server Actions, Dependencies)  
**Classification Standard:** OWASP ASVS 4.0 / CWE / CVSS v3.1  
**Overall Security Posture:** **STRONG (PRODUCTION CANDIDATE WITH MINOR HARDENING)**  

---

## 1. Executive Summary

A comprehensive, read-only security audit of the complete Gokul Connect application was performed across all 14 designated security and architecture domains. The codebase demonstrates high defensive engineering standards, including:

- **Strict Multi-Tenant Separation:** Zero cross-tenant data leakage between Astrology (`astrology`) and Vivaham (`vivaham`) workspaces across all tables, server actions, and client layouts.
- **Fail-Closed Cryptography:** Timing-safe HMAC-SHA256 signature verification for Meta webhooks and constant-time Bearer token authorization for cron workers.
- **Envelope Encryption Vault:** AES-256-GCM authenticated encryption with 12-byte cryptographically random IVs and 16-byte authentication tags for stored Meta access tokens.
- **Zero Secret Exposure:** Zero secrets, service-role keys, or access tokens are present in client-side bundles or application error logs.
- **Least-Privilege Database Architecture:** All queue and webhook procedures run as `SECURITY DEFINER` with explicit `search_path = public, pg_temp` and have `PUBLIC`, `anon`, and `authenticated` roles revoked, granting access strictly to `service_role`.
- **Zero Package Vulnerabilities:** `npm audit` reports **0 vulnerabilities**.

### Summary of Audit Findings

| Severity | Count | Status | Summary |
|---|---|---|---|
| **CRITICAL** | 0 | None | Zero critical vulnerabilities identified. |
| **HIGH** | 0 | None | Zero high-severity vulnerabilities identified. |
| **MEDIUM** | 2 | Actionable | SEC-MED-01: Missing authorization guard on `triggerQueueWorkerAction`.<br>SEC-MED-02: CSV Formula Injection risk in CRM contact export. |
| **LOW** | 2 | Actionable | SEC-LOW-01: Template existence/approval validation in `sendWhatsAppMessageService` relies solely on Meta Cloud API.<br>SEC-LOW-02: Deterministic dev key fallback in `encryption.ts` when `APP_ENCRYPTION_SECRET` is unset. |
| **INFORMATIONAL** | 1 | Advisory | SEC-INFO-01: In-memory sliding window rate limiter is single-process (recommend Redis/Upstash for multi-region clustering in Phase 12). |

---

## 2. In-Depth Domain Review & Verification Results

### Domain 1: Authentication & Session Management
- **Implementation Inspected:** `src/app/actions/auth.ts`, `src/lib/auth/tenant-guard.ts`, `src/app/(auth)/*`, `src/app/auth/callback/route.ts`.
- **Brute-Force Protection:** Enforces sliding-window rate limit of 5 login attempts per 60 seconds per email (`rateLimitLogin`). Blocks subsequent attempts for 60 seconds.
- **Password Strength:** Rejects passwords under 8 characters in server action `updatePasswordAction`.
- **Mandatory Password Change:** `must_change_password` flag in user metadata is strictly enforced in `validateBusinessAccess` across all workspace layouts, server actions, and dashboard routes, immediately redirecting to `/update-password?mandatory=true`.
- **Sign Out & Invalidation:** `handleSignOut` executes `supabase.auth.signOut()` and explicitly zeroes out all `sb-*`, `auth`, and `token` cookies with expired timestamps.
- **Open Redirect Guard:** `src/app/auth/callback/route.ts` strictly validates the `next` parameter (`next.startsWith("/") && !next.startsWith("//")`), eliminating open redirect attacks.
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 2: Business-Level Tenant Isolation
- **Implementation Inspected:** `src/lib/auth/tenant-guard.ts`, `src/types/database.ts`, `tests/phase11-2-security-integration-audit.test.ts`.
- **Astrology vs. Vivaham Boundary:** Verified via live PGlite sandboxing and database queries that queries scoped to `ASTROLOGY_BUSINESS_ID` return 0 rows for `VIVAHAM_BUSINESS_ID`.
- **URL Tampering Defense:** If an Astrology user manipulates the URL to `/workspace/vivaham`, `validateBusinessAccess` checks the authenticated session's `business_members` record and redirects to `/select-business?error=unauthorized_business_access`.
- **Immutability Triggers:** Database triggers (`prevent_business_id_tamper`) prevent updating `business_id` on existing rows.
- **Client Cache Flush:** Switching businesses invokes `SwitchBusinessButton`, which clears client-side cache before navigating to the new workspace.
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 3: Supabase RLS Policies & Database Functions
- **Implementation Inspected:** Migrations 001–015 in `supabase/migrations/`.
- **Table Coverage:** Row Level Security (RLS) is enabled on 100% of multi-tenant tables:
  - `businesses`, `business_members`, `user_profiles`
  - `wa_connections`, `wa_credentials`
  - `wa_contacts`, `wa_conversations`, `wa_messages`
  - `wa_webhook_events`, `wa_processing_jobs`
  - `wa_automation_rules`, `wa_automation_execution_logs`
  - `wa_message_templates`, `crm_categories`, `crm_segments`, `contact_notes`
- **Security Definer Function Privileges:**
  - `claim_next_wa_jobs(int, text)`: `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT TO service_role;` (Migration 011).
  - `reclaim_stuck_wa_jobs(int)`: `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT TO service_role;` (Migration 011).
  - `ingest_wa_inbound_message_v2(...)`: `REVOKE ALL FROM PUBLIC, anon, authenticated; GRANT TO service_role;` (Migration 010).
  - `search_path` is explicitly locked to `public, pg_temp` on all procedures, eliminating Trojan schema attacks.
- **Analytics Functions:**
  - `get_business_analytics_summary` and `get_business_analytics_daily_trends` are `SECURITY INVOKER`, explicitly enforce `check_user_business_access(p_business_id)`, and revoke PUBLIC execution.
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 4: WhatsApp Credential Encryption & Secret Handling
- **Implementation Inspected:** `src/lib/crypto/encryption.ts`, `src/lib/whatsapp/client.ts`.
- **Cipher Suite:** Authenticated AES-256-GCM.
- **IV Generation:** Cryptographically strong 12-byte random IV (`crypto.randomBytes(12)`) per encryption call (NIST SP 800-38D compliant).
- **Authentication Tag:** 16-byte authentication tag verified prior to ciphertext decryption; tampered ciphertext or tags are immediately rejected.
- **Logging Sanitization:** `maskTokenForLogging` masks tokens (`EAAX••••1234`). `sanitizeMetaLog` scrubs `EAA...` token patterns from all log statements and error messages.
- **Browser Bundle Inspection:** AST inspection and comprehensive regex search of `.next/static` confirmed **zero server secrets, zero service role keys, and zero Meta tokens** in client bundles.
- **Verdict:** **PASSED with 1 LOW finding (SEC-LOW-02)**.

---

### Domain 5: Meta Webhook Signature Validation
- **Implementation Inspected:** `src/lib/whatsapp/crypto-signature.ts`, `src/app/api/webhooks/whatsapp/route.ts`.
- **Timing-Safe Comparison:** Compares HMAC-SHA256 digests using `crypto.timingSafeEqual` after verifying buffer lengths, preventing timing side-channel attacks.
- **Fail-Closed Architecture:** If `META_APP_SECRET` is unset or empty, the webhook immediately logs an error and returns HTTP 500 without processing any incoming events.
- **Tamper Rejection:** Unsigned or tampered payloads return HTTP 401.
- **Abuse Rate Limiting:** Callers with invalid signatures are throttled via `rateLimitInvalidWebhookSignatures` (10 failures in 60s locks IP for 5 minutes).
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 6: Outbound Messaging & Queue Processing
- **Implementation Inspected:** `src/lib/whatsapp/service.ts`, `src/lib/automation/worker.ts`, `src/app/api/cron/process-automation-jobs/route.ts`.
- **Decoupled Architecture:** Inbound webhooks persist events and enqueue `evaluate_automation_rules` jobs in <1ms without synchronous outbound HTTP calls.
- **Concurrency & Locking:** Queue workers claim batches using `FOR UPDATE SKIP LOCKED`, preventing race conditions and double-processing by parallel workers.
- **Idempotency Guarantees:** Database constraint `uq_wa_processing_jobs_idempotency` ensures that `inbound_eval_${meta_message_id}` can only be enqueued once. Duplicate webhook deliveries return HTTP 200 with status `duplicate`.
- **Exponential Backoff:** Failed jobs retry with exponential backoff: `delay = (2^attempts * 30s) + jitter (0-5s)` up to `max_attempts = 5`.
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 7: Automation Execution Safeguards
- **Implementation Inspected:** `src/lib/automation/safeguards.ts`.
- **7-Point Pre-Execution Validation Gate:** Validates live state right before dispatching scheduled follow-ups:
  1. *Gate 1 (Opt-Out):* Blocks if contact is opted out (`contact.is_opted_out = true`).
  2. *Gate 2 (Tenant Ownership):* Blocks if `job.business_id !== conversation.business_id`.
  3. *Gate 3 (Customer Reply):* Blocks obsolete follow-up if customer messaged after job was scheduled.
  4. *Gate 4 (Human Takeover):* Blocks if conversation status is `pending_human` or automation is paused.
  5. *Gate 5 (24h Service Window):* Blocks free-form text if >24h elapsed since last inbound message.
  6. *Gate 6 (Workspace Status):* Blocks if automations are disabled or rule is inactive.
  7. *Gate 7 (Approved Template):* Blocks if template status is not `APPROVED`.
- **Circuit Breaker:** Rolling 15-minute window trips if bot sends >5 replies, preventing bot-to-bot infinite loops.
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 8: CRM & Contact Management
- **Implementation Inspected:** `src/app/actions/crm.ts`, `src/lib/crm/database.ts`, `src/lib/crm/store.ts`.
- **Tenant Scoping:** All contact lookups, creations, updates, notes, and saved segments are strictly bound to `business.id`.
- **Phone Normalization:** Strips all non-digit formatting characters.
- **Duplicate Prevention:** Unique constraint `(business_id, phone_number)` prevents duplicate contacts within a business.
- **RBAC Enforcement:** Non-managerial roles (`agent`) can view contacts, create contacts, and add notes, but cannot delete saved segments or manage categories.
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 9: Analytics & CSV Exports
- **Implementation Inspected:** `src/app/api/workspace/[businessSlug]/analytics/route.ts`, `src/lib/analytics/service.ts`, `src/lib/crm/database.ts`.
- **Timezone Safety:** All date filtering uses `Asia/Kolkata` (IST, UTC+05:30) date boundaries.
- **Tenant Scope:** Analytics queries execute through `get_business_analytics_summary`, strictly filtering by `p_business_id`.
- **CSV Isolation:** CSV exports contain UTF-8 BOM (`\uFEFF`) and only include records belonging to the authenticated tenant.
- **Formula Injection Audit:** Identified that cell values starting with formula characters (`=`, `+`, `-`, `@`) are wrapped in quotes but not prefixed with `'` (Finding SEC-MED-02).
- **Verdict:** **PASSED with 1 MEDIUM finding (SEC-MED-02)**.

---

### Domain 10: Template Management After Migration 015
- **Implementation Inspected:** Migration 015, `src/lib/templates/database.ts`, `src/lib/templates/variable-engine.ts`.
- **Status Constraints:** Database check constraint enforces valid statuses: `APPROVED`, `PENDING`, `REJECTED`, `PAUSED`, `DISABLED`, `DRAFT`, `ARCHIVED`.
- **Draft Preservation:** During Meta WABA synchronization, existing local drafts (`status = 'DRAFT'`) are preserved and never overwritten.
- **Variable Engine:** Detects and rejects malformed placeholders (`{{}}`, `{{abc}}`, `{1}`), non-sequential variables, and unresolved variables.
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 11: Inbox & Approved-Template Integration
- **Implementation Inspected:** `src/app/actions/inbox.ts`, `src/components/inbox/ChatWindowPanel.tsx`.
- **Template Eligibility:** Inbox template selector queries `getApprovedTemplatesDb`, which filters strictly by `status = 'APPROVED'` and `includeArchived = false`.
- **24-Hour Policy Compliance:** Free-form text is blocked when the 24-hour service window is closed; only approved templates can be dispatched to re-open customer conversations.
- **Verdict:** **PASSED with 1 LOW finding (SEC-LOW-01)**.

---

### Domain 12: API Routes & Server Actions Authorization
- **Implementation Inspected:** All files in `src/app/actions/` and `src/app/api/`.
- **Session Verification:** `validateBusinessAccess` validates active sessions and business memberships on all workspace actions.
- **Audit Discovery (SEC-MED-01):** `triggerQueueWorkerAction()` in `src/app/actions/automations.ts` is an exported server action that lacks an authentication or role check.
- **Verdict:** **PASSED with 1 MEDIUM finding (SEC-MED-01)**.

---

### Domain 13: Rate Limiting & Denial-of-Service Defense
- **Implementation Inspected:** `src/lib/rate-limit/rate-limiter.ts`.
- **Coverage:**
  - Login attempts: 5 per 60s per email.
  - Outbound messaging: 30 per 60s per business.
  - Sensitive workspace actions: 15 per 60s per business.
  - Webhook GET handshake: 30 per 60s per IP.
  - Invalid webhook signatures: 10 per 60s locks IP for 5 minutes.
- **Verdict:** **PASSED (SECURE)**.

---

### Domain 14: Dependency & Build Security
- **Implementation Inspected:** `package.json`, `package-lock.json`, Next.js build output.
- **Vulnerability Audit:** `npm audit` reports **0 vulnerabilities**.
- **Overrides:** Secure overrides configured for `tinypool`, `postcss`, `vite`, `esbuild`, and `@vitest/mocker`.
- **TypeScript:** `npx tsc --noEmit` completes with **0 errors**.
- **Production Build:** Clean production build (`next build`) without warnings or security flags.
- **Verdict:** **PASSED (SECURE)**.

---

## 3. Detailed Vulnerability Findings

### Finding SEC-MED-01: Unprotected Server Action `triggerQueueWorkerAction`
- **Severity:** **MEDIUM** (CVSS: 5.3 — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N`)
- **Location:** `src/app/actions/automations.ts` (lines 269–276)
- **Description:** `triggerQueueWorkerAction` is exported with `"use server"` without session validation or role authorization:
  ```ts
  export async function triggerQueueWorkerAction(): Promise<{ success: boolean; data?: ProcessQueueResult; error?: string }> {
    try {
      const result = await processQueueBatch(10, `manual_${Date.now()}`);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message || "Queue worker run failed" };
    }
  }
  ```
- **Impact:** An unauthenticated actor could invoke this server action via HTTP POST to trigger premature processing of due queue jobs.
- **Defensive Remediation Proposed:** Add session validation verifying that caller is an authenticated superadmin or authorized business owner.

---

### Finding SEC-MED-02: CSV Formula Injection (CWE-1236) in Contact Export
- **Severity:** **MEDIUM** (CVSS: 4.8 — `CVSS:3.1/AV:N/AC:L/PR:H/UI:R/S:U/C:L/I:L/A:N`)
- **Location:** `src/lib/crm/database.ts` (lines 1240–1244)
- **Description:** `exportContactsToCsvString` escapes double quotes, but does not sanitize leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`):
  ```ts
  const escapeCsv = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };
  ```
- **Impact:** If an untrusted contact enters a name such as `=CMD|' /C calc'!A0`, opening the exported CSV in Microsoft Excel or Google Sheets could execute formulas.
- **Defensive Remediation Proposed:** Prepend a single quote (`'`) to any cell whose first character is `=`, `+`, `-`, `@`, `\t`, or `\r`.

---

### Finding SEC-LOW-01: Defense-in-Depth Validation for Template Names in Outbox Dispatch
- **Severity:** **LOW** (CVSS: 2.7)
- **Location:** `src/lib/whatsapp/service.ts` (line 309)
- **Description:** `sendWhatsAppMessageService` relies on Meta Cloud API to reject unapproved templates. It does not check whether `template.name` is in `APPROVED` status in `wa_message_templates` in the database.
- **Impact:** Meta API rejects invalid templates, but a defense-in-depth database check would reject them before calling Meta.
- **Defensive Remediation Proposed:** Query `wa_message_templates` for `business_id` and ensure `status = 'APPROVED'` and `is_archived = false` prior to API invocation.

---

### Finding SEC-LOW-02: Deterministic Development Key Fallback in `encryption.ts`
- **Severity:** **LOW** (CVSS: 2.1)
- **Location:** `src/lib/crypto/encryption.ts` (lines 37–39)
- **Description:** If `APP_ENCRYPTION_SECRET` is unset, `encryption.ts` falls back to `DEV_KEY_SEED`.
- **Impact:** In development this enables offline operation, but if deployed to production without `APP_ENCRYPTION_SECRET`, it would use a known static key.
- **Defensive Remediation Proposed:** Throw an explicit configuration error if `NODE_ENV === 'production'` and `process.env.APP_ENCRYPTION_SECRET` is not configured.

---

## 4. Conclusion & Sign-Off

The Gokul Connect application exhibits **robust multi-tenant isolation, fail-closed cryptographic defenses, and clean least-privilege database controls**. The four identified findings are non-critical and have well-defined, minimally invasive remediations.

**Audit Status:** **AUDIT COMPLETE — READY FOR REMEDIATION REVIEW PRIOR TO PHASE 12**.
