# PHASE 13A — COMPLETE BACKEND SOURCE CODE AUDIT REPORT
## Gokul Connect — Facebook & Instagram Auto Comment Automation

**Audit Date:** November 22, 2026  
**Auditor:** Senior Full-Stack Architect (Meta Graph API, Supabase, Next.js, Security)  
**Scope:** Phase 13 Meta Social Automation (Facebook Pages & Instagram Professional Auto-Replies)  
**Mode:** AUDIT-ONLY (Zero source code, database, or environment modifications executed)

---

## 1. EXECUTIVE SUMMARY

An exhaustive architectural and security audit was conducted on the existing Phase 13 implementation for Gokul Connect's Facebook Page and Instagram Professional comment and DM automation.

### Key Audit Conclusions:
1. **Independent Test Suite Verification:** The Phase 13 test suite (`tests/phase13-meta-social-automation.test.ts`) currently exits with code 0 and passes 14/14 tests. However, the tests rely entirely on **in-memory mocks** (`createMockSupabase`, mocked `client` HTTP calls) and **do not execute against PostgreSQL or PGlite**, nor do they test migration 026, the webhook route handlers, or live Meta Graph API payloads.
2. **Prior Test Exit Code 1 Investigation:** When running the project's root `npm test` (`vitest run`), the test command exited with code 1 due to high CPU load during parallel PGlite migration tests causing timing assertions in `tests/phase7-5-1-webhook-latency-benchmark.test.ts` to slightly exceed strict 15ms p95 latency thresholds (27ms vs 15ms). When run in isolation, `phase7-5-1` passes cleanly with exit code 0.
3. **Critical Architectural Vulnerability (P0):** The current Meta Social webhook (`src/app/api/webhooks/meta-social/route.ts`) processes inbound events **synchronously** inside the HTTP POST handler, executing rule evaluation and making up to two blocking external HTTP fetch calls to Meta Graph API before acknowledging HTTP 200. This directly violates Meta's 5-second webhook acknowledgement mandate, risks Vercel serverless function timeouts (10-15s), and causes duplicate deliveries and silent event drops.
4. **Data Loss on Database Glitch (P0):** If database persistence fails in `ingestSocialEvent`, the error is swallowed and the route returns HTTP 200 to Meta, permanently dropping events that Meta will never retry.
5. **Multi-Tenant Isolation Gap (P0):** `meta_social_connections` enforces `UNIQUE(business_id, platform, account_id)` instead of global `UNIQUE(platform, account_id)`. Two businesses can register the same Page/Account ID, causing `SELECT ... LIMIT 1` in the ingestion RPC to non-deterministically route webhooks across tenants.
6. **Cross-Tenant Credential Leak Risk (P0):** In `service.ts`, if connection credentials cannot be decrypted, the code falls back to `process.env.META_PAGE_ACCESS_TOKEN`, allowing one tenant to dispatch messages using another tenant's access token.
7. **Meta API Compliance Flaws (P1):** Instagram Private Replies (`/messages`) require the connected **Facebook Page ID**, but `service.ts` falls back to `accountId` (IG User ID) when `page_id` is missing, which Meta Graph API rejects with `(#100) Param recipient[comment_id] is not valid`. Combined public+private replies lack independent delivery state tracking, and Meta outbound message/comment IDs are discarded without database persistence.

---

## 2. EXISTING ARCHITECTURE & REUSABLE ASSETS

### Framework & Runtime Environment
- **Framework:** Next.js 15.1.0 (App Router, Server Actions, Route Handlers)
- **UI Library:** React 19.0.0, Tailwind CSS 3.4.17, Lucide React
- **Runtime:** Node.js v26.13.1 on Windows
- **Database:** Supabase PostgreSQL with Row Level Security (RLS) & `@supabase/ssr` 0.5.2
- **Test Framework:** Vitest 4.1.12 with `@electric-sql/pglite` 0.5.15

### Tenant Isolation & Security Architecture
- Multi-tenant data model separating **Astrology** (`slug: 'astrology'`) and **Vivaham** (`slug: 'vivaham'`).
- Server-side tenant authorization via `validateBusinessAccess(slug)` in `src/lib/auth/tenant-guard.ts`.
- Tenant immutability triggers (`prevent_tenant_reassignment()`) preventing SQL reassignment of `business_id`.
- Credential vault using AES-256-GCM encryption with unique 12-byte IV and 16-byte authentication tags in `src/lib/crypto/encryption.ts`.
- Webhook signature verification via constant-time HMAC-SHA256 (`crypto.timingSafeEqual`) in `src/lib/whatsapp/crypto-signature.ts`.

### Contrast: WhatsApp vs. Meta Social Architecture

