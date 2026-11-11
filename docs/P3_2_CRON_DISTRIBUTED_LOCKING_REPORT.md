# GOKUL CONNECT — P3.2: CRON DISTRIBUTED LOCKING ARCHITECTURE & VERIFICATION REPORT

**Document ID:** `DOC-P3_2-CRON-DISTRIBUTED-LOCKING`  
**Execution Timestamp:** `2026-11-09T20:10:30+05:30`  
**Platform:** **Gokul Connect (Multi-Tenant WhatsApp Automation Engine)**  
**Author:** Independent Antigravity Engineering Agent  
**Status:** **IMPLEMENTED & VERIFIED**  

---

## 1. Architectural Overview & Context

In serverless runtime environments (such as Vercel Edge/Serverless Lambdas), cron triggers execute across ephemeral, isolated containers. The previous coordinator implementation in `src/lib/cron/coordinator.ts` utilized an in-memory JavaScript `Map` (`activeCronLocks`). While sufficient for single-process local development, this provided zero concurrency protection when multiple Vercel Lambda instances ran simultaneously, risking duplicate queue item claiming and overlapping executions.

To achieve robust production reliability, Phase P3.2 replaced the in-memory lock with a **PostgreSQL-backed distributed locking engine** powered by the database table `public.cron_locks` and atomic PL/pgSQL security-definer RPCs.

