# GOKUL CONNECT — DATABASE MIGRATION RUNBOOK
## Forward-Only Migration Standard & Execution Protocol

**Project:** Gokul Connect  
**Dedicated Database:** Supabase `ansiwtwqgrfmzfrhkzuu` (`ap-south-1`)  
**Engine:** PostgreSQL 17 (Supabase Managed Cloud)  
**Standard:** Forward-Only, Non-Destructive, RLS Hardened  

---

## 1. Migration Protocol & Non-Negotiable Rules

1. **Explicit User Approval:** Every live migration requires explicit user review and approval (Approval Gate 1).
2. **Never Reset Live Database:** `supabase db reset`, `DROP DATABASE`, and destructive table drop commands are strictly forbidden on live environments.
3. **Forward-Only SQL:** All schema evolutions must be forward-only additive operations or backward-compatible constraint relaxations.
4. **Preflight Replay Verification:** Every migration must be tested on a clean-slate in-memory PostgreSQL engine (PGlite) across migrations 001 through target prior to remote application.
5. **Preflight Baseline Snapshot:** Before applying migrations, capture a timestamped metadata snapshot of existing table structures and row counts.
6. **Multi-Tenant Security Enforcement:** Every new table must include `business_id UUID NOT NULL REFERENCES public.businesses(id)`, Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`), immutable tenant triggers, and covering indexes.

---

## 2. Remote Migration Ledger Status

### Verified Applied Migrations (001 – 015)
- `001`: `20261106_001_phase1_foundation.sql` (Businesses, Users, Memberships, RLS)
- `002`: `20261106_002_phase2_wa_connections.sql` (WhatsApp Connections & Business Settings)
- `003`: `20261106_003_phase2_wa_credentials.sql` (AES-256-GCM Credential Vault)
- `004`: `20261106_004_phase2_privilege_escalation_guard.sql` (Role Escalation Guards)
- `005`: `20261106_005_phase3_messaging_schema.sql` (Contacts, Conversations, Messages)
- `006`: `20261106_006_phase3_webhook_persistence_rpcs.sql` (Inbound Message Ingestion RPCs)
- `007`: `20261107_007_phase3i_performance_optimizations.sql` (Covering Indexes & Chat RPCs)
- `008`: `20261106_008_phase3h_webhook_events_rls.sql` (Webhook Events Table & RLS)
- `009`: `20261106_009_phase5_automation_engine_schema.sql` (Automation Rules & Execution Logs)
- `010`: `20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql` (Queue Jobs & Atomic RPC v2)
- `011`: `20261107_011_phase7_5_queue_rpc_privilege_hardening.sql` (Least Privilege Role Revocation)
- `012`: `20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql` (Arbiter Predicate Alignment)
- `013`: `20261107_013_phase9_crm_and_contacts.sql` (CRM Categories, Segments, Notes, Activity)
- `014`: `20261107_014_phase10_analytics_rpcs.sql` (Independent Analytics Aggregations)
- `015`: `20261107_015_phase11_template_management.sql` (Template Columns, Soft Archive, Status Check)

### Pending Remote Application (016 – 023)
- `016`: `20261107_016_phase12_1_team_management_and_agent_assignment.sql`
- `017`: `20261107_017_phase12_2_media_messaging.sql`
- `018`: `20261108_018_phase12_3_scheduled_messages.sql`
- `019`: `20261108_019_phase12_4_campaign_management.sql`
- `020`: `20261108_020_phase12_5_crm_lifecycle_and_followups.sql`
- `021`: `20261109_021_phase12_6_notification_center_and_durable_reminders.sql`
- `022`: `20261109_022_phase12_7_visual_flows_and_realtime.sql`
- `023`: `20261109_023_phase2_operational_reliability.sql`

---

## 3. Post-Migration Verification Standards

1. Catalog column existence check.
2. Check constraint validation.
3. RLS test: Verify anonymous caller receives 0 rows or 42501 error.
4. Tenant isolation test: Verify Astrology authenticated user receives 0 Vivaham rows and vice versa.
5. Immutability trigger test: Updating `business_id` raises exception `business_id is immutable`.
6. Baseline row count preservation: Ensure zero existing business, contact, or conversation records were modified or deleted.
