-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 019: CAMPAIGN MANAGEMENT & BULK MESSAGING
-- ==============================================================================
-- PHASE 12.4: Campaign Management & Bulk WhatsApp Messaging
-- Multi-Tenant Campaign Storage, Audience Snapshots, Recipient Claiming,
-- Consent Metadata, RLS & Safe Lifecycle Transitions.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- Composite foreign keys guarantee cross-tenant references are strictly rejected.
-- ==============================================================================

-- 1. EXTEND WA_CONTACTS WITH COMPREHENSIVE CONSENT & BLOCKING ATTRIBUTES
ALTER TABLE public.wa_contacts
    ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'opted_in'
        CHECK (consent_status IN ('opted_in', 'implicit', 'opted_out', 'none')),
    ADD COLUMN IF NOT EXISTS consent_source TEXT DEFAULT 'direct',
    ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    ADD COLUMN IF NOT EXISTS consent_withdrawn_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_eligibility_evaluation_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wa_contacts_consent
    ON public.wa_contacts (business_id, consent_status);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_blocked
    ON public.wa_contacts (business_id, is_blocked);

-- 2. WA_CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS public.wa_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    message_type TEXT NOT NULL
        CHECK (message_type IN ('template', 'text', 'image', 'document', 'audio', 'video')),
    template_id UUID REFERENCES public.wa_message_templates(id) ON DELETE SET NULL,
    template_name TEXT,
    template_language TEXT DEFAULT 'en_US',
    template_variables JSONB DEFAULT '{}'::jsonb,
    message_content TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'document', 'audio', 'video')),
    media_storage_path TEXT,
    media_filename TEXT,
    media_file_size BIGINT,
    media_mime_type TEXT,
    media_caption TEXT,
    media_meta_id TEXT,
    connection_id UUID NOT NULL,
    scheduled_at TIMESTAMPTZ,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'preparing', 'queued', 'sending', 'paused', 'completed', 'cancelled', 'failed')),
    audience_type TEXT NOT NULL DEFAULT 'all_contacts'
        CHECK (audience_type IN ('all_contacts', 'segment', 'category', 'manual')),
    audience_filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    audience_count INT NOT NULL DEFAULT 0,
    eligible_count INT NOT NULL DEFAULT 0,
    excluded_count INT NOT NULL DEFAULT 0,
    sent_count INT NOT NULL DEFAULT 0,
    delivered_count INT NOT NULL DEFAULT 0,
    read_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    batch_size INT NOT NULL DEFAULT 50,
    dispatch_interval_ms INT NOT NULL DEFAULT 1000,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Tenant isolation composite key
    CONSTRAINT uq_wa_campaigns_id_business UNIQUE (id, business_id),

    -- Composite foreign key guarantees connection belongs to the exact same business tenant
    CONSTRAINT fk_wa_campaigns_conn_tenant
        FOREIGN KEY (connection_id, business_id)
        REFERENCES public.wa_connections(id, business_id) ON DELETE CASCADE
);

-- Indexes for campaign lifecycle queries
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_biz_status
    ON public.wa_campaigns (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_scheduled
    ON public.wa_campaigns (status, scheduled_at ASC)
    WHERE status IN ('scheduled', 'queued');

-- Tenant immutability trigger for wa_campaigns
DROP TRIGGER IF EXISTS trg_wa_campaigns_immutable_business_id ON public.wa_campaigns;
CREATE TRIGGER trg_wa_campaigns_immutable_business_id
    BEFORE UPDATE ON public.wa_campaigns
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 3. WA_CAMPAIGN_RECIPIENTS TABLE
CREATE TABLE IF NOT EXISTS public.wa_campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL,
    contact_id UUID,
    phone_number TEXT NOT NULL,
    recipient_name TEXT,
    eligibility_status TEXT NOT NULL DEFAULT 'eligible'
        CHECK (eligibility_status IN ('eligible', 'excluded')),
    exclusion_reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled')),
    message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL,
    meta_message_id TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    last_error TEXT,
    locked_at TIMESTAMPTZ,
    locked_by TEXT,
    dispatched_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Unique recipient per campaign
    CONSTRAINT uq_wa_campaign_recipients_campaign_phone UNIQUE (campaign_id, phone_number),

    -- Tenant isolation composite key
    CONSTRAINT uq_wa_campaign_recipients_id_business UNIQUE (id, business_id),

    -- Composite foreign keys guarantee campaign and contact belong to the same business tenant
    CONSTRAINT fk_wa_campaign_recipients_campaign_tenant
        FOREIGN KEY (campaign_id, business_id)
        REFERENCES public.wa_campaigns(id, business_id) ON DELETE CASCADE,

    CONSTRAINT fk_wa_campaign_recipients_contact_tenant
        FOREIGN KEY (contact_id, business_id)
        REFERENCES public.wa_contacts(id, business_id) ON DELETE SET NULL
);

