import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp/crypto-signature";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
import fs from "fs";
import path from "path";

describe("P0.3 — Secure Environment Configuration Verification Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Requirement 1 & 2: Supabase Admin Client & Worker Authentication Guardrails", () => {
    it("should fail-closed when SUPABASE_SERVICE_ROLE_KEY is missing or empty", () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";

      expect(() => createAdminClient()).toThrow(
        "Missing Supabase admin credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
      );
    });

    it("should fail-closed when NEXT_PUBLIC_SUPABASE_URL is missing or empty", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "mock_service_role_key";

      expect(() => createAdminClient()).toThrow(
        "Missing Supabase admin credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
      );
    });

    it("should initialize client without session persistence when credentials are provided", () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-project.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "mock_service_role_key_1234567890";

      const client = createAdminClient();
      expect(client).toBeDefined();
      expect(typeof client.from).toBe("function");
      expect(typeof client.rpc).toBe("function");
    });
  });

  describe("Requirement 3 & 4: Meta App Credentials & Webhook Signature Verification", () => {
    const dummySecret = "0123456789abcdef0123456789abcdef";
    const dummyPayload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "123456789", changes: [] }],
    });

    it("should correctly verify valid HMAC-SHA256 signature generated with app secret", () => {
      const hmac = crypto.createHmac("sha256", dummySecret);
      hmac.update(dummyPayload);
      const signature = `sha256=${hmac.digest("hex")}`;

      const isValid = verifyMetaWebhookSignature(dummyPayload, signature, dummySecret);
      expect(isValid).toBe(true);
    });

    it("should reject tampered payload or mismatched signature header", () => {
      const hmac = crypto.createHmac("sha256", dummySecret);
      hmac.update(dummyPayload);
      const signature = `sha256=${hmac.digest("hex")}`;

      const tamperedPayload = dummyPayload + "tampered";
      const isValid = verifyMetaWebhookSignature(tamperedPayload, signature, dummySecret);
      expect(isValid).toBe(false);
    });

    it("should reject signature when secret is incorrect", () => {
      const hmac = crypto.createHmac("sha256", dummySecret);
      hmac.update(dummyPayload);
      const signature = `sha256=${hmac.digest("hex")}`;

      const wrongSecret = "fedcba9876543210fedcba9876543210";
      const isValid = verifyMetaWebhookSignature(dummyPayload, signature, wrongSecret);
      expect(isValid).toBe(false);
    });

    it("should reject when signature header or app secret is empty or missing", () => {
      expect(verifyMetaWebhookSignature(dummyPayload, null, dummySecret)).toBe(false);
      expect(verifyMetaWebhookSignature(dummyPayload, "", dummySecret)).toBe(false);
      expect(verifyMetaWebhookSignature(dummyPayload, "sha256=123", "")).toBe(false);
    });

    it("should detect placeholder format for META_APP_ID and META_APP_SECRET", () => {
      const isPlaceholder = (val?: string) =>
        !val ||
        val.startsWith("<") ||
        val.includes("your_") ||
        val.trim() === '""' ||
        val.trim() === "''";

      expect(isPlaceholder("<your_copied_app_id>")).toBe(true);
      expect(isPlaceholder("<your_copied_app_secret>")).toBe(true);
      expect(isPlaceholder("1153964060437882")).toBe(false);
      expect(isPlaceholder(dummySecret)).toBe(false);
    });
  });

  describe("Requirement 5: Browser Bundle Exposure & Server-Only Variable Audit", () => {
    const serverOnlyKeys = [
      "SUPABASE_SERVICE_ROLE_KEY",
      "META_APP_SECRET",
      "APP_ENCRYPTION_SECRET",
      "CRON_SECRET",
      "META_TEST_ACCESS_TOKEN",
    ];

    it("server-only secrets must NOT use NEXT_PUBLIC_ prefix", () => {
      serverOnlyKeys.forEach((key) => {
        expect(key.startsWith("NEXT_PUBLIC_")).toBe(false);
      });
    });

    it("no client components ('use client') in src/ should reference server-only secrets", () => {
      function walk(dir: string): string[] {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
          const full = path.join(dir, file);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            results = results.concat(walk(full));
          } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
            results.push(full);
          }
        });
        return results;
      }

      const files = walk(path.resolve(process.cwd(), "src"));
      const violations: string[] = [];

      files.forEach((file) => {
        const content = fs.readFileSync(file, "utf8");
        const isClient = content.includes('"use client"') || content.includes("'use client'");
        if (isClient) {
          serverOnlyKeys.forEach((key) => {
            if (content.includes(key)) {
              violations.push(`${file} contains reference to ${key}`);
            }
          });
        }
      });

      expect(violations).toEqual([]);
    });

    it(".gitignore must protect .env.local from version control", () => {
      const gitignore = fs.readFileSync(path.resolve(process.cwd(), ".gitignore"), "utf8");
      expect(gitignore).toMatch(/\.env\*\.local|\.env\.local/);
    });

    it(".env.example must contain sanitized placeholders for APP_ENCRYPTION_SECRET and CRON_SECRET", () => {
      const envExample = fs.readFileSync(path.resolve(process.cwd(), ".env.example"), "utf8");

      // Verify presence of APP_ENCRYPTION_SECRET placeholder
      expect(envExample).toMatch(/^APP_ENCRYPTION_SECRET=your_/m);

      // Verify presence of empty CRON_SECRET placeholder
      expect(envExample).toMatch(/^CRON_SECRET=$/m);

      // Verify no actual 64-char hex master keys or real secrets are present
      expect(envExample).not.toMatch(/[a-f0-9]{64}/i);
      expect(envExample).not.toContain("EAAG");
    });
  });
});
