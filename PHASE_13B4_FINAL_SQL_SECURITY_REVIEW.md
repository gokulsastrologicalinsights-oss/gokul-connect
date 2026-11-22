# PHASE 13B.4 — FINAL SQL & SECURITY AUDIT REVIEW
**Project:** Gokul Connect  
**Module:** Meta Social Automation (Facebook & Instagram)  
**Branch:** `phase-13b-critical-remediation`  
**Target Environment:** Dedicated Supabase Staging (`ansiwtwqgrfmzfrhkzuu`)  
**Audit Mode:** STRICT READ-ONLY SECURITY AUDIT  
**Date:** November 22, 2026  
**Auditor:** Senior Distributed Systems Architect & PostgreSQL Security Specialist  

---

## EXECUTIVE SUMMARY & AUDIT VERDICT

### FINAL VERDICT: **`READY FOR MIGRATION 027 (WITH PRIVILEGE CORRECTION)`**

An exhaustive, line-by-line security and schema audit of migrations `027` and `028` was conducted against the live staging database catalog (`ansiwtwqgrfmzfrhkzuu`).

The migrations are relationally sound, strictly forward-compatible, non-destructive, and have zero footprint on existing WhatsApp tables. However, a **critical privilege configuration** was uncovered regarding `GRANT EXECUTE ... TO authenticated` on `SECURITY DEFINER` queue worker and ingestion functions.

### Security Audit Scorecard

| Check # | Audit Dimension | Status | Summary |
| :---: | :--- | :---: | :--- |
| **1** | `GRANT` and `REVOKE` Privilege Scoping | **`NEEDS ATTENTION`** | `claim_meta_social_events`, `reclaim_stuck_meta_social_events`, and `ingest_meta_social_event_atomic` grant `EXECUTE` to `authenticated`. Must be restricted strictly to `service_role`. |
| **2** | Composite Foreign Key Relational Integrity | **`PASS`** | Composite foreign keys reference valid `UNIQUE (id, business_id)` constraints on `meta_social_connections` and `meta_social_events`. |
| **3** | `SECURITY DEFINER` Search Path & Isolation | **`PASS`** (Path) / **`NEEDS ATTENTION`** (Grant) | All functions set `SET search_path = public, pg_temp` protecting against search path hijacking. Privilege scoping must be patched. |
| **4** | Delivery Ledger RLS Policy Coverage | **`PASS`** | `service_role` has `FOR ALL`; `authenticated` has tenant-scoped `SELECT`. Client `INSERT`/`UPDATE`/`DELETE` are safely denied by default. |
| **5** | Staging Schema & Record Compatibility | **`PASS`** | Staging has 2 connections (0 duplicates), 2 credentials, 1 event, 16 rules. All constraints apply cleanly without data loss. |
| **6** | Migration Dependency Chain (027 → 028) | **`PASS`** | Migration 028 depends strictly on `meta_social_deliveries` created in 027. No external or missing dependencies. |
| **7** | Blast Radius & WhatsApp Non-Interference | **`PASS`** | Zero references to WhatsApp tables; zero table drops; zero column drops. |

---

## 1. DETAILED CHECK FINDINGS

### CHECK 1 — `GRANT` AND `REVOKE` STATEMENT AUDIT

#### 1.1 Ingestion RPC (`20261122_027_meta_social_critical_fixes.sql`)
- **Location:** Lines 279–280
- **Exact SQL:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
  ```
- **Finding:** **`NEEDS ATTENTION`**
- **Security Analysis:** `ingest_meta_social_event_atomic` is invoked exclusively by the serverless webhook endpoint (`src/app/api/webhooks/meta-social/route.ts`), which runs with `createAdminClient()` (`service_role`). Web users in the browser have no legitimate reason to execute raw webhook event ingestion. Granting `EXECUTE` to `authenticated` exposes this endpoint to authenticated client sessions.

#### 1.2 Worker Claim & Recovery RPCs (`20261122_028_meta_social_worker_reliability.sql`)
- **Location:** Lines 212–216
- **Exact SQL:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) TO authenticated, service_role;

  REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) TO authenticated, service_role;
  ```
