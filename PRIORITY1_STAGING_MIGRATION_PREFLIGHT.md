# PRIORITY 1 — STAGING DATABASE MIGRATION PREFLIGHT REPORT
## Gokul Connect — Meta Social Automation (Facebook & Instagram)

**Project:** Gokul Connect  
**Repository Branch:** `phase-13b-critical-remediation`  
**Target Environment:** Supabase Staging (`ansiwtwqgrfmzfrhkzuu`)  
**Target URL:** `https://ansiwtwqgrfmzfrhkzuu.supabase.co`  
**Execution Timestamp:** 2026-11-22T19:42:00+05:30  
**Auditor:** Autonomous Senior Systems & PostgreSQL Security Specialist  
**Document Purpose:** Independent Preflight Audit for Controlled Staging Migration Deployment  

---

## 1. PREFLIGHT EXECUTIVE SUMMARY & VERDICT

| Preflight Evaluation Metric | Result | Details |
|---|:---:|---|
| **Staging Project Targeted** | **VERIFIED** | Supabase project `ansiwtwqgrfmzfrhkzuu` |
| **Migration 026 Status** | **APPLIED** | `meta_social_*` tables and 10-param RPC active |
| **Migration 027 Status** | **PENDING** | Table `meta_social_deliveries` and columns absent |
| **Migration 028 Status** | **PENDING** | Worker RPCs and lease columns absent |
| **SQL Syntax & Compilation** | **PASS** | Validated via PostgreSQL engine & PGlite regression |
| **Staging Data Compatibility** | **PASS** | 2 connections (unique), 2 creds, 1 event, 16 rules |
| **Least-Privilege Security** | **PASS** | All RPCs restricted strictly to `service_role` |
| **RLS Policy Coverage** | **PASS** | `meta_social_deliveries` tenant-isolated SELECT; write denied |
| **Application Order Safety** | **PASS** | Strict order: 027 must precede 028 |
| **WhatsApp Non-Interference** | **PASS** | Zero references or impacts to WhatsApp tables/RPCs |
| **Rollback Preparedness** | **PASS** | Complete SQL inversion playbook prepared |
| **Migration History Repair** | **DOCUMENTED** | Clear CLI repair & transactional SQL options detailed |

```
================================================================================
FINAL VERDICT: READY TO APPLY
Sequential Order: Migration 027 -> Migration 028
================================================================================
```

---

## 2. STAGING DATABASE MIGRATION HISTORY & BASELINE STATE

### 2.1 Live Staging Project Verification
- **Project ID:** `ansiwtwqgrfmzfrhkzuu`
- **Region / Endpoint:** `https://ansiwtwqgrfmzfrhkzuu.supabase.co`
- **PostgREST API:** Functional and responding with active session keys.

### 2.2 Migration 026 Applied Status (EMPIRICAL VERIFICATION)
Live catalog queries against staging confirm that **Migration 026 (`20261121_026_meta_social_automation.sql`) is APPLIED and ACTIVE**:

1. **`public.meta_social_connections`**:
   - Status: **EXISTS**
   - Active Columns: `id`, `business_id`, `platform`, `account_id`, `account_name`, `username`, `page_id`, `credential_ref`, `connection_status`, `is_enabled`, `auto_reply_dms`, `auto_reply_comments`, `auto_dm_on_comment`, `comment_dm_trigger_keywords`, `default_comment_reply`, `last_webhook_at`, `last_reply_at`, `metadata`, `created_at`, `updated_at`.
   - Records Present: 2 active connections (1 Facebook Page, 1 Instagram Professional account).

2. **`public.meta_social_credentials`**:
   - Status: **EXISTS**
   - Active Columns: `id`, `connection_id`, `business_id`, `key_version`, `iv`, `auth_tag`, `ciphertext`, `created_at`, `updated_at`.
   - Records Present: 2 encrypted credential envelopes.

