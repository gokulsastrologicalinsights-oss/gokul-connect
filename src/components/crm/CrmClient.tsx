"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Upload,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Tag,
  Phone,
  Mail,
  MessageSquare,
  Bookmark,
  Calendar,
  MoreVertical,
  Edit2,
  Archive,
  RotateCcw,
  Plus,
  FileSpreadsheet,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Bot,
  User,
  ExternalLink,
  Layers,
  Sparkles,
  Info,
  Loader2,
  Trash2,
  CheckSquare,
} from "lucide-react";
import {
  Business,
  CrmCategory,
  CrmMetrics,
  CrmSegment,
  ContactActivityLog,
  ContactNote,
  ContactSource,
  ContactStatus,
  CsvContactImportRow,
  CsvImportValidationResult,
  WhatsAppContact,
  CrmLifecycleStage,
  ContactLifecycleHistory,
  CrmFollowUp,
} from "@/types/database";
import {
  addContactNoteAction,
  archiveContactAction,
  bulkImportContactsAction,
  createContactAction,
  createCrmCategoryAction,
  createCrmSegmentAction,
  deleteCrmSegmentAction,
  exportContactsCsvAction,
  getCrmContactByIdAction,
  getCrmContactsAction,
  openContactInInboxAction,
  updateContactAction,
  updateContactStageAction,
  bulkUpdateStageAction,
  getContactLifecycleHistoryAction,
} from "@/app/actions/crm";
import { parseAndValidateCsv, normalizePhoneNumber } from "@/lib/crm/csv-parser";

interface CrmClientProps {
  business: Business;
  initialContacts: WhatsAppContact[];
  initialTotalCount: number;
  initialMetrics: CrmMetrics;
  categories: CrmCategory[];
  initialSegments: CrmSegment[];
  stages?: CrmLifecycleStage[];
}

