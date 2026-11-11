# GOKUL CONNECT — P4 GATE 2: PRODUCTION DATABASE ROLLBACK PLAN
## Multi-Tiered Rollback Procedures, Automated Reversal Scripts & Disaster Recovery Protocols

**Target System:** Gokul Connect (Production Release Workflow)  
**Live Supabase Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`) — Region `ap-south-1`  
**Backup Dump Source:** `E:\GAI\GokulConnect_Backups\gokul_connect_pre_migration_20261110_125227.dump`  
**Backup SHA-256:** `BCE1C32A9D6027CF79063AD9A97C3FB3257D38F2065678CBCE962B3B21708BCD`  
**Execution Milestone:** P4 Gate 2 (Rollback Architecture & Procedures)  
**Audit Timestamp:** `2026-11-10 18:45 IST`  
**Restriction:** **PROCEDURAL DOCUMENT ONLY — ZERO LIVE ROLLBACK ACTIONS TRIGGERED**  

---

## 1. Rollback Objectives & Trigger Thresholds

The rollback strategy guarantees that if any unexpected error, statement failure, connection drop, or data anomaly occurs during the execution of migrations 016–024, the production database can be restored to the pure pre-migration baseline (Migrations 001–015) with zero data loss.

### Rollback Trigger Criteria:
| Trigger Condition | Threshold / Signal | Mandated Action |
|---|---|---|
| **SQL Syntax / DDL Error** | Any migration exits with non-zero code | Immediate `ROLLBACK` of active transaction |
| **Lock Contention Timeout** | Migration statement exceeds `5,000 ms` lock wait | Cancel statement, abort transaction, re-evaluate lock |
| **Integrity / FK Violation** | Composite foreign key or tenant violation | Abort transaction immediately |
| **Partial Failure / Mid-Sequence Halt** | Network disruption or unhandled exception during migrations 016–024 | Stop immediately; apply Down-Migration or Full Dump Restore |
| **Post-Migration Parity Drift** | Baseline row count $\ne 72$ or baseline table count $\ne 20$ | Trigger Tier 2 (Inverse Script) or Tier 3 (Full Restore) |

---

## 2. Multi-Tiered Rollback Strategy

```
                                  [FAILURE DETECTED]
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
         [During Transaction]                            [After Commit / Sequence]
                  │                                               │
         ╔═════════════════════╗                         ╔═════════════════════╗
         ║       TIER 1        ║                         ║       TIER 2        ║
         ║   Automatic In-Tx   ║                         ║  Automated Reverse  ║
         ║   Abort / Rollback  ║                         ║   Down-Migrations   ║
         ╚═════════════════════╝                         ╚═════════════════════╝
                  │                                               │
           (Clean recovery:                                (Clean rollback:
           Zero residue)                                   Tables & cols dropped)
                                                                  │
                                                        (If unrecoverable)
                                                                  │
                                                                  ▼
                                                         ╔═════════════════════╗
                                                         ║       TIER 3        ║
                                                         ║ Full Disaster Dump  ║
                                                         ║ Restore via pg_rest.║
                                                         ╚═════════════════════╝
```

---

## 3. Tier 1: In-Flight Transactional Abort (Immediate)

Because each migration is wrapped in an atomic transaction:
```sql
\set ON_ERROR_STOP on
BEGIN;
-- <migration DDL statements>
COMMIT;
```
If any error occurs:
1. PostgreSQL aborts the transaction immediately.
2. All DDL alterations (created tables, altered columns, triggers, functions, and RLS policies) in that migration are discarded automatically by PostgreSQL's write-ahead log (WAL).
3. The database remains at the exact state of the prior committed migration.

---

## 4. Tier 2: Inverse / Down-Migration Reversal Script

If migrations 016 through $K$ have committed and a rollback to the baseline is mandated, the automated reversal script must be executed in strict reverse dependency order ($K$ down to 016).

This script was tested and verified in Gate 2 rehearsal against native PostgreSQL 17:

```sql
-- ==============================================================================
-- GOKUL CONNECT — REVERSAL SCRIPT FOR MIGRATIONS 016 TO 024
-- ==============================================================================

