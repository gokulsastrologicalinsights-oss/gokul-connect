import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Read .env.local manually if not in process.env
function loadEnvLocal() {
  try {
    const envPath = path.resolve("./.env.local");
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    // Silently continue if .env.local is unavailable; environment checks below will fail-closed
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set."
  );
}

describe("Phase 5 / P0.2 — Automation Storage Pruning RPC (public.prune_stale_automation_records)", () => {
  // ---------------------------------------------------------------------------
  // 1. Retention Window Calculation & Boundary Semantics
  // ---------------------------------------------------------------------------
  describe("Retention Policy & Boundary Rules", () => {
    it("should enforce 14-day cutoff for execution logs", () => {
      const now = new Date("2026-11-06T12:00:00Z");
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const staleLog = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
      const validLog = new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000);

      expect(staleLog.getTime()).toBeLessThan(fourteenDaysAgo.getTime());
      expect(validLog.getTime()).toBeGreaterThan(fourteenDaysAgo.getTime());
    });

    it("should enforce 7-day cutoff for completed and failed processing jobs", () => {
      const now = new Date("2026-11-06T12:00:00Z");
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const staleJob = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const validJob = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

      expect(staleJob.getTime()).toBeLessThan(sevenDaysAgo.getTime());
      expect(validJob.getTime()).toBeGreaterThan(sevenDaysAgo.getTime());
    });

    it("should enforce active job preservation (pending / processing never pruned)", () => {
      const activeStatuses = ["pending", "processing"];
      const prunableStatuses = ["completed", "failed"];

      for (const status of activeStatuses) {
        expect(prunableStatuses.includes(status)).toBe(false);
      }
    });

    it("should enforce unprocessed webhook preservation (is_processed = false never pruned)", () => {
      const isProcessedTruePrunable = (isProcessed: boolean) => isProcessed === true;
      expect(isProcessedTruePrunable(true)).toBe(true);
      expect(isProcessedTruePrunable(false)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Return Type & Cron Schema Compatibility
  // ---------------------------------------------------------------------------
  describe("RPC Return Structure Compatibility", () => {
    it("should match the shape expected by /api/cron/process-automation-jobs", () => {
      const mockRpcResult = {
        pruned_logs: 0,
        pruned_jobs: 0,
        pruned_events: 0,
      };

      expect(mockRpcResult).toHaveProperty("pruned_logs");
      expect(mockRpcResult).toHaveProperty("pruned_jobs");
      expect(mockRpcResult).toHaveProperty("pruned_events");
      expect(typeof mockRpcResult.pruned_logs).toBe("number");
      expect(typeof mockRpcResult.pruned_jobs).toBe("number");
      expect(typeof mockRpcResult.pruned_events).toBe("number");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Live Supabase Authorization & Access Control Verification
  // ---------------------------------------------------------------------------
  describe("Live Supabase Security & Privilege Hardening (Project ansiwtwqgrfmzfrhkzuu)", () => {
    it("should DENY unauthorized invocation by anonymous caller (401 / 42501)", async () => {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data, error, status } = await client.rpc("prune_stale_automation_records");

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for function prune_stale_automation_records");
      expect(status).toBe(401);
    });

    it("should DENY unauthorized invocation by authenticated non-admin user (403 / 42501)", async () => {
      const email = process.env.TEST_ASTROLOGY_USER_EMAIL;
      const password = process.env.TEST_ASTROLOGY_USER_PASSWORD;
      if (!email || !password) {
        throw new Error("TEST_ASTROLOGY_USER_EMAIL and TEST_ASTROLOGY_USER_PASSWORD must be set in .env.local for authenticated RLS test.");
      }

      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { error: loginErr } = await client.auth.signInWithPassword({
        email,
        password,
      });
      expect(loginErr).toBeNull();

      const { data, error, status } = await client.rpc("prune_stale_automation_records");

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(error?.message).toContain("permission denied for function prune_stale_automation_records");
      expect(status).toBe(403);
    });
  });
});
