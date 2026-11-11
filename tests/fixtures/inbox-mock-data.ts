import { WhatsAppContact, WhatsAppConversation } from "@/types/database";

export const ASTRO_BUSINESS_ID = "11111111-1111-1111-1111-111111111111";
export const VIVAHAM_BUSINESS_ID = "22222222-2222-2222-2222-222222222222";

export const FIXTURE_CONTACTS_ASTRO: WhatsAppContact[] = [
  {
    id: "contact-astro-01",
    business_id: ASTRO_BUSINESS_ID,
    phone_number: "+919840211223",
    display_name: "Rajesh Sharma",
    profile_photo_url: null,
    metadata: { city: "Chennai", rasi: "Mesha", nakshatra: "Ashwini" },
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "contact-astro-02",
    business_id: ASTRO_BUSINESS_ID,
    phone_number: "+919840344556",
    display_name: "Priya Venkataraman",
    profile_photo_url: null,
    metadata: { city: "Bangalore", rasi: "Kanya", nakshatra: "Hasta" },
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

export const FIXTURE_CONVERSATIONS_ASTRO: WhatsAppConversation[] = [
  {
    id: "conv-astro-01",
    business_id: ASTRO_BUSINESS_ID,
    connection_id: "33333333-3333-3333-3333-333333333333",
    contact_id: "contact-astro-01",
    status: "open",
    last_message_preview: "Namaste Guruji, I would like to schedule a Vedic Astrology consultation for next Tuesday.",
    last_message_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    unread_count: 2,
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    contact: FIXTURE_CONTACTS_ASTRO[0],
    assigned_agent_id: null,
    assigned_agent_name: null,
    labels: ["Vedic Consultation", "VIP"],
    last_message_direction: "inbound",
    last_message_status: "delivered",
  },
  {
    id: "conv-astro-02",
    business_id: ASTRO_BUSINESS_ID,
    connection_id: "33333333-3333-3333-3333-333333333333",
    contact_id: "contact-astro-02",
    status: "pending_human",
    last_message_preview: "Thank you! I have sent the birth chart details for horoscope matching.",
    last_message_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    unread_count: 0,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    updated_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    contact: FIXTURE_CONTACTS_ASTRO[1],
    assigned_agent_id: "agent-gokul",
    assigned_agent_name: "Gokul Murugan",
    labels: ["Horoscope Matching", "Chart Review"],
    last_message_direction: "inbound",
    last_message_status: "read",
  },
];
