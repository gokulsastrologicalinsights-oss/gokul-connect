-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 015: WHATSAPP TEMPLATE MANAGEMENT SCHEMA
-- ==============================================================================
-- PHASE 11: Message Template Library, Components, Meta Sync & Draft Management.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- Composite foreign keys guarantee cross-tenant references are strictly rejected.
-- ==============================================================================

-- 1. ADD PHASE 11 COLUMNS TO wa_message_templates
ALTER TABLE public.wa_message_templates
    ADD COLUMN IF NOT EXISTS meta_template_id TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 2. UPDATE STATUS CHECK CONSTRAINT TO SUPPORT DRAFT & ARCHIVED STATUSES
-- Drop old status check constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'wa_message_templates_status_check'
          AND conrelid = 'public.wa_message_templates'::regclass
    ) THEN
        ALTER TABLE public.wa_message_templates DROP CONSTRAINT wa_message_templates_status_check;
    END IF;
END $$;

ALTER TABLE public.wa_message_templates
    ADD CONSTRAINT wa_message_templates_status_check
    CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'DRAFT', 'ARCHIVED'));

-- 3. ENSURE COMPOSITE UNIQUE KEY FOR COMPOSITE FOREIGN KEYS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_wa_message_templates_id_business'
          AND conrelid = 'public.wa_message_templates'::regclass
    ) THEN
        ALTER TABLE public.wa_message_templates
            ADD CONSTRAINT uq_wa_message_templates_id_business UNIQUE (id, business_id);
    END IF;
END $$;

-- 4. PERFORMANCE & TENANT ISOLATION COVERING INDEXES
CREATE INDEX IF NOT EXISTS idx_wa_message_templates_business_status
    ON public.wa_message_templates (business_id, status);

CREATE INDEX IF NOT EXISTS idx_wa_message_templates_meta_id
    ON public.wa_message_templates (business_id, meta_template_id);

CREATE INDEX IF NOT EXISTS idx_wa_message_templates_archived
    ON public.wa_message_templates (business_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_wa_message_templates_category
    ON public.wa_message_templates (business_id, category);

-- 5. RLS POLICY VERIFICATION
-- wa_message_templates RLS is enforced via check_user_business_access(business_id)
ALTER TABLE public.wa_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for wa_message_templates" ON public.wa_message_templates;
CREATE POLICY "Tenant isolation for wa_message_templates"
    ON public.wa_message_templates
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));
