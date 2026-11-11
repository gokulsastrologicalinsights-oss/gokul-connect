-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 021: NOTIFICATION CENTER & DURABLE REMINDERS
-- ==============================================================================
-- PHASE 12.6: Unified Internal Notification Center, Durable Reminder Processing,
-- Contextual Task Actions, User Notification Preferences, and Atomic Worker RPCs.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- User isolation: notifications are routed strictly to authorized active members.
-- ==============================================================================

-- 1. EXTEND CRM_FOLLOW_UP_REMINDERS TABLE TO SUPPORT UNIFIED NOTIFICATIONS
-- Allow notifications that are not strictly bound to a CRM follow-up task
ALTER TABLE public.crm_follow_up_reminders
    ALTER COLUMN follow_up_id DROP NOT NULL;

-- Expand reminder_type check constraint to support all Phase 12.6 categories
DO $$
BEGIN
    ALTER TABLE public.crm_follow_up_reminders
        DROP CONSTRAINT IF EXISTS crm_follow_up_reminders_reminder_type_check;

    ALTER TABLE public.crm_follow_up_reminders
        ADD CONSTRAINT crm_follow_up_reminders_reminder_type_check
        CHECK (reminder_type IN (
            'due_today',
            'due_soon',
            'overdue',
            'assigned',
            'reassigned',
            'completed',
            'team_invitation',
            'team_member_joined',
            'system',
            'escalation'
        ));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Add notification categorisation, action URL, dismissal state, deduplication and worker queue columns
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

-- Enforce deduplication key uniqueness per business tenant (where dedup_key is present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_crm_follow_up_reminders_dedup_key'
    ) THEN
        ALTER TABLE public.crm_follow_up_reminders
            ADD CONSTRAINT uq_crm_follow_up_reminders_dedup_key
            UNIQUE (business_id, dedup_key);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Performance indexes for active user notification queries & queue processing
CREATE INDEX IF NOT EXISTS idx_crm_reminders_active_user
    ON public.crm_follow_up_reminders(business_id, user_id, is_dismissed, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_reminders_processing_jobs
    ON public.crm_follow_up_reminders(status, locked_at)
    WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_crm_reminders_pending_jobs
    ON public.crm_follow_up_reminders(status, created_at ASC)
    WHERE status = 'pending';

-- 2. USER NOTIFICATION PREFERENCES TABLE
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

CREATE INDEX IF NOT EXISTS idx_user_notification_pref_lookup
    ON public.user_notification_preferences(business_id, user_id);

-- Tenant immutability trigger for user_notification_preferences
DROP TRIGGER IF EXISTS trg_user_notification_pref_immutable_business_id ON public.user_notification_preferences;
CREATE TRIGGER trg_user_notification_pref_immutable_business_id
    BEFORE UPDATE ON public.user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant and user isolation for user_notification_preferences select" ON public.user_notification_preferences;
CREATE POLICY "Tenant and user isolation for user_notification_preferences select"
    ON public.user_notification_preferences FOR SELECT
    USING ((public.check_user_business_access(business_id) AND user_id = auth.uid()) OR public.is_superadmin());

DROP POLICY IF EXISTS "User can insert own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "User can insert own notification preferences"
    ON public.user_notification_preferences FOR INSERT
    WITH CHECK ((public.check_user_business_access(business_id) AND user_id = auth.uid()) OR public.is_superadmin());

DROP POLICY IF EXISTS "User can update own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "User can update own notification preferences"
    ON public.user_notification_preferences FOR UPDATE
    USING ((public.check_user_business_access(business_id) AND user_id = auth.uid()) OR public.is_superadmin())
    WITH CHECK ((public.check_user_business_access(business_id) AND user_id = auth.uid()) OR public.is_superadmin());

DROP POLICY IF EXISTS "User can delete own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "User can delete own notification preferences"
    ON public.user_notification_preferences FOR DELETE
    USING ((public.check_user_business_access(business_id) AND user_id = auth.uid()) OR public.is_superadmin());

-- Refine crm_follow_up_reminders SELECT policy so users can access their own notifications or workspace admins can manage them
DROP POLICY IF EXISTS "Tenant isolation for crm_follow_up_reminders select" ON public.crm_follow_up_reminders;
CREATE POLICY "Tenant isolation for crm_follow_up_reminders select"
    ON public.crm_follow_up_reminders FOR SELECT
    USING (
        (
            public.check_user_business_access(business_id)
            AND (
                user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.business_members bm
                    WHERE bm.business_id = crm_follow_up_reminders.business_id
                      AND bm.user_id = auth.uid()
                      AND bm.is_active = TRUE
                      AND bm.role IN ('owner', 'admin')
                )
            )
        )
        OR public.is_superadmin()
    );

-- 4. ATOMIC REMINDER QUEUE RPCS
CREATE OR REPLACE FUNCTION public.claim_next_reminder_jobs(
    p_batch_size INTEGER DEFAULT 20,
    p_worker_id TEXT DEFAULT 'worker_reminder'
)
RETURNS SETOF public.crm_follow_up_reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH claimed AS (
        SELECT id
        FROM public.crm_follow_up_reminders
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.crm_follow_up_reminders r
    SET status = 'processing',
        locked_at = TIMEZONE('utc', NOW()),
        locked_by = p_worker_id,
        retry_count = retry_count + 1
    FROM claimed c
    WHERE r.id = c.id
    RETURNING r.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.reclaim_stuck_reminder_jobs(
    p_timeout_minutes INTEGER DEFAULT 5
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reclaimed_count INTEGER := 0;
BEGIN
    -- Reclaim stuck jobs that have retries remaining
    WITH stuck AS (
        SELECT id
        FROM public.crm_follow_up_reminders
        WHERE status = 'processing'
          AND locked_at <= TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::interval
          AND retry_count < max_retries
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.crm_follow_up_reminders r
    SET status = 'pending',
        locked_at = NULL,
        locked_by = NULL,
        last_error = COALESCE(last_error, '') || ' [Stuck reminder reclaimed after timeout]'
    FROM stuck s
    WHERE r.id = s.id;

    GET DIAGNOSTICS v_reclaimed_count = ROW_COUNT;

    -- Permanently fail jobs that exceeded max retries
    WITH max_retried AS (
        SELECT id
        FROM public.crm_follow_up_reminders
        WHERE status = 'processing'
          AND locked_at <= TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::interval
          AND retry_count >= max_retries
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.crm_follow_up_reminders r
    SET status = 'failed',
        locked_at = NULL,
        locked_by = NULL,
        last_error = COALESCE(last_error, '') || ' [Reminder job exceeded max retry limit]'
    FROM max_retried mr
    WHERE r.id = mr.id;

    RETURN v_reclaimed_count;
END;
$$;

-- 5. PRIVILEGE HARDENING FOR REMINDER QUEUE RPCS
REVOKE ALL ON FUNCTION public.claim_next_reminder_jobs(INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_reminder_jobs(INTEGER, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_next_reminder_jobs(INTEGER, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_reminder_jobs(INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.reclaim_stuck_reminder_jobs(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_reminder_jobs(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_reminder_jobs(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_reminder_jobs(INTEGER) TO service_role;
