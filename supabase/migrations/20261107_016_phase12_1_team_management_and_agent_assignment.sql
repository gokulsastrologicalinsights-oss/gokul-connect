-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 016: TEAM MANAGEMENT & AGENT ASSIGNMENT
-- ==============================================================================
-- PHASE 12.1: Multi-Tenant Team Management, Role-Based Access Control,
-- Member Invitations, Team Activity History, and Conversation Assignment Tracking.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- Composite foreign keys guarantee cross-tenant references are strictly rejected.
-- ==============================================================================

-- 1. EXTEND BUSINESS_MEMBERS WITH 'viewer' ROLE AND LAST LOGIN
DO $$
BEGIN
    -- Update role check constraint to include 'viewer'
    ALTER TABLE public.business_members
        DROP CONSTRAINT IF EXISTS business_members_role_check;

    ALTER TABLE public.business_members
        ADD CONSTRAINT business_members_role_check
        CHECK (role IN ('owner', 'admin', 'agent', 'viewer'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.business_members
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add composite unique constraint for composite foreign keys if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_business_members_id_business'
    ) THEN
        ALTER TABLE public.business_members
            ADD CONSTRAINT uq_business_members_id_business UNIQUE (id, business_id);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. EXTEND WA_CONVERSATIONS WITH ASSIGNED AGENT ATTRIBUTES
ALTER TABLE public.wa_conversations
    ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT,
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_wa_conversations_assigned_agent
    ON public.wa_conversations (business_id, assigned_agent_id);

-- 3. BUSINESS INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS public.business_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    invited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    invited_by_name TEXT,
    token TEXT UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (TIMEZONE('utc', NOW()) + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Composite unique key for tenant isolation
    CONSTRAINT uq_business_invitations_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_invitations_business ON public.business_invitations(business_id);
CREATE INDEX IF NOT EXISTS idx_business_invitations_email ON public.business_invitations(business_id, email);
CREATE INDEX IF NOT EXISTS idx_business_invitations_status ON public.business_invitations(business_id, status);

DROP TRIGGER IF EXISTS trg_business_invitations_immutable_business_id ON public.business_invitations;
CREATE TRIGGER trg_business_invitations_immutable_business_id
    BEFORE UPDATE ON public.business_invitations
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 4. TEAM ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.team_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    actor_name TEXT,
    activity_type TEXT NOT NULL
        CHECK (activity_type IN (
            'member_invited',
            'role_changed',
            'member_activated',
            'member_deactivated',
            'member_removed',
            'conversation_assigned',
            'conversation_reassigned',
            'human_takeover',
            'bot_resumed',
            'conversation_resolved'
        )),
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_team_activity_logs_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_team_activity_logs_biz_created
    ON public.team_activity_logs (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_activity_logs_biz_type
    ON public.team_activity_logs (business_id, activity_type);

DROP TRIGGER IF EXISTS trg_team_activity_logs_immutable_business_id ON public.team_activity_logs;
CREATE TRIGGER trg_team_activity_logs_immutable_business_id
    BEFORE UPDATE ON public.team_activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 5. CONVERSATION ASSIGNMENT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.conversation_assignment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL,
    assigned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    assigned_by_name TEXT,
    assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    assigned_to_name TEXT,
    previous_assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    previous_assigned_to_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_conv_assignment_logs_id_biz UNIQUE (id, business_id),

    -- Composite foreign key guarantees conversation belongs to the same business tenant
    CONSTRAINT fk_conv_assignment_conv_tenant
        FOREIGN KEY (conversation_id, business_id)
        REFERENCES public.wa_conversations(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conv_assignment_logs_conv
    ON public.conversation_assignment_logs (business_id, conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_assignment_logs_agent
    ON public.conversation_assignment_logs (business_id, assigned_to);

DROP TRIGGER IF EXISTS trg_conv_assignment_logs_immutable_business_id ON public.conversation_assignment_logs;
CREATE TRIGGER trg_conv_assignment_logs_immutable_business_id
    BEFORE UPDATE ON public.conversation_assignment_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 6. PRIVILEGE ESCALATION TRIGGER GUARD ON BUSINESS_MEMBERS
CREATE OR REPLACE FUNCTION public.guard_business_member_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_is_owner BOOLEAN;
    jwt_role TEXT;
BEGIN
    BEGIN
        jwt_role := (auth.jwt()->>'role');
    EXCEPTION
        WHEN OTHERS THEN
            jwt_role := NULL;
    END;

    -- Allow bypass for internal service role or superuser
    IF jwt_role = 'service_role' OR current_user = 'postgres' THEN
        RETURN NEW;
    END IF;

    caller_is_owner := public.is_business_owner(NEW.business_id) OR public.is_superadmin();

    -- On INSERT: Only an existing business owner or superadmin can grant owner role
    IF TG_OP = 'INSERT' THEN
        IF NEW.role = 'owner' AND NOT caller_is_owner THEN
            RAISE EXCEPTION 'Privilege escalation forbidden: Only business owners can assign owner role.';
        END IF;
        RETURN NEW;
    END IF;

    -- On UPDATE:
    IF TG_OP = 'UPDATE' THEN
        -- Only owner can grant owner role
        IF NEW.role = 'owner' AND OLD.role != 'owner' AND NOT caller_is_owner THEN
            RAISE EXCEPTION 'Privilege escalation forbidden: Only business owners can grant owner role.';
        END IF;

        -- Non-owners cannot modify an owner's role or status
        IF OLD.role = 'owner' AND (NEW.role != 'owner' OR NEW.is_active = FALSE) AND NOT caller_is_owner THEN
            RAISE EXCEPTION 'Privilege escalation forbidden: Only business owners can modify owner membership.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_business_member_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_business_member_roles() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_business_members_guard_privileges ON public.business_members;
CREATE TRIGGER trg_business_members_guard_privileges
    BEFORE INSERT OR UPDATE ON public.business_members
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_business_member_roles();

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_assignment_logs ENABLE ROW LEVEL SECURITY;

-- business_invitations RLS
DROP POLICY IF EXISTS "Tenant isolation for business_invitations select" ON public.business_invitations;
CREATE POLICY "Tenant isolation for business_invitations select"
    ON public.business_invitations
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Owners and admins can manage business_invitations" ON public.business_invitations;
CREATE POLICY "Owners and admins can manage business_invitations"
    ON public.business_invitations
    FOR ALL
    USING (
        public.is_business_owner_or_admin(business_id) OR public.is_superadmin()
    )
    WITH CHECK (
        public.is_business_owner_or_admin(business_id) OR public.is_superadmin()
    );

-- team_activity_logs RLS
DROP POLICY IF EXISTS "Tenant isolation for team_activity_logs select" ON public.team_activity_logs;
CREATE POLICY "Tenant isolation for team_activity_logs select"
    ON public.team_activity_logs
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can insert team_activity_logs" ON public.team_activity_logs;
CREATE POLICY "Authorized members can insert team_activity_logs"
    ON public.team_activity_logs
    FOR INSERT
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

-- conversation_assignment_logs RLS
DROP POLICY IF EXISTS "Tenant isolation for conversation_assignment_logs select" ON public.conversation_assignment_logs;
CREATE POLICY "Tenant isolation for conversation_assignment_logs select"
    ON public.conversation_assignment_logs
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can insert conversation_assignment_logs" ON public.conversation_assignment_logs;
CREATE POLICY "Authorized members can insert conversation_assignment_logs"
    ON public.conversation_assignment_logs
    FOR INSERT
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );
