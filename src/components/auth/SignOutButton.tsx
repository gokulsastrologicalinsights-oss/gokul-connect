"use client";

import React, { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { clearWorkspaceTenantCache } from "@/components/workspace/SwitchBusinessButton";

interface SignOutButtonProps {
  className?: string;
  variant?: "outline" | "default" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
}

export function SignOutButton({
  className = "border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white text-xs gap-1.5",
  variant = "outline",
  size = "sm",
  children,
}: SignOutButtonProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      // 1. Purge client-side tenant and workspace cache
      clearWorkspaceTenantCache();
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage?.clear();
          window.localStorage?.clear();
        } catch {
          // Storage access restricted
        }
      }

      // 2. Client-side Supabase sign-out
      const supabase = createClient();
      await supabase.auth.signOut();

      // 3. Trigger full server cookie clearing and hard redirect
      window.location.href = "/api/auth/signout";
    } catch (err) {
      console.error("Sign out error:", err);
      window.location.href = "/login";
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSignOut}
      disabled={signingOut}
      className={className}
      title="Securely sign out of Gokul Connect and invalidate session"
    >
      <LogOut className="h-3.5 w-3.5" />
      {children || (signingOut ? "Signing Out..." : "Sign Out")}
    </Button>
  );
}
