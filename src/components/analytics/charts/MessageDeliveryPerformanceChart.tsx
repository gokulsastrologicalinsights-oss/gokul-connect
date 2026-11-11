"use client";

import React from "react";
import { MessagingAnalytics } from "@/lib/analytics/types";
import { CheckCheck, Eye, AlertOctagon, Clock, Send } from "lucide-react";

interface MessageDeliveryPerformanceChartProps {
  messaging: MessagingAnalytics;
}

export function MessageDeliveryPerformanceChart({
  messaging,
}: MessageDeliveryPerformanceChartProps) {
  const totalOutbound = messaging.totalOutbound;

  const statuses = [
    {
      label: "Delivered",
      count: messaging.delivered,
      icon: CheckCheck,
      color: "text-blue-600",
      bg: "bg-blue-500",
      pillBg: "bg-blue-50 border-blue-200",
    },
    {
      label: "Read by Recipient",
      count: messaging.read,
      icon: Eye,
      color: "text-emerald-600",
      bg: "bg-emerald-500",
      pillBg: "bg-emerald-50 border-emerald-200",
    },
    {
      label: "Pending / Queued",
      count: messaging.pending,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-500",
      pillBg: "bg-amber-50 border-amber-200",
    },
    {
      label: "Failed",
      count: messaging.failed,
      icon: AlertOctagon,
      color: "text-rose-600",
      bg: "bg-rose-500",
      pillBg: "bg-rose-50 border-rose-200",
    },
  ];

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Message Delivery Performance</h3>
          <p className="text-xs text-slate-500">Outbound delivery confirmation & read rates</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
          <Send className="h-3.5 w-3.5 text-slate-500" />
          <span className="font-bold">{totalOutbound}</span>
          <span className="text-[10px] text-slate-400">Outbound</span>
        </div>
      </div>

      {/* KPI Rate Badges */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 flex flex-col">
          <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Delivery Rate
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-blue-900">
              {messaging.deliveryRatePercent}%
            </span>
            <span className="text-[10px] text-blue-600">delivered</span>
          </div>
          <div className="w-full bg-blue-200/60 h-2 rounded-full mt-2 overflow-hidden">
            <div
              style={{ width: `${messaging.deliveryRatePercent}%` }}
              className="bg-blue-600 h-full rounded-full transition-all duration-300"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 flex flex-col">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Read Rate
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-emerald-900">
              {messaging.readRatePercent}%
            </span>
            <span className="text-[10px] text-emerald-600">of delivered</span>
          </div>
          <div className="w-full bg-emerald-200/60 h-2 rounded-full mt-2 overflow-hidden">
            <div
              style={{ width: `${messaging.readRatePercent}%` }}
              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Status Breakdown Table / List */}
      <div className="space-y-2">
        {statuses.map((s) => {
          const percent = totalOutbound > 0 ? Math.round((s.count / totalOutbound) * 100) : 0;
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`flex items-center justify-between p-2 rounded-lg border text-xs ${s.pillBg}`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${s.color}`} />
                <span className="font-semibold text-slate-800">{s.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900">{s.count}</span>
                <span className="text-[10px] text-slate-500">({percent}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
