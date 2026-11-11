# GOKUL CONNECT — PHASE 7.5.6
# FORWARD-ONLY MIGRATION 012 PREPARATION & MIGRATION HISTORY RECONCILIATION REPORT

**Project:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Project Directory:** `E:\GAI\Whatsapp Automation`  
**Dedicated Supabase Project:** `ansiwtwqgrfmzfrhkzuu` (`gokul-connect`)  
**Region:** `ap-south-1` (AWS Mumbai)  
**Database Engine:** PostgreSQL `17.11.0.018`  
**Execution Timestamp:** `2026-11-07T12:44:00+05:30`  
**Author:** Antigravity Pair Programming Agent  
**Operational Mode:** **STRICT READ-ONLY DATABASE AUDIT & LOCAL PREPARATION ONLY**  
**Approval Gate Status:** **PREPARATION COMPLETE — AWAITING EXPLICIT USER APPROVAL**

---

## 1. Executive Summary

During Phase 7.5.5, a migration history discrepancy was documented:
- In Phase 7.5.3, migration `010` (`20261107062122`) was recorded in `supabase_migrations.schema_migrations` with the statement `ON CONFLICT (idempotency_key) DO NOTHING`.
- During Phase 7.5.4 integration testing, error `42P10` revealed that `uq_wa_processing_jobs_idempotency` is a partial unique index requiring the explicit predicate `WHERE idempotency_key IS NOT NULL`.
- The live function was remediated via `CREATE OR REPLACE FUNCTION` and the local file `supabase/migrations/20261107_010_phase7_5_atomic_webhook_enqueue_rpc.sql` was updated in-place.
- Consequently, `supabase_migrations.schema_migrations` retained the pre-patch SQL string for version `20261107062122`.

### Phase 7.5.6 Objectives & Deliverables Completed:
1. **Live State Inspection:** Inspected live `schema_migrations`, catalog metadata `pg_proc`, role permissions, and confirmed migration 011 privileges and history.
2. **Three-Way Parity Comparison:** Analyzed recorded migration 010 SQL vs local file vs live database function.
3. **Migration 012 Preparation:** Authored forward-only migration `supabase/migrations/20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql`.
   - Preserves currently working live function behavior.
   - Preserves partial unique index predicate (`WHERE idempotency_key IS NOT NULL`).
   - Preserves single transaction atomicity and duplicate idempotency.
   - Preserves `SECURITY DEFINER` and `SET search_path = public, pg_temp`.
   - Preserves strict `service_role` execution rights (revoked from `PUBLIC`, `anon`, `authenticated`).
   - Strictly leaves migration `010` and `011` unmodified.
   - **NOT APPLIED** to live database (compliance with strict approval gate).
4. **Clean-Slate Reproducibility Verification:** Built automated test suite `tests/phase7-5-6-migration-history-reconciliation.test.ts` executing migrations `001` through `012` sequentially on a clean in-memory PostgreSQL engine (`@electric-sql/pglite`). Verified all tables, indexes, RPC security, functional ingestion, deduplication, and worker job claiming (13/13 tests passed).
5. **Full Regression Suite:** Ran and verified TypeScript (`0 errors`), Vitest (`25/25 suites, 286/286 tests passed`), dependency audit (`0 vulnerabilities`), and Next.js production build (`Compiled successfully in 3.4s`).

---

## 2. Current State Inspection & Three-Way History Comparison

### 2.1 Live `schema_migrations` Records
Queried directly from Supabase project `ansiwtwqgrfmzfrhkzuu`:

| Version | Name | Created By | Number of Statements | Conflict Clause Recorded in `statements[1]` |
|---|---|---|:---:|---|
| `20261107062122` | `20261107_010_phase7_5_atomic_webhook_enqueue_rpc` | `ajaygokul99@gmail.com` | 1 | `ON CONFLICT (idempotency_key) DO NOTHING` |
| `20261107062145` | `20261107_011_phase7_5_queue_rpc_privilege_hardening` | `ajaygokul99@gmail.com` | 1 | N/A (Role Privilege Statements) |

