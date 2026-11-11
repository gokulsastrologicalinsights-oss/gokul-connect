# GOKUL CONNECT — P3.1: P2 & P2.1 OPERATIONAL RELIABILITY VERIFICATION

**Audit Timestamp:** `2026-11-09T19:51:30+05:30`  
**Auditor:** Independent Antigravity Evidence Verification Engine  
**Project:** `E:\GAI\Whatsapp Automation`  
**Target Architecture:** Distributed Operational Reliability, Worker Observability & Fault Recovery  
**Scope:** Milestone P2 and Milestone P2.1 Completion Verification  

---

## 1. Executive Summary

Milestones P2 and P2.1 focus on backend operational reliability, distributed cron locking, queue failure recovery, observability telemetry, and safety against double-dispatching WhatsApp messages.

This audit inspected the actual code in `src/lib/cron/coordinator.ts`, `src/lib/observability/recovery.ts`, `src/lib/whatsapp/service.ts`, `src/lib/campaigns/worker.ts`, and Migration `20261109_023_phase2_operational_reliability.sql`.

| Ref | Reliability Requirement | Status | Primary Source Reference | Key Verification Finding |
|:---|:---|:---:|:---|:---|
| **A.1** | Distributed PostgreSQL-backed cron locking across independent instances | **FAIL** | `src/lib/cron/coordinator.ts:30` | Implemented strictly as an in-memory `Map` (`activeCronLocks`). No `cron_locks` table exists in PostgreSQL. Fails across serverless instances. |
| **A.2** | Lock expiration, renewal, ownership and recovery | **PARTIAL** | `src/lib/cron/coordinator.ts:32-45`<br>`src/lib/observability/recovery.ts:45` | Queue-level locks have ownership, TTL, and recovery via `reclaim_stuck_queue_jobs`. Cron-level locks lack distributed renewal and cross-instance recovery. |
| **A.3** | Durable outbound dispatch lifecycle | **PASS** | `src/lib/whatsapp/service.ts:395-500` | Transitions through `wa_messages` (`pending` -> `sent` / `failed`), enqueues retryable errors into `wa_processing_jobs`, claims via `FOR UPDATE SKIP LOCKED`. |
| **A.4** | Handling of uncertain Meta provider responses | **PARTIAL** | `src/lib/whatsapp/service.ts:511-539` | Timeouts (504, `ECONNRESET`, `ETIMEDOUT`) are classified as retryable and re-enqueued, but no two-phase webhook receipt reconciliation exists prior to re-dispatch. |
| **A.5** | Prevention of duplicate WhatsApp dispatch | **PARTIAL** | `supabase/migrations/20261109_023_*.sql:283`<br>`src/lib/observability/recovery.ts:98` | Guards exist when `message_id` or `meta_message_id` is recorded. Outbound network timeouts where Meta dispatched but caller timed out can result in duplicate sends upon retry. |
| **A.6** | Recovery integration across all four queue systems | **PASS** | `supabase/migrations/20261109_023_*.sql:244`<br>`src/lib/observability/recovery.ts:16` | Unified RPC `reclaim_stuck_queue_jobs` recovers locks across Automation, Scheduled, Campaign, and CRM Reminder queues. |
| **A.7** | Secure manual retry | **PASS** | `supabase/migrations/20261109_023_*.sql:391`<br>`src/lib/observability/recovery.ts:136` | RPC `retry_queue_job` + Server Action verifies Owner/Admin role (rejects Agent/Viewer with 403), verifies tenant ID, and blocks retry if already dispatched. |
| **A.8** | Cron execution limits and schedule compatibility | **PARTIAL** | `vercel.json:1-21`<br>`src/lib/cron/coordinator.ts:53` | Vercel Pro plan is required for `*/2`, `*/5`, `*/10`, `*/15` cron intervals. Hobby plan restricts crons to daily. `maxDuration` is omitted from `vercel.json`. |

---

## 2. Detailed Technical Findings

### A.1 Distributed PostgreSQL-Backed Cron Locking Across Independent Instances
- **Classification:** **FAIL**
- **Source Inspection:** `src/lib/cron/coordinator.ts:29-45`
  ```typescript
  // In-memory concurrency locks to prevent overlapping executions
  const activeCronLocks = new Map<string, { lockedAt: number; workerId: string }>();

  export function isCronLocked(cronName: string, lockTtlMs: number = 60000): boolean {
    const lock = activeCronLocks.get(cronName);
    if (!lock) return false;
    if (Date.now() - lock.lockedAt > lockTtlMs) {
      activeCronLocks.delete(cronName);
      return false;
    }
    return true;
  }
  ```
- **Database Catalog Inspection:**
  - Database documentation (`docs/P3_DATABASE_MIGRATION_EXECUTION_PLAN.md:39` and `docs/P3_FINAL_INTEGRATION_AND_READINESS_REPORT.md:37`) claimed that Migration 023 created a `cron_locks` table.
  - Inspection of `supabase/migrations/20261109_023_phase2_operational_reliability.sql` shows that **NO `cron_locks` table was ever defined or created**.
- **Architectural Consequence:**
  - In a local single-node environment, an in-memory `Map` successfully prevents concurrent cron execution.
  - In a production serverless environment (such as Vercel), each incoming cron request (`/api/cron/*`) can spin up an independent lambda container with an isolated memory heap.
  - An in-memory `Map` offers **zero mutual exclusion** across independent serverless instances. Two instances triggered simultaneously will both see an empty lock map and execute concurrently.
  - A real distributed lock requires atomic PostgreSQL row locking (e.g. `pg_try_advisory_lock` or a dedicated `cron_locks` table with `UPDATE ... WHERE locked_until < NOW()`).

---

### A.2 Lock Expiration, Renewal, Ownership and Recovery
- **Classification:** **PARTIAL**
- **Source Inspection:**
  - `src/lib/cron/coordinator.ts:32-45` (Cron locking)
  - `supabase/migrations/20261109_023_phase2_operational_reliability.sql:244-383` (`reclaim_stuck_queue_jobs`)
- **Analysis:**
  - **Queue-Level Locks (PASS):**
    - `wa_processing_jobs`, `wa_scheduled_messages`, `wa_campaign_recipients`, and `crm_follow_up_reminders` track lock ownership (`locked_by`), lock time (`locked_at`), and maximum attempts.
    - RPC `reclaim_stuck_queue_jobs` safely identifies locks older than `p_timeout_minutes` (default 5 minutes), increments attempts, and unlocks or marks them `dead_letter`.
  - **Cron-Level Locks (FAIL):**
    - The cron lock only tracks `lockedAt` and `workerId` in memory.
    - There is no lock heartbeat renewal mechanism (`renewLock`) for long-running batches.
    - If a container crashes mid-execution, memory is reclaimed on teardown, but if a container hangs without terminating, the in-memory lock persists until `lockTtlMs` expires locally.
    - No distributed lock recovery exists across nodes.

---

### A.3 Durable Outbound Dispatch Lifecycle
- **Classification:** **PASS**
- **Source Inspection:**
  - `src/lib/whatsapp/service.ts:395-505` (`sendWhatsAppMessageService`)
  - `src/lib/campaigns/worker.ts:180-230`
  - `src/lib/scheduled/worker.ts:270-320`
- **Verification Details:**
  1. **Initial State:** Outbound messages are inserted into `wa_messages` with status `'pending'`.
  2. **Dispatched State:** When Meta Cloud API returns HTTP 200 with message ID, `wa_messages` is updated to `'sent'`, storing `meta_message_id` and `sent_at`.
  3. **Failed State:** If Meta returns an error, `wa_messages` is updated to `'failed'`, storing `error_code` and `error_message`.
  4. **Retry Queue Enqueue:** If `isRetryableMetaError(error)` is true, a job is inserted into `wa_processing_jobs` (`job_type: "send_message"`, attempts: 1, max_attempts: 5, scheduled with exponential backoff).
  5. **Atomic Claiming:** Background workers claim jobs using PostgreSQL `FOR UPDATE SKIP LOCKED`.

