import React, { useState } from "react";
import {
  Bot,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Tag,
  ArrowRight,
  MessageSquare,
  Share2,
  Lock,
} from "lucide-react";
import type {
  MetaSocialRule,
  MetaSocialRulePlatform,
  MetaSocialRuleTarget,
} from "@/lib/meta-social/types";
import {
  formatPlatformLabel,
  formatTargetLabel,
  formatMatchTypeLabel,
  formatActionLabel,
} from "@/lib/social-automation-dashboard/helpers";

interface RulesManagerSectionProps {
  businessSlug: string;
  rules: MetaSocialRule[];
  onOpenCreateModal: () => void;
  onOpenEditModal: (rule: MetaSocialRule) => void;
  onToggleRule: (ruleId: string, isActive: boolean) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
}

export function RulesManagerSection({
  businessSlug,
  rules,
  onOpenCreateModal,
  onOpenEditModal,
  onToggleRule,
  onDeleteRule,
}: RulesManagerSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // Filter rules
  const filteredRules = rules.filter((rule) => {
    if (platformFilter !== "all" && rule.platform !== platformFilter && rule.platform !== "both") {
      return false;
    }
    if (targetFilter !== "all" && rule.target_type !== targetFilter && rule.target_type !== "both") {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const inName = rule.rule_name.toLowerCase().includes(q);
      const inDesc = (rule.description || "").toLowerCase().includes(q);
      const inKeywords = rule.keywords.some((kw) => kw.toLowerCase().includes(q));
      if (!inName && !inDesc && !inKeywords) return false;
    }
    return true;
  });

  const handleToggle = async (ruleId: string, currentActive: boolean) => {
    setTogglingRuleId(ruleId);
    try {
      await onToggleRule(ruleId, !currentActive);
    } finally {
      setTogglingRuleId(null);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (window.confirm("Are you sure you want to delete this rule?")) {
      setDeletingRuleId(ruleId);
      try {
        await onDeleteRule(ruleId);
      } finally {
        setDeletingRuleId(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Keyword Rules Management
          </h2>
          <p className="text-sm text-slate-500">
            Deterministic matching rules for Tamil and English incoming queries on Facebook & Instagram.
          </p>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Keyword Rule</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search rules or Tamil/English keywords..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Channels</option>
            <option value="facebook">Facebook Only</option>
            <option value="instagram">Instagram Only</option>
            <option value="both">Multi-Channel (Both)</option>
          </select>

          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Target Types</option>
            <option value="comment">Comments</option>
            <option value="message">Direct Messages</option>
            <option value="both">Comments & DMs</option>
          </select>
        </div>
      </div>

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">No keyword rules found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {rules.length === 0
                ? "Get started by adding your first Tamil or English keyword rule, or select from preset reply templates."
                : "No rules match your search or filter criteria."}
            </p>
          </div>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRules.map((rule) => {
            const isToggling = togglingRuleId === rule.id;
            const isDeleting = deletingRuleId === rule.id;

            return (
              <div
                key={rule.id}
                className={`bg-white rounded-xl border p-4.5 shadow-xs transition-all ${
                  rule.is_active ? "border-slate-200" : "border-slate-200 opacity-70 bg-slate-50/50"
                }`}
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-md font-mono font-medium bg-slate-100 text-slate-700">
                        Priority #{rule.priority}
                      </span>
                      <h3 className="font-semibold text-slate-900 text-sm">{rule.rule_name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {formatPlatformLabel(rule.platform)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        {formatTargetLabel(rule.target_type)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        {formatMatchTypeLabel(rule.match_type)}
                      </span>
                    </div>
                    {rule.description && (
                      <p className="text-xs text-slate-500">{rule.description}</p>
                    )}
                  </div>

                  {/* Actions & Toggle */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => handleToggle(rule.id, rule.is_active)}
                      disabled={isToggling}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        rule.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {rule.is_active ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Active</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                          <span>Disabled</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => onOpenEditModal(rule)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-md hover:bg-slate-100 transition-colors"
                      title="Edit rule"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(rule.id)}
                      disabled={isDeleting}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Keywords & Responses */}
                <div className="pt-3 space-y-2.5 text-xs">
                  {/* Keywords Tag Cloud */}
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 font-medium shrink-0 mt-0.5">Keywords:</span>
                    <div className="flex flex-wrap gap-1">
                      {rule.keywords.length > 0 ? (
                        rule.keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            <span>{kw}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">Wildcard (Matches any message)</span>
                      )}
                    </div>
                  </div>

                  {/* Response Type & Content */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                      <div className="flex items-center justify-between text-slate-500 font-medium">
                        <span>
                          {rule.response_action === "reply_dm"
                            ? "Direct Message Reply"
                            : "Public Comment Reply"}
                        </span>
                        <span className="text-[10px] text-indigo-600 font-semibold uppercase">
                          {formatActionLabel(rule.response_action)}
                        </span>
                      </div>
                      <p className="text-slate-800 line-clamp-2">{rule.predefined_reply}</p>
                    </div>

                    {rule.predefined_dm && (
                      <div className="p-2.5 rounded-lg bg-indigo-50/50 border border-indigo-200/80 space-y-1">
                        <div className="flex items-center justify-between text-indigo-700 font-medium">
                          <span>Private DM (Meta Private Replies)</span>
                          <span className="text-[10px] text-indigo-600 font-semibold uppercase">
                            Inbox Direct
                          </span>
                        </div>
                        <p className="text-slate-800 line-clamp-2">{rule.predefined_dm}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
