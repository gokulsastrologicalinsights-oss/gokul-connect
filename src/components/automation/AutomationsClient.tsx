"use client";

import React, { useState, useTransition } from "react";
import {
  AutomationRule,
  RuleCondition,
  RuleAction,
  AutomationExecutionLog,
  BusinessHoursConfig,
  AutomationSettingsConfig,
  Business,
  SafeWhatsAppConnection,
} from "@/types/database";
import {
  saveAutomationRuleAction,
  toggleRuleActiveAction,
  deleteAutomationRuleAction,
  simulateRuleAction,
  triggerQueueWorkerAction,
} from "@/app/actions/automations";
import {
  Bot,
  Plus,
  Play,
  RotateCw,
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
} from "lucide-react";

interface AutomationsClientProps {
  business: Business;
  connections: SafeWhatsAppConnection[];
  initialRules: AutomationRule[];
  initialLogs: AutomationExecutionLog[];
  businessHours: BusinessHoursConfig;
  automationSettings: AutomationSettingsConfig;
}

export function AutomationsClient({
  business,
  connections,
  initialRules,
  initialLogs,
  businessHours,
  automationSettings,
}: AutomationsClientProps) {
  const [rules, setRules] = useState<AutomationRule[]>(initialRules);
  const [logs, setLogs] = useState<AutomationExecutionLog[]>(initialLogs);
  const [activeTab, setActiveTab] = useState<"rules" | "builder" | "simulator" | "logs">("rules");

  // Builder state
  const [editingRule, setEditingRule] = useState<Partial<AutomationRule> | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleDesc, setRuleDesc] = useState("");
  const [triggerType, setTriggerType] = useState<string>("keyword_match");
  const [connectionId, setConnectionId] = useState<string>("");
  const [priority, setPriority] = useState<number>(10);
  const [cooldown, setCooldown] = useState<number>(0);
  const [stopOnMatch, setStopOnMatch] = useState<boolean>(true);
  const [conditions, setConditions] = useState<Partial<RuleCondition>[]>([
    {
      condition_group: 0,
      condition_type: "keyword_contains",
      operator: "contains",
      match_value: { keywords: ["fees", "pricing", "கட்டணம்"] },
    },
  ]);
  const [actions, setActions] = useState<Partial<RuleAction>[]>([
    {
      action_type: "send_text_message",
      action_payload: { message_text: "Thank you for reaching out! Here are our service details." },
      delay_seconds: 0,
    },
  ]);

  // Simulator state
  const [simText, setSimText] = useState("What are the consultation fees? கட்டணம் எவ்வளவு?");
  const [simIsFirst, setSimIsFirst] = useState(false);
  const [simIsOptedOut, setSimIsOptedOut] = useState(false);
  const [simStatus, setSimStatus] = useState<"open" | "closed" | "pending_human">("open");
  const [simResult, setSimResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleToggleRule = (ruleId: string, currentActive: boolean) => {
    startTransition(async () => {
      const res = await toggleRuleActiveAction(business.slug, ruleId, !currentActive);
      if (res.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? { ...r, is_active: !currentActive } : r))
        );
        showNotification("success", `Rule ${!currentActive ? "activated" : "paused"}. Note: Live automation is awaiting approval.`);
      } else {
        showNotification("error", res.error || "Failed to toggle rule.");
      }
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this automation rule?")) return;
    startTransition(async () => {
      const res = await deleteAutomationRuleAction(business.slug, ruleId);
      if (res.success) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        showNotification("success", "Automation rule deleted successfully.");
      } else {
        showNotification("error", res.error || "Failed to delete rule.");
      }
    });
  };

  const handleEditRule = (rule: AutomationRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleDesc(rule.description || "");
    setTriggerType(rule.trigger_type);
    setConnectionId(rule.connection_id || "");
    setPriority(rule.priority);
    setCooldown(rule.cooldown_seconds);
    setStopOnMatch(rule.stop_processing_on_match);
    setConditions(rule.conditions && rule.conditions.length > 0 ? rule.conditions : []);
    setActions(rule.actions && rule.actions.length > 0 ? rule.actions : []);
    setActiveTab("builder");
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setRuleName("");
    setRuleDesc("");
    setTriggerType("keyword_match");
    setConnectionId("");
    setPriority(rules.length * 10 + 10);
    setCooldown(0);
    setStopOnMatch(true);
    setConditions([
      {
        condition_group: 0,
        condition_type: "keyword_contains",
        operator: "contains",
        match_value: { keywords: [] },
      },
    ]);
    setActions([
      {
        action_type: "send_text_message",
        action_payload: { message_text: "" },
        delay_seconds: 0,
      },
    ]);
    setActiveTab("builder");
  };

  const handleSaveRule = () => {
    if (!ruleName.trim()) {
      showNotification("error", "Rule name is required.");
      return;
    }

    startTransition(async () => {
      const res = await saveAutomationRuleAction(
        business.slug,
        {
          id: editingRule?.id,
          name: ruleName.trim(),
          description: ruleDesc.trim() || null,
          trigger_type: triggerType as any,
          connection_id: connectionId || null,
          priority,
          cooldown_seconds: cooldown,
          stop_processing_on_match: stopOnMatch,
          is_active: editingRule?.is_active ?? false,
        },
        conditions,
        actions
      );

      if (res.success && res.data) {
        const saved = res.data;
        setRules((prev) => {
          const idx = prev.findIndex((r) => r.id === saved.id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = saved;
            return updated.sort((a, b) => a.priority - b.priority);
          }
          return [...prev, saved].sort((a, b) => a.priority - b.priority);
        });
        showNotification("success", "Automation rule saved successfully!");
        setActiveTab("rules");
      } else {
        showNotification("error", res.error || "Failed to save rule.");
      }
    });
  };

  const handleRunSimulator = async () => {
    setIsSimulating(true);
    setSimResult(null);
    try {
      const res = await simulateRuleAction(business.slug, simText, {
        isFirstMessage: simIsFirst,
        isOptedOut: simIsOptedOut,
        conversationStatus: simStatus,
      });
      if (res.success) {
        setSimResult(res.data);
      } else {
        showNotification("error", res.error || "Simulation failed.");
      }
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTriggerQueueWorker = () => {
    startTransition(async () => {
      const res = await triggerQueueWorkerAction(business.slug);
      if (res.success && res.data) {
        showNotification(
          "success",
          `Queue worker executed: claimed ${res.data.claimedCount}, succeeded ${res.data.succeededCount}, skipped ${res.data.skippedCount}, failed ${res.data.failedCount}.`
        );
      } else {
        showNotification("error", res.error || "Worker trigger failed.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Mandatory Approval Safeguard */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-900 dark:text-amber-200 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">MANDATORY SAFEGUARD: Live WhatsApp Automations Paused</p>
            <p className="text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Deterministic automation engine is fully configured. As mandated, live dispatches to real customer numbers remain paused until separately approved. You can build, configure, prioritize, and dry-run all rules in the simulator safely.
            </p>
          </div>
        </div>
        <button
          onClick={handleTriggerQueueWorker}
          disabled={isPending}
          className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/40 font-medium transition-colors shrink-0 flex items-center gap-1.5"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
          Run Worker Batch
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 border ${
            notification.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
          }`}
        >
          {notification.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === "rules"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Bot className="w-4 h-4" />
            Rules List ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab("builder")}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === "builder"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Zap className="w-4 h-4" />
            {editingRule ? "Edit Rule" : "Rule Builder"}
          </button>
          <button
            onClick={() => setActiveTab("simulator")}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === "simulator"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Play className="w-4 h-4" />
            Dry-Run Simulator
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === "logs"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
            Execution Logs ({logs.length})
          </button>
        </div>

        {activeTab === "rules" && (
          <button
            onClick={handleNewRule}
            className="px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Automation Rule
          </button>
        )}
      </div>

      {/* TAB 1: RULES LIST */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-xl border-border">
              <Bot className="w-12 h-12 mx-auto text-muted-foreground opacity-50 mb-3" />
              <h3 className="font-semibold text-lg">No automation rules configured yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                Build deterministic welcome messages, Tamil and English keyword replies, and follow-ups.
              </p>
              <button
                onClick={handleNewRule}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground"
              >
                Create First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-card border border-border rounded-xl p-5 hover:border-primary/40 transition-all flex items-start justify-between gap-4"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
                        Priority {rule.priority}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                        {rule.trigger_type.replace(/_/g, " ").toUpperCase()}
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        {rule.connection_id
                          ? connections.find((c) => c.id === rule.connection_id)?.display_name || "Specific Number"
                          : "All Business Numbers"}
                      </span>
                      {rule.cooldown_seconds > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Cooldown {rule.cooldown_seconds / 3600}h
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-base text-foreground">{rule.name}</h4>
                    {rule.description && (
                      <p className="text-sm text-muted-foreground">{rule.description}</p>
                    )}

                    {/* Conditions and actions preview */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
                      <span>Conditions: {rule.conditions?.length || 0}</span>
                      <span>•</span>
                      <span>Actions: {rule.actions?.length || 0}</span>
                      <span>•</span>
                      <span>Stop on match: {rule.stop_processing_on_match ? "Yes" : "No"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {rule.is_active ? "Enabled" : "Paused"}
                      </span>
                      <input
                        type="checkbox"
                        checked={rule.is_active}
                        onChange={() => handleToggleRule(rule.id, rule.is_active)}
                        className="toggle toggle-primary cursor-pointer h-5 w-9 rounded-full bg-muted checked:bg-primary"
                      />
                    </div>

                    <button
                      onClick={() => handleEditRule(rule)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit Rule"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRIGGER-CONDITION-ACTION BUILDER */}
      {activeTab === "builder" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-lg font-semibold">
                {editingRule ? `Edit Rule: ${ruleName}` : "Create Automation Rule"}
              </h3>
              <p className="text-xs text-muted-foreground">
                3-Step Visual Builder: Trigger ➔ Condition Evaluation (AND/OR) ➔ Actions
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("rules")}
                className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                disabled={isPending}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Save Rule
              </button>
            </div>
          </div>

          {/* General Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Rule Name *</label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g., Horoscope Pricing Enquiry"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Priority (Lower = Evaluated First)</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 10)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Cooldown Seconds (0 = No cooldown)</label>
              <input
                type="number"
                value={cooldown}
                onChange={(e) => setCooldown(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-semibold text-foreground">Description</label>
              <input
                type="text"
                value={ruleDesc}
                onChange={(e) => setRuleDesc(e.target.value)}
                placeholder="Brief summary of what this automation does"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* STEP 1: TRIGGER */}
          <div className="border border-border/80 rounded-xl p-4 bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              TRIGGER: When this event occurs
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Trigger Type</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border"
                >
                  <option value="keyword_match">Keyword Match (Contains / Exact / Tamil & English)</option>
                  <option value="first_inbound_message">First Inbound Message (Welcome Message)</option>
                  <option value="inbound_message">Any Inbound WhatsApp Message</option>
                  <option value="inside_business_hours">Message Received Inside Business Hours</option>
                  <option value="outside_business_hours">Message Received Outside Business Hours</option>
                  <option value="customer_enquiry">Customer Enquiry Lead Capture</option>
                  <option value="human_requested">Human Agent Requested</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">WhatsApp Connection Number</label>
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border"
                >
                  <option value="">All Numbers in this Business Workspace</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name} ({c.phone_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STEP 2: CONDITIONS */}
          <div className="border border-border/80 rounded-xl p-4 bg-muted/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                CONDITIONS: Filter matching inbound messages
              </div>
              <button
                type="button"
                onClick={() =>
                  setConditions([
                    ...conditions,
                    {
                      condition_group: 0,
                      condition_type: "keyword_contains",
                      operator: "contains",
                      match_value: { keywords: [] },
                    },
                  ])
                }
                className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Condition
              </button>
            </div>

            <div className="space-y-3">
              {conditions.map((cond, idx) => (
                <div key={idx} className="bg-background border border-border rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Condition Type</label>
                      <select
                        value={cond.condition_type}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx] = { ...updated[idx], condition_type: e.target.value as any };
                          setConditions(updated);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border"
                      >
                        <option value="keyword_contains">Message Contains Keywords</option>
                        <option value="keyword_exact">Message Equals Exact Keyword</option>
                        <option value="keyword_starts_with">Message Starts With Keyword</option>
                        <option value="keyword_regex">Regular Expression (Regex)</option>
                        <option value="business_hours">Is Inside Business Hours</option>
                        <option value="outside_hours">Is Outside Business Hours</option>
                        <option value="first_time_contact">Is First-Time Contact</option>
                        <option value="contact_opt_in">Contact Is Opted In</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground">
                        Target Keywords (Comma-separated, supports Tamil & English)
                      </label>
                      <input
                        type="text"
                        value={((cond.match_value?.keywords as string[]) || []).join(", ")}
                        onChange={(e) => {
                          const words = e.target.value
                            .split(",")
                            .map((w) => w.trim())
                            .filter(Boolean);
                          const updated = [...conditions];
                          updated[idx] = {
                            ...updated[idx],
                            match_value: { ...updated[idx].match_value, keywords: words },
                          };
                          setConditions(updated);
                        }}
                        placeholder="e.g., fees, கட்டணம், pricing, ஜாதகம்"
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Group {cond.condition_group || 0} (AND with same group, OR with other groups)
                    </span>
                    <button
                      type="button"
                      onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* STEP 3: ACTIONS */}
          <div className="border border-border/80 rounded-xl p-4 bg-muted/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                ACTIONS: Execute when rule matches
              </div>
              <button
                type="button"
                onClick={() =>
                  setActions([
                    ...actions,
                    {
                      action_type: "send_text_message",
                      action_payload: { message_text: "" },
                      delay_seconds: 0,
                    },
                  ])
                }
                className="text-xs px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Action
              </button>
            </div>

            <div className="space-y-3">
              {actions.map((act, idx) => (
                <div key={idx} className="bg-background border border-border rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Action Type</label>
                      <select
                        value={act.action_type}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx] = { ...updated[idx], action_type: e.target.value as any };
                          setActions(updated);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border"
                      >
                        <option value="send_text_message">Send WhatsApp Text Message</option>
                        <option value="schedule_follow_up">Schedule Delayed Follow-Up Message</option>
                        <option value="update_conversation_status">Update Conversation Status</option>
                        <option value="apply_contact_label">Apply Contact Label</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">
                        Delay Seconds (0 = Immediate, 14400 = 4h)
                      </label>
                      <input
                        type="number"
                        value={act.delay_seconds || 0}
                        onChange={(e) => {
                          const updated = [...actions];
                          updated[idx] = {
                            ...updated[idx],
                            delay_seconds: parseInt(e.target.value, 10) || 0,
                          };
                          setActions(updated);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border"
                      />
                    </div>

                    <div className="flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => setActions(actions.filter((_, i) => i !== idx))}
                        className="text-xs text-destructive hover:underline flex items-center gap-1 pb-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove Action
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Message Text Content</label>
                    <textarea
                      rows={3}
                      value={(act.action_payload?.message_text as string) || ""}
                      onChange={(e) => {
                        const updated = [...actions];
                        updated[idx] = {
                          ...updated[idx],
                          action_payload: { ...updated[idx].action_payload, message_text: e.target.value },
                        };
                        setActions(updated);
                      }}
                      placeholder="Enter response message text in Tamil or English..."
                      className="w-full px-2.5 py-1.5 text-xs rounded-md bg-background border border-border"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DRY-RUN SIMULATOR */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" />
                Dry-Run Automation Simulator
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simulates rule evaluation in-memory. Zero WhatsApp API calls, zero database mutations.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Mock Incoming Message Text</label>
                <textarea
                  rows={3}
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="e.g., Tell me the fees and consultation details"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simIsFirst}
                    onChange={(e) => setSimIsFirst(e.target.checked)}
                    className="rounded border-border"
                  />
                  First-time contact (Welcome Trigger)
                </label>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simIsOptedOut}
                    onChange={(e) => setSimIsOptedOut(e.target.checked)}
                    className="rounded border-border"
                  />
                  Contact is Opted Out (STOP)
                </label>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Thread Status</label>
                <select
                  value={simStatus}
                  onChange={(e) => setSimStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border"
                >
                  <option value="open">Open (Bot active)</option>
                  <option value="pending_human">Pending Human Agent (Bot suppressed)</option>
                  <option value="closed">Closed Thread</option>
                </select>
              </div>

              <button
                onClick={handleRunSimulator}
                disabled={isSimulating}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {isSimulating ? <RotateCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Evaluate Simulation
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h4 className="font-semibold text-sm">Simulation Execution Trace</h4>
            {!simResult ? (
              <div className="text-center py-12 text-xs text-muted-foreground">
                Run a simulation on the left to inspect the evaluation trace and matched actions.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="font-semibold">Outcome Status:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full ${
                      simResult.matched
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {simResult.status.toUpperCase()}
                  </span>
                </div>

                {simResult.ruleName && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border">
                    <span className="text-muted-foreground">Matched Rule:</span>
                    <p className="font-semibold text-foreground text-sm mt-0.5">{simResult.ruleName}</p>
                  </div>
                )}

                {simResult.skipReason && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                    <span className="font-semibold">Suppression / Skip Reason:</span>
                    <p className="mt-0.5">{simResult.skipReason}</p>
                  </div>
                )}

                {simResult.actionsToDispatch?.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-semibold text-foreground">Dispatched Actions Preview:</span>
                    {simResult.actionsToDispatch.map((act: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-background border border-border space-y-1">
                        <div className="flex items-center justify-between font-medium">
                          <span className="text-primary">{act.action_type}</span>
                          <span className="text-muted-foreground text-[11px]">
                            {act.delay_seconds === 0 ? "Immediate Dispatch" : `Delayed: ${act.delay_seconds}s`}
                          </span>
                        </div>
                        {act.payload?.message_text && (
                          <p className="text-muted-foreground whitespace-pre-wrap bg-muted/30 p-2 rounded">
                            {act.payload.message_text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-[11px] text-muted-foreground text-right pt-2">
                  Engine Latency: {simResult.latencyMs} ms (Zero AI API calls)
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === "logs" && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Automation Execution Audit Logs</h3>
            <span className="text-xs text-muted-foreground">Retention: 14 Days</span>
          </div>

          {logs.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No automation logs recorded yet. Once live messages are evaluated, execution history will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                  <tr>
                    <th scope="col" className="py-2.5 px-3">Timestamp</th>
                    <th scope="col" className="py-2.5 px-3">Trigger / Rule</th>
                    <th scope="col" className="py-2.5 px-3">Status</th>
                    <th scope="col" className="py-2.5 px-3">Detail / Reason</th>
                    <th scope="col" className="py-2.5 px-3 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {log.trigger_matched}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            log.status === "success"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : log.status === "delayed"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}
                        >
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {log.skip_reason || log.error_message || "Action executed successfully"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground whitespace-nowrap">
                        {log.execution_time_ms ? `${log.execution_time_ms} ms` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