- **Finding:** **`FAIL / HIGH RISK`**
- **Security Analysis:** `claim_meta_social_events()` is a system-wide queue processor designed for background worker processes. It scans and claims events across **all** businesses (`meta_social_events`). Because it runs as `SECURITY DEFINER`, it bypasses RLS. If granted to `authenticated`, any authenticated user of Business A (e.g. an Astrology user) could invoke `supabase.rpc('claim_meta_social_events', ...)` from their browser console and claim/read inbound private messages and comments belonging to Business B (e.g. Vivaham).
- **Precedent:** In Phase 7.5, Migration 011 (`20261107_011_phase7_5_queue_rpc_privilege_hardening.sql`) explicitly resolved this exact vulnerability for WhatsApp queue workers by revoking `authenticated` and granting strictly to `service_role`:
  ```sql
  GRANT EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) TO service_role;
  GRANT EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) TO service_role;
  ```
- **Required Correction:**
  ```sql
  REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) TO service_role;

  REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) TO service_role;
  ```

---

### CHECK 2 — COMPOSITE FOREIGN KEY INTEGRITY

- **Migration:** `supabase/migrations/20261122_027_meta_social_critical_fixes.sql`
- **Location:** Lines 45–48, 55–58, 65–68, 125–128
- **Statements:**
  ```sql
  -- Line 45-48
  ALTER TABLE public.meta_social_credentials
      ADD CONSTRAINT fk_meta_social_credentials_conn_biz
      FOREIGN KEY (connection_id, business_id)
      REFERENCES public.meta_social_connections(id, business_id)
      ON DELETE CASCADE;

  -- Line 55-58
  ALTER TABLE public.meta_social_rules
      ADD CONSTRAINT fk_meta_social_rules_conn_biz
      FOREIGN KEY (connection_id, business_id)
      REFERENCES public.meta_social_connections(id, business_id)
      ON DELETE CASCADE;

  -- Line 65-68
  ALTER TABLE public.meta_social_events
      ADD CONSTRAINT fk_meta_social_events_conn_biz
      FOREIGN KEY (connection_id, business_id)
      REFERENCES public.meta_social_connections(id, business_id)
      ON DELETE CASCADE;

  -- Line 125-128
  CONSTRAINT fk_meta_social_deliveries_conn_biz FOREIGN KEY (connection_id, business_id)
      REFERENCES public.meta_social_connections(id, business_id) ON DELETE CASCADE,
  CONSTRAINT fk_meta_social_deliveries_event_biz FOREIGN KEY (event_id, business_id)
      REFERENCES public.meta_social_events(id, business_id) ON DELETE CASCADE
  ```
- **Target Parent Unique Constraints Verified:**
  - `public.meta_social_connections(id, business_id)` is defined with `CONSTRAINT uq_meta_social_connections_id_business UNIQUE (id, business_id)` in Migration 026 (Line 57).
  - `public.meta_social_events(id, business_id)` is defined with `CONSTRAINT uq_meta_social_events_id_business UNIQUE (id, business_id)` in Migration 026 (Line 332).
- **Finding:** **`PASS`**
- **Analysis:** Both referenced parent constraints exist and are valid. Under PostgreSQL default `MATCH SIMPLE` semantics, composite foreign keys where `connection_id IS NULL` (as in global rules in `meta_social_rules`) are valid, while any row with a non-null `connection_id` is strictly constrained to match both the connection ID and the business ID.

---

### CHECK 3 — `SECURITY DEFINER` POSTURE & FUNCTION BODIES

