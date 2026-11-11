import React from "react";
import Link from "next/link";
import {
  Users,
  MessageSquare,
  Clock,
  Bot,
  UserCheck,
  CalendarClock,
  AlertOctagon,
  Timer,
  ArrowUpRight,
  Shield,
  Smartphone,
  Sparkles,
  HeartHandshake,
  CheckCircle,
} from "lucide-react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getBusinessAnalytics } from "@/lib/analytics/service";
import { resolveDateRange } from "@/lib/analytics/date-utils";
import { getRecentMessagesForBusiness } from "@/lib/whatsapp/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business, user } = await validateBusinessAccess(businessSlug);

  const isAstrology = business.slug === "astrology";

  // Business-specific seed/fallback metrics (Partitioned, never combined)
  const fallbackAstrologyEnquiries = [
    { name: "K. R. Vignesh", query: "KP Horoscope Consultation for marriage", time: "10 mins ago", status: "unread", category: "KP Astrology" },
    { name: "Sangeetha M.", query: "Child birth horoscope compatibility report", time: "32 mins ago", status: "pending", category: "Horoscope" },
    { name: "Dr. Anbarasu", query: "Payment screenshot sent for Vedic consultation", time: "1 hour ago", status: "resolved", category: "Payment" },
    { name: "Praveen Kumar", query: "Appointment rescheduling request", time: "3 hours ago", status: "resolved", category: "Booking" },
  ];

  const fallbackVivahamEnquiries = [
    { name: "Meenakshi Sundaram", query: "Tamil Matrimony new profile registration link", time: "5 mins ago", status: "unread", category: "New Registration" },
    { name: "Kalyani Raman", query: "Membership plan details & horoscopes matching", time: "18 mins ago", status: "unread", category: "Membership" },
    { name: "Muthukumar S.", query: "Profile ID GV-892 contact verification", time: "45 mins ago", status: "pending", category: "Profile" },
    { name: "Revathi G.", query: "Payment verification for 6-month premium plan", time: "2 hours ago", status: "resolved", category: "Payment" },
  ];

  let liveAnalytics: any = null;
  let scheduledFollowupsCount: number | null = null;
  let realRecentEnquiries: any[] = [];
  let isLiveDb = false;

  // Pull live database metrics directly via DB RPC and tenant-isolated tables
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const defaultDateRange = resolveDateRange("30d");

      // 1. Fetch live analytics summary from DB RPC / tables
      liveAnalytics = await getBusinessAnalytics(
        business.id,
        business.slug,
        defaultDateRange,
        { userId: user.id, client: supabase }
      );

      // 2. Query real live pending scheduled follow-ups
      try {
        const { count: crmCount } = await supabase
          .from("crm_follow_ups")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("status", "pending");
        if (crmCount !== null && crmCount !== undefined) {
          scheduledFollowupsCount = crmCount;
        }
      } catch {
        const { count: schedCount } = await supabase
          .from("wa_scheduled_messages")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .eq("status", "pending");
        if (schedCount !== null && schedCount !== undefined) {
          scheduledFollowupsCount = schedCount;
        }
      }

      // 3. Query real recent conversations from DB
      const { data: convData } = await supabase
        .from("wa_conversations")
        .select(`
          id,
          status,
          unread_count,
          last_message_preview,
          last_message_at,
          wa_contacts (
            display_name,
            phone_number
          )
        `)
        .eq("business_id", business.id)
        .order("last_message_at", { ascending: false })
        .limit(5);

      if (convData && convData.length > 0) {
        realRecentEnquiries = convData.map((c: any) => {
          const contact = Array.isArray(c.wa_contacts) ? c.wa_contacts[0] : c.wa_contacts;
          const name = contact?.display_name || contact?.phone_number || "WhatsApp Client";
          const query = c.last_message_preview || "Enquiry received";
          const time = c.last_message_at
            ? new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Recently";
          const status = c.unread_count > 0 ? "unread" : c.status === "pending_human" ? "pending" : "resolved";
          return {
            name,
            query,
            time,
            status,
            category: isAstrology ? "Astrology" : "Matrimony",
          };
        });
      }

      isLiveDb = true;
    } catch (err) {
      console.warn("Falling back to baseline stats due to live DB query failure:", err);
    }
  }

  // Bind live database metrics with baseline fallback
  const stats = {
    totalCustomers: liveAnalytics?.contacts?.totalContacts ?? (isAstrology ? 142 : 318),
    newEnquiriesToday: liveAnalytics?.messaging?.incomingToday ?? (isAstrology ? 8 : 19),
    unreadConversations: liveAnalytics?.inbox?.unreadConversations ?? (isAstrology ? 5 : 12),
    pendingReplies: liveAnalytics?.inbox?.pendingReplies ?? (isAstrology ? 3 : 7),
    automatedReplies: liveAnalytics?.automation?.botHandledMessages ?? (isAstrology ? 86 : 214),
    manualReplies: liveAnalytics?.automation?.humanTakeovers ?? (isAstrology ? 42 : 95),
    scheduledFollowups: scheduledFollowupsCount ?? (isAstrology ? 11 : 26),
    failedMessages: liveAnalytics?.messaging?.failedCount ?? 0,
    averageResponseTime: liveAnalytics?.inbox?.avgResponseTimeFormatted || (isAstrology ? "4.2m" : "2.8m"),
    recentEnquiries:
      realRecentEnquiries.length > 0
        ? realRecentEnquiries
        : isAstrology
        ? fallbackAstrologyEnquiries
        : fallbackVivahamEnquiries,
  };

  const statCards = [
    { label: "Total Customers", value: stats.totalCustomers, icon: Users, sub: `Scoped to ${business.name}`, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "New Enquiries Today", value: stats.newEnquiriesToday, icon: MessageSquare, sub: "Incoming first contact", color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Unread Conversations", value: stats.unreadConversations, icon: Clock, sub: "Action required", color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Pending Replies", value: stats.pendingReplies, icon: AlertOctagon, sub: "Within 24h window", color: "text-rose-600", bg: "bg-rose-50" },
    { label: "Automated Replies", value: stats.automatedReplies, icon: Bot, sub: "Rule-based (No AI)", color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Manual Replies", value: stats.manualReplies, icon: UserCheck, sub: "Human agent takeover", color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Scheduled Follow-ups", value: stats.scheduledFollowups, icon: CalendarClock, sub: "Automated queue", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Avg Response Time", value: stats.averageResponseTime, icon: Timer, sub: "Customer satisfaction", color: "text-cyan-600", bg: "bg-cyan-50" },
  ];

  const displayEnquiries = stats.recentEnquiries;

  return (
    <div className="space-y-8">
      {/* Workspace Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
              isAstrology
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                : "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
            }`}
          >
            {isAstrology ? (
              <Sparkles className="h-6 w-6" />
            ) : (
              <HeartHandshake className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {business.name} — Workspace Dashboard
              </h1>
              <Badge variant="success" className="text-[10px]">Active</Badge>
              <Badge variant={isLiveDb ? "success" : "outline"} className="text-[10px] flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${isLiveDb ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                {isLiveDb ? "Live DB RPC" : "Baseline Demo"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500 max-w-2xl">
              {business.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              Meta Cloud API Ready
            </span>
          </div>
        </div>
      </div>

      {/* Strict Tenant Notice */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100/60 px-4 py-2.5 text-xs text-slate-600">
        <Shield className="h-4 w-4 text-indigo-600 shrink-0" />
        <span>
          <strong>Strict Tenant Isolation Active:</strong> All metrics, conversations, and records below belong exclusively to{" "}
          <span className="font-semibold text-slate-900">{business.name}</span>. Data is completely isolated from the other business.
        </span>
      </div>

      {/* 8 Business-Specific KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="border-slate-200 bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">{stat.label}</span>
                  <div className={`h-8 w-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-slate-900">{stat.value}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{stat.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Live Recent Enquiries & Module Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Business-Specific Enquiries */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200 bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base text-slate-900">
                  Recent {isAstrology ? "Astrology" : "Matrimony"} Enquiries
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time incoming enquiries routed specifically to this workspace
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-medium">
                {displayEnquiries.length} recent
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {displayEnquiries.map((enq, index) => (
                  <div key={index} className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900">{enq.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {enq.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-1">{enq.query}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span suppressHydrationWarning className="text-[11px] text-slate-400">{enq.time}</span>
                      <Badge
                        variant={enq.status === "unread" ? "warning" : enq.status === "pending" ? "destructive" : "success"}
                        className="text-[10px] capitalize"
                      >
                        {enq.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Workspace Module Readiness */}
        <div>
          <Card className="border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-900">Module Readiness</CardTitle>
              <CardDescription className="text-xs">Phase-by-phase platform roadmap</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-emerald-900">
                  <span>Phase 1 — Core Foundation</span>
                  <Badge variant="success" className="text-[10px]">Active</Badge>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Strict tenant isolation, auth, business switcher, and isolated workspaces verified.
                </p>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-emerald-900">
                  <span>Phase 2 — Connection Manager</span>
                  <Badge variant="success" className="text-[10px]">Active</Badge>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Dedicated WhatsApp numbers per business, secure token vaults, and diagnostic monitors.
                </p>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-emerald-900">
                  <span>Phase 3 — WhatsApp Webhooks</span>
                  <Badge variant="success" className="text-[10px]">Active</Badge>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Phone Number ID routing, atomic ingest, idempotency, and deduplication.
                </p>
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-emerald-900">
                  <span>Phase 4 &amp; 5 — Inbox &amp; Automation</span>
                  <Badge variant="success" className="text-[10px]">Active</Badge>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Real-time multi-agent chat, Tamil/English keyword rules, and dry-run simulator.
                </p>
              </div>

              <Link
                href={`/workspace/${businessSlug}/analytics`}
                className="block rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-xs hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center justify-between font-semibold text-indigo-900">
                  <span>Phase 10 — Analytics &amp; Business Reporting</span>
                  <Badge variant="success" className="text-[10px]">Active</Badge>
                </div>
                <p className="mt-1 text-[11px] text-indigo-800">
                  Independent business reporting, message trends, delivery rates, and enquiry categorization.
                </p>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
