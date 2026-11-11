# Gokul Connect — Phase 12.5 Implementation Details

## 1. Schema & Migration Architecture

### Migration 020: `supabase/migrations/20261108_020_phase12_5_crm_lifecycle_and_followups.sql`

```sql
-- 1. crm_lifecycle_stages
CREATE TABLE IF NOT EXISTS crm_lifecycle_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT 'blue',
    sort_order INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_converted BOOLEAN NOT NULL DEFAULT false,
    is_lost BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_crm_lifecycle_stages_slug UNIQUE (business_id, slug),
    CONSTRAINT uq_crm_lifecycle_stages_composite_pk UNIQUE (id, business_id)
);

-- 2. Extended wa_contacts
ALTER TABLE wa_contacts
    ADD COLUMN IF NOT EXISTS lifecycle_stage_id UUID,
    ADD COLUMN IF NOT EXISTS lifecycle_stage_slug TEXT,
    ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- 3. contact_lifecycle_history
CREATE TABLE IF NOT EXISTS contact_lifecycle_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    from_stage_id UUID,
    from_stage_slug TEXT,
    to_stage_id UUID NOT NULL,
    to_stage_slug TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_by_name TEXT,
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_clh_contact FOREIGN KEY (contact_id, business_id)
        REFERENCES wa_contacts(id, business_id) ON DELETE CASCADE
);

-- 4. crm_follow_ups
CREATE TABLE IF NOT EXISTS crm_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    conversation_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'open',
    due_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to_name TEXT,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_by_name TEXT,
    completion_notes TEXT,
    rescheduled_at TIMESTAMPTZ,
    rescheduled_count INT NOT NULL DEFAULT 0,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cancelled_by_name TEXT,
    cancellation_reason TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_follow_ups_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT crm_follow_ups_status_check CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT fk_crm_follow_ups_contact FOREIGN KEY (contact_id, business_id)
        REFERENCES wa_contacts(id, business_id) ON DELETE CASCADE
);

-- 5. Trigger: sync_contact_next_follow_up
CREATE OR REPLACE FUNCTION sync_contact_next_follow_up()
RETURNS TRIGGER AS $$
DECLARE
    target_contact_id UUID;
    target_biz_id UUID;
    earliest_due TIMESTAMPTZ;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_contact_id := OLD.contact_id;
        target_biz_id := OLD.business_id;
    ELSE
        target_contact_id := NEW.contact_id;
        target_biz_id := NEW.business_id;
    END IF;

    SELECT MIN(due_at) INTO earliest_due
    FROM crm_follow_ups
    WHERE contact_id = target_contact_id
      AND business_id = target_biz_id
      AND status IN ('open', 'in_progress')
      AND due_at >= now() - INTERVAL '1 day';

    UPDATE wa_contacts
    SET next_follow_up_at = earliest_due,
        updated_at = now()
    WHERE id = target_contact_id
      AND business_id = target_biz_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. crm_follow_up_reminders
CREATE TABLE IF NOT EXISTS crm_follow_up_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    follow_up_id UUID NOT NULL REFERENCES crm_follow_ups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL,
    title TEXT,
    message TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_fur_type_check CHECK (reminder_type IN ('due_soon', 'overdue', 'escalation')),
    CONSTRAINT uq_crm_follow_up_reminders_dedup UNIQUE (follow_up_id, user_id, reminder_type)
);
```

---

## 2. File Manifest & Architecture

### Backend & Core Services:
- `src/lib/crm/lifecycle.ts`:
  - `DEFAULT_ASTRO_LIFECYCLE_STAGES`, `DEFAULT_VIVAHAM_LIFECYCLE_STAGES`
  - `getLifecycleStagesDb`, `createLifecycleStageDb`
  - `updateContactLifecycleStageDb`: records history in `contact_lifecycle_history` and logs activity in `contact_activity_logs`.
  - `bulkUpdateContactsLifecycleStageDb`
  - `getContactLifecycleHistoryDb`
- `src/lib/crm/follow-ups.ts`:
  - `createFollowUpDb`, `updateFollowUpDb`, `completeFollowUpDb`, `rescheduleFollowUpDb`, `cancelFollowUpDb`
  - `getFollowUpsDb`: Supports filtering by status, priority, contact, agent, and tabs (`today`, `upcoming`, `overdue`, `completed`, `assigned_to_me`).
  - `getFollowUpMetricsDb`: Computes total, due today, upcoming, overdue, completed, and completion percentage.
  - `isTodayKolkata`, `isOverdue`: `Asia/Kolkata` timezone checks.
