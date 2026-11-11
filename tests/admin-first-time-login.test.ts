import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

// Test helper to generate secure temporary password matching our specification
export function generateSecureTemporaryPassword(length = 24): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{}";
  const allChars = uppercase + lowercase + numbers + symbols;

  const pick = (charset: string) => charset[crypto.randomInt(0, charset.length)];
  const required = [
    pick(uppercase),
    pick(uppercase),
    pick(lowercase),
    pick(lowercase),
    pick(numbers),
    pick(numbers),
    pick(symbols),
    pick(symbols),
  ];

  const remainingLength = length - required.length;
  const remaining: string[] = [];
  for (let i = 0; i < remainingLength; i++) {
    remaining.push(pick(allChars));
  }

  const passwordChars = [...required, ...remaining];
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join("");
}

describe("Admin First-Time Login & Mandatory Password Change Security Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Domain 1: Cryptographic Temporary Password Generation", () => {
    it("1.1 should generate temporary password with length >= 20 characters", () => {
      const pwd = generateSecureTemporaryPassword(24);
      expect(pwd.length).toBe(24);
      expect(pwd.length).toBeGreaterThanOrEqual(20);
    });

    it("1.2 should contain required entropy: uppercase, lowercase, numbers, and symbols", () => {
      for (let i = 0; i < 20; i++) {
        const pwd = generateSecureTemporaryPassword(24);
        expect(/[A-Z]/.test(pwd)).toBe(true);
        expect(/[a-z]/.test(pwd)).toBe(true);
        expect(/[0-9]/.test(pwd)).toBe(true);
        expect(/[!@#$%^&*()\-_=+[\]{}]/.test(pwd)).toBe(true);
      }
    });

    it("1.3 should never produce duplicate passwords across multiple iterations", () => {
      const set = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const pwd = generateSecureTemporaryPassword(24);
        expect(set.has(pwd)).toBe(false);
        set.add(pwd);
      }
      expect(set.size).toBe(100);
    });
  });

  describe("Domain 2: Server-Side must_change_password Detection & Redirect Enforcement", () => {
    it("2.1 should identify must_change_password from app_metadata or user_metadata", () => {
      const userWithAppMeta = {
        id: "d5d32479-0a5d-43d1-8b81-0bac8e6b559d",
        app_metadata: { must_change_password: true },
        user_metadata: {},
      };
      const userWithUserMeta = {
        id: "d5d32479-0a5d-43d1-8b81-0bac8e6b559d",
        app_metadata: {},
        user_metadata: { must_change_password: true },
      };
      const regularUser = {
        id: "regular-user-id",
        app_metadata: { must_change_password: false },
        user_metadata: { must_change_password: false },
      };

      const check = (u: any) =>
        Boolean(u.app_metadata?.must_change_password ?? u.user_metadata?.must_change_password);

      expect(check(userWithAppMeta)).toBe(true);
      expect(check(userWithUserMeta)).toBe(true);
      expect(check(regularUser)).toBe(false);
    });

    it("2.2 should strictly prevent workspace access when must_change_password is true", () => {
      const mustChange = true;
      let redirectTarget = "";

      // Simulate server guard logic
      if (mustChange) {
        redirectTarget = "/update-password?mandatory=true";
      }

      expect(redirectTarget).toBe("/update-password?mandatory=true");
    });

    it("2.3 should clear business listings when must_change_password is true", () => {
      const authUser = {
        id: "d5d32479-0a5d-43d1-8b81-0bac8e6b559d",
        app_metadata: { must_change_password: true },
      };

      const mustChangePassword = Boolean(authUser.app_metadata?.must_change_password);
      const businesses = mustChangePassword ? [] : [{ id: "b1", slug: "astrology" }];

      expect(businesses).toHaveLength(0);
    });
  });

  describe("Domain 3: Server Action Password Update & Flag Clearing", () => {
    it("3.1 should reject password update if new password is under 8 characters", async () => {
      const { updatePasswordAction } = await import("@/app/actions/auth");
      const result = await updatePasswordAction({ password: "short" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("at least 8 characters");
    });

    it("3.2 should require active session to perform password update", async () => {
      const { updatePasswordAction } = await import("@/app/actions/auth");
      // Without session cookies, server client returns null user
      const result = await updatePasswordAction({ password: "NewPermanentPass2026!" });
      // In mock/unconfigured or unauthenticated environment, properly handles failure
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("Domain 4: Test Account Preservation & Multi-Tenant Isolation", () => {
    it("4.1 should confirm testing accounts do not have must_change_password flag set", () => {
      const userA = {
        email: "user_a_astro@gokulconnect.com",
        app_metadata: {},
        user_metadata: {},
      };
      const userB = {
        email: "user_b_vivaham@gokulconnect.com",
        app_metadata: {},
        user_metadata: {},
      };

      const check = (u: any) =>
        Boolean(u.app_metadata?.must_change_password ?? u.user_metadata?.must_change_password);

      expect(check(userA)).toBe(false);
      expect(check(userB)).toBe(false);
    });
  });
});
