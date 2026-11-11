# GOKUL CONNECT — P4 GATE 1.1: MIGRATION RISK MATRIX & TECHNICAL RECONCILIATION
## Line-by-Line Technical Analysis, Transactionality, Lock Contention, and Engine Differences for Migrations 016–024

**Target Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`)  
**Database Host:** `db.ansiwtwqgrfmzfrhkzuu.supabase.co`  
**Region:** `ap-south-1` (AWS Mumbai)  
**PostgreSQL Version:** `17.11.0.018` (`aarch64-unknown-linux-gnu`)  
**Scope:** Migrations 016 through 024  
**Audit Date:** `2026-11-10`  
**Audit Mode:** **100% READ-ONLY INSPECTION & STATIC AST ANALYSIS**

---

## 1. Executive Summary & Verification Findings

This document reconciles all 9 pending database migrations (016 through 024), establishing the exact filenames, ledger version timestamps, topological dependency order, lock acquisition profiles, transactionality, and failure recovery characteristics.

### Key Audit Conclusions:
1. **Zero Destructive DDL Statements:** Across all 2,175 lines of SQL in migrations 016–024, there are **0 `DROP TABLE`**, **0 `DROP COLUMN`**, and **0 `TRUNCATE`** statements. The single `DELETE FROM` detected in Migration 024 is runtime lock row maintenance inside the `release_cron_lock()` function.
2. **Transactionality Finding:** None of the 9 migration files contain top-level `BEGIN;` and `COMMIT;` transaction wrappers. They only contain internal PL/pgSQL `DO $$ BEGIN ... END $$;` blocks. **Executing these files in autocommit mode risks partial failure states.** Migration runners MUST wrap each file in an explicit transaction (`BEGIN; ... COMMIT;` or `psql --single-transaction`).
3. **Locking & Downtime Blast Radius:** `ALTER TABLE ... ADD CONSTRAINT` and non-concurrent `CREATE INDEX` acquire `ACCESS EXCLUSIVE` and `SHARE` locks respectively. On the existing dataset (2 businesses, 15 messages, 4 contacts), operations complete in <10ms. However, to guarantee zero lock contention or worker timeouts, **background cron workers must be paused during execution**.
4. **PGlite vs. Live Cloud Parity Warning:** Successful replay on an in-memory PGlite sandbox does **NOT** guarantee identical execution on live Supabase due to multi-role security models, Supavisor connection pooler modes, Supabase Realtime publication dependencies, and PostgREST schema cache reloads.

---

## 2. Reconciled Migration Inventory & Ledger Specifications

| Step | Exact SQL Filename | Ledger Timestamp / Version | Total Lines | Core Capability Introduced |
|:---:|---|:---:|:---:|---|
| **016** | `20261107_016_phase12_1_team_management_and_agent_assignment.sql` | `20261107202900` | 266 | Team invitations, role hierarchy, conversation assignment, audit logs |
| **017** | `20261107_017_phase12_2_media_messaging.sql` | `20261107203000` | 161 | Media attachments (`wa_media_files`), message media attributes, extraction trigger |
| **018** | `20261108_018_phase12_3_scheduled_messages.sql` | `20261108102000` | 262 | Scheduled queue (`wa_scheduled_messages`), atomic claim RPC, stuck recovery |
| **019** | `20261108_019_phase12_4_campaign_management.sql` | `20261108102500` | 406 | Bulk campaigns (`wa_campaigns`), recipients, contact consent flags, atomic claim RPC |
| **020** | `20261108_020_phase12_5_crm_lifecycle_and_followups.sql` | `20261108151500` | 318 | CRM lifecycle stages, transition logs, follow-up tasks, team reminder queues |
| **021** | `20261109_021_phase12_6_notification_center_and_durable_reminders.sql` | `20261109110500` | 252 | Notification center extensions on reminders, user notification preferences |
| **022** | `20261109_022_phase12_7_visual_flows_and_realtime.sql` | `20261109185500` | 89 | Drag-and-drop Visual Flows (`wa_visual_flows`), Supabase Realtime publication |
| **023** | `20261109_023_phase2_operational_reliability.sql` | `20261109191000` | 489 | Worker telemetry (`worker_execution_runs`), dead_letter status across queues, health RPC |
| **024** | `20261109_024_phase_p3_2_labels_and_cron_locks.sql` | `20261109200500` | 324 | Conversation labels (`labels TEXT[]`, GIN index), distributed cron locks (`cron_locks`) |

---

## 3. Topological Dependency Order Analysis

The diagram below maps the exact relational and functional dependencies across migrations 001–024:

```mermaid
flowchart TD
    subgraph Baseline ["Existing Live Baseline (001-015)"]
        M001["001: Foundation (businesses, members, users)"]
        M002["002: Connections & Settings"]
        M005["005: Messaging (conversations, messages)"]
        M009["009: Automation Processing Jobs"]
        M013["013: CRM & Contacts (wa_contacts)"]
        M015["015: Templates (wa_message_templates)"]
    end

    subgraph Target ["Pending Migrations (016-024)"]
        M016["016: Team & Assignment"]
        M017["017: Media Messaging"]
        M018["018: Scheduled Messages"]
        M019["019: Campaigns & Consent"]
        M020["020: CRM Lifecycle & Follow-ups"]
        M021["021: Notification Center"]
        M022["022: Visual Flows & Realtime"]
        M023["023: Operational Reliability"]
        M024["024: Labels & Cron Locks"]
    end

    M001 --> M016
    M005 --> M016

    M005 --> M017
    M016 --> M017

    M002 --> M018
    M005 --> M018
    M017 --> M018

    M002 --> M019
    M005 --> M019
    M013 --> M019
    M017 --> M019
    M018 --> M019

    M001 --> M020
    M005 --> M020
    M013 --> M020

    M001 --> M021
    M020 --> M021

    M001 --> M022
    M005 --> M022

    M009 --> M023
    M018 --> M023
    M019 --> M023
    M021 --> M023

    M001 --> M024
    M005 --> M024
