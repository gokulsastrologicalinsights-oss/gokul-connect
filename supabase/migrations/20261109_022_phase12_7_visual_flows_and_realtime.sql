-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 022: VISUAL FLOW BUILDER & REALTIME
-- ==============================================================================
-- PHASE 12.7: Drag-and-drop Visual Flow Builder persistence, node/edge schema,
-- multi-tenant security policies, and Supabase Realtime publication enablement.
--
-- Strict multi-tenant isolation: every visual flow is bound to business_id.
-- Cross-tenant access is strictly denied by Row Level Security (RLS).
-- ==============================================================================

-- 1. VISUAL FLOWS TABLE
CREATE TABLE IF NOT EXISTS public.wa_visual_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_keyword TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    flow_type TEXT NOT NULL DEFAULT 'keyword' CHECK (flow_type IN ('keyword', 'intake', 'support', 'booking', 'marketing')),
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges JSONB NOT NULL DEFAULT '[]'::jsonb,
    viewport JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Composite unique key for composite foreign keys and tenant isolation
    CONSTRAINT uq_wa_visual_flows_id_business UNIQUE (id, business_id)
);

-- Indexing for fast tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_wa_visual_flows_business_id
    ON public.wa_visual_flows (business_id, is_active, updated_at DESC);

-- Tenant immutability trigger for wa_visual_flows
DROP TRIGGER IF EXISTS trg_wa_visual_flows_immutable_business_id ON public.wa_visual_flows;
CREATE TRIGGER trg_wa_visual_flows_immutable_business_id
    BEFORE UPDATE ON public.wa_visual_flows
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 2. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.wa_visual_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for wa_visual_flows select" ON public.wa_visual_flows;
CREATE POLICY "Tenant isolation for wa_visual_flows select"
    ON public.wa_visual_flows FOR SELECT
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can insert wa_visual_flows" ON public.wa_visual_flows;
CREATE POLICY "Authorized members can insert wa_visual_flows"
    ON public.wa_visual_flows FOR INSERT
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can update wa_visual_flows" ON public.wa_visual_flows;
CREATE POLICY "Authorized members can update wa_visual_flows"
    ON public.wa_visual_flows FOR UPDATE
    USING (public.check_user_business_access(business_id) OR public.is_superadmin())
    WITH CHECK (public.check_user_business_access(business_id) OR public.is_superadmin());

DROP POLICY IF EXISTS "Authorized members can delete wa_visual_flows" ON public.wa_visual_flows;
CREATE POLICY "Authorized members can delete wa_visual_flows"
    ON public.wa_visual_flows FOR DELETE
    USING (public.check_user_business_access(business_id) OR public.is_superadmin());

-- 3. ENABLE SUPABASE REALTIME PUBLICATION FOR LIVE MESSAGING & CONVERSATIONS
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_visual_flows;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END $$;
