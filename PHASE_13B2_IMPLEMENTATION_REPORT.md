# PHASE 13B.2 — CRITICAL WORKER, QUEUE & DELIVERY RELIABILITY FIXES REPORT
## Gokul Connect | Facebook & Instagram Meta Social Automation

**Project:** Gokul Connect  
**Module:** Facebook & Instagram Meta Social Automation  
**Branch:** `phase-13b-critical-remediation`  
**Implementation Date:** November 22, 2026  
**Role:** Senior Distributed Systems Architect, PostgreSQL Engineer & Meta Graph API Specialist  
**Status:** Complete — All Critical Findings Remediated, Verified, and Regression Tested (Exit Code 0)

---

## 1. EXECUTIVE SUMMARY

Phase 13B.2 has resolved all critical architectural deficiencies, API compliance flaws, scheduling omissions, and concurrency hazards identified in the Phase 13B.1 Independent Audit (`PHASE_13B1_VERIFICATION_REPORT.md`).

### Critical Problems Remediated:
1. **Worker Deduplication Short-Circuit (Task 1):** In Phase 13B, `worker.ts` invoked `processMetaSocialEvent()`, which re-ingested already-persisted events via `ingestSocialEvent()`. The database RPC returned `status: duplicate`, prematurely halting processing and leaving events in `received` indefinitely. We have completely decoupled ingestion (`ingestMetaSocialWebhookEvent()`) from execution (`processPersistedMetaSocialEvent()`). The worker now directly processes persisted event IDs without re-ingestion.
2. **Atomic Worker Claiming with `FOR UPDATE SKIP LOCKED` (Task 2):** Eliminated race conditions where two concurrent workers could select and dispatch the same pending event. Created migration `20261122_028_meta_social_worker_reliability.sql` introducing `claim_meta_social_events()`, which atomically transitions events to `processing`, stamps `claimed_by` and `lease_expires_at`, and prevents duplicate dispatches.
3. **Delivery Idempotency & Partial Retries (Task 3):** Fixed the bug where a failed private reply caused public comment duplication upon retry. Outbound dispatches are now tracked as independent operations (`public_comment_reply` vs. `private_comment_reply`). If `public_reply_status === 'replied'`, the public comment is skipped and only the failed private reply is retried.
4. **Ambiguous Outcome Handling & Reconciliation (Task 3):** Handled unconfirmed edge network timeouts by marking deliveries as `ambiguous_outcome` rather than blindly repeating public comments. Implemented `checkCommentReplied()` querying Meta Graph API comments to reconcile state prior to retries.
5. **Retry Governance & Crash Recovery (Task 4):** Implemented exponential backoff with random jitter, HTTP 429 `Retry-After` header extraction, classification of transient HTTP 5xx errors vs. permanent permission errors, automatic connection expiration on OAuth 190 token revocation, bounded processing leases, and a stuck-job reaper (`reclaim_stuck_meta_social_events()`).
6. **External Cron Scheduling Architecture (Task 5):** Configured and documented external cron runner architecture (`cron-job.org`) calling `/api/cron/process-social-automations` every 1–2 minutes with `Authorization: Bearer <CRON_SECRET>` and distributed locking (`runCoordinatedCron`), matching project standards and Vercel Hobby tier constraints.
7. **Instagram Private Reply Endpoint Path Correction (Task 6):** Independently verified official Meta Graph API specifications. Fixed `sendInstagramPrivateReply` to target the **Instagram Professional Account ID** (`POST https://graph.facebook.com/v21.0/{instagramAccountId}/messages`), eliminating the `(#100) Invalid parameter: comment_id` error caused by erroneously targeting `/{linkedPageId}/messages`.
8. **TypeScript Compiler Type Error Fix (Task 7):** Fixed the mock type mismatch in `tests/phase13b-critical-remediation.test.ts:32` without disabling strict checks or using `any` hacks. Static TypeScript compilation (`npx tsc --noEmit`) passes with exit code 0.
9. **Observability & Log Sanitization (Task 8):** Added structured logging and operational metrics reporting for events (received, processing, succeeded, failed, retried, ambiguous) and deliveries, while guaranteeing zero exposure of access tokens or secrets.
10. **Full Regression Validation (Task 10):** All 42 social automation tests passed, and all 55 test suites (839/839 tests across the entire repository) passed with exit code 0.