### 2.2 Live PostgreSQL Function Definition
Queried using `SELECT pg_get_functiondef('public.ingest_wa_inbound_message_v2(text, text, text, text, text, text, jsonb)'::regprocedure)`:
- **Security Mode:** `SECURITY DEFINER` (`prosecdef = true`)
- **Search Path:** `SET search_path TO 'public', 'pg_temp'` (`proconfig = ["search_path=public, pg_temp"]`)
- **Owner:** `postgres`
- **Execution Privileges (`proacl`):** `{postgres=X/postgres, service_role=X/postgres}` (PUBLIC, anon, authenticated revoked)
- **Enqueue Conflict Clause (Lines 245-246):**  
  `ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`

### 2.3 Three-Way Parity Matrix

| Attribute / Component | Recorded Migration 010 (`schema_migrations`) | Local Migration 010 File | Live Database Function (`pg_proc`) | Forward Migration 012 (Prepared) |
|---|:---:|:---:|:---:|:---:|
| **Function Signature** | `(text, text, text, text, text, text, jsonb)` | Identical | Identical | Identical |
| **Return Type** | `JSONB` | `JSONB` | `jsonb` | `JSONB` |
| **SECURITY DEFINER** | Yes | Yes | Yes | Yes |
| **`search_path = public, pg_temp`** | Yes | Yes | Yes | Yes |
| **`wa_processing_jobs` Insert** | `ON CONFLICT (idempotency_key) DO NOTHING` | `ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING` | `ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING` | `ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING` |
| **Target Role Grants** | `service_role` | `service_role` | `service_role` | `service_role` |
| **Untrusted Roles Revoked** | `PUBLIC`, `anon`, `authenticated` | `PUBLIC`, `anon`, `authenticated` | `PUBLIC`, `anon`, `authenticated` | `PUBLIC`, `anon`, `authenticated` |
| **Live Database Match** | **MISMATCH (Pre-patch SQL)** | **SEMANTIC MATCH** | **SOURCE OF TRUTH** | **RECONCILED MATCH** |

### 2.4 Migration 011 History & Privilege Confirmation
Inspection of `supabase_migrations.schema_migrations` and PostgreSQL catalog `pg_proc` confirms:
- Version `20261107062145` is recorded in `schema_migrations`.
- Functions `public.claim_next_wa_jobs(INTEGER, TEXT)` and `public.reclaim_stuck_wa_jobs(INTEGER)` have `proacl = {postgres=X/postgres, service_role=X/postgres}`.
- Untrusted roles `PUBLIC`, `anon`, and `authenticated` have 0 execute rights on both queue functions.

---

## 3. Prepared Migration 012

A new, forward-only migration has been created at:  
`supabase/migrations/20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql`

### 3.1 Migration File Contents

```sql
-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 012: ATOMIC WEBHOOK RPC RECONCILIATION
-- ==============================================================================
-- Migration Identifier: 20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql
-- Status: PREPARED FOR FORWARD-ONLY RECONCILIATION (NOT YET APPLIED TO LIVE)
--
-- PURPOSE:
-- Formally establishes in Supabase migration history the partial unique-index
-- conflict target predicate (WHERE idempotency_key IS NOT NULL) on wa_processing_jobs
-- in public.ingest_wa_inbound_message_v2.
--
-- This forward-only migration reconciles the migration history discrepancy where
-- Migration 010 was initially applied without the partial predicate and corrected
-- in-place on the live database. Applying this migration guarantees deterministic
-- replay across fresh, staging, and production environments via automated CI/CD.
--
-- AFFECTED OBJECTS:
-- 1. Function: public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
--    - Preserves SECURITY DEFINER and SET search_path = public, pg_temp
--    - Preserves ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
--    - Enforces REVOKE from PUBLIC, anon, authenticated
--    - Grants EXECUTE strictly to service_role
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.ingest_wa_inbound_message_v2(
    p_phone_number_id TEXT,
    p_meta_message_id TEXT,
    p_sender_phone TEXT,
    p_sender_name TEXT DEFAULT NULL,
    p_message_type TEXT DEFAULT 'text',
    p_content TEXT DEFAULT '',
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- ==============================================================================
-- PRIVILEGE HARDENING & LEAST PRIVILEGE GRANTS
-- ==============================================================================
-- 1. Revoke default EXECUTE privileges from PUBLIC pseudo-role
REVOKE ALL ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;

-- 2. Explicitly revoke EXECUTE from untrusted client roles (anon and authenticated)
REVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM authenticated;

-- 3. Grant EXECUTE strictly to the service_role (used by server-side webhook handler)
GRANT EXECUTE ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 4. Documentation & Verification Comment
COMMENT ON FUNCTION public.ingest_wa_inbound_message_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) IS
  'Atomically ingests inbound WhatsApp messages, contacts, conversations, and enqueues evaluation jobs in a single transaction. Restricted strictly to service_role.';
```

