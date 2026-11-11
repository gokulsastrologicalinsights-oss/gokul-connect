# GOKUL CONNECT — P4 LIVE DATABASE MIGRATION PLAN
## Live Production Database Migration Execution Plan & Safety Review

**Project:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Target Supabase Project:** `ansiwtwqgrfmzfrhkzuu` (`gokul-connect`, AWS Mumbai `ap-south-1`)  
**Database Version:** PostgreSQL 17.11  
**Execution Gate:** **APPROVAL GATE 1 — DATABASE MIGRATION**  
**Date:** `2026-11-09`  
**Status:** **AWAITING USER APPROVAL — ZERO MUTATIONS EXECUTED**  

---

## 1. Remote Ledger Audit & Baseline Status

A live read-only inspection was executed against the dedicated Supabase project `https://ansiwtwqgrfmzfrhkzuu.supabase.co`.

### 1.1 Verified Applied Live Migrations (001 – 015)
The live migration baseline consists of Migrations 001 through 015, confirmed active on `ansiwtwqgrfmzfrhkzuu`:

| Version | Migration Name | Applied Status | Key Schema Objects Verified Live |
|---|---|:---:|---|
| `001` | `20261106_001_phase1_foundation.sql` | Applied | `businesses`, `user_profiles`, `business_members`, RLS policies |
| `002` | `20261106_002_phase2_wa_connections.sql` | Applied | `wa_connections`, `business_settings`, immutable business triggers |
| `003` | `20261106_003_phase2_wa_credentials.sql` | Applied | `wa_credentials` (AES-256-GCM vault) |
| `004` | `20261106_004_phase2_privilege_escalation_guard.sql` | Applied | `guard_business_member_roles()` trigger |
| `005` | `20261106_005_phase3_messaging_schema.sql` | Applied | `wa_contacts`, `wa_conversations`, `wa_messages`, `wa_message_templates` |
| `006` | `20261106_006_phase3_webhook_persistence_rpcs.sql` | Applied | Inbound webhook persistence RPCs |
| `007` | `20261107_007_phase3i_performance_optimizations.sql` | Applied | Covering indexes, `get_chat_thread` RPC |
| `008` | `20261106_008_phase3h_webhook_events_rls.sql` | Applied | `wa_webhook_events` table & RLS |
| `009` | `20261106_009_phase5_automation_engine_schema.sql` | Applied | `wa_automation_rules`, `wa_automation_execution_logs` |
| `010` | `20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql` | Applied | `wa_processing_jobs`, `ingest_wa_inbound_message_v2` RPC |
| `011` | `20261107_011_phase7_5_queue_rpc_privilege_hardening.sql` | Applied | Least-privilege function execute grants |
| `012` | `20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql` | Applied | Arbiter unique index predicate alignment |
| `013` | `20261107_013_phase9_crm_and_contacts.sql` | Applied | `crm_categories`, `crm_segments`, `contact_notes`, `contact_activity_logs` |
| `014` | `20261107_014_phase10_analytics_rpcs.sql` | Applied | `get_business_analytics_summary`, `get_business_analytics_daily_trends` |
| `015` | `20261107_015_phase11_template_management.sql` | Applied | `meta_template_id`, `rejection_reason`, `is_archived`, `last_synced_at` |

---

## 2. Proposed Migrations for Production Application (016 – 023)

The following 8 forward-only migrations are pending application. Each migration has been verified via clean-slate replay in an isolated PostgreSQL engine (PGlite) with 100% test pass rates:

### Migration 016: Team Management & Agent Assignment
- **File:** `supabase/migrations/20261107_016_phase12_1_team_management_and_agent_assignment.sql`
- **Affected Tables:** `public.conversation_assignment_logs`, `public.team_invitations`, `public.business_audit_logs`, `public.wa_conversations` (foreign key & column extensions).
- **Key Changes:**
  - Creates `conversation_assignment_logs` tracking agent assignment history per conversation.
  - Creates `team_invitations` managing time-limited invitation tokens (`expires_at`, `accepted_at`, `status`).
  - Creates `business_audit_logs` capturing 10 team events (`member_invited`, `role_changed`, etc.).
  - Enforces `assigned_agent_id` composite foreign key referencing `business_members(business_id, user_id)`.
  - Attaches tenant immutability triggers and RLS policies.
