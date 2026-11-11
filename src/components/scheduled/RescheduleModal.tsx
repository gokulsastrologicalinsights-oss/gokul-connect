"use client";

import React, { useState } from "react";
import { WhatsAppScheduledMessage } from "@/types/database";
import { formatKolkataDate } from "@/lib/analytics/date-utils";
import { Clock, Calendar, X, AlertCircle } from "lucide-react";

interface RescheduleModalProps {
  message: WhatsAppScheduledMessage;
  onClose: () => void;
  onReschedule: (messageId: string, newScheduledAt: string) => Promise<boolean>;
}

export function RescheduleModal({
  message,
  onClose,
  onReschedule,
}: RescheduleModalProps) {
  // Initialize with current scheduled_at formatted for datetime-local
  const initialLocal = React.useMemo(() => {
    const d = new Date(message.scheduled_at);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${mins}`;
  }, [message.scheduled_at]);

  const [newDateLocal, setNewDateLocal] = useState<string>(initialLocal);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    setErrorMsg(null);
    const d = new Date(newDateLocal);
    if (isNaN(d.getTime())) {
      setErrorMsg("Please enter a valid date and time.");
      return;
    }

    if (d.getTime() <= Date.now()) {
      setErrorMsg("Rescheduled date and time must be in the future.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onReschedule(message.id, d.toISOString());
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reschedule message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Reschedule Message</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-700">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <p className="text-slate-500">Recipient:</p>
            <p className="font-semibold text-slate-900">
              {message.recipient_name ? `${message.recipient_name} (${message.recipient_phone})` : message.recipient_phone}
            </p>
            <p className="text-slate-500 pt-1">Currently scheduled for:</p>
            <p className="font-mono text-purple-700 font-medium">
              {formatKolkataDate(message.scheduled_at, true)}
            </p>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1.5 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>Select New Date & Time (Asia/Kolkata IST)</span>
            </label>
            <input
              type="datetime-local"
              value={newDateLocal}
              onChange={(e) => setNewDateLocal(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 transition"
          >
            {isSubmitting ? "Saving..." : "Confirm Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
