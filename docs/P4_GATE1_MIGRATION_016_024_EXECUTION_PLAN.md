# GOKUL CONNECT — P4 GATE 1: MIGRATION 016–024 EXECUTION PLAN
## Production Sequential Database Migration Plan & Technical Specifications

**Target Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`)  
**Region:** `ap-south-1` (AWS Mumbai)  
**PostgreSQL Version:** `17.11.0.018`  
**Execution Sequence:** Migrations 016 through 024 (Strict Step-by-Step Execution with Verification Gates)  
**Safety Protocol:** Zero batch execution; transactional execution per migration; live verification gate between each migration step.

---

## 1. Migration Sequence Architecture & Naming Reconciliation

### Scope & Sequence Overview:

| Order | Migration File | Migration Identifier | Scope / Core Capability |
|:---:|---|---|---|
| **016** | `supabase/migrations/20261107_016_phase12_1_team_management_and_agent_assignment.sql` | `20261107_016_phase12_1` | Team invitations, role escalation guard, conversation assignment logs, activity audit history. |
| **017** | `supabase/migrations/20261107_017_phase12_2_media_messaging.sql` | `20261107_017_phase12_2` | Media metadata storage (`wa_media_files`), `wa_messages` media extensions, auto-extraction trigger. |
| **018** | `supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql` | `20261108_018_phase12_3` | Scheduled message queue (`wa_scheduled_messages`), atomic worker claim RPC, stuck recovery RPC, status sync trigger. |
| **019** | `supabase/migrations/20261108_019_phase12_4_campaign_management.sql` | `20261108_019_phase12_4` | Campaigns (`wa_campaigns`), recipients (`wa_campaign_recipients`), consent metadata, atomic claim RPC, rollup trigger. |
| **020** | `supabase/migrations/20261108_020_phase12_5_crm_lifecycle_and_followups.sql` | `20261108_020_phase12_5` | CRM lifecycle stages, transition history, follow-up tasks (`crm_follow_ups`), team reminders (`crm_follow_up_reminders`). |
| **021** | `supabase/migrations/20261109_021_phase12_6_notification_center_and_durable_reminders.sql` | `20261109_021_phase12_6` | Unified notification center extensions on `crm_follow_up_reminders`, user notification preferences, atomic claim RPCs. |
| **022** | `supabase/migrations/20261109_022_phase12_7_visual_flows_and_realtime.sql` | `20261109_022_phase12_7` | Drag-and-drop Visual Flow schema (`wa_visual_flows`), Realtime publication for messages, conversations, and visual flows. |
| **023** | `supabase/migrations/20261109_023_phase2_operational_reliability.sql` | `20261109_023_phase2` | Worker telemetry (`worker_execution_runs`), `dead_letter` status across all queues, server-side health RPC, safe stuck job recovery. |
| **024** | `supabase/migrations/20261109_024_phase_p3_2_labels_and_cron_locks.sql` | `20261109_024_phase_p3_2` | Persistent conversation labels (`labels TEXT[]`, GIN index), distributed cron locking table (`cron_locks`) and atomic RPCs. |

### Reconciliation of Migration 022 Naming & Scope:
- **Investigation:** In certain planning documents, Migration 022 was referenced as "Business Settings / Visual Flows / Realtime".
- **Actual Content:** Technical inspection of `20261109_022_phase12_7_visual_flows_and_realtime.sql` confirms that the migration introduces:
  1. `public.wa_visual_flows` table (nodes, edges, viewport, flow_type, trigger_keyword) with composite keys and RLS.
  2. Enablement of `supabase_realtime` publication for `wa_messages`, `wa_conversations`, and `wa_visual_flows`.
- **Reconciliation Finding:** The `business_settings` table and its preferences columns were already created during foundational Migration 002 (`20261106_002_phase2_wa_connections.sql`) and currently contain 2 active live records. Migration 022 does not modify `business_settings`. The migration name `20261109_022_phase12_7_visual_flows_and_realtime.sql` accurately describes the SQL contents and must be preserved without renaming.

---

## 2. Step-by-Step Sequential Execution Specifications

---

### Step 1: Migration 016 — Team Management and Agent Assignment

#### 1. Preconditions:
- Baseline migrations 001–015 verified in remote ledger.
- `public.businesses`, `public.business_members`, and `public.wa_conversations` exist.
- Migration 016 verified absent from ledger.

#### 2. SQL File:
`supabase/migrations/20261107_016_phase12_1_team_management_and_agent_assignment.sql` (266 lines)

#### 3. Expected Schema Changes:
- **Altered Tables:**
  - `public.business_members`: Extends check constraint `role IN ('owner', 'admin', 'agent', 'viewer')`; adds column `last_login_at TIMESTAMPTZ`; adds composite unique constraint `uq_business_members_id_business (id, business_id)`.
  - `public.wa_conversations`: Adds columns `assigned_agent_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL`, `assigned_agent_name TEXT`, `assigned_at TIMESTAMPTZ`; adds index `idx_wa_conversations_assigned_agent (business_id, assigned_agent_id)`.
- **Created Tables:**
  - `public.business_invitations` (UUID PK, business_id FK, email, role, status, token, expires_at)
  - `public.team_activity_logs` (UUID PK, business_id FK, actor_id FK, activity_type, description, metadata)
  - `public.conversation_assignment_logs` (UUID PK, business_id FK, conversation_id FK composite, assigned_by, assigned_to, previous_assigned_to, notes)
- **Created Triggers & Functions:**
  - Function `public.guard_business_member_roles()` (`SECURITY DEFINER`, search_path = public, pg_temp).
  - Trigger `trg_business_members_guard_privileges` on `business_members`.
  - Immutability triggers on `business_invitations`, `team_activity_logs`, `conversation_assignment_logs`.
- **RLS Policies:**
  - Tenant isolation & role-scoped policies on all 3 new tables.
- **Grants:**
  - Function `guard_business_member_roles()` granted to `authenticated` and `service_role`.

#### 4. Dependencies:
- Depends on: 001 (businesses, business_members, user_profiles), 005 (wa_conversations).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261107_016_phase12_1_team_management_and_agent_assignment.sql
```

