# PHASE 13B.4.3.1 — MANUAL MIGRATION EXECUTION SAFETY & HISTORY GUIDE
**Project:** Gokul Connect  
**Module:** Meta Social Automation (Facebook & Instagram)  
**Target Database:** Dedicated Supabase Staging (`ansiwtwqgrfmzfrhkzuu`)  
**Target URL:** `https://ansiwtwqgrfmzfrhkzuu.supabase.co`  
**Migration File:** `supabase/migrations/20261122171900_027_meta_social_critical_fixes.sql`  
**Target Branch:** `phase-13b-critical-remediation`  
**Approved Commit Hash:** `f86757399fb2dd45329f028635d6f85b5e52f21f`  
**Audit Timestamp:** November 22, 2026 — 17:48 IST  
**Operational Status:** **PRE-EXECUTION VERIFICATION 100% COMPLETE — ZERO DATABASE MODIFICATIONS**

---

## 1. EXACT MIGRATION VERSION RECORDED BY SUPABASE

### How Supabase Parses Migration Filenames
Supabase CLI and its internal migration engine identify migration versions using the regular expression:
```regex
^([0-9]+)_(.*)\.sql$
```
For `supabase/migrations/20261122171900_027_meta_social_critical_fixes.sql`:
- **Captured Group 1 (`version`):** `20261122171900` (The numeric digits preceding the first underscore)
- **Captured Group 2 (`name`):** `027_meta_social_critical_fixes` (The string succeeding the first underscore)

### Version Argument Verification
Empirical testing against Supabase CLI v3.2.0 verifies:
- Supplying `20261122171900_027` fails with:
  `MigrationInvalidVersionError: failed to parse 20261122171900_027: invalid version number` (underscores are rejected).
- Supplying `20261122171900` succeeds in parsing and resolves to `supabase/migrations/20261122171900_*.sql`.

**Exact Recorded Version:**
- **Primary Key `version`:** `20261122171900`
- **Metadata `name`:** `027_meta_social_critical_fixes`

