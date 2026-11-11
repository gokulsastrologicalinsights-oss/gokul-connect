-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 018: SCHEDULED MESSAGES & DURABLE SCHEDULING
-- ==============================================================================
-- PHASE 12.3: Scheduled Messages & Durable Message Dispatch Engine
-- Multi-Tenant Scheduled Message Storage, Atomic Claiming, RLS & Safe Cancellation.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- Composite foreign keys guarantee cross-tenant references are strictly rejected.
-- ==============================================================================

-- 1. WA_SCHEDULED_MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.wa_scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL,
    conversation_id UUID,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT,
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'template', 'image', 'document', 'audio', 'video')),
    content TEXT,
    template_name TEXT,
    template_language TEXT DEFAULT 'en_US',
    template_variables JSONB DEFAULT '{}'::jsonb,
    media_type TEXT CHECK (media_type IN ('image', 'document', 'audio', 'video')),
    media_storage_path TEXT,
    media_filename TEXT,
    media_file_size BIGINT,
    media_mime_type TEXT,
    media_caption TEXT,
    media_meta_id TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('draft', 'scheduled', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_error TEXT,
    message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL,
    meta_message_id TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Tenant isolation composite key
    CONSTRAINT uq_wa_scheduled_messages_id_business UNIQUE (id, business_id),

    -- Composite foreign keys guarantee connection belongs to the same business tenant
    CONSTRAINT fk_wa_scheduled_messages_conn_tenant
        FOREIGN KEY (connection_id, business_id)
        REFERENCES public.wa_connections(id, business_id) ON DELETE CASCADE,

    -- Composite foreign key guarantees conversation belongs to the same business tenant if specified
    CONSTRAINT fk_wa_scheduled_messages_conv_tenant
        FOREIGN KEY (conversation_id, business_id)
        REFERENCES public.wa_conversations(id, business_id) ON DELETE SET NULL
);

