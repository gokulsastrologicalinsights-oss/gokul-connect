-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 002: WHATSAPP CONNECTIONS & BUSINESS SETTINGS
-- ==============================================================================
-- PHASE 2 & 2.2: Dedicated WhatsApp connection manager and tenant-isolated settings.
-- To be applied to the NEW DEDICATED Supabase project when provisioned.
--
-- IMPORTANT SAFETY NOTICE:
-- DO NOT APPLY TO PREVIOUS / EXISTING SUPABASE PROJECTS.
-- DO NOT EXECUTE UNTIL NEW DEDICATED SUPABASE PROJECT IS CONFIGURED.
-- ==============================================================================

-- 1. WHATSAPP CONNECTIONS TABLE
-- Represents individual WhatsApp Cloud API numbers assigned to a business.
-- Strict tenant isolation: every connection belongs to exactly one business_id.
CREATE TABLE IF NOT EXISTS public.wa_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    phone_number_id TEXT NOT NULL UNIQUE,
    waba_id TEXT NOT NULL,
    
    -- Credential Reference: Pointers to vault/encrypted secret storage.
    -- NEVER STORE PLAIN-TEXT ACCESS TOKENS IN THIS COLUMN.
    credential_ref TEXT NOT NULL,
    
    -- Operational Status
    connection_status TEXT NOT NULL DEFAULT 'setup_required'
        CHECK (connection_status IN ('connected', 'disconnected', 'setup_required', 'error')),
    webhook_status TEXT NOT NULL DEFAULT 'unconfigured'
        CHECK (webhook_status IN ('active', 'pending', 'unconfigured', 'error')),
    quality_rating TEXT DEFAULT 'UNKNOWN'
        CHECK (quality_rating IN ('GREEN', 'YELLOW', 'RED', 'UNKNOWN')),
    
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    
    -- Health & Activity Timestamps
    last_connected_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Composite unique constraint required for business-scoped composite foreign keys
    CONSTRAINT uq_wa_connections_id_business UNIQUE (id, business_id)
);

-- Indexing for high-performance tenant-isolated queries
CREATE INDEX IF NOT EXISTS idx_wa_connections_business_id ON public.wa_connections(business_id);
CREATE INDEX IF NOT EXISTS idx_wa_connections_phone_number_id ON public.wa_connections(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_wa_connections_status ON public.wa_connections(business_id, connection_status);

-- Tenant immutability trigger for wa_connections: forbids changing business_id
CREATE OR REPLACE FUNCTION public.prevent_wa_connection_tenant_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
        RAISE EXCEPTION 'Tenant reassignment forbidden: business_id on wa_connections cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_connections_immutable_business_id ON public.wa_connections;
CREATE TRIGGER trg_wa_connections_immutable_business_id
    BEFORE UPDATE ON public.wa_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_wa_connection_tenant_reassignment();

-- 2. BUSINESS SETTINGS TABLE
-- Tenant-isolated configuration preferences for each business.
CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    business_info TEXT,
    logo_placeholder TEXT,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    default_language TEXT NOT NULL DEFAULT 'ta,en',
    
    -- Notification Preferences
    notification_connection_drops BOOLEAN NOT NULL DEFAULT TRUE,
    notification_unread_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    notification_daily_digest BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- WhatsApp Channel Routing Preferences
    default_connection_id UUID,
    webhook_retry_policy TEXT NOT NULL DEFAULT 'standard'
        CHECK (webhook_retry_policy IN ('standard', 'aggressive', 'relaxed')),
    opt_out_keywords TEXT NOT NULL DEFAULT 'STOP,UNSUBSCRIBE,QUIT,நிறுத்து',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- COMPOSITE FOREIGN KEY: Guarantees default_connection_id MUST belong to the SAME business_id
    -- Column-specific SET NULL (PostgreSQL 15+): Nullifies ONLY default_connection_id on deletion,
    -- preserving the NOT NULL immutable business_id.
    CONSTRAINT fk_business_settings_default_connection
        FOREIGN KEY (default_connection_id, business_id)
        REFERENCES public.wa_connections(id, business_id)
        ON DELETE SET NULL (default_connection_id)
);

CREATE INDEX IF NOT EXISTS idx_business_settings_business_id ON public.business_settings(business_id);

-- Tenant immutability trigger for business_settings: forbids changing business_id
CREATE OR REPLACE FUNCTION public.prevent_business_settings_tenant_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
        RAISE EXCEPTION 'Tenant reassignment forbidden: business_id on business_settings cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_settings_immutable_business_id ON public.business_settings;
CREATE TRIGGER trg_business_settings_immutable_business_id
    BEFORE UPDATE ON public.business_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_business_settings_tenant_reassignment();

-- 3. ROW LEVEL SECURITY (RLS) FOR wa_connections
ALTER TABLE public.wa_connections ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can only view connections belonging to authorized businesses
CREATE POLICY "Users can only view connections for authorized businesses"
    ON public.wa_connections
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

-- INSERT Policy: Only authorized business owners and admins can add connections
CREATE POLICY "Owners and admins can add WhatsApp connections"
    ON public.wa_connections
    FOR INSERT
    WITH CHECK (
        public.is_business_owner_or_admin(business_id) OR public.is_superadmin()
    );

-- UPDATE Policy: Safe PostgreSQL RLS check without self-referential recursion.
-- Both USING and WITH CHECK ensure user is owner/admin of the connection's business_id.
-- Immutability of business_id is strictly guaranteed by trg_wa_connections_immutable_business_id.
CREATE POLICY "Owners and admins can update WhatsApp connections"
    ON public.wa_connections
    FOR UPDATE
    USING (
        public.is_business_owner_or_admin(business_id) OR public.is_superadmin()
    )
    WITH CHECK (
        public.is_business_owner_or_admin(business_id) OR public.is_superadmin()
    );

-- DELETE Policy: Only authorized business owners and admins can remove connections
CREATE POLICY "Owners and admins can delete WhatsApp connections"
    ON public.wa_connections
    FOR DELETE
    USING (
        public.is_business_owner_or_admin(business_id) OR public.is_superadmin()
    );

-- 4. ROW LEVEL SECURITY (RLS) FOR business_settings
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Users can view settings of their authorized business
CREATE POLICY "Users can view settings for their authorized business"
    ON public.business_settings
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

-- UPDATE Policy: Owners and admins can update business settings
CREATE POLICY "Owners and admins can update business settings"
    ON public.business_settings
    FOR UPDATE
    USING (
        public.is_business_owner_or_admin(business_id) OR public.is_superadmin()
    )
    WITH CHECK (
        public.is_business_owner_or_admin(business_id) OR public.is_superadmin()
    );

-- 5. INITIAL SEED FOR BUSINESS SETTINGS
INSERT INTO public.business_settings (business_id, display_name, business_info, logo_placeholder, timezone, default_language)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Gokul''s Astrological Insights',
    'Astrology consultations, Horoscope analysis, Vedic & KP enquiries, Consultation bookings, and Payment follow-ups.',
    'GA',
    'Asia/Kolkata',
    'ta,en'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Gokul Vivaham',
    'Tamil matrimony enquiries, New registrations, Membership verification, Profile enquiries, and Payment follow-ups.',
    'GV',
    'Asia/Kolkata',
    'ta,en'
  )
ON CONFLICT (business_id) DO NOTHING;
