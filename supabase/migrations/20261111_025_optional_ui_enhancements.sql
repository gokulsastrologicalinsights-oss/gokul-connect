-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 025: OPTIONAL UI ENHANCEMENTS
-- ==============================================================================
-- Completes remaining UX & schema foundations from REMAINING_DEVELOPMENT_ROADMAP.md:
-- 1. Quick Replies / Canned Responses (`public.wa_canned_responses`) with RLS,
--    tenant immutability trigger, covering indexes, and business-scoped seeds.
-- 2. Custom Business Logo URL column (`logo_url`) on `public.business_settings`.
-- 3. Realtime Publication enablement on `public.crm_follow_up_reminders` for
--    instant NotificationBell push updates.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- SECTION 1: QUICK REPLIES / CANNED RESPONSES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_canned_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    shortcut TEXT NOT NULL
        CHECK (char_length(trim(shortcut)) >= 1 AND char_length(shortcut) <= 64),
    title TEXT NOT NULL
        CHECK (char_length(trim(title)) >= 1 AND char_length(title) <= 120),
    content TEXT NOT NULL
        CHECK (char_length(trim(content)) >= 1 AND char_length(content) <= 4096),
    category TEXT NOT NULL DEFAULT 'general'
        CHECK (char_length(trim(category)) >= 1 AND char_length(category) <= 50),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_wa_canned_responses_biz_shortcut UNIQUE (business_id, shortcut),
    CONSTRAINT uq_wa_canned_responses_id_business UNIQUE (id, business_id)
);

-- Covering indexes for tenant lookup, category filtering, and FK traversal
CREATE INDEX IF NOT EXISTS idx_wa_canned_responses_biz_cat
    ON public.wa_canned_responses (business_id, category, shortcut);

CREATE INDEX IF NOT EXISTS idx_wa_canned_responses_created_by
    ON public.wa_canned_responses (created_by)
    WHERE created_by IS NOT NULL;

-- Tenant immutability trigger: forbids reassigning business_id on update
DROP TRIGGER IF EXISTS trg_wa_canned_responses_immutable_business_id ON public.wa_canned_responses;
CREATE TRIGGER trg_wa_canned_responses_immutable_business_id
    BEFORE UPDATE ON public.wa_canned_responses
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- Row Level Security (RLS)
ALTER TABLE public.wa_canned_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_wa_canned_responses" ON public.wa_canned_responses;
CREATE POLICY "service_role_wa_canned_responses"
    ON public.wa_canned_responses
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant isolation for wa_canned_responses select" ON public.wa_canned_responses;
CREATE POLICY "Tenant isolation for wa_canned_responses select"
    ON public.wa_canned_responses
    FOR SELECT
    TO authenticated
    USING (
        (select public.check_user_business_access(business_id))
        OR (select public.is_superadmin())
    );

DROP POLICY IF EXISTS "Authorized members can insert wa_canned_responses" ON public.wa_canned_responses;
CREATE POLICY "Authorized members can insert wa_canned_responses"
    ON public.wa_canned_responses
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = wa_canned_responses.business_id
              AND bm.user_id = (select auth.uid())
              AND bm.is_active = TRUE
              AND bm.role IN ('owner', 'admin', 'agent')
        )
        OR (select public.is_superadmin())
    );

DROP POLICY IF EXISTS "Authorized members can update wa_canned_responses" ON public.wa_canned_responses;
CREATE POLICY "Authorized members can update wa_canned_responses"
    ON public.wa_canned_responses
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = wa_canned_responses.business_id
              AND bm.user_id = (select auth.uid())
              AND bm.is_active = TRUE
              AND bm.role IN ('owner', 'admin', 'agent')
        )
        OR (select public.is_superadmin())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = wa_canned_responses.business_id
              AND bm.user_id = (select auth.uid())
              AND bm.is_active = TRUE
              AND bm.role IN ('owner', 'admin', 'agent')
        )
        OR (select public.is_superadmin())
    );

DROP POLICY IF EXISTS "Authorized members can delete wa_canned_responses" ON public.wa_canned_responses;
CREATE POLICY "Authorized members can delete wa_canned_responses"
    ON public.wa_canned_responses
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = wa_canned_responses.business_id
              AND bm.user_id = (select auth.uid())
              AND bm.is_active = TRUE
              AND bm.role IN ('owner', 'admin', 'agent')
        )
        OR (select public.is_superadmin())
    );

-- Safe initial default canned responses per business (idempotent)
INSERT INTO public.wa_canned_responses (business_id, shortcut, title, content, category)
SELECT b.id, s.shortcut, s.title, s.content, s.category
FROM public.businesses b
CROSS JOIN (
    VALUES
        ('greeting', 'Namaste Greeting', 'Namaste! Welcome to Gokul''s Astrological Insights. How may we assist you with your horoscope or consultation today?', 'general'),
        ('pricing', 'Consultation Fee Details', 'Our Vedic & KP Astrology consultation fee is Rs. 1,500 (detailed chart reading + remedies). Reply to confirm your preferred slot!', 'pricing'),
        ('bank', 'Payment / UPI Details', 'You can complete your consultation payment via UPI or Bank Transfer. Please share the payment screenshot here once completed for immediate confirmation.', 'billing'),
        ('hours', 'Consultation Hours', 'Our consultation hours are Monday to Saturday, 9:30 AM - 7:00 PM IST. Let us know your preferred time slot.', 'info'),
        ('birthdetails', 'Required Birth Details', E'To prepare your birth chart accurately, please share:\n1. Full Name\n2. Date of Birth\n3. Exact Time of Birth (AM/PM)\n4. Place of Birth', 'intake')
) AS s(shortcut, title, content, category)
WHERE b.id = '11111111-1111-1111-1111-111111111111'
ON CONFLICT (business_id, shortcut) DO NOTHING;

INSERT INTO public.wa_canned_responses (business_id, shortcut, title, content, category)
SELECT b.id, s.shortcut, s.title, s.content, s.category
FROM public.businesses b
CROSS JOIN (
    VALUES
        ('greeting', 'Vanakkam Greeting', 'Vanakkam! Welcome to Gokul Vivaham Tamil Matrimony. Please let us know if you are looking for a Bride or Groom profile.', 'general'),
        ('plans', 'Membership Plans', 'Gokul Vivaham offers Silver, Gold, and Diamond assisted matchmaking plans with verified horoscope matching. Would you like our coordinator to call and explain?', 'pricing'),
        ('register', 'New Profile Registration', E'To register a new matrimony profile, please share:\n1. Candidate Name & Gender\n2. Date, Time & Place of Birth\n3. Education & Occupation\n4. Preferred Star / Community', 'intake'),
        ('verify', 'Profile Verification Steps', 'Thank you for submitting your profile! Our verification team reviews ID proof and family details within 24 hours before activating your profile.', 'verification'),
        ('hours', 'Member Desk Hours', 'Gokul Vivaham Member Desk is open Monday to Saturday, 9:30 AM - 6:30 PM IST.', 'info')
) AS s(shortcut, title, content, category)
WHERE b.id = '22222222-2222-2222-2222-222222222222'
ON CONFLICT (business_id, shortcut) DO NOTHING;

-- ------------------------------------------------------------------------------
-- SECTION 2: BUSINESS LOGO URL COLUMN ON BUSINESS_SETTINGS
-- ------------------------------------------------------------------------------
ALTER TABLE public.business_settings
    ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ------------------------------------------------------------------------------
-- SECTION 3: ENABLE SUPABASE REALTIME FOR CRM FOLLOW-UP REMINDERS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_follow_up_reminders;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END $$;
