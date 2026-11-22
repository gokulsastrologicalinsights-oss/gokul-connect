import { SocialReplyTemplate } from "./types";

export const PRESET_SOCIAL_REPLY_TEMPLATES: SocialReplyTemplate[] = [
  // --------------------------------------------------------------------------
  // ASTROLOGY — TAMIL TEMPLATES
  // --------------------------------------------------------------------------
  {
    id: "tpl_astro_ta_general",
    businessSlug: "astrology",
    language: "ta",
    title: "பொதுவான வரவேற்பு & ஆலோசனை",
    text: "வணக்கம்! உங்கள் ஜாதக பலன்கள் மற்றும் ஜோதிட ஆலோசனை பெற எங்கள் வாட்ஸ்அப் அல்லது இன்பாக்ஸில் தொடர்பு கொள்ளவும். வாழ்க வளமுடன்!",
    category: "general",
  },
  {
    id: "tpl_astro_ta_pricing",
    businessSlug: "astrology",
    language: "ta",
    title: "கட்டண விவரங்கள் & முன்பதிவு",
    text: "நன்றி! ஜாதகம் கணித்தல் மற்றும் பிரசன்ன ஆலோசனைக்கான கட்டண விவரங்களை உங்கள் இன்பாக்ஸில் அனுப்பியுள்ளோம். முன்பதிவு செய்ய தொடர்பு கொள்ளவும்.",
    category: "pricing",
  },
  {
    id: "tpl_astro_ta_birth_details",
    businessSlug: "astrology",
    language: "ta",
    title: "பிறந்த விவரங்கள் கோருதல்",
    text: "உங்கள் பிறந்த தேதி, நேரம் மற்றும் பிறந்த ஊர் விவரங்களை எங்கள் இன்பாக்ஸில் பகிர்ந்தால் விரிவான பலன்களை கணிக்க முடியும். நன்றி!",
    category: "consultation",
  },

  // --------------------------------------------------------------------------
  // ASTROLOGY — ENGLISH TEMPLATES
  // --------------------------------------------------------------------------
  {
    id: "tpl_astro_en_general",
    businessSlug: "astrology",
    language: "en",
    title: "General Greeting & Consultation",
    text: "Namaste! Thank you for your comment. For personalized horoscope readings and astrological guidance, please message our inbox or WhatsApp us.",
    category: "general",
  },
  {
    id: "tpl_astro_en_pricing",
    businessSlug: "astrology",
    language: "en",
    title: "Consultation Fees & Booking",
    text: "Thank you for reaching out! Consultation fee details and booking instructions have been sent to your inbox. We look forward to assisting you.",
    category: "pricing",
  },
  {
    id: "tpl_astro_en_birth_details",
    businessSlug: "astrology",
    language: "en",
    title: "Birth Details Request",
    text: "Please share your date, exact time, and place of birth in a direct message so our astrologer can examine your birth chart thoroughly.",
    category: "consultation",
  },

  // --------------------------------------------------------------------------
  // VIVAHAM — TAMIL TEMPLATES
  // --------------------------------------------------------------------------
  {
    id: "tpl_viva_ta_general",
    businessSlug: "vivaham",
    language: "ta",
    title: "விவாஹம் வரவேற்பு & பதிவு",
    text: "வணக்கம்! கோகுல் விவாஹம் மேட்ரிமோனி சேவைகளில் பதிவு செய்து உங்கள் குடும்பத்திற்கு ஏற்ற வரனை தேர்ந்தெடுக்க எங்கள் இன்பாக்ஸில் தொடர்பு கொள்ளவும்.",
    category: "general",
  },
  {
    id: "tpl_viva_ta_matching",
    businessSlug: "vivaham",
    language: "ta",
    title: "ஜாதகப் பொருத்தம் & வரன் விவரம்",
    text: "நன்றி! வரன் விவரங்கள் மற்றும் 10 பொருத்தங்கள் குறித்த தகவல்களை எங்கள் மேட்ரிமோனி ஒருங்கிணைப்பாளர் உங்களுக்கு உடனே அனுப்புவார்.",
    category: "registration",
  },
  {
    id: "tpl_viva_ta_membership",
    businessSlug: "vivaham",
    language: "ta",
    title: "உறுப்பினர் கட்டண விவரங்கள்",
    text: "கோகுல் விவாஹம் பிரீமியம் மேட்ச்மேக்கிங் திட்ட விவரங்களை உங்கள் இன்பாக்ஸில் பகிர்ந்துள்ளோம். நேரில் அல்லது ஆன்லைனில் பதிவு செய்யலாம்.",
    category: "pricing",
  },

  // --------------------------------------------------------------------------
  // VIVAHAM — ENGLISH TEMPLATES
  // --------------------------------------------------------------------------
  {
    id: "tpl_viva_en_general",
    businessSlug: "vivaham",
    language: "en",
    title: "Vivaham Matrimony Welcome",
    text: "Namaste! Thank you for your interest in Gokul Vivaham Matrimony. Please message us to register and explore verified profiles for your family.",
    category: "general",
  },
  {
    id: "tpl_viva_en_matching",
    businessSlug: "vivaham",
    language: "en",
    title: "Horoscope & Profile Matching",
    text: "Thank you for commenting! For verified alliance profiles and detailed horoscope matching, please send us a direct message.",
    category: "registration",
  },
  {
    id: "tpl_viva_en_membership",
    businessSlug: "vivaham",
    language: "en",
    title: "Membership Plans Information",
    text: "We have sent our membership tiers and matchmaking service details to your inbox. We look forward to helping you find the ideal match!",
    category: "pricing",
  },
];

export function getReplyTemplatesForBusiness(
  businessSlug: string,
  language?: "ta" | "en"
): SocialReplyTemplate[] {
  const normalizedSlug = businessSlug.toLowerCase().includes("vivaham") ? "vivaham" : "astrology";
  return PRESET_SOCIAL_REPLY_TEMPLATES.filter((tpl) => {
    const slugMatch = tpl.businessSlug === normalizedSlug || tpl.businessSlug === "all";
    const langMatch = !language || tpl.language === language;
    return slugMatch && langMatch;
  });
}
