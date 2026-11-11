import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { validateTenant } from "@/lib/inbox/database";
import { CrmLifecycleReport } from "@/types/database";
import { getLifecycleStagesDb } from "./lifecycle";

/**
 * Computes comprehensive CRM customer lifecycle analytics and follow-up metrics.
 */
export async function getCrmLifecycleReportDb(
  businessId: string,
  client?: any
): Promise<CrmLifecycleReport> {
  await validateTenant(businessId, { client });

  let supabase = client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // outside request
    }
  }

  // 1. Fetch lifecycle stages
  const stages = await getLifecycleStagesDb(businessId, client);

  if (supabase) {
    // 2. Fetch contacts
    const { data: contacts, error: contactErr } = await supabase
      .from("wa_contacts")
      .select("id, status, category, lifecycle_stage_slug, last_interaction_at, last_inbound_at, created_at, is_archived")
      .eq("business_id", businessId)
      .eq("is_archived", false);

    // 3. Fetch follow ups
    const { data: followUps, error: fuErr } = await supabase
      .from("crm_follow_ups")
      .select("id, status, priority, due_at, assigned_to, completed_at, created_at")
      .eq("business_id", businessId);

    // 4. Fetch business members for workload naming
    const { data: members } = await supabase
      .from("business_members")
      .select("user_id, role")
      .eq("business_id", businessId);

    const contactList = contacts || [];
    const fuList = followUps || [];

    // --- Contacts by stage ---
    const totalContacts = contactList.length;
    const stageCountMap = new Map<string, number>();
    for (const c of contactList) {
      const slug = c.lifecycle_stage_slug || "unassigned";
      stageCountMap.set(slug, (stageCountMap.get(slug) || 0) + 1);
    }

    const contactsByStage = stages.map((s) => {
      const count = stageCountMap.get(s.slug) || 0;
      const percentage = totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0;
      return {
        stage: s.name,
        slug: s.slug,
        name: s.name,
        stageName: s.name,
        stageSlug: s.slug,
        color: s.color,
        count,
        percentage,
      };
    });

    // Check if unassigned exists
    const unassignedCount = stageCountMap.get("unassigned") || 0;
    if (unassignedCount > 0) {
      contactsByStage.push({
        stage: "Unassigned",
        slug: "unassigned",
        name: "Unassigned",
        stageName: "Unassigned",
        stageSlug: "unassigned",
        color: "slate",
        count: unassignedCount,
        percentage: totalContacts > 0 ? Math.round((unassignedCount / totalContacts) * 100) : 0,
      });
    }

    // --- New leads over time (last 30 days) ---
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const dateCountMap = new Map<string, number>();

    for (let d = 29; d >= 0; d--) {
      const dayDate = new Date(now - d * 24 * 60 * 60 * 1000);
      const dateStr = dayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      dateCountMap.set(dateStr, 0);
    }

    for (const c of contactList) {
      const createdTime = new Date(c.created_at).getTime();
      if (createdTime >= thirtyDaysAgo) {
        const dateStr = new Date(c.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        if (dateCountMap.has(dateStr)) {
          dateCountMap.set(dateStr, (dateCountMap.get(dateStr) || 0) + 1);
        }
      }
    }

    const newLeadsOverTime = Array.from(dateCountMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
    const leadsOverTime = newLeadsOverTime.map((d) => ({ period: d.date, count: d.count }));

    // --- Lead to conversion rate ---
    const convertedStageSlugs = new Set(stages.filter((s) => s.is_converted).map((s) => s.slug));
    const lostStageSlugs = new Set(stages.filter((s) => s.is_lost).map((s) => s.slug));

    const convertedContactsCount = contactList.filter((c: any) =>
      c.lifecycle_stage_slug ? convertedStageSlugs.has(c.lifecycle_stage_slug) : false
    ).length;
    const lostContactsCount = contactList.filter((c: any) =>
      c.lifecycle_stage_slug ? lostStageSlugs.has(c.lifecycle_stage_slug) : false
    ).length;

    const leadToConversionRate = totalContacts > 0 ? Math.round((convertedContactsCount / totalContacts) * 100) : 0;

    // --- Conversion by category ---
    const categoryStats = new Map<string, { total: number; converted: number }>();
    for (const c of contactList) {
      const cat = c.category || "uncategorized";
      if (!categoryStats.has(cat)) {
        categoryStats.set(cat, { total: 0, converted: 0 });
      }
      const stat = categoryStats.get(cat)!;
      stat.total++;
      if (c.lifecycle_stage_slug && convertedStageSlugs.has(c.lifecycle_stage_slug)) {
        stat.converted++;
      }
    }

    const conversionByCategory = Array.from(categoryStats.entries()).map(([category, stat]) => ({
      category,
      total: stat.total,
      converted: stat.converted,
      convertedCount: stat.converted,
      totalCount: stat.total,
      rate: stat.total > 0 ? Math.round((stat.converted / stat.total) * 100) : 0,
    }));

    // --- Follow-up completion rate & overdue count ---
    let completedFuCount = 0;
    let overdueFuCount = 0;
    let openFuCount = 0;
    let todayFuCount = 0;

    const todayKolkata = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

    const userWorkloadMap = new Map<
      string,
      { openTasks: number; completedTasks: number; overdueTasks: number }
    >();

    for (const fu of fuList) {
      const userId = fu.assigned_to || "unassigned";
      if (!userWorkloadMap.has(userId)) {
        userWorkloadMap.set(userId, { openTasks: 0, completedTasks: 0, overdueTasks: 0 });
      }
      const w = userWorkloadMap.get(userId)!;

      if (fu.status === "completed") {
        completedFuCount++;
        w.completedTasks++;
      } else if (fu.status === "open" || fu.status === "in_progress") {
        openFuCount++;
        w.openTasks++;
        const fuDateKolkata = new Date(fu.due_at).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        if (fuDateKolkata === todayKolkata) {
          todayFuCount++;
        }
        if (new Date(fu.due_at).getTime() < now) {
          overdueFuCount++;
          w.overdueTasks++;
        }
      }
    }

    const totalActionableFu = completedFuCount + openFuCount;
    const followUpCompletionRate = totalActionableFu > 0 ? Math.round((completedFuCount / totalActionableFu) * 100) : 0;

    const teamWorkload = Array.from(userWorkloadMap.entries()).map(([userId, w]) => ({
      userId,
      userName: userId === "unassigned" ? "Unassigned" : `Agent (${userId.slice(0, 8)})`,
      openTasks: w.openTasks,
      completedTasks: w.completedTasks,
      overdueTasks: w.overdueTasks,
    }));

    const agentWorkload = teamWorkload.map((t) => ({
      agentId: t.userId,
      agentName: t.userName,
      openCount: t.openTasks,
      overdueCount: t.overdueTasks,
      completedCount: t.completedTasks,
    }));

    // --- Inactive contacts count (> 30 days without interaction) ---
    const thirtyDaysAgoIso = new Date(thirtyDaysAgo).getTime();
    let inactiveContactsCount = 0;
    for (const c of contactList) {
      const lastInt = c.last_interaction_at || c.last_inbound_at || c.created_at;
      if (new Date(lastInt).getTime() < thirtyDaysAgoIso) {
        inactiveContactsCount++;
      }
    }

    const followUpMetrics = {
      total: fuList.length,
      totalFollowUps: fuList.length,
      openFollowUps: openFuCount,
      todayCount: todayFuCount,
      dueTodayFollowUps: todayFuCount,
      upcomingCount: fuList.length - todayFuCount - overdueFuCount - completedFuCount,
      overdueCount: overdueFuCount,
      overdueFollowUps: overdueFuCount,
      completedCount: completedFuCount,
      completedFollowUps: completedFuCount,
      completionRate: followUpCompletionRate,
    };

    return {
      contactsByStage,
      totalContacts,
      leadsOverTime,
      newLeadsOverTime,
      conversionRate: leadToConversionRate,
      leadToConversionRate,
      convertedCount: convertedContactsCount,
      lostCount: lostContactsCount,
      conversionByCategory,
      followUpMetrics,
      followUpCompletionRate,
      overdueFollowUpCount: overdueFuCount,
      agentWorkload,
      teamWorkload,
      inactiveContactsCount,
    };
  }

  // Mock implementation fallback
  return {
    contactsByStage: stages.map((s) => ({
      stage: s.name,
      slug: s.slug,
      name: s.name,
      stageName: s.name,
      stageSlug: s.slug,
      color: s.color,
      count: 0,
      percentage: 0,
    })),
    totalContacts: 0,
    leadsOverTime: [],
    newLeadsOverTime: [],
    conversionRate: 0,
    leadToConversionRate: 0,
    convertedCount: 0,
    lostCount: 0,
    conversionByCategory: [],
    followUpMetrics: {
      total: 0,
      totalFollowUps: 0,
      openFollowUps: 0,
      todayCount: 0,
      dueTodayFollowUps: 0,
      upcomingCount: 0,
      overdueCount: 0,
      overdueFollowUps: 0,
      completedCount: 0,
      completedFollowUps: 0,
      completionRate: 0,
    },
    followUpCompletionRate: 0,
    overdueFollowUpCount: 0,
    agentWorkload: [],
    teamWorkload: [],
    inactiveContactsCount: 0,
  };
}
