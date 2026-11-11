# GOKUL CONNECT — P2-A: CENTRALIZED CRON SCHEDULING REPORT

**Document ID:** GC-P2-CRON-SCHEDULING  
**Phase:** Milestone P2 — Operational Reliability & Worker Observability  
**Status:** COMPLETE (Local Development & Verification)  
**Security Level:** High / Fail-Closed  

---

## 1. Executive Summary

Workstream P2-A delivers a centralized, hardened, and fail-closed background worker scheduling architecture for Gokul Connect. The system synchronizes background queue processing across both businesses (Gokul Astrology & Gokul Vivaham Matrimony) across four core cron endpoints while guaranteeing strict concurrency control, mutual exclusion against overlapping invocations, constant-time authorization verification, and in-memory execution run telemetry.

All schedules have been specified in `vercel.json` without activating live deployments or remote hosting jobs, ensuring strict adherence to the local development environment constraints.

---

## 2. Cron Endpoints & Scheduling Matrix

The four core background worker endpoints configured in `vercel.json` are:

| Endpoint Route | Cron Expression | Interval | Purpose & Processing Scope |
| :--- | :--- | :--- | :--- |
| `/api/cron/process-automation-jobs` | `*/2 * * * *` | Every 2 mins | Inbound message rule triggers, keyword matches, immediate auto-responses, and message status updates. |
| `/api/cron/process-scheduled-messages` | `*/5 * * * *` | Every 5 mins | Outbound scheduled messages for CRM reminders, scheduled broadcasts, and follow-up templates due for dispatch. |
| `/api/cron/process-campaigns` | `*/10 * * * *` | Every 10 mins | Batch marketing and promotional campaign dispatch with consent gating and rate limits. |
| `/api/cron/process-crm-reminders` | `*/15 * * * *` | Every 15 mins | Customer follow-up reminders, lead status reviews, and agent reminder notifications. |

### Justification of Intervals:
- **Automation Jobs (`*/2 * * * *`)**: Ensures near-realtime responsiveness for inbound conversations without overwhelming database connections or exceeding serverless compute budgets.
- **Scheduled Messages (`*/5 * * * *`)**: Balances punctuality for time-scheduled messages against compute cost.
- **Campaign Recipients (`*/10 * * * *`)**: Marketing blasts are batched to preserve WhatsApp tier limits and prevent rate limit exhaustion.
- **CRM Follow-Up Reminders (`*/15 * * * *`)**: Customer relationship management follow-ups are calendar-level tasks that do not require sub-minute frequency.

---

## 3. Concurrency Coordination & Overlap Protection

Serverless cron invocations can experience unpredictable network delays, cold starts, or backlogged queues that cause a subsequent invocation to fire before the preceding run finishes. Gokul Connect enforces strict overlap prevention through `src/lib/cron/coordinator.ts`:

### 3.1 Mutual Exclusion Lock (`isCronLocked`)
- An in-memory lock table tracks currently executing cron identifiers (`process-automation-jobs`, `process-scheduled-messages`, etc.).
- When an execution starts, `isCronLocked(cronName)` is queried.
- If locked and within the safety timeout window (default: 5 minutes), the incoming request is immediately short-circuited with HTTP 200 and a structured JSON payload:
  ```json
  {
    "status": "skipped",
    "reason": "Previous execution still in progress",
    "cronName": "process-automation-jobs",
    "activeWorkerId": "cron_1794232555280"
  }
  ```
- If an execution exceeds 5 minutes without completion, the lock expires automatically to prevent permanent deadlocks caused by unhandled runtime crashes.

### 3.2 Worker Run Telemetry (`worker_execution_runs`)
- When a cron begins, an execution record is generated with a unique correlation ID (`${workerIdPrefix}_${timestamp}`).
- Upon completion, execution telemetry is persisted to the database and in-memory caches, capturing:
  - Total items claimed
  - Successfully processed items
  - Failed items
  - Reclaimed stuck items
  - Skipped items
  - Processing duration in milliseconds
  - Worker execution errors (sanitized)

---

## 4. Fail-Closed Authentication & Secret Protection

All cron routes invoke `runCoordinatedCron`, which wraps authorization with `verifyCronAuthorization`:

### 4.1 Timing-Safe Secret Validation
- Requires header: `Authorization: Bearer <CRON_SECRET>`.
- Token comparison uses `crypto.timingSafeEqual` over SHA-256 digests to protect against side-channel timing attacks:
  ```typescript
  const expectedHash = crypto.createHash("sha256").update(cronSecret).digest();
  const providedHash = crypto.createHash("sha256").update(token).digest();
  return crypto.timingSafeEqual(expectedHash, providedHash);
  ```

### 4.2 Fail-Closed Invariants
- If `CRON_SECRET` is undefined, empty string `""`, or contains only whitespace, the endpoint rejects the request with HTTP 401 Unauthorized immediately.
- Requests without an `Authorization` header or with malformed Bearer schemes are rejected before queue or database connections are initialized.
- Secret tokens are scrubbed from all logs, correlation payloads, and response bodies.

---

## 5. Hosting Limitations & External Scheduler Recommendations

### 5.1 Vercel Hobby vs Pro Plan Limits
- **Vercel Hobby**: Limits cron jobs to once per day (`0 0 * * *`). Sub-hour crons are not supported on Hobby tiers.
- **Vercel Pro / Enterprise**: Supports cron intervals down to once per minute (`* * * * *`).

### 5.2 External Scheduler Alternative (Decoupled Production Recommendation)
If deployed in environments where native platform crons are restricted or costly:
1. **GitHub Actions / Cloudflare Workers**: Secure external trigger dispatching `POST` requests with `Authorization: Bearer <CRON_SECRET>` over TLS.
2. **Supabase `pg_cron`**: Direct database-level scheduling invoking Edge Functions or calling queue maintenance RPCs directly with service role permissions.
3. **QStash (Upstash)**: Scheduled HTTP message publishing with automatic retries and dead-letter queues.

---

## 6. Verification & Test Evidence

All cron scheduling, authentication, and concurrency coordination mechanics have been verified by Vitest:
- `tests/p2-operational-reliability.test.ts` (Domain 1: Centralized Cron Scheduling & Concurrency Coordination)
  - 1.1 Rejects unauthorized cron invocations with HTTP 401 when token is missing (PASS)
  - 1.2 Rejects unauthorized cron invocations when token is tampered or invalid (PASS)
  - 1.3 Fails closed with HTTP 401 when `CRON_SECRET` is empty string or undefined (PASS)
  - 1.4 Successfully executes cron endpoint with valid Bearer token (PASS)
  - 1.5 Prevents concurrent overlapping execution of the same cron job (PASS)
  - 1.6 Allows repeated sequential invocations cleanly once lock is released (PASS)
- `tests/phase7-2-cron-security.test.ts` (16 tests passed)