---

### A.4 Handling of Uncertain Meta Provider Responses
- **Classification:** **PARTIAL**
- **Source Inspection:**
  - `src/lib/whatsapp/service.ts:68-94` (`isRetryableMetaError`)
  - `src/lib/whatsapp/service.ts:511-539`
- **Analysis & Risk Assessment:**
  1. `isRetryableMetaError` classifies HTTP 502, 503, 504, `ETIMEDOUT`, `ECONNRESET`, and `fetch failed` as retryable errors.
  2. In an uncertain state—for example, if Meta accepted and dispatched a message, but the connection dropped before Meta's HTTP 200 response reached the application—the application receives a network timeout error.
  3. Because `meta_message_id` was never returned, the application marks the local record `'failed'` and enqueues a retry job in `wa_processing_jobs`.
  4. Meta Cloud API (`POST /{phone_number_id}/messages`) **does not accept an idempotency key**. When the retry job executes, Meta will accept it as a new request and dispatch a **duplicate WhatsApp message** to the customer.
  5. Current mitigation: Webhook receipts can arrive asynchronously and correlate via `meta_message_id`, but the outbox retry worker does not query recently arrived delivery receipts before dispatching.

---

### A.5 Prevention of Duplicate WhatsApp Dispatch
- **Classification:** **PARTIAL**
- **Source Inspection:**
  - `supabase/migrations/20261109_023_phase2_operational_reliability.sql:283-348`
  - `src/lib/observability/recovery.ts:98-103`, `203-208`
- **Verification Details:**
  - **Where Duplicate Dispatch is Prevented (PASS):**
    1. In `reclaim_stuck_queue_jobs`: For scheduled messages and campaign recipients, if `message_id` or `meta_message_id` is NOT NULL when a lock is reclaimed, the status is updated to `'sent'` rather than `'pending'`. This prevents stuck jobs that succeeded at the provider from being re-sent.
    2. In `manualRetryJobDb`: If `job.message_id || job.meta_message_id || job.status === "sent"`, manual retry is rejected with error: `"Cannot retry a job that has already been dispatched"`.
    3. Inbound webhooks deduplicate on `meta_message_id` via PostgreSQL unique constraint.
  - **Where Duplication Can Still Occur (GAP):**
    1. During uncertain network timeouts (as described in A.4), because `meta_message_id` is null on failure.

---

### A.6 Recovery Integration Across All Four Queue Systems
- **Classification:** **PASS**
- **Source Inspection:**
  - `supabase/migrations/20261109_023_phase2_operational_reliability.sql:82-115`, `244-383`
  - `src/lib/observability/recovery.ts:16-129`
  - `tests/p2-operational-reliability.test.ts:550-650`
- **Verification Details:**
  1. Migration 023 expands check constraints to include `'dead_letter'` across all four queues:
     - `public.wa_processing_jobs`
     - `public.wa_scheduled_messages`
     - `public.wa_campaign_recipients`
     - `public.crm_follow_up_reminders`
  2. RPC `reclaim_stuck_queue_jobs(p_timeout_minutes, p_business_id)` recovers all 4 tables in a single transaction:
     - Section 1: `wa_processing_jobs` (increments attempts, unlocks or dead-letters).
     - Section 2: `wa_scheduled_messages` (verifies message_id, resets to 'scheduled').
     - Section 3: `wa_campaign_recipients` (verifies message_id, resets to 'pending').
     - Section 4: `crm_follow_up_reminders` (resets to 'pending').
  3. Returns unified JSON object: `{ reclaimed: { automation, scheduled, campaigns, crm_reminders } }`.
  4. Verified in `p2-operational-reliability.test.ts` test 6.4 against PGlite.

