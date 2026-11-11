# GOKUL CONNECT — P2-B: WORKER HEALTH & OPERATIONAL MONITORING REPORT

**Document ID:** GC-P2-WORKER-HEALTH  
**Phase:** Milestone P2 — Operational Reliability & Worker Observability  
**Status:** COMPLETE (Local Development & Verification)  
**Security Level:** Multi-Tenant Isolated / Owner & Admin Protected  

---

## 1. Executive Summary

Workstream P2-B implements a centralized telemetry and operational health monitoring engine for Gokul Connect. The system continuously aggregates real-time queue states, worker execution latency, throughput, failure rates, and stuck job alerts across both businesses.

To guarantee zero cross-tenant data leakage and high query performance, health metrics are aggregated entirely at the database layer via PostgreSQL RPC `get_worker_health_metrics`, avoiding in-memory table scans and strictly enforcing multi-tenant isolation.

---

## 2. Monitored Background Workers

The monitoring system tracks health states for all 5 operational worker types:

1. **Automation Worker (`automation_worker`)**:
   - Manages inbound rule evaluations, keyword actions, and immediate auto-replies in `wa_processing_jobs`.
2. **Scheduled Message Worker (`scheduled_worker`)**:
   - Manages scheduled outbound broadcasts, reminders, and template dispatches in `wa_scheduled_messages`.
3. **Campaign Worker (`campaign_worker`)**:
   - Manages bulk campaign recipient delivery and template batching in `wa_campaign_recipients`.
4. **CRM Reminder Worker (`crm_reminder_worker`)**:
   - Manages follow-up reminders, lead status alerts, and task notifications in `crm_follow_up_reminders`.
5. **Notification Worker (`notification_worker`)**:
   - Manages in-app notification events and alerts in `workspace_notifications`.

---

## 3. Database Aggregation RPC (`get_worker_health_metrics`)

To prevent loading full tables into memory, database migration `20261109_023_phase2_operational_reliability.sql` introduced `get_worker_health_metrics(p_business_id UUID)`.

### 3.1 Aggregation Strategy
- Uses SQL `COUNT(*) FILTER (...)` constructs directly against indexed queue columns.
- Aggregates by:
  - `pending_count`
  - `processing_count`
  - `failed_count`
  - `retrying_count`
  - `dead_letter_count`
  - `completed_count`
  - `stuck_count` (processing jobs older than 5 minutes)
- Returns a structured table with 1 row per queue type, tagged with `p_business_id`.

```sql
SELECT
  'automation'::TEXT AS queue_type,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
  COUNT(*) FILTER (WHERE status = 'retrying') AS retrying_count,
  COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter_count,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
  COUNT(*) FILTER (WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes') AS stuck_count
FROM public.wa_processing_jobs
WHERE business_id = p_business_id;
```

### 3.2 Covering Database Indexes
Migration 023 added high-performance indexes covering queue status lookups:
- `idx_wa_processing_jobs_biz_status_locked`: `(business_id, status, locked_at)`
- `idx_wa_scheduled_messages_biz_status_locked`: `(business_id, status, locked_at)`
- `idx_wa_campaign_recipients_biz_status`: `(business_id, status)`
- `idx_crm_follow_up_reminders_biz_status`: `(business_id, status)`

---

## 4. Worker Health Status Resolution

In `src/lib/observability/worker-health.ts`, worker health is computed dynamically based on real-time execution statistics and error thresholds:

| Status | Condition |
| :--- | :--- |
| **Healthy** | At least one successful run recorded in the last 15 minutes, 0 consecutive failures, and fewer than 10% failed jobs. |
| **Degraded** | Job failure rate between 10% and 50%, or stuck jobs detected in the queue. |
| **Failed** | Consecutive execution errors, or job failure rate exceeding 50%. |
| **Stale** | No execution recorded within the expected schedule window (e.g., > 30 minutes since last execution). |
| **Idle** | Zero pending jobs and no worker runs required. |

---

## 5. Multi-Tenant Isolation Guarantee

- All queries executed by the health monitoring service require an explicit `businessId`.
- The database RPC filters every table with `WHERE business_id = p_business_id`.
- Astrology (`11111111-1111-1111-1111-111111111111`) cannot observe Vivaham (`22222222-2222-2222-2222-222222222222`) operational stats or worker metrics under any condition.
- Verified in `tests/p2-operational-reliability.test.ts` (Domain 2: Worker Health & Operational Metrics):
  - 2.1 Computes aggregated queue health metrics per business
  - 2.2 Isolates worker health metrics strictly across business tenants
  - 2.3 Correctly flags worker status as degraded or failed when errors accumulate
  - 2.4 Detects stale workers when last execution exceeds expected interval
  - 2.5 Returns clean zero-state metrics when queues are completely empty
