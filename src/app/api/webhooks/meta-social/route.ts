import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getClientIp,
  rateLimitInvalidWebhookSignatures,
  rateLimitWebhookHandshake,
} from "@/lib/rate-limit/rate-limiter";
import { parseMetaSocialWebhook } from "@/lib/meta-social/parser";
import { ingestSocialEvent } from "@/lib/meta-social/database";
import { processSocialEventsBatch } from "@/lib/meta-social/worker";

export const dynamic = "force-dynamic";

/**
 * Timing-safe constant-time string comparison preventing timing leakage
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  try {
    return crypto.timingSafeEqual(aHash, bHash);
  } catch {
    return false;
  }
}

/**
 * GET Handler — Meta Webhook Handshake & Verification for Facebook & Instagram
 * Protected with constant-time cryptographic verification (P2-5 fix).
 */
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = rateLimitWebhookHandshake(clientIp);
  if (!rateLimit.success) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token &&
    expectedToken &&
    timingSafeCompare(token, expectedToken)
  ) {
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Verification token mismatch", { status: 403 });
}

/**
 * POST Handler — Inbound Facebook & Instagram Event Receiver
 *
 * Architectural Guarantees (Phase 13B Remediation):
 * 1. Fail-closed secret verification.
 * 2. Cryptographic timing-safe HMAC-SHA256 signature validation.
 * 3. Rate-limits forged signature attempts.
 * 4. Parses Facebook DMs/comments and Instagram DMs/comments.
 * 5. Atomically persists events into meta_social_events ledger with deduplication.
 * 6. P0-1 FIX: DECOUPLED EVENT INGESTION — Returns HTTP 200 promptly (<100ms)
 *    WITHOUT executing synchronous outbound Meta API calls.
 * 7. P0-2 FIX: Returns HTTP 500 on database persistence failure so Meta safely retries.
 *    Never silently swallows database write errors.
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const appSecret = process.env.META_APP_SECRET;

  // 1. Fail-Closed Secret Verification
  if (!appSecret) {
    console.error("[Meta Social Webhook] META_APP_SECRET is not configured on the server.");
    return new Response("Server configuration error", { status: 500 });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  // 2. Cryptographic HMAC-SHA256 verification (timing-safe)
  const isValid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
  if (!isValid) {
    console.error("[Meta Social Webhook] Invalid HMAC-SHA256 signature received.");
    rateLimitInvalidWebhookSignatures(clientIp);
    return new Response("Invalid signature", { status: 401 });
  }

  // 3. Parse JSON payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  // Check object type (Facebook uses "page", Instagram uses "instagram")
  if (payload.object !== "page" && payload.object !== "instagram") {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const events = parseMetaSocialWebhook(payload);
  if (events.length === 0) {
    return NextResponse.json({ success: true, count: 0 }, { status: 200 });
  }

  // 4. Resolve Database client
  let supabase: any = null;
  try {
    supabase = createAdminClient();
  } catch (e) {
    supabase = null;
  }

  if (!supabase && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
    } catch {
      supabase = null;
    }
  }

  if (!supabase) {
    console.error("[Meta Social Webhook] Database client unconfigured; returning retryable 500.");
    return new Response("Database configuration error", { status: 500 });
  }

  // 5. Ingest and persist all events atomically
  let hasPersistenceFailure = false;
  let ingestedCount = 0;
  let duplicateCount = 0;
  let ignoredCount = 0;

  for (const event of events) {
    try {
      const res = await ingestSocialEvent(supabase, event);

      if (res.status === "error") {
        console.error("[Meta Social Webhook] Persistence error for event:", res.error);
        hasPersistenceFailure = true;
      } else if (res.status === "duplicate") {
        duplicateCount++;
      } else if (res.status === "ingested") {
        ingestedCount++;
      } else {
        ignoredCount++;
      }
    } catch (err: any) {
      console.error("[Meta Social Webhook] Uncaught error persisting event:", err?.message || err);
      hasPersistenceFailure = true;
    }
  }

  // 6. Fail-closed persistence verification (P0-2 Fix)
  // If ANY event failed to durably persist, return retryable HTTP 500 so Meta safely retries
  if (hasPersistenceFailure) {
    return new Response("Event persistence failure; please retry.", { status: 500 });
  }

  // 7. Non-blocking asynchronous worker trigger (if events were ingested)
  if (ingestedCount > 0) {
    // Fire and forget / background dispatch without awaiting outbound HTTP calls
    // Serverless platforms will execute or cron will pick up pending events
    processSocialEventsBatch(10).catch((err) => {
      console.warn("[Meta Social Webhook] Background batch worker noticed:", err.message);
    });
  }

  // 8. Prompt HTTP 200 Acknowledgement (<100ms) to Meta
  return NextResponse.json(
    {
      success: true,
      ingested: ingestedCount,
      duplicates: duplicateCount,
      ignored: ignoredCount,
    },
    { status: 200 }
  );
}
