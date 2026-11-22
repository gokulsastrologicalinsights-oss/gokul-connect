import React from "react";
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Key,
  Calendar,
  Lock,
} from "lucide-react";
import Link from "next/link";
import type { SafeMetaSocialConnection } from "@/lib/meta-social/connections-store";

interface ChannelStatusSectionProps {
  businessSlug: string;
  connections: SafeMetaSocialConnection[];
}

export function ChannelStatusSection({
  businessSlug,
  connections,
}: ChannelStatusSectionProps) {
  const fbConn = connections.find(
    (c) => c.platform === "facebook" && c.connection_status === "connected"
  );
  const igConn = connections.find(
    (c) => c.platform === "instagram" && c.connection_status === "connected"
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Connected Social Channels
          </h2>
          <p className="text-sm text-slate-500">
            Facebook Pages and Instagram Professional Accounts authorized for automated replies.
          </p>
        </div>
        <Link
          href={`/workspace/${businessSlug}/connections/social`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          <span>Manage Social Connections</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Facebook Page Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                  f
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Facebook Page
                  </h3>
                  <span className="text-xs text-slate-500">
                    Post comments & Messenger DMs
                  </span>
                </div>
              </div>

              {fbConn ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Not Connected
                </span>
              )}
            </div>

            {fbConn ? (
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Page Name</span>
                  <span className="font-medium text-slate-900">{fbConn.account_name}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Page ID</span>
                  <span className="font-mono text-slate-700">{fbConn.account_id}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Credential Vault</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    AES-256-GCM Secured
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Token Status</span>
                  <span className="capitalize font-medium text-slate-700">
                    {fbConn.token_status || "Active"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-slate-500 mb-3">
                  No Facebook Page linked yet. Connect your page to enable automatic comment replies.
                </p>
                <Link
                  href={`/workspace/${businessSlug}/connections/social`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                >
                  Connect Facebook Page
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Instagram Account Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-pink-50 border border-pink-200 text-pink-600 flex items-center justify-center font-bold">
                  ig
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">
                    Instagram Professional
                  </h3>
                  <span className="text-xs text-slate-500">
                    Reels/Post Comments & Direct Messages
                  </span>
                </div>
              </div>

              {igConn ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Not Connected
                </span>
              )}
            </div>

            {igConn ? (
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Account Name</span>
                  <span className="font-medium text-slate-900">{igConn.account_name}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Username</span>
                  <span className="font-mono text-pink-700">
                    {igConn.username ? `@${igConn.username}` : "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Linked FB Page ID</span>
                  <span className="font-mono text-slate-700">
                    {igConn.page_id || "Missing (Required for Private Replies)"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Credential Vault</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    AES-256-GCM Secured
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-slate-500 mb-3">
                  No Instagram Professional account linked. Connect Instagram to enable DM & Reel replies.
                </p>
                <Link
                  href={`/workspace/${businessSlug}/connections/social`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-600 text-white hover:bg-pink-700 transition-colors"
                >
                  Connect Instagram
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
