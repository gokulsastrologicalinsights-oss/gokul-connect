"use client";

import React, { useState } from "react";
import { Business, UserProfile } from "@/types/database";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { X } from "lucide-react";

interface WorkspaceLayoutClientProps {
  business: Business;
  user: UserProfile;
  logoUrl?: string | null;
  children: React.ReactNode;
}

export function WorkspaceLayoutClient({
  business,
  user,
  logoUrl = null,
  children,
}: WorkspaceLayoutClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col overflow-x-hidden">
      {/* Workspace Header */}
      <WorkspaceHeader
        business={business}
        user={user}
        logoUrl={logoUrl}
        onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        isMobileMenuOpen={mobileMenuOpen}
      />

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop Sidebar (visible on md+) */}
        <div className="hidden md:flex">
          <WorkspaceSidebar slug={business.slug} businessName={business.name} />
        </div>

        {/* Mobile Slide-over Drawer (visible on small screens when open) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer */}
            <div className="relative flex w-72 max-w-[80vw] flex-1 flex-col bg-white shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <span className="font-bold text-sm text-slate-900">Navigation Menu</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto" onClick={() => setMobileMenuOpen(false)}>
                <WorkspaceSidebar slug={business.slug} businessName={business.name} />
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area: Full width on mobile, flexible on desktop */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
