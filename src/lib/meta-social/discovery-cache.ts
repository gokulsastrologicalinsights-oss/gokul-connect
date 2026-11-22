import crypto from "crypto";
import {
  DiscoveredFacebookPage,
  SanitizedDiscoveredPage,
  sanitizeDiscoveredPages,
} from "./oauth";

interface StagedDiscoverySession {
  sessionId: string;
  businessId: string;
  pages: DiscoveredFacebookPage[];
  expiresAt: number;
}

// In-memory server-side discovery staging (15 minute TTL)
const stagedSessions = new Map<string, StagedDiscoverySession>();

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function cleanupExpired() {
  const now = Date.now();
  for (const [key, session] of stagedSessions.entries()) {
    if (session.expiresAt <= now) {
      stagedSessions.delete(key);
    }
  }
}

/**
 * Stage discovered Facebook Pages and Instagram accounts server-side.
 * Returns a secure random session ID.
 */
export function stageDiscoveredPages(
  businessId: string,
  pages: DiscoveredFacebookPage[]
): string {
  cleanupExpired();
  const sessionId = `disc_${crypto.randomBytes(24).toString("hex")}`;

  stagedSessions.set(sessionId, {
    sessionId,
    businessId,
    pages,
    expiresAt: Date.now() + FIFTEEN_MINUTES_MS,
  });

  return sessionId;
}

/**
 * Retrieve staged discovery session (internal server use only, contains tokens)
 */
export function getStagedDiscoveredSession(
  sessionId: string
): StagedDiscoverySession | null {
  cleanupExpired();
  const session = stagedSessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    stagedSessions.delete(sessionId);
    return null;
  }
  return session;
}

/**
 * Retrieve sanitized pages for frontend delivery (Zero raw access tokens!)
 */
export function getSanitizedStagedPages(
  sessionId: string
): { businessId: string; pages: SanitizedDiscoveredPage[] } | null {
  const session = getStagedDiscoveredSession(sessionId);
  if (!session) return null;

  return {
    businessId: session.businessId,
    pages: sanitizeDiscoveredPages(session.pages),
  };
}

/**
 * Invalidate staged discovery session after connection is complete
 */
export function clearStagedDiscovery(sessionId: string): void {
  stagedSessions.delete(sessionId);
}
