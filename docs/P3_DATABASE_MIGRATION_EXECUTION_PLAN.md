# GOKUL CONNECT — P3: DATABASE MIGRATION EXECUTION PLAN & READINESS

**Target Project:** Dedicated Gokul Connect Supabase Project `ansiwtwqgrfmzfrhkzuu`  
**Host Region:** AWS Mumbai (`ap-south-1`)  
**Database Engine:** PostgreSQL 15.x with `pgcrypto`  
**Milestone:** P3 — Final Integration and Launch Readiness  
**Execution Policy:** **STAGED EXECUTION POST-APPROVAL ONLY** (Do not execute against live Supabase without explicit approval)

---

## 1. Migration Inventory & Dependency Order

All 23 migration scripts have been audited, sequence-verified, and validated via clean-slate PGlite replay:

| # | Migration File | Primary Schema Objects & Responsibilities | Dependency Prerequisites |
| :-: | :--- | :--- | :--- |
| **001** | `20261106_001_phase1_foundation.sql` | `businesses`, `user_profiles`, `business_members`, base RLS & seed tenants (`astrology`, `vivaham`) | None |
| **002** | `20261106_002_phase2_wa_connections.sql` | `wa_connections`, composite FKs `(business_id, id)`, connection RLS | 001 |
| **003** | `20261106_003_phase2_wa_credentials.sql` | `wa_connection_credentials`, AES-256 encrypted access tokens | 001, 002 |
| **004** | `20261106_004_phase2_privilege_escalation_guard.sql` | RBAC constraints, membership update guards | 001 |
| **005** | `20261106_005_phase3_messaging_schema.sql` | `wa_contacts`, `wa_conversations`, `wa_messages`, tenant immutability triggers | 001, 002 |
| **006** | `20261106_006_phase3_webhook_persistence_rpcs.sql` | `ingest_wa_inbound_message` RPC, webhook deduplication | 005 |
| **007** | `20261106_007_phase3i_performance_optimizations.sql` | Partial indexes on unread conversations, composite message timestamps | 005 |
| **008** | `20261106_008_phase3h_webhook_events_rls.sql` | Webhook raw event logging RLS and security hardening | 006 |
| **009** | `20261106_009_phase5_automation_engine_schema.sql` | `wa_automation_rules`, `wa_rule_conditions`, `wa_rule_actions`, `wa_processing_jobs` | 005 |
| **010** | `20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql` | `ingest_wa_inbound_message_v2` atomic ingestion and worker queueing | 006, 009 |
| **011** | `20261107_011_phase7_5_queue_rpc_privilege_hardening.sql` | Revoke anonymous RPC execution, grant service_role only | 010 |
| **012** | `20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql` | Unique partial indexes on `(business_id, phone_number)` | 010 |
| **013** | `20261107_013_phase9_crm_and_contacts.sql` | `crm_categories`, `crm_tags`, `crm_notes`, `crm_segments` | 005 |
| **014** | `20261107_014_phase10_analytics_rpcs.sql` | `get_business_analytics_v2`, `get_hourly_inbound_trends` RPCs | 005, 013 |
| **015** | `20261107_015_phase11_template_management.sql` | `wa_templates`, `wa_template_parameters`, sync status constraints | 002 |
| **016** | `20261107_016_phase12_1_team_management_and_agent_assignment.sql` | `team_invitations`, `conversation_assignment_logs`, `team_activity_logs` | 001, 005 |
| **017** | `20261107_017_phase12_2_media_messaging.sql` | `wa_media_files`, media storage columns on `wa_messages`, payload triggers | 005 |
| **018** | `20261108_018_phase12_3_scheduled_messages.sql` | `wa_scheduled_messages`, cron queue integration | 005, 009 |
| **019** | `20261108_019_phase12_4_campaign_management.sql` | `wa_campaigns`, `wa_campaign_recipients`, atomic claim RPC `claim_campaign_recipients` | 005, 015 |
| **020** | `20261108_020_phase12_5_crm_lifecycle_and_followups.sql` | `crm_follow_ups`, `crm_reminders`, lifecycle stage constraints | 013 |
| **021** | `20261109_021_phase12_6_notification_center_and_durable_reminders.sql` | `wa_notifications`, `notification_preferences`, reminder dispatch queue | 016, 020 |
| **022** | `20261109_022_phase12_7_visual_flows_and_realtime.sql` | `visual_flows`, `flow_versions`, real-time pub/sub replication | 009 |
| **023** | `20261109_023_phase2_operational_reliability.sql` | `worker_execution_runs`, `cron_locks`, dead-letter queues, `reclaim_stuck_queue_jobs`, `get_worker_health_metrics` | 009, 018, 019 |

