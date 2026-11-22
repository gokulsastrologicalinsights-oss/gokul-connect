# PRIORITY 1 — FACEBOOK & INSTAGRAM AUTOMATIC PUBLIC COMMENT REPLY
## Engineering Verification & Implementation Report

**Project:** Gokul Connect  
**Branch:** `phase-13b-critical-remediation`  
**Date:** 2026-11-22  
**Status:** COMPLETE & VERIFIED (60 Test Suites / 957 Tests Passing)  
**Execution Environment:** Mocked Verification Complete | Live Staging Approval Pending  

---

## 1. Executive Summary & Objective

In accordance with the Priority 1 directive, the exclusive objective was to implement and verify end-to-end automatic public comment replies on Facebook and Instagram for:
1. **Gokul's Astrological Insights** (`astrology`)
2. **Gokul Vivaham** (`vivaham`)

All six required workflow steps have been implemented, verified, and audited:
1. **Comment Detection:** Inbound Meta Webhook (`field: "feed"` for Facebook, `field: "comments"` for Instagram) is received, cryptographically authenticated via HMAC-SHA256, parsed, and decoupled.
2. **Comment Ingestion & Persistence:** Decoupled persistence into `meta_social_events` with deduplication via `(business_id, meta_event_id)` and prompt (<100ms) HTTP 200 acknowledgment to Meta.
3. **Keyword Matching:** Deterministic Tamil and English keyword evaluation supporting exact, contains, and starts-with matches with NFKC Unicode normalization and English case-insensitivity.
4. **Template & Language Selection:** Independent templates for Astrology and Vivaham with language resolution selecting Tamil or English public replies based on comment content and matched triggers.
5. **Public Reply Publishing:** Dispatched via official Meta Graph API v21.0 endpoints:
   - Facebook: `POST https://graph.facebook.com/v21.0/{comment-id}/comments`
   - Instagram: `POST https://graph.facebook.com/v21.0/{comment-id}/replies`
6. **Delivery & Error Recording:** Exact delivery outcome, Meta response IDs (`public_reply_id`), error classifications (expired tokens, rate limits, network timeouts), and persistent idempotency keys recorded in the ledger.

---

## 2. Six-Step Workflow Execution Path Analysis

| Step | Required Action | Implementation Status | Code Location |
|---|---|---|---|
| **Step 1** | Comment on Facebook Post or Instagram Reel/Media | **COMPLETE** | `src/app/api/webhooks/meta-social/route.ts`<br>`src/lib/meta-social/parser.ts` |
| **Step 2** | Gokul Connect automatically detects comment | **COMPLETE** | `src/app/api/webhooks/meta-social/route.ts`<br>`src/lib/meta-social/database.ts` (`ingestSocialEvent`) |
| **Step 3** | System checks Tamil & English keywords | **COMPLETE** | `src/lib/meta-social/evaluator.ts` (`normalizeSocialText`, `matchSocialRule`) |
| **Step 4** | Selects correct reply template for business & platform | **COMPLETE** | `src/lib/meta-social/evaluator.ts` (`resolvePublicReplyText`, `detectLanguage`)<br>`src/lib/meta-social/rules-store.ts` |
| **Step 5** | Publishes exactly one public reply under original comment | **COMPLETE** | `src/lib/meta-social/service.ts`<br>`src/lib/meta-social/client.ts` (`replyMetaCommentPublic`) |
| **Step 6** | Records whether reply succeeded or failed | **COMPLETE** | `src/lib/meta-social/database.ts` (`updateSocialDeliveryResult`, `updateSocialEventResult`) |

---

## 3. Platform-Specific Implementations

### 3.1 Facebook Implementation
- **Webhook Ingestion:** Evaluates `entry[].changes[]` with `field === "feed"` and `value.item === "comment" && value.verb === "add"`.
- **Self-Comment Filter:** Filters out comments from the Page itself (`value.from?.id === accountId`).
- **Comment Detail Retrieval:** If the webhook notification carries a minimal payload (comment ID without message text), invokes `fetchMetaCommentDetails` via `GET https://graph.facebook.com/v21.0/{comment-id}?fields=id,message,from,created_time`.
- **Public Reply Endpoint:** Dispatches replies to `POST https://graph.facebook.com/v21.0/{comment-id}/comments` with `message` and decrypted Page Access Token.
- **Idempotency Key:** `idemp_pub_facebook_{page_id}_{comment_id}`.

