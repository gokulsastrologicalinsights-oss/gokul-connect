"use client";

import React from "react";
import {
  AnalyticsDashboardData,
} from "@/lib/analytics/types";
import {
  MessageSquare,
  Users,
  Inbox,
  Bot,
  Timer,
  CheckCircle,
  TrendingUp,
  UserCheck,
  AlertOctagon,
} from "lucide-react";

interface SummaryMetricCardsProps {
  data: AnalyticsDashboardData;
}

export function SummaryMetricCards({ data }: SummaryMetricCardsProps) {
  const { messaging, contacts, inbox, automation } = data;

  const cards = [
    {
      title: "Messaging Volume",
      primaryValue: messaging.totalMessages,
      primaryUnit: "total messages",
      icon: MessageSquare,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      subItems: [
        { label: "Inbound", value: messaging.totalInbound, color: "text-emerald-600" },
        { label: "Outbound", value: messaging.totalOutbound, color: "text-indigo-600" },
        { label: "Delivered", value: `${messaging.deliveryRatePercent}%`, color: "text-blue-600" },
      ],
    },
    {
      title: "Contact Acquisition",
      primaryValue: contacts.totalContacts,
      primaryUnit: "total contacts",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      subItems: [
        { label: "New in Period", value: `+${contacts.newContacts}`, color: "text-blue-600" },
        { label: "Active", value: contacts.activeContacts, color: "text-emerald-600" },
        { label: "Inactive", value: contacts.inactiveContacts, color: "text-slate-500" },
      ],
    },
    {
      title: "Customer Conversations",
      primaryValue: inbox.totalConversations,
      primaryUnit: "total threads",
      icon: Inbox,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      subItems: [
        { label: "Open", value: inbox.openConversations, color: "text-emerald-600" },
        { label: "Pending Handover", value: inbox.pendingHumanHandovers, color: "text-amber-600" },
        { label: "Closed", value: inbox.closedConversations, color: "text-blue-600" },
      ],
    },
    {
      title: "First-Response Time",
      primaryValue: inbox.averageFirstResponseTimeFormatted,
      primaryUnit: "avg first response",
      icon: Timer,
      color: "text-cyan-600",
      bg: "bg-cyan-50",
      border: "border-cyan-100",
      subItems: [
        { label: "Unread Threads", value: inbox.unreadConversations, color: inbox.unreadConversations > 0 ? "text-amber-600" : "text-slate-500" },
        { label: "Calculation", value: inbox.averageFirstResponseTimeSeconds ? "Accurate" : "No outbox", color: "text-slate-500" },
        { label: "Target", value: "< 5m", color: "text-emerald-600" },
      ],
    },
    {
      title: "Automation Execution",
      primaryValue: automation.executedJobs,
      primaryUnit: "logged jobs",
      icon: Bot,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100",
      subItems: [
        { label: "Success Rate", value: `${automation.successRatePercent}%`, color: "text-emerald-600" },
        { label: "Active Rules", value: automation.activeRules, color: "text-purple-600" },
        { label: "Inactive Rules", value: automation.inactiveRules, color: "text-slate-400" },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`bg-white rounded-xl p-4 border ${c.border} shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {c.title}
                </span>
                <div className={`p-2 rounded-lg ${c.bg} ${c.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5 my-1">
                <span className="text-2xl font-black text-slate-900 tracking-tight">
                  {c.primaryValue}
                </span>
                <span className="text-[11px] font-medium text-slate-400">{c.primaryUnit}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-1 text-center">
              {c.subItems.map((sub, j) => (
                <div key={j} className="flex flex-col">
                  <span className={`text-xs font-bold ${sub.color}`}>{sub.value}</span>
                  <span className="text-[9px] text-slate-400 font-medium truncate">
                    {sub.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
