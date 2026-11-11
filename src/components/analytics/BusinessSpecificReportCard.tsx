"use client";

import React from "react";
import { BusinessSpecificReport } from "@/lib/analytics/types";
import { Sparkles, HeartHandshake, AlertCircle, CheckCircle2, Clock } from "lucide-react";

interface BusinessSpecificReportCardProps {
  report: BusinessSpecificReport;
  businessName: string;
}

export function BusinessSpecificReportCard({
  report,
  businessName,
}: BusinessSpecificReportCardProps) {
  const isAstrology = report.businessType === "astrology";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2.5 rounded-xl ${
              isAstrology
                ? "bg-purple-100 text-purple-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {isAstrology ? (
              <Sparkles className="h-5 w-5" />
            ) : (
              <HeartHandshake className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{businessName}</h3>
            <p className="text-xs text-slate-500">
              {isAstrology
                ? "Astrology, KP, Vedic, Horoscope & Consultation Intelligence"
                : "Matrimony, Profile, Groom/Bride & Membership Enquiries Intelligence"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
          <span>Tenant Scoped</span>
        </div>
      </div>

      {/* Enquiry Category Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {report.breakdown.map((item) => (
          <div
            key={item.category}
            className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between hover:bg-slate-50 transition-colors"
          >
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-bold text-slate-800">{item.label}</span>
                <span className="text-[11px] font-semibold text-indigo-600">
                  {item.percentage}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight mb-2">
                {item.description}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-medium">Recorded Volume</span>
              <span className="text-lg font-black text-slate-900">{item.count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Follow-up & Conversion Integrity Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
        {/* Follow-Up Status */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
            Follow-Up Status
          </span>
          {isAstrology ? (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-slate-600">Pending:</span>
                <span className="font-bold text-slate-900">
                  {report.followUpStatus.pending}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-slate-600">Resolved:</span>
                <span className="font-bold text-slate-900">
                  {report.followUpStatus.completed}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-slate-600">Pending Registration:</span>
                <span className="font-bold text-slate-900">
                  {report.registrationFollowUps}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-slate-600">Active Threads:</span>
                <span className="font-bold text-slate-900">
                  {report.activeMembers}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Customer / Lead Conversion Integrity Notice */}
        <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/60 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-bold block mb-0.5">
              {isAstrology ? "Customer Conversion Audit" : "Membership Conversion Audit"}
            </span>
            <span>
              {isAstrology
                ? report.customerConversion.note
                : report.leadConversion.note}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
