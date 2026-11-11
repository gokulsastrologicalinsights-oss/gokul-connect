"use client";

import React from "react";
import {
  FileText,
  Eye,
  Edit2,
  Archive,
  ArchiveRestore,
  Trash2,
  AlertTriangle,
  Globe,
  Phone,
  CornerDownLeft,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  XCircle,
  PauseCircle,
  FileQuestion,
} from "lucide-react";
import { WhatsAppMessageTemplate, TemplateStatus } from "@/lib/templates/types";
import { extractTemplateVariables } from "@/lib/templates/validation";

interface TemplateCardProps {
  template: WhatsAppMessageTemplate;
  onPreview: (template: WhatsAppMessageTemplate) => void;
  onEdit?: (template: WhatsAppMessageTemplate) => void;
  onArchiveToggle?: (template: WhatsAppMessageTemplate) => void;
  onDelete?: (template: WhatsAppMessageTemplate) => void;
}

export function TemplateCard({
  template,
  onPreview,
  onEdit,
  onArchiveToggle,
  onDelete,
}: TemplateCardProps) {
  const varExtraction = extractTemplateVariables(template.components);

  // Status Badge Helper
  const renderStatusBadge = (status: TemplateStatus, isArchived?: boolean) => {
    if (isArchived || status === "ARCHIVED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
          <Archive className="w-2.5 h-2.5" /> Archived
        </span>
      );
    }

    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" /> Approved
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-2.5 h-2.5" /> Pending Meta Review
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-2.5 h-2.5" /> Rejected
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Edit2 className="w-2.5 h-2.5" /> Local Draft
          </span>
        );
      case "PAUSED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <PauseCircle className="w-2.5 h-2.5" /> Paused
          </span>
        );
      case "DISABLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <FileQuestion className="w-2.5 h-2.5" /> Disabled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  // Find components
  const headerComp = (template.components as any[])?.find((c) => c.type === "HEADER");
  const bodyComp = (template.components as any[])?.find((c) => c.type === "BODY");
  const footerComp = (template.components as any[])?.find((c) => c.type === "FOOTER");
  const buttonsComp = (template.components as any[])?.find((c) => c.type === "BUTTONS");
  const buttonCount = Array.isArray(buttonsComp?.buttons) ? buttonsComp.buttons.length : 0;

  const isDraft = template.status === "DRAFT";
  const isArchived = template.is_archived || template.status === "ARCHIVED";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between p-5 space-y-4">
      {/* Top Bar: Name, Status & Badges */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-mono font-bold text-sm text-slate-900 truncate">
                {template.template_name}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                {template.category}
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                {template.language}
              </span>
              {varExtraction.totalCount > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {varExtraction.totalCount} Var{varExtraction.totalCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div>{renderStatusBadge(template.status, template.is_archived)}</div>
        </div>

        {/* Rejection Alert */}
        {template.status === "REJECTED" && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Meta Rejection Reason:</span>
              <p className="text-[11px] leading-relaxed">
                {template.rejection_reason || "Template content did not meet Meta guidelines or category policy."}
              </p>
            </div>
          </div>
        )}

        {/* Body Text Snippet */}
        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed pt-1">
          {bodyComp?.text || "No message body specified."}
        </p>

        {/* Components Summary Tags */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
          {headerComp && (
            <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 flex items-center gap-1">
              <ImageIcon className="w-3 h-3 text-slate-400" />
              Header ({headerComp.format || "TEXT"})
            </span>
          )}
          {footerComp && (
            <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
              Footer
            </span>
          )}
          {buttonCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 flex items-center gap-1">
              <CornerDownLeft className="w-3 h-3 text-slate-400" />
              {buttonCount} Button{buttonCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="text-[10px] text-slate-400 space-y-0.5">
          <div>
            {template.meta_template_id ? (
              <span className="font-mono">ID: {template.meta_template_id}</span>
            ) : isDraft ? (
              <span className="text-blue-600 font-medium">Local Draft</span>
            ) : (
              <span>Default</span>
            )}
          </div>
          {template.last_synced_at && (
            <div className="flex items-center gap-1 text-[9px] text-slate-400">
              <Clock className="w-2.5 h-2.5" />
              <span>Synced {new Date(template.last_synced_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Preview Button */}
          <button
            type="button"
            onClick={() => onPreview(template)}
            className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors"
            title="Preview Template"
            aria-label="Preview Template"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Edit Draft Button */}
          {isDraft && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(template)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors"
              title="Edit Local Draft"
              aria-label="Edit Local Draft"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Archive / Unarchive Button */}
          {onArchiveToggle && (
            <button
              type="button"
              onClick={() => onArchiveToggle(template)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isArchived
                  ? "text-indigo-600 hover:bg-indigo-50 border-indigo-200"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200"
              }`}
              title={isArchived ? "Unarchive Template" : "Archive Template"}
              aria-label={isArchived ? "Unarchive Template" : "Archive Template"}
            >
              {isArchived ? (
                <ArchiveRestore className="w-3.5 h-3.5" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Delete Button (Drafts or Archived only) */}
          {(isDraft || isArchived) && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(template)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
              title="Delete Template"
              aria-label="Delete Template"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
