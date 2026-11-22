"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  MetaSocialRule,
  MetaSocialRulePlatform,
  MetaSocialRuleTarget,
  MetaSocialMatchType,
  MetaSocialResponseAction,
} from "@/lib/meta-social/types";
import { SafeMetaSocialConnection } from "@/lib/meta-social/connections-store";
import {
  MetaSocialReplyTemplate,
  SaveSocialRuleInput,
} from "@/lib/meta-social/rules-store";
import {
  MetaSocialLead,
  SocialLeadFilters,
} from "@/lib/meta-social/leads-store";
import {
  saveSocialRuleAction,
  toggleSocialRuleAction,
  deleteSocialRuleAction,
  simulateSocialRuleAction,
  getSocialLeadsAction,
  ConfigurationWarning,
  SocialDashboardData,
} from "@/app/actions/social-automations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Trash2,
  Edit,
  ArrowRight,
  Sparkles,
  Zap,
  HelpCircle,
  Eye,
  Lock,
  Facebook,
  Instagram,
  Share2,
  MessageSquare,
  Search,
  Filter,
  X,
  RefreshCw,
  AlertCircle,
  Info,
  ChevronRight,
  Layers,
  HeartHandshake,
  MessageCircle,
} from "lucide-react";

interface SocialAutomationDashboardClientProps {
  initialData: SocialDashboardData;
}

