import { BusinessSlug } from "@/types/database";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "previous_month"
  | "custom";

export interface DateRangeFilter {
  preset: DateRangePreset;
  startDate: string; // ISO 8601 UTC string
  endDate: string;   // ISO 8601 UTC string
  timezone: "Asia/Kolkata";
  label: string;
  istStartFormatted: string;
  istEndFormatted: string;
}

export interface MessagingAnalytics {
  totalInbound: number;
  totalOutbound: number;
  totalMessages: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  deliveryRatePercent: number; // (delivered + read) / totalOutbound * 100
  readRatePercent: number;     // read / (delivered + read) * 100
}

export interface ContactSourceAcquisition {
  source: string;
  count: number;
  percentage: number;
}

export interface ContactAnalytics {
  totalContacts: number;
  newContacts: number;
  activeContacts: number;
  inactiveContacts: number;
  optedOutContacts: number;
  convertedLeadsCount: number; // only when supported by recorded data
  hasRecordedConversionData: boolean;
  conversionRatePercent: number;
  sources: ContactSourceAcquisition[];
}

export interface InboxAnalytics {
  totalConversations: number;
  openConversations: number;
  pendingHumanHandovers: number;
  closedConversations: number;
  unreadConversations: number;
  averageFirstResponseTimeSeconds: number | null;
  averageFirstResponseTimeFormatted: string; // e.g. "3m 42s" or "N/A"
}

export interface RulePerformanceStat {
  ruleId: string;
  ruleName: string;
  triggerType: string;
  executions: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  successRatePercent: number;
  isActive: boolean;
}

export interface AutomationFailureReason {
  reason: string;
  count: number;
  percentage: number;
}

export interface FollowUpExecutionStats {
  totalScheduled: number;
  executed: number;
  pending: number;
  failed: number;
}

export interface AutomationAnalytics {
  totalRules: number;
  activeRules: number;
  inactiveRules: number;
  executedJobs: number;
  successfulExecutions: number;
  failedExecutions: number;
  skippedExecutions: number;
  successRatePercent: number;
  failureReasons: AutomationFailureReason[];
  rulePerformance: RulePerformanceStat[];
  followUpStats: FollowUpExecutionStats;
}

export interface BusinessEnquiryItem {
  category: string;
  label: string;
  count: number;
  percentage: number;
  description: string;
}

export interface AstrologyBusinessReport {
  businessType: "astrology";
  astrologyEnquiries: number;
  consultationEnquiries: number;
  horoscopeMatchingEnquiries: number;
  numerologyEnquiries: number;
  followUpStatus: {
    scheduled: number;
    pending: number;
    completed: number;
  };
  customerConversion: {
    recordedCustomers: number;
    hasRecordedData: boolean;
    note: string;
  };
  breakdown: BusinessEnquiryItem[];
}

export interface VivahamBusinessReport {
  businessType: "vivaham";
  matrimonyEnquiries: number;
  groomEnquiries: number;
  brideEnquiries: number;
  membershipPlanEnquiries: number;
  registrationFollowUps: number;
  activeMembers: number;
  leadConversion: {
    recordedMembers: number;
    hasRecordedData: boolean;
    note: string;
  };
  breakdown: BusinessEnquiryItem[];
}

export type BusinessSpecificReport = AstrologyBusinessReport | VivahamBusinessReport;

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD in Asia/Kolkata
  inbound: number;
  outbound: number;
  total: number;
  delivered: number;
  read: number;
  failed: number;
  newContacts: number;
}

export interface AnalyticsDashboardData {
  businessId: string;
  businessSlug: BusinessSlug;
  businessName: string;
  dateRange: DateRangeFilter;
  messaging: MessagingAnalytics;
  contacts: ContactAnalytics;
  inbox: InboxAnalytics;
  automation: AutomationAnalytics;
  businessReport: BusinessSpecificReport;
  dailyTrends: DailyTrendPoint[];
  generatedAtIst: string;
}
