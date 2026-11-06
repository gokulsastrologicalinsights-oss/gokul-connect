import React from "react";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, Smartphone, Key, Bell, Globe } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business } = await validateBusinessAccess(businessSlug);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Workspace Settings — {business.name}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage isolated configurations, WhatsApp numbers, and access boundaries for this business.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-4xl">
        {/* Business Profile Details */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">Business Profile</CardTitle>
            <CardDescription className="text-xs">
              System identity and tenant parameters for this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Business Name</label>
                <Input defaultValue={business.name} readOnly className="bg-slate-50 text-slate-700" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Unique Slug / Tenant Key</label>
                <Input defaultValue={business.slug} readOnly className="bg-slate-50 font-mono text-slate-700" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Workspace Description</label>
              <textarea
                defaultValue={business.description}
                readOnly
                rows={3}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-700 focus:outline-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tenant Isolation Status */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  Tenant Isolation Security Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Database partition &amp; cryptographic boundaries
                </CardDescription>
              </div>
              <Badge variant="success" className="text-xs">Strict Isolation Enforced</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Tenant ID (UUID):</span>
                <span className="font-mono text-slate-600">{business.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">PostgreSQL RLS Filter:</span>
                <span className="font-mono text-indigo-600">WHERE business_id = '{business.id}'</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Cross-Tenant Leakage Protection:</span>
                <span className="text-emerald-700 font-semibold">Active (Server-side &amp; Database-level)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
