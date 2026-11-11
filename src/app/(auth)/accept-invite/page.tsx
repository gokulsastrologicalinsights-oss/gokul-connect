"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowRight, UserPlus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { acceptInvitationAction, validateInvitationTokenAction } from "@/app/actions/team";
import { BusinessRole } from "@/types/database";

interface InvitationInfo {
  id: string;
  email: string;
  role: BusinessRole;
  business_id: string;
  business_name: string;
  business_slug: string;
  invited_by_name?: string | null;
  expires_at: string;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided. Please check the link from your invitation email.");
      setLoading(false);
      return;
    }

    validateInvitationTokenAction(token)
      .then((res: any) => {
        if (res.valid && res.invitation) {
          setInvitation(res.invitation as InvitationInfo);
        } else {
          setError(res.error || "Invalid or expired invitation token.");
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load invitation.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!invitation) return;

    setError(null);
    setSubmitting(true);

    try {
      let userId = `user-invited-${Date.now()}`;

      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          userId = sessionData.session.user.id;
        } else if (password) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: invitation.email,
            password: password,
            options: {
              data: {
                full_name: fullName.trim() || invitation.email.split("@")[0],
              },
            },
          });
          if (signUpError) {
            setError(signUpError.message);
            setSubmitting(false);
            return;
          }
          if (signUpData.user) {
            userId = signUpData.user.id;
          }
        }
      }

      const res = await acceptInvitationAction({
        token,
        user: {
          id: userId,
          email: invitation.email,
          fullName: fullName.trim() || undefined,
        },
      });

      if (!res.success) {
        setError(res.error || "Failed to accept invitation.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/workspace/${res.businessSlug || "astrology"}/dashboard`);
        router.refresh();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="w-full max-w-md shadow-xl border-slate-200">
        <CardContent className="pt-8 pb-8 text-center text-slate-600">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm font-medium">Verifying invitation token...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl border-slate-200">
      <CardHeader className="space-y-1 text-center">
        <div className="mx-auto w-12 h-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center mb-2">
          <UserPlus className="w-6 h-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
          {invitation ? `Join ${invitation.business_name}` : "Team Invitation"}
        </CardTitle>
        <CardDescription className="text-slate-600">
          {invitation ? (
            <span>
              {invitation.invited_by_name ? `Invited by ${invitation.invited_by_name} as ` : "Invited to join as "}
              <strong className="text-indigo-600 uppercase font-semibold">
                {invitation.role}
              </strong>
            </span>
          ) : (
            "Complete your onboarding to join the team"
          )}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {invitation && (
          <div className="mb-4 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex justify-between items-center">
            <span>Role: <strong className="uppercase text-slate-800">{invitation.role}</strong></span>
            <span>Expires: {new Date(invitation.expires_at).toLocaleDateString()}</span>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <span className="font-semibold text-base">Invitation Accepted!</span>
            <span className="text-xs text-emerald-700">Redirecting to your workspace...</span>
          </div>
        ) : invitation ? (
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Email Address
              </label>
              <Input
                type="email"
                value={invitation.email}
                disabled
                className="bg-slate-50 text-slate-500 cursor-not-allowed font-medium text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Full Name
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Priyan S"
                required
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set your account password"
                minLength={8}
                required
                className="text-sm"
              />
              <span className="text-[11px] text-slate-500">Must be at least 8 characters</span>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {submitting ? "Joining Team..." : "Accept & Join Workspace"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        ) : (
          <div className="text-center py-4">
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Return to Login
              </Button>
            </Link>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-center border-t border-slate-100 pt-4 pb-4">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Gokul Connect Multi-Tenant Security & Tenant Isolation</span>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Suspense
        fallback={
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        }
      >
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