- **Risk Level:** Low (Purely additive tables and non-destructive column additions).

### Migration 017: Multi-Format Media Messaging
- **File:** `supabase/migrations/20261107_017_phase12_2_media_messaging.sql`
- **Affected Tables:** `public.wa_messages`, `public.wa_media_files`.
- **Key Changes:**
  - Extends `wa_messages.message_type` check constraint to permit `'video'` alongside `text`, `image`, `document`, `audio`, `template`.
  - Adds media metadata columns to `wa_messages`: `media_id`, `media_type`, `mime_type`, `file_name`, `file_size`, `caption`, `storage_path`, `download_status`, `uploaded_at`.
  - Creates `public.wa_media_files` table with composite tenant foreign key.
  - Adds trigger `trg_wa_messages_populate_media` automatically parsing incoming media payload.
- **Risk Level:** Low (Check constraint expansion; additive nullable columns).

### Migration 018: Scheduled Messages & Durable Scheduling
- **File:** `supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql`
- **Affected Tables:** `public.wa_scheduled_messages`.
- **Key Changes:**
  - Creates `wa_scheduled_messages` table supporting plain text, approved templates, and media formats.
  - Creates atomic claiming RPC `claim_next_scheduled_messages` (`FOR UPDATE SKIP LOCKED`).
  - Creates stuck-job auto-recovery RPC `reclaim_stuck_scheduled_messages` (5-minute lock boundary).
  - Sync trigger `trg_wa_messages_sync_scheduled_status` reflecting delivery/read status.
- **Risk Level:** Low (Additive table and isolated background worker RPCs).

### Migration 019: Campaign Management & Bulk Messaging
- **File:** `supabase/migrations/20261108_019_phase12_4_campaign_management.sql`
- **Affected Tables:** `public.wa_campaigns`, `public.wa_campaign_recipients`.
- **Key Changes:**
  - Creates `wa_campaigns` table with campaign configuration, status lifecycle, and metrics.
  - Creates `wa_campaign_recipients` tracking recipient-level delivery, status, and error logs.
  - Creates atomic recipient claiming RPC `claim_next_campaign_recipients` (`FOR UPDATE SKIP LOCKED`).
  - Creates stuck campaign recovery RPC `reclaim_stuck_campaign_recipients`.
- **Risk Level:** Low (Additive tables; strict tenant foreign keys).

### Migration 020: Advanced CRM Customer Lifecycle & Follow-ups
- **File:** `supabase/migrations/20261108_020_phase12_5_crm_lifecycle_and_followups.sql`
- **Affected Tables:** `public.crm_lifecycle_stages`, `public.contact_lifecycle_history`, `public.crm_follow_ups`, `public.crm_follow_up_reminders`, `public.wa_contacts` (lifecycle foreign keys).
- **Key Changes:**
  - Creates configurable lifecycle stages (`crm_lifecycle_stages`) seeded for Astrology and Vivaham.
  - Creates follow-up task manager (`crm_follow_ups`) and internal team reminders (`crm_follow_up_reminders`).
  - Creates reminder claiming RPC `claim_next_reminder_jobs` and stuck recovery RPC `reclaim_stuck_reminder_jobs`.
  - Enforces unique deduplication constraint `uq_crm_follow_up_reminders_dedup`.
- **Risk Level:** Low (Additive tables and internal reminder tracking).

### Migration 021: Internal Notification Center
- **File:** `supabase/migrations/20261109_021_phase12_6_notification_center_and_durable_reminders.sql`
- **Affected Tables:** `public.internal_notifications`, `public.user_notification_preferences`.
- **Key Changes:**
  - Creates `internal_notifications` table for in-app staff alerts (CRM, team, system).
  - Creates `user_notification_preferences` table with category toggles and lead-time settings.
  - Adds composite tenant indexes and strict RLS policies.
- **Risk Level:** Low (Purely internal in-app notification infrastructure).

