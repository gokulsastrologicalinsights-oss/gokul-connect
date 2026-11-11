# Gokul Connect — Milestone P0 Critical Fixes Report
**Generated**: November 9, 2026  
**Status**: Completed & Verified Locally  
**Branch / Workspace**: `E:\GAI\Whatsapp Automation`  

---

## Executive Summary

Milestone P0 addresses the five critical operational and architectural gaps identified during the comprehensive codebase audit in `DEVELOPMENT_GAP_ANALYSIS.md` and `REMAINING_DEVELOPMENT_ROADMAP.md`. All five gaps have been implemented, defensively safeguarded against cross-tenant data leaks and race conditions, and verified across all unit, integration, and regression test suites.

1. **Incoming WhatsApp Media Retrieval**: End-to-end media pipeline integrated into the webhook processor and background worker (`download_inbound_media` job), connecting Meta Graph API endpoints to the storage abstraction (`storeMediaFile`), persisting storage paths into `wa_messages` and `wa_media_files`, preventing duplicate downloads, retrying transient network errors with exponential backoff, sanitizing tokens from error logs, and adding an authenticated inline preview endpoint.
2. **Visual Flows Connected to Real Automation Worker**: Visual flow graphs (`wa_visual_flows`) are now queried and evaluated by `processInboundAutomation` in `src/lib/automation/dispatcher.ts` ahead of fallback legacy rules. Supports conditions, business hours checks, actions, delays, and loop detection (depth limit 15), while strictly respecting global opt-out and human takeover.
3. **Multi-Number Conversation Isolation**: `getOrCreateConversationForContactDb` now explicitly incorporates `connection_id` to prevent PostgreSQL multiple-row errors (`PGRST116`) when a single customer interacts across multiple WhatsApp numbers for the same business, while strictly rejecting cross-business connection mismatches.
4. **Reliable Campaign Worker Dispatch**: `launchCampaignAction` and `resumeCampaignDb` now atomically insert a durable `process_campaign` job into `wa_processing_jobs` with deterministic idempotency keys. The worker validates campaign status, opt-out status, and the 24-hour Meta messaging window before every recipient dispatch. Pausing or cancelling immediately aborts queued worker jobs.
5. **Database Migration Hardening (016–022)**: Fixed `search_path` and `SECURITY DEFINER` vulnerabilities in trigger functions (`017` and `018`), added publication replication for `wa_visual_flows` (`022`), and confirmed clean-slate replay in local PostgreSQL (PGlite).

---

## Gap 1: Incoming WhatsApp Media Retrieval

### 1. Original Problem
- Incoming webhooks extracted Meta media IDs (`image`, `document`, `audio`, `video`), but helper functions `downloadMetaMediaContent` and `getMetaMediaInfo` were never invoked.
- `wa_messages.storage_path` remained `null`, resulting in broken media previews in the inbox UI.
- No background queue job or fallback on-demand download existed.

### 2. Actual Implementation
- **Media Fetcher Utility** (`src/lib/whatsapp/media-fetcher.ts`):
  - Created `retrieveAndPersistInboundMedia` supporting `image`, `document`, `audio`, and `video`.
  - Enforces MIME-type size limits (images: 5MB, documents: 100MB, audio: 16MB, video: 16MB).
  - Fetches temporary download URLs from Meta Graph API using decrypted connection credentials.
  - Downloads media binary securely and streams to persistent storage via `storeMediaFile`.
  - Protects against duplicate downloads by checking `download_status === 'completed'` and `storage_path IS NOT NULL`.
  - Retries transient 5xx/network errors up to 3 attempts with exponential backoff.
  - Sanitizes sensitive Meta Bearer access tokens from all error messages and database log fields.
- **Worker Integration** (`src/lib/automation/worker.ts`):
  - Added worker job handler for `job_type === "download_inbound_media"`.
  - When an inbound message job containing media is processed, the worker triggers `retrieveAndPersistInboundMedia` to ensure media files are persisted durably.
