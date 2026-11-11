--
-- PostgreSQL database dump
--

\restrict Ypzd4rtVWCz6LioCBzlfrYtfE6rnED7AC6PHd5eefZZ0dgg2Dr1ROz83qCi7vjj

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA extensions;


ALTER SCHEMA extensions OWNER TO postgres;

--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql;


ALTER SCHEMA graphql OWNER TO supabase_admin;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA graphql_public;


ALTER SCHEMA graphql_public OWNER TO supabase_admin;

--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: pgbouncer
--

CREATE SCHEMA pgbouncer;


ALTER SCHEMA pgbouncer OWNER TO pgbouncer;

--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA realtime;


ALTER SCHEMA realtime OWNER TO supabase_admin;

--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA storage;


ALTER SCHEMA storage OWNER TO supabase_admin;

--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA supabase_migrations;


ALTER SCHEMA supabase_migrations OWNER TO postgres;

--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA vault;


ALTER SCHEMA vault OWNER TO supabase_admin;

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone',
    'recovery_code'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: action; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE realtime.action OWNER TO supabase_realtime_admin;

--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in',
    'like',
    'ilike',
    'is',
    'match',
    'imatch',
    'isdistinct'
);


ALTER TYPE realtime.equality_op OWNER TO supabase_realtime_admin;

--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text,
	negate boolean
);


ALTER TYPE realtime.user_defined_filter OWNER TO supabase_realtime_admin;

--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


ALTER TYPE realtime.wal_column OWNER TO supabase_realtime_admin;

--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


ALTER TYPE realtime.wal_rls OWNER TO supabase_realtime_admin;

--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE storage.buckettype OWNER TO supabase_storage_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
    revoke trigger on cron.job_run_details from postgres;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_cron_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
begin
    if not exists (
        select 1
        from pg_catalog.pg_event_trigger_ddl_commands() ev
        join pg_catalog.pg_extension e on ev.objid = e.oid
        where e.extname = 'pg_graphql'
    ) then
        return;
    end if;

    drop function if exists graphql_public.graphql;
    create or replace function graphql_public.graphql(
        "operationName" text default null,
        query text default null,
        variables jsonb default null,
        extensions jsonb default null
    )
        returns jsonb
        language sql
    as $$
        select graphql.resolve(
            query := query,
            variables := coalesce(variables, '{}'),
            "operationName" := "operationName",
            extensions := extensions
        );
    $$;

    -- Attach the wrapper to the extension so DROP EXTENSION cascades to it,
    -- which in turn triggers set_graphql_placeholder to reinstall the "not enabled" stub.
    alter extension pg_graphql add function graphql_public.graphql(text, text, jsonb, jsonb);

    grant usage on schema graphql to postgres, anon, authenticated, service_role;
    grant execute on function graphql.resolve to postgres, anon, authenticated, service_role;
    grant usage on schema graphql to postgres with grant option;
    grant usage on schema graphql_public to postgres with grant option;
end;
$_$;


ALTER FUNCTION extensions.grant_pg_graphql_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8.0', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


ALTER FUNCTION extensions.grant_pg_net_access() OWNER TO supabase_admin;

--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_ddl_watch() OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


ALTER FUNCTION extensions.pgrst_drop_watch() OWNER TO supabase_admin;

--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: supabase_admin
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
            set search_path to ''
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


ALTER FUNCTION extensions.set_graphql_placeholder() OWNER TO supabase_admin;

--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: supabase_admin
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: graphql(text, text, jsonb, jsonb); Type: FUNCTION; Schema: graphql_public; Owner: supabase_admin
--

CREATE FUNCTION graphql_public.graphql("operationName" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;


ALTER FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) OWNER TO supabase_admin;

--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: supabase_admin
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


ALTER FUNCTION pgbouncer.get_auth(p_usename text) OWNER TO supabase_admin;

--
-- Name: check_user_business_access(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_user_business_access(b_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = b_id
      AND bm.user_id = auth.uid()
      AND bm.is_active = TRUE
  );
$$;


ALTER FUNCTION public.check_user_business_access(b_id uuid) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: wa_processing_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_processing_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    connection_id uuid,
    job_type text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    last_error text,
    locked_at timestamp with time zone,
    scheduled_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    idempotency_key text,
    locked_by text,
    CONSTRAINT wa_processing_jobs_job_type_check CHECK ((job_type = ANY (ARRAY['send_message'::text, 'send_outbound_message'::text, 'evaluate_rules'::text, 'evaluate_automation_rules'::text, 'scheduled_followup'::text, 'process_webhook'::text, 'process_webhook_event'::text, 'update_status'::text]))),
    CONSTRAINT wa_processing_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


ALTER TABLE public.wa_processing_jobs OWNER TO postgres;

--
-- Name: claim_next_wa_jobs(integer, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.claim_next_wa_jobs(p_batch_size integer DEFAULT 10, p_worker_id text DEFAULT 'worker_anon'::text) RETURNS SETOF public.wa_processing_jobs
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    RETURN QUERY
    WITH selected_jobs AS (
        SELECT id
        FROM public.wa_processing_jobs
        WHERE status = 'pending'
          AND scheduled_at <= TIMEZONE('utc', NOW())
        ORDER BY scheduled_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    UPDATE public.wa_processing_jobs j
    SET status = 'processing',
        locked_at = TIMEZONE('utc', NOW()),
        locked_by = p_worker_id,
        updated_at = TIMEZONE('utc', NOW())
    FROM selected_jobs s
    WHERE j.id = s.id
    RETURNING j.*;
END;
$$;


ALTER FUNCTION public.claim_next_wa_jobs(p_batch_size integer, p_worker_id text) OWNER TO postgres;

--
-- Name: FUNCTION claim_next_wa_jobs(p_batch_size integer, p_worker_id text); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.claim_next_wa_jobs(p_batch_size integer, p_worker_id text) IS 'Claims next batch of pending processing jobs using FOR UPDATE SKIP LOCKED. Restricted to service_role.';


--
-- Name: get_business_analytics_daily_trends(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_business_analytics_daily_trends(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_trends JSONB;
BEGIN
    -- Strict tenant authorization check
    IF NOT public.check_user_business_access(p_business_id) AND NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not have access to business tenant %', p_business_id;
    END IF;

    WITH dates AS (
        SELECT generate_series(
            (TIMEZONE('Asia/Kolkata', p_start_date))::date,
            (TIMEZONE('Asia/Kolkata', p_end_date))::date,
            '1 day'::interval
        )::date AS day_date
    ),
    msg_counts AS (
        SELECT
            (TIMEZONE('Asia/Kolkata', created_at))::date AS day_date,
            COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound,
            COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound,
            COUNT(*) FILTER (WHERE direction = 'outbound' AND status IN ('delivered', 'read')) AS delivered,
            COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'read') AS read_count,
            COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'failed') AS failed
        FROM public.wa_messages
        WHERE business_id = p_business_id
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY 1
    ),
    contact_counts AS (
        SELECT
            (TIMEZONE('Asia/Kolkata', created_at))::date AS day_date,
            COUNT(*) AS new_contacts
        FROM public.wa_contacts
        WHERE business_id = p_business_id
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY 1
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'date', to_char(d.day_date, 'YYYY-MM-DD'),
            'inbound', COALESCE(m.inbound, 0),
            'outbound', COALESCE(m.outbound, 0),
            'total', COALESCE(m.inbound, 0) + COALESCE(m.outbound, 0),
            'delivered', COALESCE(m.delivered, 0),
            'read', COALESCE(m.read_count, 0),
            'failed', COALESCE(m.failed, 0),
            'new_contacts', COALESCE(c.new_contacts, 0)
        ) ORDER BY d.day_date ASC
    )
    INTO v_trends
    FROM dates d
    LEFT JOIN msg_counts m ON m.day_date = d.day_date
    LEFT JOIN contact_counts c ON c.day_date = d.day_date;

    RETURN COALESCE(v_trends, '[]'::jsonb);
END;
$$;


ALTER FUNCTION public.get_business_analytics_daily_trends(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) OWNER TO postgres;

--
-- Name: get_business_analytics_summary(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_business_analytics_summary(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_messaging JSONB;
    v_contacts JSONB;
    v_conversations JSONB;
    v_automations JSONB;
    v_response_time_seconds NUMERIC := NULL;
    v_total_contacts INT := 0;
BEGIN
    -- Strict tenant authorization check: Caller must be a member or superadmin
    IF NOT public.check_user_business_access(p_business_id) AND NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Unauthorized: Caller does not have access to business tenant %', p_business_id;
    END IF;

    -- A. Messaging Analytics Aggregation
    SELECT jsonb_build_object(
        'total_inbound', COALESCE(COUNT(*) FILTER (WHERE direction = 'inbound'), 0),
        'total_outbound', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound'), 0),
        'delivered', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound' AND status IN ('delivered', 'read')), 0),
        'read', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'read'), 0),
        'failed', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'failed'), 0),
        'pending', COALESCE(COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'pending'), 0)
    )
    INTO v_messaging
    FROM public.wa_messages
    WHERE business_id = p_business_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- B. Contact Analytics Aggregation
    SELECT COUNT(*) INTO v_total_contacts
    FROM public.wa_contacts
    WHERE business_id = p_business_id;

    SELECT jsonb_build_object(
        'total_contacts', v_total_contacts,
        'new_contacts', COALESCE(COUNT(*) FILTER (WHERE created_at >= p_start_date AND created_at <= p_end_date), 0),
        'active_contacts', COALESCE(COUNT(*) FILTER (WHERE (total_inbound_count > 0 OR last_inbound_at >= p_start_date)), 0),
        'opted_out_contacts', COALESCE(COUNT(*) FILTER (WHERE is_opted_out = true), 0)
    )
    INTO v_contacts
    FROM public.wa_contacts
    WHERE business_id = p_business_id;

    -- C. Inbox & Conversation Analytics Aggregation
    SELECT jsonb_build_object(
        'total_conversations', COALESCE(COUNT(*), 0),
        'open_conversations', COALESCE(COUNT(*) FILTER (WHERE status = 'open'), 0),
        'pending_human', COALESCE(COUNT(*) FILTER (WHERE status = 'pending_human'), 0),
        'closed_conversations', COALESCE(COUNT(*) FILTER (WHERE status = 'closed'), 0),
        'unread_conversations', COALESCE(COUNT(*) FILTER (WHERE unread_count > 0), 0)
    )
    INTO v_conversations
    FROM public.wa_conversations
    WHERE business_id = p_business_id
      AND (created_at <= p_end_date OR last_message_at >= p_start_date);

    -- D. First-Response Time Calculation (where accurate timestamps exist)
    -- Computes average seconds between first inbound message and first subsequent outbound message
    WITH first_inbound AS (
        SELECT conversation_id, MIN(created_at) AS first_inbound_at
        FROM public.wa_messages
        WHERE business_id = p_business_id
          AND direction = 'inbound'
          AND created_at >= p_start_date
          AND created_at <= p_end_date
        GROUP BY conversation_id
    ),
    first_response AS (
        SELECT fi.conversation_id,
               fi.first_inbound_at,
               MIN(m.created_at) AS first_outbound_at
        FROM first_inbound fi
        JOIN public.wa_messages m
          ON m.conversation_id = fi.conversation_id
         AND m.business_id = p_business_id
         AND m.direction = 'outbound'
         AND m.created_at >= fi.first_inbound_at
        GROUP BY fi.conversation_id, fi.first_inbound_at
    )
    SELECT AVG(EXTRACT(EPOCH FROM (first_outbound_at - first_inbound_at)))
    INTO v_response_time_seconds
    FROM first_response;

    -- E. Automation Analytics Aggregation
    SELECT jsonb_build_object(
        'total_rules', (SELECT COUNT(*) FROM public.wa_automation_rules WHERE business_id = p_business_id),
        'active_rules', (SELECT COUNT(*) FROM public.wa_automation_rules WHERE business_id = p_business_id AND is_active = true),
        'inactive_rules', (SELECT COUNT(*) FROM public.wa_automation_rules WHERE business_id = p_business_id AND is_active = false),
        'executed_jobs', COALESCE(COUNT(*), 0),
        'successful_executions', COALESCE(COUNT(*) FILTER (WHERE status = 'success'), 0),
        'failed_executions', COALESCE(COUNT(*) FILTER (WHERE status = 'failed'), 0),
        'skipped_executions', COALESCE(COUNT(*) FILTER (WHERE status = 'skipped'), 0)
    )
    INTO v_automations
    FROM public.wa_automation_execution_logs
    WHERE business_id = p_business_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date;

    -- Return consolidated JSONB object
    RETURN jsonb_build_object(
        'business_id', p_business_id,
        'start_date', p_start_date,
        'end_date', p_end_date,
        'messaging', COALESCE(v_messaging, '{}'::jsonb),
        'contacts', COALESCE(v_contacts, '{}'::jsonb),
        'conversations', COALESCE(v_conversations, '{}'::jsonb),
        'automations', COALESCE(v_automations, '{}'::jsonb),
        'avg_first_response_seconds', v_response_time_seconds
    );
END;
$$;


ALTER FUNCTION public.get_business_analytics_summary(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) OWNER TO postgres;

