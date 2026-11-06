"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare, ArrowLeft, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isConfigured) {
        const supabase = createClient();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
        });

        if (resetError) {
          setError(resetError.message);
          setLoading(false);
          return;
        }
      }

      setSubmitted(true);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || "Failed to submit password reset request.");
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Reset Password</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gokul Connect Security Access
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Password Recovery</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your authorized email to receive a password reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold">Reset Link Sent</p>
                    <p className="text-emerald-400/80 mt-1">
                      If an account exists for <span className="font-mono text-white">{email}</span>, a secure recovery email has been dispatched.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    Authorized Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="owner@gokulconnect.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white hover:bg-indigo-500 mt-2"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center border-t border-slate-900 pt-4">
            <Link
              href="/login"
              className="inline-flex items-center text-xs text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Return to Login
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
