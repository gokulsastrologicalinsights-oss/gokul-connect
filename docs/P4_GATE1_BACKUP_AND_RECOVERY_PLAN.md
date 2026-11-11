# GOKUL CONNECT — P4 GATE 1: BACKUP AND RECOVERY PLAN
## Pre-Migration Disaster Recovery, Snapshot Procedures, and Rollback Architecture

**Target Project:** `gokul-connect` (`ansiwtwqgrfmzfrhkzuu`)  
**Database Host:** `db.ansiwtwqgrfmzfrhkzuu.supabase.co`  
**Region:** `ap-south-1` (AWS Mumbai)  
**PostgreSQL Version:** `17.11.0.018`  
**Target Migrations:** 016 through 024  
**Plan Status:** **PREPARED — BACKUP PROCEDURES MANDATED PRIOR TO LIVE MODIFICATIONS**

---

## 1. Executive Summary & Verification of Existing Backups

In strict compliance with production safety rules, Antigravity has performed an independent audit of existing repository and database backup artifacts.

### Audit of Existing Backup Artifacts:
- **Found in `scripts/backup/`:**
  - `20261107_185600_phase11_4_preflight_snapshot.json` (Catalog and metadata snapshot capturing schema definitions, constraints, indexes, RLS policies, triggers, table row counts, and migration ledger history before Migration 015).
  - Migration `.sql.bak` source file copies (010, 011, 012, 013, 014, 015).
  - `wa_credentials_backup_*.json` (Encrypted credential backup payload).
- **CRITICAL DISTINCTION:** The JSON files in `scripts/backup/` are **catalog and metadata snapshots**, NOT full physical binary or restorable SQL database dumps (`pg_dump`).
- **Policy Compliance Statement:** **No physical pre-migration database dump for migrations 016–024 currently exists.** A dedicated physical database export and snapshot MUST be taken immediately prior to executing any live database modifications.

---

## 2. Supabase Backup Architecture & Methods

### 2.1 Recommended Supabase Backup Method

For Supabase Cloud projects on the Pro plan or above, the primary disaster recovery mechanism is:
1. **Automated Daily Backups:** Managed daily physical snapshots taken by Supabase Cloud and stored in multi-region encrypted S3 storage.
2. **On-Demand Management API / CLI Dump:** Executing a complete, consistent schema and data export via `pg_dump` or `supabase db dump`.

### 2.2 Point-in-Time Recovery (PITR) Availability & Requirements

| Capability | Pro Plan with PITR Add-On | Standard Free / Pro Plan | Current Gokul Connect Assessment |
|---|---|---|---|
| **RPO (Recovery Point Objective)** | Seconds (Continuous WAL archiving) | Up to 24 hours (Daily snapshot) | Must rely on on-demand preflight dump prior to migration. |
| **RTO (Recovery Time Objective)** | 10–30 minutes (Automated restore) | 30–60 minutes | Fast restore via CLI `pg_restore` or SQL dump import. |
| **PITR Requirement** | Requires Supabase Pro + PITR enablement in project settings | Standard automated daily backups | Mandatory manual preflight dump must be taken before migration start. |

---

## 3. Mandatory Preflight Backup Procedure

Before applying Migration 016, the following three backup procedures must be executed and verified:

### Step 1: Full Database Data & Schema Export (`pg_dump`)
Targeting both schema and all table data across `public` and `supabase_migrations` schemas:

```bash
# Set timestamped backup identifier
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Export complete database (roles, schema, and data)
npx supabase db dump \
  --remote=ansiwtwqgrfmzfrhkzuu \
  --data-only \
  -f "scripts/backup/${TIMESTAMP}_p4_gate1_live_data_backup.sql"

npx supabase db dump \
  --remote=ansiwtwqgrfmzfrhkzuu \
  --keep-comments \
  -f "scripts/backup/${TIMESTAMP}_p4_gate1_live_schema_backup.sql"
```

*Alternative via native `pg_dump`:*
```bash
pg_dump "postgresql://postgres.ansiwtwqgrfmzfrhkzuu:[DB-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" \
  --clean --if-exists --format=custom \
  --file="scripts/backup/${TIMESTAMP}_p4_gate1_full_pg_dump.dump"
```

### Step 2: Metadata & Catalog Baseline Snapshot
Generate a timestamped JSON snapshot recording row counts, table schemas, triggers, and the migration ledger:
```bash
node scripts/inspect-baseline-and-migrations.mjs > "scripts/backup/${TIMESTAMP}_p4_gate1_catalog_snapshot.log"
```

### Step 3: Storage Bucket Backup
Inspect and export any assets in Supabase Storage:
- Currently, the live database has **0 storage buckets**.
- Once bucket `whatsapp-media` is provisioned and in use, media blobs must be backed up using Supabase Storage API export scripts or S3-compatible replication.

---

## 4. Backup Verification Procedure

A backup is NOT considered valid until verified through the following 4-step checklist:

1. **File Size & Integrity:**
   - Confirm the SQL dump file is non-empty (`> 50 KB`).
   - Confirm file starts with standard PostgreSQL dump headers (`-- PostgreSQL database dump`).
2. **Table Inclusion Verification:**
   - Inspect dump contents to confirm presence of core tables: `businesses`, `business_members`, `wa_connections`, `wa_credentials`, `wa_conversations`, `wa_messages`, `wa_contacts`.
