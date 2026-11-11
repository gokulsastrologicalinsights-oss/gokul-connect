# GOKUL CONNECT — P3.2: DATABASE MIGRATION COMPATIBILITY REVIEW (001–024)

**Document ID:** `DOC-P3_2-DATABASE-MIGRATION-COMPATIBILITY`  
**Execution Timestamp:** `2026-11-09T20:11:00+05:30`  
**Platform:** **Gokul Connect (Multi-Tenant WhatsApp CRM & Automation Engine)**  
**Remote Supabase Project:** `https://ansiwtwqgrfmzfrhkzuu.supabase.co` (`ap-south-1` Mumbai)  
**Status:** **RECONCILED & LOCALLY VERIFIED (PENDING AUTHORIZED STAGED APPLICATION)**  

---

## 1. Executive Summary & Verification Methodology

A full sequential compatibility audit was performed across all twenty-four (24) database migrations in `supabase/migrations/`.

1. **Read-Only Live Introspection:** Executed `scripts/inspect-all-live-migrations.mjs` against live Supabase project `ansiwtwqgrfmzfrhkzuu`. Confirmed that migrations 001–015 are currently APPLIED, and migrations 016–024 are UNAPPLIED.
2. **Clean-Slate PGlite Replay:** Verified that all 24 migrations replay cleanly from an empty database in PGlite PostgreSQL 16 WebAssembly with zero syntax errors, zero circular foreign keys, and zero constraint violations.
3. **Application Query Mapping:** Verified that every table, column, RPC, and RLS policy referenced in the Next.js application codebase is fully declared across migrations 001–024.

> [!WARNING]
> No migrations were applied to the live Supabase project during Phase P3.2. Live application is strictly deferred to an authorized deployment window following a pre-migration database snapshot backup.

---

## 2. Complete Migration Ledger (001–024)

| Migration File | Description / Core Tables | Status on Live DB | PGlite Replay Status | Dependencies & FK Integrity |
|:---|:---|:---:|:---:|:---|
| `20261106_001_phase1_foundation.sql` | `businesses`, `business_members`, `user_profiles` | ✅ **APPLIED** | ✅ PASS | Root foundation schema. |
| `20261106_002_phase2_wa_connections.sql` | `wa_connections`, `business_settings` | ✅ **APPLIED** | ✅ PASS | FK to `businesses(id)`. |
| `20261106_003_phase2_wa_credentials.sql` | `wa_credentials_vault` (AES-256) | ✅ **APPLIED** | ✅ PASS | FK to `wa_connections(id)`. |
| `20261106_004_phase2_privilege_escalation_guard.sql` | Role escalation security triggers | ✅ **APPLIED** | ✅ PASS | Secures `business_members`. |
| `20261106_005_phase3_messaging_schema.sql` | `wa_contacts`, `wa_conversations`, `wa_messages` | ✅ **APPLIED** | ✅ PASS | Composite FK `(connection_id, business_id)`. |
| `20261106_006_phase3_webhook_persistence_rpcs.sql` | Ingestion RPCs (`ingest_wa_inbound_message`) | ✅ **APPLIED** | ✅ PASS | Atomic upsert procedures. |
| `20261106_007_phase3i_performance_optimizations.sql` | Partial indexes, composite indexes | ✅ **APPLIED** | ✅ PASS | Optimizes inbox queries. |
| `20261106_008_phase3h_webhook_events_rls.sql` | `wa_webhook_events` & RLS hardening | ✅ **APPLIED** | ✅ PASS | Deduplication & raw event logging. |
| `20261106_009_phase5_automation_engine_schema.sql` | `automation_rules`, `wa_processing_jobs` | ✅ **APPLIED** | ✅ PASS | Rules engine & durable background queue. |
| `20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql`| Atomic ingestion + enqueue RPC | ✅ **APPLIED** | ✅ PASS | High-throughput webhook decoupling. |
| `20261107_011_phase7_5_queue_rpc_privilege_hardening.sql`| RPC security hardening & search paths | ✅ **APPLIED** | ✅ PASS | Security Definer search_path fix. |
| `20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql` | Partial index on queue status | ✅ **APPLIED** | ✅ PASS | Replaces seq scans on pending queue. |
| `20261107_013_phase9_crm_and_contacts.sql` | CRM contact tags, custom fields, notes | ✅ **APPLIED** | ✅ PASS | Enriches `wa_contacts`. |
| `20261107_014_phase10_analytics_rpcs.sql` | Analytics RPCs (aggregate metrics) | ✅ **APPLIED** | ✅ PASS | Dashboard analytics calculations. |
| `20261107_015_phase11_template_management.sql` | `wa_message_templates`, approval sync | ✅ **APPLIED** | ✅ PASS | Baseline 015 on live database. |
| `20261107_016_phase12_1_team_management_and_agent_assignment.sql` | `team_invitations`, `business_audit_logs`, assignment | ❌ **UNAPPLIED** | ✅ PASS | Adds `assigned_agent_id` to conversations. |
| `20261107_017_phase12_2_media_messaging.sql` | `wa_media_files`, media storage columns | ❌ **UNAPPLIED** | ✅ PASS | Adds `media_id`, `storage_path` to messages. |
| `20261108_018_phase12_3_scheduled_messages.sql` | `wa_scheduled_messages`, scheduler queue | ❌ **UNAPPLIED** | ✅ PASS | Delayed message dispatch engine. |
| `20261108_019_phase12_4_campaign_management.sql` | `wa_campaigns`, `wa_campaign_recipients` | ❌ **UNAPPLIED** | ✅ PASS | Broadcast & marketing campaign engine. |
| `20261108_020_phase12_5_crm_lifecycle_and_followups.sql` | `crm_lifecycle_stages`, `crm_follow_ups` | ❌ **UNAPPLIED** | ✅ PASS | Pipeline stages and task management. |
| `20261109_021_phase12_6_notification_center_and_durable_reminders.sql` | `internal_notifications`, `user_notification_preferences` | ❌ **UNAPPLIED** | ✅ PASS | App notifications and bell alerts. |
| `20261109_022_phase12_7_visual_flows_and_realtime.sql` | `wa_visual_flows`, Realtime publications | ❌ **UNAPPLIED** | ✅ PASS | Visual drag-and-drop node graph flows. |
| `20261109_023_phase2_operational_reliability.sql` | `worker_execution_runs`, `reclaim_stuck_queue_jobs` | ❌ **UNAPPLIED** | ✅ PASS | Dead-letter state, health telemetry RPCs. |
| `20261109_024_phase_p3_2_labels_and_cron_locks.sql` | `wa_conversations.labels`, `public.cron_locks` | ❌ **UNAPPLIED** | ✅ PASS | Persistent labels + distributed cron locks. |

