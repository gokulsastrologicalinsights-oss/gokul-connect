# PHASE 13D.3 – AUTOMATIC PUBLIC COMMENT REPLY VERIFICATION REPORT

**Project:** Gokul Connect  
**Branch:** `phase-13b-critical-remediation`  
**Phase:** Phase 13D.3 – Automatic Public Comment Reply Verification  
**Date:** November 22, 2026  
**Final Verdict:** **READY WITH CONDITIONS**

---

## 1. PRIMARY OBJECTIVE & SCOPE BOUNDARY

The primary objective of this audit is to verify whether automatic public comment replies actually work for **Facebook** and **Instagram**.

The **ONLY** feature under review is:
$$\text{Incoming Comment} \longrightarrow \text{Keyword Detection} \longrightarrow \text{Correct Reply Selection} \longrightarrow \text{Public Reply Under Original Comment}$$

All other features (Private DMs, CRM lead management, YouTube automation, broad workflows) are strictly classified as out of scope.

---

## 2. END-TO-END EXECUTION PATH TRACE

### 2.1 The 10-Step Automatic Public Comment Reply Workflow

```
[Meta Platform (FB/IG)]
       │ (1) Inbound Webhook HTTP POST
       ▼
[src/app/api/webhooks/meta-social/route.ts]
       │ (2) HMAC-SHA256 signature verification & payload parsing
       ▼
[src/lib/meta-social/database.ts: ingestSocialEvent]
       │ (3) Identify connected account (Page ID / IG Account ID)
       │ (4) Resolve business_id (Astrology vs Vivaham) & persist to meta_social_events
       ▼
[src/lib/meta-social/worker.ts: processSocialEventsBatch]
       │ (5) Claim event atomically (FOR UPDATE SKIP LOCKED)
       ▼
[src/lib/meta-social/service.ts: processPersistedMetaSocialEvent]
       │ (6) Load active rules (getSocialRulesForBusiness)
       │ (7) Match Tamil / English keywords via normalizeSocialText (evaluator.ts)
       │ (8) Select public reply text (predefined_reply or default_comment_reply)
       │ (9) Check duplicate delivery in meta_social_deliveries (idempotency key)
       ▼
[src/lib/meta-social/client.ts: replyMetaCommentPublic]
       │ (10) Dispatch POST /{comment-id}/comments (FB) or POST /{comment-id}/replies (IG)
       ▼
[Database Persistence]
       Update meta_social_deliveries (status: 'succeeded', response_id)
       Update meta_social_events (status: 'replied', public_reply_id)
```

### 2.2 Trace Analysis by Step

| Step | Stage | Implementation File | Verification Finding |
|---|---|---|---|
| **1** | Receive comment event | `src/app/api/webhooks/meta-social/route.ts` | Listens on `/api/webhooks/meta-social`. Handshake (`GET`) and event ingestion (`POST`) implemented. |
| **2** | Validate webhook | `src/lib/whatsapp/crypto-signature.ts` | Timing-safe HMAC-SHA256 comparison against `META_APP_SECRET`. Rejects invalid or unsigned requests (401). |
| **3** | Identify connected account | `src/lib/meta-social/parser.ts` & `database.ts` | Extracts `entry.id` (Page ID or IG Account ID). Queries `meta_social_connections` with `is_enabled = true` and `connection_status = 'connected'`. |
| **4** | Identify correct business | `src/lib/meta-social/database.ts` | Resolves `conn.business_id` (Astrology `11111111-...` vs Vivaham `22222222-...`). Composite foreign key prevents tenant mismatch. |
| **5** | Load enabled rules | `src/lib/meta-social/database.ts` | `getSocialRulesForBusiness` selects active rules where `is_active = true` and `target_type IN ('comment', 'both')` sorted by priority ASC. |
| **6** | Match Tamil / English keywords | `src/lib/meta-social/evaluator.ts` | `normalizeSocialText` strips zero-width spaces, punctuation, lowercases ASCII, and preserves Tamil syllables (`ஜாதகம்`, `தகவல்`, `விவரம்`, `fees`, `details`). |
| **7** | Select correct public reply | `src/lib/meta-social/service.ts` | Selects `rule.predefined_reply` when `response_action` is `reply_comment_public` or `both_public_and_private`. Fallback to `default_comment_reply`. |
| **8** | Check duplicate delivery | `src/lib/meta-social/service.ts` | Checks `meta_social_deliveries` using idempotency key `idemp_pub_${eventId}_${commentId}`. Reconciles ambiguous delivery with `checkCommentReplied`. |
| **9** | Publish public reply | `src/lib/meta-social/client.ts` | Dispatches POST to `/{comment-id}/comments` for Facebook or `/{comment-id}/replies` for Instagram with `Authorization: Bearer <page_access_token>`. |
| **10** | Persist delivery result | `src/lib/meta-social/service.ts` & `database.ts` | Writes response ID to `meta_social_deliveries` and updates `meta_social_events.status = 'replied'`, `public_reply_id = response.id`. |

---

## 3. IDENTIFIED GAPS AND MISSING LINKS

While the logic chain is fully designed and verified with unit tests and mocks, three critical operational links must be addressed for live execution:

