"use client";

import React, { useState } from "react";
import { DailyTrendPoint } from "@/lib/analytics/types";
import { ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";

interface DailyTrendsTableProps {
  dailyTrends: DailyTrendPoint[];
}

export function DailyTrendsTable({ dailyTrends }: DailyTrendsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 7;

  const totalPages = Math.ceil(dailyTrends.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const currentRows = dailyTrends.slice(startIndex, startIndex + pageSize);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Daily Message & Contact Breakdown</h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Times reported in Asia/Kolkata (IST)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Date (IST)</th>
              <th className="px-4 py-3 text-right">Inbound</th>
              <th className="px-4 py-3 text-right">Outbound</th>
              <th className="px-4 py-3 text-right">Total Messages</th>
              <th className="px-4 py-3 text-right">Delivered</th>
              <th className="px-4 py-3 text-right">Read</th>
              <th className="px-4 py-3 text-right">Failed</th>
              <th className="px-4 py-3 text-right">New Contacts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-6 text-slate-400">
                  No daily records for this date range.
                </td>
              </tr>
            ) : (
              currentRows.map((row) => (
                <tr key={row.date} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.date}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600">
                    {row.inbound}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-indigo-600">
                    {row.outbound}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {row.total}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-600 font-medium">
                    {row.delivered}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                    {row.read}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-600 font-medium">
                    {row.failed}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-800 font-bold">
                    {row.newContacts}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <span>
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, dailyTrends.length)} of{" "}
            {dailyTrends.length} days
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-slate-700 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