export function SocialAutomationDashboardClient({
  initialData,
}: SocialAutomationDashboardClientProps) {
  const [data, setData] = useState<SocialDashboardData>(initialData);
  const [activeTab, setActiveTab] = useState<
    "overview" | "rules" | "templates" | "leads" | "simulator"
  >("overview");

  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const showNotification = (type: "success" | "error" | "info", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  const isAstrology = data.business.slug === "astrology";
  const brandColor = isAstrology ? "purple" : "rose";

  // ==========================================================================
  // RULES TAB STATE
  // ==========================================================================
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [rulePlatform, setRulePlatform] = useState<MetaSocialRulePlatform>("both");
  const [ruleTarget, setRuleTarget] = useState<MetaSocialRuleTarget>("both");
  const [matchType, setMatchType] = useState<MetaSocialMatchType>("contains");
  const [responseAction, setResponseAction] =
    useState<MetaSocialResponseAction>("both_public_and_private");
  const [priority, setPriority] = useState<number>(10);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [stopOnMatch, setStopOnMatch] = useState<boolean>(true);
  const [keywordsInput, setKeywordsInput] = useState<string>("");
  const [predefinedReply, setPredefinedReply] = useState<string>("");
  const [predefinedDm, setPredefinedDm] = useState<string>("");
  const [ruleConnectionId, setRuleConnectionId] = useState<string>("");

  // Delete modal state
  const [deletingRule, setDeletingRule] = useState<MetaSocialRule | null>(null);

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleName("");
    setRuleDesc("");
    setRulePlatform("both");
    setRuleTarget("both");
    setMatchType("contains");
    setResponseAction("both_public_and_private");
    setPriority(10);
    setIsActive(true);
    setStopOnMatch(true);
    setKeywordsInput("");
    setPredefinedReply("");
    setPredefinedDm("");
    setRuleConnectionId("");
  };

  const openCreateRuleModal = () => {
    resetRuleForm();
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (rule: MetaSocialRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.rule_name);
    setRuleDesc(rule.description || "");
    setRulePlatform(rule.platform);
    setRuleTarget(rule.target_type);
    setMatchType(rule.match_type);
    setResponseAction(rule.response_action);
    setPriority(rule.priority);
    setIsActive(rule.is_active);
    setStopOnMatch(rule.stop_processing_on_match);
    setKeywordsInput(Array.isArray(rule.keywords) ? rule.keywords.join(", ") : "");
    setPredefinedReply(rule.predefined_reply);
    setPredefinedDm(rule.predefined_dm || "");
    setRuleConnectionId(rule.connection_id || "");
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = () => {
    if (!ruleName.trim()) {
      showNotification("error", "Rule name is required.");
      return;
    }
    if (!predefinedReply.trim()) {
      showNotification("error", "Predefined reply message is required.");
      return;
    }

    const kwArray = keywordsInput
      .split(/[,|\n]/)
      .map((k) => k.trim())
      .filter(Boolean);

    if (kwArray.length === 0 && matchType !== "any") {
      showNotification("error", "Please provide at least one keyword.");
      return;
    }

    // Critical constraint: public comment reply must not be reused as private DM automatically
    if (
      responseAction === "both_public_and_private" &&
      predefinedDm &&
      predefinedDm.trim() === predefinedReply.trim()
    ) {
      showNotification(
        "error",
        "Public comment reply and Private DM must be distinct. Reusing a public reply as a private reply directly is prohibited."
      );
      return;
    }

    startTransition(async () => {
      const payload: SaveSocialRuleInput = {
        id: editingRuleId || undefined,
        connectionId: ruleConnectionId || null,
        platform: rulePlatform,
        targetType: ruleTarget,
        ruleName: ruleName.trim(),
        description: ruleDesc.trim() || null,
        keywords: kwArray,
        matchType,
        responseAction,
        predefinedReply: predefinedReply.trim(),
        predefinedDm: predefinedDm.trim() || null,
        priority,
        isActive,
        stopProcessingOnMatch: stopOnMatch,
      };

      const res = await saveSocialRuleAction(data.business.slug, payload);
      if (res.success && res.data) {
        showNotification(
          "success",
          editingRuleId ? "Rule updated successfully." : "Rule created successfully."
        );
        setIsRuleModalOpen(false);

        // Update local state
        const updatedRules = editingRuleId
          ? data.rules.map((r) => (r.id === res.data!.id ? res.data! : r))
          : [...data.rules, res.data!];

        setData((prev) => ({
          ...prev,
          rules: updatedRules.sort((a, b) => a.priority - b.priority),
          stats: {
            ...prev.stats,
            totalRules: updatedRules.length,
            activeRules: updatedRules.filter((r) => r.is_active).length,
          },
        }));
      } else {
        showNotification("error", res.error || "Failed to save rule.");
      }
    });
  };

  const handleToggleRule = (rule: MetaSocialRule) => {
    startTransition(async () => {
      const res = await toggleSocialRuleAction(data.business.slug, rule.id, !rule.is_active);
      if (res.success && res.data) {
        showNotification(
          "success",
          `Rule ${res.data.is_active ? "enabled" : "disabled"} successfully.`
        );
        const updatedRules = data.rules.map((r) =>
          r.id === res.data!.id ? res.data! : r
        );
        setData((prev) => ({
          ...prev,
          rules: updatedRules,
          stats: {
            ...prev.stats,
            activeRules: updatedRules.filter((r) => r.is_active).length,
          },
        }));
      } else {
        showNotification("error", res.error || "Failed to toggle rule state.");
      }
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    startTransition(async () => {
      const res = await deleteSocialRuleAction(data.business.slug, ruleId);
      if (res.success) {
        showNotification("success", "Rule deleted successfully.");
        setDeletingRule(null);
        const updatedRules = data.rules.filter((r) => r.id !== ruleId);
        setData((prev) => ({
          ...prev,
          rules: updatedRules,
          stats: {
            ...prev.stats,
            totalRules: updatedRules.length,
            activeRules: updatedRules.filter((r) => r.is_active).length,
          },
        }));
      } else {
        showNotification("error", res.error || "Failed to delete rule.");
      }
    });
  };

  // ==========================================================================
  // LEADS TAB STATE
  // ==========================================================================
  const [leadsFilter, setLeadsFilter] = useState<SocialLeadFilters>({
    platform: "all",
    dateRange: "all",
    processingStatus: "all",
    leadStatus: "all",
    search: "",
  });
  const [leadsList, setLeadsList] = useState<MetaSocialLead[]>(data.leads);
  const [leadsTotalCount, setLeadsTotalCount] = useState<number>(data.totalLeadsCount);
  const [isLeadsLoading, setIsLeadsLoading] = useState(false);
  const [selectedLead, setSelectedLead] = useState<MetaSocialLead | null>(null);

  const applyLeadsFilter = (newFilters: Partial<SocialLeadFilters>) => {
    const updated = { ...leadsFilter, ...newFilters };
    setLeadsFilter(updated);
    setIsLeadsLoading(true);

    startTransition(async () => {
      const res = await getSocialLeadsAction(data.business.slug, updated);
      if (res.success && res.data) {
        setLeadsList(res.data);
        setLeadsTotalCount(res.totalCount ?? res.data.length);
      }
      setIsLeadsLoading(false);
    });
  };

  // ==========================================================================
  // SIMULATOR STATE
  // ==========================================================================
  const [simText, setSimText] = useState(
    isAstrology
      ? "ஜாதகம் பார்க்க கட்டணம் எவ்வளவு? திருமண பொருத்தம் விவரம் வேண்டும்."
      : "திருமணம் வரன் பதிவு செய்ய பெண் தேவை விவரங்கள் கிடைக்குமா?"
  );
  const [simPlatform, setSimPlatform] = useState<"facebook" | "instagram">("instagram");
  const [simEventType, setSimEventType] = useState<"comment" | "message">("comment");
  const [simResult, setSimResult] = useState<{
    matched: boolean;
    rule?: MetaSocialRule;
    publicReply?: string;
    privateDm?: string;
  } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const runSimulation = () => {
    if (!simText.trim()) return;
    setIsSimulating(true);

    startTransition(async () => {
      const res = await simulateSocialRuleAction(data.business.slug, {
        text: simText,
        platform: simPlatform,
        eventType: simEventType,
      });

      setIsSimulating(false);
      if (res.success) {
        setSimResult({
          matched: res.matched,
          rule: res.rule,
          publicReply: res.publicReplyPreview,
          privateDm: res.privateDmPreview,
        });
      } else {
        showNotification("error", res.error || "Simulation failed.");
      }
    });
  };

  // Preset quick fill
  const loadPresetTemplateIntoRule = (tpl: MetaSocialReplyTemplate) => {
    if (tpl.templateType === "public_comment") {
      setPredefinedReply(tpl.content);
    } else {
      setPredefinedDm(tpl.content);
    }
    showNotification("info", `Loaded "${tpl.name}" into template field.`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm animate-in fade-in slide-in-from-top duration-200 ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : notification.type === "error"
              ? "bg-rose-50 text-rose-900 border-rose-200"
              : "bg-blue-50 text-blue-900 border-blue-200"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : notification.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
          )}
          <span>{notification.text}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-auto text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {isAstrology ? (
                <Sparkles className="w-6 h-6 text-purple-600" />
              ) : (
                <HeartHandshake className="w-6 h-6 text-rose-600" />
              )}
              {data.business.name} — Social Automation Dashboard
            </h1>
            <Badge
              variant="outline"
              className={
                isAstrology
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }
            >
              Tenant: {data.business.slug}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Centralized Facebook & Instagram deterministic keyword automation, public post comment replies, private DMs, and lead monitoring.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/workspace/${data.business.slug}/connections/social`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Share2 className="w-4 h-4" />
              Manage Meta Accounts
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={openCreateRuleModal}
            className={`gap-2 ${
              isAstrology
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-rose-600 hover:bg-rose-700 text-white"
            }`}
          >
            <Plus className="w-4 h-4" />
            Create Keyword Rule
          </Button>
        </div>
      </div>

      {/* Configuration Warnings Banner */}
      {data.warnings.length > 0 && (
        <div className="space-y-2">
          {data.warnings.map((w) => (
            <div
              key={w.id}
              className={`p-4 rounded-lg border flex items-start justify-between gap-3 ${
                w.type === "critical"
                  ? "bg-red-50 border-red-200 text-red-900"
                  : w.type === "warning"
                  ? "bg-amber-50 border-amber-200 text-amber-900"
                  : "bg-blue-50 border-blue-200 text-blue-900"
              }`}
            >
              <div className="flex items-start gap-3">
                {w.type === "critical" ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                ) : w.type === "warning" ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-sm font-semibold">{w.title}</h4>
                  <p className="text-xs mt-0.5 opacity-90">{w.message}</p>
                </div>
              </div>
              {w.actionHref && w.actionLabel && (
                <Link href={w.actionHref}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs h-8 bg-white border-slate-300"
                  >
                    {w.actionLabel}
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "overview"
              ? isAstrology
                ? "border-purple-600 text-purple-700"
                : "border-rose-600 text-rose-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Zap className="w-4 h-4" />
          Overview & Metrics
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "rules"
              ? isAstrology
                ? "border-purple-600 text-purple-700"
                : "border-rose-600 text-rose-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Bot className="w-4 h-4" />
          Keyword Rules
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-semibold">
            {data.rules.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "templates"
              ? isAstrology
                ? "border-purple-600 text-purple-700"
                : "border-rose-600 text-rose-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          Reply Templates
        </button>

        <button
          onClick={() => setActiveTab("leads")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "leads"
              ? isAstrology
                ? "border-purple-600 text-purple-700"
                : "border-rose-600 text-rose-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Lead Monitoring
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-semibold">
            {data.totalLeadsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "simulator"
              ? isAstrology
                ? "border-purple-600 text-purple-700"
                : "border-rose-600 text-rose-700"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Play className="w-4 h-4" />
          Dry-Run Simulator
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: OVERVIEW & METRICS */}
      {/* ==================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs uppercase font-semibold text-slate-500">
                  Connected Channels
                </CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center justify-between">
                  <span>{data.stats.connectedChannels}</span>
                  <div className="flex gap-1.5 text-slate-400">
                    <Facebook className="w-5 h-5 text-blue-600" />
                    <Instagram className="w-5 h-5 text-pink-600" />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                {data.connections.length === 0
                  ? "No accounts connected"
                  : `${data.connections.length} accounts authorized`}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs uppercase font-semibold text-slate-500">
                  Configured Rules
                </CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center justify-between">
                  <span>{data.stats.totalRules}</span>
                  <Bot className="w-5 h-5 text-emerald-600" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                <span className="text-emerald-700 font-medium">
                  {data.stats.activeRules} active
                </span>{" "}
                / {data.stats.totalRules - data.stats.activeRules} disabled
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs uppercase font-semibold text-slate-500">
                  Recent Activity / Comments
                </CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center justify-between">
                  <span>{data.stats.commentsReceived}</span>
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                {data.stats.repliesDelivered} auto-replies logged
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-4 pb-2">
                <CardDescription className="text-xs uppercase font-semibold text-slate-500">
                  High Intent Leads
                </CardDescription>
                <CardTitle className="text-2xl font-bold flex items-center justify-between">
                  <span>{data.stats.highIntentLeads}</span>
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 text-xs text-slate-500">
                Matched key enquiries (Fees / Horoscope / Matrimony)
              </CardContent>
            </Card>
          </div>

          {/* Connected Accounts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-slate-700" />
                    Authorized Social Channels
                  </span>
                  <Link href={`/workspace/${data.business.slug}/connections/social`}>
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                      Manage <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </CardTitle>
                <CardDescription className="text-xs">
                  Facebook Pages and Instagram Professional accounts linked to this business workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.connections.length === 0 ? (
                  <div className="p-6 text-center border border-dashed rounded-lg bg-slate-50">
                    <Share2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-700">No channels connected</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Connect your Facebook Page or Instagram Business account via OAuth.
                    </p>
                    <Link href={`/workspace/${data.business.slug}/connections/social`}>
                      <Button size="sm" className="mt-3 text-xs gap-1">
                        Connect Now
                      </Button>
                    </Link>
                  </div>
                ) : (
                  data.connections.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 border rounded-lg flex items-center justify-between bg-white hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            c.platform === "facebook"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-pink-100 text-pink-700"
                          }`}
                        >
                          {c.platform === "facebook" ? (
                            <Facebook className="w-5 h-5" />
                          ) : (
                            <Instagram className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {c.account_name}
                            </span>
                            {c.username && (
                              <span className="text-xs text-slate-500">@{c.username}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">
                              ID: {c.account_id}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs font-mono text-slate-400">
                              {c.credential_masked_hint}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={
                          c.connection_status === "connected"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }
                      >
                        {c.connection_status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Automation Status & Restrictions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Deterministic Automation Engine Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Legitimate, policy-compliant rule execution without AI hallucinations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Rules Engine:</span>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300">
                      Active (Deterministic)
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Outbound Meta Writes:</span>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                      Phase 13D Safe Inspection
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Multi-Keyword Normalization:</span>
                    <span className="text-slate-600 font-mono">Unicode NFKC (Tamil & English)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">Public/Private Reply Separation:</span>
                    <span className="text-emerald-700 font-medium">Strictly Enforced</span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">Sample Tenant Presets:</p>
                  <p>
                    {isAstrology
                      ? "• Astrology: ஜாதகம், ராசி பலன், திருமண பொருத்தம், horoscope, astrology, marriage matching."
                      : "• Vivaham: திருமணம், வரன், பெண் தேவை, மாப்பிள்ளை தேவை, matrimony, bride, groom."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Comments Feed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-700" />
                  Recent Matched Comments & Automation Feed
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("leads")}
                  className="text-xs gap-1"
                >
                  View All Leads <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.leads.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">
                  No comments or inbound messages logged yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.leads.slice(0, 5).map((l) => (
                    <div key={l.id} className="py-3 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            l.platform === "facebook"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-pink-100 text-pink-700"
                          }`}
                        >
                          {l.platform === "facebook" ? (
                            <Facebook className="w-4 h-4" />
                          ) : (
                            <Instagram className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {l.sender_name || l.sender_id}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(l.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {l.matched_rule_name && (
                              <Badge variant="outline" className="text-xs bg-slate-50">
                                Rule: {l.matched_rule_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mt-1">&ldquo;{l.content}&rdquo;</p>
                          {l.reply_content && (
                            <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              Auto-Reply: {l.reply_content}
                            </p>
                          )}
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={
                          l.lead_status === "high_intent"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : l.lead_status === "followup_needed"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }
                      >
                        {l.lead_status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: KEYWORD RULES MANAGEMENT */}
      {/* ==================================================================== */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border rounded-lg">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Configured Keyword Rules
              </h3>
              <p className="text-xs text-slate-500">
                Deterministic matching rules ordered by Priority (lowest number executes first).
              </p>
            </div>
            <Button
              size="sm"
              onClick={openCreateRuleModal}
              className={`gap-2 ${
                isAstrology
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Keyword Rule
            </Button>
          </div>

          {data.rules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Bot className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-slate-800">No Rules Configured</h4>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                  Add keyword rules with Tamil and English terms to automate responses to comments and direct messages.
                </p>
                <Button
                  size="sm"
                  onClick={openCreateRuleModal}
                  className="mt-4 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create First Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b text-xs uppercase font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-4 w-16">Priority</th>
                      <th className="py-3 px-4">Rule Name</th>
                      <th className="py-3 px-4">Channel / Target</th>
                      <th className="py-3 px-4">Keywords (Tamil / English)</th>
                      <th className="py-3 px-4">Match Type</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4 w-24">Status</th>
                      <th className="py-3 px-4 w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                          #{rule.priority}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{rule.rule_name}</div>
                          {rule.description && (
                            <div className="text-xs text-slate-500 truncate max-w-xs">
                              {rule.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-xs capitalize">
                              {rule.platform}
                            </Badge>
                            <span className="text-slate-400">•</span>
                            <span className="text-xs text-slate-600 capitalize">
                              {rule.target_type}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 max-w-sm">
                            {(rule.keywords || []).slice(0, 4).map((kw, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-2 py-0.5 text-xs rounded bg-slate-100 text-slate-800 font-medium"
                              >
                                {kw}
                              </span>
                            ))}
                            {(rule.keywords || []).length > 4 && (
                              <span className="text-xs text-slate-400 self-center">
                                +{(rule.keywords || []).length - 4} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {rule.match_type}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-xs text-slate-700">
                            {rule.response_action === "both_public_and_private"
                              ? "Public Comment + Private DM"
                              : rule.response_action === "reply_comment_private_dm"
                              ? "Private DM to Commenter"
                              : rule.response_action === "reply_comment_public"
                              ? "Public Comment Reply"
                              : "Direct Message Reply"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleRule(rule)}
                            disabled={isPending}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              rule.is_active ? "bg-emerald-600" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                rule.is_active ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditRuleModal(rule)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingRule(rule)}
                              className="h-8 w-8 p-0 hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: REPLY TEMPLATES */}
      {/* ==================================================================== */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-lg flex items-start gap-3">
            <Info className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-900 leading-relaxed">
              <strong className="font-semibold block text-sm mb-1">
                Public Comment Replies vs Private DM Reply Templates
              </strong>
              Public comment replies are posted under the commenter&apos;s post/reel and are visible to all followers.
              Private DM replies (Meta Private Replies) are sent directly to the commenter&apos;s personal inbox.
              To preserve brand professionalism and privacy, public replies must NEVER be automatically copied or reused as private replies.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Public Comment Templates */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                  Public Comment Reply Templates
                </h3>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {data.publicTemplates.length} Templates
                </Badge>
              </div>

              {data.publicTemplates.map((tpl) => (
                <Card key={tpl.id} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2 bg-slate-50/70 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{tpl.name}</CardTitle>
                      <Badge variant="outline" className="text-xs uppercase">
                        {tpl.language}
                      </Badge>
                    </div>
                    {tpl.description && (
                      <CardDescription className="text-xs">{tpl.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="p-3 bg-slate-50 border rounded-lg text-sm text-slate-800 leading-relaxed font-sans">
                      &ldquo;{tpl.content}&rdquo;
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-400">
                        Publicly visible on post comment thread
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          openCreateRuleModal();
                          setPredefinedReply(tpl.content);
                        }}
                        className="text-xs h-7 gap-1"
                      >
                        Use in Rule <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Private DM Templates */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-indigo-600" />
                  Private DM Reply Templates
                </h3>
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  {data.privateTemplates.length} Templates
                </Badge>
              </div>

              {data.privateTemplates.map((tpl) => (
                <Card key={tpl.id} className="overflow-hidden">
                  <CardHeader className="p-4 pb-2 bg-slate-50/70 border-b">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{tpl.name}</CardTitle>
                      <Badge variant="outline" className="text-xs uppercase">
                        {tpl.language}
                      </Badge>
                    </div>
                    {tpl.description && (
                      <CardDescription className="text-xs">{tpl.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-sm text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                      {tpl.content}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-400">
                        Delivered directly into user DM inbox
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          openCreateRuleModal();
                          setPredefinedDm(tpl.content);
                        }}
                        className="text-xs h-7 gap-1"
                      >
                        Use in Rule <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: LEAD MONITORING & COMMENTS LEDGER */}
      {/* ==================================================================== */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white border rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Search comments, sender, or keywords..."
                  value={leadsFilter.search || ""}
                  onChange={(e) => applyLeadsFilter({ search: e.target.value })}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={leadsFilter.platform || "all"}
                  onChange={(e) => applyLeadsFilter({ platform: e.target.value as any })}
                  className="h-9 px-3 rounded-md border border-slate-200 text-xs bg-white text-slate-700"
                >
                  <option value="all">All Platforms</option>
                  <option value="facebook">Facebook Only</option>
                  <option value="instagram">Instagram Only</option>
                </select>

                <select
                  value={leadsFilter.leadStatus || "all"}
                  onChange={(e) => applyLeadsFilter({ leadStatus: e.target.value as any })}
                  className="h-9 px-3 rounded-md border border-slate-200 text-xs bg-white text-slate-700"
                >
                  <option value="all">All Lead Types</option>
                  <option value="high_intent">High Intent Leads</option>
                  <option value="new_enquiry">New Enquiries</option>
                  <option value="general">General Comments</option>
                  <option value="followup_needed">Follow-up Needed</option>
                </select>

                <select
                  value={leadsFilter.processingStatus || "all"}
                  onChange={(e) =>
                    applyLeadsFilter({ processingStatus: e.target.value as any })
                  }
                  className="h-9 px-3 rounded-md border border-slate-200 text-xs bg-white text-slate-700"
                >
                  <option value="all">All Statuses</option>
                  <option value="replied">Replied</option>
                  <option value="received">Received / Pending</option>
                  <option value="failed">Failed</option>
                  <option value="ignored">Ignored</option>
                </select>

                <select
                  value={leadsFilter.dateRange || "all"}
                  onChange={(e) => applyLeadsFilter({ dateRange: e.target.value as any })}
                  className="h-9 px-3 rounded-md border border-slate-200 text-xs bg-white text-slate-700"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
              <span>
                Showing {leadsList.length} of {leadsTotalCount} social interactions
              </span>
              <span className="italic text-slate-400">
                Note: Delivery tracking fields reflect Migration 026 schema capabilities.
              </span>
            </div>
          </div>

          {/* Leads Table */}
          <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-xs uppercase font-semibold text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Platform & Channel</th>
                    <th className="py-3 px-4">Sender</th>
                    <th className="py-3 px-4">Comment / Message</th>
                    <th className="py-3 px-4">Matched Rule / Keyword</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4">Lead Status</th>
                    <th className="py-3 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leadsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No interactions matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    leadsList.map((lead) => (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {lead.platform === "facebook" ? (
                              <Facebook className="w-4 h-4 text-blue-600 shrink-0" />
                            ) : (
                              <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
                            )}
                            <span className="text-xs font-medium text-slate-800 truncate max-w-[140px]">
                              {lead.connection_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-xs text-slate-900">
                            {lead.sender_name || lead.sender_id}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {lead.sender_id}
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="text-xs text-slate-800 truncate">{lead.content}</p>
                          {lead.reply_content && (
                            <p className="text-[11px] text-emerald-700 truncate mt-0.5">
                              ↳ {lead.reply_content}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {lead.matched_rule_name ? (
                            <Badge variant="outline" className="text-xs bg-slate-50 font-normal">
                              {lead.matched_rule_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">None</span>
                          )}
                          {lead.matched_keyword && (
                            <span className="block text-[11px] text-slate-500 mt-0.5">
                              Keyword: &ldquo;{lead.matched_keyword}&rdquo;
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="flex items-center gap-1 text-slate-700">
                              Public:{" "}
                              <strong
                                className={
                                  lead.public_reply_status === "replied"
                                    ? "text-emerald-700"
                                    : "text-slate-500"
                                }
                              >
                                {lead.public_reply_status}
                              </strong>
                            </span>
                            <span className="flex items-center gap-1 text-slate-700">
                              Private DM:{" "}
                              <strong
                                className={
                                  lead.private_reply_status === "replied"
                                    ? "text-indigo-700"
                                    : "text-slate-500"
                                }
                              >
                                {lead.private_reply_status}
                              </strong>
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="outline"
                            className={
                              lead.lead_status === "high_intent"
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : lead.lead_status === "followup_needed"
                                ? "bg-rose-50 text-rose-800 border-rose-300"
                                : "bg-slate-50 text-slate-700 border-slate-200"
                            }
                          >
                            {lead.lead_status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          {new Date(lead.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 5: DRY-RUN SIMULATOR */}
      {/* ==================================================================== */}
      {activeTab === "simulator" && (
        <div className="space-y-6 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Play className="w-5 h-5 text-indigo-600" />
                Deterministic Automation Rule Simulator
              </CardTitle>
              <CardDescription className="text-xs">
                Test how your Tamil and English keywords match against incoming comments or messages.
                Zero real Meta API calls are sent during this test.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Channel Platform
                  </label>
                  <select
                    value={simPlatform}
                    onChange={(e) => setSimPlatform(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 text-sm bg-white"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Event Type
                  </label>
                  <select
                    value={simEventType}
                    onChange={(e) => setSimEventType(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 text-sm bg-white"
                  >
                    <option value="comment">Post / Reel Comment</option>
                    <option value="message">Direct Message (DM)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Inbound Text (Tamil or English)
                </label>
                <textarea
                  rows={3}
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="w-full p-3 rounded-md border border-slate-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter sample comment or question..."
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  Evaluates against {data.rules.length} configured rules
                </span>
                <Button
                  onClick={runSimulation}
                  disabled={isSimulating}
                  className={`gap-2 ${
                    isAstrology
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-rose-600 hover:bg-rose-700 text-white"
                  }`}
                >
                  <Play className="w-4 h-4" />
                  {isSimulating ? "Evaluating..." : "Run Dry-Run Match"}
                </Button>
              </div>

              {/* Simulation Result */}
              {simResult && (
                <div
                  className={`mt-4 p-4 rounded-lg border space-y-3 ${
                    simResult.matched
                      ? "bg-emerald-50/70 border-emerald-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-2">
                      {simResult.matched ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          Rule Matched Successfully!
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-5 h-5 text-slate-500" />
                          No Matching Rule Found
                        </>
                      )}
                    </span>
                    {simResult.rule && (
                      <Badge variant="outline" className="text-xs bg-white">
                        Priority #{simResult.rule.priority}
                      </Badge>
                    )}
                  </div>

                  {simResult.rule && (
                    <div className="text-xs text-slate-700 space-y-1">
                      <p>
                        <strong>Triggered Rule:</strong> {simResult.rule.rule_name}
                      </p>
                      <p>
                        <strong>Matching Mode:</strong> {simResult.rule.match_type} (
                        {simResult.rule.keywords.join(", ")})
                      </p>
                      <p>
                        <strong>Response Action:</strong> {simResult.rule.response_action}
                      </p>
                    </div>
                  )}

                  {simResult.publicReply && (
                    <div className="p-3 bg-white border border-emerald-200 rounded text-xs space-y-1">
                      <strong className="text-emerald-900 block font-semibold">
                        Public Comment Reply Preview:
                      </strong>
                      <p className="text-slate-800">&ldquo;{simResult.publicReply}&rdquo;</p>
                    </div>
                  )}

                  {simResult.privateDm && (
                    <div className="p-3 bg-white border border-indigo-200 rounded text-xs space-y-1">
                      <strong className="text-indigo-900 block font-semibold">
                        Private DM Reply Preview:
                      </strong>
                      <p className="text-slate-800 whitespace-pre-line">
                        {simResult.privateDm}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE / EDIT KEYWORD RULE */}
      {/* ==================================================================== */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingRuleId ? "Edit Keyword Automation Rule" : "Create Keyword Automation Rule"}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure deterministic triggers with Tamil and English terms.
                </p>
              </div>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Rule Name *
                </label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g., Horoscope Consultation Enquiry"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Description (Optional)
                </label>
                <Input
                  value={ruleDesc}
                  onChange={(e) => setRuleDesc(e.target.value)}
                  placeholder="Notes about when this rule fires..."
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Channel Platform
                  </label>
                  <select
                    value={rulePlatform}
                    onChange={(e) => setRulePlatform(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 text-xs bg-white"
                  >
                    <option value="both">Both (FB & IG)</option>
                    <option value="facebook">Facebook Only</option>
                    <option value="instagram">Instagram Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Target Type
                  </label>
                  <select
                    value={ruleTarget}
                    onChange={(e) => setRuleTarget(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 text-xs bg-white"
                  >
                    <option value="both">Both (Comments & DMs)</option>
                    <option value="comment">Comments Only</option>
                    <option value="message">Direct Messages Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Priority (1 = Highest)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 10)}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Keywords (Tamil & English comma-separated) *
                </label>
                <Input
                  value={keywordsInput}
                  onChange={(e) => setKeywordsInput(e.target.value)}
                  placeholder={
                    isAstrology
                      ? "ஜாதகம், ராசி பலன், திருமண பொருத்தம், horoscope, astrology"
                      : "திருமணம், வரன், பெண் தேவை, மாப்பிள்ளை தேவை, matrimony"
                  }
                  className="text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports multiple terms in Unicode Tamil script and English ASCII. Separate with commas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Keyword Matching Engine
                  </label>
                  <select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 text-xs bg-white"
                  >
                    <option value="contains">Contains (Partial Substring)</option>
                    <option value="exact">Exact Match</option>
                    <option value="starts_with">Starts With</option>
                    <option value="any">Any (Wildcard)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Response Action
                  </label>
                  <select
                    value={responseAction}
                    onChange={(e) => setResponseAction(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 text-xs bg-white"
                  >
                    <option value="both_public_and_private">
                      Public Comment Reply + Private DM
                    </option>
                    <option value="reply_comment_private_dm">
                      Private DM to Commenter Only
                    </option>
                    <option value="reply_comment_public">
                      Public Comment Reply Only
                    </option>
                    <option value="reply_dm">Direct Message Reply</option>
                  </select>
                </div>
              </div>

              {/* Public Comment Reply Field */}
              {(responseAction === "both_public_and_private" ||
                responseAction === "reply_comment_public" ||
                responseAction === "reply_dm") && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      {responseAction === "reply_dm"
                        ? "Direct Message Reply *"
                        : "Public Comment Reply Message *"}
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Publicly posted under comment
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={predefinedReply}
                    onChange={(e) => setPredefinedReply(e.target.value)}
                    placeholder="e.g., வணக்கம்! விவரங்கள் உங்கள் DM-க்கு அனுப்பப்பட்டுள்ளது."
                    className="w-full p-2.5 rounded-md border border-slate-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Private DM Reply Field */}
              {(responseAction === "both_public_and_private" ||
                responseAction === "reply_comment_private_dm") && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Private Reply DM Message *
                    </label>
                    <span className="text-[11px] text-indigo-600 font-medium">
                      Meta Private Reply (Never reuses public text)
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={predefinedDm}
                    onChange={(e) => setPredefinedDm(e.target.value)}
                    placeholder="e.g., வணக்கம்! எங்கள் விரிவான சேவை மற்றும் கட்டண விவரங்கள்..."
                    className="w-full p-2.5 rounded-md border border-slate-200 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Enable rule immediately</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={stopOnMatch}
                    onChange={(e) => setStopOnMatch(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Stop processing further rules on match</span>
                </label>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex items-center justify-end gap-3 sticky bottom-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRuleModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveRule}
                disabled={isPending}
                className={
                  isAstrology
                    ? "bg-purple-600 hover:bg-purple-700 text-white"
                    : "bg-rose-600 hover:bg-rose-700 text-white"
                }
              >
                {isPending ? "Saving..." : editingRuleId ? "Update Rule" : "Create Rule"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DELETE RULE CONFIRMATION */}
      {/* ==================================================================== */}
      {deletingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Delete Automation Rule</h3>
            </div>
            <p className="text-sm text-slate-600">
              Are you sure you want to permanently delete the rule &ldquo;{deletingRule.rule_name}&rdquo;?
              Inbound comments and messages will no longer match this keyword pattern.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingRule(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleDeleteRule(deletingRule.id)}
                disabled={isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: LEAD DETAIL VIEW */}
      {/* ==================================================================== */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                {selectedLead.platform === "facebook" ? (
                  <Facebook className="w-5 h-5 text-blue-600" />
                ) : (
                  <Instagram className="w-5 h-5 text-pink-600" />
                )}
                <h3 className="text-base font-bold text-slate-900">
                  Lead Details: {selectedLead.sender_name || selectedLead.sender_id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-slate-400 block">Channel:</span>
                  <strong>{selectedLead.connection_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Event Type:</span>
                  <strong className="capitalize">{selectedLead.event_type}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Sender ID:</span>
                  <strong className="font-mono text-[11px]">{selectedLead.sender_id}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Event Time:</span>
                  <strong>{new Date(selectedLead.created_at).toLocaleString()}</strong>
                </div>
              </div>

              <div>
                <span className="font-semibold block text-slate-800 mb-1">
                  Original Comment / Inbound Text:
                </span>
                <div className="p-3 bg-slate-100 rounded-md text-sm font-sans">
                  &ldquo;{selectedLead.content}&rdquo;
                </div>
              </div>

              {selectedLead.matched_rule_name && (
                <div>
                  <span className="font-semibold block text-slate-800 mb-1">
                    Matched Rule:
                  </span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800">
                    {selectedLead.matched_rule_name}
                  </Badge>
                </div>
              )}

              {selectedLead.reply_content && (
                <div>
                  <span className="font-semibold block text-slate-800 mb-1">
                    Executed Auto-Reply:
                  </span>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-md text-xs text-slate-800">
                    {selectedLead.reply_content}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t text-[11px] text-slate-500">
                <div>
                  Public Reply: <strong>{selectedLead.public_reply_status}</strong>
                </div>
                <div>
                  Private DM: <strong>{selectedLead.private_reply_status}</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setSelectedLead(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
