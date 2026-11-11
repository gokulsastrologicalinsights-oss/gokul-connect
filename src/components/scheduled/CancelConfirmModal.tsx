"use client";

import React, { useState } from "react";
import { WhatsAppScheduledMessage } from "@/types/database";
import { AlertTriangle, X } from "lucide-react";

interface CancelConfirmModalProps {
  message: WhatsAppScheduledMessage;
  onClose: () => void;
  onConfirm: (messageId: string, reason?: string) => Promise<boolean>;
}

export function CancelConfirmModal({
  message,
  onClose,
  onConfirm,
}: CancelConfirmModalProps) {
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const success = await onConfirm(message.id, reason.trim() || undefined);
      if (success) {
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to cancel message.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Cancel Scheduled Message</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs text-slate-700">
          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
              {errorMsg}
            </div>
          )}

          <p className="text-slate-600">
            Are you sure you want to cancel this scheduled message? Once cancelled, it will not be dispatched to the recipient.
          </p>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
            <p className="text-slate-500">Recipient:</p>
            <p className="font-semibold text-slate-900">
              {message.recipient_name ? `${message.recipient_name} (${message.recipient_phone})` : message.recipient_phone}
            </p>
            <p className="text-slate-500 pt-1">Type:</p>
            <p className="capitalize font-medium text-slate-800">{message.message_type}</p>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Cancellation Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Appointment rescheduled by customer"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
          >
            Keep Scheduled
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm disabled:opacity-50 transition"
          >
            {isSubmitting ? "Cancelling..." : "Yes, Cancel Message"}
          </button>
        </div>
      </div>
    </div>
  );
}
