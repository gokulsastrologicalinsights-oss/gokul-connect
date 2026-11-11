import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { BusinessSlug } from "@/types/database";
import {
  AnalyticsDashboardData,
  AstrologyBusinessReport,
  AutomationAnalytics,
  ContactAnalytics,
  DailyTrendPoint,
  DateRangeFilter,
  InboxAnalytics,
  MessagingAnalytics,
  VivahamBusinessReport,
} from "./types";
import {
  formatDuration,
  formatKolkataDate,
  generateDateBuckets,
  toKolkataDateString,
} from "./date-utils";
import { validateTenant } from "@/lib/inbox/database";

export interface GetBusinessAnalyticsOptions {
  client?: any;
  userId?: string;
}

/**
 * Fetch complete analytics and business reporting data for a specific business tenant.
 * Guarantees 100% strict tenant isolation: Gokul's Astrological Insights and Gokul Vivaham
 * data are NEVER combined.
 */
export async function getBusinessAnalytics(
  businessId: string,
  businessSlug: BusinessSlug,
  dateRange: DateRangeFilter,
  options: GetBusinessAnalyticsOptions = {}
): Promise<AnalyticsDashboardData> {
  // 1. Strict Tenant & Membership Validation
  await validateTenant(businessId, options);

  let supabase = options.client;
  if (!supabase && isSupabaseConfigured()) {
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      // Running outside request context
    }
  }

  const businessName =
    businessSlug === "astrology"
      ? "Gokul's Astrological Insights"
      : "Gokul Vivaham";

  // If Supabase client is not available (e.g. offline unit test), return zero baseline
  if (!supabase) {
    return buildEmptyAnalyticsData(businessId, businessSlug, businessName, dateRange);
  }

  try {
    // 2. Attempt High-Performance Server-Side SQL Aggregation RPC
    const { data: rpcSummary, error: rpcError } = await supabase.rpc(
      "get_business_analytics_summary",
      {
        p_business_id: businessId,
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
      }
    );

    const { data: rpcDailyTrends } = await supabase.rpc(
      "get_business_analytics_daily_trends",
      {
        p_business_id: businessId,
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate,
      }
    );

    if (!rpcError && rpcSummary) {
      // RPC succeeded — compute rates and business-specific categorization
      return await assembleAnalyticsFromRpc(
        businessId,
        businessSlug,
        businessName,
        dateRange,
        rpcSummary,
        rpcDailyTrends,
        supabase
      );
    }
  } catch {
    // Fall back to direct table queries
  }

  // 3. Resilient Fallback: Direct Table Queries (Indexed, Server-Side, Tenant-Scoped)
  return await assembleAnalyticsFromTables(
    businessId,
    businessSlug,
    businessName,
    dateRange,
    supabase
  );
}

/**
 * Build empty / zero analytics structure with accurate dates and meaningful empty states.
 */
export function buildEmptyAnalyticsData(
  businessId: string,
  businessSlug: BusinessSlug,
  businessName: string,
  dateRange: DateRangeFilter
): AnalyticsDashboardData {
  const buckets = generateDateBuckets(dateRange.startDate, dateRange.endDate);
  const dailyTrends: DailyTrendPoint[] = buckets.map((date) => ({
    date,
    inbound: 0,
    outbound: 0,
    total: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    newContacts: 0,
  }));

  const messaging: MessagingAnalytics = {
    totalInbound: 0,
    totalOutbound: 0,
    totalMessages: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    pending: 0,
    deliveryRatePercent: 0,
    readRatePercent: 0,
  };

  const contacts: ContactAnalytics = {
    totalContacts: 0,
    newContacts: 0,
    activeContacts: 0,
    inactiveContacts: 0,
    optedOutContacts: 0,
    convertedLeadsCount: 0,
    hasRecordedConversionData: false,
    conversionRatePercent: 0,
    sources: [],
  };

  const inbox: InboxAnalytics = {
    totalConversations: 0,
    openConversations: 0,
    pendingHumanHandovers: 0,
    closedConversations: 0,
    unreadConversations: 0,
    averageFirstResponseTimeSeconds: null,
    averageFirstResponseTimeFormatted: "N/A",
  };

  const automation: AutomationAnalytics = {
    totalRules: 0,
    activeRules: 0,
    inactiveRules: 0,
    executedJobs: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    skippedExecutions: 0,
    successRatePercent: 0,
    failureReasons: [],
    rulePerformance: [],
    followUpStats: {
      totalScheduled: 0,
      executed: 0,
      pending: 0,
      failed: 0,
    },
  };

  const businessReport = buildBusinessReport(businessSlug, [], []);

  return {
    businessId,
    businessSlug,
    businessName,
    dateRange,
    messaging,
    contacts,
    inbox,
    automation,
    businessReport,
    dailyTrends,
    generatedAtIst: formatKolkataDate(new Date()),
  };
}

/**
 * Assemble analytics from RPC output + business-specific enquiries categorization.
 */
async function assembleAnalyticsFromRpc(
  businessId: string,
  businessSlug: BusinessSlug,
  businessName: string,
  dateRange: DateRangeFilter,
  rpcSummary: any,
  rpcDailyTrends: any,
  supabase: any
): Promise<AnalyticsDashboardData> {
  const m = rpcSummary.messaging || {};
  const c = rpcSummary.contacts || {};
  const conv = rpcSummary.conversations || {};
  const a = rpcSummary.automations || {};

  const totalInbound = Number(m.total_inbound) || 0;
  const totalOutbound = Number(m.total_outbound) || 0;
  const totalMessages = totalInbound + totalOutbound;
  const delivered = Number(m.delivered) || 0;
  const read = Number(m.read) || 0;
  const failed = Number(m.failed) || 0;
  const pending = Number(m.pending) || 0;

  const deliveryRatePercent =
    totalOutbound > 0 ? Math.min(100, Math.round((delivered / totalOutbound) * 1000) / 10) : 0;
  const readRatePercent =
    delivered > 0 ? Math.min(100, Math.round((read / delivered) * 1000) / 10) : 0;

  const messaging: MessagingAnalytics = {
    totalInbound,
    totalOutbound,
    totalMessages,
    delivered,
    read,
    failed,
    pending,
    deliveryRatePercent,
    readRatePercent,
  };

  const totalContacts = Number(c.total_contacts) || 0;
  const newContacts = Number(c.new_contacts) || 0;
  const activeContacts = Number(c.active_contacts) || 0;
  const inactiveContacts = Math.max(0, totalContacts - activeContacts);
  const optedOutContacts = Number(c.opted_out_contacts) || 0;

  // Retrieve contact metadata for source acquisition and conversion checks
  const { data: contactsData } = await supabase
    .from("wa_contacts")
    .select("id, metadata, created_at, total_inbound_count")
    .eq("business_id", businessId);

  const { sources, convertedLeadsCount, hasRecordedConversionData } =
    analyzeContactsMetadata(contactsData || []);

  const contacts: ContactAnalytics = {
    totalContacts,
    newContacts,
    activeContacts,
    inactiveContacts,
    optedOutContacts,
    convertedLeadsCount,
    hasRecordedConversionData,
    conversionRatePercent:
      totalContacts > 0
        ? Math.min(100, Math.round((convertedLeadsCount / totalContacts) * 1000) / 10)
        : 0,
    sources,
  };

  const avgSeconds =
    rpcSummary.avg_first_response_seconds !== null && rpcSummary.avg_first_response_seconds !== undefined
      ? Number(rpcSummary.avg_first_response_seconds)
      : null;

  const inbox: InboxAnalytics = {
    totalConversations: Number(conv.total_conversations) || 0,
    openConversations: Number(conv.open_conversations) || 0,
    pendingHumanHandovers: Number(conv.pending_human) || 0,
    closedConversations: Number(conv.closed_conversations) || 0,
    unreadConversations: Number(conv.unread_conversations) || 0,
    averageFirstResponseTimeSeconds: avgSeconds,
    averageFirstResponseTimeFormatted: formatDuration(avgSeconds),
  };

  // Automation stats
  const executedJobs = Number(a.executed_jobs) || 0;
  const successfulExecutions = Number(a.successful_executions) || 0;
  const failedExecutions = Number(a.failed_executions) || 0;
  const skippedExecutions = Number(a.skipped_executions) || 0;
  const successRatePercent =
    executedJobs > 0
      ? Math.min(100, Math.round((successfulExecutions / executedJobs) * 1000) / 10)
      : 0;

  // Retrieve rule performance and failure reasons
  const { rulePerformance, failureReasons, followUpStats } = await getAutomationDetails(
    businessId,
    dateRange,
    supabase
  );

  const automation: AutomationAnalytics = {
    totalRules: Number(a.total_rules) || 0,
    activeRules: Number(a.active_rules) || 0,
    inactiveRules: Number(a.inactive_rules) || 0,
    executedJobs,
    successfulExecutions,
    failedExecutions,
    skippedExecutions,
    successRatePercent,
    failureReasons,
    rulePerformance,
    followUpStats,
  };

  // Retrieve conversations and recent messages for business-specific enquiry reporting
  const { data: convsData } = await supabase
    .from("wa_conversations")
    .select("id, status, last_message_preview, created_at, unread_count")
    .eq("business_id", businessId);

  const { data: msgsData } = await supabase
    .from("wa_messages")
    .select("id, content, direction, created_at, status")
    .eq("business_id", businessId)
    .gte("created_at", dateRange.startDate)
    .lte("created_at", dateRange.endDate);

  const businessReport = buildBusinessReport(businessSlug, convsData || [], msgsData || []);

  // Format daily trends
  let dailyTrends: DailyTrendPoint[] = [];
  if (Array.isArray(rpcDailyTrends) && rpcDailyTrends.length > 0) {
    dailyTrends = rpcDailyTrends.map((d: any) => ({
      date: d.date,
      inbound: Number(d.inbound) || 0,
      outbound: Number(d.outbound) || 0,
      total: Number(d.total) || 0,
      delivered: Number(d.delivered) || 0,
      read: Number(d.read) || 0,
      failed: Number(d.failed) || 0,
      newContacts: Number(d.new_contacts) || 0,
    }));
  } else {
    // Fill empty buckets
    const buckets = generateDateBuckets(dateRange.startDate, dateRange.endDate);
    dailyTrends = buckets.map((date) => ({
      date,
      inbound: 0,
      outbound: 0,
      total: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      newContacts: 0,
    }));
  }

  return {
    businessId,
    businessSlug,
    businessName,
    dateRange,
    messaging,
    contacts,
    inbox,
    automation,
    businessReport,
    dailyTrends,
    generatedAtIst: formatKolkataDate(new Date()),
  };
}

