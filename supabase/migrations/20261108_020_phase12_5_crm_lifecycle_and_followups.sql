-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 020: CRM LIFECYCLE & FOLLOW-UP MANAGEMENT
-- ==============================================================================
-- PHASE 12.5: Customer Lifecycle Stages, Lifecycle History, Follow-up Tasks,
-- Internal Reminders, and Multi-Tenant Stage Transitions.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- Composite foreign keys guarantee cross-tenant references are strictly rejected.
-- ==============================================================================

-- 1. CRM LIFECYCLE STAGES TABLE (CONFIGURABLE BUSINESS-SPECIFIC STAGES)
CREATE TABLE IF NOT EXISTS public.crm_lifecycle_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT 'indigo',
    sort_order INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_converted BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_crm_lifecycle_stages_biz_slug UNIQUE (business_id, slug),
    CONSTRAINT uq_crm_lifecycle_stages_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_lifecycle_stages_sort 
    ON public.crm_lifecycle_stages(business_id, sort_order ASC);

-- Tenant immutability trigger for crm_lifecycle_stages
DROP TRIGGER IF EXISTS trg_crm_lifecycle_stages_immutable_business_id ON public.crm_lifecycle_stages;
CREATE TRIGGER trg_crm_lifecycle_stages_immutable_business_id
    BEFORE UPDATE ON public.crm_lifecycle_stages
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 2. EXTEND WA_CONTACTS WITH LIFECYCLE & FOLLOW-UP ATTRIBUTES
ALTER TABLE public.wa_contacts
    ADD COLUMN IF NOT EXISTS lifecycle_stage_id UUID,
    ADD COLUMN IF NOT EXISTS lifecycle_stage_slug TEXT,
    ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

-- Composite foreign key for lifecycle stage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_wa_contacts_lifecycle_stage_tenant'
    ) THEN
        ALTER TABLE public.wa_contacts
            ADD CONSTRAINT fk_wa_contacts_lifecycle_stage_tenant
            FOREIGN KEY (lifecycle_stage_id, business_id)
            REFERENCES public.crm_lifecycle_stages(id, business_id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wa_contacts_lifecycle_stage
    ON public.wa_contacts(business_id, lifecycle_stage_slug);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_next_follow_up
    ON public.wa_contacts(business_id, next_follow_up_at ASC)
    WHERE next_follow_up_at IS NOT NULL;

-- 3. CONTACT LIFECYCLE HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.contact_lifecycle_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    changed_by_name TEXT NOT NULL DEFAULT 'System',
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Tenant isolation composite key
    CONSTRAINT uq_contact_lifecycle_history_id_business UNIQUE (id, business_id),

    -- Composite foreign key guarantees contact belongs to the exact same business tenant
    CONSTRAINT fk_contact_lifecycle_history_contact_tenant
        FOREIGN KEY (contact_id, business_id)
        REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contact_lifecycle_history_contact
    ON public.contact_lifecycle_history(business_id, contact_id, created_at DESC);

-- Tenant immutability trigger for contact_lifecycle_history
DROP TRIGGER IF EXISTS trg_contact_lifecycle_history_immutable_business_id ON public.contact_lifecycle_history;
CREATE TRIGGER trg_contact_lifecycle_history_immutable_business_id
    BEFORE UPDATE ON public.contact_lifecycle_history
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 4. CRM FOLLOW-UPS TABLE
CREATE TABLE IF NOT EXISTS public.crm_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    conversation_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    due_at TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    assigned_to_name TEXT,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    completed_by_name TEXT,
    completion_notes TEXT,
    rescheduled_at TIMESTAMPTZ,
    rescheduled_count INT NOT NULL DEFAULT 0,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    cancelled_by_name TEXT,
    cancellation_reason TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by_name TEXT DEFAULT 'Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Tenant isolation composite key
    CONSTRAINT uq_crm_follow_ups_id_business UNIQUE (id, business_id),

    -- Composite foreign keys
    CONSTRAINT fk_crm_follow_ups_contact_tenant
        FOREIGN KEY (contact_id, business_id)
        REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE,

    CONSTRAINT fk_crm_follow_ups_conversation_tenant
        FOREIGN KEY (conversation_id, business_id)
        REFERENCES public.wa_conversations(id, business_id) ON DELETE SET NULL
);

-- Indexes for follow-up dashboard and worker queries
CREATE INDEX IF NOT EXISTS idx_crm_follow_ups_due
    ON public.crm_follow_ups(business_id, status, due_at ASC);

