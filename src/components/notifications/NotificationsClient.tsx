"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Calendar,
  UserCheck,
  Shield,
  ExternalLink,
  Trash2,
  Settings,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  SlidersHorizontal,
} from "lucide-react";
import {
  Business,
  CrmFollowUpReminder,
  NotificationCategory,
  NotificationStats,
  UserProfile,
  UserNotificationPreferences,
} from "@/types/database";
import { formatKolkataTimestamp } from "@/lib/notifications/date-utils";
import { Badge } from "@/components/ui/badge";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface NotificationsClientProps {
  business: Business;
  user: UserProfile;
}

export function NotificationsClient({ business, user }: NotificationsClientProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"all" | "unread" | "crm" | "team" | "system">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<CrmFollowUpReminder[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unreadCount: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    assignedCount: 0,
  });

  // Preferences modal state
  const [prefModalOpen, setPrefModalOpen] = useState(false);
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null);
  const [prefSaving, setPrefSaving] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        tab: activeTab,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(
        `/api/workspace/${business.slug}/notifications?${params.toString()}`
      );
      if (!res.ok) {
        throw new Error("Failed to load notifications.");
      }

      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        setTotalPages(data.totalPages || 1);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [business.slug, activeTab, page, limit, searchQuery]);

  // Load preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/workspace/${business.slug}/notifications/preferences`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPreferences(data.preferences);
        }
      }
    } catch {
      // offline
    }
  }, [business.slug]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Live Supabase Realtime subscription on crm_follow_up_reminders
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let supabase: any = null;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`notifications-page:${business.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_follow_up_reminders",
          filter: `business_id=eq.${business.id}`,
        },
        (payload: any) => {
          const targetUserId = payload?.new?.user_id || payload?.old?.user_id;
          if (user?.id && targetUserId && targetUserId !== user.id) {
            return;
          }
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [business.id, user?.id, fetchNotifications]);

  // Mark single as read
  const handleMarkRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      const res = await fetch(
        `/api/workspace/${business.slug}/notifications/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read" }),
        }
      );

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setStats((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }));
      }
    } catch {
      // silent
    }
  };

  // Dismiss single notification
  const handleDismiss = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      const res = await fetch(
        `/api/workspace/${business.slug}/notifications/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "dismiss" }),
        }
      );

      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        fetchNotifications();
      }
    } catch {
      // silent
    }
  };

  // Mark all read
  const handleMarkAllRead = async () => {
    try {
      const res = await fetch(`/api/workspace/${business.slug}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });

      if (res.ok) {
        fetchNotifications();
      }
    } catch {
      // silent
    }
  };

  // Dismiss all read
  const handleDismissAll = async () => {
    try {
      const res = await fetch(`/api/workspace/${business.slug}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss_all" }),
      });

      if (res.ok) {
        fetchNotifications();
      }
    } catch {
      // silent
    }
  };

  // Trigger manual reminder scan
  const handleGenerateReminders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workspace/${business.slug}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_reminders" }),
      });

      if (res.ok) {
        fetchNotifications();
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async () => {
    if (!preferences) return;
    try {
      setPrefSaving(true);
      const res = await fetch(
        `/api/workspace/${business.slug}/notifications/preferences`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preferences),
        }
      );

      if (res.ok) {
        setPrefModalOpen(false);
      }
    } catch {
      // silent
    } finally {
      setPrefSaving(false);
    }
  };

  // Icon & Badge helper
  const renderCategoryBadge = (reminderType: string) => {
    switch (reminderType) {
      case "due_today":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
            <Calendar className="h-3 w-3" />
            Due Today
          </span>
        );
      case "overdue":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3 w-3" />
            Overdue
          </span>
        );
      case "due_soon":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200">
            <Clock className="h-3 w-3" />
            Due Soon
          </span>
        );
      case "assigned":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200">
            <UserCheck className="h-3 w-3" />
            Assigned
          </span>
        );
      case "reassigned":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200">
            <UserCheck className="h-3 w-3" />
            Reassigned
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "team_invitation":
      case "team_member_joined":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 border border-purple-200">
            <Shield className="h-3 w-3" />
            Team
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
            <Bell className="h-3 w-3" />
            System
          </span>
        );
    }
  };

  const isAstrology = business.slug === "astrology";

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Notification Center
            </h1>
            <Badge variant={isAstrology ? "astrology" : "vivaham"}>
              {business.name}
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Real-time CRM follow-ups, team updates, and system notifications in{" "}
            <span className="font-medium text-slate-700">Asia/Kolkata</span> time.
          </p>
        </div>

        {/* Global Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleGenerateReminders}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Scan for due and overdue CRM tasks right now"
          >
            <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
            <span>Scan Reminders</span>
          </button>

          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={stats.unreadCount === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <CheckCheck className="h-3.5 w-3.5 text-slate-500" />
            <span>Mark All Read</span>
          </button>

          <button
            type="button"
            onClick={() => setPrefModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Card 1: Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Active</span>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <Bell className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</div>
          <p className="mt-1 text-[11px] text-slate-400">In this workspace</p>
        </div>

        {/* Card 2: Unread */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Unread</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <Check className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600">
            {stats.unreadCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Needs attention</p>
        </div>

        {/* Card 3: Due Today */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Due Today</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600">
            {stats.dueTodayCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Kolkata calendar day</p>
        </div>

        {/* Card 4: Overdue */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Overdue</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600">
            {stats.overdueCount}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Requires follow-up</p>
        </div>
      </div>

      {/* Main Filter & Tabs Bar */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "all", label: "All" },
              { id: "unread", label: "Unread" },
              { id: "crm", label: "CRM Follow-ups" },
              { id: "team", label: "Team" },
              { id: "system", label: "System" },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    isSelected
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                  {tab.id === "unread" && stats.unreadCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] text-white">
                      {stats.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Clear All Read Action */}
            <button
              type="button"
              onClick={handleDismissAll}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              title="Dismiss all read notifications"
            >
              <Trash2 className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden sm:inline">Clear Read</span>
            </button>
          </div>
        </div>

        {/* Notifications Listing */}
        <div className="divide-y divide-slate-100 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
              <p className="text-xs">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
              <p className="text-sm font-semibold text-slate-800">
                Failed to load notifications
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">{error}</p>
              <button
                type="button"
                onClick={fetchNotifications}
                className="mt-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <Check className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {activeTab === "unread"
                  ? "No unread notifications"
                  : "No notifications found"}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                {searchQuery
                  ? "No notifications match your current search query."
                  : activeTab === "unread"
                  ? "You have acknowledged all internal reminders and updates in this workspace."
                  : "Reminders will appear automatically as CRM follow-up due dates approach."}
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50/70 ${
                  !notif.is_read ? "bg-indigo-50/20" : ""
                }`}
              >
                {/* Left: Indicator, Title & Content */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Unread indicator */}
                  <div className="pt-1 shrink-0">
                    {!notif.is_read ? (
                      <span className="block h-2 w-2 rounded-full bg-indigo-600" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderCategoryBadge(notif.reminder_type)}
                      <h3
                        className={`text-sm truncate ${
                          !notif.is_read
                            ? "font-bold text-slate-900"
                            : "font-medium text-slate-700"
                        }`}
                      >
                        {notif.title}
                      </h3>
                    </div>

                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{formatKolkataTimestamp(notif.created_at)}</span>
                      {notif.is_read && notif.read_at && (
                        <span>• Read at {formatKolkataTimestamp(notif.read_at)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Quick Contextual Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {notif.action_url && (
                    <Link
                      href={notif.action_url}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-600 shadow-2xs hover:bg-indigo-50 hover:border-indigo-200"
                      onClick={() => {
                        if (!notif.is_read) handleMarkRead(notif.id);
                      }}
                    >
                      <span>Open Task</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}

                  {!notif.is_read ? (
                    <button
                      type="button"
                      onClick={(e) => handleMarkRead(notif.id, e)}
                      title="Mark as read"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 px-1">Read</span>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleDismiss(notif.id, e)}
                    title="Dismiss"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 p-4">
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notification Preferences Modal */}
      {prefModalOpen && preferences && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Notification Preferences
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure alerts for {user.full_name || user.email} in {business.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrefModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* In App Notifications master switch */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    In-App Notification Center
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Show notification badge and dropdown updates
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.in_app_enabled}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      in_app_enabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Due Today */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    Follow-ups Due Today
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Notify when tasks reach their due date in Asia/Kolkata time
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notify_due_today}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      notify_due_today: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Due Soon */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    Approaching Follow-ups (Due Soon)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Notify in advance before tasks become due
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notify_due_soon}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      notify_due_soon: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Overdue */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    Overdue Follow-ups
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Notify when open follow-up tasks miss their deadline
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notify_overdue}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      notify_overdue: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Assignments */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    Follow-up Assignments & Reassignments
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Notify when tasks are assigned or delegated to you
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notify_assigned}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      notify_assigned: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Team events */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <label className="text-xs font-semibold text-slate-800">
                    Team Membership & Invitations
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Notify on member invitation and role change events
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.notify_team_events}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      notify_team_events: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Lead Time Hours */}
              <div className="border-t border-slate-100 pt-3">
                <label className="text-xs font-semibold text-slate-800">
                  Advance Reminder Lead Time (Hours)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  How many hours before due date to generate &quot;Due Soon&quot; reminders
                </p>
                <select
                  value={preferences.lead_time_hours}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      lead_time_hours: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours (1 Day, Default)</option>
                  <option value={48}>48 Hours (2 Days)</option>
                  <option value={72}>72 Hours (3 Days)</option>
                  <option value={168}>168 Hours (1 Week)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setPrefModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreferences}
                disabled={prefSaving}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {prefSaving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
