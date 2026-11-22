import React from "react";
import {
  ShieldAlert,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Info,
  Lock,
} from "lucide-react";

interface AutomationConfigBannerProps {
  businessSlug: string;
}

export function AutomationConfigBanner({ businessSlug }: AutomationConfigBannerProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Automation Engine Safeguards & Configuration
            </h3>
            <p className="text-xs text-slate-500">
              Deterministic rule execution parameters and safety boundaries.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
          <Lock className="w-3.5 h-3.5 text-slate-500" />
          Configuration Preview Only
        </span>
      </div>

      {/* Safety Notice Callout */}
      <div className="p-3.5 rounded-lg bg-indigo-50/60 border border-indigo-200 text-xs text-indigo-950 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold">Phase 13D Non-Interference & Safety Guarantee:</span>
          <p className="text-indigo-900">
            This dashboard operates strictly in configuration and preview mode. In compliance with the non-interference policy, no automated Facebook comment replies or Instagram DMs are published to live Meta endpoints during this phase. All configured keyword rules and templates are persisted safely in the database and validated offline.
          </p>
        </div>
      </div>

      {/* Feature Toggles Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 text-xs">
              Public Comment Replies
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Enabled (Dry-Run)
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Automatically acknowledges post & reel comments under Facebook & Instagram posts with predefined answers.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 text-xs">
              Private DM on Comment
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              Enabled (Dry-Run)
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Meta Private Replies: Delivers complete horoscope or matrimony details directly to the user&apos;s private inbox.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 text-xs">
              Inbound DM Auto-Reply
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Enabled (Dry-Run)
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Instant 24/7 keyword responses for direct messages received in Instagram & Facebook Messenger.
          </p>
        </div>
      </div>
    </div>
  );
}
