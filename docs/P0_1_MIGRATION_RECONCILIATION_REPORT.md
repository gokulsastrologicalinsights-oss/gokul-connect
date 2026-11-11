# GOKUL CONNECT — P0.1: MIGRATION HISTORY RECONCILIATION REPORT

**Audit & Reconciliation Date:** `2026-11-06`  
**Platform:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Dedicated Supabase Project:** `gokul-connect`  
**Supabase Project Ref:** `ansiwtwqgrfmzfrhkzuu`  
**Database Engine:** PostgreSQL 17.6 on Supabase AWS `ap-south-1`  
**Author:** Pair Programming Agent (Antigravity)  
**Status:** **RECONCILED (Duplicate File Renumbered, Schema State Audited, Baseline Plan Defined)**

---

## 1. Executive Summary

This report documents the resolution of duplicate migration version numbering (`008`) identified during the P0 cross-phase integrity audit of Gokul Connect, accompanied by a comprehensive audit of the live PostgreSQL schema in Supabase project `ansiwtwqgrfmzfrhkzuu`.

### Key Findings:
1. **Duplicate Filename Versioning:** Two migration files in `supabase/migrations/` previously shared the prefix `20261106_008_`:
   - `20261106_008_phase3h_webhook_events_rls.sql` (Phase 3H security patch)
   - `20261106_008_phase5_automation_engine_schema.sql` (Phase 5 automation engine)
2. **Live Database Status of Migration 008 (Phase 3H):**
   - **100% APPLIED**: Row-Level Security policy `"Tenant isolation for wa_webhook_events"` on `public.wa_webhook_events` is verified active in PostgreSQL with the hardened superadmin/tenant logic.
3. **Live Database Status of Duplicate Migration (Phase 5):**
   - **PARTIALLY APPLIED**: All 4 tables (`wa_automation_rules`, `wa_rule_conditions`, `wa_rule_actions`, `wa_automation_execution_logs`), 15 extended columns, 7 indexes, 3 triggers, 4 RLS policies, and 3 RPCs (`claim_next_wa_jobs`, `reclaim_stuck_wa_jobs`, `ingest_wa_inbound_message`) are verified present and active.
   - **UNAPPLIED COMPONENT**: Stored procedure `public.prune_stale_automation_records()` was **NOT** present in the database.
4. **Supabase Migration History Table Status:**
   - The standard Supabase CLI schema `supabase_migrations` and table `schema_migrations` do not currently exist in project `ansiwtwqgrfmzfrhkzuu`. Migrations to date were executed via direct SQL sessions.
5. **Actions Taken:**
   - Preserved all SQL statements without modification.
   - Renamed `20261106_008_phase5_automation_engine_schema.sql` to `20261106_009_phase5_automation_engine_schema.sql`.
   - Synchronized documentation references in `PROGRESS.md`.
   - Verified that zero live tables, columns, rows, policies, or triggers were dropped, recreated, or damaged.
   - Outlined the official baseline approach for migration history before any execution.

---

## 2. Previous vs. Reconciled Migration Inventory

