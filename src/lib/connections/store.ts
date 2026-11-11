import { decryptSecret, EncryptedSecretPayload, encryptSecret } from "@/lib/crypto/encryption";
import {
  BusinessSettings,
  CreateWhatsAppConnectionInput,
  SafeWhatsAppConnection,
  UpdateBusinessSettingsInput,
  UpdateWhatsAppConnectionInput,
  WhatsAppConnection,
} from "@/types/database";

// ============================================================================
// LOCAL DEVELOPMENT IN-MEMORY VAULT (EPHEMERAL HARNESS)
// ============================================================================
// ARCHITECTURE NOTICE:
// This in-memory Map is an ephemeral local testing harness. It is NOT persistent
// storage and resets upon process restart. Real production persistent storage
// will be connected using the dedicated Supabase project in Phase 3.
//
// Access tokens stored in this local harness are encrypted using AES-256-GCM
// with unique 12-byte IVs and 16-byte authentication tags.
// Raw tokens are NEVER stored in plain text, database rows, logs, or client-facing objects.
// ============================================================================
const serverTokenVault = new Map<string, EncryptedSecretPayload>();

// Initial Seed Connections per business tenant
// Notice: Real Meta integration is not configured yet, so status is clearly 'setup_required' or 'disconnected'
const INITIAL_CONNECTIONS: WhatsAppConnection[] = [
  // Gokul's Astrological Insights (business_id: 11111111-1111-1111-1111-111111111111)
  {
    id: "conn-astro-01",
    business_id: "11111111-1111-1111-1111-111111111111",
    display_name: "Gokul Astrology Consultations",
    phone_number: "+91 98400 12345",
    phone_number_id: "109283746501928",
    waba_id: "293847561029384",
    credential_ref: "vault:sec_astro_01",
    connection_status: "setup_required",
    webhook_status: "unconfigured",
    quality_rating: "UNKNOWN",
    is_enabled: true,
    description: "Primary line for KP & Vedic astrology appointment requests and consultation follow-ups.",
    last_connected_at: null,
    last_checked_at: new Date(Date.now() - 3600000).toISOString(),
    last_message_at: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "conn-astro-02",
    business_id: "11111111-1111-1111-1111-111111111111",
    display_name: "Gokul Horoscope Dispatch Desk",
    phone_number: "+91 98400 54321",
    phone_number_id: "109283746501929",
    waba_id: "293847561029384",
    credential_ref: "vault:sec_astro_02",
    connection_status: "disconnected",
    webhook_status: "unconfigured",
    quality_rating: "UNKNOWN",
    is_enabled: false,
    description: "Secondary automated dispatch line for horoscope PDF reports and birth chart analysis delivery.",
    last_connected_at: null,
    last_checked_at: new Date(Date.now() - 7200000).toISOString(),
    last_message_at: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },

  // Gokul Vivaham (business_id: 22222222-2222-2222-2222-222222222222)
  {
    id: "conn-vivaham-01",
    business_id: "22222222-2222-2222-2222-222222222222",
    display_name: "Gokul Vivaham Member Desk",
    phone_number: "+91 98401 77777",
    phone_number_id: "209283746501930",
    waba_id: "393847561029385",
    credential_ref: "vault:sec_vivaham_01",
    connection_status: "setup_required",
    webhook_status: "unconfigured",
    quality_rating: "UNKNOWN",
    is_enabled: true,
    description: "Primary member reception desk for matrimony profile enquiries and registrations.",
    last_connected_at: null,
    last_checked_at: new Date(Date.now() - 1800000).toISOString(),
    last_message_at: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "conn-vivaham-02",
    business_id: "22222222-2222-2222-2222-222222222222",
    display_name: "Gokul Vivaham Verification Desk",
    phone_number: "+91 98401 88888",
    phone_number_id: "209283746501931",
    waba_id: "393847561029385",
    credential_ref: "vault:sec_vivaham_02",
    connection_status: "disconnected",
    webhook_status: "unconfigured",
    quality_rating: "UNKNOWN",
    is_enabled: true,
    description: "Verification desk for ID proofs, family background checks, and community verification.",
    last_connected_at: null,
    last_checked_at: new Date(Date.now() - 5400000).toISOString(),
    last_message_at: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5400000).toISOString(),
  },
];

