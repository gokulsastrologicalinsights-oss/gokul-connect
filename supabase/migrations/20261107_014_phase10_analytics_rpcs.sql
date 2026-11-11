-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 013: ANALYTICS & BUSINESS REPORTING (PHASE 10)
-- ==============================================================================
-- Migration Identifier: 20261107_014_phase10_analytics_rpcs.sql
-- Module: Phase 10 — Analytics & Business Reporting
--
-- PURPOSE:
-- 1. Provides fast composite indexes for date-ranged, tenant-scoped analytics queries
--    on wa_messages, wa_contacts, wa_conversations, and wa_automation_execution_logs.
-- 2. Implements server-side SQL aggregation RPC `get_business_analytics_summary` to
--    compute messaging, contact, conversation, automation, and response-time metrics
--    in a single round-trip without loading bulk records into application memory.
-- 3. Implements server-side daily trend aggregation RPC `get_business_analytics_daily_trends`
--    grouped by Asia/Kolkata date boundaries.
--
-- SECURITY & COMPLIANCE:
-- - Strict multi-tenant isolation: every query is scoped to `p_business_id`.
-- - Function is SECURITY INVOKER and enforces search_path = public, pg_temp.
-- - Validates caller has business membership or is superadmin.
-- - PUBLIC execution is REVOKED; execution GRANTED strictly to authenticated, service_role.
-- ==============================================================================

-- 1. COVERING INDEXES FOR ANALYTICS QUERIES
CREATE INDEX IF NOT EXISTS idx_wa_messages_analytics 
    ON public.wa_messages (business_id, created_at DESC, direction, status);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_analytics 
    ON public.wa_contacts (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_analytics 
    ON public.wa_conversations (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_exec_logs_analytics 
    ON public.wa_automation_execution_logs (business_id, status, created_at DESC);

-- 2. ATOMIC SERVER-SIDE ANALYTICS SUMMARY AGGREGATION RPC
CREATE OR REPLACE FUNCTION public.get_business_analytics_summary(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_messaging JSONB;
    v_contacts JSONB;
    v_conversations JSONB;
    v_automations JSONB;
    v_response_time_seconds NUMERIC := NULL;
    v_total_contacts INT := 0;
BEGIN
    -- Strict tenant authorization check: Caller must be a member or superadmin
    IF NOT public.check_user_business_access(p_business_id) AND NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not have access to business tenant %', p_business_id;
    END IF;

    -- A. Messaging Analytics Aggregation
    SELECT jsonb_build_object(
        'total_inbound', COALESCE(COUNT(*) FILTER (WHERE direction = 'inbound'), 0),
        'total_outbound', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound'), 0),
        'delivered', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound' AND status IN ('delivered', 'read')), 0),
        'read', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'read'), 0),
        'failed', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'failed'), 0),
        'pending', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'pending'), 0)
    )
    INTO v_messaging
    FROM public.wa_messages
    WHERE business_id = p_business_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- B. Contact Analytics Aggregation
    SELECT COUNT(*) INTO v_total_contacts
    FROM public.wa_contacts
    WHERE business_id = p_business_id;

    SELECT jsonb_build_object(
        'total_contacts', v_total_contacts,
        'new_contacts', COALESCE(COUNT(*) FILTER (WHERE created_at >= p_start_date AND created_at <= p_end_date), 0),
        'active_contacts', COALESCE(COUNT(*) FILTER (WHERE (total_inbound_count > 0 OR last_inbound_at >= p_start_date)), 0),
        'opted_out_contacts', COALESCE(COUNT(*) FILTER (WHERE is_opted_out = true), 0)
    )
    INTO v_contacts
    FROM public.wa_contacts
    WHERE business_id = p_business_id;

    -- C. Inbox & Conversation Analytics Aggregation
    SELECT jsonb_build_object(
        'total_conversations', COALESCE(COUNT(*), 0),
        'open_conversations', COALESCE(COUNT(*) FILTER (WHERE status = 'open'), 0),
        'pending_human', COALESCE(COUNT(*) FILTER (WHERE status = 'pending_human'), 0),
        'closed_conversations', COALESCE(COUNT(*) FILTER (WHERE status = 'closed'), 0),
        'unread_conversations', COALESCE(COUNT(*) FILTER (WHERE unread_count > 0), 0)
    )
    INTO v_conversations
    FROM public.wa_conversations
    WHERE business_id = p_business_id
      AND (created_at <= p_end_date OR last_message_at >= p_start_date);

    -- D. First-Response Time Calculation (where accurate timestamps exist)
    -- Computes average seconds between first inbound message and first subsequent outbound message
    WITH first_inbound AS (
        SELECT conversation_id, MIN(created_at) AS first_inbound_at
        FROM public.wa_messages
        WHERE business_id = p_business_id
          AND direction = 'inbound'
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY conversation_id
    ),
    first_response AS (
        SELECT fi.conversation_id,
               fi.first_inbound_at,
               MIN(m.created_at) AS first_outbound_at
        FROM first_inbound fi
        JOIN public.wa_messages m
          ON m.conversation_id = fi.conversation_id
         AND m.business_id = p_business_id
         AND m.direction = 'outbound'
         AND m.created_at >= fi.first_inbound_at
        GROUP BY fi.conversation_id, fi.first_inbound_at
    )
    SELECT AVG(EXTRACT(EPOCH FROM (first_outbound_at - first_inbound_at)))
    INTO v_response_time_seconds
    FROM first_response;

    -- E. Automation Analytics Aggregation
    SELECT jsonb_build_object(
        'total_rules', (SELECT COUNT(*) FROM public.wa_automation_rules WHERE business_id = p_business_id),
        'active_rules', (SELECT COUNT(*) FROM public.wa_automation_rules WHERE business_id = p_business_id AND is_active = true),
        'inactive_rules', (SELECT COUNT(*) FROM public.wa_automation_rules WHERE business_id = p_business_id AND is_active = false),
        'executed_jobs', COALESCE(COUNT(*), 0),
        'successful_executions', COALESCE(COUNT(*) FILTER (WHERE status = 'success'), 0),
        'failed_executions', COALESCE(COUNT(*) FILTER (WHERE status = 'failed'), 0),
        'skipped_executions', COALESCE(COUNT(*) FILTER (WHERE status = 'skipped'), 0)
    )
    INTO v_automations
    FROM public.wa_automation_execution_logs
    WHERE business_id = p_business_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- Return consolidated JSONB object
    RETURN jsonb_build_object(
        'business_id', p_business_id,
        'start_date', p_start_date,
        'end_date', p_end_date,
        'messaging', COALESCE(v_messaging, '{}'::jsonb),
        'contacts', COALESCE(v_contacts, '{}'::jsonb),
        'conversations', COALESCE(v_conversations, '{}'::jsonb),
        'automations', COALESCE(v_automations, '{}'::jsonb),
        'avg_first_response_seconds', v_response_time_seconds
    );
