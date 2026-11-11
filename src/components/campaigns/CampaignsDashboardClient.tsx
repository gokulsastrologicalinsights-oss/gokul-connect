"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Business,
  BusinessMember,
  CampaignFilterOptions,
  CampaignMessageType,
  CampaignStatus,
  CampaignSummaryStats,
  UserProfile,
  WhatsAppCampaign,
} from "@/types/database";
import {
  cancelCampaignAction,
  deleteDraftCampaignAction,
  launchCampaignAction,
  pauseCampaignAction,
  resumeCampaignAction,
} from "@/app/actions/campaigns";
import { formatKolkataDate } from "@/lib/analytics/date-utils";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  FileEdit,
  FileText,
  Filter,
  Image as ImageIcon,
  MessageSquare,
  Megaphone,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  XCircle,
  Eye,
  Trash2,
} from "lucide-react";

interface CampaignsDashboardClientProps {
  business: Business;
  currentUser: UserProfile;
  currentMembership: BusinessMember;
  initialCampaigns: WhatsAppCampaign[];
  initialStats: CampaignSummaryStats;
}

export function CampaignsDashboardClient({
  business,
  currentUser,
  currentMembership,
  initialCampaigns,
  initialStats,
}: CampaignsDashboardClientProps) {
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>(initialCampaigns);
  const [stats, setStats] = useState<CampaignSummaryStats>(initialStats);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "scheduled" | "drafts" | "completed">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canMutate = ["owner", "admin"].includes(currentMembership.role);
  const canOperate = ["owner", "admin", "agent"].includes(currentMembership.role);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      // Tab filter
      if (activeTab === "active" && !["preparing", "queued", "sending", "paused"].includes(c.status)) {
        return false;
      }
      if (activeTab === "scheduled" && c.status !== "scheduled") {
        return false;
      }
      if (activeTab === "drafts" && c.status !== "draft") {
        return false;
      }
      if (activeTab === "completed" && !["completed", "failed", "cancelled"].includes(c.status)) {
        return false;
      }

      // Dropdown filters
      if (statusFilter !== "all" && c.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== "all" && c.message_type !== typeFilter) {
        return false;
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesDesc = c.description ? c.description.toLowerCase().includes(q) : false;
        const matchesTemplate = c.template_name ? c.template_name.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesDesc && !matchesTemplate) return false;
      }

      return true;
    });
  }, [campaigns, activeTab, statusFilter, typeFilter, searchQuery]);

  // Handle Pause
  const handlePause = async (campaignId: string) => {
    setActionLoadingId(campaignId);
    setActionError(null);
    try {
      const res = await pauseCampaignAction(business.slug, campaignId);
      if (res.success && res.campaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? res.campaign! : c)));
      } else {
        setActionError(res.error || "Failed to pause campaign.");
      }
    } catch (err: any) {
      setActionError(err.message || "An unexpected error occurred.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Resume
  const handleResume = async (campaignId: string) => {
    setActionLoadingId(campaignId);
    setActionError(null);
    try {
      const res = await resumeCampaignAction(business.slug, campaignId);
      if (res.success && res.campaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? res.campaign! : c)));
      } else {
        setActionError(res.error || "Failed to resume campaign.");
      }
    } catch (err: any) {
      setActionError(err.message || "An unexpected error occurred.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Cancel
  const handleCancel = async (campaignId: string) => {
    if (!confirm("Are you sure you want to cancel this campaign? Pending messages will not be sent.")) {
      return;
    }
    setActionLoadingId(campaignId);
    setActionError(null);
    try {
      const res = await cancelCampaignAction(business.slug, campaignId);
      if (res.success && res.campaign) {
        setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? res.campaign! : c)));
      } else {
        setActionError(res.error || "Failed to cancel campaign.");
      }
    } catch (err: any) {
      setActionError(err.message || "An unexpected error occurred.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Delete Draft
  const handleDeleteDraft = async (campaignId: string) => {
    if (!confirm("Are you sure you want to delete this draft campaign? This cannot be undone.")) {
      return;
    }
    setActionLoadingId(campaignId);
    setActionError(null);
    try {
      const res = await deleteDraftCampaignAction(business.slug, campaignId);
      if (res.success) {
        setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      } else {
        setActionError(res.error || "Failed to delete draft.");
      }
    } catch (err: any) {
      setActionError(err.message || "An unexpected error occurred.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case "draft":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <FileEdit className="w-3 h-3" /> Draft
          </span>
        );
      case "scheduled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <Clock className="w-3 h-3" /> Scheduled
          </span>
        );
      case "preparing":
      case "queued":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> {status === "preparing" ? "Preparing" : "Queued"}
          </span>
        );
      case "sending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Send className="w-3 h-3" /> Sending
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
            <Pause className="w-3 h-3" /> Paused
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-300">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return null;
    }
  };

  const getMessageTypeBadge = (type: CampaignMessageType) => {
    switch (type) {
      case "template":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <FileText className="w-3 h-3" /> Template
          </span>
        );
      case "text":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            <MessageSquare className="w-3 h-3" /> Text
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <ImageIcon className="w-3 h-3" /> {type.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Megaphone className="w-7 h-7 text-indigo-600" />
            WhatsApp Campaigns
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create, target, schedule, and track compliant bulk messaging campaigns for {business.name}.
          </p>
        </div>
        {canMutate && (
          <Link
            href={`/workspace/${business.slug}/campaigns/new`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Campaign
          </Link>
        )}
      </div>

      {actionError && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Campaigns</span>
            <Megaphone className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.totalCampaigns}</div>
          <div className="mt-1 text-xs text-slate-500">
            {stats.activeCampaigns} active, {stats.scheduledCampaigns} scheduled
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Messages Sent</span>
            <Send className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.totalSent}</div>
          <div className="mt-1 text-xs text-slate-500">Across {stats.completedCampaigns} completed campaigns</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Delivery Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{stats.deliveryRate}%</div>
          <div className="mt-1 text-xs text-slate-500">{stats.totalDelivered} messages confirmed delivered</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Read Rate</span>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">{stats.readRate}%</div>
          <div className="mt-1 text-xs text-slate-500">{stats.totalRead} messages opened by recipients</div>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "all"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            All Campaigns ({campaigns.length})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "active"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Active ({campaigns.filter((c) => ["preparing", "queued", "sending", "paused"].includes(c.status)).length})
          </button>
          <button
            onClick={() => setActiveTab("scheduled")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "scheduled"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Scheduled ({campaigns.filter((c) => c.status === "scheduled").length})
          </button>
          <button
            onClick={() => setActiveTab("drafts")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "drafts"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Drafts ({campaigns.filter((c) => c.status === "draft").length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "completed"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Completed ({campaigns.filter((c) => ["completed", "failed", "cancelled"].includes(c.status)).length})
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-60"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 py-1.5 px-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Types</option>
            <option value="template">Template</option>
            <option value="text">Text</option>
            <option value="image">Image</option>
            <option value="document">Document</option>
            <option value="video">Video</option>
          </select>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {filteredCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <Megaphone className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">No campaigns found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Create your first WhatsApp campaign to engage your customers."}
            </p>
            {canMutate && !searchQuery && (
              <div className="mt-5">
                <Link
                  href={`/workspace/${business.slug}/campaigns/new`}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  <Plus className="w-4 h-4" /> Create Campaign
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Campaign Name</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Audience & Delivery Progress</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCampaigns.map((c) => {
                  const percentSent =
                    c.eligible_count > 0 ? Math.min(100, Math.round((c.sent_count / c.eligible_count) * 100)) : 0;
                  const percentDelivered =
                    c.sent_count > 0 ? Math.min(100, Math.round((c.delivered_count / c.sent_count) * 100)) : 0;
                  const isLoading = actionLoadingId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/workspace/${business.slug}/campaigns/${c.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 flex items-center gap-1.5"
                        >
                          {c.name}
                        </Link>
                        {c.description && (
                          <p className="text-xs text-slate-500 truncate max-w-sm mt-0.5">{c.description}</p>
                        )}
                        {c.template_name && (
                          <p className="text-xs font-mono text-slate-400 mt-0.5">Template: {c.template_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{getStatusBadge(c.status)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{getMessageTypeBadge(c.message_type)}</td>
                      <td className="px-4 py-4 min-w-[200px]">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-600">
                            <span>
                              {c.sent_count} / {c.eligible_count} sent
                            </span>
                            <span className="font-medium text-slate-700">{percentSent}%</span>
                          </div>
                          {/* Progress bar */}
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                              style={{ width: `${percentSent}%` }}
                            />
                          </div>
                          <div className="flex gap-2 text-[11px] text-slate-400">
                            <span>Delivered: {c.delivered_count}</span>
                            <span>•</span>
                            <span>Read: {c.read_count}</span>
                            {c.failed_count > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-rose-600 font-medium">Failed: {c.failed_count}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {c.scheduled_at ? (
                          <div>
                            <span className="font-medium text-purple-700">Scheduled:</span>
                            <div>{formatKolkataDate(c.scheduled_at)}</div>
                          </div>
                        ) : c.started_at ? (
                          <div>
                            <span>Sent:</span>
                            <div>{formatKolkataDate(c.started_at)}</div>
                          </div>
                        ) : (
                          <div>
                            <span>Created:</span>
                            <div>{formatKolkataDate(c.created_at)}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/workspace/${business.slug}/campaigns/${c.id}`}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                            title="View Campaign Details & Analytics"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {canOperate && (c.status === "sending" || c.status === "queued") && (
                            <button
                              onClick={() => handlePause(c.id)}
                              disabled={isLoading}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              title="Pause Campaign"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}

                          {canOperate && c.status === "paused" && (
                            <button
                              onClick={() => handleResume(c.id)}
                              disabled={isLoading}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                              title="Resume Campaign"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}

                          {canMutate && ["draft", "scheduled", "preparing", "queued", "paused"].includes(c.status) && (
                            <button
                              onClick={() => handleCancel(c.id)}
                              disabled={isLoading}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                              title="Cancel Campaign"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}

                          {canMutate && c.status === "draft" && (
                            <button
                              onClick={() => handleDeleteDraft(c.id)}
                              disabled={isLoading}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                              title="Delete Draft"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
