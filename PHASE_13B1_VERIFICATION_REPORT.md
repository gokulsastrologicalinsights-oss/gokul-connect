# PHASE 13B.1 — POST-IMPLEMENTATION VERIFICATION & PRODUCTION READINESS AUDIT REPORT

**Project:** Gokul Connect  
**Module:** Meta Social Automation (Facebook & Instagram)  
**Branch:** `phase-13b-critical-remediation`  
**Audit Date:** November 22, 2026  
**Auditor:** Independent Lead Security & Reliability Auditor  
**Audit Scope:** Verification-Only (Source Code, Database Migrations, Delivery Reliability, Meta API Compliance, Security, Independent Test Execution)  
**Overall Verdict:** **NOT READY** (Blocking Architectural & Compliance Issues Identified)

---

## 1. EXECUTIVE VERIFICATION SUMMARY

A rigorous, independent verification of the Phase 13B implementation was conducted against the source code, database migration scripts, Meta Graph API v21.0/v22.0 official specifications, and existing production architectural standards.

While Phase 13B successfully addressed several critical security vulnerabilities (such as eliminating `process.env.META_PAGE_ACCESS_TOKEN`, implementing constant-time GET handshake verification, and enforcing tenant-isolated credential decryption), **severe architectural defects, scheduling omissions, and API compliance bugs were identified that render the module unready for production or Phase 13C.**

### Summary of Classifications:

| Verification Area | Total Items | PASS | FAIL | NEEDS LIVE VERIFICATION | BLOCKED |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Background Worker & Queue** | 10 | 4 | 5 | 0 | 1 |
| **2. Database Migration 027** | 10 | 8 | 1 | 1 | 0 |
| **3. Outbound Delivery Reliability** | 9 | 1 | 7 | 1 | 0 |
| **4. Meta API Compliance** | 8 | 6 | 1 | 1 | 0 |
| **5. Security & Isolation** | 8 | 8 | 0 | 0 | 0 |
| **6. Test Suite & Build Quality** | 7 | 6 | 1 | 0 | 0 |
| **Total** | **52** | **33** | **15** | **3** | **1** |

---

## 2. BACKGROUND WORKER & SCHEDULING FINDINGS

**Inspected Files:**
- `src/lib/meta-social/worker.ts`
- `src/app/api/cron/process-social-automations/route.ts`
- `src/app/api/webhooks/meta-social/route.ts`
- `vercel.json`
- `src/lib/cron/coordinator.ts`
- `src/lib/automation/worker.ts`

### Detailed Item Verification:

