"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquare, ShieldCheck, ArrowRight, Lock, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isConfigured) {
        const supabase = createClient();
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }

        router.push("/select-business");
        router.refresh();
      } else {
        // Local standalone preview mode before dedicated Supabase credentials are plugged in
        setInfoMessage("Local Development Mode: Authenticated as Gokul Connect Owner.");
        setTimeout(() => {
          router.push("/select-business");
        }, 600);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during login.");
      setLoading(false);
    }
  }

  function handleQuickDemoLogin() {
    setEmail("owner@gokulconnect.com");
    setPassword("MasterOwnerSecret2026!");
    setInfoMessage("Local credentials applied. Entering Business Selection...");
    setTimeout(() => {
      router.push("/select-business");
    }, 500);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4">
      {/* Background Subtle Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3">
            <MessageSquare className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Gokul Connect</h1>
          <p className="mt-1 text-sm text-slate-400">
            Multi-Business WhatsApp Automation & CRM Platform
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800 bg-slate-950 text-slate-100 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-white">Sign in to your account</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your credentials to access your business workspaces.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {infoMessage && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{infoMessage}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  Email Address
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-slate-800 bg-slate-900 text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-indigo-500/20"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white hover:bg-indigo-500 mt-2"
              >
                {loading ? "Authenticating..." : "Sign In to Workspace"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-slate-900 pt-4">
            {!isConfigured && (
              <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <p className="font-semibold mb-1">Local Standalone Environment</p>
                <p className="text-amber-300/80 mb-2">
                  Ready for dedicated Supabase configuration. Use Quick Access to test the Business Selection screen and isolated workspaces now:
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleQuickDemoLogin}
                  className="w-full border-amber-500/40 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-xs"
                >
                  Quick Sign-in as Owner
                </Button>
              </div>
            )}

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span>Strict Multi-Tenant Database Isolation Active</span>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
