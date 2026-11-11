"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  removeBusinessLogoAction,
  updateBusinessSettingsAction,
  uploadBusinessLogoAction,
} from "@/app/actions/connections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Business, BusinessSettings, SafeWhatsAppConnection } from "@/types/database";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Globe,
  Image as ImageIcon,
  Key,
  Layers,
  Loader2,
  Phone,
  RefreshCw,
  Save,
  Shield,
  Smartphone,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const ALLOWED_LOGO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB

interface BusinessSettingsClientProps {
  business: Business;
  initialSettings: BusinessSettings;
  connections: SafeWhatsAppConnection[];
}

export function BusinessSettingsClient({
  business,
  initialSettings,
  connections,
}: BusinessSettingsClientProps) {
  const router = useRouter();
  const isAstrology = business.slug === "astrology";
  const brandColor = isAstrology ? "purple" : "rose";

  const [settings, setSettings] = useState<BusinessSettings>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoRenderError, setLogoRenderError] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const emitLogoSync = (logoUrl: string | null) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("workspace:logo-updated", {
          detail: { businessId: business.id, logoUrl },
        })
      );
    }
  };

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const mimeType = (file.type || "").toLowerCase();
    if (!ALLOWED_LOGO_TYPES.has(mimeType)) {
      setNotification({
        type: "error",
        message: "Unsupported logo format. Please select a PNG, SVG, JPEG, or WebP image.",
      });
      return;
    }

    if (file.size <= 0 || file.size > MAX_LOGO_SIZE) {
      setNotification({
        type: "error",
        message: "Logo file size must be between 1 byte and 2 MB.",
      });
      return;
    }

    setIsUploadingLogo(true);
    setNotification(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = String(reader.result || "");
        const base64Data = result.split(",")[1] || "";
        const res = await uploadBusinessLogoAction({
          businessSlug: business.slug,
          filename: file.name,
          mimeType,
          fileSize: file.size,
          base64Data,
        });

        if (res.success && res.logoUrl) {
          setLogoRenderError(false);
          setSettings((prev) => ({
            ...(res.data || prev),
            logo_url: res.logoUrl,
          }));
          emitLogoSync(res.logoUrl);
          router.refresh();
          setNotification({
            type: "success",
            message: `Business logo for "${business.name}" uploaded successfully.`,
          });
          setTimeout(() => setNotification(null), 4000);
        } else {
          setNotification({
            type: "error",
            message: res.error || "Failed to upload business logo.",
          });
        }
      } catch (err: any) {
        setNotification({
          type: "error",
          message: err?.message || "Unexpected error while uploading logo.",
        });
      } finally {
        setIsUploadingLogo(false);
      }
    };
    reader.onerror = () => {
      setIsUploadingLogo(false);
      setNotification({
        type: "error",
        message: "Failed to read the selected logo file.",
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleRemoveLogo() {
    if (isUploadingLogo) return;
    setIsUploadingLogo(true);
    setNotification(null);

    try {
      const res = await removeBusinessLogoAction(business.slug);
      if (res.success) {
        setLogoRenderError(false);
        setSettings((prev) => ({
          ...(res.data || prev),
          logo_url: null,
        }));
        emitLogoSync(null);
        router.refresh();
        setNotification({
          type: "success",
          message: "Custom logo removed. Reverted to monogram badge.",
        });
        setTimeout(() => setNotification(null), 4000);
      } else {
        setNotification({
          type: "error",
          message: res.error || "Failed to remove business logo.",
        });
      }
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err?.message || "Failed to remove business logo.",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setNotification(null);

    const { logo_url: _omitLogoUrl, ...settingsPayload } = settings;
    const res = await updateBusinessSettingsAction(business.slug, settingsPayload);
    setIsSaving(false);

    if (res.success && res.data) {
      setSettings(res.data);
      setNotification({
        type: "success",
        message: `Settings for "${business.name}" saved successfully.`,
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setNotification({
        type: "error",
        message: res.error || "Failed to update settings.",
      });
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Notification Toast */}
      {notification && (
        <div
          className={`flex items-center justify-between rounded-xl p-4 text-xs font-medium border shadow-sm transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Workspace Settings — {business.name}
          </h1>
          <Badge
            variant={isAstrology ? "astrology" : "vivaham"}
            className="text-[11px] font-semibold"
          >
            Tenant Isolated
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure business profile details, logo representation, notification rules, and default WhatsApp routing.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: BUSINESS INFORMATION & LOGO */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-600" />
              Business Profile &amp; Brand
            </CardTitle>
            <CardDescription className="text-xs">
              System display identity and brand assets scoped to this tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Brand Logo Upload & Monogram Fallback Section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80">
              {settings.logo_url && !logoRenderError ? (
                <div className="h-16 w-16 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center p-1">
                  <img
                    src={settings.logo_url}
                    alt={`${business.name} logo`}
                    onError={() => setLogoRenderError(true)}
                    className="h-full w-full object-contain rounded-xl"
                  />
                </div>
              ) : (
                <div
                  className={`h-16 w-16 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-md shrink-0 ${
                    isAstrology
                      ? "bg-gradient-to-tr from-purple-700 to-indigo-600"
                      : "bg-gradient-to-tr from-rose-600 to-pink-500"
                  }`}
                >
                  {settings.logo_placeholder || (isAstrology ? "GA" : "GV")}
                </div>
              )}

              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800">Business Brand Logo</span>
                  <Badge variant="outline" className="text-[10px] bg-white">
                    PNG / SVG / JPG / WebP (Max 2 MB)
                  </Badge>
                  {settings.logo_url && !logoRenderError && (
                    <Badge variant="success" className="text-[10px]">
                      Custom Logo Active
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Upload your custom brand image for the workspace header and business switcher, or customize the 1–3 letter monogram fallback.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input
                    ref={logoInputRef}
                    id="business-logo-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    className="h-8 text-xs gap-1.5 bg-white"
                  >
                    {isUploadingLogo ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5 text-indigo-600" />
                        <span>{settings.logo_url ? "Replace Logo" : "Upload Logo"}</span>
                      </>
                    )}
                  </Button>

                  {settings.logo_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUploadingLogo}
                      onClick={handleRemoveLogo}
                      className="h-8 text-xs gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remove Logo</span>
                    </Button>
                  )}

                  <div className="flex items-center gap-2 sm:ml-2 sm:pl-3 sm:border-l sm:border-slate-200">
                    <Input
                      maxLength={3}
                      placeholder="GA"
                      value={settings.logo_placeholder}
                      onChange={(e) => setSettings({ ...settings, logo_placeholder: e.target.value.toUpperCase() })}
                      aria-label="Fallback monogram letters"
                      className="w-16 h-8 text-xs text-center font-bold tracking-wider"
                    />
                    <span className="text-[11px] text-slate-400">Fallback monogram</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Business Display Name</label>
                <Input
                  required
                  value={settings.display_name}
                  onChange={(e) => setSettings({ ...settings, display_name: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Workspace Slug (Immutable)</label>
                <Input
                  readOnly
                  defaultValue={business.slug}
                  className="text-xs font-mono bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Business Information &amp; Description</label>
              <textarea
                rows={3}
                value={settings.business_info}
                onChange={(e) => setSettings({ ...settings, business_info: e.target.value })}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Summary of services, consultations, and department capabilities.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: REGIONAL & LOCALIZATION */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <Globe className="h-4 w-4 text-indigo-600" />
              Regional &amp; Localization Preferences
            </CardTitle>
            <CardDescription className="text-xs">
              Timezone for scheduling rules and primary conversational languages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Timezone */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST — UTC+05:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST — UTC+04:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT — UTC+08:00)</option>
                  <option value="Europe/London">Europe/London (GMT/BST — UTC+00:00)</option>
                  <option value="America/New_York">America/New_York (EST — UTC-05:00)</option>
                </select>
                <p className="text-[11px] text-slate-400">Used for service hours &amp; follow-up reminders.</p>
              </div>

              {/* Default Language */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Default Automation Language</label>
                <select
                  value={settings.default_language}
                  onChange={(e) => setSettings({ ...settings, default_language: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ta,en">Tamil &amp; English (Bilingual Auto-Detection)</option>
                  <option value="ta">Tamil Primary (தமிழ்)</option>
                  <option value="en">English Primary</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Automation rule parser prioritizes selected dialect matching.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: NOTIFICATION PREFERENCES */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-600" />
              Notification Preferences
            </CardTitle>
            <CardDescription className="text-xs">
              Operational alerts and status updates for workspace administrators.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-slate-800">Connection Drop Alerts</span>
                <p className="text-[11px] text-slate-500">
                  Notify immediately if Meta Cloud API connection fails or webhook stops responding.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notification_preferences.connection_drops}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notification_preferences: {
                      ...settings.notification_preferences,
                      connection_drops: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-slate-800">Unread Enquiry Warnings</span>
                <p className="text-[11px] text-slate-500">
                  Trigger an alert when a customer enquiry remains unaddressed beyond 15 minutes.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notification_preferences.unread_alerts}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notification_preferences: {
                      ...settings.notification_preferences,
                      unread_alerts: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-slate-800">Daily Activity Digest</span>
                <p className="text-[11px] text-slate-500">
                  Receive a morning briefing of conversations handled, bookings confirmed, and follow-ups queued.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notification_preferences.daily_digest}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    notification_preferences: {
                      ...settings.notification_preferences,
                      daily_digest: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </label>
          </CardContent>
        </Card>

        {/* SECTION 4: WHATSAPP CONNECTION PREFERENCES */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base text-slate-900 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-indigo-600" />
              WhatsApp Connection Preferences
            </CardTitle>
            <CardDescription className="text-xs">
              Default routing line, webhook retry strategy, and opt-out compliance terms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Default Connection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700">Default Outbound WhatsApp Number</label>
              <select
                value={settings.whatsapp_preferences.default_connection_id || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    whatsapp_preferences: {
                      ...settings.whatsapp_preferences,
                      default_connection_id: e.target.value,
                    },
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {connections.length === 0 ? (
                  <option value="">No WhatsApp numbers connected yet</option>
                ) : (
                  connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.display_name} ({conn.phone_number})
                    </option>
                  ))
                )}
              </select>
              <p className="text-[11px] text-slate-400">
                Line used by default for automated appointment confirmations and reminder follow-ups.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Webhook Retry Policy */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Webhook Retry Policy</label>
                <select
                  value={settings.whatsapp_preferences.webhook_retry_policy}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      whatsapp_preferences: {
                        ...settings.whatsapp_preferences,
                        webhook_retry_policy: e.target.value as any,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="standard">Standard (3 retries with exponential backoff)</option>
                  <option value="aggressive">Aggressive (5 retries, 10s intervals)</option>
                  <option value="relaxed">Relaxed (Single retry, immediate alert)</option>
                </select>
              </div>

              {/* Opt-out Keywords */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Opt-out Keywords (Comma Separated)</label>
                <Input
                  value={settings.whatsapp_preferences.opt_out_keywords}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      whatsapp_preferences: {
                        ...settings.whatsapp_preferences,
                        opt_out_keywords: e.target.value,
                      },
                    })
                  }
                  className="text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 5: TENANT ISOLATION SECURITY STATUS */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-600" />
                  Tenant Cryptographic Boundary Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Active database partition and server-side isolation verification
                </CardDescription>
              </div>
              <Badge variant="success" className="text-xs">
                Strict Isolation Enforced
              </Badge>
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

        {/* Save Changes Floating Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className={`text-xs gap-1.5 text-white font-medium shadow-sm ${
              isAstrology ? "bg-purple-600 hover:bg-purple-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Saving Preferences...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save Workspace Settings</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
