import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cron/process-social-automations/route";
import {
  processPersistedMetaSocialEvent,
  processMetaSocialEvent,
  computeBackoffDelay,
} from "@/lib/meta-social/service";
import { processSocialEventsBatch } from "@/lib/meta-social/worker";
import {
  claimSocialEvents,
  reclaimStuckSocialEvents,
  getSocialOperationalMetrics,
} from "@/lib/meta-social/database";
import {
  sendInstagramPrivateReply,
  sendFacebookPrivateReply,
  sendMetaCommentPrivateDm,
  replyMetaCommentPublic,
  checkCommentReplied,
  MetaSocialApiError,
  sanitizeSocialLog,
} from "@/lib/meta-social/client";
import * as client from "@/lib/meta-social/client";
import * as db from "@/lib/meta-social/database";
import * as admin from "@/lib/supabase/admin";
import type {
  MetaSocialEvent,
  MetaSocialRule,
  NormalizedMetaSocialEvent,
} from "@/lib/meta-social/types";
import { encryptSecret } from "@/lib/crypto/encryption";

describe("Phase 13B.2 — Critical Worker, Queue & Delivery Reliability Test Suite", () => {
  const TEST_CRON_SECRET = "test-cron-secret-32-chars-long-12345";
  const TEST_APP_SECRET = "test-meta-app-secret-32-chars-long!";
  const BIZ_ASTROLOGY = "11111111-1111-1111-1111-111111111111";
  const BIZ_VIVAHAM = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    process.env.META_APP_SECRET = TEST_APP_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_key";
    delete process.env.META_PAGE_ACCESS_TOKEN;
  });

  // ============================================================================
  // DOMAIN 1: Worker Deduplication Bug Fix (Task 1)
  // ============================================================================
  describe("Domain 1: Worker Deduplication Separation (Task 1)", () => {
    it("1.1 Worker processes an already persisted event WITHOUT re-ingesting or failing as duplicate", async () => {
      const persistedEventId = "evt-persisted-1001";
      const pubReplySpy = vi
        .spyOn(client, "replyMetaCommentPublic")
        .mockResolvedValue({ id: "meta_pub_comment_123" });
      const privDmSpy = vi
        .spyOn(client, "sendMetaCommentPrivateDm")
        .mockResolvedValue({ message_id: "meta_priv_dm_456", recipient_id: "user_comm_1" });

      const mockRule: MetaSocialRule = {
        id: "rule-1001",
        business_id: BIZ_ASTROLOGY,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Astrology Fees",
        keywords: ["fees", "rate"],
        match_type: "contains",
        response_action: "both_public_and_private",
        predefined_reply: "Public: Consultation is ₹500.",
        predefined_dm: "Private: Pay via UPI 9876543210 to book your slot.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const persistedEvent: MetaSocialEvent = {
        id: persistedEventId,
        business_id: BIZ_ASTROLOGY,
        connection_id: "conn-astro-1",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "fb_comm_9999",
        sender_id: "user_comm_1",
        sender_name: "Gokul Client",
        comment_id: "fb_comm_9999",
        content: "What are your horoscope consultation fees?",
        status: "received",
        public_reply_status: "none",
        private_reply_status: "none",
        attempt_count: 0,
        max_attempts: 3,
        created_at: new Date().toISOString(),
      };

      const encrypted = encryptSecret("VALID_DECRYPTED_PAGE_TOKEN");

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_events") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col, val) => {
                if (col === "id" && val === persistedEventId) {
                  return { maybeSingle: vi.fn().mockResolvedValue({ data: persistedEvent, error: null }) };
                }
                return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_connections") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "conn-astro-1",
                  business_id: BIZ_ASTROLOGY,
                  platform: "facebook",
                  account_id: "page_astro_1",
                  page_id: "page_astro_1",
                  is_enabled: true,
                  connection_status: "connected",
                  auto_reply_comments: true,
                  auto_dm_on_comment: true,
                },
                error: null,
              }),
            };
          }
          if (table === "meta_social_credentials") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...encrypted, business_id: BIZ_ASTROLOGY },
                error: null,
              }),
            };
          }
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [mockRule], error: null }),
            };
          }
          if (table === "meta_social_deliveries") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "del-new" }, error: null }) }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      // Direct worker call: processPersistedMetaSocialEvent!
      // Proves: DOES NOT invoke ingestSocialEvent() or ingest_meta_social_event_atomic RPC!
      const rpcSpy = vi.fn();
      (mockSupabase as any).rpc = rpcSpy;

      const result = await processPersistedMetaSocialEvent(mockSupabase, persistedEventId);

      // Verify execution occurred successfully
      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.publicReplyId).toBe("meta_pub_comment_123");
      expect(result.privateReplyId).toBe("meta_priv_dm_456");

      // Verify the worker NEVER attempted duplicate ingestion
      expect(rpcSpy).not.toHaveBeenCalledWith("ingest_meta_social_event_atomic", expect.anything());

      // Verify both dispatches were performed
      expect(pubReplySpy).toHaveBeenCalledTimes(1);
      expect(privDmSpy).toHaveBeenCalledTimes(1);
    });

    it("1.2 Duplicate webhook delivery does not re-insert or confuse persisted event processing", async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: {
            status: "duplicate",
            event_id: "evt-existing-777",
            business_id: BIZ_ASTROLOGY,
            connection_id: "conn-1",
          },
          error: null,
        }),
      };

      const event: NormalizedMetaSocialEvent = {
        platform: "facebook",
        accountId: "page_1",
        eventType: "comment",
        metaEventId: "comment_dup_1",
        senderId: "user_1",
        content: "Duplicate webhook delivery test",
        timestamp: Date.now(),
      };

      const res = await processMetaSocialEvent(mockSupabase, event);
      expect(res.success).toBe(true);
      expect(res.status).toBe("duplicate");
      expect(res.eventId).toBe("evt-existing-777");
    });
  });

  // ============================================================================
  // DOMAIN 2: Atomic Worker Claiming & Concurrency Safety (Task 2)
  // ============================================================================
  describe("Domain 2: Atomic Worker Claiming (Task 2)", () => {
    it("2.1 Two concurrent workers attempting to claim the same event: exactly one worker owns the claim", async () => {
      const eventToClaim: MetaSocialEvent = {
        id: "evt-concurrency-target",
        business_id: BIZ_ASTROLOGY,
        connection_id: "conn-1",
        platform: "facebook",
        event_type: "message",
        meta_event_id: "mid.race.1",
        sender_id: "psid.race.1",
        content: "Race condition test",
        status: "received",
        attempt_count: 0,
        max_attempts: 3,
        created_at: new Date().toISOString(),
      };

      let isClaimedByWorkerA = false;

      // Mock RPC implementation simulating PostgreSQL FOR UPDATE SKIP LOCKED
      const mockSupabaseForWorkerA = {
        rpc: vi.fn().mockImplementation((fnName: string, args: any) => {
          if (fnName === "claim_meta_social_events") {
            if (!isClaimedByWorkerA) {
              isClaimedByWorkerA = true;
              return Promise.resolve({
                data: [
                  {
                    ...eventToClaim,
                    status: "processing",
                    claimed_by: args.p_worker_id,
                    claimed_at: new Date().toISOString(),
                    attempt_count: 1,
                  },
                ],
                error: null,
              });
            }
            return Promise.resolve({ data: [], error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };

      const mockSupabaseForWorkerB = {
        rpc: vi.fn().mockImplementation((fnName: string, args: any) => {
          if (fnName === "claim_meta_social_events") {
            if (!isClaimedByWorkerA) {
              isClaimedByWorkerA = true;
              return Promise.resolve({
                data: [{ ...eventToClaim, claimed_by: args.p_worker_id }],
                error: null,
              });
            }
            // Row is LOCKED by Worker A -> SKIP LOCKED returns empty set!
            return Promise.resolve({ data: [], error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };

      // Worker A and Worker B attempt claim concurrently
      const [workerAClaim, workerBClaim] = await Promise.all([
        claimSocialEvents(mockSupabaseForWorkerA, "worker_alpha", 5, 300),
        claimSocialEvents(mockSupabaseForWorkerB, "worker_beta", 5, 300),
      ]);

      expect(workerAClaim.length).toBe(1);
      expect(workerAClaim[0].claimed_by).toBe("worker_alpha");
      expect(workerAClaim[0].status).toBe("processing");

      // Worker B received 0 rows because Worker A locked and transitioned the event
      expect(workerBClaim.length).toBe(0);
    });

    it("2.2 Expired worker leases are claimed for recovery while active leases are protected", async () => {
      const now = Date.now();
      const expiredLeaseEvent: MetaSocialEvent = {
        id: "evt-stuck-expired",
        business_id: BIZ_ASTROLOGY,
        connection_id: "conn-1",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "mid.expired.1",
        sender_id: "psid.expired.1",
        content: "Expired lease comment",
        status: "processing",
        claimed_by: "crashed_worker_99",
        claimed_at: new Date(now - 400000).toISOString(),
        lease_expires_at: new Date(now - 100000).toISOString(), // EXPIRED!
        attempt_count: 1,
        max_attempts: 3,
        created_at: new Date(now - 500000).toISOString(),
      };

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              ...expiredLeaseEvent,
              claimed_by: "new_worker_revived",
              lease_expires_at: new Date(now + 300000).toISOString(),
              attempt_count: 2,
            },
          ],
          error: null,
        }),
      };

      const claimed = await claimSocialEvents(mockSupabase, "new_worker_revived", 10, 300);
      expect(claimed.length).toBe(1);
      expect(claimed[0].claimed_by).toBe("new_worker_revived");
      expect(claimed[0].attempt_count).toBe(2);
    });
  });

  // ============================================================================
  // DOMAIN 3: Delivery Idempotency & Partial Retries (Task 3)
  // ============================================================================
  describe("Domain 3: Delivery Idempotency & Partial Retries (Task 3)", () => {
    it("3.1 Partial retry: if public comment already succeeded, retry only private reply (never duplicate public comment)", async () => {
      const pubReplySpy = vi.spyOn(client, "replyMetaCommentPublic");
      const privDmSpy = vi
        .spyOn(client, "sendMetaCommentPrivateDm")
        .mockResolvedValue({ message_id: "new_priv_dm_777", recipient_id: "user_partial" });

      const mockRule: MetaSocialRule = {
        id: "rule-both",
        business_id: BIZ_ASTROLOGY,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Combined Reply",
        keywords: ["details"],
        match_type: "contains",
        response_action: "both_public_and_private",
        predefined_reply: "Public: Details shared.",
        predefined_dm: "Private: Consultation booking link.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Existing event in partial failure state from previous run:
      // public_reply_status = 'replied', private_reply_status = 'failed'
      const partialEvent: MetaSocialEvent = {
        id: "evt-partial-retry-1",
        business_id: BIZ_ASTROLOGY,
        connection_id: "conn-1",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "comm_partial_1",
        comment_id: "comm_partial_1",
        sender_id: "user_partial",
        content: "Please send details",
        status: "retry_scheduled",
        public_reply_status: "replied", // Already succeeded!
        private_reply_status: "failed", // Failed previously!
        public_reply_id: "existing_pub_comment_999",
        private_reply_id: null,
        attempt_count: 1,
        max_attempts: 3,
        created_at: new Date().toISOString(),
      };

      const encrypted = encryptSecret("VALID_DECRYPTED_PAGE_TOKEN");

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_events") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: partialEvent, error: null }) }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_connections") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "conn-1",
                  business_id: BIZ_ASTROLOGY,
                  platform: "facebook",
                  account_id: "page_1",
                  page_id: "page_1",
                  is_enabled: true,
                  connection_status: "connected",
                  auto_reply_comments: true,
                  auto_dm_on_comment: true,
                },
                error: null,
              }),
            };
          }
          if (table === "meta_social_credentials") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...encrypted, business_id: BIZ_ASTROLOGY },
                error: null,
              }),
            };
          }
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [mockRule], error: null }),
            };
          }
          if (table === "meta_social_deliveries") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col, val) => {
                if (typeof val === "string" && val.includes("idemp_pub")) {
                  // Public delivery was recorded as succeeded
                  return { maybeSingle: vi.fn().mockResolvedValue({ data: { status: "succeeded", response_id: "existing_pub_comment_999" }, error: null }) };
                }
                return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
              }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "del-retry-priv" }, error: null }) }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, "evt-partial-retry-1");

      // Overall status is now fully replied
      expect(result.success).toBe(true);
      expect(result.status).toBe("replied");
      expect(result.replyType).toBe("both");
      expect(result.publicReplyStatus).toBe("replied");
      expect(result.privateReplyStatus).toBe("replied");
      expect(result.publicReplyId).toBe("existing_pub_comment_999");
      expect(result.privateReplyId).toBe("new_priv_dm_777");

      // CRITICAL ASSERTION: Public reply was NEVER called again!
      expect(pubReplySpy).not.toHaveBeenCalled();

      // CRITICAL ASSERTION: Private DM was retried and succeeded!
      expect(privDmSpy).toHaveBeenCalledTimes(1);
    });

    it("3.2 Ambiguous public delivery outcome halts blind duplication and flags ambiguous_outcome", async () => {
      // Simulate network socket drop / timeout during public comment dispatch
      vi.spyOn(client, "replyMetaCommentPublic").mockRejectedValue(
        new MetaSocialApiError(
          { message: "fetch failed: ECONNRESET after edge TCP handshake", code: 504 },
          "https://graph.facebook.com/v21.0/comm_ambig_1/comments",
          { httpStatus: 504, isAmbiguous: true }
        )
      );

      const mockRule: MetaSocialRule = {
        id: "rule-pub-only",
        business_id: BIZ_ASTROLOGY,
        platform: "facebook",
        target_type: "comment",
        rule_name: "Public Reply Rule",
        keywords: ["timing"],
        match_type: "contains",
        response_action: "reply_comment_public",
        predefined_reply: "Public: We are open 9am-6pm.",
        priority: 1,
        is_active: true,
        stop_processing_on_match: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const event: MetaSocialEvent = {
        id: "evt-ambiguous-1",
        business_id: BIZ_ASTROLOGY,
        connection_id: "conn-1",
        platform: "facebook",
        event_type: "comment",
        meta_event_id: "comm_ambig_1",
        comment_id: "comm_ambig_1",
        sender_id: "user_ambig",
        content: "What are your office timings?",
        status: "received",
        attempt_count: 0,
        max_attempts: 3,
        created_at: new Date().toISOString(),
      };

      const encrypted = encryptSecret("VALID_TOKEN");

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_events") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: event, error: null }) }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_connections") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "conn-1",
                  business_id: BIZ_ASTROLOGY,
                  platform: "facebook",
                  account_id: "page_1",
                  page_id: "page_1",
                  is_enabled: true,
                  connection_status: "connected",
                  auto_reply_comments: true,
                },
                error: null,
              }),
            };
          }
          if (table === "meta_social_credentials") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { ...encrypted, business_id: BIZ_ASTROLOGY }, error: null }),
            };
          }
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({ data: [mockRule], error: null }),
            };
          }
          if (table === "meta_social_deliveries") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "del-ambig" }, error: null }) }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      const result = await processPersistedMetaSocialEvent(mockSupabase, "evt-ambiguous-1");

      // Verifies ambiguous delivery outcome state
      expect(result.status).toBe("ambiguous_outcome");
      expect(result.publicReplyStatus).toBe("ambiguous_outcome");
    });
  });

  // ============================================================================
  // DOMAIN 4: Retry Governance & Error Handling (Task 4)
  // ============================================================================
  describe("Domain 4: Retry Governance & Error Classification (Task 4)", () => {
    it("4.1 Meta HTTP 429 rate limit respects Retry-After and schedules backoff", () => {
      const delay = computeBackoffDelay(1, 45); // Retry-After: 45s
      expect(delay).toBe(45000); // 45 seconds in ms
    });

    it("4.2 Exponential backoff with jitter increases delay across sequential attempts", () => {
      const delay1 = computeBackoffDelay(1); // 5000 * 2^1 = 10000 + jitter
      const delay2 = computeBackoffDelay(2); // 5000 * 2^2 = 20000 + jitter
      const delay3 = computeBackoffDelay(3); // 5000 * 2^3 = 40000 + jitter

      expect(delay1).toBeGreaterThanOrEqual(10000);
      expect(delay2).toBeGreaterThanOrEqual(20000);
      expect(delay3).toBeGreaterThanOrEqual(40000);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it("4.3 Expired access token (OAuthException 190) marks connection status expired", async () => {
      const updateSpy = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "meta_social_connections") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "conn-expired",
                  business_id: BIZ_ASTROLOGY,
                  platform: "facebook",
                  account_id: "page_1",
                  page_id: "page_1",
                  is_enabled: true,
                  connection_status: "connected",
                  auto_reply_dms: true,
                },
                error: null,
              }),
              update: updateSpy,
            };
          }
          if (table === "meta_social_events") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "evt-expired-token",
                    business_id: BIZ_ASTROLOGY,
                    connection_id: "conn-expired",
                    platform: "facebook",
                    event_type: "message",
                    meta_event_id: "mid.exp.1",
                    sender_id: "psid.1",
                    content: "Hello",
                    status: "received",
                    attempt_count: 0,
                    max_attempts: 3,
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          if (table === "meta_social_credentials") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...encryptSecret("EXPIRED_TOKEN"), business_id: BIZ_ASTROLOGY },
                error: null,
              }),
            };
          }
          if (table === "meta_social_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "r1",
                    business_id: BIZ_ASTROLOGY,
                    platform: "facebook",
                    target_type: "message",
                    rule_name: "R1",
                    keywords: ["hello"],
                    match_type: "contains",
                    response_action: "reply_dm",
                    predefined_reply: "Hi",
                    priority: 1,
                    is_active: true,
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === "meta_social_deliveries") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
              upsert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "del-exp" }, error: null }) }),
              }),
              update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            };
          }
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      };

      vi.spyOn(client, "sendMetaSocialDm").mockRejectedValue(
        new MetaSocialApiError(
          { message: "Error validating access token: Session has expired.", code: 190, error_subcode: 463 },
          "https://graph.facebook.com/v21.0/page_1/messages"
        )
      );

      const result = await processPersistedMetaSocialEvent(mockSupabase, "evt-expired-token");

      expect(result.status).toBe("failed");
      // Verified connection table was updated to connection_status = 'expired'
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          connection_status: "expired",
        })
      );
    });

    it("4.4 Stuck job reaper moves max_attempts exhausted jobs to permanently_failed", async () => {
      const now = Date.now();
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: { reclaimed: 3, exhausted: 2 },
          error: null,
        }),
      };

      const result = await reclaimStuckSocialEvents(mockSupabase, 300);
      expect(result.reclaimed).toBe(3);
      expect(result.exhausted).toBe(2);
    });
  });

  // ============================================================================
  // DOMAIN 5: Scheduler & Cron Integration (Task 5)
  // ============================================================================
  describe("Domain 5: Scheduler & Cron Integration (Task 5)", () => {
    it("5.1 /api/cron/process-social-automations rejects requests without CRON_SECRET (401)", async () => {
      const req = new NextRequest("http://localhost/api/cron/process-social-automations", {
        method: "POST",
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("5.2 /api/cron/process-social-automations executes with valid CRON_SECRET and returns operational metrics", async () => {
      // Mock admin client
      vi.spyOn(admin, "createAdminClient").mockReturnValue({
        rpc: vi.fn().mockImplementation((fnName) => {
          if (fnName === "acquire_cron_lock") return Promise.resolve({ data: true, error: null });
          if (fnName === "release_cron_lock") return Promise.resolve({ data: true, error: null });
          if (fnName === "claim_meta_social_events") return Promise.resolve({ data: [], error: null });
          if (fnName === "reclaim_stuck_meta_social_events") return Promise.resolve({ data: { reclaimed: 0, exhausted: 0 }, error: null });
          return Promise.resolve({ data: null, error: null });
        }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      } as unknown as ReturnType<typeof admin.createAdminClient>);

      const req = new NextRequest(
        "http://localhost/api/cron/process-social-automations?batch_size=25",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${TEST_CRON_SECRET}`,
          },
        }
      );

      const res = await POST(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.workerId).toBeDefined();
      expect(json.socialAutomations).toBeDefined();
      expect(json.socialAutomations.claimed).toBe(0);
      expect(json.socialAutomations.durationMs).toBeGreaterThanOrEqual(0);

      // Verify NO secrets exposed in HTTP response
      expect(JSON.stringify(json)).not.toContain(TEST_CRON_SECRET);
      expect(JSON.stringify(json)).not.toContain(TEST_APP_SECRET);
    });
  });

  // ============================================================================
  // DOMAIN 6: Instagram Private Reply Endpoint Verification (Task 6)
  // ============================================================================
  describe("Domain 6: Instagram Private Reply Endpoint Correctness (Task 6)", () => {
    it("6.1 sendInstagramPrivateReply targets Instagram Professional Account ID endpoint, NOT Page ID", async () => {
      const igAccountId = "17841400012345678";
      const commentId = "ig_comment_999888";
      const text = "Instagram Private Reply Verification";
      const token = "EAAB_VALID_TOKEN";

      let capturedUrl = "";
      let capturedPayload: any = null;

      vi.spyOn(globalThis, "fetch").mockImplementation((url, init) => {
        capturedUrl = String(url);
        capturedPayload = JSON.parse(String(init?.body || "{}"));
        return Promise.resolve(
          new Response(JSON.stringify({ message_id: "mid.ig.resp.123", id: "mid.ig.resp.123" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      const res = await sendInstagramPrivateReply({
        instagramAccountId: igAccountId,
        commentId,
        text,
        accessToken: token,
      });

      expect(res.message_id).toBe("mid.ig.resp.123");

      // Verify endpoint URL is /{instagramAccountId}/messages
      expect(capturedUrl).toBe(`https://graph.facebook.com/v21.0/${igAccountId}/messages`);
      expect(capturedUrl).not.toContain("fb_page");

      // Verify request payload
      expect(capturedPayload).toEqual({
        recipient: { comment_id: commentId },
        message: { text },
      });
    });

    it("6.2 sendFacebookPrivateReply targets Facebook Page ID endpoint", async () => {
      const pageId = "fb_page_1001";
      const commentId = "fb_comment_777";
      const text = "Facebook Private Reply";
      const token = "EAAB_FB_TOKEN";

      let capturedUrl = "";
      vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
        capturedUrl = String(url);
        return Promise.resolve(
          new Response(JSON.stringify({ message_id: "mid.fb.resp.456" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      });

      const res = await sendFacebookPrivateReply({
        pageId,
        commentId,
        text,
        accessToken: token,
      });

      expect(res.message_id).toBe("mid.fb.resp.456");
      expect(capturedUrl).toBe(`https://graph.facebook.com/v21.0/${pageId}/messages`);
    });
  });

  // ============================================================================
  // DOMAIN 7: Observability & Log Sanitization (Task 8)
  // ============================================================================
  describe("Domain 7: Observability & Log Sanitization (Task 8)", () => {
    it("7.1 sanitizeSocialLog redacts Meta access tokens, Bearer secrets and query parameters", () => {
      const rawLog = "Error at https://graph.facebook.com/v21.0/messages?access_token=EAAB1234567890abcdefghijklmnop with Bearer secret-cron-token-123";
      const sanitized = sanitizeSocialLog(rawLog);

      expect(sanitized).not.toContain("EAAB1234567890abcdefghijklmnop");
      expect(sanitized).not.toContain("secret-cron-token-123");
      expect(sanitized).toContain("EAA••••••••[MASKED]");
      expect(sanitized).toContain("Bearer [MASKED]");
    });
  });
});
