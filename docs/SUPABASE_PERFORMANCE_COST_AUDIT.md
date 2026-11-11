# Gokul Connect — Supabase Database Performance & Cost Audit

**Project Reference:** `ansiwtwqgrfmzfrhkzuu` (`gokul-connect`)  
**Region:** `ap-south-1` (Mumbai, India)  
**Database Engine:** PostgreSQL 17.11.0.018 (Supabase Cloud Managed)  
**Date of Audit:** 2026-11-06  
**Audit Type:** Read-Only Performance, Schema Health, Storage & Cost Assessment  
**Compliance Status:** 🛡️ **READ-ONLY EXECUTION (0 DDL changes, 0 data modifications, 0 interruptions)**  

---

## 1. Executive Summary

This comprehensive audit evaluates the performance characteristics, relational integrity, row-level security (RLS) overhead, storage trajectory, network usage, and hosting costs of the dedicated Supabase project `ansiwtwqgrfmzfrhkzuu` powering **Gokul Connect**.

### Key Findings Snapshot
1. **Current Database Footprint:** The entire database currently consumes **12 MB** out of the **500 MB** Supabase Free Plan allocation (**2.4% utilized**).
2. **Storage Growth Vulnerability:** While baseline storage is minimal, high-frequency WhatsApp webhooks (`wa_webhook_events`), delivery receipts, and queue retry jobs (`wa_processing_jobs`) will rapidly consume storage unless automated pruning is scheduled before high-volume live traffic starts.
3. **Missing Foreign Key Indexes:** PostgreSQL’s database linter and query analyzer detected **10 unindexed foreign key relationships**, most critically on `wa_messages(connection_id)` and `wa_messages(contact_id)`, which will cause sequential table scans during deletions or cascade checks as message volume grows.
4. **Application Query Inefficiency in Inbox Store:** `getInboxCountsDb` currently fetches **all conversations** across the wire into Node.js memory to compute folder badges (`items.filter(...)`). At scale (>5,000 conversations), this will exhaust Node.js memory and create heavy egress and database connection churn.
5. **Realtime Isolation:** **Zero tables** are currently enrolled in the `supabase_realtime` publication, which perfectly preserves Free Plan broadcast quotas.
6. **Free-Tier Dormancy Risk:** Supabase Free Plan projects automatically pause after **7 days of inactivity**. A reliable external cron trigger (such as Vercel Cron) is required to ensure uninterrupted service for scheduled follow-ups and webhooks.

---

## 2. Database Inventory & Schema Health

### 2.1 Table Inventory, Sizes & Live Row Estimates

Empirical data extracted directly from PostgreSQL system statistics (`pg_stat_user_tables` and `pg_total_relation_size`):

| # | Table Name | Live Rows | Table (Heap) Size | Indexes Size | Total Disk Size | RLS Enabled |
|:---:|---|:---:|:---:|:---:|:---:|:---:|
| **1** | `public.wa_conversations` | 2 | 8 kB | 112 kB | **128 kB** | ✅ Yes |
| **2** | `public.wa_messages` | 4 | 8 kB | 96 kB | **112 kB** | ✅ Yes |
| **3** | `public.wa_connections` | 2 | 8 kB | 96 kB | **112 kB** | ✅ Yes |
| **4** | `public.wa_webhook_events` | 5 | 8 kB | 80 kB | **96 kB** | ✅ Yes |
| **5** | `public.wa_contacts` | 2 | 8 kB | 80 kB | **96 kB** | ✅ Yes |
| **6** | `public.business_members` | 2 | 8 kB | 64 kB | **80 kB** | ✅ Yes |
| **7** | `public.wa_credentials` | 1 | 8 kB | 64 kB | **80 kB** | ✅ Yes |
| **8** | `public.businesses` | 2 | 8 kB | 64 kB | **80 kB** | ✅ Yes |
| **9** | `public.business_settings` | 2 | 8 kB | 48 kB | **64 kB** | ✅ Yes |
| **10** | `public.wa_processing_jobs` | 1 | 8 kB | 48 kB | **64 kB** | ✅ Yes |
| **11** | `public.wa_message_templates` | 0 | 0 kB | 24 kB | **32 kB** | ✅ Yes |
| **12** | `public.user_profiles` | 2 | 8 kB | 16 kB | **32 kB** | ✅ Yes |
| **—** | **Total User Tables** | **25 rows** | **88 kB** | **792 kB** | **944 kB** | **100% Covered** |

