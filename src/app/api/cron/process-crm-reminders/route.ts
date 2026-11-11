import { NextRequest } from "next/server";
import {
  generateFollowUpRemindersDb,
  processReminderJobsBatch,
} from "@/lib/notifications/service";
import { ASTRO_BUSINESS_ID, VIVAHAM_BUSINESS_ID } from "@/lib/team/database";
import { runCoordinatedCron } from "@/lib/cron/coordinator";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * ==============================================================================
 * CRON API ROUTE: /api/cron/process-crm-reminders
 * ==============================================================================
 * Internal CRM Follow-Up Reminders & Queue Processing across isolated tenants.
 * Enforces fail-closed CRON_SECRET authentication and concurrency overlap guard.
 * Frequency: Every 15 minutes (or daily morning schedule).
 * Dynamically iterates across all active business tenants.
 * ==============================================================================
 */
export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: NextRequest) {
  return runCoordinatedCron({
    cronName: "process-crm-reminders",
    workerType: "crm_reminder_worker",
    request,
    handler: async (workerId) => {
      // 1. Resolve all active business tenants dynamically
      let businessIds = [ASTRO_BUSINESS_ID, VIVAHAM_BUSINESS_ID];
      if (isSupabaseConfigured()) {
        try {
          const supabase = createAdminClient();
          const { data: activeBusinesses } = await supabase
            .from("businesses")
            .select("id")
            .eq("is_active", true);

          if (activeBusinesses && activeBusinesses.length > 0) {
            businessIds = activeBusinesses.map((b) => b.id);
          }
        } catch {
          // Fallback to seeded business IDs
        }
      }

      // 2. Generate reminders across all isolated tenant workspaces
      const generationResults: Record<string, number> = {};
      let totalGenerated = 0;

      for (const bizId of businessIds) {
        try {
          const res = await generateFollowUpRemindersDb(bizId);
          generationResults[bizId] = res.generatedCount;
          totalGenerated += res.generatedCount;
        } catch (genErr) {
          console.warn(`[CRM Reminders Cron] Failed generation for business ${bizId}:`, genErr);
          generationResults[bizId] = 0;
        }
      }

      // 3. Process durable queue batch (reclaim stuck jobs + process pending)
      const batchResult = await processReminderJobsBatch(20, workerId);

      return {
        generation: {
          total: totalGenerated,
          byBusiness: generationResults,
        },
        worker: batchResult,
      };
    },
  });
}