/**
 * Resilient fallback: direct Supabase table queries with server-side filters.
 */
async function assembleAnalyticsFromTables(
  businessId: string,
  businessSlug: BusinessSlug,
  businessName: string,
  dateRange: DateRangeFilter,
  supabase: any
): Promise<AnalyticsDashboardData> {
  // A. Messaging queries
  const { data: messages } = await supabase
    .from("wa_messages")
    .select("id, direction, status, created_at, content, conversation_id")
    .eq("business_id", businessId)
    .gte("created_at", dateRange.startDate)
    .lte("created_at", dateRange.endDate);

  const msgList = messages || [];
  let totalInbound = 0;
  let totalOutbound = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;
  let pending = 0;

  const dateBuckets = generateDateBuckets(dateRange.startDate, dateRange.endDate);
  const dailyMap = new Map<string, DailyTrendPoint>();
  for (const d of dateBuckets) {
    dailyMap.set(d, {
      date: d,
      inbound: 0,
      outbound: 0,
      total: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      newContacts: 0,
    });
  }

  for (const m of msgList) {
    const dStr = toKolkataDateString(m.created_at);
    const day = dailyMap.get(dStr);

    if (m.direction === "inbound") {
      totalInbound++;
      if (day) day.inbound++;
    } else {
      totalOutbound++;
      if (day) day.outbound++;
      if (m.status === "read") {
        read++;
        delivered++; // read implies delivered
        if (day) {
          day.read++;
          day.delivered++;
        }
      } else if (m.status === "delivered") {
        delivered++;
        if (day) day.delivered++;
      } else if (m.status === "failed") {
        failed++;
        if (day) day.failed++;
      } else if (m.status === "pending" || m.status === "sent") {
        pending++;
      }
    }
    if (day) day.total++;
  }

  const deliveryRatePercent =
    totalOutbound > 0 ? Math.min(100, Math.round((delivered / totalOutbound) * 1000) / 10) : 0;
  const readRatePercent =
    delivered > 0 ? Math.min(100, Math.round((read / delivered) * 1000) / 10) : 0;

  const messaging: MessagingAnalytics = {
    totalInbound,
    totalOutbound,
    totalMessages: totalInbound + totalOutbound,
    delivered,
    read,
    failed,
    pending,
    deliveryRatePercent,
    readRatePercent,
  };

  // B. Contact queries
  const { data: allContacts } = await supabase
    .from("wa_contacts")
    .select("id, metadata, created_at, total_inbound_count, is_opted_out")
    .eq("business_id", businessId);

  const contactList = allContacts || [];
  const totalContacts = contactList.length;
  let newContacts = 0;
  let activeContacts = 0;
  let optedOutContacts = 0;

  const startMillis = new Date(dateRange.startDate).getTime();
  const endMillis = new Date(dateRange.endDate).getTime();

  for (const c of contactList) {
    const cMillis = new Date(c.created_at).getTime();
    if (cMillis >= startMillis && cMillis <= endMillis) {
      newContacts++;
      const dStr = toKolkataDateString(c.created_at);
      const day = dailyMap.get(dStr);
      if (day) day.newContacts++;
    }
    if (c.total_inbound_count > 0) {
      activeContacts++;
    }
    if (c.is_opted_out) {
      optedOutContacts++;
    }
  }

  const { sources, convertedLeadsCount, hasRecordedConversionData } =
    analyzeContactsMetadata(contactList);

  const contacts: ContactAnalytics = {
    totalContacts,
    newContacts,
    activeContacts,
    inactiveContacts: Math.max(0, totalContacts - activeContacts),
    optedOutContacts,
    convertedLeadsCount,
    hasRecordedConversionData,
    conversionRatePercent:
      totalContacts > 0
        ? Math.min(100, Math.round((convertedLeadsCount / totalContacts) * 1000) / 10)
        : 0,
    sources,
  };

  // C. Conversation queries
  const { data: conversations } = await supabase
    .from("wa_conversations")
    .select("id, status, unread_count, last_message_preview, created_at")
    .eq("business_id", businessId);

  const convList = conversations || [];
  let openConversations = 0;
  let pendingHumanHandovers = 0;
  let closedConversations = 0;
  let unreadConversations = 0;

  for (const c of convList) {
    if (c.status === "open") openConversations++;
    else if (c.status === "pending_human") pendingHumanHandovers++;
    else if (c.status === "closed") closedConversations++;
    if (c.unread_count > 0) unreadConversations++;
  }

  // Calculate average first response time where timestamps support it
  const avgResponseSecs = calculateFirstResponseTime(msgList);

  const inbox: InboxAnalytics = {
    totalConversations: convList.length,
    openConversations,
    pendingHumanHandovers,
    closedConversations,
    unreadConversations,
    averageFirstResponseTimeSeconds: avgResponseSecs,
    averageFirstResponseTimeFormatted: formatDuration(avgResponseSecs),
  };

  // D. Automation queries
  const { data: rules } = await supabase
    .from("wa_automation_rules")
    .select("id, name, trigger_type, is_active")
    .eq("business_id", businessId);

  const ruleList = rules || [];
  const totalRules = ruleList.length;
  const activeRules = ruleList.filter((r: any) => r.is_active).length;
  const inactiveRules = totalRules - activeRules;

  const { rulePerformance, failureReasons, followUpStats } = await getAutomationDetails(
    businessId,
    dateRange,
    supabase
  );

  let executedJobs = 0;
  let successfulExecutions = 0;
  let failedExecutions = 0;
  let skippedExecutions = 0;

  for (const rp of rulePerformance) {
    executedJobs += rp.executions;
    successfulExecutions += rp.successCount;
    failedExecutions += rp.failureCount;
    skippedExecutions += rp.skippedCount;
  }

  const automation: AutomationAnalytics = {
    totalRules,
    activeRules,
    inactiveRules,
    executedJobs,
    successfulExecutions,
    failedExecutions,
    skippedExecutions,
    successRatePercent:
      executedJobs > 0
        ? Math.min(100, Math.round((successfulExecutions / executedJobs) * 1000) / 10)
        : 0,
    failureReasons,
    rulePerformance,
    followUpStats,
  };

  // E. Business Specific Report
  const businessReport = buildBusinessReport(businessSlug, convList, msgList);

  return {
    businessId,
    businessSlug,
    businessName,
    dateRange,
    messaging,
    contacts,
    inbox,
    automation,
    businessReport,
    dailyTrends: Array.from(dailyMap.values()),
    generatedAtIst: formatKolkataDate(new Date()),
  };
}

