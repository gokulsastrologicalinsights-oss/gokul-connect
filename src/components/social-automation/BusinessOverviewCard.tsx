import React from "react";
import {
  Sparkles,
  Bot,
  ShieldCheck,
  Share2,
  MessageSquare,
  Users,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import type { SocialDashboardData } from "@/app/actions/social-automations";

interface BusinessOverviewCardProps {
  businessSlug: string;
  data: SocialDashboardData;
}

export function BusinessOverviewCard({ businessSlug, data }: BusinessOverviewCardProps) {
  const isAstrology = businessSlug === "astrology";
  const { stats, warnings, business } = data;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-xl p-6 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                {isAstrology ? (
                  <Sparkles className="w-6 h-6 text-amber-300" />
                ) : (
                  <Bot className="w-6 h-6 text-pink-300" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {business.name}
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-500/30 border border-indigo-400/40 text-indigo-200">
                    {isAstrology ? "Astrology Workspace" : "Matrimony Workspace"}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mt-0.5">
                  {isAstrology
                    ? "Tamil & English Horoscope Consultation, Match Making & Price Enquiry Automation for Facebook & Instagram."
                    : "Tamil & English Bride / Groom Enquiry, Registration & Matrimony Plans Automation for Facebook & Instagram."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Phase 13D Safe Inspection Mode</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warning & Operational Alerts */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warn) => {
            const isCritical = warn.type === "critical";
            const isWarn = warn.type === "warning";
            return (
              <div
                key={warn.id}
                className={`p-3.5 rounded-lg border text-sm flex items-start justify-between gap-3 ${
                  isCritical
                    ? "bg-red-50 border-red-200 text-red-900"
                    : isWarn
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-blue-50 border-blue-200 text-blue-900"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {isCritical ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  ) : isWarn ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-semibold">{warn.title}: </span>
                    <span className="text-slate-700">{warn.message}</span>
                  </div>
                </div>
                {warn.actionHref && (
                  <Link
                    href={warn.actionHref}
                    className="shrink-0 text-xs font-semibold underline hover:no-underline flex items-center gap-1 mt-0.5"
                  >
                    {warn.actionLabel || "Configure"}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Keyword Rules</span>
            <Bot className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats.activeRules}{" "}
            <span className="text-xs font-normal text-slate-500">/ {stats.totalRules} active</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Unicode Tamil & English
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Connected Channels</span>
            <Share2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats.connectedChannels}{" "}
            <span className="text-xs font-normal text-slate-500">channels</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Facebook & Instagram
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Inbound Comments</span>
            <MessageSquare className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.commentsReceived}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-1">
            Logged in ledger
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Replies Handled</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.repliesDelivered}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            Public & Private DMs
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>High-Intent Leads</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700">{stats.highIntentLeads}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            Ready for consultation
          </div>
        </div>
      </div>
    </div>
  );
}
