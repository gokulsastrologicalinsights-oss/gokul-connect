-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 010: ATOMIC WEBHOOK ENQUEUE RPC
-- ==============================================================================
-- Migration Identifier: 20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql
-- Status: PREPARED FOR PHASE 7.5 (NOT YET APPLIED TO LIVE DATABASE)
--
-- PURPOSE:
-- Provides a single, atomic, SECURITY DEFINER PostgreSQL procedure that encapsulates
-- both incoming WhatsApp message ingestion and background processing job creation
-- in a single database transaction. This eliminates any possible network split between
-- webhook recording and worker job enqueueing.
--
-- AFFECTED TABLES:
-- 1. public.wa_webhook_events (persists raw payload and deduplication record)
-- 2. public.wa_contacts (auto-upsert customer profile)
-- 3. public.wa_conversations (auto-upsert thread and unread count)
-- 4. public.wa_messages (insert inbound message)
-- 5. public.wa_processing_jobs (atomically inserts 'evaluate_automation_rules' job)
--
-- RLS POLICIES & SECURITY:
-- - Runs as SECURITY DEFINER with search_path = public, pg_temp.
-- - Strictly derives business_id and connection_id from verified wa_connections entry.
-- - Inherits existing tenant isolation and RLS barriers.
--
-- IDEMPOTENCY:
-- - Deduplicates on meta_event_id in wa_webhook_events.
-- - Enforces unique constraint uq_wa_processing_jobs_idempotency.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.ingest_wa_inbound_message_v2(
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
    v_job_id UUID;
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

    -- 4. Upsert Contact in wa_contacts (tenant isolated)
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

    -- If conflict occurred and row already existed, fetch existing message id
    IF v_message_id IS NULL THEN
        SELECT id INTO v_message_id
        FROM public.wa_messages
        WHERE meta_message_id = p_meta_message_id
        LIMIT 1;
    END IF;

    -- 7. Atomically enqueue background job in wa_processing_jobs
    INSERT INTO public.wa_processing_jobs (
        business_id,
        connection_id,
        job_type,
        payload,
        idempotency_key,
        scheduled_at,
        status,
        attempts,
        max_attempts
    )
    VALUES (
        v_conn.business_id,
        v_conn.id,
        'evaluate_automation_rules',
        jsonb_build_object(
            'business_id', v_conn.business_id,
            'connection_id', v_conn.id,
            'conversation_id', v_conversation_id,
            'contact_id', v_contact_id,
            'message_id', v_message_id,
            'message_content', p_content,
            'message_type', p_message_type,
            'sender_phone', p_sender_phone,
            'sender_name', p_sender_name,
            'meta_message_id', p_meta_message_id
        ),
        'inbound_eval_' || p_meta_message_id,
        v_now,
        'pending',
        0,
        5
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
    RETURNING id INTO v_job_id;

    -- If job already existed due to concurrent call, fetch existing job id
    IF v_job_id IS NULL THEN
        SELECT id INTO v_job_id
        FROM public.wa_processing_jobs
        WHERE idempotency_key = 'inbound_eval_' || p_meta_message_id
        LIMIT 1;
    END IF;

    -- 8. Update connection last_message_at
    UPDATE public.wa_connections
    SET last_message_at = v_now
    WHERE id = v_conn.id;

    -- 9. Mark Webhook Event as Processed
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
        'message_id', v_message_id,
        'job_id', v_job_id
    );
END;
$$;

-- ==============================================================================
-- PRIVILEGE HARDENING & LEAST PRIVILEGE GRANTS
-- ==============================================================================
-- 1. Revoke default EXECUTE privileges from PUBLIC pseudo-role
REVOKE ALL ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;

-- 2. Explicitly revoke EXECUTE from untrusted client roles (anon and authenticated)
REVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM authenticated;

-- 3. Grant EXECUTE strictly to the service_role (used by server-side webhook handler)
GRANT EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 4. Documentation & Verification Comment
COMMENT ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) IS
  'Atomically ingests inbound WhatsApp messages, contacts, conversations, and enqueues evaluation jobs in a single transaction. Restricted strictly to service_role.';