#### 6. Expected Success Output:
- Statement returns cleanly with 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
-- Check columns on wa_conversations
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'wa_conversations' AND column_name IN ('assigned_agent_id', 'assigned_agent_name', 'assigned_at');

-- Check new tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('business_invitations', 'team_activity_logs', 'conversation_assignment_logs');

-- Check trigger
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'trg_business_members_guard_privileges';
```

#### 8. Failure Detection:
- Role check conflict if non-conforming role exists; composite foreign key failure if conversation exists without matching business_id.

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Revert column additions from `wa_conversations`, drop triggers, drop the 3 newly created tables. Existing conversation rows are unaffected.

#### 10. Go / No-Go Condition:
- All 3 tables exist; 3 columns added to `wa_conversations`; baseline row counts match baseline.

---

### Step 2: Migration 017 — Media Messaging

#### 1. Preconditions:
- Migration 016 verified applied.
- `public.wa_messages` exists with baseline columns.
- Supabase storage bucket `whatsapp-media` created.

#### 2. SQL File:
`supabase/migrations/20261107_017_phase12_2_media_messaging.sql` (161 lines)

#### 3. Expected Schema Changes:
- **Altered Tables:**
  - `public.wa_messages`: Extends check constraint `message_type IN ('text', 'template', 'image', 'document', 'audio', 'video', 'interactive', 'reaction')`; adds media columns: `media_type`, `media_id`, `mime_type`, `file_name`, `file_size`, `caption`, `storage_path`, `media_url`, `download_status`, `downloaded_at`, `uploaded_at`, `media_error`.
  - Indexes: `idx_wa_messages_media_type`, `idx_wa_messages_media_id`, `idx_wa_messages_download_status`.
- **Created Tables:**
  - `public.wa_media_files` (UUID PK, business_id FK, conversation_id composite FK, message_id FK, media_type, meta_media_id, mime_type, original_filename, file_size, storage_bucket default 'whatsapp-media', storage_path, direction, download_status).
- **Created Triggers & Functions:**
  - Function `public.populate_wa_message_media_fields()` (`SECURITY DEFINER`).
  - Trigger `trg_wa_messages_populate_media` on `public.wa_messages`.
  - Immutability trigger `trg_wa_media_files_immutable_business_id`.
- **RLS Policies:**
  - Tenant isolation SELECT/INSERT/UPDATE policies on `public.wa_media_files`.

#### 4. Dependencies:
- Depends on: 005 (wa_conversations, wa_messages).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261107_017_phase12_2_media_messaging.sql
```

