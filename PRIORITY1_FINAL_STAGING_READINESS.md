# PRIORITY 1 — FINAL STAGING READINESS ASSESSMENT
## Facebook & Instagram Automatic Public Comment Replies

**Project:** Gokul Connect  
**Branch:** `phase-13b-critical-remediation`  
**Execution Timestamp:** 2026-11-22T19:30:00+05:30  
**Target Staging Project:** `ansiwtwqgrfmzfrhkzuu` (`https://ansiwtwqgrfmzfrhkzuu.supabase.co`)  
**Scope:** Final Read-Only Verification for Controlled Staging Activation  
**Auditor:** Autonomous Senior Systems & PostgreSQL Security Specialist  

---

## 1. Final Readiness Verdict

```
READY ONLY AFTER MIGRATIONS 027 AND 028
```

### Direct Resolution of Previous Documentation Contradictions:
Previous reports generated during Phase 13D claimed that the application was 100% compliant with the Migration 026 baseline. This was true **only for passive UI dashboard reads and in-memory mock adapters**. 

For **live automatic public comment reply execution**, the Migration 026 baseline is **fundamentally inoperable and unsafe**. Attempting to run live automation under Migration 026 will cause:
1. Webhooks to return **HTTP 500** due to database schema errors during ingestion.
2. Background workers to claim **0 events** due to missing queue RPCs and check constraint violations.
3. **Uncontrolled duplicate public replies** if workers run concurrently, because database-level idempotency locking (`meta_social_deliveries`) does not exist.

---

## 2. Concrete Failure Manifestations Under Migration 026 Baseline

If a controlled staging test were attempted today without applying Migrations 027 and 028, the execution pipeline would break at three distinct points:

```
[Inbound Webhook]
       │
       ▼
1. INGESTION CRASH:
   - ingest_meta_social_event_atomic called with 11 params; Migration 026 only defines 10 params.
   - Postgres Error: function public.ingest_meta_social_event_atomic(...) does not exist.
   - Fallback direct insert includes `event_timestamp`.
   - Postgres Error: column "event_timestamp" of relation "meta_social_events" does not exist.
   - Result: Webhook route catches error and returns HTTP 500 to Meta.
       │
       ▼
2. WORKER CLAIM CRASH:
   - claimSocialEvents calls claim_meta_social_events RPC.
   - Postgres Error: function public.claim_meta_social_events does not exist in 026.
   - Fallback direct update attempts status = 'processing', claimed_by, lease_expires_at, updated_at.
   - Postgres Error: Check constraint violation (processing not in status enum) + missing columns.
   - Result: 0 events claimed. Worker exits without processing.
       │
       ▼
3. IDEMPOTENCY & AUDIT DEFECT:
   - meta_social_deliveries table does not exist.
   - Idempotency key lookup returns null.
   - If two workers process an event, BOTH send POST to Meta Graph API.
   - public_reply_id and updated_at cannot be saved to meta_social_events.
   - Result: Duplicate public comments posted; Meta reply ID permanently lost.
```

---

## 3. Why Migration 027 Alone Is Insufficient

Applying Migration 027 resolves the ingestion crash and creates the delivery ledger, but **the worker will still fail** unless Migration 028 is also applied:

| Capability | In Migration 027? | In Migration 028? | Consequence if 028 is Missing |
|---|---|---|---|
| `meta_social_deliveries` table | **YES** | - | Idempotency storage restored |
| `event_timestamp` & `public_reply_id` columns | **YES** | - | Ingestion and reply ID storage restored |
| 11-param `ingest_meta_social_event_atomic` | **YES** | - | Webhook returns HTTP 200 reliably |
| `claim_meta_social_events` RPC (`FOR UPDATE SKIP LOCKED`) | **NO** | **YES** | **Worker cannot lock events concurrently** |
| Status expansion (`processing`, `retry_scheduled`, etc.) | **NO** | **YES** | **Database throws check constraint violation** |
| Worker columns (`claimed_by`, `lease_expires_at`, etc.) | **NO** | **YES** | **Database throws column does not exist error** |
| `reclaim_stuck_meta_social_events` RPC | **NO** | **YES** | **Worker cannot recover from crashes** |

**Conclusion:** Migration 027 and Migration 028 are tightly coupled in the application codebase. Staging activation requires applying **both migrations sequentially**.

---

## 4. Prerequisites Checklist for Staging Activation

Before initiating any controlled staging test, the following four prerequisites must be completed:

- [ ] **1. Apply Migration 027 to Staging Database**  
  File: `supabase/migrations/20261122171900_027_meta_social_critical_fixes.sql`  
  Target: Supabase Staging (`ansiwtwqgrfmzfrhkzuu`)  
  *Introduces global connection uniqueness, composite foreign keys, `meta_social_deliveries`, `event_timestamp`, and `public_reply_id`.*

