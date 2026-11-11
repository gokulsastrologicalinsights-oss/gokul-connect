# GOKUL CONNECT — P4 GATE 2: PRODUCTION DATABASE MIGRATION PLAN
## Detailed Execution Plan, Dependency Architecture & Operational Procedures for Migrations 016–024

**Target System:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Live Supabase Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`) — AWS `ap-south-1`  
**Baseline State:** Migrations 001–015 Applied (Verified Pure Baseline, 20 public tables, 72 baseline rows)  
**Target State:** Migrations 016–024 Applied (35 public tables, 227 constraints, 198 indexes, 37 functions, 36 triggers, 74 RLS policies)  
**Execution Milestone:** P4 Gate 2 (Migration Planning & Rehearsal)  
**Audit Timestamp:** `2026-11-10 18:45 IST`  
**Execution Restriction:** **PLANNING ONLY — ZERO LIVE MIGRATIONS AUTHORIZED UNDER THIS DOCUMENT**  

---

## 1. Executive Summary

This document specifies the step-by-step production execution plan for applying the nine pending database migrations (`016` through `024`) to the dedicated production Supabase project `ansiwtwqgrfmzfrhkzuu`.

All nine migrations have been audited line-by-line, verified for backward compatibility against the PostgreSQL 17.11 baseline, and fully rehearsed against the isolated PostgreSQL 17 cluster (Port 5433).

### Key Architectural Characteristics:
1. **100% Single-Transaction Compatible:** Every migration script executes within an atomic transaction block (`BEGIN ... COMMIT`).
2. **Strict Multi-Tenant Isolation:** Every new table includes `business_id UUID REFERENCES public.businesses(id)` with tenant immutability triggers and Row Level Security (RLS) policies.
3. **Zero Prohibited SQL Operations:** Zero occurrences of non-transactional statements (`CREATE INDEX CONCURRENTLY`, `VACUUM`, `ALTER SYSTEM`).
4. **Negligible Lock Contention:** Table alterations (`wa_conversations`, `wa_messages`, `business_members`, `wa_contacts`) hold metadata-only catalog locks measured at `<25ms` total duration.

---

## 2. Migration Inventory & Dependency Architecture

```
                                  [Baseline Migrations 001–015]
                   (businesses, user_profiles, wa_conversations, wa_messages, wa_contacts)
                                                │
         ┌──────────────────────────────────────┼──────────────────────────────────────┐
         ▼                                      ▼                                      ▼
   Migration 016                          Migration 017                          Migration 020
   (Team Management)                      (Media Messaging)                      (CRM Lifecycle)
   • business_invitations                 • wa_media_files                       • crm_lifecycle_stages
   • team_activity_logs                   • wa_messages columns                  • crm_follow_ups
   • conversation_assignment_logs         • media triggers                       • crm_follow_up_reminders
   • wa_conversations agent columns             │                                • contact_lifecycle_history
         │                                      │                                      │
         ├──────────────────────────────────────┼──────────────────────────────────────┤
         ▼                                      ▼                                      ▼
   Migration 018                          Migration 019                          Migration 021
   (Scheduled Messaging)                  (Campaign Management)                  (Notification Center)
   • wa_scheduled_messages                • wa_campaigns                         • user_notification_preferences
   • claim_next_scheduled_messages        • wa_campaign_recipients               • crm_follow_up_reminders ext.
   • stuck-job recovery RPCs              • progress counter RPCs                • claim/reclaim notification RPCs
         │                                      │                                      │
         └──────────────────────────────────────┼──────────────────────────────────────┘
                                                ▼
                                          Migration 022
                                          (Visual Flows & Realtime)
                                          • wa_visual_flows
                                          • supabase_realtime publication
                                                │
                                                ▼
                                          Migration 023
                                          (Operational Reliability)
                                          • worker_execution_runs
                                          • wa_processing_jobs dead-letter status
                                          • reclaim_stuck_wa_jobs RPC
                                                │
                                                ▼
                                          Migration 024
                                          (Labels & Distributed Cron Locks)
                                          • wa_conversations.labels TEXT[] + GIN index
                                          • cron_locks distributed coordination table
                                          • atomic acquire/renew/release cron lock RPCs