CREATE INDEX IF NOT EXISTS idx_crm_follow_ups_assigned
    ON public.crm_follow_ups(business_id, assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_crm_follow_ups_contact
    ON public.crm_follow_ups(business_id, contact_id, created_at DESC);

-- Tenant immutability trigger for crm_follow_ups
DROP TRIGGER IF EXISTS trg_crm_follow_ups_immutable_business_id ON public.crm_follow_ups;
CREATE TRIGGER trg_crm_follow_ups_immutable_business_id
    BEFORE UPDATE ON public.crm_follow_ups
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 5. TRIGGER TO AUTOMATICALLY UPDATE WA_CONTACTS.NEXT_FOLLOW_UP_AT
CREATE OR REPLACE FUNCTION public.sync_contact_next_follow_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_contact_id UUID;
    v_business_id UUID;
    v_next_due TIMESTAMPTZ;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_contact_id := OLD.contact_id;
        v_business_id := OLD.business_id;
    ELSE
        v_contact_id := NEW.contact_id;
        v_business_id := NEW.business_id;
    END IF;

    -- Calculate earliest upcoming open/in_progress follow-up due_at
    SELECT MIN(due_at) INTO v_next_due
    FROM public.crm_follow_ups
    WHERE business_id = v_business_id
      AND contact_id = v_contact_id
      AND status IN ('open', 'in_progress');

    UPDATE public.wa_contacts
    SET next_follow_up_at = v_next_due,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = v_contact_id
      AND business_id = v_business_id;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_follow_ups_sync_next ON public.crm_follow_ups;
CREATE TRIGGER trg_crm_follow_ups_sync_next
    AFTER INSERT OR UPDATE OR DELETE ON public.crm_follow_ups
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_contact_next_follow_up();

-- 6. CRM FOLLOW-UP REMINDERS TABLE (INTERNAL TEAM REMINDERS)
CREATE TABLE IF NOT EXISTS public.crm_follow_up_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    follow_up_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL
        CHECK (reminder_type IN ('due_soon', 'overdue', 'escalation')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Unique reminder to prevent duplicates for same task, user and type
    CONSTRAINT uq_crm_follow_up_reminders_dedup UNIQUE (follow_up_id, user_id, reminder_type),
    CONSTRAINT uq_crm_follow_up_reminders_id_business UNIQUE (id, business_id),

    -- Composite foreign key
    CONSTRAINT fk_crm_follow_up_reminders_followup_tenant
        FOREIGN KEY (follow_up_id, business_id)
        REFERENCES public.crm_follow_ups(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_follow_up_reminders_user
    ON public.crm_follow_up_reminders(business_id, user_id, is_read, created_at DESC);

-- Tenant immutability trigger for crm_follow_up_reminders
DROP TRIGGER IF EXISTS trg_crm_follow_up_reminders_immutable_business_id ON public.crm_follow_up_reminders;
CREATE TRIGGER trg_crm_follow_up_reminders_immutable_business_id
    BEFORE UPDATE ON public.crm_follow_up_reminders
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.crm_lifecycle_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lifecycle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_follow_up_reminders ENABLE ROW LEVEL SECURITY;

-- crm_lifecycle_stages policies
DROP POLICY IF EXISTS "Tenant isolation for crm_lifecycle_stages select" ON public.crm_lifecycle_stages;
CREATE POLICY "Tenant isolation for crm_lifecycle_stages select"
    ON public.crm_lifecycle_stages FOR SELECT
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can insert crm_lifecycle_stages" ON public.crm_lifecycle_stages;
CREATE POLICY "Authorized members can insert crm_lifecycle_stages"
    ON public.crm_lifecycle_stages FOR INSERT
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can update crm_lifecycle_stages" ON public.crm_lifecycle_stages;
CREATE POLICY "Authorized members can update crm_lifecycle_stages"
    ON public.crm_lifecycle_stages FOR UPDATE
    USING (public.check_user_business_access(business_id) OR public.is_superadmin())
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can delete crm_lifecycle_stages" ON public.crm_lifecycle_stages;
CREATE POLICY "Authorized members can delete crm_lifecycle_stages"
    ON public.crm_lifecycle_stages FOR DELETE
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());

-- contact_lifecycle_history policies
DROP POLICY IF EXISTS "Tenant isolation for contact_lifecycle_history select" ON public.contact_lifecycle_history;
CREATE POLICY "Tenant isolation for contact_lifecycle_history select"
    ON public.contact_lifecycle_history FOR SELECT
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can insert contact_lifecycle_history" ON public.contact_lifecycle_history;
CREATE POLICY "Authorized members can insert contact_lifecycle_history"
    ON public.contact_lifecycle_history FOR INSERT
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

-- crm_follow_ups policies
DROP POLICY IF EXISTS "Tenant isolation for crm_follow_ups select" ON public.crm_follow_ups;
CREATE POLICY "Tenant isolation for crm_follow_ups select"
    ON public.crm_follow_ups FOR SELECT
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can insert crm_follow_ups" ON public.crm_follow_ups;
CREATE POLICY "Authorized members can insert crm_follow_ups"
    ON public.crm_follow_ups FOR INSERT
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can update crm_follow_ups" ON public.crm_follow_ups;
CREATE POLICY "Authorized members can update crm_follow_ups"
    ON public.crm_follow_ups FOR UPDATE
    USING (public.check_user_business_access(business_id) OR public.is_superadmin())
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can delete crm_follow_ups" ON public.crm_follow_ups;
CREATE POLICY "Authorized members can delete crm_follow_ups"
    ON public.crm_follow_ups FOR DELETE
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());

-- crm_follow_up_reminders policies
DROP POLICY IF EXISTS "Tenant isolation for crm_follow_up_reminders select" ON public.crm_follow_up_reminders;
CREATE POLICY "Tenant isolation for crm_follow_up_reminders select"
    ON public.crm_follow_up_reminders FOR SELECT
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can insert crm_follow_up_reminders" ON public.crm_follow_up_reminders;
CREATE POLICY "Authorized members can insert crm_follow_up_reminders"
    ON public.crm_follow_up_reminders FOR INSERT
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can update crm_follow_up_reminders" ON public.crm_follow_up_reminders;
CREATE POLICY "Authorized members can update crm_follow_up_reminders"
    ON public.crm_follow_up_reminders FOR UPDATE
    USING (public.check_user_business_access(business_id) OR public.is_superadmin())
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can delete crm_follow_up_reminders" ON public.crm_follow_up_reminders;
CREATE POLICY "Authorized members can delete crm_follow_up_reminders"
    ON public.crm_follow_up_reminders FOR DELETE
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());
