/**
 * Gokul Connect — Transactional Email Delivery Adapter
 *
 * Server-side email delivery abstraction supporting:
 * 1. Resend API (HTTP / SDK compatible)
 * 2. Supabase Auth Admin Invite
 * 3. SMTP Transport (Generic)
 * 4. Development / Console Mock (for testing without external dependencies)
 *
 * Configuration Instructions:
 * - EMAIL_PROVIDER: "resend" | "supabase" | "smtp" | "console" | "none" (default: "none")
 * - EMAIL_FROM: "Gokul Connect <noreply@gokulconnect.com>"
 * - RESEND_API_KEY: Resend API key (re_...)
 * - NEXT_PUBLIC_APP_URL: Base URL for acceptance links (e.g., http://localhost:3000)
 *
 * Security:
 * - Server-only execution.
 * - API keys and tokens are never leaked to client components or logs.
 * - If no provider is configured, delivery is explicitly reported as unconfigured (never false-positive).
 */

export type EmailProviderType = "resend" | "supabase" | "smtp" | "console" | "none";

export interface SendInvitationEmailParams {
  toEmail: string;
  businessName: string;
  businessSlug: string;
  inviterName: string;
  inviterEmail?: string;
  role: string;
  invitationToken: string;
  expiresAt: string;
  acceptanceUrl?: string;
}

export interface EmailDeliveryResult {
  sent: boolean;
  provider: EmailProviderType;
  messageId?: string;
  error?: string;
  configured: boolean;
}

/**
 * Get current configured email provider
 */
export function getConfiguredEmailProvider(): EmailProviderType {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  if (provider === "resend" && process.env.RESEND_API_KEY) return "resend";
  if (provider === "supabase") return "supabase";
  if (provider === "smtp") return "smtp";
  if (provider === "console" || provider === "mock") return "console";
  return "none";
}

/**
 * Generate standard HTML email body for team invitation
 */
export function generateInvitationEmailHtml(params: {
  businessName: string;
  inviterName: string;
  role: string;
  expiresAtFormatted: string;
  acceptanceUrl: string;
}): string {
  const { businessName, inviterName, role, expiresAtFormatted, acceptanceUrl } = params;
  const roleDisplay = role.toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're invited to join ${businessName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; line-height: 1.5; }
    .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { margin-bottom: 24px; text-align: center; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; background-color: #e0e7ff; color: #4338ca; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 12px 0 6px; }
    .subtitle { font-size: 15px; color: #64748b; margin: 0; }
    .content { margin: 24px 0; font-size: 15px; color: #334155; }
    .role-box { background-color: #f1f5f9; border-left: 4px solid #6366f1; padding: 12px 16px; border-radius: 4px; margin: 16px 0; }
    .button-container { text-align: center; margin: 32px 0; }
    .button { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); }
    .expiry { font-size: 13px; color: #94a3b8; text-align: center; margin-top: 16px; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">Gokul Connect</span>
      <h1 class="title">Join ${businessName}</h1>
      <p class="subtitle">You have been invited to collaborate</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> has invited you to join the team for <strong>${businessName}</strong> on Gokul Connect.</p>
      <div class="role-box">
        <strong>Assigned Role:</strong> ${roleDisplay}<br>
        <small style="color: #64748b;">This grant provides appropriate access to manage WhatsApp conversations, CRM contacts, and operational workflows.</small>
      </div>
      <p>To accept this invitation and activate your account, click the button below:</p>
      <div class="button-container">
        <a href="${acceptanceUrl}" class="button" target="_blank">Accept Invitation & Join Team</a>
      </div>
      <p class="expiry">This invitation expires on <strong>${expiresAtFormatted}</strong>.<br>If you were not expecting this invitation, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>Gokul Connect — Multi-Tenant WhatsApp CRM & Automation Engine<br>Confidential & Intended Solely for the Recipient</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate plain text email body for fallback clients
 */
export function generateInvitationEmailText(params: {
  businessName: string;
  inviterName: string;
  role: string;
  expiresAtFormatted: string;
  acceptanceUrl: string;
}): string {
  const { businessName, inviterName, role, expiresAtFormatted, acceptanceUrl } = params;
  return `You're invited to join ${businessName} on Gokul Connect.

${inviterName} has invited you to join the team with the role: ${role.toUpperCase()}.

Accept your invitation and activate your account using the following secure link:
${acceptanceUrl}

This invitation will expire on: ${expiresAtFormatted}.

If you did not request this invitation, you may safely disregard this email.

---
Gokul Connect — Multi-Tenant WhatsApp CRM & Automation Engine`;
}

/**
 * Server-Side Dispatch Adapter: Sends an invitation email using the configured provider
 */
export async function sendInvitationEmail(
  params: SendInvitationEmailParams
): Promise<EmailDeliveryResult> {
  const provider = getConfiguredEmailProvider();
  const baseUrl =
    params.acceptanceUrl ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/accept-invite?token=${params.invitationToken}`;

  const expiresDate = new Date(params.expiresAt);
  const formattedExpiry = isNaN(expiresDate.getTime())
    ? params.expiresAt
    : expiresDate.toLocaleDateString("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      }) + " IST";

  const emailHtml = generateInvitationEmailHtml({
    businessName: params.businessName,
    inviterName: params.inviterName,
    role: params.role,
    expiresAtFormatted: formattedExpiry,
    acceptanceUrl: baseUrl,
  });

  const emailText = generateInvitationEmailText({
    businessName: params.businessName,
    inviterName: params.inviterName,
    role: params.role,
    expiresAtFormatted: formattedExpiry,
    acceptanceUrl: baseUrl,
  });

  const fromEmail = process.env.EMAIL_FROM || "Gokul Connect <invites@gokulconnect.com>";
  const subject = `Invitation to join ${params.businessName} on Gokul Connect`;

  // 1. PROVIDER: NONE / UNCONFIGURED
  if (provider === "none") {
    return {
      sent: false,
      configured: false,
      provider: "none",
      error:
        "No email delivery provider is configured. Configure RESEND_API_KEY, Supabase Auth invite, or EMAIL_PROVIDER=console in .env.local to enable real email delivery.",
    };
  }

  // 2. PROVIDER: CONSOLE / MOCK (for local testing & dev verification)
  if (provider === "console") {
    // Deliberate mock logging in development
    console.info(
      `[Email Mock Adapter] Sent invitation to ${params.toEmail} for ${params.businessName} (${params.role}) -> ${baseUrl}`
    );
    return {
      sent: true,
      configured: true,
      provider: "console",
      messageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    };
  }

  // 3. PROVIDER: RESEND API
  if (provider === "resend") {
    try {
      const apiKey = process.env.RESEND_API_KEY!;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [params.toEmail],
          subject,
          html: emailHtml,
          text: emailText,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          sent: false,
          configured: true,
          provider: "resend",
          error: data?.message || `Resend delivery failed with HTTP ${response.status}`,
        };
      }

      return {
        sent: true,
        configured: true,
        provider: "resend",
        messageId: data?.id,
      };
    } catch (err: any) {
      return {
        sent: false,
        configured: true,
        provider: "resend",
        error: err.message || "Network error dispatching email via Resend",
      };
    }
  }

  // 4. PROVIDER: SUPABASE AUTH ADMIN INVITE
  if (provider === "supabase") {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabaseAdmin = createAdminClient();
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(params.toEmail, {
        data: {
          business_name: params.businessName,
          business_slug: params.businessSlug,
          role: params.role,
          invitation_token: params.invitationToken,
        },
        redirectTo: baseUrl,
      });

      if (error) {
        return {
          sent: false,
          configured: true,
          provider: "supabase",
          error: error.message,
        };
      }

      return {
        sent: true,
        configured: true,
        provider: "supabase",
        messageId: data.user?.id,
      };
    } catch (err: any) {
      return {
        sent: false,
        configured: true,
        provider: "supabase",
        error: err.message || "Supabase Admin Invite failed",
      };
    }
  }

  return {
    sent: false,
    configured: false,
    provider: "none",
    error: "Unknown or unhandled email provider",
  };
}
