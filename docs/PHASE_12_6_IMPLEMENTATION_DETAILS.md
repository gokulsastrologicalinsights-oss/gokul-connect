# GOKUL CONNECT — PHASE 12.6 IMPLEMENTATION DETAILS
## Internal Notification Center & Durable Reminder Processing

**Document Version:** 1.0.0  
**Phase:** 12.6  
**Implementation Date:** 2026-11-09  

---

### 1. Architectural Architecture & Schema Design

#### 1.1 Migration 021 Schema Evolution
Location: `supabase/migrations/20261109_021_phase12_6_notification_center_and_durable_reminders.sql`

```sql
-- 1. Extend crm_follow_up_reminders
ALTER TABLE public.crm_follow_up_reminders
    ALTER COLUMN follow_up_id DROP NOT NULL;

-- 2. Expand reminder_type constraint
ALTER TABLE public.crm_follow_up_reminders
    ADD CONSTRAINT crm_follow_up_reminders_reminder_type_check
    CHECK (reminder_type IN (
        'due_today', 'due_soon', 'overdue', 'assigned',
        'reassigned', 'completed', 'team_invitation',
        'team_member_joined', 'system', 'escalation'
    ));

-- 3. Add categorization, dismissal, and queue worker columns
ALTER TABLE public.crm_follow_up_reminders
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'crm_follow_up'
        CHECK (category IN ('crm_follow_up', 'team', 'system')),
    ADD COLUMN IF NOT EXISTS action_url TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dedup_key TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'delivered'
        CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dismissed')),
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_by TEXT,
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_retries INT NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS last_error TEXT;

-- 4. Deduplication constraint
ALTER TABLE public.crm_follow_up_reminders
    ADD CONSTRAINT uq_crm_follow_up_reminders_dedup_key
    UNIQUE (business_id, dedup_key);
```

#### 1.2 User Notification Preferences Table
```sql
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    notify_due_today BOOLEAN NOT NULL DEFAULT TRUE,
    notify_due_soon BOOLEAN NOT NULL DEFAULT TRUE,
    notify_overdue BOOLEAN NOT NULL DEFAULT TRUE,
    notify_assigned BOOLEAN NOT NULL DEFAULT TRUE,
    notify_team_events BOOLEAN NOT NULL DEFAULT TRUE,
    notify_system BOOLEAN NOT NULL DEFAULT TRUE,
    lead_time_hours INT NOT NULL DEFAULT 24
        CHECK (lead_time_hours >= 1 AND lead_time_hours <= 168),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_user_notification_pref_tenant_user UNIQUE (business_id, user_id),
    CONSTRAINT uq_user_notification_pref_id_business UNIQUE (id, business_id)
);
```

#### 1.3 Atomic Database RPCs
1. `claim_next_reminder_jobs(p_batch_size, p_worker_id)`:
   - Uses `FOR UPDATE SKIP LOCKED` to lock pending records without blocking concurrent database transactions.
   - Transitions claimed records to `status = 'processing'`, sets `locked_at = NOW()`, `locked_by = worker_id`, and increments `retry_count`.
2. `reclaim_stuck_reminder_jobs(p_timeout_minutes)`:
   - Finds records in `status = 'processing'` where `locked_at` is older than `p_timeout_minutes`.
   - Transitions recoverable records (`retry_count < max_retries`) back to `status = 'pending'`.
   - Transitions exhausted records (`retry_count >= max_retries`) to `status = 'failed'`.
   - Grants restricted strictly to `service_role`.

---

### 2. Service Layer Implementation

#### 2.1 Notification Service
Location: `src/lib/notifications/service.ts`

Key Functions:
- `createNotificationDb(businessId, input, client)`:
  - Validates business tenant.
  - Checks destination user active membership status.
  - Builds deterministic deduplication key (`followup:${id}:${userId}:${type}` or `team:${id}:${userId}`).
  - Persists record with `ON CONFLICT DO NOTHING` or updates in-memory mock store.
- `listNotificationsDb(businessId, userId, filters, client)`:
  - Scoped strictly to `(business_id, user_id)`.
  - Supports tab filters: `all`, `unread`, `crm`, `team`, `system`.
  - Supports keyword search across title and message.
  - Returns paginated list with total count and unread count.
- `getNotificationStatsDb(businessId, userId, client)`:
  - Returns aggregation of `total`, `unreadCount`, `dueTodayCount`, `overdueCount`, `assignedCount`.
- `markNotificationReadDb(businessId, notificationId, userId, client)`:
  - Sets `is_read = true`, `read_at = now`.
- `markAllNotificationsReadDb(businessId, userId, client)`:
  - Marks all unread notifications for user as read in a single query.
- `dismissNotificationDb(businessId, notificationId, userId, client)`:
  - Sets `is_dismissed = true`, `dismissed_at = now`, `status = 'dismissed'`.
- `dismissAllNotificationsDb(businessId, userId, client)`:
  - Dismisses all read notifications for user.
- `generateFollowUpRemindersDb(businessId, client)`:
  - Scans active follow-ups (`status IN ('open', 'in_progress')`).
  - Evaluates calendar day boundaries in `Asia/Kolkata` time:
    - If `dueTime < now`: generates `overdue` (capped at 14 days).
    - If calendar day equals Kolkata today: generates `due_today`.
    - If due within lead time: generates `due_soon`.
  - Inserts with unique `dedup_key` per business tenant.
- `processReminderJobsBatch(batchSize, workerId)`:
  - Bounded batch queue processing.
  - Reclaims stale jobs.
  - Revalidates destination user active status before setting `delivered`.

#### 2.2 Date Formatting Utilities
Location: `src/lib/notifications/date-utils.ts`
- Client-safe utility isolated from server headers.
- `formatKolkataTimestamp(isoDate)`: Displays in `Asia/Kolkata` timezone (e.g. `09 Nov 2026, 11:30 AM`).
- `getKolkataDateString(date)`: Formats ISO date to `YYYY-MM-DD` in `Asia/Kolkata` time.

---

### 3. API Routes & Endpoints

#### 3.1 Workspace Endpoints
- `GET /api/workspace/[businessSlug]/notifications`
  - Query params: `tab`, `category`, `page`, `limit`, `search`, `includeDismissed`, `statsOnly`.
  - Validates tenant access via `validateBusinessAccess(businessSlug)`.
- `POST /api/workspace/[businessSlug]/notifications`
  - Body: `{ action: "mark_all_read" | "dismiss_all" | "generate_reminders" }`.
- `PATCH /api/workspace/[businessSlug]/notifications/[notificationId]`
  - Body: `{ action: "mark_read" | "dismiss" }`.
- `GET /api/workspace/[businessSlug]/notifications/preferences`
  - Retrieves user notification preferences.
- `PATCH /api/workspace/[businessSlug]/notifications/preferences`
  - Updates user notification preferences.

#### 3.2 Secured Cron Endpoint
- `GET | POST /api/cron/process-crm-reminders`
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Verified with `verifyCronAuthorization`.
  - Triggers reminder generation and worker batch processing across Astrology and Vivaham.

---

### 4. User Interface Integration

#### 4.1 Workspace Header Bell (`NotificationBell.tsx`)
- Integrated in `src/components/workspace/WorkspaceHeader.tsx`.
- Unread count badge with responsive animation.
- Dropdown popover previewing 5 most recent unread notifications.
- Direct click marks as read and routes to target task/contact/team view.
- Clears notification state when switching between Astrology and Vivaham.

#### 4.2 Workspace Sidebar Navigation (`WorkspaceSidebar.tsx`)
- Added **Notifications** link under Core Modules (`/workspace/${slug}/notifications`).
- Active link styling matches workspace theme (purple for Astrology, rose for Vivaham).

#### 4.3 Notification Center View (`NotificationsClient.tsx`)
- Page route: `src/app/workspace/[businessSlug]/notifications/page.tsx`.
- Metric summary cards (Total, Unread, Due Today, Overdue).
- Filter tabs and search bar.
- Category color badges with distinct iconography.
- Direct action buttons (Open Task, Mark as Read, Dismiss).
- Responsive preferences modal for configuring alert thresholds and lead times.
