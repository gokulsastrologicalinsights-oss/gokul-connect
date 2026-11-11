export interface LabelStyleConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
}

const PRESET_LABEL_STYLES: Record<string, LabelStyleConfig> = {
  vip: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  "follow-up required": {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  urgent: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  "consultation booked": {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  "profile verified": {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  "payment pending": {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  "horoscope matching": {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  "kundali ready": {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  "match shortlisted": {
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-200",
    dot: "bg-pink-500",
  },
  "membership enquiry": {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
  },
};

const FALLBACK_STYLES: LabelStyleConfig[] = [
  { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", dot: "bg-teal-500" },
  { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
  { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" },
  { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200", dot: "bg-fuchsia-500" },
];

export function getLabelStyle(label: string): LabelStyleConfig {
  const key = label.trim().toLowerCase();
  if (PRESET_LABEL_STYLES[key]) {
    return PRESET_LABEL_STYLES[key];
  }

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_STYLES[hash % FALLBACK_STYLES.length];
}

export function getSuggestedLabelsForBusiness(businessSlug?: string): string[] {
  if (businessSlug === "vivaham") {
    return [
      "VIP",
      "Profile Verified",
      "Follow-up Required",
      "Match Shortlisted",
      "Membership Enquiry",
      "Payment Pending",
      "Urgent",
    ];
  }

  return [
    "VIP",
    "Consultation Booked",
    "Follow-up Required",
    "Horoscope Matching",
    "Kundali Ready",
    "Payment Pending",
    "Urgent",
  ];
}

export function normalizeConversationLabels(labels: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of labels) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().slice(0, 40);
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.set(lower, trimmed);
    }
    if (seen.size >= 20) break;
  }
  return Array.from(seen.values());
}
