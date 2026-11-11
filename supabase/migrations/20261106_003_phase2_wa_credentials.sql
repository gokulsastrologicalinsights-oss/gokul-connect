-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 003: WHATSAPP CREDENTIAL VAULT (PERSISTENT ENCRYPTION)
-- ==============================================================================
-- Represents server-side AES-256-GCM encrypted Meta access token storage.
-- Plain-text tokens are NEVER stored in this table.
-- Strict tenant isolation: every credential row is tied to connection_id and business_id.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.wa_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES public.wa_connections(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    key_version TEXT NOT NULL DEFAULT 'v1',
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_wa_credentials_connection UNIQUE (connection_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_credentials_business_id ON public.wa_credentials(business_id);
CREATE INDEX IF NOT EXISTS idx_wa_credentials_connection_id ON public.wa_credentials(connection_id);

ALTER TABLE public.wa_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Strict server-side and owner access for wa_credentials"
    ON public.wa_credentials
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.business_id = wa_credentials.business_id
              AND bm.user_id = auth.uid()
              AND bm.role IN ('owner', 'admin')
              AND bm.is_active = TRUE
        ) OR public.is_superadmin()
    );
