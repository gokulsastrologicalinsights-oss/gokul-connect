-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 026: META SOCIAL AUTOMATION (FB & INSTAGRAM)
-- ==============================================================================
-- PHASE 13: Facebook & Instagram Legitimate Deterministic Rule Automation
-- Strict Multi-Tenant Isolation, Zero AI Overhead, Timing-Safe Security
-- Handles:
-- 1. Facebook Page & Instagram Business Connection Management (Vault Reference)
-- 2. Predefined Keyword-Based Auto-Replies for Inbound Direct Messages (DMs)
-- 3. Predefined Auto-Replies for Post / Reel Comments (Public Reply & Private DM)
-- 4. Inbound Event Deduplication & Audit Ledger (`meta_social_events`)
-- 5. Deterministic Rules Engine (`meta_social_rules`) with Tamil & English Keywords
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: META SOCIAL CONNECTIONS TABLE
-- ------------------------------------------------------------------------------
-- Represents connected Facebook Pages and Instagram Professional Accounts.
-- Access tokens are encrypted using AES-256-GCM via credential_ref.
CREATE TABLE IF NOT EXISTS public.meta_social_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
    
    -- Account Identifiers from Meta Graph API
    account_id TEXT NOT NULL,      -- FB Page ID or Instagram Business Account ID (IGSID)
    account_name TEXT NOT NULL,    -- Human readable name (e.g., 'Gokul Astrological Insights Page')
    username TEXT,                 -- Instagram handle (e.g., 'gokuls_astrology')
    page_id TEXT,                  -- Associated FB Page ID (required for Instagram Graph API token)

    -- Credential Reference: Pointers to AES-256-GCM vault / encrypted storage
    -- NEVER STORE RAW PLAIN-TEXT ACCESS TOKENS IN THIS COLUMN
    credential_ref TEXT NOT NULL,

    -- Operational Status
    connection_status TEXT NOT NULL DEFAULT 'connected'
        CHECK (connection_status IN ('connected', 'disconnected', 'expired', 'error')),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Automation Feature Toggles
    auto_reply_dms BOOLEAN NOT NULL DEFAULT TRUE,
    auto_reply_comments BOOLEAN NOT NULL DEFAULT TRUE,
    auto_dm_on_comment BOOLEAN NOT NULL DEFAULT TRUE,

    -- Predefined Comment Automation Settings
    comment_dm_trigger_keywords JSONB NOT NULL DEFAULT '["INFO", "PRICE", "DETAILS", "BOOK", "ஜாதகம்", "தகவல்", "விவரம்"]'::jsonb,
    default_comment_reply TEXT DEFAULT 'Thank you for your comment! We have sent details directly to your inbox.',

    -- Health & Webhook Tracking
    last_webhook_at TIMESTAMPTZ,
    last_reply_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Constraints
    CONSTRAINT uq_meta_social_connections_id_business UNIQUE (id, business_id),
    CONSTRAINT uq_meta_social_connections_tenant_platform_account UNIQUE (business_id, platform, account_id)
);

-- Indexing for tenant lookup and webhook matching
CREATE INDEX IF NOT EXISTS idx_meta_social_conn_biz 
    ON public.meta_social_connections(business_id, platform, is_enabled);
CREATE INDEX IF NOT EXISTS idx_meta_social_conn_account 
    ON public.meta_social_connections(account_id);
CREATE INDEX IF NOT EXISTS idx_meta_social_conn_page 
    ON public.meta_social_connections(page_id) 
    WHERE page_id IS NOT NULL;

-- Tenant immutability trigger: forbids modifying business_id
DROP TRIGGER IF EXISTS trg_meta_social_connections_immutable_business_id ON public.meta_social_connections;
CREATE TRIGGER trg_meta_social_connections_immutable_business_id
    BEFORE UPDATE ON public.meta_social_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- Row Level Security (RLS)
ALTER TABLE public.meta_social_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_meta_social_connections" ON public.meta_social_connections;
CREATE POLICY "service_role_meta_social_connections"
    ON public.meta_social_connections
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant isolation for meta_social_connections select" ON public.meta_social_connections;
CREATE POLICY "Tenant isolation for meta_social_connections select"
    ON public.meta_social_connections
    FOR SELECT
    TO authenticated
    USING (
        (select public.check_user_business_access(business_id))
        OR (select public.is_superadmin())
    );