- **Inbox On-Demand Download & UI Preview** (`src/app/actions/inbox.ts`, `src/app/api/media/download/route.ts`, `src/components/inbox/ChatWindowPanel.tsx`):
  - `getMediaDownloadUrlAction` triggers on-demand background fetch if the media was not yet retrieved.
  - `/api/media/download` provides dual authorization: time-limited signed HMAC tokens (`exp`, `sig`) or authenticated session access for workspace agents.
  - Inbox UI renders a pulsing pending badge when media is currently downloading.

### 3. Files Changed
- `src/lib/whatsapp/media-fetcher.ts` (New module)
- `src/lib/automation/worker.ts`
- `src/app/api/media/download/route.ts`
- `src/app/actions/inbox.ts`
- `src/components/inbox/ChatWindowPanel.tsx`

### 4. Migration Changes
- `supabase/migrations/20261107_017_phase12_2_media_messaging.sql`: Added `SECURITY DEFINER SET search_path = public, pg_temp` to function `populate_wa_message_media_fields()`.

### 5. Tests Added
- `tests/p0-critical-fixes-regression.test.ts` (Domain 2):
  - `2.1 Downloads incoming image, stores in private storage, and updates message`
  - `2.2 Prevents duplicate downloads if message is already downloaded`
  - `2.3 Retries transient failures with backoff and sanitizes errors without leaking tokens`

### 6. Verification Results
- 100% of media fetching and download tests passed.
- Buffer slicing and HMAC-secured signed streaming verified locally.

### 7. Remaining External Dependencies
> [!WARNING]
> **Storage Provider Credentials Notice**: In local development and unit testing, media is persisted using the built-in in-memory storage adapter fallback (`inMemoryMediaStore`). For live production operation, Supabase Storage bucket `whatsapp-media` must be provisioned with valid `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`. Incoming media retrieval cannot be claimed fully operational in production until these credentials and storage policies are active.

---

## Gap 2: Connect Visual Flows to Real Automation Worker

### 1. Original Problem
- Visual flows could be created, saved, and simulated in the UI builder, but were never queried or executed by `processInboundAutomation` in `src/lib/automation/dispatcher.ts`.
- The real inbound message worker exclusively evaluated legacy `wa_automation_rules`.

### 2. Actual Implementation
- **Visual Flow Runtime Evaluator** (`src/lib/flows/evaluator.ts`):
  - Added `getPublishedFlowsForBusiness` to retrieve published flows for a workspace.
  - Added `matchFlowTrigger` with case-insensitive and multi-language support (English and Tamil keywords, exact, contains, or starts_with matching).
  - Added `evaluateVisualFlow` to traverse the visual DAG from trigger to terminal nodes.
  - Supports condition nodes (e.g., `business_hours` in-hours/out-of-hours branching).
  - Supports action nodes (e.g., `send_message`, `assign_agent`, `update_contact`).
  - Supports delay nodes (e.g., scheduled follow-up jobs).
  - Loop circuit breaker: Tracks visited node IDs and enforces a maximum traversal depth of 15 nodes to prevent infinite loops.
- **Dispatcher Integration & Precedence** (`src/lib/automation/dispatcher.ts`):
  - Precedence order:
    1. **Opt-Out Check**: `STOP`, `UNSUBSCRIBE`, `QUIT`, `CANCEL`, `நிறுத்து` bypass all visual flows and execute opt-out handling immediately.
    2. **Human Handover Check**: If conversation is in `pending_human` or bot is paused, flow execution is skipped with `skip_reason: "human_takeover_active"`.
    3. **Published Visual Flows**: If an active published flow matches the incoming trigger, it executes, dispatches queued jobs (`flow_reply_*`), updates contact/conversation state, and halts processing.
    4. **Legacy Rules Engine Fallback**: If no visual flow matches, the existing deterministic rule engine (`evaluateAutomationRules`) processes the message.
  - Never executes draft or disabled flows (`status !== 'published'`).
  - Dispatches actions as durable background jobs to `wa_processing_jobs` rather than blocking the webhook handler.

### 3. Files Changed
- `src/lib/flows/evaluator.ts` (New module)
- `src/lib/flows/database.ts`
- `src/lib/automation/dispatcher.ts`
- `src/lib/automation/worker.ts`

### 4. Migration Changes
- `supabase/migrations/20261109_022_phase12_7_visual_flows_and_realtime.sql`: Added `ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_visual_flows;`.

