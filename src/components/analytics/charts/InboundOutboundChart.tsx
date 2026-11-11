"use client";

import React, { useState } from "react";
import { DailyTrendPoint } from "@/lib/analytics/types";
import { ArrowDownLeft, ArrowUpRight, BarChart2 } from "lucide-react";

interface InboundOutboundChartProps {
  data: DailyTrendPoint[];
  title?: string;
}

export function InboundOutboundChart({
  data,
  title = "Inbound vs Outbound Comparison",
}: InboundOutboundChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const totalInbound = data.reduce((acc, d) => acc + d.inbound, 0);
  const totalOutbound = data.reduce((acc, d) => acc + d.outbound, 0);

  if (data.length === 0 || (totalInbound === 0 && totalOutbound === 0)) {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-[300px]">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">Side-by-side volume distribution</p>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <BarChart2 className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-700">No message traffic comparison</p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
            Zero inbound or outbound messages are recorded for the selected date range.
          </p>
        </div>
      </div>
    );
  }

  // Calculate bars
  const maxVal = Math.max(...data.map((d) => Math.max(d.inbound, d.outbound)), 1);
  const chartHeight = 150;
  const paddingBottom = 20;
  const paddingTop = 10;
  const usableHeight = chartHeight - paddingBottom - paddingTop;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">Inbound (customer) vs Outbound (agent/bot)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-bold">{totalInbound}</span>
            <span className="text-[10px] text-emerald-600">Inbound</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
            <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600" />
            <span className="font-bold">{totalOutbound}</span>
            <span className="text-[10px] text-indigo-600">Outbound</span>
          </div>
        </div>
      </div>

      <div className="relative pt-2">
        <div className="flex items-end justify-between gap-1 h-[150px] border-b border-slate-200 px-2 pb-1">
          {data.map((d, i) => {
            const inHeight = Math.max(2, (d.inbound / maxVal) * usableHeight);
            const outHeight = Math.max(2, (d.outbound / maxVal) * usableHeight);
            const isHovered = hoveredIndex === i;

            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="flex items-end gap-0.5 sm:gap-1 w-full justify-center">
                  {/* Inbound Bar */}
                  <div
                    style={{ height: `${inHeight}px` }}
                    className={`w-2 sm:w-3.5 rounded-t transition-all ${
                      isHovered ? "bg-emerald-600" : "bg-emerald-400"
                    }`}
                  />
                  {/* Outbound Bar */}
                  <div
                    style={{ height: `${outHeight}px` }}
                    className={`w-2 sm:w-3.5 rounded-t transition-all ${
                      isHovered ? "bg-indigo-600" : "bg-indigo-400"
                    }`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover Tooltip */}
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] rounded-lg px-3 py-1.5 shadow-xl pointer-events-none z-10 border border-slate-700 flex items-center gap-2">
            <span className="font-semibold text-slate-300">{data[hoveredIndex].date}</span>
            <span className="text-emerald-400">Inbound: {data[hoveredIndex].inbound}</span>
            <span className="text-indigo-400">Outbound: {data[hoveredIndex].outbound}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 pt-2">
        <span>{data[0]?.date || ""}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.date}</span>}
        <span>{data[data.length - 1]?.date || ""}</span>
      </div>
    </div>
  );
}
