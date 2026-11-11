"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  FileEdit,
  Archive,
  Layers,
  Sparkles,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  WhatsAppMessageTemplate,
  TemplateCategory,
  TemplateStatus,
  TemplateDraftInput,
} from "@/lib/templates/types";
import { TemplateCard } from "./TemplateCard";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { TemplateEditorModal } from "./TemplateEditorModal";
import { SyncTemplatesModal } from "./SyncTemplatesModal";
import {
  saveDraftTemplateAction,
  archiveTemplateAction,
  deleteTemplateAction,
  getTemplatesAction,
} from "@/app/actions/templates";

interface ConnectionItem {
  id: string;
  display_name: string;
  phone_number: string;
  waba_id: string;
  connection_status: string;
}

interface TemplateManagerClientProps {
  businessSlug: string;
  businessName: string;
  initialTemplates: WhatsAppMessageTemplate[];
  connections: ConnectionItem[];
}

export function TemplateManagerClient({
  businessSlug,
  businessName,
  initialTemplates,
  connections,
}: TemplateManagerClientProps) {
  const [templates, setTemplates] = useState<WhatsAppMessageTemplate[]>(initialTemplates);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "ALL">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<TemplateStatus | "ALL">("ALL");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("ALL");
  const [includeArchived, setIncludeArchived] = useState(false);

  // Modals state
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppMessageTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppMessageTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = templates.length;
    const approved = templates.filter((t) => t.status === "APPROVED" && !t.is_archived).length;
    const drafts = templates.filter((t) => t.status === "DRAFT" && !t.is_archived).length;
    const archived = templates.filter((t) => t.is_archived || t.status === "ARCHIVED").length;
    return { total, approved, drafts, archived };
  }, [templates]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        if (!t.template_name.toLowerCase().includes(q)) return false;
      }
      // Category
      if (selectedCategory !== "ALL" && t.category !== selectedCategory) {
        return false;
      }
      // Status
      if (selectedStatus !== "ALL" && t.status !== selectedStatus) {
        return false;
      }
      // Language
      if (selectedLanguage !== "ALL" && t.language !== selectedLanguage) {
        return false;
      }
      // Archived
      if (!includeArchived && (t.is_archived || t.status === "ARCHIVED")) {
        return false;
      }
      return true;
    });
  }, [templates, searchTerm, selectedCategory, selectedStatus, selectedLanguage, includeArchived]);

  // Unique languages in template dataset
  const availableLanguages = useMemo(() => {
    const set = new Set(templates.map((t) => t.language));
    return Array.from(set).sort();
  }, [templates]);

  // Refresh templates from server
  const refreshTemplates = async () => {
    const res = await getTemplatesAction(businessSlug, { includeArchived: true });
    if (res.success) {
      setTemplates(res.templates);
    }
  };

  // Save Draft
  const handleSaveDraft = async (draft: TemplateDraftInput, templateId?: string) => {
    const res = await saveDraftTemplateAction(businessSlug, draft, templateId);
    if (res.success) {
      showToast(templateId ? "Draft template updated." : "Draft template created.");
      await refreshTemplates();
    }
    return res;
  };

  // Archive Toggle
  const handleArchiveToggle = async (t: WhatsAppMessageTemplate) => {
    const newArchivedState = !t.is_archived && t.status !== "ARCHIVED";
    const res = await archiveTemplateAction(businessSlug, t.id, newArchivedState);
    if (res.success) {
      showToast(newArchivedState ? "Template archived." : "Template unarchived.");
      await refreshTemplates();
    } else {
      showToast(res.error || "Failed to update archive status.");
    }
  };

  // Delete Draft
  const handleDeleteTemplate = async (t: WhatsAppMessageTemplate) => {
    if (!confirm(`Are you sure you want to delete template "${t.template_name}"?`)) {
      return;
    }
    const res = await deleteTemplateAction(businessSlug, t.id);
    if (res.success) {
      showToast("Template deleted successfully.");
      await refreshTemplates();
    } else {
      showToast(res.error || "Failed to delete template.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-xl border border-slate-800 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-900">Message Templates</h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {businessName}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Manage pre-approved WhatsApp notification templates and local drafts for {businessName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Sync from Meta</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Draft Template</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Templates
          </span>
          <span className="text-2xl font-bold text-slate-900">{metrics.total}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Approved by Meta
          </span>
          <span className="text-2xl font-bold text-emerald-600">{metrics.approved}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Local Drafts
          </span>
          <span className="text-2xl font-bold text-blue-600">{metrics.drafts}</span>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Archived
          </span>
          <span className="text-2xl font-bold text-slate-500">{metrics.archived}</span>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates by name..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>

          {/* Language Dropdown & Include Archived Toggle */}
          <div className="flex items-center gap-3">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Languages</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Show Archived</span>
            </label>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider mr-1">
            Category:
          </span>
          {(["ALL", "UTILITY", "MARKETING", "AUTHENTICATION"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}

          <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider ml-3 mr-1">
            Status:
          </span>
          {(["ALL", "APPROVED", "DRAFT", "PENDING", "REJECTED", "ARCHIVED"] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  selectedStatus === st
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "ALL" ? "All Statuses" : st}
              </button>
            )
          )}
        </div>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Templates Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No WhatsApp message templates matched your search and filter criteria.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("ALL");
                setSelectedStatus("ALL");
                setSelectedLanguage("ALL");
                setIncludeArchived(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
            >
              Create Draft Template
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id || template.template_name}
              template={template}
              onPreview={(t) => setPreviewTemplate(t)}
              onEdit={(t) => setEditingTemplate(t)}
              onArchiveToggle={handleArchiveToggle}
              onDelete={handleDeleteTemplate}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      {(showCreateModal || editingTemplate) && (
        <TemplateEditorModal
          businessSlug={businessSlug}
          templateToEdit={editingTemplate}
          connections={connections}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
          onSave={handleSaveDraft}
        />
      )}

      {showSyncModal && (
        <SyncTemplatesModal
          businessSlug={businessSlug}
          connections={connections}
          onClose={() => setShowSyncModal(false)}
          onSyncComplete={async () => {
            await refreshTemplates();
          }}
        />
      )}
    </div>
  );
}