/**
 * Analyzes contact metadata to determine acquisition source and conversion flags.
 * Never invents revenue or conversions if not recorded in database.
 */
function analyzeContactsMetadata(contacts: any[]): {
  sources: { source: string; count: number; percentage: number }[];
  convertedLeadsCount: number;
  hasRecordedConversionData: boolean;
} {
  const sourceCountMap = new Map<string, number>();
  let convertedCount = 0;
  let hasExplicitConversionRecord = false;

  for (const c of contacts) {
    const meta = c.metadata || {};
    // Check acquisition source
    const rawSource =
      meta.source || meta.acquisition_source || meta.channel || "WhatsApp Direct Inbound";
    const src = String(rawSource).trim();
    sourceCountMap.set(src, (sourceCountMap.get(src) || 0) + 1);

    // Check if recorded customer conversion exists
    if (
      meta.is_customer === true ||
      meta.status === "customer" ||
      meta.status === "member" ||
      meta.converted === true ||
      meta.is_active_member === true
    ) {
      convertedCount++;
      hasExplicitConversionRecord = true;
    }
  }

  const total = contacts.length;
  const sources = Array.from(sourceCountMap.entries()).map(([source, count]) => ({
    source,
    count,
    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));

  return {
    sources,
    convertedLeadsCount: convertedCount,
    hasRecordedConversionData: hasExplicitConversionRecord,
  };
}

/**
 * Compute average first response time in seconds across conversations.
 */
function calculateFirstResponseTime(messages: any[]): number | null {
  const convMap = new Map<string, { firstInbound?: number; firstOutboundAfterInbound?: number }>();

  // Sort chronologically
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  for (const m of sorted) {
    const convId = m.conversation_id;
    if (!convId) continue;
    let entry = convMap.get(convId);
    if (!entry) {
      entry = {};
      convMap.set(convId, entry);
    }

    const t = new Date(m.created_at).getTime();
    if (m.direction === "inbound" && !entry.firstInbound) {
      entry.firstInbound = t;
    } else if (m.direction === "outbound" && entry.firstInbound && !entry.firstOutboundAfterInbound) {
      if (t >= entry.firstInbound) {
        entry.firstOutboundAfterInbound = t;
      }
    }
  }

  const durations: number[] = [];
  for (const entry of convMap.values()) {
    if (entry.firstInbound && entry.firstOutboundAfterInbound) {
      const diffSecs = (entry.firstOutboundAfterInbound - entry.firstInbound) / 1000;
      if (diffSecs >= 0) {
        durations.push(diffSecs);
      }
    }
  }

  if (durations.length === 0) return null;
  const sum = durations.reduce((acc, d) => acc + d, 0);
  return Math.round(sum / durations.length);
}

/**
 * Retrieve automation rule execution breakdown and follow-up stats.
 */
async function getAutomationDetails(
  businessId: string,
  dateRange: DateRangeFilter,
  supabase: any
): Promise<{
  rulePerformance: any[];
  failureReasons: any[];
  followUpStats: any;
}> {
  // Retrieve execution logs
  const { data: logs } = await supabase
    .from("wa_automation_execution_logs")
    .select("id, rule_id, status, skip_reason, error_message, created_at")
    .eq("business_id", businessId)
    .gte("created_at", dateRange.startDate)
    .lte("created_at", dateRange.endDate);

  const { data: rules } = await supabase
    .from("wa_automation_rules")
    .select("id, name, trigger_type, is_active")
    .eq("business_id", businessId);

  const logList = logs || [];
  const ruleList = rules || [];

  const ruleMap = new Map<string, { ruleName: string; triggerType: string; isActive: boolean; exec: number; succ: number; fail: number; skip: number }>();
  for (const r of ruleList) {
    ruleMap.set(r.id, {
      ruleName: r.name,
      triggerType: r.trigger_type,
      isActive: r.is_active,
      exec: 0,
      succ: 0,
      fail: 0,
      skip: 0,
    });
  }

  const failureReasonMap = new Map<string, number>();

  for (const log of logList) {
    const rId = log.rule_id;
    let rEntry = rId ? ruleMap.get(rId) : undefined;
    if (!rEntry && rId) {
      rEntry = {
        ruleName: "System Automation Rule",
        triggerType: "custom",
        isActive: false,
        exec: 0,
        succ: 0,
        fail: 0,
        skip: 0,
      };
      ruleMap.set(rId, rEntry);
    }

    if (rEntry) {
      rEntry.exec++;
      if (log.status === "success") rEntry.succ++;
      else if (log.status === "failed") rEntry.fail++;
      else if (log.status === "skipped") rEntry.skip++;
    }

    if (log.status === "failed") {
      const reason = log.error_message || "Execution Error";
      failureReasonMap.set(reason, (failureReasonMap.get(reason) || 0) + 1);
    } else if (log.status === "skipped" && log.skip_reason) {
      failureReasonMap.set(log.skip_reason, (failureReasonMap.get(log.skip_reason) || 0) + 1);
    }
  }

  const totalFailedOrSkipped = Array.from(failureReasonMap.values()).reduce((a, b) => a + b, 0);
  const failureReasons = Array.from(failureReasonMap.entries()).map(([reason, count]) => ({
    reason,
    count,
    percentage: totalFailedOrSkipped > 0 ? Math.round((count / totalFailedOrSkipped) * 1000) / 10 : 0,
  }));

  const rulePerformance = Array.from(ruleMap.entries()).map(([ruleId, stats]) => ({
    ruleId,
    ruleName: stats.ruleName,
    triggerType: stats.triggerType,
    executions: stats.exec,
    successCount: stats.succ,
    failureCount: stats.fail,
    skippedCount: stats.skip,
    successRatePercent: stats.exec > 0 ? Math.round((stats.succ / stats.exec) * 1000) / 10 : 0,
    isActive: stats.isActive,
  }));

  // Follow-up execution stats from wa_processing_jobs
  const { data: followupJobs } = await supabase
    .from("wa_processing_jobs")
    .select("id, status")
    .eq("business_id", businessId)
    .eq("job_type", "scheduled_followup");

  const jobsList = followupJobs || [];
  const followUpStats = {
    totalScheduled: jobsList.length,
    executed: jobsList.filter((j: any) => j.status === "completed").length,
    pending: jobsList.filter((j: any) => j.status === "pending" || j.status === "processing").length,
    failed: jobsList.filter((j: any) => j.status === "failed").length,
  };

  return { rulePerformance, failureReasons, followUpStats };
}

/**
 * Builds business-specific enquiry reports strictly based on actual recorded messages/conversations.
 * Never invents revenue or conversion numbers where no records exist.
 */
function buildBusinessReport(
  businessSlug: BusinessSlug,
  conversations: any[],
  messages: any[]
): AstrologyBusinessReport | VivahamBusinessReport {
  // Aggregate text contents to search for keywords
  const textCorpus = messages
    .map((m) => {
      if (typeof m.content === "string") return m.content;
      if (m.content?.text) return m.content.text;
      if (m.content?.body) return m.content.body;
      return "";
    })
    .concat(conversations.map((c) => c.last_message_preview || ""));

  if (businessSlug === "astrology") {
    // 1. Astrology Enquiries
    let astrologyCount = 0;
    let consultationCount = 0;
    let horoscopeMatchingCount = 0;
    let numerologyCount = 0;

    for (const text of textCorpus) {
      const lower = text.toLowerCase();
      if (/astrolog|kp|vedic|prasanna|ஜோதிடம்|ராசி/i.test(lower)) astrologyCount++;
      if (/consult|book|appointment|timing|ஆலோசனை/i.test(lower)) consultationCount++;
      if (/match|horoscope|jathaga|chart|kundali|பொருத்தம்|ஜாதகம்/i.test(lower)) horoscopeMatchingCount++;
      if (/numerolog|number|name|எண் கணிதம்/i.test(lower)) numerologyCount++;
    }

    const totalCategorized = astrologyCount + consultationCount + horoscopeMatchingCount + numerologyCount || 1;

    const breakdown = [
      {
        category: "astrology_general",
        label: "General Astrology Enquiries",
        count: astrologyCount,
        percentage: Math.round((astrologyCount / totalCategorized) * 1000) / 10,
        description: "Inquiries regarding Vedic & KP astrological charts, planetary positions and general readings.",
      },
      {
        category: "consultation",
        label: "Consultation & Booking Enquiries",
        count: consultationCount,
        percentage: Math.round((consultationCount / totalCategorized) * 1000) / 10,
        description: "Requests for direct consultation appointments and time slots.",
      },
      {
        category: "horoscope_matching",
        label: "Horoscope & Marriage Matching",
        count: horoscopeMatchingCount,
        percentage: Math.round((horoscopeMatchingCount / totalCategorized) * 1000) / 10,
        description: "Birth chart compatibility analysis for marriage and auspicious dates.",
      },
      {
        category: "numerology",
        label: "Numerology & Name Corrections",
        count: numerologyCount,
        percentage: Math.round((numerologyCount / totalCategorized) * 1000) / 10,
        description: "Name numerology and auspicious number requests.",
      },
    ];

    const pendingFollowups = conversations.filter((c) => c.status === "pending_human").length;
    const closedCount = conversations.filter((c) => c.status === "closed").length;

    return {
      businessType: "astrology",
      astrologyEnquiries: astrologyCount,
      consultationEnquiries: consultationCount,
      horoscopeMatchingEnquiries: horoscopeMatchingCount,
      numerologyEnquiries: numerologyCount,
      followUpStatus: {
        scheduled: 0,
        pending: pendingFollowups,
        completed: closedCount,
      },
      customerConversion: {
        recordedCustomers: 0,
        hasRecordedData: false,
        note: "No consultation fee or revenue records are tracked in messaging tables. Values reflect zero to prevent data invention.",
      },
      breakdown,
    };
  } else {
    // 2. Vivaham Enquiries
    let matrimonyCount = 0;
    let groomCount = 0;
    let brideCount = 0;
    let membershipPlanCount = 0;
    let registrationCount = 0;

    for (const text of textCorpus) {
      const lower = text.toLowerCase();
      if (/matrimon|vivaham|thirumanam|திருமணம்|கல்யாணம்/i.test(lower)) matrimonyCount++;
      if (/groom|boy|man|male|வரன்.*ஆண்|மாப்பிள்ளை/i.test(lower)) groomCount++;
      if (/bride|girl|woman|female|வரன்.*பெண்|மணமகள்/i.test(lower)) brideCount++;
      if (/plan|member|premium|subscription|fee|கட்டணம்/i.test(lower)) membershipPlanCount++;
      if (/regist|sign.*up|profile|பதிவு/i.test(lower)) registrationCount++;
    }

    const totalCategorized =
      matrimonyCount + groomCount + brideCount + membershipPlanCount + registrationCount || 1;

    const breakdown = [
      {
        category: "matrimony_general",
        label: "Matrimony Enquiries",
        count: matrimonyCount,
        percentage: Math.round((matrimonyCount / totalCategorized) * 1000) / 10,
        description: "General Tamil matrimony service questions and profile requests.",
      },
      {
        category: "groom_enquiries",
        label: "Groom (ஆண் வரன்) Enquiries",
        count: groomCount,
        percentage: Math.round((groomCount / totalCategorized) * 1000) / 10,
        description: "Enquiries seeking suitable bride matches for male profiles.",
      },
      {
        category: "bride_enquiries",
        label: "Bride (பெண் வரன்) Enquiries",
        count: brideCount,
        percentage: Math.round((brideCount / totalCategorized) * 1000) / 10,
        description: "Enquiries seeking suitable groom matches for female profiles.",
      },
      {
        category: "membership_plans",
        label: "Membership & Premium Plans",
        count: membershipPlanCount,
        percentage: Math.round((membershipPlanCount / totalCategorized) * 1000) / 10,
        description: "Pricing, duration, and premium package feature questions.",
      },
      {
        category: "registration",
        label: "Registration & Profile Follow-ups",
        count: registrationCount,
        percentage: Math.round((registrationCount / totalCategorized) * 1000) / 10,
        description: "Assistance with photo uploads, horoscope attachment, and profile verification.",
      },
    ];

    const pendingFollowups = conversations.filter((c) => c.status === "pending_human").length;

    return {
      businessType: "vivaham",
      matrimonyEnquiries: matrimonyCount,
      groomEnquiries: groomCount,
      brideEnquiries: brideCount,
      membershipPlanEnquiries: membershipPlanCount,
      registrationFollowUps: registrationCount,
      activeMembers: conversations.length,
      leadConversion: {
        recordedMembers: 0,
        hasRecordedData: false,
        note: "No paid membership transaction data is recorded in messaging tables. Values reflect zero without assumption.",
      },
      breakdown,
    };
  }
}

/**
 * Generate an RFC 4180-compliant CSV string representing the filtered analytics report.
 */
export function exportAnalyticsCsv(
  data: AnalyticsDashboardData,
  businessName: string
): string {
  const lines: string[] = [];

  const escapeCsv = (str: string | number | null | undefined): string => {
    if (str === null || str === undefined) return '""';
    let s = String(str);
    const trimmed = s.trimStart();
    if (trimmed.length > 0) {
      const first = trimmed[0];
      if (first === "=" || first === "@" || first === "\t" || first === "\r") {
        s = "'" + s;
      } else if (first === "+" || first === "-") {
        const isPureNumber = /^[+-]?\d+(\.\d+)?$/.test(trimmed);
        const isStandardPhone = /^\+\d[\d\s\-()]{6,16}$/.test(trimmed);
        if (!isPureNumber && !isStandardPhone) {
          s = "'" + s;
        }
      }
    }
    return `"${s.replace(/"/g, '""')}"`;
  };

  // Header Metadata
  lines.push(`${escapeCsv("GOKUL CONNECT — BUSINESS ANALYTICS REPORT")}`);
  lines.push(`${escapeCsv("Business Name")},${escapeCsv(businessName)}`);
  lines.push(`${escapeCsv("Business Slug")},${escapeCsv(data.businessSlug)}`);
  lines.push(`${escapeCsv("Filter Preset")},${escapeCsv(data.dateRange.label)}`);
  lines.push(
    `${escapeCsv("Date Range (Asia/Kolkata)")},${escapeCsv(
      `${data.dateRange.istStartFormatted} to ${data.dateRange.istEndFormatted}`
    )}`
  );
  lines.push(`${escapeCsv("Timezone")},${escapeCsv("Asia/Kolkata (IST, UTC+05:30)")}`);
  lines.push(`${escapeCsv("Generated At")},${escapeCsv(data.generatedAtIst)}`);
  lines.push("");

  // Executive Summary Metrics
  lines.push(`${escapeCsv("EXECUTIVE SUMMARY METRICS")}`);
  lines.push(`${escapeCsv("Metric")},${escapeCsv("Value")},${escapeCsv("Unit / Description")}`);
  lines.push(`${escapeCsv("Total Inbound Messages")},${escapeCsv(data.messaging.totalInbound)},${escapeCsv("Count")}`);
  lines.push(`${escapeCsv("Total Outbound Messages")},${escapeCsv(data.messaging.totalOutbound)},${escapeCsv("Count")}`);
  lines.push(`${escapeCsv("Total Messages")},${escapeCsv(data.messaging.totalMessages)},${escapeCsv("Count")}`);
  lines.push(`${escapeCsv("Delivered Messages")},${escapeCsv(data.messaging.delivered)},${escapeCsv("Count")}`);
  lines.push(`${escapeCsv("Read Messages")},${escapeCsv(data.messaging.read)},${escapeCsv("Count")}`);
  lines.push(`${escapeCsv("Failed Messages")},${escapeCsv(data.messaging.failed)},${escapeCsv("Count")}`);
  lines.push(`${escapeCsv("Pending Messages")},${escapeCsv(data.messaging.pending)},${escapeCsv("Count")}`);
  lines.push(`${escapeCsv("Delivery Rate")},${escapeCsv(`${data.messaging.deliveryRatePercent}%`)},${escapeCsv("Delivered + Read / Outbound")}`);
  lines.push(`${escapeCsv("Read Rate")},${escapeCsv(`${data.messaging.readRatePercent}%`)},${escapeCsv("Read / Delivered")}`);
  lines.push(`${escapeCsv("Total Contacts")},${escapeCsv(data.contacts.totalContacts)},${escapeCsv("Registered Contacts")}`);
  lines.push(`${escapeCsv("New Contacts in Period")},${escapeCsv(data.contacts.newContacts)},${escapeCsv("Acquired in Filter Range")}`);
  lines.push(`${escapeCsv("Active Contacts")},${escapeCsv(data.contacts.activeContacts)},${escapeCsv("Contacts with Interactions")}`);
  lines.push(`${escapeCsv("Inactive Contacts")},${escapeCsv(data.contacts.inactiveContacts)},${escapeCsv("No Recent Inbound")}`);
  lines.push(`${escapeCsv("Total Conversations")},${escapeCsv(data.inbox.totalConversations)},${escapeCsv("Threads")}`);
  lines.push(`${escapeCsv("Open Conversations")},${escapeCsv(data.inbox.openConversations)},${escapeCsv("Active Threads")}`);
  lines.push(`${escapeCsv("Pending Human Handover")},${escapeCsv(data.inbox.pendingHumanHandovers)},${escapeCsv("Awaiting Agent Takeover")}`);
  lines.push(`${escapeCsv("Closed Conversations")},${escapeCsv(data.inbox.closedConversations)},${escapeCsv("Resolved")}`);
  lines.push(`${escapeCsv("Unread Conversations")},${escapeCsv(data.inbox.unreadConversations)},${escapeCsv("Unread Badge")}`);
  lines.push(`${escapeCsv("Average First Response Time")},${escapeCsv(data.inbox.averageFirstResponseTimeFormatted)},${escapeCsv("Calculated from message timestamps")}`);
  lines.push(`${escapeCsv("Total Automation Rules")},${escapeCsv(data.automation.totalRules)},${escapeCsv("Configured Rules")}`);
  lines.push(`${escapeCsv("Active Automation Rules")},${escapeCsv(data.automation.activeRules)},${escapeCsv("Active Rules (Rules default inactive)")}`);
  lines.push(`${escapeCsv("Executed Automation Jobs")},${escapeCsv(data.automation.executedJobs)},${escapeCsv("Logged Executions")}`);
  lines.push(`${escapeCsv("Successful Automation Executions")},${escapeCsv(data.automation.successfulExecutions)},${escapeCsv("Status: Success")}`);
  lines.push(`${escapeCsv("Failed Automation Executions")},${escapeCsv(data.automation.failedExecutions)},${escapeCsv("Status: Failed")}`);
  lines.push(`${escapeCsv("Skipped Automation Executions")},${escapeCsv(data.automation.skippedExecutions)},${escapeCsv("Status: Skipped")}`);
  lines.push("");

  // Daily Trends
  lines.push(`${escapeCsv("DAILY MESSAGE & CONTACT TRENDS (Asia/Kolkata)")}`);
  lines.push(
    `${escapeCsv("Date (IST)")},${escapeCsv("Inbound")},${escapeCsv("Outbound")},${escapeCsv(
      "Total Messages"
    )},${escapeCsv("Delivered")},${escapeCsv("Read")},${escapeCsv("Failed")},${escapeCsv(
      "New Contacts"
    )}`
  );
  for (const day of data.dailyTrends) {
    lines.push(
      `${escapeCsv(day.date)},${escapeCsv(day.inbound)},${escapeCsv(day.outbound)},${escapeCsv(
        day.total
      )},${escapeCsv(day.delivered)},${escapeCsv(day.read)},${escapeCsv(day.failed)},${escapeCsv(
        day.newContacts
      )}`
    );
  }
  lines.push("");

  // Business-Specific Enquiry Breakdown
  lines.push(`${escapeCsv("BUSINESS ENQUIRY CATEGORIZATION")}`);
  lines.push(
    `${escapeCsv("Category")},${escapeCsv("Enquiry Type")},${escapeCsv("Count")},${escapeCsv(
      "Share %"
    )},${escapeCsv("Description")}`
  );
  for (const item of data.businessReport.breakdown) {
    lines.push(
      `${escapeCsv(item.category)},${escapeCsv(item.label)},${escapeCsv(item.count)},${escapeCsv(
        `${item.percentage}%`
      )},${escapeCsv(item.description)}`
    );
  }
  lines.push("");

  // Contact Acquisition Sources
  lines.push(`${escapeCsv("CONTACT ACQUISITION SOURCES")}`);
  lines.push(`${escapeCsv("Source")},${escapeCsv("Count")},${escapeCsv("Percentage")}`);
  if (data.contacts.sources.length === 0) {
    lines.push(`${escapeCsv("No sources recorded")},${escapeCsv(0)},${escapeCsv("0%")}`);
  } else {
    for (const src of data.contacts.sources) {
      lines.push(`${escapeCsv(src.source)},${escapeCsv(src.count)},${escapeCsv(`${src.percentage}%`)}`);
    }
  }

  return lines.join("\r\n");
}