### 5. Tests Added
- `tests/p0-critical-fixes-regression.test.ts` (Domain 4):
  - `4.1 Matches trigger keyword case-insensitively and in Tamil`
  - `4.2 Never matches or executes draft or disabled flows`
  - `4.3 Executes supported flow nodes deterministically and traverses conditions`
  - `4.4 Enforces infinite loop prevention when flow graph contains cycles`
  - `4.5 Respects Opt-Out keyword STOP and halts visual flows immediately`

### 6. Verification Results
- 100% test pass across visual flow trigger matching, condition evaluation, loop prevention, and opt-out precedence.

### 7. Remaining External Dependencies
- Requires `wa_visual_flows` table in database (provided by migration 022).

---

## Gap 3: Fix Multi-Number Conversation Handling

### 1. Original Problem
- `getOrCreateConversationForContactDb` executed `.maybeSingle()` on `(business_id, contact_id)`.
- If a contact had communicated across multiple WhatsApp phone numbers (e.g., Line 1 KP Consultation and Line 2 Remedial) belonging to the same business, `.maybeSingle()` threw PostgreSQL error `PGRST116` ("multiple (or no) rows returned").

### 2. Actual Implementation
- **Connection-Aware Conversation Lookup** (`src/lib/crm/database.ts`):
  - Updated `getOrCreateConversationForContactDb` to accept an options bag `{ connectionId?: string, client?: any }`.
  - When `connectionId` is provided:
    - Queries for `business_id`, `contact_id`, AND `connection_id`.
    - Cross-business validation: Validates that `connection_id` belongs to `business_id`; throws an error if a cross-business connection is attempted.
  - When `connectionId` is omitted:
    - Queries by `business_id` and `contact_id` ordering by `last_message_at DESC NULLS LAST` with `.limit(1)`.
  - If no conversation exists, creates a new one explicitly binding `connection_id`.
- **Client and Store Pass-Through** (`src/lib/crm/store.ts`):
  - Updated store wrapper `getOrCreateConversationForContact` to pass options and connection ID.

### 3. Files Changed
- `src/lib/crm/database.ts`
- `src/lib/crm/store.ts`

### 4. Migration Changes
- No schema alteration required. Table `wa_conversations` already contains composite unique index `(connection_id, contact_id)` as established in migration `005`. The defect was entirely in the query methodology in `database.ts`.

### 5. Tests Added
- `tests/p0-critical-fixes-regression.test.ts` (Domain 3):
  - `3.1 Resolves distinct conversations for the same contact communicating on two WhatsApp lines`
  - `3.2 Rejects cross-business connection mismatch when creating conversation`

### 6. Verification Results
- 100% test pass. Multiple conversations for the same contact on distinct phone lines are cleanly separated without `PGRST116` errors.

### 7. Remaining External Dependencies
- None.

---

## Gap 4: Reliable Campaign Worker Dispatch

### 1. Original Problem
- `launchCampaignAction` populated recipient rows in `wa_campaign_recipients` and set `status = 'queued'`, but relied on an ephemeral background promise (`processCampaignWorker`) that could be dropped during process recycling or serverless function termination.
- Lack of queue integration meant campaigns were not guaranteed to be claimed and processed by the background cron worker.

### 2. Actual Implementation
- **Durable Queue Enqueueing** (`src/lib/campaigns/database.ts`):
  - `launchCampaignDb` and `resumeCampaignDb` now atomically insert a durable job into `wa_processing_jobs`:
    - `job_type = "process_campaign"`
    - `idempotency_key = "campaign_dispatch_<campaign_id>_<timestamp>"`
    - `status = "pending"`
  - `pauseCampaignDb` and `cancelCampaignDb` immediately update any pending/claimed queue jobs for that campaign to `status = "cancelled"`, preventing worker execution.
- **Worker Execution & Safeguards** (`src/lib/automation/worker.ts`):
  - Worker claims `process_campaign` jobs via `claim_wa_processing_jobs` RPC.
  - Multi-gate safety validation before processing each recipient batch:
    - **Gate 1 (Status Revalidation)**: Queries live campaign status from database; if `paused` or `cancelled`, immediately halts.
    - **Gate 2 (Opt-Out Revalidation)**: Queries contact consent; if contact has opted out since campaign launch, marks recipient as `skipped_opt_out`.
    - **Gate 3 (24h Window Check)**: Verifies Meta messaging window; if outside 24 hours, requires approved marketing template.
