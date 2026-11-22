# PHASE 13D – DATABASE DEPENDENCY REPORT

**Project:** Gokul Connect  
**Branch:** `phase-13b-critical-remediation`  
**Phase:** Phase 13D – Isolated Social Automation Dashboard Development  
**Date:** November 22, 2026  
**Status:** Strict Compatibility Maintained (Zero Migrations Created or Applied)

---

## 1. Executive Summary

In accordance with Section 2 (Non-Interference Policy) and Section 5 (Strict Database Compatibility) of the Phase 13D directive:
- **Migration 027 was NOT applied.**
- **Migration 028 was NOT applied.**
- **No new migrations were created.**
- **No existing migration files were modified.**
- **No changes were made to existing database tables or constraints.**
- **No SQL statements were executed against staging or production environments.**
- **No RLS policies or database privileges were modified.**

All features in the Social Automation Dashboard are built to execute strictly on top of the currently active schema (Migration `026` baseline). Features that conceptually benefit from Migration `027` or `028` columns are handled safely through deterministic in-memory and projection adapters without violating database constraints.

---

## 2. Actual Schema Inspected and Utilized (Migration 026 Baseline)

The following tables and columns from Migration `026` are verified and actively utilized:

### 2.1 Table: `public.meta_social_connections`
- **Columns Utilized:**
  - `id` (UUID, Primary Key)
  - `business_id` (UUID, Foreign Key to `businesses.id`)
  - `platform` (TEXT, 'facebook' | 'instagram')
  - `account_id` (TEXT, Page ID or IG Business Account ID)
  - `account_name` (TEXT)
  - `username` (TEXT, Nullable, IG handle)
  - `page_id` (TEXT, Nullable, Linked FB Page ID)
  - `credential_ref` (TEXT, AES-256-GCM vault reference)
  - `connection_status` (TEXT, 'connected' | 'disconnected' | 'expired' | 'error')
  - `is_enabled` (BOOLEAN)
  - `auto_reply_dms` (BOOLEAN)
  - `auto_reply_comments` (BOOLEAN)
  - `auto_dm_on_comment` (BOOLEAN)
  - `comment_dm_trigger_keywords` (JSONB)
  - `default_comment_reply` (TEXT)
  - `last_webhook_at` (TIMESTAMPTZ, Nullable)
  - `last_reply_at` (TIMESTAMPTZ, Nullable)
  - `metadata` (JSONB)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **Constraint Verified:** `uq_meta_social_connections_tenant_platform_account (business_id, platform, account_id)`
- **RLS Status:** Active. Access restricted via `check_user_business_access(business_id)`.

### 2.2 Table: `public.meta_social_credentials`
- **Columns Utilized:**
  - `id` (UUID, Primary Key)
  - `connection_id` (UUID, Foreign Key to `meta_social_connections.id`)
  - `business_id` (UUID, Foreign Key to `businesses.id`)
  - `key_version` (TEXT, default 'v1')
  - `iv` (TEXT, Hex encoded)
  - `auth_tag` (TEXT, Hex encoded)
  - `ciphertext` (TEXT, Hex encoded)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **RLS Status:** Active. Strict server-side admin access.

### 2.3 Table: `public.meta_social_rules`
- **Columns Utilized:**
  - `id` (UUID, Primary Key)
  - `business_id` (UUID, Foreign Key to `businesses.id`)
  - `connection_id` (UUID, Nullable)
  - `platform` (TEXT, 'facebook' | 'instagram' | 'both')
  - `target_type` (TEXT, 'message' | 'comment' | 'both')
  - `rule_name` (TEXT)
  - `description` (TEXT, Nullable)
  - `keywords` (JSONB, Array of Unicode Tamil and English strings)
  - `match_type` (TEXT, 'exact' | 'contains' | 'starts_with' | 'any')
  - `response_action` (TEXT, 'reply_dm' | 'reply_comment_public' | 'reply_comment_private_dm' | 'both_public_and_private')
  - `predefined_reply` (TEXT)
  - `predefined_dm` (TEXT, Nullable)
  - `priority` (INT, default 100)
  - `is_active` (BOOLEAN, default true)
  - `stop_processing_on_match` (BOOLEAN, default true)
  - `created_at` (TIMESTAMPTZ)
  - `updated_at` (TIMESTAMPTZ)
