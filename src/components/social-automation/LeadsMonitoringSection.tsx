import React, { useState } from "react";
import {
  Users,
  Search,
  Filter,
  Share2,
  Tag,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  MessageSquare,
  Lock,
} from "lucide-react";
import type { MetaSocialLead, SocialLeadFilters } from "@/lib/meta-social/leads-store";
import {
  getLeadIntentBadge,
  formatRelativeTime,
} from "@/lib/social-automation-dashboard/helpers";

interface LeadsMonitoringSectionProps {
  businessSlug: string;
  leads: MetaSocialLead[];
  totalCount: number;
  onFilterChange: (filters: SocialLeadFilters) => void;
  isLoading?: boolean;
}

export function LeadsMonitoringSection({
  businessSlug,
  leads,
  totalCount,
  onFilterChange,
  isLoading,
}: LeadsMonitoringSectionProps) {
  const [platform, setPlatform] = useState<string>("all");
  const [leadStatus, setLeadStatus] = useState<string>("all");
  const [processingStatus, setProcessingStatus] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [search, setSearch] = useState("");

  const handleApplyFilter = (key: string, value: string) => {
    let newPlatform = platform;
    let newLeadStatus = leadStatus;
    let newProcessingStatus = processingStatus;
    let newDateRange = dateRange;
    let newSearch = search;

    if (key === "platform") {
      newPlatform = value;
      setPlatform(value);
    } else if (key === "leadStatus") {
      newLeadStatus = value;
      setLeadStatus(value);
    } else if (key === "processingStatus") {
      newProcessingStatus = value;
      setProcessingStatus(value);
    } else if (key === "dateRange") {
      newDateRange = value;
      setDateRange(value);
    } else if (key === "search") {
      newSearch = value;
      setSearch(value);
    }

    onFilterChange({
      platform: newPlatform as any,
      leadStatus: newLeadStatus as any,
      processingStatus: newProcessingStatus as any,
      dateRange: newDateRange as any,
      search: newSearch,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Inbound Social Leads & Inquiries
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
              {totalCount} Total Leads
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Prospects engaged via Facebook post comments, Instagram Reels, and direct messages.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleApplyFilter("search", e.target.value)}
              placeholder="Search sender, comment text, or keyword..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {/* Platform filter */}
            <select
              value={platform}
              onChange={(e) => handleApplyFilter("platform", e.target.value)}
              className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Channels</option>
              <option value="facebook">Facebook Only</option>
              <option value="instagram">Instagram Only</option>
            </select>

            {/* Lead intent filter */}
            <select
              value={leadStatus}
              onChange={(e) => handleApplyFilter("leadStatus", e.target.value)}
              className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Intent Levels</option>
              <option value="high_intent">High Intent Leads</option>
              <option value="new_enquiry">New Enquiries</option>
              <option value="followup_needed">Follow-up Needed</option>
              <option value="general">General Queries</option>
            </select>

            {/* Processing status filter */}
            <select
              value={processingStatus}
              onChange={(e) => handleApplyFilter("processingStatus", e.target.value)}
              className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Processing Status</option>
              <option value="replied">Replied (Automated)</option>
              <option value="received">Received / Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Delivery Failed</option>
              <option value="ignored">Ignored (No Match)</option>
            </select>

            {/* Date range filter */}
            <select
              value={dateRange}
              onChange={(e) => handleApplyFilter("dateRange", e.target.value)}
              className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {leads.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900">No leads found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No inbound comments or messages matched the specified criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Prospect / Sender</th>
                  <th className="py-3 px-4">Channel & Type</th>
                  <th className="py-3 px-4">Comment / Inquiry</th>
                  <th className="py-3 px-4">Intent Classification</th>
                  <th className="py-3 px-4">Trigger & Rule</th>
                  <th className="py-3 px-4">Reply Status</th>
                  <th className="py-3 px-4 text-right">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => {
                  const intentBadge = getLeadIntentBadge(lead.lead_status);
                  const isInstagram = lead.platform === "instagram";

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Sender */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {lead.sender_name || "Anonymous User"}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          ID: {lead.sender_id.slice(0, 14)}...
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="py-3 px-4">
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
                          <span className="capitalize font-medium text-slate-700">
                            {lead.event_type}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[130px]">
                          {lead.connection_name}
                        </div>
                      </td>

                      {/* Content */}
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-slate-800 line-clamp-2 font-normal leading-relaxed">
                          {lead.content}
                        </p>
                        {lead.reply_content && (
                          <div className="mt-1 text-[11px] text-emerald-700 bg-emerald-50/60 px-2 py-0.5 rounded-sm border border-emerald-100 line-clamp-1">
                            Reply: {lead.reply_content}
                          </div>
                        )}
                      </td>

                      {/* Intent Classification */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${intentBadge.className}`}
                        >
                          {intentBadge.label}
                        </span>
                      </td>

                      {/* Trigger & Rule */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {lead.matched_rule_name ? (
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-900">
                              {lead.matched_rule_name}
                            </div>
                            {lead.matched_keyword && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Tag className="w-2.5 h-2.5" />
                                {lead.matched_keyword}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No Rule Matched</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md w-fit ${
                              lead.processing_status === "replied"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : lead.processing_status === "failed"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : lead.processing_status === "ignored"
                                ? "bg-slate-100 text-slate-600 border border-slate-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {lead.processing_status === "replied" && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )}
                            {lead.processing_status === "failed" && (
                              <AlertCircle className="w-3 h-3 text-red-600" />
                            )}
                            <span className="capitalize">{lead.processing_status}</span>
                          </span>

                          {/* Public & Private Reply status badges */}
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            {lead.public_reply_status !== "none" && (
                              <span
                                className={`px-1 py-0.5 rounded-sm border ${
                                  lead.public_reply_status === "replied"
                                    ? "bg-slate-50 border-slate-200 text-slate-700"
                                    : "bg-amber-50 border-amber-200 text-amber-700"
                                }`}
                                title="Public comment reply status"
                              >
                                Pub: {lead.public_reply_status}
                              </span>
                            )}
                            {lead.private_reply_status !== "none" && (
                              <span
                                className={`px-1 py-0.5 rounded-sm border ${
                                  lead.private_reply_status === "replied"
                                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                                    : "bg-amber-50 border-amber-200 text-amber-700"
                                }`}
                                title="Private DM reply status"
                              >
                                DM: {lead.private_reply_status}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4 text-right whitespace-nowrap text-slate-500">
                        {formatRelativeTime(lead.created_at)}
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
