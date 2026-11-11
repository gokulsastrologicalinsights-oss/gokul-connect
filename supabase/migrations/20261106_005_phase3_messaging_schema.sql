-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 005: WHATSAPP MESSAGING & WEBHOOK SCHEMA
-- ==============================================================================
-- PHASE 3B: Contacts, Conversations, Messages, Templates, Webhook Deduplication,
-- and Durable Processing Outbox.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- Composite foreign keys guarantee cross-tenant references are strictly rejected.
-- ==============================================================================

-- 1. REUSABLE TENANT IMMUTABILITY TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.prevent_tenant_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
        RAISE EXCEPTION 'Tenant reassignment forbidden: business_id cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;

-- 2. WHATSAPP CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.wa_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    display_name TEXT,
    profile_photo_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Contact phone number must be unique per business tenant
    CONSTRAINT uq_wa_contacts_business_phone UNIQUE (business_id, phone_number),
    -- Composite unique key required for composite foreign keys
    CONSTRAINT uq_wa_contacts_id_business UNIQUE (id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_business_id ON public.wa_contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_phone_number ON public.wa_contacts(business_id, phone_number);

DROP TRIGGER IF EXISTS trg_wa_contacts_immutable_business_id ON public.wa_contacts;
CREATE TRIGGER trg_wa_contacts_immutable_business_id
    BEFORE UPDATE ON public.wa_contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 3. WHATSAPP CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.wa_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'closed', 'archived', 'pending_human')),
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ,
    unread_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- One active thread per connection + contact pair
    CONSTRAINT uq_wa_conversations_connection_contact UNIQUE (connection_id, contact_id),
    -- Composite unique key required for composite foreign keys
    CONSTRAINT uq_wa_conversations_id_business UNIQUE (id, business_id),

    -- COMPOSITE FOREIGN KEYS: Both connection and contact must belong to this business
    CONSTRAINT fk_wa_conversations_connection_tenant
        FOREIGN KEY (connection_id, business_id)
        REFERENCES public.wa_connections(id, business_id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_conversations_contact_tenant
        FOREIGN KEY (contact_id, business_id)
        REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_business_id ON public.wa_conversations(business_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_connection_id ON public.wa_conversations(connection_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_contact_id ON public.wa_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_last_message ON public.wa_conversations(business_id, last_message_at DESC);

DROP TRIGGER IF EXISTS trg_wa_conversations_immutable_business_id ON public.wa_conversations;
CREATE TRIGGER trg_wa_conversations_immutable_business_id
    BEFORE UPDATE ON public.wa_conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 4. WHATSAPP MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.wa_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    contact_id UUID NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL DEFAULT 'text'
        CHECK (message_type IN ('text', 'template', 'image', 'document', 'audio', 'interactive', 'reaction')),
    content TEXT NOT NULL DEFAULT '',
    meta_message_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error_code TEXT,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    raw_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- COMPOSITE FOREIGN KEYS: Ensure all related entities belong to the same business
    CONSTRAINT fk_wa_messages_connection_tenant
        FOREIGN KEY (connection_id, business_id)
        REFERENCES public.wa_connections(id, business_id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_messages_conversation_tenant
        FOREIGN KEY (conversation_id, business_id)
        REFERENCES public.wa_conversations(id, business_id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_messages_contact_tenant
        FOREIGN KEY (contact_id, business_id)
        REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_business_id ON public.wa_messages(business_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation_id ON public.wa_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_meta_message_id ON public.wa_messages(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_status ON public.wa_messages(status);

DROP TRIGGER IF EXISTS trg_wa_messages_immutable_business_id ON public.wa_messages;
CREATE TRIGGER trg_wa_messages_immutable_business_id
    BEFORE UPDATE ON public.wa_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 5. WHATSAPP MESSAGE TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.wa_message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID,
    template_name TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    category TEXT NOT NULL CHECK (category IN ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
    status TEXT NOT NULL DEFAULT 'APPROVED'
        CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED')),
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_wa_message_templates_name_lang UNIQUE (business_id, template_name, language),
    CONSTRAINT fk_wa_message_templates_connection_tenant
        FOREIGN KEY (connection_id, business_id)
        REFERENCES public.wa_connections(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_message_templates_business_id ON public.wa_message_templates(business_id);

DROP TRIGGER IF EXISTS trg_wa_message_templates_immutable_business_id ON public.wa_message_templates;
CREATE TRIGGER trg_wa_message_templates_immutable_business_id
    BEFORE UPDATE ON public.wa_message_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 6. WHATSAPP WEBHOOK EVENTS TABLE (IDEMPOTENCY & LOGGING)
CREATE TABLE IF NOT EXISTS public.wa_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.wa_connections(id) ON DELETE SET NULL,
    phone_number_id TEXT NOT NULL,
    meta_event_id TEXT UNIQUE,
    event_type TEXT NOT NULL CHECK (event_type IN ('message', 'status', 'error', 'other')),
    payload JSONB NOT NULL,
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_phone_id ON public.wa_webhook_events(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_event_id ON public.wa_webhook_events(meta_event_id);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_processed ON public.wa_webhook_events(is_processed, created_at ASC);

-- 7. WHATSAPP DURABLE PROCESSING JOBS (OUTBOX QUEUE & RETRY)
CREATE TABLE IF NOT EXISTS public.wa_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.wa_connections(id) ON DELETE SET NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('send_message', 'process_webhook', 'update_status')),
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    last_error TEXT,
    locked_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_wa_processing_jobs_queue ON public.wa_processing_jobs(status, scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_wa_processing_jobs_business_id ON public.wa_processing_jobs(business_id);

DROP TRIGGER IF EXISTS trg_wa_processing_jobs_immutable_business_id ON public.wa_processing_jobs;
CREATE TRIGGER trg_wa_processing_jobs_immutable_business_id
    BEFORE UPDATE ON public.wa_processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_processing_jobs ENABLE ROW LEVEL SECURITY;

-- wa_contacts RLS
DROP POLICY IF EXISTS "Tenant isolation for wa_contacts" ON public.wa_contacts;
CREATE POLICY "Tenant isolation for wa_contacts"
    ON public.wa_contacts
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- wa_conversations RLS
DROP POLICY IF EXISTS "Tenant isolation for wa_conversations" ON public.wa_conversations;
CREATE POLICY "Tenant isolation for wa_conversations"
    ON public.wa_conversations
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- wa_messages RLS
DROP POLICY IF EXISTS "Tenant isolation for wa_messages" ON public.wa_messages;
CREATE POLICY "Tenant isolation for wa_messages"
    ON public.wa_messages
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- wa_message_templates RLS
DROP POLICY IF EXISTS "Tenant isolation for wa_message_templates" ON public.wa_message_templates;
CREATE POLICY "Tenant isolation for wa_message_templates"
    ON public.wa_message_templates
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));

-- wa_webhook_events RLS
DROP POLICY IF EXISTS "Tenant isolation for wa_webhook_events" ON public.wa_webhook_events;
CREATE POLICY "Tenant isolation for wa_webhook_events"
    ON public.wa_webhook_events
    FOR ALL
    USING (business_id IS NULL OR public.check_user_business_access(business_id))
    WITH CHECK (business_id IS NULL OR public.check_user_business_access(business_id));

-- wa_processing_jobs RLS
DROP POLICY IF EXISTS "Tenant isolation for wa_processing_jobs" ON public.wa_processing_jobs;
CREATE POLICY "Tenant isolation for wa_processing_jobs"
    ON public.wa_processing_jobs
    FOR ALL
    USING (public.check_user_business_access(business_id))
    WITH CHECK (public.check_user_business_access(business_id));
