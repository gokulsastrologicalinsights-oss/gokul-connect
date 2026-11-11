"use client";

import React, { useState, useMemo } from "react";
import {
  Business,
  BusinessMember,
  SafeWhatsAppConnection,
  ScheduledMessageType,
  SupportedMediaType,
  WhatsAppMessageTemplate,
} from "@/types/database";
import {
  extractTemplateVariables,
  replaceVariables,
} from "@/lib/templates/validation";
import {
  ALLOWED_MIME_TYPES,
  MEDIA_SIZE_LIMITS,
  validateMediaFile,
} from "@/lib/media/storage";
import {
  X,
  Calendar,
  Clock,
  FileText,
  Image as ImageIcon,
  FileUp,
  Mic,
  Video,
  Send,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
} from "lucide-react";

interface ScheduleMessageModalProps {
  business: Business;
  connections: SafeWhatsAppConnection[];
  templates: WhatsAppMessageTemplate[];
  recentRecipients: Array<{ phone: string; name?: string; conversationId?: string }>;
  onClose: () => void;
  onScheduled: (data: any) => Promise<boolean>;
}

export function ScheduleMessageModal({
  business,
  connections,
  templates,
  recentRecipients,
  onClose,
  onScheduled,
}: ScheduleMessageModalProps) {
  // Form state
  const [connectionId, setConnectionId] = useState<string>(
    connections[0]?.id || ""
  );
  const [recipientPhone, setRecipientPhone] = useState<string>("");
  const [recipientName, setRecipientName] = useState<string>("");
  const [conversationId, setConversationId] = useState<string>("");
  const [messageType, setMessageType] = useState<ScheduledMessageType>("text");

  // Content state
  const [textContent, setTextContent] = useState<string>("");
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>(
    templates[0]?.template_name || ""
  );
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  // Media state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<SupportedMediaType>("image");
  const [mediaBase64, setMediaBase64] = useState<string>("");
  const [mediaCaption, setMediaCaption] = useState<string>("");
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Date and Time state (Default: 2 hours from now in Asia/Kolkata)
  const defaultDateString = useMemo(() => {
    const d = new Date(Date.now() + 2 * 3600 * 1000);
    // Format YYYY-MM-DDTHH:mm for datetime-local input
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${mins}`;
  }, []);

  const [scheduledAtLocal, setScheduledAtLocal] = useState<string>(defaultDateString);
  const [timezone, setTimezone] = useState<string>("Asia/Kolkata");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick recipient selector
  const handleSelectRecentRecipient = (phone: string, name?: string, convId?: string) => {
    setRecipientPhone(phone);
    if (name) setRecipientName(name);
    if (convId) setConversationId(convId);
  };

  // Quick date presets
  const handleSetPreset = (preset: "1h" | "tomorrow_10am" | "tomorrow_3pm" | "2days") => {
    const d = new Date();
    if (preset === "1h") {
      d.setTime(d.getTime() + 60 * 60 * 1000);
    } else if (preset === "tomorrow_10am") {
      d.setDate(d.getDate() + 1);
      d.setHours(10, 0, 0, 0);
    } else if (preset === "tomorrow_3pm") {
      d.setDate(d.getDate() + 1);
      d.setHours(15, 0, 0, 0);
    } else if (preset === "2days") {
      d.setDate(d.getDate() + 2);
      d.setHours(11, 0, 0, 0);
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    setScheduledAtLocal(`${year}-${month}-${day}T${hours}:${mins}`);
  };

  // Selected template logic
  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.template_name === selectedTemplateName) || templates[0];
  }, [templates, selectedTemplateName]);

  const varExtraction = useMemo(() => {
    return extractTemplateVariables(selectedTemplate?.components);
  }, [selectedTemplate]);

  // Handle media file upload
  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMediaError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    let inferredType: SupportedMediaType = "image";
    if (file.type.startsWith("image/")) inferredType = "image";
    else if (file.type.startsWith("audio/")) inferredType = "audio";
    else if (file.type.startsWith("video/")) inferredType = "video";
    else inferredType = "document";

    setMediaType(inferredType);

    const validation = validateMediaFile(inferredType, file.type, file.size);
    if (!validation.valid) {
      setMediaError(validation.error || "Invalid file format or size.");
      return;
    }

    setMediaFile(file);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setMediaBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // Submit Handler
  const handleSubmit = async (status: "scheduled" | "draft") => {
    setErrorMsg(null);

    if (!recipientPhone.trim()) {
      setErrorMsg("Recipient phone number is required.");
      return;
    }

    if (!connectionId) {
      setErrorMsg("Please select a WhatsApp sender connection.");
      return;
    }

    // Convert local datetime to ISO UTC string
    const scheduledDate = new Date(scheduledAtLocal);
    if (isNaN(scheduledDate.getTime())) {
      setErrorMsg("Invalid scheduled date format.");
      return;
    }

    if (status === "scheduled" && scheduledDate.getTime() <= Date.now()) {
      setErrorMsg("Scheduled time must be in the future.");
      return;
    }

    if (messageType === "text" && !textContent.trim()) {
      setErrorMsg("Message text cannot be empty.");
      return;
    }

    if (messageType === "template" && !selectedTemplateName) {
      setErrorMsg("Please select an approved WhatsApp template.");
      return;
    }

    if (["image", "document", "audio", "video"].includes(messageType) && !mediaFile) {
      setErrorMsg("Please upload a media file attachment.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        businessSlug: business.slug,
        connectionId,
        recipientPhone: recipientPhone.trim(),
        recipientName: recipientName.trim() || undefined,
        conversationId: conversationId || undefined,
        messageType,
        scheduledAt: scheduledDate.toISOString(),
        timezone,
        status,
      };

      if (messageType === "text") {
        payload.content = textContent.trim();
      } else if (messageType === "template") {
        payload.templateName = selectedTemplateName;
        payload.templateLanguage = selectedTemplate?.language || "en_US";
        payload.templateVariables = templateVariables;
      } else if (["image", "document", "audio", "video"].includes(messageType) && mediaFile) {
        payload.media = {
          mediaType,
          filename: mediaFile.name,
          mimeType: mediaFile.type,
          fileSize: mediaFile.size,
          base64Data: mediaBase64,
          caption: mediaCaption.trim() || undefined,
        };
      }

      const success = await onScheduled(payload);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to schedule message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Schedule WhatsApp Message</h2>
              <p className="text-xs text-slate-500">
                Workspace: <span className="font-semibold text-purple-700">{business.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-700">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Sender Connection & Recipient */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                WhatsApp Sender Connection *
              </label>
              <select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 bg-white"
              >
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.display_name} ({conn.phone_number})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Phone Number *
              </label>
              <input
                type="text"
                placeholder="+91 98401 23456"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 font-mono"
              />
            </div>
          </div>

          {/* Recipient Name & Quick Picker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Karthik Subramanian"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {recentRecipients.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quick Select from Recent Chats
                </label>
                <select
                  onChange={(e) => {
                    const found = recentRecipients.find((r) => r.phone === e.target.value);
                    if (found) handleSelectRecentRecipient(found.phone, found.name, found.conversationId);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 bg-white text-slate-600"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select an active customer chat...
                  </option>
                  {recentRecipients.map((r, i) => (
                    <option key={i} value={r.phone}>
                      {r.name ? `${r.name} (${r.phone})` : r.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Message Type Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Message Format *
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setMessageType("text")}
                className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-medium transition ${
                  messageType === "text"
                    ? "bg-white text-purple-700 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Plain Text</span>
              </button>

              <button
                type="button"
                onClick={() => setMessageType("template")}
                className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-medium transition ${
                  messageType === "template"
                    ? "bg-white text-purple-700 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Meta Template</span>
              </button>

              <button
                type="button"
                onClick={() => setMessageType("image")}
                className={`flex items-center justify-center space-x-1.5 py-2 rounded-lg text-xs font-medium transition ${
                  ["image", "document", "audio", "video"].includes(messageType)
                    ? "bg-white text-purple-700 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Media File</span>
              </button>
            </div>
          </div>

          {/* Type 1: Plain Text Composer */}
          {messageType === "text" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Message Content</label>
                <span className="text-[11px] text-slate-400">{textContent.length} / 4096</span>
              </div>
              <textarea
                rows={4}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Type your WhatsApp message..."
                className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
              <p className="text-[11px] text-amber-600 flex items-center space-x-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>Note: Free-form text requires an active 24-hour service window at the time of delivery.</span>
              </p>
            </div>
          )}

          {/* Type 2: Template Composer */}
          {messageType === "template" && (
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Approved Meta Template ({templates.length} available)
                </label>
                <select
                  value={selectedTemplateName}
                  onChange={(e) => setSelectedTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id || tpl.template_name} value={tpl.template_name}>
                      {tpl.template_name} ({tpl.language}) — {tpl.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Dynamic Variables */}
              {varExtraction.allVariables.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <span className="text-xs font-semibold text-slate-700">
                    Template Variables ({varExtraction.allVariables.length})
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {varExtraction.allVariables.map((v) => (
                      <div key={v} className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded">
                          {`{{${v}}}`}
                        </span>
                        <input
                          type="text"
                          placeholder={`Value for {{${v}}}`}
                          value={templateVariables[v] || ""}
                          onChange={(e) =>
                            setTemplateVariables((prev) => ({ ...prev, [v]: e.target.value }))
                          }
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Preview */}
              {selectedTemplate && (
                <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-lg text-xs">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                    Template Preview
                  </span>
                  <p className="text-slate-800 whitespace-pre-wrap font-sans">
                    {replaceVariables(
                      (selectedTemplate.components?.find((c: any) => c.type === "BODY") as any)?.text ||
                        "No text body found in template.",
                      templateVariables
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Type 3: Media File Uploader */}
          {["image", "document", "audio", "video"].includes(messageType) && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-4">
                <span className="text-xs font-semibold text-slate-700">Media Category:</span>
                {(["image", "document", "audio", "video"] as SupportedMediaType[]).map((cat) => (
                  <label key={cat} className="flex items-center space-x-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="mediaCat"
                      checked={messageType === cat}
                      onChange={() => {
                        setMessageType(cat);
                        setMediaType(cat);
                      }}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span className="capitalize">{cat}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload File ({mediaType === "document" ? "Max 100MB" : mediaType === "image" ? "Max 5MB" : "Max 16MB"})
                </label>
                <input
                  type="file"
                  onChange={handleMediaFileChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
                />
              </div>

              {mediaError && (
                <p className="text-xs text-rose-600 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{mediaError}</span>
                </p>
              )}

              {mediaFile && !mediaError && (
                <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate font-medium">{mediaFile.name}</span>
                    <span className="text-slate-400">({(mediaFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              )}

              {/* Media Caption */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Attachment Caption (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Your planetary transit report for this month"
                  value={mediaCaption}
                  onChange={(e) => setMediaCaption(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {/* Section 3: Date, Time & Timezone Handling */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>Scheduled Date & Time (Local Business Time)</span>
              </label>
              <span className="text-[11px] font-mono text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                Timezone: {timezone} (IST, UTC+05:30)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-purple-500 bg-white"
              />

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetPreset("1h")}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium text-slate-700"
                >
                  +1 Hour
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset("tomorrow_10am")}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium text-slate-700"
                >
                  Tmrw 10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset("tomorrow_3pm")}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium text-slate-700"
                >
                  Tmrw 3:00 PM
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset("2days")}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-medium text-slate-700"
                >
                  In 2 Days
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit("draft")}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition shadow-sm disabled:opacity-50"
            >
              Save as Draft
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit("scheduled")}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Scheduling..." : "Schedule Message"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
