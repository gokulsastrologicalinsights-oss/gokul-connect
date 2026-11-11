import { describe, expect, it } from "vitest";
import crypto from "crypto";
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";
import { NextRequest } from "next/server";

describe("Phase 3D — WhatsApp Webhooks Verification & Event Receiver", () => {
  const VERIFY_TOKEN = "gokul_connect_secure_token_2026";
  const APP_SECRET = "test_app_secret_1234567890abcdef";

  process.env.META_WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
  process.env.META_APP_SECRET = APP_SECRET;

  // 1. GET Handshake Verification Tests
  describe("GET /api/webhooks/whatsapp (Handshake)", () => {
    it("should respond with challenge and 200 OK when verify token matches", async () => {
      const challenge = "CHALLENGE_CODE_987654321";
      const url = `http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${challenge}`;
      const request = new NextRequest(url, { method: "GET" });

      const response = await GET(request);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe(challenge);
    });

    it("should reject with 403 when verify token does not match", async () => {
      const url = `http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123`;
      const request = new NextRequest(url, { method: "GET" });

      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it("should reject with 403 when hub.mode is not subscribe", async () => {
      const url = `http://localhost:3000/api/webhooks/whatsapp?hub.mode=unknown&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=123`;
      const request = new NextRequest(url, { method: "GET" });

      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  });

  // 2. POST Signature Validation Tests
  describe("POST /api/webhooks/whatsapp (Signature Verification)", () => {
    it("should reject requests with invalid or tampered HMAC signatures (401)", async () => {
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [],
      });

      const request = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": "sha256=invalidhex00000000000000000000000000000000000000000000000000000000",
        },
        body: payload,
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("should fail closed with 500 when META_APP_SECRET is missing or empty", async () => {
      const originalSecret = process.env.META_APP_SECRET;
      try {
        delete process.env.META_APP_SECRET;
        const payload = JSON.stringify({
          object: "whatsapp_business_account",
          entry: [],
        });

        const request = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-hub-signature-256": "sha256=anyvalue",
          },
          body: payload,
        });

        const response = await POST(request);
        expect(response.status).toBe(500);
        const text = await response.text();
        expect(text).toBe("Server configuration error");
      } finally {
        process.env.META_APP_SECRET = originalSecret;
      }
    });

    it("should accept requests with valid HMAC-SHA256 signature", async () => {
      const payload = JSON.stringify({
        object: "whatsapp_business_account",
        entry: [],
      });

      const hmac = crypto.createHmac("sha256", APP_SECRET);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest("hex")}`;

      const request = new NextRequest("http://localhost:3000/api/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hub-signature-256": signature,
        },
        body: payload,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });
});