### Migration 022: Visual Flows & Realtime Support
- **File:** `supabase/migrations/20261109_022_phase12_7_visual_flows_and_realtime.sql`
- **Affected Tables:** `public.wa_visual_flows`, `supabase_realtime` publication.
- **Key Changes:**
  - Creates `wa_visual_flows` storing visual graph configurations (nodes, edges, triggers, viewport).
  - Enables Supabase Realtime publication on `public.wa_messages` and `public.wa_conversations` for dynamic unread counter updates.
- **Risk Level:** Low (Additive table; enables PostgREST WebSocket publication on existing messaging tables).

### Migration 023: Operational Reliability & System Observability
- **File:** `supabase/migrations/20261109_023_phase2_operational_reliability.sql`
- **Affected Tables:** `public.system_health_metrics`, `public.worker_execution_runs`, queue status check updates.
- **Key Changes:**
  - Creates `system_health_metrics` and `worker_execution_runs` tracking worker latency, queue backlog, and failures.
  - Updates status check constraints on `wa_processing_jobs` to support `dead_letter` status.
  - Creates RPCs `get_worker_health_metrics`, `reclaim_stuck_queue_jobs`, and `retry_queue_job`.
- **Risk Level:** Low (Additive observability schema; non-destructive check constraint updates).

---

## 3. Dependency Graph & Application Sequence

The migrations are strictly sequential and must be applied in exact numerical order:

```
015 (Live Baseline)
 └──> 016 (Team & RBAC)
       └──> 017 (Media Messaging)
             └──> 018 (Scheduled Messages)
                   └──> 019 (Campaigns)
                         └──> 020 (CRM Lifecycle)
                               └──> 021 (Notifications)
                                     └──> 022 (Visual Flows & Realtime)
                                           └──> 023 (Operational Reliability)
```

---

## 4. Potential Risks & Mitigation Strategy

| Risk Scenario | Probability | Impact | Mitigation Strategy |
|---|:---:|:---:|---|
| **SQL Syntax / Dialect Error** | Negligible | Low | All 8 migrations have been tested on PostgreSQL 16/17 via PGlite and passed 100% of test suites. |
| **Partial Execution Failure** | Low | Medium | Each migration executes inside an atomic PostgreSQL transaction (`BEGIN ... COMMIT`). A failure automatically rolls back without committing partial state. |
| **Lock Contention / Table Lock** | Low | Low | Tables are low-volume / staging state. No long-running queries exist. Migration execution takes < 5 seconds total. |
| **Cross-Tenant Data Leakage** | Zero | Critical | Every table has strict RLS enabled with `business_id` scoping and tenant immutability triggers. |
| **Existing Data Modification** | Zero | Critical | Zero `UPDATE` or `DELETE` statements on business records exist in any of migrations 016–023. |

---

## 5. Pre-Application Backup & Snapshot Procedure

Immediately prior to executing any remote migration:
1. Capture a JSON snapshot of table metadata and row counts for `businesses`, `business_members`, `wa_connections`, `wa_credentials`, `wa_contacts`, `wa_conversations`, `wa_messages`, `wa_message_templates`.
2. Save snapshot to `scripts/backup/<timestamp>_p4_pre_migration_baseline.json`.
3. Record preflight checksums of all 8 migration SQL files.

---

## 6. Post-Migration Verification Plan

Immediately after migration execution:
1. Run automated catalog verification checking all 8 new tables and updated check constraints.
2. Execute authenticated RLS tests verifying:
   - Anonymous access is denied (401 / 42501).
   - Astrology user accesses only Astrology rows.
   - Vivaham user accesses only Vivaham rows.
   - Cross-tenant queries return 0 rows.
3. Verify baseline table row counts remain 100% unchanged.
4. Run full Vitest regression suite (744/744 tests).

---

## 7. APPROVAL GATE 1 — DATABASE MIGRATION

> [!IMPORTANT]
> **GATE 1 STATUS: AWAITING USER APPROVAL**  
> In compliance with Execution Rule 4 and Rule 15, no remote database migrations will be applied until explicit user approval is granted.

### Proposed Action:
Apply forward-only migrations **016 through 023** to dedicated Supabase project `ansiwtwqgrfmzfrhkzuu` in AWS Mumbai (`ap-south-1`).
