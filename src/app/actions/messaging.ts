"use server";

import { revalidatePath } from "next/cache";
import { validateBusinessAccess } from "@/lib/auth/tenant-guard";
import {
  SendMessageResult,
  sendWhatsAppMessageService,
} from "@/lib/whatsapp/service";
import { rateLimitOutboundMessages } from "@/lib/rate-limit/rate-limiter";
import { SendWhatsAppMessageInputSchema } from "@/lib/validation/schemas";

export interface SendMessageActionInput {
  businessSlug: string;
  connectionId: string;
  recipientPhone: string;
  recipientName?: string;
  text?: string;
  template?: {
    name: string;
    languageCode?: string;
    components?: Array<Record<string, unknown>>;
  };
}

/**
 * Server Action to Send WhatsApp Message
 * Enforces business tenant isolation, Zod input validation, rate limiting, and membership authorization.
 */
export async function sendWhatsAppMessageAction(
  input: SendMessageActionInput
): Promise<SendMessageResult> {
  const validated = SendWhatsAppMessageInputSchema.parse(input);
  const { businessSlug, connectionId, recipientPhone, text, template, recipientName } = validated;

  // 1. Enforce Server-Side Tenant Authorization using workspace slug
  const { business, membership } = await validateBusinessAccess(businessSlug);

  if (!membership || !["owner", "admin", "agent"].includes(membership.role)) {
    throw new Error("Unauthorized: Insufficient permissions to send messages.");
  }

  // 2. Server-Side Outbound Rate Limiting (Abuse & Account Compromise Protection)
  const rateLimit = rateLimitOutboundMessages(business.id);
  if (!rateLimit.success) {
    throw new Error(
      `Rate limit exceeded: Outbound dispatch paused. Please wait ${rateLimit.retryAfterSeconds}s before retrying.`
    );
  }

  // 3. Dispatch via WhatsApp Service with verified server business.id
  const result = await sendWhatsAppMessageService({
    businessId: business.id,
    connectionId,
    recipientPhone,
    recipientName,
    text,
    template,
  });

  // Revalidate relevant pages
  revalidatePath(`/workspace/${businessSlug}`);

  return result;
}