3. **`public.meta_social_events`**:
   - Status: **EXISTS**
   - Active Columns: `id`, `business_id`, `connection_id`, `platform`, `event_type`, `meta_event_id`, `sender_id`, `sender_name`, `post_id`, `comment_id`, `parent_comment_id`, `content`, `status`, `matched_rule_id`, `reply_type`, `reply_content`, `error_message`, `created_at`.
   - Records Present: 1 event record (`status: 'failed'`).

4. **`public.meta_social_rules`**:
   - Status: **EXISTS**
   - Records Present: 16 automated response rules.

5. **Legacy Ingestion RPC (`ingest_meta_social_event_atomic` - 10 Parameters)**:
   - Status: **EXISTS & CALLABLE**
   - Calling the 10-parameter signature from Migration 026 successfully executes:
     ```json
     { "reason": "no_active_connection_found", "status": "ignored" }
     ```

### 2.3 Migrations 027 and 028 Pending Status (EMPIRICAL VERIFICATION)
Live catalog queries against staging confirm that **Migrations 027 and 028 are PENDING (NOT APPLIED)**:

1. **`public.meta_social_deliveries` Table**:
   - Query: `adminClient.from('meta_social_deliveries').select('id')`
   - Response: `PGRST205: Could not find the table 'public.meta_social_deliveries' in the schema cache`
   - **Conclusion: Migration 027 is NOT applied.**

2. **Migration 027 Columns on `meta_social_connections`**:
   - `default_dm_reply` and `token_expires_at` are **ABSENT**.

3. **Migration 027 Columns on `meta_social_events`**:
   - `public_reply_status`, `private_reply_status`, `public_reply_id`, `private_reply_id`, and `event_timestamp` are **ABSENT**.

4. **11-Parameter Ingestion RPC (`ingest_meta_social_event_atomic` with `p_event_timestamp`)**:
   - Status: **ABSENT** from the PostgREST schema cache.

5. **Migration 028 Queue Worker RPCs**:
   - `claim_meta_social_events(p_worker_id, p_batch_size, p_lease_seconds)`: **ABSENT** (`Could not find the function public.claim_meta_social_events in the schema cache`).
   - `reclaim_stuck_meta_social_events(p_timeout_seconds)`: **ABSENT** (`Could not find the function public.reclaim_stuck_meta_social_events in the schema cache`).

6. **Migration 028 Columns on `meta_social_events`**:
   - Worker lease and retry columns (`claimed_by`, `claimed_at`, `lease_expires_at`, `attempt_count`, `max_attempts`, `next_retry_at`, `updated_at`) are **ABSENT**.

---

## 3. COMPREHENSIVE MIGRATION FILE CODE AUDIT

### 3.1 Migration File 1: `20261122171900_027_meta_social_critical_fixes.sql`

#### Purpose:
Remediates critical data integrity, multi-tenant boundary, and race-condition vulnerabilities identified during Phase 13A/13B audits.

#### Section-by-Section SQL Verification:
1. **Section 1: Connection Uniqueness & Column Additions (Lines 22–34)**:
   - Drops `uq_meta_social_connections_tenant_platform_account` (scoped to `business_id, platform, account_id`).
   - Adds `uq_meta_social_connections_global_platform_account` (`UNIQUE (platform, account_id)`).
   - Adds `default_dm_reply TEXT DEFAULT '...'` and `token_expires_at TIMESTAMPTZ`.
   - *Verification:* Syntax is valid; staging data has zero duplicate `(platform, account_id)` pairs.

2. **Section 2: Composite Foreign Keys (Lines 41–69)**:
   - Adds `FOREIGN KEY (connection_id, business_id) REFERENCES public.meta_social_connections(id, business_id) ON DELETE CASCADE` on `meta_social_credentials`, `meta_social_rules`, and `meta_social_events`.
   - *Verification:* `public.meta_social_connections` has `CONSTRAINT uq_meta_social_connections_id_business UNIQUE (id, business_id)` created in Migration 026. Referenced unique keys exist and match.

3. **Section 3: Tenant Immutability Triggers (Lines 75–86)**:
   - Installs `BEFORE UPDATE` triggers executing `public.prevent_tenant_reassignment()` on `meta_social_credentials` and `meta_social_events`.
   - *Verification:* The function `prevent_tenant_reassignment()` is a pre-existing trusted foundation function from Phase 1.

4. **Section 4: Outbound Delivery State Columns on `meta_social_events` (Lines 90–98)**:
   - Adds `public_reply_status` and `private_reply_status` with check constraints `('none', 'pending', 'replied', 'failed', 'skipped')`.
   - Adds `public_reply_id`, `private_reply_id`, and `event_timestamp TIMESTAMPTZ`.
   - *Verification:* Uses `ADD COLUMN IF NOT EXISTS`; safe for zero-downtime execution.

5. **Section 5: `meta_social_deliveries` Table (Lines 103–163)**:
   - Dedicated delivery tracking ledger with UUID primary key, composite foreign keys referencing `meta_social_connections(id, business_id)` and `meta_social_events(id, business_id)`.
   - Enforces unique `idempotency_key`, preventing duplicate outbound Meta Graph API requests.
   - Includes partial queue index `idx_meta_social_deliveries_queue` on `(status, next_retry_at ASC) WHERE status IN ('pending', 'retry_scheduled')`.
   - Attaches `prevent_tenant_reassignment()` trigger.
   - Enables Row Level Security (RLS) with policies for `service_role` (full access) and `authenticated` (tenant-isolated `SELECT`).

6. **Section 6: Hardened Atomic Ingestion RPC (Lines 170–294)**:
   - Explicitly drops the legacy 10-parameter signature `public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)` to eliminate overload ambiguity.
   - Creates new 11-parameter function with `p_event_timestamp TIMESTAMPTZ DEFAULT NULL`.
   - Uses atomic `INSERT INTO public.meta_social_events ... ON CONFLICT (business_id, meta_event_id) DO NOTHING RETURNING id INTO v_event_id`.
   - Correctly detects duplicates without race conditions by falling back to `SELECT id` when `v_event_id IS NULL`.
   - Sets `SECURITY DEFINER` with fixed `SET search_path = public, pg_temp` protecting against search path hijacking.
   - Privilege Hardening:
     ```sql
     REVOKE ALL ON FUNCTION public.ingest_meta_social_event_atomic(...) FROM PUBLIC;
     REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(...) FROM PUBLIC;
     REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(...) FROM anon;
     REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(...) FROM authenticated;
     GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(...) TO service_role;
     ```

---

### 3.2 Migration File 2: `20261122172000_028_meta_social_worker_reliability.sql`

#### Purpose:
Implements durable background queue mechanics, distributed leasing, atomic worker locking via `FOR UPDATE SKIP LOCKED`, and stuck-job recovery.

#### Section-by-Section SQL Verification:
1. **Section 1: Expand Status Check Constraints & Lease Fields (Lines 20–65)**:
   - Expands `meta_social_events_status_check` to:
     `('received', 'processing', 'processed', 'replied', 'failed', 'retry_scheduled', 'permanently_failed', 'ambiguous_outcome', 'ignored')`.
   - Adds worker lease columns to `meta_social_events`: `claimed_by`, `claimed_at`, `lease_expires_at`, `attempt_count INT DEFAULT 0`, `max_attempts INT DEFAULT 3`, `next_retry_at`, `updated_at`.
   - Expands `meta_social_deliveries_status_check` to:
     `('pending', 'processing', 'succeeded', 'failed', 'retry_scheduled', 'permanently_failed', 'ambiguous_outcome')`.
   - Adds worker lease columns to `meta_social_deliveries`: `claimed_by`, `claimed_at`, `lease_expires_at`.
   - *Verification:* Staging's existing event has status `'failed'`, which is valid under the expanded constraint.

2. **Section 2: High-Performance Queue Indexes (Lines 70–81)**:
   - `idx_meta_social_events_claim_queue`: partial index on `(status, created_at ASC) WHERE status IN ('received', 'retry_scheduled', 'processing')`.
   - `idx_meta_social_events_retry`: partial index on `(status, next_retry_at ASC) WHERE status = 'retry_scheduled'`.
   - `idx_meta_social_deliveries_retry`: partial index on `(status, next_retry_at ASC) WHERE status IN ('pending', 'retry_scheduled', 'processing')`.
   - *Verification:* Indexes optimize worker claim queries from sequential table scans to direct index scans.

3. **Section 3: Worker Claim RPC `claim_meta_social_events` (Lines 89–133)**:
   - Parameters: `p_worker_id TEXT`, `p_batch_size INT DEFAULT 10`, `p_lease_seconds INT DEFAULT 300`.
   - Returns: `SETOF public.meta_social_events`.
   - Concurrency Safety: Uses CTE with `FOR UPDATE SKIP LOCKED`. Concurrent worker threads will never block each other or claim identical rows.
   - Increments `attempt_count` atomically upon claim.
   - Sets `SECURITY DEFINER` with fixed `search_path = public, pg_temp`.

4. **Section 4: Stuck Job Recovery RPC `reclaim_stuck_meta_social_events` (Lines 142–207)**:
   - Parameters: `p_timeout_seconds INT DEFAULT 300`.
   - Returns `JSONB` with `{ reclaimed, exhausted, timestamp }`.
   - Two-phase recovery:
     1. Transitions expired jobs at or above `max_attempts` to `'permanently_failed'`.
     2. Resets expired jobs below `max_attempts` back to `'received'` for re-claiming.
   - Uses `FOR UPDATE SKIP LOCKED` during inspection.
   - Sets `SECURITY DEFINER` with fixed `search_path = public, pg_temp`.

5. **Section 5: Privilege Hardening (Lines 212–228)**:
   - Strict least-privilege scoping:
     ```sql
     REVOKE ALL ON FUNCTION public.claim_meta_social_events(...) FROM PUBLIC;
     REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(...) FROM PUBLIC;
     REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(...) FROM anon;
     REVOKE EXECUTE ON FUNCTION public.claim_meta_social_events(...) FROM authenticated;
     GRANT EXECUTE ON FUNCTION public.claim_meta_social_events(...) TO service_role;

     REVOKE ALL ON FUNCTION public.reclaim_stuck_meta_social_events(...) FROM PUBLIC;
     REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(...) FROM PUBLIC;
     REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(...) FROM anon;
     REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(...) FROM authenticated;
     GRANT EXECUTE ON FUNCTION public.reclaim_stuck_meta_social_events(...) TO service_role;
     ```

---

## 4. RELATIONAL INTEGRITY & STAGING DATA COMPATIBILITY

### 4.1 Connection Uniqueness Audit
- **Requirement:** `ADD CONSTRAINT uq_meta_social_connections_global_platform_account UNIQUE (platform, account_id)`.
- **Live Staging Data Audit:**
  - Row 1: `platform: 'instagram'`, `account_id: '17841407289805239'`
  - Row 2: `platform: 'facebook'`, `account_id: '1408545542343822'`
  - Duplicate count: **0**.
  - **Verdict:** Constraint will apply with zero conflicts.

### 4.2 Composite Foreign Key Compatibility Audit
- **Credentials:** 2 credentials exist on staging; both have `connection_id` and `business_id` referencing active connection records.
- **Events:** 1 event exists on staging; matches connection and business.
- **Rules (`meta_social_rules`):**
  - 16 rules exist on staging, all with `connection_id = NULL`.
  - **PostgreSQL Semantic Verification:** Under PostgreSQL standard `MATCH SIMPLE` foreign key semantics, composite foreign keys with one or more `NULL` components (`connection_id IS NULL`, `business_id IS NOT NULL`) do not enforce referenced row presence.
  - Adding `CONSTRAINT fk_meta_social_rules_conn_biz FOREIGN KEY (connection_id, business_id) REFERENCES public.meta_social_connections(id, business_id)` succeeds cleanly and permits tenant-wide rules.