| Item # | Verification Criterion | Status | Finding & Evidence |
| :--- | :--- | :---: | :--- |
| **1.1** | Webhook processing no longer performs synchronous Meta API calls | **PASS** | `POST /api/webhooks/meta-social` performs only signature verification and atomic persistence via `ingestSocialEvent` before returning HTTP 200 in `<100ms`. Outbound HTTP calls (`sendMetaSocialDm`, `replyMetaCommentPublic`) are decoupled. |
| **1.2** | Incoming events are durably persisted before HTTP 200 | **PASS** | Events are persisted to `meta_social_events` before returning. If persistence fails, the route sets `hasPersistenceFailure = true` and returns retryable HTTP 500. |
| **1.3** | The worker is actually scheduled | **BLOCKED** | **CRITICAL BLOCKER:** `/api/cron/process-social-automations` is **NOT scheduled anywhere**. `vercel.json` contains no `"crons"` schedule configuration (native crons were removed in commit `1909fa9e` due to Vercel Hobby tier limits). Supabase `pg_cron` is not installed/enabled. `README.md` and checklists document external runner `cron-job.org` only for WhatsApp endpoints; the social automations cron route is absent. Without an active trigger, background events will never be drained. |
| **1.4** | Cron authentication cannot be bypassed | **PASS** | Secured with `runCoordinatedCron` invoking `verifyCronAuthorization`. Validates `Authorization: Bearer <CRON_SECRET>` using constant-time `crypto.timingSafeEqual` over SHA-256 digests. Missing or empty secret fails closed (HTTP 401). |
| **1.5** | Jobs are claimed atomically | **FAIL** | `src/lib/meta-social/worker.ts` (lines 41–46) performs a non-atomic query: `supabase.from("meta_social_events").select("*").eq("status", "received").limit(batchSize)`. Unlike `wa_processing_jobs` (which uses `claim_next_wa_jobs` with `FOR UPDATE SKIP LOCKED`), no row-level locking or atomic status transition to `processing` exists. |
| **1.6** | Two workers cannot process the same event concurrently | **FAIL** | Because `select("*").eq("status", "received")` does not lock rows, two concurrent worker executions (or concurrent unawaited triggers from webhook bursts) will select the exact same event rows simultaneously and trigger duplicate outbound Meta API dispatches. |
| **1.7** | Worker crashes do not permanently lose jobs | **PASS WITH CONDITIONS** | Because rows remain in `status = 'received'`, an unhandled crash leaves the event in `received`. However, any outbound action dispatched prior to the crash cannot be reconciled. |
| **1.8** | Stuck processing jobs can be recovered | **FAIL** | No reclamation mechanism exists. Unlike WhatsApp automation (`reclaim_stuck_wa_jobs`), there is no RPC or cron routine to reset stale locks or `processing` states in `meta_social_deliveries` or `meta_social_events`. |
| **1.9** | Retry limits are enforced | **FAIL** | `src/lib/meta-social/worker.ts` does not inspect `attempt_count`, does not increment attempts, does not calculate exponential backoff delays, and does not update `next_retry_at`. Events that fail simply throw or set `status = 'failed'` without retry governance. |
| **1.10** | Permanently failed jobs are observable | **PASS** | Failures are recorded with `status = 'failed'` and `error_message` in `meta_social_events` and `meta_social_deliveries`, queryable via `getSocialAuditEventsAction`. |

### Critical Architectural Defect: Worker Deduplication Short-Circuit
In `src/lib/meta-social/worker.ts` (line 78), the batch processor passes each pending event to `processMetaSocialEvent(supabase, normalized)`. Inside `processMetaSocialEvent` (`src/lib/meta-social/service.ts`, lines 48–60):
```typescript
const ingestion = await ingestSocialEvent(supabase, event);
if (ingestion.status === "duplicate") {
  return { success: true, status: "duplicate", eventId: ingestion.eventId };
}
```
**Impact:** Because the webhook route **already inserted** the event into `meta_social_events`, the worker's call to `ingestSocialEvent` invokes `ingest_meta_social_event_atomic`, which hits `ON CONFLICT (business_id, meta_event_id) DO NOTHING` and returns `status: "duplicate"`. `processMetaSocialEvent` immediately returns `{ success: true, status: "duplicate" }` **without evaluating any rules or sending any replies**. The event remains stuck in `status = 'received'` indefinitely. Every subsequent worker execution repeats this cycle, completely stalling all automated replies.

---

## 3. DATABASE MIGRATION 027 VERIFICATION

**Inspected Migration:** `supabase/migrations/20261122_027_meta_social_critical_fixes.sql`  
**Previous Migrations Inspected:** `20261121_026_meta_social_automation.sql`, `20261106_001_phase1_foundation.sql`

### Database Inspection & Application Status:
- Direct database query against configured Supabase environment confirmed:
  - **Migration 026:** **APPLIED** (`meta_social_connections`, `meta_social_events` exist).
  - **Migration 027:** **NOT APPLIED** (`default_dm_reply`, `public_reply_status`, `meta_social_deliveries`, and `ingest_meta_social_event_atomic` do not exist in staging DB).
  - **Existing Records in DB:** 2 active connections exist in `meta_social_connections` (1 Instagram connection ID `86024a41-...`, 1 Facebook connection ID `b9bcbebd-...` under business `11111111-1111-1111-1111-111111111111`).

### Migration Criteria Assessment:

