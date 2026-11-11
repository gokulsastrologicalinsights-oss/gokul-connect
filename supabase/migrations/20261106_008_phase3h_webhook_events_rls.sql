-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 008: SECURE WEBHOOK EVENTS RLS
-- ==============================================================================
-- Remediates unassigned webhook event visibility (Pre-Production Security Review)
--
-- Security Fix:
-- Previously: USING (business_id IS NULL OR public.check_user_business_access(business_id))
-- Gap: Allowed any regular authenticated tenant member to read unassigned (business_id IS NULL)
--      inbound webhook payloads and customer details across tenant lines.
--
-- Hardened Policy:
-- Restricts unassigned events strictly to superadmins (public.is_superadmin()) or service_role.
-- Preserves business tenant isolation for assigned events (check_user_business_access).
-- Preserves ingestion functionality (executed via SECURITY DEFINER RPCs).
-- ==============================================================================

DROP POLICY IF EXISTS "Tenant isolation for wa_webhook_events" ON public.wa_webhook_events;

CREATE POLICY "Tenant isolation for wa_webhook_events"
    ON public.wa_webhook_events
    FOR ALL
    USING (
        (business_id IS NOT NULL AND public.check_user_business_access(business_id))
        OR public.is_superadmin()
    )
    WITH CHECK (
        (business_id IS NOT NULL AND public.check_user_business_access(business_id))
        OR public.is_superadmin()
    );