3. **Sandbox Restoration Test:**
   - Restore the dump into a temporary local PostgreSQL or PGlite instance:
   ```bash
   node -e "
     const { PGlite } = require('@electric-sql/pglite');
     const fs = require('fs');
     const sql = fs.readFileSync('scripts/backup/${TIMESTAMP}_p4_gate1_live_data_backup.sql', 'utf8');
     const db = new PGlite();
     db.exec(sql).then(() => console.log('Dump parsed and executed cleanly!'));
   "
   ```
4. **Row Count Audit:**
   - Confirm row counts in the restored sandbox match the live preflight counts:
     - `businesses`: 2
     - `business_members`: 4
     - `wa_connections`: 2
     - `wa_credentials`: 1
     - `wa_conversations`: 3
     - `wa_messages`: 15
     - `wa_contacts`: 4

---

## 5. Rollback Architecture: Database vs. Application

It is vital to distinguish between a **Database Rollback** and an **Application Rollback**:

```
+---------------------------------------------------------------------------------+
|                                ROLLBACK DOMAINS                                 |
+---------------------------------------------------------------------------------+
|                                                                                 |
|  [ APPLICATION ROLLBACK ]                                                       |
|  - Scope: Next.js source code, Vercel deployments, API route handlers, crons.  |
|  - Mechanism: Instant Vercel deployment rollback (promote prior deployment).    |
|  - Impact: Zero database data lost; frontend/API reverts to prior commit.       |
|  - Time to restore: < 60 seconds.                                               |
|                                                                                 |
|  [ DATABASE ROLLBACK ]                                                          |
|  - Scope: PostgreSQL tables, columns, constraints, RLS policies, triggers.      |
|  - Mechanism: Transaction rollback, down-migrations, or pg_restore from dump.    |
|  - Impact: Risk of data loss if newly inserted records exist.                   |
|  - Time to restore: 5 to 30 minutes.                                            |
|                                                                                 |
+---------------------------------------------------------------------------------+
```

---

## 6. Reversibility Classification for Migrations 016–024

Not all migrations can be safely reversed by simple `DROP` commands if data has been accepted by the system:

| Migration | Rollback Safety Classification | Reversibility Assessment & Constraints |
|:---:|:---:|---|
| **016** (Team Management) | **HIGH REVERSIBILITY (Safe)** | Adding `business_invitations` and assignment logs does not modify existing conversations or members destructively. Drops cleanly without harming core data. |
| **017** (Media Messaging) | **MEDIUM REVERSIBILITY** | Adding `wa_media_files` and media columns to `wa_messages` is additive. Can be reversed safely unless users have already uploaded binary media files whose storage references would be severed. |
| **018** (Scheduled Messages) | **HIGH REVERSIBILITY (Safe)** | `wa_scheduled_messages` is an independent queue table. Can be dropped cleanly. Messages that have already been dispatched have independent records in `wa_messages`. |
| **019** (Campaigns) | **HIGH REVERSIBILITY (Safe)** | `wa_campaigns` and `wa_campaign_recipients` are new tables. Contacts have new consent columns (defaults `opted_in` and `false`). Reversing simply drops the campaign tables and drops the 6 columns from `wa_contacts`. |
| **020** (CRM Lifecycle) | **MEDIUM REVERSIBILITY** | `wa_contacts` gets `lifecycle_stage_id`. If stages have been assigned, reverting requires dropping the foreign key constraint before dropping `crm_lifecycle_stages`. |
| **021** (Notification Center) | **HIGH REVERSIBILITY (Safe)** | Extends `crm_follow_up_reminders` and adds `user_notification_preferences`. Can be reversed by dropping preferences table and resetting reminder check constraints. |
| **022** (Visual Flows & Realtime)| **HIGH REVERSIBILITY (Safe)** | Reversing removes tables from `supabase_realtime` publication and drops `wa_visual_flows`. Existing messages and conversations are unaffected. |
| **023** (Operational Reliability)| **HIGH REVERSIBILITY (Safe)** | Extends check constraints to permit `dead_letter`. Reversing requires verifying no jobs are currently in `dead_letter` status before restoring the tighter check constraint. |
| **024** (Labels & Cron Locks) | **HIGH REVERSIBILITY (Safe)** | Reversing drops `cron_locks` table and drops `labels` array column and GIN index from `wa_conversations`. Zero impact on existing conversation threads. |

---

## 7. Recovery Responsibilities & Timeline Considerations

| Role | Responsibility | Action in Disaster Scenario |
|---|---|---|
| **Lead Developer / DBA** | Database schema & data restoration | Stop migrations, evaluate error logs, execute down-migration SQL or restore from `pg_dump`. |
| **Platform Administrator**| Supabase project & API access | Verify Supabase instance health, confirm pooler connections, verify access tokens. |
| **Application Engineer** | Deployment & Worker coordination | Ensure all cron endpoints and workers remain paused (`CRON_ENABLED=false` or maintenance bypass). |

### Recovery Time Objective (RTO) Breakdown:
- **Scenario A: Migration Script Failure (Immediate Transaction Rollback)**
  - Cause: DDL syntax error, lock timeout, constraint collision.
  - Action: Migration executes in a single transaction; automatic PostgreSQL rollback leaves previous state untouched.
  - RTO: **< 1 minute**.
- **Scenario B: Manual Reversal (Down-Migration SQL Script)**
  - Cause: Post-migration verification fails immediately after step completion.
  - Action: Execute pre-drafted down-migration SQL script for the failed step.
  - RTO: **2–5 minutes**.
- **Scenario C: Full Database Restore (`pg_restore`)**
  - Cause: Data corruption or multiple partial migration errors.
  - Action: Drop public schema and restore from `scripts/backup/${TIMESTAMP}_p4_gate1_full_pg_dump.dump`.
  - RTO: **15–30 minutes**.
