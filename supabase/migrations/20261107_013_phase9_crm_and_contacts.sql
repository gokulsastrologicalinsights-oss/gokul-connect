-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 013: CRM & CONTACT MANAGEMENT SCHEMA
-- ==============================================================================
-- PHASE 9: CRM, Contacts, Business-Specific Categories, Notes, Saved Segments,
-- and Contact Activity Timeline.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- Composite foreign keys guarantee cross-tenant references are strictly rejected.
-- ==============================================================================

-- 1. EXTEND WA_CONTACTS WITH CRM ATTRIBUTES
ALTER TABLE public.wa_contacts
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'lead'
        CHECK (status IN ('lead', 'active', 'inactive', 'customer')),
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'whatsapp'
        CHECK (source IN ('whatsapp', 'website', 'referral', 'walk_in', 'csv_import', 'manual', 'other')),
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Covering and search indexes for CRM queries
CREATE INDEX IF NOT EXISTS idx_wa_contacts_status ON public.wa_contacts(business_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_category ON public.wa_contacts(business_id, category);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_source ON public.wa_contacts(business_id, source);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_archived ON public.wa_contacts(business_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_email ON public.wa_contacts(business_id, email);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_tags ON public.wa_contacts USING gin(tags);

-- 2. CRM CATEGORIES TABLE (CONFIGURABLE BUSINESS-SPECIFIC CATEGORIES)
CREATE TABLE IF NOT EXISTS public.crm_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'indigo',
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_crm_categories_biz_slug UNIQUE (business_id, slug),
    CONSTRAINT uq_crm_categories_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_categories_business_id ON public.crm_categories(business_id, sort_order ASC);

DROP TRIGGER IF EXISTS trg_crm_categories_immutable_business_id ON public.crm_categories;
CREATE TRIGGER trg_crm_categories_immutable_business_id
    BEFORE UPDATE ON public.crm_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 3. CRM SEGMENTS TABLE (SAVED CONTACT FILTER SEGMENTS)
CREATE TABLE IF NOT EXISTS public.crm_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_crm_segments_biz_name UNIQUE (business_id, name),
    CONSTRAINT uq_crm_segments_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_segments_business_id ON public.crm_segments(business_id);

DROP TRIGGER IF EXISTS trg_crm_segments_immutable_business_id ON public.crm_segments;
CREATE TRIGGER trg_crm_segments_immutable_business_id
    BEFORE UPDATE ON public.crm_segments
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 4. CONTACT NOTES TABLE
CREATE TABLE IF NOT EXISTS public.contact_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    author_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT 'Staff',
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- COMPOSITE FOREIGN KEY: Contact must belong to the exact same business
    CONSTRAINT fk_contact_notes_contact_tenant
        FOREIGN KEY (contact_id, business_id)
        REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE,
    CONSTRAINT uq_contact_notes_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON public.contact_notes(business_id, contact_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_contact_notes_immutable_business_id ON public.contact_notes;
CREATE TRIGGER trg_contact_notes_immutable_business_id
    BEFORE UPDATE ON public.contact_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 5. CONTACT ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.contact_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    activity_type TEXT NOT NULL
        CHECK (activity_type IN (
            'created',
            'updated',
            'status_changed',
            'category_changed',
            'tag_added',
            'tag_removed',
            'note_added',
            'archived',
            'unarchived',
            'inbound_message',
            'outbound_message',
            'opt_out',
            'opt_in',
            'imported'
        )),
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- COMPOSITE FOREIGN KEY: Contact must belong to the exact same business
    CONSTRAINT fk_contact_activity_logs_contact_tenant
        FOREIGN KEY (contact_id, business_id)
        REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE,
    CONSTRAINT uq_contact_activity_logs_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_activity_logs_contact ON public.contact_activity_logs(business_id, contact_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_contact_activity_logs_immutable_business_id ON public.contact_activity_logs;
CREATE TRIGGER trg_contact_activity_logs_immutable_business_id
    BEFORE UPDATE ON public.contact_activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.crm_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_activity_logs ENABLE ROW LEVEL SECURITY;

-- crm_categories RLS
DROP POLICY IF EXISTS "Tenant isolation for crm_categories" ON public.crm_categories;
CREATE POLICY "Tenant isolation for crm_categories"
    ON public.crm_categories
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- crm_segments RLS
DROP POLICY IF EXISTS "Tenant isolation for crm_segments" ON public.crm_segments;
CREATE POLICY "Tenant isolation for crm_segments"
    ON public.crm_segments
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- contact_notes RLS
DROP POLICY IF EXISTS "Tenant isolation for contact_notes" ON public.contact_notes;
CREATE POLICY "Tenant isolation for contact_notes"
    ON public.contact_notes
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- contact_activity_logs RLS
DROP POLICY IF EXISTS "Tenant isolation for contact_activity_logs" ON public.contact_activity_logs;
CREATE POLICY "Tenant isolation for contact_activity_logs"
    ON public.contact_activity_logs
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- 7. SEED DEFAULT BUSINESS-SPECIFIC CATEGORIES
-- Astrology Categories (11111111-1111-1111-1111-111111111111)
INSERT INTO public.crm_categories (business_id, name, slug, color, description, sort_order, is_default)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'New Enquiry', 'new-enquiry', 'blue', 'New incoming enquiry awaiting initial assessment', 1, TRUE),
    ('11111111-1111-1111-1111-111111111111', 'Astrology Consultation', 'astrology-consultation', 'purple', 'Personal astrology horoscope reading and consultation', 2, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Horoscope Matching', 'horoscope-matching', 'amber', 'Kundali / Porutham compatibility matching', 3, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Numerology', 'numerology', 'emerald', 'Name and date-of-birth numerology analysis', 4, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Existing Customer', 'existing-customer', 'teal', 'Verified repeat astrology customer', 5, FALSE),
    ('11111111-1111-1111-1111-111111111111', 'Follow-up Required', 'follow-up-required', 'rose', 'Pending follow-up or report delivery', 6, FALSE)
ON CONFLICT (business_id, slug) DO NOTHING;

-- Vivaham Categories (22222222-2222-2222-2222-222222222222)
INSERT INTO public.crm_categories (business_id, name, slug, color, description, sort_order, is_default)
VALUES
    ('22222222-2222-2222-2222-222222222222', 'New Registration', 'new-registration', 'blue', 'Newly submitted matrimony registration', 1, TRUE),
    ('22222222-2222-2222-2222-222222222222', 'Groom', 'groom', 'sky', 'Groom matrimony profile candidate', 2, FALSE),
    ('22222222-2222-2222-2222-222222222222', 'Bride', 'bride', 'pink', 'Bride matrimony profile candidate', 3, FALSE),
    ('22222222-2222-2222-2222-222222222222', 'Membership Enquiry', 'membership-enquiry', 'amber', 'Matrimony plan or membership fee enquiry', 4, FALSE),
    ('22222222-2222-2222-2222-222222222222', 'Active Member', 'active-member', 'emerald', 'Active paid matrimonial service member', 5, FALSE),
    ('22222222-2222-2222-2222-222222222222', 'Follow-up Required', 'follow-up-required', 'rose', 'Pending document verification or family contact', 6, FALSE)
ON CONFLICT (business_id, slug) DO NOTHING;