--
-- Name: get_inbox_counts(uuid, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_inbox_counts(p_business_id uuid, p_connection_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'all', COALESCE(COUNT(*) FILTER (WHERE status != 'archived'), 0),
        'unread', COALESCE(COUNT(*) FILTER (WHERE unread_count > 0 AND status != 'archived'), 0),
        'unassigned', COALESCE(COUNT(*) FILTER (WHERE status != 'archived'), 0),
        'assigned_to_me', COALESCE(COUNT(*) FILTER (WHERE status != 'archived'), 0),
        'open', COALESCE(COUNT(*) FILTER (WHERE status = 'open'), 0),
        'pending', COALESCE(COUNT(*) FILTER (WHERE status = 'pending_human'), 0),
        'resolved', COALESCE(COUNT(*) FILTER (WHERE status = 'closed'), 0),
        'archived', COALESCE(COUNT(*) FILTER (WHERE status = 'archived'), 0)
    )
    INTO v_result
    FROM public.wa_conversations
    WHERE business_id = p_business_id
      AND (p_connection_id IS NULL OR connection_id = p_connection_id);

    RETURN COALESCE(v_result, jsonb_build_object(
        'all', 0, 'unread', 0, 'unassigned', 0, 'assigned_to_me', 0,
        'open', 0, 'pending', 0, 'resolved', 0, 'archived', 0
    ));
END;
$$;


ALTER FUNCTION public.get_inbox_counts(p_business_id uuid, p_connection_id uuid) OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
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


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: ingest_wa_inbound_message(text, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ingest_wa_inbound_message(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text DEFAULT NULL::text, p_message_type text DEFAULT 'text'::text, p_content text DEFAULT ''::text, p_raw_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_conn RECORD;
    v_contact_id UUID;
    v_conversation_id UUID;
    v_message_id UUID;
    v_event_processed BOOLEAN;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
BEGIN
    SELECT id, business_id, is_enabled
    INTO v_conn
    FROM public.wa_connections
    WHERE phone_number_id = p_phone_number_id
    LIMIT 1;

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

    UPDATE public.wa_connections
    SET last_message_at = v_now
    WHERE id = v_conn.id;

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


ALTER FUNCTION public.ingest_wa_inbound_message(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) OWNER TO postgres;

--
-- Name: ingest_wa_inbound_message_v2(text, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.ingest_wa_inbound_message_v2(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text DEFAULT NULL::text, p_message_type text DEFAULT 'text'::text, p_content text DEFAULT ''::text, p_raw_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
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


ALTER FUNCTION public.ingest_wa_inbound_message_v2(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) OWNER TO postgres;

--
-- Name: FUNCTION ingest_wa_inbound_message_v2(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.ingest_wa_inbound_message_v2(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) IS 'Atomically ingests inbound WhatsApp messages, contacts, conversations, and enqueues evaluation jobs in a single transaction. Restricted strictly to service_role.';


--
-- Name: is_business_owner(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_business_owner(b_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = b_id
      AND bm.user_id = auth.uid()
      AND bm.role = 'owner'
      AND bm.is_active = TRUE
  );
$$;


ALTER FUNCTION public.is_business_owner(b_id uuid) OWNER TO postgres;

--
-- Name: is_business_owner_or_admin(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_business_owner_or_admin(b_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_members bm
    WHERE bm.business_id = b_id
      AND bm.user_id = auth.uid()
      AND bm.role IN ('owner', 'admin')
      AND bm.is_active = TRUE
  );
$$;


ALTER FUNCTION public.is_business_owner_or_admin(b_id uuid) OWNER TO postgres;

--
-- Name: is_superadmin(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.is_superadmin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.is_superadmin = TRUE
  );
$$;


ALTER FUNCTION public.is_superadmin() OWNER TO postgres;

--
-- Name: prevent_business_member_tenant_reassignment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_business_member_tenant_reassignment() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'Tenant reassignment forbidden: business_id on business_members cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_business_member_tenant_reassignment() OWNER TO postgres;

--
-- Name: prevent_business_settings_tenant_reassignment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_business_settings_tenant_reassignment() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
        RAISE EXCEPTION 'Tenant reassignment forbidden: business_id on business_settings cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_business_settings_tenant_reassignment() OWNER TO postgres;

--
-- Name: prevent_tenant_reassignment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_tenant_reassignment() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
        RAISE EXCEPTION 'Tenant reassignment forbidden: business_id cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_tenant_reassignment() OWNER TO postgres;

--
-- Name: prevent_user_profile_privilege_escalation(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_user_profile_privilege_escalation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
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


ALTER FUNCTION public.prevent_user_profile_privilege_escalation() OWNER TO postgres;

--
-- Name: prevent_wa_connection_tenant_reassignment(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prevent_wa_connection_tenant_reassignment() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
        RAISE EXCEPTION 'Tenant reassignment forbidden: business_id on wa_connections cannot be modified.';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.prevent_wa_connection_tenant_reassignment() OWNER TO postgres;

--
-- Name: prune_stale_automation_records(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prune_stale_automation_records() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$ DECLARE     v_pruned_logs INT;     v_pruned_jobs INT;     v_pruned_events INT; BEGIN     /* 1. Delete execution logs older than 14 days */     DELETE FROM public.wa_automation_execution_logs     WHERE created_at < TIMEZONE('utc', NOW()) - INTERVAL '14 days';     GET DIAGNOSTICS v_pruned_logs = ROW_COUNT;      /* 2. Delete completed or failed jobs older than 7 days */     DELETE FROM public.wa_processing_jobs     WHERE status IN ('completed', 'failed')       AND updated_at < TIMEZONE('utc', NOW()) - INTERVAL '7 days';     GET DIAGNOSTICS v_pruned_jobs = ROW_COUNT;      /* 3. Delete processed webhook events older than 7 days */     DELETE FROM public.wa_webhook_events     WHERE is_processed = TRUE       AND created_at < TIMEZONE('utc', NOW()) - INTERVAL '7 days';     GET DIAGNOSTICS v_pruned_events = ROW_COUNT;      RETURN jsonb_build_object(         'pruned_logs', v_pruned_logs,         'pruned_jobs', v_pruned_jobs,         'pruned_events', v_pruned_events     ); END; $$;


ALTER FUNCTION public.prune_stale_automation_records() OWNER TO postgres;

--
-- Name: reclaim_stuck_wa_jobs(integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.reclaim_stuck_wa_jobs(p_timeout_minutes integer DEFAULT 5) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
    v_reclaimed_count INT;
BEGIN
    WITH stuck AS (
        SELECT id
        FROM public.wa_processing_jobs
        WHERE status = 'processing'
          AND locked_at < TIMEZONE('utc', NOW()) - (p_timeout_minutes || ' minutes')::interval
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.wa_processing_jobs j
    SET status = CASE 
            WHEN j.attempts + 1 >= j.max_attempts THEN 'failed'
            ELSE 'pending'
        END,
        attempts = j.attempts + 1,
        last_error = 'Worker timeout: job reclaimed after ' || p_timeout_minutes || 'm inactivity',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = TIMEZONE('utc', NOW())
    FROM stuck s
    WHERE j.id = s.id;

    GET DIAGNOSTICS v_reclaimed_count = ROW_COUNT;
    RETURN v_reclaimed_count;
END;
$$;


ALTER FUNCTION public.reclaim_stuck_wa_jobs(p_timeout_minutes integer) OWNER TO postgres;

--
-- Name: FUNCTION reclaim_stuck_wa_jobs(p_timeout_minutes integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.reclaim_stuck_wa_jobs(p_timeout_minutes integer) IS 'Reclaims abandoned processing jobs locked longer than timeout threshold. Restricted to service_role.';


--
-- Name: update_wa_message_status(text, text, text, timestamp with time zone, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_wa_message_status(p_phone_number_id text, p_meta_message_id text, p_status text, p_timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()), p_error_code text DEFAULT NULL::text, p_error_message text DEFAULT NULL::text, p_raw_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
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


ALTER FUNCTION public.update_wa_message_status(p_phone_number_id text, p_meta_message_id text, p_status text, p_timestamp timestamp with time zone, p_error_code text, p_error_message text, p_raw_payload jsonb) OWNER TO postgres;

--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
    -- Regclass of the table e.g. public.notes
    entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

    -- I, U, D, T: insert, update ...
    action realtime.action = (
        case wal ->> 'action'
            when 'I' then 'INSERT'
            when 'U' then 'UPDATE'
            when 'D' then 'DELETE'
            else 'ERROR'
        end
    );

    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

    subscriptions realtime.subscription[] = array_agg(subs)
        from
            realtime.subscription subs
        where
            subs.entity = entity_
            -- Filter by action early - only get subscriptions interested in this action
            -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
            and (subs.action_filter = '*' or subs.action_filter = action::text);

    -- Subscription vars
    working_role regrole;
    working_selected_columns text[];
    claimed_role regrole;
    claims jsonb;

    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';

    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];

    -- the same values as wal2json sent them, which is what filters compare against
    raw_columns realtime.wal_column[] =
        array_agg((x->>'name', x->>'type', x->>'typeoid', x->'value', null, null)::realtime.wal_column)
        from jsonb_array_elements(wal -> 'columns') x;
    raw_old_columns realtime.wal_column[] =
        array_agg((x->>'name', x->>'type', x->>'typeoid', x->'value', null, null)::realtime.wal_column)
        from jsonb_array_elements(wal -> 'identity') x;

    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

    -- Primary jsonb output for record
    output jsonb;

    -- Loop record for iterating unique roles (outer loop)
    role_record record;
    -- Loop record for iterating unique selected_columns within a role (inner loop)
    cols_record record;
    -- Subscription ids visible at the role level (before fanning out by selected_columns)
    visible_role_sub_ids uuid[] = '{}';

begin
    perform set_config('role', null, true);

    columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'columns') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    old_columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'identity') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    for role_record in
        select claims_role
        from (select distinct claims_role from unnest(subscriptions)) t
        order by claims_role::text
    loop
        working_role := role_record.claims_role;

        -- Update `is_selectable` for columns and old_columns (once per role)
        columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(columns) c;

        old_columns =
                array_agg(
                    (
                        c.name,
                        c.type_name,
                        c.type_oid,
                        c.value,
                        c.is_pkey,
                        pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                    )::realtime.wal_column
                )
                from
                    unnest(old_columns) c;

        if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
            -- Fan out 400 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 400: Bad Request, no primary key']
                )::realtime.wal_rls;
            end loop;

        -- The claims role does not have SELECT permission to the primary key of entity
        elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
            -- Fan out 401 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 401: Unauthorized']
                )::realtime.wal_rls;
            end loop;

        else
            -- Create the prepared statement (once per role)
            if is_rls_enabled and action <> 'DELETE' then
                if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                    deallocate walrus_rls_stmt;
                end if;
                execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
            end if;

            -- Collect all visible subscription IDs for this role (filter check + RLS check)
            visible_role_sub_ids = '{}';

            for subscription_id, claims in (
                    select
                        subs.subscription_id,
                        subs.claims
                    from
                        unnest(subscriptions) subs
                    where
                        subs.entity = entity_
                        and subs.claims_role = working_role
                        and (
                            realtime.is_visible_through_filters(raw_columns, subs.filters)
                            or (
                              action = 'DELETE'
                              and realtime.is_visible_through_filters(raw_old_columns, subs.filters)
                            )
                        )
            ) loop

                if not is_rls_enabled or action = 'DELETE' then
                    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                else
                    -- Check if RLS allows the role to see the record
                    perform
                        -- Trim leading and trailing quotes from working_role because set_config
                        -- doesn't recognize the role as valid if they are included
                        set_config('role', trim(both '"' from working_role::text), true),
                        set_config('request.jwt.claims', claims::text, true);

                    execute 'execute walrus_rls_stmt' into subscription_has_access;

                    -- Reset the role on every FOR..LOOP batch execution.
                    -- The first batch of 10 rows is pre-fetched using the current connection role (PG internal behaviour)
                    -- then we have to reset it again otherwise it would use the role defined in the `set_config` above
                    -- to fetch the remaining rows when rows>10, which could be a user-defined role that lacks execution grants.
                    -- The flow is:
                    --   1. run batch with conn role
                    --   2. set_config working_role
                    --   3. execute walrus
                    --   4. reset role (revert)
                    --   5. repeat
                    perform set_config('role', null, true);

                    if subscription_has_access then
                        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                    end if;
                end if;
            end loop;

            perform set_config('role', null, true);

            -- Inner loop: per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;

                output = jsonb_build_object(
                    'schema', wal ->> 'schema',
                    'table', wal ->> 'table',
                    'type', action,
                    'commit_timestamp', to_char(
                        ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ),
                    'columns', (
                        select
                            jsonb_agg(
                                jsonb_build_object(
                                    'name', pa.attname,
                                    'type', pt.typname
                                )
                                order by pa.attnum asc
                            )
                        from
                            pg_attribute pa
                            join pg_type pt
                                on pa.atttypid = pt.oid
                            left join (
                                select unnest(conkey) as pkey_attnum
                                from pg_constraint
                                where conrelid = entity_ and contype = 'p'
                            ) pk on pk.pkey_attnum = pa.attnum
                        where
                            attrelid = entity_
                            and attnum > 0
                            and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
                            and (working_selected_columns is null or pa.attname = any(working_selected_columns) or pk.pkey_attnum is not null)
                    )
                )
                -- Add "record" key for insert and update
                || case
                    when action in ('INSERT', 'UPDATE') then
                        jsonb_build_object(
                            'record',
                            (
                                select
                                    jsonb_object_agg(
                                        -- if unchanged toast, get column name and value from old record
                                        coalesce((c).name, (oc).name),
                                        case
                                            when (c).name is null then (oc).value
                                            else (c).value
                                        end
                                    )
                                from
                                    unnest(columns) c
                                    full outer join unnest(old_columns) oc
                                        on (c).name = (oc).name
                                where
                                    coalesce((c).is_selectable, (oc).is_selectable)
                                    and (working_selected_columns is null or coalesce((c).name, (oc).name) = any(working_selected_columns) or coalesce((c).is_pkey, (oc).is_pkey))
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            )
                        )
                    else '{}'::jsonb
                end
                -- Add "old_record" key for update and delete
                || case
                    when action = 'UPDATE' then
                        jsonb_build_object(
                                'old_record',
                                (
                                    select jsonb_object_agg((c).name, (c).value)
                                    from unnest(old_columns) c
                                    where
                                        (c).is_selectable
                                        and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                        and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                )
                            )
                    when action = 'DELETE' then
                        jsonb_build_object(
                            'old_record',
                            (
                                select jsonb_object_agg((c).name, (c).value)
                                from unnest(old_columns) c
                                where
                                    (c).is_selectable
                                    and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                    and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                            )
                        )
                    else '{}'::jsonb
                end;

                -- Filter visible_role_sub_ids to those matching the current selected_columns group
                visible_to_subscription_ids = coalesce(
                    (
                        select array_agg(s.subscription_id)
                        from unnest(subscriptions) s
                        where s.claims_role = working_role
                          and (s.selected_columns is not distinct from working_selected_columns)
                          and s.subscription_id = any(visible_role_sub_ids)
                    ),
                    '{}'::uuid[]
                );

                return next (
                    output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    case
                        when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                        else '{}'
                    end
                )::realtime.wal_rls;
            end loop;

        end if;
    end loop;

    perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) OWNER TO supabase_realtime_admin;

--
-- Name: authorize(text, text, text, text, text, text[], text[]); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.authorize(role_name text, topic_name text, claims text, sub text, headers text, read_extensions text[], write_extensions text[], OUT read_allowed boolean[], OUT write_allowed boolean[]) RETURNS record
    LANGUAGE plpgsql
    AS $$
declare
  probe_ids uuid[];
  probe_inserted_at timestamp := now() at time zone 'utc';
  visible_ids uuid[];
  ext text;
  allowed boolean;
begin
  -- The probe inserts are rolled back, but they still give the transaction an xid, so it ends
  -- in a commit. Nothing durable was written, so skip waiting on the WAL flush and sync standbys.
  -- Set outside the block below, whose rollback would undo it.
  perform set_config('synchronous_commit', 'off', true);

  -- The RAISE at the end of this block rolls back everything in it.
  begin
    probe_ids := array(select gen_random_uuid() from unnest(read_extensions));

    insert into realtime.messages (id, topic, extension, inserted_at, updated_at)
    select p.id, topic_name, p.extension, probe_inserted_at, probe_inserted_at
    from unnest(probe_ids, read_extensions) as p(id, extension);

    perform set_config('role', role_name, true),
            set_config('realtime.topic', topic_name, true),
            set_config('request.jwt.claims', claims, true),
            set_config('request.jwt.claim.sub', sub, true),
            set_config('request.jwt.claim.role', role_name, true),
            set_config('request.headers', headers, true);

    -- One lookup for every probe, by the full primary key.
    visible_ids := array(
      select m.id
      from realtime.messages m
      where m.inserted_at = probe_inserted_at
        and m.id = any(probe_ids));

    read_allowed := array(
      select p.id = any(visible_ids)
      from unnest(probe_ids) with ordinality as p(id, n)
      order by p.n);

    write_allowed := '{}';

    foreach ext in array write_extensions loop
      begin
        insert into realtime.messages (topic, extension, inserted_at, updated_at)
        values (topic_name, ext, now() at time zone 'utc', now() at time zone 'utc');

        allowed := true;
      exception when insufficient_privilege then
        allowed := false;
      end;

      write_allowed := write_allowed || allowed;
    end loop;

    raise sqlstate 'RTA01';
  exception when sqlstate 'RTA01' then
    null;
  end;
end;
$$;


ALTER FUNCTION realtime.authorize(role_name text, topic_name text, claims text, sub text, headers text, read_extensions text[], write_extensions text[], OUT read_allowed boolean[], OUT write_allowed boolean[]) OWNER TO supabase_realtime_admin;

--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) OWNER TO supabase_realtime_admin;

--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) OWNER TO supabase_realtime_admin;

--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


ALTER FUNCTION realtime."cast"(val text, type_ regtype) OWNER TO supabase_realtime_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
/*
Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
*/
declare
    op_symbol text = (
        case
            when op = 'eq' then '='
            when op = 'neq' then '!='
            when op = 'lt' then '<'
            when op = 'lte' then '<='
            when op = 'gt' then '>'
            when op = 'gte' then '>='
            when op = 'in' then '= any'
            else 'UNKNOWN OP'
        end
    );
    res boolean;
begin
    execute format(
        'select %L::'|| type_::text || ' ' || op_symbol
        || ' ( %L::'
        || (
            case
                when op = 'in' then type_::text || '[]'
                else type_::text end
        )
        || ')', val_1, val_2) into res;
    return res;
end;
$$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) OWNER TO supabase_realtime_admin;

--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
    op_symbol text;
    res boolean;
begin
    -- IS DISTINCT FROM / IS NOT DISTINCT FROM: infix, both sides typed literals
    if op = 'isdistinct' then
        execute format(
            'select %L::%s %s %L::%s',
            val_1,
            type_::text,
            case when negate then 'IS NOT DISTINCT FROM' else 'IS DISTINCT FROM' end,
            val_2,
            type_::text
        ) into res;
        return res;
    end if;

    -- IS requires a keyword RHS (NULL, TRUE, FALSE, UNKNOWN), not a typed literal
    if op = 'is' then
        if val_2 not in ('null', 'true', 'false', 'unknown') then
            raise exception 'invalid value for is filter: must be null, true, false, or unknown';
        end if;
        execute format(
            'select %L::%s %s %s',
            val_1,
            type_::text,
            case when negate then 'IS NOT' else 'IS' end,
            upper(val_2)
        ) into res;
        return res;
    end if;

    op_symbol = case
        when op = 'eq'    then '='
        when op = 'neq'   then '!='
        when op = 'lt'    then '<'
        when op = 'lte'   then '<='
        when op = 'gt'    then '>'
        when op = 'gte'   then '>='
        when op = 'in'    then '= any'
        when op = 'like'   then 'LIKE'
        when op = 'ilike'  then 'ILIKE'
        when op = 'match'  then '~'
        when op = 'imatch' then '~*'
        else null
    end;

    if op_symbol is null then
        raise exception 'unsupported equality operator: %', op::text;
    end if;

    execute format(
        'select %L::%s %s (%L::%s)',
        val_1,
        type_::text,
        op_symbol,
        val_2,
        case when op = 'in' then type_::text || '[]' else type_::text end
    ) into res;

    return case when negate then not res else res end;
end;
$$;


ALTER FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) OWNER TO supabase_realtime_admin;

--
-- Name: filters_hash(realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.filters_hash(filters realtime.user_defined_filter[]) RETURNS bytea
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $$
  select pg_catalog.int8send(pg_catalog.hash_array_extended(filters, 0))
      || pg_catalog.int8send(pg_catalog.hash_array_extended(filters, 1))
$$;


ALTER FUNCTION realtime.filters_hash(filters realtime.user_defined_filter[]) OWNER TO supabase_realtime_admin;

--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
    select
        filters is null
        or array_length(filters, 1) is null
        or coalesce(
            count(col.name) = count(1)
            and sum(
                realtime.check_equality_op(
                    op:=f.op,
                    type_:=coalesce(col.type_oid::regtype, col.type_name::regtype),
                    val_1:=col.value #>> '{}',
                    val_2:=f.value,
                    negate:=coalesce(f.negate, false)
                )::int
            ) filter (where col.name is not null) = count(col.name),
            false
        )
    from
        unnest(filters) f
        left join unnest(columns) col
            on f.column_name = col.name;
$$;


ALTER FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) OWNER TO supabase_realtime_admin;

--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


ALTER FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_realtime_admin;

--
-- Name: list_changes_sync(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.list_changes_sync(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS TABLE(wal jsonb, is_rls_enabled boolean, subscription_ids uuid[], errors text[], slot_changes_count bigint)
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures the slot is read exactly once.
  consumed AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         realtime.settled_changes(
           slot_name, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM consumed
    WHERE consumed.w2j_add_tables <> ''
  ),
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM consumed,
         realtime.apply_rls(
           wal := consumed.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE consumed.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


ALTER FUNCTION realtime.list_changes_sync(publication name, slot_name name, max_changes integer, max_record_bytes integer) OWNER TO supabase_realtime_admin;

--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  SELECT
    realtime.wal2json_escape_identifier(nsp.nspname::text)
    || '.'
    || realtime.wal2json_escape_identifier(pc.relname::text)
  FROM pg_class pc
  JOIN pg_namespace nsp ON pc.relnamespace = nsp.oid
  WHERE pc.oid = entity
$$;


ALTER FUNCTION realtime.quote_wal2json(entity regclass) OWNER TO supabase_realtime_admin;

--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) OWNER TO supabase_realtime_admin;

--
-- Name: send_binary(bytea, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
BEGIN
  BEGIN
    generated_id := gen_random_uuid();

    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    INSERT INTO realtime.messages (id, binary_payload, event, topic, private, extension)
    VALUES (generated_id, payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'WarnSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) OWNER TO supabase_realtime_admin;

--
-- Name: settled_changes(name, integer, text[]); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.settled_changes(slot_name name, max_changes integer, VARIADIC opts text[]) RETURNS TABLE(lsn pg_lsn, xid xid, data text)
    LANGUAGE plpgsql
    AS $$
declare
  upto pg_lsn;
  total bigint;
  xids xid[];
  starts bigint[];
  snapshot pg_snapshot;
  running_xids xid[];
  xmax_age int;
  cut bigint;
begin
  -- Each statement in a volatile function takes its own snapshot, which is what lets the
  -- check below see a writer that was still in flight when the peek ran. Under REPEATABLE
  -- READ the snapshot never advances, so a deferred change would never be released.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'realtime.settled_changes requires READ COMMITTED';
  end if;

  -- The peek and the read below cover the same WAL, so the read cannot reach a commit the
  -- check never saw.
  upto := pg_current_wal_flush_lsn();

  -- One entry per transaction, in commit order: its xid and the position of its first
  -- change. The peek uses the caller's own options, so max_changes counts exactly what the
  -- read counts. A non-transactional logical message is emitted as soon as it is decoded,
  -- tagged with the xid of whatever transaction wrote it, so it does not mark where that
  -- transaction starts.
  select coalesce(sum(g.n), 0),
         array_agg(g.x order by g.first) filter (where g.first is not null),
         array_agg(g.first order by g.first) filter (where g.first is not null)
    into total, xids, starts
    from (
      select p.xid as x, count(*) as n,
             min(p.ord) filter (where not case
               when starts_with(p.data, '{"action":"M"') then (p.data::jsonb->>'transactional')::boolean is false
               else false
             end) as first
      from pg_logical_slot_peek_changes(slot_name, upto, max_changes, variadic opts)
           with ordinality as p(lsn, xid, data, ord)
      group by p.xid
    ) g;

  -- Nothing for the caller, but the slot still has to move past what the peek covered.
  if total = 0 then
    perform pg_replication_slot_advance(slot_name, upto);
    return;
  end if;

  if xids is not null then
    -- Taken after the peek is materialized, so a writer that was still in flight during
    -- decoding is guaranteed to show up here.
    snapshot := pg_current_snapshot();

    -- A commit record reaches the WAL before the writer leaves the proc array, so a change
    -- can be decoded while its row is invisible. apply_rls would resolve a policy against a
    -- row it cannot see and authorize it for nobody, while the read consumed it regardless.
    --
    -- xip lists transactions running when the snapshot was taken. It does not cover a writer
    -- whose xid sits at or beyond xmax, which never appears there, so the horizon is checked
    -- too. age() counts backwards from the current xid and so compares correctly across
    -- wraparound.
    select coalesce(array_agg(running.x::xid), array[]::xid[])
      into running_xids
      from pg_snapshot_xip(snapshot) running(x);
    xmax_age := age(pg_snapshot_xmax(snapshot)::xid);

    select min(u.s) into cut
      from unnest(xids, starts) as u(x, s)
      where u.x = any(running_xids) or age(u.x) <= xmax_age;
  end if;

  -- The read stops right after the commit that brings its count to upto_nchanges, so the
  -- count of changes in front of the first unsettled transaction stops it just before that
  -- transaction.
  if cut is null then
    return query
      select p.* from pg_logical_slot_get_changes(slot_name, upto, max_changes, variadic opts) p;
  elsif cut > 1 then
    return query
      select p.* from pg_logical_slot_get_changes(slot_name, upto, (cut - 1)::int, variadic opts) p;
  end if;
end;
$$;


ALTER FUNCTION realtime.settled_changes(slot_name name, max_changes integer, VARIADIC opts text[]) OWNER TO supabase_realtime_admin;

--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
    col_names text[] = coalesce(
            array_agg(a.attname order by a.attnum),
            '{}'::text[]
        )
        from
            pg_catalog.pg_attribute a
        where
            a.attrelid = new.entity
            and a.attnum > 0
            and not a.attisdropped
            and pg_catalog.has_column_privilege(
                (new.claims ->> 'role'),
                a.attrelid,
                a.attnum,
                'SELECT'
            );
    filter realtime.user_defined_filter;
    col_type regtype;
    in_val jsonb;
    selected_col text;
begin
    for filter in select * from unnest(new.filters) loop
        if not filter.column_name = any(col_names) then
            raise exception 'invalid column for filter %', filter.column_name;
        end if;

        col_type = (
            select atttypid::regtype
            from pg_catalog.pg_attribute
            where attrelid = new.entity
                  and attname = filter.column_name
        );
        if col_type is null then
            raise exception 'failed to lookup type for column %', filter.column_name;
        end if;

        if filter.op = 'in'::realtime.equality_op then
            in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
            if coalesce(jsonb_array_length(in_val), 0) > 100 then
                raise exception 'too many values for `in` filter. Maximum 100';
            end if;
        elsif filter.op = 'is'::realtime.equality_op then
            -- `is` requires a keyword RHS rather than a typed literal
            if filter.value not in ('null', 'true', 'false', 'unknown') then
                raise exception 'invalid value for is filter: must be null, true, false, or unknown';
            end if;
            -- IS NULL works for any type, but IS TRUE/FALSE/UNKNOWN require a boolean
            -- operand. Reject the non-null keywords on non-boolean columns here so they
            -- don't abort apply_rls at WAL time.
            if filter.value <> 'null' and col_type <> 'boolean'::regtype then
                raise exception 'is % filter requires a boolean column, got %', filter.value, col_type::text;
            end if;
        elsif filter.op in ('like'::realtime.equality_op, 'ilike'::realtime.equality_op) then
            -- like/ilike apply the text pattern operator (~~); reject column types that
            -- have no such operator instead of failing at WAL time
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = '~~' and oprleft = col_type
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
        elsif filter.op in ('match'::realtime.equality_op, 'imatch'::realtime.equality_op) then
            -- match/imatch apply the regex operators ~ / ~*; reject column types that have
            -- no such operator (e.g. integer) instead of failing at WAL time, mirroring the
            -- like/ilike guard above.
            if not exists (
                select 1 from pg_catalog.pg_operator
                where oprname = case when filter.op = 'imatch'::realtime.equality_op then '~*' else '~' end
                  and oprleft = col_type
                  and oprright = col_type
                  and oprresult = 'boolean'::regtype
            ) then
                raise exception 'operator % requires a text-compatible column type, got %', filter.op::text, col_type::text;
            end if;
            -- validate the regex eagerly so a bad pattern is rejected here, not inside
            -- apply_rls where it would abort the WAL stream for the entity
            begin
                perform '' ~ filter.value;
            exception when others then
                raise exception 'invalid regular expression for % filter: %', filter.op::text, sqlerrm;
            end;
        else
            -- eq/neq/lt/lte/gt/gte: value must be coercable to the type
            perform realtime.cast(filter.value, col_type);
        end if;
    end loop;

    if new.selected_columns is not null then
        for selected_col in select * from unnest(new.selected_columns) loop
            if not selected_col = any(col_names) then
                raise exception 'invalid column for select %', selected_col;
            end if;
        end loop;
    end if;

    -- Apply consistent order to filters so the unique constraint can't be tricked by a
    -- different filter order. negate is part of the sort key.
    new.filters = coalesce(
        array_agg(f order by f.column_name, f.op, f.value, f.negate),
        '{}'
    ) from unnest(new.filters) f;

    -- Normalize selected_columns order so ARRAY['a','b'] and ARRAY['b','a'] are treated
    -- as the same subscription group in apply_rls. Preserve an empty array as '{}'
    -- ("primary keys only") so it stays distinct from NULL ("all columns"); array_agg
    -- over an empty set would otherwise collapse '{}' back to NULL.
    if new.selected_columns is not null then
        new.selected_columns = coalesce(
            (
                select array_agg(c order by c)
                from unnest(new.selected_columns) c
            ),
            '{}'::text[]
        );
    end if;

    return new;
end;
$$;


ALTER FUNCTION realtime.subscription_check_filters() OWNER TO supabase_realtime_admin;

--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION realtime.to_regrole(role_name text) OWNER TO supabase_realtime_admin;

--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION realtime.topic() OWNER TO supabase_realtime_admin;

--
-- Name: wal2json_escape_identifier(text); Type: FUNCTION; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE FUNCTION realtime.wal2json_escape_identifier(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
  -- Prefix `\`, `,`, `.`, and any whitespace with `\`
  SELECT regexp_replace(name, '([\\,.[:space:]])', '\\\1', 'g')
$$;


ALTER FUNCTION realtime.wal2json_escape_identifier(name text) OWNER TO supabase_realtime_admin;

--
-- Name: allow_any_operation(text[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.allow_any_operation(expected_operations text[]) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION storage.allow_any_operation(expected_operations text[]) OWNER TO supabase_storage_admin;

--
-- Name: allow_only_operation(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.allow_only_operation(expected_operation text) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION storage.allow_only_operation(expected_operation text) OWNER TO supabase_storage_admin;

--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) OWNER TO supabase_storage_admin;

--
-- Name: delete_lifecycle_objects(uuid[]); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.delete_lifecycle_objects(object_ids uuid[]) RETURNS TABLE(id uuid, is_delete_marker boolean, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
    object_id uuid;
    deleted_row storage.objects%ROWTYPE;
    deleted_ids uuid[];
    deleted_markers boolean[];
    deleted_metadata jsonb[];
    bulk_deleted boolean := false;
BEGIN
    -- Surface pre-existing deferred violations instead of treating them as blocked rows.
    SET CONSTRAINTS ALL IMMEDIATE;
    PERFORM set_config('storage.allow_delete_query', 'true', true);

    -- One subxact keeps the subxid cache from overflowing; rows return only once it commits.
    BEGIN
        WITH deleted AS (
            DELETE FROM storage.objects AS object_row
              WHERE object_row.id = ANY(object_ids) AND object_row.archived_at IS NOT NULL
              RETURNING object_row.id, object_row.is_delete_marker, object_row.metadata
        )
        SELECT array_agg(deleted.id), array_agg(deleted.is_delete_marker), array_agg(deleted.metadata)
          INTO deleted_ids, deleted_markers, deleted_metadata
          FROM deleted;
        bulk_deleted := true;
    EXCEPTION
        WHEN OTHERS THEN
            -- User triggers may use insufficient_privilege to block a row.
            IF SQLSTATE <> '42501' AND left(SQLSTATE, 2) IN ('08', '40', '42', '53', '55', '57', '58', 'XX') THEN
                RAISE;
            END IF;
    END;
    IF bulk_deleted THEN
        RETURN QUERY SELECT * FROM unnest(deleted_ids, deleted_markers, deleted_metadata);
        RETURN;
    END IF;

    FOREACH object_id IN ARRAY object_ids LOOP
        BEGIN
            DELETE FROM storage.objects AS object_row
              WHERE object_row.id = object_id AND object_row.archived_at IS NOT NULL
              RETURNING object_row.* INTO deleted_row;
            IF FOUND THEN
                id := deleted_row.id;
                is_delete_marker := deleted_row.is_delete_marker;
                metadata := deleted_row.metadata;
                RETURN NEXT;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLSTATE <> '42501' AND left(SQLSTATE, 2) IN ('08', '40', '42', '53', '55', '57', '58', 'XX') THEN
                    RAISE;
                END IF;
        END;
    END LOOP;
END;
$$;


ALTER FUNCTION storage.delete_lifecycle_objects(object_ids uuid[]) OWNER TO supabase_storage_admin;

--
-- Name: enforce_bucket_lifecycle_service_role(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.enforce_bucket_lifecycle_service_role() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
  IF current_user::text IS DISTINCT FROM TG_ARGV[0] THEN
    -- Keep this check AFTER caller RLS accepts the proposed row. The API
    -- recognizes this exact signal after rolling back its permission probe.
    RAISE EXCEPTION 'bucket control columns may only be changed by the configured storage service role'
      USING ERRCODE = 'PST01',
            SCHEMA = TG_TABLE_SCHEMA,
            TABLE = TG_TABLE_NAME,
            CONSTRAINT = TG_NAME;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION storage.enforce_bucket_lifecycle_service_role() OWNER TO supabase_storage_admin;

--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION storage.enforce_bucket_name_length() OWNER TO supabase_storage_admin;

--
-- Name: enforce_versioning_status_transition(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.enforce_versioning_status_transition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.versioning_status = OLD.versioning_status THEN
        RETURN NEW;
    END IF;

    IF NEW.versioning_status = 'DISABLED' OR
       (OLD.versioning_status = 'DISABLED' AND NEW.versioning_status = 'SUSPENDED') THEN
        RAISE EXCEPTION 'Cannot transition bucket versioning status from % to %',
            OLD.versioning_status, NEW.versioning_status;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.enforce_versioning_status_transition() OWNER TO supabase_storage_admin;

--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION storage.extension(name text) OWNER TO supabase_storage_admin;

--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    RETURN _parts[array_length(_parts, 1)];
END
$$;


ALTER FUNCTION storage.filename(name text) OWNER TO supabase_storage_admin;

--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION storage.foldername(name text) OWNER TO supabase_storage_admin;

--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN p_delimiter <> ''
         AND position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(
        p_key,
        length(p_prefix)
            + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1))
            + length(p_delimiter) - 1
    )
    ELSE NULL
END;
$$;


ALTER FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) OWNER TO supabase_storage_admin;

--
-- Name: get_size_by_bucket(text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.get_size_by_bucket(noncurrent_versions text DEFAULT 'include'::text, delete_markers text DEFAULT 'include'::text) RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'include');
    delete_markers := COALESCE(delete_markers, 'include');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'include';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'include';
    END IF;

    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        where (noncurrent_versions != 'exclude' OR obj.archived_at IS NULL)
          and (noncurrent_versions != 'only' OR obj.archived_at IS NOT NULL)
          and (delete_markers != 'exclude' OR NOT obj.is_delete_marker)
          and (delete_markers != 'only' OR obj.is_delete_marker)
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION storage.get_size_by_bucket(noncurrent_versions text, delete_markers text) OWNER TO supabase_storage_admin;

--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text, raw_prefix_param text DEFAULT NULL::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $_$
WITH candidates AS (
    SELECT
        upload.key AS object_key,
        CASE
            WHEN position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0
            THEN left(
                upload.key,
                length(coalesce($7, $2))
                    + position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1))
                    + length($3) - 1
            )
            ELSE upload.key
        END AS result_key,
        upload.id,
        upload.created_at,
        position($3 IN substring(upload.key FROM length(coalesce($7, $2)) + 1)) > 0 AS is_common_prefix
    FROM storage.s3_multipart_uploads AS upload
    WHERE upload.bucket_id = $1
      AND upload.key COLLATE "C" LIKE $2 || '%'
), filtered AS (
    SELECT candidate.*
    FROM candidates AS candidate
    WHERE $5 = ''
       OR candidate.result_key COLLATE "C" > $5
       OR (
           candidate.result_key COLLATE "C" = $5
           AND NOT candidate.is_common_prefix
           AND $6 <> ''
           -- A completed or aborted marker repeats the remaining same-key uploads.
           AND COALESCE(
               (candidate.created_at, candidate.id COLLATE "C") > (
                   SELECT marker.created_at, marker.id COLLATE "C"
                   FROM storage.s3_multipart_uploads AS marker
                   WHERE marker.bucket_id = $1
                     AND marker.key COLLATE "C" = $5
                     AND marker.id = $6
               ),
               TRUE
           )
       )
), ranked AS (
    SELECT
        filtered.*,
        row_number() OVER (
            PARTITION BY filtered.result_key COLLATE "C"
            ORDER BY filtered.created_at, filtered.id COLLATE "C"
        ) AS prefix_rank
    FROM filtered
)
SELECT ranked.result_key, ranked.id, ranked.created_at
FROM ranked
WHERE NOT ranked.is_common_prefix OR ranked.prefix_rank = 1
ORDER BY ranked.result_key COLLATE "C", ranked.created_at, ranked.id COLLATE "C"
LIMIT $4;
$_$;


ALTER FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer, next_key_token text, next_upload_token text, raw_prefix_param text) OWNER TO supabase_storage_admin;

--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text, text, text, timestamp with time zone, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, next_token_archived_at timestamp with time zone DEFAULT NULL::timestamp with time zone, next_token_version text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_start_relative TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;

    -- true when noncurrent_versions can return >1 row per name; keeps them
    -- ordered most-recent-first and lets pagination resume mid-key
    v_multi_row BOOLEAN;
    v_name_order TEXT;
    v_exact_range_predicate TEXT;
    v_strict_range_predicate TEXT;
    v_inclusive_range_predicate TEXT;

    -- Seek state for the current name. archived_at is normalized to JavaScript's
    -- millisecond precision and version breaks ties within the same millisecond.
    -- Current rows use 'infinity'; NULL means no tiebreak has been established.
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_cursor_is_folder BOOLEAN;
    v_count INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_batch_query_strict TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');
    v_name_order := CASE WHEN v_is_asc THEN 'ASC' ELSE 'DESC' END;

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Keep caller-provided cursors inside the requested prefix range.
    IF v_start <> '' AND v_upper_bound IS NOT NULL THEN
        IF v_is_asc THEN
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                v_start := '';
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                RETURN;
            END IF;
        ELSE
            IF v_start COLLATE "C" < v_prefix COLLATE "C" THEN
                RETURN;
            ELSIF v_start COLLATE "C" >= v_upper_bound COLLATE "C" THEN
                v_start := '';
            END IF;
        END IF;
    END IF;

    v_start_relative := substring(v_start FROM length(v_prefix) + 1);

    -- Direction affects only the indexed name range and its ordering. Cursor
    -- state transitions and within-key version ordering stay shared.
    IF v_is_asc THEN
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" > $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" >= $2';
        IF v_upper_bound IS NOT NULL THEN
            v_exact_range_predicate := 'o.name COLLATE "C" < $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" < $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" < $3';
        END IF;
    ELSE
        v_exact_range_predicate := 'TRUE';
        v_strict_range_predicate := 'o.name COLLATE "C" < $2';
        v_inclusive_range_predicate := 'o.name COLLATE "C" < $2';
        IF v_prefix <> '' THEN
            v_exact_range_predicate := 'o.name COLLATE "C" >= $3';
            v_strict_range_predicate := v_strict_range_predicate || ' AND o.name COLLATE "C" >= $3';
            v_inclusive_range_predicate := v_inclusive_range_predicate || ' AND o.name COLLATE "C" >= $3';
        END IF;
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    -- The multi-row order matches the externally serialized cursor exactly:
    -- archived_at at millisecond precision, then version as the final tiebreak.
    --
    -- When v_multi_row, the seek is a keyset tuple comparison ("name > $2 OR
    -- (name = $2 AND tiebreak)") - Postgres won't split that OR into indexable
    -- form (confirmed even with fully literal values), so as one WHERE clause
    -- it forces a full bucket scan filtered row-by-row. Splitting it into two
    -- independently-indexable branches (exact name match with the tiebreak
    -- filter, vs. strictly-past names) combined with UNION ALL lets each
    -- branch keep name as a real index condition; the outer ORDER BY/LIMIT
    -- re-merges them into the same page the single query used to produce.
    IF v_multi_row THEN
        v_batch_query := format(
            $sql$
            SELECT *
            FROM (
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND o.name COLLATE "C" = $2
                      AND %s
                      AND NOT $7::boolean
                      AND (
                          $5::timestamptz IS NULL
                          OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < $5
                          OR (
                              COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = $5
                              AND COALESCE(o.version, '') > $6
                          )
                      )
                      %s
                    ORDER BY
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
                UNION ALL
                (
                    SELECT o.name, o.id, o.updated_at, o.created_at,
                           o.last_accessed_at, o.metadata, o.version,
                           o.archived_at, o.is_delete_marker, o.is_versioned
                    FROM storage.objects o
                    WHERE o.bucket_id = $1
                      AND %s
                      %s
                    ORDER BY
                        o.name COLLATE "C" %s,
                        COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC,
                        COALESCE(o.version, '') ASC
                    LIMIT $4
                )
            ) sub
            ORDER BY
                sub.name COLLATE "C" %s,
                COALESCE(date_trunc('milliseconds', sub.archived_at), 'infinity'::timestamptz) DESC,
                COALESCE(sub.version, '') ASC
            LIMIT $4
            $sql$,
            v_exact_range_predicate,
            v_version_filter,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order,
            v_name_order
        );
    ELSE
        v_batch_query := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_inclusive_range_predicate,
            v_version_filter,
            v_name_order
        );

        -- Strict counterpart of the query above: used once the single-row
        -- ASC batch advance (below) has left v_next_seek pointing at the
        -- last row already emitted, so an inclusive predicate would
        -- re-match it forever. Only single-row mode ever sets strict mode,
        -- so this variant is never needed when v_multi_row.
        v_batch_query_strict := format(
            $sql$
            SELECT o.name, o.id, o.updated_at, o.created_at,
                   o.last_accessed_at, o.metadata, o.version,
                   o.archived_at, o.is_delete_marker, o.is_versioned
            FROM storage.objects o
            WHERE o.bucket_id = $1
              AND %s
              %s
            ORDER BY o.name COLLATE "C" %s, o.archived_at DESC
            LIMIT $4
            $sql$,
            v_strict_range_predicate,
            v_version_filter,
            v_name_order
        );
    END IF;

    -- The static peek predicates cannot use the partial delete-marker index
    -- once PL/pgSQL switches to a generic plan because whether
    -- is_delete_marker is required remains parameter-dependent. Reuse the
    -- already-specialized batch query with a one-row limit for this sparse
    -- filter so the plan sees a literal `o.is_delete_marker` predicate.
    IF delete_markers = 'only' THEN
        v_delete_marker_peek_query :=
            'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        IF NOT v_multi_row THEN
            v_delete_marker_peek_query_strict :=
                'SELECT marker_page.name FROM (' || v_batch_query_strict || ') marker_page LIMIT 1';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor performs one specialized initial seek so
            -- partial current-version and delete-marker indexes remain available.
            EXECUTE format(
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY o.name COLLATE "C" DESC LIMIT 1',
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND o.name COLLATE "C" >= $2 AND o.name COLLATE "C" < $3'
                    ELSE ''
                END,
                v_version_filter
            )
            INTO v_next_seek
            USING _bucket_id, v_prefix, v_upper_bound;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Folder continuation tokens retain their trailing delimiter. A
        -- delimiter-less startAfter is always a literal key boundary.
        v_cursor_is_folder := delimiter_param <> ''
            AND v_start_relative <> ''
            AND right(v_start_relative, length(delimiter_param)) = delimiter_param;

        IF v_cursor_is_folder THEN
            v_next_seek := CASE
                WHEN right(v_start, length(delimiter_param)) = delimiter_param
                    THEN v_start
                ELSE v_start || delimiter_param
            END;
            IF v_is_asc THEN
                v_next_seek := left(v_next_seek, -1)
                    || chr(ascii(right(v_next_seek, 1)) + 1);
            END IF;
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- leaf object: when v_multi_row, stay on v_start with the
            -- caller-supplied tiebreak so a page boundary mid-key resumes
            -- that key's remaining rows instead of skipping them. Truncate
            -- to milliseconds like every other v_next_seek_at assignment -
            -- harmless today since object.ts's cursor always round-trips
            -- through JS Date first, but this shouldn't rely on that.
            IF v_multi_row THEN
                v_next_seek := v_start;
                v_next_seek_at := date_trunc('milliseconds', next_token_archived_at);
                v_next_seek_version := coalesce(next_token_version, '');
                v_next_seek_strict := coalesce(next_token, '') = '';
            ELSIF v_is_asc THEN
                v_next_seek := v_start;
                v_next_seek_strict := true;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        -- v_multi_row is branched here (rather than folded into the WHERE
        -- clause as a bound parameter) so each concrete query keeps an
        -- unconditional seek predicate - once PL/pgSQL switches to its
        -- cached generic plan (after 5 calls), a parameter-gated
        -- "(NOT v_multi_row AND name >= $x) OR (v_multi_row AND ...)"
        -- predicate stops the planner from using name as an index
        -- condition at all, degrading every subsequent peek to a full
        -- index scan filtered row-by-row instead of a bounded range scan.
        -- v_multi_row's seek predicate is a keyset tuple comparison
        -- ("name > x OR (name = x AND tiebreak)") - Postgres does not
        -- split this OR into indexable form even with fully literal
        -- values, so it falls back to a full scan filtered row-by-row.
        -- Splitting it into two independently-indexable branches (exact
        -- name match with the tiebreak filter, vs. strictly-past name)
        -- combined with UNION ALL lets each branch keep name as a real
        -- index condition; the outer ORDER BY/LIMIT picks whichever of
        -- the (at most 2) rows sorts first.
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING _bucket_id, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END,
                    1, v_next_seek_at, v_next_seek_version, v_next_seek_strict;
        ELSIF v_multi_row THEN
            IF v_is_asc THEN
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" < v_upper_bound
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek AND o.name COLLATE "C" < v_upper_bound
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" > v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" ASC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND o.name COLLATE "C" >= v_prefix
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT sub.name INTO v_peek_name FROM (
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" = v_next_seek
                           AND NOT v_next_seek_strict
                           AND (v_next_seek_at IS NULL
                                OR COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) < v_next_seek_at
                                OR (COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) = v_next_seek_at
                                    AND COALESCE(o.version, '') > v_next_seek_version))
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY COALESCE(date_trunc('milliseconds', o.archived_at), 'infinity'::timestamptz) DESC, COALESCE(o.version, '') ASC LIMIT 1)
                        UNION ALL
                        (SELECT o.name FROM storage.objects o
                         WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                           AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                           AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                           AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                           AND (delete_markers != 'only' OR o.is_delete_marker)
                         ORDER BY o.name COLLATE "C" DESC LIMIT 1)
                    ) sub ORDER BY sub.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        ELSE
            -- Single-row mode is always noncurrent_versions='exclude'. Keep
            -- this predicate literal so generic plans use the current index.
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.name COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSE
                IF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.name COLLATE "C" >= v_prefix
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = _bucket_id
                      AND o.name COLLATE "C" < v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                      AND (delete_markers != 'only' OR o.is_delete_marker)
                    ORDER BY o.name COLLATE "C" DESC LIMIT 1;
                END IF;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := v_common_prefix;
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            version := NULL;
            archived_at := NULL;
            is_delete_marker := NULL;
            is_versioned := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1)
                    || chr(ascii(right(v_common_prefix, 1)) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
            v_next_seek_strict := NOT v_is_asc;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE CASE WHEN v_next_seek_strict AND NOT v_multi_row THEN v_batch_query_strict ELSE v_batch_query END
                USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size, v_next_seek_at, v_next_seek_version,
                v_next_seek_strict
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN v_current.name
                        ELSE v_current.name || delimiter_param
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                version := v_current.version;
                archived_at := v_current.archived_at;
                is_delete_marker := v_current.is_delete_marker;
                is_versioned := v_current.is_versioned;
                RETURN NEXT;
                v_count := v_count + 1;

                -- when v_multi_row, stay on this name and record its
                -- archived_at as the new tiebreak so remaining rows for the
                -- same key are picked up before moving to the next name
                IF v_multi_row THEN
                    v_next_seek := v_current.name;
                    v_next_seek_at := COALESCE(date_trunc('milliseconds', v_current.archived_at), 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                    v_next_seek_strict := false;
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor
                    -- would skip a real key like `name || '!'` (or any
                    -- character sorting below the delimiter), which sorts
                    -- between `name` and `name || delimiter`. Track the real
                    -- name and mark the next comparison strict instead.
                    v_next_seek := v_current.name;
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.list_objects_with_delimiter made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer, start_after text, next_token text, sort_order text, noncurrent_versions text, delete_markers text, next_token_archived_at timestamp with time zone, next_token_version text) OWNER TO supabase_storage_admin;

--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION storage.operation() OWNER TO supabase_storage_admin;

--
-- Name: protect_active_lifecycle_states(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.protect_active_lifecycle_states() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM storage.bucket_lifecycle_states
        WHERE bucket_id = OLD.id
          AND NOT (
              continuation IS NULL
              OR (continuation @> '{"continuationVersion": 1}' AND continuation #> '{batch,inFlight}' IS NULL)
          )
    ) THEN
        RAISE EXCEPTION 'update or delete on table "buckets" violates foreign key constraint "bucket_lifecycle_states_bucket_id_fkey" on table "bucket_lifecycle_states"'
            USING ERRCODE = 'foreign_key_violation',
                  DETAIL = format('Key (id)=(%s) is still referenced from table "bucket_lifecycle_states".', OLD.id),
                  SCHEMA = 'storage',
                  TABLE = 'bucket_lifecycle_states',
                  CONSTRAINT = 'bucket_lifecycle_states_bucket_id_fkey';
    END IF;
    RETURN OLD;
END;
$$;


ALTER FUNCTION storage.protect_active_lifecycle_states() OWNER TO supabase_storage_admin;

--
-- Name: protect_bucket_control_columns(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.protect_bucket_control_columns() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  configuration_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lifecycle_configuration IS NOT NULL
       OR NEW.lifecycle_configuration_generation IS NOT NULL THEN
      IF NOT pg_has_role(current_user, TG_ARGV[0], 'MEMBER') THEN
        RAISE EXCEPTION 'only members of the configured storage service role may insert lifecycle policy state'
          USING ERRCODE = '42501',
                HINT = format(
                  'Insert with both lifecycle columns NULL and configure lifecycle through the Storage API afterward, or insert as a member of %I.',
                  TG_ARGV[0]
                );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  configuration_changed =
    OLD.lifecycle_configuration IS DISTINCT FROM NEW.lifecycle_configuration
    OR OLD.lifecycle_configuration_generation IS DISTINCT FROM NEW.lifecycle_configuration_generation;

  IF NOT configuration_changed THEN
    RETURN NEW;
  END IF;

  IF NEW.type IS DISTINCT FROM 'STANDARD' THEN
    RAISE EXCEPTION 'bucket versioning and lifecycle controls require a Standard bucket'
      USING ERRCODE = '0A000';
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     AND NEW.lifecycle_configuration_generation IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.lifecycle_configuration IS NULL
     OR NEW.lifecycle_configuration_generation IS NULL
     OR OLD.lifecycle_configuration IS NOT DISTINCT FROM NEW.lifecycle_configuration
     OR OLD.lifecycle_configuration_generation IS NOT DISTINCT FROM NEW.lifecycle_configuration_generation THEN
    RAISE EXCEPTION 'a changed lifecycle policy requires a new non-null generation'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION storage.protect_bucket_control_columns() OWNER TO supabase_storage_admin;

--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION storage.protect_delete() OWNER TO supabase_storage_admin;

--
-- Name: reconcile_lifecycle_state(text, boolean); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.reconcile_lifecycle_state(target_bucket_id text, policy_changed boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
    bucket storage.buckets%ROWTYPE;
    active boolean;
    idle boolean;
    state_generation uuid;
BEGIN
    SELECT * INTO bucket FROM storage.buckets WHERE id = target_bucket_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT continuation IS NULL OR (
               continuation @> '{"continuationVersion": 1}'
               AND continuation #> '{batch,inFlight}' IS NULL
           ), generation
    INTO idle, state_generation
    FROM storage.bucket_lifecycle_states
    WHERE bucket_id = target_bucket_id
    FOR UPDATE;

    IF bucket.lifecycle_configuration IS NULL THEN
        DELETE FROM storage.bucket_lifecycle_states
        WHERE bucket_id = target_bucket_id
          AND idle IS TRUE;

        UPDATE storage.bucket_lifecycle_states
        SET next_run_at = clock_timestamp(), updated_at = clock_timestamp()
        WHERE bucket_id = target_bucket_id
          AND idle IS NOT TRUE;
        RETURN;
    END IF;

    active := bucket.versioning_status <> 'DISABLED'
        AND bucket.lifecycle_configuration @> '{"rules":[{"status":"Enabled"}]}'::jsonb;

    -- The state row records the generation it was reconciled with so callers need not detect
    -- policy changes. Rows without a recorded generation keep their work.
    policy_changed := policy_changed OR (
        state_generation IS NOT NULL AND state_generation <> bucket.lifecycle_configuration_generation
    );

    INSERT INTO storage.bucket_lifecycle_states AS state (bucket_id, generation, next_run_at)
    VALUES (bucket.id, bucket.lifecycle_configuration_generation, CASE WHEN active THEN clock_timestamp() END)
    ON CONFLICT (bucket_id) DO UPDATE
    SET next_run_at = CASE
            WHEN policy_changed THEN
                CASE WHEN active OR idle IS NOT TRUE THEN clock_timestamp() END
            ELSE EXCLUDED.next_run_at
        END,
        generation = EXCLUDED.generation,
        claim_id = CASE WHEN policy_changed AND idle IS TRUE
                        THEN NULL ELSE state.claim_id END,
        claim_until = CASE WHEN policy_changed AND idle IS TRUE
                           THEN NULL ELSE state.claim_until END,
        continuation = CASE WHEN policy_changed AND idle IS TRUE
                            THEN NULL ELSE state.continuation END,
        failure_count = CASE WHEN policy_changed AND idle IS TRUE
                             THEN 0 ELSE state.failure_count END,
        last_error = CASE WHEN policy_changed AND idle IS TRUE
                          THEN NULL ELSE state.last_error END,
        updated_at = clock_timestamp()
    WHERE policy_changed OR (state.next_run_at IS NULL AND EXCLUDED.next_run_at IS NOT NULL);
END;
$$;


ALTER FUNCTION storage.reconcile_lifecycle_state(target_bucket_id text, policy_changed boolean) OWNER TO supabase_storage_admin;

--
-- Name: search(text, text, integer, integer, integer, text, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_prefix_len INT;
    v_prefix_start INT;
    v_combined_levels INT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;
    v_version_filter TEXT;
    v_multi_row BOOLEAN;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;
    v_delete_marker_peek_query TEXT;
    v_delete_marker_peek_query_strict TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_next_seek_at TIMESTAMPTZ;
    v_next_seek_version TEXT;
    v_next_seek_strict BOOLEAN := false;
    v_count INT := 0;
    v_skipped INT := 0;
    v_previous_seek TEXT;
    v_previous_seek_at TIMESTAMPTZ;
    v_previous_seek_version TEXT;
    v_previous_count INT;
    v_previous_skipped INT;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_prefix_len := length(coalesce(prefix, ''));
    v_prefix_start := coalesce(array_length(string_to_array(coalesce(prefix, ''), v_delimiter), 1), 1);
    v_combined_levels := coalesce(array_length(string_to_array(v_prefix, v_delimiter), 1), 1);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);
    v_next_seek_at := NULL;
    v_next_seek_version := '';

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    v_multi_row := noncurrent_versions IN ('only', 'include');

    v_version_filter := '';
    IF noncurrent_versions = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NULL';
    ELSIF noncurrent_versions = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.archived_at IS NOT NULL';
    END IF;
    IF delete_markers = 'exclude' THEN
        v_version_filter := v_version_filter || ' AND NOT o.is_delete_marker';
    ELSIF delete_markers = 'only' THEN
        v_version_filter := v_version_filter || ' AND o.is_delete_marker';
    END IF;

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT array_to_string(path_tokens[$1:$2], '/') AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $3 || '%%'
                  AND bucket_id = $4
                  AND array_length(objects.path_tokens, 1) <> $2
                  AND ($7 != 'exclude' OR objects.archived_at IS NULL)
                  AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
                  AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
                  AND ($8 != 'only' OR objects.is_delete_marker)
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata,
                   NULL::text AS version,
                   NULL::timestamptz AS archived_at,
                   NULL::boolean AS is_delete_marker,
                   NULL::boolean AS is_versioned FROM folders)
            UNION ALL
            (SELECT array_to_string(path_tokens[$1:$2], '/') AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata,
                   version, archived_at, is_delete_marker, is_versioned
             FROM storage.objects
             WHERE objects.name ILIKE $3 || '%%'
               AND bucket_id = $4
               AND array_length(objects.path_tokens, 1) = $2
               AND ($7 != 'exclude' OR objects.archived_at IS NULL)
               AND ($7 != 'only' OR objects.archived_at IS NOT NULL)
               AND ($8 != 'exclude' OR NOT objects.is_delete_marker)
               AND ($8 != 'only' OR objects.is_delete_marker)
             -- name, then version, as tiebreaks so two versions of the same
             -- key tying on the sort column still sort deterministically
             ORDER BY %I %s, name COLLATE "C" %s, COALESCE(version, '') %s)
            LIMIT $5 OFFSET $6
            $sql$, v_sort_order, v_order_by, v_sort_order, v_sort_order, v_sort_order
        ) USING v_prefix_start, v_combined_levels, v_prefix, bucketname, v_limit, offsets, noncurrent_versions, delete_markers;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build a resume-safe batch query. The exact-name branch returns remaining
    -- versions after the current (archived_at, version) boundary; the strict
    -- name branch returns subsequent keys. UNION ALL keeps both predicates
    -- independently indexable.
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2 AND lower(o.name) COLLATE "C" < $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" > $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" ASC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 AND lower(o.name) COLLATE "C" >= $3' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT * FROM (' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" = $2 AND ($5::timestamptz IS NULL OR COALESCE(o.archived_at, ''infinity''::timestamptz) < $5 OR (COALESCE(o.archived_at, ''infinity''::timestamptz) = $5 AND COALESCE(o.version, '''') > $6))' ||
                v_version_filter || ' ORDER BY COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4) UNION ALL ' ||
                '(SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata, o.version, o.archived_at, o.is_delete_marker, o.is_versioned FROM storage.objects o ' ||
                'WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2' || v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC, COALESCE(o.archived_at, ''infinity''::timestamptz) DESC, COALESCE(o.version, '''') ASC LIMIT $4)' ||
                ') sub ORDER BY lower(sub.name) COLLATE "C" DESC, COALESCE(sub.archived_at, ''infinity''::timestamptz) DESC, COALESCE(sub.version, '''') ASC LIMIT $4';
        END IF;
    END IF;

    -- Keep the delete-marker predicate literal so the cached generic
    -- plan can use idx_objects_delete_markers during the main-loop peek.
    IF delete_markers = 'only' THEN
        IF v_multi_row THEN
            v_delete_marker_peek_query :=
                'SELECT marker_page.name FROM (' || v_batch_query || ') marker_page LIMIT 1';
        ELSIF v_is_asc THEN
            -- Two separate literal query strings, not one gated by a bound
            -- boolean: folding "$n AND op1 OR NOT $n AND op2" into a single
            -- query defeats the generic plan's ability to push either
            -- comparison into the index. Branching in PL/pgSQL control flow
            -- instead keeps each query's index condition intact.
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" >= $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
            -- Strict variant: used once the single-row ASC batch advance
            -- (below) has left v_next_seek pointing at the last row already
            -- emitted, so a plain >= would re-match it forever.
            v_delete_marker_peek_query_strict :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" > $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" < $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1';
        ELSE
            v_delete_marker_peek_query :=
                'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1 ' ||
                'AND lower(o.name) COLLATE "C" < $2' ||
                CASE WHEN v_upper_bound IS NOT NULL
                    THEN ' AND lower(o.name) COLLATE "C" >= $3'
                    ELSE ''
                END ||
                v_version_filter ||
                ' ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC performs one specialized initial seek so partial current-version
        -- and delete-marker indexes remain available.
        EXECUTE format(
            'SELECT o.name FROM storage.objects o WHERE o.bucket_id = $1%s%s ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1',
            CASE WHEN v_upper_bound IS NOT NULL
                THEN ' AND lower(o.name) COLLATE "C" >= $2 AND lower(o.name) COLLATE "C" < $3'
                ELSE ''
            END,
            v_version_filter
        )
        INTO v_peek_name
        USING bucketname, v_prefix_lower, v_upper_bound;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch and
    -- the delete-marker-only path
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        v_previous_seek := v_next_seek;
        v_previous_seek_at := v_next_seek_at;
        v_previous_seek_version := v_next_seek_version;
        v_previous_count := v_count;
        v_previous_skipped := v_skipped;

        -- STEP 1: PEEK
        v_peek_name := NULL;
        IF delete_markers = 'only' THEN
            EXECUTE CASE WHEN v_next_seek_strict
                THEN v_delete_marker_peek_query_strict
                ELSE v_delete_marker_peek_query
            END
                INTO v_peek_name
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END,
                    1, v_next_seek_at, v_next_seek_version;
        ELSIF v_multi_row AND v_next_seek_at IS NOT NULL THEN
            SELECT o.name INTO v_peek_name
            FROM storage.objects o
            WHERE o.bucket_id = bucketname
              AND lower(o.name) COLLATE "C" = v_next_seek
              AND (COALESCE(o.archived_at, 'infinity'::timestamptz) < v_next_seek_at
                   OR (COALESCE(o.archived_at, 'infinity'::timestamptz) = v_next_seek_at
                       AND COALESCE(o.version, '') > v_next_seek_version))
              AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
              AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
              AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
              AND (delete_markers != 'only' OR o.is_delete_marker)
            ORDER BY COALESCE(o.archived_at, 'infinity'::timestamptz) DESC,
                     COALESCE(o.version, '') ASC
            LIMIT 1;

            -- The current key is exhausted. Clear its version boundary and
            -- make the following ASC name peek strict. Appending '/' is not a
            -- valid lexical successor because keys ending in characters such
            -- as '!' sort between the exhausted name and name || '/'.
            IF v_peek_name IS NULL THEN
                IF v_is_asc THEN
                    v_next_seek_strict := true;
                END IF;
                v_next_seek_at := NULL;
                v_next_seek_version := '';
            END IF;
        END IF;

        -- Single-row mode is always noncurrent_versions='exclude'. Keep the
        -- current-row predicate literal so generic plans use the current index.
        IF delete_markers != 'only' AND v_peek_name IS NULL AND NOT v_multi_row THEN
            IF v_is_asc THEN
                IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_next_seek_strict THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSIF v_upper_bound IS NOT NULL THEN
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                ELSE
                    SELECT o.name INTO v_peek_name FROM storage.objects o
                    WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                      AND o.archived_at IS NULL
                      AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                    ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
                END IF;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND o.archived_at IS NULL
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL AND v_is_asc THEN
            IF v_next_seek_strict AND v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_next_seek_strict THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" > v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSIF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSIF delete_markers != 'only' AND v_peek_name IS NULL THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                  AND (noncurrent_versions != 'exclude' OR o.archived_at IS NULL)
                  AND (noncurrent_versions != 'only' OR o.archived_at IS NOT NULL)
                  AND (delete_markers != 'exclude' OR NOT o.is_delete_marker)
                  AND (delete_markers != 'only' OR o.is_delete_marker)
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- If the peek landed on a different key than we were tracking, any
        -- version boundary belongs to the OLD key and must not leak into the
        -- new one - e.g. the deleteMarkers='only' peek doesn't know or care
        -- whether it's continuing the same key or jumping to a new one, so
        -- it never clears these itself.
        IF lower(v_peek_name) IS DISTINCT FROM v_next_seek THEN
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        END IF;

        -- The peek is authoritative for the next key to process. This is
        -- especially important after exhausting a multi-version key: the
        -- version boundary has been cleared, so executing the batch against
        -- a stale v_next_seek would replay every version of that old key.
        v_next_seek := lower(v_peek_name);
        v_next_seek_strict := false;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := substring(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter) from v_prefix_len + 1);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                version := NULL;
                archived_at := NULL;
                is_delete_marker := NULL;
                is_versioned := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
            v_next_seek_at := NULL;
            v_next_seek_version := '';
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size,
                    v_next_seek_at, v_next_seek_version
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it. Reset
                    -- strict mode too - it may have been set by an earlier
                    -- row in this same batch (see the single-row ASC advance
                    -- below), and v_next_seek here is the folder-triggering
                    -- row's own name, which the next peek must find inclusively.
                    v_next_seek := CASE
                        WHEN v_is_asc THEN lower(v_current.name)
                        ELSE lower(v_current.name) || v_delimiter
                    END;
                    v_next_seek_at := NULL;
                    v_next_seek_version := '';
                    v_next_seek_strict := false;
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := substring(v_current.name from v_prefix_len + 1);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    version := v_current.version;
                    archived_at := v_current.archived_at;
                    is_delete_marker := v_current.is_delete_marker;
                    is_versioned := v_current.is_versioned;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Multi-row mode must remain on this key until all of its
                -- versions have crossed the internal batch boundary.
                IF v_multi_row THEN
                    v_next_seek := lower(v_current.name);
                    v_next_seek_at := COALESCE(v_current.archived_at, 'infinity'::timestamptz);
                    v_next_seek_version := COALESCE(v_current.version, '');
                ELSIF v_is_asc THEN
                    -- Appending the delimiter as a fake lexical successor would
                    -- skip a real key like `name || '!'` (or any character
                    -- sorting below the delimiter), which sorts between `name`
                    -- and `name || delimiter`. Track the real name and mark the
                    -- next comparison strict instead - same fix as the
                    -- exhausted-key case above.
                    v_next_seek := lower(v_current.name);
                    v_next_seek_strict := true;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;

        IF v_count = v_previous_count
           AND v_skipped = v_previous_skipped
           AND v_next_seek IS NOT DISTINCT FROM v_previous_seek
           AND v_next_seek_at IS NOT DISTINCT FROM v_previous_seek_at
           AND v_next_seek_version IS NOT DISTINCT FROM v_previous_seek_version THEN
            RAISE EXCEPTION 'storage.search made no progress at seek (%, %, %)',
                v_next_seek, v_next_seek_at, v_next_seek_version;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION storage.search(prefix text, bucketname text, limits integer, levels integer, offsets integer, search text, sortcolumn text, sortorder text, noncurrent_versions text, delete_markers text) OWNER TO supabase_storage_admin;

--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, p_start_after_version text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
    v_prefix_pattern text;
    v_sort_order text;
    v_sort_column text;
    v_version_tiebreak text;
BEGIN
    v_prefix := coalesce(p_prefix, '');
    -- Keep the raw prefix for common-prefix calculations and escape only LIKE metacharacters.
    v_prefix_pattern := replace(v_prefix, chr(92), chr(92) || chr(92));
    v_prefix_pattern := replace(v_prefix_pattern, '%', chr(92) || '%');
    v_prefix_pattern := replace(v_prefix_pattern, '_', chr(92) || '_');

    -- COALESCE first: NULL NOT IN (...) evaluates to NULL (not TRUE), so a
    -- bare NOT IN check silently leaves an explicit NULL argument unreset.
    noncurrent_versions := COALESCE(noncurrent_versions, 'exclude');
    delete_markers := COALESCE(delete_markers, 'exclude');
    IF noncurrent_versions NOT IN ('exclude', 'only', 'include') THEN
        noncurrent_versions := 'exclude';
    END IF;
    IF delete_markers NOT IN ('exclude', 'only', 'include') THEN
        delete_markers := 'exclude';
    END IF;

    -- $9 is only populated in multi-row mode; it's always '' otherwise, so
    -- only use each row's real version as a tiebreak in multi-row mode.
    v_version_tiebreak := CASE WHEN noncurrent_versions IN ('only', 'include') THEN 'COALESCE(version, '''')' ELSE '''''' END;

    -- Defense-in-depth: this function is independently reachable and must
    -- not trust p_sort_order/p_sort_column to already be validated by a
    -- caller. Normalize to the same strict allow-list storage.search_v2
    -- uses before interpolating anything into dynamic SQL below.
    v_sort_order := lower(coalesce(p_sort_order, 'asc'));
    IF v_sort_order NOT IN ('asc', 'desc') THEN
        v_sort_order := 'asc';
    END IF;

    v_sort_column := lower(coalesce(p_sort_column, 'updated_at'));
    IF v_sort_column NOT IN ('updated_at', 'created_at') THEN
        v_sort_column := 'updated_at';
    END IF;

    IF v_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                o.version AS obj_version,
                o.archived_at AS obj_archived_at,
                o.is_delete_marker AS obj_is_delete_marker,
                o.is_versioned AS obj_is_versioned,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $10 || '%%'
              AND ($7 != 'exclude' OR o.archived_at IS NULL)
              AND ($7 != 'only' OR o.archived_at IS NOT NULL)
              AND ($8 != 'exclude' OR NOT o.is_delete_marker)
              AND ($8 != 'only' OR o.is_delete_marker)
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                common_prefix AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                NULL::text AS version,
                NULL::timestamptz AS archived_at,
                NULL::boolean AS is_delete_marker,
                NULL::boolean AS is_versioned,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                obj_version AS version,
                obj_archived_at AS archived_at,
                obj_is_delete_marker AS is_delete_marker,
                obj_is_versioned AS is_versioned,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz),
                    name COLLATE "C",
                    %s
                ) %s ROW(
                    -- truncated the same way as the stored value above
                    date_trunc('milliseconds', COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz)),
                    $5,
                    $9
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata,
            version,
            archived_at,
            is_delete_marker,
            is_versioned
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s,
            COALESCE(version, '') %s
        LIMIT $4
    $sql$,
        v_sort_column,
        v_version_tiebreak,
        v_cursor_op,
        v_sort_column,
        v_sort_order,
        v_sort_order,
        v_sort_order
    );

    -- version is the third tiebreak component for two versions of the same
    -- key tying on both timestamp and name (see filtered CTE / ORDER BY above)
    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after, noncurrent_versions, delete_markers, coalesce(p_start_after_version, ''), v_prefix_pattern;
END;
$_$;


ALTER FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text, noncurrent_versions text, delete_markers text, p_start_after_version text) OWNER TO supabase_storage_admin;

--
-- Name: search_v2(text, text, integer, integer, text, text, text, text, text, text, timestamp with time zone, text, boolean); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text, noncurrent_versions text DEFAULT 'exclude'::text, delete_markers text DEFAULT 'exclude'::text, start_after_archived_at timestamp with time zone DEFAULT NULL::timestamp with time zone, start_after_version text DEFAULT ''::text, start_after_is_continuation boolean DEFAULT false) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb, version text, archived_at timestamp with time zone, is_delete_marker boolean, is_versioned boolean)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata,
            l.version,
            l.archived_at,
            l.is_delete_marker,
            l.is_versioned
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            CASE WHEN start_after_is_continuation THEN '' ELSE start_after END,
            CASE WHEN start_after_is_continuation THEN start_after ELSE '' END,
            v_sort_ord,
            noncurrent_versions,
            delete_markers,
            start_after_archived_at,
            start_after_version
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after,
            noncurrent_versions, delete_markers, start_after_version
        );
    END IF;
END;
$$;


ALTER FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer, levels integer, start_after text, sort_order text, sort_column text, sort_column_after text, noncurrent_versions text, delete_markers text, start_after_archived_at timestamp with time zone, start_after_version text, start_after_is_continuation boolean) OWNER TO supabase_storage_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION storage.update_updated_at_column() OWNER TO supabase_storage_admin;

--
-- Name: wake_lifecycle_state(); Type: FUNCTION; Schema: storage; Owner: supabase_storage_admin
--

CREATE FUNCTION storage.wake_lifecycle_state() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.lifecycle_configuration IS NULL THEN
        RETURN NEW;
    END IF;

    PERFORM storage.reconcile_lifecycle_state(NEW.id, false);
    RETURN NEW;
END;
$$;


ALTER FUNCTION storage.wake_lifecycle_state() OWNER TO supabase_storage_admin;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_claims_allowlist text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


ALTER TABLE auth.custom_oauth_providers OWNER TO supabase_auth_admin;

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: mfa_recovery_code_sets; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_recovery_code_sets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    mfa_factor_id uuid NOT NULL,
    failed_verification_count integer DEFAULT 0 NOT NULL,
    verification_locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mfa_recovery_code_sets_failed_verification_count_check CHECK ((failed_verification_count >= 0))
);


ALTER TABLE auth.mfa_recovery_code_sets OWNER TO supabase_auth_admin;

--
-- Name: mfa_recovery_codes; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_recovery_codes (
    id uuid NOT NULL,
    mfa_recovery_code_set_id uuid NOT NULL,
    code_hash text NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE auth.mfa_recovery_codes OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: scim_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.scim_tokens (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    token_hash text NOT NULL,
    prefix text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone,
    CONSTRAINT scim_tokens_expires_at_future CHECK (((expires_at IS NULL) OR (expires_at > created_at))),
    CONSTRAINT scim_tokens_revoked_after_created CHECK (((revoked_at IS NULL) OR (revoked_at >= created_at))),
    CONSTRAINT scim_tokens_token_hash_check CHECK ((token_hash ~ '^[0-9a-f]{64}$'::text))
);


ALTER TABLE auth.scim_tokens OWNER TO supabase_auth_admin;

--
-- Name: scim_users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.scim_users (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    user_id uuid,
    resource jsonb NOT NULL,
    user_name text GENERATED ALWAYS AS (lower((resource ->> 'userName'::text))) STORED NOT NULL,
    external_id text GENERATED ALWAYS AS ((resource ->> 'externalId'::text)) STORED,
    active boolean GENERATED ALWAYS AS (COALESCE(((resource ->> 'active'::text))::boolean, true)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE auth.scim_users OWNER TO supabase_auth_admin;

--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


ALTER TABLE auth.webauthn_challenges OWNER TO supabase_auth_admin;

--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


ALTER TABLE auth.webauthn_credentials OWNER TO supabase_auth_admin;

--
-- Name: business_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT business_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'agent'::text])))
);


ALTER TABLE public.business_members OWNER TO postgres;

--
-- Name: business_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    display_name text NOT NULL,
    business_info text,
    logo_placeholder text,
    timezone text DEFAULT 'Asia/Kolkata'::text NOT NULL,
    default_language text DEFAULT 'ta,en'::text NOT NULL,
    notification_connection_drops boolean DEFAULT true NOT NULL,
    notification_unread_alerts boolean DEFAULT true NOT NULL,
    notification_daily_digest boolean DEFAULT true NOT NULL,
    default_connection_id uuid,
    webhook_retry_policy text DEFAULT 'standard'::text NOT NULL,
    opt_out_keywords text DEFAULT 'STOP,UNSUBSCRIBE,QUIT,நிறுத்து'::text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    business_hours jsonb DEFAULT '{"timezone": "Asia/Kolkata", "holiday_dates": [], "weekly_schedule": {"friday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "monday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "sunday": {"is_open": false, "open_time": "00:00", "close_time": "00:00"}, "tuesday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "saturday": {"is_open": true, "open_time": "10:00", "close_time": "16:00"}, "thursday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "wednesday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}}}'::jsonb NOT NULL,
    automation_settings jsonb DEFAULT '{"opt_in_keywords": ["START", "UNSTOP", "JOIN", "தொடங்கு"], "opt_out_keywords": ["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "நிறுத்து"], "is_automation_enabled": false, "human_handover_keywords": ["AGENT", "HUMAN", "REPRESENTATIVE", "0", "உதவி", "மனிதர்"], "max_bot_replies_per_hour": 10, "circuit_breaker_max_replies_15m": 5}'::jsonb NOT NULL,
    CONSTRAINT business_settings_webhook_retry_policy_check CHECK ((webhook_retry_policy = ANY (ARRAY['standard'::text, 'aggressive'::text, 'relaxed'::text])))
);


ALTER TABLE public.business_settings OWNER TO postgres;

--
-- Name: businesses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon_name text DEFAULT 'briefcase'::text,
    accent_color text DEFAULT 'indigo'::text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.businesses OWNER TO postgres;

--
-- Name: contact_activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    activity_type text NOT NULL,
    title text NOT NULL,
    description text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT contact_activity_logs_activity_type_check CHECK ((activity_type = ANY (ARRAY['created'::text, 'updated'::text, 'status_changed'::text, 'category_changed'::text, 'tag_added'::text, 'tag_removed'::text, 'note_added'::text, 'archived'::text, 'unarchived'::text, 'inbound_message'::text, 'outbound_message'::text, 'opt_out'::text, 'opt_in'::text, 'imported'::text])))
);


ALTER TABLE public.contact_activity_logs OWNER TO postgres;

--
-- Name: contact_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    author_id uuid,
    author_name text DEFAULT 'Staff'::text NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.contact_notes OWNER TO postgres;

--
-- Name: crm_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    color text DEFAULT 'indigo'::text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.crm_categories OWNER TO postgres;

--
-- Name: crm_segments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.crm_segments OWNER TO postgres;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    avatar_url text,
    is_superadmin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- Name: wa_automation_execution_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_automation_execution_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    rule_id uuid,
    connection_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    inbound_message_id uuid,
    outbound_message_id uuid,
    trigger_matched text NOT NULL,
    conditions_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    actions_executed jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text NOT NULL,
    skip_reason text,
    error_message text,
    execution_time_ms integer,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT wa_automation_execution_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'skipped'::text, 'failed'::text, 'delayed'::text])))
);


ALTER TABLE public.wa_automation_execution_logs OWNER TO postgres;

--
-- Name: wa_automation_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    connection_id uuid,
    name text NOT NULL,
    description text,
    trigger_type text NOT NULL,
    priority integer DEFAULT 100 NOT NULL,
    stop_processing_on_match boolean DEFAULT true NOT NULL,
    cooldown_seconds integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT wa_automation_rules_trigger_type_check CHECK ((trigger_type = ANY (ARRAY['inbound_message'::text, 'first_inbound_message'::text, 'keyword_match'::text, 'outside_business_hours'::text, 'inside_business_hours'::text, 'customer_enquiry'::text, 'opt_out'::text, 'opt_in'::text, 'human_requested'::text])))
);


ALTER TABLE public.wa_automation_rules OWNER TO postgres;

--
-- Name: wa_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    display_name text NOT NULL,
    phone_number text NOT NULL,
    phone_number_id text NOT NULL,
    waba_id text NOT NULL,
    credential_ref text NOT NULL,
    connection_status text DEFAULT 'setup_required'::text NOT NULL,
    webhook_status text DEFAULT 'unconfigured'::text NOT NULL,
    quality_rating text DEFAULT 'UNKNOWN'::text,
    is_enabled boolean DEFAULT true NOT NULL,
    description text,
    last_connected_at timestamp with time zone,
    last_checked_at timestamp with time zone,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT wa_connections_connection_status_check CHECK ((connection_status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'setup_required'::text, 'error'::text]))),
    CONSTRAINT wa_connections_quality_rating_check CHECK ((quality_rating = ANY (ARRAY['GREEN'::text, 'YELLOW'::text, 'RED'::text, 'UNKNOWN'::text]))),
    CONSTRAINT wa_connections_webhook_status_check CHECK ((webhook_status = ANY (ARRAY['active'::text, 'pending'::text, 'unconfigured'::text, 'error'::text])))
);


ALTER TABLE public.wa_connections OWNER TO postgres;

--
-- Name: wa_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    phone_number text NOT NULL,
    display_name text,
    profile_photo_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_opted_out boolean DEFAULT false NOT NULL,
    opted_out_at timestamp with time zone,
    opted_out_reason text,
    last_welcome_sent_at timestamp with time zone,
    last_inbound_at timestamp with time zone,
    total_inbound_count integer DEFAULT 0 NOT NULL,
    email text,
    status text DEFAULT 'lead'::text NOT NULL,
    category text,
    source text DEFAULT 'whatsapp'::text NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    assigned_agent_id uuid,
    assigned_agent_name text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    custom_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT wa_contacts_source_check CHECK ((source = ANY (ARRAY['whatsapp'::text, 'website'::text, 'referral'::text, 'walk_in'::text, 'csv_import'::text, 'manual'::text, 'other'::text]))),
    CONSTRAINT wa_contacts_status_check CHECK ((status = ANY (ARRAY['lead'::text, 'active'::text, 'inactive'::text, 'customer'::text])))
);


ALTER TABLE public.wa_contacts OWNER TO postgres;

--
-- Name: wa_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    last_message_preview text,
    last_message_at timestamp with time zone,
    unread_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_automation_paused boolean DEFAULT false NOT NULL,
    automation_paused_until timestamp with time zone,
    automation_paused_by uuid,
    bot_reply_count_window integer DEFAULT 0 NOT NULL,
    last_bot_reply_at timestamp with time zone,
    CONSTRAINT wa_conversations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text, 'pending_human'::text])))
);


ALTER TABLE public.wa_conversations OWNER TO postgres;

--
-- Name: wa_credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    connection_id uuid NOT NULL,
    business_id uuid NOT NULL,
    key_version text DEFAULT 'v1'::text NOT NULL,
    iv text NOT NULL,
    auth_tag text NOT NULL,
    ciphertext text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE public.wa_credentials OWNER TO postgres;

--
-- Name: wa_message_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_message_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    connection_id uuid,
    template_name text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    category text NOT NULL,
    status text DEFAULT 'APPROVED'::text NOT NULL,
    components jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    meta_template_id text,
    rejection_reason text,
    is_archived boolean DEFAULT false NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT wa_message_templates_category_check CHECK ((category = ANY (ARRAY['UTILITY'::text, 'MARKETING'::text, 'AUTHENTICATION'::text]))),
    CONSTRAINT wa_message_templates_status_check CHECK ((status = ANY (ARRAY['APPROVED'::text, 'PENDING'::text, 'REJECTED'::text, 'PAUSED'::text, 'DISABLED'::text, 'DRAFT'::text, 'ARCHIVED'::text])))
);


ALTER TABLE public.wa_message_templates OWNER TO postgres;

--
-- Name: wa_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    direction text NOT NULL,
    message_type text DEFAULT 'text'::text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    meta_message_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    error_code text,
    error_message text,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT wa_messages_direction_check CHECK ((direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))),
    CONSTRAINT wa_messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'template'::text, 'image'::text, 'document'::text, 'audio'::text, 'interactive'::text, 'reaction'::text]))),
    CONSTRAINT wa_messages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text])))
);


ALTER TABLE public.wa_messages OWNER TO postgres;

--
-- Name: wa_rule_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_rule_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    action_type text NOT NULL,
    action_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    delay_seconds integer DEFAULT 0 NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT wa_rule_actions_action_type_check CHECK ((action_type = ANY (ARRAY['send_text_message'::text, 'send_template_message'::text, 'send_interactive_buttons'::text, 'send_interactive_list'::text, 'assign_agent'::text, 'update_conversation_status'::text, 'apply_contact_label'::text, 'set_opt_status'::text, 'schedule_follow_up'::text])))
);


ALTER TABLE public.wa_rule_actions OWNER TO postgres;

--
-- Name: wa_rule_conditions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_rule_conditions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    rule_id uuid NOT NULL,
    condition_group integer DEFAULT 0 NOT NULL,
    condition_type text NOT NULL,
    operator text DEFAULT 'equals'::text NOT NULL,
    match_value jsonb DEFAULT '{}'::jsonb NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT wa_rule_conditions_condition_type_check CHECK ((condition_type = ANY (ARRAY['keyword_exact'::text, 'keyword_contains'::text, 'keyword_starts_with'::text, 'keyword_regex'::text, 'business_hours'::text, 'outside_hours'::text, 'conversation_status'::text, 'contact_opt_in'::text, 'first_time_contact'::text]))),
    CONSTRAINT wa_rule_conditions_operator_check CHECK ((operator = ANY (ARRAY['equals'::text, 'contains'::text, 'starts_with'::text, 'regex'::text, 'is_true'::text, 'is_false'::text, 'in_list'::text])))
);


ALTER TABLE public.wa_rule_conditions OWNER TO postgres;

--
-- Name: wa_webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wa_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid,
    connection_id uuid,
    phone_number_id text NOT NULL,
    meta_event_id text,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    is_processed boolean DEFAULT false NOT NULL,
    processed_at timestamp with time zone,
    processing_error text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT wa_webhook_events_event_type_check CHECK ((event_type = ANY (ARRAY['message'::text, 'status'::text, 'error'::text, 'other'::text])))
);


ALTER TABLE public.wa_webhook_events OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT timezone('utc'::text, clock_timestamp()) NOT NULL,
    inserted_at timestamp without time zone DEFAULT timezone('utc'::text, clock_timestamp()) NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    binary_payload bytea,
    skip_broadcast boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone
)
PARTITION BY RANGE (inserted_at);


ALTER TABLE realtime.messages OWNER TO supabase_realtime_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: supabase_admin
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone DEFAULT now()
);


ALTER TABLE realtime.schema_migrations OWNER TO supabase_admin;

--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    selected_columns text[],
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


ALTER TABLE realtime.subscription OWNER TO supabase_realtime_admin;

--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bucket_lifecycle_states; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.bucket_lifecycle_states (
    bucket_id text NOT NULL,
    generation uuid,
    next_run_at timestamp with time zone,
    claim_id uuid,
    claim_until timestamp with time zone,
    continuation jsonb,
    last_started_at timestamp with time zone,
    last_completed_at timestamp with time zone,
    last_success_at timestamp with time zone,
    last_result jsonb,
    failure_count integer DEFAULT 0 NOT NULL,
    last_error jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bucket_lifecycle_continuation_object_check CHECK (((continuation IS NULL) OR (jsonb_typeof(continuation) = 'object'::text))),
    CONSTRAINT bucket_lifecycle_failure_count_check CHECK ((failure_count >= 0)),
    CONSTRAINT bucket_lifecycle_last_result_object_check CHECK (((last_result IS NULL) OR (jsonb_typeof(last_result) = 'object'::text))),
    CONSTRAINT bucket_lifecycle_recovery_due_check CHECK (((next_run_at IS NOT NULL) OR (NOT jsonb_path_exists(COALESCE(continuation, '{}'::jsonb), '$."batch"."inFlight"'::jsonpath))))
);


ALTER TABLE storage.bucket_lifecycle_states OWNER TO supabase_storage_admin;

--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL,
    versioning_status text DEFAULT 'DISABLED'::text NOT NULL,
    lifecycle_configuration jsonb,
    lifecycle_configuration_generation uuid,
    CONSTRAINT buckets_lifecycle_configuration_pair_check CHECK (((lifecycle_configuration IS NULL) = (lifecycle_configuration_generation IS NULL))),
    CONSTRAINT buckets_lifecycle_configuration_shape_check CHECK (((lifecycle_configuration IS NULL) OR ((jsonb_typeof(lifecycle_configuration) = 'object'::text) AND (lifecycle_configuration ? 'rules'::text) AND
CASE
    WHEN (jsonb_typeof((lifecycle_configuration -> 'rules'::text)) = 'array'::text) THEN ((jsonb_array_length((lifecycle_configuration -> 'rules'::text)) >= 1) AND (jsonb_array_length((lifecycle_configuration -> 'rules'::text)) <= 1000))
    ELSE false
END))),
    CONSTRAINT buckets_lifecycle_configuration_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR ((lifecycle_configuration IS NULL) AND (lifecycle_configuration_generation IS NULL)))),
    CONSTRAINT buckets_versioning_standard_only_check CHECK (((type = 'STANDARD'::storage.buckettype) OR (versioning_status = 'DISABLED'::text))),
    CONSTRAINT buckets_versioning_status_check CHECK ((versioning_status = ANY (ARRAY['DISABLED'::text, 'ENABLED'::text, 'SUSPENDED'::text])))
);


ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;

--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


ALTER TABLE storage.buckets_analytics OWNER TO supabase_storage_admin;

--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.buckets_vectors OWNER TO supabase_storage_admin;

--
-- Name: lifecycle_abandoned_artifacts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.lifecycle_abandoned_artifacts (
    bucket_id text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    version text,
    attempted_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.lifecycle_abandoned_artifacts OWNER TO supabase_storage_admin;

--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE storage.migrations OWNER TO supabase_storage_admin;

--
-- Name: objects; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    archived_at timestamp with time zone,
    is_delete_marker boolean DEFAULT false NOT NULL,
    is_versioned boolean DEFAULT false NOT NULL
);


ALTER TABLE storage.objects OWNER TO supabase_storage_admin;

--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: supabase_storage_admin
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb,
    metadata jsonb
);


ALTER TABLE storage.s3_multipart_uploads OWNER TO supabase_storage_admin;

--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.s3_multipart_uploads_parts OWNER TO supabase_storage_admin;

--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: supabase_storage_admin
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE storage.vector_indexes OWNER TO supabase_storage_admin;

--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: postgres
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text,
    rollback text[]
);


ALTER TABLE supabase_migrations.schema_migrations OWNER TO postgres;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.custom_oauth_providers (id, provider_type, identifier, name, client_id, client_secret, acceptable_client_ids, scopes, pkce_enabled, attribute_mapping, authorization_params, enabled, email_optional, issuer, discovery_url, skip_nonce_check, cached_discovery, discovery_cached_at, authorization_url, token_url, userinfo_url, jwks_uri, created_at, updated_at, custom_claims_allowlist) FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at, invite_token, referrer, oauth_client_state_id, linking_target_id, email_optional) FROM stdin;
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "email": "user_a_astro@gokulconnect.com"}	email	2026-11-06 12:19:41.141909+00	2026-11-06 12:19:41.141909+00	2026-11-06 12:19:41.141909+00	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "email": "user_b_vivaham@gokulconnect.com"}	email	2026-11-06 12:19:41.141909+00	2026-11-06 12:19:41.141909+00	2026-11-06 12:19:41.141909+00	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
d5d32479-0a5d-43d1-8b81-0bac8e6b559d	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	{"sub": "d5d32479-0a5d-43d1-8b81-0bac8e6b559d", "email": "gokulsastrologicalinsights@gmail.com", "email_verified": true, "phone_verified": false}	email	2026-11-07 08:54:20.560306+00	2026-11-07 08:54:20.560354+00	2026-11-07 08:54:20.560354+00	5b90808a-c7b9-4160-aa95-8c1ef5f774e3
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
789f2b73-af91-44df-a670-3cba65decf96	2026-11-07 12:39:21.205756+00	2026-11-07 12:39:21.205756+00	password	363d3796-2fc5-4b5a-9e46-0028bdb0b8ae
c395ac9d-59e2-424c-a655-5c2085f40970	2026-11-07 12:39:21.322059+00	2026-11-07 12:39:21.322059+00	password	79a5db46-3068-46cd-994e-28317f813eb1
e5f5fca7-9608-4e35-af51-ba9126081d55	2026-11-07 12:40:17.190209+00	2026-11-07 12:40:17.190209+00	password	6b05c2f4-1fb1-4bae-ad18-ad8010a4879c
7db13812-6c2a-40c2-b43a-f2ab785a3143	2026-11-07 12:40:59.637188+00	2026-11-07 12:40:59.637188+00	password	473e3f28-b172-438a-a22c-02cf7a1bbdd5
68102110-7502-4d40-b953-e51ca78e7f88	2026-11-07 12:47:13.76965+00	2026-11-07 12:47:13.76965+00	password	cfa1cca3-eb14-4634-b5ee-30a9c33f9b64
0897a242-0e1e-42cf-88a2-77f26784d906	2026-11-07 12:56:22.813364+00	2026-11-07 12:56:22.813364+00	password	b8b68783-210f-4b27-91df-3345bf3bbd6d
b4c50c5d-12e1-44a6-b4ea-c1636a3999f3	2026-11-07 13:00:20.36194+00	2026-11-07 13:00:20.36194+00	password	4290fe27-b4b0-4559-9283-f26a81eeb4e1
5cd56b49-3ac9-4da0-b8a3-6c1116c7ae7c	2026-11-07 13:04:13.233075+00	2026-11-07 13:04:13.233075+00	password	247e6993-ce1b-4291-99d8-d827b462d018
5aabc470-8bb0-4741-a374-bf9c944de1e4	2026-11-07 13:11:17.302147+00	2026-11-07 13:11:17.302147+00	password	4ef1820e-937b-485a-b579-501530b27304
4805e81c-f5fa-4c46-81ba-a41ca20878c8	2026-11-07 13:14:57.011264+00	2026-11-07 13:14:57.011264+00	password	40096d2e-feb2-4172-ba06-49cab5e12e65
0325535f-0924-4d82-a142-6d9214cd4692	2026-11-07 13:17:02.385702+00	2026-11-07 13:17:02.385702+00	password	ad845cda-285c-466f-8319-96ede7eddaca
0c6a08b0-2417-4376-b7ed-b3171200d15e	2026-11-07 13:31:41.499385+00	2026-11-07 13:31:41.499385+00	password	85ae8322-c180-4ed4-b3c1-af97a9520fc7
71327de4-e957-45e5-9784-bd8f8e160d3c	2026-11-07 13:31:41.629437+00	2026-11-07 13:31:41.629437+00	password	eafe06f4-101e-4747-bc02-cdf11641e827
d6d10164-4c3c-4164-97e9-21899f6e6835	2026-11-07 13:32:07.540808+00	2026-11-07 13:32:07.540808+00	password	dafcb366-5775-4005-8c39-9bfe3e46ad26
9fbbd3df-bc05-4b69-8f8f-05c0fc809569	2026-11-07 13:32:07.622636+00	2026-11-07 13:32:07.622636+00	password	a7cb43d1-031c-4c43-b862-041ecf0fb100
11abd938-a61a-4ba6-b0b1-ab7f36740c90	2026-11-07 13:33:14.39913+00	2026-11-07 13:33:14.39913+00	password	20cae32a-c96a-43b7-ac19-9fed229f1507
1a48ada1-7e5e-4e9a-9d4a-2c87ceb04e5e	2026-11-07 13:47:48.4424+00	2026-11-07 13:47:48.4424+00	password	e8712a70-1aed-41e8-bd8d-d6d05b004a4d
eaefd3f1-cb20-4979-a1cf-d5b7271adcd3	2026-11-07 13:47:48.519675+00	2026-11-07 13:47:48.519675+00	password	30ad6696-5995-468f-bd2a-f363027d3f25
a1e26074-fe85-469c-92f3-b20df2e29e44	2026-11-07 13:48:12.687544+00	2026-11-07 13:48:12.687544+00	password	a91e8291-204a-41b3-98e4-39fe1f600b8f
8eb46617-36a1-4af6-841b-3be8308f5a11	2026-11-07 13:48:12.750603+00	2026-11-07 13:48:12.750603+00	password	49ecb40a-21d9-460f-a354-23f62c22f36f
273cb7b4-a49f-49c5-aa91-405c11d0ef6a	2026-11-07 13:54:06.298962+00	2026-11-07 13:54:06.298962+00	password	991f7974-7e7e-4419-bbaa-7b19e494bec6
f0f5b6d9-a201-4593-bec7-1abdc5dd1944	2026-11-07 13:54:06.397581+00	2026-11-07 13:54:06.397581+00	password	3d4aa19f-e4b2-46a6-b807-6712f6478d75
d351cf4a-bc7a-4e2a-8e04-f3b4da33a5f2	2026-11-07 13:54:34.279363+00	2026-11-07 13:54:34.279363+00	password	330befa8-4e27-48b4-9aac-774ada616197
f61e0d14-6730-41d8-ab04-b19fbe6b4a32	2026-11-07 13:55:16.015032+00	2026-11-07 13:55:16.015032+00	password	b0ecc0d3-a264-45b5-b9a9-448d7c659e47
3f379520-4a8d-41c8-aae8-a027532626fa	2026-11-07 13:56:04.485752+00	2026-11-07 13:56:04.485752+00	password	a3240dc2-16c9-4c2f-8a12-75b5e7124207
3b8350ee-d8fc-4f2e-8525-d195b4eca827	2026-11-07 13:56:04.549778+00	2026-11-07 13:56:04.549778+00	password	99a2bb9a-0ccd-46c8-99db-f66e287fa37b
e84fa9d7-f9c5-425e-b406-a8ea27360f43	2026-11-07 13:58:10.053778+00	2026-11-07 13:58:10.053778+00	password	68a6a243-d876-40a5-a54c-c7a5d59d0be8
069e9a1c-cd3f-484f-9913-dc7ac74ab5c7	2026-11-07 13:58:10.275894+00	2026-11-07 13:58:10.275894+00	password	6b5a61ba-4b6a-4ece-8156-106b15a27b83
391556a0-7035-4758-8897-d8666bf4257e	2026-11-07 13:58:42.697678+00	2026-11-07 13:58:42.697678+00	password	21ef8567-fdcf-4100-ba87-ce29191a859f
5dc37fd5-532d-40cf-86b8-cce4da87cc24	2026-11-07 13:58:42.781508+00	2026-11-07 13:58:42.781508+00	password	04fabb8a-544b-45d8-96de-38087a6949fe
4ec49456-be32-4d9a-a4b6-b74176510253	2026-11-07 13:59:02.900553+00	2026-11-07 13:59:02.900553+00	password	9cdf627c-939b-4f2d-a528-c014d6b82ff6
ed907978-ab67-4b76-a502-8e88a80c45a4	2026-11-07 13:59:02.993777+00	2026-11-07 13:59:02.993777+00	password	2031dd53-8683-4071-a122-93ca9621dbd5
c3ddcb27-3bab-476d-982d-71bf0c3aece1	2026-11-07 13:59:18.580478+00	2026-11-07 13:59:18.580478+00	password	1b055d82-c032-47fb-a9f6-d0fe3d054674
3cae7606-3d01-4a10-ae14-db559fd7f3b0	2026-11-07 13:59:18.675741+00	2026-11-07 13:59:18.675741+00	password	d6b1ef58-6bde-468c-83ef-44d510ff2819
5e7be0f1-ae41-4522-933b-dac4d97415bd	2026-11-07 13:59:28.595064+00	2026-11-07 13:59:28.595064+00	password	42a6e47a-78a1-49b8-8114-1452bf235e4e
a0cb93bc-0e8f-433d-bb66-6d8f5fc39211	2026-11-07 13:59:28.767264+00	2026-11-07 13:59:28.767264+00	password	19d6aff9-120c-4d0f-bb74-dabc918d3471
a6f8e944-21f4-4600-963e-c34993c104ab	2026-11-07 13:59:31.481137+00	2026-11-07 13:59:31.481137+00	password	bd8626b5-13c8-44cf-ad9a-3cd537917ec9
c13ee6d7-fdca-419f-94aa-2b91d7df8b05	2026-11-07 13:59:31.566293+00	2026-11-07 13:59:31.566293+00	password	af26cb8c-aceb-463f-a53e-829e9c8041bd
5d10f993-8871-490b-a3ee-9487e5d1f163	2026-11-07 13:59:41.408948+00	2026-11-07 13:59:41.408948+00	password	6644ecf2-48fe-439a-887f-48ac2bc8f98e
3b560fa4-a322-4f39-8704-279ba6bf94eb	2026-11-07 13:59:41.523854+00	2026-11-07 13:59:41.523854+00	password	e178a3ad-bd28-41b6-8d35-9ee6211af131
e979135e-59d0-47c6-ba5c-56ab5149e048	2026-11-07 14:01:15.850426+00	2026-11-07 14:01:15.850426+00	password	1de6451b-8a53-45ec-b2f3-397cb7a9df7f
02f1b8b7-166a-4d6d-b4ff-d3701b9d8e28	2026-11-07 14:01:15.935682+00	2026-11-07 14:01:15.935682+00	password	98d15366-04c8-47d5-accb-518144ccd9bb
d5d89e15-42bc-493e-8793-ea9937f9e2f5	2026-11-07 14:03:31.551132+00	2026-11-07 14:03:31.551132+00	password	10ba7929-65e7-43f0-ac1a-4c4a160790ed
98835558-41ed-4ce0-88e7-55d1e9c7f8eb	2026-11-07 14:03:31.807353+00	2026-11-07 14:03:31.807353+00	password	2cadb267-fe08-4191-9270-d317307c441d
4d885dc6-c266-4aa5-9aa9-7226e708e8cd	2026-11-07 14:04:00.117197+00	2026-11-07 14:04:00.117197+00	password	0d678b5e-c4f8-4f4f-a0c7-42b3208ea84d
ca6eebe5-5c84-439c-9e82-4dbdcd822a0a	2026-11-07 14:04:00.229426+00	2026-11-07 14:04:00.229426+00	password	d384550e-9d6b-477d-838e-16784a2706cb
dc2bca82-597e-4f5c-97fd-162484fcec7f	2026-11-07 14:04:19.891657+00	2026-11-07 14:04:19.891657+00	password	74895706-8c8c-4d62-920d-a404039dc982
8907417b-9921-4138-8ebf-62a7255ae0ef	2026-11-07 14:04:20.002479+00	2026-11-07 14:04:20.002479+00	password	f0a5989a-053b-4de6-aa41-3d69840e66e6
73a7f111-97a9-4efa-ba23-18d8a3be2258	2026-11-07 14:04:34.398001+00	2026-11-07 14:04:34.398001+00	password	7a6216ba-8ce8-4512-ad42-66c1d8ff6715
284bab39-920a-4b9e-ac14-5d720ea34b4a	2026-11-07 14:04:34.493409+00	2026-11-07 14:04:34.493409+00	password	00dcad4b-96e0-4393-b1c6-97a40bf9043d
2b804dcd-b9d6-4583-8916-b6277440fe1c	2026-11-07 14:04:44.754419+00	2026-11-07 14:04:44.754419+00	password	1fe91d78-0119-46cb-95f3-f57702b11c82
0eb46a4d-0362-4cda-962f-47de5f0f5893	2026-11-07 14:04:44.928962+00	2026-11-07 14:04:44.928962+00	password	e5aca0d6-7205-4696-b358-7a9df14af3f7
47724107-e1f6-433d-a23d-b7dcfe5bb076	2026-11-07 14:04:47.703722+00	2026-11-07 14:04:47.703722+00	password	8105ab19-5102-4d4f-98ce-957385a8db34
8c7771d0-96a2-493d-ba65-c2382e17f41b	2026-11-07 14:04:47.799773+00	2026-11-07 14:04:47.799773+00	password	32975a11-73ab-42f2-b85e-f4efcb7052d9
b9ca3760-f3b7-4658-8043-c93c38836094	2026-11-07 14:04:58.617066+00	2026-11-07 14:04:58.617066+00	password	7c6d6ccd-d443-4477-a04d-7cbc63a4b90d
4695a989-f3f5-4c3c-a27b-be76277b0839	2026-11-07 14:04:58.731752+00	2026-11-07 14:04:58.731752+00	password	f402da90-704b-49f8-9106-c71a087a99ef
8943b3a4-1710-46e6-98b9-927d16b53848	2026-11-07 14:05:50.90728+00	2026-11-07 14:05:50.90728+00	password	f1706195-abef-4748-901c-d10f58f13f83
2e23677c-0849-4dd9-b052-bfa860557bcc	2026-11-07 14:05:51.085967+00	2026-11-07 14:05:51.085967+00	password	0a06d4a6-ad63-4cca-884e-a0eda6023283
a30cf751-5c8e-4652-81f2-1c36fe537796	2026-11-07 14:06:19.574953+00	2026-11-07 14:06:19.574953+00	password	4f7ab6a9-13a3-4886-9ee3-b67bdd0086f0
98b7aaab-7b51-4851-bfda-a933119c3279	2026-11-07 14:06:19.67128+00	2026-11-07 14:06:19.67128+00	password	a879e717-d3b4-46e5-9f06-ae234d4f1768
cae0e144-ed66-4ee4-9367-07c98fa8b427	2026-11-07 14:06:39.213447+00	2026-11-07 14:06:39.213447+00	password	18e40e9b-e6f9-4c19-b69e-9c3ffac72d72
e59a02de-96ef-4662-9aff-bdf3264e851c	2026-11-07 14:06:39.306122+00	2026-11-07 14:06:39.306122+00	password	f0255c9d-26c4-4665-8ec1-c2d6ad955985
6545e789-2f03-4b35-ba81-238247821414	2026-11-07 14:06:53.731795+00	2026-11-07 14:06:53.731795+00	password	bc5235f2-af8d-4e65-bc5d-d52fc79b79ff
ea751e30-c3ff-4312-bd9a-ef6331b0bcea	2026-11-07 14:06:53.821362+00	2026-11-07 14:06:53.821362+00	password	b36ec11e-2e74-460a-b716-66748ebb264c
f3b669dc-6450-41f1-b5f2-8aa577591b9b	2026-11-07 14:07:04.459968+00	2026-11-07 14:07:04.459968+00	password	5466ccf9-293b-4944-9a72-cb8b676b4445
ca6fda20-d721-47f0-84d2-b180040e533b	2026-11-07 14:07:04.663385+00	2026-11-07 14:07:04.663385+00	password	8c7653d5-4cfc-4cc1-b69a-9eaf9d4534f4
8f7ac634-a532-4e0b-aa06-fed06abddc98	2026-11-07 14:07:07.368074+00	2026-11-07 14:07:07.368074+00	password	1a07c5e8-3530-4c5d-9894-3fc5461aaae8
9f33bcbb-1a22-4166-a195-01e0e69504cb	2026-11-07 14:07:07.458713+00	2026-11-07 14:07:07.458713+00	password	c38ff28e-8660-4d60-865c-3feed3c27f4e
c5bb16e9-f314-4798-83be-f3714b25ac69	2026-11-07 14:07:17.464701+00	2026-11-07 14:07:17.464701+00	password	8c35cea3-7005-4c9c-b3b2-3a4481e92509
19e2a0bc-d75a-4815-8424-57ac002a0a00	2026-11-07 14:07:17.566225+00	2026-11-07 14:07:17.566225+00	password	b2be9a8d-daf6-49bc-9e5b-5c363f7ac037
6b3b7a46-c3e3-4eef-b68f-05fe740ed4e5	2026-11-07 14:08:06.389202+00	2026-11-07 14:08:06.389202+00	password	ca9aea7f-85d1-4c0f-9218-a4a591394680
c8cc0aee-2893-4972-989c-4aaa0711ae7c	2026-11-07 09:35:09.616899+00	2026-11-07 09:35:09.616899+00	password	9ba821df-71b2-4239-b327-f4a55523ac96
0175255d-c61b-4a5f-9b42-a942677daceb	2026-11-07 09:37:16.582981+00	2026-11-07 09:37:16.582981+00	password	5f7fcfe4-3cce-46ac-b7f8-41c50df7bc17
380ef91f-9dbf-4c7a-8b40-56020906307b	2026-11-07 09:37:16.831741+00	2026-11-07 09:37:16.831741+00	password	92998ace-3123-4183-8276-e18e9dfb7953
5abb0fb5-e2c3-49d4-ac48-08556174d342	2026-11-07 14:09:03.436615+00	2026-11-07 14:09:03.436615+00	password	4ccad33f-836c-4c6e-bd51-61bf2a5e5481
fdcb07da-8789-43ca-9b76-b628f37cfe60	2026-11-07 14:09:03.545887+00	2026-11-07 14:09:03.545887+00	password	3d1cffdf-6ac6-4b24-9613-220690910692
0644cf0f-cf21-49d5-bd95-b116d936c845	2026-11-07 14:12:31.845216+00	2026-11-07 14:12:31.845216+00	password	a9acc857-86b4-49d8-bdda-5d39d295206f
d90956f7-0aa7-48fc-b369-469d1e1638eb	2026-11-07 14:21:45.255162+00	2026-11-07 14:21:45.255162+00	password	f6d68379-f33b-4591-a6d9-b1c8d3eea836
f8b65cb9-93ea-4733-ab8b-0705eccef098	2026-11-07 14:24:03.770374+00	2026-11-07 14:24:03.770374+00	password	32c2f92e-4ca2-4c63-8d62-848a5f822970
240da660-03fd-4263-8274-6fe04a3466bb	2026-11-07 14:33:24.108957+00	2026-11-07 14:33:24.108957+00	password	0aca67d2-8239-490a-bf90-f999d244327f
e4ba6f27-78a1-4456-9da6-b033c113f731	2026-11-07 14:40:39.142766+00	2026-11-07 14:40:39.142766+00	password	9bf5d0a0-3ea3-491c-9461-48a6575c767a
7d7a7edf-789e-4ae5-abc5-ee7a16c85fe7	2026-11-07 14:50:56.169843+00	2026-11-07 14:50:56.169843+00	password	cfcf9918-c13a-445a-a771-7e41b47e3cd1
4dc9a5f9-3280-47c6-9073-9299f937819e	2026-11-07 14:52:06.796316+00	2026-11-07 14:52:06.796316+00	password	4c2996f7-28ca-41f1-9f03-a4b03e84fca3
d60b511a-d679-4a36-99ac-daf4c3ce9c3a	2026-11-07 14:57:36.385198+00	2026-11-07 14:57:36.385198+00	password	aa91533a-a412-4c56-9afd-f79467dbdae6
c72f10b7-a0ad-4a4d-ad97-e9445d9c9f13	2026-11-07 15:00:27.873331+00	2026-11-07 15:00:27.873331+00	password	4fa36a68-713b-47bd-8d6f-3d0b456d5bba
e5035e39-6b9a-4d16-9fb7-2cdfd2b0edba	2026-11-07 15:01:10.5415+00	2026-11-07 15:01:10.5415+00	password	2d144de2-c1a4-46d9-b8fe-f0075722f87a
e0b525b9-90b7-4510-ad12-7d622884fd76	2026-11-07 15:30:49.339909+00	2026-11-07 15:30:49.339909+00	password	74ea2e57-6ed0-4231-8871-1e1c3d3e2cd2
97a57772-8bd6-4b2b-869c-f4916ab136ea	2026-11-07 15:51:26.225906+00	2026-11-07 15:51:26.225906+00	password	758d97fa-0943-4e97-8eda-625c1c7c91d9
fee05a73-56fb-47ba-b10d-cd2520b6fc69	2026-11-08 04:25:02.549191+00	2026-11-08 04:25:02.549191+00	password	f8917e12-2811-4765-b220-fe3d15146d5a
4bfb374a-6b99-48f9-aab0-13495b501fa2	2026-11-08 04:26:09.989716+00	2026-11-08 04:26:09.989716+00	password	5cc1fdd3-f2ef-4c32-89b8-a122864d6d5b
13b41c1f-ddbb-4e0c-9e48-e171c1907214	2026-11-08 04:43:19.058611+00	2026-11-08 04:43:19.058611+00	password	3ee46e20-f919-4d73-a4ad-bfa602332a31
554f3306-dfc0-4b73-b051-c2dd4a9884bd	2026-11-08 04:49:30.755262+00	2026-11-08 04:49:30.755262+00	password	fc7ab73a-3195-42cb-b416-08304966e284
8d8994e3-a827-410f-be07-f54b75187d66	2026-11-08 05:12:18.507587+00	2026-11-08 05:12:18.507587+00	password	bf0b6674-cd2e-4278-aef1-4a147f097c77
427ffdaa-100b-4df5-8549-e80eae3662e0	2026-11-08 10:11:23.04767+00	2026-11-08 10:11:23.04767+00	password	f7680bad-44b2-4183-94cc-cf840c3dfcc6
15c70356-52bc-452b-931a-6e599786844f	2026-11-08 10:14:24.320683+00	2026-11-08 10:14:24.320683+00	password	1947d86d-9b0c-49f6-b56f-d19766badfc7
fc44f5f6-f928-45ae-8e69-f364f9d55ded	2026-11-08 10:15:42.838967+00	2026-11-08 10:15:42.838967+00	password	aa8def5e-c1bd-4b2c-8512-24c0b64dc8ec
40aef4cf-2c1c-492a-90b3-0f832c69b786	2026-11-09 05:29:57.611942+00	2026-11-09 05:29:57.611942+00	password	7b0063b2-09ad-4659-9941-944f9c0a0a8a
1ece7fc0-6a8c-44e0-af1a-1cee6379087b	2026-11-09 05:30:52.897391+00	2026-11-09 05:30:52.897391+00	password	d272ed01-2a25-49fb-adfb-c66378132ea0
0bc599a7-2bcb-413f-bb98-b6fa96844ab7	2026-11-09 05:38:42.602807+00	2026-11-09 05:38:42.602807+00	password	e290b007-929f-4612-b5d3-b54fd9d0936a
77329f66-526c-4996-9ca8-acb7a476c380	2026-11-09 05:45:04.048636+00	2026-11-09 05:45:04.048636+00	password	06eddc88-6cd2-4b81-ba99-ded733b25437
7b6f38ea-f6de-4b3f-89e2-26cb20ccbe0e	2026-11-09 05:50:30.486516+00	2026-11-09 05:50:30.486516+00	password	a67f7043-c6de-4ee8-b2cd-f352673cd4bb
825f6d6b-b098-407c-a584-d4d12e65105a	2026-11-09 05:51:19.475449+00	2026-11-09 05:51:19.475449+00	password	67781df2-7328-4988-9481-9e47bdea5361
f48f4c9c-83c6-407a-9d83-4adb5be7ef77	2026-11-09 05:53:35.07655+00	2026-11-09 05:53:35.07655+00	password	c8c12596-abc4-4f63-8e86-6d5f3a8764b9
4aaaebd7-ca0f-4867-824e-236056c4f9c1	2026-11-09 06:05:08.432324+00	2026-11-09 06:05:08.432324+00	password	b16b760c-b53d-406f-932e-4209a3baf021
8e798795-5dc4-4686-9c2c-004d45aa99ab	2026-11-09 13:15:59.685205+00	2026-11-09 13:15:59.685205+00	password	5398ef9f-7acc-49ce-9394-af361451a402
75db3a12-c849-40f2-bb11-8960009d0826	2026-11-09 13:16:31.941689+00	2026-11-09 13:16:31.941689+00	password	b5258a8c-1134-4473-9881-18e8e52e457e
f6c0bd21-baf5-41cd-b47f-569b3dfb3914	2026-11-09 13:17:47.824149+00	2026-11-09 13:17:47.824149+00	password	86574ce4-27eb-4a26-b3de-f94b18e58384
733264d1-aeb4-442e-8f31-411dd5b453c0	2026-11-09 13:19:51.194674+00	2026-11-09 13:19:51.194674+00	password	4fce6a0e-b171-4f91-b953-13a0919f2cc4
279faaef-2b5c-42f9-aa98-bcd07a431a53	2026-11-09 13:32:01.886263+00	2026-11-09 13:32:01.886263+00	password	5765bd09-6995-4345-8921-9df52aa8422e
01dd7ee4-671e-41a4-b7d3-a76859228840	2026-11-09 13:32:38.460677+00	2026-11-09 13:32:38.460677+00	password	a8cfb968-9eb2-4ff7-a5e9-613f97adc81b
062d8fec-40bf-4c9c-a6e9-cef3da021387	2026-11-09 13:32:55.9614+00	2026-11-09 13:32:55.9614+00	password	2d6ccb2f-7b9d-4e5e-ba5c-228a52f14e6b
29e97cb1-5040-465a-bde9-4d51b84fed1c	2026-11-09 13:33:30.578415+00	2026-11-09 13:33:30.578415+00	password	bae6d48a-8118-4109-80d3-b50cf458948d
5be873d4-87fe-4966-9830-831ef71d7f78	2026-11-09 13:34:24.232507+00	2026-11-09 13:34:24.232507+00	password	0e6a1da8-17b5-421e-a0e4-64968df8ff98
f70edcc3-f7ba-4a9d-ab69-1b1450903962	2026-11-09 13:35:09.812862+00	2026-11-09 13:35:09.812862+00	password	bb369c16-3562-496b-a483-0f52a23614cd
078cf97a-59f0-442a-a61f-ca2cbf96df77	2026-11-09 13:35:55.321629+00	2026-11-09 13:35:55.321629+00	password	eb5f62b6-db2b-4210-92b8-068ef82c1229
11dcf386-f8e3-440f-9036-ef7f315b6d2f	2026-11-09 13:39:23.335493+00	2026-11-09 13:39:23.335493+00	password	42e12ec3-1a44-43f3-8307-4494ad6d4642
b3832204-c6e9-46d7-8ac5-aa90253b04fb	2026-11-09 13:39:40.450214+00	2026-11-09 13:39:40.450214+00	password	58ef56c2-ed9d-4b56-bc29-6f025488e8c6
fd1ceaf8-2771-4fb6-b405-48ecac4d3233	2026-11-09 13:40:28.487338+00	2026-11-09 13:40:28.487338+00	password	d04d4eb1-dd51-4d34-b7a2-a6fc56ca470d
d0daf880-8b07-4fb8-8516-4b09006d9876	2026-11-09 13:42:13.059082+00	2026-11-09 13:42:13.059082+00	password	27a346f5-c7c7-4581-9e54-fb8040cf84af
f72f2732-8c61-45c6-8f7f-a4aa83f5c147	2026-11-09 13:43:14.938339+00	2026-11-09 13:43:14.938339+00	password	a6f7d036-4b75-4aa2-bbab-2afdf0ea441a
00ddeba3-ca3d-4f52-81dd-46c0a28303cd	2026-11-09 13:44:27.996162+00	2026-11-09 13:44:27.996162+00	password	0b197abe-2b89-47b8-ad14-c21d3ecf20f5
3f7dd683-5069-44a9-bb42-b9151bb47d03	2026-11-09 13:44:46.02266+00	2026-11-09 13:44:46.02266+00	password	88f3d9e5-6c12-46a5-93d9-37c757e7e529
9e110a7f-413e-42e7-855f-dcc75d15da7e	2026-11-09 13:46:09.326962+00	2026-11-09 13:46:09.326962+00	password	abf405ac-f5a2-4562-ae3f-388b95f9720e
c0c05881-50f2-490e-be33-d71ccd8ca6f8	2026-11-09 13:46:11.917991+00	2026-11-09 13:46:11.917991+00	password	518310fd-62bf-4c14-8274-675ff1ed9751
e5bb10a3-b32c-415b-b44e-480ab6386431	2026-11-09 13:47:25.17402+00	2026-11-09 13:47:25.17402+00	password	8307f834-7ace-48f3-bbd4-c3f50c9df5e2
7e919bd6-fa9a-4d91-8089-3a1490e3b4a2	2026-11-09 13:48:08.071841+00	2026-11-09 13:48:08.071841+00	password	b63a862b-f10a-4013-a641-ebd209944864
04239fba-88ae-4147-95b7-9fa2698f9b66	2026-11-09 13:51:24.011+00	2026-11-09 13:51:24.011+00	password	f07b40fa-4375-44a5-a976-a5b0acf81582
1265bb81-a015-46d4-944b-aa29729b31d3	2026-11-09 13:52:05.527741+00	2026-11-09 13:52:05.527741+00	password	98b555fe-b943-42ba-93e3-65c3abb3e714
31b833b8-b278-46fb-8a71-7ad5d4c14e53	2026-11-09 13:54:20.444832+00	2026-11-09 13:54:20.444832+00	password	9fdc046d-c59f-4a2b-b7f5-178b67b41209
b2c2687d-8ddc-439e-bfc9-8be8110d5f8d	2026-11-09 13:55:49.828973+00	2026-11-09 13:55:49.828973+00	password	f1c11f3e-97b2-4e39-926c-efe416f76509
10dcbcde-9ca3-4c15-a2a9-8e253102e672	2026-11-09 13:59:56.19482+00	2026-11-09 13:59:56.19482+00	password	66824043-6744-4806-8622-e2b9c6ee33d8
fe40b83c-b0ee-4443-b0a8-b586927088a7	2026-11-09 14:01:41.032726+00	2026-11-09 14:01:41.032726+00	password	e77d61b0-db8f-4662-9d4a-446c50ea3ebb
803c9099-2ca3-4999-957f-7e0fb2370e5b	2026-11-09 14:11:40.401876+00	2026-11-09 14:11:40.401876+00	password	e0afd769-728d-4bcb-a8c4-7245c0c830df
ee1fb983-9bc4-4c64-b06d-da6b0ea6f598	2026-11-09 14:31:21.407062+00	2026-11-09 14:31:21.407062+00	password	348dff85-58cb-4bdc-aef0-9035f6f1839f
164a6c80-65e1-4c16-b552-c3272d7ee75e	2026-11-09 14:39:37.088978+00	2026-11-09 14:39:37.088978+00	password	680445d7-769b-4378-afa6-c5353ed5278f
27bef50d-3132-4f39-a0ee-fbada4cefbd7	2026-11-09 15:04:22.905184+00	2026-11-09 15:04:22.905184+00	password	0c448195-b38f-44d1-b098-c4b6636ee3cb
c4710ef7-5096-40aa-b124-a85abd222803	2026-11-09 15:36:40.80816+00	2026-11-09 15:36:40.80816+00	password	125f2e4e-dca8-45c7-8138-48aff55d0ba8
397e4fb7-ac03-4d14-88dd-896fb527c747	2026-11-10 03:49:50.21115+00	2026-11-10 03:49:50.21115+00	password	63f18d66-9de7-41d4-9e34-e70273bc02f5
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


--
-- Data for Name: mfa_recovery_code_sets; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_recovery_code_sets (id, user_id, mfa_factor_id, failed_verification_count, verification_locked_until, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: mfa_recovery_codes; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.mfa_recovery_codes (id, mfa_recovery_code_set_id, code_hash, consumed_at, created_at) FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type, token_endpoint_auth_method) FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at, expires_at) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
00000000-0000-0000-0000-000000000000	234	xfswvexklfio	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 12:39:21.183611+00	2026-11-07 12:39:21.183611+00	\N	789f2b73-af91-44df-a670-3cba65decf96
00000000-0000-0000-0000-000000000000	235	fioxyqgqytv5	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 12:39:21.32077+00	2026-11-07 12:39:21.32077+00	\N	c395ac9d-59e2-424c-a655-5c2085f40970
00000000-0000-0000-0000-000000000000	236	dwg7xuew4w5q	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 12:40:17.185171+00	2026-11-07 12:40:17.185171+00	\N	e5f5fca7-9608-4e35-af51-ba9126081d55
00000000-0000-0000-0000-000000000000	237	2rb3msr3p2ss	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 12:40:59.629999+00	2026-11-07 12:40:59.629999+00	\N	7db13812-6c2a-40c2-b43a-f2ab785a3143
00000000-0000-0000-0000-000000000000	238	cysnawzzb7vx	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 12:47:13.763537+00	2026-11-07 12:47:13.763537+00	\N	68102110-7502-4d40-b953-e51ca78e7f88
00000000-0000-0000-0000-000000000000	239	og4r5h67itvz	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 12:56:22.805371+00	2026-11-07 12:56:22.805371+00	\N	0897a242-0e1e-42cf-88a2-77f26784d906
00000000-0000-0000-0000-000000000000	240	6txym5woeq6b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:00:20.354969+00	2026-11-07 13:00:20.354969+00	\N	b4c50c5d-12e1-44a6-b4ea-c1636a3999f3
00000000-0000-0000-0000-000000000000	241	uavjrtakeuyh	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:04:13.227822+00	2026-11-07 13:04:13.227822+00	\N	5cd56b49-3ac9-4da0-b8a3-6c1116c7ae7c
00000000-0000-0000-0000-000000000000	242	yklhqhxrgsec	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:11:17.295875+00	2026-11-07 13:11:17.295875+00	\N	5aabc470-8bb0-4741-a374-bf9c944de1e4
00000000-0000-0000-0000-000000000000	243	lyso45lw7vti	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:14:57.003946+00	2026-11-07 13:14:57.003946+00	\N	4805e81c-f5fa-4c46-81ba-a41ca20878c8
00000000-0000-0000-0000-000000000000	244	h2dm43gmbj2a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:17:02.375189+00	2026-11-07 13:17:02.375189+00	\N	0325535f-0924-4d82-a142-6d9214cd4692
00000000-0000-0000-0000-000000000000	245	uhqi7flvbwiz	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:31:41.491127+00	2026-11-07 13:31:41.491127+00	\N	0c6a08b0-2417-4376-b7ed-b3171200d15e
00000000-0000-0000-0000-000000000000	246	qrgbv5ix2cak	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:31:41.627348+00	2026-11-07 13:31:41.627348+00	\N	71327de4-e957-45e5-9784-bd8f8e160d3c
00000000-0000-0000-0000-000000000000	247	mnl2twnugehb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:32:07.539466+00	2026-11-07 13:32:07.539466+00	\N	d6d10164-4c3c-4164-97e9-21899f6e6835
00000000-0000-0000-0000-000000000000	248	g43undqs6dx5	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:32:07.62124+00	2026-11-07 13:32:07.62124+00	\N	9fbbd3df-bc05-4b69-8f8f-05c0fc809569
00000000-0000-0000-0000-000000000000	249	3blhje6twi5a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:33:14.359468+00	2026-11-07 13:33:14.359468+00	\N	11abd938-a61a-4ba6-b0b1-ab7f36740c90
00000000-0000-0000-0000-000000000000	250	ixwhgaavxa54	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:47:48.433675+00	2026-11-07 13:47:48.433675+00	\N	1a48ada1-7e5e-4e9a-9d4a-2c87ceb04e5e
00000000-0000-0000-0000-000000000000	251	tzy2vwocxfkl	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:47:48.518321+00	2026-11-07 13:47:48.518321+00	\N	eaefd3f1-cb20-4979-a1cf-d5b7271adcd3
00000000-0000-0000-0000-000000000000	252	665lvjzfcc3p	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:48:12.686162+00	2026-11-07 13:48:12.686162+00	\N	a1e26074-fe85-469c-92f3-b20df2e29e44
00000000-0000-0000-0000-000000000000	253	zmhdgwrhaq2e	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:48:12.749202+00	2026-11-07 13:48:12.749202+00	\N	8eb46617-36a1-4af6-841b-3be8308f5a11
00000000-0000-0000-0000-000000000000	254	x2magfw7w2jc	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:54:06.291888+00	2026-11-07 13:54:06.291888+00	\N	273cb7b4-a49f-49c5-aa91-405c11d0ef6a
00000000-0000-0000-0000-000000000000	255	xckbw5fui5tt	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:54:06.396148+00	2026-11-07 13:54:06.396148+00	\N	f0f5b6d9-a201-4593-bec7-1abdc5dd1944
00000000-0000-0000-0000-000000000000	256	7ai76ifxnqou	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:54:34.277915+00	2026-11-07 13:54:34.277915+00	\N	d351cf4a-bc7a-4e2a-8e04-f3b4da33a5f2
00000000-0000-0000-0000-000000000000	257	gi7xkn3352a2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:55:16.010338+00	2026-11-07 13:55:16.010338+00	\N	f61e0d14-6730-41d8-ab04-b19fbe6b4a32
00000000-0000-0000-0000-000000000000	258	yfqfdcqay6yr	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:56:04.484301+00	2026-11-07 13:56:04.484301+00	\N	3f379520-4a8d-41c8-aae8-a027532626fa
00000000-0000-0000-0000-000000000000	259	vv6mjmezwojw	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:56:04.548323+00	2026-11-07 13:56:04.548323+00	\N	3b8350ee-d8fc-4f2e-8525-d195b4eca827
00000000-0000-0000-0000-000000000000	260	djkjgqnqj6ry	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:58:10.046445+00	2026-11-07 13:58:10.046445+00	\N	e84fa9d7-f9c5-425e-b406-a8ea27360f43
00000000-0000-0000-0000-000000000000	261	lzb4jgtwwauw	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:58:10.269223+00	2026-11-07 13:58:10.269223+00	\N	069e9a1c-cd3f-484f-9913-dc7ac74ab5c7
00000000-0000-0000-0000-000000000000	262	okjy45jxubai	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:58:42.694584+00	2026-11-07 13:58:42.694584+00	\N	391556a0-7035-4758-8897-d8666bf4257e
00000000-0000-0000-0000-000000000000	263	3tp6yuj446mu	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:58:42.780165+00	2026-11-07 13:58:42.780165+00	\N	5dc37fd5-532d-40cf-86b8-cce4da87cc24
00000000-0000-0000-0000-000000000000	264	c54h3gihrszj	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:59:02.89526+00	2026-11-07 13:59:02.89526+00	\N	4ec49456-be32-4d9a-a4b6-b74176510253
00000000-0000-0000-0000-000000000000	265	6gurgpe4zrad	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:59:02.992316+00	2026-11-07 13:59:02.992316+00	\N	ed907978-ab67-4b76-a502-8e88a80c45a4
00000000-0000-0000-0000-000000000000	266	iingtfl2zjxn	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:59:18.579137+00	2026-11-07 13:59:18.579137+00	\N	c3ddcb27-3bab-476d-982d-71bf0c3aece1
00000000-0000-0000-0000-000000000000	267	gwwvoyduzroj	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:59:18.674284+00	2026-11-07 13:59:18.674284+00	\N	3cae7606-3d01-4a10-ae14-db559fd7f3b0
00000000-0000-0000-0000-000000000000	268	hjkd6prfl4ur	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:59:28.592256+00	2026-11-07 13:59:28.592256+00	\N	5e7be0f1-ae41-4522-933b-dac4d97415bd
00000000-0000-0000-0000-000000000000	269	l5isgladfu7x	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 13:59:28.765901+00	2026-11-07 13:59:28.765901+00	\N	a0cb93bc-0e8f-433d-bb66-6d8f5fc39211
00000000-0000-0000-0000-000000000000	270	7ov5bwtqq2iy	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:59:31.479753+00	2026-11-07 13:59:31.479753+00	\N	a6f8e944-21f4-4600-963e-c34993c104ab
00000000-0000-0000-0000-000000000000	271	5vgvu62is5px	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:59:31.564913+00	2026-11-07 13:59:31.564913+00	\N	c13ee6d7-fdca-419f-94aa-2b91d7df8b05
00000000-0000-0000-0000-000000000000	272	v2l4wfhkl2ea	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:59:41.407619+00	2026-11-07 13:59:41.407619+00	\N	5d10f993-8871-490b-a3ee-9487e5d1f163
00000000-0000-0000-0000-000000000000	273	voy6t7ltjidh	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 13:59:41.522599+00	2026-11-07 13:59:41.522599+00	\N	3b560fa4-a322-4f39-8704-279ba6bf94eb
00000000-0000-0000-0000-000000000000	274	mkkw6w6mhaqe	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:01:15.838097+00	2026-11-07 14:01:15.838097+00	\N	e979135e-59d0-47c6-ba5c-56ab5149e048
00000000-0000-0000-0000-000000000000	275	foyq5vmavgb6	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:01:15.934312+00	2026-11-07 14:01:15.934312+00	\N	02f1b8b7-166a-4d6d-b4ff-d3701b9d8e28
00000000-0000-0000-0000-000000000000	276	p674oqc2xwp2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:03:31.539538+00	2026-11-07 14:03:31.539538+00	\N	d5d89e15-42bc-493e-8793-ea9937f9e2f5
00000000-0000-0000-0000-000000000000	277	tente3lnqa7y	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:03:31.805913+00	2026-11-07 14:03:31.805913+00	\N	98835558-41ed-4ce0-88e7-55d1e9c7f8eb
00000000-0000-0000-0000-000000000000	135	f54zwuqlulyq	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	t	2026-11-07 09:35:09.61555+00	2026-11-07 09:35:21.229264+00	\N	c8cc0aee-2893-4972-989c-4aaa0711ae7c
00000000-0000-0000-0000-000000000000	278	3sk2eje6oft5	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:04:00.111978+00	2026-11-07 14:04:00.111978+00	\N	4d885dc6-c266-4aa5-9aa9-7226e708e8cd
00000000-0000-0000-0000-000000000000	136	jidxmy2y4cxy	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	f	2026-11-07 09:35:21.232456+00	2026-11-07 09:35:21.232456+00	f54zwuqlulyq	c8cc0aee-2893-4972-989c-4aaa0711ae7c
00000000-0000-0000-0000-000000000000	279	whcv4vwdviq4	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:04:00.228125+00	2026-11-07 14:04:00.228125+00	\N	ca6eebe5-5c84-439c-9e82-4dbdcd822a0a
00000000-0000-0000-0000-000000000000	137	e5wqtleoif3g	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	f	2026-11-07 09:37:16.575352+00	2026-11-07 09:37:16.575352+00	\N	0175255d-c61b-4a5f-9b42-a942677daceb
00000000-0000-0000-0000-000000000000	280	fybqtqwjtynr	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:04:19.890227+00	2026-11-07 14:04:19.890227+00	\N	dc2bca82-597e-4f5c-97fd-162484fcec7f
00000000-0000-0000-0000-000000000000	281	voapsowrgneh	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:04:20.00101+00	2026-11-07 14:04:20.00101+00	\N	8907417b-9921-4138-8ebf-62a7255ae0ef
00000000-0000-0000-0000-000000000000	282	rufpfu7zhbhh	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:04:34.395581+00	2026-11-07 14:04:34.395581+00	\N	73a7f111-97a9-4efa-ba23-18d8a3be2258
00000000-0000-0000-0000-000000000000	283	cwd4lnknhgsw	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:04:34.492157+00	2026-11-07 14:04:34.492157+00	\N	284bab39-920a-4b9e-ac14-5d720ea34b4a
00000000-0000-0000-0000-000000000000	138	txa7gd2tgahc	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	t	2026-11-07 09:37:16.830332+00	2026-11-07 10:36:41.347463+00	\N	380ef91f-9dbf-4c7a-8b40-56020906307b
00000000-0000-0000-0000-000000000000	144	uoh5y5cr4rpv	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	f	2026-11-07 10:36:41.364714+00	2026-11-07 10:36:41.364714+00	txa7gd2tgahc	380ef91f-9dbf-4c7a-8b40-56020906307b
00000000-0000-0000-0000-000000000000	284	6ivgzjbsbt2y	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:04:44.751279+00	2026-11-07 14:04:44.751279+00	\N	2b804dcd-b9d6-4583-8916-b6277440fe1c
00000000-0000-0000-0000-000000000000	285	q4t6wkpqxoe4	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:04:44.927645+00	2026-11-07 14:04:44.927645+00	\N	0eb46a4d-0362-4cda-962f-47de5f0f5893
00000000-0000-0000-0000-000000000000	286	zyvwthsj4jak	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:04:47.70248+00	2026-11-07 14:04:47.70248+00	\N	47724107-e1f6-433d-a23d-b7dcfe5bb076
00000000-0000-0000-0000-000000000000	287	liegsb6h6o2n	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:04:47.798519+00	2026-11-07 14:04:47.798519+00	\N	8c7771d0-96a2-493d-ba65-c2382e17f41b
00000000-0000-0000-0000-000000000000	288	wip4yzsf45bo	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:04:58.610348+00	2026-11-07 14:04:58.610348+00	\N	b9ca3760-f3b7-4658-8043-c93c38836094
00000000-0000-0000-0000-000000000000	289	zafacnn2t5kt	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:04:58.730548+00	2026-11-07 14:04:58.730548+00	\N	4695a989-f3f5-4c3c-a27b-be76277b0839
00000000-0000-0000-0000-000000000000	290	f65qdfcfpoa2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:05:50.905968+00	2026-11-07 14:05:50.905968+00	\N	8943b3a4-1710-46e6-98b9-927d16b53848
00000000-0000-0000-0000-000000000000	291	i5r74vf6ctsq	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:05:51.084618+00	2026-11-07 14:05:51.084618+00	\N	2e23677c-0849-4dd9-b052-bfa860557bcc
00000000-0000-0000-0000-000000000000	292	lkun5nfdvnus	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:06:19.573558+00	2026-11-07 14:06:19.573558+00	\N	a30cf751-5c8e-4652-81f2-1c36fe537796
00000000-0000-0000-0000-000000000000	293	ximnlhligvhz	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:06:19.670055+00	2026-11-07 14:06:19.670055+00	\N	98b7aaab-7b51-4851-bfda-a933119c3279
00000000-0000-0000-0000-000000000000	294	svbzhsvwwkol	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:06:39.212137+00	2026-11-07 14:06:39.212137+00	\N	cae0e144-ed66-4ee4-9367-07c98fa8b427
00000000-0000-0000-0000-000000000000	295	in6c64pj2bzi	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:06:39.304911+00	2026-11-07 14:06:39.304911+00	\N	e59a02de-96ef-4662-9aff-bdf3264e851c
00000000-0000-0000-0000-000000000000	296	m7d4apxl2sgy	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:06:53.730527+00	2026-11-07 14:06:53.730527+00	\N	6545e789-2f03-4b35-ba81-238247821414
00000000-0000-0000-0000-000000000000	297	fpqeriub6b6p	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:06:53.819645+00	2026-11-07 14:06:53.819645+00	\N	ea751e30-c3ff-4312-bd9a-ef6331b0bcea
00000000-0000-0000-0000-000000000000	298	iibfpkxo4etw	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:07:04.455175+00	2026-11-07 14:07:04.455175+00	\N	f3b669dc-6450-41f1-b5f2-8aa577591b9b
00000000-0000-0000-0000-000000000000	299	6x5cdpnlvtu3	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:07:04.662139+00	2026-11-07 14:07:04.662139+00	\N	ca6fda20-d721-47f0-84d2-b180040e533b
00000000-0000-0000-0000-000000000000	300	mboybj3hor3y	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:07:07.366891+00	2026-11-07 14:07:07.366891+00	\N	8f7ac634-a532-4e0b-aa06-fed06abddc98
00000000-0000-0000-0000-000000000000	301	pidkoiroeack	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:07:07.455424+00	2026-11-07 14:07:07.455424+00	\N	9f33bcbb-1a22-4166-a195-01e0e69504cb
00000000-0000-0000-0000-000000000000	302	adrqicte7awp	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:07:17.463515+00	2026-11-07 14:07:17.463515+00	\N	c5bb16e9-f314-4798-83be-f3714b25ac69
00000000-0000-0000-0000-000000000000	303	74s7akdqdut5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:07:17.56501+00	2026-11-07 14:07:17.56501+00	\N	19e2a0bc-d75a-4815-8424-57ac002a0a00
00000000-0000-0000-0000-000000000000	304	sz6ngq4w56m7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:08:06.387585+00	2026-11-07 14:08:06.387585+00	\N	6b3b7a46-c3e3-4eef-b68f-05fe740ed4e5
00000000-0000-0000-0000-000000000000	305	gonpufex4s4u	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:09:03.429782+00	2026-11-07 14:09:03.429782+00	\N	5abb0fb5-e2c3-49d4-ac48-08556174d342
00000000-0000-0000-0000-000000000000	306	ybrnwcty5vmp	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	f	2026-11-07 14:09:03.54451+00	2026-11-07 14:09:03.54451+00	\N	fdcb07da-8789-43ca-9b76-b628f37cfe60
00000000-0000-0000-0000-000000000000	307	prhrol3kky7j	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:12:31.835565+00	2026-11-07 14:12:31.835565+00	\N	0644cf0f-cf21-49d5-bd95-b116d936c845
00000000-0000-0000-0000-000000000000	308	xivegpyit2sf	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:21:45.239039+00	2026-11-07 14:21:45.239039+00	\N	d90956f7-0aa7-48fc-b369-469d1e1638eb
00000000-0000-0000-0000-000000000000	309	k3zud72l2fxr	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:24:03.761727+00	2026-11-07 14:24:03.761727+00	\N	f8b65cb9-93ea-4733-ab8b-0705eccef098
00000000-0000-0000-0000-000000000000	310	gk76ga7d7ywe	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:33:24.100888+00	2026-11-07 14:33:24.100888+00	\N	240da660-03fd-4263-8274-6fe04a3466bb
00000000-0000-0000-0000-000000000000	311	ehs7h3pnwjvi	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:40:39.133001+00	2026-11-07 14:40:39.133001+00	\N	e4ba6f27-78a1-4456-9da6-b033c113f731
00000000-0000-0000-0000-000000000000	312	y43tado4jpti	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:50:56.162196+00	2026-11-07 14:50:56.162196+00	\N	7d7a7edf-789e-4ae5-abc5-ee7a16c85fe7
00000000-0000-0000-0000-000000000000	313	6pjluydtxoxk	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:52:06.790472+00	2026-11-07 14:52:06.790472+00	\N	4dc9a5f9-3280-47c6-9073-9299f937819e
00000000-0000-0000-0000-000000000000	314	nvddcfj6reve	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 14:57:36.378407+00	2026-11-07 14:57:36.378407+00	\N	d60b511a-d679-4a36-99ac-daf4c3ce9c3a
00000000-0000-0000-0000-000000000000	315	ycaixnrgplxk	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 15:00:27.867222+00	2026-11-07 15:00:27.867222+00	\N	c72f10b7-a0ad-4a4d-ad97-e9445d9c9f13
00000000-0000-0000-0000-000000000000	316	ttmyvjzmxfoz	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 15:01:10.53535+00	2026-11-07 15:01:10.53535+00	\N	e5035e39-6b9a-4d16-9fb7-2cdfd2b0edba
00000000-0000-0000-0000-000000000000	317	zalwwtn2ol25	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 15:30:49.331758+00	2026-11-07 15:30:49.331758+00	\N	e0b525b9-90b7-4510-ad12-7d622884fd76
00000000-0000-0000-0000-000000000000	318	afhpw7nkr7g7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-07 15:51:26.201018+00	2026-11-07 15:51:26.201018+00	\N	97a57772-8bd6-4b2b-869c-f4916ab136ea
00000000-0000-0000-0000-000000000000	319	eyfjmfx6lyjb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-08 04:25:02.504711+00	2026-11-08 04:25:02.504711+00	\N	fee05a73-56fb-47ba-b10d-cd2520b6fc69
00000000-0000-0000-0000-000000000000	320	cbmca2bnn6ux	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-08 04:26:09.986017+00	2026-11-08 04:26:09.986017+00	\N	4bfb374a-6b99-48f9-aab0-13495b501fa2
00000000-0000-0000-0000-000000000000	321	g77eiae4vdoj	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-08 04:43:19.051203+00	2026-11-08 04:43:19.051203+00	\N	13b41c1f-ddbb-4e0c-9e48-e171c1907214
00000000-0000-0000-0000-000000000000	322	tllhsknh4j6s	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-08 04:49:30.746611+00	2026-11-08 04:49:30.746611+00	\N	554f3306-dfc0-4b73-b051-c2dd4a9884bd
00000000-0000-0000-0000-000000000000	323	xh7x7orww7lr	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-08 05:12:18.494107+00	2026-11-08 05:12:18.494107+00	\N	8d8994e3-a827-410f-be07-f54b75187d66
00000000-0000-0000-0000-000000000000	324	6sgmfo446zom	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-08 10:11:23.011305+00	2026-11-08 10:11:23.011305+00	\N	427ffdaa-100b-4df5-8549-e80eae3662e0
00000000-0000-0000-0000-000000000000	325	mjthqfakgfad	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-08 10:14:24.314092+00	2026-11-08 10:14:24.314092+00	\N	15c70356-52bc-452b-931a-6e599786844f
00000000-0000-0000-0000-000000000000	326	r2jff3iyslwi	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-08 10:15:42.829366+00	2026-11-08 10:15:42.829366+00	\N	fc44f5f6-f928-45ae-8e69-f364f9d55ded
00000000-0000-0000-0000-000000000000	327	5oe3feasou33	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 05:29:57.574755+00	2026-11-09 05:29:57.574755+00	\N	40aef4cf-2c1c-492a-90b3-0f832c69b786
00000000-0000-0000-0000-000000000000	328	ayr7zix7gzqu	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 05:30:52.891752+00	2026-11-09 05:30:52.891752+00	\N	1ece7fc0-6a8c-44e0-af1a-1cee6379087b
00000000-0000-0000-0000-000000000000	329	dws5sahkf22k	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 05:38:42.598407+00	2026-11-09 05:38:42.598407+00	\N	0bc599a7-2bcb-413f-bb98-b6fa96844ab7
00000000-0000-0000-0000-000000000000	330	ja6knwnvkfxk	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 05:45:04.039614+00	2026-11-09 05:45:04.039614+00	\N	77329f66-526c-4996-9ca8-acb7a476c380
00000000-0000-0000-0000-000000000000	331	3p6j2j2fzi5o	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 05:50:30.4805+00	2026-11-09 05:50:30.4805+00	\N	7b6f38ea-f6de-4b3f-89e2-26cb20ccbe0e
00000000-0000-0000-0000-000000000000	332	aqt2greovkpg	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 05:51:19.474143+00	2026-11-09 05:51:19.474143+00	\N	825f6d6b-b098-407c-a584-d4d12e65105a
00000000-0000-0000-0000-000000000000	333	mexn2g775mgb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 05:53:35.070258+00	2026-11-09 05:53:35.070258+00	\N	f48f4c9c-83c6-407a-9d83-4adb5be7ef77
00000000-0000-0000-0000-000000000000	334	p3qdwojghdaf	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 06:05:08.426146+00	2026-11-09 06:05:08.426146+00	\N	4aaaebd7-ca0f-4867-824e-236056c4f9c1
00000000-0000-0000-0000-000000000000	335	jvpuw2xs3fhv	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:15:59.653358+00	2026-11-09 13:15:59.653358+00	\N	8e798795-5dc4-4686-9c2c-004d45aa99ab
00000000-0000-0000-0000-000000000000	336	ojngdv7g73iw	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:16:31.940186+00	2026-11-09 13:16:31.940186+00	\N	75db3a12-c849-40f2-bb11-8960009d0826
00000000-0000-0000-0000-000000000000	337	bnkv24la3evs	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:17:47.816359+00	2026-11-09 13:17:47.816359+00	\N	f6c0bd21-baf5-41cd-b47f-569b3dfb3914
00000000-0000-0000-0000-000000000000	338	24d3gb33iqo3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:19:51.191709+00	2026-11-09 13:19:51.191709+00	\N	733264d1-aeb4-442e-8f31-411dd5b453c0
00000000-0000-0000-0000-000000000000	339	d3vzwegvc64n	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:32:01.871773+00	2026-11-09 13:32:01.871773+00	\N	279faaef-2b5c-42f9-aa98-bcd07a431a53
00000000-0000-0000-0000-000000000000	340	mddfrgvqcl5z	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:32:38.458764+00	2026-11-09 13:32:38.458764+00	\N	01dd7ee4-671e-41a4-b7d3-a76859228840
00000000-0000-0000-0000-000000000000	341	2ezfia5evosm	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:32:55.951393+00	2026-11-09 13:32:55.951393+00	\N	062d8fec-40bf-4c9c-a6e9-cef3da021387
00000000-0000-0000-0000-000000000000	342	bf5penz3qbbj	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:33:30.577014+00	2026-11-09 13:33:30.577014+00	\N	29e97cb1-5040-465a-bde9-4d51b84fed1c
00000000-0000-0000-0000-000000000000	343	lgplwfooqaky	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:34:24.230735+00	2026-11-09 13:34:24.230735+00	\N	5be873d4-87fe-4966-9830-831ef71d7f78
00000000-0000-0000-0000-000000000000	344	fus3stahfvqi	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:35:09.807289+00	2026-11-09 13:35:09.807289+00	\N	f70edcc3-f7ba-4a9d-ab69-1b1450903962
00000000-0000-0000-0000-000000000000	345	5mkwo5dzaqnb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:35:55.317674+00	2026-11-09 13:35:55.317674+00	\N	078cf97a-59f0-442a-a61f-ca2cbf96df77
00000000-0000-0000-0000-000000000000	346	puq6uebcczc6	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:39:23.329904+00	2026-11-09 13:39:23.329904+00	\N	11dcf386-f8e3-440f-9036-ef7f315b6d2f
00000000-0000-0000-0000-000000000000	347	cht3ry7a6o6l	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:39:40.448819+00	2026-11-09 13:39:40.448819+00	\N	b3832204-c6e9-46d7-8ac5-aa90253b04fb
00000000-0000-0000-0000-000000000000	348	73yqguwkidbw	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:40:28.48586+00	2026-11-09 13:40:28.48586+00	\N	fd1ceaf8-2771-4fb6-b405-48ecac4d3233
00000000-0000-0000-0000-000000000000	349	z3sr3kijfbur	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:42:13.05321+00	2026-11-09 13:42:13.05321+00	\N	d0daf880-8b07-4fb8-8516-4b09006d9876
00000000-0000-0000-0000-000000000000	350	grbmalh4gs2e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:43:14.932127+00	2026-11-09 13:43:14.932127+00	\N	f72f2732-8c61-45c6-8f7f-a4aa83f5c147
00000000-0000-0000-0000-000000000000	351	75m6sartz2f2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:44:27.990634+00	2026-11-09 13:44:27.990634+00	\N	00ddeba3-ca3d-4f52-81dd-46c0a28303cd
00000000-0000-0000-0000-000000000000	352	tnwygjx7rrjk	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:44:46.019502+00	2026-11-09 13:44:46.019502+00	\N	3f7dd683-5069-44a9-bb42-b9151bb47d03
00000000-0000-0000-0000-000000000000	353	5iq2rplj7iew	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:46:09.32172+00	2026-11-09 13:46:09.32172+00	\N	9e110a7f-413e-42e7-855f-dcc75d15da7e
00000000-0000-0000-0000-000000000000	354	x242l66hofre	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:46:11.916497+00	2026-11-09 13:46:11.916497+00	\N	c0c05881-50f2-490e-be33-d71ccd8ca6f8
00000000-0000-0000-0000-000000000000	355	oivp7u66nrgh	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:47:25.169821+00	2026-11-09 13:47:25.169821+00	\N	e5bb10a3-b32c-415b-b44e-480ab6386431
00000000-0000-0000-0000-000000000000	356	zm4uuf34pyg3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:48:08.070463+00	2026-11-09 13:48:08.070463+00	\N	7e919bd6-fa9a-4d91-8089-3a1490e3b4a2
00000000-0000-0000-0000-000000000000	357	xn5izjxvm36z	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:51:24.005898+00	2026-11-09 13:51:24.005898+00	\N	04239fba-88ae-4147-95b7-9fa2698f9b66
00000000-0000-0000-0000-000000000000	358	qadh3nahe77v	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:52:05.526245+00	2026-11-09 13:52:05.526245+00	\N	1265bb81-a015-46d4-944b-aa29729b31d3
00000000-0000-0000-0000-000000000000	359	kepbrsvac3sz	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:54:20.437531+00	2026-11-09 13:54:20.437531+00	\N	31b833b8-b278-46fb-8a71-7ad5d4c14e53
00000000-0000-0000-0000-000000000000	360	g3sg7fbwd66m	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:55:49.82393+00	2026-11-09 13:55:49.82393+00	\N	b2c2687d-8ddc-439e-bfc9-8be8110d5f8d
00000000-0000-0000-0000-000000000000	361	4motgul5xky5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 13:59:56.186805+00	2026-11-09 13:59:56.186805+00	\N	10dcbcde-9ca3-4c15-a2a9-8e253102e672
00000000-0000-0000-0000-000000000000	362	kykjrsirg3nl	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 14:01:41.026816+00	2026-11-09 14:01:41.026816+00	\N	fe40b83c-b0ee-4443-b0a8-b586927088a7
00000000-0000-0000-0000-000000000000	363	cskr5nzxfzaf	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 14:11:40.395502+00	2026-11-09 14:11:40.395502+00	\N	803c9099-2ca3-4999-957f-7e0fb2370e5b
00000000-0000-0000-0000-000000000000	364	e5wsseoy6ubi	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 14:31:21.400996+00	2026-11-09 14:31:21.400996+00	\N	ee1fb983-9bc4-4c64-b06d-da6b0ea6f598
00000000-0000-0000-0000-000000000000	365	uskt56snx7na	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 14:39:37.082568+00	2026-11-09 14:39:37.082568+00	\N	164a6c80-65e1-4c16-b552-c3272d7ee75e
00000000-0000-0000-0000-000000000000	366	r2wuv6se3cwo	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 15:04:22.890761+00	2026-11-09 15:04:22.890761+00	\N	27bef50d-3132-4f39-a0ee-fbada4cefbd7
00000000-0000-0000-0000-000000000000	367	724nknqy3aac	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-09 15:36:40.760027+00	2026-11-09 15:36:40.760027+00	\N	c4710ef7-5096-40aa-b124-a85abd222803
00000000-0000-0000-0000-000000000000	368	vamv7kb7hav5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	f	2026-11-10 03:49:50.160374+00	2026-11-10 03:49:50.160374+00	\N	397e4fb7-ac03-4d14-88dd-896fb527c747
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
20260115000000
20260121000000
20260219120000
20260302000000
20260625000000
20260821000000
20260821010000
20260824000000
20260824000001
20260831180000
\.


--
-- Data for Name: scim_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.scim_tokens (id, sso_provider_id, token_hash, prefix, created_at, expires_at, revoked_at, last_used_at) FROM stdin;
\.


--
-- Data for Name: scim_users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.scim_users (id, sso_provider_id, user_id, resource, created_at, updated_at, deleted_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
789f2b73-af91-44df-a670-3cba65decf96	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 12:39:21.149548+00	2026-11-07 12:39:21.149548+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
c395ac9d-59e2-424c-a655-5c2085f40970	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 12:39:21.319738+00	2026-11-07 12:39:21.319738+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
e5f5fca7-9608-4e35-af51-ba9126081d55	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 12:40:17.178623+00	2026-11-07 12:40:17.178623+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
7db13812-6c2a-40c2-b43a-f2ab785a3143	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 12:40:59.613297+00	2026-11-07 12:40:59.613297+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
68102110-7502-4d40-b953-e51ca78e7f88	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 12:47:13.740774+00	2026-11-07 12:47:13.740774+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
0897a242-0e1e-42cf-88a2-77f26784d906	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 12:56:22.793611+00	2026-11-07 12:56:22.793611+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
b4c50c5d-12e1-44a6-b4ea-c1636a3999f3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:00:20.344169+00	2026-11-07 13:00:20.344169+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
5cd56b49-3ac9-4da0-b8a3-6c1116c7ae7c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:04:13.20898+00	2026-11-07 13:04:13.20898+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
5aabc470-8bb0-4741-a374-bf9c944de1e4	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:11:17.278752+00	2026-11-07 13:11:17.278752+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
4805e81c-f5fa-4c46-81ba-a41ca20878c8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:14:56.983957+00	2026-11-07 13:14:56.983957+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
0325535f-0924-4d82-a142-6d9214cd4692	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:17:02.349949+00	2026-11-07 13:17:02.349949+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
0c6a08b0-2417-4376-b7ed-b3171200d15e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:31:41.475476+00	2026-11-07 13:31:41.475476+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
71327de4-e957-45e5-9784-bd8f8e160d3c	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:31:41.625711+00	2026-11-07 13:31:41.625711+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
d6d10164-4c3c-4164-97e9-21899f6e6835	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:32:07.533214+00	2026-11-07 13:32:07.533214+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
9fbbd3df-bc05-4b69-8f8f-05c0fc809569	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:32:07.619696+00	2026-11-07 13:32:07.619696+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
11abd938-a61a-4ba6-b0b1-ab7f36740c90	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:33:14.324991+00	2026-11-07 13:33:14.324991+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
1a48ada1-7e5e-4e9a-9d4a-2c87ceb04e5e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:47:48.41161+00	2026-11-07 13:47:48.41161+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
eaefd3f1-cb20-4979-a1cf-d5b7271adcd3	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:47:48.516524+00	2026-11-07 13:47:48.516524+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
a1e26074-fe85-469c-92f3-b20df2e29e44	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:48:12.684015+00	2026-11-07 13:48:12.684015+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
8eb46617-36a1-4af6-841b-3be8308f5a11	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:48:12.747583+00	2026-11-07 13:48:12.747583+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
273cb7b4-a49f-49c5-aa91-405c11d0ef6a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:54:06.275165+00	2026-11-07 13:54:06.275165+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
f0f5b6d9-a201-4593-bec7-1abdc5dd1944	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:54:06.39509+00	2026-11-07 13:54:06.39509+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
d351cf4a-bc7a-4e2a-8e04-f3b4da33a5f2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:54:34.276289+00	2026-11-07 13:54:34.276289+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
f61e0d14-6730-41d8-ab04-b19fbe6b4a32	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:55:15.997066+00	2026-11-07 13:55:15.997066+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
3f379520-4a8d-41c8-aae8-a027532626fa	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:56:04.48293+00	2026-11-07 13:56:04.48293+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
3b8350ee-d8fc-4f2e-8525-d195b4eca827	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:56:04.547306+00	2026-11-07 13:56:04.547306+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
e84fa9d7-f9c5-425e-b406-a8ea27360f43	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:58:10.038999+00	2026-11-07 13:58:10.038999+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
069e9a1c-cd3f-484f-9913-dc7ac74ab5c7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:58:10.268303+00	2026-11-07 13:58:10.268303+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
391556a0-7035-4758-8897-d8666bf4257e	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:58:42.692758+00	2026-11-07 13:58:42.692758+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
5dc37fd5-532d-40cf-86b8-cce4da87cc24	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:58:42.779162+00	2026-11-07 13:58:42.779162+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
4ec49456-be32-4d9a-a4b6-b74176510253	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:59:02.881269+00	2026-11-07 13:59:02.881269+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
ed907978-ab67-4b76-a502-8e88a80c45a4	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:59:02.991242+00	2026-11-07 13:59:02.991242+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
c3ddcb27-3bab-476d-982d-71bf0c3aece1	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:59:18.577795+00	2026-11-07 13:59:18.577795+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
3cae7606-3d01-4a10-ae14-db559fd7f3b0	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:59:18.673198+00	2026-11-07 13:59:18.673198+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
5e7be0f1-ae41-4522-933b-dac4d97415bd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:59:28.589622+00	2026-11-07 13:59:28.589622+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
a0cb93bc-0e8f-433d-bb66-6d8f5fc39211	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 13:59:28.764931+00	2026-11-07 13:59:28.764931+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
a6f8e944-21f4-4600-963e-c34993c104ab	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:59:31.478181+00	2026-11-07 13:59:31.478181+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
c13ee6d7-fdca-419f-94aa-2b91d7df8b05	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:59:31.563887+00	2026-11-07 13:59:31.563887+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
5d10f993-8871-490b-a3ee-9487e5d1f163	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:59:41.406482+00	2026-11-07 13:59:41.406482+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
3b560fa4-a322-4f39-8704-279ba6bf94eb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 13:59:41.521705+00	2026-11-07 13:59:41.521705+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
e979135e-59d0-47c6-ba5c-56ab5149e048	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:01:15.815093+00	2026-11-07 14:01:15.815093+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
02f1b8b7-166a-4d6d-b4ff-d3701b9d8e28	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:01:15.933047+00	2026-11-07 14:01:15.933047+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
d5d89e15-42bc-493e-8793-ea9937f9e2f5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:03:31.523822+00	2026-11-07 14:03:31.523822+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
98835558-41ed-4ce0-88e7-55d1e9c7f8eb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:03:31.804109+00	2026-11-07 14:03:31.804109+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
4d885dc6-c266-4aa5-9aa9-7226e708e8cd	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:04:00.103608+00	2026-11-07 14:04:00.103608+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
ca6eebe5-5c84-439c-9e82-4dbdcd822a0a	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:04:00.226949+00	2026-11-07 14:04:00.226949+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
dc2bca82-597e-4f5c-97fd-162484fcec7f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:04:19.887495+00	2026-11-07 14:04:19.887495+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
8907417b-9921-4138-8ebf-62a7255ae0ef	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:04:19.999896+00	2026-11-07 14:04:19.999896+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
73a7f111-97a9-4efa-ba23-18d8a3be2258	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:04:34.392644+00	2026-11-07 14:04:34.392644+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
284bab39-920a-4b9e-ac14-5d720ea34b4a	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:04:34.491283+00	2026-11-07 14:04:34.491283+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
2b804dcd-b9d6-4583-8916-b6277440fe1c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:04:44.750155+00	2026-11-07 14:04:44.750155+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
0eb46a4d-0362-4cda-962f-47de5f0f5893	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:04:44.926702+00	2026-11-07 14:04:44.926702+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
47724107-e1f6-433d-a23d-b7dcfe5bb076	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:04:47.701309+00	2026-11-07 14:04:47.701309+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
8c7771d0-96a2-493d-ba65-c2382e17f41b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:04:47.797553+00	2026-11-07 14:04:47.797553+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
b9ca3760-f3b7-4658-8043-c93c38836094	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:04:58.590727+00	2026-11-07 14:04:58.590727+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
4695a989-f3f5-4c3c-a27b-be76277b0839	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:04:58.729477+00	2026-11-07 14:04:58.729477+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
8943b3a4-1710-46e6-98b9-927d16b53848	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:05:50.904026+00	2026-11-07 14:05:50.904026+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
2e23677c-0849-4dd9-b052-bfa860557bcc	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:05:51.083628+00	2026-11-07 14:05:51.083628+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
a30cf751-5c8e-4652-81f2-1c36fe537796	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:06:19.572246+00	2026-11-07 14:06:19.572246+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
c8cc0aee-2893-4972-989c-4aaa0711ae7c	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	2026-11-07 09:35:09.613786+00	2026-11-07 09:35:21.236716+00	\N	aal1	\N	2026-11-07 09:35:21.236627	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/2.29.0 Chrome/152.0.7977.130 Electron/44.5.1 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
0175255d-c61b-4a5f-9b42-a942677daceb	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	2026-11-07 09:37:16.551835+00	2026-11-07 09:37:16.551835+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
380ef91f-9dbf-4c7a-8b40-56020906307b	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	2026-11-07 09:37:16.829131+00	2026-11-07 10:36:41.394833+00	\N	aal1	\N	2026-11-07 10:36:41.394722	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
98b7aaab-7b51-4851-bfda-a933119c3279	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:06:19.66806+00	2026-11-07 14:06:19.66806+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
cae0e144-ed66-4ee4-9367-07c98fa8b427	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:06:39.211152+00	2026-11-07 14:06:39.211152+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
e59a02de-96ef-4662-9aff-bdf3264e851c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:06:39.303208+00	2026-11-07 14:06:39.303208+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
6545e789-2f03-4b35-ba81-238247821414	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:06:53.729561+00	2026-11-07 14:06:53.729561+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
ea751e30-c3ff-4312-bd9a-ef6331b0bcea	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:06:53.818625+00	2026-11-07 14:06:53.818625+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
f3b669dc-6450-41f1-b5f2-8aa577591b9b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:07:04.449464+00	2026-11-07 14:07:04.449464+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
ca6fda20-d721-47f0-84d2-b180040e533b	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:07:04.661198+00	2026-11-07 14:07:04.661198+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
8f7ac634-a532-4e0b-aa06-fed06abddc98	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:07:07.365969+00	2026-11-07 14:07:07.365969+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
9f33bcbb-1a22-4166-a195-01e0e69504cb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:07:07.454555+00	2026-11-07 14:07:07.454555+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
c5bb16e9-f314-4798-83be-f3714b25ac69	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:07:17.462668+00	2026-11-07 14:07:17.462668+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
19e2a0bc-d75a-4815-8424-57ac002a0a00	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:07:17.564135+00	2026-11-07 14:07:17.564135+00	\N	aal1	\N	\N	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36	104.28.225.167	\N	\N	\N	\N	\N
6b3b7a46-c3e3-4eef-b68f-05fe740ed4e5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:08:06.382652+00	2026-11-07 14:08:06.382652+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
5abb0fb5-e2c3-49d4-ac48-08556174d342	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:09:03.417406+00	2026-11-07 14:09:03.417406+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
fdcb07da-8789-43ca-9b76-b628f37cfe60	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	2026-11-07 14:09:03.543609+00	2026-11-07 14:09:03.543609+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
0644cf0f-cf21-49d5-bd95-b116d936c845	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:12:31.820818+00	2026-11-07 14:12:31.820818+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
d90956f7-0aa7-48fc-b369-469d1e1638eb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:21:45.21697+00	2026-11-07 14:21:45.21697+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
f8b65cb9-93ea-4733-ab8b-0705eccef098	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:24:03.743911+00	2026-11-07 14:24:03.743911+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
240da660-03fd-4263-8274-6fe04a3466bb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:33:24.087348+00	2026-11-07 14:33:24.087348+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
e4ba6f27-78a1-4456-9da6-b033c113f731	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:40:39.115429+00	2026-11-07 14:40:39.115429+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
7d7a7edf-789e-4ae5-abc5-ee7a16c85fe7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:50:56.149708+00	2026-11-07 14:50:56.149708+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
4dc9a5f9-3280-47c6-9073-9299f937819e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:52:06.773357+00	2026-11-07 14:52:06.773357+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
d60b511a-d679-4a36-99ac-daf4c3ce9c3a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 14:57:36.354147+00	2026-11-07 14:57:36.354147+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
c72f10b7-a0ad-4a4d-ad97-e9445d9c9f13	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 15:00:27.844128+00	2026-11-07 15:00:27.844128+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
e5035e39-6b9a-4d16-9fb7-2cdfd2b0edba	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 15:01:10.515963+00	2026-11-07 15:01:10.515963+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
e0b525b9-90b7-4510-ad12-7d622884fd76	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 15:30:49.318796+00	2026-11-07 15:30:49.318796+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
97a57772-8bd6-4b2b-869c-f4916ab136ea	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-07 15:51:26.177892+00	2026-11-07 15:51:26.177892+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
fee05a73-56fb-47ba-b10d-cd2520b6fc69	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-08 04:25:02.464048+00	2026-11-08 04:25:02.464048+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
4bfb374a-6b99-48f9-aab0-13495b501fa2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-08 04:26:09.981365+00	2026-11-08 04:26:09.981365+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
13b41c1f-ddbb-4e0c-9e48-e171c1907214	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-08 04:43:19.036426+00	2026-11-08 04:43:19.036426+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
554f3306-dfc0-4b73-b051-c2dd4a9884bd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-08 04:49:30.725152+00	2026-11-08 04:49:30.725152+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
8d8994e3-a827-410f-be07-f54b75187d66	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-08 05:12:18.478152+00	2026-11-08 05:12:18.478152+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
427ffdaa-100b-4df5-8549-e80eae3662e0	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-08 10:11:22.988467+00	2026-11-08 10:11:22.988467+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
15c70356-52bc-452b-931a-6e599786844f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-08 10:14:24.288544+00	2026-11-08 10:14:24.288544+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
fc44f5f6-f928-45ae-8e69-f364f9d55ded	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-08 10:15:42.806384+00	2026-11-08 10:15:42.806384+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
40aef4cf-2c1c-492a-90b3-0f832c69b786	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 05:29:57.525263+00	2026-11-09 05:29:57.525263+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
1ece7fc0-6a8c-44e0-af1a-1cee6379087b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 05:30:52.869412+00	2026-11-09 05:30:52.869412+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
0bc599a7-2bcb-413f-bb98-b6fa96844ab7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 05:38:42.585085+00	2026-11-09 05:38:42.585085+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
77329f66-526c-4996-9ca8-acb7a476c380	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 05:45:04.019859+00	2026-11-09 05:45:04.019859+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
7b6f38ea-f6de-4b3f-89e2-26cb20ccbe0e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 05:50:30.469508+00	2026-11-09 05:50:30.469508+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
825f6d6b-b098-407c-a584-d4d12e65105a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 05:51:19.472961+00	2026-11-09 05:51:19.472961+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
f48f4c9c-83c6-407a-9d83-4adb5be7ef77	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 05:53:35.047548+00	2026-11-09 05:53:35.047548+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
4aaaebd7-ca0f-4867-824e-236056c4f9c1	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 06:05:08.403893+00	2026-11-09 06:05:08.403893+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
8e798795-5dc4-4686-9c2c-004d45aa99ab	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:15:59.61681+00	2026-11-09 13:15:59.61681+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
75db3a12-c849-40f2-bb11-8960009d0826	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:16:31.936152+00	2026-11-09 13:16:31.936152+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
f6c0bd21-baf5-41cd-b47f-569b3dfb3914	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:17:47.800599+00	2026-11-09 13:17:47.800599+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
733264d1-aeb4-442e-8f31-411dd5b453c0	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:19:51.181951+00	2026-11-09 13:19:51.181951+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
279faaef-2b5c-42f9-aa98-bcd07a431a53	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:32:01.848057+00	2026-11-09 13:32:01.848057+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
01dd7ee4-671e-41a4-b7d3-a76859228840	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:32:38.4501+00	2026-11-09 13:32:38.4501+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
062d8fec-40bf-4c9c-a6e9-cef3da021387	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:32:55.930793+00	2026-11-09 13:32:55.930793+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
29e97cb1-5040-465a-bde9-4d51b84fed1c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:33:30.575752+00	2026-11-09 13:33:30.575752+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
5be873d4-87fe-4966-9830-831ef71d7f78	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:34:24.229371+00	2026-11-09 13:34:24.229371+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
f70edcc3-f7ba-4a9d-ab69-1b1450903962	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:35:09.789503+00	2026-11-09 13:35:09.789503+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
078cf97a-59f0-442a-a61f-ca2cbf96df77	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:35:55.314959+00	2026-11-09 13:35:55.314959+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
11dcf386-f8e3-440f-9036-ef7f315b6d2f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:39:23.314547+00	2026-11-09 13:39:23.314547+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
b3832204-c6e9-46d7-8ac5-aa90253b04fb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:39:40.447575+00	2026-11-09 13:39:40.447575+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
fd1ceaf8-2771-4fb6-b405-48ecac4d3233	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:40:28.484021+00	2026-11-09 13:40:28.484021+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
d0daf880-8b07-4fb8-8516-4b09006d9876	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:42:13.0467+00	2026-11-09 13:42:13.0467+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
f72f2732-8c61-45c6-8f7f-a4aa83f5c147	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:43:14.922411+00	2026-11-09 13:43:14.922411+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
00ddeba3-ca3d-4f52-81dd-46c0a28303cd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:44:27.979018+00	2026-11-09 13:44:27.979018+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
3f7dd683-5069-44a9-bb42-b9151bb47d03	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:44:46.003296+00	2026-11-09 13:44:46.003296+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
9e110a7f-413e-42e7-855f-dcc75d15da7e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:46:09.315876+00	2026-11-09 13:46:09.315876+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
c0c05881-50f2-490e-be33-d71ccd8ca6f8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:46:11.915463+00	2026-11-09 13:46:11.915463+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
e5bb10a3-b32c-415b-b44e-480ab6386431	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:47:25.158599+00	2026-11-09 13:47:25.158599+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
7e919bd6-fa9a-4d91-8089-3a1490e3b4a2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:48:08.06915+00	2026-11-09 13:48:08.06915+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
04239fba-88ae-4147-95b7-9fa2698f9b66	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:51:23.99673+00	2026-11-09 13:51:23.99673+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
1265bb81-a015-46d4-944b-aa29729b31d3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:52:05.525121+00	2026-11-09 13:52:05.525121+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
31b833b8-b278-46fb-8a71-7ad5d4c14e53	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:54:20.416784+00	2026-11-09 13:54:20.416784+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
b2c2687d-8ddc-439e-bfc9-8be8110d5f8d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:55:49.808821+00	2026-11-09 13:55:49.808821+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
10dcbcde-9ca3-4c15-a2a9-8e253102e672	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 13:59:56.169713+00	2026-11-09 13:59:56.169713+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
fe40b83c-b0ee-4443-b0a8-b586927088a7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 14:01:41.009385+00	2026-11-09 14:01:41.009385+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
803c9099-2ca3-4999-957f-7e0fb2370e5b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 14:11:40.388269+00	2026-11-09 14:11:40.388269+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
ee1fb983-9bc4-4c64-b06d-da6b0ea6f598	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 14:31:21.386532+00	2026-11-09 14:31:21.386532+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
164a6c80-65e1-4c16-b552-c3272d7ee75e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 14:39:37.067519+00	2026-11-09 14:39:37.067519+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
27bef50d-3132-4f39-a0ee-fbada4cefbd7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 15:04:22.873648+00	2026-11-09 15:04:22.873648+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
c4710ef7-5096-40aa-b124-a85abd222803	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-09 15:36:40.723425+00	2026-11-09 15:36:40.723425+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
397e4fb7-ac03-4d14-88dd-896fb527c747	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	2026-11-10 03:49:50.120728+00	2026-11-10 03:49:50.120728+00	\N	aal1	\N	\N	node	104.28.225.167	\N	\N	\N	\N	\N
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	authenticated	authenticated	gokulsastrologicalinsights@gmail.com	$2a$10$QxncWELlt6UYIkFMhCjYWeGWTBqs37MU7/2OSfI0Q6QbTBmKm5lqS	2026-11-07 09:17:04.913993+00	2026-11-07 08:54:20.56375+00		\N		\N			\N	2026-11-07 09:37:16.829034+00	{"provider": "email", "providers": ["email"], "must_change_password": false}	{"full_name": "Gokul (Platform Admin)", "email_verified": true, "must_change_password": false}	\N	2026-11-07 08:54:20.550121+00	2026-11-07 10:36:41.378655+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	authenticated	authenticated	user_b_vivaham@gokulconnect.com	$2a$06$ZPw8WmSUKMoIcVb7O55bS.ZC2iR.tRISn/rzMKq5MtVn0Wjc/MoLC	2026-11-06 12:18:47.367031+00	\N		\N		\N			\N	2026-11-07 14:09:03.543526+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Vivaham Test Admin"}	\N	2026-11-06 12:18:47.367031+00	2026-11-07 14:09:03.545539+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	authenticated	authenticated	user_a_astro@gokulconnect.com	$2a$06$qKJfBYxn9OlaI0kW7KzBCute8sI2mMFEEmMHj17VZouKT.QoMe2.O	2026-11-06 12:18:47.367031+00	\N		\N		\N			\N	2026-11-10 03:49:50.120117+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Astrology Test Admin"}	\N	2026-11-06 12:18:47.367031+00	2026-11-10 03:49:50.193675+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.webauthn_challenges (id, user_id, challenge_type, session_data, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY auth.webauthn_credentials (id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, transports, backup_eligible, backed_up, friendly_name, created_at, updated_at, last_used_at) FROM stdin;
\.


--
-- Data for Name: business_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.business_members (id, business_id, user_id, role, is_active, created_at, updated_at) FROM stdin;
a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1	11111111-1111-1111-1111-111111111111	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	owner	t	2026-11-06 12:19:07.199239+00	2026-11-06 12:19:07.199239+00
b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2	22222222-2222-2222-2222-222222222222	bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	owner	t	2026-11-06 12:19:07.199239+00	2026-11-06 12:19:07.199239+00
b734d257-f570-4497-96d7-c76e99adb8d2	11111111-1111-1111-1111-111111111111	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	owner	t	2026-11-07 08:54:23.50233+00	2026-11-07 08:54:23.50233+00
fc083c41-5106-41d9-a3ef-2e1fba70b382	22222222-2222-2222-2222-222222222222	d5d32479-0a5d-43d1-8b81-0bac8e6b559d	owner	t	2026-11-07 08:54:23.589543+00	2026-11-07 08:54:23.589543+00
\.


--
-- Data for Name: business_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.business_settings (id, business_id, display_name, business_info, logo_placeholder, timezone, default_language, notification_connection_drops, notification_unread_alerts, notification_daily_digest, default_connection_id, webhook_retry_policy, opt_out_keywords, created_at, updated_at, business_hours, automation_settings) FROM stdin;
f7070890-853b-4113-8c34-b6d8436d85e4	11111111-1111-1111-1111-111111111111	Gokul's Astrological Insights	Astrology consultations, Horoscope analysis, Vedic & KP enquiries, Consultation bookings, and Payment follow-ups.	GA	Asia/Kolkata	ta,en	t	t	t	33333333-3333-3333-3333-333333333333	standard	STOP,UNSUBSCRIBE,QUIT,நிறுத்து	2026-11-06 12:00:08.127039+00	2026-11-06 12:00:08.127039+00	{"timezone": "Asia/Kolkata", "holiday_dates": [], "weekly_schedule": {"friday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "monday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "sunday": {"is_open": false, "open_time": "00:00", "close_time": "00:00"}, "tuesday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "saturday": {"is_open": true, "open_time": "10:00", "close_time": "16:00"}, "thursday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "wednesday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}}}	{"opt_in_keywords": ["START", "UNSTOP", "JOIN", "தொடங்கு"], "opt_out_keywords": ["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "நிறுத்து"], "is_automation_enabled": false, "human_handover_keywords": ["AGENT", "HUMAN", "REPRESENTATIVE", "0", "உதவி", "மனிதர்"], "max_bot_replies_per_hour": 10, "circuit_breaker_max_replies_15m": 5}
8e325cc0-4f24-4382-944e-522973e92ed3	22222222-2222-2222-2222-222222222222	Gokul Vivaham	Tamil matrimony enquiries, New registrations, Membership verification, Profile enquiries, and Payment follow-ups.	GV	Asia/Kolkata	ta,en	t	t	t	44444444-4444-4444-4444-444444444444	standard	STOP,UNSUBSCRIBE,QUIT,நிறுத்து	2026-11-06 12:00:08.127039+00	2026-11-06 13:56:54.01467+00	{"timezone": "Asia/Kolkata", "holiday_dates": [], "weekly_schedule": {"friday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "monday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "sunday": {"is_open": false, "open_time": "00:00", "close_time": "00:00"}, "tuesday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "saturday": {"is_open": true, "open_time": "10:00", "close_time": "16:00"}, "thursday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}, "wednesday": {"is_open": true, "open_time": "09:00", "close_time": "18:00"}}}	{"opt_in_keywords": ["START", "UNSTOP", "JOIN", "தொடங்கு"], "opt_out_keywords": ["STOP", "UNSUBSCRIBE", "CANCEL", "QUIT", "நிறுத்து"], "is_automation_enabled": false, "human_handover_keywords": ["AGENT", "HUMAN", "REPRESENTATIVE", "0", "உதவி", "மனிதர்"], "max_bot_replies_per_hour": 10, "circuit_breaker_max_replies_15m": 5}
\.


--
-- Data for Name: businesses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.businesses (id, name, slug, description, icon_name, accent_color, is_active, created_at, updated_at) FROM stdin;
11111111-1111-1111-1111-111111111111	Gokul's Astrological Insights	astrology	Astrology consultations, Horoscope analysis, Vedic & KP enquiries, Consultation bookings, and Payment follow-ups.	Sparkles	purple	t	2026-11-06 11:59:32.839605+00	2026-11-06 11:59:32.839605+00
22222222-2222-2222-2222-222222222222	Gokul Vivaham	vivaham	Tamil matrimony enquiries, New registrations, Membership verification, Profile enquiries, and Payment follow-ups.	HeartHandshake	rose	t	2026-11-06 11:59:32.839605+00	2026-11-06 11:59:32.839605+00
\.


--
-- Data for Name: contact_activity_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_activity_logs (id, business_id, contact_id, activity_type, title, description, metadata, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: contact_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_notes (id, business_id, contact_id, author_id, author_name, note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crm_categories (id, business_id, name, slug, color, description, sort_order, is_default, created_at, updated_at) FROM stdin;
1c3c9aef-a156-4790-bebe-002cc05ba530	11111111-1111-1111-1111-111111111111	New Enquiry	new-enquiry	blue	New incoming enquiry awaiting initial assessment	1	t	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
54a67e08-e4bb-417d-b8f8-f00d1b4fc4f7	11111111-1111-1111-1111-111111111111	Astrology Consultation	astrology-consultation	purple	Personal astrology horoscope reading and consultation	2	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
561a5f33-b77d-49ed-ae28-e0a9917324d5	11111111-1111-1111-1111-111111111111	Horoscope Matching	horoscope-matching	amber	Kundali / Porutham compatibility matching	3	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
bea7c6d3-3784-4648-9b8f-56fcf82c516f	11111111-1111-1111-1111-111111111111	Numerology	numerology	emerald	Name and date-of-birth numerology analysis	4	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
01512c6a-aa22-46ae-b59a-5c74d17ed221	11111111-1111-1111-1111-111111111111	Existing Customer	existing-customer	teal	Verified repeat astrology customer	5	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
23154401-af4c-4ee0-8c14-1838def90c23	11111111-1111-1111-1111-111111111111	Follow-up Required	follow-up-required	rose	Pending follow-up or report delivery	6	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
4896510b-9b4f-425e-8199-6392c6dff289	22222222-2222-2222-2222-222222222222	New Registration	new-registration	blue	Newly submitted matrimony registration	1	t	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
0a5311c7-ac39-4e3a-9fc5-b1d16d0a716d	22222222-2222-2222-2222-222222222222	Groom	groom	sky	Groom matrimony profile candidate	2	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
85486290-2dc9-4453-8970-3e6e122c0f8c	22222222-2222-2222-2222-222222222222	Bride	bride	pink	Bride matrimony profile candidate	3	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
c0110824-a6cd-4cc0-8eb2-1d160de950fd	22222222-2222-2222-2222-222222222222	Membership Enquiry	membership-enquiry	amber	Matrimony plan or membership fee enquiry	4	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
8ae6b792-e85f-427c-b3ef-a346ce363941	22222222-2222-2222-2222-222222222222	Active Member	active-member	emerald	Active paid matrimonial service member	5	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
10cbb053-b206-48eb-9571-6e7a2d52aff7	22222222-2222-2222-2222-222222222222	Follow-up Required	follow-up-required	rose	Pending document verification or family contact	6	f	2026-11-07 12:34:11.182241+00	2026-11-07 12:34:11.182241+00
\.


--
-- Data for Name: crm_segments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.crm_segments (id, business_id, name, description, filters, is_system, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_profiles (id, email, full_name, avatar_url, is_superadmin, created_at, updated_at) FROM stdin;
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	user_a_astro@gokulconnect.com	Astrology Test Admin	\N	f	2026-11-06 12:18:47.367031+00	2026-11-06 12:18:47.367031+00
bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb	user_b_vivaham@gokulconnect.com	Vivaham Test Admin	\N	f	2026-11-06 12:18:47.367031+00	2026-11-06 12:18:47.367031+00
d5d32479-0a5d-43d1-8b81-0bac8e6b559d	gokulsastrologicalinsights@gmail.com	Gokul (Platform Admin)	\N	t	2026-11-07 08:54:20.549864+00	2026-11-07 08:54:20.549864+00
\.


--
-- Data for Name: wa_automation_execution_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_automation_execution_logs (id, business_id, rule_id, connection_id, conversation_id, contact_id, inbound_message_id, outbound_message_id, trigger_matched, conditions_snapshot, actions_executed, status, skip_reason, error_message, execution_time_ms, created_at) FROM stdin;
\.


--
-- Data for Name: wa_automation_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_automation_rules (id, business_id, connection_id, name, description, trigger_type, priority, stop_processing_on_match, cooldown_seconds, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: wa_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_connections (id, business_id, display_name, phone_number, phone_number_id, waba_id, credential_ref, connection_status, webhook_status, quality_rating, is_enabled, description, last_connected_at, last_checked_at, last_message_at, created_at, updated_at) FROM stdin;
33333333-3333-3333-3333-333333333333	11111111-1111-1111-1111-111111111111	Gokul Astrology Consultations	+91 98400 12345	109283746501928	293847561029384	vault:sec_astro_01	error	unconfigured	UNKNOWN	t	\N	\N	2026-11-07 10:06:38.471+00	2026-11-07 10:55:29.759185+00	2026-11-06 12:03:20.9022+00	2026-11-06 12:03:20.9022+00
44444444-4444-4444-4444-444444444444	22222222-2222-2222-2222-222222222222	Gokul Vivaham Member Desk	+1 555-152-9045	1395663896970053	1153964060437882	vault:sec_1395663896970053	connected	unconfigured	GREEN	t	\N	2026-11-06 13:56:54.01467+00	2026-11-06 13:56:54.01467+00	2026-11-07 10:55:31.164527+00	2026-11-06 12:03:20.9022+00	2026-11-06 13:56:54.01467+00
\.


--
-- Data for Name: wa_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_contacts (id, business_id, phone_number, display_name, profile_photo_url, metadata, created_at, updated_at, is_opted_out, opted_out_at, opted_out_reason, last_welcome_sent_at, last_inbound_at, total_inbound_count, email, status, category, source, is_archived, assigned_agent_id, assigned_agent_name, tags, custom_fields) FROM stdin;
c994bc69-ab0a-456b-89a5-2c81bd9a8738	22222222-2222-2222-2222-222222222222	919444559071	Gokul Test	\N	{}	2026-11-06 16:22:03.353787+00	2026-11-06 16:23:22.334599+00	f	\N	\N	\N	2026-11-06 16:23:22.334599+00	3	\N	lead	\N	whatsapp	f	\N	\N	{}	{}
4e58a9b0-9079-4670-aeb9-c709fc9a945b	11111111-1111-1111-1111-111111111111	919444559071	Gokul Approved Test Client	\N	{}	2026-11-06 13:51:41.860776+00	2026-11-07 10:55:29.759185+00	f	\N	\N	\N	2026-11-07 10:55:29.759185+00	3	\N	lead	\N	whatsapp	f	\N	\N	{}	{}
1d269630-5d55-45bc-8447-2ed39f9107fd	22222222-2222-2222-2222-222222222222	919840199999	Vivaham Matrimony Member	\N	{}	2026-11-06 13:51:43.609123+00	2026-11-07 10:55:31.164527+00	f	\N	\N	\N	2026-11-07 10:55:31.164527+00	2	\N	lead	\N	whatsapp	f	\N	\N	{}	{}
2278494e-c2df-4289-be7e-9dddb582be9d	11111111-1111-1111-1111-111111111111	919888811111	Karthik Astrologer Client	\N	{"tags": ["KP Astrology", "Chennai"], "email": "karthik.client@example.com", "source": "manual", "status": "lead", "category": "Astrology Consultation", "is_archived": false, "custom_fields": {}, "assigned_agent_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "assigned_agent_name": "user_a_astro"}	2026-11-07 11:57:08.234+00	2026-11-07 11:57:08.234+00	f	\N	\N	\N	\N	0	\N	lead	\N	whatsapp	f	\N	\N	{}	{}
\.


--
-- Data for Name: wa_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_conversations (id, business_id, connection_id, contact_id, status, last_message_preview, last_message_at, unread_count, created_at, updated_at, is_automation_paused, automation_paused_until, automation_paused_by, bot_reply_count_window, last_bot_reply_at) FROM stdin;
3a5aef84-6d5d-46f0-92b3-cb4183ccf726	22222222-2222-2222-2222-222222222222	44444444-4444-4444-4444-444444444444	c994bc69-ab0a-456b-89a5-2c81bd9a8738	open	Testing idempotency deduplication	2026-11-06 16:23:22.334599+00	0	2026-11-06 16:22:03.353787+00	2026-11-06 16:23:22.334599+00	f	\N	\N	0	\N
bb3be87f-0fd4-4626-9567-8ee4512ddb3f	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	4e58a9b0-9079-4670-aeb9-c709fc9a945b	open	Vanakkam, requesting KP astrological chart analysis	2026-11-07 10:55:29.759185+00	0	2026-11-06 13:51:41.970125+00	2026-11-07 10:55:29.759185+00	f	\N	\N	0	\N
3a70bd6e-f5a8-411e-9748-f64977a0108d	22222222-2222-2222-2222-222222222222	44444444-4444-4444-4444-444444444444	1d269630-5d55-45bc-8447-2ed39f9107fd	open	Enquiry for Mudaliar community premium membership	2026-11-07 10:55:31.164527+00	0	2026-11-06 13:51:43.609123+00	2026-11-07 10:55:31.164527+00	f	\N	\N	0	\N
\.


--
-- Data for Name: wa_credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_credentials (id, connection_id, business_id, key_version, iv, auth_tag, ciphertext, created_at, updated_at) FROM stdin;
64b36ca4-0ced-4b98-81be-321aa0486f17	44444444-4444-4444-4444-444444444444	22222222-2222-2222-2222-222222222222	v1	e0a6aaee2ec886b454a70435	93cd50030b1ea5a075487df0d8beae7b	dcb9f6140933806b2187f52a9dec15f99b84cac37ab350b6b1aa994659584c4cfcd49446099888015522153da20022d6c8ba927a6654e6060195a134b7b4c16c372f0e6446cdf5c9a3d55adbb921a92f471d94189e2edb76ffa9ca7018960067aa4690b3cfd81c7a7ac12486474886ad935e3f527c1beb694a7dbd077171e5d75275cd99b1107a26c0336fbbb706a50cab20fea605e679309157e989c35d4bd77567e24564f57f9d470363421fdcbd3e24776061c0d52442902758dbd3277856609ede376330a770faa5f145995975cf033963f803e3c04cb66b3cc54a35665ea4ed240340f97a205c349348d61b436c1ab272cdb44d4e4283c3c9fb27a17863948d7413e7b3c3c2ec2457d9e1db4a2eb8f5b1f03e046178c169e13b5075d936fb9a6f881bb0f2d3f9fd84	2026-11-06 13:56:54.01467+00	2026-11-06 16:48:24.617+00
\.


--
-- Data for Name: wa_message_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_message_templates (id, business_id, connection_id, template_name, language, category, status, components, created_at, updated_at, meta_template_id, rejection_reason, is_archived, last_synced_at) FROM stdin;
\.


--
-- Data for Name: wa_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_messages (id, business_id, connection_id, conversation_id, contact_id, direction, message_type, content, meta_message_id, status, error_code, error_message, sent_at, delivered_at, read_at, raw_payload, created_at, updated_at) FROM stdin;
621d152a-b0a9-4665-af8e-66848edfc532	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	inbound	text	Vanakkam, requesting KP astrological chart analysis	wamid.live_in_096958_32c3d717	delivered	\N	\N	\N	2026-11-06 13:51:42.108736+00	\N	{"text": {"body": "Vanakkam, requesting KP astrological chart analysis"}, "type": "text"}	2026-11-06 13:51:42.108736+00	2026-11-06 13:51:42.108736+00
fa7ca778-d750-42d7-86b6-3e62b22fc41b	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	outbound	text	Astrology consultation booking confirmation	wamid.live_out_096958_c1f94923	read	\N	\N	2026-11-06 13:51:37.381+00	2026-11-06 13:51:37.853+00	2026-11-06 13:51:37.983+00	{"text": "Astrology consultation booking confirmation"}	2026-11-06 13:51:42.043337+00	2026-11-06 13:51:42.682968+00
126d67d1-7cfe-4f8b-9e04-f374cd0a7adc	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	outbound	text	Message to unreachable phone	wamid.live_fail_096958_d2e1156b	failed	131026	Message undeliverable: User not on WhatsApp	\N	\N	\N	\N	2026-11-06 13:51:42.789576+00	2026-11-06 13:51:42.856669+00
d7865547-697d-43ac-a5b9-e1d975afb21b	22222222-2222-2222-2222-222222222222	44444444-4444-4444-4444-444444444444	3a70bd6e-f5a8-411e-9748-f64977a0108d	1d269630-5d55-45bc-8447-2ed39f9107fd	inbound	text	Enquiry for Mudaliar community premium membership	wamid.live_viv_096958_f00fd88e	delivered	\N	\N	\N	2026-11-06 13:51:43.609123+00	\N	{}	2026-11-06 13:51:43.609123+00	2026-11-06 13:51:43.609123+00
ef5746ed-65e6-4e97-a960-79100bb458cd	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	inbound	text	Vanakkam, requesting KP astrological chart analysis	wamid.live_in_523182_c92ddf87	delivered	\N	\N	\N	2026-11-07 04:58:48.357653+00	\N	{"text": {"body": "Vanakkam, requesting KP astrological chart analysis"}, "type": "text"}	2026-11-07 04:58:48.357653+00	2026-11-07 04:58:48.357653+00
f4cc01fc-fe45-4038-8573-4cdf4a0a3a12	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	outbound	text	Astrology consultation booking confirmation	wamid.live_out_523182_9d4e8ca6	read	\N	\N	2026-11-07 04:58:43.326+00	2026-11-07 04:58:43.691+00	2026-11-07 04:58:43.798+00	{"text": "Astrology consultation booking confirmation"}	2026-11-07 04:58:48.290011+00	2026-11-07 04:58:48.804423+00
a35b147d-135a-4085-8957-ed8cbc208fc3	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	outbound	text	Message to unreachable phone	wamid.live_fail_523182_4dc1ca5e	failed	131026	Message undeliverable: User not on WhatsApp	\N	\N	\N	\N	2026-11-07 04:58:48.909329+00	2026-11-07 04:58:48.971474+00
cd3e1268-bdeb-4914-a9c8-399aea6f801a	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	inbound	text	Vanakkam, requesting KP astrological chart analysis	wamid.live_in_560762_82af3ca8	delivered	\N	\N	\N	2026-11-07 08:19:26.066601+00	\N	{"text": {"body": "Vanakkam, requesting KP astrological chart analysis"}, "type": "text"}	2026-11-07 08:19:26.066601+00	2026-11-07 08:19:26.066601+00
00c67799-c17d-44ae-91cc-c3c24cce7b8b	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	outbound	text	Astrology consultation booking confirmation	wamid.live_out_560762_10f4160d	read	\N	\N	2026-11-07 08:19:20.911+00	2026-11-07 08:19:21.342+00	2026-11-07 08:19:21.446+00	{"text": "Astrology consultation booking confirmation"}	2026-11-07 08:19:25.978915+00	2026-11-07 08:19:26.543739+00
4fc5de15-5932-487f-ab02-2b589bbc68bb	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	outbound	text	Message to unreachable phone	wamid.live_fail_560762_70664d3f	failed	131026	Message undeliverable: User not on WhatsApp	\N	\N	\N	\N	2026-11-07 08:19:26.658234+00	2026-11-07 08:19:26.710602+00
53776f87-410f-4273-af23-8fb749e9f7f3	22222222-2222-2222-2222-222222222222	44444444-4444-4444-4444-444444444444	3a70bd6e-f5a8-411e-9748-f64977a0108d	1d269630-5d55-45bc-8447-2ed39f9107fd	inbound	text	Enquiry for Mudaliar community premium membership	wamid.live_viv_560762_31971ec6	delivered	\N	\N	\N	2026-11-07 08:19:27.44355+00	\N	{}	2026-11-07 08:19:27.44355+00	2026-11-07 08:19:27.44355+00
cee3fca5-434a-4df1-beb2-166ff3879a43	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	inbound	text	Vanakkam, requesting KP astrological chart analysis	wamid.live_in_924409_4674be71	delivered	\N	\N	\N	2026-11-07 10:55:29.759185+00	\N	{"text": {"body": "Vanakkam, requesting KP astrological chart analysis"}, "type": "text"}	2026-11-07 10:55:29.759185+00	2026-11-07 10:55:29.759185+00
8acbe51b-1f3f-4bce-96a3-0375ef579818	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	outbound	text	Astrology consultation booking confirmation	wamid.live_out_924409_0b88f2af	read	\N	\N	2026-11-07 10:55:24.556+00	2026-11-07 10:55:24.942+00	2026-11-07 10:55:25.048+00	{"text": "Astrology consultation booking confirmation"}	2026-11-07 10:55:29.681805+00	2026-11-07 10:55:30.217906+00
62d992ff-1647-49c4-a856-4b7ee996685e	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	bb3be87f-0fd4-4626-9567-8ee4512ddb3f	4e58a9b0-9079-4670-aeb9-c709fc9a945b	outbound	text	Message to unreachable phone	wamid.live_fail_924409_37d24b82	failed	131026	Message undeliverable: User not on WhatsApp	\N	\N	\N	\N	2026-11-07 10:55:30.364997+00	2026-11-07 10:55:30.429138+00
01bead8c-8fe8-40fa-95cb-e40f64741583	22222222-2222-2222-2222-222222222222	44444444-4444-4444-4444-444444444444	3a70bd6e-f5a8-411e-9748-f64977a0108d	1d269630-5d55-45bc-8447-2ed39f9107fd	inbound	text	Enquiry for Mudaliar community premium membership	wamid.live_viv_924409_8b804924	delivered	\N	\N	\N	2026-11-07 10:55:31.164527+00	\N	{}	2026-11-07 10:55:31.164527+00	2026-11-07 10:55:31.164527+00
\.


--
-- Data for Name: wa_processing_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_processing_jobs (id, business_id, connection_id, job_type, payload, status, attempts, max_attempts, last_error, locked_at, scheduled_at, created_at, updated_at, idempotency_key, locked_by) FROM stdin;
87baed38-1c26-472e-985f-d97785fa37e9	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	send_message	{"text": "Automated retry payload", "recipient": "919444559071"}	completed	4	5	Skipped: Missing connection_id or recipient_phone in payload	2026-11-07 08:30:25.87208+00	2026-11-06 13:56:39.143+00	2026-11-06 13:51:43.732028+00	2026-11-07 08:30:20.882+00	\N	cron_1794040219674
39217bbe-7b0f-4262-a346-698e9b72f336	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	send_message	{"text": "Automated retry payload", "recipient": "919444559071"}	completed	2	5	Skipped: Missing connection_id or recipient_phone in payload	2026-11-07 08:30:25.87208+00	2026-11-07 05:03:44.907+00	2026-11-07 04:58:49.813355+00	2026-11-07 08:30:20.962+00	\N	cron_1794040219674
7397f94b-a3dd-4f35-8803-a6463bc1f435	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	send_message	{"text": "Automated retry payload", "recipient": "919444559071"}	completed	1	5	Skipped: Missing connection_id or recipient_phone in payload	2026-11-07 08:30:25.87208+00	2026-11-07 08:24:22.57+00	2026-11-07 08:19:27.56351+00	2026-11-07 08:30:21.044+00	\N	cron_1794040219674
5689c56f-7002-44fb-bdfc-9ae621d2e44f	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	send_message	{"text": "Automated retry payload", "recipient": "919444559071"}	pending	1	5	Meta API Rate Limited (code 130429)	\N	2026-11-07 11:00:26.222+00	2026-11-07 10:55:31.286082+00	2026-11-07 10:55:31.286082+00	\N	\N
\.


--
-- Data for Name: wa_rule_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_rule_actions (id, business_id, rule_id, action_type, action_payload, delay_seconds, order_index, created_at) FROM stdin;
\.


--
-- Data for Name: wa_rule_conditions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_rule_conditions (id, business_id, rule_id, condition_group, condition_type, operator, match_value, order_index, created_at) FROM stdin;
\.


--
-- Data for Name: wa_webhook_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wa_webhook_events (id, business_id, connection_id, phone_number_id, meta_event_id, event_type, payload, is_processed, processed_at, processing_error, created_at) FROM stdin;
358c8a17-6109-42e9-a5a4-07692418b099	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_in_096958_32c3d717	message	{"text": {"body": "Vanakkam, requesting KP astrological chart analysis"}, "type": "text"}	t	2026-11-06 13:51:42.108736+00	\N	2026-11-06 13:51:42.108736+00
9908be7e-bbe2-4639-ab9b-ef3d628f7330	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_fail_560762_70664d3f_failed	status	{}	t	2026-11-07 08:19:26.710602+00	\N	2026-11-07 08:19:26.710602+00
1e5b6ae8-3fa1-46bf-9d21-3711a521d879	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_out_096958_c1f94923_delivered	status	{}	t	2026-11-06 13:51:42.508327+00	\N	2026-11-06 13:51:42.508327+00
2f9b91a9-60c9-47e3-bcf0-3eb140be8618	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_out_096958_c1f94923_read	status	{}	t	2026-11-06 13:51:42.682968+00	\N	2026-11-06 13:51:42.682968+00
155ada2c-0796-4550-9fd1-a2f9488b0345	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_fail_096958_d2e1156b_failed	status	{}	t	2026-11-06 13:51:42.856669+00	\N	2026-11-06 13:51:42.856669+00
b70b56fe-fb36-4bdd-84f0-3c761ca8df03	22222222-2222-2222-2222-222222222222	44444444-4444-4444-4444-444444444444	209283746501930	wamid.live_viv_096958_f00fd88e	message	{}	t	2026-11-06 13:51:43.609123+00	\N	2026-11-06 13:51:43.609123+00
6869f104-eb48-4ba5-b1ae-1357ce597cf7	22222222-2222-2222-2222-222222222222	44444444-4444-4444-4444-444444444444	1395663896970053	wamid.live_viv_560762_31971ec6	message	{}	t	2026-11-07 08:19:27.44355+00	\N	2026-11-07 08:19:27.44355+00
d11cf5b8-e22a-4fa4-8900-53d928a077e8	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_in_523182_c92ddf87	message	{"text": {"body": "Vanakkam, requesting KP astrological chart analysis"}, "type": "text"}	t	2026-11-07 04:58:48.357653+00	\N	2026-11-07 04:58:48.357653+00
35511835-67bc-4809-9b97-69df23bdbe71	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_out_523182_9d4e8ca6_delivered	status	{}	t	2026-11-07 04:58:48.654021+00	\N	2026-11-07 04:58:48.654021+00
7f58dcab-5989-4a24-b808-a229a0b89369	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_out_523182_9d4e8ca6_read	status	{}	t	2026-11-07 04:58:48.804423+00	\N	2026-11-07 04:58:48.804423+00
4a60e66d-717b-4854-b932-6d3078b64b97	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_fail_523182_4dc1ca5e_failed	status	{}	t	2026-11-07 04:58:48.971474+00	\N	2026-11-07 04:58:48.971474+00
316744c3-504b-4ea4-b37c-27666ce90c96	\N	\N	209283746501930	wamid.live_viv_523182_a27ded5b	message	{}	f	\N	No registered WhatsApp connection for Phone Number ID: 209283746501930	2026-11-07 04:58:49.685886+00
19336806-045d-464a-9782-cc8250e7337d	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_in_560762_82af3ca8	message	{"text": {"body": "Vanakkam, requesting KP astrological chart analysis"}, "type": "text"}	t	2026-11-07 08:19:26.066601+00	\N	2026-11-07 08:19:26.066601+00
5568094d-0361-45de-8ea2-b2d7c57a387a	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_out_560762_10f4160d_delivered	status	{}	t	2026-11-07 08:19:26.394693+00	\N	2026-11-07 08:19:26.394693+00
b36b223b-d632-4905-9029-710ff58d5cee	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_out_560762_10f4160d_read	status	{}	t	2026-11-07 08:19:26.543739+00	\N	2026-11-07 08:19:26.543739+00
47915d3a-ab5f-4763-b413-e015113ce86b	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_in_924409_4674be71	message	{"text": {"body": "Vanakkam, requesting KP astrological chart analysis"}, "type": "text"}	t	2026-11-07 10:55:29.759185+00	\N	2026-11-07 10:55:29.759185+00
47517d0b-b761-4464-be14-51a7432f3545	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_out_924409_0b88f2af_delivered	status	{}	t	2026-11-07 10:55:30.062763+00	\N	2026-11-07 10:55:30.062763+00
defc0807-b9af-4594-b378-1687aa7f6409	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_out_924409_0b88f2af_read	status	{}	t	2026-11-07 10:55:30.217906+00	\N	2026-11-07 10:55:30.217906+00
84e9c91c-bfdf-4a17-a268-a26c6c3ab1cd	11111111-1111-1111-1111-111111111111	33333333-3333-3333-3333-333333333333	109283746501928	wamid.live_fail_924409_37d24b82_failed	status	{}	t	2026-11-07 10:55:30.429138+00	\N	2026-11-07 10:55:30.429138+00
d56669a9-23c4-4985-bf96-208efc517168	22222222-2222-2222-2222-222222222222	44444444-4444-4444-4444-444444444444	1395663896970053	wamid.live_viv_924409_8b804924	message	{}	t	2026-11-07 10:55:31.164527+00	\N	2026-11-07 10:55:31.164527+00
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: realtime; Owner: supabase_admin
--

COPY realtime.schema_migrations (version, inserted_at) FROM stdin;
20211116024918	2026-11-06 09:26:26
20211116045059	2026-11-06 09:26:26
20211116050929	2026-11-06 09:26:26
20211116051442	2026-11-06 09:26:26
20211116212300	2026-11-06 09:26:26
20211116213355	2026-11-06 09:26:26
20211116213934	2026-11-06 09:26:26
20211116214523	2026-11-06 09:26:26
20211122062447	2026-11-06 09:26:26
20211124070109	2026-11-06 09:26:26
20211202204204	2026-11-06 09:26:26
20211202204605	2026-11-06 09:26:26
20211210212804	2026-11-06 09:26:26
20211228014915	2026-11-06 09:26:26
20220107221237	2026-11-06 09:26:26
20220228202821	2026-11-06 09:26:26
20220312004840	2026-11-06 09:26:26
20220603231003	2026-11-06 09:26:26
20220603232444	2026-11-06 09:26:26
20220615214548	2026-11-06 09:26:26
20220712093339	2026-11-06 09:26:26
20220908172859	2026-11-06 09:26:26
20220916233421	2026-11-06 09:26:26
20230119133233	2026-11-06 09:26:26
20230128025114	2026-11-06 09:26:26
20230128025212	2026-11-06 09:26:26
20230227211149	2026-11-06 09:26:26
20230228184745	2026-11-06 09:26:26
20230308225145	2026-11-06 09:26:26
20230328144023	2026-11-06 09:26:26
20231018144023	2026-11-06 09:26:26
20231204144023	2026-11-06 09:26:26
20231204144024	2026-11-06 09:26:26
20231204144025	2026-11-06 09:26:26
20240108234812	2026-11-06 09:26:26
20240109165339	2026-11-06 09:26:26
20240227174441	2026-11-06 09:26:26
20240311171622	2026-11-06 09:26:26
20240321100241	2026-11-06 09:26:26
20240401105812	2026-11-06 09:26:26
20240418121054	2026-11-06 09:26:26
20240523004032	2026-11-06 09:26:26
20240618124746	2026-11-06 09:26:26
20240801235015	2026-11-06 09:26:26
20240805133720	2026-11-06 09:26:26
20240827160934	2026-11-06 09:26:26
20240919163303	2026-11-06 09:26:26
20240919163305	2026-11-06 09:26:26
20241019105805	2026-11-06 09:26:26
20241030150047	2026-11-06 09:26:26
20241108114728	2026-11-06 09:26:26
20241121104152	2026-11-06 09:26:26
20241130184212	2026-11-06 09:26:26
20241220035512	2026-11-06 09:26:26
20241220123912	2026-11-06 09:26:26
20241224161212	2026-11-06 09:26:26
20250107150512	2026-11-06 09:26:26
20250110162412	2026-11-06 09:26:26
20250123174212	2026-11-06 09:26:26
20250128220012	2026-11-06 09:26:26
20250506224012	2026-11-06 09:26:26
20250523164012	2026-11-06 09:26:26
20250714121412	2026-11-06 09:26:26
20250905041441	2026-11-06 09:26:26
20251103001201	2026-11-06 09:26:26
20251120212548	2026-11-06 09:26:26
20251120215549	2026-11-06 09:26:26
20260218120000	2026-11-06 09:26:26
20260326120000	2026-11-06 09:26:26
20260514120000	2026-11-06 09:26:26
20260527120000	2026-11-06 09:26:26
20260528120000	2026-11-06 09:26:26
20260603120000	2026-11-06 09:26:26
20260605120000	2026-11-06 09:26:26
20260606110000	2026-11-06 09:26:26
20260616120000	2026-11-06 09:26:26
20260624120000	2026-11-06 09:26:26
20260626120000	2026-11-06 09:26:26
20260706120000	2026-11-06 09:26:26
20260707120000	2026-11-06 09:26:26
20260709120000	2026-11-06 09:26:26
20260714120000	2026-11-06 09:26:26
20260827120000	2026-11-06 09:26:26
20260914120000	2026-11-06 09:26:26
20260916120000	2026-11-06 09:26:26
20260922120000	2026-11-06 09:26:26
20260925120000	2026-11-06 09:26:26
20260928120000	2026-11-06 09:26:26
20261002120000	2026-11-06 09:26:26
20261008120000	2026-11-06 09:26:26
20261009120000	2026-11-06 09:26:26
20261007120000	2026-11-10 07:15:06
20261022120000	2026-11-10 07:15:06
20261027120000	2026-11-10 07:15:06
20261029120000	2026-11-10 07:15:07
20261103130000	2026-11-10 07:15:07
\.


--
-- Data for Name: subscription; Type: TABLE DATA; Schema: realtime; Owner: supabase_realtime_admin
--

COPY realtime.subscription (id, subscription_id, entity, filters, claims, created_at, action_filter, selected_columns) FROM stdin;
\.


--
-- Data for Name: bucket_lifecycle_states; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.bucket_lifecycle_states (bucket_id, generation, next_run_at, claim_id, claim_until, continuation, last_started_at, last_completed_at, last_success_at, last_result, failure_count, last_error, updated_at) FROM stdin;
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets (id, name, owner, created_at, updated_at, public, avif_autodetection, file_size_limit, allowed_mime_types, owner_id, type, versioning_status, lifecycle_configuration, lifecycle_configuration_generation) FROM stdin;
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets_analytics (name, type, format, created_at, updated_at, id, deleted_at) FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.buckets_vectors (id, type, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lifecycle_abandoned_artifacts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.lifecycle_abandoned_artifacts (bucket_id, key, name, version, attempted_at) FROM stdin;
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.migrations (id, name, hash, executed_at) FROM stdin;
0	create-migrations-table	e18db593bcde2aca2a408c4d1100f6abba2195df	2026-11-06 09:26:25.805625
1	initialmigration	6ab16121fbaa08bbd11b712d05f358f9b555d777	2026-11-06 09:26:25.823183
2	storage-schema	cdc19a79b298ce37cc730487821a1a7b06b98105	2026-11-06 09:26:25.828015
3	pathtoken-column	2cb1b0004b817b29d5b0a971af16bafeede4b70d	2026-11-06 09:26:25.852843
4	add-migrations-rls	427c5b63fe1c5937495d9c635c263ee7a5905058	2026-11-06 09:26:25.875575
5	add-size-functions	79e081a1455b63666c1294a440f8ad4b1e6a7f84	2026-11-06 09:26:25.881887
6	change-column-name-in-get-size	ded78e2f1b5d7e616117897e6443a925965b30d2	2026-11-06 09:26:25.888045
7	add-rls-to-buckets	e7e7f86adbc51049f341dfe8d30256c1abca17aa	2026-11-06 09:26:25.895624
8	add-public-to-buckets	fd670db39ed65f9d08b01db09d6202503ca2bab3	2026-11-06 09:26:25.90083
9	fix-search-function	af597a1b590c70519b464a4ab3be54490712796b	2026-11-06 09:26:25.908491
10	search-files-search-function	b595f05e92f7e91211af1bbfe9c6a13bb3391e16	2026-11-06 09:26:25.912202
11	add-trigger-to-auto-update-updated_at-column	7425bdb14366d1739fa8a18c83100636d74dcaa2	2026-11-06 09:26:25.917547
12	add-automatic-avif-detection-flag	8e92e1266eb29518b6a4c5313ab8f29dd0d08df9	2026-11-06 09:26:25.92244
13	add-bucket-custom-limits	cce962054138135cd9a8c4bcd531598684b25e7d	2026-11-06 09:26:25.928595
14	use-bytes-for-max-size	941c41b346f9802b411f06f30e972ad4744dad27	2026-11-06 09:26:25.932237
15	add-can-insert-object-function	934146bc38ead475f4ef4b555c524ee5d66799e5	2026-11-06 09:26:26.002431
16	add-version	76debf38d3fd07dcfc747ca49096457d95b1221b	2026-11-06 09:26:26.00888
17	drop-owner-foreign-key	f1cbb288f1b7a4c1eb8c38504b80ae2a0153d101	2026-11-06 09:26:26.014882
18	add_owner_id_column_deprecate_owner	e7a511b379110b08e2f214be852c35414749fe66	2026-11-06 09:26:26.019764
19	alter-default-value-objects-id	02e5e22a78626187e00d173dc45f58fa66a4f043	2026-11-06 09:26:26.024794
20	list-objects-with-delimiter	cd694ae708e51ba82bf012bba00caf4f3b6393b7	2026-11-06 09:26:26.028312
21	s3-multipart-uploads	8c804d4a566c40cd1e4cc5b3725a664a9303657f	2026-11-06 09:26:26.037974
22	s3-multipart-uploads-big-ints	9737dc258d2397953c9953d9b86920b8be0cdb73	2026-11-06 09:26:26.060002
23	optimize-search-function	9d7e604cddc4b56a5422dc68c9313f4a1b6f132c	2026-11-06 09:26:26.078005
24	operation-function	8312e37c2bf9e76bbe841aa5fda889206d2bf8aa	2026-11-06 09:26:26.081958
25	custom-metadata	d974c6057c3db1c1f847afa0e291e6165693b990	2026-11-06 09:26:26.0874
26	objects-prefixes	215cabcb7f78121892a5a2037a09fedf9a1ae322	2026-11-06 09:26:26.091351
27	search-v2	859ba38092ac96eb3964d83bf53ccc0b141663a6	2026-11-06 09:26:26.096727
28	object-bucket-name-sorting	c73a2b5b5d4041e39705814fd3a1b95502d38ce4	2026-11-06 09:26:26.099476
29	create-prefixes	ad2c1207f76703d11a9f9007f821620017a66c21	2026-11-06 09:26:26.10246
30	update-object-levels	2be814ff05c8252fdfdc7cfb4b7f5c7e17f0bed6	2026-11-06 09:26:26.106887
31	objects-level-index	b40367c14c3440ec75f19bbce2d71e914ddd3da0	2026-11-06 09:26:26.110254
32	backward-compatible-index-on-objects	e0c37182b0f7aee3efd823298fb3c76f1042c0f7	2026-11-06 09:26:26.113179
33	backward-compatible-index-on-prefixes	b480e99ed951e0900f033ec4eb34b5bdcb4e3d49	2026-11-06 09:26:26.117234
34	optimize-search-function-v1	ca80a3dc7bfef894df17108785ce29a7fc8ee456	2026-11-06 09:26:26.120503
35	add-insert-trigger-prefixes	458fe0ffd07ec53f5e3ce9df51bfdf4861929ccc	2026-11-06 09:26:26.1249
36	optimise-existing-functions	6ae5fca6af5c55abe95369cd4f93985d1814ca8f	2026-11-06 09:26:26.127907
37	add-bucket-name-length-trigger	3944135b4e3e8b22d6d4cbb568fe3b0b51df15c1	2026-11-06 09:26:26.132835
38	iceberg-catalog-flag-on-buckets	02716b81ceec9705aed84aa1501657095b32e5c5	2026-11-06 09:26:26.138512
39	add-search-v2-sort-support	6706c5f2928846abee18461279799ad12b279b78	2026-11-06 09:26:26.152979
40	fix-prefix-race-conditions-optimized	7ad69982ae2d372b21f48fc4829ae9752c518f6b	2026-11-06 09:26:26.156305
41	add-object-level-update-trigger	07fcf1a22165849b7a029deed059ffcde08d1ae0	2026-11-06 09:26:26.169132
42	rollback-prefix-triggers	771479077764adc09e2ea2043eb627503c034cd4	2026-11-06 09:26:26.179855
43	fix-object-level	84b35d6caca9d937478ad8a797491f38b8c2979f	2026-11-06 09:26:26.182967
44	vector-bucket-type	99c20c0ffd52bb1ff1f32fb992f3b351e3ef8fb3	2026-11-06 09:26:26.186406
45	vector-buckets	049e27196d77a7cb76497a85afae669d8b230953	2026-11-06 09:26:26.195299
46	buckets-objects-grants	fedeb96d60fefd8e02ab3ded9fbde05632f84aed	2026-11-06 09:26:26.211082
47	iceberg-table-metadata	649df56855c24d8b36dd4cc1aeb8251aa9ad42c2	2026-11-06 09:26:26.215
48	iceberg-catalog-ids	e0e8b460c609b9999ccd0df9ad14294613eed939	2026-11-06 09:26:26.217767
49	buckets-objects-grants-postgres	072b1195d0d5a2f888af6b2302a1938dd94b8b3d	2026-11-06 09:26:26.233256
50	search-v2-optimised	6323ac4f850aa14e7387eb32102869578b5bd478	2026-11-06 09:26:26.236991
51	index-backward-compatible-search	2ee395d433f76e38bcd3856debaf6e0e5b674011	2026-11-06 09:26:26.670608
52	drop-not-used-indexes-and-functions	5cc44c8696749ac11dd0dc37f2a3802075f3a171	2026-11-06 09:26:26.672338
53	drop-index-lower-name	d0cb18777d9e2a98ebe0bc5cc7a42e57ebe41854	2026-11-06 09:26:26.682887
54	drop-index-object-level	6289e048b1472da17c31a7eba1ded625a6457e67	2026-11-06 09:26:26.685184
55	prevent-direct-deletes	262a4798d5e0f2e7c8970232e03ce8be695d5819	2026-11-06 09:26:26.686695
56	fix-optimized-search-function	b823ed1e418101032fa01374edc9a436e54e3ed4	2026-11-06 09:26:26.690666
57	s3-multipart-uploads-metadata	f127886e00d1b374fadbc7c6b31e09336aad5287	2026-11-06 09:26:26.696032
58	operation-ergonomics	00ca5d483b3fe0d522133d9002ccc5df98365120	2026-11-06 09:26:26.699461
59	drop-unused-functions	38456f13e39691c2bbb4b5151d0d1cdbabd4a8c4	2026-11-06 09:26:26.702968
60	optimize-existing-functions-again	db35e1c91a9201e59f4fef8d972c2f277d68b157	2026-11-06 09:26:26.706409
61	mark-filename-immutable	fe0096517ae9d60aaec1d110172ba9036dc66bb7	2026-11-06 09:26:26.710066
62	object-versioning-core	c6567e688f8c4a76887e7c1b117b2d58f4feccba	2026-11-06 09:26:26.713126
63	fix-search-name-relative-to-prefix	c7485e417624f795ce8bb2da21927f48e088904d	2026-11-06 09:26:26.718321
64	fix-search-by-timestamp-sqli	0af424ecd388a39bb1645184b222185a12149675	2026-11-06 09:26:26.724152
65	objects-key-version-index	da319c4b89ba800ce795d1b699f3a70675138058	2026-11-06 09:26:26.736392
66	objects-current-version-index	191466c93aa2c46a00e36505577c5fcab8d7cb4b	2026-11-06 09:26:26.743586
67	objects-null-version-index	15bfe8c35b66642b6c78ba60060fa8793bd2207a	2026-11-06 09:26:26.751295
68	bucket-lifecycle-configuration	3c08f6f889922f399519722a932b51007c11bebc	2026-11-06 09:26:26.752827
69	validate-bucket-lifecycle-constraints	4febacaaaa0e61e2b783bef081fe03a287e65eb3	2026-11-06 09:26:26.760858
70	list-objects-with-versions	5c17c3777616cd8d7b18b82835525fa3205af57b	2026-11-06 09:26:26.764459
71	objects-delete-marker-index	6d14858e66c66f8d6accf8a2630aefd1527fddba	2026-11-06 09:26:26.784157
72	drop-bucketid-objname-index	302beb09e1b469d7d4db19566f2389d280b64aa3	2026-11-06 09:26:26.790523
73	revoke-grants-to-unused-operations	ba9244051be09f22f714fc0170a2539f8b5f0e68	2026-11-06 09:26:26.79199
74	unlock-object-versioning	dacb58ecb37678de855505b3e1c5aec0d5df7894	2026-11-06 09:26:26.797034
75	enforce-bucket-lifecycle-update-role	8454a556116c985db857d3b99de94a31a68ad273	2026-11-06 09:26:26.801199
76	noncurrent-lifecycle	052cbe11956fd14b85861fc19537c0303b73010e	2026-11-06 09:26:26.804376
77	noncurrent-lifecycle-archived-order-index	d68b03438a987aa1324a0fca68f7078cb2ffb849	2026-11-06 09:26:26.81856
78	noncurrent-lifecycle-archived-due-index	c82ba0e577ec5c3496b1077ff385ce4645497698	2026-11-06 09:26:26.82527
79	lifecycle-writer-coordination	3b38458424d2099e6b2e3cb4233590060f527fe1	2026-11-06 09:26:26.826769
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.objects (id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata, version, owner_id, user_metadata, archived_at, is_delete_marker, is_versioned) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads (id, in_progress_size, upload_signature, bucket_id, key, version, owner_id, created_at, user_metadata, metadata) FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.s3_multipart_uploads_parts (id, upload_id, size, part_number, bucket_id, key, etag, owner_id, version, created_at) FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY storage.vector_indexes (id, name, bucket_id, data_type, dimension, distance_metric, metadata_configuration, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: supabase_migrations; Owner: postgres
--

COPY supabase_migrations.schema_migrations (version, statements, name, created_by, idempotency_key, rollback) FROM stdin;
20261107062122	{"CREATE OR REPLACE FUNCTION public.ingest_wa_inbound_message_v2(\n    p_phone_number_id TEXT,\n    p_meta_message_id TEXT,\n    p_sender_phone TEXT,\n    p_sender_name TEXT DEFAULT NULL,\n    p_message_type TEXT DEFAULT 'text',\n    p_content TEXT DEFAULT '',\n    p_raw_payload JSONB DEFAULT '{}'::jsonb\n)\nRETURNS JSONB\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public, pg_temp\nAS $$\nDECLARE\n    v_conn RECORD;\n    v_contact_id UUID;\n    v_conversation_id UUID;\n    v_message_id UUID;\n    v_job_id UUID;\n    v_event_processed BOOLEAN;\n    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());\nBEGIN\n    -- 1. Resolve registered connection for this phone_number_id\n    SELECT id, business_id, is_enabled\n    INTO v_conn\n    FROM public.wa_connections\n    WHERE phone_number_id = p_phone_number_id\n    LIMIT 1;\n\n    -- 2. Idempotency check: has this meta_message_id already been processed?\n    SELECT is_processed\n    INTO v_event_processed\n    FROM public.wa_webhook_events\n    WHERE meta_event_id = p_meta_message_id;\n\n    IF v_event_processed IS TRUE THEN\n        RETURN jsonb_build_object(\n            'status', 'duplicate',\n            'meta_message_id', p_meta_message_id,\n            'message', 'Webhook event already processed'\n        );\n    END IF;\n\n    -- 3. Record event in wa_webhook_events\n    INSERT INTO public.wa_webhook_events (\n        meta_event_id,\n        business_id,\n        connection_id,\n        phone_number_id,\n        event_type,\n        payload,\n        is_processed\n    )\n    VALUES (\n        p_meta_message_id,\n        v_conn.business_id,\n        v_conn.id,\n        p_phone_number_id,\n        'message',\n        p_raw_payload,\n        FALSE\n    )\n    ON CONFLICT (meta_event_id)\n    DO UPDATE SET\n        business_id = EXCLUDED.business_id,\n        connection_id = EXCLUDED.connection_id,\n        payload = EXCLUDED.payload;\n\n    -- If connection does not exist or is disabled, log error and return\n    IF v_conn.id IS NULL THEN\n        UPDATE public.wa_webhook_events\n        SET processing_error = 'No registered WhatsApp connection for Phone Number ID: ' || p_phone_number_id\n        WHERE meta_event_id = p_meta_message_id;\n\n        RETURN jsonb_build_object(\n            'status', 'unregistered_phone',\n            'error', 'No connection registered for phone_number_id'\n        );\n    END IF;\n\n    IF v_conn.is_enabled IS NOT TRUE THEN\n        UPDATE public.wa_webhook_events\n        SET processing_error = 'WhatsApp connection is currently disabled: ' || v_conn.id::text\n        WHERE meta_event_id = p_meta_message_id;\n\n        RETURN jsonb_build_object(\n            'status', 'disabled_connection',\n            'error', 'WhatsApp connection is disabled'\n        );\n    END IF;\n\n    -- 4. Upsert Contact in wa_contacts (tenant isolated)\n    INSERT INTO public.wa_contacts (\n        business_id,\n        phone_number,\n        display_name,\n        last_inbound_at,\n        total_inbound_count,\n        updated_at\n    )\n    VALUES (\n        v_conn.business_id,\n        p_sender_phone,\n        p_sender_name,\n        v_now,\n        1,\n        v_now\n    )\n    ON CONFLICT (business_id, phone_number)\n    DO UPDATE SET\n        display_name = COALESCE(EXCLUDED.display_name, public.wa_contacts.display_name),\n        last_inbound_at = v_now,\n        total_inbound_count = public.wa_contacts.total_inbound_count + 1,\n        updated_at = v_now\n    RETURNING id INTO v_contact_id;\n\n    -- 5. Upsert Conversation thread in wa_conversations\n    INSERT INTO public.wa_conversations (\n        business_id,\n        connection_id,\n        contact_id,\n        status,\n        last_message_preview,\n        last_message_at,\n        updated_at\n    )\n    VALUES (\n        v_conn.business_id,\n        v_conn.id,\n        v_contact_id,\n        'open',\n        SUBSTRING(p_content FROM 1 FOR 200),\n        v_now,\n        v_now\n    )\n    ON CONFLICT (connection_id, contact_id)\n    DO UPDATE SET\n        last_message_preview = SUBSTRING(EXCLUDED.last_message_preview FROM 1 FOR 200),\n        last_message_at = v_now,\n        updated_at = v_now\n    RETURNING id INTO v_conversation_id;\n\n    -- 6. Insert Inbound Message in wa_messages\n    INSERT INTO public.wa_messages (\n        business_id,\n        connection_id,\n        conversation_id,\n        contact_id,\n        direction,\n        message_type,\n        content,\n        meta_message_id,\n        status,\n        delivered_at,\n        raw_payload\n    )\n    VALUES (\n        v_conn.business_id,\n        v_conn.id,\n        v_conversation_id,\n        v_contact_id,\n        'inbound',\n        COALESCE(p_message_type, 'text'),\n        p_content,\n        p_meta_message_id,\n        'delivered',\n        v_now,\n        p_raw_payload\n    )\n    ON CONFLICT (meta_message_id) DO NOTHING\n    RETURNING id INTO v_message_id;\n\n    -- If conflict occurred and row already existed, fetch existing message id\n    IF v_message_id IS NULL THEN\n        SELECT id INTO v_message_id\n        FROM public.wa_messages\n        WHERE meta_message_id = p_meta_message_id\n        LIMIT 1;\n    END IF;\n\n    -- 7. Atomically enqueue background job in wa_processing_jobs\n    INSERT INTO public.wa_processing_jobs (\n        business_id,\n        connection_id,\n        job_type,\n        payload,\n        idempotency_key,\n        scheduled_at,\n        status,\n        attempts,\n        max_attempts\n    )\n    VALUES (\n        v_conn.business_id,\n        v_conn.id,\n        'evaluate_automation_rules',\n        jsonb_build_object(\n            'business_id', v_conn.business_id,\n            'connection_id', v_conn.id,\n            'conversation_id', v_conversation_id,\n            'contact_id', v_contact_id,\n            'message_id', v_message_id,\n            'message_content', p_content,\n            'message_type', p_message_type,\n            'sender_phone', p_sender_phone,\n            'sender_name', p_sender_name,\n            'meta_message_id', p_meta_message_id\n        ),\n        'inbound_eval_' || p_meta_message_id,\n        v_now,\n        'pending',\n        0,\n        5\n    )\n    ON CONFLICT (idempotency_key) DO NOTHING\n    RETURNING id INTO v_job_id;\n\n    -- If job already existed due to concurrent call, fetch existing job id\n    IF v_job_id IS NULL THEN\n        SELECT id INTO v_job_id\n        FROM public.wa_processing_jobs\n        WHERE idempotency_key = 'inbound_eval_' || p_meta_message_id\n        LIMIT 1;\n    END IF;\n\n    -- 8. Update connection last_message_at\n    UPDATE public.wa_connections\n    SET last_message_at = v_now\n    WHERE id = v_conn.id;\n\n    -- 9. Mark Webhook Event as Processed\n    UPDATE public.wa_webhook_events\n    SET is_processed = TRUE,\n        processed_at = v_now\n    WHERE meta_event_id = p_meta_message_id;\n\n    RETURN jsonb_build_object(\n        'status', 'success',\n        'business_id', v_conn.business_id,\n        'connection_id', v_conn.id,\n        'conversation_id', v_conversation_id,\n        'contact_id', v_contact_id,\n        'message_id', v_message_id,\n        'job_id', v_job_id\n    );\nEND;\n$$;\n\nREVOKE ALL ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;\nREVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;\nREVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM authenticated;\nGRANT EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;\n\nCOMMENT ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) IS\n  'Atomically ingests inbound WhatsApp messages, contacts, conversations, and enqueues evaluation jobs in a single transaction. Restricted strictly to service_role.';"}	20261107_010_phase7_5_atomic_webhook_enqueue_rpc	ajaygokul99@gmail.com	\N	\N
20261107062145	{"REVOKE ALL ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) FROM PUBLIC;\nREVOKE EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) FROM anon;\nREVOKE EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) FROM authenticated;\nGRANT EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) TO service_role;\n\nREVOKE ALL ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) FROM PUBLIC;\nREVOKE EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) FROM anon;\nREVOKE EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) FROM authenticated;\nGRANT EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) TO service_role;\n\nCOMMENT ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) IS \n  'Claims next batch of pending processing jobs using FOR UPDATE SKIP LOCKED. Restricted to service_role.';\n\nCOMMENT ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) IS \n  'Reclaims abandoned processing jobs locked longer than timeout threshold. Restricted to service_role.';"}	20261107_011_phase7_5_queue_rpc_privilege_hardening	ajaygokul99@gmail.com	\N	\N
20261107073349	{"-- ==============================================================================\n-- GOKUL CONNECT — DATABASE MIGRATION 012: ATOMIC WEBHOOK RPC RECONCILIATION\n-- ==============================================================================\n-- Migration Identifier: 20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql\n-- Status: PREPARED FOR FORWARD-ONLY RECONCILIATION (NOT YET APPLIED TO LIVE)\n--\n-- PURPOSE:\n-- Formally establishes in Supabase migration history the partial unique-index\n-- conflict target predicate (WHERE idempotency_key IS NOT NULL) on wa_processing_jobs\n-- in public.ingest_wa_inbound_message_v2.\n--\n-- This forward-only migration reconciles the migration history discrepancy where\n-- Migration 010 was initially applied without the partial predicate and corrected\n-- in-place on the live database. Applying this migration guarantees deterministic\n-- replay across fresh, staging, and production environments via automated CI/CD.\n--\n-- AFFECTED OBJECTS:\n-- 1. Function: public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)\n--    - Preserves SECURITY DEFINER and SET search_path = public, pg_temp\n--    - Preserves ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING\n--    - Enforces REVOKE from PUBLIC, anon, authenticated\n--    - Grants EXECUTE strictly to service_role\n-- ==============================================================================\n\nCREATE OR REPLACE FUNCTION public.ingest_wa_inbound_message_v2(\n    p_phone_number_id TEXT,\n    p_meta_message_id TEXT,\n    p_sender_phone TEXT,\n    p_sender_name TEXT DEFAULT NULL,\n    p_message_type TEXT DEFAULT 'text',\n    p_content TEXT DEFAULT '',\n    p_raw_payload JSONB DEFAULT '{}'::jsonb\n)\nRETURNS JSONB\nLANGUAGE plpgsql\nSECURITY DEFINER\nSET search_path = public, pg_temp\nAS $$\nDECLARE\n    v_conn RECORD;\n    v_contact_id UUID;\n    v_conversation_id UUID;\n    v_message_id UUID;\n    v_job_id UUID;\n    v_event_processed BOOLEAN;\n    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());\nBEGIN\n    -- 1. Resolve registered connection for this phone_number_id\n    SELECT id, business_id, is_enabled\n    INTO v_conn\n    FROM public.wa_connections\n    WHERE phone_number_id = p_phone_number_id\n    LIMIT 1;\n\n    -- 2. Idempotency check: has this meta_message_id already been processed?\n    SELECT is_processed\n    INTO v_event_processed\n    FROM public.wa_webhook_events\n    WHERE meta_event_id = p_meta_message_id;\n\n    IF v_event_processed IS TRUE THEN\n        RETURN jsonb_build_object(\n            'status', 'duplicate',\n            'meta_message_id', p_meta_message_id,\n            'message', 'Webhook event already processed'\n        );\n    END IF;\n\n    -- 3. Record event in wa_webhook_events\n    INSERT INTO public.wa_webhook_events (\n        meta_event_id,\n        business_id,\n        connection_id,\n        phone_number_id,\n        event_type,\n        payload,\n        is_processed\n    )\n    VALUES (\n        p_meta_message_id,\n        v_conn.business_id,\n        v_conn.id,\n        p_phone_number_id,\n        'message',\n        p_raw_payload,\n        FALSE\n    )\n    ON CONFLICT (meta_event_id)\n    DO UPDATE SET\n        business_id = EXCLUDED.business_id,\n        connection_id = EXCLUDED.connection_id,\n        payload = EXCLUDED.payload;\n\n    -- If connection does not exist or is disabled, log error and return\n    IF v_conn.id IS NULL THEN\n        UPDATE public.wa_webhook_events\n        SET processing_error = 'No registered WhatsApp connection for Phone Number ID: ' || p_phone_number_id\n        WHERE meta_event_id = p_meta_message_id;\n\n        RETURN jsonb_build_object(\n            'status', 'unregistered_phone',\n            'error', 'No connection registered for phone_number_id'\n        );\n    END IF;\n\n    IF v_conn.is_enabled IS NOT TRUE THEN\n        UPDATE public.wa_webhook_events\n        SET processing_error = 'WhatsApp connection is currently disabled: ' || v_conn.id::text\n        WHERE meta_event_id = p_meta_message_id;\n\n        RETURN jsonb_build_object(\n            'status', 'disabled_connection',\n            'error', 'WhatsApp connection is disabled'\n        );\n    END IF;\n\n    -- 4. Upsert Contact in wa_contacts (tenant isolated)\n    INSERT INTO public.wa_contacts (\n        business_id,\n        phone_number,\n        display_name,\n        last_inbound_at,\n        total_inbound_count,\n        updated_at\n    )\n    VALUES (\n        v_conn.business_id,\n        p_sender_phone,\n        p_sender_name,\n        v_now,\n        1,\n        v_now\n    )\n    ON CONFLICT (business_id, phone_number)\n    DO UPDATE SET\n        display_name = COALESCE(EXCLUDED.display_name, public.wa_contacts.display_name),\n        last_inbound_at = v_now,\n        total_inbound_count = public.wa_contacts.total_inbound_count + 1,\n        updated_at = v_now\n    RETURNING id INTO v_contact_id;\n\n    -- 5. Upsert Conversation thread in wa_conversations\n    INSERT INTO public.wa_conversations (\n        business_id,\n        connection_id,\n        contact_id,\n        status,\n        last_message_preview,\n        last_message_at,\n        updated_at\n    )\n    VALUES (\n        v_conn.business_id,\n        v_conn.id,\n        v_contact_id,\n        'open',\n        SUBSTRING(p_content FROM 1 FOR 200),\n        v_now,\n        v_now\n    )\n    ON CONFLICT (connection_id, contact_id)\n    DO UPDATE SET\n        last_message_preview = SUBSTRING(EXCLUDED.last_message_preview FROM 1 FOR 200),\n        last_message_at = v_now,\n        updated_at = v_now\n    RETURNING id INTO v_conversation_id;\n\n    -- 6. Insert Inbound Message in wa_messages\n    INSERT INTO public.wa_messages (\n        business_id,\n        connection_id,\n        conversation_id,\n        contact_id,\n        direction,\n        message_type,\n        content,\n        meta_message_id,\n        status,\n        delivered_at,\n        raw_payload\n    )\n    VALUES (\n        v_conn.business_id,\n        v_conn.id,\n        v_conversation_id,\n        v_contact_id,\n        'inbound',\n        COALESCE(p_message_type, 'text'),\n        p_content,\n        p_meta_message_id,\n        'delivered',\n        v_now,\n        p_raw_payload\n    )\n    ON CONFLICT (meta_message_id) DO NOTHING\n    RETURNING id INTO v_message_id;\n\n    -- If conflict occurred and row already existed, fetch existing message id\n    IF v_message_id IS NULL THEN\n        SELECT id INTO v_message_id\n        FROM public.wa_messages\n        WHERE meta_message_id = p_meta_message_id\n        LIMIT 1;\n    END IF;\n\n    -- 7. Atomically enqueue background job in wa_processing_jobs\n    INSERT INTO public.wa_processing_jobs (\n        business_id,\n        connection_id,\n        job_type,\n        payload,\n        idempotency_key,\n        scheduled_at,\n        status,\n        attempts,\n        max_attempts\n    )\n    VALUES (\n        v_conn.business_id,\n        v_conn.id,\n        'evaluate_automation_rules',\n        jsonb_build_object(\n            'business_id', v_conn.business_id,\n            'connection_id', v_conn.id,\n            'conversation_id', v_conversation_id,\n            'contact_id', v_contact_id,\n            'message_id', v_message_id,\n            'message_content', p_content,\n            'message_type', p_message_type,\n            'sender_phone', p_sender_phone,\n            'sender_name', p_sender_name,\n            'meta_message_id', p_meta_message_id\n        ),\n        'inbound_eval_' || p_meta_message_id,\n        v_now,\n        'pending',\n        0,\n        5\n    )\n    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING\n    RETURNING id INTO v_job_id;\n\n    -- If job already existed due to concurrent call, fetch existing job id\n    IF v_job_id IS NULL THEN\n        SELECT id INTO v_job_id\n        FROM public.wa_processing_jobs\n        WHERE idempotency_key = 'inbound_eval_' || p_meta_message_id\n        LIMIT 1;\n    END IF;\n\n    -- 8. Update connection last_message_at\n    UPDATE public.wa_connections\n    SET last_message_at = v_now\n    WHERE id = v_conn.id;\n\n    -- 9. Mark Webhook Event as Processed\n    UPDATE public.wa_webhook_events\n    SET is_processed = TRUE,\n        processed_at = v_now\n    WHERE meta_event_id = p_meta_message_id;\n\n    RETURN jsonb_build_object(\n        'status', 'success',\n        'business_id', v_conn.business_id,\n        'connection_id', v_conn.id,\n        'conversation_id', v_conversation_id,\n        'contact_id', v_contact_id,\n        'message_id', v_message_id,\n        'job_id', v_job_id\n    );\nEND;\n$$;\n\n-- ==============================================================================\n-- PRIVILEGE HARDENING & LEAST PRIVILEGE GRANTS\n-- ==============================================================================\n-- 1. Revoke default EXECUTE privileges from PUBLIC pseudo-role\nREVOKE ALL ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;\n\n-- 2. Explicitly revoke EXECUTE from untrusted client roles (anon and authenticated)\nREVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;\nREVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM authenticated;\n\n-- 3. Grant EXECUTE strictly to the service_role (used by server-side webhook handler)\nGRANT EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;\n\n-- 4. Documentation & Verification Comment\nCOMMENT ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) IS\n  'Atomically ingests inbound WhatsApp messages, contacts, conversations, and enqueues evaluation jobs in a single transaction. Restricted strictly to service_role.';\n"}	20261107_012_phase7_5_atomic_rpc_partial_index_fix	ajaygokul99@gmail.com	\N	\N
20261107123400	\N	20261107_013_phase9_crm_and_contacts	ajaygokul99@gmail.com	\N	\N
20261107123600	\N	20261107_014_phase10_analytics_rpcs	ajaygokul99@gmail.com	\N	\N
20261107132600	\N	20261107_015_phase11_template_management	ajaygokul99@gmail.com	\N	\N
\.


--
-- Data for Name: secrets; Type: TABLE DATA; Schema: vault; Owner: supabase_admin
--

COPY vault.secrets (id, name, description, secret, key_id, nonce, created_at, updated_at) FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 368, true);


--
-- Name: subscription_id_seq; Type: SEQUENCE SET; Schema: realtime; Owner: supabase_realtime_admin
--

SELECT pg_catalog.setval('realtime.subscription_id_seq', 1, false);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_mfa_factor_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_mfa_factor_id_key UNIQUE (mfa_factor_id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_pkey PRIMARY KEY (id);


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_user_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_user_id_key UNIQUE (user_id);


--
-- Name: mfa_recovery_codes mfa_recovery_codes_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: scim_tokens scim_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.scim_tokens
    ADD CONSTRAINT scim_tokens_pkey PRIMARY KEY (id);


--
-- Name: scim_users scim_users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: business_members business_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_members
    ADD CONSTRAINT business_members_pkey PRIMARY KEY (id);


--
-- Name: business_settings business_settings_business_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT business_settings_business_id_key UNIQUE (business_id);


--
-- Name: business_settings business_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT business_settings_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_name_key UNIQUE (name);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_slug_key UNIQUE (slug);


--
-- Name: contact_activity_logs contact_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_activity_logs
    ADD CONSTRAINT contact_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: contact_notes contact_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT contact_notes_pkey PRIMARY KEY (id);


--
-- Name: crm_categories crm_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_categories
    ADD CONSTRAINT crm_categories_pkey PRIMARY KEY (id);


--
-- Name: crm_segments crm_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_segments
    ADD CONSTRAINT crm_segments_pkey PRIMARY KEY (id);


--
-- Name: business_members uq_business_user; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_members
    ADD CONSTRAINT uq_business_user UNIQUE (business_id, user_id);


--
-- Name: contact_activity_logs uq_contact_activity_logs_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_activity_logs
    ADD CONSTRAINT uq_contact_activity_logs_id_business UNIQUE (id, business_id);


--
-- Name: contact_notes uq_contact_notes_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT uq_contact_notes_id_business UNIQUE (id, business_id);


--
-- Name: crm_categories uq_crm_categories_biz_slug; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_categories
    ADD CONSTRAINT uq_crm_categories_biz_slug UNIQUE (business_id, slug);


--
-- Name: crm_categories uq_crm_categories_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_categories
    ADD CONSTRAINT uq_crm_categories_id_business UNIQUE (id, business_id);


--
-- Name: crm_segments uq_crm_segments_biz_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_segments
    ADD CONSTRAINT uq_crm_segments_biz_name UNIQUE (business_id, name);


--
-- Name: crm_segments uq_crm_segments_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_segments
    ADD CONSTRAINT uq_crm_segments_id_business UNIQUE (id, business_id);


--
-- Name: wa_automation_execution_logs uq_rule_exec_single_trigger; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT uq_rule_exec_single_trigger UNIQUE (business_id, rule_id, inbound_message_id);


--
-- Name: wa_automation_rules uq_wa_automation_rules_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_rules
    ADD CONSTRAINT uq_wa_automation_rules_id_business UNIQUE (id, business_id);


--
-- Name: wa_connections uq_wa_connections_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_connections
    ADD CONSTRAINT uq_wa_connections_id_business UNIQUE (id, business_id);


--
-- Name: wa_contacts uq_wa_contacts_business_phone; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_contacts
    ADD CONSTRAINT uq_wa_contacts_business_phone UNIQUE (business_id, phone_number);


--
-- Name: wa_contacts uq_wa_contacts_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_contacts
    ADD CONSTRAINT uq_wa_contacts_id_business UNIQUE (id, business_id);


--
-- Name: wa_conversations uq_wa_conversations_connection_contact; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_conversations
    ADD CONSTRAINT uq_wa_conversations_connection_contact UNIQUE (connection_id, contact_id);


--
-- Name: wa_conversations uq_wa_conversations_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_conversations
    ADD CONSTRAINT uq_wa_conversations_id_business UNIQUE (id, business_id);


--
-- Name: wa_credentials uq_wa_credentials_connection; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_credentials
    ADD CONSTRAINT uq_wa_credentials_connection UNIQUE (connection_id);


--
-- Name: wa_message_templates uq_wa_message_templates_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_message_templates
    ADD CONSTRAINT uq_wa_message_templates_id_business UNIQUE (id, business_id);


--
-- Name: wa_message_templates uq_wa_message_templates_name_lang; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_message_templates
    ADD CONSTRAINT uq_wa_message_templates_name_lang UNIQUE (business_id, template_name, language);


--
-- Name: wa_rule_actions uq_wa_rule_actions_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_rule_actions
    ADD CONSTRAINT uq_wa_rule_actions_id_business UNIQUE (id, business_id);


--
-- Name: wa_rule_conditions uq_wa_rule_conditions_id_business; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_rule_conditions
    ADD CONSTRAINT uq_wa_rule_conditions_id_business UNIQUE (id, business_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: wa_automation_execution_logs wa_automation_execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT wa_automation_execution_logs_pkey PRIMARY KEY (id);


--
-- Name: wa_automation_rules wa_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_rules
    ADD CONSTRAINT wa_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: wa_connections wa_connections_phone_number_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_connections
    ADD CONSTRAINT wa_connections_phone_number_id_key UNIQUE (phone_number_id);


--
-- Name: wa_connections wa_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_connections
    ADD CONSTRAINT wa_connections_pkey PRIMARY KEY (id);


--
-- Name: wa_contacts wa_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_contacts
    ADD CONSTRAINT wa_contacts_pkey PRIMARY KEY (id);


--
-- Name: wa_conversations wa_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_conversations
    ADD CONSTRAINT wa_conversations_pkey PRIMARY KEY (id);


--
-- Name: wa_credentials wa_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_credentials
    ADD CONSTRAINT wa_credentials_pkey PRIMARY KEY (id);


--
-- Name: wa_message_templates wa_message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_message_templates
    ADD CONSTRAINT wa_message_templates_pkey PRIMARY KEY (id);


--
-- Name: wa_messages wa_messages_meta_message_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT wa_messages_meta_message_id_key UNIQUE (meta_message_id);


--
-- Name: wa_messages wa_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT wa_messages_pkey PRIMARY KEY (id);


--
-- Name: wa_processing_jobs wa_processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_processing_jobs
    ADD CONSTRAINT wa_processing_jobs_pkey PRIMARY KEY (id);


--
-- Name: wa_rule_actions wa_rule_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_rule_actions
    ADD CONSTRAINT wa_rule_actions_pkey PRIMARY KEY (id);


--
-- Name: wa_rule_conditions wa_rule_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_rule_conditions
    ADD CONSTRAINT wa_rule_conditions_pkey PRIMARY KEY (id);


--
-- Name: wa_webhook_events wa_webhook_events_meta_event_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_webhook_events
    ADD CONSTRAINT wa_webhook_events_meta_event_id_key UNIQUE (meta_event_id);


--
-- Name: wa_webhook_events wa_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_webhook_events
    ADD CONSTRAINT wa_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: messages messages_payload_exclusive; Type: CHECK CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages
    ADD CONSTRAINT messages_payload_exclusive CHECK (((payload IS NULL) OR (binary_payload IS NULL))) NOT VALID;


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: supabase_admin
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: bucket_lifecycle_states bucket_lifecycle_states_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.bucket_lifecycle_states
    ADD CONSTRAINT bucket_lifecycle_states_pkey PRIMARY KEY (bucket_id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: lifecycle_abandoned_artifacts lifecycle_abandoned_artifacts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.lifecycle_abandoned_artifacts
    ADD CONSTRAINT lifecycle_abandoned_artifacts_pkey PRIMARY KEY (bucket_id, key);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: postgres
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: idx_users_created_at_desc; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_users_created_at_desc ON auth.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_users_email ON auth.users USING btree (email);


--
-- Name: idx_users_last_sign_in_at_desc; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_users_last_sign_in_at_desc ON auth.users USING btree (last_sign_in_at DESC);


--
-- Name: idx_users_name; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_users_name ON auth.users USING btree (((raw_user_meta_data ->> 'name'::text))) WHERE ((raw_user_meta_data ->> 'name'::text) IS NOT NULL);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: mfa_recovery_codes_set_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_recovery_codes_set_id_idx ON auth.mfa_recovery_codes USING btree (mfa_recovery_code_set_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: scim_tokens_expires_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_tokens_expires_at_idx ON auth.scim_tokens USING btree (expires_at);


--
-- Name: scim_tokens_revoked_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_tokens_revoked_at_idx ON auth.scim_tokens USING btree (revoked_at);


--
-- Name: scim_tokens_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_tokens_sso_provider_id_idx ON auth.scim_tokens USING btree (sso_provider_id);


--
-- Name: scim_tokens_token_hash_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX scim_tokens_token_hash_key ON auth.scim_tokens USING btree (token_hash);


--
-- Name: scim_users_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_users_created_at_idx ON auth.scim_users USING btree (sso_provider_id, created_at, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_users_deleted_at_idx ON auth.scim_users USING btree (deleted_at);


--
-- Name: scim_users_external_id_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX scim_users_external_id_key ON auth.scim_users USING btree (sso_provider_id, external_id) WHERE ((external_id IS NOT NULL) AND (deleted_at IS NULL));


--
-- Name: scim_users_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_users_id_idx ON auth.scim_users USING btree (sso_provider_id, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_users_sso_provider_id_idx ON auth.scim_users USING btree (sso_provider_id);


--
-- Name: scim_users_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_users_updated_at_idx ON auth.scim_users USING btree (sso_provider_id, updated_at, id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_users_user_id_idx ON auth.scim_users USING btree (user_id);


--
-- Name: scim_users_user_name_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX scim_users_user_name_idx ON auth.scim_users USING btree (sso_provider_id, user_name COLLATE "C", id) WHERE (deleted_at IS NULL);


--
-- Name: scim_users_user_name_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX scim_users_user_name_key ON auth.scim_users USING btree (sso_provider_id, user_name) WHERE (deleted_at IS NULL);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: idx_business_members_business; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_business_members_business ON public.business_members USING btree (business_id);


--
-- Name: idx_business_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_business_members_user ON public.business_members USING btree (user_id);


--
-- Name: idx_business_settings_default_conn; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_business_settings_default_conn ON public.business_settings USING btree (default_connection_id, business_id);


--
-- Name: idx_businesses_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_businesses_slug ON public.businesses USING btree (slug);


--
-- Name: idx_contact_activity_logs_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_activity_logs_contact ON public.contact_activity_logs USING btree (business_id, contact_id, created_at DESC);


--
-- Name: idx_contact_notes_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contact_notes_contact ON public.contact_notes USING btree (business_id, contact_id, created_at DESC);


--
-- Name: idx_crm_categories_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_categories_business_id ON public.crm_categories USING btree (business_id, sort_order);


--
-- Name: idx_crm_segments_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_segments_business_id ON public.crm_segments USING btree (business_id);


--
-- Name: idx_wa_automation_rules_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_automation_rules_lookup ON public.wa_automation_rules USING btree (business_id, is_active, priority);


--
-- Name: idx_wa_connections_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_connections_business_id ON public.wa_connections USING btree (business_id);


--
-- Name: idx_wa_connections_phone_number_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_connections_phone_number_id ON public.wa_connections USING btree (phone_number_id);


--
-- Name: idx_wa_connections_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_connections_status ON public.wa_connections USING btree (business_id, connection_status);


--
-- Name: idx_wa_contacts_analytics; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_analytics ON public.wa_contacts USING btree (business_id, created_at DESC);


--
-- Name: idx_wa_contacts_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_archived ON public.wa_contacts USING btree (business_id, is_archived);


--
-- Name: idx_wa_contacts_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_business_id ON public.wa_contacts USING btree (business_id);


--
-- Name: idx_wa_contacts_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_category ON public.wa_contacts USING btree (business_id, category);


--
-- Name: idx_wa_contacts_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_email ON public.wa_contacts USING btree (business_id, email);


--
-- Name: idx_wa_contacts_opt_out; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_opt_out ON public.wa_contacts USING btree (business_id, is_opted_out);


--
-- Name: idx_wa_contacts_phone_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_phone_number ON public.wa_contacts USING btree (business_id, phone_number);


--
-- Name: idx_wa_contacts_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_source ON public.wa_contacts USING btree (business_id, source);


--
-- Name: idx_wa_contacts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_status ON public.wa_contacts USING btree (business_id, status);


--
-- Name: idx_wa_contacts_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_contacts_tags ON public.wa_contacts USING gin (tags);


--
-- Name: idx_wa_conversations_analytics; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_conversations_analytics ON public.wa_conversations USING btree (business_id, status, created_at DESC);


--
-- Name: idx_wa_conversations_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_conversations_business_id ON public.wa_conversations USING btree (business_id);


--
-- Name: idx_wa_conversations_conn_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_conversations_conn_tenant ON public.wa_conversations USING btree (connection_id, business_id);


--
-- Name: idx_wa_conversations_connection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_conversations_connection_id ON public.wa_conversations USING btree (connection_id);


--
-- Name: idx_wa_conversations_contact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_conversations_contact_id ON public.wa_conversations USING btree (contact_id);


--
-- Name: idx_wa_conversations_contact_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_conversations_contact_tenant ON public.wa_conversations USING btree (contact_id, business_id);


--
-- Name: idx_wa_conversations_last_message; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_conversations_last_message ON public.wa_conversations USING btree (business_id, last_message_at DESC);


--
-- Name: idx_wa_credentials_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_credentials_business_id ON public.wa_credentials USING btree (business_id);


--
-- Name: idx_wa_credentials_connection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_credentials_connection_id ON public.wa_credentials USING btree (connection_id);


--
-- Name: idx_wa_exec_logs_analytics; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_exec_logs_analytics ON public.wa_automation_execution_logs USING btree (business_id, status, created_at DESC);


--
-- Name: idx_wa_exec_logs_business; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_exec_logs_business ON public.wa_automation_execution_logs USING btree (business_id, created_at DESC);


--
-- Name: idx_wa_exec_logs_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_exec_logs_contact ON public.wa_automation_execution_logs USING btree (business_id, contact_id, created_at DESC);


--
-- Name: idx_wa_exec_logs_rule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_exec_logs_rule ON public.wa_automation_execution_logs USING btree (business_id, rule_id, created_at DESC);


--
-- Name: idx_wa_message_templates_archived; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_message_templates_archived ON public.wa_message_templates USING btree (business_id, is_archived);


--
-- Name: idx_wa_message_templates_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_message_templates_business_id ON public.wa_message_templates USING btree (business_id);


--
-- Name: idx_wa_message_templates_business_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_message_templates_business_status ON public.wa_message_templates USING btree (business_id, status);


--
-- Name: idx_wa_message_templates_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_message_templates_category ON public.wa_message_templates USING btree (business_id, category);


--
-- Name: idx_wa_message_templates_conn_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_message_templates_conn_tenant ON public.wa_message_templates USING btree (connection_id, business_id);


--
-- Name: idx_wa_message_templates_connection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_message_templates_connection_id ON public.wa_message_templates USING btree (connection_id);


--
-- Name: idx_wa_message_templates_meta_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_message_templates_meta_id ON public.wa_message_templates USING btree (business_id, meta_template_id);


--
-- Name: idx_wa_messages_analytics; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_analytics ON public.wa_messages USING btree (business_id, created_at DESC, direction, status);


--
-- Name: idx_wa_messages_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_business_id ON public.wa_messages USING btree (business_id);


--
-- Name: idx_wa_messages_conn_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_conn_tenant ON public.wa_messages USING btree (connection_id, business_id);


--
-- Name: idx_wa_messages_connection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_connection_id ON public.wa_messages USING btree (connection_id);


--
-- Name: idx_wa_messages_contact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_contact_id ON public.wa_messages USING btree (contact_id);


--
-- Name: idx_wa_messages_contact_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_contact_tenant ON public.wa_messages USING btree (contact_id, business_id);


--
-- Name: idx_wa_messages_conv_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_conv_tenant ON public.wa_messages USING btree (conversation_id, business_id);


--
-- Name: idx_wa_messages_conversation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_conversation_id ON public.wa_messages USING btree (conversation_id, created_at);


--
-- Name: idx_wa_messages_meta_message_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_meta_message_id ON public.wa_messages USING btree (meta_message_id);


--
-- Name: idx_wa_messages_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_messages_status ON public.wa_messages USING btree (status);


--
-- Name: idx_wa_processing_jobs_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_processing_jobs_business_id ON public.wa_processing_jobs USING btree (business_id);


--
-- Name: idx_wa_processing_jobs_claim; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_processing_jobs_claim ON public.wa_processing_jobs USING btree (status, scheduled_at) WHERE (status = 'pending'::text);


--
-- Name: idx_wa_processing_jobs_connection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_processing_jobs_connection_id ON public.wa_processing_jobs USING btree (connection_id);


--
-- Name: idx_wa_processing_jobs_queue; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_processing_jobs_queue ON public.wa_processing_jobs USING btree (status, scheduled_at);


--
-- Name: idx_wa_rule_actions_rule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_rule_actions_rule_id ON public.wa_rule_actions USING btree (business_id, rule_id, order_index);


--
-- Name: idx_wa_rule_conditions_rule_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_rule_conditions_rule_id ON public.wa_rule_conditions USING btree (business_id, rule_id, order_index);


--
-- Name: idx_wa_webhook_events_business_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_webhook_events_business_id ON public.wa_webhook_events USING btree (business_id);


--
-- Name: idx_wa_webhook_events_connection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_webhook_events_connection_id ON public.wa_webhook_events USING btree (connection_id);


--
-- Name: idx_wa_webhook_events_event_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_webhook_events_event_id ON public.wa_webhook_events USING btree (meta_event_id);


--
-- Name: idx_wa_webhook_events_phone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_webhook_events_phone_id ON public.wa_webhook_events USING btree (phone_number_id);


--
-- Name: idx_wa_webhook_events_processed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wa_webhook_events_processed ON public.wa_webhook_events USING btree (is_processed, created_at);


--
-- Name: uq_wa_processing_jobs_idempotency; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_wa_processing_jobs_idempotency ON public.wa_processing_jobs USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_replay_index; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE INDEX messages_replay_index ON ONLY realtime.messages USING btree (topic, inserted_at DESC, COALESCE(expires_at, 'infinity'::timestamp without time zone)) WHERE ((extension = 'broadcast'::text) AND (private = true));


--
-- Name: subscription_subscription_id_entity_filters_hash_key; Type: INDEX; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_hash_key ON realtime.subscription USING btree (subscription_id, entity, realtime.filters_hash(filters), action_filter, COALESCE(selected_columns, '{}'::text[]));


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucket_lifecycle_states_due_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX bucket_lifecycle_states_due_idx ON storage.bucket_lifecycle_states USING btree (next_run_at, bucket_id) WHERE (next_run_at IS NOT NULL);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: idx_objects_current_version; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX idx_objects_current_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (archived_at IS NULL);


--
-- Name: idx_objects_delete_markers; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX idx_objects_delete_markers ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE is_delete_marker;


--
-- Name: idx_objects_null_version; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX idx_objects_null_version ON storage.objects USING btree (bucket_id, name COLLATE "C") WHERE (NOT is_versioned);


--
-- Name: lifecycle_abandoned_artifacts_attempted_at_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX lifecycle_abandoned_artifacts_attempted_at_idx ON storage.lifecycle_abandoned_artifacts USING btree (attempted_at);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_archived_due_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE INDEX objects_archived_due_idx ON storage.objects USING btree (bucket_id, archived_at, name COLLATE "C") INCLUDE (id, version, is_delete_marker) WHERE (archived_at IS NOT NULL);


--
-- Name: objects_archived_order_uq; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX objects_archived_order_uq ON storage.objects USING btree (bucket_id, name COLLATE "C", archived_at) WHERE (archived_at IS NOT NULL);


--
-- Name: objects_bucket_id_name_version_key; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX objects_bucket_id_name_version_key ON storage.objects USING btree (bucket_id, name COLLATE "C", version) NULLS NOT DISTINCT;


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: supabase_storage_admin
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: supabase_auth_admin
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: business_members trg_business_members_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_business_members_immutable_business_id BEFORE UPDATE ON public.business_members FOR EACH ROW EXECUTE FUNCTION public.prevent_business_member_tenant_reassignment();


--
-- Name: business_settings trg_business_settings_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_business_settings_immutable_business_id BEFORE UPDATE ON public.business_settings FOR EACH ROW EXECUTE FUNCTION public.prevent_business_settings_tenant_reassignment();


--
-- Name: contact_activity_logs trg_contact_activity_logs_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_contact_activity_logs_immutable_business_id BEFORE UPDATE ON public.contact_activity_logs FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: contact_notes trg_contact_notes_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_contact_notes_immutable_business_id BEFORE UPDATE ON public.contact_notes FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: crm_categories trg_crm_categories_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_crm_categories_immutable_business_id BEFORE UPDATE ON public.crm_categories FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: crm_segments trg_crm_segments_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_crm_segments_immutable_business_id BEFORE UPDATE ON public.crm_segments FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: user_profiles trg_user_profiles_privilege_escalation; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_user_profiles_privilege_escalation BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_user_profile_privilege_escalation();


--
-- Name: wa_automation_rules trg_wa_automation_rules_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_automation_rules_immutable_business_id BEFORE UPDATE ON public.wa_automation_rules FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: wa_connections trg_wa_connections_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_connections_immutable_business_id BEFORE UPDATE ON public.wa_connections FOR EACH ROW EXECUTE FUNCTION public.prevent_wa_connection_tenant_reassignment();


--
-- Name: wa_contacts trg_wa_contacts_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_contacts_immutable_business_id BEFORE UPDATE ON public.wa_contacts FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: wa_conversations trg_wa_conversations_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_conversations_immutable_business_id BEFORE UPDATE ON public.wa_conversations FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: wa_message_templates trg_wa_message_templates_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_message_templates_immutable_business_id BEFORE UPDATE ON public.wa_message_templates FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: wa_messages trg_wa_messages_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_messages_immutable_business_id BEFORE UPDATE ON public.wa_messages FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: wa_processing_jobs trg_wa_processing_jobs_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_processing_jobs_immutable_business_id BEFORE UPDATE ON public.wa_processing_jobs FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: wa_rule_actions trg_wa_rule_actions_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_rule_actions_immutable_business_id BEFORE UPDATE ON public.wa_rule_actions FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: wa_rule_conditions trg_wa_rule_conditions_immutable_business_id; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_wa_rule_conditions_immutable_business_id BEFORE UPDATE ON public.wa_rule_conditions FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();


--
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: supabase_realtime_admin
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets enforce_versioning_status_transition; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER enforce_versioning_status_transition BEFORE UPDATE OF versioning_status ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_versioning_status_transition();


--
-- Name: buckets protect_active_lifecycle_states; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_active_lifecycle_states BEFORE DELETE ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_active_lifecycle_states();


--
-- Name: buckets protect_bucket_control_insert; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');


--
-- Name: buckets protect_bucket_control_update; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();


--
-- Name: buckets protect_bucket_control_update_role; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: buckets wake_lifecycle_on_policy_write; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER wake_lifecycle_on_policy_write AFTER INSERT OR UPDATE OF lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.wake_lifecycle_state();


--
-- Name: buckets wake_lifecycle_on_versioning_enable; Type: TRIGGER; Schema: storage; Owner: supabase_storage_admin
--

CREATE TRIGGER wake_lifecycle_on_versioning_enable AFTER UPDATE OF versioning_status ON storage.buckets FOR EACH ROW WHEN ((new.lifecycle_configuration IS NOT NULL)) EXECUTE FUNCTION storage.wake_lifecycle_state();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_mfa_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_mfa_factor_id_fkey FOREIGN KEY (mfa_factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_code_sets mfa_recovery_code_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_recovery_code_sets
    ADD CONSTRAINT mfa_recovery_code_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_recovery_codes mfa_recovery_codes_mfa_recovery_code_set_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_recovery_codes
    ADD CONSTRAINT mfa_recovery_codes_mfa_recovery_code_set_id_fkey FOREIGN KEY (mfa_recovery_code_set_id) REFERENCES auth.mfa_recovery_code_sets(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_tokens scim_tokens_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.scim_tokens
    ADD CONSTRAINT scim_tokens_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_users scim_users_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: scim_users scim_users_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.scim_users
    ADD CONSTRAINT scim_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: business_members business_members_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_members
    ADD CONSTRAINT business_members_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_members business_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_members
    ADD CONSTRAINT business_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: business_settings business_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT business_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: contact_activity_logs contact_activity_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_activity_logs
    ADD CONSTRAINT contact_activity_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: contact_activity_logs contact_activity_logs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_activity_logs
    ADD CONSTRAINT contact_activity_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: contact_notes contact_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT contact_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: contact_notes contact_notes_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT contact_notes_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: crm_categories crm_categories_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_categories
    ADD CONSTRAINT crm_categories_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: crm_segments crm_segments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_segments
    ADD CONSTRAINT crm_segments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: crm_segments crm_segments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_segments
    ADD CONSTRAINT crm_segments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: business_settings fk_business_settings_default_connection; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_settings
    ADD CONSTRAINT fk_business_settings_default_connection FOREIGN KEY (default_connection_id, business_id) REFERENCES public.wa_connections(id, business_id) ON DELETE SET NULL (default_connection_id);


--
-- Name: contact_activity_logs fk_contact_activity_logs_contact_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_activity_logs
    ADD CONSTRAINT fk_contact_activity_logs_contact_tenant FOREIGN KEY (contact_id, business_id) REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE;


--
-- Name: contact_notes fk_contact_notes_contact_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_notes
    ADD CONSTRAINT fk_contact_notes_contact_tenant FOREIGN KEY (contact_id, business_id) REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_conversations fk_wa_conversations_connection_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_conversations
    ADD CONSTRAINT fk_wa_conversations_connection_tenant FOREIGN KEY (connection_id, business_id) REFERENCES public.wa_connections(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_conversations fk_wa_conversations_contact_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_conversations
    ADD CONSTRAINT fk_wa_conversations_contact_tenant FOREIGN KEY (contact_id, business_id) REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_automation_execution_logs fk_wa_exec_logs_contact_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT fk_wa_exec_logs_contact_tenant FOREIGN KEY (contact_id, business_id) REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_automation_execution_logs fk_wa_exec_logs_conversation_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT fk_wa_exec_logs_conversation_tenant FOREIGN KEY (conversation_id, business_id) REFERENCES public.wa_conversations(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_message_templates fk_wa_message_templates_connection_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_message_templates
    ADD CONSTRAINT fk_wa_message_templates_connection_tenant FOREIGN KEY (connection_id, business_id) REFERENCES public.wa_connections(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_messages fk_wa_messages_connection_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT fk_wa_messages_connection_tenant FOREIGN KEY (connection_id, business_id) REFERENCES public.wa_connections(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_messages fk_wa_messages_contact_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT fk_wa_messages_contact_tenant FOREIGN KEY (contact_id, business_id) REFERENCES public.wa_contacts(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_messages fk_wa_messages_conversation_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT fk_wa_messages_conversation_tenant FOREIGN KEY (conversation_id, business_id) REFERENCES public.wa_conversations(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_rule_actions fk_wa_rule_actions_rule_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_rule_actions
    ADD CONSTRAINT fk_wa_rule_actions_rule_tenant FOREIGN KEY (rule_id, business_id) REFERENCES public.wa_automation_rules(id, business_id) ON DELETE CASCADE;


--
-- Name: wa_rule_conditions fk_wa_rule_conditions_rule_tenant; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_rule_conditions
    ADD CONSTRAINT fk_wa_rule_conditions_rule_tenant FOREIGN KEY (rule_id, business_id) REFERENCES public.wa_automation_rules(id, business_id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: wa_automation_execution_logs wa_automation_execution_logs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT wa_automation_execution_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_automation_execution_logs wa_automation_execution_logs_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT wa_automation_execution_logs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.wa_connections(id) ON DELETE CASCADE;


--
-- Name: wa_automation_execution_logs wa_automation_execution_logs_inbound_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT wa_automation_execution_logs_inbound_message_id_fkey FOREIGN KEY (inbound_message_id) REFERENCES public.wa_messages(id) ON DELETE SET NULL;


--
-- Name: wa_automation_execution_logs wa_automation_execution_logs_outbound_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT wa_automation_execution_logs_outbound_message_id_fkey FOREIGN KEY (outbound_message_id) REFERENCES public.wa_messages(id) ON DELETE SET NULL;


--
-- Name: wa_automation_execution_logs wa_automation_execution_logs_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_execution_logs
    ADD CONSTRAINT wa_automation_execution_logs_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.wa_automation_rules(id) ON DELETE SET NULL;


--
-- Name: wa_automation_rules wa_automation_rules_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_rules
    ADD CONSTRAINT wa_automation_rules_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_automation_rules wa_automation_rules_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_automation_rules
    ADD CONSTRAINT wa_automation_rules_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.wa_connections(id) ON DELETE CASCADE;


--
-- Name: wa_connections wa_connections_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_connections
    ADD CONSTRAINT wa_connections_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_contacts wa_contacts_assigned_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_contacts
    ADD CONSTRAINT wa_contacts_assigned_agent_id_fkey FOREIGN KEY (assigned_agent_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: wa_contacts wa_contacts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_contacts
    ADD CONSTRAINT wa_contacts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_conversations wa_conversations_automation_paused_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_conversations
    ADD CONSTRAINT wa_conversations_automation_paused_by_fkey FOREIGN KEY (automation_paused_by) REFERENCES public.user_profiles(id);


--
-- Name: wa_conversations wa_conversations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_conversations
    ADD CONSTRAINT wa_conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_credentials wa_credentials_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_credentials
    ADD CONSTRAINT wa_credentials_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_credentials wa_credentials_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_credentials
    ADD CONSTRAINT wa_credentials_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.wa_connections(id) ON DELETE CASCADE;


--
-- Name: wa_message_templates wa_message_templates_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_message_templates
    ADD CONSTRAINT wa_message_templates_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_messages wa_messages_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_messages
    ADD CONSTRAINT wa_messages_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_processing_jobs wa_processing_jobs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_processing_jobs
    ADD CONSTRAINT wa_processing_jobs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_processing_jobs wa_processing_jobs_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_processing_jobs
    ADD CONSTRAINT wa_processing_jobs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.wa_connections(id) ON DELETE SET NULL;


--
-- Name: wa_rule_actions wa_rule_actions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_rule_actions
    ADD CONSTRAINT wa_rule_actions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_rule_conditions wa_rule_conditions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_rule_conditions
    ADD CONSTRAINT wa_rule_conditions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_webhook_events wa_webhook_events_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_webhook_events
    ADD CONSTRAINT wa_webhook_events_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: wa_webhook_events wa_webhook_events_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wa_webhook_events
    ADD CONSTRAINT wa_webhook_events_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.wa_connections(id) ON DELETE SET NULL;


--
-- Name: bucket_lifecycle_states bucket_lifecycle_states_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.bucket_lifecycle_states
    ADD CONSTRAINT bucket_lifecycle_states_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses Business owners and admins can update business profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Business owners and admins can update business profile" ON public.businesses FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.business_members bm
  WHERE ((bm.business_id = businesses.id) AND (bm.user_id = ( SELECT auth.uid() AS uid)) AND (bm.role = ANY (ARRAY['owner'::text, 'admin'::text])) AND (bm.is_active = true)))) OR public.is_superadmin()));


--
-- Name: wa_connections Owners and admins can add WhatsApp connections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can add WhatsApp connections" ON public.wa_connections FOR INSERT WITH CHECK ((public.is_business_owner_or_admin(business_id) OR public.is_superadmin()));


--
-- Name: wa_connections Owners and admins can delete WhatsApp connections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can delete WhatsApp connections" ON public.wa_connections FOR DELETE USING ((public.is_business_owner_or_admin(business_id) OR public.is_superadmin()));


--
-- Name: wa_connections Owners and admins can update WhatsApp connections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can update WhatsApp connections" ON public.wa_connections FOR UPDATE USING ((public.is_business_owner_or_admin(business_id) OR public.is_superadmin())) WITH CHECK ((public.is_business_owner_or_admin(business_id) OR public.is_superadmin()));


--
-- Name: business_settings Owners and admins can update business settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners and admins can update business settings" ON public.business_settings FOR UPDATE USING ((public.is_business_owner_or_admin(business_id) OR public.is_superadmin())) WITH CHECK ((public.is_business_owner_or_admin(business_id) OR public.is_superadmin()));


--
-- Name: business_members Owners can manage business members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Owners can manage business members" ON public.business_members USING ((public.is_business_owner(business_id) OR public.is_superadmin())) WITH CHECK ((public.is_business_owner(business_id) OR public.is_superadmin()));


--
-- Name: wa_credentials Strict server-side and owner access for wa_credentials; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Strict server-side and owner access for wa_credentials" ON public.wa_credentials USING ((public.is_business_owner_or_admin(business_id) OR public.is_superadmin())) WITH CHECK ((public.is_business_owner_or_admin(business_id) OR public.is_superadmin()));


--
-- Name: contact_activity_logs Tenant isolation for contact_activity_logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for contact_activity_logs" ON public.contact_activity_logs USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: contact_notes Tenant isolation for contact_notes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for contact_notes" ON public.contact_notes USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: crm_categories Tenant isolation for crm_categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for crm_categories" ON public.crm_categories USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: crm_segments Tenant isolation for crm_segments; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for crm_segments" ON public.crm_segments USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_automation_execution_logs Tenant isolation for wa_automation_execution_logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_automation_execution_logs" ON public.wa_automation_execution_logs USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_automation_rules Tenant isolation for wa_automation_rules; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_automation_rules" ON public.wa_automation_rules USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_contacts Tenant isolation for wa_contacts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_contacts" ON public.wa_contacts USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_conversations Tenant isolation for wa_conversations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_conversations" ON public.wa_conversations USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_message_templates Tenant isolation for wa_message_templates; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_message_templates" ON public.wa_message_templates USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_messages Tenant isolation for wa_messages; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_messages" ON public.wa_messages USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_processing_jobs Tenant isolation for wa_processing_jobs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_processing_jobs" ON public.wa_processing_jobs USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_rule_actions Tenant isolation for wa_rule_actions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_rule_actions" ON public.wa_rule_actions USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_rule_conditions Tenant isolation for wa_rule_conditions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_rule_conditions" ON public.wa_rule_conditions USING (public.check_user_business_access(business_id)) WITH CHECK (public.check_user_business_access(business_id));


--
-- Name: wa_webhook_events Tenant isolation for wa_webhook_events; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Tenant isolation for wa_webhook_events" ON public.wa_webhook_events USING ((((business_id IS NOT NULL) AND public.check_user_business_access(business_id)) OR public.is_superadmin())) WITH CHECK ((((business_id IS NOT NULL) AND public.check_user_business_access(business_id)) OR public.is_superadmin()));


--
-- Name: businesses Users can only view assigned businesses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can only view assigned businesses" ON public.businesses FOR SELECT USING ((public.check_user_business_access(id) OR public.is_superadmin()));


--
-- Name: wa_connections Users can only view connections for authorized businesses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can only view connections for authorized businesses" ON public.wa_connections FOR SELECT USING ((public.check_user_business_access(business_id) OR public.is_superadmin()));


--
-- Name: user_profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));


--
-- Name: business_members Users can view members of their authorized businesses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view members of their authorized businesses" ON public.business_members FOR SELECT USING (((user_id = ( SELECT auth.uid() AS uid)) OR public.check_user_business_access(business_id) OR public.is_superadmin()));


--
-- Name: business_settings Users can view settings for their authorized business; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view settings for their authorized business" ON public.business_settings FOR SELECT USING ((public.check_user_business_access(business_id) OR public.is_superadmin()));


--
-- Name: user_profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT USING (((id = ( SELECT auth.uid() AS uid)) OR public.is_superadmin()));


--
-- Name: business_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

--
-- Name: business_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_activity_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contact_activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_notes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.crm_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: crm_segments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_automation_execution_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_automation_execution_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_automation_rules; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_connections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_contacts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_conversations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_credentials; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_credentials ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_message_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_message_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_processing_jobs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_processing_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_rule_actions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_rule_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_rule_conditions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_rule_conditions ENABLE ROW LEVEL SECURITY;

--
-- Name: wa_webhook_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.wa_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: bucket_lifecycle_states; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.bucket_lifecycle_states ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: lifecycle_abandoned_artifacts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.lifecycle_abandoned_artifacts ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION supabase_realtime OWNER TO postgres;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA extensions; Type: ACL; Schema: -; Owner: postgres
--

GRANT USAGE ON SCHEMA extensions TO anon;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO service_role;
GRANT ALL ON SCHEMA extensions TO dashboard_user;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: SCHEMA realtime; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA realtime TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA realtime TO anon;
GRANT USAGE ON SCHEMA realtime TO service_role;
GRANT ALL ON SCHEMA realtime TO supabase_realtime_admin;
GRANT USAGE ON SCHEMA realtime TO authenticated;


--
-- Name: SCHEMA storage; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA storage TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT USAGE ON SCHEMA storage TO service_role;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON SCHEMA storage TO dashboard_user;


--
-- Name: SCHEMA vault; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA vault TO postgres WITH GRANT OPTION;
GRANT USAGE ON SCHEMA vault TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea) TO dashboard_user;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.armor(bytea, text[], text[]) FROM postgres;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.armor(bytea, text[], text[]) TO dashboard_user;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.crypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.crypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.dearmor(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.dearmor(text) TO dashboard_user;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.decrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.digest(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.digest(text, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.encrypt_iv(bytea, bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_bytes(integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_bytes(integer) TO dashboard_user;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_random_uuid() FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_random_uuid() TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text) TO dashboard_user;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.gen_salt(text, integer) FROM postgres;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.gen_salt(text, integer) TO dashboard_user;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_cron_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_cron_access() TO dashboard_user;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.grant_pg_graphql_access() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION grant_pg_net_access(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION extensions.grant_pg_net_access() FROM supabase_admin;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO supabase_admin WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.grant_pg_net_access() TO dashboard_user;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.hmac(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.hmac(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements(showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_info(OUT dealloc bigint, OUT stats_reset timestamp with time zone) TO dashboard_user;


--
-- Name: FUNCTION pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) FROM postgres;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint, minmax_only boolean) TO dashboard_user;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_armor_headers(text, OUT key text, OUT value text) TO dashboard_user;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_key_id(bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_key_id(bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_decrypt_bytea(bytea, bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt(text, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea) TO dashboard_user;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_pub_encrypt_bytea(bytea, bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_decrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt(text, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text) TO dashboard_user;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) FROM postgres;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.pgp_sym_encrypt_bytea(bytea, text, text) TO dashboard_user;


--
-- Name: FUNCTION pgrst_ddl_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_ddl_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION pgrst_drop_watch(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.pgrst_drop_watch() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

GRANT ALL ON FUNCTION extensions.set_graphql_placeholder() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION uuid_generate_v1(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v1mc(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v1mc() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v1mc() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v3(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v3(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v4(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v4() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v4() TO dashboard_user;


--
-- Name: FUNCTION uuid_generate_v5(namespace uuid, name text); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_generate_v5(namespace uuid, name text) TO dashboard_user;


--
-- Name: FUNCTION uuid_nil(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_nil() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_nil() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_dns(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_dns() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_dns() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_oid(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_oid() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_oid() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_url(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_url() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_url() TO dashboard_user;


--
-- Name: FUNCTION uuid_ns_x500(); Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON FUNCTION extensions.uuid_ns_x500() FROM postgres;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION extensions.uuid_ns_x500() TO dashboard_user;


--
-- Name: FUNCTION graphql("operationName" text, query text, variables jsonb, extensions jsonb); Type: ACL; Schema: graphql_public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO postgres;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO anon;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO authenticated;
GRANT ALL ON FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) TO service_role;


--
-- Name: FUNCTION pg_reload_conf(); Type: ACL; Schema: pg_catalog; Owner: supabase_admin
--

GRANT ALL ON FUNCTION pg_catalog.pg_reload_conf() TO postgres WITH GRANT OPTION;


--
-- Name: FUNCTION get_auth(p_usename text); Type: ACL; Schema: pgbouncer; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION pgbouncer.get_auth(p_usename text) FROM PUBLIC;
GRANT ALL ON FUNCTION pgbouncer.get_auth(p_usename text) TO pgbouncer;


--
-- Name: FUNCTION check_user_business_access(b_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.check_user_business_access(b_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_user_business_access(b_id uuid) TO anon;
GRANT ALL ON FUNCTION public.check_user_business_access(b_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_user_business_access(b_id uuid) TO service_role;


--
-- Name: TABLE wa_processing_jobs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_processing_jobs TO anon;
GRANT ALL ON TABLE public.wa_processing_jobs TO authenticated;
GRANT ALL ON TABLE public.wa_processing_jobs TO service_role;


--
-- Name: FUNCTION claim_next_wa_jobs(p_batch_size integer, p_worker_id text); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.claim_next_wa_jobs(p_batch_size integer, p_worker_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_next_wa_jobs(p_batch_size integer, p_worker_id text) TO service_role;


--
-- Name: FUNCTION get_business_analytics_daily_trends(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_business_analytics_daily_trends(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_business_analytics_daily_trends(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.get_business_analytics_daily_trends(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_business_analytics_daily_trends(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_business_analytics_summary(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_business_analytics_summary(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_business_analytics_summary(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.get_business_analytics_summary(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_business_analytics_summary(p_business_id uuid, p_start_date timestamp with time zone, p_end_date timestamp with time zone) TO service_role;


--
-- Name: FUNCTION get_inbox_counts(p_business_id uuid, p_connection_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.get_inbox_counts(p_business_id uuid, p_connection_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_inbox_counts(p_business_id uuid, p_connection_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_inbox_counts(p_business_id uuid, p_connection_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_inbox_counts(p_business_id uuid, p_connection_id uuid) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION ingest_wa_inbound_message(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ingest_wa_inbound_message(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ingest_wa_inbound_message(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) TO anon;
GRANT ALL ON FUNCTION public.ingest_wa_inbound_message(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.ingest_wa_inbound_message(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) TO service_role;


--
-- Name: FUNCTION ingest_wa_inbound_message_v2(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.ingest_wa_inbound_message_v2(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.ingest_wa_inbound_message_v2(p_phone_number_id text, p_meta_message_id text, p_sender_phone text, p_sender_name text, p_message_type text, p_content text, p_raw_payload jsonb) TO service_role;


--
-- Name: FUNCTION is_business_owner(b_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_business_owner(b_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_business_owner(b_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_business_owner(b_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_business_owner(b_id uuid) TO service_role;


--
-- Name: FUNCTION is_business_owner_or_admin(b_id uuid); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_business_owner_or_admin(b_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_business_owner_or_admin(b_id uuid) TO anon;
GRANT ALL ON FUNCTION public.is_business_owner_or_admin(b_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_business_owner_or_admin(b_id uuid) TO service_role;


--
-- Name: FUNCTION is_superadmin(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.is_superadmin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_superadmin() TO anon;
GRANT ALL ON FUNCTION public.is_superadmin() TO authenticated;
GRANT ALL ON FUNCTION public.is_superadmin() TO service_role;


--
-- Name: FUNCTION prevent_business_member_tenant_reassignment(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_business_member_tenant_reassignment() TO anon;
GRANT ALL ON FUNCTION public.prevent_business_member_tenant_reassignment() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_business_member_tenant_reassignment() TO service_role;


--
-- Name: FUNCTION prevent_business_settings_tenant_reassignment(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_business_settings_tenant_reassignment() TO anon;
GRANT ALL ON FUNCTION public.prevent_business_settings_tenant_reassignment() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_business_settings_tenant_reassignment() TO service_role;


--
-- Name: FUNCTION prevent_tenant_reassignment(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_tenant_reassignment() TO anon;
GRANT ALL ON FUNCTION public.prevent_tenant_reassignment() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_tenant_reassignment() TO service_role;


--
-- Name: FUNCTION prevent_user_profile_privilege_escalation(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_user_profile_privilege_escalation() TO anon;
GRANT ALL ON FUNCTION public.prevent_user_profile_privilege_escalation() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_user_profile_privilege_escalation() TO service_role;


--
-- Name: FUNCTION prevent_wa_connection_tenant_reassignment(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.prevent_wa_connection_tenant_reassignment() TO anon;
GRANT ALL ON FUNCTION public.prevent_wa_connection_tenant_reassignment() TO authenticated;
GRANT ALL ON FUNCTION public.prevent_wa_connection_tenant_reassignment() TO service_role;


--
-- Name: FUNCTION prune_stale_automation_records(); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.prune_stale_automation_records() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prune_stale_automation_records() TO service_role;


--
-- Name: FUNCTION reclaim_stuck_wa_jobs(p_timeout_minutes integer); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.reclaim_stuck_wa_jobs(p_timeout_minutes integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reclaim_stuck_wa_jobs(p_timeout_minutes integer) TO service_role;


--
-- Name: FUNCTION update_wa_message_status(p_phone_number_id text, p_meta_message_id text, p_status text, p_timestamp timestamp with time zone, p_error_code text, p_error_message text, p_raw_payload jsonb); Type: ACL; Schema: public; Owner: postgres
--

REVOKE ALL ON FUNCTION public.update_wa_message_status(p_phone_number_id text, p_meta_message_id text, p_status text, p_timestamp timestamp with time zone, p_error_code text, p_error_message text, p_raw_payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_wa_message_status(p_phone_number_id text, p_meta_message_id text, p_status text, p_timestamp timestamp with time zone, p_error_code text, p_error_message text, p_raw_payload jsonb) TO anon;
GRANT ALL ON FUNCTION public.update_wa_message_status(p_phone_number_id text, p_meta_message_id text, p_status text, p_timestamp timestamp with time zone, p_error_code text, p_error_message text, p_raw_payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.update_wa_message_status(p_phone_number_id text, p_meta_message_id text, p_status text, p_timestamp timestamp with time zone, p_error_code text, p_error_message text, p_raw_payload jsonb) TO service_role;


--
-- Name: FUNCTION apply_rls(wal jsonb, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO anon;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO authenticated;
GRANT ALL ON FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer) TO service_role;


--
-- Name: FUNCTION authorize(role_name text, topic_name text, claims text, sub text, headers text, read_extensions text[], write_extensions text[], OUT read_allowed boolean[], OUT write_allowed boolean[]); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.authorize(role_name text, topic_name text, claims text, sub text, headers text, read_extensions text[], write_extensions text[], OUT read_allowed boolean[], OUT write_allowed boolean[]) TO postgres;
GRANT ALL ON FUNCTION realtime.authorize(role_name text, topic_name text, claims text, sub text, headers text, read_extensions text[], write_extensions text[], OUT read_allowed boolean[], OUT write_allowed boolean[]) TO dashboard_user;


--
-- Name: FUNCTION broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO postgres;
GRANT ALL ON FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text) TO dashboard_user;


--
-- Name: FUNCTION build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO postgres;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO anon;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) TO service_role;


--
-- Name: FUNCTION "cast"(val text, type_ regtype); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO postgres;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO dashboard_user;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO anon;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO authenticated;
GRANT ALL ON FUNCTION realtime."cast"(val text, type_ regtype) TO service_role;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) TO service_role;


--
-- Name: FUNCTION check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO anon;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO authenticated;
GRANT ALL ON FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text, negate boolean) TO service_role;


--
-- Name: FUNCTION filters_hash(filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.filters_hash(filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.filters_hash(filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.filters_hash(filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.filters_hash(filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.filters_hash(filters realtime.user_defined_filter[]) TO service_role;


--
-- Name: FUNCTION is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO postgres;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO anon;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO authenticated;
GRANT ALL ON FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) TO service_role;


--
-- Name: FUNCTION list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;


--
-- Name: FUNCTION list_changes_sync(publication name, slot_name name, max_changes integer, max_record_bytes integer); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.list_changes_sync(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO postgres;
GRANT ALL ON FUNCTION realtime.list_changes_sync(publication name, slot_name name, max_changes integer, max_record_bytes integer) TO dashboard_user;


--
-- Name: FUNCTION quote_wal2json(entity regclass); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO postgres;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO anon;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO authenticated;
GRANT ALL ON FUNCTION realtime.quote_wal2json(entity regclass) TO service_role;


--
-- Name: FUNCTION send(payload jsonb, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION send_binary(payload bytea, event text, topic text, private boolean); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) TO postgres;
GRANT ALL ON FUNCTION realtime.send_binary(payload bytea, event text, topic text, private boolean) TO dashboard_user;


--
-- Name: FUNCTION settled_changes(slot_name name, max_changes integer, VARIADIC opts text[]); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.settled_changes(slot_name name, max_changes integer, VARIADIC opts text[]) TO postgres;
GRANT ALL ON FUNCTION realtime.settled_changes(slot_name name, max_changes integer, VARIADIC opts text[]) TO dashboard_user;


--
-- Name: FUNCTION subscription_check_filters(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO postgres;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO dashboard_user;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO anon;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO authenticated;
GRANT ALL ON FUNCTION realtime.subscription_check_filters() TO service_role;


--
-- Name: FUNCTION to_regrole(role_name text); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO postgres;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO dashboard_user;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO anon;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO authenticated;
GRANT ALL ON FUNCTION realtime.to_regrole(role_name text) TO service_role;


--
-- Name: FUNCTION topic(); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.topic() TO postgres;
GRANT ALL ON FUNCTION realtime.topic() TO dashboard_user;


--
-- Name: FUNCTION wal2json_escape_identifier(name text); Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON FUNCTION realtime.wal2json_escape_identifier(name text) TO postgres;
GRANT ALL ON FUNCTION realtime.wal2json_escape_identifier(name text) TO dashboard_user;


--
-- Name: FUNCTION delete_lifecycle_objects(object_ids uuid[]); Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON FUNCTION storage.delete_lifecycle_objects(object_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION storage.delete_lifecycle_objects(object_ids uuid[]) TO postgres;
GRANT ALL ON FUNCTION storage.delete_lifecycle_objects(object_ids uuid[]) TO service_role;


--
-- Name: FUNCTION protect_active_lifecycle_states(); Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON FUNCTION storage.protect_active_lifecycle_states() FROM PUBLIC;


--
-- Name: FUNCTION reconcile_lifecycle_state(target_bucket_id text, policy_changed boolean); Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON FUNCTION storage.reconcile_lifecycle_state(target_bucket_id text, policy_changed boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION storage.reconcile_lifecycle_state(target_bucket_id text, policy_changed boolean) TO postgres;
GRANT ALL ON FUNCTION storage.reconcile_lifecycle_state(target_bucket_id text, policy_changed boolean) TO service_role;


--
-- Name: FUNCTION wake_lifecycle_state(); Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON FUNCTION storage.wake_lifecycle_state() FROM PUBLIC;


--
-- Name: FUNCTION _crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault._crypto_aead_det_decrypt(message bytea, additional bytea, key_id bigint, context bytea, nonce bytea) TO service_role;


--
-- Name: FUNCTION create_secret(new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.create_secret(new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: FUNCTION update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid); Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO postgres WITH GRANT OPTION;
GRANT ALL ON FUNCTION vault.update_secret(secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid) TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE mfa_recovery_code_sets; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.mfa_recovery_code_sets TO postgres;
GRANT ALL ON TABLE auth.mfa_recovery_code_sets TO dashboard_user;


--
-- Name: TABLE mfa_recovery_codes; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.mfa_recovery_codes TO postgres;
GRANT ALL ON TABLE auth.mfa_recovery_codes TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE scim_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.scim_tokens TO postgres;
GRANT ALL ON TABLE auth.scim_tokens TO dashboard_user;


--
-- Name: TABLE scim_users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.scim_users TO postgres;
GRANT ALL ON TABLE auth.scim_users TO dashboard_user;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE webauthn_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_challenges TO postgres;
GRANT ALL ON TABLE auth.webauthn_challenges TO dashboard_user;


--
-- Name: TABLE webauthn_credentials; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_credentials TO postgres;
GRANT ALL ON TABLE auth.webauthn_credentials TO dashboard_user;


--
-- Name: TABLE pg_stat_statements; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements TO dashboard_user;


--
-- Name: TABLE pg_stat_statements_info; Type: ACL; Schema: extensions; Owner: postgres
--

REVOKE ALL ON TABLE extensions.pg_stat_statements_info FROM postgres;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE extensions.pg_stat_statements_info TO dashboard_user;


--
-- Name: TABLE business_members; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.business_members TO anon;
GRANT ALL ON TABLE public.business_members TO authenticated;
GRANT ALL ON TABLE public.business_members TO service_role;


--
-- Name: TABLE business_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.business_settings TO anon;
GRANT ALL ON TABLE public.business_settings TO authenticated;
GRANT ALL ON TABLE public.business_settings TO service_role;


--
-- Name: TABLE businesses; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.businesses TO anon;
GRANT ALL ON TABLE public.businesses TO authenticated;
GRANT ALL ON TABLE public.businesses TO service_role;


--
-- Name: TABLE contact_activity_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contact_activity_logs TO anon;
GRANT ALL ON TABLE public.contact_activity_logs TO authenticated;
GRANT ALL ON TABLE public.contact_activity_logs TO service_role;


--
-- Name: TABLE contact_notes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.contact_notes TO anon;
GRANT ALL ON TABLE public.contact_notes TO authenticated;
GRANT ALL ON TABLE public.contact_notes TO service_role;


--
-- Name: TABLE crm_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.crm_categories TO anon;
GRANT ALL ON TABLE public.crm_categories TO authenticated;
GRANT ALL ON TABLE public.crm_categories TO service_role;


--
-- Name: TABLE crm_segments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.crm_segments TO anon;
GRANT ALL ON TABLE public.crm_segments TO authenticated;
GRANT ALL ON TABLE public.crm_segments TO service_role;


--
-- Name: TABLE user_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;


--
-- Name: TABLE wa_automation_execution_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_automation_execution_logs TO anon;
GRANT ALL ON TABLE public.wa_automation_execution_logs TO authenticated;
GRANT ALL ON TABLE public.wa_automation_execution_logs TO service_role;


--
-- Name: TABLE wa_automation_rules; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_automation_rules TO anon;
GRANT ALL ON TABLE public.wa_automation_rules TO authenticated;
GRANT ALL ON TABLE public.wa_automation_rules TO service_role;


--
-- Name: TABLE wa_connections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_connections TO anon;
GRANT ALL ON TABLE public.wa_connections TO authenticated;
GRANT ALL ON TABLE public.wa_connections TO service_role;


--
-- Name: TABLE wa_contacts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_contacts TO anon;
GRANT ALL ON TABLE public.wa_contacts TO authenticated;
GRANT ALL ON TABLE public.wa_contacts TO service_role;


--
-- Name: TABLE wa_conversations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_conversations TO anon;
GRANT ALL ON TABLE public.wa_conversations TO authenticated;
GRANT ALL ON TABLE public.wa_conversations TO service_role;


--
-- Name: TABLE wa_credentials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_credentials TO anon;
GRANT ALL ON TABLE public.wa_credentials TO authenticated;
GRANT ALL ON TABLE public.wa_credentials TO service_role;


--
-- Name: TABLE wa_message_templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_message_templates TO anon;
GRANT ALL ON TABLE public.wa_message_templates TO authenticated;
GRANT ALL ON TABLE public.wa_message_templates TO service_role;


--
-- Name: TABLE wa_messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_messages TO anon;
GRANT ALL ON TABLE public.wa_messages TO authenticated;
GRANT ALL ON TABLE public.wa_messages TO service_role;


--
-- Name: TABLE wa_rule_actions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_rule_actions TO anon;
GRANT ALL ON TABLE public.wa_rule_actions TO authenticated;
GRANT ALL ON TABLE public.wa_rule_actions TO service_role;


--
-- Name: TABLE wa_rule_conditions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_rule_conditions TO anon;
GRANT ALL ON TABLE public.wa_rule_conditions TO authenticated;
GRANT ALL ON TABLE public.wa_rule_conditions TO service_role;


--
-- Name: TABLE wa_webhook_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.wa_webhook_events TO anon;
GRANT ALL ON TABLE public.wa_webhook_events TO authenticated;
GRANT ALL ON TABLE public.wa_webhook_events TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE realtime.messages TO postgres;
GRANT SELECT,INSERT ON TABLE realtime.messages TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE realtime.messages TO dashboard_user;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE realtime.messages TO service_role;


--
-- Name: TABLE subscription; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON TABLE realtime.subscription TO postgres;
GRANT ALL ON TABLE realtime.subscription TO dashboard_user;
GRANT SELECT ON TABLE realtime.subscription TO anon;
GRANT SELECT ON TABLE realtime.subscription TO authenticated;
GRANT SELECT ON TABLE realtime.subscription TO service_role;


--
-- Name: SEQUENCE subscription_id_seq; Type: ACL; Schema: realtime; Owner: supabase_realtime_admin
--

GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO postgres;
GRANT ALL ON SEQUENCE realtime.subscription_id_seq TO dashboard_user;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO anon;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE realtime.subscription_id_seq TO service_role;


--
-- Name: TABLE bucket_lifecycle_states; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.bucket_lifecycle_states TO postgres;
GRANT ALL ON TABLE storage.bucket_lifecycle_states TO service_role;


--
-- Name: TABLE buckets; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.buckets FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.buckets TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.buckets TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE storage.buckets TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE storage.buckets TO anon;
GRANT ALL ON TABLE storage.buckets TO postgres WITH GRANT OPTION;


--
-- Name: TABLE buckets_analytics; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.buckets_analytics TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE storage.buckets_analytics TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE storage.buckets_analytics TO anon;


--
-- Name: TABLE buckets_vectors; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.buckets_vectors TO service_role;
GRANT SELECT ON TABLE storage.buckets_vectors TO anon;
GRANT SELECT ON TABLE storage.buckets_vectors TO authenticated;


--
-- Name: TABLE lifecycle_abandoned_artifacts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.lifecycle_abandoned_artifacts TO postgres;
GRANT ALL ON TABLE storage.lifecycle_abandoned_artifacts TO service_role;


--
-- Name: TABLE objects; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

REVOKE ALL ON TABLE storage.objects FROM supabase_storage_admin;
GRANT ALL ON TABLE storage.objects TO supabase_storage_admin WITH GRANT OPTION;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE storage.objects TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE storage.objects TO anon;
GRANT ALL ON TABLE storage.objects TO postgres WITH GRANT OPTION;


--
-- Name: TABLE s3_multipart_uploads; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads TO anon;


--
-- Name: TABLE s3_multipart_uploads_parts; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT ALL ON TABLE storage.s3_multipart_uploads_parts TO service_role;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO authenticated;
GRANT SELECT ON TABLE storage.s3_multipart_uploads_parts TO anon;


--
-- Name: TABLE vector_indexes; Type: ACL; Schema: storage; Owner: supabase_storage_admin
--

GRANT SELECT ON TABLE storage.vector_indexes TO service_role;
GRANT SELECT ON TABLE storage.vector_indexes TO anon;
GRANT SELECT ON TABLE storage.vector_indexes TO authenticated;


--
-- Name: TABLE secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.secrets TO service_role;


--
-- Name: TABLE decrypted_secrets; Type: ACL; Schema: vault; Owner: supabase_admin
--

GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE vault.decrypted_secrets TO postgres WITH GRANT OPTION;
GRANT SELECT,DELETE ON TABLE vault.decrypted_secrets TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON SEQUENCES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON FUNCTIONS TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: extensions; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL ON TABLES TO postgres WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: graphql_public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: realtime; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT SELECT,INSERT ON TABLES TO postgres WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: storage; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL ON TABLES TO service_role;


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


ALTER EVENT TRIGGER issue_graphql_placeholder OWNER TO supabase_admin;

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


ALTER EVENT TRIGGER issue_pg_cron_access OWNER TO supabase_admin;

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


ALTER EVENT TRIGGER issue_pg_graphql_access OWNER TO supabase_admin;

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


ALTER EVENT TRIGGER issue_pg_net_access OWNER TO supabase_admin;

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


ALTER EVENT TRIGGER pgrst_ddl_watch OWNER TO supabase_admin;

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


ALTER EVENT TRIGGER pgrst_drop_watch OWNER TO supabase_admin;

--
-- PostgreSQL database dump complete
--

\unrestrict Ypzd4rtVWCz6LioCBzlfrYtfE6rnED7AC6PHd5eefZZ0dgg2Dr1ROz83qCi7vjj