\set ON_ERROR_STOP on
BEGIN;

-- ------------------------------------------------------------------------------
-- 1. REVERSE MIGRATION 024 (Labels & Distributed Cron Locks)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.cron_locks CASCADE;
DROP FUNCTION IF EXISTS public.acquire_cron_lock(TEXT, TEXT, TEXT, INT, UUID, JSONB);
DROP FUNCTION IF EXISTS public.renew_cron_lock(TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.release_cron_lock(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_cron_lock_status(TEXT);
ALTER TABLE public.wa_conversations DROP COLUMN IF EXISTS labels;

-- ------------------------------------------------------------------------------
-- 2. REVERSE MIGRATION 023 (Operational Reliability)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.system_health_metrics CASCADE;
DROP TABLE IF EXISTS public.worker_execution_runs CASCADE;
DROP FUNCTION IF EXISTS public.reclaim_stuck_wa_jobs(INT);
DROP FUNCTION IF EXISTS public.get_operational_health_summary(UUID, INT);

-- ------------------------------------------------------------------------------
-- 3. REVERSE MIGRATION 022 (Visual Flows & Realtime)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.wa_visual_flows CASCADE;

-- ------------------------------------------------------------------------------
-- 4. REVERSE MIGRATION 021 (Notification Center & Durable Reminders)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.user_notification_preferences CASCADE;
ALTER TABLE public.crm_follow_up_reminders
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS action_url,
    DROP COLUMN IF EXISTS metadata,
    DROP COLUMN IF EXISTS is_dismissed,
    DROP COLUMN IF EXISTS dismissed_at,
    DROP COLUMN IF EXISTS dedup_key;
DROP FUNCTION IF EXISTS public.claim_pending_notifications(INT, TEXT);
DROP FUNCTION IF EXISTS public.reclaim_stuck_notifications(INT);
DROP FUNCTION IF EXISTS public.mark_all_notifications_read(UUID, UUID);

-- ------------------------------------------------------------------------------
-- 5. REVERSE MIGRATION 020 (CRM Lifecycle & Followups)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.contact_lifecycle_history CASCADE;
DROP TABLE IF EXISTS public.crm_follow_up_reminders CASCADE;
DROP TABLE IF EXISTS public.crm_follow_ups CASCADE;
ALTER TABLE public.wa_contacts DROP COLUMN IF EXISTS lifecycle_stage_id;
DROP TABLE IF EXISTS public.crm_lifecycle_stages CASCADE;
DROP FUNCTION IF EXISTS public.reassign_lifecycle_stage_contacts(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.get_crm_lifecycle_stats(UUID);

-- ------------------------------------------------------------------------------
-- 6. REVERSE MIGRATION 019 (Campaign Management)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.wa_campaign_recipients CASCADE;
DROP TABLE IF EXISTS public.wa_campaigns CASCADE;
DROP FUNCTION IF EXISTS public.claim_next_campaign_recipients(UUID, INT, TEXT);
DROP FUNCTION IF EXISTS public.reclaim_stuck_campaign_recipients(INT);
DROP FUNCTION IF EXISTS public.update_campaign_progress_counters(UUID);

-- ------------------------------------------------------------------------------
-- 7. REVERSE MIGRATION 018 (Scheduled Messaging)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.wa_scheduled_messages CASCADE;
DROP FUNCTION IF EXISTS public.claim_next_scheduled_messages(INT, TEXT);
DROP FUNCTION IF EXISTS public.reclaim_stuck_scheduled_messages(INT);

-- ------------------------------------------------------------------------------
-- 8. REVERSE MIGRATION 017 (Media Messaging Support)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.wa_media_files CASCADE;
DROP TRIGGER IF EXISTS trg_wa_messages_populate_media ON public.wa_messages;
DROP FUNCTION IF EXISTS public.populate_wa_message_media_fields();
ALTER TABLE public.wa_messages
    DROP COLUMN IF EXISTS media_type,
    DROP COLUMN IF EXISTS media_id,
    DROP COLUMN IF EXISTS mime_type,
    DROP COLUMN IF EXISTS file_name,
    DROP COLUMN IF EXISTS file_size,
    DROP COLUMN IF EXISTS caption,
    DROP COLUMN IF EXISTS storage_path,
    DROP COLUMN IF EXISTS media_url,
    DROP COLUMN IF EXISTS download_status,
    DROP COLUMN IF EXISTS downloaded_at,
    DROP COLUMN IF EXISTS uploaded_at,
    DROP COLUMN IF EXISTS media_error;

-- ------------------------------------------------------------------------------
-- 9. REVERSE MIGRATION 016 (Team Management & Agent Assignment)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS public.conversation_assignment_logs CASCADE;
DROP TABLE IF EXISTS public.team_activity_logs CASCADE;
DROP TABLE IF EXISTS public.business_invitations CASCADE;
DROP TRIGGER IF EXISTS trg_business_members_guard_privileges ON public.business_members;
DROP FUNCTION IF EXISTS public.guard_business_member_roles();
ALTER TABLE public.wa_conversations
    DROP COLUMN IF EXISTS assigned_agent_id,
    DROP COLUMN IF EXISTS assigned_agent_name,
    DROP COLUMN IF EXISTS assigned_at;
ALTER TABLE public.business_members
    DROP COLUMN IF EXISTS last_login_at;

-- ------------------------------------------------------------------------------
-- 10. REVERT MIGRATION LEDGER
-- ------------------------------------------------------------------------------
DELETE FROM supabase_migrations.schema_migrations
WHERE version IN (
    '20261107_016', '20261107_017', '20261108_018',
    '20261108_019', '20261108_020', '20261109_021',
    '20261109_022', '20261109_023', '20261109_024'
);

COMMIT;
```

---

## 5. Tier 3: Full Disaster Recovery Restoration from Backup Dump

In the catastrophic event that database state or integrity is severely compromised:

1. **Verify Backup Archive:**
   - Confirm archive exists at:  
     `E:\GAI\GokulConnect_Backups\gokul_connect_pre_migration_20261110_125227.dump`
   - Verify SHA-256 hash matches:  
     `BCE1C32A9D6027CF79063AD9A97C3FB3257D38F2065678CBCE962B3B21708BCD`
2. **Execute Full Restoration via PostgreSQL 17 Tooling:**
   ```powershell
   & "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" `
       -h aws-0-ap-south-1.pooler.supabase.com `
       -p 5432 `
       -U postgres.ansiwtwqgrfmzfrhkzuu `
       -d postgres `
       --clean `
       --if-exists `
       --no-owner `
       --no-privileges `
       "E:\GAI\GokulConnect_Backups\gokul_connect_pre_migration_20261110_125227.dump"
   ```
3. **Execute Post-Restore Parity Assertion:**
   - Assert all 20 public application tables exist.
   - Assert total row count is exactly 72.
   - Assert zero upcoming migration tables exist.

---

## 6. Post-Rollback Verification & Sign-Off Checklist

| # | Assertion Check | Verification Query | Expected Outcome |
|:---:|---|---|:---:|
| 1 | Public Table Count | `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';` | Exactly `20` |
| 2 | Baseline Rows Preserved | Sum of counts across all 20 public tables | Exactly `72` |
| 3 | Core Businesses Intact | `SELECT count(*) FROM public.businesses WHERE is_active = true;` | Exactly `2` |
| 4 | Upcoming Tables Removed | `SELECT count(*) FROM information_schema.tables WHERE table_name IN ('cron_locks', 'wa_campaigns', 'wa_media_files');` | Exactly `0` |
| 5 | Conversation Labels Removed | `SELECT column_name FROM information_schema.columns WHERE table_name = 'wa_conversations' AND column_name = 'labels';` | `0 rows` |
| 6 | Application Test Suite | `npm test` | `51/51 passed, 779/779 passed` |
