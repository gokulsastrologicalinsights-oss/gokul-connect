# GOKUL CONNECT — P2-C: QUEUE FAILURE RECOVERY & DEAD-LETTER MANAGEMENT REPORT

**Document ID:** GC-P2-QUEUE-RECOVERY  
**Phase:** Milestone P2 — Operational Reliability & Worker Observability  
**Status:** COMPLETE (Local Development & Verification)  
**Security Level:** Critical / Idempotent Message Protection  

---

## 1. Executive Summary

Workstream P2-C establishes a fault-tolerant failure recovery and dead-letter queue management framework for Gokul Connect. The system handles transient infrastructure failures, classifies permanent invalid requests, reclaims stuck processing locks, and prevents duplicate WhatsApp message dispatches.

Additionally, authorized Owners and Admins are provided with atomic manual retry capabilities to safely requeue failed or dead-lettered jobs once operational anomalies have been resolved.

---

## 2. Error Classification Architecture

In `src/lib/observability/error-classifier.ts`, errors are categorized deterministically to prevent infinite retry loops on non-recoverable payloads:

### 2.1 Classification Taxonomy

| Category | Typical Causes & Error Codes | Recovery Behavior |
| :--- | :--- | :--- |
| **Transient Errors** | `ECONNRESET`, `ETIMEDOUT`, `503 Service Unavailable`, `429 Rate Limit Exhausted`, database connection pool timeouts, simulated network glitches. | Automatically retried using bounded exponential backoff with random jitter. |
| **Permanent Errors** | `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `131026 Message Undeliverable`, invalid phone numbers, template parameter count mismatch, unapproved template names. | Immediately moved to `dead_letter` or `failed` state. Automatic retry is aborted. |

### 2.2 Bounded Exponential Backoff with Jitter
To prevent thundering herds on upstream Meta APIs and internal Supabase connections, backoff intervals are computed via `calculateBoundedBackoff`:
$$t_{\text{backoff}} = \min(t_{\text{max}}, t_{\text{base}} \times 2^{\text{attempt}} + \text{jitter})$$
- Default base delay: 30 seconds
- Default max delay: 1,800 seconds (30 minutes)
- Full jitter applied randomly between 0 and 20% of base interval.

---

## 3. Stuck Job Reclamation & Duplicate Send Prevention

Serverless crashes, container restarts, or unhandled exceptions can leave jobs in `'processing'` state indefinitely with active locks.

### 3.1 Database Reclamation RPC (`reclaim_stuck_queue_jobs`)
Migration 023 implements `reclaim_stuck_queue_jobs(p_timeout_minutes INT, p_business_id UUID)`:
- Scans `wa_processing_jobs` and `wa_scheduled_messages` for jobs with `status = 'processing'` and `locked_at < NOW() - (p_timeout_minutes * INTERVAL '1 minute')`.
- Bounded retry check:
  - If `attempts < max_attempts`: resets status to `'retrying'`, unlocks the job, and schedules next run with exponential backoff.
  - If `attempts >= max_attempts`: permanently transitions job to `'dead_letter'`.

### 3.2 Duplicate Message Dispatch Prevention Guard
A critical risk during failure recovery is accidentally resending a WhatsApp message that was already delivered by Meta before the worker crashed.
Gokul Connect safeguards against this by inspecting `message_id` / `meta_message_id`:
```sql
-- Safeguard: If message was already dispatched to Meta, DO NOT RE-DISPATCH!
IF v_job.payload->>'message_id' IS NOT NULL OR v_job.payload->>'meta_message_id' IS NOT NULL THEN
  UPDATE public.wa_processing_jobs
  SET status = 'completed',
      locked_by = NULL,
      locked_at = NULL,
      updated_at = NOW()
  WHERE id = v_job.id;
  v_reclaimed := v_reclaimed + 1;
END IF;
```
If an outbound job recorded a Meta message ID, the system marks the job completed without re-invoking the outbound API.

---

## 4. Dead-Letter State Implementation

Across all four queue tables, Migration 023 extended status check constraints to permit `'dead_letter'`:
- `wa_processing_jobs`: `status IN ('pending', 'processing', 'completed', 'failed', 'retrying', 'dead_letter')`
- `wa_scheduled_messages`: `status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'retrying', 'dead_letter')`
- `wa_campaign_recipients`: `status IN ('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped', 'retrying', 'dead_letter')`
- `crm_follow_up_reminders`: `status IN ('pending', 'processing', 'completed', 'cancelled', 'failed', 'retrying', 'dead_letter')`

---

## 5. Controlled Manual Retries for Authorized Admins

In `src/lib/observability/recovery.ts`, authorized Owners and Admins can trigger manual retries via `manualRetryJobDb` and Server Action `manualRetryJobAction`:

### 5.1 Authorization & Role Gating
- Verified roles: `'owner'` and `'admin'`.
- `'agent'` and `'viewer'` roles are rejected with HTTP 403 Forbidden.
- Tenant isolation: Target job must belong to the caller's active `businessId`. Cross-tenant manual retries are strictly blocked.

### 5.2 Atomic State Reset (`retry_queue_job`)
- Resets job status to `'pending'`.
- Clears locks (`locked_by = NULL`, `locked_at = NULL`).
- Resets `scheduled_at = NOW()`.
- Increments `max_attempts` by 1 to permit another execution cycle.
- Preserves idempotency key and original failure diagnostic history.

---

## 6. Verification & Test Evidence

All recovery mechanics have been verified by Vitest:
- `tests/p2-operational-reliability.test.ts` (Domain 3: Failure Recovery, Error Classification & Dead-Letter Management)
  - 3.1 Correctly classifies transient vs permanent errors
  - 3.2 Calculates bounded exponential backoff with full jitter
  - 3.3 Reclaims stuck processing jobs safely when timeout is exceeded
  - 3.4 Prevents duplicate message dispatch when job already has `meta_message_id`
  - 3.5 Automatically dead-letters jobs after exhausting maximum retry attempts
  - 3.6 Rejects non-retryable permanent errors immediately to dead-letter state
  - 3.7 Sanitizes error messages when recording failure telemetry
  - 3.8 Preserves idempotency key across worker retries
  - 3.9 Allows Owner and Admin to manually retry failed/dead-letter jobs
  - 3.10 Rejects manual retry attempt by unauthorized Agent or Viewer role (403)
  - 3.11 Blocks cross-tenant manual retry attempts strictly
