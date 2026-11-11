-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 004: PRIVILEGE ESCALATION & IMMUTABILITY GUARDS
-- ==============================================================================
-- PHASE 2.4 SECURITY AUDIT REMEDIATION:
-- Prevents authenticated users from elevating their own profile to superadmin.
-- Enforces tenant immutability on business membership records.
-- ==============================================================================

-- 1. PREVENT SUPERADMIN PRIVILEGE ESCALATION ON USER PROFILES
CREATE OR REPLACE FUNCTION public.prevent_user_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_superadmin IS DISTINCT FROM OLD.is_superadmin THEN
    IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' AND current_user != 'postgres' THEN
      RAISE EXCEPTION 'Privilege escalation forbidden: users cannot modify their own superadmin status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_privilege_escalation ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_privilege_escalation
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_profile_privilege_escalation();

-- 2. PREVENT BUSINESS ID TAMPERING ON BUSINESS MEMBERS
CREATE OR REPLACE FUNCTION public.prevent_business_member_tenant_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'Tenant reassignment forbidden: business_id on business_members cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_members_immutable_business_id ON public.business_members;
CREATE TRIGGER trg_business_members_immutable_business_id
  BEFORE UPDATE ON public.business_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_member_tenant_reassignment();
