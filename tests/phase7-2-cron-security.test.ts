import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { verifyCronAuthorization } from "@/lib/automation/cron-auth";
import { GET, POST } from "@/app/api/cron/process-automation-jobs/route";
import * as workerModule from "@/lib/automation/worker";
import * as adminModule from "@/lib/supabase/admin";

describe("Phase 7.2 — Cron Authentication & Queue Security Hardening", () => {
  const originalEnv = { ...process.env };
  const VALID_SECRET = "super_secure_cron_token_64_characters_long_for_testing_purposes";

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. HELPER UNIT TESTS: verifyCronAuthorization
  // ============================================================================
  describe("Unit: verifyCronAuthorization() Guardrails", () => {
    it("should reject when CRON_SECRET is undefined in environment", () => {
      expect(verifyCronAuthorization(`Bearer ${VALID_SECRET}`, undefined)).toBe(false);
    });

    it("should reject when CRON_SECRET is empty string or only whitespace", () => {
      expect(verifyCronAuthorization(`Bearer ${VALID_SECRET}`, "")).toBe(false);
      expect(verifyCronAuthorization(`Bearer ${VALID_SECRET}`, "   ")).toBe(false);
    });

    it("should reject when Authorization header is missing (null or undefined)", () => {
      expect(verifyCronAuthorization(null, VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization(undefined, VALID_SECRET)).toBe(false);
    });

    it("should reject when Authorization header is empty or whitespace", () => {
      expect(verifyCronAuthorization("", VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization("   ", VALID_SECRET)).toBe(false);
    });

    it("should reject when Authorization header does not start with exact 'Bearer '", () => {
      expect(verifyCronAuthorization(`Basic ${VALID_SECRET}`, VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization(`Token ${VALID_SECRET}`, VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization(`bearer ${VALID_SECRET}`, VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization(VALID_SECRET, VALID_SECRET)).toBe(false);
    });

    it("should reject when Authorization header has 'Bearer ' but empty token", () => {
      expect(verifyCronAuthorization("Bearer ", VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization("Bearer    ", VALID_SECRET)).toBe(false);
    });

    it("should reject when token is incorrect or tampered", () => {
      expect(verifyCronAuthorization("Bearer invalid_token", VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization(`Bearer ${VALID_SECRET}_extra`, VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization(`Bearer ${VALID_SECRET.slice(0, -1)}`, VALID_SECRET)).toBe(false);
    });

    it("should accept when exact Authorization Bearer token matches CRON_SECRET", () => {
      expect(verifyCronAuthorization(`Bearer ${VALID_SECRET}`, VALID_SECRET)).toBe(true);
    });

    it("should execute constant-time comparison without RangeError on arbitrary token lengths", () => {
      // Testing short, identical, and very long token comparisons
      expect(verifyCronAuthorization("Bearer a", VALID_SECRET)).toBe(false);
      expect(verifyCronAuthorization(`Bearer ${"a".repeat(1000)}`, VALID_SECRET)).toBe(false);
    });
  });

  // ============================================================================
  // 2. ROUTE INTEGRATION TESTS: GET & POST /api/cron/process-automation-jobs
  // ============================================================================
  describe("Integration: /api/cron/process-automation-jobs Route Protection", () => {
    it("should return 401 Unauthorized and NOT invoke queue worker when CRON_SECRET is missing", async () => {
      delete process.env.CRON_SECRET;

      const workerSpy = vi.spyOn(workerModule, "processQueueBatch");
      const request = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        method: "GET",
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      });

      const response = await GET(request);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json).toEqual({ error: "Unauthorized" });
      expect(workerSpy).not.toHaveBeenCalled();
    });

    it("should return 401 Unauthorized and NOT invoke queue worker when CRON_SECRET is empty string", async () => {
      process.env.CRON_SECRET = "";

      const workerSpy = vi.spyOn(workerModule, "processQueueBatch");
      const request = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        method: "POST",
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json).toEqual({ error: "Unauthorized" });
      expect(workerSpy).not.toHaveBeenCalled();
    });

    it("should return 401 Unauthorized and NOT invoke queue worker when Authorization header is missing", async () => {
      process.env.CRON_SECRET = VALID_SECRET;

      const workerSpy = vi.spyOn(workerModule, "processQueueBatch");
      const request = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        method: "GET",
      });

      const response = await GET(request);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json).toEqual({ error: "Unauthorized" });
      expect(workerSpy).not.toHaveBeenCalled();
    });

    it("should return 401 Unauthorized and NOT invoke queue worker when token is invalid", async () => {
      process.env.CRON_SECRET = VALID_SECRET;

      const workerSpy = vi.spyOn(workerModule, "processQueueBatch");
      const request = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        method: "GET",
        headers: { authorization: "Bearer wrong_secret_token_value" },
      });

      const response = await GET(request);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json).toEqual({ error: "Unauthorized" });
      expect(workerSpy).not.toHaveBeenCalled();
    });

    it("should succeed with 200 OK and process queue when valid Bearer token is provided (GET)", async () => {
      process.env.CRON_SECRET = VALID_SECRET;

      const mockQueueResult: workerModule.ProcessQueueResult = {
        claimedCount: 2,
        processedCount: 2,
        succeededCount: 2,
        failedCount: 0,
        skippedCount: 0,
        errors: [],
      };

      const workerSpy = vi
        .spyOn(workerModule, "processQueueBatch")
        .mockResolvedValue(mockQueueResult);

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: { pruned_logs: 0, pruned_jobs: 0 }, error: null }),
      };
      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

      const request = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        method: "GET",
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      });

      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.queue).toEqual(mockQueueResult);
      expect(json.workerId).toMatch(/^cron_\d+$/);
      expect(workerSpy).toHaveBeenCalledTimes(1);
      expect(workerSpy).toHaveBeenCalledWith(15, expect.stringMatching(/^cron_\d+$/));
    });

    it("should succeed with 200 OK and process queue when valid Bearer token is provided (POST)", async () => {
      process.env.CRON_SECRET = VALID_SECRET;

      const mockQueueResult: workerModule.ProcessQueueResult = {
        claimedCount: 1,
        processedCount: 1,
        succeededCount: 1,
        failedCount: 0,
        skippedCount: 0,
        errors: [],
      };

      const workerSpy = vi
        .spyOn(workerModule, "processQueueBatch")
        .mockResolvedValue(mockQueueResult);

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: { pruned_logs: 5, pruned_jobs: 2 }, error: null }),
      };
      vi.spyOn(adminModule, "createAdminClient").mockReturnValue(mockSupabase as any);

      const request = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        method: "POST",
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.queue).toEqual(mockQueueResult);
      expect(workerSpy).toHaveBeenCalledTimes(1);
    });

    it("should never expose secret tokens or sensitive error messages to callers", async () => {
      process.env.CRON_SECRET = VALID_SECRET;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      vi.spyOn(workerModule, "processQueueBatch").mockRejectedValue(
        new Error("Database connection timed out at postgres://user:secretpass@host")
      );

      const request = new NextRequest("http://localhost:3000/api/cron/process-automation-jobs", {
        method: "GET",
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      });

      const response = await GET(request);
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.success).toBe(false);
      // Ensure raw database connection string or passwords are not returned
      expect(json.error).toBe("Internal Server Error");
      expect(JSON.stringify(json)).not.toContain("secretpass");
      expect(JSON.stringify(json)).not.toContain(VALID_SECRET);

      // Verify console log redaction
      expect(consoleErrorSpy).toHaveBeenCalled();
      const loggedError = consoleErrorSpy.mock.calls[0].join(" ");
      expect(loggedError).not.toContain("secretpass");
      expect(loggedError).toContain("[REDACTED]");
    });
  });
});
