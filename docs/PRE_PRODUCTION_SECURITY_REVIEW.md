# Gokul Connect — Pre-Production Security Review

**Platform:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Date:** 2026-11-06  
**Audit Scope:** Independent, Read-Only Security Architecture & Vulnerability Assessment  
**Target Infrastructure:** Supabase PostgreSQL 17.11 (`ansiwtwqgrfmzfrhkzuu`), Meta Graph API `v26.0`, Next.js 15.1 Server-Side Application  
**Execution Posture:** Read-Only (Zero Code/Data Alteration, Zero Outbound Messages, Zero Migrations Applied)  

---

## Executive Summary

This pre-production security review evaluates the architectural defenses, multi-tenant isolation, cryptographic protection, access controls, and operational resilience of **Gokul Connect**.

The platform is designed around a strict multi-tenant paradigm hosting two distinct business verticals: **Gokul's Astrological Insights** (`11111111-1111-1111-1111-111111111111`) and **Gokul Vivaham** (`22222222-2222-2222-2222-222222222222`).

### High-Level Summary of Findings

| Classification | Count | Description |
|---|:---:|---|
| **PASS** | **11** | Core security pillars verified through automated suites and live PostgreSQL/Meta tests. |
| **WARNING** | **4** | Security hardening gaps identified (fail-open webhook secret check, missing signout cookie clearing, lack of rate limiting, and stubbed agent assignment). |
| **FAIL** | **1** | Dependency vulnerability scan detected 9 known package advisories (including critical prototype pollution in dev tooling and high severity issues). |
| **NOT IMPLEMENTED** | **2** | Binary file storage and account deletion/GDPR scrubbing have not yet been implemented in the codebase. |
| **NOT VERIFIED** | **0** | All target areas were inspected and evaluated. |

---

## Detailed Review by Domain (15 Areas)

### 1. Authentication and Session Security

- **Status:** **PASS**
- **Severity:** Informational
- **Affected File(s):**
  - [`src/lib/supabase/server.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/supabase/server.ts)
  - [`src/lib/auth/tenant-guard.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/auth/tenant-guard.ts)
- **Evidence:**
  - Authenticated sessions are managed via `@supabase/ssr` `createServerClient` using HttpOnly, Secure, SameSite cookies.
  - Server-side authorization utilizes `supabase.auth.getUser()`, which validates the cryptographic JWT signature directly against the Supabase Auth server, avoiding spoofing risks inherent in unverified client claims.
  - Test coverage: [`tests/phase2-authenticated-rls.test.ts`](file:///e:/GAI/Whatsapp%20Automation/tests/phase2-authenticated-rls.test.ts) (10/10 passed).
- **Potential Impact:** Low.
- **Recommended Correction:** None required for core authentication flow.

---

### 2. Business Tenant Isolation

- **Status:** **PASS**
- **Severity:** Informational
- **Affected File(s) / Database Policy:**
  - [`supabase/migrations/20261106_001_phase1_foundation.sql`](file:///e:/GAI/Whatsapp%20Automation/supabase/migrations/20261106_001_phase1_foundation.sql)
  - [`src/lib/auth/tenant-guard.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/auth/tenant-guard.ts) (`validateBusinessAccess`)
  - [`src/components/workspace/SwitchBusinessButton.tsx`](file:///e:/GAI/Whatsapp%20Automation/src/components/workspace/SwitchBusinessButton.tsx) (`clearWorkspaceTenantCache`)
- **Evidence:**
  - Every workspace page (`/workspace/[businessSlug]/*`) executes server-side guard `validateBusinessAccess(businessSlug)` before rendering.
  - Database queries resolve business context through verified active `business_members` where `is_active = TRUE`.
  - Switching businesses invokes `clearWorkspaceTenantCache()`, purging `sessionStorage` and `localStorage` to avoid stale client cache contamination.
  - Live Supabase verification: User A (Astrology) attempting to access Vivaham workspace is blocked and redirected (`/select-business?error=unauthorized_business_access`).
- **Potential Impact:** Low.
- **Recommended Correction:** None required.

---

### 3. Supabase RLS Policies & Database Defenses

- **Status:** **PASS (with WARNING on wa_webhook_events)**
- **Severity:** Medium
- **Affected Database Policy:**
  - `public.check_user_business_access(business_id)` in [`supabase/migrations/20261106_001_phase1_foundation.sql`](file:///e:/GAI/Whatsapp%20Automation/supabase/migrations/20261106_001_phase1_foundation.sql)
  - Trigger `trg_user_profiles_privilege_escalation` in [`supabase/migrations/20261106_004_phase2_privilege_escalation_guard.sql`](file:///e:/GAI/Whatsapp%20Automation/supabase/migrations/20261106_004_phase2_privilege_escalation_guard.sql)
  - Policy `"Tenant isolation for wa_webhook_events"` in [`supabase/migrations/20261106_005_phase3_messaging_schema.sql`](file:///e:/GAI/Whatsapp%20Automation/supabase/migrations/20261106_005_phase3_messaging_schema.sql#L251-L256)
- **Evidence:**
  - All multi-tenant tables (`businesses`, `business_members`, `wa_connections`, `business_settings`, `wa_credentials`, `wa_contacts`, `wa_conversations`, `wa_messages`, `wa_message_templates`, `wa_processing_jobs`) have RLS enabled with `FOR ALL USING (check_user_business_access(business_id))`.
  - Database triggers enforce tenant immutability (`prevent_tenant_reassignment()`), throwing exceptions if any query attempts to alter `business_id`.
  - Privilege escalation guard `prevent_user_profile_privilege_escalation()` blocks regular users from updating `is_superadmin = true`.
  - **Identified Gap (WARNING):** In Migration 005 line 255:
    ```sql
    CREATE POLICY "Tenant isolation for wa_webhook_events" ON public.wa_webhook_events
    FOR ALL USING (business_id IS NULL OR public.check_user_business_access(business_id));
    ```
    If an inbound webhook arrives for an unrecognized phone number, `business_id` is set to `NULL`. The clause `business_id IS NULL` allows *any* authenticated user from *any* business to read those unassigned webhook events.
- **Potential Impact:** Unassigned webhook payloads could be inspected by non-administrative users across tenant lines.
- **Recommended Correction:** Restrict reading unassigned webhook events exclusively to superadmins or service role:
  ```sql
  USING ((business_id IS NOT NULL AND public.check_user_business_access(business_id)) OR public.is_superadmin());
  ```

---

### 4. Server Actions and API Authorization

- **Status:** **PASS**
- **Severity:** Informational
- **Affected File(s):**
  - [`src/app/actions/connections.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/actions/connections.ts)
  - [`src/app/actions/messaging.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/actions/messaging.ts)
  - [`src/app/actions/inbox.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/actions/inbox.ts)
- **Evidence:**
  - All server actions strictly execute `await validateBusinessAccess(businessSlug)` to derive trusted server-side `business.id`.
  - Role-based permissions are enforced: `createConnectionAction`, `updateConnectionAction`, `disconnectConnectionAction`, and `updateBusinessSettingsAction` verify `['owner', 'admin'].includes(membership.role)`.
  - `sendWhatsAppMessageAction` verifies `['owner', 'admin', 'agent'].includes(membership.role)`.
  - Mutations take both target entity ID and verified `business.id` (e.g. `.eq("id", connectionId).eq("business_id", businessId)`). If an attacker passes a connection ID belonging to another business, 0 rows are updated and the action rejects.
  - Automated test coverage: [`tests/phase2-server-authorization.test.ts`](file:///e:/GAI/Whatsapp%20Automation/tests/phase2-server-authorization.test.ts) (6/6 passed).
- **Potential Impact:** Low.
- **Recommended Correction:** None required.

---

### 5. WhatsApp Credential Encryption and Access

- **Status:** **PASS**
- **Severity:** Informational
- **Affected File(s):**
  - [`src/lib/crypto/encryption.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/crypto/encryption.ts)
  - [`supabase/migrations/20261106_003_phase2_wa_credentials.sql`](file:///e:/GAI/Whatsapp%20Automation/supabase/migrations/20261106_003_phase2_wa_credentials.sql)
- **Evidence:**
  - Tokens are encrypted using AES-256-GCM with a unique 12-byte initialization vector (IV) per NIST SP 800-38D recommendations.
  - 16-byte GCM authentication tags guarantee tamper detection; decryption throws an explicit error if ciphertext or tag is modified.
  - Database schema: `wa_credentials` stores only `key_version`, `iv`, `auth_tag`, and `ciphertext`. Plaintext tokens are never written to disk or database rows.
  - RLS policy on `wa_credentials` restricts access to business owners/admins or superadmins.
  - Automated test coverage: [`tests/phase2-credential-security.test.ts`](file:///e:/GAI/Whatsapp%20Automation/tests/phase2-credential-security.test.ts) (8/8 passed).
  - Live Supabase verification: Vivaham credentials decrypted cleanly; tampering test confirmed immediate tag validation failure.
- **Potential Impact:** Low.
- **Recommended Correction:** None required.

---

### 6. Webhook Signature Verification

- **Status:** **WARNING**
- **Severity:** High
- **Affected File(s):**
  - [`src/app/api/webhooks/whatsapp/route.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/api/webhooks/whatsapp/route.ts#L41-L47)
  - [`src/lib/whatsapp/crypto-signature.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/whatsapp/crypto-signature.ts)
- **Evidence:**
  - `verifyMetaWebhookSignature()` correctly computes `crypto.createHmac("sha256", secret).update(rawBody).digest("hex")` and validates headers prefixed with `sha256=`.
  - Uses `crypto.timingSafeEqual` to eliminate timing attack vectors.
  - Automated test coverage: [`tests/phase3-webhooks.test.ts`](file:///e:/GAI/Whatsapp%20Automation/tests/phase3-webhooks.test.ts) (rejects tampered payloads with 401).
  - **Identified Gap (WARNING):** In [`route.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/api/webhooks/whatsapp/route.ts#L41):
    ```typescript
    if (appSecret) {
      const isValid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
      if (!isValid) {
        return new Response("Invalid signature", { status: 401 });
      }
    }
    ```
    If `process.env.META_APP_SECRET` is unset or omitted in a deployment environment, the webhook handler skips verification entirely and proceeds to process unauthenticated payloads.
- **Potential Impact:** In the event of a misconfigured environment variable, the system fails open, allowing forged webhook injection.
- **Recommended Correction:** Fail closed by rejecting incoming webhooks if `META_APP_SECRET` is missing:
  ```typescript
  if (!appSecret) {
    console.error("[Webhook Error] META_APP_SECRET is not configured on the server.");
    return new Response("Server configuration error", { status: 500 });
  }
  ```

---

### 7. Webhook Replay and Duplicate Protection

- **Status:** **PASS**
- **Severity:** Informational
- **Affected File(s) / Database RPC:**
  - [`supabase/migrations/20261106_006_phase3_webhook_persistence_rpcs.sql`](file:///e:/GAI/Whatsapp%20Automation/supabase/migrations/20261106_006_phase3_webhook_persistence_rpcs.sql)
  - [`src/app/api/webhooks/whatsapp/route.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/api/webhooks/whatsapp/route.ts)
- **Evidence:**
  - `wa_webhook_events` enforces unique constraint on `meta_event_id TEXT NOT NULL UNIQUE`.
  - `wa_messages` enforces unique constraint on `meta_message_id TEXT UNIQUE`.
  - Atomic PostgreSQL stored procedure `ingest_wa_inbound_message()` queries `is_processed` in `wa_webhook_events`. If already true, it returns `{"status": "duplicate"}` and terminates without creating duplicate message rows or conversations.
  - Automated test coverage: [`tests/phase3f-end-to-end-validation.test.ts`](file:///e:/GAI/Whatsapp%20Automation/tests/phase3f-end-to-end-validation.test.ts) (Requirement 7 passed).
- **Potential Impact:** Low.
- **Recommended Correction:** None required.

---

### 8. Outbound Message Authorization

- **Status:** **PASS**
- **Severity:** Informational
- **Affected File(s):**
  - [`src/app/actions/messaging.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/actions/messaging.ts)
  - [`src/lib/whatsapp/service.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/whatsapp/service.ts)
- **Evidence:**
  - Outbound message requests derive `businessId` directly from server-side `validateBusinessAccess(businessSlug)` using the authenticated user's session.
  - `getDecryptedConnectionCredentials(businessId, connectionId)` verifies that `connectionId` belongs strictly to `businessId`.
  - If a user sends a connection ID belonging to another business tenant, the query fails with `"Connection not found or cross-tenant access denied."`
  - Automated test coverage: [`tests/phase3-whatsapp-architecture.test.ts`](file:///e:/GAI/Whatsapp%20Automation/tests/phase3-whatsapp-architecture.test.ts) (10/10 passed).
- **Potential Impact:** Low.
- **Recommended Correction:** None required.

---

### 9. Queue Concurrency and Retry Safety

- **Status:** **WARNING / NOT IMPLEMENTED**
- **Severity:** Medium
- **Affected File(s) / Database Table:**
  - [`supabase/migrations/20261106_005_phase3_messaging_schema.sql`](file:///e:/GAI/Whatsapp%20Automation/supabase/migrations/20261106_005_phase3_messaging_schema.sql#L183-L209) (`wa_processing_jobs`)
- **Evidence:**
  - The schema for durable job processing exists (`status`, `attempts`, `max_attempts`, `locked_at`, `scheduled_at`, `payload`).
  - Unit tests verify that retry counters and error codes can be stored.
  - **Identified Gap (WARNING):** There is currently no active background worker or queue consumer process executing in the application. Outbound messaging is currently dispatched synchronously during server action execution.
- **Potential Impact:** Transient Meta API outages or rate limits will return immediate errors to users rather than backing off gracefully via a persistent queue worker.
- **Recommended Correction:** Implement a durable queue worker (e.g. pg_cron or Next.js edge cron worker) to pull `wa_processing_jobs` where `status = 'pending' AND scheduled_at <= NOW() FOR UPDATE SKIP LOCKED`.

---

### 10. Input Validation and Injection Protection

- **Status:** **PASS (with WARNING on Schema Parsing)**
- **Severity:** Low
- **Affected File(s):**
  - [`src/lib/whatsapp/client.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/whatsapp/client.ts)
  - [`src/lib/connections/store.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/connections/store.ts)
- **Evidence:**
  - **SQL Injection:** PASS. All database queries utilize the Supabase JavaScript client's parameterized query builder (`.eq()`, `.insert()`, `.update()`) or parameterized PostgreSQL stored procedures. No string concatenation occurs in SQL queries.
  - **XSS:** PASS. React JSX automatically escapes dynamic content. No `dangerouslySetInnerHTML` is used in any component.
  - **Phone Number Sanitization:** Inbound and outbound phone numbers are stripped of non-numeric characters (`recipientPhone.replace(/[^0-9]/g, "")`).
  - **Identified Gap (WARNING):** Zod is installed in `package.json`, but formal Zod schema parsers are not systematically enforced at server action boundaries; imperative `if (!field?.trim())` checks are used instead.
- **Potential Impact:** Edge-case malformed payload structures could slip past simple truthiness checks.
- **Recommended Correction:** Define standard Zod schemas for `SendMessageActionInput`, `CreateWhatsAppConnectionInput`, etc., and execute `.parse()` on entry.

---

### 11. Rate Limiting and Abuse Protection

- **Status:** **WARNING / NOT IMPLEMENTED**
- **Severity:** Medium
- **Affected File(s):**
  - [`src/app/api/webhooks/whatsapp/route.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/api/webhooks/whatsapp/route.ts)
  - [`src/app/(auth)/login/page.tsx`](file:///e:/GAI/Whatsapp%20Automation/src/app/(auth)/login/page.tsx)
  - [`src/app/actions/messaging.ts`](file:///e:/GAI/Whatsapp%20Automation/src/app/actions/messaging.ts)
- **Evidence:**
  - There is currently no application-level rate limiter or token bucket middleware (e.g. Upstash Redis, memory cache, or Cloudflare turnstile) configured on API routes or server actions.
- **Potential Impact:**
  - `/api/webhooks/whatsapp` could be flooded with invalid requests, consuming server compute on HMAC hashing.
  - `/login` lacks brute-force throttling at the Next.js layer (relies solely on default Supabase Auth rate limits).
  - Outbound messaging server actions could be spammed if an agent account is compromised.
- **Recommended Correction:** Deploy Next.js middleware with IP-based and user-based sliding window rate limiting (e.g. 60 requests/minute for webhooks, 10 attempts/minute for login).

---

### 12. Sensitive Information in Logs and Browser Responses

- **Status:** **PASS**
- **Severity:** Informational
- **Affected File(s):**
  - [`src/lib/whatsapp/client.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/whatsapp/client.ts) (`sanitizeMetaLog`)
  - [`src/lib/crypto/encryption.ts`](file:///e:/GAI/Whatsapp%20Automation/src/lib/crypto/encryption.ts) (`maskTokenForLogging`)
  - [`src/types/database.ts`](file:///e:/GAI/Whatsapp%20Automation/src/types/database.ts) (`SafeWhatsAppConnection`)
- **Evidence:**
  - `sanitizeMetaLog()` automatically matches and replaces `EAA...` OAuth tokens with `EAA••••••••[MASKED]`.
  - Server actions return `SafeWhatsAppConnection`, which strips `credential_ref`, `iv`, `auth_tag`, and `ciphertext`, returning only masked hints (e.g. `Ref: ••••••••9053`).
  - Next.js environment configuration isolates non-`NEXT_PUBLIC_` secrets (`META_APP_SECRET`, `APP_ENCRYPTION_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_TEST_ACCESS_TOKEN`) exclusively to Node.js server runtimes.
- **Potential Impact:** Low.
- **Recommended Correction:** None required.

---

### 13. File Upload and Storage Security

- **Status:** **NOT IMPLEMENTED**
- **Severity:** Low (Architectural Notice)
- **Affected File(s):** Supabase Storage / Media Endpoints
- **Evidence:**
  - The application currently handles text and template messages. Binary media upload endpoints and Supabase Storage buckets have not yet been provisioned or implemented.
- **Potential Impact:** None in the current release.
- **Recommended Correction:** When implementing media support in Phase 4B/5, enforce strict MIME-type whitelisting, file size caps (e.g. 16MB for WhatsApp documents), random filename hashing, and tenant-partitioned storage bucket paths (`storage/buckets/tenant_<id>/...`).

---

### 14. Account Deletion and Session Revocation

- **Status:** **WARNING (Signout Gap) / NOT IMPLEMENTED (Deletion)**
- **Severity:** Medium
- **Affected File(s):**
  - [`src/app/select-business/page.tsx`](file:///e:/GAI/Whatsapp%20Automation/src/app/select-business/page.tsx#L54-L64)
- **Evidence:**
  - **Identified Gap (WARNING):** In `select-business/page.tsx`, the "Sign Out" button is implemented as a simple client-side link:
    ```tsx
    <Link href="/login">
      <Button variant="outline" size="sm">
        <LogOut className="h-3.5 w-3.5" /> Sign Out
      </Button>
    </Link>
    ```
    Clicking "Sign Out" redirects to `/login` without invoking `supabase.auth.signOut()` or clearing session cookies from the browser. An active cookie remains valid until natural expiration.
  - **Account Deletion:** There is currently no self-service account deletion or data purge mechanism (GDPR Right to Erasure).
- **Potential Impact:** On shared terminal devices, navigating back to `/select-business` allows an unauthorized person to resume the previous session.
- **Recommended Correction:** Convert "Sign Out" into a server action or client handler that calls `await supabase.auth.signOut()`, invalidates cookie headers, and executes `clearWorkspaceTenantCache()`.

---

### 15. Dependency and Package Vulnerabilities

- **Status:** **FAIL**
- **Severity:** Critical
- **Affected File(s):**
  - [`package.json`](file:///e:/GAI/Whatsapp%20Automation/package.json)
  - [`package-lock.json`](file:///e:/GAI/Whatsapp%20Automation/package-lock.json)
- **Evidence:**
  - Execution of `npm audit` reported **9 vulnerabilities (2 Critical, 3 High, 4 Moderate)**:
    1. **`tinypool` (<= 2.1.1) — CRITICAL:** Prototype pollution gadget in worker options leading to potential Remote Code Execution (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr).
    2. **`postcss` (<= 8.5.22) — HIGH:** Arbitrary file read and source map path traversal disclosure (GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849).
    3. **`zod` (< 4.6.6) — HIGH:** Uncontrolled resource consumption and memory exhaustion on oversized constrained collections (GHSA-mrhx-c7xc-m3w5).
    4. **`@vitest/mocker` / `esbuild` / `vite` — MODERATE:** Path traversal in mocker and SSR dev server request disclosure (GHSA-82fw-gwwq-j7x9, GHSA-67mh-4wv8-2f99).
- **Potential Impact:** Exploitation of development and build-time tooling, memory exhaustion via malformed payloads, or source map information leakage.
- **Recommended Correction:** Execute dependency updates and security patches (`npm update`, bump `zod` to `>= 3.24.2` or safe release, update Vitest build stack).

---

## Special Attention: Cross-Business Information Leakage Verification

All cross-tenant boundaries were audited across both business workspaces:

| Subsystem | Scope Checked | Result | Evidence & Analysis |
|---|---|:---:|---|
| **Inbox** | Conversations & Thread Lists | **PASS** | `getConversationsForBusinessDb()` explicitly filters by `business_id`. `getConversationMessagesDb()` validates `.eq("id", conversationId).eq("business_id", businessId)`. |
| **Contacts** | Customer Profiles & Names | **PASS** | `wa_contacts` enforces `UNIQUE(business_id, phone_number)` and RLS policy `check_user_business_access(business_id)`. |
| **Messages** | Inbound & Outbound Texts | **PASS** | `wa_messages` enforces composite foreign keys `(connection_id, business_id)` and immutable tenant triggers. Cross-tenant queries return 0 rows. |
| **Templates** | Message Templates | **PASS** | `wa_message_templates` enforces `UNIQUE(business_id, template_name, language)` and tenant-scoped RLS. |
| **Automations** | Flow Engine & Menus | **NOT IMPLEMENTED** | Scheduled for Phase 5. No automations currently active. |
| **Analytics** | Metrics & Reporting | **PASS** | Metrics in `BusinessDashboardPage` derive either from strictly filtered messages (`business.id`) or segregated seed structures. |
| **Settings** | Configuration Preferences | **PASS** | `business_settings` enforces `FOREIGN KEY (default_connection_id, business_id) REFERENCES wa_connections(id, business_id)`. Cross-referencing connections throws error. |

---

## Summary of Priority Remediation Actions

Before production release, the following remediations should be prioritized:

1. **[CRITICAL] Dependency Patches:** Update vulnerable npm packages (`tinypool`, `postcss`, `zod`).
2. **[HIGH] Webhook Fail-Closed:** Ensure `/api/webhooks/whatsapp` rejects incoming requests if `META_APP_SECRET` is unset.
3. **[MEDIUM] Webhook Events RLS:** Amend `wa_webhook_events` RLS to prevent regular authenticated users from reading unassigned (`business_id IS NULL`) events.
4. **[MEDIUM] Real Session Revocation:** Wire the "Sign Out" button to `supabase.auth.signOut()` and invalidate session cookies.
5. **[MEDIUM] Rate Limiting:** Introduce IP and user-based sliding-window rate limiting on webhooks, authentication, and outbound message actions.
