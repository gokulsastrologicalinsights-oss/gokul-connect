import {
  decryptSecret,
  EncryptedSecretPayload,
  encryptSecret,
  maskTokenForLogging,
} from "@/lib/crypto/encryption";
import { validateBusinessTenant } from "@/lib/auth/tenant-guard";
import { debugMetaToken } from "./oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MetaSocialPlatform } from "./types";

export interface SafeMetaSocialConnection {
  id: string;
  business_id: string;
  platform: MetaSocialPlatform;
  account_id: string;
  account_name: string;
  username?: string | null;
  page_id?: string | null;
  connection_status: "connected" | "disconnected" | "expired" | "error";
  is_enabled: boolean;
  token_status: "valid" | "expired" | "revoked" | "unknown";
  token_expires_at?: string | null;
  has_credential: boolean;
  credential_masked_hint: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SaveSocialConnectionInput {
  platform: MetaSocialPlatform;
  accountId: string;
  accountName: string;
  username?: string | null;
  pageId?: string | null;
  accessToken: string;
  metadata?: Record<string, unknown>;
}

export interface VerifyConnectionResult {
  success: boolean;
  connectionId: string;
  platform: MetaSocialPlatform;
  status: "connected" | "disconnected" | "expired" | "error";
  message: string;
  diagnostics: {
    accountIdValid: boolean;
    credentialsPresent: boolean;
    credentialsDecryptable: boolean;
    tokenValid?: boolean;
    tokenExpiresAt?: string | null;
    timestamp: string;
  };
}

// ============================================================================
// LOCAL DEVELOPMENT / TEST IN-MEMORY VAULT & STORE
// ============================================================================
interface InMemorySocialConnection {
  id: string;
  business_id: string;
  platform: MetaSocialPlatform;
  account_id: string;
  account_name: string;
  username?: string | null;
  page_id?: string | null;
  credential_ref: string;
  connection_status: "connected" | "disconnected" | "expired" | "error";
  is_enabled: boolean;
  token_status: "valid" | "expired" | "revoked" | "unknown";
  token_expires_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const memorySocialVault = new Map<string, EncryptedSecretPayload>();
const memorySocialConnections = new Map<string, InMemorySocialConnection>();

export function projectSafeConnection(
  conn: InMemorySocialConnection | any,
  hasCredentialOverride?: boolean
): SafeMetaSocialConnection {
  const hasCred =
    hasCredentialOverride !== undefined
      ? hasCredentialOverride
      : Boolean(conn.credential_ref && memorySocialVault.has(conn.credential_ref));

  return {
    id: conn.id,
    business_id: conn.business_id,
    platform: conn.platform,
    account_id: conn.account_id,
    account_name: conn.account_name,
    username: conn.username || null,
    page_id: conn.page_id || null,
    connection_status: conn.connection_status,
    is_enabled: conn.is_enabled,
    token_status: conn.token_status || (conn.connection_status === "connected" ? "valid" : "unknown"),
    token_expires_at: conn.token_expires_at || null,
    has_credential: Boolean(hasCred),
    credential_masked_hint: conn.credential_ref
      ? `Ref: ••••••••${conn.credential_ref.slice(-4)}`
      : "None",
    metadata: conn.metadata || {},
    created_at: conn.created_at,
    updated_at: conn.updated_at,
  };
}

// ----------------------------------------------------------------------------
// IN-MEMORY METHODS (Used for local mock development and unit tests)
// ----------------------------------------------------------------------------
export function getSocialConnectionsMemory(businessId: string): SafeMetaSocialConnection[] {
  validateBusinessTenant(businessId);
  const results: SafeMetaSocialConnection[] = [];
  for (const conn of memorySocialConnections.values()) {
    if (conn.business_id === businessId) {
      results.push(projectSafeConnection(conn));
    }
  }
  return results.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export function saveSocialConnectionMemory(
  businessId: string,
  params: SaveSocialConnectionInput
): SafeMetaSocialConnection {
  validateBusinessTenant(businessId);

  if (!params.accountId?.trim()) throw new Error("Account ID is required.");
  if (!params.accountName?.trim()) throw new Error("Account Name is required.");
  if (!params.accessToken?.trim()) throw new Error("Access Token is required.");

  if (params.platform === "instagram" && !params.pageId?.trim()) {
    throw new Error(
      "Connected Facebook Page ID (pageId) is strictly required for Instagram accounts to support Meta Private Replies."
    );
  }

  // Encrypt with AES-256-GCM
  const encrypted = encryptSecret(params.accessToken.trim());
  const connKey = `${businessId}_${params.platform}_${params.accountId.trim()}`;
  const existing = Array.from(memorySocialConnections.values()).find(
    (c) =>
      c.business_id === businessId &&
      c.platform === params.platform &&
      c.account_id === params.accountId.trim()
  );

  const connId = existing?.id || `meta_conn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const vaultRef = `vault:sec_social_${connId}`;

  // Store encrypted token in memory vault
  memorySocialVault.set(vaultRef, encrypted);

  const now = new Date().toISOString();
  const meta: Record<string, unknown> = {
    ...(existing?.metadata || {}),
    ...(params.metadata || {}),
    connected_at: existing?.metadata?.connected_at || now,
    last_verified_at: now,
  };

  const storedConn: InMemorySocialConnection = {
    id: connId,
    business_id: businessId,
    platform: params.platform,
    account_id: params.accountId.trim(),
    account_name: params.accountName.trim(),
    username: params.username?.trim() || null,
    page_id: params.pageId?.trim() || null,
    credential_ref: vaultRef,
    connection_status: "connected",
    is_enabled: true,
    token_status: "valid",
    token_expires_at: null,
    metadata: meta,
    created_at: existing?.created_at || now,
    updated_at: now,
  };

  memorySocialConnections.set(connId, storedConn);
  return projectSafeConnection(storedConn);
}

export function disconnectSocialAccountMemory(
  businessId: string,
  connectionId: string
): { success: boolean } {
  validateBusinessTenant(businessId);
  const conn = memorySocialConnections.get(connectionId);
  if (!conn) throw new Error("Social connection not found.");
  if (conn.business_id !== businessId) {
    throw new Error("Tenant mismatch: Connection does not belong to active business.");
  }

  // Delete credentials from vault
  if (conn.credential_ref) {
    memorySocialVault.delete(conn.credential_ref);
  }

  conn.connection_status = "disconnected";
  conn.is_enabled = false;
  conn.token_status = "revoked";
  conn.updated_at = new Date().toISOString();
  memorySocialConnections.set(connectionId, conn);

  return { success: true };
}

export async function verifySocialConnectionTokenMemory(
  businessId: string,
  connectionId: string
): Promise<VerifyConnectionResult> {
  validateBusinessTenant(businessId);
  const conn = memorySocialConnections.get(connectionId);
  const timestamp = new Date().toISOString();

  if (!conn || conn.business_id !== businessId) {
    return {
      success: false,
      connectionId,
      platform: "facebook",
      status: "error",
      message: "Connection not found for this business tenant.",
      diagnostics: {
        accountIdValid: false,
        credentialsPresent: false,
        credentialsDecryptable: false,
        timestamp,
      },
    };
  }

  const payload = memorySocialVault.get(conn.credential_ref);
  if (!payload) {
    conn.connection_status = "error";
    conn.token_status = "unknown";
    conn.updated_at = timestamp;
    return {
      success: false,
      connectionId: conn.id,
      platform: conn.platform,
      status: "error",
      message: "Credentials missing from encrypted vault.",
      diagnostics: {
        accountIdValid: true,
        credentialsPresent: false,
        credentialsDecryptable: false,
        timestamp,
      },
    };
  }

  let decryptedToken = "";
  try {
    decryptedToken = decryptSecret(payload);
  } catch {
    conn.connection_status = "error";
    conn.token_status = "unknown";
    conn.updated_at = timestamp;
    return {
      success: false,
      connectionId: conn.id,
      platform: conn.platform,
      status: "error",
      message: "Failed to decrypt credentials with master key.",
      diagnostics: {
        accountIdValid: true,
        credentialsPresent: true,
        credentialsDecryptable: false,
        timestamp,
      },
    };
  }

  // Call Meta debug endpoint
  const debug = await debugMetaToken({ inputToken: decryptedToken });
  if (!debug.isValid) {
    const isExpired = debug.error?.subcode === 463;
    const isRevoked = debug.error?.code === 190 || debug.error?.subcode === 467;
    const newStatus = isExpired ? "expired" : "error";
    const tokenStatus = isExpired ? "expired" : isRevoked ? "revoked" : "unknown";

    conn.connection_status = newStatus;
    conn.token_status = tokenStatus;
    conn.updated_at = timestamp;

    return {
      success: false,
      connectionId: conn.id,
      platform: conn.platform,
      status: newStatus,
      message: debug.error?.message || "Token is invalid or expired.",
      diagnostics: {
        accountIdValid: true,
        credentialsPresent: true,
        credentialsDecryptable: true,
        tokenValid: false,
        timestamp,
      },
    };
  }

  conn.connection_status = "connected";
  conn.token_status = "valid";
  conn.updated_at = timestamp;

  return {
    success: true,
    connectionId: conn.id,
    platform: conn.platform,
    status: "connected",
    message: "Meta token is valid and credentials decrypt successfully.",
    diagnostics: {
      accountIdValid: true,
      credentialsPresent: true,
      credentialsDecryptable: true,
      tokenValid: true,
      tokenExpiresAt: debug.expiresAt ? new Date(debug.expiresAt * 1000).toISOString() : null,
      timestamp,
    },
  };
}

// ----------------------------------------------------------------------------
// SUPABASE DATABASE METHODS (Migration 026 Compatible)
// ----------------------------------------------------------------------------
export async function getSocialConnectionsDb(
  businessId: string
): Promise<SafeMetaSocialConnection[]> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();

  // Query connections for tenant
  const { data: conns, error: connErr } = await supabase
    .from("meta_social_connections")
    .select("*, meta_social_credentials(id)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (connErr) {
    throw new Error(`Database error fetching social connections: ${connErr.message}`);
  }

  return (conns || []).map((c: any) => {
    const hasCred = Boolean(c.meta_social_credentials && c.meta_social_credentials.length > 0);
    const meta = c.metadata || {};
    return {
      id: c.id,
      business_id: c.business_id,
      platform: c.platform,
      account_id: c.account_id,
      account_name: c.account_name,
      username: c.username || null,
      page_id: c.page_id || null,
      connection_status: c.connection_status,
      is_enabled: c.is_enabled,
      token_status: meta.token_status || (c.connection_status === "connected" ? "valid" : "unknown"),
      token_expires_at: meta.token_expires_at || null,
      has_credential: hasCred,
      credential_masked_hint: c.credential_ref
        ? `Ref: ••••••••${c.credential_ref.slice(-4)}`
        : "None",
      metadata: meta,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  });
}

export async function saveSocialConnectionDb(
  businessId: string,
  params: SaveSocialConnectionInput
): Promise<SafeMetaSocialConnection> {
  validateBusinessTenant(businessId);

  if (!params.accountId?.trim()) throw new Error("Account ID is required.");
  if (!params.accountName?.trim()) throw new Error("Account Name is required.");
  if (!params.accessToken?.trim()) throw new Error("Access Token is required.");

  if (params.platform === "instagram" && !params.pageId?.trim()) {
    throw new Error(
      "Connected Facebook Page ID (pageId) is strictly required for Instagram accounts to support Meta Private Replies."
    );
  }

  const supabase = createAdminClient();

  // 1. Encrypt access token using AES-256-GCM
  const encrypted = encryptSecret(params.accessToken.trim());
  const credentialRef = `sec_social_${businessId.slice(0, 8)}_${Date.now()}`;
  const now = new Date().toISOString();

  const metaPayload: Record<string, unknown> = {
    ...(params.metadata || {}),
    connected_at: now,
    last_verified_at: now,
    token_status: "valid",
  };

  // 2. Upsert connection record with composite unique constraint (business_id, platform, account_id)
  const { data: conn, error: connErr } = await supabase
    .from("meta_social_connections")
    .upsert(
      {
        business_id: businessId,
        platform: params.platform,
        account_id: params.accountId.trim(),
        account_name: params.accountName.trim(),
        username: params.username?.trim() || null,
        page_id: params.pageId?.trim() || null,
        credential_ref: credentialRef,
        connection_status: "connected",
        is_enabled: true,
        metadata: metaPayload,
        updated_at: now,
      },
      { onConflict: "business_id,platform,account_id" }
    )
    .select("*")
    .single();

  if (connErr) {
    throw new Error(`Failed to save social connection in database: ${connErr.message}`);
  }

  // 3. Upsert encrypted secret in meta_social_credentials
  const { error: credErr } = await supabase.from("meta_social_credentials").upsert(
    {
      connection_id: conn.id,
      business_id: businessId,
      key_version: encrypted.key_version,
      iv: encrypted.iv,
      auth_tag: encrypted.auth_tag,
      ciphertext: encrypted.ciphertext,
      updated_at: now,
    },
    { onConflict: "connection_id" }
  );

  if (credErr) {
    throw new Error(`Failed to store encrypted credentials: ${credErr.message}`);
  }

  return {
    id: conn.id,
    business_id: conn.business_id,
    platform: conn.platform,
    account_id: conn.account_id,
    account_name: conn.account_name,
    username: conn.username || null,
    page_id: conn.page_id || null,
    connection_status: conn.connection_status,
    is_enabled: conn.is_enabled,
    token_status: "valid",
    token_expires_at: null,
    has_credential: true,
    credential_masked_hint: `Ref: ••••••••${credentialRef.slice(-4)}`,
    metadata: metaPayload,
    created_at: conn.created_at,
    updated_at: conn.updated_at,
  };
}

export async function disconnectSocialAccountDb(
  businessId: string,
  connectionId: string
): Promise<{ success: boolean }> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();

  // 1. Delete credentials
  await supabase
    .from("meta_social_credentials")
    .delete()
    .eq("connection_id", connectionId)
    .eq("business_id", businessId);

  // 2. Update status to disconnected
  const { error } = await supabase
    .from("meta_social_connections")
    .update({
      connection_status: "disconnected",
      is_enabled: false,
      metadata: { token_status: "revoked", disconnected_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(`Failed to disconnect social account: ${error.message}`);
  }

  return { success: true };
}

export async function verifySocialConnectionTokenDb(
  businessId: string,
  connectionId: string
): Promise<VerifyConnectionResult> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();
  const timestamp = new Date().toISOString();

  // Load connection and credential
  const { data: conn, error: connErr } = await supabase
    .from("meta_social_connections")
    .select("*, meta_social_credentials(*)")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .single();

  if (connErr || !conn) {
    return {
      success: false,
      connectionId,
      platform: "facebook",
      status: "error",
      message: "Connection not found for this tenant.",
      diagnostics: {
        accountIdValid: false,
        credentialsPresent: false,
        credentialsDecryptable: false,
        timestamp,
      },
    };
  }

  const credRow = Array.isArray(conn.meta_social_credentials)
    ? conn.meta_social_credentials[0]
    : conn.meta_social_credentials;

  if (!credRow) {
    await supabase
      .from("meta_social_connections")
      .update({ connection_status: "error", updated_at: timestamp })
      .eq("id", connectionId);

    return {
      success: false,
      connectionId: conn.id,
      platform: conn.platform,
      status: "error",
      message: "Missing credentials in database vault.",
      diagnostics: {
        accountIdValid: true,
        credentialsPresent: false,
        credentialsDecryptable: false,
        timestamp,
      },
    };
  }

  let decryptedToken = "";
  try {
    decryptedToken = decryptSecret({
      key_version: credRow.key_version,
      iv: credRow.iv,
      auth_tag: credRow.auth_tag,
      ciphertext: credRow.ciphertext,
    });
  } catch {
    await supabase
      .from("meta_social_connections")
      .update({ connection_status: "error", updated_at: timestamp })
      .eq("id", connectionId);

    return {
      success: false,
      connectionId: conn.id,
      platform: conn.platform,
      status: "error",
      message: "Failed to decrypt credentials with master key.",
      diagnostics: {
        accountIdValid: true,
        credentialsPresent: true,
        credentialsDecryptable: false,
        timestamp,
      },
    };
  }

  const debug = await debugMetaToken({ inputToken: decryptedToken });
  const isExpired = debug.error?.subcode === 463;
  const isRevoked = debug.error?.code === 190 || debug.error?.subcode === 467;
  const newStatus = debug.isValid ? "connected" : isExpired ? "expired" : "error";
  const tokenStatus = debug.isValid ? "valid" : isExpired ? "expired" : isRevoked ? "revoked" : "unknown";

  const metaUpdates = {
    ...(conn.metadata || {}),
    token_status: tokenStatus,
    last_verified_at: timestamp,
    token_expires_at: debug.expiresAt ? new Date(debug.expiresAt * 1000).toISOString() : null,
  };

  await supabase
    .from("meta_social_connections")
    .update({
      connection_status: newStatus,
      metadata: metaUpdates,
      updated_at: timestamp,
    })
    .eq("id", connectionId);

  return {
    success: debug.isValid,
    connectionId: conn.id,
    platform: conn.platform,
    status: newStatus,
    message: debug.isValid
      ? "Meta token is valid and active."
      : debug.error?.message || "Meta token has expired or permissions were revoked.",
    diagnostics: {
      accountIdValid: true,
      credentialsPresent: true,
      credentialsDecryptable: true,
      tokenValid: debug.isValid,
      tokenExpiresAt: debug.expiresAt ? new Date(debug.expiresAt * 1000).toISOString() : null,
      timestamp,
    },
  };
}

// Clear memory for testing
export function resetMemorySocialStore(): void {
  memorySocialVault.clear();
  memorySocialConnections.clear();
}

/**
 * Retrieve decrypted access token for server-side API execution (Memory store)
 */
export function getDecryptedAccessTokenMemory(businessId: string, connectionId: string): string | null {
  validateBusinessTenant(businessId);
  const conn = memorySocialConnections.get(connectionId);
  if (!conn || conn.business_id !== businessId) return null;
  const payload = memorySocialVault.get(conn.credential_ref);
  if (!payload) return null;
  try {
    return decryptSecret(payload);
  } catch {
    return null;
  }
}

/**
 * Retrieve decrypted access token for server-side API execution (Database store)
 */
export async function getDecryptedAccessTokenDb(businessId: string, connectionId: string): Promise<string | null> {
  validateBusinessTenant(businessId);
  const supabase = createAdminClient();
  const { data: credRow } = await supabase
    .from("meta_social_credentials")
    .select("key_version, iv, auth_tag, ciphertext, business_id")
    .eq("connection_id", connectionId)
    .eq("business_id", businessId)
    .single();

  if (!credRow || !credRow.ciphertext || !credRow.iv || !credRow.auth_tag) {
    return null;
  }
  try {
    return decryptSecret({
      key_version: credRow.key_version,
      iv: credRow.iv,
      auth_tag: credRow.auth_tag,
      ciphertext: credRow.ciphertext,
    });
  } catch {
    return null;
  }
}