#### 3.1 `ingest_meta_social_event_atomic`
- **Migration:** `supabase/migrations/20261122_027_meta_social_critical_fixes.sql`
- **Location:** Lines 168–276
- **Complete SQL Definition:**
```sql
CREATE OR REPLACE FUNCTION public.ingest_meta_social_event_atomic(
    p_platform TEXT,
    p_account_id TEXT,
    p_event_type TEXT,
    p_meta_event_id TEXT,
    p_sender_id TEXT,
    p_sender_name TEXT,
    p_post_id TEXT,
    p_comment_id TEXT,
    p_parent_comment_id TEXT,
    p_content TEXT,
    p_event_timestamp TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_connection RECORD;
    v_event_id UUID;
BEGIN
    -- 1. Locate registered connection for this platform and account_id (or page_id)
    SELECT * INTO v_connection
    FROM public.meta_social_connections
    WHERE platform = p_platform
      AND (account_id = p_account_id OR page_id = p_account_id)
      AND is_enabled = true
      AND connection_status = 'connected'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'ignored',
            'reason', 'no_active_connection_found'
        );
    END IF;

    -- 2. Concurrency-safe atomic insert using ON CONFLICT DO NOTHING
    INSERT INTO public.meta_social_events (
        business_id,
        connection_id,
        platform,
        event_type,
        meta_event_id,
        sender_id,
        sender_name,
        post_id,
        comment_id,
        parent_comment_id,
        content,
        event_timestamp,
        status
    ) VALUES (
        v_connection.business_id,
        v_connection.id,
        p_platform,
        p_event_type,
        p_meta_event_id,
        p_sender_id,
        p_sender_name,
        p_post_id,
        p_comment_id,
        p_parent_comment_id,
        p_content,
        COALESCE(p_event_timestamp, TIMEZONE('utc', NOW())),
        'received'
    )
    ON CONFLICT (business_id, meta_event_id) DO NOTHING
    RETURNING id INTO v_event_id;

    -- If conflict occurred (v_event_id is NULL), it is a duplicate event
    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id
        FROM public.meta_social_events
        WHERE business_id = v_connection.business_id
          AND meta_event_id = p_meta_event_id;

        RETURN jsonb_build_object(
            'status', 'duplicate',
            'event_id', v_event_id,
            'business_id', v_connection.business_id,
            'connection_id', v_connection.id
        );
    END IF;

    -- 3. Update last_webhook_at on connection
    UPDATE public.meta_social_connections
    SET last_webhook_at = TIMEZONE('utc', NOW()),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = v_connection.id;

    RETURN jsonb_build_object(
        'status', 'ingested',
        'event_id', v_event_id,
        'business_id', v_connection.business_id,
        'connection_id', v_connection.id,
        'credential_ref', v_connection.credential_ref,
        'page_id', v_connection.page_id,
        'account_id', v_connection.account_id,
        'auto_reply_dms', v_connection.auto_reply_dms,
        'auto_reply_comments', v_connection.auto_reply_comments,
        'auto_dm_on_comment', v_connection.auto_dm_on_comment,
        'comment_dm_trigger_keywords', v_connection.comment_dm_trigger_keywords,
        'default_comment_reply', v_connection.default_comment_reply,
        'default_dm_reply', v_connection.default_dm_reply
    );
END;
$$;
```

#### 3.2 `claim_meta_social_events`
- **Migration:** `supabase/migrations/20261122_028_meta_social_worker_reliability.sql`
- **Location:** Lines 89–133
- **Complete SQL Definition:**
```sql
CREATE OR REPLACE FUNCTION public.claim_meta_social_events(
    p_worker_id TEXT,
    p_batch_size INT DEFAULT 10,
    p_lease_seconds INT DEFAULT 300
)
RETURNS SETOF public.meta_social_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_lease_duration INTERVAL;
BEGIN
    v_lease_duration := (p_lease_seconds || ' seconds')::INTERVAL;

    RETURN QUERY
    WITH eligible_events AS (
        SELECT id
        FROM public.meta_social_events
        WHERE (
            -- 1. Brand new received events ready to process
            (status = 'received' AND (next_retry_at IS NULL OR next_retry_at <= TIMEZONE('utc', NOW())))
            OR
            -- 2. Retry scheduled events that have reached next_retry_at
            (status = 'retry_scheduled' AND (next_retry_at IS NULL OR next_retry_at <= TIMEZONE('utc', NOW())) AND attempt_count < max_attempts)
            OR
            -- 3. Abandoned / expired leased processing events (crash recovery)
            (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < TIMEZONE('utc', NOW()) AND attempt_count < max_attempts)
        )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    UPDATE public.meta_social_events e
    SET status = 'processing',
        claimed_by = p_worker_id,
        claimed_at = TIMEZONE('utc', NOW()),
        lease_expires_at = TIMEZONE('utc', NOW()) + v_lease_duration,
        attempt_count = e.attempt_count + 1,
        updated_at = TIMEZONE('utc', NOW())
    FROM eligible_events s
    WHERE e.id = s.id
    RETURNING e.*;
END;
$$;
```

