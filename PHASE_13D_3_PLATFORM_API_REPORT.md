# PHASE 13D.3 – PLATFORM API ARCHITECTURE & VERIFICATION REPORT
## Facebook vs. Instagram Public Comment Reply Analysis

**Project:** Gokul Connect  
**Branch:** `phase-13b-critical-remediation`  
**Phase:** Phase 13D.3 – Platform API Verification  
**Date:** November 22, 2026  
**Status:** ARCHITECTURALLY VERIFIED (GET/POST Operations Segregated)

---

## 1. PLATFORM ARCHITECTURAL COMPARISON: FACEBOOK VS. INSTAGRAM

Facebook and Instagram exhibit distinct Graph API paradigms. Gokul Connect strictly segregates their endpoints, token requirements, payload formats, and comment identifiers.

| Dimension | Facebook Page Comments | Instagram Media / Reel Comments |
|---|---|---|
| **Graph API Version** | v21.0 (`https://graph.facebook.com/v21.0`) | v21.0 (`https://graph.facebook.com/v21.0`) |
| **Inbound Webhook Object** | `object: "page"` | `object: "instagram"` |
| **Webhook Field** | `field: "feed"` (`item: "comment"`, `verb: "add"`) | `field: "comments"` |
| **Account Identifier** | Facebook Page ID (`page_id`) | Instagram Professional Account ID (`account_id`) |
| **Comment Ingestion Endpoint (GET)** | `GET /{post-id}/comments?fields=id,from,message,created_time,comments{...}` | `GET /{media-id}/comments?fields=id,text,timestamp,username,from,replies{...}` |
| **Comment Retrieval / Reconciliation (GET)** | `GET /{comment-id}/comments?fields=id,message,from` | `GET /{comment-id}/replies?fields=id,text,username` |
| **Public Reply Endpoint (POST)** | `POST /{comment-id}/comments` | `POST /{comment-id}/replies` |
| **Public Reply Payload** | `{ "message": "<TEXT>" }` | `{ "message": "<TEXT>" }` |
| **Access Token Type** | Facebook Page Access Token | Facebook Page Access Token (linked to IG account) or IG User Token |
| **Required Meta Permissions** | `pages_manage_posts`, `pages_read_engagement`, `pages_show_list` | `instagram_basic`, `instagram_manage_comments`, `pages_show_list` |
| **Response ID Format** | `{ "id": "<comment_id>_<reply_comment_id>" }` | `{ "id": "<ig_comment_id>" }` |
| **Self-Comment Loop Guard** | `if (value.from?.id === accountId) continue;` | `if (value.from?.id === accountId) continue;` |

---

## 2. FACEBOOK VERIFICATION DETAILS

### 2.1 Comment Retrieval Operations (GET)
- **Post Comments Retrieval:**
  - Endpoint: `GET https://graph.facebook.com/v21.0/{post-id}/comments`
  - Implementation: `fetchFacebookPostComments(params)` in `src/lib/meta-social/client.ts`
  - Fields Requested: `id,from,message,created_time,comments{id,message,created_time}`
- **Reply Reconciliation Retrieval:**
  - Endpoint: `GET https://graph.facebook.com/v21.0/{comment-id}/comments`
  - Implementation: `checkCommentReplied(params)` in `src/lib/meta-social/client.ts`
  - Purpose: Before retrying an ambiguous request, checks if the reply text is already present under the comment thread.

### 2.2 Public Reply Operations (POST)
- **Endpoint:** `POST https://graph.facebook.com/v21.0/{comment-id}/comments`
- **Implementation:** `replyMetaCommentPublic` in `src/lib/meta-social/client.ts`
- **Authorization:** `Bearer <page_access_token>`
- **Payload:**
  ```json
  {
    "message": "வணக்கம்! உங்கள் ஜாதக பலன்கள் மற்றும் ஜோதிட ஆலோசனை பெற எங்கள் இன்பாக்ஸில் தொடர்பு கொள்ளவும்."
  }
  ```
- **Response Format:**
  ```json
  {
    "id": "123456789012345_987654321098765"
  }
  ```