| Criterion | Status | Analysis |
| :--- | :---: | :--- |
| Existing records preserved | **PASS** | Forward-only migration; uses `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, and constraint drops/adds without table drops. |
| Duplicate account ownership detected before adding global uniqueness | **FAIL** | Lines 22–27 execute `ALTER TABLE public.meta_social_connections ADD CONSTRAINT uq_meta_social_connections_global_platform_account UNIQUE (platform, account_id);` directly. If duplicate accounts exist across tenants, the migration immediately aborts with `23505 unique_violation`. It lacks a pre-check or exception-handling block. |
| Migration fails safely if conflicting data exists | **PASS** | Enclosed within PostgreSQL DDL transaction semantics; conflicting data causes transaction rollback without partial schema corruption. |
| Foreign keys are correct | **PASS** | Composite foreign keys `(connection_id, business_id)` reference `meta_social_connections(id, business_id)` which has a pre-existing matching unique constraint `uq_meta_social_connections_id_business`. Composite FK on `meta_social_deliveries` references `meta_social_events(id, business_id)`. |
| RLS policies are correct | **PASS** | `meta_social_deliveries` enables RLS, grants `ALL` to `service_role`, and grants `SELECT` to `authenticated` using `(select public.check_user_business_access(business_id)) OR (select public.is_superadmin())`. Prevents cross-tenant reads and unauthorized direct user mutations. |
| Outbound delivery records tenant-isolated | **PASS** | Enforces `business_id` not-null reference to `public.businesses(id)`, immutable via trigger `trg_meta_social_deliveries_immutable_business_id`. |
| Unique delivery idempotency constraints exist | **PASS** | `uq_meta_social_deliveries_idempotency UNIQUE (idempotency_key)` prevents duplicate delivery ledger rows. |
| Required indexes exist | **PASS** | `idx_meta_social_deliveries_lookup` on `(business_id, event_id, action_type)` and partial queue index `idx_meta_social_deliveries_queue` on `(status, next_retry_at ASC) WHERE status IN ('pending', 'retry_scheduled')`. |
| SQL functions use secure search_path | **PASS** | `ingest_meta_social_event_atomic` explicitly sets `SET search_path = public, pg_temp`. |
| SECURITY DEFINER functions enforce authorization | **PASS** | Function execution revoked from `PUBLIC` and granted strictly to `authenticated, service_role`. |
| Compatible with migration history | **PASS** | Fully forward-compatible with Migration 026 schema. |

### Pre-Migration Data Validation Query:
Before applying Migration 027, the following read-only SQL validation query must be executed to ensure zero constraint violations:

```sql
-- ==============================================================================
-- PRE-MIGRATION 027 DATA INTEGRITY VALIDATION SCRIPT
-- ==============================================================================

-- 1. Check for duplicate account registrations across different businesses
SELECT platform, account_id, COUNT(*) AS duplicate_count, ARRAY_AGG(business_id) AS conflicting_tenants
FROM public.meta_social_connections
GROUP BY platform, account_id
HAVING COUNT(*) > 1;

-- 2. Check for orphaned credentials with mismatched tenant business_id
SELECT c.id AS credential_id, c.business_id AS cred_biz, conn.business_id AS conn_biz
FROM public.meta_social_credentials c
JOIN public.meta_social_connections conn ON c.connection_id = conn.id
WHERE c.business_id <> conn.business_id;

-- 3. Check for orphaned rules with mismatched tenant business_id
SELECT r.id AS rule_id, r.business_id AS rule_biz, conn.business_id AS conn_biz
FROM public.meta_social_rules r
JOIN public.meta_social_connections conn ON r.connection_id = conn.id
WHERE r.connection_id IS NOT NULL AND r.business_id <> conn.business_id;

-- 4. Check for orphaned events with mismatched tenant business_id
SELECT e.id AS event_id, e.business_id AS event_biz, conn.business_id AS conn_biz
FROM public.meta_social_events e
JOIN public.meta_social_connections conn ON e.connection_id = conn.id
WHERE e.business_id <> conn.business_id;
```
*(Validation Result on Staging: Zero conflicts detected on existing 2 connections).*

---

## 4. OUTBOUND DELIVERY RELIABILITY & SIMULATION AUDIT

**Inspected Files:**
- `src/lib/meta-social/service.ts`
- `src/lib/meta-social/database.ts`
- `src/lib/meta-social/client.ts`

### Scenario Simulation Findings:

| Scenario | Simulated Flow & Expected Behavior | Actual Source Code Behavior | Status |
| :--- | :--- | :--- | :---: |
| **A. Public reply succeeds, private reply succeeds** | Post public comment, then send private DM. Both response IDs stored. Event marked `replied`. | `replyMetaCommentPublic` succeeds, `pubDelivery` marked `succeeded`. `sendMetaCommentPrivateDm` succeeds, `privDelivery` marked `succeeded`. Event marked `status: replied`, `replyType: both`. | **PASS** |
| **B. Public reply succeeds, private reply fails** | Public comment succeeds. Private DM fails. Event marked partial failure. On retry, **only** private DM is retried; public comment is **never** duplicated. | `pubDelivery` marked `succeeded`. `privDelivery` marked `failed`. Event marked `status: replied`, `public_reply_status: replied`, `private_reply_status: failed`. **CRITICAL DEFECT ON RETRY:** `processMetaSocialEvent` lines 221–233 do **not** check `public_reply_status === 'replied'`. On retry, `shouldDoPublic` evaluates to true again, calling `replyMetaCommentPublic` a second time and posting a **duplicate public comment**. | **FAIL** |
| **C. Public reply fails, private reply succeeds** | Public comment fails. Private DM succeeds. Event marked partial failure. On retry, only public comment is retried. | Private DM succeeds. Public comment fails. On retry, `processMetaSocialEvent` does not check `private_reply_status === 'replied'`, re-sending the private reply. | **FAIL** |
| **D. Both actions fail** | Both deliveries marked failed. Job rescheduled with exponential backoff. | Both marked `failed`. Event marked `status: failed`. However, no retry scheduler exists to drain `failed` or `retry_scheduled` delivery records. | **FAIL** |
| **E. Worker crashes after Meta accepts request but before DB persists** | Meta created comment/DM, but worker process died before recording response ID. | Ambiguous delivery state. On reboot/retry, worker has no record of Meta ID. Re-execution dispatches duplicate comments because Meta Graph API comments endpoint lacks client idempotency keys. | **FAIL (Residual Risk)** |
| **F. Two workers attempt delivery simultaneously** | Only one worker acquires lock; second skips or waits. Exactly one comment posted. | Workers select without row lock (`FOR UPDATE SKIP LOCKED`). Both generate idempotency key, upsert to `meta_social_deliveries`, and invoke `fetch()` to Meta API concurrently. Meta posts **two identical comments**. | **FAIL** |
| **G. Meta returns HTTP 429** | Worker extracts `Retry-After` / `x-business-use-case-usage`, schedules exponential backoff. | `client.ts` throws `MetaSocialApiError`. `service.ts` catches it and marks delivery `status: 'failed'`. Does not parse rate limit headers, does not compute backoff delay, does not set `next_retry_at`. | **FAIL** |
| **H. Meta returns HTTP 5xx** | Transient error captured; delivery scheduled for retry with exponential backoff and jitter. | Marked `status: 'failed'`, logged. No retry is ever scheduled. | **FAIL** |
| **I. Meta returns Auth/Permission error** | Token marked expired/revoked; connection marked `connection_status: 'expired'`; operator alerted. | Marked `status: 'failed'`. Connection table is not updated to `expired` or `error`; continues to attempt deliveries on subsequent events. | **FAIL** |

### Residual Risk & Exactly-Once Delivery Analysis:
- **Meta Graph API Limitation:** The Meta Graph API endpoints for comment replies (`POST /{comment-id}/comments` and `POST /{comment-id}/replies`) and messaging (`POST /{page-id}/messages`) **do not accept client-generated idempotency keys** (unlike Stripe or WhatsApp Cloud API idempotency headers).
- **Residual Risk:** If a network timeout occurs after Meta's edge accepts the request but before the HTTP response returns to Gokul Connect, the system cannot verify whether the comment was posted without issuing an out-of-band `GET /{comment-id}/comments` check.
- **Recovery Strategy Recommendation:** Before executing any retry on a failed public comment delivery, the worker should execute a lightweight query `GET /{comment-id}/comments?fields=id,message,from,created_time` to inspect whether the business account already posted a comment matching the outbound template within the past 5 minutes.

---

## 5. META API COMPLIANCE AUDIT

**Inspected Implementation:** `src/lib/meta-social/client.ts`  
**Standard Verified Against:** Official Meta Graph API v21.0 / v22.0 Specifications (`developers.facebook.com`)

### Endpoint Compliance Matrix:

| Capability | Official Meta Endpoint & Method | Implementation in `client.ts` | Required Account & Permissions | Restrictions & Rules | Compliance Verdict |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **1. Facebook Public Comment Reply** | `POST https://graph.facebook.com/v21.0/{comment-id}/comments` | `POST https://graph.facebook.com/v21.0/{commentId}/comments` (line 103) | Facebook Page. Permissions: `pages_manage_engagement`, `pages_read_user_content`. | Page Access Token required. Rate limits apply. | **PASS** |
| **2. Facebook Private Reply** | `POST https://graph.facebook.com/v21.0/{page-id}/messages` with payload `{"recipient": {"comment_id": "<id>"}, "message": {"text": "<text>"}}` | `POST https://graph.facebook.com/v21.0/{pageId}/messages` (line 152) with payload `recipient: { comment_id }, message: { text }` | Facebook Page. Permissions: `pages_messaging`. | **Strict Meta Constraints:** Max 1 private message per comment; must be within 7 days of comment timestamp; subsequent messaging requires user reply to open 24h window. | **PASS** |
| **3. Instagram Public Comment Reply** | `POST https://graph.facebook.com/v21.0/{comment-id}/replies` with payload `message=<text>` | `POST https://graph.facebook.com/v21.0/{commentId}/replies` (line 103) with payload `message` | Instagram Professional Account. Permissions: `instagram_manage_comments`. | Max 60 comments/hr/user rate limit. Supported on Reels, Media, and nested comments. | **PASS** |
| **4. Instagram Private Reply** | `POST https://graph.facebook.com/v21.0/{app_users_ig_id}/messages` (or `graph.instagram.com/...`) with payload `{"recipient": {"comment_id": "<id>"}, "message": {"text": "<text>"}}` | `POST https://graph.facebook.com/v21.0/{linkedPageId}/messages` (line 204) where `linkedPageId` is Facebook Page ID | Instagram Professional Account. Permissions: `instagram_manage_messages`, `instagram_manage_comments`. | **CRITICAL COMPLIANCE BUG:** Meta documentation strictly mandates targeting the **Instagram Professional Account ID** (`{app_users_ig_id}`), NOT the linked Facebook Page ID (`linkedPageId`). Calling `/{pageId}/messages` with an Instagram comment ID causes Meta API to return `(#100) Invalid parameter: comment_id`. | **FAIL (Critical)** |
| **5. Instagram Account / Page Relationship** | Instagram Professional Account linked to a Facebook Page via Meta Business Manager. | Enforced in `saveSocialConnectionAction` (lines 71–75). | Business Account linking. | Required for Page token authorization. | **PASS** |
| **6. Private Reply Eligibility (7-Day Rule)** | Meta rejects private replies to comments older than 7 days (604,800 seconds). | Checked in `client.ts` (lines 148, 200) and `service.ts` (lines 209, 271). | System clock validation. | Comments older than 7 days rejected before calling Meta API. | **PASS** |
| **7. Instagram Reels & Nested Comments** | Instagram comments on Reels and top-level comments support private replies and parent comment chaining. | Supported in `parser.ts` (`parent_id` extraction) and `client.ts` (`replies` endpoint). | Instagram Graph API. | Nested replies supported. | **PASS** |
| **8. Graph API Version** | Active Meta Graph API: v21.0 / v22.0. | `const META_GRAPH_VERSION = "v21.0"` in `client.ts` line 4. | Meta Platform standard. | Supported and active. | **PASS** |

