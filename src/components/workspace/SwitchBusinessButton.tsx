"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { clearWorkspaceTenantCache } from "@/lib/workspace/tenant-cache";

export { clearWorkspaceTenantCache };

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