| Old Filename | Reconciled Filename | Scope / Content | Live DB Status (`ansiwtwqgrfmzfrhkzuu`) |
|---|---|---|:---:|
| `20261106_001_phase1_foundation.sql` | `20261106_001_phase1_foundation.sql` | `businesses`, `user_profiles`, `business_members`, base RLS, helper functions | **100% APPLIED** |
| `20261106_002_phase2_wa_connections.sql` | `20261106_002_phase2_wa_connections.sql` | `business_settings`, `wa_connections`, composite FKs, immutability triggers | **100% APPLIED** |
| `20261106_003_phase2_wa_credentials.sql` | `20261106_003_phase2_wa_credentials.sql` | `wa_credentials` AES-256-GCM vault, strict superadmin/service RLS | **100% APPLIED** |
| `20261106_004_phase2_privilege_escalation_guard.sql` | `20261106_004_phase2_privilege_escalation_guard.sql` | `prevent_user_profile_privilege_escalation` trigger on `user_profiles` | **100% APPLIED** |
| `20261106_005_phase3_messaging_schema.sql` | `20261106_005_phase3_messaging_schema.sql` | `wa_contacts`, `wa_conversations`, `wa_messages`, `wa_message_templates`, `wa_webhook_events`, `wa_processing_jobs` | **100% APPLIED** |
| `20261106_006_phase3_webhook_persistence_rpcs.sql` | `20261106_006_phase3_webhook_persistence_rpcs.sql` | RPCs `ingest_wa_inbound_message`, `update_wa_message_status` | **100% APPLIED** |
| `20261106_007_phase3i_performance_optimizations.sql` | `20261106_007_phase3i_performance_optimizations.sql` | Covering indexes, composite lookups, `get_inbox_counts` RPC | **100% APPLIED** |
| `20261106_008_phase3h_webhook_events_rls.sql` | `20261106_008_phase3h_webhook_events_rls.sql` | Hardened RLS policy on `wa_webhook_events` (Superadmin or tenant) | **100% APPLIED** |
| `20261106_008_phase5_automation_engine_schema.sql` | `20261106_009_phase5_automation_engine_schema.sql` | Phase 5 automation tables, columns, indexes, triggers, and RPCs | **PARTIALLY APPLIED** (All schema objects applied; RPC `prune_stale_automation_records()` missing) |

---

## 3. Actual Live Database Schema Verification

A read-only SQL inspection of the live PostgreSQL instance `ansiwtwqgrfmzfrhkzuu` was performed to confirm the exact presence and configuration of all objects:

### 3.1 Public Tables (16/16 Present)
```
public.business_members
public.business_settings
public.businesses
public.user_profiles
public.wa_automation_execution_logs   <-- Added in Migration 009
public.wa_automation_rules            <-- Added in Migration 009
public.wa_connections
public.wa_contacts
public.wa_conversations
public.wa_credentials
public.wa_message_templates
public.wa_messages
public.wa_processing_jobs
public.wa_rule_actions                <-- Added in Migration 009
public.wa_rule_conditions             <-- Added in Migration 009
public.wa_webhook_events
```

### 3.2 Migration 008 (Phase 3H Webhook Events RLS) Verification
Query against `pg_policies`:
```sql
SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'wa_webhook_events';
```
**Live Result:**
- Policy Name: `Tenant isolation for wa_webhook_events`
- Roles: `{public}`
- Command: `ALL`
- Qual: `(((business_id IS NOT NULL) AND check_user_business_access(business_id)) OR is_superadmin())`
- With Check: `(((business_id IS NOT NULL) AND check_user_business_access(business_id)) OR is_superadmin())`
- **Verdict:** **100% APPLIED & VERIFIED**.

### 3.3 Migration 009 (Phase 5 Automation Engine) Verification

#### A. Table Columns Extended by Migration 009:
- `business_settings.business_hours` (`jsonb`, default weekly schedule) — **CONFIRMED**
- `business_settings.automation_settings` (`jsonb`, default `is_automation_enabled: false`) — **CONFIRMED**
- `wa_contacts.is_opted_out` (`boolean`, default `false`) — **CONFIRMED**
- `wa_contacts.opted_out_at` (`timestamptz`) — **CONFIRMED**
- `wa_contacts.opted_out_reason` (`text`) — **CONFIRMED**
- `wa_contacts.last_welcome_sent_at` (`timestamptz`) — **CONFIRMED**
- `wa_contacts.last_inbound_at` (`timestamptz`) — **CONFIRMED**
- `wa_contacts.total_inbound_count` (`integer`, default `0`) — **CONFIRMED**
- `wa_conversations.is_automation_paused` (`boolean`, default `false`) — **CONFIRMED**
- `wa_conversations.automation_paused_until` (`timestamptz`) — **CONFIRMED**
- `wa_conversations.automation_paused_by` (`uuid`) — **CONFIRMED**
- `wa_conversations.bot_reply_count_window` (`integer`, default `0`) — **CONFIRMED**
- `wa_conversations.last_bot_reply_at` (`timestamptz`) — **CONFIRMED**
- `wa_processing_jobs.idempotency_key` (`text`) — **CONFIRMED**
- `wa_processing_jobs.locked_by` (`text`) — **CONFIRMED**