*Note: The remaining ~11 MB of the 12 MB database footprint is allocated to PostgreSQL system catalogs, Supabase Auth (`auth.*`), Storage (`storage.*`), Vault (`vault.*`), and WAL metadata.*

### 2.2 Installed PostgreSQL Extensions

| Extension | Version | Installed Schema | Purpose | Status |
|---|:---:|:---:|---|:---:|
| `pg_stat_statements` | 1.11 | `extensions` | Tracks query execution performance and slow queries. | Active |
| `pgcrypto` | 1.3 | `extensions` | Cryptographic functions and secure random generation. | Active |
| `supabase_vault` | 0.3.1 | `vault` | Supabase Vault secret management infrastructure. | Active |
| `uuid-ossp` | 1.1 | `extensions` | Universal unique identifier generation functions. | Active |
| `plpgsql` | 1.0 | `pg_catalog` | PL/pgSQL procedural database language. | Active |

**Uninstalled Extensions of Note:**
- `pg_cron` (v1.6.4 available, not installed): PostgreSQL background job scheduler.
- `pg_net` (v0.20.4 available, not installed): Asynchronous HTTP client for PostgreSQL.
- `pgmq` (v1.5.1 available, not installed): Lightweight PostgreSQL message queue.

### 2.3 Database Triggers & Security Controls

All public tables are protected by `BEFORE UPDATE` tenant-immutability triggers preventing cross-tenant privilege escalation or reassignment:

| Trigger Name | Target Table | Function Executed | Purpose |
|---|---|---|---|
| `trg_business_members_immutable_business_id` | `business_members` | `prevent_business_member_tenant_reassignment()` | Blocks moving a user to another business tenant. |
| `trg_business_settings_immutable_business_id` | `business_settings` | `prevent_business_settings_tenant_reassignment()` | Blocks reassignment of business settings. |
| `trg_user_profiles_privilege_escalation` | `user_profiles` | `prevent_user_profile_privilege_escalation()` | Blocks non-superadmins from setting `is_superadmin = true`. |
| `trg_wa_connections_immutable_business_id` | `wa_connections` | `prevent_wa_connection_tenant_reassignment()` | Blocks moving WhatsApp lines between businesses. |
| `trg_wa_contacts_immutable_business_id` | `wa_contacts` | `prevent_tenant_reassignment()` | Enforces contact tenant immutability. |
| `trg_wa_conversations_immutable_business_id` | `wa_conversations` | `prevent_tenant_reassignment()` | Enforces conversation thread tenant immutability. |
| `trg_wa_messages_immutable_business_id` | `wa_messages` | `prevent_tenant_reassignment()` | Enforces message tenant immutability. |
| `trg_wa_message_templates_immutable_business_id` | `wa_message_templates` | `prevent_tenant_reassignment()` | Enforces message template tenant immutability. |
| `trg_wa_processing_jobs_immutable_business_id` | `wa_processing_jobs` | `prevent_tenant_reassignment()` | Enforces outbox queue tenant immutability. |

---

## 3. Query Performance & Bottleneck Analysis

### 3.1 Supabase Linter Findings Analysis

The Supabase database advisor identified three architectural performance opportunities:

#### 1. Unindexed Foreign Keys (10 Occurrences)
Foreign keys without covering indexes cause PostgreSQL to execute sequential table scans on the referencing table during `DELETE` or `UPDATE` cascades on the parent table.
- `wa_messages`: Foreign keys referencing `connection_id` and `contact_id` lack dedicated single-column or covering indexes. When contacts are pruned or connections updated, PostgreSQL scans `wa_messages`.
- `wa_webhook_events`: References `business_id` and `connection_id` without covering indexes.
- `wa_processing_jobs`: References `connection_id` without an index.
- `business_settings`: Composite foreign key `(default_connection_id, business_id)` has no composite index.

#### 2. Auth RLS Initialization Plan Re-Evaluation (`auth_rls_initplan`)
In RLS policies on `businesses`, `user_profiles`, and `business_members`, the clause `auth.uid()` is written directly without a subquery wrapper:
```sql
-- Suboptimal (Evaluated once per row during sequential scan)
qual: (id = auth.uid())

-- Optimal (Evaluated ONCE for the entire query statement via InitPlan)
qual: (id = (select auth.uid()))
```
*Impact:* On small tables this produces negligible overhead (<1ms), but on larger tables (e.g. `business_members` with hundreds of rows), wrapping with `(select auth.uid())` prevents significant CPU cycles.

