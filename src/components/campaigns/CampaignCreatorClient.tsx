"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Business,
  BusinessMember,
  CampaignAudienceFilters,
  CampaignAudiencePreviewResult,
  CampaignAudienceType,
  CampaignMessageType,
  CrmCategory,
  CrmSegment,
  SafeWhatsAppConnection,
  UserProfile,
  WhatsAppContact,
  WhatsAppMessageTemplate,
} from "@/types/database";
import {
  createCampaignAction,
  previewCampaignAudienceAction,
} from "@/app/actions/campaigns";
import { kolkataToUtc } from "@/lib/analytics/date-utils";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileEdit,
  FileText,
  Filter,
  Image as ImageIcon,
  Info,
  Megaphone,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";

interface CampaignCreatorClientProps {
  business: Business;
  currentUser: UserProfile;
  currentMembership: BusinessMember;
  connections: SafeWhatsAppConnection[];
  templates: WhatsAppMessageTemplate[];
  categories: CrmCategory[];
  segments: CrmSegment[];
  sampleContacts: WhatsAppContact[];
}

export function CampaignCreatorClient({
  business,
  currentUser,
  currentMembership,
  connections,
  templates,
  categories,
  segments,
  sampleContacts,
}: CampaignCreatorClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [connectionId, setConnectionId] = useState<string>(connections[0]?.id || "");
  const [messageType, setMessageType] = useState<CampaignMessageType>("template");

  // Step 2: Audience Builder State
  const [audienceType, setAudienceType] = useState<CampaignAudienceType>("all_contacts");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSegment, setSelectedSegment] = useState<string>("");
  const [includedContactIds, setIncludedContactIds] = useState<string[]>([]);
  const [excludedContactIds, setExcludedContactIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState<string>("");

  // Live Audience Preview State
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [audiencePreview, setAudiencePreview] = useState<CampaignAudiencePreviewResult | null>(null);

  // Step 3: Message Composer State
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [textContent, setTextContent] = useState<string>("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState<string>("");

  // Step 4: Schedule State
  const [sendOption, setSendOption] = useState<"immediate" | "scheduled">("immediate");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [batchSize, setBatchSize] = useState<number>(50);
  const [dispatchIntervalMs, setDispatchIntervalMs] = useState<number>(1000);

  // Approved templates only for template campaigns
  const approvedTemplates = templates.filter((t) => t.status === "APPROVED" && !t.is_archived);

  // Automatically select first template if available
  useEffect(() => {
    if (approvedTemplates.length > 0 && !selectedTemplateName) {
      setSelectedTemplateName(approvedTemplates[0].template_name || (approvedTemplates[0] as any).name);
    }
  }, [approvedTemplates, selectedTemplateName]);

  // Extract variable placeholders from selected template
  const activeTemplate = templates.find(
    (t) => (t.template_name || (t as any).name) === selectedTemplateName
  );

  const getTemplateBodyText = (t: WhatsAppMessageTemplate) => {
    if ((t as any).body_text) return (t as any).body_text;
    if (Array.isArray(t.components)) {
      const bodyComp = (t.components as any[]).find((c) => c.type === "BODY" || c.type === "body");
      if (bodyComp?.text) return bodyComp.text;
    }
    return "Template message preview";
  };

  const getTemplateFooterText = (t: WhatsAppMessageTemplate) => {
    if ((t as any).footer_text) return (t as any).footer_text;
    if (Array.isArray(t.components)) {
      const footerComp = (t.components as any[]).find((c) => c.type === "FOOTER" || c.type === "footer");
      if (footerComp?.text) return footerComp.text;
    }
    return null;
  };

  // Fetch Audience Preview when audience settings change
  const fetchAudiencePreview = async () => {
    setPreviewLoading(true);
    try {
      const filters: CampaignAudienceFilters = {
        category_slug: audienceType === "category" ? selectedCategory : undefined,
        segment_id: audienceType === "segment" ? selectedSegment : undefined,
        included_contact_ids: audienceType === "manual" ? includedContactIds : undefined,
        excluded_contact_ids: excludedContactIds.length > 0 ? excludedContactIds : undefined,
      };

      const res = await previewCampaignAudienceAction(
        business.slug,
        messageType,
        audienceType,
        filters
      );

      if (res.success && res.preview) {
        setAudiencePreview(res.preview);
      }
    } catch {
      // Ignore
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 2) {
      fetchAudiencePreview();
    }
  }, [currentStep, audienceType, selectedCategory, selectedSegment, includedContactIds, excludedContactIds, messageType]);

  // Handle Quick Schedule Presets
  const handleQuickPreset = (preset: "hour" | "tmrw_10am" | "in_2days") => {
    const now = new Date();
    let target = new Date();

    if (preset === "hour") {
      target = new Date(now.getTime() + 60 * 60 * 1000);
    } else if (preset === "tmrw_10am") {
      target.setDate(now.getDate() + 1);
      target.setHours(10, 0, 0, 0);
    } else if (preset === "in_2days") {
      target.setDate(now.getDate() + 2);
      target.setHours(11, 0, 0, 0);
    }

    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    const hh = String(target.getHours()).padStart(2, "0");
    const min = String(target.getMinutes()).padStart(2, "0");

    setScheduledDate(`${yyyy}-${mm}-${dd}`);
    setScheduledTime(`${hh}:${min}`);
    setSendOption("scheduled");
  };

  // Submit Campaign
  const handleSubmit = async (saveAsDraft: boolean = false) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let finalUtcScheduled: string | undefined = undefined;
      if (sendOption === "scheduled" && scheduledDate && scheduledTime) {
        const [year, month, day] = scheduledDate.split("-").map(Number);
        const [hours, minutes] = scheduledTime.split(":").map(Number);
        finalUtcScheduled = kolkataToUtc(year, month - 1, day, hours, minutes).toISOString();
      }

      const formData = new FormData();
      formData.set("name", name);
      if (description) formData.set("description", description);
      formData.set("connectionId", connectionId);
      formData.set("messageType", messageType);
      formData.set("status", saveAsDraft ? "draft" : finalUtcScheduled ? "scheduled" : "draft");

      if (messageType === "template") {
        if (activeTemplate) formData.set("templateId", activeTemplate.id);
        formData.set("templateName", selectedTemplateName);
        formData.set("templateLanguage", activeTemplate?.language || "en_US");
        formData.set("templateVariables", JSON.stringify(templateVariables));
      } else if (messageType === "text") {
        formData.set("content", textContent);
      } else {
        if (mediaFile) formData.set("mediaFile", mediaFile);
        if (mediaCaption) formData.set("mediaCaption", mediaCaption);
      }

      formData.set("audienceType", audienceType);
      const audienceFilters: CampaignAudienceFilters = {
        category_slug: audienceType === "category" ? selectedCategory : undefined,
        segment_id: audienceType === "segment" ? selectedSegment : undefined,
        included_contact_ids: audienceType === "manual" ? includedContactIds : undefined,
        excluded_contact_ids: excludedContactIds.length > 0 ? excludedContactIds : undefined,
      };
      formData.set("audienceFilters", JSON.stringify(audienceFilters));

      if (finalUtcScheduled) {
        formData.set("scheduledAt", finalUtcScheduled);
      }
      formData.set("batchSize", String(batchSize));
      formData.set("dispatchIntervalMs", String(dispatchIntervalMs));

      const res = await createCampaignAction(business.slug, formData);

      if (res.success && res.campaign) {
        router.push(`/workspace/${business.slug}/campaigns/${res.campaign.id}`);
      } else {
        setErrorMessage(res.error || "Failed to create campaign.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validation before advancing to next step
  const canAdvance = () => {
    if (currentStep === 1) {
      return name.trim().length > 0 && connectionId.length > 0;
    }
    if (currentStep === 2) {
      if (audienceType === "category" && !selectedCategory) return false;
      if (audienceType === "segment" && !selectedSegment) return false;
      if (audienceType === "manual" && includedContactIds.length === 0) return false;
      return true;
    }
    if (currentStep === 3) {
      if (messageType === "template") return selectedTemplateName.length > 0;
      if (messageType === "text") return textContent.trim().length > 0;
      return mediaFile !== null;
    }
    return true;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Back button and title */}
      <div>
        <Link
          href={`/workspace/${business.slug}/campaigns`}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Campaigns
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
          <Megaphone className="w-6 h-6 text-indigo-600" />
          Create WhatsApp Campaign
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Target CRM contacts, select approved Meta templates, and configure automated dispatch for {business.name}.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Stepper Progress */}
      <div className="grid grid-cols-4 gap-2 border-b border-slate-200 pb-4">
        {[
          { num: 1, title: "1. Details & Channel" },
          { num: 2, title: "2. Audience Builder" },
          { num: 3, title: "3. Message Composer" },
          { num: 4, title: "4. Schedule & Launch" },
        ].map((s) => (
          <div
            key={s.num}
            className={`text-xs font-semibold py-2 px-1 text-center rounded-lg border transition-colors ${
              currentStep === s.num
                ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-bold"
                : currentStep > s.num
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-400"
            }`}
          >
            {s.title}
          </div>
        ))}
      </div>

      {/* STEP 1: CAMPAIGN DETAILS */}
      {currentStep === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Step 1: Campaign Details & WhatsApp Channel
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Campaign Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Diwali Horoscope Consultation Offer 2026"
                className="w-full text-sm rounded-lg border border-slate-300 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Campaign Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief internal note regarding audience intent or target promo..."
                className="w-full text-sm rounded-lg border border-slate-300 px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  WhatsApp Connection <span className="text-rose-500">*</span>
                </label>
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name || c.phone_number} ({c.phone_number_id})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Select the verified phone number for outbound dispatch.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Message Format <span className="text-rose-500">*</span>
                </label>
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as CampaignMessageType)}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="template">Approved Meta Template (Recommended for bulk)</option>
                  <option value="text">Free-form Text (24h Service Window Required)</option>
                  <option value="image">Image Attachment (Phase 12.2)</option>
                  <option value="document">PDF / Document (Phase 12.2)</option>
                  <option value="video">Video Message (Phase 12.2)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  {messageType === "template"
                    ? "Approved Meta templates can be sent outside the 24h customer window."
                    : "Non-template messages strictly require an open 24h customer window under WhatsApp policy."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: AUDIENCE BUILDER */}
      {currentStep === 2 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-lg font-semibold text-slate-900">Step 2: Audience Selection & Compliance Guard</h2>
            <button
              onClick={fetchAudiencePreview}
              disabled={previewLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? "animate-spin" : ""}`} /> Refresh Preview
            </button>
          </div>

          {/* Selection Source Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { type: "all_contacts", label: "All CRM Contacts", desc: "All active contacts" },
              { type: "segment", label: "Saved Segment", desc: "CRM saved filter" },
              { type: "category", label: "Contact Category", desc: "By lead category" },
              { type: "manual", label: "Manual Selection", desc: "Pick specific contacts" },
            ].map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => setAudienceType(opt.type as CampaignAudienceType)}
                className={`p-3.5 rounded-lg border text-left transition-all ${
                  audienceType === opt.type
                    ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="font-semibold text-xs text-slate-900">{opt.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Type-Specific Filter Selector */}
          {audienceType === "category" && (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select CRM Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800"
              >
                <option value="">-- Choose Category --</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name} ({cat.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          {audienceType === "segment" && (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Saved CRM Segment</label>
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white text-slate-800"
              >
                <option value="">-- Choose Segment --</option>
                {segments.map((seg) => (
                  <option key={seg.id} value={seg.id}>
                    {seg.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {audienceType === "manual" && (
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Select Contacts Manually</label>
                <span className="text-xs text-slate-500">{includedContactIds.length} contacts selected</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100 bg-white p-2 rounded border border-slate-200">
                {sampleContacts.map((contact) => {
                  const isChecked = includedContactIds.includes(contact.id);
                  return (
                    <label key={contact.id} className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-slate-50 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setIncludedContactIds((prev) => [...prev, contact.id]);
                          } else {
                            setIncludedContactIds((prev) => prev.filter((id) => id !== contact.id));
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium text-slate-800">{contact.display_name || "Unnamed"}</span>
                      <span className="font-mono text-slate-400">({contact.phone_number})</span>
                      {contact.is_opted_out && (
                        <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">Opted Out</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compliance & Live Preview Box */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Audience Compliance & Eligibility Snapshot</h3>
              </div>
              {previewLoading && <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />}
            </div>

            {audiencePreview ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-medium text-slate-500 uppercase">Total Audience</span>
                    <div className="text-xl font-bold text-slate-900">{audiencePreview.totalCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-200">
                    <span className="text-[11px] font-medium text-emerald-600 uppercase">Estimated Eligible</span>
                    <div className="text-xl font-bold text-emerald-700">{audiencePreview.eligibleCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-rose-200">
                    <span className="text-[11px] font-medium text-rose-600 uppercase">Excluded</span>
                    <div className="text-xl font-bold text-rose-700">{audiencePreview.excludedCount}</div>
                  </div>
                </div>

                {audiencePreview.excludedCount > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="text-xs font-semibold text-slate-700 mb-1.5">Compliance Exclusion Breakdown:</div>
                    <div className="space-y-1">
                      {Object.entries(audiencePreview.exclusionsBreakdown).map(([reason, count]) => (
                        <div key={reason} className="flex justify-between text-xs text-slate-600">
                          <span className="flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" /> {reason}
                          </span>
                          <span className="font-semibold text-rose-600">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500">Calculating audience eligibility...</div>
            )}
          </div>
        </div>
      )}

      {/* STEP 3: MESSAGE COMPOSER */}
      {currentStep === 3 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Step 3: Message Composition & Meta Preview
          </h2>

          {messageType === "template" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Select Approved Meta Template <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedTemplateName}
                  onChange={(e) => {
                    setSelectedTemplateName(e.target.value);
                    setTemplateVariables({});
                  }}
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2.5 bg-white text-slate-800"
                >
                  {approvedTemplates.map((t) => {
                    const tName = t.template_name || (t as any).name;
                    return (
                      <option key={t.id} value={tName}>
                        {tName} ({t.category} - {t.language})
                      </option>
                    );
                  })}
                </select>
              </div>

              {activeTemplate && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Variables input */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Template Variables
                    </h4>
                    {["1", "2", "3"].map((idx) => (
                      <div key={idx}>
                        <label className="block text-xs text-slate-600 mb-1">
                          Variable {"{{" + idx + "}}"}
                        </label>
                        <input
                          type="text"
                          value={templateVariables[idx] || ""}
                          onChange={(e) =>
                            setTemplateVariables((prev) => ({ ...prev, [idx]: e.target.value }))
                          }
                          placeholder={`Value for {{${idx}}}`}
                          className="w-full text-xs rounded border border-slate-300 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    ))}
                  </div>

                  {/* WhatsApp Message Preview Bubble */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      WhatsApp Preview
                    </h4>
                    <div className="rounded-xl bg-[#EFEAE2] p-4 border border-slate-200 max-w-sm">
                      <div className="bg-white rounded-lg p-3.5 shadow-sm text-xs text-slate-800 space-y-1.5">
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {getTemplateBodyText(activeTemplate)
                            .replace(/\{\{1\}\}/g, templateVariables["1"] || "{{1}}")
                            .replace(/\{\{2\}\}/g, templateVariables["2"] || "{{2}}")
                            .replace(/\{\{3\}\}/g, templateVariables["3"] || "{{3}}")}
                        </p>
                        {getTemplateFooterText(activeTemplate) && (
                          <p className="text-[10px] text-slate-400 pt-1">
                            {getTemplateFooterText(activeTemplate)}
                          </p>
                        )}
                        <div className="text-[10px] text-slate-400 text-right">10:45 AM</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {messageType === "text" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Message Content <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  rows={5}
                  placeholder="Enter message text... (e.g. Namaskaram {{name}}, your horoscope appointment is scheduled for tomorrow.)"
                  className="w-full text-sm rounded-lg border border-slate-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>Placeholders like {"{{name}}"} are supported.</span>
                  <span>{textContent.length} / 4096 characters</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  Under WhatsApp policy, free-form text messages can only be delivered to contacts with an active 24-hour service window.
                </span>
              </div>
            </div>
          )}

          {["image", "document", "audio", "video"].includes(messageType) && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Attach Media File ({messageType.toUpperCase()}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Media Caption (Optional)
                </label>
                <input
                  type="text"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  placeholder="Optional caption text to accompany media..."
                  className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: SCHEDULE & LAUNCH */}
      {currentStep === 4 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Step 4: Dispatch Timing & Launch Configuration
          </h2>

          <div className="space-y-5">
            {/* Dispatch timing options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  sendOption === "immediate"
                    ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sendOption"
                    value="immediate"
                    checked={sendOption === "immediate"}
                    onChange={() => setSendOption("immediate")}
                    className="text-indigo-600"
                  />
                  <span className="font-bold text-sm text-slate-900">Queue for Dispatch Now</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 pl-5">
                  Prepares the audience and marks campaign as queued for immediate background processing.
                </p>
              </label>

              <label
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  sendOption === "scheduled"
                    ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sendOption"
                    value="scheduled"
                    checked={sendOption === "scheduled"}
                    onChange={() => setSendOption("scheduled")}
                    className="text-indigo-600"
                  />
                  <span className="font-bold text-sm text-slate-900">Schedule for Future Time</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-500 pl-5">
                  Set specific date and time in Asia/Kolkata (IST) timezone.
                </p>
              </label>
            </div>

            {/* Scheduled picker if selected */}
            {sendOption === "scheduled" && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-700">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset("hour")}
                    className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100"
                  >
                    +1 Hour
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset("tmrw_10am")}
                    className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100"
                  >
                    Tomorrow 10:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset("in_2days")}
                    className="text-xs px-2.5 py-1 bg-white border border-slate-300 rounded hover:bg-slate-100"
                  >
                    In 2 Days
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Date (YYYY-MM-DD)</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 px-3 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Time (Asia/Kolkata)</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 px-3 py-2 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Batching & Rate Limits */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Size</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full text-xs rounded border border-slate-300 px-3 py-2"
                />
                <span className="text-[10px] text-slate-400">Recipients per worker cycle (1-200)</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Interval (ms)</label>
                <input
                  type="number"
                  min={200}
                  max={5000}
                  step={100}
                  value={dispatchIntervalMs}
                  onChange={(e) => setDispatchIntervalMs(Number(e.target.value))}
                  className="w-full text-xs rounded border border-slate-300 px-3 py-2"
                />
                <span className="text-[10px] text-slate-400">Delay between message bursts (200-5000ms)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" /> Previous
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isSubmitting || !name.trim()}
            onClick={() => handleSubmit(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileEdit className="w-4 h-4" /> Save as Draft
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              disabled={!canAdvance()}
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Next Step <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting || !canAdvance()}
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 shadow disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Preparing...
                </>
              ) : sendOption === "scheduled" ? (
                <>
                  <Clock className="w-4 h-4" /> Schedule Campaign
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Launch Campaign
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
