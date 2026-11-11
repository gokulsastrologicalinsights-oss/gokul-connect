-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 017: MEDIA MESSAGING SUPPORT
-- ==============================================================================
-- PHASE 12.2: Media Messaging (Images, Documents, Audio, Video)
-- Multi-Tenant Media Metadata Storage, Download Tracking, and RLS.
--
-- Strict multi-tenant isolation: every record is bound to business_id.
-- Composite foreign keys guarantee cross-tenant references are strictly rejected.
-- ==============================================================================

-- 1. UPDATE WA_MESSAGES MESSAGE_TYPE CHECK TO INCLUDE 'video'
DO $$
BEGIN
    ALTER TABLE public.wa_messages
        DROP CONSTRAINT IF EXISTS wa_messages_message_type_check;

    ALTER TABLE public.wa_messages
        ADD CONSTRAINT wa_messages_message_type_check
        CHECK (message_type IN ('text', 'template', 'image', 'document', 'audio', 'video', 'interactive', 'reaction'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 2. EXTEND WA_MESSAGES WITH MEDIA ATTRIBUTES
ALTER TABLE public.wa_messages
    ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'document', 'audio', 'video')),
    ADD COLUMN IF NOT EXISTS media_id TEXT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT,
    ADD COLUMN IF NOT EXISTS file_name TEXT,
    ADD COLUMN IF NOT EXISTS file_size BIGINT,
    ADD COLUMN IF NOT EXISTS caption TEXT,
    ADD COLUMN IF NOT EXISTS storage_path TEXT,
    ADD COLUMN IF NOT EXISTS media_url TEXT,
    ADD COLUMN IF NOT EXISTS download_status TEXT DEFAULT 'not_applicable'
        CHECK (download_status IN ('not_applicable', 'pending', 'downloaded', 'failed')),
    ADD COLUMN IF NOT EXISTS downloaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS media_error TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_messages_media_type
    ON public.wa_messages (business_id, media_type);

CREATE INDEX IF NOT EXISTS idx_wa_messages_media_id
    ON public.wa_messages (media_id);

CREATE INDEX IF NOT EXISTS idx_wa_messages_download_status
    ON public.wa_messages (business_id, download_status);

-- 3. WA_MEDIA_FILES TABLE FOR ATTACHMENT TRACKING & TENANT STORAGE
CREATE TABLE IF NOT EXISTS public.wa_media_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.wa_messages(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'document', 'audio', 'video')),
    meta_media_id TEXT,
    mime_type TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'whatsapp-media',
    storage_path TEXT NOT NULL,
    sha256 TEXT,
    caption TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    download_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (download_status IN ('not_applicable', 'pending', 'downloaded', 'failed')),
    error_message TEXT,
    uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    -- Tenant isolation composite key
    CONSTRAINT uq_wa_media_files_id_business UNIQUE (id, business_id),

    -- Composite foreign key guarantees conversation belongs to the same business tenant
    CONSTRAINT fk_wa_media_files_conv_tenant
        FOREIGN KEY (conversation_id, business_id)
        REFERENCES public.wa_conversations(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wa_media_files_biz_created
    ON public.wa_media_files (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_media_files_message
    ON public.wa_media_files (business_id, message_id);

CREATE INDEX IF NOT EXISTS idx_wa_media_files_meta_id
    ON public.wa_media_files (meta_media_id);

-- 4. TENANT IMMUTABILITY TRIGGER ON WA_MEDIA_FILES
DROP TRIGGER IF EXISTS trg_wa_media_files_immutable_business_id ON public.wa_media_files;
CREATE TRIGGER trg_wa_media_files_immutable_business_id
    BEFORE UPDATE ON public.wa_media_files
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- 5. TRIGGER TO POPULATE WA_MESSAGES MEDIA COLUMNS AUTOMATICALLY
CREATE OR REPLACE FUNCTION public.populate_wa_message_media_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.message_type IN ('image', 'document', 'audio', 'video') THEN
        NEW.media_type := COALESCE(NEW.media_type, NEW.message_type);

        IF NEW.raw_payload IS NOT NULL AND NEW.raw_payload ? NEW.message_type THEN
            NEW.media_id := COALESCE(NEW.media_id, NEW.raw_payload->NEW.message_type->>'id');
            NEW.mime_type := COALESCE(NEW.mime_type, NEW.raw_payload->NEW.message_type->>'mime_type');
            NEW.file_name := COALESCE(NEW.file_name, NEW.raw_payload->NEW.message_type->>'filename');
            NEW.caption := COALESCE(NEW.caption, NEW.raw_payload->NEW.message_type->>'caption');
        END IF;

        IF NEW.direction = 'inbound' AND (NEW.download_status IS NULL OR NEW.download_status = 'not_applicable') THEN
            NEW.download_status := 'pending';
        ELSIF NEW.direction = 'outbound' THEN
            NEW.download_status := COALESCE(NEW.download_status, 'not_applicable');
            NEW.uploaded_at := COALESCE(NEW.uploaded_at, TIMEZONE('utc', NOW()));
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_messages_populate_media ON public.wa_messages;
CREATE TRIGGER trg_wa_messages_populate_media
    BEFORE INSERT OR UPDATE ON public.wa_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.populate_wa_message_media_fields();

-- 6. ROW LEVEL SECURITY (RLS) POLICIES FOR WA_MEDIA_FILES
ALTER TABLE public.wa_media_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for wa_media_files select" ON public.wa_media_files;
CREATE POLICY "Tenant isolation for wa_media_files select"
    ON public.wa_media_files
    FOR SELECT
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can insert wa_media_files" ON public.wa_media_files;
CREATE POLICY "Authorized members can insert wa_media_files"
    ON public.wa_media_files
    FOR INSERT
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );

DROP POLICY IF EXISTS "Authorized members can update wa_media_files" ON public.wa_media_files;
CREATE POLICY "Authorized members can update wa_media_files"
    ON public.wa_media_files
    FOR UPDATE
    USING (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    )
    WITH CHECK (
        public.check_user_business_access(business_id) OR public.is_superadmin()
    );
