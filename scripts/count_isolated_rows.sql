DO $$
DECLARE
    r RECORD;
    v_count BIGINT;
    v_total BIGINT := 0;
BEGIN
    FOR r IN SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name LOOP
        EXECUTE format('SELECT count(*) FROM public.%I', r.table_name) INTO v_count;
        RAISE NOTICE '%: %', rpad(r.table_name, 30), v_count;
        v_total := v_total + v_count;
    END LOOP;
    RAISE NOTICE 'TOTAL ROWS: %', v_total;
END $$;