- **Constraint Verified:** `uq_meta_social_rules_id_business (id, business_id)`
- **RLS Status:** Active. Full tenant isolation.

### 2.4 Table: `public.meta_social_events`
- **Columns Utilized:**
  - `id` (UUID, Primary Key)
  - `business_id` (UUID, Foreign Key to `businesses.id`)
  - `connection_id` (UUID, Foreign Key to `meta_social_connections.id`)
  - `platform` (TEXT, 'facebook' | 'instagram')
  - `event_type` (TEXT, 'message' | 'comment' | 'mention')
  - `meta_event_id` (TEXT, Message ID or Comment ID)
  - `sender_id` (TEXT, PSID or IGSID)
  - `sender_name` (TEXT, Nullable)
  - `post_id` (TEXT, Nullable)
  - `comment_id` (TEXT, Nullable)
  - `parent_comment_id` (TEXT, Nullable)
  - `content` (TEXT)
  - `status` (TEXT, 'received' | 'processed' | 'replied' | 'failed' | 'ignored')
  - `matched_rule_id` (UUID, Nullable)
  - `reply_type` (TEXT, 'dm_reply' | 'comment_public_reply' | 'comment_private_dm' | 'both' | 'none')
  - `reply_content` (TEXT, Nullable)
  - `error_message` (TEXT, Nullable)
  - `created_at` (TIMESTAMPTZ)
- **Constraint Verified:** `uq_meta_social_events_dedup (business_id, meta_event_id)`

---

## 3. Database Dependencies Requiring Future Migrations (Post-Phase 13D)

The following capabilities are architecturally designed for future production rollout and depend on Migrations `027` and `028`. During Phase 13D, they were handled using strict non-invasive software adapters:

| Missing Schema Element | Migration Source | Purpose | Phase 13D Safe Software Adapter |
|---|---|---|---|
| `public_reply_status` column on `meta_social_events` | Migration 027 Section 4 | Independent tracking of public comment reply delivery | Projected deterministically from existing `status` and `reply_type` (`projectEventToLead`) |
| `private_reply_status` column on `meta_social_events` | Migration 027 Section 4 | Independent tracking of private DM reply delivery | Projected deterministically from existing `status` and `reply_type` (`projectEventToLead`) |
| `public_reply_id` & `private_reply_id` columns | Migration 027 Section 4 | Meta API response ID storage | Stored within existing `metadata` JSONB column |
| `event_timestamp` column | Migration 027 Section 4 | Original Meta webhook timestamp | Derived from `created_at` / `metadata` |
| `meta_social_deliveries` table | Migration 027 Section 5 | Granular delivery retry queue | Inbound event ledger (`meta_social_events`) tracks overall outcome directly |
| `meta_social_dead_letters` table | Migration 028 Section 1 | Dead-letter storage for unprocessable payloads | Events marked with `status = 'failed'` and `error_message` in Migration 026 ledger |
| `claim_meta_social_events_atomic` RPC | Migration 028 Section 2 | Distributed worker locking | Worker operates in single-concurrency or dormant inspection mode |
| `uq_meta_social_connections_global_platform_account` | Migration 027 Section 1 | Global account uniqueness across all tenants | Existing tenant-scoped constraint `uq_meta_social_connections_tenant_platform_account` enforced |

---

## 4. Tenant Ownership and RLS Verification

1. **Composite Foreign Keys & Triggers:** All tables include `business_id` with foreign key references to `businesses(id)` with `ON DELETE CASCADE`.
2. **Tenant Immutability Triggers:** Verified that `prevent_tenant_reassignment()` blocks any attempt to reassign `business_id` via SQL updates.
3. **Fail-Closed Queries:** All queries in `src/app/actions/social-automations.ts` strictly enforce `.eq("business_id", business.id)`. No client-supplied tenant ID is trusted.
4. **Zero Cross-Tenant Leakage:** Verified through automated tests (`tests/phase13d-social-automation-dashboard.test.ts` Domain 2).

---

## 5. Conclusion & Recommendations

The application remains 100% compliant with Migration 026 baseline. No manual or automatic database interventions are necessary to run the Phase 13D dashboard.

When proceeding to production activation in Phase 13E:
1. Review and apply Migration `20261122171900_027_meta_social_critical_fixes.sql`.
2. Review and apply Migration `20261122172000_028_meta_social_worker_reliability.sql`.
3. Verify live index and constraint creation before enabling live Meta outbound messaging.