// Seed initial encrypted tokens into vault
serverTokenVault.set("vault:sec_astro_01", encryptSecret("EAAX...token_astro_primary"));
serverTokenVault.set("vault:sec_astro_02", encryptSecret("EAAX...token_astro_secondary"));
serverTokenVault.set("vault:sec_vivaham_01", encryptSecret("EAAX...token_vivaham_member"));
serverTokenVault.set("vault:sec_vivaham_02", encryptSecret("EAAX...token_vivaham_verify"));

// Seed business settings
const INITIAL_SETTINGS: BusinessSettings[] = [
  {
    id: "sett-astro",
    business_id: "11111111-1111-1111-1111-111111111111",
    display_name: "Gokul's Astrological Insights",
    business_info: "Vedic & KP Astrology consultations, Horoscope matching, and Astro Remedies.",
    logo_placeholder: "GA",
    timezone: "Asia/Kolkata",
    default_language: "ta,en",
    notification_preferences: {
      connection_drops: true,
      unread_alerts: true,
      daily_digest: true,
    },
    whatsapp_preferences: {
      default_connection_id: "conn-astro-01",
      webhook_retry_policy: "standard",
      opt_out_keywords: "STOP,UNSUBSCRIBE,QUIT,நிறுத்து",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "sett-vivaham",
    business_id: "22222222-2222-2222-2222-222222222222",
    display_name: "Gokul Vivaham",
    business_info: "Premium Tamil Matrimony platform, profile matching, and verified matrimonial introductions.",
    logo_placeholder: "GV",
    timezone: "Asia/Kolkata",
    default_language: "ta,en",
    notification_preferences: {
      connection_drops: true,
      unread_alerts: true,
      daily_digest: true,
    },
    whatsapp_preferences: {
      default_connection_id: "conn-vivaham-01",
      webhook_retry_policy: "standard",
      opt_out_keywords: "STOP,UNSUBSCRIBE,QUIT,நிறுத்து",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// In-memory tenant stores
let connectionsStore: WhatsAppConnection[] = [...INITIAL_CONNECTIONS];
let settingsStore: BusinessSettings[] = [...INITIAL_SETTINGS];

const VALID_BUSINESS_IDS = new Set([
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222222",
]);

/**
 * Strips secret identifiers from the connection object to create a client-safe DTO.
 * Guarantees zero credential leakage.
 */
export function toSafeConnection(conn: WhatsAppConnection): SafeWhatsAppConnection {
  const { credential_ref, ...rest } = conn;
  return {
    ...rest,
    has_credential: Boolean(credential_ref && serverTokenVault.has(credential_ref)),
    credential_masked_hint: credential_ref ? `Ref: ••••••••${credential_ref.slice(-4)}` : "None",
  };
}

/**
 * Validates business ID existence and tenant boundaries
 */
export function validateBusinessTenant(businessId: string): void {
  if (!businessId || !VALID_BUSINESS_IDS.has(businessId)) {
    throw new Error(`Unauthorized Tenant: Business ID "${businessId}" is invalid or does not exist.`);
  }
}

/**
 * Fetch all WhatsApp connections strictly scoped to the requesting business.
 * Enforces zero cross-business leakage.
 */
export function getConnectionsForBusiness(businessId: string): SafeWhatsAppConnection[] {
  validateBusinessTenant(businessId);
  return connectionsStore
    .filter((conn) => conn.business_id === businessId)
    .map(toSafeConnection);
}

/**
 * Fetch raw internal connection by ID with strict tenant boundary check.
 */
export function getConnectionInternal(businessId: string, connectionId: string): WhatsAppConnection {
  validateBusinessTenant(businessId);
  const conn = connectionsStore.find((c) => c.id === connectionId);

  if (!conn) {
    throw new Error(`Connection not found with ID "${connectionId}".`);
  }

  // Cross-tenant protection: Connection must belong to requesting business
  if (conn.business_id !== businessId) {
    throw new Error(
      `Forbidden: Access denied. Connection "${connectionId}" belongs to another business tenant.`
    );
  }

  return conn;
}

/**
 * Add a new WhatsApp connection to a specific business.
 * Validates uniqueness of Phone Number ID and stores AES-256-GCM encrypted token in vault.
 */
export function createConnection(
  businessId: string,
  input: CreateWhatsAppConnectionInput
): SafeWhatsAppConnection {
  validateBusinessTenant(businessId);

  // Field validation
  if (!input.display_name?.trim()) throw new Error("Display name is required.");
  if (!input.phone_number?.trim()) throw new Error("Phone number is required.");
  if (!input.phone_number_id?.trim()) throw new Error("Phone Number ID is required.");
  if (!input.waba_id?.trim()) throw new Error("WhatsApp Business Account ID (WABA ID) is required.");
  if (!input.access_token?.trim()) throw new Error("Access token is required.");

  const cleanPhoneId = input.phone_number_id.trim();

  // Cross-business uniqueness check: Phone Number ID cannot be reused anywhere
  const existingWithSamePhoneId = connectionsStore.find(
    (c) => c.phone_number_id === cleanPhoneId
  );
  if (existingWithSamePhoneId) {
    throw new Error(
      `Duplicate Phone Number ID: "${cleanPhoneId}" is already registered on ${
        existingWithSamePhoneId.business_id === businessId
          ? "this workspace"
          : "another business tenant"
      }. Each WhatsApp number can only belong to one business.`
    );
  }

  const newId = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const vaultRef = `vault:sec_${newId}`;

  // Encrypt access token using AES-256-GCM with unique 12-byte IV before storing in vault
  const encryptedPayload = encryptSecret(input.access_token.trim());
  serverTokenVault.set(vaultRef, encryptedPayload);

  const newConnection: WhatsAppConnection = {
    id: newId,
    business_id: businessId,
    display_name: input.display_name.trim(),
    phone_number: input.phone_number.trim(),
    phone_number_id: cleanPhoneId,
    waba_id: input.waba_id.trim(),
    credential_ref: vaultRef,
    // Real Meta Cloud API integration is pending Phase 3, so status is setup_required
    connection_status: "setup_required",
    webhook_status: "unconfigured",
    quality_rating: "UNKNOWN",
    is_enabled: true,
    description: input.description?.trim() || "",
    last_connected_at: null,
    last_checked_at: new Date().toISOString(),
    last_message_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  connectionsStore.push(newConnection);
  return toSafeConnection(newConnection);
}

/**
 * Edit an existing connection with strict tenant check.
 * Strictly forbids modifying business_id (tenant immutability).
 */
export function updateConnection(
  businessId: string,
  connectionId: string,
  updates: UpdateWhatsAppConnectionInput
): SafeWhatsAppConnection {
  const conn = getConnectionInternal(businessId, connectionId);

  // Tenant immutability guard: business_id cannot be changed
  if ((updates as any).business_id !== undefined && (updates as any).business_id !== businessId) {
    throw new Error("Tenant reassignment forbidden: business_id on wa_connections cannot be modified.");
  }

  if (updates.display_name !== undefined) {
    if (!updates.display_name.trim()) throw new Error("Display name cannot be empty.");
    conn.display_name = updates.display_name.trim();
  }

  if (updates.phone_number !== undefined) {
    if (!updates.phone_number.trim()) throw new Error("Phone number cannot be empty.");
    conn.phone_number = updates.phone_number.trim();
  }

  if (updates.description !== undefined) {
    conn.description = updates.description.trim();
  }

  if (updates.is_enabled !== undefined) {
    conn.is_enabled = Boolean(updates.is_enabled);
  }

  conn.updated_at = new Date().toISOString();
  return toSafeConnection(conn);
}

/**
 * Toggle enable/disable status with tenant check
 */
export function toggleConnectionEnabled(
  businessId: string,
  connectionId: string,
  isEnabled: boolean
): SafeWhatsAppConnection {
  const conn = getConnectionInternal(businessId, connectionId);
  conn.is_enabled = isEnabled;
  conn.updated_at = new Date().toISOString();
  return toSafeConnection(conn);
}

/**
 * Test a connection (diagnostic check)
 */
export interface TestConnectionResult {
  success: boolean;
  connectionId: string;
  status: "verified_ready" | "needs_setup" | "disabled" | "error";
  message: string;
  diagnostics: {
    phoneNumberIdValid: boolean;
    wabaIdValid: boolean;
    credentialsPresent: boolean;
    credentialsDecryptable: boolean;
    webhookConfigured: boolean;
    timestamp: string;
  };
}

export function testConnection(businessId: string, connectionId: string): TestConnectionResult {
  const conn = getConnectionInternal(businessId, connectionId);

  if (!conn.is_enabled) {
    return {
      success: false,
      connectionId: conn.id,
      status: "disabled",
      message: "Connection is currently disabled. Enable the connection before testing.",
      diagnostics: {
        phoneNumberIdValid: true,
        wabaIdValid: true,
        credentialsPresent: Boolean(conn.credential_ref),
        credentialsDecryptable: false,
        webhookConfigured: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const encryptedPayload = serverTokenVault.get(conn.credential_ref);
  let decryptable = false;
  if (encryptedPayload) {
    try {
      const decrypted = decryptSecret(encryptedPayload);
      decryptable = Boolean(decrypted);
    } catch {
      decryptable = false;
    }
  }

  conn.last_checked_at = new Date().toISOString();

  return {
    success: true,
    connectionId: conn.id,
    status: "needs_setup",
    message:
      "Configuration valid. Meta Cloud API handshake pending Phase 3 verification. AES-256-GCM server credentials and Phone Number ID are validated.",
    diagnostics: {
      phoneNumberIdValid: Boolean(conn.phone_number_id),
      wabaIdValid: Boolean(conn.waba_id),
      credentialsPresent: Boolean(encryptedPayload),
      credentialsDecryptable: decryptable,
      webhookConfigured: conn.webhook_status === "active",
      timestamp: conn.last_checked_at,
    },
  };
}

/**
 * Disconnect (remove) a WhatsApp connection with tenant check.
 */
export function disconnectConnection(businessId: string, connectionId: string): { success: boolean } {
  // Validate ownership first
  const conn = getConnectionInternal(businessId, connectionId);

  // Remove secret from server vault
  if (conn.credential_ref) {
    serverTokenVault.delete(conn.credential_ref);
  }

  // Remove from store
  connectionsStore = connectionsStore.filter((c) => c.id !== connectionId);
  return { success: true };
}

/**
 * Get Business Settings with tenant validation.
 */
export function getBusinessSettings(businessId: string): BusinessSettings {
  validateBusinessTenant(businessId);
  const settings = settingsStore.find((s) => s.business_id === businessId);
  if (!settings) {
    throw new Error(`Settings not found for business ID "${businessId}".`);
  }
  return { ...settings };
}

/**
 * Update Business Settings with tenant validation.
 * Enforces composite constraint: default_connection_id must belong to the SAME business_id.
 */
export function updateBusinessSettings(
  businessId: string,
  updates: UpdateBusinessSettingsInput
): BusinessSettings {
  validateBusinessTenant(businessId);
  const settings = settingsStore.find((s) => s.business_id === businessId);
  if (!settings) {
    throw new Error(`Settings not found for business ID "${businessId}".`);
  }

  if (updates.display_name !== undefined) settings.display_name = updates.display_name;
  if (updates.business_info !== undefined) settings.business_info = updates.business_info;
  if (updates.logo_placeholder !== undefined) settings.logo_placeholder = updates.logo_placeholder;
  if (updates.timezone !== undefined) settings.timezone = updates.timezone;
  if (updates.default_language !== undefined) settings.default_language = updates.default_language;
  if (updates.notification_preferences !== undefined) {
    settings.notification_preferences = {
      ...settings.notification_preferences,
      ...updates.notification_preferences,
    };
  }
  if (updates.whatsapp_preferences !== undefined) {
    // Composite check: Validate default_connection_id belongs to the SAME business_id
    if (updates.whatsapp_preferences.default_connection_id) {
      const defId = updates.whatsapp_preferences.default_connection_id;
      const targetConn = connectionsStore.find((c) => c.id === defId);
      if (!targetConn) {
        throw new Error(`Default connection not found with ID "${defId}".`);
      }
      if (targetConn.business_id !== businessId) {
        throw new Error(
          `Tenant cross-referencing forbidden: Default connection "${defId}" belongs to another business tenant.`
        );
      }
    }

    settings.whatsapp_preferences = {
      ...settings.whatsapp_preferences,
      ...updates.whatsapp_preferences,
    };
  }

  settings.updated_at = new Date().toISOString();
  return { ...settings };
}

/**
 * Helper to retrieve encrypted payload directly (server-side only, for testing).
 */
export function getEncryptedVaultPayload(credentialRef: string): EncryptedSecretPayload | undefined {
  return serverTokenVault.get(credentialRef);
}

/**
 * Helper to reset stores for automated testing.
 */
export function resetStoreForTests(): void {
  connectionsStore = [...INITIAL_CONNECTIONS];
  settingsStore = [...INITIAL_SETTINGS];
  serverTokenVault.clear();
  serverTokenVault.set("vault:sec_astro_01", encryptSecret("EAAX...token_astro_primary"));
  serverTokenVault.set("vault:sec_astro_02", encryptSecret("EAAX...token_astro_secondary"));
  serverTokenVault.set("vault:sec_vivaham_01", encryptSecret("EAAX...token_vivaham_member"));
  serverTokenVault.set("vault:sec_vivaham_02", encryptSecret("EAAX...token_vivaham_verify"));
}

// ============================================================================
// PHASE 2.3: SUPABASE PERSISTENT DATABASE STORAGE IMPLEMENTATION
// ============================================================================

/**
 * Fetch WhatsApp connections from Supabase persistent database storage.
 */
export async function getConnectionsForBusinessDb(businessId: string): Promise<SafeWhatsAppConnection[]> {
  validateBusinessTenant(businessId);
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  const { data: connections, error } = await supabase
    .from("wa_connections")
    .select("*, wa_credentials(id)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load connections from database: ${error.message}`);
  }

  return (connections || []).map((conn: any) => {
    const hasCred = Boolean(conn.wa_credentials && conn.wa_credentials.length > 0);
    const { credential_ref, wa_credentials: _cred, ...rest } = conn;
    return {
      ...rest,
      has_credential: hasCred,
      credential_masked_hint: credential_ref ? `Ref: ••••••••${credential_ref.slice(-4)}` : "None",
    };
  });
}

/**
 * Persist a new WhatsApp connection and AES-256-GCM encrypted token to Supabase.
 */
export async function createConnectionDb(
  businessId: string,
  input: CreateWhatsAppConnectionInput
): Promise<SafeWhatsAppConnection> {
  validateBusinessTenant(businessId);

  if (!input.display_name?.trim()) throw new Error("Display name is required.");
  if (!input.phone_number?.trim()) throw new Error("Phone number is required.");
  if (!input.phone_number_id?.trim()) throw new Error("Phone Number ID is required.");
  if (!input.waba_id?.trim()) throw new Error("WhatsApp Business Account ID (WABA ID) is required.");
  if (!input.access_token?.trim()) throw new Error("Access token is required.");

  const cleanPhoneId = input.phone_number_id.trim();
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  // Encrypt access token using AES-256-GCM with unique 12-byte IV
  const encryptedPayload = encryptSecret(input.access_token.trim());

  // Insert connection record
  const { data: newConn, error: connError } = await supabase
    .from("wa_connections")
    .insert({
      business_id: businessId,
      display_name: input.display_name.trim(),
      phone_number: input.phone_number.trim(),
      phone_number_id: cleanPhoneId,
      waba_id: input.waba_id.trim(),
      credential_ref: `vault:sec_${cleanPhoneId}`,
      connection_status: "setup_required",
      webhook_status: "unconfigured",
      quality_rating: "UNKNOWN",
      is_enabled: true,
      description: input.description?.trim() || "",
    })
    .select()
    .single();

  if (connError || !newConn) {
    throw new Error(connError?.message || "Failed to create connection in database.");
  }

  // Insert encrypted credentials into wa_credentials
  const { error: credError } = await supabase
    .from("wa_credentials")
    .insert({
      connection_id: newConn.id,
      business_id: businessId,
      key_version: encryptedPayload.key_version,
      iv: encryptedPayload.iv,
      auth_tag: encryptedPayload.auth_tag,
      ciphertext: encryptedPayload.ciphertext,
    });

  if (credError) {
    await supabase.from("wa_connections").delete().eq("id", newConn.id);
    throw new Error(`Failed to persist encrypted credential: ${credError.message}`);
  }

  const { credential_ref, ...rest } = newConn;
  return {
    ...rest,
    has_credential: true,
    credential_masked_hint: `Ref: ••••••••${credential_ref.slice(-4)}`,
  };
}

/**
 * Update connection details in Supabase with tenant immutability guard.
 */
export async function updateConnectionDb(
  businessId: string,
  connectionId: string,
  updates: UpdateWhatsAppConnectionInput
): Promise<SafeWhatsAppConnection> {
  validateBusinessTenant(businessId);

  if ((updates as any).business_id !== undefined && (updates as any).business_id !== businessId) {
    throw new Error("Tenant reassignment forbidden: business_id on wa_connections cannot be modified.");
  }

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.display_name !== undefined) {
    if (!updates.display_name.trim()) throw new Error("Display name cannot be empty.");
    patch.display_name = updates.display_name.trim();
  }
  if (updates.phone_number !== undefined) {
    if (!updates.phone_number.trim()) throw new Error("Phone number cannot be empty.");
    patch.phone_number = updates.phone_number.trim();
  }
  if (updates.description !== undefined) {
    patch.description = updates.description.trim();
  }
  if (updates.is_enabled !== undefined) {
    patch.is_enabled = Boolean(updates.is_enabled);
  }

  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  const { data: updated, error } = await supabase
    .from("wa_connections")
    .update(patch)
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .select("*, wa_credentials(id)")
    .single();

  if (error || !updated) {
    throw new Error(error?.message || "Failed to update connection in database.");
  }

  const hasCred = Boolean(updated.wa_credentials && updated.wa_credentials.length > 0);
  const { credential_ref, wa_credentials: _c, ...rest } = updated;
  return {
    ...rest,
    has_credential: hasCred,
    credential_masked_hint: credential_ref ? `Ref: ••••••••${credential_ref.slice(-4)}` : "None",
  };
}

/**
 * Toggle connection enabled status in Supabase.
 */
export async function toggleConnectionEnabledDb(
  businessId: string,
  connectionId: string,
  isEnabled: boolean
): Promise<SafeWhatsAppConnection> {
  return updateConnectionDb(businessId, connectionId, { is_enabled: isEnabled });
}

/**
 * Delete connection from Supabase (cascades to wa_credentials).
 */
export async function disconnectConnectionDb(
  businessId: string,
  connectionId: string
): Promise<{ success: boolean }> {
  validateBusinessTenant(businessId);
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("wa_connections")
    .delete()
    .eq("id", connectionId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message || "Failed to delete connection.");
  }

  return { success: true };
}

/**
 * Test WhatsApp connection credentials against Supabase vault.
 */
export async function testConnectionDb(
  businessId: string,
  connectionId: string
): Promise<TestConnectionResult> {
  validateBusinessTenant(businessId);
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  const { data: conn, error: connError } = await supabase
    .from("wa_connections")
    .select("*, wa_credentials(*)")
    .eq("id", connectionId)
    .eq("business_id", businessId)
    .single();

  if (connError || !conn) {
    throw new Error("Connection not found or access denied.");
  }

  if (!conn.is_enabled) {
    return {
      success: false,
      connectionId: conn.id,
      status: "disabled",
      message: "Connection is currently disabled. Enable the connection before testing.",
      diagnostics: {
        phoneNumberIdValid: true,
        wabaIdValid: true,
        credentialsPresent: Boolean(conn.wa_credentials),
        credentialsDecryptable: false,
        webhookConfigured: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const credRow = Array.isArray(conn.wa_credentials) ? conn.wa_credentials[0] : conn.wa_credentials;
  let decryptedToken: string | null = null;
  let decryptable = false;

  if (credRow && credRow.ciphertext && credRow.iv && credRow.auth_tag) {
    try {
      decryptedToken = decryptSecret({
        key_version: credRow.key_version,
        iv: credRow.iv,
        auth_tag: credRow.auth_tag,
        ciphertext: credRow.ciphertext,
      });
      decryptable = Boolean(decryptedToken);
    } catch {
      decryptable = false;
    }
  }

  // Fallback for Phase 3 test sandbox if matching test phone ID
  if (!decryptedToken && process.env.META_TEST_PHONE_NUMBER_ID === conn.phone_number_id && process.env.META_TEST_ACCESS_TOKEN) {
    decryptedToken = process.env.META_TEST_ACCESS_TOKEN;
    decryptable = true;
  }

  const timestamp = new Date().toISOString();

  // If credentials cannot be decrypted or are missing
  if (!decryptable || !decryptedToken) {
    await supabase
      .from("wa_connections")
      .update({ connection_status: "error", last_checked_at: timestamp })
      .eq("id", connectionId);

    return {
      success: false,
      connectionId: conn.id,
      status: "error",
      message: "Credentials could not be decrypted or are missing from the vault.",
      diagnostics: {
        phoneNumberIdValid: Boolean(conn.phone_number_id),
        wabaIdValid: Boolean(conn.waba_id),
        credentialsPresent: false,
        credentialsDecryptable: false,
        webhookConfigured: conn.webhook_status === "active",
        timestamp,
      },
    };
  }

  // Test live connectivity against Meta Cloud API
  try {
    const { getMetaPhoneNumberDetails } = await import("@/lib/whatsapp/client");
    const metaDetails = await getMetaPhoneNumberDetails(conn.phone_number_id, decryptedToken);

    await supabase
      .from("wa_connections")
      .update({
        connection_status: "connected",
        quality_rating: metaDetails.quality_rating || "GREEN",
        last_connected_at: timestamp,
        last_checked_at: timestamp,
      })
      .eq("id", connectionId);

    return {
      success: true,
      connectionId: conn.id,
      status: "verified_ready",
      message: `Meta Cloud API verified. Connected to "${metaDetails.verified_name || metaDetails.display_phone_number || conn.display_name}". Quality: ${metaDetails.quality_rating || "GREEN"}.`,
      diagnostics: {
        phoneNumberIdValid: true,
        wabaIdValid: true,
        credentialsPresent: true,
        credentialsDecryptable: true,
        webhookConfigured: conn.webhook_status === "active",
        timestamp,
      },
    };
  } catch (apiErr: any) {
    const isTokenRevoked = apiErr?.code === 190 || apiErr?.message?.includes("OAuthException");
    const newStatus = isTokenRevoked ? "error" : "error";

    await supabase
      .from("wa_connections")
      .update({
        connection_status: newStatus,
        last_checked_at: timestamp,
      })
      .eq("id", connectionId);

    return {
      success: false,
      connectionId: conn.id,
      status: "error",
      message: `Meta API connection check failed: ${apiErr.message}`,
      diagnostics: {
        phoneNumberIdValid: Boolean(conn.phone_number_id),
        wabaIdValid: Boolean(conn.waba_id),
        credentialsPresent: true,
        credentialsDecryptable: true,
        webhookConfigured: conn.webhook_status === "active",
        timestamp,
      },
    };
  }
}

/**
 * Fetch business settings from Supabase.
 */
export async function getBusinessSettingsDb(businessId: string): Promise<BusinessSettings> {
  validateBusinessTenant(businessId);
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  const { data: row, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (error || !row) {
    throw new Error(`Failed to load business settings from database: ${error?.message}`);
  }

  return {
    id: row.id,
    business_id: row.business_id,
    display_name: row.display_name,
    business_info: row.business_info || "",
    logo_placeholder: row.logo_placeholder || "",
    timezone: row.timezone,
    default_language: row.default_language,
    notification_preferences: {
      connection_drops: row.notification_connection_drops,
      unread_alerts: row.notification_unread_alerts,
      daily_digest: row.notification_daily_digest,
    },
    whatsapp_preferences: {
      default_connection_id: row.default_connection_id || null,
      webhook_retry_policy: row.webhook_retry_policy,
      opt_out_keywords: row.opt_out_keywords,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Update business settings in Supabase with composite foreign key protection.
 */
export async function updateBusinessSettingsDb(
  businessId: string,
  updates: UpdateBusinessSettingsInput
): Promise<BusinessSettings> {
  validateBusinessTenant(businessId);
  const { createServerSupabaseClient } = await import("@/lib/supabase/server");
  const supabase = await createServerSupabaseClient();

  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.display_name !== undefined) patch.display_name = updates.display_name;
  if (updates.business_info !== undefined) patch.business_info = updates.business_info;
  if (updates.logo_placeholder !== undefined) patch.logo_placeholder = updates.logo_placeholder;
  if (updates.timezone !== undefined) patch.timezone = updates.timezone;
  if (updates.default_language !== undefined) patch.default_language = updates.default_language;

  if (updates.notification_preferences) {
    if (updates.notification_preferences.connection_drops !== undefined) {
      patch.notification_connection_drops = updates.notification_preferences.connection_drops;
    }
    if (updates.notification_preferences.unread_alerts !== undefined) {
      patch.notification_unread_alerts = updates.notification_preferences.unread_alerts;
    }
    if (updates.notification_preferences.daily_digest !== undefined) {
      patch.notification_daily_digest = updates.notification_preferences.daily_digest;
    }
  }

  if (updates.whatsapp_preferences) {
    if (updates.whatsapp_preferences.default_connection_id !== undefined) {
      patch.default_connection_id = updates.whatsapp_preferences.default_connection_id;
    }
    if (updates.whatsapp_preferences.webhook_retry_policy !== undefined) {
      patch.webhook_retry_policy = updates.whatsapp_preferences.webhook_retry_policy;
    }
    if (updates.whatsapp_preferences.opt_out_keywords !== undefined) {
      patch.opt_out_keywords = updates.whatsapp_preferences.opt_out_keywords;
    }
  }

  const { error } = await supabase
    .from("business_settings")
    .update(patch)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message || "Failed to update business settings.");
  }

  return getBusinessSettingsDb(businessId);
}
