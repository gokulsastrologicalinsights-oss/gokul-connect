"use client";

import React, { useState, useTransition } from "react";
import {
  AnalyticsDashboardData,
  DateRangeFilter,
} from "@/lib/analytics/types";
import { DateRangePicker } from "./DateRangePicker";
import { SummaryMetricCards } from "./SummaryMetricCards";
import { MessageVolumeChart } from "./charts/MessageVolumeChart";
import { InboundOutboundChart } from "./charts/InboundOutboundChart";
import { ContactGrowthChart } from "./charts/ContactGrowthChart";
import { ConversationStatusChart } from "./charts/ConversationStatusChart";
import { AutomationExecutionChart } from "./charts/AutomationExecutionChart";
import { MessageDeliveryPerformanceChart } from "./charts/MessageDeliveryPerformanceChart";
import { BusinessSpecificReportCard } from "./BusinessSpecificReportCard";
import { DailyTrendsTable } from "./DailyTrendsTable";
import { AutomationPerformanceTable } from "./AutomationPerformanceTable";
import {
  BarChart3,
  Download,
  RefreshCw,
  MessageSquare,
  Users,
  Inbox,
  Bot,
  Sparkles,
  HeartHandshake,
  Shield,
  Layers,
} from "lucide-react";

interface AnalyticsDashboardClientProps {
  initialData: AnalyticsDashboardData;
}

type TabKey = "overview" | "messaging" | "contacts" | "inbox" | "automations" | "enquiries";

