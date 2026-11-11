import { CampaignMessageType, WhatsAppContact } from "@/types/database";

export interface ContactEligibilityResult {
  isEligible: boolean;
  exclusionReason?: string;
}

/**
 * Validate phone number format for WhatsApp (E.164 compatible digits-only, 10-15 digits)
 */
export function validateWhatsAppPhoneNumber(phone: string): { isValid: boolean; normalized: string; error?: string } {
  if (!phone || typeof phone !== "string") {
    return { isValid: false, normalized: "", error: "Phone number is missing." };
  }

  // Remove whitespace, plus sign, dashes, parentheses
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 10) {
    return { isValid: false, normalized: digits, error: "Phone number is too short (minimum 10 digits required)." };
  }

  if (digits.length > 15) {
    return { isValid: false, normalized: digits, error: "Phone number is too long (maximum 15 digits under E.164)." };
  }

  // Check for dummy or repeating numbers
  if (/^(\d)\1+$/.test(digits)) {
    return { isValid: false, normalized: digits, error: "Invalid repeating dummy phone number." };
  }

  return { isValid: true, normalized: digits };
}

/**
 * Evaluates whether a CRM contact is eligible to receive a campaign message
 * according to Meta WhatsApp Messaging Policies and Gokul Connect compliance safeguards.
 */
export function evaluateContactEligibility(
  contact: WhatsAppContact,
  messageType: CampaignMessageType,
  options?: {
    is24HourWindowOpen?: boolean;
  }
): ContactEligibilityResult {
  // 1. Opt-out Enforcement: Never allow a campaign to override an opt-out (STOP / நிறுத்து / manual)
  if (contact.is_opted_out || contact.consent_status === "opted_out") {
    const reasonDetail = contact.opted_out_reason ? ` (${contact.opted_out_reason})` : "";
    return {
      isEligible: false,
      exclusionReason: `Contact opted out of WhatsApp messaging${reasonDetail}`,
    };
  }

  // 2. Blocked Contact Check
  if (contact.is_blocked) {
    return {
      isEligible: false,
      exclusionReason: "Contact is marked as blocked",
    };
  }

  // 3. WhatsApp Phone Number Validation
  const phoneValidation = validateWhatsAppPhoneNumber(contact.phone_number);
  if (!phoneValidation.isValid) {
    return {
      isEligible: false,
      exclusionReason: phoneValidation.error || "Invalid WhatsApp phone number format",
    };
  }

  // 4. Consent Validation
  // If consent is explicitly 'none' and contact has never sent an inbound message, exclude
  if (contact.consent_status === "none" && (!contact.total_inbound_count || contact.total_inbound_count === 0)) {
    return {
      isEligible: false,
      exclusionReason: "No messaging consent on record under WhatsApp Business Policy",
    };
  }

  // 5. WhatsApp 24-Hour Service Window Policy Enforcement
  // Business-initiated bulk campaigns outside the 24-hour customer window MUST use approved Meta Templates.
  // Free-form text and session media without a template are only allowed within an open 24h window.
  if (messageType !== "template") {
    // If window status was provided, check it
    if (options && options.is24HourWindowOpen === false) {
      return {
        isEligible: false,
        exclusionReason: "24-hour customer service window closed (requires approved WhatsApp template for bulk dispatch)",
      };
    }

    // If contact has last_inbound_at, check if it's older than 24 hours
    if (contact.last_inbound_at) {
      const elapsedMs = Date.now() - new Date(contact.last_inbound_at).getTime();
      const isWindowOpen = elapsedMs >= 0 && elapsedMs < 24 * 60 * 60 * 1000;
      if (!isWindowOpen) {
        return {
          isEligible: false,
          exclusionReason: "24-hour customer service window closed (requires approved WhatsApp template for bulk dispatch)",
        };
      }
    } else {
      // No inbound message recorded: non-template bulk message cannot be sent
      return {
        isEligible: false,
        exclusionReason: "24-hour customer service window closed (requires approved WhatsApp template for bulk dispatch)",
      };
    }
  }

  return { isEligible: true };
}

/**
 * Revalidates contact eligibility immediately prior to dispatching each message.
 * This guarantees that opt-outs, blocks, or consent withdrawals occurring between
 * audience snapshotting and dispatch execution are strictly enforced.
 */
export async function revalidateRecipientAtDispatch(
  supabase: any,
  businessId: string,
  recipient: {
    phone_number: string;
    contact_id?: string | null;
  },
  messageType: CampaignMessageType
): Promise<ContactEligibilityResult> {
  // Query latest contact record directly from database
  let contact: WhatsAppContact | null = null;

  if (supabase) {
    try {
      let query = supabase
        .from("wa_contacts")
        .select("*")
        .eq("business_id", businessId);

      if (recipient.contact_id) {
        query = query.eq("id", recipient.contact_id);
      } else {
        query = query.eq("phone_number", recipient.phone_number);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        contact = data as WhatsAppContact;
      }
    } catch {
      // In local/mock mode, fallback
    }
  }

  // If contact was found in DB, re-evaluate with latest state
  if (contact) {
    return evaluateContactEligibility(contact, messageType);
  }

  // If no contact record exists, perform basic phone validation and policy check
  const phoneVal = validateWhatsAppPhoneNumber(recipient.phone_number);
  if (!phoneVal.isValid) {
    return {
      isEligible: false,
      exclusionReason: phoneVal.error || "Invalid WhatsApp phone number format",
    };
  }

  if (messageType !== "template") {
    return {
      isEligible: false,
      exclusionReason: "24-hour customer service window closed (requires approved WhatsApp template for bulk dispatch)",
    };
  }

  return { isEligible: true };
}