- **Error Handling & Classification:**
  - HTTP 429 / Rate Limit: Wrapped with `isTransient: true`, parses `Retry-After`.
  - HTTP 504 / TCP Timeout: Wrapped with `isAmbiguous: true` to prevent automatic re-dispatch.
  - Error 190 / Token Expired: Automatically marks connection as `expired`.

---

## 3. INSTAGRAM VERIFICATION DETAILS

### 3.1 Comment Retrieval Operations (GET)
- **Media Comments Retrieval:**
  - Endpoint: `GET https://graph.facebook.com/v21.0/{media-id}/comments`
  - Implementation: `fetchInstagramMediaComments(params)` in `src/lib/meta-social/client.ts`
  - Fields Requested: `id,text,timestamp,username,from,replies{id,text,timestamp,username}`
- **Reply Reconciliation Retrieval:**
  - Endpoint: `GET https://graph.facebook.com/v21.0/{comment-id}/replies`
  - Implementation: `checkCommentReplied(params)` in `src/lib/meta-social/client.ts`

### 3.2 Public Reply Operations (POST)
- **Endpoint:** `POST https://graph.facebook.com/v21.0/{comment-id}/replies`
  > **Crucial Difference:** Instagram Graph API strictly rejects `POST /{comment-id}/comments` with Error 100 ("Unsupported post request"). It **strictly requires** `POST /{comment-id}/replies`.
- **Implementation:** `replyMetaCommentPublic` in `src/lib/meta-social/client.ts`
  ```typescript
  const endpoint = platform === "facebook" ? "comments" : "replies";
  const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(commentId.trim())}/${endpoint}`;
  ```
- **Authorization:** Page Access Token of the Facebook Page connected to the Instagram Professional Account.
- **Payload:**
  ```json
  {
    "message": "Thank you for commenting! For verified alliance profiles, please send us a direct message."
  }
  ```
- **Response Format:**
  ```json
  {
    "id": "17891234567890123"
  }
  ```

---

## 4. LIVE API DISTINCTION & MATURITY CLASSIFICATION

Every capability in the public comment reply engine is classified into one of four maturity tiers:

### Tier 1: Implemented and Verified with Mocks
- **Webhook Handshake & Signature Validation:** Timing-safe HMAC-SHA256 signature checking (`/api/webhooks/meta-social`).
- **Webhook Event Parsing:** Normalizing `feed` (FB) and `comments` (IG) payloads into `NormalizedMetaSocialEvent`.
- **Keyword Evaluation Engine:** Deterministic Tamil and English normalization and rule evaluation (`evaluator.ts`).
- **Multi-Tenant Routing:** Strict isolation between `astrology` (`11111111-...`) and `vivaham` (`22222222-...`).
- **Idempotency & Deduplication Logic:** Preventing double-posting on retry or duplicate webhook.
- **Manual Comment Reply Actions:** Posting replies via `replyToSocialCommentAction` and updating inbox status.

### Tier 2: Implemented but NOT Live-Tested
- **Real Graph API v21.0 Outbound HTTP Calls:** Outbound POST requests to live Facebook Page comments and Instagram Reels.
- **Live Meta Webhook Subscriptions:** Real Webhook delivery from Meta Developer App to production URL.
- **Live Ambiguous Reconciliation:** Live GET requests to verify comment appearance on Facebook/Instagram servers.

### Tier 3: Blocked by Permissions or Database Dependencies
- **Database Schema Dependencies:** Table `meta_social_deliveries` and columns `public_reply_status`, `public_reply_id` require execution of Migration `027` and `028`.
- **External Cron Scheduler:** Background queue execution via `/api/cron/process-social-automations` requires registration with cron-job.org or Upstash.
- **Meta Platform Permissions:** Live execution requires Meta App Review approvals for `pages_manage_posts`, `pages_read_engagement`, `instagram_manage_comments`, and `instagram_basic`.

### Tier 4: Not Implemented (Out of Scope / Future Roadmap)
- **Live Background WebSocket Inbox Streaming:** The UI currently relies on on-demand refresh or optimistic state updates rather than live WebSockets.
- **Direct Webhook-to-Inbox Memory Sync:** Ingested database events from webhooks are not mirrored into `memorySocialComments` until the UI adapter is connected directly to `meta_social_events`.
