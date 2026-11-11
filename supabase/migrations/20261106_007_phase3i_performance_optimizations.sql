-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 007: PERFORMANCE & RLS OPTIMIZATION (PHASE 3I)
-- ==============================================================================
-- Implements audit remediations from docs/SUPABASE_PERFORMANCE_COST_AUDIT.md:
-- 1. Covering indexes for unindexed foreign keys (wa_messages, wa_webhook_events, wa_processing_jobs).
-- 2. Cleanup of redundant index on business_settings.business_id.
-- 3. Optimization of auth.uid() in RLS policies to (select auth.uid()).
-- 4. Consolidation of multiple permissive policies on business_members.
-- 5. Atomic SQL aggregation RPC for inbox folder counts (get_inbox_counts).
-- ==============================================================================

-- 1. COVERING INDEXES FOR FOREIGN KEYS
CREATE INDEX IF NOT EXISTS idx_wa_messages_connection_id 
    ON public.wa_messages (connection_id);

CREATE INDEX IF NOT EXISTS idx_wa_messages_contact_id 
    ON public.wa_messages (contact_id);

CREATE INDEX IF NOT EXISTS idx_wa_processing_jobs_connection_id 
    ON public.wa_processing_jobs (connection_id);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_business_id 
    ON public.wa_webhook_events (business_id);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_connection_id 
    ON public.wa_webhook_events (connection_id);

CREATE INDEX IF NOT EXISTS idx_wa_message_templates_connection_id 
    ON public.wa_message_templates (connection_id);

CREATE INDEX IF NOT EXISTS idx_business_settings_default_conn 
    ON public.business_settings (default_connection_id, business_id);

-- 2. CLEANUP REDUNDANT INDEX
-- business_settings_business_id_key already creates a UNIQUE btree index on business_id.
DROP INDEX IF EXISTS public.idx_business_settings_business_id;

-- 3. RLS QUERY OPTIMIZATION — (SELECT auth.uid()) INITPLAN CACHING

-- Table: public.user_profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.user_profiles;
CREATE POLICY "Users can view their own profile"
    ON public.user_profiles
    FOR SELECT
    USING ((id = (select auth.uid())) OR public.is_superadmin());

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile"
    ON public.user_profiles
    FOR UPDATE
    USING (id = (select auth.uid()))
    WITH CHECK (id = (select auth.uid()));

-- Table: public.businesses
DROP POLICY IF EXISTS "Business owners and admins can update business profile" ON public.businesses;
CREATE POLICY "Business owners and admins can update business profile"
    ON public.businesses
    FOR UPDATE
    USING (
        (EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = businesses.id
              AND bm.user_id = (select auth.uid())
              AND bm.role IN ('owner', 'admin')
              AND bm.is_active = true
        )) OR public.is_superadmin()
    )
    WITH CHECK (
        (EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = businesses.id
              AND bm.user_id = (select auth.uid())
              AND bm.role IN ('owner', 'admin')
              AND bm.is_active = true
        )) OR public.is_superadmin()
    );

-- Table: public.business_members
-- Consolidate to eliminate multiple permissive SELECT policies
DROP POLICY IF EXISTS "Users can view members of their authorized businesses" ON public.business_members;
CREATE POLICY "Users can view members of their authorized businesses"
    ON public.business_members
    FOR SELECT
    USING (
        (user_id = (select auth.uid()))
        OR public.check_user_business_access(business_id)
        OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Owners can manage business members" ON public.business_members;
CREATE POLICY "Owners can insert business members"
    ON public.business_members
    FOR INSERT
    WITH CHECK (public.is_business_owner(business_id) OR public.is_superadmin());

CREATE POLICY "Owners can update business members"
    ON public.business_members
    FOR UPDATE
    USING (public.is_business_owner(business_id) OR public.is_superadmin())
    WITH CHECK (public.is_business_owner(business_id) OR public.is_superadmin());

CREATE POLICY "Owners can delete business members"
    ON public.business_members
    FOR DELETE
    USING (public.is_business_owner(business_id) OR public.is_superadmin());

-- 4. ATOMIC INBOX COUNTS SQL AGGREGATION RPC
CREATE OR REPLACE FUNCTION public.get_inbox_counts(
    p_business_id UUID,
    p_connection_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'all', COALESCE(COUNT(*) FILTER (WHERE status != 'archived'), 0),
        'unread', COALESCE(COUNT(*) FILTER (WHERE unread_count > 0 AND status != 'archived'), 0),
        'unassigned', COALESCE(COUNT(*) FILTER (WHERE status != 'archived'), 0),
        'assigned_to_me', COALESCE(COUNT(*) FILTER (WHERE status != 'archived'), 0),
        'open', COALESCE(COUNT(*) FILTER (WHERE status = 'open'), 0),
        'pending', COALESCE(COUNT(*) FILTER (WHERE status = 'pending_human'), 0),
        'resolved', COALESCE(COUNT(*) FILTER (WHERE status = 'closed'), 0),
        'archived', COALESCE(COUNT(*) FILTER (WHERE status = 'archived'), 0)
    )
    INTO v_result
    FROM public.wa_conversations
    WHERE business_id = p_business_id
      AND (p_connection_id IS NULL OR connection_id = p_connection_id);

    RETURN COALESCE(v_result, jsonb_build_object(
        'all', 0, 'unread', 0, 'unassigned', 0, 'assigned_to_me', 0,
        'open', 0, 'pending', 0, 'resolved', 0, 'archived', 0
    ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_inbox_counts(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inbox_counts(UUID, UUID) TO authenticated, service_role;