- `src/lib/crm/reminders.ts`:
  - `generateFollowUpRemindersDb`: Scans tasks due within 24 hours or overdue, records deduplicated internal reminders in `crm_follow_up_reminders`.
  - `getUserRemindersDb`, `markReminderReadDb`
- `src/lib/crm/lifecycle-automation.ts`:
  - Deterministic lifecycle rules (disabled by default): auto-assign default stage on creation, update stage on follow-up completion, scan overdue tasks.
- `src/lib/crm/lifecycle-reports.ts`:
  - `getCrmLifecycleReportDb`: Computes stage breakdown, leads over time, lead-to-conversion rate, conversion by category, follow-up workload by agent.
- `src/lib/crm/database.ts` & `src/lib/crm/store.ts`:
  - Enriched `WhatsAppContact` mapping with `lifecycle_stage_id`, `lifecycle_stage_slug`, `next_follow_up_at`, `last_interaction_at`.
  - `filterContactsBySegmentFilters`, `getContactsForSegmentDb`: Multi-dimensional dynamic CRM segmentation engine.
- `src/lib/validation/schemas.ts`:
  - Zod schemas: `CreateFollowUpSchema`, `UpdateFollowUpSchema`, `CompleteFollowUpSchema`, `RescheduleFollowUpSchema`, `CancelFollowUpSchema`, `UpdateContactStageSchema`, `BulkUpdateStageSchema`, `CreateLifecycleStageSchema`.

### Server Actions (`src/app/actions/crm.ts`):
- `getLifecycleStagesAction`, `createLifecycleStageAction`
- `updateContactStageAction`, `bulkUpdateStageAction`, `getContactLifecycleHistoryAction`
- `createFollowUpAction`, `updateFollowUpAction`, `completeFollowUpAction`, `rescheduleFollowUpAction`, `cancelFollowUpAction`
- `getFollowUpsAction`, `getFollowUpByIdAction`, `getFollowUpMetricsAction`
- `getUserRemindersAction`, `markReminderReadAction`, `generateFollowUpRemindersAction`
- `getCrmLifecycleReportAction`

### UI Components & Pages:
- `/workspace/[businessSlug]/crm/follow-ups/page.tsx`: Server Component loading follow-ups, metrics, stages, and contacts in parallel.
- `src/components/crm/FollowUpsClient.tsx`:
  - 4 KPI cards (Due Today, Upcoming, Overdue, Completion Rate progress bar).
  - 6 Filter tabs (All, Due Today, Upcoming, Overdue, Assigned to Me, Completed).
  - Search and Priority filter dropdown.
  - Interactive Action Modals (Schedule Follow-Up, Complete with Notes & Stage update, Reschedule with picker & reason, Cancel with reason).
- `/workspace/[businessSlug]/crm/page.tsx` & `src/components/crm/CrmClient.tsx`:
  - View Mode toggle: **Table View** vs **Pipeline Kanban View**.
  - Pipeline columns for all lifecycle stages with card counters and next follow-up dates.
  - Lifecycle Stage column in table view.
  - Bulk Stage update action bar when contacts are selected.
  - Contact Detail Drawer with quick Lifecycle Stage selector, Follow-ups panel, and Stage History timeline.
- `src/components/workspace/WorkspaceSidebar.tsx`:
  - Added "CRM Follow-ups" navigation link under Core Modules.

---

## 3. Test Suite: `tests/phase12-5-crm-lifecycle.test.ts`

25 tests covering:
1. Migration 020 schema, composite keys, constraints, and triggers in PGlite.
2. Dynamic trigger recalculation of `wa_contacts.next_follow_up_at`.
3. Business-specific default stages for `astrology` vs `vivaham`.
4. Stage progression, history recording, and activity log generation.
5. Follow-up task creation, priority, completion, rescheduling, cancellation.
6. Timezone calculation in `Asia/Kolkata`.
7. Internal reminder generation, deduplication, and zero customer WhatsApp messaging guard.
8. Dynamic multi-criteria saved segment filtering.
9. Comprehensive lifecycle reporting metrics.
10. Server action role-based authorization (Viewer mutation block, Agent/Admin permission).