END;
$$;

-- 3. SERVER-SIDE DAILY TREND AGGREGATION RPC (Asia/Kolkata Timezone)
CREATE OR REPLACE FUNCTION public.get_business_analytics_daily_trends(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_trends JSONB;
BEGIN
    -- Strict tenant authorization check
    IF NOT public.check_user_business_access(p_business_id) AND NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not have access to business tenant %', p_business_id;
    END IF;

    WITH dates AS (
        SELECT generate_series(
            (TIMEZONE('Asia/Kolkata', p_start_date))::date,
            (TIMEZONE('Asia/Kolkata', p_end_date))::date,
            '1 day'::interval
        )::date AS day_date
    ),
    msg_counts AS (
        SELECT
            (TIMEZONE('Asia/Kolkata', created_at))::date AS day_date,
            COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound,
            COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound,
            COUNT(*) FILTER (WHERE direction = 'outbound' AND status IN ('delivered', 'read')) AS delivered,
            COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'read') AS read_count,
            COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'failed') AS failed
        FROM public.wa_messages
        WHERE business_id = p_business_id
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY 1
    ),
    contact_counts AS (
        SELECT
            (TIMEZONE('Asia/Kolkata', created_at))::date AS day_date,
            COUNT(*) AS new_contacts
        FROM public.wa_contacts
        WHERE business_id = p_business_id
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY 1
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', to_char(d.day_date, 'YYYY-MM-DD'),
            'inbound', COALESCE(m.inbound, 0),
            'outbound', COALESCE(m.outbound, 0),
            'total', COALESCE(m.inbound, 0) + COALESCE(m.outbound, 0),
            'delivered', COALESCE(m.delivered, 0),
            'read', COALESCE(m.read_count, 0),
            'failed', COALESCE(m.failed, 0),
            'new_contacts', COALESCE(c.new_contacts, 0)
        ) ORDER BY d.day_date ASC
    )
    INTO v_trends
    FROM dates d
    LEFT JOIN msg_counts m ON m.day_date = d.day_date
    LEFT JOIN contact_counts c ON c.day_date = d.day_date;

    RETURN COALESCE(v_trends, '[]'::jsonb);
END;
$$;

-- 4. PRIVILEGE GUARDS
REVOKE EXECUTE ON FUNCTION public.get_business_analytics_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_analytics_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_business_analytics_daily_trends(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_business_analytics_daily_trends(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;