---

## 2. FILES MODIFIED & CREATED

### Modified Source Files:
1. `src/lib/meta-social/types.ts`:
   - Added statuses to `MetaSocialEventStatus`: `'processing' | 'retry_scheduled' | 'permanently_failed' | 'ambiguous_outcome'`.
   - Added `'ambiguous_outcome'` to `MetaSocialDeliveryStatus`.
   - Added lease, worker identification, attempt tracking, and retry fields (`claimed_by`, `claimed_at`, `lease_expires_at`, `attempt_count`, `max_attempts`, `next_retry_at`) to `MetaSocialEvent` and `MetaSocialDelivery`.
   - Added `SocialOperationalMetrics` interface.
2. `src/lib/meta-social/client.ts`:
   - Enhanced `MetaSocialApiError` with detailed classifications: `httpStatus`, `retryAfterSeconds`, `isRateLimit`, `isTransient`, `isAuthError`, `isPermanentPermissionError`, `isAmbiguous`.
   - Extracted and parsed HTTP `Retry-After` headers.
   - Fixed `sendInstagramPrivateReply()`: targets `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${instagramAccountId}/messages` using the Instagram Professional Account ID.
   - Maintained dedicated `sendFacebookPrivateReply()` targeting `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${pageId}/messages`.
   - Enhanced `sendMetaCommentPrivateDm()` to route based on platform and comment ID.
   - Added `checkCommentReplied()` for out-of-band reconciliation of ambiguous deliveries.
   - Hardened `sanitizeSocialLog()` to mask access tokens (`EAA••••••••[MASKED]`) and Bearer tokens (`Bearer [MASKED]`).
3. `src/lib/meta-social/database.ts`:
   - Implemented `claimSocialEvents()`: executes atomic RPC `claim_meta_social_events` using `FOR UPDATE SKIP LOCKED`.
   - Implemented `reclaimStuckSocialEvents()`: executes `reclaim_stuck_meta_social_events` to recover expired leases and transition exhausted jobs to `permanently_failed`.
   - Added `getSocialEventById()` and `getSocialDeliveryByIdempotencyKey()`.
   - Updated `updateSocialDeliveryResult()` and `updateSocialEventResult()` to support retry governance, attempt counts, and `ambiguous_outcome` states.
   - Implemented `getSocialOperationalMetrics()` for real-time observability telemetry.
4. `src/lib/meta-social/service.ts`:
   - Separated ingestion (`ingestMetaSocialWebhookEvent`) from persisted event execution (`processPersistedMetaSocialEvent`).
   - Implemented independent action-level processing in `processPersistedMetaSocialEvent`: public comment replies and private DMs check their respective delivery states independently.
   - Partial retry guarantee: skips already-succeeded actions (`public_reply_status === 'replied'`) and executes only pending/failed actions.
   - Handled `ambiguous_outcome` outcomes with automated reconciliation via `checkCommentReplied()`.
   - Implemented `computeBackoffDelay()` for exponential backoff with jitter.
   - Preserved backward-compatible `processMetaSocialEvent()` wrapper for end-to-end processing.
5. `src/lib/meta-social/worker.ts`:
   - Refactored `processSocialEventsBatch()` to claim events atomically via `claimSocialEvents()`.
   - Directly executes `processPersistedMetaSocialEvent()`, completely eliminating duplicate ingestion crashes.
   - Runs `reclaimStuckSocialEvents()` prior to claiming new batches.
   - Emits structured, sanitized operational logs containing Event ID, Business ID, Platform, Action Type, and duration.