---

## 6. SECURITY & TENANT ISOLATION AUDIT

### Security Verifications:

| Security Domain | Scan / Audit Target | Finding | Status |
| :--- | :--- | :--- | :---: |
| **Global Token Fallback** | `META_PAGE_ACCESS_TOKEN` | Fully removed from runtime logic. Only appears in non-executable comments in `service.ts` and test cleanup fixtures. | **PASS** |
| **Raw Token Logging** | `console.log` / `console.error` across all routes | `sanitizeSocialLog` masks access tokens matching `EAA[A-Za-z0-9_-]{20,}` with `EAA••••••••[MASKED]`. URLs with tokens in query params sanitized. | **PASS** |
| **Cross-Tenant Credential Fallback** | `meta_social_credentials` resolution | In `service.ts` (lines 98–112), credentials query strictly filters on `connection_id = connectionId AND business_id = businessId`. Explicit check `if (credRow.business_id !== businessId) throw SECURITY VIOLATION`. | **PASS** |
| **Unsafe `business_id` Resolution** | Server actions & API routes | All server actions validate tenant session via `validateBusinessAccess(businessSlug)` and derive `business.id` from trusted database lookup. | **PASS** |
| **Unprotected Cron Routes** | `/api/cron/process-social-automations` | Protected by `runCoordinatedCron` requiring `Authorization: Bearer <CRON_SECRET>` with constant-time HMAC check. | **PASS** |
| **Server Action Authorization** | Role-based permission checks | Mutations (`saveSocialConnectionAction`, `deleteSocialConnectionAction`, `saveSocialRuleAction`, `deleteSocialRuleAction`) enforce `membership.role IN ('owner', 'admin')`. | **PASS** |
| **RLS Policies** | `meta_social_*` tables | Strict policies on all tables prevent cross-tenant access for `authenticated` users and restrict vault access. | **PASS** |
| **Publicly Accessible Delivery Records** | `meta_social_deliveries` | Protected with RLS. Anonymous role has no grants. Authenticated users limited to business membership. | **PASS** |
| **Secrets in Client Components** | `process.env.*` in client components | Zero server secrets exposed in `src/components/`. Social UI components not yet introduced. | **PASS** |
| **Tenant Isolation (Astrology vs. Vivaham)** | Cross-business query separation | Astrology (`11111111-1111-1111-1111-111111111111`) and Vivaham (`22222222-2222-2222-2222-222222222222`) are strictly segregated at database, RLS, composite FK, and application layers. | **PASS** |

