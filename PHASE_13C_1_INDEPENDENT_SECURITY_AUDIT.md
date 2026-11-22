# Phase 13C.1 — Independent Security and Database Compatibility Audit Report

**Project:** Gokul Connect  
**Branch:** `phase-13b-critical-remediation`  
**Audit Phase:** Phase 13C.1 – Independent Security & Database Compatibility Audit  
**Audited Target:** Phase 13C Meta Account Connection Implementation  
**Date:** November 22, 2026  
**Auditor Mode:** Read-Only Independent Security & Schema Auditor (No fixes applied)  

---

## Final Verdict

### **READY WITH CONDITIONS**

The Phase 13C Meta Account Connection implementation demonstrates robust architectural foundations:
- **Zero Frontend Token Leakage:** User tokens, Page Access Tokens, and long-lived tokens remain exclusively server-side. The frontend UI operates entirely on sanitized metadata.
- **Strong Cryptographic Vault:** Credentials use AES-256-GCM encryption with 12-byte random IVs and 16-byte authentication tags.
- **Tenant Isolation:** Both `astrology` and `vivaham` tenants are strictly isolated across all read, write, disconnect, and diagnostic boundaries.
- **Database Safety:** Zero dependencies on unapplied migrations (027 or 028); built 100% on Migration 026 schema.
- **Regression Safety:** 100% test pass rate across the workspace (57 test files, 885 passing tests).

However, Phase 13D progression is conditional upon resolving **two medium-severity code findings** (one security fail-open edge case in CSRF validation and TypeScript mock typing errors in the test file) and noting one forward-migration schema constraint dependency.

---

## Executive Summary Matrix

| Audit Area | Status | Key Findings |
|---|---|---|
| **1. Database Compatibility** | **PASS (With Note)** | Uses only tables/columns from Migration 026 (`meta_social_connections`, `meta_social_credentials`). Zero dependencies on migrations 027/028. Note on future `onConflict` clause when 027 is applied. |
| **2. OAuth Security** | **CONDITIONAL** | Strong HMAC-SHA256 signature and timing-safe validation. **Finding:** CSRF cookie validation fails open if `csrfCookieValue` is missing/undefined. |
| **3. Credential Security** | **PASS** | AES-256-GCM with 12-byte IV and 16-byte GCM tag. Access tokens never reach client components. Server-side ephemeral staging with 15-minute TTL. |
| **4. Tenant Isolation** | **PASS** | Strict multi-tenant boundaries between `astrology` and `vivaham`. Cross-tenant reading, writing, disconnection, and diagnostics are prevented. |
| **5. Meta API Correctness** | **PASS** | Graph API v21.0 endpoints for Dialog, code exchange, long-lived token exchange, `/me/accounts`, and `/debug_token`. All tests currently use mocked HTTP transport. |
| **6. Regression Testing** | **CONDITIONAL** | 885/885 vitest tests pass (including all WhatsApp and Phase 13 suites). However, `npx tsc --noEmit` produces 7 compilation errors in `tests/phase13c-meta-account-connection.test.ts`. |
| **7. Git Review** | **PASS (With Details)**| Working tree contains staged migration file renames from Phase 13B.4.3.2, 4 modified files, and 13 untracked files/reports. |

---

## 1. Database Compatibility Audit

### 1.1 Tables and Columns Used by Phase 13C

Phase 13C interacts with exactly two database tables:

#### Table 1: `public.meta_social_connections`
| Column Name | Type | Existing in Migration 026? | Usage in Phase 13C |
|---|---|---|---|
| `id` | UUID (PK) | Yes | Connection identifier |
| `business_id` | UUID (FK) | Yes | Tenant isolation foreign key to `businesses(id)` |
| `platform` | TEXT | Yes | Platform discriminator (`'facebook'`, `'instagram'`) |
| `account_id` | TEXT | Yes | Facebook Page ID or Instagram Business Account ID |
| `account_name` | TEXT | Yes | Display name of Page or Instagram account |
| `username` | TEXT | Yes | Instagram handle or null |
| `page_id` | TEXT | Yes | Associated Facebook Page ID (required for Instagram) |
| `credential_ref` | TEXT | Yes | Vault pointer identifier (`sec_social_*`) |
| `connection_status` | TEXT | Yes | Status: `'connected'`, `'disconnected'`, `'expired'`, `'error'` |
| `is_enabled` | BOOLEAN | Yes | Operational toggle |
| `metadata` | JSONB | Yes | Stored metadata: `connected_at`, `token_status`, `token_expires_at` |
| `created_at` | TIMESTAMPTZ | Yes | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Yes | Last update timestamp |