#### 6. Expected Success Output:
- Clean execution, 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'wa_messages' AND column_name IN ('media_type', 'media_id', 'download_status', 'storage_path');

SELECT table_name FROM information_schema.tables WHERE table_name = 'wa_media_files';

SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'trg_wa_messages_populate_media';
```

#### 8. Failure Detection:
- Type check collision on existing messages; syntax error in trigger function.

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Drop trigger `trg_wa_messages_populate_media`, drop function `populate_wa_message_media_fields()`, drop table `wa_media_files`, drop added media columns from `wa_messages`.

#### 10. Go / No-Go Condition:
- `wa_media_files` table active; 12 new columns verified on `wa_messages`; 15 existing baseline messages intact.

---

### Step 3: Migration 018 — Scheduled Messages

#### 1. Preconditions:
- Migration 017 verified applied.
- `public.wa_connections`, `public.wa_conversations`, `public.wa_messages` intact.

#### 2. SQL File:
`supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql` (261 lines)

#### 3. Expected Schema Changes:
- **Created Tables:**
  - `public.wa_scheduled_messages` (UUID PK, business_id FK, connection_id composite FK, conversation_id composite FK, recipient_phone, message_type, content, template details, media details, scheduled_at, timezone, status, locked_at, locked_by, retry_count, max_retries, message_id FK, meta_message_id).
- **Created Indexes:**
  - `idx_wa_scheduled_messages_claim` (partial index WHERE status = 'scheduled').
  - Covering indexes on `(business_id, status)`, `(business_id, recipient_phone)`.
- **Created Triggers & Functions:**
  - Atomic claim RPC: `public.claim_next_scheduled_messages(INT, TEXT)` (`SECURITY DEFINER`, FOR UPDATE SKIP LOCKED).
  - Stuck job recovery RPC: `public.reclaim_stuck_scheduled_messages(INT)` (`SECURITY DEFINER`).
  - Delivery sync function: `public.sync_scheduled_message_delivery_status()` and trigger `trg_wa_messages_sync_scheduled_status`.
  - Immutability trigger `trg_wa_scheduled_messages_immutable_business_id`.
- **RLS & Grants:**
  - RLS enabled with tenant isolation SELECT/INSERT/UPDATE/DELETE.
  - Revoked execute on claim/reclaim RPCs from PUBLIC/anon/authenticated; granted strictly to `service_role`.

#### 4. Dependencies:
- Depends on: 002 (wa_connections), 005 (wa_conversations, wa_messages).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql
```

#### 6. Expected Success Output:
- Clean execution, 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'wa_scheduled_messages';

SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('claim_next_scheduled_messages', 'reclaim_stuck_scheduled_messages');

SELECT grantee, privilege_type FROM information_schema.routine_privileges 
WHERE routine_name = 'claim_next_scheduled_messages';
```

#### 8. Failure Detection:
- Routine definition failure; index creation conflict.

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Drop trigger `trg_wa_messages_sync_scheduled_status`, drop RPC functions, drop table `wa_scheduled_messages`.

#### 10. Go / No-Go Condition:
- Table exists; both RPCs created and restricted to `service_role`; trigger verified on `wa_messages`.

---

### Step 4: Migration 019 — Campaign Management

#### 1. Preconditions:
- Migration 018 verified applied.
- `public.wa_contacts`, `public.wa_connections`, `public.wa_message_templates` intact.

#### 2. SQL File:
`supabase/migrations/20261108_019_phase12_4_campaign_management.sql` (405 lines)

#### 3. Expected Schema Changes:
- **Altered Tables:**
  - `public.wa_contacts`: Adds columns `is_blocked BOOLEAN NOT NULL DEFAULT FALSE`, `consent_status TEXT NOT NULL DEFAULT 'opted_in'`, `consent_source`, `consented_at`, `consent_withdrawn_at`, `last_eligibility_evaluation_at`.
  - Indexes: `idx_wa_contacts_consent`, `idx_wa_contacts_blocked`.
- **Created Tables:**
  - `public.wa_campaigns` (UUID PK, business_id FK, name, message_type, template_id FK, connection_id composite FK, scheduled_at, status, audience details, rollup counters: audience, eligible, excluded, sent, delivered, read, failed).
  - `public.wa_campaign_recipients` (UUID PK, business_id FK, campaign_id composite FK, contact_id composite FK, phone_number, eligibility_status, status, message_id FK, meta_message_id, retry_count, locked_at, locked_by; unique constraint on `(campaign_id, phone_number)`).
- **Created Triggers & Functions:**
  - Atomic claim RPC: `public.claim_next_campaign_recipients(INT, TEXT)`.
  - Stuck recipient recovery RPC: `public.reclaim_stuck_campaign_recipients(INT)`.
  - Campaign counter rollup function: `public.sync_campaign_recipient_delivery_status()` and trigger `trg_wa_messages_sync_campaign_status`.
  - Immutability triggers on both tables.
- **RLS & Grants:**
  - RLS enabled on campaigns and recipients.
  - RPC execution revoked from PUBLIC/anon/authenticated; granted strictly to `service_role`.

#### 4. Dependencies:
- Depends on: 002 (wa_connections), 005 (wa_contacts, wa_messages), 015 (wa_message_templates).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261108_019_phase12_4_campaign_management.sql
```

