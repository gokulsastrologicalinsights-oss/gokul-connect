-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 009: AUTOMATION ENGINE & RULE BUILDER
-- ==============================================================================
-- PHASE 5: Rule-Based WhatsApp Automation Engine
-- Strict Multi-Tenant Isolation, 100% Deterministic (Zero AI overhead)
-- Loop Prevention, 24-Hour Compliance, Opt-Out Enforcement, and Queue Idempotency
-- ==============================================================================

-- 1. EXTEND BUSINESS_SETTINGS WITH BUSINESS HOURS & AUTOMATION SETTINGS
ALTER TABLE public.business_settings
    ADD COLUMN IF NOT EXISTS business_hours JSONB NOT NULL DEFAULT '{
        "timezone": "Asia/Kolkata",
        "weekly_schedule": {
            "monday":    {"is_open": true,  "open_time": "09:00", "close_time": "18:00"},
            "tuesday":   {"is_open": true,  "open_time": "09:00", "close_time": "18:00"},
            "wednesday": {"is_open": true,  "open_time": "09:00", "close_time": "18:00"},
            "thursday":  {"is_open": true,  "open_time": "09:00", "close_time": "18:00"},
            "friday":    {"is_open": true,  "open_time": "09:00", "close_time": "18:00"},
            "saturday":  {"is_open": true,  "open_time": "10:00", "close_time": "16:00"},
            "sunday":    {"is_open": false, "open_time": "00:00", "close_time": "00:00"}
        },
        "holiday_dates": []
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS automation_settings JSONB NOT NULL DEFAULT '{
        "is_automation_enabled": false,
        "opt_out_keywords": ["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "நிறுத்து"],
        "opt_in_keywords": ["START", "UNSTOP", "JOIN", "தொடங்கு"],
        "human_handover_keywords": ["AGENT", "HUMAN", "REPRESENTATIVE", "0", "உதவி", "மனிதர்"],
        "max_bot_replies_per_hour": 10,
        "circuit_breaker_max_replies_15m": 5
    }'::jsonb;

-- 2. EXTEND WA_CONTACTS WITH OPT-OUT AND ENGAGEMENT TRACKING
ALTER TABLE public.wa_contacts
    ADD COLUMN IF NOT EXISTS is_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS opted_out_reason TEXT,
    ADD COLUMN IF NOT EXISTS last_welcome_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_inbound_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_wa_contacts_opt_out 
    ON public.wa_contacts (business_id, is_opted_out);

-- 3. EXTEND WA_CONVERSATIONS WITH AUTOMATION PAUSE & LOOP CIRCUIT BREAKER
ALTER TABLE public.wa_conversations
    ADD COLUMN IF NOT EXISTS is_automation_paused BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS automation_paused_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS automation_paused_by UUID REFERENCES public.user_profiles(id),
    ADD COLUMN IF NOT EXISTS bot_reply_count_window INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_bot_reply_at TIMESTAMPTZ;

-- 4. EXTEND WA_PROCESSING_JOBS WITH IDEMPOTENCY & LOCKING
ALTER TABLE public.wa_processing_jobs
    DROP CONSTRAINT IF EXISTS wa_processing_jobs_job_type_check;

ALTER TABLE public.wa_processing_jobs
    ADD CONSTRAINT wa_processing_jobs_job_type_check 
        CHECK (job_type IN (
            'send_message',
            'send_outbound_message',
            'evaluate_rules',
            'evaluate_automation_rules',
            'scheduled_followup',
            'process_webhook',
            'process_webhook_event',
            'update_status'
        )),
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS locked_by TEXT;

-- Enforce unique idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_processing_jobs_idempotency 
    ON public.wa_processing_jobs (idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_processing_jobs_claim 
    ON public.wa_processing_jobs (status, scheduled_at ASC)
    WHERE status = 'pending';

-- 5. WA_AUTOMATION_RULES TABLE
CREATE TABLE IF NOT EXISTS public.wa_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.wa_connections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'inbound_message',
        'first_inbound_message',
        'keyword_match',
        'outside_business_hours',
        'inside_business_hours',
        'customer_enquiry',
        'opt_out',
        'opt_in',
        'human_requested'
    )),
    priority INT NOT NULL DEFAULT 100,
    stop_processing_on_match BOOLEAN NOT NULL DEFAULT TRUE,
    cooldown_seconds INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_wa_automation_rules_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_automation_rules_lookup 
    ON public.wa_automation_rules(business_id, is_active, priority ASC);

