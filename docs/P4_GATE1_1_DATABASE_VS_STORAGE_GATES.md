# GOKUL CONNECT — P4 GATE 1.1: DATABASE VS. STORAGE SEPARATION
## Independent Verification Gates for Relational Database Migrations and Cloud Media Storage

**Target Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`)  
**Database Host:** `db.ansiwtwqgrfmzfrhkzuu.supabase.co`  
**Storage Engine:** Supabase Storage `v1.89.13` (AWS S3-backed)  
**Target Bucket:** `whatsapp-media` (Private)  
**Target Migrations:** 016 through 024 (Database Layer)  
**Safety Mandate:** **STRICT READ-ONLY INSPECTION — NO BUCKET CREATED, NO STORAGE POLICIES MODIFIED**

---

## 1. Architectural Rationale for Separating Database & Storage Gates

In earlier planning documents, the provisioning of the Supabase Storage bucket `whatsapp-media` was intermingled with database migration prerequisites.

This document establishes a **strict architectural decoupling**:

```
+--------------------------------------------------------------------------------------------------------+
|                                    GATE DECOUPLING ARCHITECTURE                                        |
+--------------------------------------------------------------------------------------------------------+
|                                                                                                        |
|   [ GATE 1: DATABASE MIGRATION GATE ]                     [ GATE 2: MEDIA STORAGE ACTIVATION GATE ]    |
|   - Scope: PostgreSQL DDL & DML                           - Scope: Supabase Storage & Object Engine    |
|   - Migrations: 016 through 024                           - Bucket: Private `whatsapp-media`           |
|   - Tables: wa_media_files, wa_messages                   - Storage RLS: storage.objects policies      |
|   - Independent of Storage API                            - Independent of Migration Execution         |
|   - Verification: Schema & Table Constraints              - Verification: Upload, Download, Signed URLs|
|                                                                                                        |
+--------------------------------------------------------------------------------------------------------+
```

### Why Decoupling is Essential:
1. **Migration 017 Schema Independence:** Migration 017 creates the relational table `public.wa_media_files` and adds metadata columns (`storage_path`, `mime_type`, `file_size`, `media_id`, `download_status`) to `public.wa_messages`. These are standard PostgreSQL DDL operations that store string and numeric metadata. **PostgreSQL does not require the physical storage bucket to exist to execute this DDL.**
2. **Blast Radius Containment:** If storage bucket creation or storage RLS policy configuration encounters permissions or network issues, it must not block or destabilize core database migrations for Team Management (016), Scheduled Messages (018), Campaigns (019), CRM Lifecycle (020), Notifications (021), Visual Flows (022), Operational Telemetry (023), or Cron Locks (024).
3. **Phased Activation:** The database schema can be fully migrated, tested, and locked down first. Subsequently, the media storage bucket can be provisioned, configured with tenant RLS policies, and verified with live binary uploads as an independent milestone.

---

## 2. Gate 1: Database Migration Gate

This gate governs the authorization and execution of PostgreSQL migrations 016 through 024.

### 2.1 Database Migration Checklist

| Criterion # | Verification Item | Assessment Standard | Current Status | Gate Verdict |
|:---:|---|---|:---:|:---:|
| **DMG-01** | **Preflight Backup Verified** | Full logical backup (`pg_dump`) executed, non-empty (>20KB), valid headers, restored in isolated PGlite sandbox with 100% row count parity. | Preflight dump commands specified; execution pending human authorization | ⚠️ **PENDING EXECUTION** |
| **DMG-02** | **Migration Ledger Baseline Verified** | Remote ledger `supabase_migrations.schema_migrations` audited; baseline migrations 001–015 verified intact; 016–024 verified absent. | Verified via live read-only inspection (`inspect-all-live-migrations.mjs`) | ✅ **PASS** |
| **DMG-03** | **Migration SQL Content Reviewed** | All 9 SQL files (016–024) inspected line-by-line; verified search_path security, least-privilege grants, immutable business_id triggers, and zero destructive DDL. | Verified across 2,175 lines of SQL | ✅ **PASS** |
| **DMG-04** | **Schema Dependencies Verified** | Migration dependency sequence verified: 001/005 → 016 → 017 → 018 → 019 → 020 → 021 → 022 → 023 → 024. | Full topological dependency graph verified | ✅ **PASS** |
| **DMG-05** | **Execution Method & Tooling Verified** | Session Pooler (port 5432) or CLI Management API selected; `--single-transaction` or explicit transaction blocks mandated to prevent partial failures. | Protocol documented in `P4_GATE1_1_CREDENTIAL_EXECUTION_GUIDE.md` | ✅ **PASS** |
| **DMG-06** | **Rollback & Forward-Fix Plan Approved** | Transaction abort protocol, down-migration scripts, and forward-fix procedure documented and approved. | Documented in `P4_GATE1_1_BACKUP_VALIDATION.md` | ✅ **PASS** |

### 2.2 Database Gate Clearance Condition:
- **Status:** **CONDITIONAL GO**
- **Action Required to Open Gate:** User authorizes live backup execution, validates restoration in isolated sandbox, and confirms execution command.

---

## 3. Gate 2: Media Storage Activation Gate

This gate governs the creation, security hardening, and validation of the Supabase Storage infrastructure.

> [!IMPORTANT]
> In accordance with strict restrictions, **NO bucket was created and NO storage policies were altered** during this task.  
> The checklist below defines the requirements that must be verified when Media Storage Activation is authorized.

### 3.1 Media Storage Activation Checklist

| Criterion # | Verification Item | Specification / Requirement | Current Status | Gate Verdict |
|:---:|---|---|:---:|:---:|
| **SAG-01** | **Private Bucket Provisioning** | Bucket `whatsapp-media` created in Supabase Storage with `public: false` (strictly private). | Bucket count: 0 (verified via Storage API) | ⚠️ **STANDBY (NOT CREATED)** |
| **SAG-02** | **MIME Type Restrictions** | Whitelist enforced at bucket/API level: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `audio/ogg`, `audio/mp4`, `video/mp4`. | Whitelist defined in `src/lib/media/storage.ts` | ⚠️ **STANDBY** |
| **SAG-03** | **File-Size Quotas Enforced** | Maximum upload limits: Images ≤ 5MB, Documents ≤ 100MB, Audio ≤ 16MB, Video ≤ 16MB. | Enforced in `src/lib/media/storage.ts` | ⚠️ **STANDBY** |
| **SAG-04** | **Tenant-Specific Storage RLS Policies** | RLS enabled on `storage.objects`; policies enforce path prefix `{business_id}/*` matching `check_user_business_access(business_id)`. | Policies drafted, not applied to live storage | ⚠️ **STANDBY** |
| **SAG-05** | **Signed URL Access Verified** | Media downloads require temporary HMAC-signed URLs with a 30-minute expiration window; direct public URL access returns HTTP 403 Forbidden. | Tested in Vitest suite `tests/p0-1-media-retrieval-download.test.ts` | ⚠️ **STANDBY (LIVE TEST PENDING)** |
| **SAG-06** | **Cross-Tenant Access Denial** | Astrology user session attempting to access `storage.objects` path `/22222222-2222-2222-2222-222222222222/*` is strictly rejected (0 rows / 403). | Validated in local tenant isolation tests | ⚠️ **STANDBY (LIVE TEST PENDING)** |
| **SAG-07** | **End-to-End Media Upload & Download** | Inbound webhook media downloader persists buffer to bucket; ChatWindow generates signed preview URL; media renders cleanly. | Local Vitest passing (25/25 tests) | ⚠️ **STANDBY (LIVE TEST PENDING)** |

### 3.2 Media Storage Activation Procedure (Post-Database Migration)
Once Gate 1 (Database Migration) is successfully completed:
1. Provision private bucket `whatsapp-media` via Supabase Storage API or Dashboard.
2. Apply tenant-scoped RLS policies to `storage.objects`:
   ```sql
   -- Example Storage RLS for whatsapp-media:
   CREATE POLICY "Tenant media access" ON storage.objects
     FOR ALL TO authenticated
     USING (
       bucket_id = 'whatsapp-media' AND
       public.check_user_business_access((storage.foldername(name))[1]::UUID)
     )
     WITH CHECK (
       bucket_id = 'whatsapp-media' AND
       public.check_user_business_access((storage.foldername(name))[1]::UUID)
     );
   ```
3. Execute automated test script (`scripts/test-storage-activation.mjs`) to verify signed upload, signed download, and cross-tenant rejection.

---

## 4. Summary of Gate Decoupling

| Gate | Target Layer | Execution Dependency | Current Status |
|---|---|---|:---:|
| **Gate 1: Database Migration** | PostgreSQL Engine (016–024) | Preflight Backup & DB Password | **CONDITIONAL GO** |
| **Gate 2: Media Storage Activation** | Storage Engine (`whatsapp-media`) | Gate 1 Completion + Bucket Provisioning | **STANDBY (GATED)** |
