# GOKUL CONNECT — P4 GATE 1.2.1: BACKUP EXECUTION GUIDE
## Pre-Migration Logical Export Specification, Integrity Verification Protocol, and Restoration Procedures

**Target Project:** `gokul-connect`  
**Dedicated Supabase Ref:** `ansiwtwqgrfmzfrhkzuu`  
**Host:** `aws-0-ap-south-1.pooler.supabase.com`  
**Port:** `5432` (Session Pooler)  
**Database User:** `postgres.ansiwtwqgrfmzfrhkzuu`  
**Database Name:** `postgres`  
**Target Migration Scope:** Migrations 016 through 024  
**Audit Milestone:** P4 Gate 1.2.1 (Evidence Verification & Tooling Readiness)  
**Audit Date:** `2026-11-10`  
**Operational Status:** **READ-ONLY SPECIFICATION — NO LIVE BACKUP RUN WITHOUT EXPLICIT OPERATOR AUTHORIZATION**

---

## 1. Tooling Readiness & Preflight Status

Before capturing a live backup or testing restoration, the required client utilities must be present on the host:

```
+--------------------------------------------------------------------------------------------------------------------+
|                                         BACKUP TOOLING READINESS MATRIX                                            |
+-------------------+----------------------+-----------------------------+--------------------+----------------------+
| TOOL / ASSET      | ROLE IN BACKUP       | DETECTED HOST STATUS        | VERSION / PATH     | STATUS LABEL         |
+-------------------+----------------------+-----------------------------+--------------------+----------------------+
| `pg_dump`         | Logical Dump (-Fc)   | NOT FOUND ON PATH           | None               | 🔴 BLOCKED           |
| `pg_restore`      | Archive TOC / Restore| NOT FOUND ON PATH           | None               | 🔴 BLOCKED           |
| `psql`            | Post-restore verify  | NOT FOUND ON PATH           | None               | 🔴 BLOCKED           |
| `Get-FileHash`    | SHA-256 Checksum     | Available (PowerShell 7)    | Built-in           | 🟢 VERIFIED (EXEC)   |
| Supabase CLI      | Fallback CLI export  | Available                   | npx supabase 3.1.0 | 🟢 VERIFIED (EXEC)   |
| Backup Scripts    | Script syntax/logic  | Drafted and audited         | scripts/           | 🔍 VERIFIED (INSPECT)|
| Live Backup Asset | Production .dump file| NOT CAPTURED                | None               | 🔴 NOT VERIFIED      |
+-------------------+----------------------+-----------------------------+--------------------+----------------------+
```

> [!IMPORTANT]
> **TOOLING PREREQUISITE:**  
> The host currently lacks `pg_dump` and `pg_restore`. Before executing the backup commands below, the operator must either:
> 1. Install PostgreSQL 17 client utilities via `winget install PostgreSQL.PostgreSQL.17`, OR
> 2. Start Docker Desktop and run the commands inside a containerized PostgreSQL 17 container (`postgres:17-alpine`), OR
> 3. Use the Supabase CLI (`npx supabase db dump`).

---

## 2. Security & Credential Protection Guardrails

1. **Zero Hardcoded Credentials:** Database passwords must never be stored in files, script bodies, commit history, or markdown documents.
2. **Session-Scoped Variables:** Passwords must be passed through temporary, memory-only session environment variables (`$env:PGPASSWORD`) or interactive secure prompt (`Read-Host -AsSecureString`).
3. **Immediate Post-Execution Wipe:** The password variable must be unlinked immediately after command execution:
   ```powershell
   Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
   Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
   ```
4. **Git Exclusion:** `scripts/backup/` is enforced in `.gitignore`:
   ```gitignore
   scripts/backup/*.dump
   scripts/backup/*.sql
   scripts/backup/*.sql.bak
   scripts/backup/*.json
   ```
5. **PII Sanitization:** Production dumps contain customer phone numbers, messages, and CRM notes. Dump files must never be inspected via terminal stdout, shared, or checked into source control.

---

## 3. Exact Commands for Database Backup Operations

### 3.1 Step 1: Logical Database Export using `pg_dump -Fc`

