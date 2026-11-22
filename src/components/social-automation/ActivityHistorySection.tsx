import React, { useState } from "react";
import {
  Activity,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Tag,
  ArrowRight,
} from "lucide-react";
import type { MetaSocialLead } from "@/lib/meta-social/leads-store";
import { formatRelativeTime } from "@/lib/social-automation-dashboard/helpers";

interface ActivityHistorySectionProps {
  businessSlug: string;
  events: MetaSocialLead[];
}

export function ActivityHistorySection({
  businessSlug,
  events,
}: ActivityHistorySectionProps) {
  const [search, setSearch] = useState("");

  const filteredEvents = events.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.content.toLowerCase().includes(q) ||
      (e.sender_name && e.sender_name.toLowerCase().includes(q)) ||
      (e.meta_event_id && e.meta_event_id.toLowerCase().includes(q)) ||
      (e.matched_rule_name && e.matched_rule_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Social Inbound Activity History & Audit Ledger
          </h2>
          <p className="text-sm text-slate-500">
            Durable log of inbound webhooks, deduplicated events, and rule evaluation outcomes.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event ID, sender, or content..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Activity className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900">No activity logged</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No recent inbound events found in the audit trail.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Event ID & Channel</th>
                  <th className="py-3 px-4">Sender</th>
                  <th className="py-3 px-4">Inbound Content</th>
                  <th className="py-3 px-4">Rule Matched</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((evt) => {
                  const isInstagram = evt.platform === "instagram";
                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white ${
                              isInstagram
                                ? "bg-gradient-to-tr from-yellow-500 via-pink-600 to-purple-600"
                                : "bg-blue-600"
                            }`}
                          >
                            {isInstagram ? "ig" : "f"}
                          </span>
                          <span className="font-mono text-[11px] text-slate-800">
                            {evt.meta_event_id.slice(0, 16)}...
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize">
                          {evt.event_type}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {evt.sender_name || "Unknown"}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {evt.sender_id.slice(0, 12)}...
                        </div>
                      </td>

                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-slate-800 line-clamp-2 leading-relaxed">
                          {evt.content}
                        </p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {evt.matched_rule_name ? (
                          <div className="space-y-0.5">
                            <span className="font-medium text-slate-800">
                              {evt.matched_rule_name}
                            </span>
                            {evt.matched_keyword && (
                              <div>
                                <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-700">
                                  <Tag className="w-2.5 h-2.5" />
                                  {evt.matched_keyword}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No Match</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md ${
                            evt.processing_status === "replied"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : evt.processing_status === "failed"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : evt.processing_status === "ignored"
                              ? "bg-slate-100 text-slate-600 border border-slate-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {evt.processing_status === "replied" && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          )}
                          {evt.processing_status === "failed" && (
                            <AlertCircle className="w-3 h-3 text-red-600" />
                          )}
                          <span className="capitalize">{evt.processing_status}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap text-slate-500">
                        {formatRelativeTime(evt.created_at)}
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