export function CrmClient({
  business,
  initialContacts,
  initialTotalCount,
  initialMetrics,
  categories: initialCategories,
  initialSegments,
  stages: initialStages = [],
}: CrmClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // State
  const [contacts, setContacts] = useState<WhatsAppContact[]>(initialContacts);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);
  const [metrics, setMetrics] = useState<CrmMetrics>(initialMetrics);
  const [categories, setCategories] = useState<CrmCategory[]>(initialCategories);
  const [segments, setSegments] = useState<CrmSegment[]>(initialSegments);
  const [stages, setStages] = useState<CrmLifecycleStage[]>(initialStages);

  // Filters & View Mode
  const [viewMode, setViewMode] = useState<"table" | "pipeline">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<ContactSource | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Selection for Campaigns / Bulk Actions
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [campaignSelectionMode, setCampaignSelectionMode] = useState(false);
  const [isBulkStageModalOpen, setIsBulkStageModalOpen] = useState(false);
  const [bulkTargetStage, setBulkTargetStage] = useState(stages[0]?.slug || "");

  // Modals & Drawers
  const [activeContact, setActiveContact] = useState<WhatsAppContact | null>(null);
  const [contactLifecycleHistory, setContactLifecycleHistory] = useState<ContactLifecycleHistory[]>([]);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<WhatsAppContact | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Operation Feedback & Loading States
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Detail Drawer Active Tab
  const [drawerTab, setDrawerTab] = useState<"profile" | "notes" | "timeline" | "followups" | "history">("profile");
  const [newNoteText, setNewNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Bulk Import State
  const [csvText, setCsvText] = useState("");
  const [validationResult, setValidationResult] = useState<CsvImportValidationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Category Color Map
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    pink: "bg-pink-50 text-pink-700 border-pink-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };

  // Distinct tags collected from contacts
  const allAvailableTags = useMemo(() => {
    const tagSet = new Set<string>();
    contacts.forEach((c) => (c.tags || []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [contacts]);

  // Refetch contacts with current filters
  const reloadContacts = async (page = currentPage) => {
    setIsLoadingContacts(true);
    try {
      const res = await getCrmContactsAction(business.slug, {
        search: searchQuery,
        status: statusFilter,
        category: categoryFilter,
        source: sourceFilter,
        tag: tagFilter,
        is_archived: showArchived,
        page,
        limit: pageSize,
      });

      if (res.success) {
        setContacts(res.contacts);
        setTotalCount(res.totalCount || 0);
        setCurrentPage(page);
      } else if (res.error) {
        setFeedbackMessage({ type: "error", text: res.error });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to load contacts." });
    } finally {
      setIsLoadingContacts(false);
    }
  };

  // Trigger search on filter changes
  const handleFilterChange = (updates: Partial<{
    search: string;
    status: ContactStatus | "all";
    category: string;
    stage: string;
    source: ContactSource | "all";
    tag: string;
    archived: boolean;
  }>) => {
    let nextSearch = searchQuery;
    let nextStatus = statusFilter;
    let nextCategory = categoryFilter;
    let nextStage = stageFilter;
    let nextSource = sourceFilter;
    let nextTag = tagFilter;
    let nextArchived = showArchived;

    if (updates.search !== undefined) {
      setSearchQuery(updates.search);
      nextSearch = updates.search;
    }
    if (updates.status !== undefined) {
      setStatusFilter(updates.status);
      nextStatus = updates.status;
    }
    if (updates.category !== undefined) {
      setCategoryFilter(updates.category);
      nextCategory = updates.category;
    }
    if (updates.stage !== undefined) {
      setStageFilter(updates.stage);
      nextStage = updates.stage;
    }
    if (updates.source !== undefined) {
      setSourceFilter(updates.source);
      nextSource = updates.source;
    }
    if (updates.tag !== undefined) {
      setTagFilter(updates.tag);
      nextTag = updates.tag;
    }
    if (updates.archived !== undefined) {
      setShowArchived(updates.archived);
      nextArchived = updates.archived;
    }

    startTransition(async () => {
      setIsLoadingContacts(true);
      const res = await getCrmContactsAction(business.slug, {
        search: nextSearch,
        status: nextStatus,
        category: nextCategory,
        lifecycle_stage: nextStage,
        source: nextSource,
        tag: nextTag,
        is_archived: nextArchived,
        page: 1,
        limit: pageSize,
      });
      if (res.success) {
        setContacts(res.contacts);
        setTotalCount(res.totalCount || 0);
        setCurrentPage(1);
      }
      setIsLoadingContacts(false);
    });
  };

  // Open Contact Profile
  const handleOpenProfile = async (contact: WhatsAppContact) => {
    setActiveContact(contact);
    setIsDetailDrawerOpen(true);
    setDrawerTab("profile");

    // Load full profile with notes, timeline & lifecycle history in parallel
    const [res, histRes] = await Promise.all([
      getCrmContactByIdAction(business.slug, contact.id),
      getContactLifecycleHistoryAction(business.slug, contact.id),
    ]);
    if (res.success && res.contact) {
      setActiveContact(res.contact);
    }
    if (histRes.success && histRes.history) {
      setContactLifecycleHistory(histRes.history);
    }
  };

  // Change stage for active contact
  const handleUpdateActiveContactStage = async (newStageSlug: string, reason?: string) => {
    if (!activeContact) return;
    try {
      const res = await updateContactStageAction(business.slug, activeContact.id, newStageSlug, reason);
      if (res.success) {
        setActiveContact((prev) => (prev ? { ...prev, lifecycle_stage_slug: newStageSlug } : prev));
        setContacts((prev) =>
          prev.map((c) => (c.id === activeContact.id ? { ...c, lifecycle_stage_slug: newStageSlug } : c))
        );
        setFeedbackMessage({ type: "success", text: `Updated lifecycle stage to "${newStageSlug}".` });
        // Refresh history
        const histRes = await getContactLifecycleHistoryAction(business.slug, activeContact.id);
        if (histRes.success && histRes.history) {
          setContactLifecycleHistory(histRes.history);
        }
      } else {
        setFeedbackMessage({ type: "error", text: res.error || "Failed to update lifecycle stage." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to update lifecycle stage." });
    }
  };

  // Bulk update stage for selected contacts
  const handleBulkUpdateStageSubmit = async () => {
    if (selectedContactIds.size === 0 || !bulkTargetStage) return;
    try {
      const ids = Array.from(selectedContactIds);
      const res = await bulkUpdateStageAction(business.slug, ids, bulkTargetStage);
      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: `Successfully updated ${res.updatedCount} contact(s) to "${bulkTargetStage}".`,
        });
        setIsBulkStageModalOpen(false);
        setSelectedContactIds(new Set());
        // Refresh contacts list
        handleFilterChange({});
      } else {
        setFeedbackMessage({ type: "error", text: res.error || "Failed to bulk update stage." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to bulk update stage." });
    }
  };

  // Open Contact directly in WhatsApp Inbox
  const handleOpenInInbox = async (contactId: string) => {
    try {
      const res = await openContactInInboxAction(business.slug, contactId);
      if (res.success) {
        router.push(`/workspace/${business.slug}/inbox?conversationId=${res.conversationId}`);
      } else {
        setFeedbackMessage({ type: "error", text: (res as any).error || "Could not link conversation." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to open in inbox." });
    }
  };

  // Add Note
  const handleAddNote = async () => {
    if (!activeContact || !newNoteText.trim()) return;
    setIsAddingNote(true);
    try {
      const res = await addContactNoteAction(business.slug, activeContact.id, {
        note: newNoteText.trim(),
        author_name: "Staff",
      });
      if (res.success && res.note) {
        setNewNoteText("");
        const refreshed = await getCrmContactByIdAction(business.slug, activeContact.id);
        if (refreshed.success && refreshed.contact) {
          setActiveContact(refreshed.contact);
        }
        setFeedbackMessage({ type: "success", text: "Note added successfully." });
      } else {
        setFeedbackMessage({ type: "error", text: res.error || "Failed to save note." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Error adding note." });
    } finally {
      setIsAddingNote(false);
    }
  };

  // Archive / Restore
  const handleToggleArchive = async (contact: WhatsAppContact) => {
    const shouldArchive = !contact.is_archived;
    const res = await archiveContactAction(business.slug, contact.id, shouldArchive);
    if (res.success) {
      setFeedbackMessage({
        type: "success",
        text: shouldArchive ? "Contact archived." : "Contact restored.",
      });
      if (activeContact?.id === contact.id) {
        setIsDetailDrawerOpen(false);
      }
      reloadContacts(currentPage);
    } else {
      setFeedbackMessage({ type: "error", text: res.error || "Failed to update contact." });
    }
  };

  // Copy Phone Number
  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      const res = await exportContactsCsvAction(business.slug, {
        search: searchQuery,
        status: statusFilter,
        category: categoryFilter,
        source: sourceFilter,
        tag: tagFilter,
        is_archived: showArchived,
      });

      if (res.success) {
        const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || "contacts.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedbackMessage({ type: "success", text: `Exported ${res.count} contacts to CSV.` });
      } else {
        setFeedbackMessage({ type: "error", text: (res as any).error || "Failed to export CSV." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Failed to download export." });
    }
  };

  // Parse CSV on upload
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      const existingPhones = new Set(contacts.map((c) => c.phone_number));
      const result = parseAndValidateCsv(text, existingPhones);
      setValidationResult(result);
    };
    reader.readAsText(file);
  };

  // Commit CSV Bulk Import
  const handleCommitImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return;
    setIsImporting(true);
    try {
      const res = await bulkImportContactsAction(business.slug, validationResult.validRows);
      if (res.success) {
        setFeedbackMessage({
          type: "success",
          text: `Imported ${res.importedCount} contacts successfully! (${res.duplicateCount} duplicates skipped).`,
        });
        setIsImportModalOpen(false);
        setCsvText("");
        setValidationResult(null);
        reloadContacts(1);
      } else {
        setFeedbackMessage({ type: "error", text: res.error || "Import failed." });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: "error", text: err.message || "Bulk import error." });
    } finally {
      setIsImporting(false);
    }
  };

  // Apply Saved Segment
  const handleApplySegment = (segment: CrmSegment) => {
    const f = segment.filters || {};
    if (f.status && Array.isArray(f.status) && f.status.length > 0) {
      setStatusFilter(f.status[0]);
    }
    if (f.category && Array.isArray(f.category) && f.category.length > 0) {
      setCategoryFilter(f.category[0]);
    }
    if (f.source && Array.isArray(f.source) && f.source.length > 0) {
      setSourceFilter(f.source[0]);
    }
    if (f.tags && Array.isArray(f.tags) && f.tags.length > 0) {
      setTagFilter(f.tags[0]);
    }
    if (f.search && typeof f.search === "string") {
      setSearchQuery(f.search);
    }

    startTransition(async () => {
      const res = await getCrmContactsAction(business.slug, {
        search: (f.search as string) || "",
        status: f.status?.[0] || "all",
        category: f.category?.[0] || "all",
        source: f.source?.[0] || "all",
        tag: f.tags?.[0] || "all",
        is_archived: false,
        page: 1,
        limit: pageSize,
      });
      if (res.success) {
        setContacts(res.contacts);
        setTotalCount(res.totalCount || 0);
        setCurrentPage(1);
        setFeedbackMessage({ type: "success", text: `Loaded segment "${segment.name}".` });
      }
    });
  };

  // Toggle Contact Selection
  const handleToggleSelectContact = (id: string) => {
    const next = new Set(selectedContactIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedContactIds(next);
  };

  const handleSelectAllOnPage = () => {
    if (selectedContactIds.size === contacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(contacts.map((c) => c.id)));
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          role="alert"
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium border animate-in fade-in duration-200 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* 1. CRM KPI SUMMARY METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Contacts</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{metrics.totalContacts}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Isolated to {business.name}</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Leads</span>
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-2">{metrics.leads}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">New prospective clients</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Customers</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2">{metrics.activeCustomers}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Engaged & verified</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Inactive</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2">{metrics.inactive}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">No recent activity</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Opted Out</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2">{metrics.optedOut}</div>
          <span className="text-[10px] text-rose-500 mt-0.5 block">Marketing blocked</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">New This Month</span>
            <Calendar className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 mt-2">{metrics.newThisMonth}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Registered this month</span>
        </div>
      </div>

      {/* 2. CONTROLS BAR: SEARCH, FILTERS, SEGMENTS & ACTIONS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              placeholder="Search by name, WhatsApp number, or email..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setEditingContact(null);
                setIsAddEditModalOpen(true);
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              title="Bulk Import Contacts from CSV"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Import CSV</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              title="Export Filtered Contacts to CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setCampaignSelectionMode(!campaignSelectionMode)}
              className={`px-3 py-2 border text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors ${
                campaignSelectionMode
                  ? "bg-purple-50 border-purple-300 text-purple-700 font-bold"
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
              }`}
              title="Select contacts for future approved campaign without sending messages"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Campaign Select {selectedContactIds.size > 0 && `(${selectedContactIds.size})`}</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-400">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange({ status: e.target.value as any })}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="customer">Customer</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Business Category Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => handleFilterChange({ category: e.target.value })}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lifecycle Stage Filter */}
          {stages.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400">Stage:</span>
              <select
                value={stageFilter}
                onChange={(e) => handleFilterChange({ stage: e.target.value })}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Stages</option>
                {stages.map((st) => (
                  <option key={st.id} value={st.slug}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Source Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-400">Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => handleFilterChange({ source: e.target.value as any })}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Sources</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website">Website</option>
              <option value="referral">Referral</option>
              <option value="walk_in">Walk-in</option>
              <option value="csv_import">CSV Import</option>
              <option value="manual">Manual Entry</option>
            </select>
          </div>

          {/* Tag Filter */}
          {allAvailableTags.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400">Tag:</span>
              <select
                value={tagFilter}
                onChange={(e) => handleFilterChange({ tag: e.target.value })}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Tags</option>
                {allAvailableTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Saved Segments Selector */}
          {segments.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-slate-400">Segment:</span>
              <select
                onChange={(e) => {
                  const s = segments.find((seg) => seg.id === e.target.value);
                  if (s) handleApplySegment(s);
                }}
                defaultValue=""
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="" disabled>
                  Load Saved Segment...
                </option>
                {segments.map((seg) => (
                  <option key={seg.id} value={seg.id}>
                    {seg.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Save Current Filters as Segment Button */}
          <button
            onClick={() => setIsSegmentModalOpen(true)}
            className="px-2.5 py-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Save Segment</span>
          </button>

          {/* Archived Toggle */}
          <label className="flex items-center gap-1.5 ml-auto cursor-pointer text-slate-500 hover:text-slate-800">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => handleFilterChange({ archived: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span className="text-xs">Show Archived</span>
          </label>

          {/* View Mode Toggle: Table vs Pipeline */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-2">
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                viewMode === "table" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode("pipeline")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                viewMode === "pipeline" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Pipeline
            </button>
          </div>
        </div>
      </div>

      {/* Selected Contacts Action Banner */}
      {selectedContactIds.size > 0 && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span>
              <strong>{selectedContactIds.size} contact(s) selected:</strong> Update stage in bulk or export.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBulkStageModalOpen(true)}
              className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
            >
              Change Stage
            </button>
            <button
              onClick={handleExportCsv}
              className="px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100/50 transition"
            >
              Export Selected
            </button>
            <button
              onClick={() => setSelectedContactIds(new Set())}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Campaign Selection Active Notice Banner */}
      {campaignSelectionMode && selectedContactIds.size === 0 && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600 flex-shrink-0" />
            <span>
              <strong>Campaign Audience Mode:</strong> Check contacts to select them for your campaign.
            </span>
          </div>
        </div>
      )}

      {/* 3. RESPONSIVE CONTACTS TABLE / PIPELINE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoadingContacts ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs text-slate-500">Loading contacts for {business.name}...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Contacts Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all" || categoryFilter !== "all"
                ? "No contacts matched your search and filter criteria. Try clearing some filters."
                : `Get started by adding your first contact or importing an existing customer list for ${business.name}.`}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setEditingContact(null);
                  setIsAddEditModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700"
              >
                Add Contact
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Import CSV
              </button>
            </div>
          </div>
        ) : viewMode === "pipeline" ? (
          <div className="p-4 overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-4">
              {stages.map((stage) => {
                const stageContacts = contacts.filter((c) => c.lifecycle_stage_slug === stage.slug);
                return (
                  <div
                    key={stage.id}
                    className="w-72 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-col max-h-[70vh]"
                  >
                    {/* Stage Header */}
                    <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white rounded-t-xl">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <h4 className="text-xs font-bold text-slate-900">{stage.name}</h4>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">
                        {stageContacts.length}
                      </span>
                    </div>

                    {/* Stage Contact Cards */}
                    <div className="p-2 space-y-2 overflow-y-auto flex-1">
                      {stageContacts.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs italic">
                          No contacts in this stage
                        </div>
                      ) : (
                        stageContacts.map((contact) => (
                          <div
                            key={contact.id}
                            onClick={() => handleOpenProfile(contact)}
                            className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs hover:border-indigo-400 hover:shadow-sm cursor-pointer transition space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-slate-900">
                                {contact.display_name || "Unknown"}
                              </span>
                              {contact.category && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                                  {contact.category}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {contact.phone_number}
                            </div>
                            {contact.next_follow_up_at && (
                              <div className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  Follow-up:{" "}
                                  {new Date(contact.next_follow_up_at).toLocaleDateString("en-IN", {
                                    timeZone: "Asia/Kolkata",
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedContactIds.size === contacts.length && contacts.length > 0}
                      onChange={handleSelectAllOnPage}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">WhatsApp Number</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4">Compliance</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {contacts.map((contact) => {
                  const isSelected = selectedContactIds.has(contact.id);
                  const isOptedOut = contact.is_opted_out;

                  return (
                    <tr
                      key={contact.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? "bg-indigo-50/30" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectContact(contact.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        />
                      </td>

                      {/* Contact Name & Avatar */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => handleOpenProfile(contact)}
                          className="flex items-center gap-2.5 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            {(contact.display_name || "C").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {contact.display_name || "Unknown"}
                            </div>
                            {contact.email && (
                              <div className="text-[11px] text-slate-400 font-normal">
                                {contact.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                          <span>{contact.phone_number}</span>
                          <button
                            onClick={() => handleCopyPhone(contact.phone_number)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                            title="Copy number"
                          >
                            {copiedPhone === contact.phone_number ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        {contact.category ? (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              colorMap[
                                categories.find((c) => c.name === contact.category)?.color || "indigo"
                              ] || "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }`}
                          >
                            {contact.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Unassigned</span>
                        )}
                      </td>

                      {/* Stage */}
                      <td className="py-3 px-4">
                        {contact.lifecycle_stage_slug ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {stages.find((s) => s.slug === contact.lifecycle_stage_slug)?.name || contact.lifecycle_stage_slug}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No Stage</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            contact.status === "active" || contact.status === "customer"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : contact.status === "lead"
                              ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {contact.status?.toUpperCase() || "LEAD"}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 text-slate-600 text-[11px] capitalize">
                        {contact.source?.replace("_", " ") || "whatsapp"}
                      </td>

                      {/* Tags */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(contact.tags || []).slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                            >
                              #{t}
                            </span>
                          ))}
                          {(contact.tags || []).length > 2 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              +{(contact.tags || []).length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Compliance / Opt-out */}
                      <td className="py-3 px-4">
                        {isOptedOut ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Opted Out</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Check className="w-3 h-3" />
                            <span>Opted In</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Open in Inbox */}
                          <button
                            onClick={() => handleOpenInInbox(contact.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Open in WhatsApp Inbox"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* View Profile */}
                          <button
                            onClick={() => handleOpenProfile(contact)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="View Contact Profile"
                          >
                            <User className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditingContact(contact);
                              setIsAddEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Edit Contact"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Archive/Restore */}
                          <button
                            onClick={() => handleToggleArchive(contact)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title={contact.is_archived ? "Restore Contact" : "Archive Contact"}
                          >
                            {contact.is_archived ? (
                              <RotateCcw className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > pageSize && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing {contacts.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
              {Math.min(currentPage * pageSize, totalCount)} of {totalCount} contacts
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1 || isLoadingContacts}
                onClick={() => reloadContacts(currentPage - 1)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="font-semibold text-slate-800">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages || isLoadingContacts}
                onClick={() => reloadContacts(currentPage + 1)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. CONTACT DETAIL PROFILE DRAWER */}
      {isDetailDrawerOpen && activeContact && (
        <div
          className="fixed inset-0 z-50 overflow-hidden flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDetailDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl z-10 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                  {(activeContact.display_name || "C").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {activeContact.display_name || "Contact Profile"}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-slate-600">{activeContact.phone_number}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        activeContact.status === "active" || activeContact.status === "customer"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {activeContact.status?.toUpperCase() || "LEAD"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                aria-label="Close profile drawer"
              >
                ✕
              </button>
            </div>

            {/* Quick Action: Open in WhatsApp Inbox */}
            <div className="p-4 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-950 block">WhatsApp Conversation</span>
                <span className="text-[11px] text-indigo-700">Open full chat history and send messages</span>
              </div>
              <button
                onClick={() => handleOpenInInbox(activeContact.id)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Open in Inbox</span>
              </button>
            </div>

            {/* Automation Eligibility Notice */}
            <div className="px-5 py-3 border-b border-slate-100">
              {activeContact.is_opted_out ? (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <div>
                    <strong>Opted Out:</strong> WhatsApp automated messages are blocked for this contact.
                    {activeContact.opted_out_reason && (
                      <span className="block text-[11px] text-rose-600 mt-0.5">
                        Reason: {activeContact.opted_out_reason}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    <strong>Automation Eligible:</strong> Active opt-in confirmed. Automated rule workflows and notifications are permitted.
                  </span>
                </div>
              )}
            </div>

            {/* Drawer Tabs */}
            <div className="flex border-b border-slate-200 text-xs font-semibold text-slate-600 overflow-x-auto">
              <button
                onClick={() => setDrawerTab("profile")}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors whitespace-nowrap ${
                  drawerTab === "profile"
                    ? "border-indigo-600 text-indigo-600 font-bold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setDrawerTab("notes")}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors whitespace-nowrap ${
                  drawerTab === "notes"
                    ? "border-indigo-600 text-indigo-600 font-bold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                Notes ({activeContact.notes?.length || 0})
              </button>
              <button
                onClick={() => setDrawerTab("followups")}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors whitespace-nowrap ${
                  drawerTab === "followups"
                    ? "border-indigo-600 text-indigo-600 font-bold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                Follow-ups ({activeContact.follow_ups?.length || 0})
              </button>
              <button
                onClick={() => setDrawerTab("history")}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors whitespace-nowrap ${
                  drawerTab === "history"
                    ? "border-indigo-600 text-indigo-600 font-bold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                Stage History ({contactLifecycleHistory.length})
              </button>
              <button
                onClick={() => setDrawerTab("timeline")}
                className={`flex-1 py-2.5 px-2 text-center border-b-2 transition-colors whitespace-nowrap ${
                  drawerTab === "timeline"
                    ? "border-indigo-600 text-indigo-600 font-bold"
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                Timeline
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {drawerTab === "profile" && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Business Tenant</span>
                      <span className="font-semibold text-slate-800">{business.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Category</span>
                      <span className="font-semibold text-indigo-600">{activeContact.category || "Unassigned"}</span>
                    </div>
                    <div className="col-span-2 bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                      <span className="text-[10px] text-indigo-900 font-semibold uppercase block mb-1">
                        Customer Lifecycle Stage
                      </span>
                      <select
                        value={activeContact.lifecycle_stage_slug || ""}
                        onChange={(e) => handleUpdateActiveContactStage(e.target.value)}
                        className="w-full text-xs font-semibold rounded-md border border-indigo-200 bg-white p-1.5 text-indigo-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="" disabled>Select Lifecycle Stage...</option>
                        {stages.map((st) => (
                          <option key={st.id} value={st.slug}>
                            {st.name} {st.is_default ? "(Default)" : ""} {st.is_converted ? "★ Converted" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Contact Source</span>
                      <span className="font-medium text-slate-700 capitalize">
                        {activeContact.source?.replace("_", " ") || "WhatsApp"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Contact Source</span>
                      <span className="font-medium text-slate-700 capitalize">
                        {activeContact.source?.replace("_", " ") || "WhatsApp"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Registered On</span>
                      <span className="font-medium text-slate-700">
                        {activeContact.created_at ? new Date(activeContact.created_at).toLocaleDateString() : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Total Inbound msgs</span>
                      <span className="font-medium text-slate-700">{activeContact.total_inbound_count || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Last Inbound at</span>
                      <span className="font-medium text-slate-700">
                        {activeContact.last_inbound_at
                          ? new Date(activeContact.last_inbound_at).toLocaleString()
                          : "Never"}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <span className="text-xs font-semibold text-slate-700 block mb-1.5">Tags:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeContact.tags || []).length > 0 ? (
                        (activeContact.tags || []).map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200"
                          >
                            #{t}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">No tags assigned.</span>
                      )}
                    </div>
                  </div>

                  {/* Contact Actions */}
                  <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingContact(activeContact);
                        setIsAddEditModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Contact Details</span>
                    </button>
                    <button
                      onClick={() => handleToggleArchive(activeContact)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ml-auto"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>{activeContact.is_archived ? "Restore Contact" : "Archive Contact"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Notes Tab */}
              {drawerTab === "notes" && (
                <div className="space-y-4">
                  {/* Add Note Form */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 block">Add Contact Note:</label>
                    <textarea
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      rows={3}
                      placeholder="Enter internal consultation note, horoscope details, or matrimony preferences..."
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={handleAddNote}
                        disabled={isAddingNote || !newNoteText.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50"
                      >
                        {isAddingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>Save Note</span>
                      </button>
                    </div>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {(activeContact.notes || []).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">No notes recorded yet.</p>
                    ) : (
                      (activeContact.notes || []).map((note) => (
                        <div key={note.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-700">{note.author_name}</span>
                            <span>{new Date(note.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{note.note}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Timeline Tab */}
              {drawerTab === "timeline" && (
                <div className="space-y-3">
                  {(activeContact.activity_logs || []).length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No activity history found.</p>
                  ) : (
                    (activeContact.activity_logs || []).map((log) => (
                      <div key={log.id} className="flex items-start gap-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{log.title}</span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          {log.description && (
                            <p className="text-[11px] text-slate-600 mt-0.5">{log.description}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Follow-ups Tab */}
              {drawerTab === "followups" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">Follow-up Tasks</span>
                    <Link
                      href={`/workspace/${business.slug}/crm/follow-ups`}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Follow-ups Dashboard</span>
                    </Link>
                  </div>

                  {(activeContact.follow_ups || []).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      No follow-up tasks currently assigned to this contact.
                    </div>
                  ) : (
                    (activeContact.follow_ups || []).map((fu) => (
                      <div key={fu.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{fu.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                            {fu.status}
                          </span>
                        </div>
                        {fu.description && <p className="text-slate-600 text-[11px]">{fu.description}</p>}
                        <div className="text-[10px] text-slate-400 font-mono pt-1">
                          Due: {new Date(fu.due_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Stage History Tab */}
              {drawerTab === "history" && (
                <div className="space-y-3">
                  <div className="pb-2 border-b border-slate-100 text-xs font-semibold text-slate-700">
                    Lifecycle Stage Transitions
                  </div>

                  {contactLifecycleHistory.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No stage changes recorded yet for this contact.
                    </div>
                  ) : (
                    contactLifecycleHistory.map((hist) => (
                      <div key={hist.id} className="flex items-start gap-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0" />
                        <div className="flex-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-indigo-700">
                              {hist.from_stage_slug ? `${hist.from_stage_slug} → ` : ""}{hist.to_stage_slug || hist.to_stage}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(hist.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                            </span>
                          </div>
                          {hist.change_reason && (
                            <p className="text-[11px] text-slate-600 mt-1">{hist.change_reason}</p>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Changed by: {hist.changed_by_name || hist.changed_by || "Staff"}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. BULK CHANGE STAGE MODAL */}
      {isBulkStageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Bulk Update Lifecycle Stage</h3>
            <p className="text-xs text-slate-500 mb-4">
              Apply a new lifecycle stage to {selectedContactIds.size} selected contact(s).
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Stage</label>
                <select
                  value={bulkTargetStage}
                  onChange={(e) => setBulkTargetStage(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-indigo-500"
                >
                  {stages.map((st) => (
                    <option key={st.id} value={st.slug}>
                      {st.name} {st.is_default ? "(Default)" : ""} {st.is_converted ? "★ Converted" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkStageModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpdateStageSubmit}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                >
                  Confirm Bulk Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD / EDIT CONTACT MODAL */}
      {isAddEditModalOpen && (
        <AddEditContactModal
          business={business}
          categories={categories}
          contact={editingContact}
          onClose={() => setIsAddEditModalOpen(false)}
          onSuccess={(saved) => {
            setIsAddEditModalOpen(false);
            setFeedbackMessage({
              type: "success",
              text: editingContact ? "Contact updated." : "Contact created successfully.",
            });
            reloadContacts(currentPage);
          }}
        />
      )}

      {/* 6. CSV BULK IMPORT MODAL */}
      {isImportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Bulk Import Contacts from CSV</h3>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setValidationResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Upload a CSV file containing contact records for <strong>{business.name}</strong>. Existing duplicate numbers within this business will be identified and safely skipped.
            </p>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center space-y-2 bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs text-slate-600">
                <label className="font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                  <span>Click to browse CSV file</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileUpload}
                    className="sr-only"
                  />
                </label>{" "}
                or drag and drop here
              </div>
              <p className="text-[10px] text-slate-400">Supported columns: Name, WhatsApp Phone, Email, Category, Status, Tags, Notes</p>
            </div>

            {/* Validation Preview */}
            {validationResult && (
              <div className="flex-1 overflow-y-auto space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-100 font-semibold text-slate-700">
                    Total: {validationResult.totalRows}
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                    Valid: {validationResult.validRows.length}
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                    Duplicates: {validationResult.duplicateCount}
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 text-rose-800 font-semibold border border-rose-200">
                    Errors: {validationResult.invalidCount}
                  </div>
                </div>

                {/* Validation Errors Notice */}
                {validationResult.errors.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 space-y-1 max-h-32 overflow-y-auto">
                    <strong className="block font-semibold">Row Issues Detected:</strong>
                    {validationResult.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx}>
                        Row {err.row}: {err.error} {err.phone && `(${err.phone})`}
                      </div>
                    ))}
                    {validationResult.errors.length > 10 && (
                      <span className="italic block">+ {validationResult.errors.length - 10} more issues.</span>
                    )}
                  </div>
                )}

                {/* Preview Valid Rows Table */}
                {validationResult.validRows.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase">
                        <tr>
                          <th className="p-2">Name</th>
                          <th className="p-2">Phone</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {validationResult.validRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium">{row.name}</td>
                            <td className="p-2 font-mono">{row.phone}</td>
                            <td className="p-2 text-slate-500">{row.email || "—"}</td>
                            <td className="p-2">{row.category || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setValidationResult(null);
                }}
                className="px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitImport}
                disabled={isImporting || !validationResult || validationResult.validRows.length === 0}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                {isImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Import {validationResult?.validRows.length || 0} Contacts</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. SAVE SEGMENT MODAL */}
      {isSegmentModalOpen && (
        <SaveSegmentModal
          business={business}
          currentFilters={{
            status: statusFilter !== "all" ? [statusFilter] : undefined,
            category: categoryFilter !== "all" ? [categoryFilter] : undefined,
            source: sourceFilter !== "all" ? [sourceFilter] : undefined,
            tags: tagFilter !== "all" ? [tagFilter] : undefined,
            search: searchQuery || undefined,
          }}
          onClose={() => setIsSegmentModalOpen(false)}
          onSuccess={(newSegment) => {
            setSegments([newSegment, ...segments]);
            setIsSegmentModalOpen(false);
            setFeedbackMessage({ type: "success", text: `Segment "${newSegment.name}" saved.` });
          }}
        />
      )}
    </div>
  );
}

/**
 * Modal: Add / Edit Contact
 */
function AddEditContactModal({
  business,
  categories,
  contact,
  onClose,
  onSuccess,
}: {
  business: Business;
  categories: CrmCategory[];
  contact: WhatsAppContact | null;
  onClose: () => void;
  onSuccess: (saved: WhatsAppContact) => void;
}) {
  const [displayName, setDisplayName] = useState(contact?.display_name || "");
  const [phoneNumber, setPhoneNumber] = useState(contact?.phone_number || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [status, setStatus] = useState<ContactStatus>(contact?.status || "lead");
  const [category, setCategory] = useState<string>(contact?.category || "");
  const [source, setSource] = useState<ContactSource>(contact?.source || "manual");
  const [tagsInput, setTagsInput] = useState((contact?.tags || []).join(", "));
  const [initialNote, setInitialNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      if (contact) {
        // Update existing contact
        const res = await updateContactAction(business.slug, contact.id, {
          display_name: displayName,
          phone_number: phoneNumber,
          email: email || null,
          status,
          category: category || null,
          source,
          tags,
        });

        if (res.success && res.contact) {
          onSuccess(res.contact);
        } else {
          setErrorMessage(res.error || "Failed to update contact.");
        }
      } else {
        // Create new contact
        const res = await createContactAction(business.slug, {
          display_name: displayName,
          phone_number: phoneNumber,
          email: email || undefined,
          status,
          category: category || undefined,
          source,
          tags,
          note: initialNote || undefined,
        });

        if (res.success && res.contact) {
          onSuccess(res.contact);
        } else {
          setErrorMessage(res.error || "Failed to create contact.");
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            {contact ? "Edit Contact" : "Add New Contact"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorMessage}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Full Name / Display Name *</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">WhatsApp Phone Number *</label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 919444559071 or +91 94445 59071"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Unique per business tenant. Formatted automatically into E.164.
            </span>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Email Address (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. ramesh@example.com"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="">Unassigned</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContactStatus)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="lead">Lead</option>
                <option value="active">Active</option>
                <option value="customer">Customer</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as ContactSource)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="manual">Manual Entry</option>
              <option value="whatsapp">WhatsApp Inbound</option>
              <option value="website">Website Enquiry</option>
              <option value="referral">Referral</option>
              <option value="walk_in">Walk-in</option>
              <option value="csv_import">CSV Import</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. VIP, Horoscope, Chennai"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {!contact && (
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Initial Consultation Note</label>
              <textarea
                rows={2}
                value={initialNote}
                onChange={(e) => setInitialNote(e.target.value)}
                placeholder="Optional notes or customer requirements..."
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{contact ? "Save Changes" : "Create Contact"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Modal: Save Segment
 */
function SaveSegmentModal({
  business,
  currentFilters,
  onClose,
  onSuccess,
}: {
  business: Business;
  currentFilters: Record<string, unknown>;
  onClose: () => void;
  onSuccess: (segment: CrmSegment) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await createCrmSegmentAction(business.slug, {
        name: name.trim(),
        description: description.trim() || undefined,
        filters: currentFilters,
      });

      if (res.success && res.segment) {
        onSuccess(res.segment);
      } else {
        setError(res.error || "Failed to save segment.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save segment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Save Filter as Segment</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold">
            ✕
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">Segment Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Active Horoscope Enquiries"
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Purpose or notes about this segment..."
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Segment</span>
          </button>
        </div>
      </form>
    </div>
  );
}
