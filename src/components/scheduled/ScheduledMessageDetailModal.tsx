"use client";

import React from "react";
import { WhatsAppScheduledMessage } from "@/types/database";
import { formatKolkataDate } from "@/lib/analytics/date-utils";
import {
  X,
  Calendar,
  Clock,
  Phone,
  User,
  MessageSquare,
  Sparkles,
  Image as ImageIcon,
  CheckCheck,
  AlertCircle,
  Hash,
} from "lucide-react";

interface ScheduledMessageDetailModalProps {
  message: WhatsAppScheduledMessage;
  onClose: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  canEdit?: boolean;
}

export function ScheduledMessageDetailModal({
  message,
  onClose,
  onReschedule,
  onCancel,
  onRetry,
  canEdit = true,
}: ScheduledMessageDetailModalProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "processing":
        return "bg-blue-100 text-blue-800 border-blue-200 animate-pulse";
      case "sent":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "delivered":
        return "bg-teal-100 text-teal-800 border-teal-200";
      case "read":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "failed":
        return "bg-rose-100 text-rose-800 border-rose-200";
      case "cancelled":
        return "bg-slate-200 text-slate-700 border-slate-300";
      case "draft":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Scheduled Message Details</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(
                    message.status
                  )}`}
                >
                  {message.status.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">ID: {message.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Recipient & Connection Card */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Recipient
              </span>
              <p className="font-semibold text-slate-900 flex items-center space-x-1">
                <Phone className="w-3.5 h-3.5 text-purple-600" />
                <span className="font-mono">{message.recipient_phone}</span>
              </p>
              {message.recipient_name && (
                <p className="text-slate-600 flex items-center space-x-1 mt-0.5">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>{message.recipient_name}</span>
                </p>
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Message Format
              </span>
              <p className="font-semibold text-slate-900 capitalize flex items-center space-x-1">
                {message.message_type === "template" ? (
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                ) : message.message_type === "text" ? (
                  <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                )}
                <span>{message.message_type}</span>
              </p>
              {message.template_name && (
                <p className="text-purple-700 font-medium truncate mt-0.5">
                  Template: {message.template_name}
                </p>
              )}
            </div>
          </div>

          {/* Message Content Preview */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Content Preview
            </span>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl whitespace-pre-wrap font-sans text-slate-800">
              {message.content ? (
                message.content
              ) : message.template_name ? (
                <div className="space-y-1">
                  <p className="font-semibold text-purple-800">
                    Meta Template: {message.template_name} ({message.template_language})
                  </p>
                  {message.template_variables && Object.keys(message.template_variables).length > 0 && (
                    <div className="pt-1.5 border-t border-slate-200 flex flex-wrap gap-1">
                      {Object.entries(message.template_variables).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px]">
                          <strong>{`{{${k}}}`}:</strong> {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : message.media_filename ? (
                <div className="flex items-center space-x-2">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                  <span>
                    {message.media_filename} ({message.media_type})
                  </span>
                  {message.media_caption && <p className="italic text-slate-600">"{message.media_caption}"</p>}
                </div>
              ) : (
                <span className="text-slate-400 italic">No content</span>
              )}
            </div>
          </div>

          {/* Schedule & Timing */}
          <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>Scheduled For:</span>
              </span>
              <span className="font-semibold text-purple-900 font-mono">
                {formatKolkataDate(message.scheduled_at, true)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span>Created At:</span>
              <span>{formatKolkataDate(message.created_at, true)}</span>
            </div>

            {message.sent_at && (
              <div className="flex items-center justify-between text-emerald-700 text-[11px]">
                <span className="flex items-center space-x-1">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Dispatched At:</span>
                </span>
                <span className="font-mono">{formatKolkataDate(message.sent_at, true)}</span>
              </div>
            )}

            {message.cancelled_at && (
              <div className="flex items-center justify-between text-slate-600 text-[11px]">
                <span>Cancelled At:</span>
                <span>{formatKolkataDate(message.cancelled_at, true)}</span>
              </div>
            )}
          </div>

          {/* Errors or Rejection notice */}
          {message.last_error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1">
              <div className="flex items-center space-x-1.5 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Delivery or Processing Issue:</span>
              </div>
              <p className="text-[11px] font-mono whitespace-pre-wrap">{message.last_error}</p>
              <p className="text-[10px] text-rose-600">
                Retry count: {message.retry_count} / {message.max_retries}
              </p>
            </div>
          )}

          {/* Meta Identifiers if available */}
          {(message.meta_message_id || message.message_id) && (
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1 font-mono text-[11px] text-slate-500">
              {message.meta_message_id && <p>Meta WAMID: {message.meta_message_id}</p>}
              {message.message_id && <p>Internal Msg ID: {message.message_id}</p>}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Close
          </button>

          {canEdit && (
            <div className="flex items-center space-x-2">
              {message.status === "failed" && onRetry && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onRetry();
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Retry Message
                </button>
              )}

              {["scheduled", "draft"].includes(message.status) && (
                <>
                  {onReschedule && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onReschedule();
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                    >
                      Reschedule
                    </button>
                  )}

                  {onCancel && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onCancel();
                      }}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition"
                    >
                      Cancel Message
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
