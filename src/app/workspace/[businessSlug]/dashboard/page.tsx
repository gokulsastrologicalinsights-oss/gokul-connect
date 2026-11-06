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
  const { business } = await validateBusinessAccess(businessSlug);

  const isAstrology = business.slug === "astrology";

  // Business-specific seed metrics (Strictly partitioned, never combined)
  const stats = isAstrology
    ? {
        totalCustomers: 142,
        newEnquiriesToday: 8,
        unreadConversations: 5,
        pendingReplies: 3,
        automatedReplies: 86,
        manualReplies: 42,
        scheduledFollowups: 11,
        failedMessages: 0,
        averageResponseTime: "4.2m",
        recentEnquiries: [
          { name: "K. R. Vignesh", query: "KP Horoscope Consultation for marriage", time: "10 mins ago", status: "unread", category: "KP Astrology" },
          { name: "Sangeetha M.", query: "Child birth horoscope compatibility report", time: "32 mins ago", status: "pending", category: "Horoscope" },
          { name: "Dr. Anbarasu", query: "Payment screenshot sent for Vedic consultation", time: "1 hour ago", status: "resolved", category: "Payment" },
          { name: "Praveen Kumar", query: "Appointment rescheduling request", time: "3 hours ago", status: "resolved", category: "Booking" },
        ],
      }
    : {
        totalCustomers: 318,
        newEnquiriesToday: 19,
        unreadConversations: 12,
        pendingReplies: 7,
        automatedReplies: 214,
        manualReplies: 95,
        scheduledFollowups: 26,
        failedMessages: 0,
        averageResponseTime: "2.8m",
        recentEnquiries: [
          { name: "Meenakshi Sundaram", query: "Tamil Matrimony new profile registration link", time: "5 mins ago", status: "unread", category: "New Registration" },
          { name: "Kalyani Raman", query: "Membership plan details & horoscopes matching", time: "18 mins ago", status: "unread", category: "Membership" },
          { name: "Muthukumar S.", query: "Profile ID GV-892 contact verification", time: "45 mins ago", status: "pending", category: "Profile" },
          { name: "Revathi G.", query: "Payment verification for 6-month premium plan", time: "2 hours ago", status: "resolved", category: "Payment" },
        ],
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {business.name} — Workspace Dashboard
              </h1>
              <Badge variant="success" className="text-[10px]">Active</Badge>
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
                {stats.recentEnquiries.length} recent
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {stats.recentEnquiries.map((enq, index) => (
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
                      <span className="text-[11px] text-slate-400">{enq.time}</span>
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
                  <Badge variant="success" className="text-[10px]">Completed</Badge>
                </div>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Strict tenant isolation, auth, business switcher, and isolated workspaces verified.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>Phase 2 — Connection Manager</span>
                  <Badge variant="secondary" className="text-[10px]">Next</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Dedicated WhatsApp numbers per business and connection status monitors.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>Phase 3 — WhatsApp Webhooks</span>
                  <Badge variant="outline" className="text-[10px]">Queued</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Phone Number ID routing, idempotency, and message event deduplication.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-800">
                  <span>Phase 4 — Rule Automation</span>
                  <Badge variant="outline" className="text-[10px]">Queued</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Tamil/English keyword rules, flow builder, and deterministic menus.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
