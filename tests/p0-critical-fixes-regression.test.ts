import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { retrieveAndPersistInboundMedia } from "@/lib/whatsapp/media-fetcher";
import { getStoredMediaFile, clearInMemoryMediaStore, storeMediaFile } from "@/lib/media/storage";
import { getOrCreateConversationForContactDb } from "@/lib/crm/database";
import { matchFlowTrigger, evaluateVisualFlow, getPublishedFlowsForBusiness } from "@/lib/flows/evaluator";
import { VisualFlow } from "@/types/flows";
import { processInboundAutomation } from "@/lib/automation/dispatcher";
import { dispatchSingleCampaignRecipient, processCampaignsBatch } from "@/lib/campaigns/worker";
import { launchCampaignDb, pauseCampaignDb, resumeCampaignDb, cancelCampaignDb } from "@/lib/campaigns/database";
import { WhatsAppCampaign, WhatsAppCampaignRecipient } from "@/types/database";

describe("Milestone P0 — Critical Integration Fixes & Regression Suite", () => {
  const ASTRO_BIZ_ID = "11111111-1111-1111-1111-111111111111";
  const VIVAHAM_BIZ_ID = "22222222-2222-2222-2222-222222222222";
  const ROGUE_BIZ_ID = "99999999-9999-9999-9999-999999999999";

  const ASTRO_CONN_LINE_1 = "33333333-3333-3333-3333-333333333331";
  const ASTRO_CONN_LINE_2 = "33333333-3333-3333-3333-333333333332";
  const VIVAHAM_CONN_LINE = "44444444-4444-4444-4444-444444444444";

  // ==========================================================================
  // DOMAIN 1: CLEAN-SLATE MIGRATION REPLAY (001–022 on PGlite)
  // ==========================================================================
  describe("Domain 1: Clean-Slate Migration Replay (001–022)", () => {
    let db: PGlite;
    const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

    beforeAll(async () => {
      db = new PGlite();

      // Mocks for Supabase auth schema and roles
      await db.exec(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            CREATE ROLE anon;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            CREATE ROLE authenticated;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            CREATE ROLE service_role;
          END IF;
        END $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
          SELECT '00000000-0000-0000-0000-000000000001'::uuid;
        $$;
        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
          SELECT '{"role": "service_role"}'::jsonb;
        $$;
      `);

      const sqlFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      // Confirm migrations 016 through 022 exist in directory
      expect(sqlFiles.some((f) => f.includes("016"))).toBe(true);
      expect(sqlFiles.some((f) => f.includes("017"))).toBe(true);
      expect(sqlFiles.some((f) => f.includes("018"))).toBe(true);
      expect(sqlFiles.some((f) => f.includes("019"))).toBe(true);
      expect(sqlFiles.some((f) => f.includes("020"))).toBe(true);
      expect(sqlFiles.some((f) => f.includes("021"))).toBe(true);
      expect(sqlFiles.some((f) => f.includes("022"))).toBe(true);

      for (const file of sqlFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
        await db.exec(sql);
      }
    });

    it("1.1 Confirms all 22 database migrations replay cleanly and creates all tables", async () => {
      const res = await db.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);

      const tables = res.rows.map((r: any) => r.table_name);
      const expectedTables = [
        "businesses",
        "business_members",
        "business_settings",
        "wa_connections",
        "wa_credentials",
        "wa_contacts",
        "wa_conversations",
        "wa_messages",
        "wa_message_templates",
        "wa_webhook_events",
        "wa_processing_jobs",
        "wa_automation_rules",
        "wa_automation_execution_logs",
        "business_invitations",
        "team_activity_logs",
        "conversation_assignment_logs",
        "wa_media_files",
        "wa_scheduled_messages",
        "wa_campaigns",
        "wa_campaign_recipients",
        "crm_lifecycle_stages",
        "contact_lifecycle_history",
        "crm_follow_ups",
        "crm_follow_up_reminders",
        "user_notification_preferences",
        "wa_visual_flows",
      ];

      for (const expected of expectedTables) {
        expect(tables).toContain(expected);
      }
    });

    it("1.2 Confirms tenant immutability triggers on wa_media_files, wa_campaigns, and wa_visual_flows", async () => {
      const triggersRes = await db.query(`
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND trigger_name LIKE '%immutable%';
      `);

      const triggerTables = triggersRes.rows.map((r: any) => r.event_object_table);
      expect(triggerTables).toContain("wa_media_files");
      expect(triggerTables).toContain("wa_campaigns");
      expect(triggerTables).toContain("wa_campaign_recipients");
      expect(triggerTables).toContain("wa_visual_flows");
      expect(triggerTables).toContain("crm_follow_ups");
    });
  });

  // ==========================================================================
  // DOMAIN 2: INCOMING WHATSAPP MEDIA RETRIEVAL & RETRY
  // ==========================================================================
  describe("Domain 2: Incoming WhatsApp Media Retrieval & Storage", () => {
    beforeEach(() => {
      clearInMemoryMediaStore();
      vi.restoreAllMocks();
    });

    it("2.1 Downloads incoming image, stores in private storage, and updates message", async () => {
      const fakeImageBytes = Buffer.from("RIFFfake-webp-image-bytes-header");
      const fakeMediaUrl = "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=media_img_101";

      // Mock fetch for Meta Graph API & media download
      const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes("graph.facebook.com") && urlStr.includes("media_img_101")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: "media_img_101",
              url: fakeMediaUrl,
              mime_type: "image/webp",
              file_size: fakeImageBytes.length,
            }),
          } as any;
        }

        if (urlStr.includes("lookaside.fbsbx.com")) {
          const slice = fakeImageBytes.buffer.slice(
            fakeImageBytes.byteOffset,
            fakeImageBytes.byteOffset + fakeImageBytes.byteLength
          );
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => slice,
          } as any;
        }

        return { ok: false, status: 404 } as any;
      });

      // Mock Supabase client
      const mockMessage = {
        id: "msg_inbound_img_01",
        business_id: ASTRO_BIZ_ID,
        connection_id: ASTRO_CONN_LINE_1,
        conversation_id: "conv_astro_01",
        message_type: "image",
        media_type: "image",
        media_id: "media_img_101",
        file_name: null,
        file_size: null,
        mime_type: null,
        storage_path: null,
        download_status: "pending",
        raw_payload: { image: { id: "media_img_101", mime_type: "image/webp" } },
      };

      let updatedFields: any = null;
      let mediaFilesUpserted: any = null;

      const mockSupabase = {
        from: (table: string) => {
          if (table === "wa_messages") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: mockMessage, error: null }),
                  }),
                }),
              }),
              update: (fields: any) => {
                updatedFields = fields;
                return {
                  eq: () => ({
                    eq: async () => ({ data: null, error: null }),
                  }),
                };
              },
            };
          }
          if (table === "wa_media_files") {
            return {
              upsert: async (row: any) => {
                mediaFilesUpserted = row;
                return { data: null, error: null };
              },
              update: () => ({
                eq: () => ({ eq: async () => ({ data: null, error: null }) }),
              }),
            };
          }
          if (table === "wa_connections") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { id: ASTRO_CONN_LINE_1, display_name: "Astrology Primary" },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const result = await retrieveAndPersistInboundMedia(
        ASTRO_BIZ_ID,
        "msg_inbound_img_01",
        {
          supabaseClient: mockSupabase,
          overrideAccessToken: "test-meta-token-xyz",
        }
      );

      expect(result.success).toBe(true);
      expect(result.storagePath).toContain(`businesses/${ASTRO_BIZ_ID}/conversations/conv_astro_01/`);
      expect(updatedFields).not.toBeNull();
      expect(updatedFields.download_status).toBe("downloaded");
      expect(updatedFields.storage_path).toBe(result.storagePath);
      expect(updatedFields.media_url).toBeNull(); // Never expose temporary Meta URL directly

      expect(mediaFilesUpserted).not.toBeNull();
      expect(mediaFilesUpserted.download_status).toBe("downloaded");
      expect(mediaFilesUpserted.meta_media_id).toBe("media_img_101");

      // Verify file is readable from private tenant storage
      const stored = await getStoredMediaFile(ASTRO_BIZ_ID, result.storagePath!);
      expect(stored.buffer.length).toBe(fakeImageBytes.length);

      fetchSpy.mockRestore();
    });

    it("2.2 Prevents duplicate downloads if message is already downloaded", async () => {
      const mockMessage = {
        id: "msg_already_downloaded",
        business_id: ASTRO_BIZ_ID,
        connection_id: ASTRO_CONN_LINE_1,
        conversation_id: "conv_astro_01",
        message_type: "image",
        media_type: "image",
        media_id: "media_img_101",
        file_name: "image_01.webp",
        file_size: 1024,
        mime_type: "image/webp",
        storage_path: `businesses/${ASTRO_BIZ_ID}/conversations/conv_astro_01/file-image_01.webp`,
        download_status: "downloaded",
      };

      const fetchSpy = vi.spyOn(global, "fetch");

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockMessage, error: null }),
              }),
            }),
          }),
        }),
      };

      const result = await retrieveAndPersistInboundMedia(
        ASTRO_BIZ_ID,
        "msg_already_downloaded",
        {
          supabaseClient: mockSupabase,
          overrideAccessToken: "token-123",
        }
      );

      expect(result.success).toBe(true);
      expect(result.alreadyDownloaded).toBe(true);
      expect(result.storagePath).toBe(mockMessage.storage_path);
      // No external Meta fetch should have occurred
      expect(fetchSpy).not.toHaveBeenCalled();

      fetchSpy.mockRestore();
    });

    it("2.3 Retries transient failures with backoff and sanitizes errors without leaking tokens", async () => {
      const sensitiveToken = "EAAGK_super_sensitive_meta_token_SECRET999";
      let callCount = 0;

      const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async () => {
        callCount++;
        // Simulate transient network failures
        throw new Error(`Connection timeout with Bearer ${sensitiveToken}`);
      });

      let updatedMessageFields: any = null;
      const mockSupabase = {
        from: (table: string) => {
          if (table === "wa_messages") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: {
                        id: "msg_fail_retry",
                        business_id: ASTRO_BIZ_ID,
                        connection_id: ASTRO_CONN_LINE_1,
                        conversation_id: "conv_01",
                        message_type: "document",
                        media_id: "meta_doc_999",
                        download_status: "pending",
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
              update: (f: any) => {
                updatedMessageFields = f;
                return { eq: () => ({ eq: async () => ({}) }) };
              },
            };
          }
          return {
            update: () => ({ eq: () => ({ eq: async () => ({}) }) }),
          };
        },
      };

      const result = await retrieveAndPersistInboundMedia(
        ASTRO_BIZ_ID,
        "msg_fail_retry",
        {
          supabaseClient: mockSupabase,
          maxRetries: 3,
          overrideAccessToken: sensitiveToken,
        }
      );

      expect(result.success).toBe(false);
      expect(callCount).toBe(3); // Attempted 3 retries
      expect(updatedMessageFields).not.toBeNull();
      expect(updatedMessageFields.download_status).toBe("failed");
      // Must NOT contain sensitive token in error message!
      expect(updatedMessageFields.media_error).not.toContain(sensitiveToken);
      expect(updatedMessageFields.media_error).toContain("[REDACTED]");

      fetchSpy.mockRestore();
    });
  });

  // ==========================================================================
  // DOMAIN 3: MULTI-NUMBER CONVERSATION RESOLUTION
  // ==========================================================================
  describe("Domain 3: Multi-Number Conversation Handling", () => {
    it("3.1 Resolves distinct conversations for the same contact communicating on two WhatsApp lines", async () => {
      const contactId = "contact-ram-kumar-01";
      const convLine1Id = "conv-line-1-id";
      const convLine2Id = "conv-line-2-id";

      // Mock database state with 2 connections and 2 conversations for the same contact
      const mockConversations: any[] = [
        {
          id: convLine1Id,
          business_id: ASTRO_BIZ_ID,
          connection_id: ASTRO_CONN_LINE_1,
          contact_id: contactId,
          status: "open",
          last_message_at: "2026-11-09T10:00:00Z",
        },
        {
          id: convLine2Id,
          business_id: ASTRO_BIZ_ID,
          connection_id: ASTRO_CONN_LINE_2,
          contact_id: contactId,
          status: "open",
          last_message_at: "2026-11-09T11:00:00Z",
        },
      ];

      const mockConnections: any[] = [
        { id: ASTRO_CONN_LINE_1, business_id: ASTRO_BIZ_ID, is_enabled: true },
        { id: ASTRO_CONN_LINE_2, business_id: ASTRO_BIZ_ID, is_enabled: true },
      ];

      const mockClient = {
        from: (table: string) => {
          if (table === "wa_connections") {
            return {
              select: () => ({
                eq: (_col: string, val: string) => ({
                  maybeSingle: async () => ({
                    data: mockConnections.find((c) => c.id === val),
                    error: null,
                  }),
                  eq: (_col2: string, val2: any) => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: mockConnections.find((c) => c.business_id === val && c.is_enabled === val2),
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "wa_conversations") {
            return {
              select: () => {
                let filtered = [...mockConversations];
                const builder: any = {
                  eq: (col: string, val: string) => {
                    filtered = filtered.filter((c) => c[col] === val);
                    return builder;
                  },
                  order: () => builder,
                  limit: (num: number) => ({
                    data: filtered.slice(0, num),
                    error: null,
                  }),
                };
                return builder;
              },
            };
          }
          return {};
        },
      };

      // 1. Lookup for Line 1 specifically
      const resLine1 = await getOrCreateConversationForContactDb(ASTRO_BIZ_ID, contactId, {
        connectionId: ASTRO_CONN_LINE_1,
        client: mockClient,
      });
      expect(resLine1.conversationId).toBe(convLine1Id);

      // 2. Lookup for Line 2 specifically
      const resLine2 = await getOrCreateConversationForContactDb(ASTRO_BIZ_ID, contactId, {
        connectionId: ASTRO_CONN_LINE_2,
        client: mockClient,
      });
      expect(resLine2.conversationId).toBe(convLine2Id);

      // They must be different conversation threads
      expect(resLine1.conversationId).not.toBe(resLine2.conversationId);
    });

    it("3.2 Rejects cross-business connection mismatch when creating conversation", async () => {
      const contactId = "contact-cross-tenant-test";

      const mockClient = {
        from: (table: string) => {
          if (table === "wa_connections") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    // Connection belongs to Vivaham, NOT Astrology!
                    data: { id: VIVAHAM_CONN_LINE, business_id: VIVAHAM_BIZ_ID, is_enabled: true },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      // Attempting to create an Astrology conversation using a Vivaham connection must be rejected!
      await expect(
        getOrCreateConversationForContactDb(ASTRO_BIZ_ID, contactId, {
          connectionId: VIVAHAM_CONN_LINE,
          client: mockClient,
        })
      ).rejects.toThrow(/Cross-business connection violation/);
    });
  });

  // ==========================================================================
  // DOMAIN 4: VISUAL FLOW RUNTIME EVALUATION & PRECEDENCE
  // ==========================================================================
  describe("Domain 4: Visual Flow Runtime Worker Integration", () => {
    const publishedAstrologyFlow: VisualFlow = {
      id: "flow-astro-consultation",
      business_id: ASTRO_BIZ_ID,
      name: "KP Consultation Intake Flow",
      description: "Intake birth details",
      trigger_keyword: "jathagam",
      status: "published",
      flow_type: "intake",
      nodes: [
        {
          id: "trg-1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            title: "Keyword Trigger",
            config: {
              keywords: ["jathagam", "horoscope", "ஜாதகம்"],
              matchType: "contains",
            },
          },
        },
        {
          id: "msg-welcome",
          type: "message",
          position: { x: 200, y: 0 },
          data: {
            title: "Welcome Message",
            config: {
              messageText: "Vanakkam! Welcome to Gokul's Astrological Insights. Please share your birth details.",
            },
          },
        },
        {
          id: "cond-hours",
          type: "condition",
          position: { x: 400, y: 0 },
          data: {
            title: "Business Hours Check",
            config: {
              conditionType: "business_hours",
              operator: "in_hours",
            },
          },
        },
        {
          id: "act-assign",
          type: "action",
          position: { x: 600, y: 0 },
          data: {
            title: "Assign Astrologer",
            config: {
              actionType: "assign_agent",
              agentName: "Gokul Astrologer",
              crmStage: "qualified",
            },
          },
        },
      ],
      edges: [
        { id: "e1", source: "trg-1", target: "msg-welcome" },
        { id: "e2", source: "msg-welcome", target: "cond-hours" },
        { id: "e3", source: "cond-hours", sourceHandle: "true", target: "act-assign", label: "During Hours" },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const draftFlow: VisualFlow = {
      ...publishedAstrologyFlow,
      id: "flow-draft-only",
      status: "draft",
    };

    it("4.1 Matches trigger keyword case-insensitively and in Tamil", () => {
      expect(matchFlowTrigger(publishedAstrologyFlow, "Can I get my Jathagam checked?")).not.toBeNull();
      expect(matchFlowTrigger(publishedAstrologyFlow, "எனக்கு ஜாதகம் பார்க்க வேண்டும்")).not.toBeNull();
      expect(matchFlowTrigger(publishedAstrologyFlow, "Just checking random text")).toBeNull();
    });

    it("4.2 Never matches or executes draft or disabled flows", () => {
      expect(matchFlowTrigger(draftFlow, "jathagam")).toBeNull();

      const disabledFlow: VisualFlow = { ...publishedAstrologyFlow, is_active: false };
      expect(matchFlowTrigger(disabledFlow, "jathagam")).toBeNull();
    });

    it("4.3 Executes supported flow nodes deterministically and traverses conditions", () => {
      const mockContact: any = {
        id: "cnt-1",
        business_id: ASTRO_BIZ_ID,
        phone_number: "919444559071",
        last_inbound_at: new Date().toISOString(),
      };
      const mockConversation: any = {
        id: "conv-1",
        business_id: ASTRO_BIZ_ID,
        connection_id: ASTRO_CONN_LINE_1,
        status: "open",
      };

      const result = evaluateVisualFlow({
        flow: publishedAstrologyFlow,
        messageContent: "Vanakkam, I want jathagam review",
        contact: mockContact,
        conversation: mockConversation,
        now: new Date("2026-11-09T10:00:00Z"), // Monday 3:30 PM IST (in hours)
      });

      expect(result.matched).toBe(true);
      expect(result.executedNodeIds).toContain("trg-1");
      expect(result.executedNodeIds).toContain("msg-welcome");
      expect(result.actionsToDispatch.length).toBeGreaterThanOrEqual(1);
      expect(result.actionsToDispatch[0].payload.message_text).toContain("Welcome to Gokul's Astrological Insights");
      expect(result.conversationUpdates?.assigned_agent_name).toBe("Gokul Astrologer");
      expect(result.contactUpdates?.lifecycle_stage_slug).toBe("qualified");
    });

    it("4.4 Enforces infinite loop prevention when flow graph contains cycles", () => {
      const cyclicFlow: VisualFlow = {
        ...publishedAstrologyFlow,
        edges: [
          { id: "e1", source: "trg-1", target: "msg-welcome" },
          { id: "e2", source: "msg-welcome", target: "trg-1" }, // Cycle back to trigger!
        ],
      };

      const result = evaluateVisualFlow({
        flow: cyclicFlow,
        messageContent: "jathagam",
        contact: {} as any,
        conversation: {} as any,
      });

      expect(result.matched).toBe(true);
      // Execution must terminate safely without hanging
      expect(result.executedNodeIds.length).toBeLessThan(10);
    });

    it("4.5 Respects Opt-Out keyword STOP and halts visual flows immediately", async () => {
      let contactUpdated = false;
      let logRecorded = false;
      let flowJobInserted = false;

      const mockSupabase = {
        from: (table: string) => {
          if (table === "wa_contacts") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: "cnt-1", business_id: ASTRO_BIZ_ID, phone_number: "919444559071", is_opted_out: false },
                  }),
                }),
              }),
              update: (fields: any) => {
                if (fields.is_opted_out === true) contactUpdated = true;
                return { eq: async () => ({}) };
              },
            };
          }
          if (table === "wa_conversations") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: "conv-1", business_id: ASTRO_BIZ_ID, status: "open" },
                  }),
                }),
              }),
            };
          }
          if (table === "business_settings") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: {} }),
                }),
              }),
            };
          }
          if (table === "wa_visual_flows") {
            return {
              select: () => ({
                eq: () => ({
                  order: async () => ({ data: [publishedAstrologyFlow], error: null }),
                }),
              }),
            };
          }
          if (table === "wa_automation_execution_logs") {
            return {
              insert: async (entry: any) => {
                logRecorded = true;
                return { error: null };
              },
            };
          }
          if (table === "wa_processing_jobs") {
            return {
              insert: async (job: any) => {
                // If a visual flow was executed, payload would contain flow_id
                if (job?.payload?.flow_id) {
                  flowJobInserted = true;
                }
                return { error: null };
              },
            };
          }
          return {};
        },
      };

      await processInboundAutomation(mockSupabase, {
        businessId: ASTRO_BIZ_ID,
        connectionId: ASTRO_CONN_LINE_1,
        conversationId: "conv-1",
        contactId: "cnt-1",
        messageId: "msg-optout-01",
        messageContent: "STOP",
        messageType: "text",
      });

      expect(contactUpdated).toBe(true);
      expect(logRecorded).toBe(true);
      expect(flowJobInserted).toBe(false); // Visual flow was safely bypassed
    });
  });

  // ==========================================================================
  // DOMAIN 5: DURABLE CAMPAIGN WORKER DISPATCH & LIFECYCLE
  // ==========================================================================
  describe("Domain 5: Reliable Campaign Worker Dispatch & Lifecycle", () => {
    it("5.1 Enqueues durable process_campaign job when campaign is launched", async () => {
      let jobInserted: any = null;
      let campaignUpdated: any = null;

      const mockCampaign: WhatsAppCampaign = {
        id: "camp-launch-01",
        business_id: ASTRO_BIZ_ID,
        name: "Diwali Special Campaign",
        description: null,
        message_type: "text",
        template_id: null,
        template_name: null,
        template_language: "en_US",
        template_variables: {},
        message_content: "Special festive wishes from Gokul Astrological Insights!",
        media_type: null,
        media_storage_path: null,
        media_filename: null,
        media_file_size: null,
        media_mime_type: null,
        media_caption: null,
        media_meta_id: null,
        connection_id: ASTRO_CONN_LINE_1,
        scheduled_at: null,
        timezone: "Asia/Kolkata",
        status: "draft",
        audience_type: "all_contacts",
        audience_filters: {},
        audience_count: 5,
        eligible_count: 5,
        excluded_count: 0,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        batch_size: 50,
        dispatch_interval_ms: 1000,
        locked_at: null,
        locked_by: null,
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        paused_at: null,
        created_by: null,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: (table: string) => {
          if (table === "wa_campaigns") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: mockCampaign, error: null }),
                  }),
                }),
              }),
              update: (fields: any) => {
                campaignUpdated = fields;
                return {
                  eq: () => ({
                    eq: () => ({
                      select: () => ({
                        single: async () => ({ data: { ...mockCampaign, ...fields }, error: null }),
                      }),
                    }),
                  }),
                };
              },
            };
          }
          if (table === "wa_processing_jobs") {
            return {
              upsert: async (job: any) => {
                jobInserted = job;
                return { error: null };
              },
            };
          }
          return {};
        },
      };

      const res = await launchCampaignDb(ASTRO_BIZ_ID, "camp-launch-01", mockSupabase);
      expect(res.status).toBe("queued");
      expect(campaignUpdated.status).toBe("queued");
      expect(jobInserted).not.toBeNull();
      expect(jobInserted.job_type).toBe("process_campaign");
      expect(jobInserted.idempotency_key).toBe("campaign_dispatch_camp-launch-01");
      expect(jobInserted.status).toBe("pending");
    });

    it("5.2 Cancels pending queue job when campaign is paused or cancelled", async () => {
      let jobCancelled = false;

      const mockRunningCampaign = {
        id: "camp-pause-01",
        business_id: ASTRO_BIZ_ID,
        connection_id: ASTRO_CONN_LINE_1,
        status: "queued",
        eligible_count: 10,
        audience_count: 10,
      };

      const mockSupabase = {
        from: (table: string) => {
          if (table === "wa_campaigns") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: mockRunningCampaign, error: null }),
                  }),
                }),
              }),
              update: (fields: any) => ({
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      single: async () => ({ data: { ...mockRunningCampaign, ...fields }, error: null }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "wa_processing_jobs") {
            return {
              update: (fields: any) => {
                if (fields.status === "cancelled") jobCancelled = true;
                return { eq: async () => ({}) };
              },
            };
          }
          return {};
        },
      };

      const paused = await pauseCampaignDb(ASTRO_BIZ_ID, "camp-pause-01", mockSupabase);
      expect(paused.status).toBe("paused");
      expect(jobCancelled).toBe(true);
    });

    it("5.3 Skips recipient dispatch if campaign is paused immediately prior to send (Gate 1)", async () => {
      const mockPausedCampaign: WhatsAppCampaign = {
        id: "camp-02",
        business_id: ASTRO_BIZ_ID,
        name: "Test",
        description: null,
        message_type: "text",
        template_id: null,
        template_name: null,
        template_language: "en_US",
        template_variables: {},
        message_content: "Hello",
        media_type: null,
        media_storage_path: null,
        media_filename: null,
        media_file_size: null,
        media_mime_type: null,
        media_caption: null,
        media_meta_id: null,
        connection_id: ASTRO_CONN_LINE_1,
        scheduled_at: null,
        timezone: "Asia/Kolkata",
        status: "paused", // PAUSED!
        audience_type: "all_contacts",
        audience_filters: {},
        audience_count: 1,
        eligible_count: 1,
        excluded_count: 0,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0,
        batch_size: 50,
        dispatch_interval_ms: 1000,
        locked_at: null,
        locked_by: null,
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        paused_at: new Date().toISOString(),
        created_by: null,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockRecipient: WhatsAppCampaignRecipient = {
        id: "recip-01",
        business_id: ASTRO_BIZ_ID,
        campaign_id: "camp-02",
        contact_id: "cnt-01",
        phone_number: "919444559071",
        recipient_name: "Ram",
        status: "pending",
        eligibility_status: "eligible",
        exclusion_reason: null,
        meta_message_id: null,
        message_id: null,
        dispatched_at: null,
        delivered_at: null,
        read_at: null,
        last_error: null,
        retry_count: 0,
        max_retries: 3,
        locked_at: null,
        locked_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await dispatchSingleCampaignRecipient(
        null,
        mockPausedCampaign,
        mockRecipient,
        "worker-test"
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe("skipped");
      expect(result.error).toContain("Campaign was paused before recipient dispatch");
    });
  });
});
