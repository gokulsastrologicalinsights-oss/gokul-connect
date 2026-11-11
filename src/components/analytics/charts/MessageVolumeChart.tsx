"use client";

import React, { useState } from "react";
import { DailyTrendPoint } from "@/lib/analytics/types";
import { MessageSquare, Info } from "lucide-react";

interface MessageVolumeChartProps {
  data: DailyTrendPoint[];
  title?: string;
  description?: string;
}

export function MessageVolumeChart({
  data,
  title = "Message Volume Trends",
  description = "Daily aggregate volume of incoming and outgoing WhatsApp messages",
}: MessageVolumeChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const totalAllMessages = data.reduce((acc, d) => acc + d.total, 0);

  if (data.length === 0 || totalAllMessages === 0) {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-[300px]">
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="text-xs font-semibold text-slate-700">No message traffic recorded</p>
          <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
            There are no inbound or outbound WhatsApp messages recorded in the database for this date range.
          </p>
        </div>
      </div>
    );
  }

  // Calculate SVG line points
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const chartHeight = 160;
  const chartWidth = 500;
  const paddingX = 30;
  const paddingY = 20;

  const innerWidth = chartWidth - paddingX * 2;
  const innerHeight = chartHeight - paddingY * 2;

  const points = data.map((d, i) => {
    const x = paddingX + (i / Math.max(data.length - 1, 1)) * innerWidth;
    const y = chartHeight - paddingY - (d.total / maxVal) * innerHeight;
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
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-extrabold text-indigo-600">{totalAllMessages}</span>
          <span className="text-[11px] text-slate-400 block">Total Messages</span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden pt-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-44 overflow-visible"
        >
          <defs>
            <linearGradient id="msgVolGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={chartWidth - paddingX}
            y2={paddingY}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={chartHeight / 2}
            x2={chartWidth - paddingX}
            y2={chartHeight / 2}
            stroke="#f1f5f9"
            strokeDasharray="4 4"
          />
          <line
            x1={paddingX}
            y1={chartHeight - paddingY}
            x2={chartWidth - paddingX}
            y2={chartHeight - paddingY}
            stroke="#e2e8f0"
          />

          {/* Area fill */}
          <path d={areaD} fill="url(#msgVolGrad)" />

          {/* Trend line */}
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" />

          {/* Hoverable points */}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? 5 : 3.5}
                className={`transition-all duration-150 cursor-pointer ${
                  hoveredIndex === i ? "fill-white stroke-indigo-600 stroke-2" : "fill-indigo-600"
                }`}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            </g>
          ))}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] rounded-lg px-3 py-1.5 shadow-xl pointer-events-none z-10 border border-slate-700 flex items-center gap-3 animate-in fade-in duration-100"
          >
            <span className="font-semibold text-slate-300">{points[hoveredIndex].data.date}</span>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">In: {points[hoveredIndex].data.inbound}</span>
              <span className="text-indigo-400">Out: {points[hoveredIndex].data.outbound}</span>
              <span className="font-bold text-white border-l border-slate-700 pl-2">
                Total: {points[hoveredIndex].data.total}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Axis X Labels */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 px-2 pt-2 border-t border-slate-100">
        <span>{data[0]?.date || ""}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.date}</span>}
        <span>{data[data.length - 1]?.date || ""}</span>
      </div>
    </div>
  );
}
