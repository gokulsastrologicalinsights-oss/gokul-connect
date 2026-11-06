"use client";

import React from "react";
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
} from "lucide-react";
import { BusinessSlug } from "@/types/database";

interface WorkspaceSidebarProps {
  slug: BusinessSlug;
  businessName: string;
}

export function WorkspaceSidebar({ slug, businessName }: WorkspaceSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      title: "Core Modules",
      items: [
        {
          name: "Dashboard",
          href: `/workspace/${slug}/dashboard`,
          icon: LayoutDashboard,
          phase: 1,
        },
        {
          name: "WhatsApp Inbox",
          href: `/workspace/${slug}/inbox`,
          icon: MessageSquare,
          phase: 5,
          badge: "Phase 5",
        },
        {
          name: "Customer CRM",
          href: `/workspace/${slug}/customers`,
          icon: Users,
          phase: 5,
          badge: "Phase 5",
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
          badge: "Phase 2",
        },
        {
          name: "Automation Rules",
          href: `/workspace/${slug}/automations`,
          icon: Bot,
          phase: 4,
          badge: "Phase 4",
        },
        {
          name: "Flow Builder",
          href: `/workspace/${slug}/flows`,
          icon: GitBranch,
          phase: 4,
          badge: "Phase 4",
        },
        {
          name: "Message Templates",
          href: `/workspace/${slug}/templates`,
          icon: FileText,
          phase: 4,
          badge: "Phase 4",
        },
        {
          name: "Scheduled Messages",
          href: `/workspace/${slug}/scheduled`,
          icon: CalendarClock,
          phase: 6,
          badge: "Phase 6",
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
          phase: 7,
          badge: "Phase 7",
        },
        {
          name: "Campaigns",
          href: `/workspace/${slug}/campaigns`,
          icon: Megaphone,
          phase: 7,
          badge: "Phase 7",
        },
        {
          name: "Workspace Settings",
          href: `/workspace/${slug}/settings`,
          icon: Settings,
          phase: 1,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col justify-between h-[calc(100vh-4rem)]">
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

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-all ${
                      isActive
                        ? `${activeColor} border`
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium border border-slate-200">
                        {item.badge}
                      </span>
                    )}
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
