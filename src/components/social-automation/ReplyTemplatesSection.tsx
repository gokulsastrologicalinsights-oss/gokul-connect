import React, { useState } from "react";
import {
  FileText,
  Copy,
  Check,
  Plus,
  Sparkles,
  Globe,
  MessageSquare,
  Lock,
} from "lucide-react";
import type { MetaSocialReplyTemplate } from "@/lib/meta-social/rules-store";

interface ReplyTemplatesSectionProps {
  businessSlug: string;
  publicTemplates: MetaSocialReplyTemplate[];
  privateTemplates: MetaSocialReplyTemplate[];
  onUseTemplate: (template: MetaSocialReplyTemplate) => void;
}

export function ReplyTemplatesSection({
  businessSlug,
  publicTemplates,
  privateTemplates,
  onUseTemplate,
}: ReplyTemplatesSectionProps) {
  const isAstrology = businessSlug === "astrology";
  const [activeTab, setActiveTab] = useState<"public" | "private">("public");
  const [languageFilter, setLanguageFilter] = useState<"all" | "ta" | "en" | "both">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentTemplates = activeTab === "public" ? publicTemplates : privateTemplates;

  const filteredTemplates = currentTemplates.filter((t) => {
    if (languageFilter === "all") return true;
    return t.language === languageFilter;
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Standard Reply Templates Library
          </h2>
          <p className="text-sm text-slate-500">
            Pre-approved Tamil & English response templates optimized for {isAstrology ? "Astrology" : "Vivaham Matrimony"}.
          </p>
        </div>
      </div>

      {/* Tabs & Language Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("public")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "public"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Public Comment Replies ({publicTemplates.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("private")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "private"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Private DMs ({privateTemplates.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" />
            Language:
          </span>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value as any)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-hidden"
          >
            <option value="all">All Languages</option>
            <option value="ta">Tamil (தமிழ்)</option>
            <option value="en">English</option>
            <option value="both">Bilingual</option>
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => {
          const isCopied = copiedId === template.id;
          return (
            <div
              key={template.id}
              className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">{template.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                      {template.language === "ta"
                        ? "தமிழ் (Tamil)"
                        : template.language === "en"
                        ? "English"
                        : "Bilingual"}
                    </span>
                    {template.isDefault && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Recommended
                      </span>
                    )}
                  </div>
                </div>

                {template.description && (
                  <p className="text-xs text-slate-500">{template.description}</p>
                )}

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                  {template.content}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleCopy(template.id, template.content)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium py-1 px-2 rounded-md hover:bg-slate-100 transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onUseTemplate(template)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Use in Rule</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
