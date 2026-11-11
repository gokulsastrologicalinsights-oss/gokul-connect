"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  Globe,
  Phone,
  CornerDownLeft,
  Image as ImageIcon,
  CheckCheck,
  Tag,
  AlertTriangle,
  Info,
} from "lucide-react";
import { WhatsAppMessageTemplate } from "@/lib/templates/types";
import {
  extractTemplateVariables,
  replaceVariables,
} from "@/lib/templates/validation";

interface TemplatePreviewModalProps {
  template: WhatsAppMessageTemplate | null;
  onClose: () => void;
}

export function TemplatePreviewModal({
  template,
  onClose,
}: TemplatePreviewModalProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const varExtraction = extractTemplateVariables(template?.components);

  // Initialize variable sample values
  useEffect(() => {
    if (template) {
      const initial: Record<string, string> = {};
      const exampleTexts = (
        template.components?.find((c: any) => c.type === "BODY") as any
      )?.example?.body_text?.[0];

      varExtraction.allVariables.forEach((v, idx) => {
        initial[v] = exampleTexts?.[idx] || `Sample ${v}`;
      });
      setVariableValues(initial);
    }
  }, [template?.id]);

  if (!template) return null;

  const headerComp = (template.components as any[])?.find(
    (c) => c.type === "HEADER"
  );
  const bodyComp = (template.components as any[])?.find(
    (c) => c.type === "BODY"
  );
  const footerComp = (template.components as any[])?.find(
    (c) => c.type === "FOOTER"
  );
  const buttonsComp = (template.components as any[])?.find(
    (c) => c.type === "BUTTONS"
  );

  const replacedHeaderText = headerComp?.format === "TEXT"
    ? replaceVariables(headerComp.text || "", variableValues)
    : "";
  const replacedBodyText = replaceVariables(bodyComp?.text || "", variableValues);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col space-y-5 my-8">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 id="preview-modal-title" className="text-sm font-bold text-slate-900">
                WhatsApp Template Preview
              </h3>
              <p className="text-[11px] font-mono text-slate-500">
                {template.template_name} ({template.language})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close preview modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left: Metadata & Variable Inputs */}
          <div className="md:col-span-5 space-y-4">
            {/* Template Specs */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-400">
                Template Specifications
              </h4>
              <div className="space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Category:</span>
                  <span className="font-bold uppercase">{template.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-semibold text-emerald-700">{template.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Language:</span>
                  <span className="font-mono">{template.language}</span>
                </div>
                {template.meta_template_id && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Meta ID:</span>
                    <span className="font-mono text-[10px]">{template.meta_template_id}</span>
                  </div>
                )}
                {template.last_synced_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Last Synced:</span>
                    <span className="font-mono text-[10px]">{new Date(template.last_synced_at).toLocaleString()}</span>
                  </div>
                )}
                {template.connection_id && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Connection:</span>
                    <span className="font-mono text-[10px] truncate max-w-[130px]">{template.connection_id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rejection Reason Alert if Applicable */}
            {template.status === "REJECTED" && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Meta Rejection Notice
                </div>
                <p className="text-[11px] leading-relaxed">
                  {template.rejection_reason || "Template content violated WhatsApp policy or formatting guidelines."}
                </p>
              </div>
            )}

            {/* Interactive Variable Tester */}
            {varExtraction.allVariables.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  Test Dynamic Variables
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">
                  Edit variable values below to simulate live customer personalization.
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {varExtraction.allVariables.map((v) => (
                    <div key={v} className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-700">
                        Variable <code className="text-indigo-600 font-mono">{`{{${v}}}`}</code>
                      </label>
                      <input
                        type="text"
                        value={variableValues[v] || ""}
                        onChange={(e) =>
                          setVariableValues((prev) => ({
                            ...prev,
                            [v]: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder={`Value for {{${v}}}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Realistic WhatsApp Phone Bubble Mock */}
          <div className="md:col-span-7 flex flex-col justify-center">
            <div className="rounded-3xl bg-[#efeae2] p-4 border border-slate-300 shadow-inner">
              {/* WhatsApp Message Bubble */}
              <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200/80 space-y-2.5 max-w-sm mx-auto">
                {/* Header */}
                {headerComp && (
                  <div>
                    {headerComp.format === "TEXT" ? (
                      <h4 className="font-bold text-xs text-slate-900 border-b border-slate-100 pb-1.5">
                        {replacedHeaderText}
                      </h4>
                    ) : (
                      <div className="w-full h-28 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 gap-2 text-xs border border-slate-200">
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                        <span className="font-bold uppercase tracking-wider text-[11px]">
                          {headerComp.format || "MEDIA"} HEADER
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Body Text */}
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {replacedBodyText}
                </p>

                {/* Footer */}
                {footerComp?.text && (
                  <p className="text-[10px] text-slate-400 italic pt-1">
                    {footerComp.text}
                  </p>
                )}

                {/* Sent Time & Double Checkmark */}
                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-0.5">
                  <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-indigo-500" />
                </div>

                {/* Buttons */}
                {buttonsComp && Array.isArray(buttonsComp.buttons) && buttonsComp.buttons.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    {buttonsComp.buttons.map((b: any, idx: number) => (
                      <div
                        key={idx}
                        className="w-full py-1.5 px-3 rounded-xl border border-slate-200 text-center text-xs font-semibold text-indigo-600 bg-slate-50/50 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        {b.type === "URL" && <Globe className="w-3.5 h-3.5" />}
                        {b.type === "PHONE_NUMBER" && <Phone className="w-3.5 h-3.5" />}
                        {b.type === "QUICK_REPLY" && <CornerDownLeft className="w-3.5 h-3.5" />}
                        <span>{b.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
