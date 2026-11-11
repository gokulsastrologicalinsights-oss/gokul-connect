# GOKUL CONNECT — PHASE 12.3 REMAINING ISSUES
**Blocker & Technical Debt Log**  
**Execution Date:** November 8, 2026  

---

## 1. Resolved in Phase 12.3

1. **Multi-Tenant Scheduled Message Schema:** Forward-only Migration 018 introduced `public.wa_scheduled_messages` with composite foreign keys, tenant triggers, and covering indexes.
2. **Atomic Dispatch & Concurrency Safety:** `claim_next_scheduled_messages` RPC guarantees that concurrent cron runs or multi-instance serverless workers cannot double-dispatch the same scheduled message.
3. **Stuck Job Auto-Recovery:** Automatic detection and reclaiming of processing jobs locked longer than 5 minutes with retry count tracking and fail-safe caps.
4. **Pre-Flight Compliance Verification:** Strictly blocks messaging opted-out contacts and enforces the 24-hour service window before sending free-form text or media.
5. **Safe Cancellation & Rescheduling:** Implemented atomic state transitions preventing race conditions between worker claiming and user cancellations.
6. **Full Production Readiness:** 100% clean Next.js production build (`next build`) and 600 Vitest tests passing with zero failures.

---

## 2. Staged Considerations for Future Deployment (Phase 13 / Production)

| Item | Priority | Description | Action Required Upon Production Launch |
| :--- | :---: | :--- | :--- |
| **Apply Migration 018 to Live Supabase** | Medium | Migration 018 has been tested locally on PGlite. When ready for production promotion, apply `supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql` to the production database. | Run via Supabase CLI migration pipeline after pre-flight snapshot. |
| **Production Cron Frequency Configuration** | Low | Currently `/api/cron/process-scheduled-messages` is secured with `CRON_SECRET`. In production, configure Vercel Cron or Supabase `pg_cron` to invoke this route every 1-2 minutes. | Add to `vercel.json` or configure pg_cron schedule. |
| **Meta Graph API Live Testing** | Low | Live message dispatches remain sandboxed per strict boundaries. Real WhatsApp numbers will begin sending once production credentials and live WABA webhooks are active. | Verify with test business phone number during live staging. |

---

## 3. Known Non-Blockers & Limitations
- **Browser-Side Timers:** As designed, no browser timers or `setTimeout` mechanisms are used to trigger messages. Scheduling relies completely on server-side database state and cron triggers.
- **Clock Skew Tolerance:** A 30-second skew tolerance is used when checking future timestamps to avoid rejecting valid form submissions due to client-server clock drift.
