"use client";

import React, { useState } from "react";
import { Calendar, Clock, ChevronDown } from "lucide-react";
import { DateRangeFilter, DateRangePreset } from "@/lib/analytics/types";
import { resolveDateRange } from "@/lib/analytics/date-utils";

interface DateRangePickerProps {
  currentFilter: DateRangeFilter;
  onChange: (filter: DateRangeFilter) => void;
  isLoading?: boolean;
}

const PRESET_OPTIONS: { id: DateRangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "this_month", label: "This Month" },
  { id: "previous_month", label: "Previous Month" },
  { id: "custom", label: "Custom Range" },
];

export function DateRangePicker({
  currentFilter,
  onChange,
  isLoading = false,
}: DateRangePickerProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const handlePresetSelect = (preset: DateRangePreset) => {
    if (preset === "custom") {
      setShowCustomModal(true);
      return;
    }
    const resolved = resolveDateRange(preset);
    onChange(resolved);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStart || !customEnd) return;
    if (customStart > customEnd) {
      alert("Start date must be before or equal to End date.");
      return;
    }
    const resolved = resolveDateRange("custom", customStart, customEnd);
    onChange(resolved);
    setShowCustomModal(false);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm">
      {/* Active Range & Timezone Badge */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <Calendar className="h-3.5 w-3.5 text-indigo-600" />
          <span>
            {currentFilter.istStartFormatted} — {currentFilter.istEndFormatted}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
          <Clock className="h-3 w-3 text-emerald-600" />
          <span>Asia/Kolkata (IST, UTC+05:30)</span>
        </div>
      </div>

      {/* Preset Pill Buttons */}
      <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
        {PRESET_OPTIONS.map((opt) => {
          const isSelected = currentFilter.preset === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={isLoading}
              onClick={() => handlePresetSelect(opt.id)}
              className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm font-semibold"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200"
              } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Range Modal */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-5 max-w-sm w-full animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Select Custom Date Range</h3>
            <p className="text-xs text-slate-500 mb-4">
              All dates are evaluated in Asia/Kolkata (IST) timezone.
            </p>
            <form onSubmit={handleApplyCustom} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Start Date (IST)
                </label>
                <input
                  type="date"
                  required
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  End Date (IST)
                </label>
                <input
                  type="date"
                  required
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-sm"
                >
                  Apply Range
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