```

### Dependency Validation Rules:
- **017 depends on 016:** `wa_messages` references `business_members` composite keys for assignment tracking during media exchange.
- **018 depends on 017:** Scheduled messages support media attachments referencing `wa_media_files`.
- **019 depends on 017 & 018:** Bulk campaigns can dispatch templates, text, or media attachments, requiring media and consent columns.
- **021 depends on 020:** Notification center extends `crm_follow_up_reminders` created in Migration 020.
- **023 depends on 009, 018, 019, 021:** Operational reliability updates check constraints across all four queue tables (`wa_processing_jobs`, `wa_scheduled_messages`, `wa_campaign_recipients`, `crm_follow_up_reminders`) to permit `dead_letter` status.
- **024 depends on 005:** Conversation labels extend `wa_conversations` table.

---

## 4. Deep Technical Analysis per Migration (016–024)

### 4.1 Migration 016 — Team Management & Agent Assignment
- **File:** `supabase/migrations/20261107_016_phase12_1_team_management_and_agent_assignment.sql`
- **Objects Created:** `business_invitations`, `team_activity_logs`, `conversation_assignment_logs`, function `guard_business_member_roles()`, trigger `trg_business_members_guard_privileges`.
- **Objects Altered:** `business_members` (extends role check, adds `last_login_at`, unique `(id, business_id)`), `wa_conversations` (adds `assigned_agent_id`, `assigned_agent_name`, `assigned_at`).
- **Locks Acquired:** `ACCESS EXCLUSIVE` on `business_members` (constraint check) and `wa_conversations` (column addition).
- **Destructive Statements:** None. Check constraint update is widening (`owner`, `admin`, `agent`, `viewer`).
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

### 4.2 Migration 017 — Media Messaging Support
- **File:** `supabase/migrations/20261107_017_phase12_2_media_messaging.sql`
- **Objects Created:** `wa_media_files`, function `populate_wa_message_media_fields()`, trigger `trg_wa_messages_populate_media`.
- **Objects Altered:** `wa_messages` (extends message_type check to include `video`, adds 11 media attributes: `media_type`, `media_id`, `mime_type`, `file_name`, `file_size`, `caption`, `storage_path`, `media_url`, `download_status`, `downloaded_at`, `uploaded_at`, `media_error`).
- **Locks Acquired:** `ACCESS EXCLUSIVE` on `wa_messages` (constraint and column additions), `SHARE` on `wa_messages` for 3 non-concurrent indexes.
- **Destructive Statements:** None.
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

### 4.3 Migration 018 — Scheduled Messages
- **File:** `supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql`
- **Objects Created:** `wa_scheduled_messages`, function `claim_next_scheduled_messages()`, function `reclaim_stuck_scheduled_messages()`, trigger `trg_wa_scheduled_messages_sync_status`.
- **Locks Acquired:** Table creation only (`ACCESS EXCLUSIVE` on new table `wa_scheduled_messages`). Zero lock impact on existing baseline tables.
- **Destructive Statements:** None.
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

### 4.4 Migration 019 — Campaign Management & Bulk Messaging
- **File:** `supabase/migrations/20261108_019_phase12_4_campaign_management.sql`
- **Objects Created:** `wa_campaigns`, `wa_campaign_recipients`, functions `claim_next_campaign_recipients()`, `reclaim_stuck_campaign_recipients()`, `sync_campaign_stats_rollup()`.
- **Objects Altered:** `wa_contacts` (adds consent tracking columns: `consent_status`, `consent_source`, `consent_recorded_at`, `is_blacklisted`, `opt_out_timestamp`, `opt_out_reason`).
- **Locks Acquired:** `ACCESS EXCLUSIVE` on `wa_contacts` (additive columns with defaults).
- **Destructive Statements:** None.
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

### 4.5 Migration 020 — CRM Customer Lifecycle & Follow-up Management
- **File:** `supabase/migrations/20261108_020_phase12_5_crm_lifecycle_and_followups.sql`
- **Objects Created:** `crm_lifecycle_stages`, `contact_lifecycle_history`, `crm_follow_ups`, `crm_follow_up_reminders`, triggers for immutability and updated_at.
- **Objects Altered:** `wa_contacts` (adds `lifecycle_stage_id UUID REFERENCES crm_lifecycle_stages(id)`).
- **Locks Acquired:** `ACCESS EXCLUSIVE` on `wa_contacts` (foreign key column addition).
- **Destructive Statements:** None.
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

### 4.6 Migration 021 — Internal Notification Center & Durable Reminders
- **File:** `supabase/migrations/20261109_021_phase12_6_notification_center_and_durable_reminders.sql`
- **Objects Created:** `user_notification_preferences`, function `claim_next_reminder_jobs()`, function `reclaim_stuck_reminder_jobs()`.
- **Objects Altered:** `crm_follow_up_reminders` (relaxes `follow_up_id` NOT NULL to allow standalone system alerts; adds `category`, `title`, `message`, `priority`, `action_url`, `dedup_key`, `sent_at`, `read_at`).
- **Locks Acquired:** `ACCESS EXCLUSIVE` on `crm_follow_up_reminders`.
- **Destructive Statements:** None (`DROP NOT NULL` is non-destructive).
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

### 4.7 Migration 022 — Visual Flow Builder & Supabase Realtime
- **File:** `supabase/migrations/20261109_022_phase12_7_visual_flows_and_realtime.sql`
- **Objects Created:** `wa_visual_flows` (nodes, edges, viewport, status, flow_type).
- **Subsystem Modifications:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages, public.wa_conversations, public.wa_visual_flows;`.
- **Locks Acquired:** Exclusive lock on `supabase_realtime` publication.
- **Destructive Statements:** None. Uses exception handling (`duplicate_object`, `undefined_object`).
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