#### 6. Expected Success Output:
- Clean execution, 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'wa_contacts' AND column_name IN ('is_blocked', 'consent_status');

SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('wa_campaigns', 'wa_campaign_recipients');

SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('claim_next_campaign_recipients', 'reclaim_stuck_campaign_recipients');
```

#### 8. Failure Detection:
- Unique constraint conflict on phone numbers; foreign key mismatch on connection_id.

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Drop trigger `trg_wa_messages_sync_campaign_status`, drop campaign RPCs, drop `wa_campaign_recipients`, drop `wa_campaigns`, drop added consent columns from `wa_contacts`.

#### 10. Go / No-Go Condition:
- Both campaign tables active; 6 consent columns added to `wa_contacts`; 4 existing contact rows intact with default `consent_status = 'opted_in'`.

---

### Step 5: Migration 020 — CRM Lifecycle and Follow-ups

#### 1. Preconditions:
- Migration 019 verified applied.
- `public.wa_contacts`, `public.wa_conversations` intact.

#### 2. SQL File:
`supabase/migrations/20261108_020_phase12_5_crm_lifecycle_and_followups.sql` (317 lines)

#### 3. Expected Schema Changes:
- **Created Tables:**
  - `public.crm_lifecycle_stages` (UUID PK, business_id FK, name, slug, color, sort_order, is_default, is_converted, is_lost; unique on `(business_id, slug)`).
  - `public.contact_lifecycle_history` (UUID PK, business_id FK, contact_id composite FK, from_stage, to_stage, changed_by, change_reason).
  - `public.crm_follow_ups` (UUID PK, business_id FK, contact_id composite FK, conversation_id composite FK, title, description, priority, status, due_at, assigned_to).
  - `public.crm_follow_up_reminders` (UUID PK, business_id FK, follow_up_id composite FK, user_id FK, reminder_type, title, message, is_read; unique on `(follow_up_id, user_id, reminder_type)`).
- **Altered Tables:**
  - `public.wa_contacts`: Adds columns `lifecycle_stage_id`, `lifecycle_stage_slug`, `next_follow_up_at`, `last_interaction_at`; composite foreign key `fk_wa_contacts_lifecycle_stage_tenant`.
- **Created Triggers & Functions:**
  - Function `public.sync_contact_next_follow_up()` and trigger `trg_crm_follow_ups_sync_next` on `crm_follow_ups`.
  - Immutability triggers on all 4 new tables.
- **RLS Policies:**
  - Tenant isolation policies on all 4 new tables.

#### 4. Dependencies:
- Depends on: 001 (businesses, user_profiles), 005 (wa_contacts, wa_conversations).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261108_020_phase12_5_crm_lifecycle_and_followups.sql
```

#### 6. Expected Success Output:
- Clean execution, 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('crm_lifecycle_stages', 'contact_lifecycle_history', 'crm_follow_ups', 'crm_follow_up_reminders');

SELECT column_name FROM information_schema.columns 
WHERE table_name = 'wa_contacts' AND column_name IN ('lifecycle_stage_id', 'next_follow_up_at');

SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'trg_crm_follow_ups_sync_next';
```

#### 8. Failure Detection:
- Slug uniqueness check failure; foreign key conflict between contact and business.

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Drop trigger `trg_crm_follow_ups_sync_next`, drop function `sync_contact_next_follow_up()`, drop the 4 tables in reverse dependency order, drop added columns from `wa_contacts`.

#### 10. Go / No-Go Condition:
- All 4 tables exist; 4 columns added to `wa_contacts`; 0 drift on existing contacts.

---

### Step 6: Migration 021 — Notification Center and Durable Reminders

#### 1. Preconditions:
- Migration 020 verified applied (`crm_follow_up_reminders` exists).

#### 2. SQL File:
`supabase/migrations/20261109_021_phase12_6_notification_center_and_durable_reminders.sql` (251 lines)

#### 3. Expected Schema Changes:
- **Altered Tables:**
  - `public.crm_follow_up_reminders`:
    - `follow_up_id` altered to `DROP NOT NULL` (enables non-CRM system/team notifications).
    - Extends check constraint `reminder_type IN ('due_today', 'due_soon', 'overdue', 'assigned', 'reassigned', 'completed', 'team_invitation', 'team_member_joined', 'system', 'escalation')`.
    - Adds columns: `category`, `action_url`, `metadata`, `is_dismissed`, `dismissed_at`, `dedup_key`, `status`, `locked_at`, `locked_by`, `retry_count`, `max_retries`, `last_error`.
    - Adds unique constraint `uq_crm_follow_up_reminders_dedup_key (business_id, dedup_key)`.
    - Indexes: `idx_crm_reminders_active_user`, `idx_crm_reminders_processing_jobs`, `idx_crm_reminders_pending_jobs`.
- **Created Tables:**
  - `public.user_notification_preferences` (UUID PK, business_id FK, user_id FK, in_app_enabled, notify_due_today, notify_due_soon, notify_overdue, notify_assigned, notify_team_events, notify_system, lead_time_hours; unique on `(business_id, user_id)`).
- **Created Triggers & Functions:**
  - Atomic claim RPC: `public.claim_next_reminder_jobs(INT, TEXT)`.
  - Stuck recovery RPC: `public.reclaim_stuck_reminder_jobs(INT)`.
  - Immutability trigger `trg_user_notification_pref_immutable_business_id`.
- **RLS Policies:**
  - User-scoped RLS policies on `user_notification_preferences`.
  - Refined SELECT policy on `crm_follow_up_reminders` for recipient user and workspace admins.
- **Grants:**
  - Claim and reclaim RPCs revoked from PUBLIC/anon/authenticated; granted strictly to `service_role`.

#### 4. Dependencies:
- Depends on: 020 (crm_follow_up_reminders).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261109_021_phase12_6_notification_center_and_durable_reminders.sql
```

#### 6. Expected Success Output:
- Clean execution, 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
SELECT column_name, is_nullable FROM information_schema.columns 
WHERE table_name = 'crm_follow_up_reminders' AND column_name IN ('follow_up_id', 'category', 'dedup_key', 'is_dismissed');

SELECT table_name FROM information_schema.tables WHERE table_name = 'user_notification_preferences';

SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('claim_next_reminder_jobs', 'reclaim_stuck_reminder_jobs');
```

#### 8. Failure Detection:
- Check constraint violation on reminder types; dedup_key uniqueness conflict.

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Drop RPC functions, drop table `user_notification_preferences`, revert columns and check constraint on `crm_follow_up_reminders`.

#### 10. Go / No-Go Condition:
- `user_notification_preferences` active; `crm_follow_up_reminders.follow_up_id` is nullable; claim RPC executable by `service_role`.

---

### Step 7: Migration 022 — Visual Flows and Realtime

#### 1. Preconditions:
- Migration 021 verified applied.
- `public.businesses`, `public.wa_messages`, `public.wa_conversations` intact.

#### 2. SQL File:
`supabase/migrations/20261109_022_phase12_7_visual_flows_and_realtime.sql` (89 lines)

#### 3. Expected Schema Changes:
- **Created Tables:**
  - `public.wa_visual_flows` (UUID PK, business_id FK, name, description, trigger_keyword, status, flow_type, nodes JSONB default '[]', edges JSONB default '[]', viewport JSONB, is_active; composite unique key `uq_wa_visual_flows_id_business`).
- **Created Indexes:**
  - `idx_wa_visual_flows_business_id (business_id, is_active, updated_at DESC)`.
- **Created Triggers:**
  - Immutability trigger `trg_wa_visual_flows_immutable_business_id`.
- **RLS Policies:**
  - Tenant isolation SELECT/INSERT/UPDATE/DELETE policies on `wa_visual_flows`.
- **Realtime Publications:**
  - Adds `wa_messages`, `wa_conversations`, and `wa_visual_flows` to `supabase_realtime` publication (safely guarded against duplicate_object / undefined_object).

#### 4. Dependencies:
- Depends on: 001 (businesses), 005 (wa_messages, wa_conversations).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261109_022_phase12_7_visual_flows_and_realtime.sql
```