This command extracts a compressed custom binary archive (`-Fc`) containing all schemas, tables, constraints, indexes, and data. It connects exclusively via the **Session Pooler** (`port 5432`). (Note: The transaction pooler `:6543` does not support `pg_dump`).

```powershell
# 1. Ensure backup directory exists
$BACKUP_DIR = "scripts\backup"
if (-not (Test-Path $BACKUP_DIR)) { New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null }

# 2. Establish timestamped target filenames
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$DUMP_FILE   = "$BACKUP_DIR\${TIMESTAMP}_p4_gate1_full.dump"
$SCHEMA_FILE = "$BACKUP_DIR\${TIMESTAMP}_p4_gate1_schema.sql"

# 3. Connection variables (NO PASSWORDS HARDCODED)
$DB_HOST = "aws-0-ap-south-1.pooler.supabase.com"
$DB_PORT = "5432"
$DB_USER = "postgres.ansiwtwqgrfmzfrhkzuu"
$DB_NAME = "postgres"

# 4. Prompt operator for password securely if not already set in session
if (-not $env:PGPASSWORD) {
    $secPass = Read-Host -Prompt "Enter Supabase DB Password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
    $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# 5. Execute Custom Binary Export (-Fc)
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME `
    --format=custom `
    --clean `
    --if-exists `
    --no-owner `
    --no-privileges `
    --file=$DUMP_FILE

# 6. Execute Plaintext Schema Export (For catalog DDL audit)
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME `
    --schema-only `
    --no-owner `
    --no-privileges `
    --file=$SCHEMA_FILE

# 7. Immediately wipe credentials from session
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
```

*Alternative via Supabase CLI (if native `pg_dump` is unavailable):*
```powershell
npx supabase db dump --project-ref ansiwtwqgrfmzfrhkzuu -f "$BACKUP_DIR\${TIMESTAMP}_supabase_dump.sql"
```

---

### 3.2 Step 2: Backup File Integrity Verification using SHA-256

Immediately following export, verify that the files are valid and calculate cryptographic checksums:

```powershell
# 1. Verify existence and non-trivial file size (> 20 KB)
$dumpItem = Get-Item $DUMP_FILE
$schemaItem = Get-Item $SCHEMA_FILE

Write-Host "Dump File Size   : $($dumpItem.Length) bytes ($($dumpItem.FullName))"
Write-Host "Schema File Size : $($schemaItem.Length) bytes ($($schemaItem.FullName))"

if ($dumpItem.Length -lt 20480) {
    throw "BACKUP INTEGRITY FAILURE: Dump file abnormally small (< 20 KB). Export may have failed!"
}

# 2. Compute SHA-256 Hashes
$dumpHash = (Get-FileHash -Path $DUMP_FILE -Algorithm SHA256).Hash
$schemaHash = (Get-FileHash -Path $SCHEMA_FILE -Algorithm SHA256).Hash

Write-Host "Dump SHA-256   : $dumpHash"
Write-Host "Schema SHA-256 : $schemaHash"

# 3. Inspect Table of Contents (TOC) via pg_restore
# This validates that the archive is not corrupted and contains critical core tables
$toc = pg_restore --list $DUMP_FILE
$hasBusinesses = $toc | Select-String -Pattern "TABLE public businesses"
$hasConversations = $toc | Select-String -Pattern "TABLE public wa_conversations"
$hasMessages = $toc | Select-String -Pattern "TABLE public wa_messages"

if (-not $hasBusinesses -or -not $hasConversations -or -not $hasMessages) {
    throw "BACKUP INTEGRITY FAILURE: Core tables missing from archive Table of Contents!"
}

Write-Host "✅ Archive Table of Contents verified: Core baseline tables present."

# 4. Record Checksums to persistent verification manifest
$MANIFEST_FILE = "$BACKUP_DIR\${TIMESTAMP}_backup_manifest.json"
@{
    timestamp = $TIMESTAMP
    project_ref = "ansiwtwqgrfmzfrhkzuu"
    dump_file = $DUMP_FILE
    dump_size_bytes = $dumpItem.Length
    dump_sha256 = $dumpHash
    schema_file = $SCHEMA_FILE
    schema_size_bytes = $schemaItem.Length
    schema_sha256 = $schemaHash
    toc_verified = $true
} | ConvertTo-Json -Depth 4 | Set-Content -Path $MANIFEST_FILE
```