6. `src/app/api/cron/process-social-automations/route.ts`:
   - Added support for configurable `?batch_size=` query parameter (bounded between 1 and 50).
   - Returns sanitized operational telemetry without leaking secrets.
7. `tests/phase13b-critical-remediation.test.ts`:
   - Fixed TypeScript TS2345 compiler error on line 32 using properly typed `ReturnType<typeof admin.createAdminClient>`.
8. `README.md`:
   - Added `/api/cron/process-social-automations` to the scheduled endpoints table with interval (every 1–2 minutes), authorization header, and execution parameters.

### Newly Created Files:
1. `supabase/migrations/20261122_028_meta_social_worker_reliability.sql`:
   - Forward-only, idempotent migration adding lease fields, status constraint expansions, queue indexes, `claim_meta_social_events()`, and `reclaim_stuck_meta_social_events()`.
2. `tests/phase13b2-critical-worker-fixes.test.ts`:
   - Dedicated 15-test test suite covering all Phase 13B.2 domains (15/15 passing).

---

## 3. DATABASE MIGRATION 028

**File:** `supabase/migrations/20261122_028_meta_social_worker_reliability.sql`  
**Safety:** Forward-only, non-destructive, enclosed in transactions, idempotent.

### Schema Changes:
1. **Status Constraints:**
   - `meta_social_events.status` expanded to include: `'received'`, `'processing'`, `'processed'`, `'replied'`, `'failed'`, `'retry_scheduled'`, `'permanently_failed'`, `'ambiguous_outcome'`, `'ignored'`.
   - `meta_social_deliveries.status` expanded to include: `'pending'`, `'processing'`, `'succeeded'`, `'failed'`, `'retry_scheduled'`, `'permanently_failed'`, `'ambiguous_outcome'`.
2. **Lease & Retry Columns:**
   - Added to `meta_social_events`: `claimed_by TEXT`, `claimed_at TIMESTAMPTZ`, `lease_expires_at TIMESTAMPTZ`, `attempt_count INT DEFAULT 0`, `max_attempts INT DEFAULT 3`, `next_retry_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`.
   - Added to `meta_social_deliveries`: `claimed_by TEXT`, `claimed_at TIMESTAMPTZ`, `lease_expires_at TIMESTAMPTZ`.
3. **Queue Indexes:**
   - `idx_meta_social_events_claim_queue` on `(status, created_at ASC) WHERE status IN ('received', 'retry_scheduled', 'processing')`.
   - `idx_meta_social_events_retry` on `(status, next_retry_at ASC) WHERE status = 'retry_scheduled'`.
   - `idx_meta_social_deliveries_retry` on `(status, next_retry_at ASC) WHERE status IN ('pending', 'retry_scheduled', 'processing')`.
4. **PostgreSQL RPCs:**
   - `public.claim_meta_social_events(p_worker_id TEXT, p_batch_size INT, p_lease_seconds INT)`:
     Uses `FOR UPDATE SKIP LOCKED` inside a single atomic CTE statement. Locks eligible rows (`received`, `retry_scheduled` where `next_retry_at <= NOW()`, or `processing` where `lease_expires_at < NOW()`), transitions status to `processing`, assigns `claimed_by`, sets lease expiration, increments `attempt_count`, and returns exclusively claimed records.
   - `public.reclaim_stuck_meta_social_events(p_timeout_seconds INT)`:
     Identifies abandoned jobs whose leases have expired. If `attempt_count >= max_attempts`, sets `status = 'permanently_failed'`. Otherwise, resets `status = 'received'`, clears locks, and returns audit counts.
5. **Security & Permissions:**
   - Both RPCs enforce `SET search_path = public, pg_temp`.
   - `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC`.
   - `GRANT EXECUTE ON FUNCTION ... TO authenticated, service_role`.

