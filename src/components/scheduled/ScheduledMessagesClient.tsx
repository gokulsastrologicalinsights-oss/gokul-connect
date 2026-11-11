"use client";

import React, { useState, useMemo } from "react";
import {
  Business,
  BusinessMember,
  SafeWhatsAppConnection,
  ScheduledMessageFilters,
  ScheduledMessagesSummaryStats,
  ScheduledMessageStatus,
  ScheduledMessageType,
  UserProfile,
  WhatsAppMessageTemplate,
  WhatsAppScheduledMessage,
} from "@/types/database";
import {
  cancelScheduledMessageAction,
  createScheduledMessageAction,
  deleteDraftScheduledMessageAction,
  rescheduleMessageAction,
  retryScheduledMessageAction,
  triggerScheduledWorkerAction,
} from "@/app/actions/scheduled";
import { formatKolkataDate } from "@/lib/analytics/date-utils";
import { ScheduleMessageModal } from "./ScheduleMessageModal";
import { RescheduleModal } from "./RescheduleModal";
import { CancelConfirmModal } from "./CancelConfirmModal";
import { ScheduledMessageDetailModal } from "./ScheduledMessageDetailModal";
import {
  CalendarClock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  AlertCircle,
  XCircle,
  FileEdit,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  MoreVertical,
  Calendar,
  RefreshCw,
  Phone,
  Eye,
} from "lucide-react";

interface ScheduledMessagesClientProps {
  business: Business;
  currentUser: UserProfile;
  currentMembership: BusinessMember;
  initialMessages: WhatsAppScheduledMessage[];
  initialStats: ScheduledMessagesSummaryStats;
  connections: SafeWhatsAppConnection[];
  templates: WhatsAppMessageTemplate[];
  recentRecipients: Array<{ phone: string; name?: string; conversationId?: string }>;
}

