import { NextRequest, NextResponse } from "next/server";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getClientIp,
  rateLimitInvalidWebhookSignatures,
  rateLimitWebhookHandshake,
} from "@/lib/rate-limit/rate-limiter";

export const dynamic = "force-dynamic";

/**
 * GET Handler — Meta Webhook Handshake & Verification
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
    // Challenge must be returned as plain text with HTTP 200
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Verification token mismatch", { status: 403 });
}

/**
 * POST Handler — Inbound WhatsApp Event Receiver & Decoupled Queueing
 *
 * Architecture (Phase 7.5):
 * 1. Validate fail-closed secret & HMAC-SHA256 signature (timing-safe).
 * 2. Parse and validate JSON payload.
 * 3. Ingest atomically into wa_webhook_events, wa_contacts, wa_conversations, wa_messages.
 * 4. Deduplicate using stable Meta message identifiers.
 * 5. Atomically enqueue 'evaluate_automation_rules' job into wa_processing_jobs with idempotency key.
 * 6. Return HTTP 200 promptly (<100ms) without synchronous automation evaluation or outbound API calls.
 * 7. If persistence or queueing fails, return retryable non-2xx (HTTP 500) so Meta safely retries.
 */
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const appSecret = process.env.META_APP_SECRET;

  // 1. Fail-Closed Secret Verification: strictly reject incoming webhooks if secret is unconfigured
  if (!appSecret) {
    console.error("[Webhook Error] META_APP_SECRET is not configured on the server.");
    return new Response("Server configuration error", { status: 500 });
  }

  const signatureHeader = request.headers.get("x-hub-signature-256");

  // Read raw body as text for HMAC verification
  const rawBody = await request.text();

  // 2. Cryptographic HMAC-SHA256 signature verification (Timing-safe)
  const isValid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
  if (!isValid) {
    console.error("[Webhook Error] Invalid HMAC-SHA256 signature received.");
    // Throttle abusive callers attempting signature forgery
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

  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    // Acknowledge non-whatsapp events with 200 OK
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  if (payload.entry.length === 0) {
    return NextResponse.json({ success: true, count: 0 }, { status: 200 });
  }

  // Resolve database client: prefer Admin client (service role) if configured, else public Anon client with SECURITY DEFINER RPCs
  let supabase: any = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      supabase = createAdminClient();
    } catch {
      supabase = null;
    }
  }

  if (!supabase && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  if (!supabase) {
    console.warn("[Webhook Receiver] Supabase credentials not configured. Event acknowledged without persistence.");
    return NextResponse.json({ success: true, status: "acknowledged_unpersisted" }, { status: 200 });
  }

  let hasPersistenceFailure = false;

  // 4. Process entries and changes
  for (const entry of payload.entry) {
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (change.field !== "messages" || !change.value) continue;

      const value = change.value;
      const metadata = value.metadata;
      const phoneNumberId = metadata?.phone_number_id;

      if (!phoneNumberId) continue;

      // Handle Inbound Messages
      if (Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          const metaMessageId = msg.id;
          if (!metaMessageId) continue;

          // Extract sender details
          const fromPhone = msg.from;
          const contactProfile = value.contacts?.find((c: any) => c.wa_id === fromPhone)?.profile;
          const senderName = contactProfile?.name || null;

          // Resolve message text/content
          let contentText = "";
          if (msg.type === "text" && msg.text?.body) {
            contentText = msg.text.body;
          } else if (msg.type === "interactive" && msg.interactive?.button_reply?.title) {
            contentText = msg.interactive.button_reply.title;
          } else if (msg.type === "interactive" && msg.interactive?.list_reply?.title) {
            contentText = msg.interactive.list_reply.title;
          } else if (msg.type === "image") {
            contentText = msg.image?.caption ? `📷 ${msg.image.caption}` : "📷 Photo";
          } else if (msg.type === "document") {
            contentText = msg.document?.caption
              ? `📄 ${msg.document.caption}`
              : msg.document?.filename
              ? `📄 ${msg.document.filename}`
              : "📄 Document";
          } else if (msg.type === "audio") {
            contentText = "🎤 Audio message";
          } else if (msg.type === "video") {
            contentText = msg.video?.caption ? `🎥 ${msg.video.caption}` : "🎥 Video";
          } else {
            contentText = `[${msg.type || "media"} message]`;
          }

          // Ingest atomically via PostgreSQL SECURITY DEFINER RPC
          // Check feature flag: USE_ATOMIC_WEBHOOK_V2 toggles between Phase 7.5 single-transaction
          // atomic RPC (ingest_wa_inbound_message_v2) and legacy two-phase ingestion.
          const useAtomicV2 = process.env.USE_ATOMIC_WEBHOOK_V2 === "true";

          if (useAtomicV2) {
            // PHASE 7.5.2 ATOMIC INGESTION:
            // Single transaction encapsulates event logging, contact upsert, conversation upsert,
            // message persistence, and processing job enqueue with idempotency key.
            const { data: rpcRes, error: rpcErr } = await supabase.rpc("ingest_wa_inbound_message_v2", {
              p_phone_number_id: phoneNumberId,
              p_meta_message_id: metaMessageId,
              p_sender_phone: fromPhone,
              p_sender_name: senderName,
              p_message_type: msg.type || "text",
              p_content: contentText,
              p_raw_payload: msg,
            });

            if (rpcErr) {
              console.error("[Webhook RPC Error] ingest_wa_inbound_message_v2 failed:", rpcErr.message);
              hasPersistenceFailure = true;
            } else if (rpcRes?.status === "duplicate") {
              // Confirmed duplicate delivery: already processed; acknowledge with 200 without duplicate job
            } else if (rpcRes?.status !== "success") {
              console.warn("[Webhook RPC Warning] ingest_wa_inbound_message_v2 returned non-success status:", rpcRes?.status);
            }
          } else {
            // LEGACY TWO-PHASE INGESTION:
            // Ingest message via v1 RPC, then queue job via separate insert query
            const { data: rpcRes, error: rpcErr } = await supabase.rpc("ingest_wa_inbound_message", {
              p_phone_number_id: phoneNumberId,
              p_meta_message_id: metaMessageId,
              p_sender_phone: fromPhone,
              p_sender_name: senderName,
              p_message_type: msg.type || "text",
              p_content: contentText,
              p_raw_payload: msg,
            });

            if (rpcErr) {
              console.error("[Webhook RPC Error] ingest_wa_inbound_message failed:", rpcErr.message);
              hasPersistenceFailure = true;
            } else if (rpcRes?.status === "success" && rpcRes.business_id) {
              const idempotencyKey = `inbound_eval_${metaMessageId}`;
              const fromJobs = typeof supabase.from === "function" ? supabase.from("wa_processing_jobs") : null;

              if (fromJobs && typeof fromJobs.insert === "function") {
                const { error: jobErr } = await fromJobs.insert({
                  business_id: rpcRes.business_id,
                  connection_id: rpcRes.connection_id,
                  job_type: "evaluate_automation_rules",
                  payload: {
                    business_id: rpcRes.business_id,
                    connection_id: rpcRes.connection_id,
                    conversation_id: rpcRes.conversation_id,
                    contact_id: rpcRes.contact_id,
                    message_id: rpcRes.message_id,
                    message_content: contentText,
                    message_type: msg.type || "text",
                    sender_phone: fromPhone,
                    sender_name: senderName,
                    meta_message_id: metaMessageId,
                  },
                  idempotency_key: idempotencyKey,
                  scheduled_at: new Date().toISOString(),
                  status: "pending",
                  attempts: 0,
                  max_attempts: 5,
                });

                // Postgres code 23505 = unique constraint violation (already enqueued on retry)
                if (jobErr && jobErr.code !== "23505") {
                  console.error("[Webhook Queue Error] Failed to enqueue processing job:", jobErr.message);
                  hasPersistenceFailure = true;
                }
              }
            }
          }
        }
      }

      // Handle Delivery, Read, and Failed Statuses
      if (Array.isArray(value.statuses)) {
        for (const status of value.statuses) {
          const metaMsgId = status.id;
          const statusName = status.status; // sent, delivered, read, failed
          const timestamp = status.timestamp
            ? new Date(parseInt(status.timestamp, 10) * 1000).toISOString()
            : new Date().toISOString();
          const errorCode = status.errors?.[0]?.code ? String(status.errors[0].code) : null;
          const errorMessage =
            status.errors?.[0]?.message || status.errors?.[0]?.title || (statusName === "failed" ? "Message delivery failed" : null);

          // Update message status atomically via PostgreSQL SECURITY DEFINER RPC
          const { data: statusRes, error: statusErr } = await supabase.rpc("update_wa_message_status", {
            p_phone_number_id: phoneNumberId,
            p_meta_message_id: metaMsgId,
            p_status: statusName,
            p_timestamp: timestamp,
            p_error_code: errorCode,
            p_error_message: errorMessage,
            p_raw_payload: status,
          });

          if (statusErr) {
            console.error("[Webhook RPC Error] update_wa_message_status failed:", statusErr.message);
            hasPersistenceFailure = true;
          }
        }
      }
    }
  }

  // If critical persistence or queue insertion failed, return retryable HTTP 500
  if (hasPersistenceFailure) {
    return new Response("Failed to persist or queue webhook event", { status: 500 });
  }

  // Meta requires immediate 200 OK response upon durable persistence and enqueue
  return NextResponse.json({ success: true }, { status: 200 });
}