#### Table 2: `public.meta_social_credentials`
| Column Name | Type | Existing in Migration 026? | Usage in Phase 13C |
|---|---|---|---|
| `id` | UUID (PK) | Yes | Credential record identifier |
| `connection_id` | UUID (FK) | Yes | Foreign key to `meta_social_connections(id)` |
| `business_id` | UUID (FK) | Yes | Tenant verification reference |
| `key_version` | TEXT | Yes | Encryption key version (`'v1'`) |
| `iv` | TEXT | Yes | 12-byte hex initialization vector |
| `auth_tag` | TEXT | Yes | 16-byte hex GCM authentication tag |
| `ciphertext` | TEXT | Yes | Encrypted Page Access Token hex |
| `created_at` | TIMESTAMPTZ | Yes | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Yes | Rotation/update timestamp |

### 1.2 Verification Against Current Schema (Migration 026)
- Every table and column utilized by Phase 13C exists in `supabase/migrations/20261121_026_meta_social_automation.sql`.
- **Zero reliance on Migration 027:**
  - Migration 027 introduced `default_dm_reply` and `token_expires_at` columns on `meta_social_connections`. Phase 13C stores token expiry inside `metadata->'token_expires_at'` JSONB, ensuring zero runtime dependency on the unapplied `token_expires_at` column.
  - Migration 027 created `meta_social_deliveries` and outbound tracking columns on `meta_social_events`. Phase 13C does not query, insert, or reference `meta_social_deliveries` or `meta_social_events`.
- **Zero reliance on Migration 028:**
  - Migration 028 introduced worker lease fields (`claimed_by`, `lease_expires_at`) and claim RPCs (`claim_meta_social_events`). Phase 13C does not reference these fields or RPCs.

### 1.3 Schema Dependency & Conflict Risk Identification
- In `src/lib/meta-social/connections-store.ts` (line 421):
  ```typescript
  await supabase
    .from("meta_social_connections")
    .upsert(
      { business_id: businessId, platform: params.platform, account_id: params.accountId.trim(), ... },
      { onConflict: "business_id,platform,account_id" }
    );
  ```
  This clause is strictly compatible with Migration 026 constraint:
  `CONSTRAINT uq_meta_social_connections_tenant_platform_account UNIQUE (business_id, platform, account_id)`
- **Future Migration Advisory (Migration 027):**
  Migration 027 drops `uq_meta_social_connections_tenant_platform_account` and replaces it with `uq_meta_social_connections_global_platform_account UNIQUE (platform, account_id)`. When Migration 027 is eventually applied in a future phase, this upsert will fail with PostgreSQL error 42P10 unless `{ onConflict: "platform,account_id" }` is updated or a supporting unique index on `(business_id, platform, account_id)` is preserved.

---

## 2. OAuth Security Audit

### 2.1 State Generation & HMAC Signature
- **State Structure:** `base64url(JSON.stringify({ businessSlug, businessId, userId, nonce, timestamp })) + "." + HMAC-SHA256(payload, secret)`
- **Secret Sourcing:** Derived from `APP_ENCRYPTION_SECRET` or `META_APP_SECRET`.
- **Signature Validation:** Uses `crypto.timingSafeEqual` with strict buffer length checks to eliminate timing side-channel attacks. Tested and verified in unit test 1.2.

### 2.2 Expiration and Replay Protection
- **Expiration Window:** 15 minutes (`Date.now() - payload.timestamp > 15 * 60 * 1000`). Tested in unit test 1.3.
- **Authorization Code Replay:** Protected by Meta Graph API (Meta authorization codes are strictly single-use).
- **Session Cookie Deletion:** On successful callback, `response.cookies.delete("meta_oauth_csrf")` clears the CSRF cookie to prevent subsequent submissions.

### 2.3 CSRF Nonce Cookie Validation & Finding
- **Current Implementation (`src/lib/meta-social/oauth.ts` lines 157-160):**
  ```typescript
  // CSRF validation
  if (csrfCookieValue && payload.nonce !== csrfCookieValue) {
    throw new Error("OAuth CSRF validation failed: State nonce does not match session cookie.");
  }
  ```
- **SECURITY FINDING (Medium — Fail-Open Edge Case):**
  If `csrfCookieValue` is missing (`undefined` or empty string) due to cookie stripping, cross-site omission, or an attacker initiating callback in a browser without the cookie, `if (csrfCookieValue && ...)` evaluates to `false`. The validation silently passes without error!