### 3.2 Design Requirements Compliance Matrix

| Requirement | Implementation Detail | Compliance |
|---|---|:---:|
| **Preserve live function behavior** | Function body is character-for-character identical to the active function in `pg_proc` | **PASS** |
| **Preserve partial unique-index conflict predicate** | `ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING` | **PASS** |
| **Preserve transaction atomicity & idempotency** | Single PL/pgSQL transaction boundary; duplicate checks on `meta_event_id` and `idempotency_key` | **PASS** |
| **Preserve SECURITY DEFINER & safe search_path** | `SECURITY DEFINER` with `SET search_path = public, pg_temp` | **PASS** |
| **Preserve service_role-only execution privileges** | `REVOKE ... FROM PUBLIC, anon, authenticated; GRANT ... TO service_role;` | **PASS** |
| **Avoid unnecessary schema changes** | Modifies only the function and its ACL grants; zero table/index/column mutations | **PASS** |
| **Predictable & idempotent execution** | Can be executed repeatedly without errors or side effects | **PASS** |
| **No modification of 010 or 011** | Local files `20261107_010_...` and `20261107_011_...` left completely intact | **PASS** |

---

## 4. Reproducibility & Database Verification

To verify that migrations `001` through `012` reproduce the complete schema from scratch in a deterministic manner, a dedicated automated test suite was constructed:  
`tests/phase7-5-6-migration-history-reconciliation.test.ts`

### 4.1 Verification Domains & Test Results

```
 RUN  v4.1.12 E:/GAI/Whatsapp Automation

 ✓ tests/phase7-5-6-migration-history-reconciliation.test.ts (13 tests) 2912ms
   ✓ Domain 1: Migration 012 Static Parity & Security Definer Integrity
     ✓ Test 1.1: Migration 012 file exists and follows project naming convention
     ✓ Test 1.2: Migration 012 preserves exact partial unique-index conflict predicate
     ✓ Test 1.3: Migration 012 preserves SECURITY DEFINER and safe search_path
     ✓ Test 1.4: Migration 012 strictly revokes execution from PUBLIC, anon, and authenticated
     ✓ Test 1.5: Migrations 010 and 011 exist and remain intact
   ✓ Domain 2: Full Database Replay & Schema Reproducibility (001–012)
     ✓ Test 2.1: Replayed database contains all core schema tables (16 tables verified)
     ✓ Test 2.2: Replayed database contains partial unique index on wa_processing_jobs
     ✓ Test 2.3: Replayed database contains target functions with SECURITY DEFINER and search_path
     ✓ Test 2.4: Target functions enforce restricted role execution grants (service_role)
   ✓ Domain 3: Clean Replay Functional Execution & Webhook Atomicity
     ✓ Test 3.1: ingest_wa_inbound_message_v2 successfully ingests message and enqueues job
     ✓ Test 3.2: Duplicate delivery of same meta_message_id returns duplicate status without error
     ✓ Test 3.3: claim_next_wa_jobs claims pending job using FOR UPDATE SKIP LOCKED
   ✓ Domain 4: Feature Flag Runtime Posture
     ✓ Test 4.1: USE_ATOMIC_WEBHOOK_V2 defaults to undefined / false in normal execution
```

