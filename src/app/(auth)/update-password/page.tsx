"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, ArrowLeft, Lock, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { updatePasswordAction } from "@/app/actions/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

function UpdatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMandatory = searchParams.get("mandatory") === "true";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);

    try {
      // 1. Server Action: updates password and clears must_change_password via Admin API
      const result = await updatePasswordAction({ password });
      if (!result.success) {
        setError(result.error || "Failed to update password.");
        setLoading(false);
        return;
      }

      // 2. Synchronize client Supabase session
      if (isConfigured) {
        try {
          const supabase = createClient();
          await supabase.auth.updateUser({ password });
          await supabase.auth.refreshSession();
        } catch {
          // Server action is primary authority
        }
      }

      setSubmitted(true);
      setLoading(false);
      setTimeout(() => {
        router.push("/select-business");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to update password.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4">
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg mb-3">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isMandatory ? "Mandatory Password Setup" : "Set New Password"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gokul Connect Security Access
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">
              {isMandatory ? "Change Temporary Password" : "Update Password"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {isMandatory
                ? "First-time login detected. You must set a permanent password before accessing business workspaces."
                : "Enter and confirm your new secure password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isMandatory && !submitted && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-200">Action Required</p>
                  <p className="text-amber-200/80 mt-0.5">
                    Workspace access is restricted until you choose a new secure permanent password.
                  </p>
                </div>
              </div>
            )}

            {submitted ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">Password Successfully Updated</p>
                    <p className="text-emerald-400/80 mt-1">
                      Your permanent password has been set. Redirecting to workspace selection...
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                {error && (
                  <div role="alert" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="update-password-input" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    New Permanent Password
                  </label>
                  <Input
                    id="update-password-input"
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm-password-input" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    Confirm Permanent Password
                  </label>
                  <Input
                    id="confirm-password-input"
                    type="password"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white hover:bg-indigo-500 mt-2"
                >
                  {loading ? "Updating..." : "Save New Password & Continue"}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t border-slate-900 pt-4">
            {isMandatory ? (
              <SignOutButton
                variant="ghost"
                className="text-slate-400 hover:text-red-400 hover:bg-transparent text-xs"
              >
                Sign Out of Session
              </SignOutButton>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center text-xs text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Return to Login
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">
          Loading security verification...
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