export function AnalyticsDashboardClient({ initialData }: AnalyticsDashboardClientProps) {
  const [data, setData] = useState<AnalyticsDashboardData>(initialData);
  const [currentFilter, setCurrentFilter] = useState<DateRangeFilter>(initialData.dateRange);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const isAstrology = data.businessSlug === "astrology";

  const fetchAnalytics = async (filter: DateRangeFilter) => {
    try {
      const url = new URL(
        `/api/workspace/${data.businessSlug}/analytics`,
        window.location.origin
      );
      url.searchParams.set("preset", filter.preset);
      if (filter.preset === "custom") {
        url.searchParams.set("customStart", filter.startDate.split("T")[0]);
        url.searchParams.set("customEnd", filter.endDate.split("T")[0]);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      setData(json);
      setCurrentFilter(filter);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    }
  };

  const handleFilterChange = (newFilter: DateRangeFilter) => {
    startTransition(() => {
      fetchAnalytics(newFilter);
    });
  };

  const handleRefresh = () => {
    startTransition(() => {
      fetchAnalytics(currentFilter);
    });
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const url = new URL(
        `/api/workspace/${data.businessSlug}/analytics`,
        window.location.origin
      );
      url.searchParams.set("preset", currentFilter.preset);
      url.searchParams.set("format", "csv");
      if (currentFilter.preset === "custom") {
        url.searchParams.set("customStart", currentFilter.startDate.split("T")[0]);
        url.searchParams.set("customEnd", currentFilter.endDate.split("T")[0]);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to download CSV");
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `analytics-${data.businessSlug}-${currentFilter.preset}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("CSV export failed:", err);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "overview", label: "Executive Overview", icon: Layers },
    { key: "messaging", label: "Messaging", icon: MessageSquare },
    { key: "contacts", label: "Contacts & Growth", icon: Users },
    { key: "inbox", label: "Inbox & Response", icon: Inbox },
    { key: "automations", label: "Automation Health", icon: Bot },
    {
      key: "enquiries",
      label: isAstrology ? "Astrology Enquiries" : "Vivaham Enquiries",
      icon: isAstrology ? Sparkles : HeartHandshake,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isAstrology
                  ? "bg-purple-100 text-purple-800"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {isAstrology ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <HeartHandshake className="h-3 w-3" />
              )}
              {data.businessName}
            </span>
            <span className="text-xs text-slate-400">· Phase 10 Analytics</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Analytics & Business Reporting
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Strictly tenant-isolated intelligence, message volumes, customer engagement, and conversion metrics.
          </p>
        </div>

        {/* Action Buttons: Refresh & CSV Export */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            disabled={isPending}
            onClick={handleRefresh}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isPending ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportCsv}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
            title="Export filtered report as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
          </button>
        </div>
      </div>

      {/* Date Range Picker Filter Bar */}
      <DateRangePicker
        currentFilter={currentFilter}
        onChange={handleFilterChange}
        isLoading={isPending}
      />

      {/* Primary KPI Summary Cards */}
      <div className={`transition-opacity duration-200 ${isPending ? "opacity-60" : "opacity-100"}`}>
        <SummaryMetricCards data={data} />
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div className={`space-y-6 transition-opacity duration-200 ${isPending ? "opacity-60" : "opacity-100"}`}>
        {/* TAB 1: EXECUTIVE OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MessageVolumeChart data={data.dailyTrends} />
              <ConversationStatusChart inbox={data.inbox} />
            </div>

            <BusinessSpecificReportCard
              report={data.businessReport}
              businessName={data.businessName}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InboundOutboundChart data={data.dailyTrends} />
              <MessageDeliveryPerformanceChart messaging={data.messaging} />
            </div>

            <DailyTrendsTable dailyTrends={data.dailyTrends} />
          </div>
        )}

        {/* TAB 2: MESSAGING */}
        {activeTab === "messaging" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MessageVolumeChart data={data.dailyTrends} />
              <InboundOutboundChart data={data.dailyTrends} />
            </div>
            <MessageDeliveryPerformanceChart messaging={data.messaging} />
            <DailyTrendsTable dailyTrends={data.dailyTrends} />
          </div>
        )}

        {/* TAB 3: CONTACTS & GROWTH */}
        {activeTab === "contacts" && (
          <div className="space-y-6">
            <ContactGrowthChart
              data={data.dailyTrends}
              totalContacts={data.contacts.totalContacts}
              newContacts={data.contacts.newContacts}
            />

            {/* Acquisition Sources Breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Source-Wise Contact Acquisition
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Recorded channels from contact metadata and first inbound messages
              </p>

              {data.contacts.sources.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No source metadata recorded for contacts yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {data.contacts.sources.map((src) => (
                    <div
                      key={src.source}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <span className="text-xs font-semibold text-slate-800 block truncate">
                        {src.source}
                      </span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-lg font-black text-slate-900">{src.count}</span>
                        <span className="text-xs text-slate-500 font-medium">
                          ({src.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DailyTrendsTable dailyTrends={data.dailyTrends} />
          </div>
        )}

        {/* TAB 4: INBOX & RESPONSE */}
        {activeTab === "inbox" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConversationStatusChart inbox={data.inbox} />

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">
                    First-Response Time Analysis
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Elapsed duration between customer initial inbound and agent/bot response
                  </p>

                  <div className="p-4 rounded-xl bg-cyan-50 border border-cyan-200 text-center my-3">
                    <span className="text-xs text-cyan-800 font-bold uppercase tracking-wider block mb-1">
                      Average First-Response Time
                    </span>
                    <span className="text-3xl font-black text-cyan-900">
                      {data.inbox.averageFirstResponseTimeFormatted}
                    </span>
                    <span className="text-[11px] text-cyan-600 block mt-1">
                      {data.inbox.averageFirstResponseTimeSeconds
                        ? `Exact mathematical average across ${data.inbox.totalConversations} threads`
                        : "No corresponding outbound responses recorded yet"}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-700">Audit Compliance:</span> Response
                  times are calculated only where exact inbound and outbound timestamps exist. Zero
                  assumed or estimated timings are used.
                </div>
              </div>
            </div>

            <DailyTrendsTable dailyTrends={data.dailyTrends} />
          </div>
        )}

        {/* TAB 5: AUTOMATION HEALTH */}
        {activeTab === "automations" && (
          <div className="space-y-6">
            <AutomationExecutionChart automation={data.automation} />
            <AutomationPerformanceTable automation={data.automation} />
          </div>
        )}

        {/* TAB 6: BUSINESS ENQUIRIES */}
        {activeTab === "enquiries" && (
          <div className="space-y-6">
            <BusinessSpecificReportCard
              report={data.businessReport}
              businessName={data.businessName}
            />
            <DailyTrendsTable dailyTrends={data.dailyTrends} />
          </div>
        )}
      </div>

      {/* Tenant Isolation Guard Footer */}
      <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-600" />
          <span>
            Strict Multi-Tenant Separation Active: Queries scoped strictly to{" "}
            <strong className="text-slate-700">{data.businessName}</strong> ({data.businessId}).
          </span>
        </div>
        <span className="font-mono">Timezone: Asia/Kolkata</span>
      </div>
    </div>
  );
}
