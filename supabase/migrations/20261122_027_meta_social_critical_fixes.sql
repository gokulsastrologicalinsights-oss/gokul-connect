-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 027: META SOCIAL CRITICAL REMEDIATION
-- ==============================================================================
-- PHASE 13B: Forward-only fixes for Facebook & Instagram Social Automation
-- Strict Multi-Tenant Isolation, Outbound Delivery Ledger, Webhook Hardening
--
-- REMEDIATIONS INCLUDED:
-- 1. Enforces global uniqueness on (platform, account_id) in meta_social_connections
-- 2. Adds default_dm_reply and token_expires_at to meta_social_connections
-- 3. Creates meta_social_deliveries table for separate public/private delivery tracking
-- 4. Adds composite foreign keys (connection_id, business_id) across all child tables
-- 5. Adds tenant immutability triggers (prevent_tenant_reassignment) to all tables
-- 6. Adds outbound delivery tracking columns to meta_social_events
-- 7. Upgrades ingest_meta_social_event_atomic with ON CONFLICT race-condition safety
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. META SOCIAL CONNECTIONS HARDENING
-- ------------------------------------------------------------------------------
-- Drop tenant-scoped unique constraint and replace with global (platform, account_id)
-- uniqueness so a Facebook Page or Instagram Account can only belong to one tenant.
ALTER TABLE public.meta_social_connections 
    DROP CONSTRAINT IF EXISTS uq_meta_social_connections_tenant_platform_account;

ALTER TABLE public.meta_social_connections
    ADD CONSTRAINT uq_meta_social_connections_global_platform_account 
    UNIQUE (platform, account_id);

-- Add separate default_dm_reply and token expiration tracking
ALTER TABLE public.meta_social_connections
    ADD COLUMN IF NOT EXISTS default_dm_reply TEXT 
        DEFAULT 'வணக்கம்! எங்கள் சேவைகள் மற்றும் ஆலோசனை விவரங்களை இங்கே பகிர்கிறோம்.',
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 2. COMPOSITE FOREIGN KEYS ON EXISTING TABLES
-- ------------------------------------------------------------------------------
-- Enforces tenant integrity: child rows cannot point to another tenant's connection

-- 2.1 meta_social_credentials
ALTER TABLE public.meta_social_credentials
    DROP CONSTRAINT IF EXISTS fk_meta_social_credentials_conn_biz;

ALTER TABLE public.meta_social_credentials
    ADD CONSTRAINT fk_meta_social_credentials_conn_biz
    FOREIGN KEY (connection_id, business_id)
    REFERENCES public.meta_social_connections(id, business_id)
    ON DELETE CASCADE;

-- 2.2 meta_social_rules
ALTER TABLE public.meta_social_rules
    DROP CONSTRAINT IF EXISTS fk_meta_social_rules_conn_biz;

ALTER TABLE public.meta_social_rules
    ADD CONSTRAINT fk_meta_social_rules_conn_biz
    FOREIGN KEY (connection_id, business_id)
    REFERENCES public.meta_social_connections(id, business_id)
    ON DELETE CASCADE;

-- 2.3 meta_social_events
ALTER TABLE public.meta_social_events
    DROP CONSTRAINT IF EXISTS fk_meta_social_events_conn_biz;

ALTER TABLE public.meta_social_events
    ADD CONSTRAINT fk_meta_social_events_conn_biz
    FOREIGN KEY (connection_id, business_id)
    REFERENCES public.meta_social_connections(id, business_id)
    ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 3. TENANT IMMUTABILITY TRIGGERS
-- ------------------------------------------------------------------------------
-- Prevent altering business_id on credentials and events via direct SQL UPDATE

DROP TRIGGER IF EXISTS trg_meta_social_credentials_immutable_business_id ON public.meta_social_credentials;
CREATE TRIGGER trg_meta_social_credentials_immutable_business_id
    BEFORE UPDATE ON public.meta_social_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

DROP TRIGGER IF EXISTS trg_meta_social_events_immutable_business_id ON public.meta_social_events;
CREATE TRIGGER trg_meta_social_events_immutable_business_id
    BEFORE UPDATE ON public.meta_social_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- ------------------------------------------------------------------------------
-- 4. OUTBOUND DELIVERY STATE COLUMNS ON META_SOCIAL_EVENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.meta_social_events
    ADD COLUMN IF NOT EXISTS public_reply_status TEXT DEFAULT 'none'
        CHECK (public_reply_status IN ('none', 'pending', 'replied', 'failed', 'skipped')),
    ADD COLUMN IF NOT EXISTS private_reply_status TEXT DEFAULT 'none'
        CHECK (private_reply_status IN ('none', 'pending', 'replied', 'failed', 'skipped')),
    ADD COLUMN IF NOT EXISTS public_reply_id TEXT,
    ADD COLUMN IF NOT EXISTS private_reply_id TEXT,
    ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 5. OUTBOUND DELIVERY TRACKING TABLE (META_SOCIAL_DELIVERIES)