#### 6. Expected Success Output:
- Clean execution, 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'wa_visual_flows';

SELECT schemaname, tablename FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename IN ('wa_messages', 'wa_conversations', 'wa_visual_flows');
```

#### 8. Failure Detection:
- Publication assignment failure; check constraint failure on status or flow_type.

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Alter publication `supabase_realtime` drop tables, drop table `wa_visual_flows`. Existing messages and conversations remain unaffected.

#### 10. Go / No-Go Condition:
- Table `wa_visual_flows` active; publication contains tables; RLS enabled.

---

### Step 8: Migration 023 — Operational Reliability

#### 1. Preconditions:
- Migration 022 verified applied.
- All background queues (`wa_processing_jobs`, `wa_scheduled_messages`, `wa_campaign_recipients`, `crm_follow_up_reminders`) active.

#### 2. SQL File:
`supabase/migrations/20261109_023_phase2_operational_reliability.sql` (488 lines)

#### 3. Expected Schema Changes:
- **Created Tables:**
  - `public.worker_execution_runs` (UUID PK, business_id FK nullable, worker_name, worker_id, status, started_at, completed_at, duration_ms, claimed_count, processed_count, succeeded_count, failed_count, reclaimed_count, skipped_count, error_message, metadata).
- **Altered Check Constraints (Dead-Letter Support):**
  - `wa_processing_jobs`: Permits `'dead_letter'`.
  - `wa_scheduled_messages`: Permits `'dead_letter'`.
  - `wa_campaign_recipients`: Permits `'dead_letter'`.
  - `crm_follow_up_reminders`: Permits `'dead_letter'`.
- **Created Indexes:**
  - Observability indexes on `worker_execution_runs`.
  - Stuck and retrying indexes on all 4 background queue tables.
- **Created Triggers & Functions:**
  - Telemetry aggregator RPC: `public.get_worker_health_metrics(UUID)` (`SECURITY DEFINER`, returns aggregated queue depth, stuck jobs, error rates).
  - Multi-queue stuck lock recovery RPC: `public.reclaim_stuck_queue_jobs(INT, UUID)` (`SECURITY DEFINER`, checks if message was dispatched before marking dead_letter to prevent duplicate delivery).
  - Manual requeue RPC: `public.retry_queue_job(UUID, TEXT, UUID)` (`SECURITY DEFINER`, resets dead-letter jobs safely).
  - Immutability trigger on `worker_execution_runs`.
- **RLS & Grants:**
  - Service role full access and authenticated tenant SELECT on `worker_execution_runs`.
  - RPC execution granted to `service_role` and `authenticated` where appropriate.

#### 4. Dependencies:
- Depends on: 009/010 (wa_processing_jobs), 018 (wa_scheduled_messages), 019 (wa_campaign_recipients), 020/021 (crm_follow_up_reminders).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261109_023_phase2_operational_reliability.sql
```

#### 6. Expected Success Output:
- Clean execution, 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'worker_execution_runs';

SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('get_worker_health_metrics', 'reclaim_stuck_queue_jobs', 'retry_queue_job');

