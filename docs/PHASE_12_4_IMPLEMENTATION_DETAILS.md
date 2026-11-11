# Phase 12.4 — Implementation Details

**Platform:** Gokul Connect  
**Module:** Campaign Management & Bulk WhatsApp Messaging  
**Date:** `2026-11-08`  

---

## 1. Database Implementation

### 1.1 Migration 019: `20261108_019_phase12_4_campaign_management.sql`

```sql
-- Core Tables Created:
-- 1. wa_contacts additions (is_blocked, consent_status, consent_source, consented_at, consent_withdrawn_at, last_eligibility_evaluation_at)
-- 2. wa_campaigns (tenant-isolated campaign records with composite unique (id, business_id))
-- 3. wa_campaign_recipients (unique (campaign_id, phone_number), composite foreign keys, delivery tracking)
-- 4. claim_next_campaign_recipients RPC (FOR UPDATE SKIP LOCKED)
-- 5. reclaim_stuck_campaign_recipients RPC (5-minute timeout)
-- 6. trg_wa_messages_sync_campaign_status (Webhook delivery status rollup)
-- 7. Row Level Security policies enforcing tenant boundaries
```

### 1.2 Status Transitions Matrix
```
[draft] -----> [preparing] -----> [queued] -----> [sending] -----> [completed]
   |                |                |               |
   |                |                +------> [paused] <---+
   |                |                           |          |
   |                |                           v          |
   |                +-------------------> [cancelled]      |
   |                                            ^          |
   +--------------------------------------------+          |
                                                |          |
                                           [failed] -------+
```

---

## 2. Code Modules Created and Modified

### 2.1 Schema & Types
- `src/types/database.ts`: Added `CampaignStatus`, `CampaignMessageType`, `CampaignAudienceType`, `CampaignRecipientStatus`, `CampaignRecipientEligibility`, `WhatsAppCampaign`, `WhatsAppCampaignRecipient`, `CampaignSummaryStats`, `CampaignFilterOptions`, and `CampaignAudiencePreviewResult`. Extended `WhatsAppContact` with consent attributes.
- `src/lib/validation/schemas.ts`: Added `CreateCampaignSchema`, `UpdateCampaignSchema`, `CampaignAudienceFiltersSchema`, and `CampaignAudiencePreviewSchema`.

### 2.2 Compliance & Eligibility Engine
- `src/lib/campaigns/eligibility.ts`:
  - `validateWhatsAppPhoneNumber(phone)`: E.164 normalization, length checks (10-15 digits), dummy repeating number rejection.
  - `evaluateContactEligibility(contact, messageType, options)`: 5 compliance gates:
    - Opt-out status check (STOP / Tamil `நிறுத்து`).
    - Block check.
    - Phone number validation.
    - Consent status check (`none` without inbound excluded).
    - 24-hour service window check for non-template campaigns.
  - `revalidateRecipientAtDispatch(supabase, businessId, recipient, messageType)`: Direct database revalidation immediately before dispatch.

### 2.3 Database Layer & Store
- `src/lib/campaigns/database.ts`: Tenant-scoped operations (`createCampaignDb`, `updateCampaignDb`, `getCampaignByIdDb`, `listCampaignsDb`, `prepareCampaignAudienceDb`, `launchCampaignDb`, `pauseCampaignDb`, `resumeCampaignDb`, `cancelCampaignDb`, `deleteDraftCampaignDb`, `getCampaignRecipientsDb`, `retryFailedCampaignRecipientsDb`, `getCampaignStatsDb`, `exportCampaignRecipientsToCsv`). Includes dual-layer persistence (Supabase-first with in-memory fallback for local tests).
- `src/lib/campaigns/store.ts`: High-level store wrapper that automatically records audit entries in `team_activity_logs`.

### 2.4 Batch Dispatch Worker
- `src/lib/campaigns/worker.ts`:
  - `calculateCampaignBackoffDelay(attempts)`: Exponential backoff with random jitter.
  - `dispatchSingleCampaignRecipient(supabase, campaign, recipient, workerId)`: 6 verification gates including connection health, real-time opt-out revalidation, approved template verification, and 24h window compliance.
  - `processCampaignsBatch(options)`: Batch processing engine with stuck-job reclaiming and automatic completion detection.
- `src/app/api/cron/process-campaigns/route.ts`: Timing-safe Bearer authenticated cron endpoint (`CRON_SECRET`).

### 2.5 Server Actions & Permissions
- `src/app/actions/campaigns.ts`:
  - `getCampaignsAction`, `getCampaignDetailsAction`, `getCampaignStatsAction` (All authenticated members).
  - `createCampaignAction`, `updateCampaignAction`, `prepareCampaignAudienceAction`, `cancelCampaignAction`, `deleteDraftCampaignAction` (Owner & Admin only).
  - `launchCampaignAction`, `pauseCampaignAction`, `resumeCampaignAction`, `retryFailedCampaignRecipientsAction` (Owner, Admin & Agent).
  - Viewer role strictly blocked from all mutations with HTTP 403 / permission error.
  - `exportCampaignResultsCsvAction`: RFC 4180 export with SEC-MED-02 formula injection protection.

### 2.6 User Interface
- `src/components/workspace/WorkspaceSidebar.tsx`: Activated "Campaigns" with phase 12 and active badge.
- `src/app/workspace/[businessSlug]/campaigns/page.tsx`: Campaigns dashboard page.
- `src/components/campaigns/CampaignsDashboardClient.tsx`: 4 KPI summary cards, filter tabs, search, progress bars, pause/resume/cancel controls.
- `src/app/workspace/[businessSlug]/campaigns/new/page.tsx`: Campaign creation wizard page.
- `src/components/campaigns/CampaignCreatorClient.tsx`: 4-step wizard with live audience preview, compliance breakdown, template picker with live WhatsApp bubble, and Asia/Kolkata scheduling.
- `src/app/workspace/[businessSlug]/campaigns/[campaignId]/page.tsx`: Campaign details page.
- `src/components/campaigns/CampaignDetailClient.tsx`: Real-time analytics, recipient report table, error logs, and one-click CSV export.

---

## 3. Test Suite: `tests/phase12-4-campaign-management.test.ts`

28 focused automated tests covering all 10 verification domains:
1. Migration 019 PGlite clean replay, constraints, triggers, and RPCs (6 tests).
2. Eligibility & consent safeguards (5 tests).
3. Campaign creation, lifecycle transitions, pause/resume/cancel (5 tests).
4. Audience builder, filters, and anti-duplicate deduplication (2 tests).
5. Batch claiming, rate limits, and backoff calculation (3 tests).
6. Pre-dispatch real-time opt-out revalidation (1 test).
7. Template approval validation (1 test).
8. Real analytics calculations and delivery rates (1 test).
9. SEC-MED-02 formula injection neutralization in CSV exports (1 test).
10. Cross-business isolation and role-based permissions (3 tests).