#### B. Constraints and Indexes:
- `wa_processing_jobs_job_type_check` includes all 8 job types (`send_message`, `send_outbound_message`, `evaluate_rules`, `evaluate_automation_rules`, `scheduled_followup`, `process_webhook`, `process_webhook_event`, `update_status`) — **CONFIRMED**
- `uq_wa_processing_jobs_idempotency` unique partial index — **CONFIRMED**
- `idx_wa_processing_jobs_claim` partial index on `status = 'pending'` — **CONFIRMED**
- `idx_wa_contacts_opt_out` on `(business_id, is_opted_out)` — **CONFIRMED**
- `idx_wa_automation_rules_lookup` on `(business_id, is_active, priority)` — **CONFIRMED**
- `idx_wa_rule_conditions_rule_id` on `(business_id, rule_id, order_index)` — **CONFIRMED**
- `idx_wa_rule_actions_rule_id` on `(business_id, rule_id, order_index)` — **CONFIRMED**
- Composite unique and foreign key constraints on `wa_rule_conditions`, `wa_rule_actions`, `wa_automation_execution_logs` — **CONFIRMED**

#### C. Triggers:
- `trg_wa_automation_rules_immutable_business_id` — **CONFIRMED**
- `trg_wa_rule_conditions_immutable_business_id` — **CONFIRMED**
- `trg_wa_rule_actions_immutable_business_id` — **CONFIRMED**

#### D. Row Level Security Policies:
- `Tenant isolation for wa_automation_rules` — **CONFIRMED**
- `Tenant isolation for wa_rule_conditions` — **CONFIRMED**
- `Tenant isolation for wa_rule_actions` — **CONFIRMED**
- `Tenant isolation for wa_automation_execution_logs` — **CONFIRMED**

#### E. Stored Procedures / Functions:
- `claim_next_wa_jobs(p_batch_size INT, p_worker_id TEXT)` — **CONFIRMED PRESENT**
- `reclaim_stuck_wa_jobs(p_timeout_minutes INT)` — **CONFIRMED PRESENT**
- `ingest_wa_inbound_message(...)` — **CONFIRMED PRESENT** (definition contains Phase 5 additions: `last_inbound_at = v_now`, `total_inbound_count = count + 1`)
- `prune_stale_automation_records()` — **CONFIRMED MISSING (UNAPPLIED)**

---

## 4. Applied vs. Unapplied Changes Matrix