| Architectural Dimension | Existing WhatsApp Engine (Phase 7.5) | Existing Meta Social Engine (Phase 13) |
| :--- | :--- | :--- |
| **Webhook Ingestion** | Fully decoupled: persists raw event, enqueues background job, returns HTTP 200 (<100ms) | Synchronous: evaluates rules and executes Meta API calls before returning HTTP 200 |
| **Outbound Dispatch** | Asynchronous worker via cron (`/api/cron/process-automation-jobs`) | Synchronous inline `fetch()` inside webhook handler |
| **Failure Recovery** | Retry schedule, exponential backoff, dead-letter classification, cron recovery | No queue, no retry schedule, no background worker, no cron recovery |
| **Persistence Failure** | Returns HTTP 500 so Meta safely retries delivery | Swallows error, returns HTTP 200, causes permanent data loss |
| **Delivery State** | Independent status per message, outbound message IDs persisted | Single aggregate status, outbound Meta IDs discarded |
| **Account Uniqueness** | `phone_number_id TEXT NOT NULL UNIQUE` (global) | `UNIQUE (business_id, platform, account_id)` (scoped to tenant) |

---

## 3. COMPLETE FILE-BY-FILE AUDIT FINDINGS

### 3.1 `src/lib/meta-social/types.ts`
- **Strengths:** Clean TypeScript definitions for platforms, event types, match types, response actions, connection configs, and rules.
- **Weaknesses:**
  - `MetaSocialConnection` lacks `token_expires_at`, `refresh_token`, and granted OAuth scopes.
  - `MetaSocialEvent` lacks separate delivery status fields (`public_reply_status`, `private_reply_status`) and outbound Meta IDs (`public_reply_id`, `private_reply_id`).
  - `NormalizedMetaSocialEvent` uses `timestamp: number` without timezone guarantee or original Meta event ISO string.

### 3.2 `src/lib/meta-social/parser.ts`
- **Function:** `parseMetaSocialWebhook(payload)`
- **Strengths:** Correctly distinguishes `object: "page"` (Facebook) and `object: "instagram"`; filters out Page echoes (`is_echo: true`) and self-comments (`from.id === accountId`).
- **Weaknesses:**
  - **Missing Instagram Nested Comment Support:** Does not parse `value.parent_id` for Instagram comments on Reels/Media.
  - **Instagram Timestamp Hardcoding:** Sets `timestamp: Date.now()` instead of extracting `value.created_time` or `entry.time`. This masks old comments and prevents enforcing Meta's 7-day private reply window.
  - **Incomplete Sender Identification:** If Instagram privacy settings omit `value.from.id`, it falls back to `commentId`, which is not an IGSID and cannot be used for DM targeting.

### 3.3 `src/lib/meta-social/evaluator.ts`
- **Functions:** `normalizeSocialText`, `matchSocialRule`, `findMatchingSocialRule`
- **Strengths:**
  - Uses `normalize("NFKC")` which preserves Unicode Tamil glyphs while normalizing ASCII.
  - Strips zero-width spaces (`\u200B-\u200D\uFEFF`).
  - Deterministic priority ordering (ASC: priority 1 executes before priority 100).
- **Weaknesses:**
  - **Incomplete Punctuation Stripping:** Punctuation regex `/[.,/#!$%^&*;:{}=\-_`~()?]/g` omits quotation marks (`"`, `'`), square brackets (`[`, `]`), angle brackets (`<`, `>`), and symbols (`@`, `+`). A comment containing `[INFO]` or `"price"` fails exact matching against `info` or `price`.
  - **Duplicated Logic:** Implemented separate normalization rather than harmonizing with `src/lib/automation/normalizer.ts`.
  - **Unused Column:** `rule.stop_processing_on_match` is defined but ignored because `findMatchingSocialRule` always halts at the first matching rule.

### 3.4 `src/lib/meta-social/client.ts`
- **Functions:** `sendMetaSocialDm`, `replyMetaCommentPublic`, `sendMetaCommentPrivateDm`, `sanitizeSocialLog`
- **Strengths:**
  - Token masking utility (`sanitizeSocialLog`) prevents access tokens from leaking into console logs or error messages.
  - Clean error wrapper `MetaSocialApiError` capturing `code`, `subcode`, `fbtrace_id`.
  - Correct endpoint for Instagram public comment replies: `POST /{comment-id}/replies`.
- **Weaknesses:**
  - **Broken Instagram Private Reply Parameterization:** `sendMetaCommentPrivateDm` accepts `pageId: string`, but does not enforce that this MUST be the connected Facebook Page ID when replying to Instagram comments.
  - **No Error Classification:** Does not classify Meta OAuth error subcodes (e.g., Subcode 463 for token expired, Subcode 2018001 for private reply already sent, Subcode 2018002 for comment older than 7 days).
  - **No Retry or Rate Limit Header Inspection:** Ignores Meta `x-business-use-case-usage` or `Retry-After` headers.