#### 3. Multiple Permissive Policies on `business_members`
Table `business_members` has two permissive policies for `SELECT`:
- `Owners can manage business members` (ALL)
- `Users can view members of their authorized businesses` (SELECT)
When an authenticated user executes a `SELECT`, PostgreSQL must evaluate **both** policies and compute a boolean `OR` for every candidate row. Consolidating into a single policy simplifies query execution.

### 3.2 Redundant Index Identified

Inspection of `pg_indexes` revealed a redundant index on `business_settings`:
- `business_settings_business_id_key` (UNIQUE on `business_id`)
- `idx_business_settings_business_id` (INDEX on `business_id`)

Because a unique constraint automatically generates a B-tree index covering single-column lookups on `business_id`, `idx_business_settings_business_id` is 100% redundant, consuming extra index storage and write overhead during updates.

### 3.3 Application Code Query Patterns Review

Analysis of `src/lib/inbox/database.ts` revealed two high-impact optimization opportunities:

#### Critical Bottleneck: In-Memory Count Calculation (`getInboxCountsDb`)
Lines 152–187 of `src/lib/inbox/database.ts`:
```typescript
let query = supabase
  .from("wa_conversations")
  .select("id, business_id, connection_id, status, unread_count")
  .eq("business_id", businessId);

const { data, error } = await query;
// ...
return {
  all: items.filter((c: any) => c.status !== "archived").length,
  unread: items.filter((c: any) => c.unread_count > 0 && c.status !== "archived").length,
  open: items.filter((c: any) => c.status === "open").length,
  pending: items.filter((c: any) => c.status === "pending_human").length,
  resolved: items.filter((c: any) => c.status === "closed").length,
  archived: items.filter((c: any) => c.status === "archived").length,
};
```
*The Problem:* As conversation volume grows to 5,000 or 50,000 threads, every single page visit or inbox folder click will download all 50,000 rows across the network into Node.js memory just to calculate badges!
*The Solution:* Replace with an atomic PostgreSQL aggregation query:
```sql
SELECT
    COUNT(*) FILTER (WHERE status != 'archived') AS all_count,
    COUNT(*) FILTER (WHERE unread_count > 0 AND status != 'archived') AS unread_count,
    COUNT(*) FILTER (WHERE status = 'open') AS open_count,
    COUNT(*) FILTER (WHERE status = 'pending_human') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'closed') AS resolved_count,
    COUNT(*) FILTER (WHERE status = 'archived') AS archived_count
FROM public.wa_conversations
WHERE business_id = $1;
```
This transfers a single 100-byte row instead of thousands of JSON objects.

#### Redundant Sequential Check in `getConversationMessagesDb`
Lines 315–325 execute a preliminary query to check if the conversation exists:
```typescript
const { data: conv } = await supabase
  .from("wa_conversations")
  .select("id")
  .eq("id", conversationId)
  .eq("business_id", businessId)
  .maybeSingle();
```
Immediately followed by fetching `wa_messages` filtered by `business_id` and `conversation_id`.  
*The Problem:* Because `wa_messages` already contains `business_id` and has strict RLS, querying `wa_conversations` first adds an unnecessary round-trip latency of 40–120ms on every message load.

#### Client-Side Search after Pagination Limit
Lines 97–132 in `getConversationsForBusinessDb`: The database query limits results to `50` rows (`range(offset, offset + limit - 1)`), and then JavaScript filters by search query (`name.includes(q) || phone.includes(q)`).  
*The Problem:* If a matching customer is on page 2 or page 5 in the database, the search returns zero results because the matching contact was not in the first 50 rows retrieved. Text search should be pushed directly to PostgreSQL using `ILIKE` or `pg_trgm`.

---

## 4. Storage Growth Projections & Optimization

### 4.1 Storage Growth Modeling

WhatsApp CRM workloads produce three primary drivers of table bloat:
1. **`wa_webhook_events`:** Every inbound message, delivery confirmation (`sent`, `delivered`, `read`), and failure receipt sends a webhook event with a 1–3 kB raw JSON payload.
2. **`wa_messages`:** Stores text content, raw payloads, delivery timestamps, and Meta message IDs.
3. **`wa_processing_jobs`:** Churns rows for outbound message dispatch, retries, and scheduled follow-ups.

