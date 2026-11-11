"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  X,
  Loader2,
} from "lucide-react";
import { Business, CrmFollowUpReminder, NotificationStats } from "@/types/database";
import { formatKolkataTimestamp } from "@/lib/notifications/date-utils";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface NotificationBellProps {
  business: Business;
  userId?: string;
}

export function NotificationBell({ business, userId }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<CrmFollowUpReminder[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "connecting" | "polling">(
    isSupabaseConfigured() ? "connecting" : "polling"
  );
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unreadCount: 0,
    dueTodayCount: 0,
    overdueCount: 0,
    assignedCount: 0,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentBusinessIdRef = useRef<string>(business.id);

  // Fetch recent notifications and unread stats
  const fetchNotifications = useCallback(
    async (silent = false) => {
      const requestBusinessId = business.id;
      try {
        if (!silent) setLoading(true);
        const res = await fetch(
          `/api/workspace/${business.slug}/notifications?tab=unread&limit=5`
        );
        if (!res.ok) return;

        const data = await res.json();
        // Cross-tenant race protection: ignore stale response after business switch
        if (currentBusinessIdRef.current !== requestBusinessId) return;

        if (data.success) {
          setNotifications(data.notifications || []);
          if (data.stats) {
            setStats(data.stats);
          }
        }
      } catch {
        // offline / transient
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [business.id, business.slug]
  );

  // Strict tenant boundary: Clear state whenever business changes
  useEffect(() => {
    if (currentBusinessIdRef.current !== business.id) {
      currentBusinessIdRef.current = business.id;
      setNotifications([]);
      setStats({
        total: 0,
        unreadCount: 0,
        dueTodayCount: 0,
        overdueCount: 0,
        assignedCount: 0,
      });
      setIsOpen(false);
    }
    fetchNotifications(false);
  }, [business.id, fetchNotifications]);

  // Live Supabase Realtime subscription on crm_follow_up_reminders + local event sync
  useEffect(() => {
    const handleLocalSync = (e: any) => {
      if (!e?.detail?.businessId || e.detail.businessId === business.id) {
        fetchNotifications(true);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("workspace:notifications-sync", handleLocalSync);
    }

    if (!isSupabaseConfigured()) {
      setRealtimeStatus("polling");
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("workspace:notifications-sync", handleLocalSync);
        }
      };
    }

    let supabase: any = null;
    try {
      supabase = createClient();
    } catch {
      setRealtimeStatus("polling");
      return () => {
        if (typeof window !== "undefined") {
          window.removeEventListener("workspace:notifications-sync", handleLocalSync);
        }
      };
    }

    setRealtimeStatus("connecting");
    const channel = supabase
      .channel(`notifications:${business.id}`)
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
          if (userId && targetUserId && targetUserId !== userId) {
            return;
          }
          fetchNotifications(true);
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("polling");
        }
      });

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("workspace:notifications-sync", handleLocalSync);
      }
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [business.id, userId, fetchNotifications]);

  // Resilient fallback heartbeat (60s when Realtime subscribed, 15s when fallback polling)
  useEffect(() => {
    const intervalMs = realtimeStatus === "connected" ? 60000 : 15000;
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchNotifications(true);
    }, intervalMs);

    return () => clearInterval(id);
  }, [realtimeStatus, fetchNotifications]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Mark single notification read
  const handleMarkRead = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      const res = await fetch(
        `/api/workspace/${business.slug}/notifications/${notificationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read" }),
        }
      );

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
        setStats((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }));
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("workspace:notifications-sync", {
              detail: { businessId: business.id },
            })
          );
        }
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
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setStats((prev) => ({
          ...prev,
          unreadCount: 0,
        }));
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("workspace:notifications-sync", {
              detail: { businessId: business.id },
            })
          );
        }
      }
    } catch {
      // silent
    }
  };

  // Click on notification: mark as read and navigate
  const handleNotificationClick = async (notif: CrmFollowUpReminder) => {
    if (!notif.is_read) {
      await handleMarkRead(notif.id);
    }
    setIsOpen(false);

    if (notif.action_url) {
      router.push(notif.action_url);
    } else {
      router.push(`/workspace/${business.slug}/notifications`);
    }
  };

  // Get Category/Type Icon
  const getCategoryIcon = (type: string) => {
    switch (type) {
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "due_today":
        return <Calendar className="h-4 w-4 text-amber-600" />;
      case "due_soon":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "assigned":
      case "reassigned":
        return <UserCheck className="h-4 w-4 text-indigo-600" />;
      case "team_invitation":
      case "team_member_joined":
        return <Shield className="h-4 w-4 text-purple-600" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  const isAstrology = business.slug === "astrology";
  const badgeColor = isAstrology ? "bg-purple-600" : "bg-rose-600";

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label={`Notifications (${stats.unreadCount} unread)`}
        title="Internal Notification Center"
      >
        <Bell className="h-4 w-4" />

        {stats.unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-xs ${badgeColor} animate-in zoom-in-50 duration-150`}
          >
            {stats.unreadCount > 99 ? "99+" : stats.unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Notifications
              </span>
              {stats.unreadCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {stats.unreadCount} new
                </span>
              )}
              {realtimeStatus === "connected" ? (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                  title="Supabase Realtime Push Active"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                  title="Background Sync Active"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Sync
                </span>
              )}
            </div>

            {stats.unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center p-6 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-xs">Loading updates...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                  <Check className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No unread notifications in this workspace.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 p-3 text-left transition-colors cursor-pointer hover:bg-slate-50 ${
                    !notif.is_read ? "bg-indigo-50/40" : ""
                  }`}
                >
                  <div className="mt-0.5 shrink-0 rounded-lg bg-slate-100 p-2 border border-slate-200">
                    {getCategoryIcon(notif.reminder_type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs truncate ${
                          !notif.is_read
                            ? "font-semibold text-slate-900"
                            : "font-medium text-slate-700"
                        }`}
                      >
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkRead(notif.id, e)}
                          title="Mark as read"
                          className="shrink-0 p-1 text-slate-400 hover:text-indigo-600 rounded"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {formatKolkataTimestamp(notif.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 p-2.5 bg-slate-50/50 text-center">
            <Link
              href={`/workspace/${business.slug}/notifications`}
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-1"
            >
              <span>Open Notification Center</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