---

## 4. SCHEDULER IMPLEMENTATION & SETUP (cron-job.org)

### Architecture Decision:
- **Hosting Environment:** Vercel Hobby Tier.
- **Vercel Hobby Limitation:** Vercel Hobby accounts restrict native crons to at most 1–2 jobs running once per day. Deploying native high-frequency crons in `vercel.json` causes deployment rejection.
- **Supported Architecture:** In alignment with Gokul Connect's documented background runner strategy (Commit `25a99c14`), background jobs are triggered externally via **[cron-job.org](https://cron-job.org)**.

### Scheduler Configuration Specification:

| Parameter | Configuration Setting |
| :--- | :--- |
| **Title / Name** | `Gokul Connect — Meta Social Automation Worker` |
| **URL** | `https://<your-vercel-domain>/api/cron/process-social-automations?batch_size=15` |
| **HTTP Method** | `POST` (or `GET`) |
| **Schedule / Interval** | Every 1 minute (`* * * * *`) or every 2 minutes (`*/2 * * * *`) |
| **Headers** | `Authorization: Bearer <CRON_SECRET>`<br>`Content-Type: application/json` |
| **Timeout** | 30 seconds (Endpoint `maxDuration` set to 60s) |
| **Failure Notification** | Enabled (notify operator on 3 consecutive non-200 responses) |

### Concurrency Protection:
- Protected by `runCoordinatedCron()` using PostgreSQL distributed lock key `cron_lock_process-social-automations`.
- If an execution is still running when the next tick fires, the overlapping execution is gracefully skipped (`skipped: true, reason: "Overlapping execution prevented"`).

---

## 5. WORKER ARCHITECTURE & FLOW

```
                Meta Webhook POST
                        │
                        ▼
           ingestMetaSocialWebhookEvent()
       (Persists to meta_social_events, status = 'received')
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
Prompt HTTP 200 (<100ms)      cron-job.org / Worker Trigger
                                       │
                                       ▼
                        processSocialEventsBatch()
                                       │
                                       ├─► 1. reclaimStuckSocialEvents() (Reclaim expired leases)
                                       │
                                       ├─► 2. claimSocialEvents() (FOR UPDATE SKIP LOCKED)
                                       │
                                       ▼
                        For each claimed event ID:
                                       │
                                       ▼
                       processPersistedMetaSocialEvent()
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
     Public Comment Reply?                         Private Comment Reply?
                │                                             │
      Already 'replied'?                            Already 'replied'?
         ├── Yes: Skip!                                ├── Yes: Skip!
         └── No:                                       └── No:
             ├── Check ambiguous outcome                   ├── Check 7-day rule (<7 days)
             ├── Record delivery (processing)              ├── Record delivery (processing)
             ├── Call replyMetaCommentPublic()             └── Call sendInstagramPrivateReply()
             └── Update status: succeeded / failed              (Target: {instagramAccountId}/messages)
                                                           └── Update status: succeeded / failed
                └──────────────────────┬──────────────────────┘
                                       │
                                       ▼
                    Update Event & Deliveries State
                (Status: replied | retry_scheduled | ambiguous)
```

---

## 6. RETRY, RECOVERY & IDEMPOTENCY GOVERNANCE

### Independent Action-Level State Machine:
Every comment event maintains independent action states:
- `public_reply_status`: `'none'` | `'pending'` | `'replied'` | `'failed'` | `'skipped'` | `'retry_scheduled'` | `'ambiguous_outcome'`
- `private_reply_status`: `'none'` | `'pending'` | `'replied'` | `'failed'` | `'skipped'` | `'retry_scheduled'` | `'ambiguous_outcome'`

### Scenarios & Guarantees:
1. **Public Succeeded, Private Failed:**
   - Event status: `replied` (partial) / `retry_scheduled`.
   - On worker retry: `public_reply_status === 'replied'` causes public reply dispatch to be completely skipped.
   - Only the private reply is retried.
   - Once private succeeds, event reaches `replied` with `replyType: 'both'`.
