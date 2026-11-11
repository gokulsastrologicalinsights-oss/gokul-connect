"use client";

import React, { useState } from "react";
import { AutomationAnalytics } from "@/lib/analytics/types";
import { Bot, CheckCircle2, AlertTriangle, XCircle, ShieldAlert } from "lucide-react";

interface AutomationExecutionChartProps {
  automation: AutomationAnalytics;
}

export function AutomationExecutionChart({ automation }: AutomationExecutionChartProps) {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const total = automation.executedJobs;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Automation Rule Executions</h3>
          <p className="text-xs text-slate-500">Deterministic rule trigger performance & outcomes</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-extrabold text-indigo-600">{total}</span>
          <span className="text-[10px] text-slate-400 block">Total Executions</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-6 my-auto h-[160px]">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Bot className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-700">No automation jobs executed</p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
            Automations remain strictly inactive by default unless separately approved and enabled.
          </p>
        </div>
      ) : (
        <div className="space-y-4 py-2">
          {/* Multi-segment horizontal progress bar */}
          <div className="h-5 w-full bg-slate-100 rounded-lg overflow-hidden flex shadow-inner">
            {automation.successfulExecutions > 0 && (
              <div
                style={{ width: `${(automation.successfulExecutions / total) * 100}%` }}
                className="bg-emerald-500 h-full transition-all hover:opacity-90 cursor-pointer"
                onMouseEnter={() => setHoveredStatus("success")}
                onMouseLeave={() => setHoveredStatus(null)}
                title={`Success: ${automation.successfulExecutions}`}
              />
            )}
            {automation.skippedExecutions > 0 && (
              <div
                style={{ width: `${(automation.skippedExecutions / total) * 100}%` }}
                className="bg-slate-400 h-full transition-all hover:opacity-90 cursor-pointer"
                onMouseEnter={() => setHoveredStatus("skipped")}
                onMouseLeave={() => setHoveredStatus(null)}
                title={`Skipped: ${automation.skippedExecutions}`}
              />
            )}
            {automation.failedExecutions > 0 && (
              <div
                style={{ width: `${(automation.failedExecutions / total) * 100}%` }}
                className="bg-rose-500 h-full transition-all hover:opacity-90 cursor-pointer"
                onMouseEnter={() => setHoveredStatus("failed")}
                onMouseLeave={() => setHoveredStatus(null)}
                title={`Failed: ${automation.failedExecutions}`}
              />
            )}
          </div>

          {/* Outcome Metric Cards */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center justify-center gap-1 text-emerald-700 mb-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Success</span>
              </div>
              <span className="text-base font-extrabold text-emerald-900">
                {automation.successfulExecutions}
              </span>
              <span className="text-[10px] text-emerald-600 block">
                ({automation.successRatePercent}%)
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-center gap-1 text-slate-700 mb-0.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Skipped</span>
              </div>
              <span className="text-base font-extrabold text-slate-900">
                {automation.skippedExecutions}
              </span>
              <span className="text-[10px] text-slate-500 block">
                ({total > 0 ? Math.round((automation.skippedExecutions / total) * 100) : 0}%)
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200">
              <div className="flex items-center justify-center gap-1 text-rose-700 mb-0.5">
                <XCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold">Failed</span>
              </div>
              <span className="text-base font-extrabold text-rose-900">
                {automation.failedExecutions}
              </span>
              <span className="text-[10px] text-rose-600 block">
                ({total > 0 ? Math.round((automation.failedExecutions / total) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Safety Invariant Notice */}
      <div className="mt-3 text-[11px] text-amber-800 bg-amber-50/80 px-3 py-2 rounded-lg border border-amber-200/80 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Strict Rule Safety Invariant:</span> Automations remain inactive
          unless explicitly enabled by administrator. {automation.inactiveRules} of {automation.totalRules} rules
          currently inactive.
        </div>
      </div>
    </div>
  );
}