DROP POLICY IF EXISTS "Authorized members can insert meta_social_connections" ON public.meta_social_connections;
CREATE POLICY "Authorized members can insert meta_social_connections"
    ON public.meta_social_connections
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = meta_social_connections.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'admin')
        )
        OR (select public.is_superadmin())
    );

DROP POLICY IF EXISTS "Authorized members can update meta_social_connections" ON public.meta_social_connections;
CREATE POLICY "Authorized members can update meta_social_connections"
    ON public.meta_social_connections
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = meta_social_connections.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'admin')
        )
        OR (select public.is_superadmin())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = meta_social_connections.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'admin')
        )
        OR (select public.is_superadmin())
    );

DROP POLICY IF EXISTS "Authorized owners can delete meta_social_connections" ON public.meta_social_connections;
CREATE POLICY "Authorized owners can delete meta_social_connections"
    ON public.meta_social_connections
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = meta_social_connections.business_id
              AND bm.user_id = auth.uid()
              AND bm.role = 'owner'
        )
        OR (select public.is_superadmin())
    );

-- ------------------------------------------------------------------------------
-- SECTION 1.1: META SOCIAL CREDENTIAL VAULT (AES-256-GCM)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_social_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.meta_social_connections(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    key_version TEXT NOT NULL DEFAULT 'v1',
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_meta_social_credentials_connection UNIQUE (connection_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_social_credentials_biz ON public.meta_social_credentials(business_id);
CREATE INDEX IF NOT EXISTS idx_meta_social_credentials_conn ON public.meta_social_credentials(connection_id);

ALTER TABLE public.meta_social_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_meta_social_credentials" ON public.meta_social_credentials;
CREATE POLICY "service_role_meta_social_credentials"
    ON public.meta_social_credentials
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Strict server-side and owner access for meta_social_credentials" ON public.meta_social_credentials;
CREATE POLICY "Strict server-side and owner access for meta_social_credentials"
    ON public.meta_social_credentials
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = meta_social_credentials.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'admin')
              AND bm.is_active = TRUE
        ) OR (select public.is_superadmin())
    );

-- ------------------------------------------------------------------------------
-- SECTION 2: META SOCIAL AUTOMATION RULES
-- ------------------------------------------------------------------------------
-- Deterministic rules matching incoming keywords in DMs or Comments
CREATE TABLE IF NOT EXISTS public.meta_social_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.meta_social_connections(id) ON DELETE CASCADE,
    
    -- Channel targeting
    platform TEXT NOT NULL DEFAULT 'both' CHECK (platform IN ('facebook', 'instagram', 'both')),
    target_type TEXT NOT NULL DEFAULT 'both' CHECK (target_type IN ('message', 'comment', 'both')),
    
    rule_name TEXT NOT NULL,
    description TEXT,
    
    -- Deterministic Keyword matching (Unicode Tamil & English supported)
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    match_type TEXT NOT NULL DEFAULT 'contains'
        CHECK (match_type IN ('exact', 'contains', 'starts_with', 'any')),

    -- Predefined Response Actions
    -- 'reply_dm': Replies directly to user via DM
    -- 'reply_comment_public': Posts a public comment reply under their post comment
    -- 'reply_comment_private_dm': Sends a private DM to the user who commented (Meta Private Replies)
    -- 'both_public_and_private': Posts public reply AND sends private DM
    response_action TEXT NOT NULL DEFAULT 'reply_dm'
        CHECK (response_action IN (
            'reply_dm', 
            'reply_comment_public', 
            'reply_comment_private_dm', 
            'both_public_and_private'
        )),
    
    -- Predefined Messages
    predefined_reply TEXT NOT NULL,
    predefined_dm TEXT,            -- Optional secondary DM message when using 'both_public_and_private'

    priority INT NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    stop_processing_on_match BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_meta_social_rules_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_social_rules_eval 
    ON public.meta_social_rules(business_id, platform, target_type, is_active, priority ASC);