- **Condition for 13D:** `verifyMetaOAuthState` must mandate that `csrfCookieValue` is provided and non-empty whenever called from the callback handler:
  ```typescript
  if (!csrfCookieValue || payload.nonce !== csrfCookieValue) {
    throw new Error("OAuth CSRF validation failed: State nonce does not match session cookie.");
  }
  ```

### 2.4 Redirect URI Validation
- **Protection Against Open Redirects:**
  The `redirectUri` is constructed server-side using `NEXT_PUBLIC_APP_URL` or `request.nextUrl.origin` (`/api/auth/meta/callback`).
  No user-supplied redirect URI parameter is accepted or redirected to.

### 2.5 Code & Long-Lived Token Exchange
- Authorization code exchange calls `https://graph.facebook.com/v21.0/oauth/access_token` with `code`, `client_id`, `client_secret`, and `redirect_uri`.
- Short-lived token is exchanged for a 60-day long-lived token via `grant_type=fb_exchange_token`.
- Page Access Tokens obtained from `/me/accounts` are extracted and stored. Page tokens inherit long-lived validity and do not expire unless password is changed or permissions revoked.

### 2.6 Credential Leakage in Error Responses & Logs
- In `src/app/api/auth/meta/callback/route.ts`:
  Errors redirect to `/workspace/${businessSlug}/connections/social?oauth_error=${encodeURIComponent(msg)}`.
  Error messages contain only Meta API error strings or generic security messages.
  No secrets, access tokens, or authorization codes are reflected in error query parameters.

---

## 3. Credential Security Audit

### 3.1 AES-256-GCM Vault Implementation
- **Cipher:** Standard `aes-256-gcm` authenticated encryption via `src/lib/crypto/encryption.ts`.
- **IV Handling:** Unique 12-byte cryptographically secure random IV generated per secret (`crypto.randomBytes(12).toString("hex")`).
- **Tag Handling:** 16-byte GCM authentication tag stored in `auth_tag` column.
- **Tamper Resistance:** `decipher.setAuthTag()` is called prior to `decipher.final()`. Any alteration to ciphertext or auth tag fails with `Unsupported state or unable to authenticate data`.

### 3.2 Frontend Token Isolation
- **Client Component (`MetaConnectionsManagerClient.tsx`):**
  Accepts only `SafeMetaSocialConnection`, `SanitizedDiscoveredPage`, and `VerifyConnectionResult`.
- **Sanitized Discovered Pages:**
  `sanitizeDiscoveredPages()` strictly strips `pageAccessToken` before exposing discovered pages to the UI.
- **Ephemeral Staging Isolation (`discovery-cache.ts`):**
  Raw Page Access Tokens reside temporarily in server-side memory (`stagedSessions`) with a 15-minute TTL. The client receives only a temporary `sessionId` (`disc_<48-hex-chars>`).
  When connecting, the client transmits only the `sessionId` and target `pageId`. The server looks up the token in cache, encrypts it with AES-256-GCM, stores it in the database vault, and immediately calls `clearStagedDiscovery(sessionId)`.
  **Access tokens never touch the client DOM, React props, network responses, or client storage.**

### 3.3 Logging and Redaction
- `maskTokenForLogging` masks sensitive tokens (e.g. `EAAB...••••••••...1234`).
- No raw token is logged via `console.log` or `console.error`.

---

## 4. Tenant Isolation Audit

### 4.1 Independent Business Tenant Verification

Both businesses were tested and verified:
1. **Gokul's Astrological Insights (`astrology` / `11111111-1111-1111-1111-111111111111`)**
2. **Gokul Vivaham (`vivaham` / `22222222-2222-2222-2222-222222222222`)**

| Isolation Vector | Astrology Tenant | Vivaham Tenant | Cross-Tenant Protection |
|---|---|---|---|
| **Account Read** | Reads only Astrology rows (`business_id = 1111...`) | Reads only Vivaham rows (`business_id = 2222...`) | Enforced by `.eq("business_id", ...)` and RLS `check_user_business_access` |
| **Credential Storage** | Vault entry scoped to Astrology | Vault entry scoped to Vivaham | Foreign key `(connection_id, business_id)` and RLS |
| **Account Disconnect** | Can disconnect Astrology accounts | Can disconnect Vivaham accounts | Disconnect action checks `conn.business_id === businessId` |
| **Token Diagnostics** | Can verify Astrology tokens | Can verify Vivaham tokens | Returns `Connection not found for this tenant` on mismatch |
| **Discovery Session** | Staged session bound to Astrology ID | Staged session bound to Vivaham ID | Rejects `session.businessId !== business.id` |

