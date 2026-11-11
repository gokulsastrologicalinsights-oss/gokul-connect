"use client";

import React, { useState, useTransition } from "react";
import {
  OperationalDashboardData,
  OperationalActivityItem,
  WorkerStatusInfo,
  QueueType,
} from "@/types/operations";
import {
  manualRetryJobAction,
  recoverStuckJobsAction,
  getOperationsDataAction,
} from "@/app/actions/operations";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  XCircle,
  Eye,
  RotateCcw,
} from "lucide-react";

interface OperationsClientProps {
  initialData: OperationalDashboardData;
}

export function OperationsClient({ initialData }: OperationsClientProps) {
  const [data, setData] = useState<OperationalDashboardData>(initialData);
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inspectingItem, setInspectingItem] = useState<OperationalActivityItem | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const isAstrology = data.businessSlug === "astrology";
  const primaryBg = isAstrology ? "bg-purple-600 hover:bg-purple-700" : "bg-rose-600 hover:bg-rose-700";
  const primaryText = isAstrology ? "text-purple-600" : "text-rose-600";
  const primaryBorder = isAstrology ? "border-purple-200" : "border-rose-200";

  // Refresh operational telemetry
  const handleRefresh = () => {
    startTransition(async () => {
      const res = await getOperationsDataAction(data.businessSlug);
      if (res.success && res.data) {
        setData(res.data);
        setActionMessage({ type: "success", text: "Operational status refreshed" });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to refresh status" });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  // Recover stuck jobs
  const handleRecoverStuck = () => {
    if (!data.canManageOperations) return;
    startTransition(async () => {
      const res = await recoverStuckJobsAction(data.businessSlug);
      if (res.success && res.result) {
        const total = Object.values(res.result.reclaimed).reduce((a, b) => a + b, 0);
        setActionMessage({
          type: "success",
          text: `Successfully reclaimed ${total} stuck job(s)`,
        });
        // Auto refresh
        const ref = await getOperationsDataAction(data.businessSlug);
        if (ref.success && ref.data) setData(ref.data);
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to recover stuck jobs" });
      }
      setTimeout(() => setActionMessage(null), 4000);
    });
  };

  // Manual retry of a specific job
  const handleManualRetry = (item: OperationalActivityItem) => {
    if (!data.canManageOperations || !item.jobId) return;
    const qType: QueueType = item.queueType || "automation";

    startTransition(async () => {
      const res = await manualRetryJobAction(data.businessSlug, qType, item.jobId!);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Job ${item.jobId?.slice(0, 8)}... successfully requeued for execution`,
        });
        setInspectingItem(null);
        // Refresh telemetry
        const ref = await getOperationsDataAction(data.businessSlug);
        if (ref.success && ref.data) setData(ref.data);
      } else {
        setActionMessage({ type: "error", text: res.error || "Manual retry failed" });
      }
      setTimeout(() => setActionMessage(null), 5000);
    });
  };

  // Filtered recent activity
  const filteredActivity = data.recentActivity.filter((item) => {
    if (selectedWorkerFilter !== "all" && item.workerType !== selectedWorkerFilter) {
      return false;
    }
    if (selectedStatusFilter === "failed" && item.status !== "error") {
      return false;
    }
    if (selectedStatusFilter === "warning" && item.status !== "warning") {
      return false;
    }
    if (selectedStatusFilter === "success" && item.status !== "success") {
      return false;
    }
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      const matchSummary = item.summary.toLowerCase().includes(query);
      const matchDetails = item.details?.toLowerCase().includes(query);
      const matchJobId = item.jobId?.toLowerCase().includes(query);
      return matchSummary || matchDetails || matchJobId;
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Operational Reliability & Queue Health
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                data.overallStatus === "healthy"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : data.overallStatus === "degraded"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {data.overallStatus}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Monitoring background workers, execution heartbeats, queue recovery, and failure diagnostics for{" "}
            <span className="font-medium text-slate-700 capitalize">{data.businessSlug}</span>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md font-medium border border-slate-200">
            Role: <span className="font-semibold text-slate-800 uppercase">{data.userRole}</span>
          </span>

          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? "animate-spin text-slate-500" : ""}`} />
            Refresh
          </button>

          {data.canManageOperations && (
            <button
              onClick={handleRecoverStuck}
              disabled={isPending || data.queuesSummary.totalStuck === 0}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${primaryBg}`}
            >
              <RotateCcw className="w-4 h-4" />
              Reclaim Stuck Jobs
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertOctagon className="w-4 h-4 text-red-600" />
            )}
            {actionMessage.text}
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stuck Jobs Alert Banner */}
      {data.queuesSummary.totalStuck > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-red-900 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold">
                {data.queuesSummary.totalStuck} Stuck Job(s) Detected
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                Jobs in processing status have exceeded the 5-minute lock lease without completion. Reclaim them to resume execution or dead-letter exhausted retries.
              </p>
            </div>
          </div>
          {data.canManageOperations ? (
            <button
              onClick={handleRecoverStuck}
              disabled={isPending}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              Reclaim Now
            </button>
          ) : (
            <span className="text-xs text-red-600 italic font-medium">Admin recovery required</span>
          )}
        </div>
      )}

      {/* Section 1: Queue Overview KPIs */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          Queue Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Pending</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {data.queuesSummary.totalPending}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Ready for next batch</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Processing</span>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {data.queuesSummary.totalProcessing}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Actively locked</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Retrying</span>
              <RefreshCw className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {data.queuesSummary.totalRetrying}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Exponential backoff</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Failed</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600">
              {data.queuesSummary.totalFailed}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Retry limit hit</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Dead Letter</span>
              <AlertOctagon className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-bold text-red-700">
              {data.queuesSummary.totalDeadLetter}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Permanent failures</p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {data.queuesSummary.totalCompleted}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Processed cleanly</p>
          </div>
        </div>
      </div>

      {/* Section 2: Worker Health Matrix */}
      <div>
        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          Background Worker Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.workers.map((worker) => (
            <div
              key={worker.workerType}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{worker.displayName}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {worker.description}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-full uppercase tracking-wider shrink-0 ${
                      worker.status === "healthy"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : worker.status === "degraded"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : worker.status === "stalled"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {worker.status}
                  </span>
                </div>

                {/* Queue pill indicators */}
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Pending</span>
                    <span className="text-sm font-bold text-slate-800">{worker.queue.pending}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Processing</span>
                    <span className="text-sm font-bold text-amber-600">{worker.queue.processing}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Retrying</span>
                    <span className="text-sm font-bold text-purple-600">{worker.queue.retrying}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-semibold block">Failed</span>
                    <span className="text-sm font-bold text-rose-600">
                      {worker.queue.failed + worker.queue.deadLetter}
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution telemetry summary */}
              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <div className="flex justify-between">
                  <span>Last Executed:</span>
                  <span className="font-medium text-slate-700">
                    {worker.lastRunAt ? new Date(worker.lastRunAt).toLocaleTimeString("en-IN") : "No recorded runs"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Duration:</span>
                  <span className="font-medium text-slate-700">
                    {worker.avgDurationMs > 0 ? `${worker.avgDurationMs}ms` : "—"}
                  </span>
                </div>
                {worker.lastError && (
                  <div className="pt-1">
                    <span className="text-rose-600 font-semibold block">Last Error:</span>
                    <p className="text-[11px] text-rose-500 truncate" title={worker.lastError}>
                      {worker.lastError}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Recent Activity & Diagnostics */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Activity & Failure Logs</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspected job executions, sanitized failure codes, and retry recovery history.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 w-44"
              />
            </div>

            <select
              value={selectedWorkerFilter}
              onChange={(e) => setSelectedWorkerFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="all">All Workers</option>
              <option value="automation_worker">Automation</option>
              <option value="scheduled_worker">Scheduled</option>
              <option value="campaign_worker">Campaigns</option>
              <option value="crm_reminder_worker">CRM Reminders</option>
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              <option value="all">All Statuses</option>
              <option value="failed">Failed / Dead Letter</option>
              <option value="warning">Warnings / Stuck</option>
              <option value="success">Successful Runs</option>
            </select>
          </div>
        </div>

        {/* Activity Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Worker</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Summary</th>
                <th className="py-3 px-4">Details / Sanitized Error</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredActivity.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No recent activity matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredActivity.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(item.timestamp).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                      {item.workerType.replace("_worker", "")}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "success"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : item.status === "warning"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-red-50 text-red-700 border border-red-100"
                        }`}
                      >
                        {item.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">
                      {item.summary}
                    </td>
                    <td className="py-3 px-4 text-slate-500 max-w-sm truncate font-mono text-[11px]">
                      {item.details || "—"}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {item.jobId && (
                          <button
                            onClick={() => setInspectingItem(item)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                            title="Inspect Job"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.isRetryable && (
                          <button
                            onClick={() => handleManualRetry(item)}
                            disabled={!data.canManageOperations || isPending}
                            className={`px-2 py-1 text-[11px] font-semibold rounded border transition-colors ${
                              data.canManageOperations
                                ? "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-xs"
                                : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            }`}
                            title={
                              data.canManageOperations
                                ? "Retry job"
                                : "Only Owner or Admin can manually retry jobs"
                            }
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspector Modal */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Job Diagnostics Inspector</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {inspectingItem.jobId}</p>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700 block mb-1">Queue & Worker:</span>
                <span className="font-mono bg-slate-50 px-2.5 py-1 rounded border border-slate-200 inline-block">
                  {inspectingItem.workerType}
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Status Summary:</span>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                  {inspectingItem.summary}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-700 block mb-1">Sanitized Error Code & Detail:</span>
                <pre className="text-rose-600 bg-rose-50/50 p-2.5 rounded border border-rose-100 font-mono text-[11px] whitespace-pre-wrap">
                  {inspectingItem.details || "No error reported"}
                </pre>
              </div>

              {inspectingItem.payloadPreview && (
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Sanitized Payload Preview:</span>
                  <pre className="bg-slate-50 p-2.5 rounded border border-slate-200 font-mono text-[11px] whitespace-pre-wrap text-slate-700">
                    {inspectingItem.payloadPreview}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 italic">
                * All sensitive tokens, auth headers and customer data are scrubbed before display.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInspectingItem(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Close
                </button>
                {inspectingItem.isRetryable && data.canManageOperations && (
                  <button
                    onClick={() => handleManualRetry(inspectingItem)}
                    disabled={isPending}
                    className={`px-3 py-1.5 text-xs text-white rounded-lg font-semibold shadow-xs ${primaryBg}`}
                  >
                    Retry Job Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
