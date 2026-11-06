"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, LogOut, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SwitchBusinessButtonProps {
  currentBusinessName: string;
}

export function SwitchBusinessButton({ currentBusinessName }: SwitchBusinessButtonProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  function handleSwitchBusiness() {
    setSwitching(true);

    // Clear client-side workspace cache to prevent cross-tenant data leak
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("active_workspace_cache");
        sessionStorage.removeItem("active_conversation_id");
        localStorage.removeItem("last_opened_inbox_chat");
      } catch (err) {
        // Storage access error or non-browser env
      }
    }

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
      title="Clear active workspace cache and return to Business Selection"
    >
      <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-600" />
      <span>{switching ? "Clearing Context..." : "Switch Business"}</span>
    </Button>
  );
}
