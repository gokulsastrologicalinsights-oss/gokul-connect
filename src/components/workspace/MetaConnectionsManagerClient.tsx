"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  initiateMetaOAuthAction,
  getDiscoveredPagesAction,
  connectDiscoveredAccountAction,
  disconnectSocialConnectionAction,
  verifySocialConnectionAction,
  getSocialConnectionsAction,
} from "@/app/actions/meta-connections";
import {
  SafeMetaSocialConnection,
  VerifyConnectionResult,
} from "@/lib/meta-social/connections-store";
import { SanitizedDiscoveredPage } from "@/lib/meta-social/oauth";
import { Business } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Facebook,
  HelpCircle,
  Instagram,
  Layers,
  Lock,
  Power,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";

interface MetaConnectionsManagerClientProps {
  business: Business;
  initialConnections: SafeMetaSocialConnection[];
  initialSessionId?: string | null;
  initialError?: string | null;
}

export function MetaConnectionsManagerClient({
  business,
  initialConnections,
  initialSessionId,
  initialError,
}: MetaConnectionsManagerClientProps) {
  const router = useRouter();
  const isAstrology = business.slug === "astrology";
  const brandColor = isAstrology ? "purple" : "rose";

  const [connections, setConnections] =
    useState<SafeMetaSocialConnection[]>(initialConnections);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(
    initialError
      ? { type: "error", message: decodeURIComponent(initialError) }
      : null
  );

  // Discovery Modal State
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(
    Boolean(initialSessionId)
  );
  const [discoveredPages, setDiscoveredPages] = useState<SanitizedDiscoveredPage[]>(
    []
  );
  const [discoveryLoading, setDiscoveryLoading] = useState(
    Boolean(initialSessionId)
  );
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    initialSessionId || null
  );

  // Selected accounts to connect in modal
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [connectFbChecked, setConnectFbChecked] = useState(true);
  const [connectIgChecked, setConnectIgChecked] = useState(true);

  // Diagnostic modal state
  const [diagnosticResult, setDiagnosticResult] =
    useState<VerifyConnectionResult | null>(null);
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);

  // Disconnect confirmation modal
  const [disconnectTarget, setDisconnectTarget] =
    useState<SafeMetaSocialConnection | null>(null);

  // Loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isSubmittingConnection, setIsSubmittingConnection] = useState(false);

  // Fetch discovered pages when initialSessionId is provided
  useEffect(() => {
    if (initialSessionId) {
      loadDiscoveredPages(initialSessionId);
    }
  }, [initialSessionId]);

  async function loadDiscoveredPages(sessionId: string) {
    setDiscoveryLoading(true);
    const res = await getDiscoveredPagesAction(business.slug, sessionId);
    setDiscoveryLoading(false);

    if (res.success && res.data && res.data.length > 0) {
      setDiscoveredPages(res.data);
      setSelectedPageId(res.data[0].pageId);
      setIsDiscoveryModalOpen(true);
    } else {
      setNotification({
        type: "error",
        message: res.error || "No accessible Facebook Pages were found.",
      });
      setIsDiscoveryModalOpen(false);
    }
  }

  // Initiate OAuth flow
  async function handleStartOAuth() {
    setIsConnectingOAuth(true);
    setNotification(null);
    const res = await initiateMetaOAuthAction(business.slug);

    if (res.success && res.authorizationUrl) {
      window.location.href = res.authorizationUrl;
    } else {
      setIsConnectingOAuth(false);
      setNotification({
        type: "error",
        message: res.error || "Failed to start Meta OAuth flow.",
      });
    }
  }

  // Connect selected page/instagram from discovery modal
  async function handleConfirmConnection() {
    if (!currentSessionId || !selectedPageId) return;

    const page = discoveredPages.find((p) => p.pageId === selectedPageId);
    if (!page) return;

    setIsSubmittingConnection(true);
    const res = await connectDiscoveredAccountAction(business.slug, {
      sessionId: currentSessionId,
      pageId: selectedPageId,
      connectFacebook: connectFbChecked,
      connectInstagram: connectIgChecked && Boolean(page.instagramAccount?.isEligible),
    });
    setIsSubmittingConnection(false);

    if (res.success) {
      setIsDiscoveryModalOpen(false);
      setCurrentSessionId(null);
      // Clean query params
      router.replace(`/workspace/${business.slug}/connections/social`);

      // Refresh connections list
      const updated = await getSocialConnectionsAction(business.slug);
      if (updated.success && updated.data) {
        setConnections(updated.data);
      }

      setNotification({
        type: "success",
        message: "Meta accounts connected securely! Credentials encrypted with AES-256-GCM.",
      });
      setTimeout(() => setNotification(null), 5000);
    } else {
      setNotification({
        type: "error",
        message: res.error || "Failed to complete account connection.",
      });
    }
  }

  // Run token verification
  async function handleVerifyToken(conn: SafeMetaSocialConnection) {
    setActionLoadingId(conn.id);
    const res = await verifySocialConnectionAction(business.slug, conn.id);
    setActionLoadingId(null);

    if (res.success && res.result) {
      setDiagnosticResult(res.result);
      setIsDiagnosticModalOpen(true);
      // Refresh local state status
      setConnections((prev) =>
        prev.map((c) =>
          c.id === conn.id
            ? {
                ...c,
                connection_status: res.result!.status,
                token_status: res.result!.status === "connected" ? "valid" : "expired",
              }
            : c
        )
      );
    } else {
      setNotification({
        type: "error",
        message: res.error || "Verification failed.",
      });
    }
  }

  // Disconnect account
  async function handleConfirmDisconnect() {
    if (!disconnectTarget) return;

    setActionLoadingId(disconnectTarget.id);
    const res = await disconnectSocialConnectionAction(
      business.slug,
      disconnectTarget.id
    );
    setActionLoadingId(null);
    setDisconnectTarget(null);

    if (res.success) {
      setConnections((prev) =>
        prev.map((c) =>
          c.id === disconnectTarget.id
            ? {
                ...c,
                connection_status: "disconnected",
                is_enabled: false,
                token_status: "revoked",
                has_credential: false,
              }
            : c
        )
      );
      setNotification({
        type: "info",
        message: `Account "${disconnectTarget.account_name}" has been disconnected.`,
      });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setNotification({
        type: "error",
        message: res.error || "Failed to disconnect account.",
      });
    }
  }

  // Active status calculations
  const fbConnection = connections.find((c) => c.platform === "facebook");
  const igConnection = connections.find((c) => c.platform === "instagram");

  return (
    <div className="space-y-6 pb-12">
      {/* Navigation Tabs Header between WhatsApp & Meta Social */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Channel Connections
            </h1>
            <Badge
              variant={isAstrology ? "astrology" : "vivaham"}
              className="text-xs uppercase font-semibold"
            >
              {business.name}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage your official messaging and social engagement channels with strict tenant isolation.
          </p>
        </div>

        {/* Channel Tab Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
          <Link
            href={`/workspace/${business.slug}/connections`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-all"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>WhatsApp Cloud API</span>
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-white text-indigo-700 shadow-2xs">
            <Facebook className="h-3.5 w-3.5 text-blue-600" />
            <Instagram className="h-3.5 w-3.5 text-pink-600" />
            <span>Meta (Facebook & IG)</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 text-sm shadow-2xs transition-all ${
            notification.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : notification.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-sky-200 bg-sky-50 text-sky-800"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : notification.type === "error" ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-sky-600" />
          )}
          <div className="flex-1 font-medium">{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Meta Account Connection Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect your Facebook Page and linked Instagram Professional account using official Meta OAuth.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleStartOAuth}
            disabled={isConnectingOAuth}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-2xs text-xs font-semibold"
          >
            {isConnectingOAuth ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Facebook className="h-3.5 w-3.5" />
            )}
            <span>{isConnectingOAuth ? "Redirecting..." : "Connect with Meta"}</span>
          </Button>

          {discoveredPages.length > 0 && currentSessionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDiscoveryModalOpen(true)}
              className="text-xs gap-1.5"
            >
              <span>View Discovered ({discoveredPages.length})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Connection Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Facebook Page Card */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 border border-blue-200 text-blue-600">
                <Facebook className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Facebook Page
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Messenger DMs & Public Post Comments
                </CardDescription>
              </div>
            </div>

            {fbConnection && fbConnection.connection_status === "connected" ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : fbConnection && fbConnection.connection_status === "expired" ? (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold gap-1">
                <AlertTriangle className="h-3 w-3" /> Token Expired
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 text-[11px]">
                Not Connected
              </Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {fbConnection ? (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Page Name:</span>
                    <span className="font-semibold text-slate-900">
                      {fbConnection.account_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Page ID:</span>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">
                      {fbConnection.account_id}
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Connected On:</span>
                    <span className="text-slate-700">
                      {new Date(fbConnection.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Token Validity:</span>
                    <span
                      className={`font-semibold ${
                        fbConnection.token_status === "valid"
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {fbConnection.token_status === "valid" ? "Active (Valid)" : "Needs Reconnect"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Vault Storage:</span>
                    <span className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                      <Lock className="h-3 w-3 text-emerald-600" />
                      {fbConnection.credential_masked_hint} (AES-256-GCM)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoadingId === fbConnection.id}
                    onClick={() => handleVerifyToken(fbConnection)}
                    className="text-xs gap-1.5"
                  >
                    {actionLoadingId === fbConnection.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                    )}
                    <span>Verify Token</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartOAuth}
                      className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <span>Reconnect</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisconnectTarget(fbConnection)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Disconnect</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center space-y-3">
                <p className="text-xs text-slate-500">
                  No Facebook Page is currently connected to {business.name}.
                </p>
                <Button
                  size="sm"
                  onClick={handleStartOAuth}
                  disabled={isConnectingOAuth}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5"
                >
                  <Facebook className="h-3.5 w-3.5" />
                  <span>Connect Facebook Page</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instagram Professional Account Card */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-50 border border-pink-200 text-pink-600">
                <Instagram className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Instagram Professional
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Instagram Direct & Reel/Post Comments
                </CardDescription>
              </div>
            </div>

            {igConnection && igConnection.connection_status === "connected" ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : igConnection && igConnection.connection_status === "expired" ? (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-semibold gap-1">
                <AlertTriangle className="h-3 w-3" /> Token Expired
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 text-[11px]">
                Not Connected
              </Badge>
            )}
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {igConnection ? (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Handle:</span>
                    <span className="font-semibold text-slate-900">
                      @{igConnection.username || igConnection.account_name}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Instagram ID:</span>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">
                      {igConnection.account_id}
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Linked FB Page:</span>
                    <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-mono text-[11px]">
                      {igConnection.page_id || "None"}
                    </code>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Connected On:</span>
                    <span className="text-slate-700">
                      {new Date(igConnection.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Token Validity:</span>
                    <span
                      className={`font-semibold ${
                        igConnection.token_status === "valid"
                          ? "text-emerald-600"
                          : "text-amber-600"
                      }`}
                    >
                      {igConnection.token_status === "valid" ? "Active (Valid)" : "Needs Reconnect"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Vault Storage:</span>
                    <span className="text-slate-600 font-mono text-[11px] flex items-center gap-1">
                      <Lock className="h-3 w-3 text-emerald-600" />
                      {igConnection.credential_masked_hint} (AES-256-GCM)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoadingId === igConnection.id}
                    onClick={() => handleVerifyToken(igConnection)}
                    className="text-xs gap-1.5"
                  >
                    {actionLoadingId === igConnection.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                    )}
                    <span>Verify Token</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartOAuth}
                      className="text-xs text-pink-600 hover:text-pink-700 hover:bg-pink-50"
                    >
                      <span>Reconnect</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisconnectTarget(igConnection)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Disconnect</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center space-y-3">
                <p className="text-xs text-slate-500">
                  No Instagram Professional account is currently connected to {business.name}.
                </p>
                <Button
                  size="sm"
                  onClick={handleStartOAuth}
                  disabled={isConnectingOAuth}
                  className="bg-pink-600 hover:bg-pink-700 text-white text-xs gap-1.5"
                >
                  <Instagram className="h-3.5 w-3.5" />
                  <span>Connect Instagram</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Guidance Notice for Linking Instagram to Facebook Page */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-xs text-slate-700">
            <h3 className="font-semibold text-slate-900">
              Connecting Instagram Professional Accounts to Gokul Connect
            </h3>
            <p>
              Meta requires an Instagram account to be a <strong>Professional Account</strong> (Business or Creator) and linked to an authorized Facebook Page to use the official Instagram Graph API.
            </p>
            <ol className="list-decimal list-inside space-y-1 text-slate-600 pt-1">
              <li>Open <strong>Meta Business Suite</strong> or the Instagram mobile app settings.</li>
              <li>Ensure your account is converted to a <strong>Business</strong> or <strong>Creator</strong> profile.</li>
              <li>Under <em>Page Settings &gt; Linked Accounts &gt; Instagram</em>, connect your Instagram account.</li>
              <li>Return to Gokul Connect and click <strong>Connect with Meta</strong> to authorize permissions.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Discovered Pages Selection Modal */}
      {isDiscoveryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Select Facebook Page to Connect
                </h3>
                <p className="text-xs text-slate-500">
                  Meta OAuth authorized access to {discoveredPages.length} Facebook Page(s). Select which page and linked accounts to connect for {business.name}.
                </p>
              </div>
              <button
                onClick={() => setIsDiscoveryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {discoveryLoading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                <p className="text-xs text-slate-500">Loading accessible pages from Meta...</p>
              </div>
            ) : discoveredPages.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No Facebook Pages found. Make sure you are an administrator of the page in Meta Business Suite.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Page Selection Radio List */}
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {discoveredPages.map((page) => {
                    const isSelected = selectedPageId === page.pageId;
                    const ig = page.instagramAccount;

                    return (
                      <div
                        key={page.pageId}
                        onClick={() => setSelectedPageId(page.pageId)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/40 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-slate-900">
                                {page.pageName}
                              </span>
                              {page.category && (
                                <Badge variant="outline" className="text-[10px]">
                                  {page.category}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-mono">
                              Page ID: {page.pageId}
                            </p>
                          </div>

                          <div
                            className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? "border-indigo-600 bg-indigo-600"
                                : "border-slate-300"
                            }`}
                          >
                            {isSelected && (
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </div>
                        </div>

                        {/* Linked Instagram Info */}
                        <div className="mt-3 pt-3 border-t border-slate-100 text-xs">
                          {ig && ig.isEligible ? (
                            <div className="flex items-center justify-between text-emerald-800 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/60">
                              <div className="flex items-center gap-1.5">
                                <Instagram className="h-3.5 w-3.5 text-pink-600" />
                                <span className="font-medium">
                                  Linked Instagram: @{ig.username}
                                </span>
                              </div>
                              <Badge className="bg-emerald-100 text-emerald-800 border-none text-[10px]">
                                Eligible
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex items-start gap-1.5 text-amber-800 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200/60">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <span className="text-[11px] leading-tight">
                                No eligible Instagram Professional account linked to this Facebook Page.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Independent Selection Checkboxes */}
                {selectedPageId && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-semibold text-slate-900 block">
                      Choose Channels to Connect:
                    </span>
                    <div className="space-y-1.5 text-xs text-slate-700">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={connectFbChecked}
                          onChange={(e) => setConnectFbChecked(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Connect Facebook Page</span>
                      </label>

                      {(() => {
                        const page = discoveredPages.find(
                          (p) => p.pageId === selectedPageId
                        );
                        const igEligible = Boolean(page?.instagramAccount?.isEligible);
                        return (
                          <label
                            className={`flex items-center gap-2 ${
                              igEligible ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={connectIgChecked && igEligible}
                              disabled={!igEligible}
                              onChange={(e) => setConnectIgChecked(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                            />
                            <span>
                              Connect Instagram Professional Account
                              {!igEligible && " (Not Eligible / Not Linked)"}
                            </span>
                          </label>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDiscoveryModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  isSubmittingConnection ||
                  !selectedPageId ||
                  (!connectFbChecked && !connectIgChecked)
                }
                onClick={handleConfirmConnection}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 font-semibold"
              >
                {isSubmittingConnection ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>
                  {isSubmittingConnection ? "Saving Credentials..." : "Confirm & Connect"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Dialog */}
      {disconnectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50 border border-rose-200 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Disconnect {disconnectTarget.platform === "facebook" ? "Facebook Page" : "Instagram Account"}?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you sure you want to disconnect <strong>{disconnectTarget.account_name}</strong>? Encrypted access tokens will be removed from the server vault. Inbound comments and messages will no longer receive automated responses.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisconnectTarget(null)}
                className="text-xs"
              >
                Keep Connected
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDisconnect}
                disabled={actionLoadingId === disconnectTarget.id}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 font-semibold"
              >
                {actionLoadingId === disconnectTarget.id ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Power className="h-3.5 w-3.5" />
                )}
                <span>Disconnect</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Verification Result Modal */}
      {isDiagnosticModalOpen && diagnosticResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in-50 zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Connection Diagnostic Result
                </h3>
              </div>
              <button
                onClick={() => setIsDiagnosticModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div
                className={`p-3 rounded-lg border ${
                  diagnosticResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                <p className="font-semibold">{diagnosticResult.message}</p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Platform:</span>
                  <span className="font-semibold capitalize text-slate-900">
                    {diagnosticResult.platform}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vault Decryption:</span>
                  <span className="text-emerald-700 font-semibold">
                    {diagnosticResult.diagnostics.credentialsDecryptable ? "Passed (AES-256-GCM)" : "Failed"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Meta API Token Valid:</span>
                  <span
                    className={`font-semibold ${
                      diagnosticResult.diagnostics.tokenValid
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }`}
                  >
                    {diagnosticResult.diagnostics.tokenValid ? "Yes (Active)" : "No (Expired / Revoked)"}
                  </span>
                </div>
                {diagnosticResult.diagnostics.tokenExpiresAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expires At:</span>
                    <span className="text-slate-800">
                      {diagnosticResult.diagnostics.tokenExpiresAt}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Checked At:</span>
                  <span className="text-slate-700 font-mono text-[11px]">
                    {diagnosticResult.diagnostics.timestamp}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={() => setIsDiagnosticModalOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