DROP TRIGGER IF EXISTS trg_wa_automation_rules_immutable_business_id ON public.wa_automation_rules;
CREATE TRIGGER trg_wa_automation_rules_immutable_business_id
    BEFORE UPDATE ON public.wa_automation_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 6. WA_RULE_CONDITIONS TABLE
CREATE TABLE IF NOT EXISTS public.wa_rule_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL,
    condition_group INT NOT NULL DEFAULT 0,
    condition_type TEXT NOT NULL CHECK (condition_type IN (
        'keyword_exact',
        'keyword_contains',
        'keyword_starts_with',
        'keyword_regex',
        'business_hours',
        'outside_hours',
        'conversation_status',
        'contact_opt_in',
        'first_time_contact'
    )),
    operator TEXT NOT NULL DEFAULT 'equals' CHECK (operator IN (
        'equals', 'contains', 'starts_with', 'regex', 'is_true', 'is_false', 'in_list'
    )),
    match_value JSONB NOT NULL DEFAULT '{}'::jsonb,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_wa_rule_conditions_id_business UNIQUE (id, business_id),
    CONSTRAINT fk_wa_rule_conditions_rule_tenant
        FOREIGN KEY (rule_id, business_id)
        REFERENCES public.wa_automation_rules(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_rule_conditions_rule_id 
    ON public.wa_rule_conditions(business_id, rule_id, order_index ASC);

DROP TRIGGER IF EXISTS trg_wa_rule_conditions_immutable_business_id ON public.wa_rule_conditions;
CREATE TRIGGER trg_wa_rule_conditions_immutable_business_id
    BEFORE UPDATE ON public.wa_rule_conditions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 7. WA_RULE_ACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.wa_rule_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'send_text_message',
        'send_template_message',
        'send_interactive_buttons',
        'send_interactive_list',
        'assign_agent',
        'update_conversation_status',
        'apply_contact_label',
        'set_opt_status',
        'schedule_follow_up'
    )),
    action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    delay_seconds INT NOT NULL DEFAULT 0,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_wa_rule_actions_id_business UNIQUE (id, business_id),
    CONSTRAINT fk_wa_rule_actions_rule_tenant
        FOREIGN KEY (rule_id, business_id)
        REFERENCES public.wa_automation_rules(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_rule_actions_rule_id 
    ON public.wa_rule_actions(business_id, rule_id, order_index ASC);

DROP TRIGGER IF EXISTS trg_wa_rule_actions_immutable_business_id ON public.wa_rule_actions;
CREATE TRIGGER trg_wa_rule_actions_immutable_business_id
    BEFORE UPDATE ON public.wa_rule_actions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 8. WA_AUTOMATION_EXECUTION_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.wa_automation_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES public.wa_automation_rules(id) ON DELETE SET NULL,
    connection_id UUID NOT NULL REFERENCES public.wa_connections(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    inbound_message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL,
    outbound_message_id UUID REFERENCES public.wa_messages(id) ON DELETE SET NULL,
    trigger_matched TEXT NOT NULL,
    conditions_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions_executed JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'failed', 'delayed')),
    skip_reason TEXT,
    error_message TEXT,
    execution_time_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT fk_wa_exec_logs_conversation_tenant
        FOREIGN KEY (conversation_id, business_id)
        REFERENCES public.wa_conversations(id, business_id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_exec_logs_contact_tenant
        FOREIGN KEY (contact_id, business_id)
        REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE,
    CONSTRAINT uq_rule_exec_single_trigger 
        UNIQUE (business_id, rule_id, inbound_message_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_exec_logs_business 
    ON public.wa_automation_execution_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_exec_logs_contact 
    ON public.wa_automation_execution_logs(business_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_exec_logs_rule 
    ON public.wa_automation_execution_logs(business_id, rule_id, created_at DESC);

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.wa_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_rule_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_rule_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_automation_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for wa_automation_rules" ON public.wa_automation_rules;
CREATE POLICY "Tenant isolation for wa_automation_rules"
    ON public.wa_automation_rules
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

DROP POLICY IF EXISTS "Tenant isolation for wa_rule_conditions" ON public.wa_rule_conditions;
CREATE POLICY "Tenant isolation for wa_rule_conditions"
    ON public.wa_rule_conditions
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

DROP POLICY IF EXISTS "Tenant isolation for wa_rule_actions" ON public.wa_rule_actions;
CREATE POLICY "Tenant isolation for wa_rule_actions"
    ON public.wa_rule_actions
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

DROP POLICY IF EXISTS "Tenant isolation for wa_automation_execution_logs" ON public.wa_automation_execution_logs;
CREATE POLICY "Tenant isolation for wa_automation_execution_logs"
    ON public.wa_automation_execution_logs
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- 10. HELPER RPCS FOR WORKER QUEUE, RECOVERY & PRUNING

-- Claim next batch of pending jobs exclusively using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_next_wa_jobs(
    p_batch_size INT DEFAULT 10,
    p_worker_id TEXT DEFAULT 'worker_anon'
)
RETURNS SETOF public.wa_processing_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH selected_jobs AS (
        SELECT id
        FROM public.wa_processing_jobs
        WHERE status = 'pending'
          AND scheduled_at <= TIMEZONE('utc', NOW())
        ORDER BY scheduled_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    UPDATE public.wa_processing_jobs j
    SET status = 'processing',
        locked_at = TIMEZONE('utc', NOW()),
        locked_by = p_worker_id,
        updated_at = TIMEZONE('utc', NOW())
    FROM selected_jobs s
    WHERE j.id = s.id
    RETURNING j.*;
END;
$$;

-- Stuck Job Reaper (reclaims jobs locked > 5 minutes ago without completion)
CREATE OR REPLACE FUNCTION public.reclaim_stuck_wa_jobs(
    p_timeout_minutes INT DEFAULT 5
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reclaimed_count INT;
BEGIN
    WITH stuck AS (
        SELECT id
        FROM public.wa_processing_jobs
        WHERE status = 'processing'
          AND locked_at < TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::interval
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.wa_processing_jobs j
    SET status = CASE 
            WHEN j.attempts + 1 >= j.max_attempts THEN 'failed'
            ELSE 'pending'
        END,
        attempts = j.attempts + 1,
        last_error = 'Worker timeout: job reclaimed after ' || p_timeout_minutes || 'm inactivity',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = TIMEZONE('utc', NOW())
    FROM stuck s
    WHERE j.id = s.id;

    GET DIAGNOSTICS v_reclaimed_count = ROW_COUNT;
    RETURN v_reclaimed_count;
END;
$$;

-- Automated Storage Pruning Procedure (14-day logs, 7-day completed jobs/events)
CREATE OR REPLACE FUNCTION public.prune_stale_automation_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pruned_logs INT;
    v_pruned_jobs INT;
    v_pruned_events INT;
BEGIN
    -- Delete execution logs older than 14 days
    DELETE FROM public.wa_automation_execution_logs
    WHERE created_at < TIMEZONE('utc', NOW()) - INTERVAL '14 days';
    GET DIAGNOSTICS v_pruned_logs = ROW_COUNT;

    -- Delete completed or failed jobs older than 7 days
    DELETE FROM public.wa_processing_jobs
    WHERE status IN ('completed', 'failed')
      AND updated_at < TIMEZONE('utc', NOW()) - INTERVAL '7 days';
    GET DIAGNOSTICS v_pruned_jobs = ROW_COUNT;

    -- Delete processed webhook events older than 7 days
    DELETE FROM public.wa_webhook_events
    WHERE is_processed = TRUE
      AND created_at < TIMEZONE('utc', NOW()) - INTERVAL '7 days';
    GET DIAGNOSTICS v_pruned_events = ROW_COUNT;

    RETURN jsonb_build_object(
        'pruned_logs', v_pruned_logs,
        'pruned_jobs', v_pruned_jobs,
        'pruned_events', v_pruned_events
    );
END;
$$;

-- Restrict execution: administrative background maintenance only
REVOKE ALL ON FUNCTION public.prune_stale_automation_records() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prune_stale_automation_records() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_stale_automation_records() TO service_role;

-- Update Ingestion RPC to update last_inbound_at & total_inbound_count
CREATE OR REPLACE FUNCTION public.ingest_wa_inbound_message(
    p_phone_number_id TEXT,
    p_meta_message_id TEXT,
    p_sender_phone TEXT,
    p_sender_name TEXT DEFAULT NULL,
    p_message_type TEXT DEFAULT 'text',
    p_content TEXT DEFAULT '',
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conn RECORD;
    v_contact_id UUID;
    v_conversation_id UUID;
    v_message_id UUID;
    v_event_processed BOOLEAN;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
BEGIN
    -- 1. Resolve registered connection for this phone_number_id
    SELECT id, business_id, is_enabled
    INTO v_conn
    FROM public.wa_connections
    WHERE phone_number_id = p_phone_number_id
    LIMIT 1;

    -- 2. Idempotency check: has this meta_message_id already been processed?
    SELECT is_processed
    INTO v_event_processed
    FROM public.wa_webhook_events
    WHERE meta_event_id = p_meta_message_id;

    IF v_event_processed IS TRUE THEN
        RETURN jsonb_build_object(
            'status', 'duplicate',
            'meta_message_id', p_meta_message_id,
            'message', 'Webhook event already processed'
        );
    END IF;

    -- 3. Record event in wa_webhook_events
    INSERT INTO public.wa_webhook_events (
        meta_event_id,
        business_id,
        connection_id,
        phone_number_id,
        event_type,
        payload,
        is_processed
    )
    VALUES (
        p_meta_message_id,
        v_conn.business_id,
        v_conn.id,
        p_phone_number_id,
        'message',
        p_raw_payload,
        FALSE
    )
    ON CONFLICT (meta_event_id)
    DO UPDATE SET
        business_id = EXCLUDED.business_id,
        connection_id = EXCLUDED.connection_id,
        payload = EXCLUDED.payload;

    -- If connection does not exist or is disabled, log error and return
    IF v_conn.id IS NULL THEN
        UPDATE public.wa_webhook_events
        SET processing_error = 'No registered WhatsApp connection for Phone Number ID: ' || p_phone_number_id
        WHERE meta_event_id = p_meta_message_id;

        RETURN jsonb_build_object(
            'status', 'unregistered_phone',
            'error', 'No connection registered for phone_number_id'
        );
    END IF;

    IF v_conn.is_enabled IS NOT TRUE THEN
        UPDATE public.wa_webhook_events
        SET processing_error = 'WhatsApp connection is currently disabled: ' || v_conn.id::text
        WHERE meta_event_id = p_meta_message_id;

        RETURN jsonb_build_object(
            'status', 'disabled_connection',
            'error', 'WhatsApp connection is disabled'
        );
    END IF;

    -- 4. Upsert Contact in wa_contacts (tenant isolated, tracks last_inbound_at and count)
    INSERT INTO public.wa_contacts (
        business_id,
        phone_number,
        display_name,
        last_inbound_at,
        total_inbound_count,
        updated_at
    )
    VALUES (
        v_conn.business_id,
        p_sender_phone,
        p_sender_name,
        v_now,
        1,
        v_now
    )
    ON CONFLICT (business_id, phone_number)
    DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, public.wa_contacts.display_name),
        last_inbound_at = v_now,
        total_inbound_count = public.wa_contacts.total_inbound_count + 1,
        updated_at = v_now
    RETURNING id INTO v_contact_id;

    -- 5. Upsert Conversation thread in wa_conversations
    INSERT INTO public.wa_conversations (
        business_id,
        connection_id,
        contact_id,
        status,
        last_message_preview,
        last_message_at,
        updated_at
    )
    VALUES (
        v_conn.business_id,
        v_conn.id,
        v_contact_id,
        'open',
        SUBSTRING(p_content FROM 1 FOR 200),
        v_now,
        v_now
    )
    ON CONFLICT (connection_id, contact_id)
    DO UPDATE SET
        last_message_preview = SUBSTRING(EXCLUDED.last_message_preview FROM 1 FOR 200),
        last_message_at = v_now,
        updated_at = v_now
    RETURNING id INTO v_conversation_id;

    -- 6. Insert Inbound Message in wa_messages
    INSERT INTO public.wa_messages (
        business_id,
        connection_id,
        conversation_id,
        contact_id,
        direction,
        message_type,
        content,
        meta_message_id,
        status,
        delivered_at,
        raw_payload
    )
    VALUES (
        v_conn.business_id,
        v_conn.id,
        v_conversation_id,
        v_contact_id,
        'inbound',
        COALESCE(p_message_type, 'text'),
        p_content,
        p_meta_message_id,
        'delivered',
        v_now,
        p_raw_payload
    )
    ON CONFLICT (meta_message_id) DO NOTHING
    RETURNING id INTO v_message_id;

    -- 7. Update connection last_message_at
    UPDATE public.wa_connections
    SET last_message_at = v_now
    WHERE id = v_conn.id;

    -- 8. Mark Webhook Event as Processed
    UPDATE public.wa_webhook_events
    SET is_processed = TRUE,
        processed_at = v_now
    WHERE meta_event_id = p_meta_message_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'business_id', v_conn.business_id,
        'connection_id', v_conn.id,
        'conversation_id', v_conversation_id,
        'contact_id', v_contact_id,
        'message_id', v_message_id
    );
END;
$$;