#### 3.3 `reclaim_stuck_meta_social_events`
- **Migration:** `supabase/migrations/20261122_028_meta_social_worker_reliability.sql`
- **Location:** Lines 142–207
- **Complete SQL Definition:**
```sql
CREATE OR REPLACE FUNCTION public.reclaim_stuck_meta_social_events(
    p_timeout_seconds INT DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reclaimed_count INT := 0;
    v_exhausted_count INT := 0;
    v_threshold TIMESTAMPTZ;
BEGIN
    v_threshold := TIMEZONE('utc', NOW()) - (p_timeout_seconds || ' seconds')::INTERVAL;

    -- 1. Mark exhausted stuck jobs permanently_failed
    WITH exhausted AS (
        SELECT id
        FROM public.meta_social_events
        WHERE status = 'processing'
          AND (lease_expires_at < TIMEZONE('utc', NOW()) OR (claimed_at IS NOT NULL AND claimed_at < v_threshold))
          AND attempt_count >= max_attempts
        FOR UPDATE SKIP LOCKED
    ),
    marked_exhausted AS (
        UPDATE public.meta_social_events e
        SET status = 'permanently_failed',
            error_message = COALESCE(e.error_message, 'Exhausted maximum retry attempts while stuck in processing lease'),
            claimed_by = NULL,
            lease_expires_at = NULL,
            updated_at = TIMEZONE('utc', NOW())
        FROM exhausted x
        WHERE e.id = x.id
        RETURNING e.id
    )
    SELECT COUNT(*) INTO v_exhausted_count FROM marked_exhausted;

    -- 2. Reset unexhausted stuck jobs back to received for re-claiming
    WITH stuck AS (
        SELECT id
        FROM public.meta_social_events
        WHERE status = 'processing'
          AND (lease_expires_at < TIMEZONE('utc', NOW()) OR (claimed_at IS NOT NULL AND claimed_at < v_threshold))
          AND attempt_count < max_attempts
        FOR UPDATE SKIP LOCKED
    ),
    reset_stuck AS (
        UPDATE public.meta_social_events e
        SET status = 'received',
            claimed_by = NULL,
            lease_expires_at = NULL,
            error_message = 'Reclaimed from expired worker lease',
            updated_at = TIMEZONE('utc', NOW())
        FROM stuck s
        WHERE e.id = s.id
        RETURNING e.id
    )
    SELECT COUNT(*) INTO v_reclaimed_count FROM reset_stuck;

    RETURN jsonb_build_object(
        'reclaimed', v_reclaimed_count,
        'exhausted', v_exhausted_count,
        'timestamp', TIMEZONE('utc', NOW())
    );
END;
$$;
```
- **Finding:** **`PASS` on Search Path Lockdown / `NEEDS ATTENTION` on Privilege Grant**
- **Analysis:** All three functions enforce `SET search_path = public, pg_temp`. Search path poisoning is impossible. Restricting `GRANT EXECUTE` strictly to `service_role` completes the security boundary.

---

### CHECK 4 — DELIVERY LEDGER RLS COVERAGE

- **Migration:** `supabase/migrations/20261122_027_meta_social_critical_fixes.sql`
- **Location:** Lines 145–163
- **Exact SQL:**
  ```sql
  ALTER TABLE public.meta_social_deliveries ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "service_role_meta_social_deliveries" ON public.meta_social_deliveries;
  CREATE POLICY "service_role_meta_social_deliveries"
      ON public.meta_social_deliveries
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);

  DROP POLICY IF EXISTS "Tenant isolation for meta_social_deliveries select" ON public.meta_social_deliveries;
  CREATE POLICY "Tenant isolation for meta_social_deliveries select"
      ON public.meta_social_deliveries
      FOR SELECT
      TO authenticated
      USING (
          (select public.check_user_business_access(business_id))
          OR (select public.is_superadmin())
      );
  ```
- **Finding:** **`PASS`**
- **Security Analysis:**
  1. `service_role` has full CRUD permissions (`FOR ALL`), allowing background workers and webhook processors to insert, select, and update delivery states.
  2. `authenticated` has tenant-isolated `FOR SELECT`, enabling UI users to view delivery attempts for their business.
  3. `INSERT`, `UPDATE`, and `DELETE` have **no policy** defined for `authenticated` or `anon`. Under PostgreSQL RLS default-deny semantics, write attempts by client roles are rejected at the database engine level. This ensures delivery ledgers remain untampered audit records.

