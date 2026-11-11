"use client";

import React, { useState } from "react";
import { DailyTrendPoint } from "@/lib/analytics/types";
import { Users, UserPlus } from "lucide-react";

interface ContactGrowthChartProps {
  data: DailyTrendPoint[];
  totalContacts: number;
  newContacts: number;
}

export function ContactGrowthChart({
  data,
  totalContacts,
  newContacts,
}: ContactGrowthChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0 || totalContacts === 0) {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-[300px]">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Contact Growth & Acquisition</h3>
          <p className="text-xs text-slate-500">New contacts added over time</p>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Users className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-700">No contact growth recorded</p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
            No contacts were acquired during this specific date window.
          </p>
        </div>
      </div>
    );
  }

  // Calculate cumulative or daily new contacts
  let cumulative = Math.max(0, totalContacts - newContacts);
  const trendWithCumulative = data.map((d) => {
    cumulative += d.newContacts;
    return { ...d, cumulative };
  });

  const maxVal = Math.max(...trendWithCumulative.map((d) => d.cumulative), 1);
  const chartHeight = 150;
  const chartWidth = 500;
  const paddingX = 30;
  const paddingY = 20;

  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const points = trendWithCumulative.map((d, i) => {
    const x = paddingX + (i / Math.max(trendWithCumulative.length - 1, 1)) * innerWidth;
    const y = chartHeight - paddingY - (d.cumulative / maxVal) * innerHeight;
    return { x, y, data: d };
  });

  const pathD = points.reduce(
    (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
    ""
  );

  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${
    points[0].x
  } ${chartHeight - paddingY} Z`;

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Contact Growth & Acquisition</h3>
          <p className="text-xs text-slate-500">Cumulative contacts across filtered date range</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-lg font-extrabold text-blue-600">{totalContacts}</span>
            <span className="text-[10px] text-slate-400 block">Total</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
            <UserPlus className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-bold">+{newContacts}</span>
            <span className="text-[10px] text-blue-600">New</span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-hidden pt-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-40 overflow-visible"
        >
          <defs>
            <linearGradient id="contactGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={chartHeight - paddingY}
            x2={chartWidth - paddingX}
            y2={chartHeight - paddingY}
            stroke="#e2e8f0"
          />

          <path d={areaD} fill="url(#contactGrad)" />
          <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />

          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 5 : 3.5}
              className={`transition-all duration-150 cursor-pointer ${
                hoveredIndex === i ? "fill-white stroke-blue-600 stroke-2" : "fill-blue-600"
              }`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>

        {hoveredIndex !== null && points[hoveredIndex] && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] rounded-lg px-3 py-1.5 shadow-xl pointer-events-none z-10 border border-slate-700 flex items-center gap-2">
            <span className="font-semibold text-slate-300">{points[hoveredIndex].data.date}</span>
            <span className="text-blue-400">Total: {points[hoveredIndex].data.cumulative}</span>
            <span className="text-emerald-400">+{points[hoveredIndex].data.newContacts} new</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 pt-2 border-t border-slate-100">
        <span>{data[0]?.date || ""}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.date}</span>}
        <span>{data[data.length - 1]?.date || ""}</span>
      </div>
    </div>
  );
}
