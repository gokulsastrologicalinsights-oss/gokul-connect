# GOKUL CONNECT — PHASE 11.5: UAT DEFECT LOG & ISSUES REPORT

**Project:** Gokul Connect (Multi-Business WhatsApp Automation & CRM)  
**Phase:** Phase 11.5 — End-to-End Template Management UAT  
**Date:** 2026-11-07  
**Overall Status:** **RESOLVED — 0 REMAINING BLOCKERS (LOCAL)**

---

## 1. Defects Identified & Narrowly Remediated

### Defect 11.5-01: Status Stuck at `ARCHIVED` on Unarchive in `archiveTemplateDb`
- **Severity:** Medium (Functional / UI State Inconsistency)
- **Component:** `src/lib/templates/database.ts` -> `archiveTemplateDb()`
- **Symptom:** In Test `ASTRO-10`, when unarchiving a template (`isArchived: false`), the template remained tagged with the "Archived" badge and was not restored to the active catalog as "Local Draft".
- **Root Cause Analysis:** In `archiveTemplateDb`, when `isArchived` was `true`, `updateFields.status` was set to `"ARCHIVED"`. However, the function omitted an `else` branch for when `isArchived` was `false`. As a result, the database column `is_archived` was set to `false`, but `status` remained permanently `"ARCHIVED"`, violating the Phase 11 specification: *"Unarchive template restores is_archived = false and status = 'DRAFT'"*.
- **Narrow Fix Applied:** Updated `archiveTemplateDb` in `src/lib/templates/database.ts` lines 310–314:
  ```ts
  if (isArchived) {
    updateFields.status = "ARCHIVED";
  } else {
    updateFields.status = "DRAFT";
  }
  ```
- **Verification & Regression Testing:**
  - Re-executed `ASTRO-10` in headless browser: unarchiving immediately restored `status = "DRAFT"`, updated the badge to "Local Draft", and returned the card to the active catalog.
  - Re-ran full Vitest test suite: 463/463 tests passing.

---

### Defect 11.5-02: Default Approved Templates Eclipsed by Initial Draft Creation in `listTemplatesDb`
- **Severity:** Medium (UX / Library Usability)
- **Component:** `src/lib/templates/database.ts` -> `listTemplatesDb()`
- **Symptom:** In the template library page, before any custom draft was created, the UI displayed the 7 default business templates for Astrology or Vivaham. However, as soon as a user created 1 custom draft template in the database, `data.length === 1`, causing `listTemplatesDb` to return only the single database row and completely hide the default approved templates.
- **Root Cause Analysis:** `listTemplatesDb` contained an all-or-nothing fallback check: `if (error || !data || data.length === 0) { return defaults; }`. When the database contained only drafts and zero approved templates from Meta sync, creating a draft silenced the fallback defaults instead of merging them.
- **Narrow Fix Applied:** Updated `listTemplatesDb` in `src/lib/templates/database.ts` lines 76–85 to merge unseeded default templates with database templates by composite key `(template_name, language)`:
  ```ts
  const dbTemplates = (!error && data) ? (data as WhatsAppMessageTemplate[]) : [];
  const defaults = getDefaultBusinessTemplates(businessId);
  const dbKeys = new Set(dbTemplates.map((t) => `${t.template_name}__${t.language}`));
  const unseededDefaults = defaults.filter((d) => !dbKeys.has(`${d.template_name}__${d.language}`));

  let results = [...dbTemplates, ...unseededDefaults];
  ```
- **Verification & Regression Testing:**
  - Creating a draft in Astrology now displays Total: 11 (10 approved default templates + 1 draft).
  - Archiving the draft hides the draft from the active catalog while keeping the 10 approved templates visible.
  - Deleting the draft smoothly restores the catalog without page flicker.
  - Re-ran full Vitest test suite: 463/463 tests passing.

---

## 2. External Environmental Blockers (Carried Forward)

### External Blocker: Meta Graph API User Access Token Expiration
- **Status:** Documented in Phase 6.2; Preserved Unmodified.
- **Impact:** Meta template synchronization (`syncTemplatesAction`) and outbound message dispatch require a fresh system user access token.
- **Mitigation in Phase 11.5:** Under strict safety boundaries, zero outbound Graph API calls were made. Local draft workflows, template builder, validation engine, database persistence, and inbox picker integration operate 100% locally and were verified end-to-end.
- **Resolution Plan:** Token refresh scheduled for Phase 12 (Production Cloud Deployment & Meta Webhook Registration) upon user authorization.

---

## 3. Summary of Open Issues

- **Local Codebase Defects:** `0` (All resolved and verified)
- **Database Drift / Unapplied Migrations:** `0` (Migration 015 recorded and active)
- **Security Vulnerabilities:** `0` (`npm audit` clean)
- **Remaining Blockers for Phase 12:** `0` local blockers.