2. **Ambiguous Network Outcome (Timeouts / ECONNRESET):**
   - Meta does not support client idempotency headers on comment replies.
   - Network timeouts mark delivery `status = 'ambiguous_outcome'`.
   - On retry, worker invokes `checkCommentReplied()`. If the comment was already posted by the business account, the ID is recorded and delivery is marked `succeeded`.
   - If unconfirmed, the worker does **not** blindly repost; operator review is flagged.
3. **HTTP 429 Rate Limiting:**
   - Extracts `Retry-After` header. Computes `next_retry_at = NOW() + MAX(retryAfter, backoff)`.
   - Marks delivery and event as `retry_scheduled`.
4. **Transient HTTP 5xx Errors:**
   - Backoff delay: $\text{delay} = \min(300\text{s}, 5000 \times 2^{\text{attempt}} + \text{jitter})$.
   - Up to `max_attempts` (default: 3). If exhausted, transitions to `permanently_failed`.
5. **Revoked / Expired Token (OAuth 190):**
   - Marks `meta_social_connections.connection_status = 'expired'`.
   - Delivery marked `failed`; halts automatic retry storms until operator token renewal.

---

## 7. INSTAGRAM GRAPH API COMPLIANCE VERIFICATION

**Endpoint Standard:** Meta Graph API v21.0 / v22.0 Official Platform Specifications (`developers.facebook.com`)

### Compliance Findings:
1. **Endpoint Path:**
   - Previous Implementation: `POST https://graph.facebook.com/v21.0/{linkedPageId}/messages` (Incorrect).
   - Corrected Implementation: `POST https://graph.facebook.com/v21.0/{instagramAccountId}/messages`.
   - Verified that Meta API strictly expects `{instagramAccountId}` (the Instagram Professional Account ID, `account_id` in connections). Calling `{pageId}/messages` with an Instagram comment ID causes Meta API to return `(#100) Invalid parameter: comment_id`.
2. **Request Payload:**
   ```json
   {
     "recipient": {
       "comment_id": "<INSTAGRAM_COMMENT_ID>"
     },
     "message": {
       "text": "<REPLY_TEXT>"
     }
   }
   ```
3. **Required Permissions:** `instagram_manage_comments`, `instagram_manage_messages`, `instagram_basic`.
4. **Token Authorization:** Page Access Token for the Facebook Page linked to the Instagram Professional Account (or System User User Token with matching scopes).
5. **Time Window Restriction:** Enforced 7-day rule (`< 604,800,000` ms from comment creation). Comments older than 7 days skip private DM dispatch before calling Meta API.
6. **Limit:** Maximum 1 private message per comment ID.

---

## 8. TYPESCRIPT COMPILER VERIFICATION

### Exact Command:
```bash
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH; npx tsc --noEmit
```

### Output:
```text
(Zero errors output)
```

### Exit Code:
**`0`** (Passed cleanly across all production files, API routes, and test suites).

---

## 9. TEST RESULTS & REPRODUCIBILITY

### 1. Phase 13B.2 Dedicated Worker & Delivery Fixes Test Suite:
```bash
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH; npx vitest run tests/phase13b2-critical-worker-fixes.test.ts
```
- **Exit Code:** `0`
- **Result:** **15 passed** (15 tests)
- **Coverage:**
  1. Worker processing without re-ingestion
  2. Duplicate webhook delivery handling
  3. Concurrent worker claims (`FOR UPDATE SKIP LOCKED`)
  4. Expired lease claiming
  5. Partial retries without public duplication
  6. Ambiguous delivery outcome handling
  7. HTTP 429 Retry-After backoff
  8. Exponential backoff with jitter
  9. Expired access token connection invalidation
  10. Stuck job reaper recovery
  11. Cron authentication guard (401)
  12. Coordinated cron execution & operational metrics
  13. Instagram Professional Account ID endpoint correctness
  14. Facebook Page ID endpoint correctness
  15. Observability log sanitization

