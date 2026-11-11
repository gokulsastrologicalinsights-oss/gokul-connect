# GOKUL CONNECT — PRODUCTION ROLLBACK PLAN
## Incident Mitigation, Recovery & Reversal Protocol

**Project:** Gokul Connect  
**Objective:** Restore operational stability without data loss or duplicate message dispatch.  
**Classification:** Operational Security / High  

---

## 1. Rollback Principles

1. **Zero Data Loss:** Never execute destructive table drops or resets.
2. **Preserve Message History:** Inbound and outbound message records are immutable and must be preserved.
3. **Prevent Duplicate WhatsApp Dispatch:** In the event of worker or deployment instability, immediately pause queue processing to prevent duplicate customer messages.
4. **Tenant Isolation Continuity:** Cross-tenant barriers must remain strictly enforced throughout any rollback.

---

## 2. Component-Specific Rollback Procedures

### 2.1 Application Hosting Rollback (Vercel)
If a runtime error, fatal crash, or UI regression occurs after deployment:
1. Open Vercel Project Dashboard > Deployments.
2. Select previous stable deployment.
3. Click "Promote to Production" (instant rollback via DNS / CDN pointer update).
4. Verify `/api/health` returns HTTP 200 on the restored deployment.

### 2.2 Database Migration Rollback
1. **Never drop tables with active data.**
2. If a forward migration introduces an issue, author an additive compensating migration:
   - Example: Relaxing an erroneous constraint or dropping an index rather than dropping tables.
3. If an unapplied migration fails during application:
   - Transaction will automatically roll back cleanly without committing partial changes.
   - The ledger entry in `supabase_migrations.schema_migrations` is NOT recorded.

### 2.3 Webhook Processing Mitigation
If an anomalous flood of invalid webhooks occurs:
1. In Meta App Dashboard > WhatsApp > Configuration > Edit Webhook:
   - Temporarily point to a standby staging URL or disable `messages` subscription.
2. Verify inbound queue in `wa_processing_jobs` stops accumulating.

### 2.4 Worker & Background Job Rollback
If a worker encounters unhandled exceptions or looping errors:
1. Revoke or temporarily invalidate `CRON_SECRET` in hosting settings to immediately pause cron job triggers.
2. Staged jobs remain preserved in `wa_processing_jobs` with status `pending`.
3. Dead-letter queue captures failed attempts (`status = 'dead_letter'`).
4. Re-enable `CRON_SECRET` once the code defect is deployed.
