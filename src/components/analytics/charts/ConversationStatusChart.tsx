"use client";

import React, { useState } from "react";
import { InboxAnalytics } from "@/lib/analytics/types";
import { MessageSquare } from "lucide-react";

interface ConversationStatusChartProps {
  inbox: InboxAnalytics;
}

export function ConversationStatusChart({ inbox }: ConversationStatusChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const total = inbox.totalConversations;

  if (total === 0) {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-[300px]">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Conversation Status Distribution</h3>
          <p className="text-xs text-slate-500">Breakdown of customer thread states</p>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-700">No conversations recorded</p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
            Zero conversation threads found for this business tenant.
          </p>
        </div>
      </div>
    );
  }

  const slices = [
    { id: "open", label: "Open", count: inbox.openConversations, color: "#10b981", bg: "bg-emerald-500" },
    { id: "pending_human", label: "Pending Handover", count: inbox.pendingHumanHandovers, color: "#f59e0b", bg: "bg-amber-500" },
    { id: "closed", label: "Closed / Resolved", count: inbox.closedConversations, color: "#3b82f6", bg: "bg-blue-500" },
    {
      id: "other",
      label: "Other / Archived",
      count: Math.max(0, total - (inbox.openConversations + inbox.pendingHumanHandovers + inbox.closedConversations)),
      color: "#94a3b8",
      bg: "bg-slate-400",
    },
  ].filter((s) => s.count > 0);

  // Calculate SVG donut stroke-dasharray and stroke-dashoffset
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-slate-800">Conversation Status Distribution</h3>
        <p className="text-xs text-slate-500">Live breakdown of customer thread states</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-3">
        {/* SVG Donut */}
        <div className="relative h-36 w-36 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 160 160" className="h-36 w-36 -rotate-90">
            {slices.map((slice) => {
              const sliceRatio = slice.count / total;
              const strokeLength = sliceRatio * circumference;
              const dashoffset = -accumulatedAngle * circumference;
              accumulatedAngle += sliceRatio;

              const isHovered = hoveredSlice === slice.id;

              return (
                <circle
                  key={slice.id}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered ? "22" : "18"}
                  strokeDasharray={`${strokeLength} ${circumference - strokeLength}`}
                  strokeDashoffset={dashoffset}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredSlice(slice.id)}
                  onMouseLeave={() => setHoveredSlice(null)}
                />
              );
            })}
          </svg>
          {/* Donut Center Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xl font-extrabold text-slate-900 leading-tight">
              {hoveredSlice
                ? slices.find((s) => s.id === hoveredSlice)?.count
                : total}
            </span>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              {hoveredSlice
                ? slices.find((s) => s.id === hoveredSlice)?.label
                : "Total"}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 w-full max-w-xs">
          {slices.map((slice) => {
            const percent = Math.round((slice.count / total) * 100);
            return (
              <div
                key={slice.id}
                onMouseEnter={() => setHoveredSlice(slice.id)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`flex items-center justify-between text-xs p-1.5 rounded-lg cursor-pointer transition-colors ${
                  hoveredSlice === slice.id ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${slice.bg}`} />
                  <span className="text-slate-700 font-medium">{slice.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{slice.count}</span>
                  <span className="text-[11px] text-slate-400">({percent}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {inbox.unreadConversations > 0 && (
        <div className="text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center justify-between">
          <span>Unread Customer Conversations:</span>
          <span className="font-bold">{inbox.unreadConversations}</span>
        </div>
      )}
    </div>
  );
}
