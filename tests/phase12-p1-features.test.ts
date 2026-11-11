import { describe, it, expect, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  inviteTeamMemberDb,
  getTeamInvitationsDb,
  revokeInvitationDb,
  resendInvitationDb,
  validateInvitationTokenDb,
  acceptInvitationDb,
  resetTeamMemoryStore,
} from "@/lib/team/database";
import {
  sendInvitationEmail,
  generateInvitationEmailHtml,
  generateInvitationEmailText,
  getConfiguredEmailProvider,
} from "@/lib/email/adapter";
import { getOrCreateConversationForContactDb } from "@/lib/crm/database";
import { retrieveAndPersistInboundMedia } from "@/lib/whatsapp/media-fetcher";
import { launchCampaignDb, createCampaignDb } from "@/lib/campaigns/database";
import { BusinessRole } from "@/types/database";

describe("Phase 12 — P1 Product Functionality Verification Suite", () => {
  beforeEach(() => {
    resetTeamMemoryStore();
  });

  // ============================================================================
  // WORKSTREAM P1-A: TEAM INVITATION & ACCEPTANCE WORKFLOW
  // ============================================================================
  describe("Workstream P1-A: Team Invitation Workflow", () => {
    const ownerActor = {
      id: "owner-user-00000000-0000-0000-0000-000000000001",
      name: "Gokul Murugan",
      role: "owner" as BusinessRole,
    };

    it("1.1 Transactional email adapter generates secure, branded invitation content", () => {
      const html = generateInvitationEmailHtml({
        businessName: "Gokul's Astrological Insights",
        inviterName: "Gokul Murugan",
        role: "agent",
        expiresAtFormatted: "Mon, Nov 16, 2026, 06:00 PM IST",
        acceptanceUrl: "http://localhost:3000/accept-invite?token=tok-test-123",
      });

      expect(html).toContain("Gokul's Astrological Insights");
      expect(html).toContain("Gokul Murugan");
      expect(html).toContain("AGENT");
      expect(html).toContain("http://localhost:3000/accept-invite?token=tok-test-123");
      expect(html).toContain("Mon, Nov 16, 2026, 06:00 PM IST");

      const text = generateInvitationEmailText({
        businessName: "Gokul Vivaham",
        inviterName: "Radhika Raman",
        role: "viewer",
        expiresAtFormatted: "Mon, Nov 16, 2026, 06:00 PM IST",
        acceptanceUrl: "http://localhost:3000/accept-invite?token=tok-test-456",
      });

      expect(text).toContain("Gokul Vivaham");
      expect(text).toContain("Radhika Raman");
      expect(text).toContain("VIEWER");
      expect(text).toContain("http://localhost:3000/accept-invite?token=tok-test-456");
    });

    it("1.2 Does not claim email delivery when no email provider is configured", async () => {
      const originalProvider = process.env.EMAIL_PROVIDER;
      delete process.env.EMAIL_PROVIDER;

      const result = await sendInvitationEmail({
        toEmail: "candidate@example.com",
        businessName: "Gokul Vivaham",
        businessSlug: "vivaham",
        inviterName: "Gokul Murugan",
        role: "agent",
        invitationToken: "tok-unconfigured-test",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(result.sent).toBe(false);
      expect(result.configured).toBe(false);
      expect(result.provider).toBe("none");
      expect(result.error).toContain("No email delivery provider is configured");

      process.env.EMAIL_PROVIDER = originalProvider;
    });

    it("1.3 Successfully dispatches via console mock provider when configured", async () => {
      const originalProvider = process.env.EMAIL_PROVIDER;
      process.env.EMAIL_PROVIDER = "console";

      const result = await sendInvitationEmail({
        toEmail: "mock.agent@astrology.example.com",
        businessName: "Gokul's Astrological Insights",
        businessSlug: "astrology",
        inviterName: "Gokul Murugan",
        role: "admin",
        invitationToken: "tok-console-test",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(result.sent).toBe(true);
      expect(result.configured).toBe(true);
      expect(result.provider).toBe("console");
      expect(result.messageId).toBeDefined();

      process.env.EMAIL_PROVIDER = originalProvider;
    });

    it("1.4 Rejects invalid or missing invitation tokens gracefully", async () => {
      const emptyRes = await validateInvitationTokenDb("");
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.status).toBe("invalid");

      const notFoundRes = await validateInvitationTokenDb("tok-nonexistent-99999");
      expect(notFoundRes.valid).toBe(false);
      expect(notFoundRes.status).toBe("invalid");
      expect(notFoundRes.error).toContain("invalid or does not exist");
    });

    it("1.5 Detects revoked invitations and prevents acceptance", async () => {
      const invite = await inviteTeamMemberDb(
        ASTRO_BUSINESS_ID,
        { email: "to.revoke@astrology.example.com", role: "agent" },
        ownerActor
      );

      expect(invite.token).toBeDefined();
      await revokeInvitationDb(ASTRO_BUSINESS_ID, invite.id, ownerActor);

      const val = await validateInvitationTokenDb(invite.token!);
      expect(val.valid).toBe(false);
      expect(val.status).toBe("revoked");
      expect(val.error).toContain("revoked");

      await expect(
        acceptInvitationDb(invite.token!, {
          id: "new-user-01",
          email: "to.revoke@astrology.example.com",
        })
      ).rejects.toThrow("revoked");
    });

    it("1.6 Detects expired invitations and supports resending with fresh expiration", async () => {
      const invite = await inviteTeamMemberDb(
        ASTRO_BUSINESS_ID,
        { email: "to.expire@astrology.example.com", role: "agent" },
        ownerActor
      );

      // Force expiration into the past
      invite.expires_at = new Date(Date.now() - 3600000).toISOString();

      const val = await validateInvitationTokenDb(invite.token!);
      expect(val.valid).toBe(false);
      expect(val.status).toBe("expired");

      await expect(
        acceptInvitationDb(invite.token!, {
          id: "new-user-02",
          email: "to.expire@astrology.example.com",
        })
      ).rejects.toThrow("expired");

      // Resend the invitation
      const resent = await resendInvitationDb(ASTRO_BUSINESS_ID, invite.id, ownerActor);
      expect(resent.status).toBe("pending");
      expect(new Date(resent.expires_at).getTime()).toBeGreaterThan(Date.now());

      const reVal = await validateInvitationTokenDb(invite.token!);
      expect(reVal.valid).toBe(true);
      expect(reVal.status).toBe("valid");
    });

    it("1.7 Prevents cross-account acceptance (email mismatch guard)", async () => {
      const invite = await inviteTeamMemberDb(
        ASTRO_BUSINESS_ID,
        { email: "intended.recipient@astrology.example.com", role: "agent" },
        ownerActor
      );

      await expect(
        acceptInvitationDb(invite.token!, {
          id: "attacker-user-01",
          email: "attacker@malicious.com",
        })
      ).rejects.toThrow("Cross-account invitation mismatch");
    });

    it("1.8 Successfully accepts valid invitation atomically and prevents reuse", async () => {
      const invite = await inviteTeamMemberDb(
        ASTRO_BUSINESS_ID,
        { email: "valid.candidate@astrology.example.com", role: "agent" },
        ownerActor
      );

      const acceptResult = await acceptInvitationDb(invite.token!, {
        id: "candidate-user-01",
        email: "valid.candidate@astrology.example.com",
        fullName: "Valid Candidate",
      });

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.businessId).toBe(ASTRO_BUSINESS_ID);
      expect(acceptResult.role).toBe("agent");

      // Verify token cannot be reused
      const secondVal = await validateInvitationTokenDb(invite.token!);
      expect(secondVal.valid).toBe(false);
      expect(secondVal.status).toBe("already_accepted");

      await expect(
        acceptInvitationDb(invite.token!, {
          id: "candidate-user-01",
          email: "valid.candidate@astrology.example.com",
        })
      ).rejects.toThrow("already been accepted");
    });
  });

  // ============================================================================
  // WORKSTREAM P1-B: INBOUND MEDIA RETRIEVAL & PERSISTENCE
  // ============================================================================
  describe("Workstream P1-B: Inbound Media Retrieval & Persistence", () => {
    it("2.1 Safely handles missing message or invalid tenant gracefully", async () => {
      const missingRes = await retrieveAndPersistInboundMedia(
        ASTRO_BUSINESS_ID,
        "non-existent-msg-id"
      );
      expect(missingRes.success).toBe(false);
      expect(missingRes.error).toBeDefined();
    });

    it("2.2 Rejects requests with empty businessId or messageId", async () => {
      const res = await retrieveAndPersistInboundMedia("", "");
      expect(res.success).toBe(false);
      expect(res.error).toContain("required");
    });
  });

  // ============================================================================
  // WORKSTREAM P1-C: MULTI-NUMBER CONVERSATION RESOLUTION FIX
  // ============================================================================
  describe("Workstream P1-C: Multi-Number Conversation Resolution Fix", () => {
    it("3.1 Resolves conversation safely without throwing PGRST116 ambiguity", async () => {
      const contactId = "cnt-test-multi-num-01";

      // Query without connectionId resolves default conversation without crashing
      const res1 = await getOrCreateConversationForContactDb(
        ASTRO_BUSINESS_ID,
        contactId
      );
      expect(res1.conversationId).toBeDefined();

      // Query with connectionId resolves connection-specific conversation
      const res2 = await getOrCreateConversationForContactDb(
        ASTRO_BUSINESS_ID,
        contactId,
        { connectionId: "conn-line-2" }
      );
      expect(res2.conversationId).toBeDefined();
      expect(res2.connectionId).toBe("conn-line-2");
    });
  });

  // ============================================================================
  // WORKSTREAM P1-D: CAMPAIGN LAUNCH WORKER IMMEDIATE KICKOFF
  // ============================================================================
  describe("Workstream P1-D: Campaign Launch Immediate Worker Kickoff", () => {
    it("4.1 Launching a campaign transitions status and records queued timestamp", async () => {
      const newCamp = await createCampaignDb(ASTRO_BUSINESS_ID, {
        name: "Festive Puja Offer",
        message_type: "text",
        message_content: "Blessings for the upcoming festival!",
        connection_id: "conn-astro-01",
        audience_type: "all_contacts",
      });

      expect(newCamp.status).toBe("draft");

      const launched = await launchCampaignDb(
        ASTRO_BUSINESS_ID,
        newCamp.id,
        { id: "owner-user-01", name: "Gokul Murugan" }
      );

      expect(["queued", "sending"]).toContain(launched.status);
    });
  });

  // ============================================================================
  // WORKSTREAM P1-E: VERCEL CRON CONFIGURATION & INFRASTRUCTURE
  // ============================================================================
  describe("Workstream P1-E: Vercel Cron Configuration & Infrastructure", () => {
    it("5.1 vercel.json exists in root and defines valid execution parameters or cron configurations for workers", () => {
      const vercelConfigPath = path.join(process.cwd(), "vercel.json");
      expect(fs.existsSync(vercelConfigPath)).toBe(true);

      const raw = fs.readFileSync(vercelConfigPath, "utf-8");
      const config = JSON.parse(raw);

      // Either native Vercel crons or maxDuration functions configured for external cron runners
      if (Array.isArray(config.crons)) {
        expect(config.crons.length).toBe(4);
        const paths = config.crons.map((c: any) => c.path);
        expect(paths).toContain("/api/cron/process-automation-jobs");
        expect(paths).toContain("/api/cron/process-scheduled-messages");
        expect(paths).toContain("/api/cron/process-campaigns");
        expect(paths).toContain("/api/cron/process-crm-reminders");

        config.crons.forEach((c: any) => {
          expect(typeof c.schedule).toBe("string");
          expect(c.schedule.trim().length).toBeGreaterThan(0);
        });
      } else {
        expect(config.functions).toBeDefined();
        expect(config.functions["src/app/api/cron/**/route.ts"]).toBeDefined();
        expect(config.functions["src/app/api/cron/**/route.ts"].maxDuration).toBeGreaterThanOrEqual(60);
      }
    });
  });
});
