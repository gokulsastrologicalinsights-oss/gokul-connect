-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 006: ATOMIC WEBHOOK INGESTION RPCs
-- ==============================================================================
-- Implements privileged, atomic, SECURITY DEFINER functions for WhatsApp Cloud API
-- webhook event ingestion, contact/conversation auto-upsert, and status tracking.
--
-- Guarantees:
-- 1. Atomic execution in a single PostgreSQL transaction.
-- 2. Strict tenant binding resolved directly from phone_number_id.
-- 3. Idempotent webhook event deduplication.
-- 4. Safe execution path (search_path = public, pg_temp).
-- ==============================================================================

-- 1. INBOUND MESSAGE INGESTION FUNCTION
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

    -- 4. Upsert Contact in wa_contacts (tenant isolated)
    INSERT INTO public.wa_contacts (
        business_id,
        phone_number,
        display_name,
        updated_at
    )
    VALUES (
        v_conn.business_id,
        p_sender_phone,
        p_sender_name,
        v_now
    )
    ON CONFLICT (business_id, phone_number)
    DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, public.wa_contacts.display_name),
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

-- 2. STATUS UPDATE FUNCTION (sent, delivered, read, failed)
CREATE OR REPLACE FUNCTION public.update_wa_message_status(
    p_phone_number_id TEXT,
    p_meta_message_id TEXT,
    p_status TEXT,
    p_timestamp TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    p_error_code TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conn RECORD;
    v_status_event_key TEXT;
    v_event_processed BOOLEAN;
    v_rows_updated INT := 0;
    v_now TIMESTAMPTZ := COALESCE(p_timestamp, TIMEZONE('utc', NOW()));
BEGIN
    v_status_event_key := p_meta_message_id || '_' || p_status;

    -- 1. Idempotency check: has this specific status event been processed?
    SELECT is_processed
    INTO v_event_processed
    FROM public.wa_webhook_events
    WHERE meta_event_id = v_status_event_key;

    IF v_event_processed IS TRUE THEN
        RETURN jsonb_build_object(
            'status', 'duplicate',
            'meta_event_id', v_status_event_key,
            'message', 'Status update already processed'
        );
    END IF;

    -- 2. Resolve registered connection for this phone_number_id
    SELECT id, business_id
    INTO v_conn
    FROM public.wa_connections
    WHERE phone_number_id = p_phone_number_id
    LIMIT 1;

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
        v_status_event_key,
        v_conn.business_id,
        v_conn.id,
        p_phone_number_id,
        'status',
        p_raw_payload,
        FALSE
    )
    ON CONFLICT (meta_event_id)
    DO UPDATE SET
        payload = EXCLUDED.payload;

    -- 4. Update Message Status in wa_messages
    IF p_status = 'sent' THEN
        UPDATE public.wa_messages
        SET status = 'sent',
            sent_at = v_now,
            updated_at = TIMEZONE('utc', NOW())
        WHERE meta_message_id = p_meta_message_id;
    ELSIF p_status = 'delivered' THEN
        UPDATE public.wa_messages
        SET status = 'delivered',
            delivered_at = v_now,
            updated_at = TIMEZONE('utc', NOW())
        WHERE meta_message_id = p_meta_message_id;
    ELSIF p_status = 'read' THEN
        UPDATE public.wa_messages
        SET status = 'read',
            read_at = v_now,
            updated_at = TIMEZONE('utc', NOW())
        WHERE meta_message_id = p_meta_message_id;
    ELSIF p_status = 'failed' THEN
        UPDATE public.wa_messages
        SET status = 'failed',
            error_code = p_error_code,
            error_message = p_error_message,
            updated_at = TIMEZONE('utc', NOW())
        WHERE meta_message_id = p_meta_message_id;
    END IF;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    -- 5. Mark status event as processed
    UPDATE public.wa_webhook_events
    SET is_processed = TRUE,
        processed_at = TIMEZONE('utc', NOW())
    WHERE meta_event_id = v_status_event_key;

    RETURN jsonb_build_object(
        'status', 'success',
        'meta_message_id', p_meta_message_id,
        'new_status', p_status,
        'rows_updated', v_rows_updated
    );
END;
$$;

-- 3. PERMISSIONS AND PRIVILEGE GUARDS
REVOKE ALL ON FUNCTION public.ingest_wa_inbound_message FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_wa_inbound_message TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_wa_message_status FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_wa_message_status TO anon, authenticated, service_role;
