import { NextRequest, NextResponse } from "next/server";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getClientIp,
  rateLimitInvalidWebhookSignatures,
  rateLimitWebhookHandshake,
} from "@/lib/rate-limit/rate-limiter";
import { parseMetaSocialWebhook } from "@/lib/meta-social/parser";
import { processMetaSocialEvent } from "@/lib/meta-social/service";

export const dynamic = "force-dynamic";

/**
 * GET Handler — Meta Webhook Handshake & Verification for Facebook & Instagram
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

  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
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
 * Security:
 * 1. Fail-closed secret verification.
 * 2. Cryptographic timing-safe HMAC-SHA256 signature validation.
 * 3. Rate-limits forged signature attempts.
 * 4. Parses Facebook DMs/comments and Instagram DMs/comments.
 * 5. Processes deterministic rules with atomic deduplication.
 * 6. Returns 200 OK promptly to prevent Meta webhook retries.
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
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      supabase = createAdminClient();
    } catch (e) {
      console.error("[Meta Social Webhook] Failed to initialize admin Supabase client:", e);
    }
  }

  if (!supabase) {
    return new Response("Database configuration error", { status: 500 });
  }

  // 5. Process events
  const results = [];
  for (const event of events) {
    try {
      const res = await processMetaSocialEvent(supabase, event);
      results.push(res);
    } catch (err: any) {
      console.error("[Meta Social Webhook] Error processing event:", err?.message || err);
    }
  }

  return NextResponse.json({ success: true, processed: results.length }, { status: 200 });
}