---

## 5. SECURITY, PRIVILEGES & RLS POLICY VERIFICATION

### 5.1 RPC Execution Privilege Matrix

| Function Name | `PUBLIC` | `anon` | `authenticated` | `service_role` | Security Assessment |
|---|:---:|:---:|:---:|:---:|---|
| `ingest_meta_social_event_atomic` | **REVOKED** | **REVOKED** | **REVOKED** | **GRANTED** | **SECURE** — Ingestion limited strictly to webhook handler |
| `claim_meta_social_events` | **REVOKED** | **REVOKED** | **REVOKED** | **GRANTED** | **SECURE** — Queue claiming isolated from client users |
| `reclaim_stuck_meta_social_events` | **REVOKED** | **REVOKED** | **REVOKED** | **GRANTED** | **SECURE** — Recovery isolated from client users |

### 5.2 Delivery Ledger RLS Matrix (`meta_social_deliveries`)

| Role | Operation | Permission | Enforcement Mechanism |
|---|---|:---:|---|
| `anon` | `SELECT` / `INSERT` / `UPDATE` / `DELETE` | **DENIED** | Default Deny (no policy matches) |
| `authenticated` | `SELECT` | **PERMITTED** | `check_user_business_access(business_id) OR is_superadmin()` |
| `authenticated` | `INSERT` / `UPDATE` / `DELETE` | **DENIED** | Default Deny (no write policy) |
| `service_role` | `ALL` | **PERMITTED** | Policy `service_role_meta_social_deliveries` (`USING (true) WITH CHECK (true)`) |

---

## 6. MIGRATION ORDER & DEPENDENCY CHAIN

```
┌────────────────────────────────────────────────────────┐
│ MIGRATION 026 (Applied)                                │
│ - meta_social_connections                              │
│ - meta_social_credentials                              │
│ - meta_social_events                                   │
│ - meta_social_rules                                    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ MIGRATION 027 (Pending - Step 1)                       │
│ - Creates meta_social_deliveries                       │
│ - Adds default_dm_reply, token_expires_at              │
│ - Adds event_timestamp, reply status columns           │
│ - Drops 10-param RPC, creates 11-param RPC             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ MIGRATION 028 (Pending - Step 2)                       │
│ - Modifies meta_social_deliveries (from 027)           │
│ - Expands status check constraints                     │
│ - Adds worker lease columns (claimed_by, etc.)         │
│ - Creates claim & recovery worker RPCs                 │
└────────────────────────────────────────────────────────┘
```

### Safety and Ordering Rules:
1. **Migration 028 STRICTLY DEPENDS on Migration 027**:
   - Migration 028 runs `ALTER TABLE public.meta_social_deliveries DROP CONSTRAINT ...` and `ADD COLUMN ...`.
   - Because `meta_social_deliveries` is created in Migration 027, applying Migration 028 first will immediately abort with `ERROR: relation "public.meta_social_deliveries" does not exist`.
2. **Order of Application MUST BE**:
   - **Step 1:** Apply `20261122171900_027_meta_social_critical_fixes.sql`
   - **Step 2:** Apply `20261122172000_028_meta_social_worker_reliability.sql`
3. **WhatsApp Isolation**:
   - Zero modifications to `wa_*` tables, WhatsApp webhook RPCs, or WhatsApp campaign/CRM tables.

---

## 7. COMPREHENSIVE ROLLBACK STRATEGY

If an operational anomaly occurs during migration application, execute the following SQL reversal procedures in reverse order:

### 7.1 Rollback Migration 028:

```sql
-- ROLLBACK 028: Reverse Worker Reliability & Queues
BEGIN;

-- 1. Drop worker RPCs
DROP FUNCTION IF EXISTS public.claim_meta_social_events(TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.reclaim_stuck_meta_social_events(INT);

-- 2. Drop partial queue indexes
DROP INDEX IF EXISTS public.idx_meta_social_events_claim_queue;
DROP INDEX IF EXISTS public.idx_meta_social_events_retry;
DROP INDEX IF EXISTS public.idx_meta_social_deliveries_retry;

-- 3. Drop lease columns from meta_social_deliveries
ALTER TABLE public.meta_social_deliveries
    DROP COLUMN IF EXISTS claimed_by,
    DROP COLUMN IF EXISTS claimed_at,
    DROP COLUMN IF EXISTS lease_expires_at;

-- 4. Revert status constraint on meta_social_deliveries
ALTER TABLE public.meta_social_deliveries
    DROP CONSTRAINT IF EXISTS meta_social_deliveries_status_check;

ALTER TABLE public.meta_social_deliveries
    ADD CONSTRAINT meta_social_deliveries_status_check
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'retry_scheduled', 'permanently_failed'));

-- 5. Drop worker columns from meta_social_events
ALTER TABLE public.meta_social_events
    DROP COLUMN IF EXISTS claimed_by,
    DROP COLUMN IF EXISTS claimed_at,
    DROP COLUMN IF EXISTS lease_expires_at,
    DROP COLUMN IF EXISTS attempt_count,
    DROP COLUMN IF EXISTS max_attempts,
    DROP COLUMN IF EXISTS next_retry_at,
    DROP COLUMN IF EXISTS updated_at;

-- 6. Revert status constraint on meta_social_events
ALTER TABLE public.meta_social_events
    DROP CONSTRAINT IF EXISTS meta_social_events_status_check;

ALTER TABLE public.meta_social_events
    ADD CONSTRAINT meta_social_events_status_check
    CHECK (status IN ('received', 'processed', 'replied', 'failed', 'ignored'));

COMMIT;
```

### 7.2 Rollback Migration 027:

```sql
-- ROLLBACK 027: Reverse Critical Fixes & Ledger
BEGIN;

-- 1. Revert Ingestion RPC: Drop 11-param and recreate 10-param from Migration 026
DROP FUNCTION IF EXISTS public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ);

-- Recreate 10-param signature (Migration 026 baseline)
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
    p_content TEXT
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
    SELECT * INTO v_connection
    FROM public.meta_social_connections
    WHERE platform = p_platform
      AND (account_id = p_account_id OR page_id = p_account_id)
      AND is_enabled = true
      AND connection_status = 'connected'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'ignored', 'reason', 'no_active_connection_found');
    END IF;

    INSERT INTO public.meta_social_events (
        business_id, connection_id, platform, event_type, meta_event_id,
        sender_id, sender_name, post_id, comment_id, parent_comment_id, content, status
    ) VALUES (
        v_connection.business_id, v_connection.id, p_platform, p_event_type, p_meta_event_id,
        p_sender_id, p_sender_name, p_post_id, p_comment_id, p_parent_comment_id, p_content, 'received'
    )
    ON CONFLICT (business_id, meta_event_id) DO NOTHING
    RETURNING id INTO v_event_id;

    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id FROM public.meta_social_events
        WHERE business_id = v_connection.business_id AND meta_event_id = p_meta_event_id;
        RETURN jsonb_build_object('status', 'duplicate', 'event_id', v_event_id);
    END IF;

    RETURN jsonb_build_object('status', 'ingested', 'event_id', v_event_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 2. Drop meta_social_deliveries table
DROP TABLE IF EXISTS public.meta_social_deliveries CASCADE;

-- 3. Drop outbound tracking columns from meta_social_events
ALTER TABLE public.meta_social_events
    DROP COLUMN IF EXISTS public_reply_status,
    DROP COLUMN IF EXISTS private_reply_status,
    DROP COLUMN IF EXISTS public_reply_id,
    DROP COLUMN IF EXISTS private_reply_id,
    DROP COLUMN IF EXISTS event_timestamp;

-- 4. Revert composite foreign keys to standard connection foreign keys
ALTER TABLE public.meta_social_credentials DROP CONSTRAINT IF EXISTS fk_meta_social_credentials_conn_biz;
ALTER TABLE public.meta_social_rules DROP CONSTRAINT IF EXISTS fk_meta_social_rules_conn_biz;
ALTER TABLE public.meta_social_events DROP CONSTRAINT IF EXISTS fk_meta_social_events_conn_biz;

-- 5. Drop immutability triggers
DROP TRIGGER IF EXISTS trg_meta_social_credentials_immutable_business_id ON public.meta_social_credentials;
DROP TRIGGER IF EXISTS trg_meta_social_events_immutable_business_id ON public.meta_social_events;

-- 6. Revert global uniqueness on meta_social_connections to tenant-scoped
ALTER TABLE public.meta_social_connections DROP CONSTRAINT IF EXISTS uq_meta_social_connections_global_platform_account;
ALTER TABLE public.meta_social_connections
    ADD CONSTRAINT uq_meta_social_connections_tenant_platform_account
    UNIQUE (business_id, platform, account_id);

ALTER TABLE public.meta_social_connections
    DROP COLUMN IF EXISTS default_dm_reply,
    DROP COLUMN IF EXISTS token_expires_at;

COMMIT;
```

