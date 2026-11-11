"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Clears all client-side cached data for the workspace to prevent cross-tenant data leakage.
 */
export function clearWorkspaceTenantCache(): void {
  const targetWindow = typeof window !== "undefined" ? window : (globalThis as any).window;
  if (targetWindow) {
    try {
      targetWindow.sessionStorage?.removeItem("active_workspace_cache");
      targetWindow.sessionStorage?.removeItem("active_conversation_id");
      targetWindow.sessionStorage?.removeItem("active_connections_cache");
      targetWindow.sessionStorage?.removeItem("active_business_settings");
      targetWindow.localStorage?.removeItem("last_opened_inbox_chat");
      targetWindow.localStorage?.removeItem("cached_connections");
    } catch {
      // Storage access error or private mode
    }
  }
}

interface SwitchBusinessButtonProps {
  currentBusinessName: string;
}

export function SwitchBusinessButton({ currentBusinessName }: SwitchBusinessButtonProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  function handleSwitchBusiness() {
    setSwitching(true);

    // Clear client-side workspace cache to prevent cross-tenant data leak
    clearWorkspaceTenantCache();

    // Force hard refresh & redirect to the Business Selection screen
    router.push("/select-business");
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSwitchBusiness}
      disabled={switching}
      className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm text-xs gap-1.5 font-medium transition-all"
      title={`Clear active workspace cache and exit ${currentBusinessName}`}
    >
      <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-600" />
      <span>{switching ? "Clearing Context..." : "Switch Business"}</span>
    </Button>
  );
}
