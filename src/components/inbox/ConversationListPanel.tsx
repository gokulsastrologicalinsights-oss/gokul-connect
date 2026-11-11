"use client";

import React from "react";
import Link from "next/link";
import {
  Search,
  X,
  ArrowDownLeft,
  CheckCheck,
  User,
  MessageSquare,
  MessageSquarePlus,
  Settings,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { WhatsAppConversation } from "@/types/database";
import { getLabelStyle } from "@/lib/inbox/labels";

interface ConversationListPanelProps {
  conversations: WhatsAppConversation[];
  totalCount?: number;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  folderTitle: string;
  businessSlug?: string;
  activeFolder?: string;
  unreadCount?: number;
  realtimeStatus?: "connected" | "connecting" | "polling";
  onToggleMobileFolders?: () => void;
  onOpenStartChat?: () => void;
  isViewer?: boolean;
  selectedLabel?: string;
  onClearLabelFilter?: () => void;
}

function formatConversationTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getStatusBadge(status: WhatsAppConversation["status"]) {
  switch (status) {
    case "open":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          Open
        </span>
      );
    case "pending_human":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
          Pending
        </span>
      );
    case "closed":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
          Resolved
        </span>
      );
    case "archived":
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
          Archived
        </span>
      );
    default:
      return null;
  }
}

export function ConversationListPanel({
  conversations,
  totalCount,
  selectedConversationId,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  folderTitle,
  businessSlug = "astrology",
  activeFolder,
  unreadCount,
  realtimeStatus = "connected",
  onToggleMobileFolders,
  onOpenStartChat,
  isViewer = false,
  selectedLabel = "all",
  onClearLabelFilter,
}: ConversationListPanelProps) {
  return (
    <div className="w-80 sm:w-96 border-r border-slate-200 bg-white flex flex-col h-full flex-shrink-0">
      {/* Search & Folder Header */}
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              {folderTitle}
              <span className="text-xs font-normal text-slate-500">
                ({conversations.length})
              </span>
            </h2>
            {realtimeStatus === "connected" ? (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                title="Supabase Realtime WebSockets Live"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
                title="Fallback Polling Active"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Sync
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenStartChat && !isViewer && (
              <button
                type="button"
                onClick={onOpenStartChat}
                className="min-h-[32px] px-2.5 py-1 inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Start New Chat"
                title="Start New WhatsApp Chat"
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            )}

            {/* Priority 1: Mobile Folders Drawer Button (visible on < lg) */}
            {onToggleMobileFolders && (
              <button
                type="button"
                onClick={onToggleMobileFolders}
                className="lg:hidden min-h-[36px] px-2.5 py-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Filter folders and WhatsApp lines"
                title="Filter folders and WhatsApp lines"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                <span>Folders</span>
                {unreadCount !== undefined && unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Active Label Filter Indicator */}
        {selectedLabel !== "all" && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-800">
            <div className="flex items-center gap-1.5 truncate">
              <Tag className="w-3 h-3 text-indigo-600 shrink-0" />
              <span className="truncate">
                Label: <strong className="font-semibold">{selectedLabel}</strong>
              </span>
            </div>
            {onClearLabelFilter && (
              <button
                type="button"
                onClick={onClearLabelFilter}
                className="text-indigo-600 hover:text-indigo-800 p-0.5 rounded"
                aria-label="Clear label filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="inbox-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search customers, phones or messages..."
            aria-label="Search customers, phones or messages"
            className="w-full text-xs pl-8 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation Cards List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {conversations.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
            {searchQuery ? (
              <>
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Search className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-800">No conversations found</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[220px]">
                  No results matching &ldquo;{searchQuery}&rdquo;. Try another term.
                </p>
                <button
                  onClick={() => onSearchChange("")}
                  className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Clear search
                </button>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-xs font-bold text-slate-800 mb-1">
                  No WhatsApp conversations yet.
                </h3>
                <p className="text-[11px] text-slate-500 max-w-[220px] mb-4 leading-relaxed">
                  Incoming customer messages will appear here.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {onOpenStartChat && !isViewer && (
                    <button
                      type="button"
                      onClick={onOpenStartChat}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>Start New Chat</span>
                    </button>
                  )}
                  <Link
                    href={`/workspace/${businessSlug}/connections`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium border border-indigo-200 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>WhatsApp Connections</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = selectedConversationId === conv.id;
            const displayName = conv.contact?.display_name || "Unknown Customer";
            const phone = conv.contact?.phone_number || "No number";
            const isOutbound = conv.last_message_direction === "outbound";
            const unread = conv.unread_count;

            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectConversation(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectConversation(conv.id);
                  }
                }}
                className={`p-3 cursor-pointer transition-colors relative flex flex-col gap-1.5 text-left border-l-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isSelected
                    ? "bg-indigo-50/50 border-indigo-600 shadow-sm"
                    : unread > 0
                    ? "bg-emerald-50/20 border-emerald-500 hover:bg-slate-50"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                {/* Top row: Name & Timestamp */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Avatar Initial */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : unread > 0
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`text-xs truncate ${
                        unread > 0 ? "font-bold text-slate-900" : "font-medium text-slate-800"
                      }`}
                    >
                      {displayName}
                    </span>
                  </div>

                  <span suppressHydrationWarning className="text-[10px] text-slate-500 flex-shrink-0 font-medium">
                    {formatConversationTime(conv.last_message_at)}
                  </span>
                </div>

                {/* Sub row: Phone number & Status badge */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pl-9">
                  <span className="font-mono text-[10px] text-slate-500">{phone}</span>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(conv.status)}
                    {unread > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle row: Last message preview */}
                <div className="flex items-center gap-1.5 pl-9 text-xs text-slate-600">
                  {isOutbound ? (
                    <CheckCheck className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                  ) : (
                    <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  )}
                  <p
                    className={`line-clamp-1 truncate text-xs ${
                      unread > 0 ? "text-slate-900 font-semibold" : "text-slate-600"
                    }`}
                  >
                    {conv.last_message_preview || "No message content"}
                  </p>
                </div>

                {/* Bottom row: Agent & Labels */}
                <div className="flex items-center justify-between text-[10px] pt-1 pl-9">
                  <div className="flex items-center gap-1 text-slate-500">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{conv.assigned_agent_name || "Unassigned"}</span>
                  </div>

                  {conv.labels && conv.labels.length > 0 && (
                    <div className="flex items-center gap-1 truncate max-w-[160px]">
                      {conv.labels.slice(0, 2).map((label) => {
                        const style = getLabelStyle(label);
                        return (
                          <span
                            key={label}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-medium border truncate ${style.bg} ${style.text} ${style.border}`}
                          >
                            {label}
                          </span>
                        );
                      })}
                      {conv.labels.length > 2 && (
                        <span className="text-[9px] text-slate-400 font-semibold">
                          +{conv.labels.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
