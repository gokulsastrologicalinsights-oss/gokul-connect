# GOKUL CONNECT — P4 GATE 1: SCHEMA COMPATIBILITY MATRIX & PRODUCTION CONTROLS
## Application Source Code Compatibility, Partial-Failure Blast Radii, and Production Safety Controls

**Target Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`)  
**Application Repository:** `E:\GAI\Whatsapp Automation`  
**Test Suite Coverage:** 51 test suites, 779/779 tests passing (100% pass)  
**TypeScript Status:** `npx tsc --noEmit` — 0 errors  
**Next.js Build Status:** 10 static pages, 32 dynamic routes, zero build errors  
**Audit Status:** `npm audit` — 0 vulnerabilities  

---

## 1. Application Source Code Compatibility Matrix

The table below maps each migration (016–024) to the specific application source files, UI routes, API endpoints, and background worker modules that consume the schema:

| Migration | Required Database Objects | Consuming Application Code Modules | Verification State |
|:---:|---|---|:---:|
| **016** (Team Management) | `business_invitations`<br>`team_activity_logs`<br>`conversation_assignment_logs`<br>`wa_conversations.assigned_agent_id` | - `src/app/workspace/[businessSlug]/team/page.tsx`<br>- `src/components/workspace/TeamClient.tsx`<br>- `src/app/actions/team.ts`<br>- `src/lib/team/store.ts`<br>- `src/app/actions/inbox.ts` (assignAgent) | **100% Compatible**<br>Tested in `tests/phase12-1-team-management.test.ts` |
| **017** (Media Messaging) | `wa_media_files`<br>`wa_messages` media cols<br>`trg_wa_messages_populate_media` | - `src/lib/media/storage.ts`<br>- `src/lib/media/inbound-downloader.ts`<br>- `src/app/api/media/download/route.ts`<br>- `src/components/workspace/ChatWindow.tsx`<br>- `src/lib/whatsapp/cloud-api.ts` | **100% Compatible**<br>Tested in `tests/p0-1-media-retrieval-download.test.ts` |
| **018** (Scheduled Messages) | `wa_scheduled_messages`<br>`claim_next_scheduled_messages`<br>`reclaim_stuck_scheduled_messages` | - `src/app/workspace/[businessSlug]/scheduled/page.tsx`<br>- `src/components/workspace/ScheduledClient.tsx`<br>- `src/app/actions/scheduled.ts`<br>- `src/lib/scheduled/worker.ts`<br>- `src/app/api/cron/process-scheduled-messages/route.ts` | **100% Compatible**<br>Tested in `tests/phase12-3-scheduled-messages.test.ts` |
| **019** (Campaigns) | `wa_campaigns`<br>`wa_campaign_recipients`<br>`claim_next_campaign_recipients`<br>`wa_contacts` consent cols | - `src/app/workspace/[businessSlug]/campaigns/page.tsx`<br>- `src/components/workspace/CampaignsClient.tsx`<br>- `src/app/actions/campaigns.ts`<br>- `src/lib/campaigns/worker.ts`<br>- `src/app/api/cron/process-campaigns/route.ts` | **100% Compatible**<br>Tested in `tests/phase12-4-campaign-management.test.ts` |
| **020** (CRM Lifecycle) | `crm_lifecycle_stages`<br>`contact_lifecycle_history`<br>`crm_follow_ups`<br>`crm_follow_up_reminders` | - `src/app/workspace/[businessSlug]/crm/page.tsx`<br>- `src/app/workspace/[businessSlug]/crm/follow-ups/page.tsx`<br>- `src/components/workspace/CrmClient.tsx`<br>- `src/components/workspace/FollowUpsClient.tsx`<br>- `src/app/actions/crm.ts`<br>- `src/app/actions/follow-ups.ts` | **100% Compatible**<br>Tested in `tests/phase12-5-crm-lifecycle.test.ts` |
| **021** (Notification Center) | `crm_follow_up_reminders` notification cols<br>`user_notification_preferences`<br>`claim_next_reminder_jobs` | - `src/app/workspace/[businessSlug]/notifications/page.tsx`<br>- `src/components/workspace/NotificationsClient.tsx`<br>- `src/app/api/workspace/[businessSlug]/notifications/route.ts`<br>- `src/lib/notifications/store.ts`<br>- `src/lib/notifications/worker.ts`<br>- `src/app/api/cron/process-crm-reminders/route.ts` | **100% Compatible**<br>Tested in `tests/phase12-6-notification-center.test.ts` |
| **022** (Visual Flows & Realtime) | `wa_visual_flows`<br>`supabase_realtime` pub | - `src/app/workspace/[businessSlug]/flows/page.tsx`<br>- `src/components/workspace/FlowBuilderClient.tsx`<br>- `src/app/actions/flows.ts`<br>- `src/lib/automation/visual-flow-engine.ts`<br>- `src/lib/supabase/client.ts` (realtime channel) | **100% Compatible**<br>Tested in `tests/phase12-7-ui-features-priority.test.ts` |
| **023** (Operational Reliability) | `worker_execution_runs`<br>`get_worker_health_metrics`<br>`reclaim_stuck_queue_jobs`<br>`retry_queue_job`<br>`dead_letter` status | - `src/app/workspace/[businessSlug]/operations/page.tsx`<br>- `src/components/workspace/OperationsClient.tsx`<br>- `src/lib/workers/telemetry.ts`<br>- `src/lib/workers/dead-letter.ts`<br>- `src/app/api/health/workers/route.ts`<br>- `src/lib/cron/coordinator.ts` | **100% Compatible**<br>Tested in `tests/p2-operational-reliability.test.ts` |
| **024** (Labels & Cron Locks) | `wa_conversations.labels`<br>`cron_locks`<br>`acquire_cron_lock`<br>`renew_cron_lock`<br>`release_cron_lock` | - `src/app/workspace/[businessSlug]/inbox/page.tsx`<br>- `src/components/workspace/ChatWindow.tsx` (Labels & Filter)<br>- `src/app/actions/inbox.ts` (updateConversationLabelsAction)<br>- `src/lib/cron/coordinator.ts` (PostgreSQL lock manager)<br>- All 4 cron routes (`/api/cron/*`) | **100% Compatible**<br>Tested in `tests/p3-2-blocker-remediation.test.ts`<br>and `tests/p3-3-independent-verification.test.ts` |

---

## 2. Partial Migration Failure & Blast Radius Analysis

If the migration process is halted or fails midway, specific application features would break if exposed to production traffic without the subsequent migrations in place:

```
+--------------------------------------------------------------------------------------------------------+
|                                  PARTIAL FAILURE BLAST RADIUS MAP                                      |
+--------------------------------------------------------------------------------------------------------+
| IF STOPPED AFTER: | BROKEN CAPABILITIES IF TRAFFIC ALLOWED:                                             |
+-------------------+------------------------------------------------------------------------------------+
| 016 (Team)        | - Media upload/download fails (wa_media_files missing)                             |
|                   | - Scheduled messages route 500s (wa_scheduled_messages missing)                     |
|                   | - Campaigns, CRM follow-ups, and notifications non-functional                      |
+-------------------+------------------------------------------------------------------------------------+
| 017 (Media)       | - Scheduled messages route 500s (wa_scheduled_messages missing)                     |
|                   | - Campaigns and CRM lifecycle non-functional                                       |
+-------------------+------------------------------------------------------------------------------------+
| 018 (Scheduled)   | - Campaigns and CRM follow-ups non-functional                                       |
+-------------------+------------------------------------------------------------------------------------+
| 019 (Campaigns)   | - CRM follow-up reminders non-functional (crm_lifecycle_stages missing)             |
|                   | - Notification center non-functional                                               |
+-------------------+------------------------------------------------------------------------------------+
| 020 (CRM)         | - Notification center fails when saving user preferences                           |
|                   | - System notifications missing dedup_key and category columns                      |
+-------------------+------------------------------------------------------------------------------------+
| 021 (Notify)      | - Visual flow builder cannot save flows (wa_visual_flows missing)                  |
|                   | - Realtime message broadcast unapplied                                             |
+-------------------+------------------------------------------------------------------------------------+
| 022 (Visual)      | - Operations dashboard fails (worker_execution_runs & metrics RPC missing)         |
|                   | - Dead-letter status rejected by queue tables                                      |
+-------------------+------------------------------------------------------------------------------------+
| 023 (Reliability) | - Distributed cron locking falls back or fails (cron_locks missing)               |
|                   | - Inbox label filtering fails (wa_conversations.labels missing)                     |
+-------------------+------------------------------------------------------------------------------------+
```

### Blast Radius Remediation:
To prevent any of these partial failure states from affecting users, **the maintenance isolation protocol (Section 3) must be strictly enforced during the migration window**.

---

## 3. Production Safety Controls & Isolation Protocols

### Control 1: Maintenance Window & Worker Pause
- **Mechanism:** During the sequential migration execution, all 4 cron endpoints must be temporarily paused by setting `CRON_ENABLED=false` or changing the secret bypass header, preventing Vercel cron jobs from running workers against incomplete schemas.
- **Worker Endpoints Guarded:**
  - `/api/cron/process-automation-jobs`
  - `/api/cron/process-scheduled-messages`
  - `/api/cron/process-campaigns`
  - `/api/cron/process-crm-reminders`

### Control 2: Preventing Live WhatsApp Dispatch
- **Mechanism:** No campaigns can be launched because all campaigns start in `draft` state upon creation and require explicit UI activation (`launchCampaignAction`).
- **Safety Guarantee:** Scheduled messages require explicit submission. Existing tables contain 0 scheduled messages and 0 campaigns. Zero WhatsApp messages will be triggered by applying migrations.

### Control 3: Preventing Inbound Webhook Conflicts
- **Mechanism:** Inbound webhooks call `ingest_wa_inbound_message_v2` (from Migration 010/012).
- **Safety Guarantee:** Migration 017 adds media columns and a trigger `trg_wa_messages_populate_media` to `wa_messages`. This trigger is backward-compatible with text messages (sets `media_type = null` and returns cleanly). Existing inbound message ingestion continues uninterrupted.

### Control 4: Multi-Tenant Isolation & Role Protection
- **Tenant Integrity:** Every new table introduced (`business_invitations`, `team_activity_logs`, `conversation_assignment_logs`, `wa_media_files`, `wa_scheduled_messages`, `wa_campaigns`, `wa_campaign_recipients`, `crm_lifecycle_stages`, `crm_follow_ups`, `crm_follow_up_reminders`, `user_notification_preferences`, `wa_visual_flows`, `cron_locks`) includes:
  1. `business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE`
  2. Composite unique constraint `(id, business_id)`
  3. Tenant immutability trigger `prevent_tenant_reassignment()`
  4. Row Level Security enabled with `check_user_business_access(business_id)`
- **Role Hierarchy Enforcement:**
  - `Owner`: Full administrative privileges, can invite members, assign roles, manage credentials.
  - `Admin`: Full operational privileges, can assign agents, dispatch campaigns, manage flows.
  - `Agent`: Operational privileges, can reply in inbox, manage contacts, complete follow-ups. Blocked from modifying business settings, invitations, or worker retry endpoints.
  - `Viewer`: Read-only access across all workspace pages. Mutating actions strictly return HTTP 403 Forbidden.

### Control 5: Protection of Existing Astrology & Vivaham Records
- **Existing Records:**
  - Astrology: 1 conversation, 12 messages, 2 contacts.
  - Vivaham: 1 active credential, 2 conversations, 3 messages, 2 contacts.
- **Safety Guarantee:** None of migrations 016–024 execute `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE`. All schema modifications are strictly **additive** (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Baseline records will remain 100% intact.