- [ ] **2. Apply Migration 028 to Staging Database**  
  File: `supabase/migrations/20261122172000_028_meta_social_worker_reliability.sql`  
  Target: Supabase Staging (`ansiwtwqgrfmzfrhkzuu`)  
  *Introduces expanded status constraints, worker lease columns, `claim_meta_social_events` RPC, and queue indexes.*

- [ ] **3. Reconcile Supabase Migration Ledger**  
  Execute via Supabase CLI:
  ```powershell
  npx supabase migration repair --status applied 20261122171900 --remote
  npx supabase migration repair --status applied 20261122172000 --remote
  ```

- [ ] **4. Configure Background Worker Execution (Cron)**  
  Because `vercel.json` does not currently contain a `"crons"` schedule, configure either:
  - An entry in `vercel.json`:
    ```json
    "crons": [
      {
        "path": "/api/cron/process-social-automations",
        "schedule": "* * * * *"
      }
    ]
    ```
  - OR an external cron trigger (e.g., GitHub Actions, Cloudflare Worker, Upstash Cron) issuing:
    ```bash
    curl -X POST https://<staging-url>/api/cron/process-social-automations \
      -H "Authorization: Bearer <CRON_SECRET>"
    ```

---

## 5. Controlled Staging Verification Protocol

Once Migrations 027 and 028 are applied and the cron trigger is configured, controlled staging verification should proceed under the following strict protocol:

### Step 1: Account & Page Scope Isolation
- Verify that only designated staging Facebook Pages and Instagram Professional Accounts are connected.
- Confirm Astrology (`astrology`) and Vivaham (`vivaham`) connections remain strictly isolated by `business_id`.

### Step 2: Dedicated Test Posts & Triggers
- Create 1 unlisted/test Facebook Page post and 1 Instagram test post.
- Test Keywords: `டெஸ்ட்101` (Tamil) / `connecttest` (English).
- Configured Staging Reply:
  `"வணக்கம்! இது கோகுல் கனெக்ட் தானியங்கி சோதனை பதில் (Automated Staging Verification Reply)."`

### Step 3: Verified Execution Sequence
1. Post a test comment containing `டெஸ்ட்101`.
2. Inspect `/api/webhooks/meta-social`:
   - Verify HMAC-SHA256 signature verification succeeds.
   - Verify HTTP 200 returned within 100ms.
   - Verify event is persisted in `meta_social_events` with `status = 'received'`.
3. Trigger worker via `/api/cron/process-social-automations`:
   - Verify `claim_meta_social_events` claims the event and sets `status = 'processing'`.
   - Verify keyword match resolves Tamil template.
   - Verify single public reply is dispatched to `POST /{comment-id}/comments` (FB) or `POST /{comment-id}/replies` (IG).
   - Verify `meta_social_deliveries` records `status = 'succeeded'` and `response_id`.
   - Verify `meta_social_events` records `status = 'replied'`, `public_reply_status = 'replied'`, and `public_reply_id`.
4. Duplicate Suppression Test:
   - Resend identical comment webhook payload.
   - Verify system identifies duplicate via `(business_id, meta_event_id)` and rejects processing.
   - Verify ZERO duplicate public replies are posted on Meta.

---

## 6. Non-Interference Affirmation

The Meta Social Automation architecture strictly isolates social channels from core WhatsApp functionality:
- **WhatsApp Webhook Unchanged:** `/api/webhooks/whatsapp` operates on dedicated routes and tables (`whatsapp_messages`, `whatsapp_incoming_events`).
- **Database Table Isolation:** Social operations are confined to `meta_social_*` tables (`connections`, `credentials`, `rules`, `events`, `deliveries`).
- **Zero Impact on Messaging Engine:** No WhatsApp campaign tables, message queues, or template management schemas are touched.
- **Tenant Isolation Preserved:** Cross-tenant access is blocked at both RLS and database trigger levels (`prevent_tenant_reassignment()`).

---

## 7. Sign-Off & Recommendation

| Assessment Area | Status Under 026 Baseline | Status After Migrations 027 & 028 |
|---|:---:|:---:|
| Webhook Ingestion | **FAIL (HTTP 500)** | **PASS (HTTP 200)** |
| Inbound Event Ledger | **FAIL (Missing Columns)** | **PASS** |
| Keyword Engine (Tamil & English) | **PASS** | **PASS** |
| Graph API Request Construction | **PASS** | **PASS** |
| Idempotency & Concurrency Lock | **FAIL (Missing Table)** | **PASS** |
| Worker Lease & Stuck Recovery | **FAIL (Missing RPC)** | **PASS** |
| Observability & Delivery Audit | **FAIL (Missing Columns)** | **PASS** |
| **OVERALL READINESS** | **NOT READY** | **READY FOR CONTROLLED STAGING** |

**Actionable Next Step:** Apply Migration `20261122171900_027_meta_social_critical_fixes.sql` followed by `20261122172000_028_meta_social_worker_reliability.sql` to staging database `ansiwtwqgrfmzfrhkzuu`.
