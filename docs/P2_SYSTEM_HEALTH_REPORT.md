# GOKUL CONNECT — P2-F: SYSTEM HEALTH & READINESS PROBES REPORT

**Document ID:** GC-P2-SYSTEM-HEALTH  
**Phase:** Milestone P2 — Operational Reliability & Worker Observability  
**Status:** COMPLETE (Local Development & Verification)  
**Security Level:** Public Liveness / Authenticated Admin Diagnostics  

---

## 1. Executive Summary

Workstream P2-F establishes Kubernetes-grade and serverless-compatible health and readiness probes for Gokul Connect. The system decouples process liveness from downstream dependency readiness, providing infrastructure monitoring tools (such as uptime monitors, load balancers, and container orchestrators) with clean HTTP status codes while protecting internal architecture details from public reconnaissance.

Authorized administrators can access detailed diagnostic breakdowns covering database latency, migration state, environment configuration, encryption key validity, and queue responsiveness.

---

## 2. Health Endpoint Architecture

The health subsystem provides four specialized API routes under `/api/health/*`:

| Endpoint Route | Auth Level | Purpose | HTTP Codes |
| :--- | :--- | :--- | :--- |
| `/api/health/liveness` | Public | Process health & uptime verification. Confirms Next.js event loop is responsive. | `200 OK` (Healthy) |
| `/api/health/readiness` | Public (Sanitized) | Dependency verification. Checks Supabase connection and environment configuration. | `200 OK` (Ready) / `503 Unavailable` (Not Ready) |
| `/api/health/workers` | Admin / Cron Secret | Background worker execution readiness, active locks, and queue responsiveness. | `200 OK` (Ready) / `503 Unavailable` (Degraded) |
| `/api/health` | Dual Mode (Public / Admin) | Root summary. Public returns minimal status; Bearer token returns deep diagnostic tree. | `200 OK` / `503 Unavailable` |

---

## 3. Probe Separation: Liveness vs Readiness

### 3.1 Liveness Probe (`/api/health/liveness`)
- Checks only that the runtime process is running and able to allocate memory and service HTTP requests.
- Does NOT execute downstream database queries or network calls.
- If this endpoint fails, container orchestrators (or PM2) should immediately restart the process.
- Response payload:
  ```json
  {
    "status": "alive",
    "uptime": 142.5,
    "timestamp": "2026-11-09T13:59:23.000Z"
  }
  ```

### 3.2 Readiness Probe (`/api/health/readiness`)
- Evaluates whether the application can safely accept user traffic:
  1. Supabase database connectivity: executes lightweight `SELECT 1` ping.
  2. Required environment configuration: verifies `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
  3. Encryption key readiness: verifies `ENCRYPTION_KEY` is present and valid.
- If database is unreachable, returns HTTP 503 so load balancers stop routing traffic to the instance without restarting the container.

---

## 4. Public vs Authenticated Admin Diagnostics

To prevent threat actors from probing internal database versions, hostnames, or configuration variables, `/api/health` employs dual-mode disclosure:

### 4.1 Public View (Unauthenticated)
Returns only high-level status without infrastructure specifics:
```json
{
  "status": "healthy",
  "timestamp": "2026-11-09T13:59:23.000Z"
}
```

### 4.2 Administrator View (Authenticated via `Authorization: Bearer <CRON_SECRET>`)
Returns detailed diagnostic diagnostics for operations teams:
```json
{
  "status": "healthy",
  "timestamp": "2026-11-09T13:59:23.000Z",
  "diagnostics": {
    "liveness": { "status": "alive", "uptime": 142.5 },
    "readiness": {
      "status": "ready",
      "database": { "connected": true, "latencyMs": 12 },
      "environment": { "supabaseConfigured": true, "encryptionConfigured": true },
      "migrations": { "status": "up_to_date" }
    },
    "workers": {
      "automation": { "status": "healthy", "pendingJobs": 0, "activeLocks": 0 },
      "scheduled": { "status": "healthy", "pendingJobs": 0, "activeLocks": 0 },
      "campaigns": { "status": "healthy", "pendingJobs": 0, "activeLocks": 0 },
      "crm": { "status": "healthy", "pendingJobs": 0, "activeLocks": 0 }
    }
  }
}
```

---

## 5. Verification & Test Evidence

All health probe endpoints and diagnostic masking have been verified by Vitest:
- `tests/p2-operational-reliability.test.ts` (Domain 6: System Health & Readiness Probes)
  - 6.1 Confirms liveness returns HTTP 200 with uptime metric
  - 6.2 Confirms readiness checks database connection and environment
  - 6.3 Returns HTTP 503 Service Unavailable when database connection fails
  - 6.4 Sanitizes public health endpoint output from leaking internal secrets
  - 6.5 Returns deep diagnostic tree to authenticated administrators