### 3.5 `src/lib/meta-social/service.ts`
- **Function:** `processMetaSocialEvent`
- **Strengths:** Orchestrates ingestion, rule matching, token resolution, and dispatch in a single pipeline.
- **Weaknesses:**
  - **P0 Global Fallback Token:** Falls back to `process.env.META_PAGE_ACCESS_TOKEN` if credential decryption fails, violating tenant isolation.
  - **P0 Synchronous Execution:** Dispatches external HTTP requests directly within the webhook request cycle.
  - **P1 Atomicity Loss on Combined Replies:** When `both_public_and_private` is active, if public reply succeeds but private DM fails, the entire event is marked `failed`. On retry, duplicate public comments will be posted.
  - **P1 Outbound IDs Discarded:** The response from Meta API (`id`, `message_id`) is discarded and never saved to the database.
  - **P1 Identical Text for DM and Comment:** Default keyword trigger (Case B) sends `default_comment_reply` text ("Thank you for your comment! We have sent details directly to your inbox.") as BOTH public comment and private DM.

### 3.6 `src/lib/meta-social/database.ts`
- **Functions:** `getSocialConnectionsForBusiness`, `getSocialRulesForBusiness`, `ingestSocialEvent`, `updateSocialEventResult`
- **Strengths:** Provides both an atomic RPC invocation path and a direct SQL fallback.
- **Weaknesses:**
  - In `ingestSocialEvent`, database insertion errors return `{ status: "ignored" }` instead of throwing or returning an error, causing the webhook route to return HTTP 200 and silently lose the event.
  - Fallback connection query uses `.or('account_id.eq.${event.accountId},page_id.eq.${event.accountId}').limit(1).single()`, which selects an arbitrary row if multiple businesses configured the same account.

### 3.7 `src/app/api/webhooks/meta-social/route.ts`
- **Handlers:** `GET` (handshake), `POST` (webhook receiver)
- **Strengths:**
  - Fail-closed if `META_APP_SECRET` is missing.
  - Verifies HMAC-SHA256 signature using constant-time comparison.
  - Rate-limits handshake requests and forged signature attempts.
- **Weaknesses:**
  - **P0 Synchronous Execution:** Awaits `processMetaSocialEvent` inside the loop before returning HTTP 200.
  - **P0 Silent Data Loss:** Catches errors in the event processing loop and returns HTTP 200 even when event ingestion or dispatch failed.
  - **P2 Non-Timing-Safe Handshake:** GET handler compares verify tokens with `token === expectedToken` instead of `crypto.timingSafeEqual`.

### 3.8 `src/app/actions/social-automations.ts`
- **Server Actions:** `getSocialConnectionsAction`, `saveSocialConnectionAction`, `deleteSocialConnectionAction`, `getSocialRulesAction`, `saveSocialRuleAction`, `deleteSocialRuleAction`, `getSocialAuditEventsAction`
- **Strengths:**
  - Strict tenant authorization using `validateBusinessAccess(businessSlug)`.
  - Role-based authorization (`owner` and `admin` only).
  - Encrypts tokens with AES-256-GCM before database insertion.
- **Weaknesses:**
  - `saveSocialConnectionAction` does not validate that `pageId` is provided when `platform === 'instagram'`.
  - No connection health test action (unlike WhatsApp which has `testConnectionAction`).
  - No UI page currently invokes these actions.

### 3.9 `supabase/migrations/20261121_026_meta_social_automation.sql`
- **Tables:** `meta_social_connections`, `meta_social_credentials`, `meta_social_rules`, `meta_social_events`
- **Strengths:**
  - Strong RLS policies for authenticated users and `service_role`.
  - Tenant immutability triggers on `meta_social_connections` and `meta_social_rules`.
  - Dedup constraint `uq_meta_social_events_dedup UNIQUE (business_id, meta_event_id)`.
- **Weaknesses:**
  - Missing global uniqueness constraint on `(platform, account_id)`.
  - Missing composite foreign keys `FOREIGN KEY (connection_id, business_id) REFERENCES meta_social_connections(id, business_id)`.
  - Missing tenant immutability triggers on `meta_social_credentials` and `meta_social_events`.
  - Missing outbound delivery columns: `public_reply_id`, `private_reply_id`, `public_reply_status`, `private_reply_status`.
  - Missing retry scheduling columns (`retry_count`, `next_retry_at`, `max_retries`).
  - RPC function `ingest_meta_social_event_atomic` lacks `ON CONFLICT` or `EXCEPTION WHEN unique_violation` handling.

---

## 4. META GRAPH API COMPLIANCE MATRIX

Independent verification against official Meta Graph API v21.0 documentation:

