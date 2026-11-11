# GOKUL CONNECT — P2-E: STRUCTURED LOGGING & DIAGNOSTICS REPORT

**Document ID:** GC-P2-LOGGING-AND-DIAGNOSTICS  
**Phase:** Milestone P2 — Operational Reliability & Worker Observability  
**Status:** COMPLETE (Local Development & Verification)  
**Security Level:** High / Zero-Secret Leakage Guarantee  

---

## 1. Executive Summary

Workstream P2-E standardizes log emission, trace correlation, and failure diagnostics across Gokul Connect's webhooks, crons, queue workers, and database operations.

The logging infrastructure outputs structured, single-line JSON logs that include contextual correlation IDs, worker names, execution timestamps, duration measurements, and tenant identifiers. The system incorporates an aggressive redaction sanitizer that guarantees zero exposure of Meta Bearer tokens, App Secrets, Supabase service-role keys, database connection strings, passwords, or customer credit card data.

---

## 2. Structured JSON Log Schema

All logs emitted by `ObservabilityLogger` (`src/lib/observability/logger.ts`) adhere to a uniform JSON schema:

```json
{
  "timestamp": "2026-11-09T13:59:23.108Z",
  "service": "gokul-connect",
  "level": "info",
  "correlationId": "process_crm_reminders_1794232763074",
  "workerName": "crm_reminder_worker",
  "businessId": "11111111-1111-1111-1111-111111111111",
  "action": "worker_run_succeeded",
  "status": "succeeded",
  "durationMs": 33,
  "meta": {
    "workerId": "process_crm_reminders_1794232763074",
    "claimed": 5,
    "processed": 5,
    "succeeded": 5,
    "failed": 0,
    "reclaimed": 0,
    "skipped": 0,
    "cronName": "process-crm-reminders"
  }
}
```

### 2.1 Core Schema Fields:
- `timestamp`: ISO-8601 UTC timestamp.
- `service`: Identifier (`gokul-connect`).
- `level`: Log level (`debug`, `info`, `warn`, `error`).
- `correlationId`: Distributed trace ID linking webhook ingestion, queue insertion, and worker execution.
- `workerName`: Name of the executing background worker or cron route.
- `businessId`: Active tenant UUID (preserved for debugging while cross-tenant records are segregated).
- `jobId`: Target queue item UUID (optional).
- `action`: Specific operational event (e.g., `worker_run_started`, `cron_unauthorized_rejection`, `manual_retry_job_requeued`).
- `status`: Outcome (`started`, `succeeded`, `failed`, `skipped`).
- `durationMs`: Wall-clock elapsed time in milliseconds.
- `error`: Sanitized error code or description.
- `meta`: Arbitrary operational context with automatic recursive sanitization.

---

## 3. Secret Scrubbing & Data Sanitization

`sanitizeLogData` inspects all log entries, nested objects, arrays, and string messages to scrub sensitive values before emission:

### 3.1 Redaction Rules

| Sensitive Data Category | Detection Pattern | Replacement Token |
| :--- | :--- | :--- |
| **Meta Access Tokens** | `\bEAA[A-Za-z0-9_\-\.]{15,}\b` | `[REDACTED_ACCESS_TOKEN]` |
| **Authorization Bearer Headers** | `\bBearer\s+[A-Za-z0-9_\-\.]{10,}\b` | `Bearer [REDACTED_BEARER_TOKEN]` |
| **Database Connection Strings** | `postgres(?:ql)?:\/\/[^\s'"]+` | `postgresql://[REDACTED_DB_CONNECTION]` |
| **Sensitive Object Keys** | `secret`, `password`, `token`, `key`, `auth`, `authorization`, `cookie`, `credential` | `[REDACTED_KEY_VALUE]` |
| **Credit Card Numbers** | 13–16 digits with Luhn patterns (exempting UUIDs) | `[REDACTED_CREDIT_CARD]` |

### 3.2 Preservation of Tenant & Diagnostic Identifiers
Crucially, sanitization does NOT corrupt standard UUIDs or tenant business identifiers. The regex matcher explicitly verifies whether a token is a UUID (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`), ensuring tenant routing diagnostics remain fully traceable across log aggregators.

---

## 4. End-to-End Trace Correlation

To trace messages across decoupled architectural boundaries:
1. **Webhook Ingestion**: Generates `corr_webhook_<timestamp>_<hash>` upon receiving incoming Meta webhook payload.
2. **Queue Insertion**: Sets `correlation_id` in `wa_processing_jobs.payload`.
3. **Worker Claim**: Inherits the correlation ID from the job payload for worker execution logs.
4. **Outbound Dispatch**: Logs Meta API delivery status under the same correlation ID.

---

## 5. Verification & Test Evidence

All structured logging and sanitization capabilities have been verified by Vitest:
- `tests/p2-operational-reliability.test.ts` (Domain 5: Structured Logging & Sensitive Secret Sanitization)
  - 5.1 Redacts Bearer tokens, App Secrets, and passwords from logs
  - 5.2 Redacts database connection strings and JWT credentials
  - 5.3 Preserves business_id and non-sensitive diagnostic IDs in logs
  - 5.4 Emits uniform structured JSON format across workers and cron routes
