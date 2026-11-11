"use client";

import React, { useState } from "react";
import { AutomationAnalytics } from "@/lib/analytics/types";
import { Bot, AlertOctagon, CheckCircle2, XCircle } from "lucide-react";

interface AutomationPerformanceTableProps {
  automation: AutomationAnalytics;
}

export function AutomationPerformanceTable({
  automation,
}: AutomationPerformanceTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const rules = automation.rulePerformance;
  const totalPages = Math.ceil(rules.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentRows = rules.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-bold text-slate-900">Automation Rule Performance</h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Deterministic Rule Trigger Evaluation
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Rule Name</th>
              <th className="px-4 py-3">Trigger Type</th>
              <th className="px-4 py-3 text-right">Executions</th>
              <th className="px-4 py-3 text-right">Success</th>
              <th className="px-4 py-3 text-right">Failed</th>
              <th className="px-4 py-3 text-right">Skipped</th>
              <th className="px-4 py-3 text-right">Success Rate</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-6 text-slate-400">
                  No automation rules have executed in this date range.
                </td>
              </tr>
            ) : (
              currentRows.map((r) => (
                <tr key={r.ruleId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">{r.ruleName}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                    {r.triggerType}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {r.executions}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600">
                    {r.successCount}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-rose-600">
                    {r.failureCount}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-500">
                    {r.skippedCount}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-600">
                    {r.successRatePercent}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Failure Reasons Breakdown (if any) */}
      {automation.failureReasons.length > 0 && (
        <div className="p-4 border-t border-slate-200 bg-rose-50/40">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 mb-2">
            <AlertOctagon className="h-4 w-4 text-rose-600" />
            <span>Execution Failures & Skip Reasons</span>
          </div>
          <div className="space-y-1.5">
            {automation.failureReasons.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs text-rose-900 bg-white p-2 rounded-lg border border-rose-200"
              >
                <span className="font-medium truncate max-w-md">{f.reason}</span>
                <span className="font-bold">
                  {f.count} ({f.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