export function ScheduledMessagesClient({
  business,
  currentUser,
  currentMembership,
  initialMessages,
  initialStats,
  connections,
  templates,
  recentRecipients,
}: ScheduledMessagesClientProps) {
  const [messages, setMessages] = useState<WhatsAppScheduledMessage[]>(initialMessages);
  const [stats, setStats] = useState<ScheduledMessagesSummaryStats>(initialStats);

  // Filter states
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [connectionFilter, setConnectionFilter] = useState<string>("all");

  // Modals state
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [selectedMessageForDetail, setSelectedMessageForDetail] =
    useState<WhatsAppScheduledMessage | null>(null);
  const [messageToReschedule, setMessageToReschedule] =
    useState<WhatsAppScheduledMessage | null>(null);
  const [messageToCancel, setMessageToCancel] =
    useState<WhatsAppScheduledMessage | null>(null);

  // Notification Banner
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Worker trigger state (Owner/Admin only)
  const [isTriggeringWorker, setIsTriggeringWorker] = useState<boolean>(false);

  const canEdit = ["owner", "admin", "agent"].includes(currentMembership.role);
  const isAdmin = ["owner", "admin"].includes(currentMembership.role);

  const showBanner = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  // Filtered messages calculation
  const filteredMessages = useMemo(() => {
    let list = [...messages];
    const nowMs = Date.now();

    // Tab filter: upcoming vs past
    if (activeTab === "upcoming") {
      list = list.filter(
        (m) =>
          ["scheduled", "draft", "processing"].includes(m.status) &&
          new Date(m.scheduled_at).getTime() >= nowMs - 60_000
      );
      list.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    } else {
      list = list.filter(
        (m) =>
          ["sent", "delivered", "read", "failed", "cancelled"].includes(m.status) ||
          new Date(m.scheduled_at).getTime() < nowMs - 60_000
      );
      list.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((m) => m.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      list = list.filter((m) => m.message_type === typeFilter);
    }

    // Connection filter
    if (connectionFilter !== "all") {
      list = list.filter((m) => m.connection_id === connectionFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.recipient_phone.toLowerCase().includes(q) ||
          (m.recipient_name && m.recipient_name.toLowerCase().includes(q)) ||
          (m.content && m.content.toLowerCase().includes(q)) ||
          (m.template_name && m.template_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [messages, activeTab, statusFilter, typeFilter, connectionFilter, searchQuery]);

  // Recalculate summary stats
  const updateStatsLocal = (items: WhatsAppScheduledMessage[]) => {
    const newStats: ScheduledMessagesSummaryStats = {
      upcomingCount: 0,
      sentCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      draftCount: 0,
      totalCount: items.length,
    };
    for (const m of items) {
      if (m.status === "scheduled" || m.status === "processing") {
        newStats.upcomingCount++;
      } else if (["sent", "delivered", "read"].includes(m.status)) {
        newStats.sentCount++;
      } else if (m.status === "failed") {
        newStats.failedCount++;
      } else if (m.status === "cancelled") {
        newStats.cancelledCount++;
      } else if (m.status === "draft") {
        newStats.draftCount++;
      }
    }
    setStats(newStats);
  };

  // Actions
  const handleScheduleSubmit = async (payload: any): Promise<boolean> => {
    const res = await createScheduledMessageAction(payload);
    if (res.success && res.message) {
      const updated = [res.message, ...messages];
      setMessages(updated);
      updateStatsLocal(updated);
      showBanner("success", `Message scheduled successfully for ${res.message.recipient_phone}!`);
      return true;
    } else {
      showBanner("error", res.error || "Failed to schedule message.");
      return false;
    }
  };

  const handleRescheduleConfirm = async (
    messageId: string,
    newScheduledAt: string
  ): Promise<boolean> => {
    const res = await rescheduleMessageAction(business.slug, messageId, newScheduledAt);
    if (res.success && res.message) {
      const updated = messages.map((m) => (m.id === messageId ? res.message! : m));
      setMessages(updated);
      updateStatsLocal(updated);
      showBanner("success", "Message rescheduled successfully!");
      return true;
    } else {
      showBanner("error", res.error || "Failed to reschedule message.");
      return false;
    }
  };

  const handleCancelConfirm = async (
    messageId: string,
    reason?: string
  ): Promise<boolean> => {
    const res = await cancelScheduledMessageAction({
      businessSlug: business.slug,
      messageId,
      reason,
    });
    if (res.success && res.message) {
      const updated = messages.map((m) => (m.id === messageId ? res.message! : m));
      setMessages(updated);
      updateStatsLocal(updated);
      showBanner("success", "Scheduled message cancelled.");
      return true;
    } else {
      showBanner("error", res.error || "Failed to cancel message.");
      return false;
    }
  };

  const handleRetryMessage = async (messageId: string) => {
    const res = await retryScheduledMessageAction({
      businessSlug: business.slug,
      messageId,
    });
    if (res.success && res.message) {
      const updated = messages.map((m) => (m.id === messageId ? res.message! : m));
      setMessages(updated);
      updateStatsLocal(updated);
      showBanner("success", "Message scheduled for immediate retry dispatch.");
    } else {
      showBanner("error", res.error || "Failed to retry message.");
    }
  };

  const handleDeleteDraft = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this draft message?")) return;
    const res = await deleteDraftScheduledMessageAction(business.slug, messageId);
    if (res.success) {
      const updated = messages.filter((m) => m.id !== messageId);
      setMessages(updated);
      updateStatsLocal(updated);
      showBanner("success", "Draft message deleted.");
    } else {
      showBanner("error", res.error || "Failed to delete draft message.");
    }
  };

  const handleTriggerWorker = async () => {
    setIsTriggeringWorker(true);
    try {
      const res = await triggerScheduledWorkerAction(business.slug);
      if (res.success) {
        showBanner(
          "success",
          `Worker executed: ${res.result?.succeededCount || 0} dispatched, ${res.result?.failedCount || 0} failed.`
        );
      } else {
        showBanner("error", res.error || "Worker run failed.");
      }
    } finally {
      setIsTriggeringWorker(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200 animate-pulse";
      case "sent":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "delivered":
        return "bg-teal-100 text-teal-800 border-teal-200";
      case "read":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "failed":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "cancelled":
        return "bg-slate-200 text-slate-700 border-slate-300";
      case "draft":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Alert */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium shadow-sm transition ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Scheduled Messages</h1>
              <p className="text-xs text-slate-500">
                Workspace: <span className="font-semibold text-purple-700">{business.name}</span>{" "}
                • Timezone: <span className="font-mono font-medium text-slate-700">Asia/Kolkata (IST)</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {isAdmin && (
            <button
              onClick={handleTriggerWorker}
              disabled={isTriggeringWorker}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-sm flex items-center space-x-1.5 transition disabled:opacity-50"
              title="Trigger dispatch worker immediately"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTriggeringWorker ? "animate-spin" : ""}`} />
              <span>{isTriggeringWorker ? "Dispatching..." : "Run Dispatch Worker"}</span>
            </button>
          )}

          {canEdit && (
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm flex items-center space-x-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Message</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Upcoming</span>
            <span className="text-xl font-bold text-purple-900">{stats.upcomingCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
            <Send className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Dispatched</span>
            <span className="text-xl font-bold text-emerald-900">{stats.sentCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
            <XCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Failed</span>
            <span className="text-xl font-bold text-rose-900">{stats.failedCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Cancelled</span>
            <span className="text-xl font-bold text-slate-800">{stats.cancelledCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3 col-span-2 md:col-span-1">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <FileEdit className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block">Drafts</span>
            <span className="text-xl font-bold text-amber-900">{stats.draftCount}</span>
          </div>
        </div>
      </div>

      {/* Main Container: Tabs & Search Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="px-5 border-b border-slate-200 flex items-center space-x-6">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`py-3.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition ${
              activeTab === "upcoming"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Upcoming & Scheduled</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800 font-semibold">
              {stats.upcomingCount + stats.draftCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("past")}
            className={`py-3.5 text-xs font-bold border-b-2 flex items-center space-x-2 transition ${
              activeTab === "past"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Past & History</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-semibold">
              {stats.sentCount + stats.failedCount + stats.cancelledCount}
            </span>
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search phone, recipient, or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            >
              <option value="all">All Statuses</option>
              {activeTab === "upcoming" ? (
                <>
                  <option value="scheduled">Scheduled</option>
                  <option value="processing">Processing</option>
                  <option value="draft">Draft</option>
                </>
              ) : (
                <>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </>
              )}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Format:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            >
              <option value="all">All Formats</option>
              <option value="text">Plain Text</option>
              <option value="template">Meta Template</option>
              <option value="image">Image</option>
              <option value="document">Document</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </select>
          </div>

          {/* Connection Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 font-medium">Sender:</span>
            <select
              value={connectionFilter}
              onChange={(e) => setConnectionFilter(e.target.value)}
              className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white truncate"
            >
              <option value="all">All Numbers</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name} ({c.phone_number})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Message List Table / Cards */}
        {filteredMessages.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <CalendarClock className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No scheduled messages found.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {activeTab === "upcoming"
                ? "You have no upcoming messages matching the current filters. Schedule one now to engage customers automatically."
                : "No past messages found matching the filter criteria."}
            </p>
            {canEdit && activeTab === "upcoming" && (
              <button
                onClick={() => setShowScheduleModal(true)}
                className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 transition inline-flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule a Message</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Preview</th>
                  <th className="py-3 px-4">Scheduled For (IST)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMessages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-purple-50/30 transition group">
                    {/* Recipient */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 font-mono">
                        {msg.recipient_phone}
                      </div>
                      {msg.recipient_name && (
                        <div className="text-[11px] text-slate-500">{msg.recipient_name}</div>
                      )}
                    </td>

                    {/* Format */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 capitalize font-medium text-slate-700">
                        {msg.message_type === "template" ? (
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        ) : msg.message_type === "text" ? (
                          <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                        ) : (
                          <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                        )}
                        <span>{msg.message_type}</span>
                      </span>
                      {msg.template_name && (
                        <div className="text-[10px] text-purple-700 font-medium truncate max-w-[120px]">
                          {msg.template_name}
                        </div>
                      )}
                    </td>

                    {/* Preview */}
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                      {msg.content ? (
                        msg.content
                      ) : msg.template_name ? (
                        <span className="italic text-purple-800">[Template: {msg.template_name}]</span>
                      ) : msg.media_filename ? (
                        <span className="font-medium text-slate-800">
                          📎 {msg.media_filename}
                          {msg.media_caption && ` — "${msg.media_caption}"`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Scheduled For */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900 font-mono">
                        {formatKolkataDate(msg.scheduled_at, true)}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusBadge(
                          msg.status
                        )}`}
                      >
                        {msg.status}
                      </span>
                      {msg.last_error && msg.status === "failed" && (
                        <div className="text-[10px] text-rose-600 truncate max-w-[140px] mt-0.5" title={msg.last_error}>
                          {msg.last_error}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setSelectedMessageForDetail(msg)}
                          className="p-1.5 text-slate-400 hover:text-purple-700 rounded-lg hover:bg-slate-100 transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {canEdit && ["scheduled", "draft"].includes(msg.status) && (
                          <>
                            <button
                              onClick={() => setMessageToReschedule(msg)}
                              className="px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => setMessageToCancel(msg)}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {canEdit && msg.status === "failed" && (
                          <button
                            onClick={() => handleRetryMessage(msg.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
                          >
                            Retry
                          </button>
                        )}

                        {canEdit && msg.status === "draft" && (
                          <button
                            onClick={() => handleDeleteDraft(msg.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Schedule Message Modal */}
      {showScheduleModal && (
        <ScheduleMessageModal
          business={business}
          connections={connections}
          templates={templates}
          recentRecipients={recentRecipients}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={handleScheduleSubmit}
        />
      )}

      {/* Reschedule Modal */}
      {messageToReschedule && (
        <RescheduleModal
          message={messageToReschedule}
          onClose={() => setMessageToReschedule(null)}
          onReschedule={handleRescheduleConfirm}
        />
      )}

      {/* Cancel Confirmation Modal */}
      {messageToCancel && (
        <CancelConfirmModal
          message={messageToCancel}
          onClose={() => setMessageToCancel(null)}
          onConfirm={handleCancelConfirm}
        />
      )}

      {/* Details Modal */}
      {selectedMessageForDetail && (
        <ScheduledMessageDetailModal
          message={selectedMessageForDetail}
          onClose={() => setSelectedMessageForDetail(null)}
          onReschedule={() => setMessageToReschedule(selectedMessageForDetail)}
          onCancel={() => setMessageToCancel(selectedMessageForDetail)}
          onRetry={() => handleRetryMessage(selectedMessageForDetail.id)}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