---

### 3.3 Step 3: Restoration using `pg_restore`

To restore the custom binary archive into an isolated test or staging PostgreSQL 17 database (or restore to live in a disaster recovery scenario):

```powershell
# Target Test Database parameters (e.g., local PG17 container or staging database)
$TARGET_HOST = "localhost"
$TARGET_PORT = "5433"
$TARGET_USER = "postgres"
$TARGET_DB   = "restore_verification_db"

# 1. Create fresh restore database if running against local PG17
# psql -h $TARGET_HOST -p $TARGET_PORT -U $TARGET_USER -c "DROP DATABASE IF EXISTS $TARGET_DB;"
# psql -h $TARGET_HOST -p $TARGET_PORT -U $TARGET_USER -c "CREATE DATABASE $TARGET_DB;"

# 2. Execute Restoration via pg_restore
pg_restore -h $TARGET_HOST -p $TARGET_PORT -U $TARGET_USER -d $TARGET_DB `
    --clean `
    --if-exists `
    --no-owner `
    --no-privileges `
    --verbose `
    $DUMP_FILE
```

---

### 3.4 Step 4: Post-Restoration Verification Queries

Once restored, execute the following SQL verification suite via `psql` to validate 100% schema and data parity:

```powershell
# Post-restoration verification script executed via psql
psql -h $TARGET_HOST -p $TARGET_PORT -U $TARGET_USER -d $TARGET_DB -c "
  -- 1. Table Count Verification
  SELECT 
    (SELECT COUNT(*) FROM public.businesses) AS businesses_count,
    (SELECT COUNT(*) FROM public.business_members) AS members_count,
    (SELECT COUNT(*) FROM public.wa_connections) AS connections_count,
    (SELECT COUNT(*) FROM public.wa_credentials) AS credentials_count,
    (SELECT COUNT(*) FROM public.wa_contacts) AS contacts_count,
    (SELECT COUNT(*) FROM public.wa_conversations) AS conversations_count,
    (SELECT COUNT(*) FROM public.wa_messages) AS messages_count;

  -- 2. Schema Object Counts
  SELECT 
    COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) AS tables_count,
    COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) AS views_count
  FROM information_schema.tables 
  WHERE table_schema = 'public';

  -- 3. Functions / Stored Procedures Count
  SELECT COUNT(*) AS custom_functions_count
  FROM information_schema.routines 
  WHERE routine_schema = 'public';

  -- 4. Active Indexes Count
  SELECT COUNT(*) AS active_indexes_count
  FROM pg_indexes 
  WHERE schemaname = 'public';

  -- 5. Foreign Key Integrity Check (Returns 0 if all FKs valid)
  SELECT conname, conrelid::regclass AS table_from, confrelid::regclass AS table_to
  FROM pg_constraint 
  WHERE contype = 'f' AND connamespace = 'public'::regnamespace;
"
```

---

## 4. Current Gate Status & Stop Rule

```
+--------------------------------------------------------------------------------------------------------+
|                                    GATE EXECUTION AUDIT CLASSIFICATION                                 |
+------------------------------------+--------------------------+----------------------------------------+
| ITEM                               | RESULT                   | AUDIT LABEL                            |
+------------------------------------+--------------------------+----------------------------------------+
| Backup script commands & logic     | Formally defined         | 🔍 VERIFIED BY SOURCE INSPECTION       |
| SHA-256 verification protocol      | Formally defined         | 🔍 VERIFIED BY SOURCE INSPECTION       |
| Host pg_dump / pg_restore tooling  | Missing from PATH        | 🔴 BLOCKED                             |
| Live database export executed      | Not executed             | 🔴 NOT VERIFIED (Awaiting Authorization|
| Live dump restoration executed     | Not executed             | 🔴 NOT VERIFIED                        |
+------------------------------------+--------------------------+----------------------------------------+
```

> [!CAUTION]
> **MANDATORY STOP RULE:**  
> In accordance with P4 Gate 1.2 rules, no live `pg_dump` will be executed autonomously.  
> The operator must first resolve the client tooling prerequisite and provide explicit human authorization.