---

### CHECK 5 — STAGING SCHEMA & RECORD COMPATIBILITY

- **Current Staging Data Catalog (`ansiwtwqgrfmzfrhkzuu`):**
  - `meta_social_connections`: 2 records (Instagram: `17841407289805239`, Facebook: `1408545542343822`). Duplicate account count = 0.
  - `meta_social_credentials`: 2 records. Both map to valid `connection_id` and `business_id` in `meta_social_connections`.
  - `meta_social_rules`: 16 records. All have `business_id = '11111111-1111-1111-1111-111111111111'` and `connection_id IS NULL`.
  - `meta_social_events`: 1 record (`f7c7aae3-41df-467b-b37a-046158ce0b75`). Correctly maps to business and Facebook connection.
- **DDL Execution Verification:**
  - `ALTER TABLE public.meta_social_connections DROP CONSTRAINT IF EXISTS ...` drops old tenant-scoped constraint.
  - `ALTER TABLE public.meta_social_connections ADD CONSTRAINT ... UNIQUE (platform, account_id)` executes without conflict (0 duplicate accounts exist).
  - Immutability triggers use `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`.
- **Finding:** **`PASS`**. Migration 027 will execute cleanly and safely against the live staging database.

---

### CHECK 6 — MIGRATION DEPENDENCY CHAIN (027 → 028)

- **Verification:**
  - Migration 028 modifies `meta_social_deliveries`:
    - Line 47: `ALTER TABLE public.meta_social_deliveries DROP CONSTRAINT IF EXISTS meta_social_deliveries_status_check;`
    - Line 51: `ALTER TABLE public.meta_social_deliveries ADD CONSTRAINT meta_social_deliveries_status_check ...`
    - Line 62: `ALTER TABLE public.meta_social_deliveries ADD COLUMN IF NOT EXISTS claimed_by TEXT, ...`
    - Line 78: `CREATE INDEX IF NOT EXISTS idx_meta_social_deliveries_retry ON public.meta_social_deliveries ...`
  - `meta_social_deliveries` is created in **Migration 027** (Lines 103–129).
  - If Migration 028 is executed before Migration 027, it will fail with `relation "meta_social_deliveries" does not exist`.
  - Migration 028 does not reference any external uncommitted objects.
- **Finding:** **`PASS`**. Strict dependency order is confirmed: Migration 027 **must** precede Migration 028.

---

### CHECK 7 — BLAST RADIUS & WHATSAPP NON-INTERFERENCE

- **Verification:**
  - Neither migration drops any tables, columns, or views.
  - Neither migration modifies or references WhatsApp tables (`wa_connections`, `wa_messages`, `wa_contacts`, `wa_conversations`, `wa_processing_jobs`, `wa_message_templates`, `wa_campaigns`, `wa_scheduled_messages`, etc.).
  - All status constraints expanded in Migration 028 preserve all existing statuses (`received`, `processing`, `processed`, `replied`, `failed`, `ignored`) and add only new lifecycle statuses (`retry_scheduled`, `permanently_failed`, `ambiguous_outcome`).
- **Finding:** **`PASS`**. The blast radius is strictly isolated to the `meta_social_*` subsystem. Zero impact on WhatsApp operations.

---

## 2. REQUIRED CORRECTIONS PRIOR TO APPLYING

Before applying Migration 027 and Migration 028, the privilege grants must be hardened to restrict execution strictly to `service_role`:

### Correction 1 — Migration 027 (Line 280)
```sql
-- BEFORE:
GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;

-- AFTER (HARDENED):
GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
```

### Correction 2 — Migration 028 (Lines 213 & 216)
```sql
-- BEFORE:
GRANT EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) TO authenticated, service_role;

-- AFTER (HARDENED):
GRANT EXECUTE ON FUNCTION public.claim_meta_social_events(TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(INT) TO service_role;
```

---

## 3. FINAL RECOMMENDATION

### **STATUS: READY FOR MIGRATION 027 UPON APPROVAL OF PRIVILEGE PATCH**

1. Apply the privilege grant patch to Migration 027 (restricting `ingest_meta_social_event_atomic` execution strictly to `service_role`).
2. Stand by for your explicit authorization before executing Migration 027 on staging.
3. Stand by for a separate explicit authorization before executing Migration 028 on staging.
