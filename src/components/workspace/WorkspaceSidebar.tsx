"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Smartphone,
  Bot,
  GitBranch,
  FileText,
  CalendarClock,
  BarChart3,
  Megaphone,
  Settings,
  Shield,
  Layers,
  CheckSquare,
  Bell,
  Activity,
} from "lucide-react";
import { BusinessSlug } from "@/types/database";
import { getInboxUnreadCountAction } from "@/app/actions/inbox";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface WorkspaceSidebarProps {
  slug: BusinessSlug;
  businessName: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  phase: number;
  badge?: string;
  isImplemented: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function WorkspaceSidebar({ slug, businessName }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const [liveUnreadCount, setLiveUnreadCount] = useState<number | null>(null);

  // Live Realtime Subscriptions for Instant Unread Counter Updates
  useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const res = await getInboxUnreadCountAction(slug);
        if (isMounted && res.success && typeof res.unread === "number") {
          setLiveUnreadCount(res.unread);
        }
      } catch {}
    };

    fetchUnread();

    // Listen to local client events from active inbox tab
    const handleSync = (e: any) => {
      if (!e.detail?.businessSlug || e.detail.businessSlug === slug) {
        fetchUnread();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("workspace:unread-count-sync", handleSync);
    }

    // Subscribe to Supabase Realtime channel on wa_conversations
    let channel: any = null;
    let supabase: any = null;
    if (isSupabaseConfigured()) {
      try {
        supabase = createClient();
        channel = supabase
          .channel(`sidebar-unread-${slug}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "wa_conversations",
            },
            () => {
              fetchUnread();
            }
          )
          .subscribe();
      } catch {}
    }

    return () => {
      isMounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("workspace:unread-count-sync", handleSync);
      }
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [slug]);

  // Reconciled Route Architecture:
  // Core routes with active Visual Flow Builder and Live Realtime Push
  const navItems: NavGroup[] = [
    {
      title: "Core Modules",
      items: [
        {
          name: "Dashboard",
          href: `/workspace/${slug}/dashboard`,
          icon: LayoutDashboard,
          phase: 1,
          isImplemented: true,
        },
        {
          name: "WhatsApp Inbox",
          href: `/workspace/${slug}/inbox`,
          icon: MessageSquare,
          phase: 4,
          badge: "Active",
          isImplemented: true,
        },
        {
          name: "Customer CRM",
          href: `/workspace/${slug}/crm`,
          icon: Users,
          phase: 9,
          badge: "Active",
          isImplemented: true,
        },
        {
          name: "CRM Follow-ups",
          href: `/workspace/${slug}/crm/follow-ups`,
          icon: CheckSquare,
          phase: 12,
          badge: "Active",
          isImplemented: true,
        },
        {
          name: "Notifications",
          href: `/workspace/${slug}/notifications`,
          icon: Bell,
          phase: 12,
          badge: "Active",
          isImplemented: true,
        },
      ],
    },
    {
      title: "Automation & Engine",
      items: [
        {
          name: "WhatsApp Connections",
          href: `/workspace/${slug}/connections`,
          icon: Smartphone,
          phase: 2,
          isImplemented: true,
        },
        {
          name: "Automation Rules",
          href: `/workspace/${slug}/automations`,
          icon: Bot,
          phase: 5,
          badge: "Active",
          isImplemented: true,
        },
        {
          name: "Flow Builder",
          href: `/workspace/${slug}/flows`,
          icon: GitBranch,
          phase: 4,
          badge: "Visual Flow",
          isImplemented: true,
        },
        {
          name: "Message Templates",
          href: `/workspace/${slug}/templates`,
          icon: FileText,
          phase: 11,
          badge: "Active",
          isImplemented: true,
        },
        {
          name: "Scheduled Messages",
          href: `/workspace/${slug}/scheduled`,
          icon: CalendarClock,
          phase: 12,
          badge: "Active",
          isImplemented: true,
        },
      ],
    },
    {
      title: "Intelligence & Settings",
      items: [
        {
          name: "Analytics",
          href: `/workspace/${slug}/analytics`,
          icon: BarChart3,
          phase: 10,
          badge: "Active",
          isImplemented: true,
        },
        {
          name: "Campaigns",
          href: `/workspace/${slug}/campaigns`,
          icon: Megaphone,
          phase: 12,
          badge: "Active",
          isImplemented: true,
        },
        {
          name: "Team Management",
          href: `/workspace/${slug}/team`,
          icon: Shield,
          phase: 12,
          badge: "Active",
          isImplemented: true,
        },
        {
          name: "Operations & Health",
          href: `/workspace/${slug}/operations`,
          icon: Activity,
          phase: 2,
          badge: "P2",
          isImplemented: true,
        },
        {
          name: "Workspace Settings",
          href: `/workspace/${slug}/settings`,
          icon: Settings,
          phase: 1,
          isImplemented: true,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between h-[calc(100dvh-4rem)]">
      {/* Navigation List */}
      <div className="p-4 space-y-6 overflow-y-auto">
        {navItems.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {group.title}
            </h4>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const isAstrology = slug === "astrology";
                const activeColor = isAstrology
                  ? "bg-purple-50 text-purple-700 font-semibold border-purple-200"
                  : "bg-rose-50 text-rose-700 font-semibold border-rose-200";

                // If not implemented, render as a safe, disabled non-clickable row (prevents 404s)
                if (!item.isImplemented) {
                  return (
                    <div
                      key={item.name}
                      role="button"
                      aria-disabled="true"
                      tabIndex={-1}
                      title={`${item.name} is scheduled for future release (${item.badge || "Planned"}). Broken 404 navigation disabled.`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-400 opacity-60 cursor-not-allowed select-none transition-opacity"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                        <span>{item.name}</span>
                      </div>

                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-medium border border-slate-200">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs min-h-[36px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isActive
                        ? `${activeColor} border shadow-2xs`
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </div>

                    {item.name === "WhatsApp Inbox" && liveUnreadCount !== null && liveUnreadCount > 0 ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold animate-pulse shadow-xs">
                        {liveUnreadCount}
                      </span>
                    ) : item.badge ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium border border-slate-200">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tenant Isolation Status at bottom */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
            <Shield className="h-3.5 w-3.5 text-indigo-600" />
            <span>Strict Tenant Scope</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 leading-tight">
            Queries and actions are locked to <span className="font-semibold text-slate-700">{businessName}</span>.
          </p>
        </div>
      </div>
    </aside>
  );
}