-- 2. COVERING INDEXES FOR SCHEDULING, DISPATCH & AUDITING
CREATE INDEX IF NOT EXISTS idx_wa_scheduled_messages_claim
    ON public.wa_scheduled_messages (status, scheduled_at ASC)
    WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_messages_biz_status
    ON public.wa_scheduled_messages (business_id, status, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_messages_biz_type
    ON public.wa_scheduled_messages (business_id, message_type);

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_messages_meta_msg
    ON public.wa_scheduled_messages (meta_message_id)
    WHERE meta_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_messages_msg_id
    ON public.wa_scheduled_messages (message_id)
    WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_scheduled_messages_phone
    ON public.wa_scheduled_messages (business_id, recipient_phone);

-- 3. TENANT IMMUTABILITY TRIGGER ON WA_SCHEDULED_MESSAGES
DROP TRIGGER IF EXISTS trg_wa_scheduled_messages_immutable_business_id ON public.wa_scheduled_messages;
CREATE TRIGGER trg_wa_scheduled_messages_immutable_business_id
    BEFORE UPDATE ON public.wa_scheduled_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 4. ATOMIC CLAIM RPC FOR SCHEDULED MESSAGE WORKER
CREATE OR REPLACE FUNCTION public.claim_next_scheduled_messages(
    p_batch_size INT DEFAULT 10,
    p_worker_id TEXT DEFAULT 'worker_anon'
)
RETURNS SETOF public.wa_scheduled_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH selected_messages AS (
        SELECT id
        FROM public.wa_scheduled_messages
        WHERE status = 'scheduled'
          AND scheduled_at <= TIMEZONE('utc', NOW())
        ORDER BY scheduled_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    UPDATE public.wa_scheduled_messages sm
    SET status = 'processing',
        locked_at = TIMEZONE('utc', NOW()),
        locked_by = p_worker_id,
        updated_at = TIMEZONE('utc', NOW())
    FROM selected_messages s
    WHERE sm.id = s.id
    RETURNING sm.*;
END;
$$;

-- 5. STUCK JOB RECOVERY RPC FOR SCHEDULED MESSAGES
CREATE OR REPLACE FUNCTION public.reclaim_stuck_scheduled_messages(
    p_timeout_minutes INT DEFAULT 5
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reclaimed_count INT;
BEGIN
    WITH stuck AS (
        SELECT id
        FROM public.wa_scheduled_messages
        WHERE status = 'processing'
          AND locked_at <= TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::interval
          AND retry_count < max_retries
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.wa_scheduled_messages sm
    SET status = 'scheduled',
        locked_at = NULL,
        locked_by = NULL,
        last_error = COALESCE(last_error, '') || ' [Stuck job reclaimed after timeout]',
        retry_count = retry_count + 1,
        updated_at = TIMEZONE('utc', NOW())
    FROM stuck s
    WHERE sm.id = s.id;

    GET DIAGNOSTICS v_reclaimed_count = ROW_COUNT;

    -- Permanently fail jobs that exceeded max_retries
    WITH max_retried AS (
        SELECT id
        FROM public.wa_scheduled_messages
        WHERE status = 'processing'
          AND locked_at <= TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::interval
          AND retry_count >= max_retries
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.wa_scheduled_messages sm
    SET status = 'failed',
        locked_at = NULL,
        locked_by = NULL,
        last_error = COALESCE(last_error, '') || ' [Job exceeded max retry limit during processing timeout]',
        updated_at = TIMEZONE('utc', NOW())
    FROM max_retried mr
    WHERE sm.id = mr.id;

    RETURN v_reclaimed_count;
END;
$$;

-- 6. PRIVILEGE HARDENING FOR SCHEDULED QUEUE RPCS
REVOKE ALL ON FUNCTION public.claim_next_scheduled_messages(INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_scheduled_messages(INTEGER, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_next_scheduled_messages(INTEGER, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_scheduled_messages(INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.reclaim_stuck_scheduled_messages(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_scheduled_messages(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_scheduled_messages(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_scheduled_messages(INTEGER) TO service_role;

-- 7. TRIGGER: SYNC DELIVERY AND READ STATUS FROM WA_MESSAGES
CREATE OR REPLACE FUNCTION public.sync_scheduled_message_delivery_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.meta_message_id IS NOT NULL THEN
        UPDATE public.wa_scheduled_messages
        SET status = CASE
                WHEN NEW.status = 'read' THEN 'read'
                WHEN NEW.status = 'delivered' AND status != 'read' THEN 'delivered'
                WHEN NEW.status = 'failed' THEN 'failed'
                ELSE status
            END,
            delivered_at = COALESCE(delivered_at, NEW.delivered_at),
            read_at = COALESCE(read_at, NEW.read_at),
            last_error = CASE WHEN NEW.status = 'failed' THEN COALESCE(NEW.error_message, last_error) ELSE last_error END,
            updated_at = TIMEZONE('utc', NOW())
        WHERE meta_message_id = NEW.meta_message_id
           OR message_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_messages_sync_scheduled_status ON public.wa_messages;
CREATE TRIGGER trg_wa_messages_sync_scheduled_status
    AFTER UPDATE OF status ON public.wa_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_scheduled_message_delivery_status();

-- 8. ROW LEVEL SECURITY (RLS) POLICIES FOR WA_SCHEDULED_MESSAGES
ALTER TABLE public.wa_scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for wa_scheduled_messages select" ON public.wa_scheduled_messages;
CREATE POLICY "Tenant isolation for wa_scheduled_messages select"
    ON public.wa_scheduled_messages
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can insert wa_scheduled_messages" ON public.wa_scheduled_messages;
CREATE POLICY "Authorized members can insert wa_scheduled_messages"
    ON public.wa_scheduled_messages
    FOR INSERT
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can update wa_scheduled_messages" ON public.wa_scheduled_messages;
CREATE POLICY "Authorized members can update wa_scheduled_messages"
    ON public.wa_scheduled_messages
    FOR UPDATE
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    )
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can delete wa_scheduled_messages" ON public.wa_scheduled_messages;
CREATE POLICY "Authorized members can delete wa_scheduled_messages"
    ON public.wa_scheduled_messages
    FOR DELETE
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );
