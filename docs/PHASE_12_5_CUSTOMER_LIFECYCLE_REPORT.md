# Gokul Connect — Phase 12.5 Customer Lifecycle & Follow-up Management Report

## 1. Executive Summary

Phase 12.5 transforms Gokul Connect's existing customer relationship management into a multi-tenant, enterprise-grade customer lifecycle and follow-up management system. Both independent businesses—**Gokul's Astrological Insights (`astrology`)** and **Gokul Vivaham (`vivaham`)**—now possess dedicated lifecycle pipelines, configurable stage progressions, full stage transition audit trails, an interactive follow-up task system with Indian Standard Time (`Asia/Kolkata`) scheduling, internal team reminders with strict customer WhatsApp protection, and enhanced dynamic CRM segmentation.

All code is fully verified locally through an isolated PGlite migration runner (001–020), 43 test suites comprising 653 automated tests (25 new tests in Phase 12.5), 100% clean TypeScript checks (`tsc --noEmit`), and an optimized Next.js 15 production build (`next build`).

---

## 2. Business-Specific Customer Lifecycle Stages

Both businesses operate distinct customer journeys and require tailored lifecycle definitions:

| Business | Default Stages (Ordered) | Default Stage | Converted Stage | Lost Stage |
| :--- | :--- | :--- | :--- | :--- |
| **Gokul's Astrological Insights (`astrology`)** | 1. New Lead<br>2. Contacted<br>3. Horoscope Shared<br>4. Consultation Scheduled<br>5. Follow-up Required<br>6. Consultation Completed<br>7. Inactive<br>8. Lost | `new-lead` | `consultation-completed` | `lost` |
| **Gokul Vivaham (`vivaham`)** | 1. New Registration<br>2. Profile Verified<br>3. Matchmaking Active<br>4. Horoscope / Family Matching<br>5. Follow-up Required<br>6. Match Finalized<br>7. Inactive<br>8. Lost | `new-registration` | `match-finalized` | `lost` |

### Key Lifecycle Capabilities:
- **Tenant-Scoped Stage Configuration:** Custom stages can be created by Owners/Admins per business with unique composite keys `(id, business_id)`.
- **Full Transition Auditing:** Every stage transition records `from_stage_slug`, `to_stage_slug`, `changed_by`, `change_reason`, and timestamps in `contact_lifecycle_history`, plus an event in `contact_activity_logs`.
- **Bulk Stage Updates:** Authorized users can select multiple contacts from the CRM table and advance them to any stage in one confirmed action.
- **Pipeline Kanban View:** An interactive multi-column visual pipeline displaying contact cards organized by lifecycle stage with quick drawer access.

---

## 3. Follow-up Management & Reminders

### Task Management Features:
- **Priority Levels:** `low`, `normal`, `high`, `urgent`.
- **Status Lifecycle:** `open` ➔ `in_progress` ➔ `completed` / `cancelled`.
- **Due Date Scheduling:** Native support for Indian Standard Time (`Asia/Kolkata`) scheduling, identifying "Due Today" tasks and highlighting overdue tasks in real-time.
- **Automated Next Follow-up Sync:** PostgreSQL database trigger `trg_crm_follow_ups_sync_next` (`sync_contact_next_follow_up()`) automatically recalculates `wa_contacts.next_follow_up_at` to the earliest pending task whenever follow-ups are inserted, updated, or deleted.
- **Rescheduling & Cancellation Auditing:** Rescheduling logs the previous date, new date, and reason. Cancellation records an explicit cancellation reason and timestamp.

### Internal Team Reminders (Safeguard Compliance):
- **Due-Soon & Overdue Notifications:** Detects tasks due within 24 hours or past their deadline, generating in-app reminder records for the assigned agent or task creator.
- **Deduplication:** Composite constraint `uq_crm_follow_up_reminders_dedup (follow_up_id, user_id, reminder_type)` prevents repeated reminder notifications.
- **Strict Customer WhatsApp Protection:** Follow-up reminders are **strictly internal**. No customer-facing WhatsApp messages are ever triggered or dispatched automatically.

---

## 4. Enhanced Dynamic CRM Segmentation

CRM saved segments now support multi-dimensional combinations of:
1. **Lifecycle stage:** (`lifecycle_stage_slug`)
2. **Category:** (`category`)
3. **Assigned team member:** (`assigned_agent_id`)
4. **Follow-up status:** (`has_overdue_followups`, `has_upcoming_followups`)
5. **Last interaction:** Inactivity thresholds in days (`last_interaction_days`)
6. **Consent & compliance:** Active opt-in, implicit consent, or opt-out status
7. **Creation date range:** (`created_date_from`, `created_date_to`)

---

## 5. Security & Multi-Tenant Enforcement

1. **Composite Foreign Keys & Immutability Triggers:**
   - `crm_lifecycle_stages`, `contact_lifecycle_history`, `crm_follow_ups`, and `crm_follow_up_reminders` enforce composite foreign keys to `(contact_id, business_id)` and `(conversation_id, business_id)`.
   - Immutability trigger `trg_crm_follow_ups_immutable_business_id` permanently blocks attempts to reassign records across businesses.
2. **Role-Based Access Control (RBAC):**
   - Owners, Admins, and Agents can create, update, reschedule, and complete follow-up tasks, and update lifecycle stages.
   - Viewers are strictly read-only; any mutation attempts return `{ success: false, error: "Permission denied: viewer role is not permitted..." }`.
3. **RLS Policies:** Explicit Row-Level Security policies active on all 4 new tables.

---

## 6. Verification & Quality Gates Summary

- **Vitest Suites:** 43 passed (43 files, 653 passed tests).
- **TypeScript:** Clean compilation (`npx tsc --noEmit` exited 0).
- **Next.js Production Build:** `npm run build` compiled 31 static and dynamic routes with zero warnings.