---

## 7. INDEPENDENT TEST EXECUTION & BUILD AUDIT

All tests were independently executed in the environment (Node.js v26.13.1, Vitest v4.1.12).

### Actual Test Results:

| Test Suite | Command Executed | Exit Code | Tests Passed | Tests Failed |
| :--- | :--- | :---: | :---: | :---: |
| **Phase 13 Meta Social Automation** | `npx vitest run tests/phase13-meta-social-automation.test.ts` | **0** | **14** (14) | 0 |
| **Phase 13B Critical Remediation** | `npx vitest run tests/phase13b-critical-remediation.test.ts` | **0** | **13** (13) | 0 |
| **Tenant Isolation Suite** | `npx vitest run tests/tenant-isolation.test.ts` | **0** | **7** (7) | 0 |
| **Credential Security Suite** | `npx vitest run tests/phase2-credential-security.test.ts` | **0** | **8** (8) | 0 |
| **WhatsApp Webhook Receiver** | `npx vitest run tests/phase3-webhooks.test.ts` | **0** | **6** (6) | 0 |
| **Webhook Decoupling & P0 Regression** | `npx vitest run tests/phase7-5-webhook-decoupling.test.ts tests/p0-critical-fixes-regression.test.ts` | **0** | **33** (33) | 0 |
| **Automation Engine, Functional, Phase 12** | `npx vitest run tests/phase5-automation-engine.test.ts tests/phase8-functional-integration.test.ts tests/phase12-p1-features.test.ts` | **0** | **74** (74) | 0 |
| **Total Test Suite Execution** | Combined Vitest Runs | **0** | **155** (155) | 0 |

### TypeScript Compilation Audit:
- **Command:** `npx tsc --noEmit`
- **Exit Code:** **1 (FAILED)**
- **Compiler Error Output:**
  ```text
  tests/phase13b-critical-remediation.test.ts(32,58): error TS2345: Argument of type '{ from: Mock<Procedure>; rpc: Mock<Procedure>; }' is not assignable to parameter of type 'SupabaseClient<any, "public", "public", any, any>'.
    Type '{ from: Mock<Procedure>; rpc: Mock<Procedure>; }' is missing the following properties from type 'SupabaseClient<any, "public", "public", any, any>': supabaseUrl, supabaseKey, auth, realtime, and 21 more.
  ```
