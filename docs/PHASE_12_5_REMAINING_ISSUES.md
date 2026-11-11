# Gokul Connect — Phase 12.5 Remaining Issues & Operational Considerations

## 1. Zero Blocking Defects

Phase 12.5 has completed all implementation criteria and passed all verification gates:
- **Migration 020:** Authored, syntax-validated, and verified in PGlite.
- **Type Safety:** 100% clean (`tsc --noEmit` exited 0).
- **Test Suite:** 43/43 test suites passing (653/653 tests passing).
- **Build:** Next.js 15 production build (`next build`) succeeded with 31 clean routes.

---

## 2. Staged Deployment & Live Database Application

1. **Forward-Only Migration Application:**
   - In accordance with the local development boundary, migration `20261108_020_phase12_5_crm_lifecycle_and_followups.sql` has not been applied to the live remote Supabase project `ansiwtwqgrfmzfrhkzuu`.
   - Before deploying Phase 12.5 to production, apply migration `020` via Supabase CLI (`supabase db push`) or the Supabase SQL editor.
2. **Initial Stage Seeding for Existing Contacts:**
   - Existing contacts created prior to Phase 12.5 have `lifecycle_stage_id` and `lifecycle_stage_slug` set to `NULL`.
   - A one-time SQL backfill script can seed them to default stages:
     - `UPDATE wa_contacts SET lifecycle_stage_slug = 'new-lead' WHERE business_id = '11111111-1111-1111-1111-111111111111' AND lifecycle_stage_slug IS NULL;`
     - `UPDATE wa_contacts SET lifecycle_stage_slug = 'new-registration' WHERE business_id = '22222222-2222-2222-2222-222222222222' AND lifecycle_stage_slug IS NULL;`

---

## 3. Scheduled Worker for Internal Reminders

1. **Cron Endpoint:**
   - Follow-up reminders are generated on demand and can be scheduled via a recurring Vercel Cron or Supabase `pg_cron` calling `generateFollowUpRemindersDb` every 15–30 minutes.
   - The unique constraint `uq_crm_follow_up_reminders_dedup` guarantees that repeated executions will never create duplicate notifications.
2. **WhatsApp Policy Guard:**
   - Follow-up reminders remain strictly internal. If business owners ever request sending WhatsApp notifications to customers for upcoming appointments, they must be explicitly routed through approved template campaigns (Phase 12.4) or scheduled messages (Phase 12.3) with verified opt-in consent.
