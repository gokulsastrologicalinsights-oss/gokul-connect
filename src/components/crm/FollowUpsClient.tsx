"use client";

import React, { useState, useTransition } from "react";
import {
  Business,
  BusinessMember,
  UserProfile,
  CrmFollowUp,
  FollowUpMetrics,
  CrmLifecycleStage,
  WhatsAppContact,
  FollowUpPriority,
  FollowUpStatus,
} from "@/types/database";
import {
  CheckSquare,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  User,
  MessageSquare,
  MoreVertical,
  CalendarClock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import {
  createFollowUpAction,
  completeFollowUpAction,
  rescheduleFollowUpAction,
  cancelFollowUpAction,
  getFollowUpsAction,
  getFollowUpMetricsAction,
} from "@/app/actions/crm";

interface FollowUpsClientProps {
  business: Business;
  currentUser: UserProfile;
  currentMembership: BusinessMember;
  initialFollowUps: CrmFollowUp[];
  initialMetrics: FollowUpMetrics;
  stages: CrmLifecycleStage[];
  contacts: WhatsAppContact[];
}

export function FollowUpsClient({
  business,
  currentUser,
  currentMembership,
  initialFollowUps,
  initialMetrics,
  stages,
  contacts,
}: FollowUpsClientProps) {
  const [followUps, setFollowUps] = useState<CrmFollowUp[]>(initialFollowUps);
  const [metrics, setMetrics] = useState<FollowUpMetrics>(initialMetrics);
  const [activeTab, setActiveTab] = useState<
    "all" | "today" | "upcoming" | "overdue" | "assigned_to_me" | "completed"
  >("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<CrmFollowUp | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<CrmFollowUp | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CrmFollowUp | null>(null);

  // Form states
  const [newContactId, setNewContactId] = useState(contacts[0]?.id || "");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<FollowUpPriority>("normal");
  const [newDueAt, setNewDueAt] = useState("");

  const [completionNotes, setCompletionNotes] = useState("");
  const [updateStageSlug, setUpdateStageSlug] = useState("");

  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const isViewer = currentMembership.role === "viewer";

  // Refresh follow ups & metrics
  const refreshData = () => {
    startTransition(async () => {
      const [fuRes, mRes] = await Promise.all([
        getFollowUpsAction(business.slug, {
          tab: activeTab,
          priority: priorityFilter !== "all" ? (priorityFilter as FollowUpPriority) : undefined,
          search: searchQuery.trim() || undefined,
        }),
        getFollowUpMetricsAction(business.slug),
      ]);
      if (fuRes.success) setFollowUps(fuRes.followUps);
      if (mRes.success && mRes.metrics) setMetrics(mRes.metrics);
    });
  };

  // Switch tab
  const handleTabChange = (
    tab: "all" | "today" | "upcoming" | "overdue" | "assigned_to_me" | "completed"
  ) => {
    setActiveTab(tab);
    startTransition(async () => {
      const res = await getFollowUpsAction(business.slug, {
        tab,
        priority: priorityFilter !== "all" ? (priorityFilter as FollowUpPriority) : undefined,
        search: searchQuery.trim() || undefined,
      });
      if (res.success) setFollowUps(res.followUps);
    });
  };

  // Submit create follow-up
  const handleCreateFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactId || !newTitle.trim() || !newDueAt) return;
    setActionError(null);

    startTransition(async () => {
      const res = await createFollowUpAction(business.slug, {
        contactId: newContactId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        priority: newPriority,
        dueAt: new Date(newDueAt).toISOString(),
      });

      if (!res.success) {
        setActionError(res.error || "Failed to create follow-up.");
      } else {
        setIsCreateOpen(false);
        setNewTitle("");
        setNewDescription("");
        setNewDueAt("");
        refreshData();
      }
    });
  };

  // Submit complete follow-up
  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeTarget) return;
    setActionError(null);

    startTransition(async () => {
      const res = await completeFollowUpAction(
        business.slug,
        completeTarget.id,
        completionNotes.trim() || undefined,
        updateStageSlug || undefined
      );

      if (!res.success) {
        setActionError(res.error || "Failed to complete follow-up.");
      } else {
        setCompleteTarget(null);
        setCompletionNotes("");
        setUpdateStageSlug("");
        refreshData();
      }
    });
  };

  // Submit reschedule follow-up
  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !rescheduleDate) return;
    setActionError(null);

    startTransition(async () => {
      const res = await rescheduleFollowUpAction(
        business.slug,
        rescheduleTarget.id,
        new Date(rescheduleDate).toISOString(),
        rescheduleReason.trim() || undefined
      );

      if (!res.success) {
        setActionError(res.error || "Failed to reschedule follow-up.");
      } else {
        setRescheduleTarget(null);
        setRescheduleDate("");
        setRescheduleReason("");
        refreshData();
      }
    });
  };

  // Submit cancel follow-up
  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setActionError(null);

    startTransition(async () => {
      const res = await cancelFollowUpAction(
        business.slug,
        cancelTarget.id,
        cancelReason.trim() || undefined
      );

      if (!res.success) {
        setActionError(res.error || "Failed to cancel follow-up.");
      } else {
        setCancelTarget(null);
        setCancelReason("");
        refreshData();
      }
    });
  };

  const formatIST = (dateIso: string) => {
    const d = new Date(dateIso);
    if (isNaN(d.getTime())) return dateIso;
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isDueToday = (dateIso: string) => {
    const d = new Date(dateIso);
    const now = new Date();
    const nowStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return nowStr === dateStr;
  };

  const isItemOverdue = (dateIso: string, status: FollowUpStatus) => {
    if (status === "completed" || status === "cancelled") return false;
    return new Date(dateIso).getTime() < Date.now();
  };

  const getPriorityBadge = (p: FollowUpPriority) => {
    switch (p) {
      case "urgent":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">Urgent</span>;
      case "high":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">High</span>;
      case "normal":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700">Normal</span>;
      case "low":
        return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 text-slate-700">Low</span>;
    }
  };

  const getStatusBadge = (s: FollowUpStatus) => {
    switch (s) {
      case "open":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700">Open</span>;
      case "in_progress":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-sky-100 text-sky-700">In Progress</span>;
      case "completed":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">Completed</span>;
      case "cancelled":
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-rose-100 text-rose-700">Cancelled</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wide">
              {business.name}
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Timezone: Asia/Kolkata (IST)
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">CRM Follow-up Management</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Track customer commitments, follow-up deadlines, and internal agent reminders.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/workspace/${business.slug}/crm`}
            className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            ← Back to CRM
          </Link>
          {!isViewer && (
            <button
              onClick={() => {
                setActionError(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              New Follow-up
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Due Today</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{metrics.todayCount ?? metrics.dueTodayFollowUps ?? 0}</span>
            <span className="text-xs text-slate-500">tasks today</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Upcoming</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{metrics.upcomingCount ?? 0}</span>
            <span className="text-xs text-slate-500">scheduled ahead</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overdue</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600">{metrics.overdueCount ?? metrics.overdueFollowUps ?? 0}</span>
            <span className="text-xs text-rose-500 font-medium">requires attention</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Completion Rate</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">{metrics.completionRate}%</span>
            <span className="text-xs text-slate-500">{metrics.completedCount ?? metrics.completedFollowUps ?? 0} done</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, metrics.completionRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs and Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 pt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { id: "all", label: "All Tasks" },
              { id: "today", label: "Due Today" },
              { id: "upcoming", label: "Upcoming" },
              { id: "overdue", label: "Overdue" },
              { id: "assigned_to_me", label: "Assigned to Me" },
              { id: "completed", label: "Completed" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as any)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition -mb-px ${
                  activeTab === tab.id
                    ? "border-emerald-600 text-emerald-700 font-semibold"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 pb-3 sm:pb-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refreshData()}
                placeholder="Search task or contact..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-48 sm:w-56 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                startTransition(async () => {
                  const res = await getFollowUpsAction(business.slug, {
                    tab: activeTab,
                    priority: e.target.value !== "all" ? (e.target.value as FollowUpPriority) : undefined,
                    search: searchQuery.trim() || undefined,
                  });
                  if (res.success) setFollowUps(res.followUps);
                });
              }}
              className="py-1.5 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="m-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {actionError}
            </span>
            <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Follow-ups List */}
        <div className="divide-y divide-slate-100">
          {followUps.length === 0 ? (
            <div className="p-12 text-center">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-800">No follow-up tasks found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {activeTab === "overdue"
                  ? "Great job! There are no overdue follow-ups."
                  : "No tasks match your current filter criteria."}
              </p>
              {!isViewer && activeTab === "all" && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create First Follow-up
                </button>
              )}
            </div>
          ) : (
            followUps.map((fu) => {
              const overdue = isItemOverdue(fu.due_at, fu.status);
              const today = isDueToday(fu.due_at);

              return (
                <div
                  key={fu.id}
                  className={`p-4 hover:bg-slate-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    overdue ? "bg-rose-50/40" : ""
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {getPriorityBadge(fu.priority)}
                      {getStatusBadge(fu.status)}

                      {overdue && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-100 text-rose-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Overdue
                        </span>
                      )}

                      {today && !overdue && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-700 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Due Today
                        </span>
                      )}

                      <span className="text-xs text-slate-400 font-mono">
                        Due: {formatIST(fu.due_at)}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                      {fu.title}
                    </h4>

                    {fu.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 max-w-xl">
                        {fu.description}
                      </p>
                    )}

                    {fu.contact && (
                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                        <span className="font-medium text-slate-800">
                          {fu.contact.display_name || "Unnamed Contact"}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{fu.contact.phone_number}</span>
                        {fu.contact.category && (
                          <>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">
                              {fu.contact.category}
                            </span>
                          </>
                        )}
                        {fu.contact.lifecycle_stage_slug && (
                          <>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium">
                              Stage: {fu.contact.lifecycle_stage_slug}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {fu.completion_notes && fu.status === "completed" && (
                      <div className="mt-1 p-2 bg-emerald-50 rounded text-xs text-emerald-800 border border-emerald-100">
                        <span className="font-medium">Completion Note:</span> {fu.completion_notes}
                      </div>
                    )}

                    {fu.cancellation_reason && fu.status === "cancelled" && (
                      <div className="mt-1 p-2 bg-rose-50 rounded text-xs text-rose-800 border border-rose-100">
                        <span className="font-medium">Cancellation Reason:</span> {fu.cancellation_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {fu.contact && (
                      <Link
                        href={`/workspace/${business.slug}/inbox?contactId=${fu.contact_id}`}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Open in WhatsApp Inbox"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Link>
                    )}

                    {!isViewer && (fu.status === "open" || fu.status === "in_progress") && (
                      <>
                        <button
                          onClick={() => {
                            setActionError(null);
                            setCompleteTarget(fu);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition"
                        >
                          Complete
                        </button>

                        <button
                          onClick={() => {
                            setActionError(null);
                            setRescheduleTarget(fu);
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                        >
                          Reschedule
                        </button>

                        <button
                          onClick={() => {
                            setActionError(null);
                            setCancelTarget(fu);
                          }}
                          className="px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL 1: Create Follow-up */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Schedule New Follow-up</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a task for a contact with deadline and priority.
            </p>

            <form onSubmit={handleCreateFollowUp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Contact <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newContactId}
                  onChange={(e) => setNewContactId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                  required
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name || "Unnamed"} ({c.phone_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Call for horoscope clarification"
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description / Notes
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Additional context or questions for this follow-up..."
                  rows={2}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as FollowUpPriority)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Due Date & Time (IST) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={newDueAt}
                    onChange={(e) => setNewDueAt(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                >
                  {isPending ? "Creating..." : "Create Follow-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Complete Follow-up */}
      {completeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Mark Follow-up as Completed</h3>
            <p className="text-xs text-slate-500 mb-4">
              "{completeTarget.title}"
            </p>

            <form onSubmit={handleCompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Completion Notes (Optional)
                </label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Record summary of call, client response, or outcome..."
                  rows={3}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Update Contact Lifecycle Stage (Optional)
                </label>
                <select
                  value={updateStageSlug}
                  onChange={(e) => setUpdateStageSlug(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Keep current stage</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.slug}>
                      Advance to: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompleteTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                >
                  {isPending ? "Completing..." : "Complete Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reschedule Follow-up */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Reschedule Follow-up</h3>
            <p className="text-xs text-slate-500 mb-4">
              "{rescheduleTarget.title}"
            </p>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Due Date & Time (IST) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason for Rescheduling
                </label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Client requested callback tomorrow afternoon"
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
                >
                  {isPending ? "Rescheduling..." : "Save New Time"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Cancel Follow-up */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Cancel Follow-up</h3>
            <p className="text-xs text-slate-500 mb-4">
              Are you sure you want to cancel "{cancelTarget.title}"?
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Cancellation Reason
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Client already finalized consultation"
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Keep Task
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition"
                >
                  {isPending ? "Cancelling..." : "Confirm Cancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