```

### Detailed Migration Specifications:

| Sequence | Migration File | Target Scope | New Tables Created | Extended Existing Tables | Core Functions / Triggers |
|:---:|---|---|---|---|---|
| **1** | `20261107_016_phase12_1_team_management_and_agent_assignment.sql` | Role-based team access, invitations, agent assignment | `business_invitations`, `team_activity_logs`, `conversation_assignment_logs` | `business_members` (last_login_at, role check), `wa_conversations` (assigned agent) | `guard_business_member_roles()`, tenant immutability triggers |
| **2** | `20261107_017_phase12_2_media_messaging.sql` | Inbound/outbound images, docs, audio, video metadata | `wa_media_files` | `wa_messages` (12 media columns + type check) | `populate_wa_message_media_fields()`, tenant immutability triggers |
| **3** | `20261108_018_phase12_3_scheduled_messages.sql` | Durable scheduled dispatch, atomic claiming, cancellation | `wa_scheduled_messages` | None | `claim_next_scheduled_messages()`, `reclaim_stuck_scheduled_messages()` |
| **4** | `20261108_019_phase12_4_campaign_management.sql` | Bulk campaigns, recipient queues, progress counters | `wa_campaigns`, `wa_campaign_recipients` | None | `claim_next_campaign_recipients()`, `update_campaign_progress_counters()` |
| **5** | `20261108_020_phase12_5_crm_lifecycle_and_followups.sql` | Multi-stage CRM pipelines, tasks, follow-up reminders | `crm_lifecycle_stages`, `crm_follow_ups`, `crm_follow_up_reminders`, `contact_lifecycle_history` | `wa_contacts` (lifecycle_stage_id) | `reassign_lifecycle_stage_contacts()`, `get_crm_lifecycle_stats()` |
| **6** | `20261109_021_phase12_6_notification_center_and_durable_reminders.sql` | Workspace notification bell, user preferences, reminder queue | `user_notification_preferences` | `crm_follow_up_reminders` (extended with notification categories) | `claim_pending_notifications()`, `reclaim_stuck_notifications()`, `mark_all_notifications_read()` |
| **7** | `20261109_022_phase12_7_visual_flows_and_realtime.sql` | Visual drag-and-drop flow persistence, Realtime replication | `wa_visual_flows` | None | Realtime publication attachment for `wa_messages`, `wa_conversations`, `wa_visual_flows` |
| **8** | `20261109_023_phase2_operational_reliability.sql` | Worker telemetry, dead-letter classification, health summaries | `worker_execution_runs` | `wa_processing_jobs`, `wa_scheduled_messages`, `wa_campaign_recipients`, `crm_follow_up_reminders` (dead_letter status) | `reclaim_stuck_wa_jobs()`, `get_operational_health_summary()` |
| **9** | `20261109_024_phase_p3_2_labels_and_cron_locks.sql` | Distributed PostgreSQL cron locks, conversation labels | `cron_locks` | `wa_conversations` (labels TEXT[] with GIN index) | `acquire_cron_lock()`, `renew_cron_lock()`, `release_cron_lock()`, `get_cron_lock_status()` |

---

## 3. Strict Pre-Migration Safeguards & Entry Criteria

Before initiating live migration execution on Supabase, ALL of the following conditions must be fulfilled:

1. **Gate 1.4 Backup Qualified:** Backup archive `gokul_connect_pre_migration_20261110_125227.dump` (SHA-256: `BCE1C32A9D6027CF79063AD9A97C3FB3257D38F2065678CBCE962B3B21708BCD`) confirmed intact.
2. **Explicit Human Authorization:** A separate human operator command explicitly authorizing production migration execution.
3. **Application Workers Dormant:** All background cron workers (`automation_worker`, `campaign_worker`, `scheduled_worker`, `crm_reminder_worker`) must remain dormant (`CRON_ENABLED` not enabled).
4. **Maintenance Window Protocol:** Off-peak execution window selected; estimated migration execution time is `<5 seconds` total.
5. **Session-Level Execution Boundary:** Each migration must execute in its own dedicated transaction:
   ```sql
   \set ON_ERROR_STOP on
   BEGIN;
   -- <migration SQL>
   INSERT INTO supabase_migrations.schema_migrations (version, statements) VALUES ('...', '...');
   COMMIT;
   ```

---

## 4. Live Migration Execution Protocol (Step-by-Step)

The live execution must follow this exact step sequence:

### Step 1: Preflight Connectivity & Schema Baseline Assertion
Execute a read-only probe asserting:
- `SELECT count(*) FROM public.businesses;` = `2`
- `SELECT count(*) FROM public.wa_messages;` = `15`
- `SELECT count(*) FROM public.wa_webhook_events;` = `20`
- Confirm `conversation_assignment_logs`, `wa_media_files`, `cron_locks` do NOT exist.

### Step 2: Sequential Transactional Execution
For each migration $N \in [016..024]$:
1. Open database connection.
2. Begin transaction `BEGIN`.
3. Apply migration $N$.
4. Verify migration signature object exists (e.g., `SELECT 1 FROM public.<new_table> LIMIT 1;`).
5. Record migration entry in `supabase_migrations.schema_migrations`.
6. Commit transaction `COMMIT`.
7. Log execution latency and status.

### Step 3: Post-Execution Schema & Parity Assertion
Execute automated verification asserting:
- 35 public tables exist.
- 227 constraints active.
- 198 indexes active.
- 37 functions active.
- 36 triggers active.
- 74 RLS policies active.
- Baseline data row counts: exactly 72 rows preserved across baseline tables.

---

## 5. Post-Migration Manual Dashboard Operations

Following database migration, the following platform configurations must be verified in the Supabase Dashboard:

1. **Storage Bucket Verification:**
   - Navigate to **Storage** -> **Buckets**.
   - Verify bucket `whatsapp-media` exists as a **Private** bucket.
   - If absent, create `whatsapp-media` with private ACL (required before media messaging activation).
2. **Realtime Replication Verification:**
   - Navigate to **Database** -> **Replication**.
   - Confirm that publication `supabase_realtime` includes:
     - `public.wa_messages`
     - `public.wa_conversations`
     - `public.wa_visual_flows`
3. **Cron Secret Configuration:**
   - Verify `CRON_SECRET` is set in Vercel project environment variables to authorize inbound cron requests.