---

## 2. Pre-Flight Verification & Safety Checks

Prior to applying migrations to the live Supabase project `ansiwtwqgrfmzfrhkzuu`:

1. **Verify Live Project Identifiers:**
   ```bash
   SUPABASE_PROJECT_ID="ansiwtwqgrfmzfrhkzuu"
   SUPABASE_REGION="ap-south-1"
   ```
2. **Confirm Backup / Snapshot:**
   Trigger point-in-time backup via Supabase Dashboard before executing any DDL.
3. **Database Role Permissions:**
   Ensure the executing connection uses `postgres` or `service_role` superuser privileges so triggers and RLS policies can be declared without permission barriers.

---

## 3. Step-by-Step Live Execution Procedure

When explicit user approval is granted, execute via Supabase CLI or direct migration runner:

### Step 1: Migration Replay via Supabase CLI
```bash
# Link project
supabase link --project-ref ansiwtwqgrfmzfrhkzuu

# Push migrations sequentially
supabase db push
```

### Step 2: Post-Migration Schema Verification
Run sanity queries against live database:
```sql
-- 1. Verify all 23 migrations registered
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- 2. Verify businesses seed
SELECT id, slug, name FROM public.businesses;

-- 3. Verify core triggers exist
SELECT trigger_name, event_object_table FROM information_schema.triggers 
WHERE trigger_name LIKE 'trg_%_tenant_immutable';

-- 4. Verify operational reliability tables
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('worker_execution_runs', 'cron_locks', 'wa_processing_jobs');
```

---

## 4. Rollback and Disaster Recovery Plan

If an unexpected error occurs during migration:
1. **Transaction Isolation:** Each migration file is structured within atomic transactions (`BEGIN ... COMMIT`).
2. **Failed Migration Recovery:**
   - Review failed SQL statement and error log.
   - Revert current migration using the corresponding `DOWN` statement if available, or restore from the pre-migration snapshot.
3. **Emergency Lock Break:**
   ```sql
   DELETE FROM public.cron_locks;
   ```

---

## 5. Production Environment Variables Inventory

| Variable Name | Environment | Purpose & Description | Sensitivity |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Web & Worker | Supabase project endpoint (`https://ansiwtwqgrfmzfrhkzuu.supabase.co`) | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web & Worker | Anonymous public client key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Web & Worker | Elevated administrative key for background workers and RPCs | **SECRET** |
| `META_APP_ID` | Web & Worker | Meta WhatsApp Developer App ID | Standard |
| `META_APP_SECRET` | Web & Worker | Meta App Secret for HMAC webhook verification | **SECRET** |
| `META_WEBHOOK_VERIFY_TOKEN` | Web | Inbound webhook registration token | **SECRET** |
| `CRON_SECRET` | Worker & Vercel | Bearer token for Vercel Cron worker triggering | **SECRET** |
| `CREDENTIAL_ENCRYPTION_KEY` | Web & Worker | 32-byte AES-256-GCM symmetric key for access token vault | **SECRET** |
| `RESEND_API_KEY` | Web | Email provider API key for invitation delivery | **SECRET** |
| `EMAIL_FROM` | Web | Verified sender address (e.g. `notifications@gokulconnect.com`) | Standard |
| `NEXT_PUBLIC_APP_URL` | Web | Production canonical URL (`https://app.gokulconnect.com`) | Standard |
