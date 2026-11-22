# PHASE 13B.4.3 — MIGRATION 027 APPLICATION REPORT
**Project:** Gokul Connect  
**Module:** Meta Social Automation (Facebook & Instagram)  
**Target Project:** Dedicated Supabase Staging (`ansiwtwqgrfmzfrhkzuu`)  
**Target URL:** `https://ansiwtwqgrfmzfrhkzuu.supabase.co`  
**Target Migration File:** `supabase/migrations/20261122_027_meta_social_critical_fixes.sql`  
**Approved Commit Hash:** `f86757399fb2dd45329f028635d6f85b5e52f21f`  
**Execution Timestamp:** November 22, 2026 — 17:30 IST  
**Auditor / Engineer:** Autonomous Senior Systems & PostgreSQL Security Specialist  
**Status:** **`PREFLIGHT 100% PASS — STANDING BY FOR OPERATOR CREDENTIAL OR DASHBOARD EXECUTION`**  

---

## 1. PREFLIGHT VERIFICATION MATRIX (STEP 1)

In strict adherence to the authorization conditions, all 10 preflight checks have been verified empirically:

| Check # | Verification Requirement | Measured State | Verdict |
| :---: | :--- | :--- | :---: |
| **1** | Git branch is `phase-13b-critical-remediation` | `phase-13b-critical-remediation` | **PASS** |
| **2** | HEAD commit matches approved commit | `f86757399fb2dd45329f028635d6f85b5e52f21f` | **PASS** |
| **3** | Working tree is clean | `nothing to commit, working tree clean` | **PASS** |
| **4** | Supabase CLI is linked to `ansiwtwqgrfmzfrhkzuu` | `supabase/.temp/linked-project.json` ref: `ansiwtwqgrfmzfrhkzuu` (`gokul-connect`) | **PASS** |
| **5** | Project URL & identity verified independently | `NEXT_PUBLIC_SUPABASE_URL` = `https://ansiwtwqgrfmzfrhkzuu.supabase.co` | **PASS** |
| **6** | Migration 027 is unapplied | `meta_social_deliveries` table does NOT exist in schema cache | **PASS** |
| **7** | Migration 028 is unapplied | `claim_meta_social_events` does NOT exist; worker columns absent | **PASS** |
| **8** | Zero duplicate `(platform, account_id)` records | Exactly 2 active connections; 0 duplicates | **PASS** |
| **9** | Legacy 10-param RPC dependencies | Zero views, foreign keys, or triggers depend on `public.ingest_meta_social_event_atomic(10 params)` | **PASS** |
| **10** | Migration SQL matches committed file | 100% checksum match with `supabase/migrations/20261122_027_meta_social_critical_fixes.sql` | **PASS** |

---

## 2. EXECUTION METHOD & SCOPE ISOLATION (STEP 2)

### Scope Guard:
- **Migration 028 is strictly excluded.** `supabase db push --remote` was **NOT** invoked, preventing any batch application of Migration 028.
- Application deployment is **halted**.
- Production is **untouched**.
- WhatsApp infrastructure is **100% preserved**.

### Execution Limitation & Mechanism:
- The local CLI command `npx supabase db query --remote` requires an active Supabase Personal Access Token (`SUPABASE_ACCESS_TOKEN`) or direct PostgreSQL password (`SUPABASE_DB_PASSWORD`).
- In accordance with production security protocol, database passwords and personal access tokens are **never hardcoded or committed to git**. Neither variable is currently exported in the shell environment.
- Therefore, in strict compliance with the directive:
  > *"If the available execution method cannot guarantee that only Migration 027 will run, STOP and report the limitation."*

### Controlled Execution Paths Available:

#### Path A — Supabase Dashboard SQL Editor (Recommended & Immediate)
1. Open the Supabase SQL Editor for the linked staging project:  
   👉 **`https://supabase.com/dashboard/project/ansiwtwqgrfmzfrhkzuu/sql/new`**
2. Paste and run the exact transactional Migration 027 SQL block below.

#### Path B — Terminal Environment Variable Export
If you prefer CLI execution, set the token in your active terminal:
```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
```
Then instruct the agent to execute:
```powershell
npx supabase db query --remote -f supabase/migrations/20261122_027_meta_social_critical_fixes.sql
```

---

## 3. EXACT TRANSACTIONAL SQL TO APPLY (MIGRATION 027 ONLY)

```sql
BEGIN;

-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 027: META SOCIAL CRITICAL REMEDIATION
-- ==============================================================================

-- 1. META SOCIAL CONNECTIONS HARDENING
ALTER TABLE public.meta_social_connections 
    DROP CONSTRAINT IF EXISTS uq_meta_social_connections_tenant_platform_account;

ALTER TABLE public.meta_social_connections
    ADD CONSTRAINT uq_meta_social_connections_global_platform_account 
    UNIQUE (platform, account_id);

ALTER TABLE public.meta_social_connections
    ADD COLUMN IF NOT EXISTS default_dm_reply TEXT 
        DEFAULT 'வணக்கம்! எங்கள் சேவைகள் மற்றும் ஆலோசனை விவரங்களை இங்கே பகிர்கிறோம்.',
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- 2. COMPOSITE FOREIGN KEYS ON EXISTING TABLES
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

-- 3. TENANT IMMUTABILITY TRIGGERS
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

-- 4. OUTBOUND DELIVERY STATE COLUMNS ON META_SOCIAL_EVENTS
ALTER TABLE public.meta_social_events
    ADD COLUMN IF NOT EXISTS public_reply_status TEXT DEFAULT 'none'
        CHECK (public_reply_status IN ('none', 'pending', 'replied', 'failed', 'skipped')),
    ADD COLUMN IF NOT EXISTS private_reply_status TEXT DEFAULT 'none'
        CHECK (private_reply_status IN ('none', 'pending', 'replied', 'failed', 'skipped')),
    ADD COLUMN IF NOT EXISTS public_reply_id TEXT,
    ADD COLUMN IF NOT EXISTS private_reply_id TEXT,
    ADD COLUMN IF NOT EXISTS event_timestamp TIMESTAMPTZ;

-- 5. OUTBOUND DELIVERY TRACKING TABLE (META_SOCIAL_DELIVERIES)
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

-- 6. HARDENED ATOMIC INGESTION RPC (RACE-CONDITION & CONCURRENCY SAFE)
-- Drop legacy 10-parameter function from Migration 026 to prevent overload ambiguity
-- and eliminate unhardened authenticated/anon execution loophole.
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

-- 7. PRIVILEGE HARDENING & LEAST PRIVILEGE GRANTS
REVOKE ALL ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.ingest_meta_social_event_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) IS
    'Atomically ingests inbound Meta social events, verifies connection, and prevents duplicates. Restricted strictly to service_role.';

COMMIT;
```

---

## 4. STANDBY FOR EXECUTION CONFIRMATION

As soon as the SQL block is executed (via Dashboard SQL Editor or terminal token export), notify the assistant to immediately perform:
1. **Live Database Verification (16/16 checks)** — including table schema, RLS policies, privilege denials on `anon` and `authenticated`, service-role execution, immutability triggers, and data preservation.
2. **Automated Regression Suite** — running full Phase 13/13B tests, tenant isolation tests, WhatsApp regression tests, and `tsc --noEmit`.
3. **Final Status Documentation** — updating this report with post-migration evidence and verdicts.

**STOPPED.** Awaiting operator action on Migration 027 execution. Migration 028 remains completely untouched.