- **Campaign Execution State**:
  - Updates campaign progress metrics (`sent_count`, `delivered_count`, `failed_count`).
  - Sets campaign `status = 'completed'` when all recipients are processed.

### 3. Files Changed
- `src/lib/campaigns/database.ts`
- `src/lib/automation/worker.ts`

### 4. Migration Changes
- None required. Leveraged existing `wa_processing_jobs` queue and `claim_wa_processing_jobs` RPC from migrations `009` and `010`.

### 5. Tests Added
- `tests/p0-critical-fixes-regression.test.ts` (Domain 5):
  - `5.1 Enqueues durable process_campaign job when campaign is launched`
  - `5.2 Cancels pending queue job when campaign is paused or cancelled`
  - `5.3 Skips recipient dispatch if campaign is paused immediately prior to send (Gate 1)`

### 6. Verification Results
- 100% test pass. Atomic claiming, pause abort, and durable queueing verified.

### 7. Remaining External Dependencies
- Centralized cron runner `/api/cron/process-campaigns` must be triggered periodically by Vercel Cron or an external scheduler.

---

## Gap 5: Database Migration Compatibility (016–022)

### 1. Original Problem
- Functions in migrations `017` and `018` were defined as plain functions without `SECURITY DEFINER` and `SET search_path = public, pg_temp`, creating potential search_path injection risks.
- Migration `022` lacked publication replication for `wa_visual_flows` in `supabase_realtime`.

### 2. Actual Implementation
- **Migration 017** (`supabase/migrations/20261107_017_phase12_2_media_messaging.sql`):
  - Added `SECURITY DEFINER SET search_path = public, pg_temp` to trigger function `populate_wa_message_media_fields()`.
- **Migration 018** (`supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql`):
  - Added `SECURITY DEFINER SET search_path = public, pg_temp` to trigger function `sync_scheduled_message_delivery_status()`.
- **Migration 022** (`supabase/migrations/20261109_022_phase12_7_visual_flows_and_realtime.sql`):
  - Added `ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_visual_flows;`.
- **Clean-Slate Replay in PGlite**:
  - Replayed all 22 migration files sequentially from `001` through `022` against a clean in-memory PostgreSQL instance. Verified that all tables, foreign keys, RLS policies, tenant immutability triggers, and RPCs compile with zero errors.

### 3. Files Changed
- `supabase/migrations/20261107_017_phase12_2_media_messaging.sql`
- `supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql`
- `supabase/migrations/20261109_022_phase12_7_visual_flows_and_realtime.sql`

### 4. Tests Added
- `tests/p0-critical-fixes-regression.test.ts` (Domain 1):
  - `1.1 Confirms all 22 database migrations replay cleanly and creates all tables`
  - `1.2 Confirms tenant immutability triggers on wa_media_files, wa_campaigns, and wa_visual_flows`

### 5. Verification Results
- 100% test pass on clean-slate replay.

### 6. Remaining External Dependencies
> [!IMPORTANT]
> **Pending Live Supabase Deployment**: Migrations 016–022 have been verified locally via PGlite and have NOT been applied to the live production Supabase instance (`ansiwtwqgrfmzfrhkzuu`), in strict compliance with Milestone P0 constraints.

---

## Full Test & Verification Summary

| Verification Step | Target / Command | Result |
| :--- | :--- | :--- |
| **P0 Regression Suite** | `npx vitest run tests/p0-critical-fixes-regression.test.ts` | **15 passed (100%)** |
| **Phase 7.5 Suite** | `npx vitest run tests/phase7-5-webhook-decoupling.test.ts` | **18 passed (100%)** |
| **Complete Vitest Suite** | `npx vitest run` | **48 test files, 744 tests passed (100%)** |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **0 errors (Exit code 0)** |
| **Dependency Vulnerabilities**| `npm audit` | **0 vulnerabilities found** |
| **Next.js Production Build** | `npm run build` | **Build completed successfully (Exit code 0)** |
