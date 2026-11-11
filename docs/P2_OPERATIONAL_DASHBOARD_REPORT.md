# GOKUL CONNECT — P2-D: OPERATIONAL DASHBOARD REPORT

**Document ID:** GC-P2-OPERATIONAL-DASHBOARD  
**Phase:** Milestone P2 — Operational Reliability & Worker Observability  
**Status:** COMPLETE (Local Development & Verification)  
**Security Level:** Multi-Tenant Isolated / Role-Based UI Access  

---

## 1. Executive Summary

Workstream P2-D implements the operational command and control dashboard for Gokul Connect, accessible at `/workspace/[businessSlug]/operations`. The interface provides business owners and system administrators with immediate visibility into background queue health, worker execution metrics, failure diagnostics, stuck lock alerts, and operational controls.

The UI strictly enforces multi-tenant boundary isolation, ensuring that operational telemetry from Gokul Astrology is never accessible to Gokul Vivaham Matrimony, and restricts administrative control actions (such as manual retry and lock reclamation) to Owners and Admins.

---

## 2. Dashboard Architecture & Components

The dashboard is structured around server-side data fetching and client-side interactive telemetry:

### 2.1 Route & Entry Point
- Server Component: `src/app/workspace/[businessSlug]/operations/page.tsx`
  - Validates user authentication and membership within the active business slug.
  - Queries `getOperationsDataAction(businessId)` server-side.
  - Passes tenant data to the interactive client component.
- Sidebar Navigation: Added "Operations & Health" with an activity-pulse icon to `src/components/workspace/WorkspaceSidebar.tsx`.

### 2.2 Client Interactive View (`OperationsClient.tsx`)
1. **Header & Control Bar**:
   - Shows active business name and current live operational status (All Systems Operational / Attention Required).
   - "Refresh" button with optimistic refresh indicator.
   - "Reclaim Stuck Locks" button (Owner/Admin only).
2. **Key Metric Overview Cards (6 KPI tiles)**:
   - **Pending Jobs**: Total queued items awaiting worker execution.
   - **Processing Jobs**: Items currently actively locked by background workers.
   - **Retrying Jobs**: Jobs experiencing transient errors undergoing exponential backoff.
   - **Failed Jobs**: Recent processing errors.
   - **Dead Letter**: Jobs with exhausted retries or non-recoverable permanent errors.
   - **Completed Jobs**: Total jobs processed successfully.
3. **Stuck Jobs Alert Banner**:
   - Conditionally displayed if any jobs have been locked in `'processing'` for longer than 5 minutes.
   - Displays count of stuck items and provides an instant one-click "Recover Stuck Jobs" action.
4. **Worker Health Cards (5 worker panels)**:
   - Separate telemetry cards for Automation, Scheduled, Campaign, CRM Reminders, and Notifications.
   - Shows status badge (Healthy / Degraded / Failed / Stale / Idle), last successful run timestamp, last attempt timestamp, average duration in ms, and current queue breakdown.
5. **Operational Activity Table & Filters**:
   - Filterable by worker type, status, and search query.
   - Columns: Queue / Worker, Job ID, Status, Attempts, Duration, Recorded At, Actions.
   - Inspect Action: Opens modal displaying sanitized job payload and error diagnostic code.
   - Retry Action: Requeues failed/dead-lettered jobs (Owner/Admin only).
6. **Diagnostic Job Inspector Modal**:
   - Renders formatted, syntax-highlighted JSON preview of job payload and error history.
   - Automatically masks tokens, connection strings, and credential secrets.

---

## 3. Role-Based Access Control (RBAC) Invariants

Operational actions are restricted by role:

| Action | Owner | Admin | Agent | Viewer |
| :--- | :---: | :---: | :---: | :---: |
| **View Operational Dashboard** | ✅ | ✅ | ✅ | ✅ |
| **Filter & Inspect Sanitized Diagnostics** | ✅ | ✅ | ✅ | ✅ |
| **Trigger Queue Refresh** | ✅ | ✅ | ✅ | ✅ |
| **Reclaim Stuck Job Locks** | ✅ | ✅ | ❌ | ❌ |
| **Manual Retry Failed / Dead-Letter Jobs** | ✅ | ✅ | ❌ | ❌ |

In the UI, Agent and Viewer users see a locked tooltip ("Requires Owner or Admin permissions") on operational control buttons. Server actions enforce this check independently:

```typescript
if (role !== "owner" && role !== "admin") {
  return { success: false, error: "Unauthorized: Only Owners and Admins can perform operational actions." };
}
```

---

## 4. Verification & Test Evidence

All dashboard features and role protections have been verified by Vitest:
- `tests/p2-operational-reliability.test.ts` (Domain 4: Operational Dashboard Data Aggregation & RBAC)
  - 4.1 Returns consolidated operational dashboard metrics for active business
  - 4.2 Restricts operational actions (retry, reclaim) to Owner and Admin roles
  - 4.3 Redacts credentials and secrets from job payload inspection
  - 4.4 Isolates operational dashboard data strictly between tenants
  - 4.5 Filters recent activity records correctly by worker type and status