### 2. Social Automation Suites Combined (Phase 13, 13B, 13B.2):
```bash
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH; npx vitest run tests/phase13-meta-social-automation.test.ts tests/phase13b-critical-remediation.test.ts tests/phase13b2-critical-worker-fixes.test.ts
```
- **Exit Code:** `0`
- **Result:** **42 passed** (42 tests across 3 suites)

### 3. Full Platform & WhatsApp Regression Gate (Repository-Wide):
```bash
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH; npx vitest run
```
- **Exit Code:** `0`
- **Result:** **839 passed** (839 tests across 55 test files)
- **Duration:** 35.03 seconds
- **Regression Status:** Zero regressions introduced to WhatsApp automation, multi-tenant isolation, CRM, campaigns, or core platform systems.

---

## 10. REMAINING LIMITATIONS

1. **Meta Graph API Exactly-Once Comment Reply:** Meta does not accept client-provided idempotency keys on comment replies (`/{comment-id}/comments` and `/{comment-id}/replies`). In rare instances where an unacknowledged HTTP timeout occurs after Meta edge processing, our automated reconciliation (`checkCommentReplied`) will identify the existing comment, but if Meta's read API is lagging, manual operator review via the ambiguous outcome state may be required.
2. **Meta 24-Hour Messaging Window:** Inbound Instagram DMs must be replied to within 24 hours. Comments support 1 private DM within 7 days, which then requires the user to reply to open a subsequent 24-hour messaging window.

---

## 11. MANUAL STAGING INSTRUCTIONS

Before testing live Meta Social webhooks in staging:
1. **Apply Migration 027 and 028 to Staging Database:**
   ```bash
   psql -h <staging-db-host> -U postgres -d postgres -f supabase/migrations/20261122_027_meta_social_critical_fixes.sql
   psql -h <staging-db-host> -U postgres -d postgres -f supabase/migrations/20261122_028_meta_social_worker_reliability.sql
   ```
2. **Register External Cron on cron-job.org:**
   - Target URL: `https://<staging-app-domain>/api/cron/process-social-automations?batch_size=15`
   - Method: `POST`
   - Header: `Authorization: Bearer <STAGING_CRON_SECRET>`
   - Interval: Every 1 minute (`* * * * *`)
3. **Verify Meta Webhook Subscriptions:**
   - Page object: `feed`, `messages`
   - Instagram object: `comments`, `messages`

---

## 12. PRODUCTION ROLLOUT CHECKLIST

- [ ] Execute read-only pre-migration integrity query (from Section 3 of `PHASE_13B1_VERIFICATION_REPORT.md`).
- [ ] Apply Migration 027 to production Supabase database.
- [ ] Apply Migration 028 to production Supabase database.
- [ ] Verify `claim_meta_social_events` and `reclaim_stuck_meta_social_events` RPC grants in production.
- [ ] Verify `CRON_SECRET`, `META_APP_SECRET`, and `META_WEBHOOK_VERIFY_TOKEN` in production Vercel environment variables.
- [ ] Verify `APP_ENCRYPTION_SECRET` (32 bytes) configured for credential vault.
- [ ] Register `/api/cron/process-social-automations` on production `cron-job.org` account.
- [ ] Verify first 5 worker executions in cron-job.org execution logs (check for HTTP 200).
- [ ] Submit Meta App Review permissions (`pages_manage_engagement`, `pages_messaging`, `instagram_manage_comments`, `instagram_manage_messages`).
- [ ] Keep live automatic replies disabled until tenant user explicitly enables them in connection settings.

---

**End of Phase 13B.2 Implementation Report.**  
*All completion criteria fulfilled. Awaiting approval before proceeding to Phase 13C.*
