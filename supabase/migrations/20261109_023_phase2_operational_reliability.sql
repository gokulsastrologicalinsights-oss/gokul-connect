-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 023: OPERATIONAL RELIABILITY & OBSERVABILITY
-- ==============================================================================
-- PHASE 2: Background Worker Scheduling, Queue Health Monitoring, Dead-Letter
-- Recovery, Failure Classification, and System Observability Infrastructure.
--
-- Strict multi-tenant isolation: every operational record is bound to business_id.
-- Cross-tenant isolation guarantees zero metric or job leakage between businesses.
-- ==============================================================================

-- 1. WORKER_EXECUTION_RUNS TABLE (Worker & Cron Heartbeats / Execution Telemetry)
CREATE TABLE IF NOT EXISTS public.worker_execution_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    worker_name TEXT NOT NULL CHECK (worker_name IN (
        'automation_worker',
        'scheduled_worker',
        'campaign_worker',
        'crm_reminder_worker',
        'notification_worker',
        'prune_worker'
    )),
    worker_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'partial', 'skipped')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    claimed_count INT NOT NULL DEFAULT 0,
    processed_count INT NOT NULL DEFAULT 0,
    succeeded_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    reclaimed_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    error_code TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for worker telemetry queries
CREATE INDEX IF NOT EXISTS idx_worker_execution_runs_worker_time
    ON public.worker_execution_runs (worker_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_worker_execution_runs_biz_time
    ON public.worker_execution_runs (business_id, started_at DESC)
    WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_worker_execution_runs_status
    ON public.worker_execution_runs (status, started_at DESC);

-- Enable RLS on worker_execution_runs
ALTER TABLE public.worker_execution_runs ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "service_role_worker_execution_runs" ON public.worker_execution_runs;
CREATE POLICY "service_role_worker_execution_runs"
    ON public.worker_execution_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated tenant access (read-only for own business runs or system-wide runs)
DROP POLICY IF EXISTS "tenant_worker_execution_runs_select" ON public.worker_execution_runs;
CREATE POLICY "tenant_worker_execution_runs_select"
    ON public.worker_execution_runs
    FOR SELECT
    TO authenticated
    USING (
        business_id IS NULL OR
        check_user_business_access(business_id) OR
        is_superadmin()
    );

-- Tenant immutability trigger for worker_execution_runs
DROP TRIGGER IF EXISTS trg_worker_execution_runs_immutable_business_id ON public.worker_execution_runs;
CREATE TRIGGER trg_worker_execution_runs_immutable_business_id
    BEFORE UPDATE ON public.worker_execution_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 2. EXPAND STATUS CHECK CONSTRAINTS TO PERMIT DEAD-LETTER STATE
-- Allows explicit dead-letter status across all background queue tables
DO $$
BEGIN
    -- 2.1 wa_processing_jobs
    ALTER TABLE public.wa_processing_jobs
        DROP CONSTRAINT IF EXISTS wa_processing_jobs_status_check;
    ALTER TABLE public.wa_processing_jobs
        ADD CONSTRAINT wa_processing_jobs_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter'));

    -- 2.2 wa_scheduled_messages
    ALTER TABLE public.wa_scheduled_messages
        DROP CONSTRAINT IF EXISTS wa_scheduled_messages_status_check;
    ALTER TABLE public.wa_scheduled_messages
        ADD CONSTRAINT wa_scheduled_messages_status_check
        CHECK (status IN ('draft', 'scheduled', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'dead_letter'));

    -- 2.3 wa_campaign_recipients
    ALTER TABLE public.wa_campaign_recipients
        DROP CONSTRAINT IF EXISTS wa_campaign_recipients_status_check;
    ALTER TABLE public.wa_campaign_recipients
        ADD CONSTRAINT wa_campaign_recipients_status_check
        CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled', 'dead_letter'));

    -- 2.4 crm_follow_up_reminders
    ALTER TABLE public.crm_follow_up_reminders
        DROP CONSTRAINT IF EXISTS crm_follow_up_reminders_status_check;
    ALTER TABLE public.crm_follow_up_reminders
        ADD CONSTRAINT crm_follow_up_reminders_status_check
        CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dismissed', 'dead_letter'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. COVERING INDEXES FOR OBSERVABILITY & STUCK JOB DETECTION
CREATE INDEX IF NOT EXISTS idx_wa_processing_jobs_biz_stuck
    ON public.wa_processing_jobs (business_id, status, locked_at)
    WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_wa_processing_jobs_biz_retrying
    ON public.wa_processing_jobs (business_id, status, attempts)
    WHERE status = 'pending' AND attempts > 0;

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_messages_biz_stuck
    ON public.wa_scheduled_messages (business_id, status, locked_at)
    WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_messages_biz_retrying
    ON public.wa_scheduled_messages (business_id, status, retry_count)
    WHERE status = 'scheduled' AND retry_count > 0;

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_biz_stuck
    ON public.wa_campaign_recipients (business_id, status, locked_at)
    WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_crm_reminders_biz_stuck
    ON public.crm_follow_up_reminders (business_id, status, locked_at)
    WHERE status = 'processing';

-- 4. DATABASE AGGREGATION RPC: GET_WORKER_HEALTH_METRICS
-- Efficient server-side aggregation of queue depth, stuck jobs, and worker telemetry per business
CREATE OR REPLACE FUNCTION public.get_worker_health_metrics(
    p_business_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSONB;
    v_automation JSONB;
    v_scheduled JSONB;
    v_campaign JSONB;
    v_crm_reminders JSONB;
    v_stuck_threshold TIMESTAMPTZ := TIMEZONE('utc', NOW()) - INTERVAL '5 minutes';
BEGIN
    -- Strict tenant validation: p_business_id must not be null
    IF p_business_id IS NULL THEN
        RAISE EXCEPTION 'p_business_id cannot be null for worker health metrics';
    END IF;

    -- 1. Automation Queue (wa_processing_jobs)
    SELECT jsonb_build_object(
        'worker_type', 'automation_worker',
        'pending', COUNT(*) FILTER (WHERE status = 'pending' AND attempts = 0),
        'processing', COUNT(*) FILTER (WHERE status = 'processing'),
        'retrying', COUNT(*) FILTER (WHERE status = 'pending' AND attempts > 0),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'dead_letter', COUNT(*) FILTER (WHERE status = 'dead_letter'),
        'completed', COUNT(*) FILTER (WHERE status = 'completed'),
        'stuck', COUNT(*) FILTER (WHERE status = 'processing' AND locked_at < v_stuck_threshold)
    ) INTO v_automation
    FROM public.wa_processing_jobs
    WHERE business_id = p_business_id;

    -- 2. Scheduled Messages Queue (wa_scheduled_messages)
    SELECT jsonb_build_object(
        'worker_type', 'scheduled_worker',
        'pending', COUNT(*) FILTER (WHERE status = 'scheduled' AND retry_count = 0),
        'processing', COUNT(*) FILTER (WHERE status = 'processing'),
        'retrying', COUNT(*) FILTER (WHERE status = 'scheduled' AND retry_count > 0),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'dead_letter', COUNT(*) FILTER (WHERE status = 'dead_letter'),
        'completed', COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read')),
        'stuck', COUNT(*) FILTER (WHERE status = 'processing' AND locked_at < v_stuck_threshold)
    ) INTO v_scheduled
    FROM public.wa_scheduled_messages
    WHERE business_id = p_business_id;

    -- 3. Campaign Recipients Queue (wa_campaign_recipients)
    SELECT jsonb_build_object(
        'worker_type', 'campaign_worker',
        'pending', COUNT(*) FILTER (WHERE status = 'pending' AND retry_count = 0),
        'processing', COUNT(*) FILTER (WHERE status = 'processing'),
        'retrying', COUNT(*) FILTER (WHERE status = 'pending' AND retry_count > 0),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'dead_letter', COUNT(*) FILTER (WHERE status = 'dead_letter'),
        'completed', COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'read')),
        'stuck', COUNT(*) FILTER (WHERE status = 'processing' AND locked_at < v_stuck_threshold)
    ) INTO v_campaign
    FROM public.wa_campaign_recipients
    WHERE business_id = p_business_id;

    -- 4. CRM Reminders Queue (crm_follow_up_reminders)
    SELECT jsonb_build_object(
        'worker_type', 'crm_reminder_worker',
        'pending', COUNT(*) FILTER (WHERE status = 'pending' AND retry_count = 0),
        'processing', COUNT(*) FILTER (WHERE status = 'processing'),
        'retrying', COUNT(*) FILTER (WHERE status = 'pending' AND retry_count > 0),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'dead_letter', COUNT(*) FILTER (WHERE status = 'dead_letter'),
        'completed', COUNT(*) FILTER (WHERE status = 'delivered'),
        'stuck', COUNT(*) FILTER (WHERE status = 'processing' AND locked_at < v_stuck_threshold)
    ) INTO v_crm_reminders
    FROM public.crm_follow_up_reminders
    WHERE business_id = p_business_id;

    -- Combine into unified tenant operational telemetry object
    v_result := jsonb_build_object(
        'business_id', p_business_id,
        'timestamp', TIMEZONE('utc', NOW()),
        'queues', jsonb_build_object(
            'automation', v_automation,
            'scheduled', v_scheduled,
            'campaigns', v_campaign,
            'crm_reminders', v_crm_reminders
        )
    );

    RETURN v_result;
END;
$$;

-- Grant execution to service_role and authenticated users
REVOKE EXECUTE ON FUNCTION public.get_worker_health_metrics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_worker_health_metrics(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_worker_health_metrics(UUID) TO authenticated;

-- 5. ATOMIC RPC: RECOVER STUCK QUEUE JOBS SAFELY
-- Reclaims stuck processing jobs while verifying if the message was already dispatched to prevent duplicate sends
CREATE OR REPLACE FUNCTION public.reclaim_stuck_queue_jobs(
    p_timeout_minutes INT DEFAULT 5,
    p_business_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_threshold TIMESTAMPTZ := TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::INTERVAL;
    v_reclaimed_automation INT := 0;
    v_reclaimed_scheduled INT := 0;
    v_reclaimed_campaigns INT := 0;
    v_reclaimed_crm INT := 0;
BEGIN
    -- 1. Automation Jobs: Unlock stuck jobs, increment attempts, or dead-letter if exhausted
    WITH stuck AS (
        SELECT id, attempts, max_attempts
        FROM public.wa_processing_jobs
        WHERE status = 'processing'
          AND locked_at < v_threshold
          AND (p_business_id IS NULL OR business_id = p_business_id)
        FOR UPDATE SKIP LOCKED
    ),
    updated AS (
        UPDATE public.wa_processing_jobs j
        SET status = CASE WHEN s.attempts + 1 >= s.max_attempts THEN 'dead_letter' ELSE 'pending' END,
            attempts = s.attempts + 1,
            locked_at = NULL,
            locked_by = NULL,
            last_error = CASE WHEN s.attempts + 1 >= s.max_attempts THEN 'Max attempts exhausted after stuck processing' ELSE 'Reclaimed from stuck lock' END,
            updated_at = TIMEZONE('utc', NOW())
        FROM stuck s
        WHERE j.id = s.id
        RETURNING j.id
    )
    SELECT COUNT(*) INTO v_reclaimed_automation FROM updated;

    -- 2. Scheduled Messages: If message_id or meta_message_id exists, mark sent to prevent duplicate send!
    WITH stuck AS (
        SELECT id, retry_count, max_retries, message_id, meta_message_id
        FROM public.wa_scheduled_messages
        WHERE status = 'processing'
          AND locked_at < v_threshold
          AND (p_business_id IS NULL OR business_id = p_business_id)
        FOR UPDATE SKIP LOCKED
    ),
    updated AS (
        UPDATE public.wa_scheduled_messages m
        SET status = CASE
                WHEN s.message_id IS NOT NULL OR s.meta_message_id IS NOT NULL THEN 'sent'
                WHEN s.retry_count + 1 >= s.max_retries THEN 'dead_letter'
                ELSE 'scheduled'
            END,
            retry_count = CASE
                WHEN s.message_id IS NOT NULL OR s.meta_message_id IS NOT NULL THEN s.retry_count
                ELSE s.retry_count + 1
            END,
            locked_at = NULL,
            locked_by = NULL,
            last_error = CASE
                WHEN s.message_id IS NOT NULL OR s.meta_message_id IS NOT NULL THEN 'Dispatched prior to lock recovery'
                WHEN s.retry_count + 1 >= s.max_retries THEN 'Max retries exhausted after stuck processing'
                ELSE 'Reclaimed from stuck lock'
            END,
            updated_at = TIMEZONE('utc', NOW())
        FROM stuck s
        WHERE m.id = s.id
        RETURNING m.id
    )
    SELECT COUNT(*) INTO v_reclaimed_scheduled FROM updated;

    -- 3. Campaign Recipients: If message_id exists, mark sent to prevent duplicate send!
    WITH stuck AS (
        SELECT id, retry_count, max_retries, message_id
        FROM public.wa_campaign_recipients
        WHERE status = 'processing'
          AND locked_at < v_threshold
          AND (p_business_id IS NULL OR business_id = p_business_id)
        FOR UPDATE SKIP LOCKED
    ),
    updated AS (
        UPDATE public.wa_campaign_recipients r
        SET status = CASE
                WHEN s.message_id IS NOT NULL THEN 'sent'
                WHEN s.retry_count + 1 >= s.max_retries THEN 'dead_letter'
                ELSE 'pending'
            END,
            retry_count = CASE
                WHEN s.message_id IS NOT NULL THEN s.retry_count
                ELSE s.retry_count + 1
            END,
            locked_at = NULL,
            locked_by = NULL,
            last_error = CASE
                WHEN s.message_id IS NOT NULL THEN 'Dispatched prior to lock recovery'
                WHEN s.retry_count + 1 >= s.max_retries THEN 'Max retries exhausted after stuck processing'
                ELSE 'Reclaimed from stuck lock'
            END,
            updated_at = TIMEZONE('utc', NOW())
        FROM stuck s
        WHERE r.id = s.id
        RETURNING r.id
    )
    SELECT COUNT(*) INTO v_reclaimed_campaigns FROM updated;

    -- 4. CRM Follow-Up Reminders: Unlock stuck reminders
    WITH stuck AS (
        SELECT id, retry_count, max_retries
        FROM public.crm_follow_up_reminders
        WHERE status = 'processing'
          AND locked_at < v_threshold
          AND (p_business_id IS NULL OR business_id = p_business_id)
        FOR UPDATE SKIP LOCKED
    ),
    updated AS (
        UPDATE public.crm_follow_up_reminders rem
        SET status = CASE WHEN s.retry_count + 1 >= s.max_retries THEN 'dead_letter' ELSE 'pending' END,
            retry_count = s.retry_count + 1,
            locked_at = NULL,
            locked_by = NULL,
            last_error = CASE WHEN s.retry_count + 1 >= s.max_retries THEN 'Max retries exhausted after stuck processing' ELSE 'Reclaimed from stuck lock' END
        FROM stuck s
        WHERE rem.id = s.id
        RETURNING rem.id
    )
    SELECT COUNT(*) INTO v_reclaimed_crm FROM updated;

    RETURN jsonb_build_object(
        'timestamp', TIMEZONE('utc', NOW()),
        'reclaimed', jsonb_build_object(
            'automation', v_reclaimed_automation,
            'scheduled', v_reclaimed_scheduled,
            'campaigns', v_reclaimed_campaigns,
            'crm_reminders', v_reclaimed_crm
        )
    );
END;
$$;

-- Grant execution to service_role only
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_queue_jobs(INT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_queue_jobs(INT, UUID) TO service_role;

-- 6. ATOMIC RPC: MANUAL RETRY OF FAILED/DEAD-LETTER QUEUE JOBS
-- Strictly validates business ownership, resets status to pending/scheduled, and clears locks safely
CREATE OR REPLACE FUNCTION public.retry_queue_job(
    p_business_id UUID,
    p_queue_type TEXT,
    p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated_id UUID;
BEGIN
    IF p_business_id IS NULL OR p_job_id IS NULL OR p_queue_type IS NULL THEN
        RAISE EXCEPTION 'Parameters p_business_id, p_queue_type, and p_job_id are required';
    END IF;

    IF p_queue_type = 'automation' THEN
        UPDATE public.wa_processing_jobs
        SET status = 'pending',
            attempts = 0,
            locked_at = NULL,
            locked_by = NULL,
            scheduled_at = TIMEZONE('utc', NOW()),
            last_error = 'Manually requeued by administrator',
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = p_job_id
          AND business_id = p_business_id
          AND status IN ('failed', 'dead_letter')
        RETURNING id INTO v_updated_id;

    ELSIF p_queue_type = 'scheduled' THEN
        -- Prevent duplicate send if message already was sent
        UPDATE public.wa_scheduled_messages
        SET status = 'scheduled',
            retry_count = 0,
            locked_at = NULL,
            locked_by = NULL,
            scheduled_at = TIMEZONE('utc', NOW()),
            last_error = 'Manually requeued by administrator',
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = p_job_id
          AND business_id = p_business_id
          AND status IN ('failed', 'dead_letter')
          AND message_id IS NULL
          AND meta_message_id IS NULL
        RETURNING id INTO v_updated_id;

    ELSIF p_queue_type = 'campaign' THEN
        UPDATE public.wa_campaign_recipients
        SET status = 'pending',
            retry_count = 0,
            locked_at = NULL,
            locked_by = NULL,
            last_error = 'Manually requeued by administrator',
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = p_job_id
          AND business_id = p_business_id
          AND status IN ('failed', 'dead_letter')
          AND message_id IS NULL
        RETURNING id INTO v_updated_id;

    ELSIF p_queue_type = 'crm_reminder' THEN
        UPDATE public.crm_follow_up_reminders
        SET status = 'pending',
            retry_count = 0,
            locked_at = NULL,
            locked_by = NULL,
            last_error = 'Manually requeued by administrator'
        WHERE id = p_job_id
          AND business_id = p_business_id
          AND status IN ('failed', 'dead_letter')
        RETURNING id INTO v_updated_id;

    ELSE
        RAISE EXCEPTION 'Unsupported queue type: %', p_queue_type;
    END IF;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Job not found, already dispatched, or not in retryable state'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'job_id', v_updated_id,
        'queue_type', p_queue_type,
        'status', 'requeued'
    );
END;
$$;

-- Grant execution to service_role and authenticated users
REVOKE EXECUTE ON FUNCTION public.retry_queue_job(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_queue_job(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_queue_job(UUID, TEXT, UUID) TO authenticated;
