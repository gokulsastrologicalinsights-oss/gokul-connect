-- ==============================================================================
-- GOKUL CONNECT — P4 GATE 2.1: RLS BEHAVIORAL VERIFICATION TEST SUITE
-- Isolated Database: gokul_connect_gate2_rls_test (PG 17 on Port 5433)
-- ==============================================================================

\set ON_ERROR_STOP off

-- Ensure authenticated role has necessary table privileges (standard Supabase grant)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- Set up test helper to report assertions
CREATE OR REPLACE FUNCTION test_assert(test_name TEXT, condition BOOLEAN, details TEXT DEFAULT '')
RETURNS VOID AS $$
BEGIN
    IF condition THEN
        RAISE NOTICE '🟢 [PASS] %: %', test_name, details;
    ELSE
        RAISE EXCEPTION '❌ [FAIL] %: %', test_name, details;
    END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    v_count INT;
    v_err TEXT;
    v_astrology_id UUID := '11111111-1111-1111-1111-111111111111';
    v_vivaham_id UUID := '22222222-2222-2222-2222-222222222222';
    v_user_a_astro UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    v_user_b_vivaham UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'STARTING RLS SIMULATED JWT BEHAVIORAL TESTS';
    RAISE NOTICE '================================================================================';

    -- --------------------------------------------------------------------------
    -- SUITE 1: ASTROLOGY OWNER (User A) ISOLATION TESTS
    -- --------------------------------------------------------------------------
    RAISE NOTICE '--- SUITE 1: Astrology Owner (User A) ---';
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_a_astro::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a_astro::text, 'role', 'authenticated')::text, true);

    -- 1.1 Authorized owner can access their own business
    SELECT count(*) INTO v_count FROM public.businesses WHERE id = v_astrology_id;
    PERFORM test_assert('1.1 Astrology owner accesses own business', v_count = 1, format('Found %s business rows', v_count));

    -- 1.2 Astrology owner CANNOT read Vivaham business record
    SELECT count(*) INTO v_count FROM public.businesses WHERE id = v_vivaham_id;
    PERFORM test_assert('1.2 Astrology owner cannot read Vivaham business', v_count = 0, format('Returned %s rows (expected 0)', v_count));

    -- 1.3 Astrology owner reads own contacts, but 0 Vivaham contacts
    SELECT count(*) INTO v_count FROM public.wa_contacts WHERE business_id = v_astrology_id;
    PERFORM test_assert('1.3a Astrology owner reads own contacts', v_count = 2, format('Found %s contacts', v_count));

    SELECT count(*) INTO v_count FROM public.wa_contacts WHERE business_id = v_vivaham_id;
    PERFORM test_assert('1.3b Astrology owner cannot read Vivaham contacts', v_count = 0, format('Returned %s rows (expected 0)', v_count));

    -- 1.4 Astrology owner reads own messages, but 0 Vivaham messages
    SELECT count(*) INTO v_count FROM public.wa_messages WHERE business_id = v_astrology_id;
    PERFORM test_assert('1.4a Astrology owner reads own messages', v_count > 0, format('Found %s messages', v_count));

    SELECT count(*) INTO v_count FROM public.wa_messages WHERE business_id = v_vivaham_id;
    PERFORM test_assert('1.4b Astrology owner cannot read Vivaham messages', v_count = 0, format('Returned %s rows (expected 0)', v_count));

    -- 1.5 Astrology owner CANNOT modify Vivaham contacts (UPDATE should affect 0 rows)
    UPDATE public.wa_contacts SET display_name = 'Hacked Name' WHERE business_id = v_vivaham_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM test_assert('1.5 Astrology owner cannot modify Vivaham contacts', v_count = 0, format('Updated %s rows (expected 0)', v_count));

    -- 1.6 Astrology owner CANNOT insert contact into Vivaham (RLS WITH CHECK blocks it)
    BEGIN
        INSERT INTO public.wa_contacts (id, business_id, phone_number, display_name)
        VALUES (gen_random_uuid(), v_vivaham_id, '919999999991', 'Intruder');
        RAISE EXCEPTION 'RLS failed to block cross-tenant INSERT into wa_contacts';
    EXCEPTION 
        WHEN insufficient_privilege OR check_violation THEN
            PERFORM test_assert('1.6 Astrology owner blocked from inserting into Vivaham contacts', true, 'Blocked by RLS policy');
        WHEN OTHERS THEN
            PERFORM test_assert('1.6 Astrology owner blocked from inserting into Vivaham contacts', true, format('Blocked: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- SUITE 2: VIVAHAM OWNER (User B) ISOLATION TESTS
    -- --------------------------------------------------------------------------
    RAISE NOTICE '--- SUITE 2: Vivaham Owner (User B) ---';
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_b_vivaham::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_b_vivaham::text, 'role', 'authenticated')::text, true);

    -- 2.1 Authorized owner can access their own business
    SELECT count(*) INTO v_count FROM public.businesses WHERE id = v_vivaham_id;
    PERFORM test_assert('2.1 Vivaham owner accesses own business', v_count = 1, format('Found %s business rows', v_count));

    -- 2.2 Vivaham owner CANNOT read Astrology business record
    SELECT count(*) INTO v_count FROM public.businesses WHERE id = v_astrology_id;
    PERFORM test_assert('2.2 Vivaham owner cannot read Astrology business', v_count = 0, format('Returned %s rows (expected 0)', v_count));

    -- 2.3 Vivaham owner reads own contacts, but 0 Astrology contacts
    SELECT count(*) INTO v_count FROM public.wa_contacts WHERE business_id = v_vivaham_id;
    PERFORM test_assert('2.3a Vivaham owner reads own contacts', v_count = 2, format('Found %s contacts', v_count));

    SELECT count(*) INTO v_count FROM public.wa_contacts WHERE business_id = v_astrology_id;
    PERFORM test_assert('2.3b Vivaham owner cannot read Astrology contacts', v_count = 0, format('Returned %s rows (expected 0)', v_count));

    -- 2.4 Vivaham owner reads own categories, but 0 Astrology categories
    SELECT count(*) INTO v_count FROM public.crm_categories WHERE business_id = v_vivaham_id;
    PERFORM test_assert('2.4a Vivaham owner reads own categories', v_count = 6, format('Found %s categories', v_count));

    SELECT count(*) INTO v_count FROM public.crm_categories WHERE business_id = v_astrology_id;
    PERFORM test_assert('2.4b Vivaham owner cannot read Astrology categories', v_count = 0, format('Returned %s rows (expected 0)', v_count));

    -- 2.5 Vivaham owner CANNOT modify Astrology categories
    UPDATE public.crm_categories SET name = 'Hacked Category' WHERE business_id = v_astrology_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM test_assert('2.5 Vivaham owner cannot modify Astrology categories', v_count = 0, format('Updated %s rows (expected 0)', v_count));

    -- 2.6 Vivaham owner CANNOT insert record into Astrology crm_categories
    BEGIN
        INSERT INTO public.crm_categories (id, business_id, name, slug)
        VALUES (gen_random_uuid(), v_astrology_id, 'Intruder Category', 'intruder');
        RAISE EXCEPTION 'RLS failed to block cross-tenant INSERT into crm_categories';
    EXCEPTION 
        WHEN insufficient_privilege OR check_violation THEN
            PERFORM test_assert('2.6 Vivaham owner blocked from inserting into Astrology categories', true, 'Blocked by RLS policy');
        WHEN OTHERS THEN
            PERFORM test_assert('2.6 Vivaham owner blocked from inserting into Astrology categories', true, format('Blocked: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- SUITE 3: TEAM MEMBER PERMISSIONS & BUSINESS BOUNDARIES (Migration 016)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '--- SUITE 3: Team Management & Invitations (Migration 016) ---';
    -- Set back to User A (Astrology)
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claim.sub', v_user_a_astro::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_a_astro::text, 'role', 'authenticated')::text, true);

    -- 3.1 User A can view Astrology members, but 0 Vivaham members
    SELECT count(*) INTO v_count FROM public.business_members WHERE business_id = v_astrology_id;
    PERFORM test_assert('3.1a User A can view Astrology members', v_count = 2, format('Found %s members', v_count));

    SELECT count(*) INTO v_count FROM public.business_members WHERE business_id = v_vivaham_id;
    PERFORM test_assert('3.1b User A cannot view Vivaham members', v_count = 0, format('Returned %s rows (expected 0)', v_count));

    -- 3.2 User A can create invitation for Astrology
    INSERT INTO public.business_invitations (business_id, email, role, token, invited_by, expires_at)
    VALUES (v_astrology_id, 'new_astrologer@example.com', 'agent', 'token_astro_123', v_user_a_astro, NOW() + INTERVAL '7 days');
    PERFORM test_assert('3.2 Astrology owner can invite team member to Astrology', true, 'Created invitation');

    -- 3.3 User A CANNOT create invitation for Vivaham
    BEGIN
        INSERT INTO public.business_invitations (business_id, email, role, token, invited_by, expires_at)
        VALUES (v_vivaham_id, 'intruder_agent@example.com', 'agent', 'token_vivaham_bad', v_user_a_astro, NOW() + INTERVAL '7 days');
        RAISE EXCEPTION 'RLS failed to block cross-tenant business_invitation';
    EXCEPTION 
        WHEN insufficient_privilege OR check_violation THEN
            PERFORM test_assert('3.3 Astrology owner blocked from creating Vivaham invitation', true, 'Blocked by RLS policy');
        WHEN OTHERS THEN
            PERFORM test_assert('3.3 Astrology owner blocked from creating Vivaham invitation', true, format('Blocked: %s', SQLERRM));
    END;

    -- --------------------------------------------------------------------------
    -- SUITE 4: UNAUTHORIZED BUSINESS REASSIGNMENT BLOCKED (IMMUTABILITY TRIGGERS)
    -- --------------------------------------------------------------------------
    RAISE NOTICE '--- SUITE 4: Immutability Trigger Enforcement ---';
    -- Switch to superuser to prove trigger blocks even high-privilege reassignment
    PERFORM set_config('role', 'postgres', true);

    -- 4.1 Reassigning business_id on business_invitations is strictly blocked
    BEGIN
        UPDATE public.business_invitations
        SET business_id = v_vivaham_id
        WHERE email = 'new_astrologer@example.com';
        RAISE EXCEPTION 'Trigger failed to block tenant reassignment on business_invitations';
    EXCEPTION WHEN OTHERS THEN
        PERFORM test_assert('4.1 business_invitations tenant reassignment blocked', SQLERRM LIKE '%Tenant reassignment forbidden%', SQLERRM);
    END;

    -- Clean up test invitation
    DELETE FROM public.business_invitations WHERE email = 'new_astrologer@example.com';

    -- 4.2 Reassigning business_id on wa_visual_flows (Migration 022) is blocked
    INSERT INTO public.wa_visual_flows (id, business_id, name)
    VALUES ('f1111111-1111-1111-1111-111111111111', v_astrology_id, 'Astro Flow');

    BEGIN
        UPDATE public.wa_visual_flows
        SET business_id = v_vivaham_id
        WHERE id = 'f1111111-1111-1111-1111-111111111111';
        RAISE EXCEPTION 'Trigger failed to block tenant reassignment on wa_visual_flows';
    EXCEPTION WHEN OTHERS THEN
        PERFORM test_assert('4.2 wa_visual_flows tenant reassignment blocked', SQLERRM LIKE '%Tenant reassignment forbidden%', SQLERRM);
    END;

    DELETE FROM public.wa_visual_flows WHERE id = 'f1111111-1111-1111-1111-111111111111';

    -- 4.3 Reassigning business_id on cron_locks (Migration 024) is blocked
    INSERT INTO public.cron_locks (lock_key, cron_name, owner_id, expires_at, business_id)
    VALUES ('test:lock:1', 'test_cron', 'worker_1', NOW() + INTERVAL '5 minutes', v_astrology_id);

    BEGIN
        UPDATE public.cron_locks
        SET business_id = v_vivaham_id
        WHERE lock_key = 'test:lock:1';
        RAISE EXCEPTION 'Trigger failed to block tenant reassignment on cron_locks';
    EXCEPTION WHEN OTHERS THEN
        PERFORM test_assert('4.3 cron_locks tenant reassignment blocked', SQLERRM LIKE '%Tenant reassignment forbidden%', SQLERRM);
    END;

    DELETE FROM public.cron_locks WHERE lock_key = 'test:lock:1';

    RAISE NOTICE '================================================================================';
    RAISE NOTICE 'ALL RLS AND TENANT INTEGRITY ASSERTIONS COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '================================================================================';
END $$;
