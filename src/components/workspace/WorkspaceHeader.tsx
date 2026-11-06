"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, HeartHandshake, ShieldCheck, User, Menu, X } from "lucide-react";
import { Business, UserProfile } from "@/types/database";
import { SwitchBusinessButton } from "./SwitchBusinessButton";
import { Badge } from "@/components/ui/badge";

interface WorkspaceHeaderProps {
  business: Business;
  user: UserProfile;
  onToggleMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export function WorkspaceHeader({
  business,
  user,
  onToggleMobileMenu,
  isMobileMenuOpen,
}: WorkspaceHeaderProps) {
  const isAstrology = business.slug === "astrology";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {/* Left: Mobile Menu Toggle & Active Business Indicator */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        )}

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isAstrology
              ? "bg-purple-100 text-purple-700 border border-purple-200"
              : "bg-rose-100 text-rose-700 border border-rose-200"
          }`}
        >
          {isAstrology ? (
            <Sparkles className="h-5 w-5" />
          ) : (
            <HeartHandshake className="h-5 w-5" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight line-clamp-1">
              {business.name}
            </span>
            <Badge
              variant={isAstrology ? "astrology" : "vivaham"}
              className="hidden sm:inline-flex text-[10px] uppercase font-semibold tracking-wider"
            >
              Workspace Active
            </Badge>
          </div>
          <p className="hidden sm:block text-xs text-slate-500">
            Isolated Database Scope: <span className="font-mono text-slate-700">{business.slug}</span>
          </p>
        </div>
      </div>

      {/* Right: Switch Business Action & User Indicator */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 border-r border-slate-200 pr-3">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-emerald-700 font-medium">Tenant Guard: Strict RLS</span>
        </div>

        {/* The prominent Switch Business button */}
        <SwitchBusinessButton currentBusinessName={business.name} />

        {/* User Pill */}
        <div className="flex items-center gap-2 pl-1">
          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden md:block text-left text-xs">
            <div className="font-medium text-slate-900 leading-tight">
              {user.full_name || "Owner"}
            </div>
            <div className="text-[11px] text-slate-400">Platform Owner</div>
          </div>
        </div>
      </div>
    </header>
  );
}