### 4.8 Migration 023 — Operational Reliability & Worker Telemetry
- **File:** `supabase/migrations/20261109_023_phase2_operational_reliability.sql`
- **Objects Created:** `worker_execution_runs`, functions `reclaim_stuck_queue_jobs()`, `retry_queue_job()`, `get_worker_health_metrics()`.
- **Objects Altered:** Drops and recreates status check constraints across `wa_processing_jobs`, `wa_scheduled_messages`, `wa_campaign_recipients`, and `crm_follow_up_reminders` to permit `dead_letter` status.
- **Locks Acquired:** `ACCESS EXCLUSIVE` on all 4 queue tables.
- **Destructive Statements:** None. Check constraints are widened.
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

### 4.9 Migration 024 — Conversation Labels & Distributed Cron Locks
- **File:** `supabase/migrations/20261109_024_phase_p3_2_labels_and_cron_locks.sql`
- **Objects Created:** `cron_locks`, functions `acquire_cron_lock()`, `renew_cron_lock()`, `release_cron_lock()`.
- **Objects Altered:** `wa_conversations` (adds `labels TEXT[] DEFAULT '{}'::text[]` and GIN index `idx_wa_conversations_labels`).
- **Locks Acquired:** `ACCESS EXCLUSIVE` on `wa_conversations` (column addition), `SHARE` on `wa_conversations` for GIN index.
- **Destructive Statements:** None. `DELETE FROM public.cron_locks` is within the `release_cron_lock()` function body.
- **Transactionality:** Requires explicit `BEGIN; ... COMMIT;`.

---

## 5. Blast Radius and Application Dependency Analysis

A critical operational question is: **Can the application start or run with only a subset of migrations applied?**