---

## 3. Discrepancy Reconciliation & Schema Gap Analysis

### 3.1 Reconciliation of Discrepancies Identified in P3.1
1. **Missing `wa_conversations.labels`:** Resolved in Migration 024. Table `public.wa_conversations` receives `labels TEXT[] NOT NULL DEFAULT '{}'::text[]` with GIN index `idx_wa_conversations_labels`.
2. **Missing `public.cron_locks`:** Resolved in Migration 024. Table `public.cron_locks` and security-definer RPCs (`acquire_cron_lock`, `renew_cron_lock`, `release_cron_lock`, `get_cron_lock_status`) created.
3. **Queue Dead-Letter Support across all 4 Queues:** Resolved in Migration 023. Check constraints on `wa_processing_jobs`, `wa_scheduled_messages`, `wa_campaign_recipients`, and `crm_follow_up_reminders` updated to allow `'dead_letter'`.
4. **Realtime Publication for Visual Flows:** Migration 022 adds `wa_visual_flows` to `supabase_realtime` publication (`ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_visual_flows;`).

### 3.2 Application Query & Schema Alignment Matrix
All application database interactions have been audited against the new 024 schema:

| Application Module | Target Table(s) / Column(s) | Migration Providing Definition | Integrity Status |
|:---|:---|:---:|:---:|
| `src/lib/inbox/database.ts` | `wa_conversations.labels` | Migration 024 | Aligned |
| `src/lib/cron/coordinator.ts` | `public.cron_locks` | Migration 024 | Aligned |
| `src/lib/observability/worker-health.ts` | `worker_execution_runs` | Migration 023 | Aligned |
| `src/lib/observability/recovery.ts` | `reclaim_stuck_queue_jobs`, `retry_queue_job` | Migration 023 | Aligned |
| `src/lib/automation/visual-flow-engine.ts` | `wa_visual_flows` | Migration 022 | Aligned |
| `src/lib/notifications/service.ts` | `internal_notifications`, `crm_follow_up_reminders` | Migration 021 | Aligned |
| `src/lib/crm/database.ts` | `crm_lifecycle_stages`, `crm_follow_ups` | Migration 020 | Aligned |
| `src/lib/campaigns/worker.ts` | `wa_campaigns`, `wa_campaign_recipients` | Migration 019 | Aligned |
| `src/lib/scheduled/worker.ts` | `wa_scheduled_messages` | Migration 018 | Aligned |
| `src/lib/media/storage.ts` | `wa_media_files` | Migration 017 | Aligned |
| `src/lib/team/store.ts` | `team_invitations`, `business_audit_logs` | Migration 016 | Aligned |

---

## 4. Staged Execution Plan for Remote Supabase (Preflight Checklist)

When authorized by stakeholders during Phase P4 deployment, execute the pending migrations sequentially according to this standard operating procedure:

1. **Database Snapshot:** Perform an immediate manual backup of project `ansiwtwqgrfmzfrhkzuu` via the Supabase Dashboard.
2. **Sequential Application:** Apply migrations 016 through 024 in order using the Supabase CLI (`supabase db push`) or SQL Query Editor:
   - `016_phase12_1_team_management_and_agent_assignment.sql`
   - `017_phase12_2_media_messaging.sql`
   - `018_phase12_3_scheduled_messages.sql`
   - `019_phase12_4_campaign_management.sql`
   - `020_phase12_5_crm_lifecycle_and_followups.sql`
   - `021_phase12_6_notification_center_and_durable_reminders.sql`
   - `022_phase12_7_visual_flows_and_realtime.sql`
   - `023_phase2_operational_reliability.sql`
   - `024_phase_p3_2_labels_and_cron_locks.sql`
3. **Verification:** Execute `node scripts/inspect-all-live-migrations.mjs` to confirm all 24 migration modules report `✅ APPLIED`.
