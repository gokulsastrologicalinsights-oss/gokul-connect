"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  BusinessMember,
  CannedResponse,
  SupportedMediaType,
  TeamMemberWithProfile,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppMessageTemplate,
} from "@/types/database";
import {
  CheckCircle2,
  Archive,
  Mail,
  Copy,
  Check,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Send,
  ArrowLeft,
  ShieldCheck,
  Tag,
  Clock,
  Sparkles,
  Settings,
  ChevronUp,
  Loader2,
  FileText,
  Bot,
  X,
  User,
  ExternalLink,
  Image as ImageIcon,
  Phone,
  Globe,
  Search,
  CornerDownLeft,
  Paperclip,
  Download,
  Film,
  Mic,
  RotateCcw,
  Maximize2,
  Plus,
  Zap,
} from "lucide-react";
import { extractTemplateVariables, replaceVariables } from "@/lib/templates/validation";
import { getDefaultBusinessTemplates } from "@/lib/templates/default-templates";
import { MEDIA_SIZE_LIMITS } from "@/lib/media/storage";
import { getLabelStyle, getSuggestedLabelsForBusiness } from "@/lib/inbox/labels";
import {
  applySlashCommandReplacement,
  extractSlashCommandQuery,
  filterCannedResponses,
  SlashCommandMatch,
} from "@/lib/inbox/slash-commands";
import { CannedResponsesModal } from "./CannedResponsesModal";

interface StagedAttachment {
  file: File;
  mediaType: SupportedMediaType;
  filename: string;
  fileSize: number;
  mimeType: string;
  base64Data: string;
  previewUrl?: string;
  caption: string;
}

interface ChatWindowPanelProps {
  conversation: WhatsAppConversation | null;
  businessSlug?: string;
  messages?: WhatsAppMessage[];
  isLoadingMessages?: boolean;
  hasMoreMessages?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlderMessages?: () => void;
  onBackMobile?: () => void;
  onToggleRead: (conversationId: string, currentUnread: number) => void;
  onUpdateStatus: (
    conversationId: string,
    status: WhatsAppConversation["status"]
  ) => void;
  onAssignAgent: (
    conversationId: string,
    agentId: string | null,
    agentName: string | null
  ) => void;
  onSendMessage?: (
    text: string
  ) => Promise<{ success: boolean; error?: string; isWindowClosed?: boolean }>;
  onSendMedia?: (params: {
    mediaType: SupportedMediaType;
    filename: string;
    mimeType: string;
    fileSize: number;
    base64Data: string;
    caption?: string;
  }) => Promise<{ success: boolean; error?: string; isWindowClosed?: boolean }>;
  onGetDownloadUrl?: (
    messageId: string
  ) => Promise<{ success: boolean; downloadUrl?: string; filename?: string; mimeType?: string; error?: string }>;
  onRetryMessage?: (
    messageId: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSendTemplate?: (
    templateName: string,
    languageCode?: string,
    components?: Array<Record<string, unknown>>
  ) => Promise<{ success: boolean; error?: string }>;
  approvedTemplates?: WhatsAppMessageTemplate[];
  isSendingMessage?: boolean;
  teamMembers?: TeamMemberWithProfile[];
  currentMembership?: BusinessMember;
  availableLabels?: string[];
  onUpdateLabels?: (
    conversationId: string,
    labels: string[]
  ) => Promise<{ success: boolean; error?: string }>;
  cannedResponses?: CannedResponse[];
  onCreateCannedResponse?: (input: {
    shortcut: string;
    title: string;
    content: string;
    category: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdateCannedResponse?: (input: {
    responseId: string;
    shortcut: string;
    title: string;
    content: string;
    category: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onDeleteCannedResponse?: (responseId: string) => Promise<{ success: boolean; error?: string }>;
}

function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function formatMessageTime(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const MAX_CHARS = 4096;

export function ChatWindowPanel({
  conversation,
  businessSlug = "astrology",
  messages = [],
  isLoadingMessages = false,
  hasMoreMessages = false,
  isLoadingOlder = false,
  onLoadOlderMessages,
  onBackMobile,
  onToggleRead,
  onUpdateStatus,
  onAssignAgent,
  onSendMessage,
  onSendMedia,
  onGetDownloadUrl,
  onRetryMessage,
  onSendTemplate,
  approvedTemplates = [],
  isSendingMessage = false,
  teamMembers = [],
  currentMembership,
  availableLabels = [],
  onUpdateLabels,
  cannedResponses = [],
  onCreateCannedResponse,
  onUpdateCannedResponse,
  onDeleteCannedResponse,
}: ChatWindowPanelProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [localSending, setLocalSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("hello_world");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templateSearch, setTemplateSearch] = useState("");
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [showCrmDrawer, setShowCrmDrawer] = useState(false);

  // Phase 12.2 Media states
  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [downloadingMediaId, setDownloadingMediaId] = useState<string | null>(null);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; title: string; type: "image" | "video" } | null>(null);

  // Labels Picker state
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelInput, setNewLabelInput] = useState("");
  const [updatingLabels, setUpdatingLabels] = useState(false);

  // Quick Replies / Canned Responses (/shortcut) state
  const [slashMatch, setSlashMatch] = useState<SlashCommandMatch | null>(null);
  const [activeSlashIndex, setActiveSlashIndex] = useState(0);
  const [showCannedModal, setShowCannedModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const labelPickerRef = useRef<HTMLDivElement>(null);

  // Close label picker on outside click or Escape
  useEffect(() => {
    if (!showLabelPicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setShowLabelPicker(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowLabelPicker(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [showLabelPicker]);

  // Reset slash command popover & label picker when switching conversation
  useEffect(() => {
    setSlashMatch(null);
    setActiveSlashIndex(0);
    setShowLabelPicker(false);
    setNewLabelInput("");
  }, [conversation?.id]);

  // Combined label options (presets + workspace labels + current conversation labels)
  const labelOptions = useMemo(() => {
    const map = new Map<string, string>();
    const combined = [
      ...getSuggestedLabelsForBusiness(businessSlug),
      ...availableLabels,
      ...(conversation?.labels || []),
    ];
    for (const lbl of combined) {
      const trimmed = lbl.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!map.has(key)) map.set(key, trimmed);
    }
    const q = newLabelInput.trim().toLowerCase();
    const all = Array.from(map.values());
    if (!q) return all;
    return all.filter((l) => l.toLowerCase().includes(q));
  }, [businessSlug, availableLabels, conversation?.labels, newLabelInput]);

  // Filtered quick replies for `/` slash command popover
  const slashFilteredResponses = useMemo(() => {
    if (!slashMatch) return [];
    return filterCannedResponses(cannedResponses, slashMatch.query).slice(0, 8);
  }, [cannedResponses, slashMatch]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (!isLoadingMessages && !isLoadingOlder) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isLoadingMessages, isLoadingOlder]);

  // Calculate WhatsApp 24-hour customer service window status
  const windowStatus = useMemo(() => {
    if (!conversation) {
      return { isOpen: false, lastInboundAt: null, timeRemaining: "" };
    }

    // Find the latest inbound message
    const inbounds = messages.filter((m) => m.direction === "inbound");
    if (inbounds.length === 0) {
      return { isOpen: false, lastInboundAt: null, timeRemaining: "" };
    }

    const sorted = [...inbounds].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const latest = sorted[0];
    const lastInboundTime = new Date(latest.created_at).getTime();
    const elapsed = Date.now() - lastInboundTime;
    const windowDuration = 24 * 60 * 60 * 1000;
    const isOpen = elapsed >= 0 && elapsed < windowDuration;

    let timeRemaining = "";
    if (isOpen) {
      const remainingMs = windowDuration - elapsed;
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = `${hours}h ${minutes}m remaining`;
    }

    return {
      isOpen,
      lastInboundAt: latest.created_at,
      timeRemaining,
    };
  }, [conversation, messages]);

  const isViewer = currentMembership?.role === "viewer";
  const eligibleAgents = useMemo(() => {
    return (teamMembers || []).filter((m) => m.is_active && m.role !== "viewer");
  }, [teamMembers]);

  const isSending = isSendingMessage || localSending;

  // Handle message sending
  const handleSend = async () => {
    if (isViewer) {
      setComposerError("Read-only access: Viewers cannot send messages.");
      return;
    }
    const trimmed = draftText.trim();
    if (!trimmed || isSending) return;

    if (trimmed.length > MAX_CHARS) {
      setComposerError(`Message length exceeds ${MAX_CHARS} character limit.`);
      return;
    }

    if (!windowStatus.isOpen) {
      setComposerError(
        "WhatsApp 24-hour customer service window is closed. Regular text messages cannot be sent. Please send an approved WhatsApp Template to re-open the conversation."
      );
      return;
    }

    if (!onSendMessage) {
      setComposerError("Message sender is not connected.");
      return;
    }

    setLocalSending(true);
    setComposerError(null);

    try {
      const res = await onSendMessage(trimmed);
      if (res.success) {
        // Clear composer ONLY upon successful dispatch
        setDraftText("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } else {
        // Preserve draft text upon failure
        setComposerError(res.error || "Failed to send message via Meta Cloud API.");
      }
    } catch (err: any) {
      setComposerError(err.message || "An unexpected error occurred while sending.");
    } finally {
      setLocalSending(false);
    }
  };

  // Insert a canned response snippet into composer (from slash popover or modal)
  const insertCannedSnippet = (
    snippet: CannedResponse,
    activeMatch?: SlashCommandMatch | null
  ) => {
    let nextValue = draftText;
    let cursorPos = draftText.length;

    if (activeMatch) {
      const replaced = applySlashCommandReplacement(draftText, activeMatch, snippet.content);
      nextValue = replaced.nextText;
      cursorPos = replaced.nextCursorPos;
    } else {
      const prefix = draftText.length > 0 && !/\s$/.test(draftText) ? " " : "";
      nextValue = `${draftText}${prefix}${snippet.content}`;
      cursorPos = nextValue.length;
    }

    setDraftText(nextValue);
    setSlashMatch(null);
    setActiveSlashIndex(0);
    if (composerError) setComposerError(null);

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
      }
    });
  };

  // Toggle or add/remove conversation label
  const handleToggleLabel = async (labelToToggle: string) => {
    if (!conversation || !onUpdateLabels || isViewer || updatingLabels) return;
    const clean = labelToToggle.trim().slice(0, 40);
    if (!clean) return;

    const current = conversation.labels || [];
    const exists = current.some((l) => l.toLowerCase() === clean.toLowerCase());
    const nextLabels = exists
      ? current.filter((l) => l.toLowerCase() !== clean.toLowerCase())
      : [...current, clean];

    setUpdatingLabels(true);
    try {
      const res = await onUpdateLabels(conversation.id, nextLabels);
      if (!res.success) {
        setComposerError(res.error || "Failed to update conversation labels.");
      }
    } catch (err: any) {
      setComposerError(err?.message || "Failed to update conversation labels.");
    } finally {
      setUpdatingLabels(false);
    }
  };

  const handleAddCustomLabel = async () => {
    const clean = newLabelInput.trim().slice(0, 40);
    if (!clean || !conversation || !onUpdateLabels || isViewer || updatingLabels) return;
    const current = conversation.labels || [];
    if (!current.some((l) => l.toLowerCase() === clean.toLowerCase())) {
      await handleToggleLabel(clean);
    }
    setNewLabelInput("");
  };

  // Keyboard shortcut: Slash menu navigation OR Enter to send, Shift + Enter for new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashMatch) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMatch(null);
        return;
      }
      if (slashFilteredResponses.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveSlashIndex((prev) => (prev + 1) % slashFilteredResponses.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveSlashIndex(
            (prev) => (prev - 1 + slashFilteredResponses.length) % slashFilteredResponses.length
          );
          return;
        }
        if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
          e.preventDefault();
          const chosen = slashFilteredResponses[activeSlashIndex] || slashFilteredResponses[0];
          if (chosen) {
            insertCannedSnippet(chosen, slashMatch);
          }
          return;
        }
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea & detect /shortcut slash command
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setDraftText(val);
    if (composerError) setComposerError(null);

    const target = e.target;
    const match = extractSlashCommandQuery(val, target.selectionStart ?? val.length);
    setSlashMatch(match);
    setActiveSlashIndex(0);

    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  // Phase 12.2: Handle Media Attachment Selection & Staging
  const handleFileSelect = (file: File) => {
    if (isViewer) {
      setComposerError("Read-only access: Viewers cannot attach or send media.");
      return;
    }

    if (!windowStatus.isOpen) {
      setComposerError(
        "WhatsApp 24-hour service window is closed. Regular media cannot be sent. Please send an approved template."
      );
      return;
    }

    let mediaType: SupportedMediaType = "document";
    const mime = (file.type || "").toLowerCase();
    if (mime.startsWith("image/")) {
      mediaType = "image";
    } else if (mime.startsWith("video/")) {
      mediaType = "video";
    } else if (mime.startsWith("audio/")) {
      mediaType = "audio";
    } else {
      mediaType = "document";
    }

    const limit = MEDIA_SIZE_LIMITS[mediaType];
    if (file.size > limit) {
      setComposerError(
        `File exceeds maximum limit of ${formatBytes(limit)} for ${mediaType} messages (Selected: ${formatBytes(file.size)}).`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(",")[1] || "";
      let previewUrl: string | undefined;
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = undefined;
      }

      setStagedAttachment({
        file,
        mediaType,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        base64Data,
        previewUrl,
        caption: "",
      });
      setComposerError(null);
    };
    reader.onerror = () => {
      setComposerError("Failed to read the selected file.");
    };
    reader.readAsDataURL(file);
  };

  // Dispatch Staged Media Message
  const handleSendMediaSubmit = async () => {
    if (!stagedAttachment || isUploadingMedia || !onSendMedia) return;

    if (isViewer) {
      setComposerError("Read-only access: Viewers cannot send media messages.");
      return;
    }

    setIsUploadingMedia(true);
    setComposerError(null);

    try {
      const res = await onSendMedia({
        mediaType: stagedAttachment.mediaType,
        filename: stagedAttachment.filename,
        mimeType: stagedAttachment.mimeType,
        fileSize: stagedAttachment.fileSize,
        base64Data: stagedAttachment.base64Data,
        caption: stagedAttachment.caption.trim() || undefined,
      });

      if (res.success) {
        if (stagedAttachment.previewUrl) {
          URL.revokeObjectURL(stagedAttachment.previewUrl);
        }
        setStagedAttachment(null);
      } else {
        setComposerError(res.error || "Failed to deliver media message.");
      }
    } catch (err: any) {
      setComposerError(err.message || "Failed to upload and dispatch media.");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Download Media via Authorized Signed URL
  const handleDownloadMedia = async (msg: WhatsAppMessage) => {
    if (!onGetDownloadUrl) return;
    setDownloadingMediaId(msg.id);
    try {
      const res = await onGetDownloadUrl(msg.id);
      if (res.success && res.downloadUrl) {
        const a = document.createElement("a");
        a.href = res.downloadUrl;
        a.download = res.filename || "download";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setComposerError(res.error || "Failed to download media file.");
      }
    } catch (err: any) {
      setComposerError(err.message || "Failed to retrieve media download URL.");
    } finally {
      setDownloadingMediaId(null);
    }
  };

  // Retry Failed Outbound Message
  const handleRetryMessage = async (messageId: string) => {
    if (!onRetryMessage) return;
    setRetryingMessageId(messageId);
    try {
      const res = await onRetryMessage(messageId);
      if (!res.success) {
        setComposerError(res.error || "Retry failed.");
      } else {
        setComposerError(null);
      }
    } catch (err: any) {
      setComposerError(err.message || "Failed to retry message.");
    } finally {
      setRetryingMessageId(null);
    }
  };


  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/60 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 mb-4">
          <Sparkles className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">
          Select a Conversation
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mb-4">
          Choose a WhatsApp customer conversation from the list to view incoming
          enquiries, review chat history, and reply directly.
        </p>
        <Link
          href={`/workspace/${businessSlug}/connections`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium shadow-sm transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>WhatsApp Connection Settings</span>
        </Link>
      </div>
    );
  }

  const contact = conversation.contact;
  const displayName = contact?.display_name || "Unknown Customer";
  const phone = contact?.phone_number || "No number";

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // Fallback approved templates list (using tenant-isolated default business templates)
  const templatesList: WhatsAppMessageTemplate[] = useMemo(() => {
    const list =
      approvedTemplates.length > 0
        ? approvedTemplates
        : getDefaultBusinessTemplates(conversation.business_id, businessSlug);
    return list.filter((t) => t.status === "APPROVED" && !t.is_archived);
  }, [approvedTemplates, conversation.business_id, businessSlug]);

  const selectedTemplate = useMemo(() => {
    return (
      templatesList.find((t) => t.template_name === selectedTemplateName) ||
      templatesList[0]
    );
  }, [templatesList, selectedTemplateName]);

  const varExtraction = useMemo(() => {
    return extractTemplateVariables(selectedTemplate?.components);
  }, [selectedTemplate]);

  // When selected template changes, prefill templateVariables from example or blank
  useEffect(() => {
    if (selectedTemplate) {
      const vars: Record<string, string> = {};
      const exampleTexts = (
        selectedTemplate.components?.find((c: any) => c.type === "BODY") as any
      )?.example?.body_text?.[0];
      varExtraction.allVariables.forEach((v, idx) => {
        vars[v] = exampleTexts?.[idx] || "";
      });
      setTemplateVariables(vars);
    }
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

  const missingVariables = useMemo(() => {
    return varExtraction.allVariables.filter(
      (v) => !templateVariables[v]?.trim()
    );
  }, [varExtraction.allVariables, templateVariables]);

  // Handle template dispatch
  const handleSendTemplateSubmit = async () => {
    if (!onSendTemplate || !selectedTemplate || sendingTemplate) return;

    if (missingVariables.length > 0) {
      setComposerError(
        `Please provide values for all required variables: {{${missingVariables.join("}}, {{")}}}`
      );
      return;
    }

    setSendingTemplate(true);
    try {
      const componentsPayload: Array<Record<string, unknown>> = [];
      if (varExtraction.headerVariables.length > 0) {
        componentsPayload.push({
          type: "header",
          parameters: varExtraction.headerVariables.map((v) => ({
            type: "text",
            text: (templateVariables[v] || "").trim(),
          })),
        });
      }
      if (varExtraction.bodyVariables.length > 0) {
        componentsPayload.push({
          type: "body",
          parameters: varExtraction.bodyVariables.map((v) => ({
            type: "text",
            text: (templateVariables[v] || "").trim(),
          })),
        });
      }

      const res = await onSendTemplate(
        selectedTemplate.template_name,
        selectedTemplate.language || "en_US",
        componentsPayload.length > 0 ? componentsPayload : undefined
      );

      if (res.success) {
        setShowTemplateModal(false);
        setComposerError(null);
      } else {
        setComposerError(res.error || "Failed to dispatch WhatsApp template.");
      }
    } catch (err: any) {
      setComposerError(err.message || "Template dispatch error.");
    } finally {
      setSendingTemplate(false);
    }
  };

  const charsRemaining = MAX_CHARS - draftText.length;
  const isOverLimit = charsRemaining < 0;

  return (
    <div
      className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-hidden relative"
      onDragOver={(e) => {
        e.preventDefault();
        if (!isViewer && windowStatus.isOpen) {
          setIsDraggingOver(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (!isViewer && windowStatus.isOpen && e.dataTransfer.files?.[0]) {
          handleFileSelect(e.dataTransfer.files[0]);
        }
      }}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-50 bg-indigo-600/15 backdrop-blur-[2px] border-2 border-dashed border-indigo-600 rounded-xl flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center text-indigo-600 mb-3 animate-bounce">
            <Paperclip className="w-7 h-7" />
          </div>
          <p className="font-bold text-sm text-indigo-950">Drop file to attach</p>
          <p className="text-xs text-indigo-800 mt-1">
            Images (≤5MB), Documents (≤100MB), Audio/Video (≤16MB)
          </p>
        </div>
      )}
      {/* Top Header Bar */}
      <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg"
              title="Back to conversation list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Customer Avatar */}
          <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0 shadow-xs">
            {displayName.charAt(0).toUpperCase()}
          </div>

          {/* Customer Details */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {displayName}
              </h2>
              {conversation.unread_count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {conversation.unread_count} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-mono text-[11px]">{phone}</span>
              <button
                onClick={handleCopyPhone}
                className="text-slate-400 hover:text-slate-600 p-0.5"
                title="Copy phone number"
                aria-label="Copy phone number"
              >
                {copiedPhone ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Contact CRM Details Toggle */}
          <button
            onClick={() => setShowCrmDrawer(!showCrmDrawer)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-2xs"
            title="View Contact CRM Profile"
            aria-label="View Contact CRM Profile"
          >
            <User className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">CRM Profile</span>
          </button>

          {/* Toggle Read / Unread */}
          <button
            onClick={() =>
              onToggleRead(conversation.id, conversation.unread_count)
            }
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title={
              conversation.unread_count > 0 ? "Mark as Read" : "Mark as Unread"
            }
            aria-label={
              conversation.unread_count > 0 ? "Mark conversation as read" : "Mark conversation as unread"
            }
          >
            <Mail className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">
              {conversation.unread_count > 0 ? "Mark Read" : "Mark Unread"}
            </span>
          </button>

          {/* Resume Bot / Return to Bot */}
          {conversation.status === "pending_human" && (
            <button
              onClick={() => onUpdateStatus(conversation.id, "open")}
              aria-label="Resume bot automation"
              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Resume Bot Automation"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Resume Bot</span>
            </button>
          )}

          {/* Resolve / Reopen */}
          {conversation.status === "closed" ? (
            <button
              onClick={() => onUpdateStatus(conversation.id, "open")}
              aria-label="Reopen conversation"
              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reopen</span>
            </button>
          ) : (
            <button
              onClick={() => onUpdateStatus(conversation.id, "closed")}
              aria-label="Resolve conversation"
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Resolve</span>
            </button>
          )}

          {/* Archive */}
          {conversation.status === "archived" ? (
            <button
              onClick={() => onUpdateStatus(conversation.id, "open")}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Unarchive"
              aria-label="Unarchive conversation"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onUpdateStatus(conversation.id, "archived")}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Archive Conversation"
              aria-label="Archive conversation"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Conversation Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Customer Profile & Window Status Bar */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Assigned Agent:</span>
            <select
              value={conversation.assigned_agent_id || "unassigned"}
              disabled={isViewer}
              title={isViewer ? "Viewers cannot change conversation assignments." : "Assign conversation to a team member"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "unassigned") {
                  onAssignAgent(conversation.id, null, null);
                } else {
                  const selected = eligibleAgents.find((m) => m.user_id === val);
                  if (selected) {
                    onAssignAgent(
                      conversation.id,
                      selected.user_id,
                      selected.user_profile.full_name || selected.user_profile.email
                    );
                  }
                }
              }}
              className={`bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 font-medium ${
                isViewer ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-slate-300"
              }`}
            >
              <option value="unassigned">Unassigned</option>
              {eligibleAgents.map((agent) => (
                <option key={agent.id} value={agent.user_id}>
                  {agent.user_profile.full_name || agent.user_profile.email} ({agent.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* CRM Status & Category */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-800">Status:</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
              {contact?.status || "Lead"}
            </span>
            {contact?.category && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {contact.category}
              </span>
            )}
            {contact?.is_opted_out && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                Opted Out
              </span>
            )}
          </div>

          {/* Conversation Labels & Interactive Picker Popover */}
          <div className="relative flex flex-wrap items-center gap-1.5" ref={labelPickerRef}>
            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {conversation.labels && conversation.labels.length > 0 ? (
              conversation.labels.map((l) => {
                const style = getLabelStyle(l);
                return (
                  <span
                    key={l}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.bg} ${style.text} ${style.border}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    <span>{l}</span>
                    {!isViewer && onUpdateLabels && (
                      <button
                        type="button"
                        onClick={() => handleToggleLabel(l)}
                        disabled={updatingLabels}
                        className="hover:opacity-75 ml-0.5 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                        title={`Remove label "${l}"`}
                        aria-label={`Remove label ${l}`}
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </span>
                );
              })
            ) : (
              <span className="text-[11px] text-slate-400">No labels</span>
            )}

            {!isViewer && onUpdateLabels && (
              <button
                type="button"
                onClick={() => setShowLabelPicker((prev) => !prev)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-dashed border-slate-300 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-slate-600 hover:text-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Manage conversation labels"
                aria-expanded={showLabelPicker}
                title="Add or remove conversation labels"
              >
                <Plus className="w-3 h-3" />
                <span>Label</span>
              </button>
            )}

            {showLabelPicker && !isViewer && onUpdateLabels && (
              <div
                role="dialog"
                aria-label="Conversation labels picker"
                className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl z-40 p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Conversation Labels
                  </span>
                  {updatingLabels && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  )}
                </div>

                {/* Custom / Search Label Input */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newLabelInput}
                    onChange={(e) => setNewLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomLabel();
                      }
                    }}
                    maxLength={40}
                    placeholder="Filter or create new label..."
                    aria-label="Filter or create new label"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {newLabelInput.trim() && (
                    <button
                      type="button"
                      onClick={handleAddCustomLabel}
                      disabled={updatingLabels}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold"
                    >
                      Add
                    </button>
                  )}
                </div>

                {/* Label Toggle Options */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
                  {labelOptions.map((lbl) => {
                    const isSelected = (conversation.labels || []).some(
                      (existing) => existing.toLowerCase() === lbl.toLowerCase()
                    );
                    const style = getLabelStyle(lbl);
                    return (
                      <button
                        key={lbl}
                        type="button"
                        disabled={updatingLabels}
                        onClick={() => handleToggleLabel(lbl)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? "bg-indigo-50 text-indigo-900 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                          <span className="truncate">{lbl}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp 24-Hour Customer Care Window Badge */}
          {windowStatus.isOpen ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
              <span>24h Service Window Active ({windowStatus.timeRemaining})</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>24h Window Closed (Template Required)</span>
            </div>
          )}
        </div>

        {/* Load Older Messages Pagination Control */}
        {hasMoreMessages && (
          <div className="flex items-center justify-center my-1">
            <button
              onClick={onLoadOlderMessages}
              disabled={isLoadingOlder}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              {isLoadingOlder ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                  <span>Loading older messages...</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3 h-3 text-slate-400" />
                  <span>Load older messages</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Messages List */}
        {isLoadingMessages ? (
          <div className="p-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <p>Loading messages from database...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3">
            {conversation.last_message_preview ? (
              <div className="flex justify-start">
                <div className="max-w-md bg-white border border-slate-200 text-slate-900 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs space-y-1">
                  <p className="text-xs leading-relaxed">
                    {conversation.last_message_preview}
                  </p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                    <Clock className="w-2.5 h-2.5" />
                    <span suppressHydrationWarning>{formatMessageTime(conversation.last_message_at)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                No messages recorded for this conversation yet. Send an approved template to begin.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isInbound = msg.direction === "inbound";
              const isFailed = msg.status === "failed";
              const isPending = msg.status === "pending";

              return (
                <div
                  key={msg.id}
                  className={`flex ${isInbound ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-md rounded-2xl px-3.5 py-2.5 shadow-2xs space-y-1 text-xs leading-relaxed ${
                      isInbound
                        ? "bg-white border border-slate-200 text-slate-900 rounded-tl-xs"
                        : isFailed
                        ? "bg-rose-50 border border-rose-200 text-rose-950 rounded-tr-xs"
                        : "bg-indigo-600 text-white rounded-tr-xs"
                    }`}
                  >
                    {/* Media Type Rendering */}
                    {(() => {
                      const mediaCat = msg.media_type || (["image", "document", "audio", "video"].includes(msg.message_type) ? (msg.message_type as SupportedMediaType) : null);
                      const mediaSrc = msg.media_url || (msg.storage_path ? `/api/media/download?path=${encodeURIComponent(msg.storage_path)}&biz=${encodeURIComponent(msg.business_id)}` : "");

                      if (mediaCat === "image") {
                        return (
                          <div className="space-y-1.5">
                            <div
                              className="relative rounded-lg overflow-hidden bg-slate-900/10 cursor-pointer group"
                              onClick={() => {
                                if (mediaSrc) {
                                  setLightboxMedia({ url: mediaSrc, title: msg.caption || msg.file_name || "Image Preview", type: "image" });
                                }
                              }}
                            >
                              {mediaSrc ? (
                                <img
                                  src={mediaSrc}
                                  alt={msg.caption || msg.file_name || "WhatsApp image"}
                                  className="w-full max-w-[280px] max-h-64 object-cover rounded-lg transition-transform group-hover:scale-[1.02]"
                                />
                              ) : msg.download_status === "pending" ? (
                                <div className="p-4 flex flex-col items-center justify-center bg-slate-100 text-slate-500 rounded-lg gap-1">
                                  <Loader2 className="w-5 h-5 animate-spin opacity-75" />
                                  <span className="text-[10px]">Retrieving media...</span>
                                </div>
                              ) : (
                                <div className="p-4 flex items-center justify-center bg-slate-100 text-slate-500 rounded-lg">
                                  <ImageIcon className="w-8 h-8 opacity-60" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Maximize2 className="w-5 h-5 drop-shadow" />
                              </div>
                            </div>
                            {msg.caption && <p className="whitespace-pre-wrap break-words">{msg.caption}</p>}
                            <div className="flex items-center justify-between pt-0.5 text-[10px]">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadMedia(msg);
                                }}
                                disabled={downloadingMediaId === msg.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                  isInbound
                                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    : "bg-indigo-700 text-white hover:bg-indigo-800"
                                }`}
                                title="Download Image"
                              >
                                {downloadingMediaId === msg.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                <span>Download</span>
                              </button>
                              {msg.file_size ? (
                                <span className="opacity-75">{formatBytes(msg.file_size)}</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      }

                      if (mediaCat === "document") {
                        return (
                          <div className="space-y-1.5">
                            <div
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                                isInbound
                                  ? "bg-slate-50 border-slate-200"
                                  : "bg-indigo-700/60 border-indigo-400/30 text-white"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`p-2 rounded-lg flex-shrink-0 ${
                                    isInbound ? "bg-indigo-50 text-indigo-600" : "bg-white/10 text-white"
                                  }`}
                                >
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <p
                                    className="font-semibold text-xs truncate max-w-[150px] sm:max-w-[200px]"
                                    title={msg.file_name || "Document"}
                                  >
                                    {msg.file_name || "Document"}
                                  </p>
                                  <p className="text-[10px] opacity-75">
                                    {msg.file_size ? formatBytes(msg.file_size) : "Document"}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDownloadMedia(msg)}
                                disabled={downloadingMediaId === msg.id}
                                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                                  isInbound
                                    ? "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                                    : "bg-white/20 text-white hover:bg-white/30"
                                }`}
                                title="Download document"
                                aria-label="Download document"
                              >
                                {downloadingMediaId === msg.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {msg.caption && <p className="whitespace-pre-wrap break-words">{msg.caption}</p>}
                          </div>
                        );
                      }

                      if (mediaCat === "audio") {
                        return (
                          <div className="space-y-1.5 min-w-[220px]">
                            <div className="flex items-center gap-2">
                              <Mic className={`w-4 h-4 flex-shrink-0 ${isInbound ? "text-slate-500" : "text-indigo-200"}`} />
                              <audio
                                controls
                                preload="metadata"
                                className="w-full h-8"
                                src={mediaSrc || undefined}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] pt-0.5">
                              <span className="opacity-75">{msg.file_size ? formatBytes(msg.file_size) : "Audio message"}</span>
                              <button
                                type="button"
                                onClick={() => handleDownloadMedia(msg)}
                                disabled={downloadingMediaId === msg.id}
                                className="inline-flex items-center gap-1 hover:underline"
                                title="Download audio"
                              >
                                <Download className="w-3 h-3" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (mediaCat === "video") {
                        return (
                          <div className="space-y-1.5">
                            <video
                              controls
                              preload="metadata"
                              className="w-full max-w-[280px] rounded-lg max-h-60 bg-black"
                              src={mediaSrc || undefined}
                            />
                            {msg.caption && <p className="whitespace-pre-wrap break-words">{msg.caption}</p>}
                            <div className="flex items-center justify-between text-[10px]">
                              <button
                                type="button"
                                onClick={() => handleDownloadMedia(msg)}
                                disabled={downloadingMediaId === msg.id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                  isInbound
                                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                    : "bg-indigo-700 text-white hover:bg-indigo-800"
                                }`}
                                title="Download video"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </button>
                              {msg.file_size ? <span className="opacity-75">{formatBytes(msg.file_size)}</span> : null}
                            </div>
                          </div>
                        );
                      }

                      // Default text / template message
                      return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
                    })()}

                    {/* Error details & Retry if failed */}
                    {isFailed && (
                      <div className="pt-1 mt-1 border-t border-rose-200/60 space-y-1">
                        <div className="flex items-center gap-1 text-[10px] text-rose-600 font-medium">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{msg.error_message || "Delivery failed"}</span>
                        </div>
                        {onRetryMessage && !isViewer && (
                          <button
                            type="button"
                            onClick={() => handleRetryMessage(msg.id)}
                            disabled={retryingMessageId === msg.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-semibold transition-colors"
                            title="Retry sending message"
                          >
                            {retryingMessageId === msg.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-2.5 h-2.5" />
                            )}
                            <span>Retry Send</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Metadata Footer with Status Indicators */}
                    <div
                      className={`flex items-center justify-end gap-1 text-[10px] pt-0.5 ${
                        isInbound
                          ? "text-slate-400"
                          : isFailed
                          ? "text-rose-400"
                          : "text-indigo-200"
                      }`}
                    >
                      <span suppressHydrationWarning>{formatMessageTime(msg.created_at)}</span>

                      {/* Explicit 5 Delivery Status Indicators for Outbound */}
                      {!isInbound && (
                        <span className="inline-flex items-center ml-1 gap-0.5">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-indigo-200" title="Sending...">
                              <Clock className="w-3 h-3 animate-pulse" />
                              <span className="text-[9px]">Sending</span>
                            </span>
                          )}
                          {msg.status === "sent" && (
                            <span className="inline-flex items-center gap-0.5 text-indigo-200" title="Sent (Received by Meta)">
                              <Check className="w-3 h-3" />
                              <span className="text-[9px]">Sent</span>
                            </span>
                          )}
                          {msg.status === "delivered" && (
                            <span className="inline-flex items-center gap-0.5 text-indigo-200" title="Delivered to recipient">
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span className="text-[9px]">Delivered</span>
                            </span>
                          )}
                          {msg.status === "read" && (
                            <span className="inline-flex items-center gap-0.5 text-sky-200 font-semibold" title="Read by recipient">
                              <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                              <span className="text-[9px]">Read</span>
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-0.5 text-rose-600 font-semibold" title="Delivery Failed">
                              <AlertCircle className="w-3 h-3 text-rose-600" />
                              <span className="text-[9px]">Failed</span>
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Meta Compliance 24-Hour Messaging Window Notice */}
      {!windowStatus.isOpen && (
        <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>24-Hour Messaging Window Closed.</strong> Meta policy requires an approved template to initiate or re-engage this customer.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-2xs transition-colors flex-shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Send Approved Template</span>
          </button>
        </div>
      )}

      {/* Composer Error Notice Banner (Preserves draft) */}
      {composerError && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="truncate">{composerError}</span>
          </div>
          <button
            onClick={() => setComposerError(null)}
            className="p-1 text-rose-500 hover:text-rose-700"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Text Message Composer */}
      <footer className="p-3 bg-white border-t border-slate-200">
        {/* Staged Media Attachment Preview Banner */}
        {stagedAttachment && (
          <div className="mb-2 p-3 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {stagedAttachment.mediaType === "image" && stagedAttachment.previewUrl && (
                  <img
                    src={stagedAttachment.previewUrl}
                    alt="Attachment preview"
                    className="w-12 h-12 rounded-lg object-cover border border-indigo-200 flex-shrink-0"
                  />
                )}
                {stagedAttachment.mediaType === "document" && (
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                )}
                {stagedAttachment.mediaType === "audio" && (
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                    <Mic className="w-5 h-5" />
                  </div>
                )}
                {stagedAttachment.mediaType === "video" && (
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                    <Film className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate max-w-[200px]" title={stagedAttachment.filename}>
                    {stagedAttachment.filename}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatBytes(stagedAttachment.fileSize)} • {stagedAttachment.mediaType.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (stagedAttachment.previewUrl) URL.revokeObjectURL(stagedAttachment.previewUrl);
                  setStagedAttachment(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-indigo-100"
                title="Remove attachment"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Optional Caption Input */}
            {(stagedAttachment.mediaType === "image" || stagedAttachment.mediaType === "document" || stagedAttachment.mediaType === "video") && (
              <input
                type="text"
                value={stagedAttachment.caption}
                onChange={(e) => setStagedAttachment({ ...stagedAttachment, caption: e.target.value })}
                placeholder="Add an optional caption..."
                maxLength={1024}
                className="w-full text-xs rounded-lg px-2.5 py-1.5 bg-white border border-indigo-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (stagedAttachment.previewUrl) URL.revokeObjectURL(stagedAttachment.previewUrl);
                  setStagedAttachment(null);
                }}
                className="px-3 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-indigo-100/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendMediaSubmit}
                disabled={isUploadingMedia}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5"
              >
                {isUploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send {stagedAttachment.mediaType}</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* File Attachment Hidden Input & Button */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileSelect(e.target.files[0]);
                e.target.value = "";
              }
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isViewer || !windowStatus.isOpen || isSending}
            className={`p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isViewer || !windowStatus.isOpen ? "cursor-not-allowed opacity-50" : ""
            }`}
            title={
              isViewer
                ? "Viewers cannot attach media."
                : !windowStatus.isOpen
                ? "Service window closed"
                : "Attach Media (Image, Document, Audio, Video)"
            }
            aria-label="Attach Media"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <div className="flex-1 relative">
            {/* Slash-Command Quick Replies Popover */}
            {slashMatch && !isViewer && windowStatus.isOpen && (
              <div
                role="listbox"
                aria-label="Quick replies matching slash shortcut"
                className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-slate-200 bg-white shadow-2xl z-40 overflow-hidden"
              >
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      Quick Replies{" "}
                      {slashMatch.query ? (
                        <code className="text-indigo-600 font-mono">/{slashMatch.query}</code>
                      ) : (
                        "(Type to filter)"
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSlashMatch(null);
                      setShowCannedModal(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Manage Snippets
                  </button>
                </div>

                {slashFilteredResponses.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 flex items-center justify-between gap-2">
                    <span>
                      No quick reply matching{" "}
                      <code className="font-mono text-indigo-600">/{slashMatch.query}</code>.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSlashMatch(null);
                        setShowCannedModal(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px]"
                    >
                      + Create Snippet
                    </button>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {slashFilteredResponses.map((snippet, idx) => {
                      const isActive = idx === activeSlashIndex;
                      return (
                        <button
                          key={snippet.id}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveSlashIndex(idx)}
                          onClick={() => insertCannedSnippet(snippet, slashMatch)}
                          className={`w-full text-left px-3 py-2 transition-colors flex flex-col gap-0.5 ${
                            isActive ? "bg-indigo-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-mono text-[10px] font-bold">
                                /{snippet.shortcut}
                              </span>
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {snippet.title}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 capitalize shrink-0">
                              {snippet.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-1">
                            {snippet.content}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>↑↓ Navigate · Enter or Tab to Insert · Esc to Close</span>
                </div>
              </div>
            )}

            <textarea
              id="chat-composer-textarea"
              ref={textareaRef}
              rows={1}
              value={draftText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={isSending || !windowStatus.isOpen || isViewer}
              aria-label="Type a WhatsApp message"
              placeholder={
                isViewer
                  ? "Read-only access: Viewers cannot send messages."
                  : !windowStatus.isOpen
                  ? "24-hour window closed. Click 'Send Approved Template' above to re-engage..."
                  : "Type a WhatsApp message or / for quick replies (Enter to send)..."
              }
              className={`w-full text-xs rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:bg-white resize-none max-h-32 transition-all ${
                isViewer || !windowStatus.isOpen
                  ? "bg-slate-100 cursor-not-allowed border-dashed border-slate-300"
                  : isOverLimit
                  ? "bg-rose-50 border border-rose-300 focus:ring-rose-500"
                  : "bg-slate-50 border border-slate-200 focus:ring-indigo-500"
              }`}
            />
          </div>

          {/* Quick Replies / Canned Responses Button */}
          <button
            type="button"
            onClick={() => setShowCannedModal(true)}
            disabled={isViewer}
            className={`p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isViewer ? "cursor-not-allowed opacity-50" : ""
            }`}
            title={
              isViewer
                ? "Viewers cannot insert or manage quick replies."
                : "Quick Replies & Canned Responses (/shortcut)"
            }
            aria-label="Quick Replies and Canned Responses"
          >
            <Zap className="w-4 h-4 text-amber-500" />
          </button>

          {/* Quick Template Button */}
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            disabled={isViewer}
            className={`p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isViewer ? "cursor-not-allowed opacity-50" : ""
            }`}
            title={isViewer ? "Viewers cannot send templates." : "Choose Approved WhatsApp Template"}
            aria-label="Choose Approved WhatsApp Template"
          >
            <FileText className="w-4 h-4" />
          </button>

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={
              isViewer ||
              isSending ||
              !windowStatus.isOpen ||
              !draftText.trim() ||
              isOverLimit
            }
            className={`p-2.5 rounded-xl text-white shadow-xs transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isViewer || isSending || !windowStatus.isOpen || !draftText.trim() || isOverLimit
                ? "bg-slate-300 cursor-not-allowed text-slate-500"
                : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
            }`}
            title={
              !windowStatus.isOpen
                ? "Messaging window closed — send a template to re-engage"
                : isOverLimit
                ? "Character limit exceeded"
                : "Send WhatsApp Message (Enter)"
            }
            aria-label="Send WhatsApp Message"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Composer Character Count & Helper */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1">
          <div className="flex items-center gap-2">
            <span>Meta Cloud API v26.0 Outbound</span>
            {!windowStatus.isOpen && (
              <span className="text-amber-600 font-medium">Window Closed</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={isOverLimit ? "text-rose-600 font-bold" : "text-slate-400"}>
              {draftText.length} / {MAX_CHARS}
            </span>
          </div>
        </div>
      </footer>

      {/* Approved Templates Modal */}
      {showTemplateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="template-modal-title" className="text-sm font-bold text-slate-900">
                    Send WhatsApp Message Template
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Approved templates can be sent at any time, including when the 24-hour service window is closed.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close template modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Two-Column Body */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 py-4 overflow-y-auto flex-1">
              {/* Left Column: Template Selection & Variable Input Form */}
              <div className="md:col-span-7 space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates by name or category..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
                  />
                </div>

                {/* Templates List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Select Approved Template ({filteredTemplates.length})
                  </label>
                  {filteredTemplates.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                      No matching templates found.
                    </p>
                  ) : (
                    filteredTemplates.map((tpl) => {
                      const isSelected = selectedTemplate?.template_name === tpl.template_name;
                      return (
                        <div
                          key={tpl.id || tpl.template_name}
                          onClick={() => setSelectedTemplateName(tpl.template_name)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all text-xs ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500/20"
                              : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-slate-900 font-mono text-[11px]">
                              {tpl.template_name}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600">
                                {tpl.category}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                                {tpl.language}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                {tpl.status}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-500 text-[11px] line-clamp-2 leading-relaxed">
                            {(tpl.components?.find((c: any) => c.type === "BODY") as any)?.text ||
                              "Notification template"}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Dynamic Variables Form */}
                {selectedTemplate && varExtraction.allVariables.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        Fill Required Variables ({varExtraction.allVariables.length})
                      </span>
                      {missingVariables.length > 0 ? (
                        <span className="text-[10px] text-amber-600 font-semibold">
                          {missingVariables.length} remaining
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> All filled
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {varExtraction.allVariables.map((varNum) => {
                        const isMissing = !templateVariables[varNum]?.trim();
                        return (
                          <div key={varNum} className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                              <span>
                                Variable <code className="text-indigo-600">{`{{${varNum}}}`}</code>
                              </span>
                              {isMissing && (
                                <span className="text-[10px] text-rose-500 font-medium">
                                  Required
                                </span>
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
                              className={`w-full px-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-1 ${
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

              {/* Right Column: Live WhatsApp Chat Bubble Preview */}
              <div className="md:col-span-5 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Live WhatsApp Preview
                  </span>
                  <div className="rounded-2xl bg-[#efeae2] p-3 border border-slate-200 shadow-inner min-h-[220px] flex flex-col justify-center">
                    {selectedTemplate ? (
                      <div className="bg-white rounded-xl p-3.5 shadow-sm space-y-2 border border-slate-100 max-w-sm">
                        {/* Header Component */}
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
                            <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 gap-1.5 text-[11px] border border-slate-200">
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold uppercase tracking-wider text-[10px]">
                                {header.format || "MEDIA"} HEADER
                              </span>
                            </div>
                          );
                        })()}

                        {/* Body Component */}
                        {(() => {
                          const body = selectedTemplate.components?.find(
                            (c: any) => c.type === "BODY"
                          ) as any;
                          const rawText = body?.text || "";
                          const replacedText = replaceVariables(rawText, templateVariables);
                          return (
                            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {replacedText}
                            </p>
                          );
                        })()}

                        {/* Footer Component */}
                        {(() => {
                          const footer = selectedTemplate.components?.find(
                            (c: any) => c.type === "FOOTER"
                          ) as any;
                          if (!footer?.text) return null;
                          return (
                            <p className="text-[10px] text-slate-400 italic">
                              {footer.text}
                            </p>
                          );
                        })()}

                        {/* Timestamp & Sent Status */}
                        <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-1">
                          <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <CheckCheck className="w-3 h-3 text-indigo-500" />
                        </div>

                        {/* Buttons Component */}
                        {(() => {
                          const btnComp = selectedTemplate.components?.find(
                            (c: any) => c.type === "BUTTONS"
                          ) as any;
                          if (!btnComp || !Array.isArray(btnComp.buttons) || btnComp.buttons.length === 0) {
                            return null;
                          }
                          return (
                            <div className="pt-2 border-t border-slate-100 space-y-1">
                              {btnComp.buttons.map((b: any, bIdx: number) => (
                                <div
                                  key={bIdx}
                                  className="w-full py-1 px-2.5 rounded-lg border border-slate-200 text-center text-[11px] font-semibold text-indigo-600 bg-slate-50/50 flex items-center justify-center gap-1.5"
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
                        Select a template to view live preview.
                      </p>
                    )}
                  </div>
                </div>

                {/* 24h Policy Compliance Badge */}
                <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-snug">
                  <span className="font-semibold block mb-0.5 flex items-center gap-1 text-amber-800">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    24-Hour Policy Compliant
                  </span>
                  Meta WhatsApp policy permits template messages at any time. When delivered, it re-opens the 24-hour service window.
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {missingVariables.length > 0 ? (
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Fill all variables to proceed
                  </span>
                ) : (
                  <span className="text-emerald-600 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Template is ready for dispatch
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendTemplateSubmit}
                  disabled={sendingTemplate || missingVariables.length > 0}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium text-white shadow-xs flex items-center gap-1.5 transition-colors ${
                    sendingTemplate || missingVariables.length > 0
                      ? "bg-indigo-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {sendingTemplate ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Template...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Template</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Contact CRM Profile Slide-Over */}
      {showCrmDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="crm-drawer-title"
          className="fixed inset-0 z-50 overflow-hidden flex justify-end"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setShowCrmDrawer(false)}
          />
          <div className="relative w-full max-w-sm bg-white h-full shadow-2xl z-10 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <h3 id="crm-drawer-title" className="text-sm font-bold text-slate-900">
                  Contact CRM Profile
                </h3>
              </div>
              <button
                onClick={() => setShowCrmDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                aria-label="Close CRM details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Contact Name</span>
                  <span className="font-bold text-slate-900 text-sm">{displayName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">WhatsApp Number</span>
                  <span className="font-mono text-slate-800 font-semibold">{phone}</span>
                </div>
                {contact?.email && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase block">Email Address</span>
                    <span className="text-slate-700">{contact.email}</span>
                  </div>
                )}
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Category</span>
                  <span className="font-semibold text-indigo-600">{contact?.category || "Unassigned"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Customer Status</span>
                  <span className="font-semibold capitalize text-slate-800">{contact?.status || "Lead"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">WhatsApp Messaging Window</span>
                  <span className={windowStatus.isOpen ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>
                    {windowStatus.isOpen ? `Active (${windowStatus.timeRemaining})` : "Closed (Template Required)"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Compliance / Opt-out</span>
                  <span className={contact?.is_opted_out ? "text-rose-600 font-bold" : "text-emerald-600 font-semibold"}>
                    {contact?.is_opted_out ? "Opted Out (Automations Blocked)" : "Opted In (Eligible for Automations)"}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href={`/workspace/${businessSlug}/crm`}
                  className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Profile in CRM</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase 12.2 Full-Screen Lightbox Image/Media Preview Modal */}
      {lightboxMedia && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxMedia(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxMedia(null)}
              className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-black/40 rounded-full"
              title="Close preview"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxMedia.url}
              alt={lightboxMedia.title}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            {lightboxMedia.title && (
              <p className="text-white/90 text-xs font-medium mt-3 text-center px-4 py-1.5 bg-black/50 rounded-full">
                {lightboxMedia.title}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Quick Replies & Canned Responses Modal */}
      <CannedResponsesModal
        isOpen={showCannedModal}
        onClose={() => setShowCannedModal(false)}
        responses={cannedResponses}
        isViewer={isViewer}
        canInsert={!isViewer && windowStatus.isOpen}
        onInsertSnippet={(snippet) => insertCannedSnippet(snippet)}
        onCreateResponse={async (input) => {
          if (!onCreateCannedResponse) {
            return { success: false, error: "Quick reply creation is not wired." };
          }
          return onCreateCannedResponse(input);
        }}
        onUpdateResponse={async (input) => {
          if (!onUpdateCannedResponse) {
            return { success: false, error: "Quick reply updates are not wired." };
          }
          return onUpdateCannedResponse(input);
        }}
        onDeleteResponse={async (responseId) => {
          if (!onDeleteCannedResponse) {
            return { success: false, error: "Quick reply deletion is not wired." };
          }
          return onDeleteCannedResponse(responseId);
        }}
      />
    </div>
  );
}