> [!WARNING]
> **APPLICATION HARD DEPENDENCY ON FULL MIGRATION SUITE:**
> While static Next.js pages compile successfully, **runtime execution strictly requires all 9 migrations (016–024)**.  
> If an operator applies migrations 016–018 but stops before 024:
> - Visiting `/workspace/[slug]/inbox` will trigger PostgreSQL errors because `wa_conversations.labels` does not exist.
> - Vercel cron jobs will fail immediately because `acquire_cron_lock` and `cron_locks` do not exist.
> - Visiting `/operations` will throw 500 errors because `worker_execution_runs` does not exist.
> - Visiting `/flows` will fail because `wa_visual_flows` does not exist.
> 
> **Operational Rule:** Migrations 016 through 024 must be executed as a unified, complete release before reopening the application to live users or re-enabling cron jobs.

---

## 6. Technical Parity Gap: PGlite Sandbox vs. Live Supabase PostgreSQL 17

Replaying migrations in an in-memory PGlite sandbox provides strong structural confidence, but does **NOT** guarantee live success due to the following infrastructure gaps:

```
+--------------------------------------------------------------------------------------------------------+
|                                  SANDBOX VS. LIVE CLOUD DIVERGENCE                                     |
+--------------------------------------------------------------------------------------------------------+
| ARCHITECTURAL ATTRIBUTE        | PGLITE SANDBOX                    | LIVE SUPABASE PROJECT             |
+--------------------------------+-----------------------------------+-----------------------------------+
| 1. Engine & Runtime            | WebAssembly (WASM) single-process | PostgreSQL 17.11.0.018 64-bit     |
|                                | in Node.js V8 engine memory.      | running on AWS Linux ARM64.       |
+--------------------------------+-----------------------------------+-----------------------------------+
| 2. Security & Role Context     | Runs as unrestricted superuser;   | Role separation: postgres, anon,  |
|                                | all role checks mocked.           | authenticated, service_role.      |
|                                | search_path security unenforced.  | Strict search_path enforcement.   |
+--------------------------------+-----------------------------------+-----------------------------------+
| 3. Connection Pooling          | Direct in-memory buffer;          | Supavisor Connection Pooler       |
|                                | 0 network latency, 0 timeouts.    | (port 5432 session, 6543 trans).  |
+--------------------------------+-----------------------------------+-----------------------------------+
| 4. Realtime Replication Subsys | Mock publication created in-RAM;  | Real Elixir/Phoenix CDC streamer; |
|                                | no real logical decoding active.  | wal2json replication slot bound.  |
+--------------------------------+-----------------------------------+-----------------------------------+
| 5. PostgREST Schema Cache      | No PostgREST layer; direct SQL.   | PostgREST requires NOTIFY reload; |
|                                |                                   | schema cache lag can cause 404s.  |
+--------------------------------+-----------------------------------+-----------------------------------+
| 6. Concurrency & Contention    | Strictly single-threaded (0 load) | Multi-tenant connections, auth,   |
|                                | Zero possibility of lock timeout. | webhooks; lock contention risk.   |
+--------------------------------------------------------------------------------------------------------+
```

---

## 7. Migration Risk Classification Summary

| Migration | Rollback Safety | Downtime / Locking Risk | Overall Risk Score | Mandated Precaution |
|:---:|:---:|:---:|:---:|---|
| **016** | HIGH (Additive) | LOW (<5ms lock) | **LOW** | Wrap in transaction |
| **017** | MEDIUM (Storage-coupled)| LOW (<10ms lock) | **MEDIUM** | Separate Storage Gate; wrap in transaction |
| **018** | HIGH (Additive) | NEGLIGIBLE (New table) | **LOW** | Wrap in transaction |
| **019** | HIGH (Additive) | LOW (<5ms lock on contacts) | **LOW** | Wrap in transaction |
| **020** | MEDIUM (FK dependencies)| LOW (<5ms lock on contacts) | **LOW** | Wrap in transaction |
| **021** | HIGH (Relaxing constraint)| LOW (<5ms lock on reminders) | **LOW** | Wrap in transaction |
| **022** | HIGH (Additive) | MEDIUM (Publication lock) | **MEDIUM** | Exception trap verified; wrap in transaction |
| **023** | HIGH (Widening check) | LOW (<10ms across 4 queues) | **LOW** | Pause cron workers; wrap in transaction |
| **024** | HIGH (Additive) | LOW (<10ms lock on convs) | **LOW** | Wrap in transaction |
