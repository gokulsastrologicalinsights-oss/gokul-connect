-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 001: FOUNDATION & STRICT TENANT ISOLATION
-- ==============================================================================
-- To be applied to the NEW DEDICATED Supabase project when provisioned.
-- DO NOT APPLY TO PREVIOUS/EXISTING SUPABASE PROJECTS.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BUSINESSES TABLE
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_name TEXT DEFAULT 'briefcase',
    accent_color TEXT DEFAULT 'indigo',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON public.businesses(slug);

-- 2. USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 3. BUSINESS MEMBERSHIP (M:N mapping enforcing strict tenant assignment)
CREATE TABLE IF NOT EXISTS public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    CONSTRAINT uq_business_user UNIQUE (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_members_user ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_business ON public.business_members(business_id);

-- 4. ROW LEVEL SECURITY (RLS)

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- Helper function: check if authenticated user belongs to a business
CREATE OR REPLACE FUNCTION public.check_user_business_access(b_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = b_id
      AND bm.user_id = auth.uid()
      AND bm.is_active = TRUE
  );
$$;

-- Restrict execution to authenticated sessions and service_role
REVOKE EXECUTE ON FUNCTION public.check_user_business_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_business_access(UUID) TO authenticated, service_role;

-- Helper function: check if authenticated user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.is_superadmin = TRUE
  );
$$;

-- Restrict execution to authenticated sessions and service_role
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;

-- RLS POLICIES FOR businesses:
-- Only active members of a business (or superadmin) can view that business
CREATE POLICY "Users can only view assigned businesses"
  ON public.businesses
  FOR SELECT
  USING (
    public.check_user_business_access(id) OR public.is_superadmin()
  );

-- Only owners/admins can update business details
CREATE POLICY "Business owners and admins can update business profile"
  ON public.businesses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = id
        AND bm.user_id = auth.uid()
        AND bm.role IN ('owner', 'admin')
        AND bm.is_active = TRUE
    ) OR public.is_superadmin()
  );

-- RLS POLICIES FOR user_profiles:
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles
  FOR SELECT
  USING (id = auth.uid() OR public.is_superadmin());

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (id = auth.uid());

-- RLS POLICIES FOR business_members:
-- Users can view membership records for their businesses
CREATE POLICY "Users can view members of their authorized businesses"
  ON public.business_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.check_user_business_access(business_id)
    OR public.is_superadmin()
  );

-- Helper function: check if authenticated user is business owner
CREATE OR REPLACE FUNCTION public.is_business_owner(b_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = b_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'owner'
      AND bm.is_active = TRUE
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_business_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_business_owner(UUID) TO authenticated, service_role;

-- Helper function: check if authenticated user is business owner or admin
CREATE OR REPLACE FUNCTION public.is_business_owner_or_admin(b_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = b_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
      AND bm.is_active = TRUE
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_business_owner_or_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_business_owner_or_admin(UUID) TO authenticated, service_role;

-- Only owners can manage business members (non-recursive via security definer)
CREATE POLICY "Owners can manage business members"
  ON public.business_members
  FOR ALL
  USING (
    public.is_business_owner(business_id) OR public.is_superadmin()
  );

-- 5. AUTO-CREATE USER PROFILE ON AUTH SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. SEED THE TWO EXACT BUSINESSES
INSERT INTO public.businesses (id, name, slug, description, icon_name, accent_color)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Gokul''s Astrological Insights',
    'astrology',
    'Astrology consultations, Horoscope analysis, Vedic & KP enquiries, Consultation bookings, and Payment follow-ups.',
    'Sparkles',
    'purple'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Gokul Vivaham',
    'vivaham',
    'Tamil matrimony enquiries, New registrations, Membership verification, Profile enquiries, and Payment follow-ups.',
    'HeartHandshake',
    'rose'
  )
ON CONFLICT (slug) DO NOTHING;