| Migration | Component | SQL Line Range | Status in Live DB | Impact |
|---|---|---|---|---|
| **008 (Phase 3H)** | Drop old `wa_webhook_events` policy | Lines 17-18 | **APPLIED** | Old overly-permissive policy removed. |
| **008 (Phase 3H)** | Create hardened `wa_webhook_events` policy | Lines 19-29 | **APPLIED** | Unassigned webhooks restricted to superadmin/service_role. |
| **009 (Phase 5)** | Extend `business_settings` | Lines 9-31 | **APPLIED** | Columns `business_hours` and `automation_settings` exist. |
| **009 (Phase 5)** | Extend `wa_contacts` & index | Lines 33-43 | **APPLIED** | Opt-out and inbound tracking columns exist. |
| **009 (Phase 5)** | Extend `wa_conversations` | Lines 45-51 | **APPLIED** | Pause and velocity limiter columns exist. |
| **009 (Phase 5)** | Extend `wa_processing_jobs` & constraint & indexes | Lines 53-79 | **APPLIED** | Check constraint, idempotency key & partial indexes exist. |
| **009 (Phase 5)** | Create `wa_automation_rules` & trigger | Lines 81-116 | **APPLIED** | Table, index, and immutable trigger exist. |
| **009 (Phase 5)** | Create `wa_rule_conditions` & trigger | Lines 118-155 | **APPLIED** | Table, index, and immutable trigger exist. |
| **009 (Phase 5)** | Create `wa_rule_actions` & trigger | Lines 157-191 | **APPLIED** | Table, index, and immutable trigger exist. |
| **009 (Phase 5)** | Create `wa_automation_execution_logs` | Lines 193-228 | **APPLIED** | Table, indexes, and unique trigger constraint exist. |
| **009 (Phase 5)** | Enable RLS on 4 automation tables | Lines 230-261 | **APPLIED** | All 4 tables enforce tenant isolation policies. |
| **009 (Phase 5)** | RPC `claim_next_wa_jobs` | Lines 266-295 | **APPLIED** | Callable via Supabase client. |
| **009 (Phase 5)** | RPC `reclaim_stuck_wa_jobs` | Lines 298-332 | **APPLIED** | Callable via Supabase client. |
| **009 (Phase 5)** | **RPC `prune_stale_automation_records`** | **Lines 335-369** | **UNAPPLIED** | **Function does not exist in `pg_proc`. Calling it results in error 42883.** |
| **009 (Phase 5)** | RPC `ingest_wa_inbound_message` (Update) | Lines 372-563 | **APPLIED** | Updated with `last_inbound_at` and `total_inbound_count`. |

---

## 5. Safest Migration Management & Baselining Strategy

### 5.1 Why Naive Migration Execution is Hazardous
1. **No Migration Ledger Table:** Because `supabase_migrations.schema_migrations` does not exist in `ansiwtwqgrfmzfrhkzuu`, executing `supabase db push` or any migration runner blindly will attempt to execute every migration from `20261106_001` through `20261106_009`.
2. **Fatal Trigger Clashes:** Several early migrations (such as `20261106_001` and `20261106_005`) contain statements like `CREATE TRIGGER trg_prevent_tenant_reassignment...` without `DROP TRIGGER IF EXISTS`. Re-running them against an existing live database causes immediate transaction aborts:
   ```
   ERROR: trigger "trg_prevent_tenant_reassignment" for relation "businesses" already exists
   ```
3. **Data Loss / Drift Risk:** Forcing migrations or modifying tables with existing production data risks lock escalation, schema drift, or corruption of live tenant state.
4. **Prohibition of Manual Ledger Fabrication:** Fabricating records manually via raw `INSERT INTO supabase_migrations.schema_migrations` statements is dangerous because it bypasses CLI checksums, risks schema incompatibility with future Supabase CLI releases, and masks underlying unapplied changes.

### 5.2 Proposed Multi-Step Reconciliation Strategy