---

## 8. SUPABASE MIGRATION HISTORY REPAIR & RECONCILIATION

### 8.1 Migration Ledger Drift Context
When executing DDL in the Supabase Dashboard SQL Editor, PostgreSQL runs queries directly in `public`. The SQL Editor does **not** automatically insert rows into `supabase_migrations.schema_migrations`.

To prevent version drift between the remote database and future CLI commands (`supabase db push`), the migration ledger must be updated.

### 8.2 Standard Supabase CLI Repair Commands:

Execute from terminal with access token exported:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
npx supabase migration repair --status applied 20261122171900 --remote
npx supabase migration repair --status applied 20261122172000 --remote
```

### 8.3 Zero-Token Alternative (In-Transaction Ledger Registration):

If applying migrations via the Supabase Dashboard SQL Editor without a CLI token, the operator can append the following ledger registration statements directly to the respective migration blocks:

**For Migration 027:**
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
    '20261122171900',
    '027_meta_social_critical_fixes',
    ARRAY['-- Applied via Gokul Connect Staging Migration Preflight']
)
ON CONFLICT (version) DO UPDATE
SET name = EXCLUDED.name, statements = EXCLUDED.statements;
```

**For Migration 028:**
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
    '20261122172000',
    '028_meta_social_worker_reliability',
    ARRAY['-- Applied via Gokul Connect Staging Migration Preflight']
)
ON CONFLICT (version) DO UPDATE
SET name = EXCLUDED.name, statements = EXCLUDED.statements;
```

---

## 9. FINAL PREFLIGHT VERDICT

```
================================================================================
                               FINAL VERDICT
                              READY TO APPLY
================================================================================
```

### Deployment Approval Summary:
1. **Migration 026** is confirmed active on staging (`ansiwtwqgrfmzfrhkzuu`).
2. **Migrations 027 and 028** are validated as completely pending.
3. Both migration scripts are free of SQL errors, have proper `SET search_path = public, pg_temp`, strictly revoke privileges from `PUBLIC`/`anon`/`authenticated`, and grant execution exclusively to `service_role`.
4. RLS policies on `meta_social_deliveries` enforce strict tenant boundaries.
5. Strict execution order is verified: **Apply Migration 027 first, followed by Migration 028**.
6. Rollback SQL and migration history repair commands are completely specified.