```
+-----------------------------------------------------------------------------------------+
|                                 Vercel Serverless Hosting                               |
|                                                                                         |
|   +-----------------------+                    +-----------------------+                |
|   |   Lambda Instance A   |                    |   Lambda Instance B   |                |
|   |  (cron: 14:00:00.000) |                    |  (cron: 14:00:00.050) |                |
|   +-----------+-----------+                    +-----------+-----------+                |
|               |                                            |                            |
+---------------|--------------------------------------------|----------------------------+
                | acquire_cron_lock()                        | acquire_cron_lock()
                | (Owner: worker_A)                          | (Owner: worker_B)
                v                                            v
+-----------------------------------------------------------------------------------------+
|                           Supabase / PostgreSQL Database                                |
|                                                                                         |
|   SQL: INSERT INTO public.cron_locks ...                                                |
|        ON CONFLICT (lock_key) DO UPDATE                                                 |
|        WHERE public.cron_locks.expires_at < NOW();                                      |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   | Result for Instance A: 200 OK -> ACQUIRED (Lock granted until expires_at)       |   |
|   | Result for Instance B: 200 OK -> SKIPPED (Overlap prevented: held by worker_A)  |   |
|   +---------------------------------------------------------------------------------+   |
|                                                                                         |
|   TABLE: public.cron_locks                                                              |
|   - lock_key (TEXT PK)       : 'process-automation-jobs'                                |
|   - owner_id (TEXT)          : 'cron_1731154200'                                        |
|   - acquired_at (TIMESTAMPTZ): 2026-11-09 14:00:00 UTC                                 |
|   - expires_at (TIMESTAMPTZ) : 2026-11-09 14:01:00 UTC                                 |
|   - renewed_at (TIMESTAMPTZ) : NULL                                                     |
|   - renewal_count (INT)      : 0                                                        |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Database Schema: `public.cron_locks`

Defined in migration `20261109_024_phase_p3_2_labels_and_cron_locks.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.cron_locks (
    lock_key TEXT PRIMARY KEY,
    cron_name TEXT NOT NULL,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    expires_at TIMESTAMPTZ NOT NULL,
    renewed_at TIMESTAMPTZ,
    renewal_count INT NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for performance and tenant scoping
CREATE INDEX IF NOT EXISTS idx_cron_locks_expires_at ON public.cron_locks (expires_at);
CREATE INDEX IF NOT EXISTS idx_cron_locks_cron_name ON public.cron_locks (cron_name);
CREATE INDEX IF NOT EXISTS idx_cron_locks_business_id ON public.cron_locks (business_id) WHERE business_id IS NOT NULL;

-- Security & RLS
ALTER TABLE public.cron_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_cron_locks"
    ON public.cron_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_cron_locks_select"
    ON public.cron_locks FOR SELECT TO authenticated
    USING (business_id IS NULL OR check_user_business_access(business_id) OR is_superadmin());

CREATE TRIGGER trg_cron_locks_immutable_business_id
    BEFORE UPDATE ON public.cron_locks
    FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();
```

---

## 3. Atomic PL/pgSQL RPC Implementation

### 3.1 Lock Acquisition (`acquire_cron_lock`)
- **Signature:** `acquire_cron_lock(p_lock_key TEXT, p_cron_name TEXT, p_owner_id TEXT, p_ttl_seconds INT, p_business_id UUID, p_metadata JSONB) RETURNS JSONB`
- **Race Condition Prevention:** Uses PostgreSQL's atomic `INSERT ... ON CONFLICT (lock_key) DO UPDATE ... WHERE expires_at < NOW()`.
- **Crash Recovery:** If an instance crashes or is killed by a timeout without releasing its lock, the row remains in the table until `expires_at`. The next arriving instance checks `WHERE expires_at < NOW()`. Because the timestamp has elapsed, the update succeeds, granting the lock to the new worker and resetting `owner_id`, `acquired_at`, and `expires_at`. Deadlocks are mathematically impossible.
- **Return Data:**
  - When acquired: `{ "acquired": true, "lock_key": "...", "owner_id": "...", "expires_at": "..." }`
  - When contended: `{ "acquired": false, "lock_key": "...", "current_owner": "...", "expires_at": "..." }`

### 3.2 Safe Lease Renewal (`renew_cron_lock`)
- **Signature:** `renew_cron_lock(p_lock_key TEXT, p_owner_id TEXT, p_ttl_seconds INT) RETURNS JSONB`
- **Verification:** Requires `owner_id = p_owner_id` AND `expires_at >= NOW()`.
- **Behavior:** Extends `expires_at` by `p_ttl_seconds` and increments `renewal_count`. If another worker has already stolen the expired lock, renewal fails closed with `{ "renewed": false }`.

### 3.3 Owner-Verified Release (`release_cron_lock`)
- **Signature:** `release_cron_lock(p_lock_key TEXT, p_owner_id TEXT) RETURNS JSONB`
- **Verification:** Executes `DELETE FROM public.cron_locks WHERE lock_key = p_lock_key AND owner_id = p_owner_id;`.
- **Safety:** A worker that hung, exceeded its `maxDuration`, and woke up after its lease expired cannot delete a lock that has since been acquired by another worker.

---

## 4. Multi-Tenant Lock Isolation

To prevent tenant-specific cron jobs (e.g., CRM follow-ups, campaign dispatches) from interfering with other businesses, the coordinator resolves the lock key dynamically:

```ts
export function resolveLockKey(cronName: string, businessId?: string | null): string {
  if (businessId && typeof businessId === "string" && businessId.trim().length > 0) {
    return `${cronName}:${businessId.trim()}`;
  }
  return cronName;
}
```

### Isolation Proof:
- **Tenant 1 (Astrology):** `lock_key = 'process-campaigns:11111111-1111-1111-1111-111111111111'`
- **Tenant 2 (Vivaham):** `lock_key = 'process-campaigns:22222222-2222-2222-2222-222222222222'`
- **Global Jobs:** `lock_key = 'process-automation-jobs'`

Because each tenant operates under an independent primary key in `public.cron_locks`, Tenant 1 running a heavy campaign batch has zero impact on Tenant 2's scheduled jobs.

---

## 5. Automated Concurrency & Crash Recovery Test Verification

Comprehensive concurrency tests were implemented in `tests/p3-2-blocker-remediation.test.ts` using PGlite (simulated isolated Postgres instance):

| Test Case | Description | Tested Condition | Result |
|:---:|:---|:---|:---:|
| **1.1** | Atomic Acquisition | Inserts row into `public.cron_locks` and verifies timestamps and owner. | **PASS** |
| **1.2** | Concurrency Contention | Instance A acquires; Instance B concurrently requests same lock -> Instance B rejected (`acquired: false`). | **PASS** |
| **1.3** | Lease Renewal | Instance A extends lease (`renewed: true`, `renewal_count: 1`); Imposter instance renewal rejected. | **PASS** |
| **1.4** | Owner-Verified Release | Imposter cannot release lock (`released: false`); Owner releases (`released: true`); Next worker acquires. | **PASS** |
| **1.5** | Automatic Crash Recovery | Expired lock inserted (simulating crashed container); New worker claims lock automatically without deadlock. | **PASS** |
| **1.6** | Tenant Isolation | Astrology and Vivaham workers acquire same cron name concurrently; both succeed with distinct lock keys. | **PASS** |

All tests passed with 100% success rate in Vitest.