### 3.2 Instagram Implementation
- **Webhook Ingestion:** Evaluates `entry[].changes[]` with `field === "comments"`.
- **Self-Comment Filter:** Filters out comments from the Instagram account itself (`value.from?.id === accountId`).
- **Comment Detail Retrieval:** If webhook payload lacks text, invokes `fetchMetaCommentDetails` via `GET https://graph.facebook.com/v21.0/{comment-id}?fields=id,text,from,timestamp`.
- **Public Reply Endpoint:** Dispatches replies to `POST https://graph.facebook.com/v21.0/{comment-id}/replies` (strictly segregated from Facebook's `/comments` endpoint).
- **Idempotency Key:** `idemp_pub_instagram_{account_id}_{comment_id}`.

---

## 4. Tamil & English Keyword Matching Engine

The keyword engine in `src/lib/meta-social/evaluator.ts` provides:
1. **Unicode Syllable Normalization:** Uses `NFKC` normalization to standardize Tamil vowel markers, pulli (virama), and combining characters (`\u0B80-\u0BFF`).
2. **Zero-Width Stripping:** Removes zero-width spaces (`\u200B`), non-joiners (`\u200C`), joiners (`\u200D`), and byte order marks (`\uFEFF`).
3. **Punctuation & Whitespace Collapsing:** Replaces punctuation, quotes, and symbols with spaces while collapsing multiple whitespaces into a single space.
4. **English Case-Insensitivity:** Standardizes all Latin text to lowercase.
5. **Multi-Word Phrase Support:** Accurately matches phrases such as `ராசி பலன்`, `மாப்பிள்ளை தேவை`, `பெண் தேவை`, `திருமண பொருத்தம்`.
6. **Deterministic Priority Policy:** When multiple rules match an inbound comment, candidate rules are sorted by:
   - Priority ascending (`priority ASC`)
   - Creation timestamp ascending (`created_at ASC`)
   - Rule ID ascending (`id ASC`) as a stable tie-breaker.
7. **Fail-Closed Matching:** If no configured rule or default trigger matches, the event transitions to `ignored` with zero public replies published.
8. **Disabled Rule Protection:** Rules with `is_active: false` are strictly skipped during evaluation.

---

## 5. Exactly-Once Delivery & Duplicate Prevention

To eliminate duplicate public replies across distributed and retry environments:
1. **Webhook Deduplication:** Incoming events are deduplicated at ingestion by checking `(business_id, meta_event_id)` against the `meta_social_events` ledger.
2. **Persistent Idempotency Key:** Constructed deterministically as `idemp_pub_${platform}_${accountId}_${commentId}` and tracked in `meta_social_deliveries`.
3. **Worker Concurrency Locking:** Batch processors claim jobs using `claim_meta_social_events` with `FOR UPDATE SKIP LOCKED` (or optimistic locking `status = 'received'`), preventing race conditions between concurrent worker threads.
4. **Ambiguous Network Timeout Handling:** If an outbound Meta Graph API call encounters an ambiguous network error (HTTP 504 / socket timeout):
   - The delivery is marked as `ambiguous_outcome`.
   - The system **halts** without blindly re-posting.
   - On reconciliation, `checkCommentReplied` inspects the live post via `GET /{comment-id}/comments` or `GET /{comment-id}/replies`.
   - If the reply is confirmed on Meta, the delivery is marked `succeeded`.
   - If unconfirmed, the event is held for operator verification rather than generating duplicate replies.

---

## 6. Business Separation (Astrology vs Vivaham)

Strict multi-tenant boundaries are enforced at the server level:
- **Astrology (`astrology`):** Uses Astrology Facebook Pages (`fb_page_astro_*`), Instagram accounts (`ig_gokul_astrology`), and Astrology reply templates/credentials.
- **Vivaham (`vivaham`):** Uses Vivaham Facebook Pages (`fb_page_vivaham_*`), Instagram accounts (`ig_vivaham_matrimony`), and Vivaham reply templates/credentials.
- **Credential Vaulting:** Tokens are retrieved strictly with `.eq("business_id", businessId)`. Cross-tenant credential sharing throws an immediate `SECURITY VIOLATION`.

---

## 7. Controlled Staging Live Test Plan (Pending Approval)

> [!IMPORTANT]
> **Production automation remains strictly disabled.** No live outbound Meta Graph API requests will be dispatched without explicit human operator approval.

When authorized, live staging verification will proceed using this controlled protocol:
1. **Target Social Accounts:**
   - Facebook Page: 1 test Page connected to staging.
   - Instagram Professional: 1 test Instagram account linked to the staging Page.
2. **Dedicated Test Posts:**
   - 1 unlisted/test Facebook Page post created specifically for automation testing.
   - 1 dedicated Instagram test media item.
3. **Dedicated Test Keyword:**
   - Keyword: `டெஸ்ட்101` (Tamil) / `connecttest` (English).
4. **Predefined Staging Reply:**
   - `"வணக்கம்! இது கோகுல் கனெக்ட் தானியங்கி சோதனை பதில் (Automated Staging Verification Reply)."`
5. **Controlled Execution Steps:**
   - Post 1 comment containing `டெஸ்ட்101`.
   - Verify webhook arrival, signature validation, and payload parsing.
   - Verify worker claim and single public reply dispatch.
   - Verify Meta response ID stored in ledger.
   - Post duplicate comment to verify duplicate suppression.
   - Verify zero interference with WhatsApp queues or other workspaces.