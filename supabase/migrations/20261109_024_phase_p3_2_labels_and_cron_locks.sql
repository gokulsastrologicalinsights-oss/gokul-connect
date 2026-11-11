-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 024: LABELS & DISTRIBUTED CRON LOCKS
-- ==============================================================================
-- PHASE P3.2: Production Blocker Remediation
-- 
-- 1. Persistent Conversation Labels:
--    Adds labels TEXT[] NOT NULL DEFAULT '{}'::text[] to public.wa_conversations
--    with a GIN index for high-performance label filtering.
--
-- 2. PostgreSQL-Backed Distributed Cron Locking:
--    Creates public.cron_locks table and atomic security-definer RPCs for:
--    - acquire_cron_lock (atomic acquisition with expiry / crash recovery)
--    - renew_cron_lock (owner-verified lease renewal)
--    - release_cron_lock (owner-verified graceful release)
--    - get_cron_lock_status (read-only lock state inspection)
--
-- Multi-tenant isolation: Lock keys support tenant scoping (cron_name:business_id)
-- so jobs for one tenant never interfere with or block jobs for another tenant.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: PERSISTENT CONVERSATION LABELS
-- ------------------------------------------------------------------------------

-- 1.1 Add labels array column to wa_conversations
ALTER TABLE public.wa_conversations
    ADD COLUMN IF NOT EXISTS labels TEXT[] NOT NULL DEFAULT '{}'::text[];

-- 1.2 GIN index for high-performance tag/label lookups and array containment
CREATE INDEX IF NOT EXISTS idx_wa_conversations_labels
    ON public.wa_conversations USING GIN (labels);

-- ------------------------------------------------------------------------------
-- SECTION 2: DISTRIBUTED CRON LOCKS TABLE
-- ------------------------------------------------------------------------------

-- 2.1 Create table public.cron_locks
CREATE TABLE IF NOT EXISTS public.cron_locks (
    lock_key TEXT PRIMARY KEY,
    cron_name TEXT NOT NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    expires_at TIMESTAMPTZ NOT NULL,
    renewed_at TIMESTAMPTZ,
    renewal_count INT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 2.2 Indexes for fast lock expiration queries and tenant filtering
CREATE INDEX IF NOT EXISTS idx_cron_locks_expires_at
    ON public.cron_locks (expires_at);

CREATE INDEX IF NOT EXISTS idx_cron_locks_cron_name
    ON public.cron_locks (cron_name);

CREATE INDEX IF NOT EXISTS idx_cron_locks_business_id
    ON public.cron_locks (business_id)
    WHERE business_id IS NOT NULL;

-- 2.3 Row Level Security
ALTER TABLE public.cron_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_cron_locks" ON public.cron_locks;
CREATE POLICY "service_role_cron_locks"
    ON public.cron_locks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_cron_locks_select" ON public.cron_locks;
CREATE POLICY "tenant_cron_locks_select"
    ON public.cron_locks
    FOR SELECT
    TO authenticated
    USING (
        business_id IS NULL OR
        check_user_business_access(business_id) OR
        is_superadmin()
    );

-- 2.4 Tenant Immutability Trigger
DROP TRIGGER IF EXISTS trg_cron_locks_immutable_business_id ON public.cron_locks;
CREATE TRIGGER trg_cron_locks_immutable_business_id
    BEFORE UPDATE ON public.cron_locks
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- ------------------------------------------------------------------------------
-- SECTION 3: ATOMIC CRON LOCKING RPCs (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- 3.1 ATOMIC LOCK ACQUISITION (with crash recovery for expired leases)
CREATE OR REPLACE FUNCTION public.acquire_cron_lock(
    p_lock_key TEXT,
    p_cron_name TEXT,
    p_owner_id TEXT,
    p_ttl_seconds INT DEFAULT 60,
    p_business_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_expires_at TIMESTAMPTZ := v_now + (p_ttl_seconds || ' seconds')::interval;
    v_existing RECORD;
BEGIN
    -- Atomic upsert: Insert new lock, or overwrite existing lock IF AND ONLY IF expired
    INSERT INTO public.cron_locks (
        lock_key,
        cron_name,
        business_id,
        owner_id,
        acquired_at,
        expires_at,
        renewed_at,
        renewal_count,
        metadata,
        created_at,
        updated_at
    )
    VALUES (
        p_lock_key,
        p_cron_name,
        p_business_id,
        p_owner_id,
        v_now,
        v_expires_at,
        NULL,
        0,
        COALESCE(p_metadata, '{}'::jsonb),
        v_now,
        v_now
    )
    ON CONFLICT (lock_key) DO UPDATE
    SET
        cron_name = EXCLUDED.cron_name,
        business_id = EXCLUDED.business_id,
        owner_id = EXCLUDED.owner_id,
        acquired_at = v_now,
        expires_at = v_expires_at,
        renewed_at = NULL,
        renewal_count = 0,
        metadata = EXCLUDED.metadata,
        updated_at = v_now
    WHERE public.cron_locks.expires_at < v_now;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'acquired', true,
            'lock_key', p_lock_key,
            'owner_id', p_owner_id,
            'acquired_at', v_now,
            'expires_at', v_expires_at,
            'recovered', (SELECT count(*) > 0 FROM public.cron_locks WHERE lock_key = p_lock_key AND acquired_at = v_now AND created_at < v_now)
        );
    END IF;

    -- Concurrency contention: Lock is actively held by another instance
    SELECT owner_id, acquired_at, expires_at, renewed_at, renewal_count
    INTO v_existing
    FROM public.cron_locks
    WHERE lock_key = p_lock_key;

    RETURN jsonb_build_object(
        'acquired', false,
        'lock_key', p_lock_key,
        'current_owner', v_existing.owner_id,
        'acquired_at', v_existing.acquired_at,
        'expires_at', v_existing.expires_at,
        'renewed_at', v_existing.renewed_at,
        'renewal_count', v_existing.renewal_count
    );
END;
$$;

-- 3.2 SAFE LEASE RENEWAL (Owner-verified lease extension)
CREATE OR REPLACE FUNCTION public.renew_cron_lock(
    p_lock_key TEXT,
    p_owner_id TEXT,
    p_ttl_seconds INT DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_expires_at TIMESTAMPTZ := v_now + (p_ttl_seconds || ' seconds')::interval;
    v_rec RECORD;
BEGIN
    UPDATE public.cron_locks
    SET
        expires_at = v_expires_at,
        renewed_at = v_now,
        renewal_count = renewal_count + 1,
        updated_at = v_now
    WHERE lock_key = p_lock_key
      AND owner_id = p_owner_id
      AND expires_at >= v_now
    RETURNING * INTO v_rec;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'renewed', true,
            'lock_key', p_lock_key,
            'owner_id', p_owner_id,
            'renewed_at', v_now,
            'expires_at', v_expires_at,
            'renewal_count', v_rec.renewal_count
        );
    ELSE
        RETURN jsonb_build_object(
            'renewed', false,
            'lock_key', p_lock_key,
            'owner_id', p_owner_id,
            'reason', 'Lock lost, expired, or claimed by another worker'
        );
    END IF;
END;
$$;

-- 3.3 OWNER-VERIFIED RELEASE
CREATE OR REPLACE FUNCTION public.release_cron_lock(
    p_lock_key TEXT,
    p_owner_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted BOOLEAN := FALSE;
BEGIN
    DELETE FROM public.cron_locks
    WHERE lock_key = p_lock_key
      AND owner_id = p_owner_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'released', true,
            'lock_key', p_lock_key,
            'owner_id', p_owner_id
        );
    ELSE
        RETURN jsonb_build_object(
            'released', false,
            'lock_key', p_lock_key,
            'owner_id', p_owner_id,
            'reason', 'Lock not found or owned by another instance'
        );
    END IF;
END;
$$;

-- 3.4 READ-ONLY STATUS INSPECTION
CREATE OR REPLACE FUNCTION public.get_cron_lock_status(
    p_lock_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
BEGIN
    SELECT *
    INTO v_rec
    FROM public.cron_locks
    WHERE lock_key = p_lock_key;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'exists', false,
            'lock_key', p_lock_key,
            'is_locked', false
        );
    END IF;

    RETURN jsonb_build_object(
        'exists', true,
        'lock_key', v_rec.lock_key,
        'cron_name', v_rec.cron_name,
        'business_id', v_rec.business_id,
        'owner_id', v_rec.owner_id,
        'acquired_at', v_rec.acquired_at,
        'expires_at', v_rec.expires_at,
        'renewed_at', v_rec.renewed_at,
        'renewal_count', v_rec.renewal_count,
        'is_locked', v_rec.expires_at >= v_now,
        'seconds_remaining', GREATEST(0, EXTRACT(EPOCH FROM (v_rec.expires_at - v_now))::int)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- SECTION 4: FUNCTION EXECUTION PRIVILEGES
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.acquire_cron_lock(TEXT, TEXT, TEXT, INT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_cron_lock(TEXT, TEXT, TEXT, INT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_cron_lock(TEXT, TEXT, TEXT, INT, UUID, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.renew_cron_lock(TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_cron_lock(TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_cron_lock(TEXT, TEXT, INT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.release_cron_lock(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_cron_lock(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_cron_lock(TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_cron_lock_status(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cron_lock_status(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cron_lock_status(TEXT) TO authenticated;