-- Verify dead_letter is permitted
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint 
WHERE conname IN ('wa_processing_jobs_status_check', 'wa_scheduled_messages_status_check');
```

#### 8. Failure Detection:
- Check constraint update error if existing rows violate new definition (impossible here since baseline contains only valid states).

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Drop RPCs, drop table `worker_execution_runs`, revert check constraints to previous status sets.

#### 10. Go / No-Go Condition:
- `worker_execution_runs` active; all 3 RPCs exist; check constraints permit `dead_letter`.

---

### Step 9: Migration 024 — Conversation Labels and Distributed Cron Locks

#### 1. Preconditions:
- Migration 023 verified applied.
- `public.wa_conversations` intact.

#### 2. SQL File:
`supabase/migrations/20261109_024_phase_p3_2_labels_and_cron_locks.sql` (324 lines)

#### 3. Expected Schema Changes:
- **Altered Tables:**
  - `public.wa_conversations`: Adds column `labels TEXT[] NOT NULL DEFAULT '{}'::text[]`.
  - GIN Index: `idx_wa_conversations_labels ON wa_conversations USING GIN (labels)`.
- **Created Tables:**
  - `public.cron_locks` (lock_key TEXT PK, cron_name TEXT, business_id FK nullable, owner_id TEXT, acquired_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, renewed_at TIMESTAMPTZ, renewal_count INT, metadata JSONB).
- **Created Indexes:**
  - `idx_cron_locks_expires_at`, `idx_cron_locks_cron_name`, `idx_cron_locks_business_id`.
- **Created RPCs (Distributed Cron Coordinator):**
  - `public.acquire_cron_lock(TEXT, TEXT, TEXT, INT, UUID, JSONB)` (Atomic upsert with crash recovery on expired leases).
  - `public.renew_cron_lock(TEXT, TEXT, INT)` (Owner-verified lease renewal).
  - `public.release_cron_lock(TEXT, TEXT)` (Owner-verified release).
  - `public.get_cron_lock_status(TEXT)` (Read-only status inspection).
- **RLS & Grants:**
  - RLS enabled on `cron_locks`.
  - RPC execution granted to `service_role` and `authenticated`.
  - Immutability trigger `trg_cron_locks_immutable_business_id`.

#### 4. Dependencies:
- Depends on: 001 (businesses), 005 (wa_conversations).

#### 5. Execution Method:
```bash
npx supabase db query --remote=ansiwtwqgrfmzfrhkzuu -f supabase/migrations/20261109_024_phase_p3_2_labels_and_cron_locks.sql
```

#### 6. Expected Success Output:
- Clean execution, 0 errors.

#### 7. Post-Migration Verification Queries:
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'wa_conversations' AND column_name = 'labels';

SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_wa_conversations_labels';

SELECT table_name FROM information_schema.tables WHERE table_name = 'cron_locks';

SELECT routine_name FROM information_schema.routines 
WHERE routine_name IN ('acquire_cron_lock', 'renew_cron_lock', 'release_cron_lock', 'get_cron_lock_status');
```

#### 8. Failure Detection:
- GIN index creation failure; routine definition conflict.

#### 9. Recovery / Forward-Fix Strategy:
- Rollback: Drop RPCs, drop table `cron_locks`, drop index `idx_wa_conversations_labels`, drop column `labels` from `wa_conversations`.

#### 10. Go / No-Go Condition:
- `wa_conversations.labels` column active; GIN index active; all 4 cron locking RPCs callable.

---

## 3. Remote Ledger Version Stamping

Upon successful execution of each migration step, the remote ledger `supabase_migrations.schema_migrations` must record the official timestamp version:

| Step | Migration File | Ledger Version Stamping |
|:---:|---|---|
| 016 | `20261107_016_phase12_1_team_management_and_agent_assignment.sql` | `20261107202900` |
| 017 | `20261107_017_phase12_2_media_messaging.sql` | `20261107203000` |
| 018 | `20261108_018_phase12_3_scheduled_messages.sql` | `20261108102000` |
| 019 | `20261108_019_phase12_4_campaign_management.sql` | `20261108102500` |
| 020 | `20261108_020_phase12_5_crm_lifecycle_and_followups.sql` | `20261108151500` |
| 021 | `20261109_021_phase12_6_notification_center_and_durable_reminders.sql` | `20261109110500` |
| 022 | `20261109_022_phase12_7_visual_flows_and_realtime.sql` | `20261109185500` |
| 023 | `20261109_023_phase2_operational_reliability.sql` | `20261109191000` |
| 024 | `20261109_024_phase_p3_2_labels_and_cron_locks.sql` | `20261109200500` |

---

## 4. End-of-Sequence Cumulative Verification

After applying all 9 migrations, the post-migration verification suite must execute:

1. **Table Inventory Check:** Verify all 16 new tables exist and are registered in PostgREST schema cache.
2. **Constraint Check:** Verify all composite unique keys and composite foreign keys.
3. **Trigger Check:** Verify all tenant immutability triggers block reassignment of `business_id`.
4. **Row Count Verification:** Confirm baseline row counts across businesses, members, contacts, conversations, and messages remain 100% intact.
5. **Multi-Tenant RLS Test:** Authenticate as Astrology user (`astro@example.com`) and Vivaham user (`vivaham@example.com`) to verify strict row-level isolation across all 9 new feature areas.
6. **Application Integration Test:** Execute `npm test` (779/779 tests pass) and verify zero regression.
