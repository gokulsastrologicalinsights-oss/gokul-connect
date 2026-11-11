import React from "react";
import Link from "next/link";
import {
  Sparkles,
  HeartHandshake,
  ArrowRight,
  ShieldAlert,
  LogOut,
  Radio,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { getAuthorizedBusinesses } from "@/lib/auth/tenant-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BusinessSelectionPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const mustChangePassword = Boolean(
      user.app_metadata?.must_change_password ??
      user.user_metadata?.must_change_password
    );

    if (mustChangePassword) {
      redirect("/update-password?mandatory=true");
    }
  }

  const businesses = await getAuthorizedBusinesses();
  const resolvedParams = searchParams ? await searchParams : undefined;
  const errorParam = resolvedParams?.error;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden">
      {/* Background grid accent */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 mx-auto w-full max-w-6xl flex items-center justify-between border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Gokul Connect
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Multi-Tenant v1.0
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Isolated Workspaces &amp; Automation Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SignOutButton />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 mx-auto w-full max-w-6xl my-auto py-12">
        {/* Security / Error Notice */}
        {errorParam && (
          <div className="mb-8 mx-auto max-w-2xl rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Tenant Boundary Access Denied</p>
              <p className="text-xs text-red-300/80 mt-1">
                {errorParam === "unauthorized_business_access"
                  ? "You do not have authorized membership credentials for the requested business workspace. Cross-tenant access is strictly blocked."
                  : "The requested business context was not found or has been deactivated."}
              </p>
            </div>
          </div>
        )}

        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Select Business Workspace
          </h2>
          <p className="mt-3 text-sm text-slate-400">
            Each business functions in complete isolation with its own WhatsApp numbers, CRM customers, automations, templates, and analytics.
          </p>
        </div>

        {/* The Two Business Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {businesses.map((business) => {
            const isAstrology = business.slug === "astrology";
            const borderHover = isAstrology
              ? "hover:border-purple-500/60 hover:shadow-purple-500/10"
              : "hover:border-rose-500/60 hover:shadow-rose-500/10";
            const accentBg = isAstrology ? "bg-purple-500/10" : "bg-rose-500/10";
            const accentText = isAstrology ? "text-purple-400" : "text-rose-400";
            const accentBorder = isAstrology ? "border-purple-500/20" : "border-rose-500/20";
            const enterBtnClass = isAstrology
              ? "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/40"
              : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40";

            return (
              <div
                key={business.id}
                className={`group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl transition-all duration-200 hover:-translate-y-1 ${borderHover}`}
              >
                <div>
                  {/* Business Icon & Status Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className={`h-16 w-16 rounded-2xl ${accentBg} border ${accentBorder} flex items-center justify-center ${accentText} shadow-inner`}
                    >
                      {isAstrology ? (
                        <Sparkles className="h-8 w-8" />
                      ) : (
                        <HeartHandshake className="h-8 w-8" />
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      {business.stats?.connectionStatus === "connected" ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {business.stats?.connectedNumbersCount ?? 1}{" "}
                          {(business.stats?.connectedNumbersCount ?? 1) === 1 ? "Number Connected" : "Numbers Connected"}
                        </span>
                      ) : business.stats?.connectionStatus === "setup_required" ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Setup Required
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full px-2.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                          Not Connected
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <span className="h-1 w-1 rounded-full bg-emerald-500 inline-block" />
                        Live DB Synced
                      </span>
                    </div>
                  </div>

                  {/* Business Title & Description */}
                  <h3 className="text-2xl font-bold tracking-tight text-white group-hover:text-slate-100">
                    {business.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed min-h-[4rem]">
                    {business.description}
                  </p>

                  {/* Business-Specific Quick Metrics */}
                  <div className="grid grid-cols-2 gap-3 my-6 pt-4 border-t border-slate-800">
                    <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                        <Radio className="h-3 w-3 text-slate-500" />
                        Unread Enquiries
                      </div>
                      <div className="text-2xl font-bold text-white mt-1">
                        {business.stats?.unreadEnquiriesCount ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Specific to {business.name}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800">
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        Pending Follow-ups
                      </div>
                      <div className="text-2xl font-bold text-white mt-1">
                        {business.stats?.pendingRepliesCount ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Active reminders
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enter Workspace Action */}
                <div className="pt-2">
                  <Link
                    href={`/workspace/${business.slug}/dashboard`}
                    className="block"
                  >
                    <Button
                      className={`w-full py-6 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] ${enterBtnClass}`}
                    >
                      <span>Enter Workspace</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 mx-auto w-full max-w-6xl border-t border-slate-800/80 pt-6 text-center text-xs text-slate-500">
        <p>
          Gokul Connect &bull; Strict Tenant Separation Enforced &bull; Zero AI Dependency &bull; Official Meta Cloud API
        </p>
      </div>
    </div>
  );
}