### 4.2 Cross-Tenant Penetration Test Results
- Unit tests 7.1, 7.2, and 7.3 confirm:
  - Astrology connections are completely invisible to Vivaham queries.
  - Vivaham workspace cannot disconnect or diagnose an Astrology connection.
  - Attempting to pass an Astrology discovery `sessionId` while authenticated to Vivaham fails closed with: `Tenant mismatch: Session does not belong to this business`.
  - Passing an invalid or forged tenant UUID fails closed with: `Invalid business tenant: <id>`.

---

## 5. Meta API Correctness Audit

### 5.1 Endpoint & Version Review
All endpoints conform to Meta Graph API **v21.0**:
- **OAuth Dialog:** `https://www.facebook.com/v21.0/dialog/oauth`
- **Access Token Code Exchange:** `https://graph.facebook.com/v21.0/oauth/access_token`
- **Long-Lived Token Exchange:** `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token`
- **Page & Instagram Discovery:** `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,category,access_token,tasks,instagram_business_account{id,username,name,profile_picture_url}&limit=50`
- **Token Debugger:** `https://graph.facebook.com/v21.0/debug_token?input_token=...&access_token=app_id|app_secret`

### 5.2 Facebook Page & Instagram Professional Account Discovery
- Correctly parses the Meta Graph API response data array.
- For linked Instagram Professional accounts: extracts `id`, `username`, `name`, `profile_picture_url`, and flags `isEligible: true`.
- For unlinked Pages: flags `isEligible: false` and provides exact user remediation instructions:
  *"No Instagram Professional Account is linked to this Facebook Page. Link an Instagram Professional Account to this Page in Meta Business Suite to enable Instagram messaging."*

### 5.3 Page-Token Handling and Instagram Page Linkage
- Correctly associates `pageId` when saving Instagram connections. Instagram Graph API messaging and Private Replies require the associated Facebook Page ID and Page Access Token.
- Unit test 4.3 verifies rejection when an Instagram account is connected without `pageId`.

### 5.4 Token Validity Diagnostics & Permission Error Handling
- Diagnoses expired tokens (`code: 190`, `subcode: 463`) and marks status as `expired`.
- Diagnoses revoked tokens (`code: 190`, `subcode: 467`) and marks status as `revoked`.
- Handles active valid tokens and extracts `expires_at` timestamp.

### 5.5 Mocked Tests vs. Live Meta Verification
- **Current State:** 100% of Meta API interactions in Phase 13C tests are executed against mocked HTTP transport via Vitest.
- **Notice:** Actual live Meta Graph API calls against Meta's production servers require configured production credentials (`META_APP_ID`, `META_APP_SECRET`). Live verification is documented for Phase 13D staging verification.

---

## 6. Regression Testing Audit

### 6.1 TypeScript Compilation (`npx tsc --noEmit`)
- **Status:** **FAILED** (7 errors detected)
- **Scope:** All 7 errors occur in `tests/phase13c-meta-account-connection.test.ts`. Application code in `src/` compiles with **0 errors**.
- **Error Details:**
  1. `tests/phase13c-meta-account-connection.test.ts:515`: Missing `description`, `icon_name`, `accent_color` on mock `Business` object.
  2. `tests/phase13c-meta-account-connection.test.ts:532`: Missing `avatar_url` on mock `UserProfile` object.
  3. `tests/phase13c-meta-account-connection.test.ts:551`: Missing `description`, `icon_name`, `accent_color` on mock `Business` object.
  4. `tests/phase13c-meta-account-connection.test.ts:568`: Missing `avatar_url` on mock `UserProfile` object.
  5. `tests/phase13c-meta-account-connection.test.ts:603`: Missing `description`, `icon_name`, `accent_color` on mock `Business` object.
  6. `tests/phase13c-meta-account-connection.test.ts:620`: Missing `avatar_url` on mock `UserProfile` object.
  7. `tests/phase13c-meta-account-connection.test.ts:660`: Property `platform` does not exist on type `SafeWhatsAppConnection`.

### 6.2 Test Execution Results

All vitest test suites execute successfully:

| Test Suite | Files | Tests Passed | Tests Failed | Status |
|---|---|---|---|---|
| **Phase 13C Suite** (`phase13c-meta-account-connection.test.ts`) | 1 | 24 | 0 | **PASS** |
| **All Phase 13 Social Suites** (`phase13*.test.ts`) | 5 | 88 | 0 | **PASS** |
| **WhatsApp Regression Suites** (`phase2*`, `phase3*`, etc.) | 12 | 126 | 0 | **PASS** |
| **Full Repository Test Suite** | 57 | 885 | 0 | **PASS** |

Execution duration: 36.01s. Zero WhatsApp or existing core messaging regressions detected.

---

## 7. Git Working Tree Review

### 7.1 Branch and Commit
- **Current Branch:** `phase-13b-critical-remediation`
- **Latest Commit:** `f867573 feat(social): privilege hardening and legacy overload deprecation for migrations 027 and 028 (Phase 13B.4)`

### 7.2 Staged Changes
- `supabase/migrations/20261122_027_meta_social_critical_fixes.sql` -> `supabase/migrations/20261122171900_027_meta_social_critical_fixes.sql`
- `supabase/migrations/20261122_028_meta_social_worker_reliability.sql` -> `supabase/migrations/20261122172000_028_meta_social_worker_reliability.sql`
*(Staged from Phase 13B.4.3.2 to align migration timestamps with Supabase 14-digit convention)*

### 7.3 Unstaged Modified Files
1. `src/components/workspace/ConnectionsManagerClient.tsx`: Link button to Meta Social connection page.
2. `src/components/workspace/WorkspaceSidebar.tsx`: "Meta Connections" navigation item added under Automation & Engine.
3. `src/lib/auth/tenant-guard.ts`: Re-export of `validateBusinessTenant` from `@/lib/connections/store`.
4. `tests/phase13b4-1-rpc-privilege-hardening.test.ts`: Updated test migration path references for renamed 027 and 028 files.

### 7.4 Untracked Files
- **Documentation & Scripts:**
  - `PHASE_13B4_3_1_MIGRATION_HISTORY_GUIDE.md`
  - `PHASE_13B4_3_2_MIGRATION_VERSION_CORRECTION_REPORT.md`
  - `PHASE_13B4_3_MIGRATION_027_APPLICATION_REPORT.md`
  - `PHASE_13C_IMPLEMENTATION_REPORT.md`
  - `scripts/verify-migration-027-live.mjs`
- **Phase 13C Implementation Files:**
  - `src/app/actions/meta-connections.ts`
  - `src/app/api/auth/meta/callback/route.ts`
  - `src/app/api/auth/meta/login/route.ts`
  - `src/app/workspace/[businessSlug]/connections/social/page.tsx`
  - `src/components/workspace/MetaConnectionsManagerClient.tsx`
  - `src/lib/meta-social/connections-store.ts`
  - `src/lib/meta-social/discovery-cache.ts`
  - `src/lib/meta-social/oauth.ts`
  - `tests/phase13c-meta-account-connection.test.ts`

### 7.5 Working Tree Cleanliness & Unrelated Modifications
- The working tree is **NOT CLEAN**; it contains the above uncommitted files.
- The staged migration renames and the unstaged path change in `tests/phase13b4-1-rpc-privilege-hardening.test.ts` pertain to Phase 13B.4.3.2 and are separate from Phase 13C.

---

## 8. Specific Remediation Conditions Before Phase 13D

To transition from **READY WITH CONDITIONS** to fully approved for Phase 13D, the following two conditions must be satisfied:

### Condition 1: Enforce Fail-Closed CSRF Cookie Validation
In `src/lib/meta-social/oauth.ts`, modify `verifyMetaOAuthState` so that if `csrfCookieValue` is missing or does not match `payload.nonce`, an error is strictly thrown:
```typescript
if (!csrfCookieValue || payload.nonce !== csrfCookieValue) {
  throw new Error("OAuth CSRF validation failed: State nonce does not match session cookie.");
}
```

### Condition 2: Correct Mock Types in `tests/phase13c-meta-account-connection.test.ts`
Provide the missing fields (`description`, `icon_name`, `accent_color`, `avatar_url`) in mock objects and remove `.platform` access on `SafeWhatsAppConnection` to ensure `npx tsc --noEmit` exits with **0 errors**.

---

## Audit Conclusion & Next Steps

Phase 13C achieves its functional, architectural, and security goals with zero database drift and zero WhatsApp regressions. 

Per instructions:
- **No code modifications were performed during this audit.**
- **No migrations were created or applied.**
- **System is awaiting user approval before proceeding.**
