import { WhatsAppMessageTemplate } from "./types";

export const ASTROLOGY_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
export const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";

export function getDefaultBusinessTemplates(
  businessId: string,
  businessSlug?: string
): WhatsAppMessageTemplate[] {
  const isVivaham =
    businessId === VIVAHAM_BUSINESS_ID || businessSlug === "vivaham";
  const now = new Date().toISOString();

  if (isVivaham) {
    return [
      {
        id: "tpl-default-01",
        business_id: businessId,
        connection_id: null,
        template_name: "hello_world",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "BODY",
            text: "Welcome and congratulations! This message confirms that your WhatsApp number can now receive real-time notifications.",
          },
        ],
        created_at: now,
        updated_at: now,
      },
      {
        id: "tpl-default-02",
        business_id: businessId,
        connection_id: null,
        template_name: "reengage_customer",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "BODY",
            text: "Hello! We are following up regarding your WhatsApp enquiry. Please reply to this message to continue the conversation with our support team.",
          },
        ],
        created_at: now,
        updated_at: now,
      },
      // 1. Registration Confirmation
      {
        id: "tpl-vivaham-01",
        business_id: businessId,
        connection_id: null,
        template_name: "registration_confirmation",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "HEADER",
            format: "TEXT",
            text: "Registration Confirmed",
          },
          {
            type: "BODY",
            text: "Vanakkam {{1}}, welcome to Gokul Vivaham. Your matrimonial registration has been received successfully with Profile ID {{2}}. Our screening team will verify your credentials.",
            example: {
              body_text: [["Sundar", "GV-1024"]],
            },
          },
          {
            type: "FOOTER",
            text: "Gokul Vivaham — Trusted Tamil Matrimony",
          },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "View Profile" },
              { type: "QUICK_REPLY", text: "Contact Support" },
            ],
          },
        ],
        created_at: now,
        updated_at: now,
      },
      // 2. Profile Interest Notification
      {
        id: "tpl-vivaham-02",
        business_id: businessId,
        connection_id: null,
        template_name: "profile_interest_notification",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "HEADER",
            format: "TEXT",
            text: "New Matrimonial Interest",
          },
          {
            type: "BODY",
            text: "Vanakkam {{1}}, a prospective alliance member (Profile ID: {{2}}) has expressed interest in your Vivaham profile. Please review their horoscope and bio.",
            example: {
              body_text: [["Priya", "GV-4412"]],
            },
          },
          {
            type: "FOOTER",
            text: "Gokul Vivaham Matrimony",
          },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "Accept Interest" },
              { type: "QUICK_REPLY", text: "Decline" },
            ],
          },
        ],
        created_at: now,
        updated_at: now,
      },
      // 3. Membership Information
      {
        id: "tpl-vivaham-03",
        business_id: businessId,
        connection_id: null,
        template_name: "membership_information",
        language: "en_US",
        category: "MARKETING",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "HEADER",
            format: "TEXT",
            text: "Premium Membership Plans",
          },
          {
            type: "BODY",
            text: "Vanakkam {{1}}, unlock verified phone numbers and direct horoscope matching with Gokul Vivaham {{2}} membership. Enjoy personalized Relationship Manager assistance.",
            example: {
              body_text: [["Karthik", "Gold"]],
            },
          },
          {
            type: "FOOTER",
            text: "Reply STOP to opt out",
          },
          {
            type: "BUTTONS",
            buttons: [
              {
                type: "URL",
                text: "View Plans",
                url: "https://gokulvivaham.com/plans",
              },
            ],
          },
        ],
        created_at: now,
        updated_at: now,
      },
      // 4. Matrimony Profile Update
      {
        id: "tpl-vivaham-04",
        business_id: businessId,
        connection_id: null,
        template_name: "matrimony_profile_update",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "HEADER",
            format: "TEXT",
            text: "Profile Verification Complete",
          },
          {
            type: "BODY",
            text: "Vanakkam {{1}}, your Vivaham matrimonial profile {{2}} has been successfully updated and verified. Your profile is now visible to matching families.",
            example: {
              body_text: [["Sundar", "GV-9021"]],
            },
          },
          {
            type: "FOOTER",
            text: "Gokul Vivaham Matrimony",
          },
          {
            type: "BUTTONS",
            buttons: [
              {
                type: "URL",
                text: "Login & Search",
                url: "https://gokulvivaham.com/portal",
              },
            ],
          },
        ],
        created_at: now,
        updated_at: now,
      },
      // 5. Membership Renewal Reminder
      {
        id: "tpl-vivaham-05",
        business_id: businessId,
        connection_id: null,
        template_name: "membership_renewal_reminder",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "HEADER",
            format: "TEXT",
            text: "Membership Expiry Notice",
          },
          {
            type: "BODY",
            text: "Vanakkam {{1}}, your Gokul Vivaham {{2}} package is set to expire on {{3}}. Renew today to retain uninterrupted match alerts and RM support.",
            example: {
              body_text: [["Meenakshi", "Diamond Plan", "November 30"]],
            },
          },
          {
            type: "FOOTER",
            text: "Gokul Vivaham Matrimony",
          },
          {
            type: "BUTTONS",
            buttons: [
              {
                type: "URL",
                text: "Renew Now",
                url: "https://gokulvivaham.com/renew",
              },
            ],
          },
        ],
        created_at: now,
        updated_at: now,
      },
      // 6. Match Recommendations Alert
      {
        id: "tpl-vivaham-06",
        business_id: businessId,
        connection_id: null,
        template_name: "match_recommendations_alert",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "HEADER",
            format: "TEXT",
            text: "Gokul Vivaham Matrimony",
          },
          {
            type: "BODY",
            text: "Vanakkam {{1}}, we have found {{2}} newly verified profiles matching your horoscope and community criteria. Click below to view prospective matches.",
            example: {
              body_text: [["Karthik", "5"]],
            },
          },
          {
            type: "FOOTER",
            text: "Gokul Vivaham — Trusted Tamil Matrimony",
          },
          {
            type: "BUTTONS",
            buttons: [
              { type: "QUICK_REPLY", text: "View Matches" },
              { type: "QUICK_REPLY", text: "Contact RM" },
            ],
          },
        ],
        created_at: now,
        updated_at: now,
      },
      // 7. Profile Verification Update (legacy alias)
      {
        id: "tpl-vivaham-07",
        business_id: businessId,
        connection_id: null,
        template_name: "profile_verification_update",
        language: "en_US",
        category: "UTILITY",
        status: "APPROVED",
        is_archived: false,
        components: [
          {
            type: "HEADER",
            format: "TEXT",
            text: "Profile Verified",
          },
          {
            type: "BODY",
            text: "Vanakkam {{1}}, your Vivaham profile {{2}} is 100% verified.",
          },
        ],
        created_at: now,
        updated_at: now,
      },
      // 8. Local Draft
      {
        id: "tpl-vivaham-08",
        business_id: businessId,
        connection_id: null,
        template_name: "vivaham_draft_welcome",
        language: "en_US",
        category: "MARKETING",
        status: "DRAFT",
        is_archived: false,
        components: [
          {
            type: "BODY",
            text: "Vanakkam {{1}}, welcome to Gokul Vivaham! Complete your horoscope details to receive 100% matched alliances.",
          },
          {
            type: "FOOTER",
            text: "Draft Template (Not submitted to Meta)",
          },
        ],
        created_at: now,
        updated_at: now,
      },
    ];
  }

  // Astrology templates
  return [
    {
      id: "tpl-default-01",
      business_id: businessId,
      connection_id: null,
      template_name: "hello_world",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "BODY",
          text: "Welcome and congratulations! This message confirms that your WhatsApp number can now receive real-time notifications.",
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: "tpl-default-02",
      business_id: businessId,
      connection_id: null,
      template_name: "reengage_customer",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "BODY",
          text: "Hello! We are following up regarding your WhatsApp enquiry. Please reply to this message to continue the conversation with our support team.",
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 1. Consultation Confirmation
    {
      id: "tpl-astrology-01",
      business_id: businessId,
      connection_id: null,
      template_name: "consultation_confirmation",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Consultation Confirmed",
        },
        {
          type: "BODY",
          text: "Namaste {{1}}, your Vedic astrology consultation has been confirmed for {{2}} at {{3}}. Astrologer Gokul will review your birth chart prior to the call.",
          example: {
            body_text: [["Karthik", "Friday, Nov 14", "10:30 AM"]],
          },
        },
        {
          type: "FOOTER",
          text: "Gokul's Astrological Insights",
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Confirm Attendance" },
            { type: "QUICK_REPLY", text: "Reschedule" },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 2. Horoscope Matching Update
    {
      id: "tpl-astrology-02",
      business_id: businessId,
      connection_id: null,
      template_name: "horoscope_matching_update",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Horoscope Porutham Report",
        },
        {
          type: "BODY",
          text: "Namaste {{1}}, the Kundali Porutham analysis between {{2}} and {{3}} is complete. Porutham score: {{4}} / 10. Click below to download the full Vedic report.",
          example: {
            body_text: [["Suresh", "Bride Profile", "Groom Profile", "8.5"]],
          },
        },
        {
          type: "FOOTER",
          text: "Gokul's Astrological Insights",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Download Report",
              url: "https://gokulastrology.com/porutham",
            },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 3. Numerology Consultation
    {
      id: "tpl-astrology-03",
      business_id: businessId,
      connection_id: null,
      template_name: "numerology_consultation",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Numerology Consultation",
        },
        {
          type: "BODY",
          text: "Namaste {{1}}, your Name Correction & Numerology recommendation for {{2}} is ready. Auspicious life path number: {{3}}.",
          example: {
            body_text: [["Deepak", "Baby Name", "9"]],
          },
        },
        {
          type: "FOOTER",
          text: "Gokul's Astrological Insights",
        },
        {
          type: "BUTTONS",
          buttons: [{ type: "QUICK_REPLY", text: "View Details" }],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 4. Appointment Reminder
    {
      id: "tpl-astrology-04",
      business_id: businessId,
      connection_id: null,
      template_name: "appointment_reminder",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Astrology Appointment Reminder",
        },
        {
          type: "BODY",
          text: "Namaste {{1}}, this is a friendly reminder for your upcoming Vedic astrology consultation on {{2}} at {{3}}.",
          example: {
            body_text: [["Anand", "Tomorrow", "11:00 AM"]],
          },
        },
        {
          type: "FOOTER",
          text: "Gokul's Astrological Insights",
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Join Call" },
            { type: "QUICK_REPLY", text: "Reschedule" },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 5. Follow-up Reminder
    {
      id: "tpl-astrology-05",
      business_id: businessId,
      connection_id: null,
      template_name: "followup_reminder",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Follow-up Consultation",
        },
        {
          type: "BODY",
          text: "Namaste {{1}}, following your recent consultation on {{2}}, we recommend checking your gemstone and pariharam progress. Would you like to schedule a quick follow-up?",
          example: {
            body_text: [["Ramesh", "Dasha Bhukti Transit"]],
          },
        },
        {
          type: "FOOTER",
          text: "Gokul's Astrological Insights",
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "Schedule Followup" },
            { type: "QUICK_REPLY", text: "All Good" },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 6. Horoscope Report Ready (legacy alias)
    {
      id: "tpl-astrology-06",
      business_id: businessId,
      connection_id: null,
      template_name: "horoscope_report_ready",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Vedic Astrology Insights",
        },
        {
          type: "BODY",
          text: "Namaste {{1}}, your personalized Horoscope Analysis & Kundali Report for {{2}} is ready. Please review your planetary dasha and prescribed pariharams.",
          example: {
            body_text: [["Gokul", "Year 2026 Transit"]],
          },
        },
        {
          type: "FOOTER",
          text: "Gokul's Astrological Insights",
        },
        {
          type: "BUTTONS",
          buttons: [
            { type: "QUICK_REPLY", text: "View Report" },
            { type: "QUICK_REPLY", text: "Ask Question" },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 7. Consultation Reminder (legacy alias)
    {
      id: "tpl-astrology-07",
      business_id: businessId,
      connection_id: null,
      template_name: "consultation_reminder",
      language: "en_US",
      category: "UTILITY",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "HEADER",
          format: "TEXT",
          text: "Consultation Reminder",
        },
        {
          type: "BODY",
          text: "Namaste {{1}}, this is a gentle reminder for your upcoming Vedic astrology consultation on {{2}} at {{3}}.",
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 8. Daily Panchangam Update
    {
      id: "tpl-astrology-08",
      business_id: businessId,
      connection_id: null,
      template_name: "daily_panchangam_update",
      language: "en_US",
      category: "MARKETING",
      status: "APPROVED",
      is_archived: false,
      components: [
        {
          type: "HEADER",
          format: "IMAGE",
        },
        {
          type: "BODY",
          text: "Namaste {{1}}, today's auspicious Muhurtham timings and Panchangam highlights are ready. Check Rahu Kaalam, Yamagandam, and auspicious horai timings.",
          example: {
            body_text: [["Devotee"]],
          },
        },
        {
          type: "FOOTER",
          text: "Reply STOP to unsubscribe",
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Open Panchangam",
              url: "https://gokulastrology.com/panchangam",
            },
          ],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    // 9. Local Draft
    {
      id: "tpl-astrology-09",
      business_id: businessId,
      connection_id: null,
      template_name: "astrology_draft_muhurtham",
      language: "en_US",
      category: "UTILITY",
      status: "DRAFT",
      is_archived: false,
      components: [
        {
          type: "BODY",
          text: "Namaste {{1}}, here is your customized Grihapravesam Muhurtham date recommendation for {{2}}.",
        },
        {
          type: "FOOTER",
          text: "Local Draft (Gokul Astrology)",
        },
      ],
      created_at: now,
      updated_at: now,
    },
  ];
}
