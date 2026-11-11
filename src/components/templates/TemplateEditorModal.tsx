"use client";

import React, { useState } from "react";
import {
  X,
  FileEdit,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCheck,
  Globe,
  Phone,
  CornerDownLeft,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  WhatsAppMessageTemplate,
  TemplateDraftInput,
  TemplateCategory,
  TemplateHeaderFormat,
  TemplateButton,
  TemplateButtonType,
} from "@/lib/templates/types";
import {
  validateTemplateDraft,
  parseComponentsToDraft,
  replaceVariables,
  extractVariables,
} from "@/lib/templates/validation";

interface ConnectionItem {
  id: string;
  display_name: string;
  phone_number: string;
}

interface TemplateEditorModalProps {
  businessSlug: string;
  templateToEdit?: WhatsAppMessageTemplate | null;
  connections?: ConnectionItem[];
  onClose: () => void;
  onSave: (draft: TemplateDraftInput, templateId?: string) => Promise<{ success: boolean; error?: string }>;
}

export function TemplateEditorModal({
  businessSlug,
  templateToEdit,
  connections = [],
  onClose,
  onSave,
}: TemplateEditorModalProps) {
  const isEditing = !!templateToEdit;

  const parsed = templateToEdit
    ? parseComponentsToDraft(templateToEdit.components)
    : null;

  const [templateName, setTemplateName] = useState(templateToEdit?.template_name || "");
  const [category, setCategory] = useState<TemplateCategory>(
    templateToEdit?.category || "UTILITY"
  );
  const [language, setLanguage] = useState(templateToEdit?.language || "en_US");
  const [connectionId, setConnectionId] = useState<string>(templateToEdit?.connection_id || "");
  const [description, setDescription] = useState<string>("");
  const [headerFormat, setHeaderFormat] = useState<TemplateHeaderFormat | "NONE">(
    parsed?.header_format || "NONE"
  );
  const [headerText, setHeaderText] = useState(parsed?.header_text || "");
  const [bodyText, setBodyText] = useState(parsed?.body_text || "");
  const [footerText, setFooterText] = useState(parsed?.footer_text || "");
  const [buttons, setButtons] = useState<TemplateButton[]>(parsed?.buttons || []);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Variable insertion into body text
  const handleInsertVariable = () => {
    const existing = extractVariables(bodyText);
    const nextNum = existing.length + 1;
    setBodyText((prev) => `${prev} {{${nextNum}}}`);
  };

  // Button management
  const handleAddButton = () => {
    if (buttons.length >= 3) return;
    setButtons((prev) => [
      ...prev,
      { type: "QUICK_REPLY", text: `Action ${prev.length + 1}` },
    ]);
  };

  const handleUpdateButton = (
    index: number,
    field: keyof TemplateButton,
    value: string
  ) => {
    setButtons((prev) =>
      prev.map((btn, idx) => (idx === index ? { ...btn, [field]: value } : btn))
    );
  };

  const handleRemoveButton = (index: number) => {
    setButtons((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const draftInput: TemplateDraftInput = {
      template_name: templateName.trim().toLowerCase(),
      category,
      language: language.trim(),
      connection_id: connectionId || null,
      header_format: headerFormat,
      header_text: headerText.trim(),
      body_text: bodyText.trim(),
      footer_text: footerText.trim(),
      buttons,
    };

    const validation = validateTemplateDraft(draftInput);
    if (!validation.isValid) {
      setFormError(validation.errors.join(" "));
      return;
    }

    setSaving(true);
    try {
      const res = await onSave(draftInput, templateToEdit?.id);
      if (res.success) {
        onClose();
      } else {
        setFormError(res.error || "Failed to save draft template.");
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col space-y-5 my-6 max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <h3 id="editor-modal-title" className="text-sm font-bold text-slate-900">
                {isEditing ? "Edit Local Draft Template" : "Create New Local Draft Template"}
              </h3>
              <p className="text-[11px] text-slate-500">
                Draft templates are stored locally in your business workspace and preserved during Meta sync.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{formError}</p>
          </div>
        )}

        {/* Two-Column Editor Layout */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto flex-1 pr-1">
          {/* Left Column: Form Fields */}
          <div className="md:col-span-7 space-y-4">
            {/* Template Name & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  placeholder="e.g. order_update_01"
                  required
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block">
                  Lowercase letters and underscores only.
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="UTILITY">Utility</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </div>
            </div>

            {/* Language & Associated Connection */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Language Code <span className="text-rose-500">*</span>
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="en_US">English (US) — en_US</option>
                  <option value="en">English — en</option>
                  <option value="ta">Tamil — ta</option>
                  <option value="hi">Hindi — hi</option>
                  <option value="te">Telugu — te</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Associated WhatsApp Connection
                </label>
                <select
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Connections</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name} ({c.phone_number})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Internal Description */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">
                Internal Description (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Sent when customer confirms wedding consultation"
                maxLength={255}
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Header Component */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Header Component (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={headerFormat}
                  onChange={(e) => setHeaderFormat(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="NONE">No Header</option>
                  <option value="TEXT">Text Header</option>
                  <option value="IMAGE">Image Header</option>
                  <option value="DOCUMENT">Document Header</option>
                  <option value="VIDEO">Video Header</option>
                </select>

                {headerFormat === "TEXT" && (
                  <input
                    type="text"
                    value={headerText}
                    maxLength={60}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="Header title (max 60 chars)"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                )}
              </div>
            </div>

            {/* Body Text (Required) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-700">
                  Body Text <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleInsertVariable}
                  className="text-[10px] text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Insert Variable
                </button>
              </div>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={4}
                maxLength={1024}
                required
                placeholder="Enter template message text. Use {{1}}, {{2}} for dynamic customer parameters."
                className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Variables must be sequential: &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;...</span>
                <span>{bodyText.length} / 1024</span>
              </div>
            </div>

            {/* Footer Text */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-700">
                Footer Text (Optional)
              </label>
              <input
                type="text"
                value={footerText}
                maxLength={60}
                onChange={(e) => setFooterText(e.target.value)}
                placeholder="e.g. Reply STOP to opt out"
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 block">
                Short plain text note (no variables allowed). Max 60 characters.
              </span>
            </div>

            {/* Interactive Buttons */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Interactive Buttons ({buttons.length}/3)
                </span>
                {buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={handleAddButton}
                    className="text-[10px] text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Button
                  </button>
                )}
              </div>

              {buttons.map((btn, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={btn.type}
                      onChange={(e) =>
                        handleUpdateButton(idx, "type", e.target.value as TemplateButtonType)
                      }
                      className="px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="QUICK_REPLY">Quick Reply</option>
                      <option value="URL">Website URL</option>
                      <option value="PHONE_NUMBER">Phone Number</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveButton(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={btn.text}
                    maxLength={25}
                    onChange={(e) => handleUpdateButton(idx, "text", e.target.value)}
                    placeholder="Button Label (max 25 chars)"
                    className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200"
                  />

                  {btn.type === "URL" && (
                    <input
                      type="url"
                      value={btn.url || ""}
                      onChange={(e) => handleUpdateButton(idx, "url", e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200"
                    />
                  )}

                  {btn.type === "PHONE_NUMBER" && (
                    <input
                      type="tel"
                      value={btn.phone_number || ""}
                      onChange={(e) => handleUpdateButton(idx, "phone_number", e.target.value)}
                      placeholder="+919876543210"
                      className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Phone Mock Preview */}
          <div className="md:col-span-5 flex flex-col justify-start space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Live Real-Time Preview
            </span>
            <div className="rounded-3xl bg-[#efeae2] p-4 border border-slate-300 shadow-inner flex flex-col justify-center min-h-[300px]">
              <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200/80 space-y-2.5 max-w-sm w-full mx-auto">
                {/* Header Preview */}
                {headerFormat !== "NONE" && (
                  <div>
                    {headerFormat === "TEXT" ? (
                      <h4 className="font-bold text-xs text-slate-900 border-b border-slate-100 pb-1.5">
                        {headerText || "Header Title"}
                      </h4>
                    ) : (
                      <div className="w-full h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 gap-1.5 text-xs border border-slate-200">
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                        <span className="font-bold uppercase tracking-wider text-[10px]">
                          {headerFormat} HEADER
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Body Preview */}
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {bodyText || "Your message body will appear here..."}
                </p>

                {/* Footer Preview */}
                {footerText && (
                  <p className="text-[10px] text-slate-400 italic pt-1">
                    {footerText}
                  </p>
                )}

                {/* Time & Sent Status */}
                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-0.5">
                  <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-indigo-500" />
                </div>

                {/* Buttons Preview */}
                {buttons.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    {buttons.map((b, idx) => (
                      <div
                        key={idx}
                        className="w-full py-1.5 px-3 rounded-xl border border-slate-200 text-center text-xs font-semibold text-indigo-600 bg-slate-50/50 flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        {b.type === "URL" && <Globe className="w-3.5 h-3.5" />}
                        {b.type === "PHONE_NUMBER" && <Phone className="w-3.5 h-3.5" />}
                        {b.type === "QUICK_REPLY" && <CornerDownLeft className="w-3.5 h-3.5" />}
                        <span>{b.text || `Button ${idx + 1}`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Draft...</span>
              </>
            ) : (
              <>
                <FileEdit className="w-3.5 h-3.5" />
                <span>Save Local Draft</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