| Operation | HTTP Method & Endpoint | Required Meta Permissions | Required Payload | Account Eligibility & Prerequisites | Applicable Limitations & Rules | Official Meta Documentation URL |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A. Facebook Public Comment Reply** | `POST https://graph.facebook.com/v21.0/{comment-id}/comments` | `pages_read_engagement`, `pages_manage_posts` | `{"message": "..."}` | Facebook Page (Page Access Token with `MODERATE` or `CREATE_CONTENT` task) | Cannot reply to hidden/deleted comments; subject to Page velocity limits | [Meta Graph API: Comments](https://developers.facebook.com/docs/graph-api/reference/v21.0/comment/comments) |
| **B. Facebook Private Reply to Comment** | `POST https://graph.facebook.com/v21.0/{page-id}/messages` | `pages_messaging` | `{"recipient": {"comment_id": "{comment-id}"}, "message": {"text": "..."}}` | Facebook Page (Page Access Token). Recipient must be an individual Facebook user (not a Page). | Exactly 1 private reply per comment. Must be sent within **7 days** of comment creation. Opens 24-hr window only after user replies. | [Messenger Platform: Send API](https://developers.facebook.com/docs/messenger-platform/reference/send-api/) |
| **C. Instagram Public Comment Reply** | `POST https://graph.facebook.com/v21.0/{ig-comment-id}/replies` | `instagram_basic`, `instagram_manage_comments` | `{"message": "..."}` | Instagram Professional Account (Business or Creator) linked to a Facebook Page | Only for comments on media owned by the account. Cannot reply to disabled or spam-filtered comments. | [Instagram Graph API: Replies](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/replies) |
| **D. Instagram Private Reply to Comment** | `POST https://graph.facebook.com/v21.0/{linked-page-id}/messages` | `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, `pages_messaging` | `{"recipient": {"comment_id": "{ig-comment-id}"}, "message": {"text": "..."}}` | Instagram Professional Account linked to a Facebook Page (Page Access Token required) | Exactly 1 private reply per comment. Must be sent within **7 days** of comment creation. For Instagram Live, reply is only valid during active broadcast. Rate limited to ~750 replies/hr. | [Instagram Messaging: Private Replies](https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies) |
| **E. Facebook Page Webhook Subscription** | `POST https://graph.facebook.com/v21.0/{page-id}/subscribed_apps` | `pages_manage_metadata` | `{"subscribed_fields": ["feed", "messages"]}` | Facebook Page | Requires Meta App Review approval for production access | [Facebook Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/) |
| **F. Instagram Webhook Subscription** | `POST https://graph.facebook.com/v21.0/{linked-page-id}/subscribed_apps` | `instagram_manage_comments`, `instagram_manage_messages` | `{"subscribed_fields": ["comments", "messages", "mentions"]}` | Instagram Professional Account linked to Page | Webhook object is `instagram`. Subscriptions receive comments on Posts, Videos, and Reels. | [Instagram Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/) |
| **G. Instagram Reels Comment Support** | Supported via `field: "comments"` webhook | `instagram_manage_comments` | Same as item C (`/{ig-comment-id}/replies`) and D | Instagram Professional Account | Webhook payload contains `media: { id: "...", media_product_type: "REELS" }`. Comments on Reels behave identically to standard media comments. | [Instagram Platform: Media](https://developers.facebook.com/docs/instagram-platform/) |

---

## 5. WEBHOOK & CRYPTOGRAPHIC SECURITY AUDIT

| Security Dimension | Current Implementation | Verdict | Risk / Vulnerability | Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Raw Request Body** | `await request.text()` before `JSON.parse` | PASS | None; raw bytes correctly fed to HMAC | Retain existing implementation |
| **HMAC-SHA256 Signature** | `crypto.createHmac("sha256", secret)` | PASS | None; matches Meta specification | Retain existing implementation |
| **Timing-Safe Comparison** | `crypto.timingSafeEqual(expected, actual)` | PASS | None; timing side-channel protected | Retain existing implementation |
| **Missing Secret Handling** | Fails closed with HTTP 500 | PASS | None; strictly rejects requests if secret unset | Retain existing implementation |
| **GET Handshake Comparison** | `token === expectedToken` (line 34) | FAIL | Timing leakage on verify token | Replace with SHA-256 buffer `crypto.timingSafeEqual` |
| **Forged Signature Rejection** | Returns HTTP 401 & throttles IP | PASS | Abusive IPs rate-limited | Retain existing implementation |
| **Event Persistence Order** | Evaluates rules & dispatches before returning 200 | FAIL (P0) | Exceeds Meta 5s timeout; drops events | Return HTTP 200 immediately after persistence (<100ms) |
| **Persistence Failure Handling** | Returns HTTP 200 with `{ status: "ignored" }` | FAIL (P0) | Silent permanent data loss | Return retryable HTTP 500 so Meta retries |
| **Crash Resilience** | Crash during dispatch marks event duplicate on retry | FAIL (P0) | Incomplete event never retried | Background job table with atomic status locking |

---

## 6. MULTI-TENANT ISOLATION AUDIT

### Analysis: Astrology vs. Vivaham Isolation

1. **Server Actions Authorization:**
   - Both businesses are protected by `validateBusinessAccess(businessSlug)`.
   - Every database query in `src/app/actions/social-automations.ts` includes `.eq("business_id", business.id)`.
   - Role checks (`owner`, `admin`) strictly enforced.
   - **Verdict:** Secure.

2. **Row Level Security (RLS) in Migration 026:**
   - All 4 tables (`meta_social_connections`, `meta_social_credentials`, `meta_social_rules`, `meta_social_events`) have RLS enabled.
   - Authenticated users can only read/modify rows where `check_user_business_access(business_id)` is true.
   - **Verdict:** Secure.

3. **Account-to-Business Webhook Mapping Flaw (P0):**
   - In `meta_social_connections`, `uq_meta_social_connections_tenant_platform_account` is scoped to `(business_id, platform, account_id)`.
   - If Business A registers Page ID `1001` and Business B registers Page ID `1001`, PostgreSQL permits both rows.
   - In `ingest_meta_social_event_atomic`, the lookup does:
     ```sql
     SELECT * INTO v_connection FROM meta_social_connections
     WHERE platform = p_platform AND (account_id = p_account_id OR page_id = p_account_id)
     LIMIT 1;
     ```
   - This causes non-deterministic tenant routing. Incoming webhooks for Business A could be routed to Business B!
   - **Verdict:** **FAIL (P0 Critical Cross-Tenant Leak).** Must enforce global uniqueness on `(platform, account_id)`.

4. **Global Fallback Access Token Flaw (P0):**
   - `src/lib/meta-social/service.ts` line 92 falls back to `process.env.META_PAGE_ACCESS_TOKEN`.
   - If Business A's encrypted credential is missing, it dispatches using the global token (which may belong to Business B).
   - **Verdict:** **FAIL (P0 Critical Cross-Tenant Token Leak).**

5. **Composite Foreign Key Integrity Gap (P2):**
   - Tables reference `connection_id` and `business_id` as separate foreign keys, omitting `FOREIGN KEY (connection_id, business_id) REFERENCES meta_social_connections(id, business_id)`.
   - **Verdict:** Incomplete tenant integrity enforcement.

---

## 7. DATABASE SCHEMA AUDIT (MIGRATION 026)

Detailed inspection of `supabase/migrations/20261121_026_meta_social_automation.sql`:

### 1. `meta_social_connections`
- **Missing Capabilities:**
  - Global `UNIQUE (platform, account_id)` constraint.
  - `token_expires_at TIMESTAMPTZ` for access token lifecycle and expiry warnings.
  - `default_dm_reply TEXT` (only `default_comment_reply` currently exists).
  - Validation check that `page_id IS NOT NULL` when `platform = 'instagram'`.

### 2. `meta_social_credentials`
- **Missing Capabilities:**
  - Composite foreign key `FOREIGN KEY (connection_id, business_id) REFERENCES meta_social_connections(id, business_id)`.
  - Tenant immutability trigger `trg_meta_social_credentials_immutable_business_id`.

### 3. `meta_social_rules`
- **Missing Capabilities:**
  - Composite foreign key `FOREIGN KEY (connection_id, business_id) REFERENCES meta_social_connections(id, business_id)`.
  - Extended keyword match options (e.g. `case_sensitive`, `regex_pattern`).

### 4. `meta_social_events`
- **Missing Capabilities:**
  - Composite foreign key `FOREIGN KEY (connection_id, business_id) REFERENCES meta_social_connections(id, business_id)`.
  - Tenant immutability trigger `trg_meta_social_events_immutable_business_id`.
  - Separate delivery tracking:
    - `public_reply_status TEXT DEFAULT 'none' CHECK (public_reply_status IN ('none', 'pending', 'replied', 'failed', 'skipped'))`
    - `private_reply_status TEXT DEFAULT 'none' CHECK (private_reply_status IN ('none', 'pending', 'replied', 'failed', 'skipped'))`
    - `public_reply_id TEXT` (Meta comment ID)
    - `private_reply_id TEXT` (Meta message ID)
  - `event_timestamp TIMESTAMPTZ` (original creation timestamp on Meta).
  - Retry scheduling: `retry_count INT DEFAULT 0`, `next_retry_at TIMESTAMPTZ`, `max_retries INT DEFAULT 3`.

### 5. `ingest_meta_social_event_atomic` RPC
- **Missing Capabilities:**
  - Lacks `ON CONFLICT (business_id, meta_event_id) DO NOTHING` or `EXCEPTION WHEN unique_violation` block, crashing with unhandled 500 on concurrent webhooks.
  - Lacks asynchronous job enqueueing (unlike `ingest_wa_inbound_message_v2`).

---

## 8. TEST EXECUTION RESULTS

All test suites were executed independently using Node v26.13.1 and Vitest 4.1.12.

| Test Suite | Exact Command | Exit Code | Passed | Failed | Skipped | Status & Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Phase 13 Meta Social Suite** | `npx vitest run tests/phase13-meta-social-automation.test.ts` | **0** | **14** | 0 | 0 | **PASSED.** In-memory mocks only; no DB/PGlite verification. |
| **Tenant Isolation Suite** | `npx vitest run tests/tenant-isolation.test.ts` | **0** | **7** | 0 | 0 | **PASSED.** Verified cross-tenant boundary protections. |
| **Credential Security Suite** | `npx vitest run tests/phase2-credential-security.test.ts` | **0** | **8** | 0 | 0 | **PASSED.** AES-256-GCM encryption verified. |
| **WhatsApp Webhook Suite** | `npx vitest run tests/phase3-webhooks.test.ts` | **0** | **6** | 0 | 0 | **PASSED.** Signature & secret fail-closed verified. |
| **Automation Engine Suite** | `npx vitest run tests/phase5-automation-engine.test.ts` | **0** | **30** | 0 | 0 | **PASSED.** Keyword matching & deterministic rules verified. |
| **Webhook Decoupling Suite** | `npx vitest run tests/phase7-5-webhook-decoupling.test.ts` | **0** | **18** | 0 | 0 | **PASSED.** Verified decoupled queue architecture. |
| **P0 Critical Regression Suite** | `npx vitest run tests/p0-critical-fixes-regression.test.ts` | **0** | **15** | 0 | 0 | **PASSED.** Core platform regressions verified. |
| **Latency Benchmark (Solo)** | `npx vitest run tests/phase7-5-1-webhook-latency-benchmark.test.ts` | **0** | **4** | 0 | 0 | **PASSED.** Latency benchmark passes when run alone. |
| **Full Project Test Run** | `npx vitest run` | **1** | **809** | **2** | 0 | **FAILED (2 tests).** Latency benchmarks in `phase7-5-1` failed due to CPU contention from 52 parallel test files. |

---

## 9. CLASSIFIED DEFECT REGISTER

### P0 — Critical Security & Data-Loss Issues

#### Finding P0-1: Synchronous Outbound Meta API Calls in Webhook Handler
- **File & Function:** `src/app/api/webhooks/meta-social/route.ts` (`POST`), `src/lib/meta-social/service.ts` (`processMetaSocialEvent`).
- **Existing Behavior:** Webhook receiver synchronously awaits external Meta Graph API calls (`replyMetaCommentPublic`, `sendMetaCommentPrivateDm`) before returning HTTP 200.
- **Problem:** Meta webhooks must be acknowledged in <5 seconds. Slow Meta API responses or multi-event batches trigger gateway timeouts. When Meta retries, the event is marked `duplicate`, permanently aborting execution.
- **Recommended Solution:** Decouple webhook ingestion from processing. Webhook persists the raw event to `meta_social_events` and enqueues a background job in <100ms. Outbound replies are dispatched by a decoupled worker.
- **Test Required:** Mocked latency test asserting webhook route returns HTTP 200 in <100ms without invoking `sendMetaSocialDm` or `replyMetaCommentPublic`.

#### Finding P0-2: Database Write Failure Silently Swallowed (Permanent Event Loss)
- **File & Function:** `src/app/api/webhooks/meta-social/route.ts` (`POST`), `src/lib/meta-social/database.ts` (`ingestSocialEvent`).
- **Existing Behavior:** If database insert fails, `ingestSocialEvent` returns `{ status: "ignored" }`, which causes the webhook route to return HTTP 200.
- **Problem:** Meta assumes the webhook was successfully processed and never retries. Database connection timeouts cause silent data loss.
- **Recommended Solution:** Return HTTP 500 when database persistence fails, ensuring Meta automatically retries with exponential backoff.
- **Test Required:** Route test simulating database exception during webhook POST, verifying HTTP 500 is returned.

#### Finding P0-3: Cross-Tenant Account Collision & Ambiguous Webhook Routing
- **File & Function:** `supabase/migrations/20261121_026_meta_social_automation.sql` (`meta_social_connections`), `src/lib/meta-social/database.ts` (`ingestSocialEvent`).
- **Existing Behavior:** Unique constraint is `UNIQUE (business_id, platform, account_id)`. Webhook connection query uses `LIMIT 1`.
- **Problem:** Two businesses can configure the same Page ID or Instagram Account ID. Webhook deliveries are routed non-deterministically, leaking customer comments and replies across tenants.
- **Recommended Solution:** Enforce global `UNIQUE (platform, account_id)` on `meta_social_connections`.
- **Test Required:** Database test asserting that inserting a duplicate `(platform, account_id)` for a second business raises a unique constraint violation.

#### Finding P0-4: Global Fallback Access Token in Multi-Tenant Service
- **File & Function:** `src/lib/meta-social/service.ts` (lines 91-97).
- **Existing Behavior:** Falls back to `process.env.META_PAGE_ACCESS_TOKEN` if database credentials cannot be decrypted.
- **Problem:** Violates tenant isolation by sharing a global token across different business tenants.
- **Recommended Solution:** Remove global environment variable fallback. If connection credential is unavailable, fail closed with a tenant-specific error.
- **Test Required:** Test asserting that an uncredentialed tenant connection fails closed without reading `process.env`.

#### Finding P0-5: Concurrency Race Condition in Deduplication RPC
- **File & Function:** `supabase/migrations/20261121_026_meta_social_automation.sql` (`ingest_meta_social_event_atomic`).
- **Existing Behavior:** Evaluates `IF EXISTS (...)` before executing `INSERT INTO meta_social_events`.
- **Problem:** Concurrent webhook deliveries for the same event trigger simultaneous inserts, causing an unhandled `23505 unique_violation` exception.
- **Recommended Solution:** Use `ON CONFLICT (business_id, meta_event_id) DO NOTHING` or catch `unique_violation` in an `EXCEPTION` block to return `{ status: 'duplicate' }` cleanly.
- **Test Required:** Concurrency test executing two parallel ingestion RPC calls with identical `meta_event_id`.

---

### P1 — Blocks Live Functionality

#### Finding P1-1: Instagram Private Replies Broken When `page_id` Missing
- **File & Function:** `src/lib/meta-social/client.ts` (`sendMetaCommentPrivateDm`), `src/lib/meta-social/service.ts` (line 100, 183).
- **Existing Behavior:** Calls `/{pageId}/messages` with `dmDispatcherId = pageId || accountId || event.accountId`.
- **Problem:** Meta Graph API mandates that Instagram private replies MUST use the linked **Facebook Page ID**. If `page_id` is missing and falls back to `accountId` (IG User ID), Meta returns an OAuth error (`#100 Param recipient[comment_id] is not valid`).
- **Recommended Solution:** Enforce `page_id` requirement for Instagram connections and validate that `sendMetaCommentPrivateDm` receives a valid Page ID.
- **Test Required:** Client test verifying Instagram private reply requests target `/{linked_page_id}/messages`.

#### Finding P1-2: Atomicity Failure on Combined Public + Private Reply
- **File & Function:** `src/lib/meta-social/service.ts` (lines 159-205).
- **Existing Behavior:** Awaits public comment reply, then awaits private DM. If private DM throws, the catch block marks the entire event `failed`.
- **Problem:** Public comment was already posted. Retrying the event posts duplicate public comments.
- **Recommended Solution:** Store independent delivery states: `public_reply_status` and `private_reply_status`.
- **Test Required:** Test where public reply succeeds and private reply fails, verifying public reply is skipped on retry.

#### Finding P1-3: Default Comment Reply Duplicated verbatim as Private DM
- **File & Function:** `src/lib/meta-social/service.ts` (lines 234-249), `supabase/migrations/20261121_026_meta_social_automation.sql`.
- **Existing Behavior:** Case B sends `default_comment_reply` text ("Thank you for your comment! We have sent details directly to your inbox.") to BOTH public comment and private DM.
- **Problem:** Customer receives a DM that says "We sent details to your inbox" instead of actual details.
- **Recommended Solution:** Add `default_dm_reply TEXT` to `meta_social_connections`.
- **Test Required:** Test verifying distinct content is dispatched for default public comment and default private DM.

#### Finding P1-4: Outbound Meta Message & Comment IDs Discarded
- **File & Function:** `src/lib/meta-social/service.ts`, `supabase/migrations/20261121_026_meta_social_automation.sql` (`meta_social_events`).
- **Existing Behavior:** Meta API return values (`{ id }`, `{ message_id }`) are discarded.
- **Problem:** Impossible to correlate outbound comments/messages with inbound events during customer disputes or audits.
- **Recommended Solution:** Persist `public_reply_id` and `private_reply_id` in `meta_social_events`.
- **Test Required:** Test asserting outbound Meta IDs are recorded in `meta_social_events`.

#### Finding P1-5: Missing Instagram Nested Comment Support & Zero Timestamp Validation
- **File & Function:** `src/lib/meta-social/parser.ts` (lines 87-111), `src/lib/meta-social/service.ts`.
- **Existing Behavior:** Ignores `value.parent_id` in Instagram comments; hardcodes `timestamp: Date.now()`.
- **Problem:** Nested comments on Reels cannot be distinguished from root comments. Comments older than 7 days are not filtered out, triggering Meta API errors.
- **Recommended Solution:** Parse `parent_id` and `created_time`; validate comment age (`<= 7 days`) before attempting private DMs.
- **Test Required:** Test verifying comments older than 7 days skip private DM dispatch.

---

### P2 — Reliability & Operational Improvements

#### Finding P2-1: Lack of Asynchronous Retry Schedule and Failed-Event Recovery Cron
- **File:** `src/lib/meta-social/service.ts`, `src/app/api/cron/`
- **Existing Behavior:** Failed events are marked `status = 'failed'` and never re-attempted.
- **Problem:** Transient Meta API errors (e.g. rate limits, 503s) result in permanent delivery failure.
- **Recommended Solution:** Add `retry_count`, `next_retry_at`, and create `/api/cron/process-social-automations` with exponential backoff.
- **Test Required:** Cron worker test processing pending and failed retryable events.

#### Finding P2-2: Missing Composite Foreign Keys on Tenant Tables
- **File:** `supabase/migrations/20261121_026_meta_social_automation.sql`
- **Existing Behavior:** Tables reference `connection_id` and `business_id` separately.
- **Problem:** Does not enforce composite foreign key integrity `(connection_id, business_id) REFERENCES meta_social_connections(id, business_id)`.
- **Recommended Solution:** Add composite foreign key constraints across all child tables.
- **Test Required:** Database test asserting cross-tenant connection assignment is rejected.

#### Finding P2-3: Missing Tenant Immutability Triggers on Credentials and Events
- **File:** `supabase/migrations/20261121_026_meta_social_automation.sql`
- **Existing Behavior:** `meta_social_credentials` and `meta_social_events` lack `prevent_tenant_reassignment()` triggers.
- **Problem:** `business_id` can theoretically be altered via SQL UPDATE.
- **Recommended Solution:** Add `BEFORE UPDATE` triggers executing `public.prevent_tenant_reassignment()`.
- **Test Required:** Immutability trigger test asserting updating `business_id` raises an exception.

#### Finding P2-4: Incomplete Punctuation Stripping in Evaluator Normalizer
- **File:** `src/lib/meta-social/evaluator.ts` (`normalizeSocialText`)
- **Existing Behavior:** Punctuation regex does not strip quotes (`"`, `'`), brackets (`[`, `]`), or symbols (`@`, `+`).
- **Problem:** `[INFO]` normalizes to `"[info]"`, failing exact match against `"info"`.
- **Recommended Solution:** Expand regex to strip all standard punctuation and enclosing symbols.
- **Test Required:** Normalizer test verifying `"[INFO]"` and `"\"PRICE\""` normalize to clean text.

#### Finding P2-5: Webhook GET Handshake Uses Non-Constant-Time Comparison
- **File:** `src/app/api/webhooks/meta-social/route.ts` (line 34)
- **Existing Behavior:** `token === expectedToken`.
- **Problem:** Timing side-channel vulnerability on webhook verify token.
- **Recommended Solution:** Use SHA-256 buffer comparison via `crypto.timingSafeEqual` (matching `cron-auth.ts`).
- **Test Required:** Handshake test asserting valid and invalid verify tokens are handled securely.

#### Finding P2-6: Missing Connection Token Expiration Tracking
- **File:** `supabase/migrations/20261121_026_meta_social_automation.sql` (`meta_social_connections`)
- **Existing Behavior:** Lacks `token_expires_at TIMESTAMPTZ`. Meta OAuth error code 190 does not update connection status.
- **Problem:** Admins receive no proactive warning when Page tokens expire.
- **Recommended Solution:** Add `token_expires_at` column; automatically set `connection_status = 'expired'` when Meta returns code 190.
- **Test Required:** Test asserting error code 190 updates connection status to `expired`.

---

### P3 — Optional Enhancements

#### Finding P3-1: No Frontend UI for Meta Social Automations
- **File:** `src/app/workspace/[businessSlug]/`
- **Existing Behavior:** Server actions exist in `src/app/actions/social-automations.ts`, but no UI pages exist.
- **Recommended Solution:** Build a unified Social Automation tab under Workspace Settings or Connections.

#### Finding P3-2: Regex Keyword Matching Support
- **File:** `src/lib/meta-social/evaluator.ts`, `src/lib/meta-social/types.ts`
- **Existing Behavior:** Rules support `exact`, `contains`, `starts_with`, `any`.
- **Recommended Solution:** Add `regex` match type with ReDoS safety guards matching WhatsApp Phase 5 normalizer.

---

## 10. PRIORITIZED IMPLEMENTATION ROADMAP (FOR PHASE 13B)

```
Phase 13B-1: Core Database Hardening & Schema Migration
├── Migration 027: Add global UNIQUE (platform, account_id)
├── Migration 027: Add composite foreign keys (connection_id, business_id)
├── Migration 027: Add tenant immutability triggers on credentials and events
├── Migration 027: Add public/private delivery tracking columns to meta_social_events
├── Migration 027: Add default_dm_reply and token_expires_at to meta_social_connections
└── Migration 027: Hardened ingest_meta_social_event_atomic with ON CONFLICT & EXCEPTION handling

Phase 13B-2: Webhook Decoupling & Queue Architecture
├── Decouple POST /api/webhooks/meta-social (atomic persist + enqueue in <100ms)
├── Return retryable HTTP 500 on persistence failure
├── Timing-safe GET handshake verification
└── Asynchronous background processor route: /api/cron/process-social-automations

Phase 13B-3: Service & Meta Client Compliance
├── Enforce Facebook Page ID resolution for Instagram private replies
├── Atomically isolate public comment reply from private DM delivery state
├── Save outbound Meta message_id and comment_id to audit ledger
├── Remove global process.env.META_PAGE_ACCESS_TOKEN fallback
├── Validate 7-day comment eligibility window before private DM dispatch
├── Parse Instagram parent_id and created_time in parser.ts
└── Expand Unicode normalizer punctuation stripping (quotes, brackets, math symbols)

Phase 13B-4: Verification & Comprehensive Integration Testing
├── PGlite migration replay tests for migration 026 & 027
├── Real HTTP route integration tests for GET and POST webhooks
├── Concurrency race condition tests on deduplication RPC
├── Full cross-tenant isolation regression tests (Astrology vs. Vivaham)
└── Verification of all WhatsApp regression suites
```

---

**End of Audit Report.**  
*Awaiting User Approval before proceeding to Phase 13B implementation.*
