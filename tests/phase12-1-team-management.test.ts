import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  ASTRO_BUSINESS_ID,
  VIVAHAM_BUSINESS_ID,
  getTeamMembersDb,
  inviteTeamMemberDb,
  updateMemberRoleDb,
  toggleMemberStatusDb,
  removeMemberDb,
  getTeamInvitationsDb,
  revokeInvitationDb,
  resendInvitationDb,
  getTeamActivityLogsDb,
  logTeamActivityDb,
  assignConversationToAgentDb,
  getConversationAssignmentHistoryDb,
  getAgentWorkloadSummaryDb,
  resetTeamMemoryStore,
} from "@/lib/team/database";
import {
  inviteTeamMemberAction,
  updateMemberRoleAction,
  toggleMemberStatusAction,
  removeMemberAction,
  revokeInvitationAction,
  resendInvitationAction,
} from "@/app/actions/team";
import {
  assignConversationAgentAction,
  sendWhatsAppMessageAction,
  updateConversationStatusAction,
  resumeConversationAutomationAction,
} from "@/app/actions/inbox";
import { BusinessRole } from "@/types/database";

describe("Phase 12.1 — Team Management & Agent Assignment Quality Suite", () => {
  beforeEach(() => {
    resetTeamMemoryStore();
  });

  // ============================================================================
  // DOMAIN 1: STRICT TENANT ISOLATION & INDEPENDENT TEAM ROSTERS
  // ============================================================================
  describe("Domain 1: Strict Multi-Tenant Separation for Team Members", () => {
    it("1.1 Astrology and Vivaham have completely independent team rosters", async () => {
      const astroMembers = await getTeamMembersDb(ASTRO_BUSINESS_ID);
      const vivahamMembers = await getTeamMembersDb(VIVAHAM_BUSINESS_ID);

      expect(astroMembers.length).toBeGreaterThan(0);
      expect(vivahamMembers.length).toBeGreaterThan(0);

      // Verify all Astro members belong to ASTRO_BUSINESS_ID
      astroMembers.forEach((m) => {
        expect(m.business_id).toBe(ASTRO_BUSINESS_ID);
      });

      // Verify all Vivaham members belong to VIVAHAM_BUSINESS_ID
      vivahamMembers.forEach((m) => {
        expect(m.business_id).toBe(VIVAHAM_BUSINESS_ID);
      });

      // Verify staff uniqueness (except owner who has separate memberships in both)
      const astroStaffEmails = astroMembers
        .filter((m) => m.role !== "owner")
        .map((m) => m.user_profile.email);
      const vivahamStaffEmails = vivahamMembers
        .filter((m) => m.role !== "owner")
        .map((m) => m.user_profile.email);

      // No intersection between astrology and vivaham staff rosters
      const sharedStaff = astroStaffEmails.filter((email) => vivahamStaffEmails.includes(email));
      expect(sharedStaff).toHaveLength(0);
    });

    it("1.2 Rejects team member query with missing or invalid business ID", async () => {
      await expect(getTeamMembersDb("")).rejects.toThrow("Tenant isolation violation");
      await expect(getTeamMembersDb("   ")).rejects.toThrow("Tenant isolation violation");
    });
  });

  // ============================================================================
  // DOMAIN 2: ROLE-BASED ACCESS CONTROL (RBAC) & PRIVILEGE GUARDS
  // ============================================================================
  describe("Domain 2: Role-Based Access Control & Privilege Escalation Guards", () => {
    const ownerActor = {
      id: "owner-user-00000000-0000-0000-0000-000000000001",
      name: "Gokul Murugan",
      role: "owner" as BusinessRole,
    };
    const adminActor = {
      id: "user-astro-admin-01",
      name: "Suresh Sastri",
      role: "admin" as BusinessRole,
    };
    const agentActor = {
      id: "user-astro-agent-01",
      name: "Meenakshi Sundaram",
      role: "agent" as BusinessRole,
    };
    const viewerActor = {
      id: "user-astro-viewer-01",
      name: "Kavitha Narayanan",
      role: "viewer" as BusinessRole,
    };

    it("2.1 Owner has full privileges: can invite any role including Admin", async () => {
      const invite = await inviteTeamMemberDb(
        ASTRO_BUSINESS_ID,
        { email: "new.admin@astrology.example.com", role: "admin" },
        ownerActor
      );
      expect(invite.status).toBe("pending");
      expect(invite.role).toBe("admin");
      expect(invite.email).toBe("new.admin@astrology.example.com");
    });

    it("2.2 Admin CANNOT invite someone as Owner (Privilege Escalation Defense)", async () => {
      await expect(
        inviteTeamMemberDb(
          ASTRO_BUSINESS_ID,
          { email: "rogue.owner@astrology.example.com", role: "owner" },
          adminActor
        )
      ).rejects.toThrow("Privilege escalation forbidden");
    });

    it("2.3 Admin CANNOT invite someone as Admin (Privilege Escalation Defense)", async () => {
      await expect(
        inviteTeamMemberDb(
          ASTRO_BUSINESS_ID,
          { email: "rogue.admin@astrology.example.com", role: "admin" },
          adminActor
        )
      ).rejects.toThrow("Privilege escalation forbidden");
    });

    it("2.4 Admin CAN invite an Agent or Viewer", async () => {
      const inviteAgent = await inviteTeamMemberDb(
        ASTRO_BUSINESS_ID,
        { email: "sub.agent@astrology.example.com", role: "agent" },
        adminActor
      );
      expect(inviteAgent.status).toBe("pending");
      expect(inviteAgent.role).toBe("agent");

      const inviteViewer = await inviteTeamMemberDb(
        ASTRO_BUSINESS_ID,
        { email: "auditor@astrology.example.com", role: "viewer" },
        adminActor
      );
      expect(inviteViewer.status).toBe("pending");
      expect(inviteViewer.role).toBe("viewer");
    });

    it("2.5 Agent and Viewer CANNOT invite members", async () => {
      await expect(
        inviteTeamMemberDb(
          ASTRO_BUSINESS_ID,
          { email: "test@astrology.example.com", role: "agent" },
          agentActor
        )
      ).rejects.toThrow("Unauthorized");

      await expect(
        inviteTeamMemberDb(
          ASTRO_BUSINESS_ID,
          { email: "test@astrology.example.com", role: "viewer" },
          viewerActor
        )
      ).rejects.toThrow("Unauthorized");
    });

    it("2.6 Admin CANNOT elevate themselves or anyone else to Owner", async () => {
      await expect(
        updateMemberRoleDb(ASTRO_BUSINESS_ID, "mem-astro-03", "owner", adminActor)
      ).rejects.toThrow("Privilege escalation forbidden");
    });

    it("2.7 Admin CANNOT modify or demote an Owner", async () => {
      await expect(
        updateMemberRoleDb(ASTRO_BUSINESS_ID, "mem-astro-01", "agent", adminActor)
      ).rejects.toThrow("Privilege escalation forbidden");
    });

    it("2.8 Admin CANNOT deactivate or remove an Owner", async () => {
      await expect(
        toggleMemberStatusDb(ASTRO_BUSINESS_ID, "mem-astro-01", false, adminActor)
      ).rejects.toThrow("Privilege escalation forbidden");

      await expect(
        removeMemberDb(ASTRO_BUSINESS_ID, "mem-astro-01", adminActor)
      ).rejects.toThrow("Privilege escalation forbidden");
    });

    it("2.9 Sole active Owner cannot be demoted or deactivated", async () => {
      await expect(
        updateMemberRoleDb(ASTRO_BUSINESS_ID, "mem-astro-01", "agent", ownerActor)
      ).rejects.toThrow("Cannot demote the sole active owner");

      await expect(
        toggleMemberStatusDb(ASTRO_BUSINESS_ID, "mem-astro-01", false, ownerActor)
      ).rejects.toThrow("Cannot deactivate the sole active owner");

      await expect(
        removeMemberDb(ASTRO_BUSINESS_ID, "mem-astro-01", ownerActor)
      ).rejects.toThrow("Cannot remove the sole active owner");
    });
  });

  // ============================================================================
  // DOMAIN 3: MEMBER INVITATIONS LIFECYCLE
  // ============================================================================
  describe("Domain 3: Member Invitations Lifecycle", () => {
    const ownerActor = {
      id: "owner-user-00000000-0000-0000-0000-000000000001",
      name: "Gokul Murugan",
      role: "owner" as BusinessRole,
    };

    it("3.1 Rejects invitation for an email that is already an active member", async () => {
      await expect(
        inviteTeamMemberDb(
          ASTRO_BUSINESS_ID,
          { email: "suresh.sastri@astrology.example.com", role: "agent" },
          ownerActor
        )
      ).rejects.toThrow("already an active member");
    });

    it("3.2 Can revoke a pending invitation", async () => {
      const invites = await getTeamInvitationsDb(ASTRO_BUSINESS_ID);
      const pendingInvite = invites.find((i) => i.status === "pending");
      expect(pendingInvite).toBeDefined();

      if (pendingInvite) {
        await revokeInvitationDb(ASTRO_BUSINESS_ID, pendingInvite.id, ownerActor);
        const updated = await getTeamInvitationsDb(ASTRO_BUSINESS_ID);
        const revoked = updated.find((i) => i.id === pendingInvite.id);
        expect(revoked?.status).toBe("revoked");
      }
    });

    it("3.3 Can resend an invitation with a fresh expiration date", async () => {
      const invites = await getTeamInvitationsDb(ASTRO_BUSINESS_ID);
      const target = invites[0];
      const resent = await resendInvitationDb(ASTRO_BUSINESS_ID, target.id, ownerActor);

      expect(resent.status).toBe("pending");
      expect(new Date(resent.expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ============================================================================
  // DOMAIN 4: AGENT ASSIGNMENT & REASSIGNMENT
  // ============================================================================
  describe("Domain 4: Conversation Agent Assignment & History", () => {
    const ownerActor = {
      id: "owner-user-00000000-0000-0000-0000-000000000001",
      name: "Gokul Murugan",
      role: "owner" as BusinessRole,
    };
    const viewerActor = {
      id: "user-astro-viewer-01",
      name: "Kavitha Narayanan",
      role: "viewer" as BusinessRole,
    };

    it("4.1 Rejects conversation assignment performed by a Viewer", async () => {
      await expect(
        assignConversationToAgentDb(
          ASTRO_BUSINESS_ID,
          "conv-astro-01",
          "user-astro-agent-01",
          "Meenakshi Sundaram",
          viewerActor
        )
      ).rejects.toThrow("Unauthorized: Viewers have read-only access");
    });

    it("4.2 Rejects assigning a conversation to a Viewer", async () => {
      await expect(
        assignConversationToAgentDb(
          ASTRO_BUSINESS_ID,
          "conv-astro-01",
          "user-astro-viewer-01",
          "Kavitha Narayanan",
          ownerActor
        )
      ).rejects.toThrow("Cannot assign conversation to a Viewer");
    });

    it("4.3 Rejects assigning a conversation to an agent of a different business (Cross-Tenant Barrier)", async () => {
      // Vivaham agent trying to be assigned to Astrology conversation
      await expect(
        assignConversationToAgentDb(
          ASTRO_BUSINESS_ID,
          "conv-astro-01",
          "user-vivaham-agent-01",
          "Karthik Natarajan",
          ownerActor
        )
      ).rejects.toThrow("does not belong to this business");
    });

    it("4.4 Successfully assigns conversation to an eligible agent and creates assignment log", async () => {
      const res = await assignConversationToAgentDb(
        ASTRO_BUSINESS_ID,
        "conv-astro-01",
        "user-astro-agent-01",
        "Meenakshi Sundaram",
        ownerActor
      );
      expect(res.success).toBe(true);

      const history = await getConversationAssignmentHistoryDb(ASTRO_BUSINESS_ID, "conv-astro-01");
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].assigned_to).toBe("user-astro-agent-01");
      expect(history[0].assigned_to_name).toBe("Meenakshi Sundaram");
      expect(history[0].assigned_by).toBe(ownerActor.id);
    });

    it("4.5 Reassigning conversation logs previous and new agent correctly", async () => {
      // Reassign to Suresh Sastri (Admin/Agent)
      const res = await assignConversationToAgentDb(
        ASTRO_BUSINESS_ID,
        "conv-astro-01",
        "user-astro-admin-01",
        "Suresh Sastri",
        ownerActor
      );
      expect(res.success).toBe(true);

      const history = await getConversationAssignmentHistoryDb(ASTRO_BUSINESS_ID, "conv-astro-01");
      expect(history[0].assigned_to).toBe("user-astro-admin-01");
      expect(history[0].assigned_to_name).toBe("Suresh Sastri");
    });

    it("4.6 Can unassign conversation", async () => {
      const res = await assignConversationToAgentDb(
        ASTRO_BUSINESS_ID,
        "conv-astro-01",
        null,
        null,
        ownerActor
      );
      expect(res.success).toBe(true);

      const history = await getConversationAssignmentHistoryDb(ASTRO_BUSINESS_ID, "conv-astro-01");
      expect(history[0].assigned_to).toBeNull();
      expect(history[0].notes).toBe("Unassigned");
    });
  });

  // ============================================================================
  // DOMAIN 5: TEAM ACTIVITY HISTORY AUDIT LOGGING
  // ============================================================================
  describe("Domain 5: Team Activity History Audit", () => {
    it("5.1 Logs all 10 required activity types correctly", async () => {
      const activityTypes = [
        "member_invited",
        "role_changed",
        "member_activated",
        "member_deactivated",
        "member_removed",
        "conversation_assigned",
        "conversation_reassigned",
        "human_takeover",
        "bot_resumed",
        "conversation_resolved",
      ] as const;

      for (const actType of activityTypes) {
        const log = await logTeamActivityDb(ASTRO_BUSINESS_ID, {
          actor_id: "owner-user-00000000-0000-0000-0000-000000000001",
          actor_name: "Gokul Murugan",
          activity_type: actType,
          description: `Test event for ${actType}`,
          metadata: { test: true },
        });

        expect(log.business_id).toBe(ASTRO_BUSINESS_ID);
        expect(log.activity_type).toBe(actType);
      }

      const allLogs = await getTeamActivityLogsDb(ASTRO_BUSINESS_ID, { limit: 100 });
      for (const actType of activityTypes) {
        const found = allLogs.some((l) => l.activity_type === actType);
        expect(found).toBe(true);
      }
    });

    it("5.2 Activity logs are strictly tenant isolated", async () => {
      const astroLogs = await getTeamActivityLogsDb(ASTRO_BUSINESS_ID);
      const vivahamLogs = await getTeamActivityLogsDb(VIVAHAM_BUSINESS_ID);

      astroLogs.forEach((l) => {
        expect(l.business_id).toBe(ASTRO_BUSINESS_ID);
      });
      vivahamLogs.forEach((l) => {
        expect(l.business_id).toBe(VIVAHAM_BUSINESS_ID);
      });
    });
  });

  // ============================================================================
  // DOMAIN 6: AGENT WORKLOAD SUMMARY
  // ============================================================================
  describe("Domain 6: Agent Workload Summary", () => {
    it("6.1 Returns workloads for eligible staff and excludes Viewers", async () => {
      const workloads = await getAgentWorkloadSummaryDb(ASTRO_BUSINESS_ID);
      expect(workloads.length).toBeGreaterThan(0);

      // Verify no Viewer in workload summary
      const hasViewer = workloads.some((w) => w.role === "viewer");
      expect(hasViewer).toBe(false);

      // Verify structure
      const sample = workloads[0];
      expect(sample).toHaveProperty("userId");
      expect(sample).toHaveProperty("userName");
      expect(sample).toHaveProperty("activeConversationsCount");
      expect(sample).toHaveProperty("unreadCount");
      expect(sample).toHaveProperty("pendingHumanCount");
      expect(sample).toHaveProperty("resolvedCount");
    });
  });

  // ============================================================================
  // DOMAIN 7: DATABASE MIGRATION 016 DISPOSABLE PGLITE REPLAY & RLS
  // ============================================================================
  describe("Domain 7: Migration 016 Disposable PGlite Safety & Schema Verification", () => {
    const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
    let db: PGlite;

    it("7.1 Replays all 16 migrations cleanly from scratch in isolated PGlite sandbox", async () => {
      db = new PGlite();

      // Mocks for auth schema
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
        END
        $$;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
          SELECT '00000000-0000-0000-0000-000000000001'::UUID;
        $$;
        CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
          SELECT '{"role": "service_role"}'::jsonb;
        $$;
      `);

      const sqlFiles = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      expect(sqlFiles.some((f) => f.includes("016"))).toBe(true);

      for (const file of sqlFiles) {
        let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "-- native");
        sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/gi, "-- native");
        await db.exec(sql);
      }

      // Check all new tables created
      const tablesRes = await db.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      const tableNames = tablesRes.rows.map((r: any) => r.table_name);
      expect(tableNames).toContain("business_invitations");
      expect(tableNames).toContain("team_activity_logs");
      expect(tableNames).toContain("conversation_assignment_logs");

      // Check wa_conversations columns
      const colsRes = await db.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'wa_conversations';
      `);
      const colNames = colsRes.rows.map((r: any) => r.column_name);
      expect(colNames).toContain("assigned_agent_id");
      expect(colNames).toContain("assigned_agent_name");
      expect(colNames).toContain("assigned_at");

      // Check viewer role in business_members constraint
      const testUserId = "99999999-9999-9999-9999-999999999999";
      await db.query(`
        INSERT INTO auth.users (id, email) VALUES ('${testUserId}', 'viewer@example.com');
      `);
      // Profile is auto-created by auth trigger; update name
      await db.query(`
        UPDATE public.user_profiles SET full_name = 'Test Viewer' WHERE id = '${testUserId}';
      `);

      // Inserting role = 'viewer' should succeed!
      await db.query(`
        INSERT INTO public.business_members (business_id, user_id, role, is_active)
        VALUES ('${ASTRO_BUSINESS_ID}', '${testUserId}', 'viewer', true);
      `);

      const memberRes = await db.query(`
        SELECT role FROM public.business_members WHERE user_id = '${testUserId}';
      `);
      expect(memberRes.rows[0]).toEqual({ role: "viewer" });
    }, 30000);
  });
});
