"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  CornerDownLeft,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Phone,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Tag,
  User,
  X,
} from "lucide-react";
import {
  Business,
  SafeWhatsAppConnection,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppMessageTemplate,
} from "@/types/database";
import { startNewConversationAction } from "@/app/actions/inbox";
import { extractTemplateVariables, replaceVariables } from "@/lib/templates/validation";
import { getDefaultBusinessTemplates } from "@/lib/templates/default-templates";

interface StartConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business;
  connections: SafeWhatsAppConnection[];
  approvedTemplates: WhatsAppMessageTemplate[];
  defaultConnectionId?: string;
  onConversationStarted: (result: {
    conversationId: string;
    conversation?: WhatsAppConversation | null;
    message?: WhatsAppMessage;
  }) => void;
}

export function StartConversationModal({
  isOpen,
  onClose,
  business,
  connections,
  approvedTemplates,
  defaultConnectionId,
  onConversationStarted,
}: StartConversationModalProps) {
  const enabledConnections = useMemo(
    () => connections.filter((c) => c.is_enabled),
    [connections]
  );

  const initialConnId = useMemo(() => {
    if (
      defaultConnectionId &&
      defaultConnectionId !== "all" &&
      enabledConnections.some((c) => c.id === defaultConnectionId)
    ) {
      return defaultConnectionId;
    }
    return enabledConnections[0]?.id || connections[0]?.id || "";
  }, [defaultConnectionId, enabledConnections, connections]);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("");
  const [connectionId, setConnectionId] = useState(initialConnId);
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateName, setSelectedTemplateName] = useState("hello_world");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConnectionId(initialConnId);
      setError(null);
    }
  }, [isOpen, initialConnId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const categorySuggestions = useMemo(() => {
    if (business.slug === "vivaham") {
      return [
        "New Registration",
        "Groom",
        "Bride",
        "Membership Enquiry",
        "Active Member",
        "Follow-up Required",
      ];
    }
    return [
      "New Enquiry",
      "Astrology Consultation",
      "Horoscope Matching",
      "Numerology",
      "Existing Customer",
      "Follow-up Required",
    ];
  }, [business.slug]);

  const templatesList = useMemo(() => {
    const base =
      approvedTemplates.length > 0
        ? approvedTemplates
        : getDefaultBusinessTemplates(business.id, business.slug);
    return base.filter(
      (t) =>
        t.status === "APPROVED" &&
        !t.is_archived &&
        (!t.connection_id || !connectionId || t.connection_id === connectionId)
    );
  }, [approvedTemplates, business.id, business.slug, connectionId]);

  const selectedTemplate = useMemo(() => {
    return (
      templatesList.find((t) => t.template_name === selectedTemplateName) ||
      templatesList[0] ||
      null
    );
  }, [templatesList, selectedTemplateName]);

  const varExtraction = useMemo(
    () => extractTemplateVariables(selectedTemplate?.components),
    [selectedTemplate]
  );

  useEffect(() => {
    if (!selectedTemplate) return;
    const vars: Record<string, string> = {};
    const exampleTexts = (
      selectedTemplate.components?.find((c: any) => c.type === "BODY") as any
    )?.example?.body_text?.[0];
    varExtraction.allVariables.forEach((v, idx) => {
      if (v === "1" && displayName.trim()) {
        vars[v] = displayName.trim();
      } else {
        vars[v] = exampleTexts?.[idx] || "";
      }
    });
    setTemplateVariables(vars);
  }, [selectedTemplate?.template_name]);

  const filteredTemplates = useMemo(() => {
    if (!templateSearch.trim()) return templatesList;
    const q = templateSearch.toLowerCase().trim();
    return templatesList.filter(
      (t) =>
        t.template_name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
    );
  }, [templatesList, templateSearch]);

  const normalizedDigits = phoneNumber.replace(/\D/g, "");
  const isPhoneValid = normalizedDigits.length >= 7 && normalizedDigits.length <= 15;

  const missingVariables = useMemo(
    () => varExtraction.allVariables.filter((v) => !templateVariables[v]?.trim()),
    [varExtraction.allVariables, templateVariables]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!isPhoneValid) {
      setError("Please enter a valid WhatsApp phone number with country code (7–15 digits, e.g. +91 98400 12345).");
      return;
    }

    if (!displayName.trim()) {
      setError("Please enter the customer's name.");
      return;
    }

    if (!connectionId) {
      setError("Please select an active WhatsApp line to send from.");
      return;
    }

    if (!selectedTemplate) {
      setError("Please select an approved WhatsApp template.");
      return;
    }

    if (missingVariables.length > 0) {
      setError(
        `Please fill all template variables: {{${missingVariables.join("}}, {{")}}}`
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await startNewConversationAction({
        businessSlug: business.slug,
        phoneNumber: phoneNumber.trim(),
        displayName: displayName.trim(),
        category: category.trim() || null,
        connectionId,
        templateName: selectedTemplate.template_name,
        templateLanguage: selectedTemplate.language || "en_US",
        templateVariables,
      });

      if (res.success && res.conversationId) {
        onConversationStarted({
          conversationId: res.conversationId,
          conversation: res.conversation,
          message: res.message,
        });
        setPhoneNumber("");
        setDisplayName("");
        setCategory("");
        onClose();
      } else {
        setError(res.error || "Failed to initiate WhatsApp conversation.");
      }
    } catch (err: any) {
      setError(err?.message || "Unexpected error while starting chat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-new-chat-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <MessageSquarePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="start-new-chat-title" className="text-sm font-bold text-slate-900">
                Start New WhatsApp Conversation
              </h3>
              <p className="text-[11px] text-slate-500">
                Initiate an outbound template conversation with any valid phone number in {business.name}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close start new chat modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-6 overflow-y-auto flex-1">
            {/* Left Column: Recipient, Line & Template Selection */}
            <div className="lg:col-span-7 space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Recipient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="start-chat-phone"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Recipient WhatsApp Number *</span>
                  </label>
                  <input
                    id="start-chat-phone"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="+91 98400 12345"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Include country code (E.164, e.g. +919840012345).
                    {phoneNumber && (
                      <span
                        className={`ml-1 font-semibold ${
                          isPhoneValid ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        ({normalizedDigits.length} digits)
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="start-chat-name"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Customer Name *</span>
                  </label>
                  <input
                    id="start-chat-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="e.g. Karthik Sundaram"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Saved automatically in {business.name} CRM.
                  </p>
                </div>
              </div>

              {/* Line & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="start-chat-line"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Send From WhatsApp Line *</span>
                  </label>
                  <select
                    id="start-chat-line"
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {enabledConnections.length === 0 ? (
                      <option value="">No active WhatsApp line configured</option>
                    ) : (
                      enabledConnections.map((conn) => (
                        <option key={conn.id} value={conn.id}>
                          {conn.display_name} ({conn.phone_number})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="start-chat-category"
                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
                  >
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <span>CRM Category (Optional)</span>
                  </label>
                  <select
                    id="start-chat-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select category...</option>
                    {categorySuggestions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Template Picker */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Select Approved Opening Template ({filteredTemplates.length})</span>
                  </label>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search approved templates..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {filteredTemplates.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      No approved templates match your search.
                    </p>
                  ) : (
                    filteredTemplates.map((tpl) => {
                      const isSelected = selectedTemplate?.template_name === tpl.template_name;
                      return (
                        <button
                          key={tpl.id || tpl.template_name}
                          type="button"
                          onClick={() => setSelectedTemplateName(tpl.template_name)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/40 shadow-2xs ring-1 ring-indigo-500/20"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-900 font-mono text-[11px]">
                              {tpl.template_name}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600">
                                {tpl.category}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                                {tpl.language}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                APPROVED
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed">
                            {(tpl.components?.find((c: any) => c.type === "BODY") as any)?.text ||
                              "Approved WhatsApp template"}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Dynamic Template Variables */}
              {selectedTemplate && varExtraction.allVariables.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Template Variables ({varExtraction.allVariables.length})
                    </span>
                    {missingVariables.length > 0 ? (
                      <span className="text-[10px] text-amber-600 font-semibold">
                        {missingVariables.length} required
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ready
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {varExtraction.allVariables.map((varNum) => {
                      const isMissing = !templateVariables[varNum]?.trim();
                      return (
                        <div key={varNum} className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                            <span>
                              Variable <code className="text-indigo-600">{`{{${varNum}}}`}</code>
                            </span>
                            {isMissing && (
                              <span className="text-[10px] text-rose-500">Required</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={templateVariables[varNum] || ""}
                            onChange={(e) =>
                              setTemplateVariables((prev) => ({
                                ...prev,
                                [varNum]: e.target.value,
                              }))
                            }
                            placeholder={`Value for {{${varNum}}}`}
                            className={`w-full px-2.5 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-1 ${
                              isMissing
                                ? "border-amber-300 focus:ring-amber-500"
                                : "border-slate-200 focus:ring-indigo-500"
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Live WhatsApp Preview & Policy */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Live WhatsApp Message Preview
                </span>
                <div className="rounded-2xl bg-[#efeae2] p-3.5 border border-slate-200 shadow-inner min-h-[240px] flex flex-col justify-center">
                  {selectedTemplate ? (
                    <div className="bg-white rounded-xl p-3.5 shadow-sm space-y-2 border border-slate-100 max-w-sm">
                      {(() => {
                        const header = selectedTemplate.components?.find(
                          (c: any) => c.type === "HEADER"
                        ) as any;
                        if (!header) return null;
                        if (header.format === "TEXT") {
                          return (
                            <h4 className="font-bold text-xs text-slate-900 border-b border-slate-100 pb-1">
                              {replaceVariables(header.text || "", templateVariables)}
                            </h4>
                          );
                        }
                        return (
                          <div className="w-full h-16 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 gap-1.5 text-[11px] border border-slate-200">
                            <ImageIcon className="w-4 h-4" />
                            <span className="font-semibold uppercase tracking-wider text-[10px]">
                              {header.format || "MEDIA"} HEADER
                            </span>
                          </div>
                        );
                      })()}

                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {replaceVariables(
                          (
                            selectedTemplate.components?.find(
                              (c: any) => c.type === "BODY"
                            ) as any
                          )?.text || "",
                          templateVariables
                        )}
                      </p>

                      {(() => {
                        const footer = selectedTemplate.components?.find(
                          (c: any) => c.type === "FOOTER"
                        ) as any;
                        if (!footer?.text) return null;
                        return <p className="text-[10px] text-slate-400 italic">{footer.text}</p>;
                      })()}

                      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-0.5">
                        <span suppressHydrationWarning>
                          {new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <CheckCheck className="w-3 h-3 text-indigo-500" />
                      </div>

                      {(() => {
                        const btnComp = selectedTemplate.components?.find(
                          (c: any) => c.type === "BUTTONS"
                        ) as any;
                        if (!btnComp || !Array.isArray(btnComp.buttons) || btnComp.buttons.length === 0) {
                          return null;
                        }
                        return (
                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            {btnComp.buttons.map((b: any, idx: number) => (
                              <div
                                key={idx}
                                className="w-full py-1 px-2 rounded-lg border border-slate-200 text-center text-[11px] font-semibold text-indigo-600 bg-slate-50/50 flex items-center justify-center gap-1"
                              >
                                {b.type === "URL" && <Globe className="w-3 h-3" />}
                                {b.type === "PHONE_NUMBER" && <Phone className="w-3 h-3" />}
                                {b.type === "QUICK_REPLY" && <CornerDownLeft className="w-3 h-3" />}
                                <span>{b.text}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center">
                      Select an approved template to preview.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 leading-snug">
                <span className="font-semibold flex items-center gap-1 text-amber-800 mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Meta Business-Initiated Policy
                </span>
                New WhatsApp conversations outside a 24-hour customer care window must start with a Meta-approved template. Once the customer replies, free-form chat &amp; media unlock for 24 hours.
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs text-slate-500">
              {!isPhoneValid ? (
                <span className="text-slate-500">Enter a valid recipient phone number</span>
              ) : missingVariables.length > 0 ? (
                <span className="text-amber-600 font-medium">
                  Fill all {missingVariables.length} template variable(s)
                </span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Ready to initiate WhatsApp chat
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  !isPhoneValid ||
                  !displayName.trim() ||
                  !connectionId ||
                  !selectedTemplate ||
                  missingVariables.length > 0
                }
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed shadow-xs flex items-center gap-1.5 transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Starting Chat...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Start Chat &amp; Send Template</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
