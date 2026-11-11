"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Business,
  BusinessMember,
  CampaignRecipientEligibility,
  CampaignRecipientStatus,
  CampaignStatus,
  UserProfile,
  WhatsAppCampaign,
  WhatsAppCampaignRecipient,
} from "@/types/database";
import {
  cancelCampaignAction,
  exportCampaignResultsCsvAction,
  getCampaignDetailsAction,
  getCampaignRecipientsAction,
  launchCampaignAction,
  pauseCampaignAction,
  prepareCampaignAudienceAction,
  resumeCampaignAction,
  retryFailedCampaignRecipientsAction,
} from "@/app/actions/campaigns";
import { formatKolkataDate } from "@/lib/analytics/date-utils";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileEdit,
  FileText,
  Filter,
  Image as ImageIcon,
  MessageSquare,
  Megaphone,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";

interface CampaignDetailClientProps {
  business: Business;
  currentUser: UserProfile;
  currentMembership: BusinessMember;
  initialCampaign: WhatsAppCampaign;
  initialRecipients: WhatsAppCampaignRecipient[];
  initialTotalRecipients: number;
}

export function CampaignDetailClient({
  business,
  currentUser,
  currentMembership,
  initialCampaign,
  initialRecipients,
  initialTotalRecipients,
}: CampaignDetailClientProps) {
  const [campaign, setCampaign] = useState<WhatsAppCampaign>(initialCampaign);
  const [recipients, setRecipients] = useState<WhatsAppCampaignRecipient[]>(initialRecipients);
  const [totalRecipients, setTotalRecipients] = useState<number>(initialTotalRecipients);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canMutate = ["owner", "admin"].includes(currentMembership.role);
  const canOperate = ["owner", "admin", "agent"].includes(currentMembership.role);

  // Poll for status updates if campaign is queued or sending
  useEffect(() => {
    if (!["queued", "sending", "preparing"].includes(campaign.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await getCampaignDetailsAction(business.slug, campaign.id);
        if (res.success && res.campaign) {
          setCampaign(res.campaign);
        }
        const recRes = await getCampaignRecipientsAction(business.slug, campaign.id, {
          status: statusFilter !== "all" ? (statusFilter as CampaignRecipientStatus) : undefined,
          search: searchQuery,
          limit: 100,
        });
        if (recRes.success) {
          setRecipients(recRes.recipients);
          setTotalRecipients(recRes.totalCount);
        }
      } catch {
        // Ignore polling errors
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [campaign.status, business.slug, campaign.id, statusFilter, searchQuery]);

  const loadRecipients = async () => {
    setActionLoading(true);
    try {
      const res = await getCampaignRecipientsAction(business.slug, campaign.id, {
        status: statusFilter !== "all" ? (statusFilter as CampaignRecipientStatus) : undefined,
        search: searchQuery,
        limit: 100,
      });
      if (res.success) {
        setRecipients(res.recipients);
        setTotalRecipients(res.totalCount);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load recipients." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLaunch = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await launchCampaignAction(business.slug, campaign.id);
      if (res.success && res.campaign) {
        setCampaign(res.campaign);
        setActionMessage({ type: "success", text: "Campaign launched successfully!" });
        loadRecipients();
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to launch campaign." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to launch campaign." });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrepareAudience = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await prepareCampaignAudienceAction(business.slug, campaign.id);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Audience prepared: ${res.eligibleCount} eligible, ${res.excludedCount} excluded.`,
        });
        const cRes = await getCampaignDetailsAction(business.slug, campaign.id);
        if (cRes.success && cRes.campaign) setCampaign(cRes.campaign);
        loadRecipients();
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to prepare audience." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to prepare audience." });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await pauseCampaignAction(business.slug, campaign.id);
      if (res.success && res.campaign) {
        setCampaign(res.campaign);
        setActionMessage({ type: "success", text: "Campaign paused." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to pause campaign." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to pause campaign." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await resumeCampaignAction(business.slug, campaign.id);
      if (res.success && res.campaign) {
        setCampaign(res.campaign);
        setActionMessage({ type: "success", text: "Campaign resumed." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to resume campaign." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to resume campaign." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this campaign? Any pending messages will be cancelled.")) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await cancelCampaignAction(business.slug, campaign.id);
      if (res.success && res.campaign) {
        setCampaign(res.campaign);
        setActionMessage({ type: "success", text: "Campaign cancelled." });
        loadRecipients();
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to cancel campaign." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to cancel campaign." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await retryFailedCampaignRecipientsAction(business.slug, campaign.id);
      if (res.success) {
        setActionMessage({
          type: "success",
          text: `Reset ${res.retriedCount} failed recipients to pending for dispatch retry.`,
        });
        const cRes = await getCampaignDetailsAction(business.slug, campaign.id);
        if (cRes.success && cRes.campaign) setCampaign(cRes.campaign);
        loadRecipients();
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to retry recipients." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to retry recipients." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setActionLoading(true);
    try {
      const res = await exportCampaignResultsCsvAction(business.slug, campaign.id);
      if (res.success && res.csv) {
        const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", res.filename || "campaign_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setActionMessage({ type: "success", text: "Campaign report exported successfully." });
      } else {
        setActionMessage({ type: "error", text: res.error || "Failed to export CSV." });
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to export CSV." });
    } finally {
      setActionLoading(false);
    }
  };

  const deliveryRate =
    campaign.sent_count > 0
      ? Math.round((campaign.delivered_count / campaign.sent_count) * 100)
      : 0;
  const readRate =
    campaign.delivered_count > 0
      ? Math.round((campaign.read_count / campaign.delivered_count) * 100)
      : 0;
  const failureRate =
    campaign.sent_count > 0
      ? Math.round((campaign.failed_count / campaign.sent_count) * 100)
      : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Header and Back Link */}
      <div>
        <Link
          href={`/workspace/${business.slug}/campaigns`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaigns
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{campaign.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  campaign.status === "completed"
                    ? "bg-emerald-100 text-emerald-800"
                    : campaign.status === "sending" || campaign.status === "queued"
                    ? "bg-indigo-100 text-indigo-800 animate-pulse"
                    : campaign.status === "paused"
                    ? "bg-amber-100 text-amber-800"
                    : campaign.status === "failed"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {campaign.status}
              </span>
            </div>
            {campaign.description && <p className="mt-1 text-sm text-slate-500">{campaign.description}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canOperate && ["draft", "scheduled"].includes(campaign.status) && (
              <>
                <button
                  onClick={handlePrepareAudience}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Users className="w-3.5 h-3.5" /> Re-prepare Audience
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" /> Launch Now
                </button>
              </>
            )}

            {canOperate && (campaign.status === "sending" || campaign.status === "queued") && (
              <button
                onClick={handlePause}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                <Pause className="w-3.5 h-3.5" /> Pause Campaign
              </button>
            )}

            {canOperate && campaign.status === "paused" && (
              <button
                onClick={handleResume}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> Resume Campaign
              </button>
            )}

            {canOperate && campaign.failed_count > 0 && (
              <button
                onClick={handleRetryFailed}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retry Failed ({campaign.failed_count})
              </button>
            )}

            <button
              onClick={handleExportCsv}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>

            {canMutate && ["draft", "scheduled", "preparing", "queued", "paused"].includes(campaign.status) && (
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Campaign Metadata Details */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs">
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wider block">Message Type</span>
          <span className="font-medium text-slate-800">{campaign.message_type.toUpperCase()}</span>
          {campaign.template_name && (
            <span className="block text-[11px] font-mono text-slate-500">({campaign.template_name})</span>
          )}
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wider block">Timezone</span>
          <span className="font-medium text-slate-800">{campaign.timezone}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wider block">Timing</span>
          <span className="font-medium text-slate-800">
            {campaign.scheduled_at
              ? `Scheduled: ${formatKolkataDate(campaign.scheduled_at)}`
              : campaign.started_at
              ? `Started: ${formatKolkataDate(campaign.started_at)}`
              : "Manual trigger"}
          </span>
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wider block">Batch Limits</span>
          <span className="font-medium text-slate-800">
            {campaign.batch_size} msgs / {campaign.dispatch_interval_ms}ms
          </span>
        </div>
      </div>

      {/* Real-time Analytics KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Audience</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{campaign.audience_count}</div>
          <span className="text-[10px] text-slate-400">Contacts targeted</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">Eligible</span>
          <div className="text-2xl font-bold text-indigo-700 mt-1">{campaign.eligible_count}</div>
          <span className="text-[10px] text-slate-400">Passed compliance</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">Sent</span>
          <div className="text-2xl font-bold text-blue-700 mt-1">{campaign.sent_count}</div>
          <span className="text-[10px] text-slate-400">Dispatched to Meta</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">Delivered</span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{campaign.delivered_count}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">{deliveryRate}% delivery rate</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">Read</span>
          <div className="text-2xl font-bold text-teal-700 mt-1">{campaign.read_count}</div>
          <span className="text-[10px] text-teal-600 font-semibold">{readRate}% read rate</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-[11px] font-bold uppercase text-slate-400">Failed / Excluded</span>
          <div className="text-2xl font-bold text-rose-700 mt-1">{campaign.failed_count + campaign.excluded_count}</div>
          <span className="text-[10px] text-rose-600 font-semibold">{campaign.failed_count} failed</span>
        </div>
      </div>

      {/* Recipients Log Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recipient Delivery Report</h3>
            <p className="text-xs text-slate-500">
              Showing {recipients.length} of {totalRecipients} recipients
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadRecipients()}
                className="pl-8 pr-3 py-1 text-xs rounded border border-slate-300 w-44"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded border border-slate-300 py-1 px-2 bg-white text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="read">Read</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped / Excluded</option>
            </select>

            <button
              onClick={loadRecipients}
              disabled={actionLoading}
              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded border border-slate-200 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {recipients.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No recipients found matching the filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 uppercase tracking-wider text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Eligibility</th>
                  <th className="px-4 py-3">Delivery Status</th>
                  <th className="px-4 py-3">Dispatched / Delivered</th>
                  <th className="px-4 py-3">Error / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recipients.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {r.recipient_name || "Unknown"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600">{r.phone_number}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          r.eligibility_status === "eligible"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {r.eligibility_status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          r.status === "delivered" || r.status === "read"
                            ? "bg-emerald-50 text-emerald-700"
                            : r.status === "sent"
                            ? "bg-blue-50 text-blue-700"
                            : r.status === "failed"
                            ? "bg-rose-50 text-rose-700"
                            : r.status === "processing"
                            ? "bg-indigo-50 text-indigo-700 animate-pulse"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {r.dispatched_at ? (
                        <div>
                          <div>Sent: {formatKolkataDate(r.dispatched_at)}</div>
                          {r.delivered_at && <div>Delivered: {formatKolkataDate(r.delivered_at)}</div>}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-rose-600 max-w-xs truncate" title={r.last_error || r.exclusion_reason || ""}>
                      {r.last_error || r.exclusion_reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