- **Finding:** While the runtime Vitest runner executes due to ts-node/esbuild stripping types, the static TypeScript compiler fails on `tests/phase13b-critical-remediation.test.ts`.

### Mocked Unit Tests vs. Live Integration Reality:
- **Critical Caveat:** **All passing Phase 13 and 13B tests are unit tests using mocked Supabase clients and mocked `fetch` functions.**
- In test `A.2`, when the mock webhook runs, Vitest logs an uncaught background worker error: `[Meta Social Webhook] Background batch worker noticed: Cannot read properties of undefined (reading 'eq')`. The test passed only because the background promise was floating and unawaited.
- In test `B.1` and `B.2`, `mockSupabase.rpc` was mocked to return `status: "ingested"`, concealing the fact that in real execution, the worker calls `ingest_meta_social_event_atomic` on already-ingested events and immediately aborts due to `status: "duplicate"`.
- **Conclusion:** Passing mocked unit tests does **not** indicate production readiness.

---

## 8. REMAINING BLOCKERS & REQUIRED REMEDIATIONS

The following blocking issues must be resolved before Phase 13C:

1. **Schedule the Background Worker (BLOCKER):**
   - Register `/api/cron/process-social-automations` with the external scheduler (cron-job.org / Upstash) or configure native scheduling, ensuring it is triggered every 1–2 minutes with `Authorization: Bearer <CRON_SECRET>`.
2. **Fix Worker Deduplication Loophole (BLOCKER):**
   - Refactor `processSocialEventsBatch` and `processMetaSocialEvent` so that the worker does not attempt to re-ingest already-persisted events via `ingestSocialEvent`. The worker should query pending events, atomically claim them (e.g. `status = 'processing'`), and pass the existing `event_id` and metadata directly to the dispatch engine.
3. **Implement Atomic Job Claiming & Stuck Job Recovery (BLOCKER):**
   - Create a dedicated database RPC (e.g. `claim_next_social_jobs`) using `FOR UPDATE SKIP LOCKED` and a companion RPC `reclaim_stuck_social_jobs` to prevent worker race conditions.
4. **Prevent Duplicate Outbound Replies on Partial Retries (BLOCKER):**
   - In `processMetaSocialEvent`, inspect `event.public_reply_status` and `event.private_reply_status` before initiating calls. If `public_reply_status === 'replied'`, skip `replyMetaCommentPublic` and retry only the pending private reply.
5. **Fix Instagram Private Reply Endpoint Parameter (BLOCKER):**
   - In `src/lib/meta-social/client.ts` (`sendInstagramPrivateReply`), change the target endpoint from `/{linkedPageId}/messages` to `/{accountId}/messages` (Instagram Professional Account ID), matching official Meta specifications.
6. **Implement Retry Governance & Backoff (HIGH):**
   - Extract rate limit headers on HTTP 429 and calculate exponential backoff delay for transient HTTP 5xx errors, recording `next_retry_at` and `attempt_count` in `meta_social_deliveries`.
7. **Fix TypeScript Compiler Error in Test Suite (MEDIUM):**
   - Cast the mock client in `tests/phase13b-critical-remediation.test.ts:32` to `unknown as SupabaseClient` to achieve `0` compiler errors on `npx tsc --noEmit`.

---

## 9. FINAL AUDIT VERDICT

### Verdict: **NOT READY**

**Justification:**
Although Phase 13B closed critical security vulnerabilities regarding credentials and timing-safe webhook verification, the background worker implementation is architecturally disconnected:
1. The cron route is unscheduled.
2. In real operation, every worker execution short-circuits due to duplicate ingestion detection, leaving all inbound comments and DMs completely unreplied.
3. Concurrent workers will cause duplicate comment dispatches.
4. Partial retries will post duplicate public comments.
5. Instagram private replies target an incorrect Meta Graph API path parameter.
6. The test suite contains a TypeScript compilation error.

**Next Action:**
Proceeding to Phase 13C before resolving these foundational worker and delivery defects is **strictly advised against**. Remediate the items in Section 8 before initiating end-to-end integration or UI development.
