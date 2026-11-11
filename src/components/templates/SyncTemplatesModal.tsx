"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  X,
  RefreshCw,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Server,
} from "lucide-react";
import { syncTemplatesAction } from "@/app/actions/templates";

interface ConnectionItem {
  id: string;
  display_name: string;
  phone_number: string;
  waba_id: string;
  connection_status: string;
}

interface SyncTemplatesModalProps {
  businessSlug: string;
  connections: ConnectionItem[];
  onClose: () => void;
  onSyncComplete: () => void;
}

export function SyncTemplatesModal({
  businessSlug,
  connections,
  onClose,
  onSyncComplete,
}: SyncTemplatesModalProps) {
  const [selectedConnectionId, setSelectedConnectionId] = useState(
    connections[0]?.id || ""
  );
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count?: number;
    added?: number;
    updated?: number;
    error?: string;
    requiresConnection?: boolean;
  } | null>(null);

  const selectedConnection = connections.find(
    (c) => c.id === selectedConnectionId
  );

  const handleSync = async () => {
    if (!selectedConnectionId) return;
    setSyncing(true);
    setResult(null);

    try {
      const res = await syncTemplatesAction(businessSlug, selectedConnectionId);
      setResult(res);
      if (res.success) {
        onSyncComplete();
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || "Template synchronization failed.",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 id="sync-modal-title" className="text-sm font-bold text-slate-900">
                Synchronize Meta WhatsApp Templates
              </h3>
              <p className="text-[11px] text-slate-500">
                Secure server-side sync from your Meta WhatsApp Business Account (WABA).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close sync modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security & Access Notice */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Server-Side Vault Security
          </div>
          <p className="text-[11px] leading-relaxed">
            API tokens are retrieved securely from the encrypted vault on the server and are never exposed to client browsers.
            Local drafts are preserved and will not be overwritten.
          </p>
        </div>

        {/* Connection Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">
            Select Connected WhatsApp Number:
          </label>
          {connections.length === 0 ? (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 space-y-2">
              <p className="font-semibold">No active WhatsApp connections found for this business.</p>
              <Link
                href={`/workspace/${businessSlug}/connections`}
                className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-semibold"
              >
                Go to Connections Manager <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {connections.map((c) => (
                <label
                  key={c.id}
                  onClick={() => setSelectedConnectionId(c.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs transition-all ${
                    selectedConnectionId === c.id
                      ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-slate-500" />
                    <div>
                      <span className="font-bold text-slate-900 block">
                        {c.display_name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {c.phone_number} &bull; WABA: {c.waba_id}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.connection_status === "connected"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {c.connection_status}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Sync Status Feedback */}
        {result && (
          <div
            className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
              result.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            {result.success ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Synchronization Succeeded
                </div>
                <p className="text-[11px] leading-relaxed">
                  Processed {result.count} Meta template(s): {result.added} added, {result.updated} updated. Local drafts were preserved.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Synchronization Failed
                </div>
                <p className="text-[11px] leading-relaxed">{result.error}</p>
                {result.requiresConnection && (
                  <div className="pt-1">
                    <Link
                      href={`/workspace/${businessSlug}/connections`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 font-semibold hover:bg-rose-100/50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Reconnect or Update Token in Settings
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || connections.length === 0}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {syncing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting to Meta...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Synchronize Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