-- Indexes for campaign dispatching and recipient lookups
CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_claim
    ON public.wa_campaign_recipients (campaign_id, status, eligibility_status)
    WHERE status = 'pending' AND eligibility_status = 'eligible';

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_biz_phone
    ON public.wa_campaign_recipients (business_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_meta_msg
    ON public.wa_campaign_recipients (meta_message_id)
    WHERE meta_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_campaign_recipients_msg_id
    ON public.wa_campaign_recipients (message_id)
    WHERE message_id IS NOT NULL;

-- Tenant immutability trigger for wa_campaign_recipients
DROP TRIGGER IF EXISTS trg_wa_campaign_recipients_immutable_business_id ON public.wa_campaign_recipients;
CREATE TRIGGER trg_wa_campaign_recipients_immutable_business_id
    BEFORE UPDATE ON public.wa_campaign_recipients
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 4. ATOMIC CLAIM RPC FOR CAMPAIGN WORKER
CREATE OR REPLACE FUNCTION public.claim_next_campaign_recipients(
    p_batch_size INT DEFAULT 50,
    p_worker_id TEXT DEFAULT 'worker_anon'
)
RETURNS SETOF public.wa_campaign_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH eligible_campaigns AS (
        SELECT id
        FROM public.wa_campaigns
        WHERE status IN ('queued', 'sending')
          AND (scheduled_at IS NULL OR scheduled_at <= TIMEZONE('utc', NOW()))
        ORDER BY created_at ASC
    ),
    selected_recipients AS (
        SELECT r.id
        FROM public.wa_campaign_recipients r
        JOIN eligible_campaigns c ON r.campaign_id = c.id
        WHERE r.status = 'pending'
          AND r.eligibility_status = 'eligible'
        ORDER BY r.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    UPDATE public.wa_campaign_recipients r
    SET status = 'processing',
        locked_at = TIMEZONE('utc', NOW()),
        locked_by = p_worker_id,
        updated_at = TIMEZONE('utc', NOW())
    FROM selected_recipients s
    WHERE r.id = s.id
    RETURNING r.*;
END;
$$;

-- 5. STUCK JOB RECOVERY RPC FOR CAMPAIGN RECIPIENTS
CREATE OR REPLACE FUNCTION public.reclaim_stuck_campaign_recipients(
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
        FROM public.wa_campaign_recipients
        WHERE status = 'processing'
          AND locked_at <= TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::interval
          AND retry_count < max_retries
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.wa_campaign_recipients r
    SET status = 'pending',
        locked_at = NULL,
        locked_by = NULL,
        last_error = COALESCE(last_error, '') || ' [Stuck recipient claimed after timeout]',
        retry_count = retry_count + 1,
        updated_at = TIMEZONE('utc', NOW())
    FROM stuck s
    WHERE r.id = s.id;

    GET DIAGNOSTICS v_reclaimed_count = ROW_COUNT;

    -- Permanently fail recipients that exceeded max_retries
    WITH max_retried AS (
        SELECT id, campaign_id
        FROM public.wa_campaign_recipients
        WHERE status = 'processing'
          AND locked_at <= TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::interval
          AND retry_count >= max_retries
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.wa_campaign_recipients r
    SET status = 'failed',
        locked_at = NULL,
        locked_by = NULL,
        last_error = COALESCE(last_error, '') || ' [Recipient exceeded max retry limit during processing timeout]',
        updated_at = TIMEZONE('utc', NOW())
    FROM max_retried mr
    WHERE r.id = mr.id;

    RETURN v_reclaimed_count;
END;
$$;

-- 6. PRIVILEGE HARDENING FOR CAMPAIGN RPCS
REVOKE ALL ON FUNCTION public.claim_next_campaign_recipients(INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_campaign_recipients(INTEGER, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_next_campaign_recipients(INTEGER, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_campaign_recipients(INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.reclaim_stuck_campaign_recipients(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_campaign_recipients(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_campaign_recipients(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_campaign_recipients(INTEGER) TO service_role;

-- 7. TRIGGER: SYNC DELIVERY AND READ STATUS FROM WA_MESSAGES TO RECIPIENTS & ROLLUP COUNTERS
CREATE OR REPLACE FUNCTION public.sync_campaign_recipient_delivery_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_recipient RECORD;
BEGIN
    IF NEW.meta_message_id IS NOT NULL OR NEW.id IS NOT NULL THEN
        SELECT id, campaign_id, status INTO v_recipient
        FROM public.wa_campaign_recipients
        WHERE meta_message_id = NEW.meta_message_id
           OR message_id = NEW.id
        LIMIT 1;

        IF v_recipient.id IS NOT NULL THEN
            UPDATE public.wa_campaign_recipients
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
            WHERE id = v_recipient.id;

            -- Rollup counters on parent campaign
            IF NEW.status = 'delivered' AND v_recipient.status != 'delivered' AND v_recipient.status != 'read' THEN
                UPDATE public.wa_campaigns
                SET delivered_count = delivered_count + 1,
                    updated_at = TIMEZONE('utc', NOW())
                WHERE id = v_recipient.campaign_id;
            ELSIF NEW.status = 'read' AND v_recipient.status != 'read' THEN
                UPDATE public.wa_campaigns
                SET read_count = read_count + 1,
                    delivered_count = CASE WHEN v_recipient.status != 'delivered' THEN delivered_count + 1 ELSE delivered_count END,
                    updated_at = TIMEZONE('utc', NOW())
                WHERE id = v_recipient.campaign_id;
            ELSIF NEW.status = 'failed' AND v_recipient.status != 'failed' THEN
                UPDATE public.wa_campaigns
                SET failed_count = failed_count + 1,
                    updated_at = TIMEZONE('utc', NOW())
                WHERE id = v_recipient.campaign_id;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_messages_sync_campaign_status ON public.wa_messages;
CREATE TRIGGER trg_wa_messages_sync_campaign_status
    AFTER UPDATE OF status ON public.wa_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_campaign_recipient_delivery_status();

-- 8. ROW LEVEL SECURITY (RLS) POLICIES FOR CAMPAIGNS & RECIPIENTS
ALTER TABLE public.wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- wa_campaigns policies
DROP POLICY IF EXISTS "Tenant isolation for wa_campaigns select" ON public.wa_campaigns;
CREATE POLICY "Tenant isolation for wa_campaigns select"
    ON public.wa_campaigns
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can insert wa_campaigns" ON public.wa_campaigns;
CREATE POLICY "Authorized members can insert wa_campaigns"
    ON public.wa_campaigns
    FOR INSERT
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can update wa_campaigns" ON public.wa_campaigns;
CREATE POLICY "Authorized members can update wa_campaigns"
    ON public.wa_campaigns
    FOR UPDATE
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    )
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can delete wa_campaigns" ON public.wa_campaigns;
CREATE POLICY "Authorized members can delete wa_campaigns"
    ON public.wa_campaigns
    FOR DELETE
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

-- wa_campaign_recipients policies
DROP POLICY IF EXISTS "Tenant isolation for wa_campaign_recipients select" ON public.wa_campaign_recipients;
CREATE POLICY "Tenant isolation for wa_campaign_recipients select"
    ON public.wa_campaign_recipients
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can insert wa_campaign_recipients" ON public.wa_campaign_recipients;
CREATE POLICY "Authorized members can insert wa_campaign_recipients"
    ON public.wa_campaign_recipients
    FOR INSERT
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can update wa_campaign_recipients" ON public.wa_campaign_recipients;
CREATE POLICY "Authorized members can update wa_campaign_recipients"
    ON public.wa_campaign_recipients
    FOR UPDATE
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    )
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can delete wa_campaign_recipients" ON public.wa_campaign_recipients;
CREATE POLICY "Authorized members can delete wa_campaign_recipients"
    ON public.wa_campaign_recipients
    FOR DELETE
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );
