"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  getTenantWorkerHealthSummary,
  getRecentOperationalActivity,
} from "@/lib/observability/worker-health";
import {
  manualRetryJobDb,
  recoverStuckJobsDb,
  ManualRetryResult,
  StuckRecoveryResult,
} from "@/lib/observability/recovery";
import { OperationalDashboardData, QueueType } from "@/types/operations";

/**
 * ==============================================================================
 * GOKUL CONNECT — OPERATIONS SERVER ACTIONS
 * ==============================================================================
 * Strict multi-tenant operational monitoring and retry actions.
 * Owner and Admin roles hold full recovery permissions; Agents and Viewers are read-only.
 * ==============================================================================
 */

export async function getOperationsDataAction(
  businessSlug: string
): Promise<{ success: boolean; data?: OperationalDashboardData; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    const userRole = (membership.role as "owner" | "admin" | "agent" | "viewer") || "agent";
    const canManageOperations = userRole === "owner" || userRole === "admin";

    const [healthSummary, recentActivity] = await Promise.all([
      getTenantWorkerHealthSummary(business.id),
      getRecentOperationalActivity(business.id, 25),
    ]);

    const dashboardData: OperationalDashboardData = {
      businessId: business.id,
      businessSlug,
      userRole,
      canManageOperations,
      timestamp: new Date().toISOString(),
      overallStatus: healthSummary.overallStatus,
      queuesSummary: healthSummary.queuesSummary,
      workers: healthSummary.workers,
      recentActivity,
    };

    return { success: true, data: dashboardData };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load operational data",
    };
  }
}

export async function manualRetryJobAction(
  businessSlug: string,
  queueType: QueueType,
  jobId: string
): Promise<ManualRetryResult> {
  try {
    const { business, user, membership } = await validateBusinessAccess(businessSlug);

    const userRole = (membership.role as "owner" | "admin" | "agent" | "viewer") || "agent";

    // Enforce role restriction
    if (userRole !== "owner" && userRole !== "admin") {
      return {
        success: false,
        error: "Forbidden: Only Owner or Admin can manually retry queue jobs",
      };
    }

    const result = await manualRetryJobDb({
      businessId: business.id,
      queueType,
      jobId,
      actorUserId: user.id,
      actorRole: userRole,
    });

    if (result.success) {
      revalidatePath(`/workspace/${businessSlug}/operations`);
    }

    return result;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Manual retry failed",
    };
  }
}

export async function recoverStuckJobsAction(
  businessSlug: string
): Promise<{ success: boolean; result?: StuckRecoveryResult; error?: string }> {
  try {
    const { business, membership } = await validateBusinessAccess(businessSlug);

    const userRole = (membership.role as "owner" | "admin" | "agent" | "viewer") || "agent";

    if (userRole !== "owner" && userRole !== "admin") {
      return {
        success: false,
        error: "Forbidden: Only Owner or Admin can execute stuck job recovery",
      };
    }

    const result = await recoverStuckJobsDb({
      businessId: business.id,
      timeoutMinutes: 5,
    });

    revalidatePath(`/workspace/${businessSlug}/operations`);
    return { success: true, result };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to recover stuck jobs",
    };
  }
}
