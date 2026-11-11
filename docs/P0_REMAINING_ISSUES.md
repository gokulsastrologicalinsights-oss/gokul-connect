# Gokul Connect — Milestone P0 Remaining Issues & Pre-Deployment Checklist

**Generated**: November 9, 2026  
**Status**: Milestone P0 Code Complete  

---

## 1. Summary of Milestone P0 Status

Milestone P0 has resolved all five critical code and architecture gaps locally:
- [x] Inbound media retrieval with deduplication, retries, and token sanitization.
- [x] Published visual flows integrated into real worker with safe precedence.
- [x] Multi-number conversation isolation preventing `PGRST116` errors.
- [x] Reliable campaign worker dispatch with queue claiming and pause/cancel handling.
- [x] Migration hardening (016–022) with `search_path` and `SECURITY DEFINER` patches.

All 48 Vitest test suites (744 tests) pass cleanly, TypeScript compiles with zero errors, `npm audit` reports zero vulnerabilities, and the Next.js production build succeeds.

---

## 2. Outstanding External & Operational Dependencies

The following items cannot be completed autonomously in local development due to strict safety boundaries and require configuration in cloud staging/production environments:

### 2.1 Live Supabase Cloud Migrations (016–022)
- **Status**: Verified locally in PGlite clean-slate replay. NOT applied to live Supabase project (`ansiwtwqgrfmzfrhkzuu`).
- **Pending Migrations**:
  - `20261107_016_phase12_1_team_management_and_agent_assignment.sql`
  - `20261107_017_phase12_2_media_messaging.sql` (hardened with `search_path`)
  - `20261108_018_phase12_3_scheduled_messages.sql` (hardened with `search_path`)
  - `20261108_019_phase12_4_campaign_management.sql`
  - `20261108_020_phase12_5_crm_lifecycle_and_followups.sql`
  - `20261109_021_phase12_6_notification_center_and_durable_reminders.sql`
  - `20261109_022_phase12_7_visual_flows_and_realtime.sql` (hardened with `supabase_realtime`)
- **Required Action**: Apply these migrations sequentially via Supabase CLI or the Supabase SQL Editor prior to deploying the application to production.

### 2.2 Supabase Storage Configuration (`whatsapp-media`)
- **Status**: Local tests operate via the built-in in-memory fallback adapter (`inMemoryMediaStore`).
- **Production Requirement**:
  - Bucket `whatsapp-media` must be created in Supabase Storage.
  - Bucket must be configured as **Private** (public read disabled).
  - Storage RLS policies must allow read/write access to `service_role`.
  - Production environment must have `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` populated.

### 2.3 Meta WhatsApp Cloud API Permanent System User Token
- **Status**: Live Meta API calls were disabled during this milestone to prevent inadvertent charges or external side-effects.
- **Production Requirement**:
  - A permanent System User Access Token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions must be configured in `wa_connections` for both Astrology (`11111111-1111-1111-1111-111111111111`) and Vivaham (`22222222-2222-2222-2222-222222222222`) lines.
  - Temporary 24-hour developer tokens will cause incoming media downloads and outbound campaign dispatches to fail with authentication errors.

### 2.4 Vercel Cron or External Scheduler Setup
- **Status**: Worker routes and lock coordination endpoints are implemented and tested.
- **Production Requirement**:
  - Verify that `vercel.json` cron configurations or an external scheduler invokes the following endpoints periodically with a valid `Authorization: Bearer <CRON_SECRET>`:
    - `/api/cron/process-automation-jobs` (every minute)
    - `/api/cron/process-campaigns` (every minute)
    - `/api/cron/process-scheduled-messages` (every minute)
    - `/api/cron/process-crm-reminders` (every 5–15 minutes)

---

## 3. Residual Edge Cases & Future Recommendations

1. **Media Expiration Cleanup**:
   Meta Graph API temporary media URLs expire after 5 minutes, but media persisted in Supabase Storage remains permanently. Consider implementing a lifecycle storage policy (e.g. archiving or deleting unreferenced media after 90 days) to optimize storage costs.
2. **Visual Flow Complex Condition Operators**:
   The current visual flow runtime handles `business_hours` in/out and simple keyword matching. If complex multi-variable nested AND/OR condition nodes are introduced into the flow editor, the condition evaluator in `src/lib/flows/evaluator.ts` should be expanded to evaluate custom contact metadata attributes (e.g., KP rasi, star, budget).
3. **Campaign Rate-Limiting Calibration**:
   The campaign processor currently processes batches of up to 10 recipients per invocation with a safety delay to prevent Meta Cloud API rate limit throttling. Once WhatsApp Business Accounts achieve Tier 2 or Tier 3 messaging limits (10,000 to 100,000 msgs/day), the batch size in `src/lib/campaigns/worker.ts` can be tuned accordingly.
