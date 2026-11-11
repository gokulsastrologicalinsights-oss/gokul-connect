"use client";

import React from "react";
import {
  Inbox,
  Mail,
  UserX,
  UserCheck,
  MessageCircle,
  Clock,
  CheckCircle2,
  Archive,
  Smartphone,
  ChevronDown,
} from "lucide-react";
import { InboxCounts, InboxFolder, SafeWhatsAppConnection } from "@/types/database";

interface ConversationNavPanelProps {
  activeFolder: InboxFolder;
  onSelectFolder: (folder: InboxFolder) => void;
  counts: InboxCounts;
  connections: SafeWhatsAppConnection[];
  selectedConnectionId: string;
  onSelectConnection: (connectionId: string) => void;
  accentColor: string;
}

export function ConversationNavPanel({
  activeFolder,
  onSelectFolder,
  counts,
  connections,
  selectedConnectionId,
  onSelectConnection,
  accentColor,
}: ConversationNavPanelProps) {
  const folders: Array<{
    id: InboxFolder;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
    badgeColor?: string;
  }> = [
    { id: "all", label: "All Conversations", icon: Inbox, count: counts.all },
    {
      id: "unread",
      label: "Unread",
      icon: Mail,
      count: counts.unread,
      badgeColor: "bg-emerald-600 text-white font-semibold",
    },
    { id: "unassigned", label: "Unassigned", icon: UserX, count: counts.unassigned },
    { id: "assigned_to_me", label: "Assigned to Me", icon: UserCheck, count: counts.assigned_to_me },
    { id: "open", label: "Open", icon: MessageCircle, count: counts.open },
    { id: "pending", label: "Pending", icon: Clock, count: counts.pending },
    { id: "resolved", label: "Resolved", icon: CheckCircle2, count: counts.resolved },
    { id: "archived", label: "Archived", icon: Archive, count: counts.archived },
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-full flex-shrink-0">
      {/* WhatsApp Number Selector Header */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/60">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          Active WhatsApp Line
        </label>
        <div className="relative">
          <select
            value={selectedConnectionId}
            onChange={(e) => onSelectConnection(e.target.value)}
            aria-label="Active WhatsApp Line Filter"
            className="w-full min-h-[38px] text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 pr-7 font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer transition-colors"
          >
            <option value="all">All Lines ({connections.length})</option>
            {connections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name} ({c.phone_number})
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Navigation Folder List */}
      <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto">
        <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Folders
        </div>

        {folders.map((f) => {
          const Icon = f.icon;
          const isActive = activeFolder === f.id;

          return (
            <button
              key={f.id}
              onClick={() => onSelectFolder(f.id)}
              aria-label={`${f.label} (${f.count})`}
              className={`w-full min-h-[40px] sm:min-h-[36px] flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}
                />
                <span className="truncate">{f.label}</span>
              </div>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                  isActive
                    ? "bg-slate-800 text-slate-200"
                    : f.badgeColor || "bg-slate-100 text-slate-600"
                }`}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Status indicator footer */}
      <div className="p-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-700">Meta API v26.0 Live</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Real-time Ready</span>
      </div>
    </aside>
  );
}