### 4.2 Verified Database State from Clean Replay
1. **Core Relational Entities (16 tables):** `businesses`, `business_members`, `business_settings`, `user_profiles`, `wa_connections`, `wa_credentials`, `wa_contacts`, `wa_conversations`, `wa_messages`, `wa_message_templates`, `wa_webhook_events`, `wa_processing_jobs`, `wa_automation_rules`, `wa_rule_conditions`, `wa_rule_actions`, `wa_automation_execution_logs`.
2. **Partial Unique Indexes:** `uq_wa_processing_jobs_idempotency` with predicate `WHERE (idempotency_key IS NOT NULL)`.
3. **Target Stored Procedures:**
   - `public.ingest_wa_inbound_message_v2(text, text, text, text, text, text, jsonb)`
   - `public.claim_next_wa_jobs(integer, text)`
   - `public.reclaim_stuck_wa_jobs(integer)`
   - `public.prune_stale_automation_records(integer, integer, integer)`
4. **Access Control Matrices:** Verified all 4 procedures have execution grants exclusively restricted to `service_role`.

---

## 5. Full Regression Suite Results

All four mandatory regression checks were executed sequentially:

| Check | Command | Status | Result / Output Summary |
|---|---|:---:|---|
| **TypeScript Typecheck** | `npx tsc --noEmit` | **PASS** | Exit code `0` (Zero compiler errors across all files) |
| **Vitest Test Suite** | `npm test` | **PASS** | **25/25 test files passed, 286/286 tests passed** (7.15s) |
| **Dependency Audit** | `npm audit` | **PASS** | Exit code `0` (Found 0 vulnerabilities) |
| **Next.js Production Build** | `npm run build` | **PASS** | Compiled in 3.4s, 7 static pages generated, dynamic routes optimized, JS shared 103 kB |

---

## 6. Remaining Risks & Mitigation Plan

| Risk Factor | Severity | Impact | Mitigation Strategy |
|---|:---:|---|---|
| **Live Migration 012 Not Yet Recorded in `schema_migrations`** | Low | Live database has the patched function running, but `supabase_migrations.schema_migrations` does not yet contain a record for version `012`. | When approved, applying migration 012 via Supabase Migration CLI / API will record migration 012 in `schema_migrations` with zero downtime (idempotent `CREATE OR REPLACE FUNCTION`). |
| **Staging CI/CD Pipeline Divergence** | Low | An automated runner executing migrations sequentially would succeed with migrations 001–012, but live environment currently stopped at 011. | Applying migration 012 reconciles both local repository and remote Supabase tracking metadata. |
| **Unintended Activation of Atomic Ingestion** | Negligible | Running v2 ingestion prematurely before staging validation. | Feature flag `USE_ATOMIC_WEBHOOK_V2` remains strictly unset in `.env.local` and runtime configurations. Ingestion continues on proven v1 path. |

---

## 7. Next Actions (Awaiting User Approval)

Upon receiving explicit user approval:
1. **Apply Migration 012 to Supabase `ansiwtwqgrfmzfrhkzuu`:**
   - Apply `20261107_012_phase7_5_atomic_rpc_partial_index_fix.sql` via Supabase migration runner.
   - Verify that `supabase_migrations.schema_migrations` records version `012`.
2. **Proceed to Phase 7.6 (Controlled Staging Deployment):**
   - Deploy codebase with `USE_ATOMIC_WEBHOOK_V2` left disabled by default.
   - Perform live Meta webhook handshake (`GET /api/webhooks/whatsapp`).
   - Enable `USE_ATOMIC_WEBHOOK_V2=true` in staging for canary validation.

---

## STRICT APPROVAL GATE ENFORCEMENT

In compliance with instructions:
- **Migration 012 has NOT been applied to the live Supabase project.**
- **No live database functions, triggers, or privileges were modified.**
- **`USE_ATOMIC_WEBHOOK_V2` remains disabled.**
- **No automations were activated and zero WhatsApp messages were dispatched.**
- **No deployments or GitHub operations were performed.**
- **Antigravity has stopped and is awaiting explicit user approval.**
