-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 028: META SOCIAL WORKER & QUEUE RELIABILITY
-- ==============================================================================
-- PHASE 13B.2: Forward-only fixes for Meta Social Worker, Queue & Delivery Reliability
--
-- REMEDIATIONS INCLUDED:
-- 1. Expands status constraints on meta_social_events and meta_social_deliveries
-- 2. Adds worker lease, retry governance and lock fields to meta_social_events
-- 3. Adds worker lease and lock fields to meta_social_deliveries
-- 4. Creates atomic claim RPC claim_meta_social_events() using FOR UPDATE SKIP LOCKED
-- 5. Creates stuck-job recovery RPC reclaim_stuck_meta_social_events()
-- 6. Adds high-performance partial indexes for queue draining and lease expiration
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXPAND STATUS CHECK CONSTRAINTS & ADD LEASE / RETRY FIELDS
-- ------------------------------------------------------------------------------

-- 1.1 meta_social_events
ALTER TABLE public.meta_social_events
    DROP CONSTRAINT IF EXISTS meta_social_events_status_check;

ALTER TABLE public.meta_social_events
    ADD CONSTRAINT meta_social_events_status_check
    CHECK (status IN (
        'received',
        'processing',
        'processed',
        'replied',
        'failed',
        'retry_scheduled',
        'permanently_failed',
        'ambiguous_outcome',
        'ignored'
    ));

ALTER TABLE public.meta_social_events
    ADD COLUMN IF NOT EXISTS claimed_by TEXT,
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_attempts INT NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW());

-- 1.2 meta_social_deliveries
ALTER TABLE public.meta_social_deliveries
    DROP CONSTRAINT IF EXISTS meta_social_deliveries_status_check;

ALTER TABLE public.meta_social_deliveries
    ADD CONSTRAINT meta_social_deliveries_status_check
    CHECK (status IN (
        'pending',
        'processing',
        'succeeded',
        'failed',
        'retry_scheduled',
        'permanently_failed',
        'ambiguous_outcome'
    ));

ALTER TABLE public.meta_social_deliveries
    ADD COLUMN IF NOT EXISTS claimed_by TEXT,
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 2. HIGH-PERFORMANCE QUEUE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meta_social_events_claim_queue 
    ON public.meta_social_events (status, created_at ASC)
    WHERE status IN ('received', 'retry_scheduled', 'processing');

CREATE INDEX IF NOT EXISTS idx_meta_social_events_retry 
    ON public.meta_social_events (status, next_retry_at ASC)
    WHERE status = 'retry_scheduled';

CREATE INDEX IF NOT EXISTS idx_meta_social_deliveries_retry 
    ON public.meta_social_deliveries (status, next_retry_at ASC)
    WHERE status IN ('pending', 'retry_scheduled', 'processing');

-- ------------------------------------------------------------------------------
-- 3. ATOMIC WORKER CLAIM RPC: claim_meta_social_events
-- ------------------------------------------------------------------------------
-- Atomically locks and transitions eligible events from 'received' or
-- 'retry_scheduled' to 'processing' with a bounded lease duration using
-- FOR UPDATE SKIP LOCKED. Concurrent workers will never claim the same row.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_meta_social_events(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 10,
    p_lease_seconds INT DEFAULT 300
)
RETURNS SETOF public.meta_social_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lease_duration INTERVAL;
BEGIN
    v_lease_duration := (p_lease_seconds || ' seconds')::INTERVAL;

    RETURN QUERY
    WITH eligible_events AS (
        SELECT id
        FROM public.meta_social_events
        WHERE (
            -- 1. Brand new received events ready to process
            (status = 'received' AND (next_retry_at IS NULL OR next_retry_at <= TIMEZONE('utc', NOW())))
            OR
            -- 2. Retry scheduled events that have reached next_retry_at
            (status = 'retry_scheduled' AND (next_retry_at IS NULL OR next_retry_at <= TIMEZONE('utc', NOW())) AND attempt_count < max_attempts)
            OR
            -- 3. Abandoned / expired leased processing events (crash recovery)
            (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < TIMEZONE('utc', NOW()) AND attempt_count < max_attempts)
        )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    UPDATE public.meta_social_events e
    SET status = 'processing',
        claimed_by = p_worker_id,
        claimed_at = TIMEZONE('utc', NOW()),
        lease_expires_at = TIMEZONE('utc', NOW()) + v_lease_duration,
        attempt_count = e.attempt_count + 1,
        updated_at = TIMEZONE('utc', NOW())
    FROM eligible_events s
    WHERE e.id = s.id
    RETURNING e.*;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. STUCK JOB RECOVERY RPC: reclaim_stuck_meta_social_events
-- ------------------------------------------------------------------------------
-- Reclaims jobs whose leases have expired without completion.
-- Jobs that have reached max_attempts are marked 'permanently_failed'.
-- Jobs below max_attempts are reset to 'received' or 'retry_scheduled'.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reclaim_stuck_meta_social_events(
    p_timeout_seconds INT DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reclaimed_count INT := 0;
    v_exhausted_count INT := 0;
    v_threshold TIMESTAMPTZ;
BEGIN
    v_threshold := TIMEZONE('utc', NOW()) - (p_timeout_seconds || ' seconds')::INTERVAL;

    -- 1. Mark exhausted stuck jobs permanently_failed
    WITH exhausted AS (
        SELECT id
        FROM public.meta_social_events
        WHERE status = 'processing'
          AND (lease_expires_at < TIMEZONE('utc', NOW()) OR (claimed_at IS NOT NULL AND claimed_at < v_threshold))
          AND attempt_count >= max_attempts
        FOR UPDATE SKIP LOCKED
    ),
    marked_exhausted AS (
        UPDATE public.meta_social_events e
        SET status = 'permanently_failed',
            error_message = COALESCE(e.error_message, 'Exhausted maximum retry attempts while stuck in processing lease'),
            claimed_by = NULL,
            lease_expires_at = NULL,
            updated_at = TIMEZONE('utc', NOW())
        FROM exhausted x
        WHERE e.id = x.id
        RETURNING e.id
    )
    SELECT COUNT(*) INTO v_exhausted_count FROM marked_exhausted;

    -- 2. Reset unexhausted stuck jobs back to received for re-claiming
    WITH stuck AS (
        SELECT id
        FROM public.meta_social_events
        WHERE status = 'processing'
          AND (lease_expires_at < TIMEZONE('utc', NOW()) OR (claimed_at IS NOT NULL AND claimed_at < v_threshold))
          AND attempt_count < max_attempts
        FOR UPDATE SKIP LOCKED
    ),
    reset_stuck AS (
        UPDATE public.meta_social_events e
        SET status = 'received',
            claimed_by = NULL,
            lease_expires_at = NULL,
            error_message = 'Reclaimed from expired worker lease',
            updated_at = TIMEZONE('utc', NOW())
        FROM stuck s
        WHERE e.id = s.id
        RETURNING e.id
    )
    SELECT COUNT(*) INTO v_reclaimed_count FROM reset_stuck;

    RETURN jsonb_build_object(
        'reclaimed', v_reclaimed_count,
        'exhausted', v_exhausted_count,
        'timestamp', TIMEZONE('utc', NOW())
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCTION AUTHORIZATION GRANTS (HARDENED: SERVICE_ROLE ONLY)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) TO service_role;

COMMENT ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) IS
    'Claims next batch of pending Meta social events using FOR UPDATE SKIP LOCKED. Restricted strictly to service_role.';

COMMENT ON FUNCTION public.reclaim_stuck_meta_social_events(INT) IS
    'Reclaims expired or stuck Meta social events. Restricted strictly to service_role.';