#### Step 1: Isolate the Unapplied Change into a Dedicated Remediation Migration
Rather than re-running the 564-line migration 009 (which would fail on existing tables and constraints), create an idempotent, isolated migration containing exclusively the unapplied routine:
- **File:** `supabase/migrations/20261106_010_prune_stale_automation_records.sql`
- **Content:**
  ```sql
  -- ==============================================================================
  -- GOKUL CONNECT — DATABASE MIGRATION 010: PRUNE STALE AUTOMATION RECORDS RPC
  -- ==============================================================================
  -- Deploys missing routine identified in P0.1 Reconciliation
  -- Idempotent, safe to apply without touching any existing schema or data
  -- ==============================================================================

  CREATE OR REPLACE FUNCTION public.prune_stale_automation_records()
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
  DECLARE
      v_pruned_logs INT;
      v_pruned_jobs INT;
      v_pruned_events INT;
  BEGIN
      -- Delete execution logs older than 14 days
      DELETE FROM public.wa_automation_execution_logs
      WHERE created_at < TIMEZONE('utc', NOW()) - INTERVAL '14 days';
      GET DIAGNOSTICS v_pruned_logs = ROW_COUNT;

      -- Delete completed or failed jobs older than 7 days
      DELETE FROM public.wa_processing_jobs
      WHERE status IN ('completed', 'failed')
        AND updated_at < TIMEZONE('utc', NOW()) - INTERVAL '7 days';
      GET DIAGNOSTICS v_pruned_jobs = ROW_COUNT;

      -- Delete processed webhook events older than 7 days
      DELETE FROM public.wa_webhook_events
      WHERE is_processed = TRUE
        AND created_at < TIMEZONE('utc', NOW()) - INTERVAL '7 days';
      GET DIAGNOSTICS v_pruned_events = ROW_COUNT;

      RETURN jsonb_build_object(
          'pruned_logs', v_pruned_logs,
          'pruned_jobs', v_pruned_jobs,
          'pruned_events', v_pruned_events
      );
  END;
  $$;

  REVOKE EXECUTE ON FUNCTION public.prune_stale_automation_records() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.prune_stale_automation_records() TO service_role;
  ```

#### Step 2: Baselining Migration History (Official Supabase CLI Pattern)
When initializing the Supabase CLI ledger on this project, use the official, sanctioned `supabase migration repair` command:
```bash
# Marks migrations 001 through 009 as applied without re-running DDL:
supabase migration repair --status applied 20261106_001
supabase migration repair --status applied 20261106_002
supabase migration repair --status applied 20261106_003
supabase migration repair --status applied 20261106_004
supabase migration repair --status applied 20261106_005
supabase migration repair --status applied 20261106_006
supabase migration repair --status applied 20261106_007
supabase migration repair --status applied 20261106_008
supabase migration repair --status applied 20261106_009
```
This safely informs Supabase CLI that the existing schema baseline has already been satisfied, allowing subsequent migrations (e.g., `010`) to deploy smoothly via `supabase db push`.

#### Step 3: Migration Versioning Rules Going Forward
To permanently eliminate migration version collisions:
1. **Monotonic Sequential Prefix:** Every new migration must use a unique sequential prefix: `YYYYMMDD_NNN_<descriptive_name>.sql` (e.g., `20261106_010_...`).
2. **Idempotency Rule:** All migration DDL must include idempotency guards (`CREATE TABLE IF NOT EXISTS`, `DROP TRIGGER IF EXISTS ... CREATE TRIGGER`, `CREATE OR REPLACE FUNCTION`).
3. **Pre-Commit Version Verification:** CI/CD or git pre-commit hooks should enforce that no two files share the same prefix in `supabase/migrations/`.

---

## 6. Remaining Risks & Guardrails

| Risk Description | Severity | Likelihood | Mitigation |
|---|:---:|:---:|---|
| **Cron Job Runtime Failure** | Medium | High | Route `/api/cron/process-automation-jobs` will fail during the pruning step until `prune_stale_automation_records()` is applied via Migration 010. |
| **Accidental `supabase db push` execution** | High | Low | Baselining migrations 001–009 via `supabase migration repair` before running `supabase db push` completely prevents re-execution errors. |
| **Missing Service Role Key** | Critical | High | Worker in `src/lib/automation/worker.ts` requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` to process queue batches. |

---

## 7. Conclusion

The duplicate migration version collision between Phase 3H and Phase 5 is resolved:
- `20261106_008_phase3h_webhook_events_rls.sql` remains version **008**.
- `20261106_009_phase5_automation_engine_schema.sql` is established as version **009**.
- Live database schema inspection confirms that all Phase 5 tables, columns, indexes, and security controls are already active in `ansiwtwqgrfmzfrhkzuu`.
- The only unapplied object is `prune_stale_automation_records()`, prepared for deployment via additive Migration **010**.
- Zero live database objects were dropped, recreated, or modified during this reconciliation.
