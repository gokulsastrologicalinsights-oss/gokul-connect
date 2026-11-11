# GOKUL CONNECT — PHASE 12.3 IMPLEMENTATION DETAILS
**Technical Blueprint: Scheduled Messages & Durable Message Scheduling**  
**Execution Date:** November 8, 2026  

---

## 1. Modified & Created Files

| File Path | Type | Key Changes |
| :--- | :--- | :--- |
| `supabase/migrations/20261108_018_phase12_3_scheduled_messages.sql` | SQL | Added Migration 018: created `wa_scheduled_messages` table, tenant triggers, composite foreign keys, RLS policies, `claim_next_scheduled_messages`, `reclaim_stuck_scheduled_messages`, and webhook delivery sync trigger. |
| `src/types/database.ts` | TypeScript | Added `ScheduledMessageStatus`, `ScheduledMessageType`, `WhatsAppScheduledMessage`, `ScheduledMessageFilters`, `ScheduledMessagesSummaryStats`, and extended `TeamActivityType`. |
| `src/lib/validation/schemas.ts` | TypeScript | Added `CreateScheduledMessageSchema`, `UpdateScheduledMessageSchema`, `RescheduleMessageSchema`, `CancelScheduledMessageSchema`, `RetryScheduledMessageSchema`, and `DeleteDraftScheduledMessageSchema`. |
| `src/lib/scheduled/database.ts` | TypeScript | Dual-mode persistence layer (Supabase / In-Memory), seed data per business tenant, safe update and cancellation guards. |
| `src/lib/scheduled/store.ts` | TypeScript | High-level business store wrapping database actions and logging team activity. |
| `src/lib/scheduled/worker.ts` | TypeScript | Durable server-side dispatcher: atomic row claiming, stuck-job recovery, opt-out validation, 24h window validation, approved template checks, exponential backoff. |
| `src/app/api/cron/process-scheduled-messages/route.ts` | Route Handler | Secured cron endpoint with timing-safe Bearer authorization matching `CRON_SECRET`. |
| `src/app/api/cron/process-automation-jobs/route.ts` | Route Handler | Integrated scheduled message batch execution into standard cron handler. |
| `src/app/actions/scheduled.ts` | Server Actions | Server actions for listing, creating, updating, rescheduling, cancelling, and retrying scheduled messages with strict RBAC. |
| `src/components/workspace/WorkspaceSidebar.tsx` | React Client | Updated "Scheduled Messages" navigation item to `isImplemented: true`, `badge: "Active"`, `phase: 12`. |
| `src/app/workspace/[businessSlug]/scheduled/page.tsx` | Next.js Server Component | Server-rendered workspace route loading initial messages, active connections, and approved templates. |
| `src/components/scheduled/ScheduledMessagesClient.tsx` | React Client | Main scheduled messages dashboard with KPI counters, Upcoming/Past tabs, search, filters, and table/card list. |
| `src/components/scheduled/ScheduleMessageModal.tsx` | React Client | Modal composer for Plain Text, Meta Templates, and Media messages with Asia/Kolkata date picker and quick presets. |
| `src/components/scheduled/RescheduleModal.tsx` | React Client | Modal for rescheduling upcoming messages to future local times. |
| `src/components/scheduled/CancelConfirmModal.tsx` | React Client | Safe confirmation modal for message cancellation. |
| `src/components/scheduled/ScheduledMessageDetailModal.tsx` | React Client | Full message details modal with status badges, content preview, and timeline tracking. |
| `tests/phase12-3-scheduled-messages.test.ts` | Vitest Suite | 22 tests across 6 testing domains verifying schema, triggers, input validation, scheduling, worker safeguards, and RBAC. |

---

## 2. Scheduling & Dispatch Architecture

```mermaid
flowchart TD
    User([Business User: Owner/Admin/Agent]) --> UI[Scheduled Messages Dashboard & Composer]
    UI --> Action[createScheduledMessageAction]
    Action --> ValidateInput{Valid Date & Inputs?}
    ValidateInput -- No (Past Date / Empty) --> ReturnError[Validation Error]
    ValidateInput -- Yes --> RBAC{Role Check: Viewer?}
    RBAC -- Yes --> RejectViewer[HTTP 403 Forbidden]
    RBAC -- No --> DB[(wa_scheduled_messages)]
    
    CronJob[Cron Scheduler / Vercel Cron] --> Route[/api/cron/process-scheduled-messages]
    Route --> AuthCheck{Bearer CRON_SECRET Valid?}
    AuthCheck -- No --> Ret401[HTTP 401 Unauthorized]
    AuthCheck -- Yes --> Worker[processScheduledMessagesBatch]
    
    Worker --> Reclaim[reclaim_stuck_scheduled_messages RPC]
    Reclaim --> Claim[claim_next_scheduled_messages RPC: FOR UPDATE SKIP LOCKED]
    Claim --> Preflight{Pre-Flight Verification}
    
    Preflight -- Opted Out --> MarkFailed[Fail: Contact Opted Out]
    Preflight -- Window Expired & Text/Media --> MarkFailedWindow[Fail: 24h Window Expired]
    Preflight -- Template Unapproved --> MarkFailedTpl[Fail: Template Not Approved]
    Preflight -- Eligible & Ready --> Dispatch[sendWhatsAppMessageService]
    
    Dispatch -- Success --> UpdateSent[Status: 'sent', Message ID, sent_at]
    Dispatch -- Transient Error --> CalcBackoff[Retry: Exponential Backoff + Jitter]
    Dispatch -- Fatal Error / Max Retries --> UpdateFail[Status: 'failed', last_error]
```

---

## 3. Date, Time & Timezone Conversion Strategy

1. **Storage Format:** Standard ISO 8601 UTC timestamp string stored in PostgreSQL `TIMESTAMPTZ`.
2. **Display Timezone:** All user-facing components explicitly convert UTC timestamps to `Asia/Kolkata` (IST) using `formatKolkataDate`:
   ```ts
   new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ... })
   ```
3. **Past Date Prevention:**
   ```ts
   if (status === "scheduled") {
     const scheduledTime = new Date(data.scheduledAt).getTime();
     if (scheduledTime <= Date.now() - 30_000) {
       ctx.addIssue({ message: "Scheduled time must be in the future." });
     }
   }
   ```
   A 30-second clock skew tolerance is included to accommodate network latency when submitting forms.

---

## 4. RBAC Permission Matrix

| Operation | Owner | Admin | Agent | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| View scheduled messages | Yes | Yes | Yes | Yes |
| View message details & logs | Yes | Yes | Yes | Yes |
| Schedule Plain Text message | Yes | Yes | Yes | **Blocked** |
| Schedule WhatsApp Template | Yes | Yes | Yes | **Blocked** |
| Schedule Media message | Yes | Yes | Yes | **Blocked** |
| Save message as draft | Yes | Yes | Yes | **Blocked** |
| Edit scheduled message | Yes | Yes | Yes | **Blocked** |
| Reschedule message | Yes | Yes | Yes | **Blocked** |
| Cancel scheduled message | Yes | Yes | Yes | **Blocked** |
| Retry failed message | Yes | Yes | Yes | **Blocked** |
| Delete draft message | Yes | Yes | Yes | **Blocked** |
| Run dispatch worker manually | Yes | Yes | **Blocked** | **Blocked** |