### Gap 1: Background Worker Execution in Serverless Environment (CRITICAL)
- **Finding:** In `src/app/api/webhooks/meta-social/route.ts` line 180, `processSocialEventsBatch(10)` is invoked as a floating asynchronous promise after returning HTTP 200 to Meta.
- **Risk:** In serverless runtimes (Next.js on Vercel), background execution contexts are immediately suspended or frozen once the response terminates.
- **Resolution:** Outbound replies depend on the cron route `/api/cron/process-social-automations`. An external cron scheduler (e.g., cron-job.org or Upstash) must ping this route every 1–2 minutes with `Authorization: Bearer <CRON_SECRET>`.

### Gap 2: Unapplied Migrations 027 and 028 in Production Database (CRITICAL)
- **Finding:** Migrations `20261122171900_027_meta_social_critical_fixes.sql` and `20261122172000_028_meta_social_worker_reliability.sql` remain unapplied to preserve the Migration 026 baseline.
- **Impact:**
  - Table `meta_social_deliveries` does not yet exist in the live database schema.
  - Columns `public_reply_status`, `public_reply_id`, `event_timestamp` do not exist on `meta_social_events`.
  - RPC function `claim_meta_social_events` does not exist in the live database.
- **Resolution:** These migrations must be formally executed against staging before live end-to-end tests can persist outbound delivery records.

### Gap 3: Inbox UI Store Decoupling
- **Finding:** `UnifiedCommentInboxClient.tsx` loads data from `src/lib/social-comments/comments-store.ts`, which currently maintains an in-memory `Map` with preset mock comments for interactive simulation.
- **Impact:** Comments received via the live webhook route `/api/webhooks/meta-social` are stored in PostgreSQL table `meta_social_events`, but do not automatically appear in the Comments Inbox UI until the inbox adapter is connected to query `meta_social_events`.

---

## 4. DUPLICATE PROTECTION & IDEMPOTENCY AUDIT

| Protection Layer | Mechanism | Evaluation |
|---|---|---|
| **Webhook Ingestion Deduplication** | Composite unique constraint `uq_meta_social_events_dedup (business_id, meta_event_id)` | **PASS:** Duplicate webhook events return `status: "duplicate"` and are ignored. |
| **Worker Concurrency Deduplication** | `claim_meta_social_events` RPC with `FOR UPDATE SKIP LOCKED` | **PASS (Design):** Prevents two workers from claiming the same event simultaneously. (Requires Migration 028). |
| **Action-Level Idempotency** | Idempotency key `idemp_pub_${eventId}_${commentId}` in `meta_social_deliveries` | **PASS:** Previous successful deliveries are skipped immediately. |
| **Ambiguous Network Reconciliation** | `checkCommentReplied` GET request inspects comment child replies for matching text | **PASS:** Prevents duplicate posting if Meta returns a 504 gateway timeout or TCP disconnect after receiving the reply. |
| **Retry Governance** | Exponential backoff with jitter (`computeBackoffDelay`), max 3 attempts | **PASS:** Transient HTTP 429/500/503 errors back off safely; non-transient 4xx errors fail immediately without retry. |

> **Note on Exactly-Once Delivery:** Exactly-once delivery cannot be theoretically guaranteed across distributed networks without receiver-side idempotency keys. However, Gokul Connect enforces **at-least-once ingestion** combined with **at-most-once outbound dispatch** through its idempotency ledger and pre-flight reconciliation.

---

## 5. STRICT SCOPE AUDIT (EXCESS FEATURES IDENTIFIED)

The product specification is strictly limited to public comment replies. The following features were identified in the codebase and must remain dormant or separated:

1. **Private DMs / Comment-to-DM:**
   - Implemented in `service.ts` (`sendMetaCommentPrivateDm`) and `rules-store.ts` (`predefined_dm`, `reply_comment_private_dm`).
   - *Status:* **OUT OF SCOPE.** Must not be activated for pure public comment reply workflows.
2. **CRM & Lead Lifecycle Tracking:**
   - Implemented in `src/lib/meta-social/leads-store.ts` (extracting commenter phone/email and tracking intent status).
   - *Status:* **OUT OF SCOPE.**
3. **YouTube Comment Ingestion & Replies:**
   - Implemented in `src/lib/social-comments/youtube-client.ts` and `youtube-oauth.ts`.
   - *Status:* **OUT OF SCOPE** for Meta Phase 13D.3.
4. **Broadcast & Marketing Campaigns:**
   - Implemented in `src/lib/campaigns/`.
   - *Status:* **OUT OF SCOPE.** Completely isolated.

---

## 6. FINAL VERDICT & PREREQUISITES FOR STAGING

### Final Verdict: **READY WITH CONDITIONS**

### Mandatory Conditions for Staging Execution:
1. **Apply Migration 027 & 028:** Run migration files on the staging Supabase instance to create `meta_social_deliveries` and worker RPCs.
2. **Register Cron Job:** Configure external runner for `/api/cron/process-social-automations` with `CRON_SECRET`.
3. **Configure Meta Permissions:** Ensure target Facebook Page and Instagram Professional Account grant `pages_manage_posts`, `pages_read_engagement`, `instagram_manage_comments`, and `instagram_basic`.
4. **Connect Inbox Query Adapter:** Connect `UnifiedCommentInboxClient` to read from `meta_social_events` rather than the in-memory simulation store.
5. **Keep Private DMs Deactivated:** Enforce rules with `response_action = 'reply_comment_public'` only.