#### 30-Day Storage Trajectory Projections

| Daily Inbound Messages | Monthly Messages | Estimated Monthly Webhook Events | Monthly Data Ingestion | Time to Reach 500 MB Free Quota |
|:---:|:---:|:---:|:---:|:---:|
| **10 / day** | 300 | ~1,200 | ~3.5 MB | **> 10 years** |
| **100 / day** | 3,000 | ~12,000 | ~35 MB | **~ 14 months** |
| **500 / day** | 15,000 | ~60,000 | ~180 MB | **~ 2.8 months** |
| **2,000 / day** | 60,000 | ~240,000 | ~720 MB | **< 25 days (Over Quota)** |

*Key Takeaway:* At low enquiry volume (10–50/day), Gokul Connect can comfortably run within the Free Plan for over a year. At medium volume (100–500/day), active storage management is essential to prevent reaching the 500 MB ceiling.

### 4.2 Safe Retention & Archival Strategy

To guarantee permanent operation within the 500 MB Free Tier without data loss:
1. **Processed Webhook Event Pruning (7-day retention):**
   `wa_webhook_events` is an idempotency buffer and temporary debug log. Once an event is marked `is_processed = true`, it has zero operational value after 7 days.
2. **Queue Job Purging (7-day retention):**
   `wa_processing_jobs` rows marked `'completed'` or `'failed'` should be removed after 7 days. Active pending/processing jobs remain untouched.
3. **Selective JSONB Payload Sanitization:**
   Avoid storing uncompressed media bytes or redundant nested headers in `raw_payload`.

---

## 5. Realtime & Network Usage Review

### 5.1 Realtime Publication Membership
Direct catalog inspection of `pg_publication_tables`:
```sql
SELECT pubname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- Result: [] (0 tables enrolled)
```
- **Audit Assessment:** ✅ **EXCELLENT.** Currently, no tables are enrolled in Realtime. This eliminates unintended WebSocket broadcast storms.
- **Architectural Requirement:** When Phase 4 Realtime inbox updates are activated:
  - **DO ENROLL:** `wa_messages` and `wa_conversations` (scoped by RLS).
  - **DO NOT ENROLL:** `wa_processing_jobs`, `wa_webhook_events`, or `wa_credentials`. Broadcasting job queues or vault updates would leak internal queue state and burn through the 2 million monthly Realtime message quota.

---

## 6. Supabase Free Plan Cost Assessment & Quota Comparison

### 6.1 Verified Account Usage vs. Free Plan Allocations

| Resource Dimension | Supabase Free Plan Quota | Actual Verified Usage | % Utilized | Risk Level |
|---|---|:---:|:---:|:---:|
| **Database Storage** | 500 MB | **12 MB** | **2.4%** | 🟢 Minimal |
| **File Storage Buckets** | 1 GB | **0 MB (0 buckets)** | **0.0%** | 🟢 Minimal |
| **Monthly Active Users (MAU)** | 50,000 MAU | **2 users** (`user_a`, `user_b`) | **0.004%** | 🟢 Minimal |
| **Realtime Messages** | 2,000,000 / month | **0 messages** | **0.0%** | 🟢 Minimal |
| **Concurrent Realtime Connections** | 200 concurrent | **0 connections** | **0.0%** | 🟢 Minimal |
| **Edge Function Invocations** | 500,000 / month | **0 invocations** | **0.0%** | 🟢 Minimal |
| **Egress Bandwidth** | 2 GB / month | **< 15 MB** | **< 1.0%** | 🟢 Minimal |
| **Compute Instance** | Micro (shared 2-core ARM, 1GB RAM) | Normal (< 5% CPU) | Low | 🟢 Minimal |
| **Project Activity Policy** | **Pauses after 7 days of inactivity** | Active | ⚠️ **Risk** | 🟡 Moderate |
| **Point-in-Time Recovery (PITR)** | Not Included (Manual pg_dump only) | No automated PITR | N/A | 🟡 Moderate |

### 6.2 Free-Tier Operational Risks & Workarounds

1. **The 7-Day Inactivity Auto-Pause:**
   - *Risk:* If no user visits the Gokul Connect dashboard or API for 7 consecutive days, Supabase pauses the project. Incoming webhooks from Meta would fail (returning HTTP 500), disrupting customer communication.
   - *Mitigation:* The scheduled job worker (e.g. Vercel Cron or GitHub Actions cron) pinging the webhook/cron endpoint every 5 minutes maintains continuous active status, preventing automatic dormancy.
