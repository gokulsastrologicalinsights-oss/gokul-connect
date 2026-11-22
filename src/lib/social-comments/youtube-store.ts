import {
  decryptSecret,
  EncryptedSecretPayload,
  encryptSecret,
} from "@/lib/crypto/encryption";
import { validateBusinessTenant } from "@/lib/auth/tenant-guard";
import { YouTubeChannelConnection } from "./types";

interface StoredYouTubeConnection {
  id: string;
  businessId: string;
  channelId: string;
  channelTitle: string;
  customUrl?: string;
  thumbnailUrl?: string;
  credentialRef: string;
  connectionStatus: "connected" | "disconnected" | "expired" | "error";
  isEnabled: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

// In-Memory store for development and test execution
const memoryYouTubeVault = new Map<string, EncryptedSecretPayload>();
const memoryYouTubeConnections = new Map<string, StoredYouTubeConnection>();

export function projectSafeYouTubeConnection(
  conn: StoredYouTubeConnection
): YouTubeChannelConnection {
  const hasCred = Boolean(conn.credentialRef && memoryYouTubeVault.has(conn.credentialRef));
  return {
    id: conn.id,
    businessId: conn.businessId,
    channelId: conn.channelId,
    channelTitle: conn.channelTitle,
    customUrl: conn.customUrl,
    thumbnailUrl: conn.thumbnailUrl,
    connectionStatus: conn.connectionStatus,
    isEnabled: conn.isEnabled,
    hasCredential: hasCred,
    credentialMaskedHint: conn.credentialRef
      ? `Vault: ••••••••${conn.credentialRef.slice(-4)}`
      : "None",
    lastSyncAt: conn.lastSyncAt,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
  };
}

export function getYouTubeConnections(businessId: string): YouTubeChannelConnection[] {
  validateBusinessTenant(businessId);
  const results: YouTubeChannelConnection[] = [];
  for (const conn of memoryYouTubeConnections.values()) {
    if (conn.businessId === businessId) {
      results.push(projectSafeYouTubeConnection(conn));
    }
  }
  return results;
}

export function saveYouTubeConnection(
  businessId: string,
  params: {
    channelId: string;
    channelTitle: string;
    customUrl?: string;
    thumbnailUrl?: string;
    accessToken: string;
    refreshToken?: string;
  }
): YouTubeChannelConnection {
  validateBusinessTenant(businessId);

  if (!params.channelId?.trim()) throw new Error("YouTube Channel ID is required.");
  if (!params.channelTitle?.trim()) throw new Error("YouTube Channel Title is required.");
  if (!params.accessToken?.trim()) throw new Error("YouTube Access Token is required.");

  // Encrypt with AES-256-GCM
  const tokenPayload = JSON.stringify({
    accessToken: params.accessToken.trim(),
    refreshToken: params.refreshToken?.trim() || null,
  });
  const encrypted = encryptSecret(tokenPayload);

  // Check existing
  const existing = Array.from(memoryYouTubeConnections.values()).find(
    (c) => c.businessId === businessId && c.channelId === params.channelId.trim()
  );

  const connId = existing?.id || `yt_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const vaultRef = `vault:sec_youtube_${connId}`;

  // Store in dedicated YouTube vault (separate from Meta)
  memoryYouTubeVault.set(vaultRef, encrypted);

  const now = new Date().toISOString();
  const stored: StoredYouTubeConnection = {
    id: connId,
    businessId,
    channelId: params.channelId.trim(),
    channelTitle: params.channelTitle.trim(),
    customUrl: params.customUrl?.trim() || undefined,
    thumbnailUrl: params.thumbnailUrl?.trim() || undefined,
    credentialRef: vaultRef,
    connectionStatus: "connected",
    isEnabled: true,
    lastSyncAt: now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  memoryYouTubeConnections.set(connId, stored);
  return projectSafeYouTubeConnection(stored);
}

export function disconnectYouTubeConnection(
  businessId: string,
  connectionId: string
): { success: boolean } {
  validateBusinessTenant(businessId);
  const conn = memoryYouTubeConnections.get(connectionId);
  if (!conn) throw new Error("YouTube connection not found.");
  if (conn.businessId !== businessId) {
    throw new Error("Tenant mismatch: YouTube connection does not belong to active business.");
  }

  if (conn.credentialRef) {
    memoryYouTubeVault.delete(conn.credentialRef);
  }

  conn.connectionStatus = "disconnected";
  conn.isEnabled = false;
  conn.updatedAt = new Date().toISOString();
  memoryYouTubeConnections.set(connectionId, conn);

  return { success: true };
}

export function getDecryptedYouTubeToken(
  businessId: string,
  connectionId: string
): { accessToken: string; refreshToken?: string } | null {
  validateBusinessTenant(businessId);
  const conn = memoryYouTubeConnections.get(connectionId);
  if (!conn || conn.businessId !== businessId) return null;

  const payload = memoryYouTubeVault.get(conn.credentialRef);
  if (!payload) return null;

  try {
    const raw = decryptSecret(payload);
    try {
      const parsed = JSON.parse(raw);
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken || undefined,
      };
    } catch {
      return { accessToken: raw };
    }
  } catch {
    return null;
  }
}

export function resetMemoryYouTubeStore(): void {
  memoryYouTubeVault.clear();
  memoryYouTubeConnections.clear();
}