-- Tenant immutability trigger
DROP TRIGGER IF EXISTS trg_meta_social_rules_immutable_business_id ON public.meta_social_rules;
CREATE TRIGGER trg_meta_social_rules_immutable_business_id
    BEFORE UPDATE ON public.meta_social_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- Row Level Security (RLS)
ALTER TABLE public.meta_social_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_meta_social_rules" ON public.meta_social_rules;
CREATE POLICY "service_role_meta_social_rules"
    ON public.meta_social_rules
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant isolation for meta_social_rules select" ON public.meta_social_rules;
CREATE POLICY "Tenant isolation for meta_social_rules select"
    ON public.meta_social_rules
    FOR SELECT
    TO authenticated
    USING (
        (select public.check_user_business_access(business_id))
        OR (select public.is_superadmin())
    );

DROP POLICY IF EXISTS "Authorized members can manage meta_social_rules" ON public.meta_social_rules;
CREATE POLICY "Authorized members can manage meta_social_rules"
    ON public.meta_social_rules
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = meta_social_rules.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'admin')
        )
        OR (select public.is_superadmin())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = meta_social_rules.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'admin')
        )
        OR (select public.is_superadmin())
    );

-- ------------------------------------------------------------------------------
-- SECTION 3: META SOCIAL EVENTS LEDGER & AUDIT TRAIL
-- ------------------------------------------------------------------------------
-- Durable ledger of inbound messages & comments with deduplication and status
CREATE TABLE IF NOT EXISTS public.meta_social_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.meta_social_connections(id) ON DELETE CASCADE,
    
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
    event_type TEXT NOT NULL CHECK (event_type IN ('message', 'comment', 'mention')),
    
    -- Meta Identifiers
    meta_event_id TEXT NOT NULL,   -- Message ID (mid) or Comment ID
    sender_id TEXT NOT NULL,       -- PSID / IGSID
    sender_name TEXT,
    post_id TEXT,                  -- Target Post/Reel ID (for comments)
    comment_id TEXT,               -- Comment ID
    parent_comment_id TEXT,        -- If this is a reply to another comment

    -- Inbound content
    content TEXT NOT NULL,

    -- Processing & Automation Results
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processed', 'replied', 'failed', 'ignored')),
    matched_rule_id UUID REFERENCES public.meta_social_rules(id) ON DELETE SET NULL,
    reply_type TEXT CHECK (reply_type IN ('dm_reply', 'comment_public_reply', 'comment_private_dm', 'both', 'none')),
    reply_content TEXT,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_meta_social_events_id_business UNIQUE (id, business_id),
    CONSTRAINT uq_meta_social_events_dedup UNIQUE (business_id, meta_event_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_social_events_lookup 
    ON public.meta_social_events(business_id, platform, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_social_events_sender 
    ON public.meta_social_events(business_id, sender_id);

-- Row Level Security (RLS)
ALTER TABLE public.meta_social_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_meta_social_events" ON public.meta_social_events;
CREATE POLICY "service_role_meta_social_events"
    ON public.meta_social_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant isolation for meta_social_events select" ON public.meta_social_events;
CREATE POLICY "Tenant isolation for meta_social_events select"
    ON public.meta_social_events
    FOR SELECT
    TO authenticated
    USING (
        (select public.check_user_business_access(business_id))
        OR (select public.is_superadmin())
    );

-- ------------------------------------------------------------------------------
-- SECTION 4: ATOMIC ATTEMPT & INGESTION RPC (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
-- Atomically ingests an event, checks for duplicates, and looks up active rules.
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
    p_content TEXT
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
    -- 1. Locate active connection matching platform and account_id
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

    -- 2. Deduplication Check via meta_event_id
    IF EXISTS (
        SELECT 1 FROM public.meta_social_events
        WHERE business_id = v_connection.business_id
          AND meta_event_id = p_meta_event_id
    ) THEN
        RETURN jsonb_build_object(
            'status', 'duplicate',
            'business_id', v_connection.business_id,
            'connection_id', v_connection.id
        );
    END IF;

    -- 3. Ingest event
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
        'received'
    ) RETURNING id INTO v_event_id;

    -- Update last_webhook_at on connection
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
        'default_comment_reply', v_connection.default_comment_reply
    );
END;
$$;

-- Revoke default public execution privileges and restrict to authorized roles
REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