-- ------------------------------------------------------------------------------
-- Tracks individual public comment replies and private DM replies independently
CREATE TABLE IF NOT EXISTS public.meta_social_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.meta_social_events(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.meta_social_connections(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
    action_type TEXT NOT NULL CHECK (action_type IN ('public_comment_reply', 'private_comment_reply', 'dm_reply')),
    recipient_id TEXT NOT NULL,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'retry_scheduled', 'permanently_failed')),
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_error TEXT,
    idempotency_key TEXT NOT NULL,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_meta_social_deliveries_idempotency UNIQUE (idempotency_key),
    CONSTRAINT uq_meta_social_deliveries_id_business UNIQUE (id, business_id),
    CONSTRAINT fk_meta_social_deliveries_conn_biz FOREIGN KEY (connection_id, business_id)
        REFERENCES public.meta_social_connections(id, business_id) ON DELETE CASCADE,
    CONSTRAINT fk_meta_social_deliveries_event_biz FOREIGN KEY (event_id, business_id)
        REFERENCES public.meta_social_events(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meta_social_deliveries_lookup 
    ON public.meta_social_deliveries(business_id, event_id, action_type);
CREATE INDEX IF NOT EXISTS idx_meta_social_deliveries_queue 
    ON public.meta_social_deliveries(status, next_retry_at ASC) 
    WHERE status IN ('pending', 'retry_scheduled');

-- Tenant immutability trigger for deliveries
DROP TRIGGER IF EXISTS trg_meta_social_deliveries_immutable_business_id ON public.meta_social_deliveries;
CREATE TRIGGER trg_meta_social_deliveries_immutable_business_id
    BEFORE UPDATE ON public.meta_social_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- Row Level Security (RLS)
ALTER TABLE public.meta_social_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_meta_social_deliveries" ON public.meta_social_deliveries;
CREATE POLICY "service_role_meta_social_deliveries"
    ON public.meta_social_deliveries
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant isolation for meta_social_deliveries select" ON public.meta_social_deliveries;
CREATE POLICY "Tenant isolation for meta_social_deliveries select"
    ON public.meta_social_deliveries
    FOR SELECT
    TO authenticated
    USING (
        (select public.check_user_business_access(business_id))
        OR (select public.is_superadmin())
    );

-- ------------------------------------------------------------------------------
-- 6. HARDENED ATOMIC INGESTION RPC (RACE-CONDITION & CONCURRENCY SAFE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ingest_meta_social_event_atomic(
    p_platform TEXT,
    p_account_id TEXT,
    p_event_type TEXT,
    p_meta_event_id TEXT,
    p_sender_id TEXT,
    p_sender_name TEXT,
    p_post_id TEXT,
    p_comment_id TEXT,
    p_parent_comment_id TEXT,
    p_content TEXT,
    p_event_timestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_connection RECORD;
    v_event_id UUID;
BEGIN
    -- 1. Locate registered connection for this platform and account_id (or page_id)
    SELECT * INTO v_connection
    FROM public.meta_social_connections
    WHERE platform = p_platform
      AND (account_id = p_account_id OR page_id = p_account_id)
      AND is_enabled = true
      AND connection_status = 'connected'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'ignored',
            'reason', 'no_active_connection_found'
        );
    END IF;

    -- 2. Concurrency-safe atomic insert using ON CONFLICT DO NOTHING
    INSERT INTO public.meta_social_events (
        business_id,
        connection_id,
        platform,
        event_type,
        meta_event_id,
        sender_id,
        sender_name,
        post_id,
        comment_id,
        parent_comment_id,
        content,
        event_timestamp,
        status
    ) VALUES (
        v_connection.business_id,
        v_connection.id,
        p_platform,
        p_event_type,
        p_meta_event_id,
        p_sender_id,
        p_sender_name,
        p_post_id,
        p_comment_id,
        p_parent_comment_id,
        p_content,
        COALESCE(p_event_timestamp, TIMEZONE('utc', NOW())),
        'received'
    )
    ON CONFLICT (business_id, meta_event_id) DO NOTHING
    RETURNING id INTO v_event_id;

    -- If conflict occurred (v_event_id is NULL), it is a duplicate event
    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id
        FROM public.meta_social_events
        WHERE business_id = v_connection.business_id
          AND meta_event_id = p_meta_event_id;

        RETURN jsonb_build_object(
            'status', 'duplicate',
            'event_id', v_event_id,
            'business_id', v_connection.business_id,
            'connection_id', v_connection.id
        );
    END IF;

    -- 3. Update last_webhook_at on connection
    UPDATE public.meta_social_connections
    SET last_webhook_at = TIMEZONE('utc', NOW()),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = v_connection.id;

    RETURN jsonb_build_object(
        'status', 'ingested',
        'event_id', v_event_id,
        'business_id', v_connection.business_id,
        'connection_id', v_connection.id,
        'credential_ref', v_connection.credential_ref,
        'page_id', v_connection.page_id,
        'account_id', v_connection.account_id,
        'auto_reply_dms', v_connection.auto_reply_dms,
        'auto_reply_comments', v_connection.auto_reply_comments,
        'auto_dm_on_comment', v_connection.auto_dm_on_comment,
        'comment_dm_trigger_keywords', v_connection.comment_dm_trigger_keywords,
        'default_comment_reply', v_connection.default_comment_reply,
        'default_dm_reply', v_connection.default_dm_reply
    );
END;
$$;

-- Grant execution privileges
REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