---

### A.7 Secure Manual Retry
- **Classification:** **PASS**
- **Source Inspection:**
  - `supabase/migrations/20261109_023_phase2_operational_reliability.sql:391-488` (`retry_queue_job`)
  - `src/lib/observability/recovery.ts:136-239` (`manualRetryJobDb`)
  - `src/app/actions/operations.ts:75-130` (`manualRetryJobAction`)
  - `tests/p2-operational-reliability.test.ts:320-395` (Tests 3.9 & 3.10)
- **Verification Details:**
  1. **Strict Role Verification:** Only users with `role = 'owner'` or `role = 'admin'` can trigger a manual retry. Requests by `'agent'` or `'viewer'` return HTTP 403 Forbidden:
     ```typescript
     if (params.actorRole !== "owner" && params.actorRole !== "admin") {
       return { success: false, error: "Forbidden: Only Owner or Admin can manually retry jobs" };
     }
     ```
  2. **Multi-Tenant Boundary:** Database query enforces `AND business_id = p_business_id`. Cross-tenant retries fail silently and return `success: false`.
  3. **Dispatched Job Guard:** If a job has `message_id IS NOT NULL` or `meta_message_id IS NOT NULL`, the retry is blocked.
  4. **State Reset:** Sets `status = 'pending'` (or `'scheduled'`), `attempts = 0`, `locked_at = NULL`, `locked_by = NULL`, and sets `last_error = 'Manually requeued by administrator'`.

---

### A.8 Cron Execution Limits and Schedule Compatibility
- **Classification:** **PARTIAL**
- **Source Inspection:**
  - `vercel.json:1-21`
  - `src/app/api/cron/*/route.ts`
  - `src/lib/cron/coordinator.ts:53`
- **Verification Details:**
  1. **Vercel Plan Conflict:**
     - `vercel.json` configures crons every 2m, 5m, 10m, and 15m.
     - **Vercel Hobby (Free) Tier** enforces a hard limitation: cron jobs can only be invoked **once per day** (`0 0 * * *`). Deploying frequent schedules to Hobby fails deployment validation or ignores schedules.
     - **Vercel Pro / Enterprise** is strictly required to run these schedules.
  2. **Execution Timeout (`maxDuration`):**
     - Default Vercel serverless function execution limit is 15 seconds (Hobby: 10s).
     - `src/lib/cron/coordinator.ts` uses `timeoutMs = 60000` (60s).
     - However, neither `vercel.json` nor the route files export `export const maxDuration = 60;`. On standard Vercel deployments, a batch that exceeds 15 seconds will be terminated abruptly with HTTP 504.
  3. **Batch Sizing Safety:**
     - Automation worker: batch size 15.
     - Scheduled worker: batch size 10.
     - Campaign worker: batch size 50. A batch of 50 external Meta API calls averaging 300ms each will take ~15 seconds, risking timeout if not given at least 60s max duration.

---

## 3. Remediation Actions Before P4 Production Activation

1. **Implement Distributed Cron Locking in PostgreSQL:**
   Create migration `20261109_024_distributed_cron_locks.sql` with table:
   ```sql
   CREATE TABLE public.cron_locks (
       cron_name TEXT PRIMARY KEY,
       locked_by TEXT NOT NULL,
       locked_at TIMESTAMPTZ NOT NULL,
       expires_at TIMESTAMPTZ NOT NULL
   );
   ```
   Update `coordinator.ts` to acquire and release locks via atomic `INSERT ... ON CONFLICT DO UPDATE WHERE expires_at < NOW()`.
2. **Configure `maxDuration` for Cron Routes:**
   Add `export const maxDuration = 60;` to all four cron route files and configure function settings in `vercel.json`.
3. **Formalize Vercel Pro Hosting Requirement:**
   Document in the deployment runbook that Gokul Connect requires a Vercel Pro subscription for production cron scheduling.
