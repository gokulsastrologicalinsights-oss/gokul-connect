# GOKUL CONNECT — P4 GATE 1.1: SECURE CREDENTIAL & EXECUTION GUIDE
## Authentication Topologies, Minimum Privileges, and Credential Security for Database Migrations

**Target Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`)  
**Database Host:** `db.ansiwtwqgrfmzfrhkzuu.supabase.co`  
**Session Pooler:** `aws-0-ap-south-1.pooler.supabase.com:5432`  
**Transaction Pooler:** `aws-0-ap-south-1.pooler.supabase.com:6543`  
**Execution Target:** Sequential Migrations 016 through 024  
**Security Mandate:** **ZERO CREDENTIAL LOGGING, ZERO CHAT EXPOSURE, MINIMUM PRIVILEGE ENFORCEMENT**

---

## 1. Executive Summary & Critical Workflow Correction

In previous preflight drafts, it was erroneously assumed that possessing a `SUPABASE_ACCESS_TOKEN` alone was sufficient to execute remote database migrations.

> [!CAUTION]
> **CRITICAL ARCHITECTURAL DISTINCTION:**
> A `SUPABASE_ACCESS_TOKEN` is a Personal Access Token (PAT) for the **Supabase Management API** (`api.supabase.com`). While it allows managing cloud project settings and executing HTTP queries via the Management API, **it does NOT authenticate direct PostgreSQL TCP connections on port 5432 or 6543**.  
> Executing migrations via `pg_dump`, `pg_restore`, `psql`, or `supabase db push --remote` requires the **PostgreSQL database password** (`SUPABASE_DB_PASSWORD`).

This guide details the minimum credentials required across each execution topology, how to authenticate securely using local environment variables, and the exact security boundaries that must be maintained.

---

## 2. Taxonomy of Supabase Credentials & Privileges

Understanding the distinct scope of each credential is vital for security:

```
+--------------------------------------------------------------------------------------------------------+
|                                    SUPABASE CREDENTIAL TAXONOMY                                        |
+--------------------------------------------------------------------------------------------------------+
| CREDENTIAL                      | PROTOCOL / PORT       | SCOPE / CAPABILITIES | DDL EXECUTION STATUS  |
+---------------------------------+-----------------------+----------------------+-----------------------+
| 1. Database Password            | PostgreSQL TCP        | Full superuser/admin | ✅ REQUIRED for       |
|    (SUPABASE_DB_PASSWORD)       | Port 5432 / 6543      | access to PostgreSQL | pg_dump, pg_restore,  |
|                                 | (Direct / Pooler)     | catalog & DDL engine.| psql, & db push.      |
+---------------------------------+-----------------------+----------------------+-----------------------+
| 2. Supabase Access Token        | HTTPS (REST API)      | Management API       | ⚠️ Permitted ONLY for  |
|    (SUPABASE_ACCESS_TOKEN)      | api.supabase.com:443  | project config, orgs,| `supabase db query`   |
|                                 |                       | and API SQL queries. | HTTP endpoint.        |
+---------------------------------+-----------------------+----------------------+-----------------------+
| 3. Service Role Key             | HTTPS (PostgREST)     | Bypasses RLS on      | ❌ CANNOT execute raw |
|    (SUPABASE_SERVICE_ROLE_KEY)  | Port 443              | REST API endpoints & | DDL scripts, tables,  |
|                                 |                       | Storage API.         | or migrations.        |
+---------------------------------+-----------------------+----------------------+-----------------------+
| 4. Anon Public Key              | HTTPS (PostgREST)     | Client-side queries; | ❌ CANNOT execute     |
|    (NEXT_PUBLIC_...ANON_KEY)    | Port 443              | strictly bound to    | DDL. Read/write only  |
|                                 |                       | RLS policies.        | within tenant scope.  |
+--------------------------------------------------------------------------------------------------------+
```

---

## 3. Comparison of Migration Execution Topologies

There are three sanctioned topologies for executing database migrations on the dedicated Supabase project. Each requires a distinct credential profile:

### Topology A: Direct PostgreSQL / Session Pooler Execution (`psql` / Node pg Runner) — RECOMMENDED
- **Mechanism:** Direct TCP connection to AWS Mumbai Session Pooler (`aws-0-ap-south-1.pooler.supabase.com:5432`).
- **Minimum Required Credentials:**
  - `SUPABASE_DB_PASSWORD` (Database password for `postgres.ansiwtwqgrfmzfrhkzuu`).
- **Advantages:**
  - Full support for `--single-transaction` wrapping per migration file.
  - Native streaming of standard PostgreSQL error codes and notices.
  - Unaffected by HTTP timeout limits on large migration scripts.
- **Connection String Structure:**
  ```
  postgresql://postgres.ansiwtwqgrfmzfrhkzuu:[SUPABASE_DB_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
  ```

---

### Topology B: Supabase CLI Linked Execution (`supabase db push --remote`)
- **Mechanism:** The Supabase CLI connects to the Supabase Management API to resolve project state, then opens a direct database connection to apply unapplied files from `supabase/migrations/`.
- **Minimum Required Credentials:**
  - `SUPABASE_ACCESS_TOKEN` (scopes: `projects_read`, `database_write`, `database_pooling_config_read`).
  - `SUPABASE_DB_PASSWORD` (passed via `--password` or environment variable).
- **Considerations:**
  - Supabase CLI parses migration filenames looking for standard 14-digit timestamps (`YYYYMMDDHHMMSS`).
  - If migration history table contains non-standard version strings from historical manual entries (e.g., `20261106_001`), `supabase db push` may encounter ledger mismatch warnings unless `--include-all` is evaluated.

---

### Topology C: Supabase CLI Management Query (`supabase db query --remote`)
- **Mechanism:** Sends SQL script content over HTTPS to the Supabase Management API endpoint (`POST /v1/projects/{ref}/database/query`).
- **Minimum Required Credentials:**
  - `SUPABASE_ACCESS_TOKEN` (scopes: `database_read`, `database_write`, `projects_read`).
- **Considerations:**
  - Does NOT require `SUPABASE_DB_PASSWORD`.
  - Executes in autocommit mode per statement unless explicitly wrapped in `BEGIN; ... COMMIT;` within the SQL file.
  - Does NOT automatically insert records into `supabase_migrations.schema_migrations`; requires an explicit ledger insert statement per migration.

---

## 4. Secure Credential Configuration & Environment Hygiene

In strict compliance with production safety rules, credentials must **NEVER** be hardcoded, requested in chat, or logged.

### 4.1 Local Environment Variable Configuration

All execution tools must source credentials exclusively from local system environment variables or `.env.local` (which is excluded from Git tracking via `.gitignore`):

```bash
# In .env.local (LOCAL ONLY - NEVER COMMITTED):
NEXT_PUBLIC_SUPABASE_URL="https://ansiwtwqgrfmzfrhkzuu.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

# Operator-provided migration credentials (set in active terminal session):
$env:SUPABASE_DB_PASSWORD="[OPERATOR_DATABASE_PASSWORD]"
$env:SUPABASE_ACCESS_TOKEN="[OPERATOR_ACCESS_TOKEN]"
```

### 4.2 Script Credential Sanitization Protocol

Any script executing preflight or migration tasks must implement automatic credential sanitization:
1. **Never print connection strings:** When logging target databases, mask credentials:
   ```javascript
   function sanitizeUri(uri) {
     return uri.replace(/:([^:@]+)@/, ":****@");
   }
   console.log("Connecting to:", sanitizeUri(databaseUri));
   ```
2. **Never log query payloads containing tokens:** Prevent logging SQL statements that seed credentials or sensitive keys.
3. **Environment validation without reflection:** When validating that credentials exist, log only boolean presence:
   ```javascript
   console.log("Database Password Configured:", Boolean(process.env.SUPABASE_DB_PASSWORD));
   console.log("Access Token Configured:", Boolean(process.env.SUPABASE_ACCESS_TOKEN));
   ```

---

## 5. Pooler Port Selection: 5432 (Session) vs. 6543 (Transaction)

Supabase utilizes **Supavisor** for connection pooling, exposing two distinct ports:

> [!WARNING]
> **DO NOT USE PORT 6543 FOR MIGRATIONS.**  
> Port 6543 operates in **Transaction Pooling Mode**. In this mode, subsequent statements in a script may be dispatched across different server backend processes.  
> Transaction pooling **breaks prepared statements, session-level locks, temporary tables, and multi-statement transactional DDL (`BEGIN; ... COMMIT;`)**.  
> **Always use Port 5432 (Session Pooling Mode)** or direct database connection for DDL and migration execution.

---

## 6. Preflight Credential Checklist

Prior to requesting final live execution authorization, the operator must verify the local credential environment:

- [ ] `SUPABASE_DB_PASSWORD` confirmed locally available for Session Pooler (`aws-0-ap-south-1.pooler.supabase.com:5432`).
- [ ] Direct database connectivity confirmed with read-only probe (`SELECT 1;`).
- [ ] `SUPABASE_ACCESS_TOKEN` confirmed locally available if CLI query method is selected.
- [ ] Verified that `.env.local` is present in `.gitignore`.
- [ ] Confirmed zero secrets exposed in Git commit logs, shell histories, or chat transcripts.
- [ ] Verified that `SUPABASE_SERVICE_ROLE_KEY` is NOT being used as a PostgreSQL password.
