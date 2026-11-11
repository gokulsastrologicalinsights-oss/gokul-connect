import { Business } from "@/types/database";

export const INITIAL_BUSINESSES: Business[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Gokul's Astrological Insights",
    slug: "astrology",
    description: "Astrology consultations, Horoscope enquiries, Vedic astrology, KP astrology enquiries, Consultation bookings, and Payment follow-ups.",
    icon_name: "Sparkles",
    accent_color: "purple",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: {
      connectionStatus: "setup_required",
      connectedNumbersCount: 0,
      unreadEnquiriesCount: 8,
      pendingRepliesCount: 3,
    },
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Gokul Vivaham",
    slug: "vivaham",
    description: "Tamil matrimony enquiries, New registration enquiries, Membership enquiries, Profile-related enquiries, and Payment follow-ups.",
    icon_name: "HeartHandshake",
    accent_color: "rose",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stats: {
      connectionStatus: "setup_required",
      connectedNumbersCount: 0,
      unreadEnquiriesCount: 15,
      pendingRepliesCount: 6,
    },
  },
];