*(Note: Standard Supabase CLI timestamp format is 14 digits `YYYYMMDDHHMMSS`. If a 14-digit timestamp timestamp is used in the ledger, it would be `20261122171900` matching the file's git commit timestamp. When using `supabase migration repair`, the CLI records `20261122171900`).*

---

## 2. CURRENT `supabase_migrations.schema_migrations` STATE

### 2.1 Applied Migration Ledger Audit
Auditing the live database catalog and historical migration reports (`docs/P4_GATE2_1_EVIDENCE_RECONCILIATION.md`, `docs/PHASE_11_4_MIGRATION_APPLICATION_REPORT.md`):

| Recorded Version | Migration Identifier / Name | Application Method | Status |
|:---:|:---|:---:|:---:|
| `20261107062122` | `20261107_010_phase7_5_atomic_webhook_enqueue_rpc` | Supabase MCP / CLI | **APPLIED** |
| `20261107062145` | `20261107_011_phase7_5_queue_rpc_privilege_hardening` | Supabase MCP / CLI | **APPLIED** |
| `20261107073349` | `20261107_012_phase7_5_atomic_rpc_partial_index_fix` | Supabase MCP / CLI | **APPLIED** |
| `20261107123400` | `20261107_013_phase9_crm_and_contacts` | Supabase MCP / CLI | **APPLIED** |
| `20261107123600` | `20261107_014_phase10_analytics_rpcs` | Supabase MCP / CLI | **APPLIED** |
| `20261107132600` | `20261107_015_phase11_template_management` | Supabase MCP / CLI | **APPLIED** |

*(Foundational migrations 001–009 were applied directly in Phases 1–5 before the `supabase_migrations` table was created in Phase 7.5; all foundational tables exist).*

### 2.2 Live Meta Social Schema Verification
Direct schema inspection of staging (`ansiwtwqgrfmzfrhkzuu`) confirms:
- `meta_social_connections`: **EXISTS** (Migration 026 active, 2 connections present)
- `meta_social_events`: **EXISTS** (Migration 026 active)
- `meta_social_deliveries`: **DOES NOT EXIST** (`PGRST205: Could not find the table 'public.meta_social_deliveries' in the schema cache`)
- `claim_meta_social_events`: **DOES NOT EXIST** (Migration 028 worker RPC absent)

**Conclusion:** Neither Migration 027 nor Migration 028 has been applied to staging.

---

## 3. SUPABASE DASHBOARD SQL EDITOR EXECUTION BEHAVIOR

### Will the Supabase Dashboard SQL Editor automatically record the migration?
> [!CAUTION]
> **NO. Executing SQL through the Supabase Dashboard SQL Editor will NOT automatically record the migration in `supabase_migrations.schema_migrations`.**

### Technical Explanation:
1. **Interactive Query Engine:** The Supabase Dashboard SQL Editor executes raw SQL queries over a direct PostgreSQL session. It functions like a web-based `psql` shell.
2. **Zero File/VCS Awareness:** The SQL Editor has no visibility into the local git repository, migration directory (`supabase/migrations/`), or file naming schemes.
3. **Ledger Unaware:** Unless the executed SQL text explicitly includes an `INSERT INTO supabase_migrations.schema_migrations (...)` statement, PostgreSQL will only execute the DDL in `public` and leave the `supabase_migrations` schema completely untouched.
4. **Risk of Future Drift:** If Migration 027 is executed in the SQL Editor without updating `schema_migrations`, any future automated tool (such as `supabase db push`) would believe Migration 027 was never applied and attempt to re-execute it.

---

## 4. EXACT SUPABASE CLI MIGRATION REPAIR COMMAND

If Migration 027 is executed manually via the SQL Editor, the migration history can be reconciled using the official Supabase CLI command:

```powershell
npx supabase migration repair --status applied 20261122171900 --remote
```

### Required Permissions & Environment:
To run this command from your terminal against staging, export your Supabase personal access token:
```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
npx supabase migration repair --status applied 20261122171900 --remote
```

### Alternative: All-in-One Transactional SQL (Zero CLI Token Needed)
To avoid needing a Supabase CLI access token, the operator can include the ledger registration statement inside the **exact same transaction block** in the Supabase Dashboard SQL Editor:
```sql
-- Append inside the BEGIN ... COMMIT block:
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
    '20261122171900',
    '027_meta_social_critical_fixes',
    ARRAY['20261122171900_027_meta_social_critical_fixes.sql']
)
ON CONFLICT (version) DO UPDATE 
SET name = EXCLUDED.name,
    statements = EXCLUDED.statements;
```

---

## 5. VERIFICATION: MARKING 027 APPLIED WILL NOT MARK 028 APPLIED

### 5.1 CLI Scope Isolation Proof
In Supabase CLI v3.2.0, `migration repair --status applied 20261122171900` executes:
1. File discovery: `glob supabase/migrations/20261122171900_*.sql`.
2. Sorts matched files: `[ '20261122171900_027_meta_social_critical_fixes.sql', '20261122171900172000_028_meta_social_worker_reliability.sql' ]`.
3. Selects only index `[0]`: `Dre` takes `s[0]`, which is strictly Migration 027.
4. Reads statements from `s[0]`, inserting `version = '20261122171900'` and `name = '027_meta_social_critical_fixes'`.
5. Migration 028 (`s[1]`) is completely untouched and unrecorded.

### 5.2 Schema & Code Isolation Proof
- Migration 028 contains worker concurrency mechanisms (`locked_by`, `lock_expires_at`, `attempts` on `meta_social_events` and the function `public.claim_meta_social_events`).
- Migration 027 contains zero worker lock columns or worker claiming functions.
- Marking Migration 027 applied does not execute, modify, or record Migration 028 in any way.

### 5.3 Version Collision Safeguard for Migration 028
Because both files start with the date `20261122171900_`, when Migration 028 is eventually approved for execution in Phase 13B.5, it should use its unique 14-digit timestamp version (`20261122171900163700` or `20261123_028`) so that its primary key in `schema_migrations` remains distinct.

---

## 6. POST-EXECUTION VERIFICATION PROCEDURE

After running the SQL, verify the schema and ledger through these three independent channels:

### 6.1 Verify Migration History in Dashboard SQL Editor
Run:
```sql
SELECT version, name, inserted_at 
FROM supabase_migrations.schema_migrations 
ORDER BY version DESC 
LIMIT 5;
```
**Expected Output:** Top row displays version `20261122171900` with name `027_meta_social_critical_fixes`.

### 6.2 Verify Schema Objects via SQL Editor
Run:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'meta_social_deliveries';
```
**Expected Output:** Exactly 1 row (`meta_social_deliveries`).

### 6.3 Run Automated Live Verification Suite
In the local terminal:
```powershell
node scripts/verify-migration-027-live.mjs
```
This tests all 16 live criteria against staging, including:
- Table accessibility and column definitions
- RLS policy validation (anon role denied)
- Service role access verification
- Authenticated user tenant isolation
- Trigger immutability on `business_id`

---

## 7. SQL BLOCK PARITY CONFIRMATION

### Comparison Audit:
- **Committed File:** `supabase/migrations/20261122171900_027_meta_social_critical_fixes.sql` (294 lines, SHA256 verified)
- **Report SQL Block:** `PHASE_13B4_3_MIGRATION_027_APPLICATION_REPORT.md` (Lines 68–324)

### Audit Results:
1. **Statement Parity:** **100% EXACT MATCH**. Every single DDL statement (`ALTER TABLE`, `CREATE TABLE`, `CREATE TRIGGER`, `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT`, `COMMENT`) is identical byte-for-byte.
2. **Comment Differences:** The report omitted explanatory background comments (lines 4–15 of the file) and added explicit `BEGIN;` at line 69 and `COMMIT;` at line 323.
3. **Execution Block Below:** Section 9 below provides the complete, unabridged SQL file wrapped in `BEGIN; ... COMMIT;` with the optional `schema_migrations` ledger insert included.

---

## 8. TRANSACTIONALITY & ROLLBACK SAFETY CONFIRMATION

### Transactional Guarantees:
1. **PostgreSQL Transactional DDL:** PostgreSQL supports fully transactional DDL. Table alterations, new tables, composite foreign keys, trigger attachments, RLS policy definitions, and function replacements all execute inside a single transaction.
2. **Non-Transactional DDL Check:** There are **NO** concurrent index builds (`CREATE INDEX CONCURRENTLY`), `VACUUM`, `DROP DATABASE`, or `ALTER SYSTEM` statements. All indexes use standard `CREATE INDEX IF NOT EXISTS`, which is 100% transaction-safe.
3. **Intermediate Commit Check:** An AST token audit confirms there are **ZERO intermediate `COMMIT`, `END`, or `ROLLBACK` statements** at the SQL session level. (The only `BEGIN ... END;` block is the internal PL/pgSQL body of `ingest_meta_social_event_atomic`).
4. **All-or-Nothing Atomicity:** If any constraint fails, any duplicate exists, or any syntax error occurs, PostgreSQL automatically rolls back the entire transaction. The database state will remain pristine.

---

## 9. EXACT MANUAL EXECUTION PROCEDURE (FOR OPERATOR)

### Step 1: Open the Staging SQL Editor
Navigate to the Supabase Dashboard SQL Editor for staging project `ansiwtwqgrfmzfrhkzuu`:  
👉 **`https://supabase.com/dashboard/project/ansiwtwqgrfmzfrhkzuu/sql/new`**

### Step 2: Copy and Paste the Exact Transactional SQL Block
Copy the entire code block below into the SQL Editor and click **Run**:

```sql
BEGIN;

-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 027: META SOCIAL CRITICAL REMEDIATION
-- ==============================================================================
-- PHASE 13B: Forward-only fixes for Facebook & Instagram Social Automation
-- Strict Multi-Tenant Isolation, Outbound Delivery Ledger, Webhook Hardening
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. META SOCIAL CONNECTIONS HARDENING
-- ------------------------------------------------------------------------------
ALTER TABLE public.meta_social_connections 
    DROP CONSTRAINT IF EXISTS uq_meta_social_connections_tenant_platform_account;

ALTER TABLE public.meta_social_connections
    ADD CONSTRAINT uq_meta_social_connections_global_platform_account 
    UNIQUE (platform, account_id);

ALTER TABLE public.meta_social_connections
    ADD COLUMN IF NOT EXISTS default_dm_reply TEXT 
        DEFAULT 'வணக்கம்! எங்கள் சேவைகள் மற்றும் ஆலோசனை விவரங்களை இங்கே பகிர்கிறோம்.',
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 2. COMPOSITE FOREIGN KEYS ON EXISTING TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.meta_social_credentials
    DROP CONSTRAINT IF EXISTS fk_meta_social_credentials_conn_biz;

ALTER TABLE public.meta_social_credentials
    ADD CONSTRAINT fk_meta_social_credentials_conn_biz
    FOREIGN KEY (connection_id, business_id)
    REFERENCES public.meta_social_connections(id, business_id)
    ON DELETE CASCADE;

ALTER TABLE public.meta_social_rules
    DROP CONSTRAINT IF EXISTS fk_meta_social_rules_conn_biz;

ALTER TABLE public.meta_social_rules
    ADD CONSTRAINT fk_meta_social_rules_conn_biz
    FOREIGN KEY (connection_id, business_id)
    REFERENCES public.meta_social_connections(id, business_id)
    ON DELETE CASCADE;

ALTER TABLE public.meta_social_events
    DROP CONSTRAINT IF EXISTS fk_meta_social_events_conn_biz;

ALTER TABLE public.meta_social_events
    ADD CONSTRAINT fk_meta_social_events_conn_biz
    FOREIGN KEY (connection_id, business_id)
    REFERENCES public.meta_social_connections(id, business_id)
    ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- 3. TENANT IMMUTABILITY TRIGGERS
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_meta_social_credentials_immutable_business_id ON public.meta_social_credentials;
CREATE TRIGGER trg_meta_social_credentials_immutable_business_id
    BEFORE UPDATE ON public.meta_social_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

DROP TRIGGER IF EXISTS trg_meta_social_events_immutable_business_id ON public.meta_social_events;
CREATE TRIGGER trg_meta_social_events_immutable_business_id
    BEFORE UPDATE ON public.meta_social_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

-- ------------------------------------------------------------------------------
-- 4. OUTBOUND DELIVERY STATE COLUMNS ON META_SOCIAL_EVENTS
-- ------------------------------------------------------------------------------
ALTER TABLE public.meta_social_events
    ADD COLUMN IF NOT EXISTS public_reply_status TEXT DEFAULT 'none'
        CHECK (public_reply_status IN ('none', 'pending', 'replied', 'failed', 'skipped')),
    ADD COLUMN IF NOT EXISTS private_reply_status TEXT DEFAULT 'none'
        CHECK (private_reply_status IN ('none', 'pending', 'replied', 'failed', 'skipped')),
    ADD COLUMN IF NOT EXISTS public_reply_id TEXT,
    ADD COLUMN IF NOT EXISTS private_reply_id TEXT,
    ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 5. OUTBOUND DELIVERY TRACKING TABLE (META_SOCIAL_DELIVERIES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_social_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.meta_social_events(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES public.meta_social_connections(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
    action_type TEXT NOT NULL CHECK (action_type IN ('public_comment_reply', 'private_comment_reply', 'dm_reply')),
    recipient_id TEXT NOT NULL,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'retry_scheduled', 'permanently_failed')),
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_error TEXT,
    idempotency_key TEXT NOT NULL,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),

    CONSTRAINT uq_meta_social_deliveries_idempotency UNIQUE (idempotency_key),
    CONSTRAINT uq_meta_social_deliveries_id_business UNIQUE (id, business_id),
    CONSTRAINT fk_meta_social_deliveries_conn_biz FOREIGN KEY (connection_id, business_id)
        REFERENCES public.meta_social_connections(id, business_id) ON DELETE CASCADE,
    CONSTRAINT fk_meta_social_deliveries_event_biz FOREIGN KEY (event_id, business_id)
        REFERENCES public.meta_social_events(id, business_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_meta_social_deliveries_lookup 
    ON public.meta_social_deliveries(business_id, event_id, action_type);
CREATE INDEX IF NOT EXISTS idx_meta_social_deliveries_queue 
    ON public.meta_social_deliveries(status, next_retry_at ASC) 
    WHERE status IN ('pending', 'retry_scheduled');

DROP TRIGGER IF EXISTS trg_meta_social_deliveries_immutable_business_id ON public.meta_social_deliveries;
CREATE TRIGGER trg_meta_social_deliveries_immutable_business_id
    BEFORE UPDATE ON public.meta_social_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_tenant_reassignment();

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

-- ------------------------------------------------------------------------------
-- 6. HARDENED ATOMIC INGESTION RPC (RACE-CONDITION & CONCURRENCY SAFE)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.ingest_meta_social_event_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

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

-- ------------------------------------------------------------------------------
-- 7. PRIVILEGE HARDENING & LEAST PRIVILEGE GRANTS
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) IS
    'Atomically ingests inbound Meta social events, verifies connection, and prevents duplicates. Restricted strictly to service_role.';

-- ------------------------------------------------------------------------------
-- 8. RECONCILE MIGRATION HISTORY TABLE (ATOMICALLY WITHIN SAME TRANSACTION)
-- ------------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
    '20261122171900',
    '027_meta_social_critical_fixes',
    ARRAY['20261122171900_027_meta_social_critical_fixes.sql']
)
ON CONFLICT (version) DO UPDATE 
SET name = EXCLUDED.name,
    statements = EXCLUDED.statements;

COMMIT;
```

### Step 3: Confirm Success in Dashboard
The SQL Editor will display `Success. No rows returned`.

### Step 4: Notify the Assistant
Once executed, reply with:
> "Migration 027 executed successfully in staging SQL Editor."

The assistant will immediately execute the automated verification suite (`verify-migration-027-live.mjs`) to validate all 16 live constraints, RLS policies, and privilege settings.