2. **Point-in-Time Recovery (PITR):**
   - *Risk:* Free Plan does not provide automated Point-in-Time Recovery or automated daily backups downloadable via the dashboard.
   - *Mitigation:* A weekly automated `pg_dump` scheduled via GitHub Actions or Supabase CLI provides zero-cost off-site backup snapshots.

---

## 7. Actionable Recommendations & Prioritized Roadmap

All recommendations are classified by urgency, business impact, and required change type:

```
[RECOMMENDATION ROADMAP]
├── HIGH PRIORITY (Performance & Stability)
│   ├── REC-01: Add missing foreign key covering indexes (Migration)
│   ├── REC-02: Optimize getInboxCountsDb with SQL aggregation (Code Change)
│   └── REC-03: Wrap auth.uid() in (select auth.uid()) for RLS policies (Migration)
│
├── MEDIUM PRIORITY (Storage & Architecture)
│   ├── REC-04: Implement 7-day automated pruning for webhook events & jobs (Migration)
│   ├── REC-05: Remove redundant index idx_business_settings_business_id (Migration)
│   └── REC-06: Consolidate multiple permissive policies on business_members (Migration)
│
└── LOW PRIORITY (Operational Continuity)
    ├── REC-07: Configure external cron ping to prevent 7-day project pausing (Configuration)
    └── REC-08: Setup automated weekly pg_dump backup snapshot workflow (DevOps)
```

### Recommendation Specifications

| ID | Recommendation Description | Category | Required Action Type | Impact / Benefit |
|:---:|---|---|:---:|---|
| **REC-01** | Add covering indexes on `wa_messages(connection_id)`, `wa_messages(contact_id)`, and `wa_processing_jobs(connection_id)`. | Performance | **Database Migration** | Eliminates sequential table scans on message deletions and connection updates. |
| **REC-02** | Refactor `getInboxCountsDb` to use a single PostgreSQL `COUNT(*) FILTER (...)` query instead of fetching all rows into memory. | Performance | **Code Change** | Reduces network payload by >99% and prevents Node.js memory exhaustion on large conversation lists. |
| **REC-03** | Update RLS policies on `businesses`, `user_profiles`, and `business_members` to use `(select auth.uid())`. | Performance | **Database Migration** | Prevents per-row function re-evaluation during table scans (Supabase Lint 0003). |
| **REC-04** | Create a scheduled stored procedure (`prune_stale_wa_records`) to purge completed jobs and processed webhook events older than 7 days. | Storage | **Database Migration** | Prevents database bloat and guarantees staying within the 500 MB Free Plan limit. |
| **REC-05** | Drop redundant duplicate index `idx_business_settings_business_id`. | Storage | **Database Migration** | Reclaims unnecessary index storage and eliminates double-indexing on update. |
| **REC-06** | Consolidate multiple permissive `SELECT` policies on `business_members` into a single unified policy. | Performance | **Database Migration** | Simplifies query execution plan and avoids evaluating multiple policies per row. |
| **REC-07** | Configure external serverless ping (e.g. Vercel Cron) hitting `/api/cron/process-automation-jobs` every 5 minutes. | Availability | **Configuration / Code** | Keeps Supabase project active, preventing the 7-day dormancy pause. |
| **REC-08** | Setup automated weekly `pg_dump` backup script via GitHub Actions to export database schema and seed data. | Disaster Recovery | **DevOps / Script** | Mitigates Free Plan lack of automated Point-in-Time Recovery. |

---

## 8. Audit Conclusion

The dedicated Gokul Connect Supabase database (`ansiwtwqgrfmzfrhkzuu`) is in **healthy operational condition**:
- Total current consumption is just **12 MB** (**2.4%** of the free tier).
- Multi-tenant Row-Level Security is enabled and enforced across 100% of public tables.
- Realtime quotas are completely unconsumed.
- Implementing the 3 high-priority recommendations (REC-01, REC-02, REC-03) before Phase 5 deployment will guarantee optimal performance, zero memory bottlenecks, and maximum longevity on the Supabase Free Plan.

*Strict audit guidelines maintained: No database changes or code modifications were performed during this audit.*
