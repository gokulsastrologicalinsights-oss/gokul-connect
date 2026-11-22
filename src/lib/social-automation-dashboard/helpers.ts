import type {
  MetaSocialRulePlatform,
  MetaSocialRuleTarget,
  MetaSocialMatchType,
  MetaSocialResponseAction,
} from "@/lib/meta-social/types";
import type { MetaSocialLeadClassification } from "@/lib/meta-social/leads-store";

export function formatPlatformLabel(platform: MetaSocialRulePlatform): string {
  switch (platform) {
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
    case "both":
      return "FB & Instagram";
    default:
      return platform;
  }
}

export function formatTargetLabel(target: MetaSocialRuleTarget): string {
  switch (target) {
    case "comment":
      return "Comments Only";
    case "message":
      return "Direct Messages";
    case "both":
      return "Comments & DMs";
    default:
      return target;
  }
}

export function formatMatchTypeLabel(matchType: MetaSocialMatchType): string {
  switch (matchType) {
    case "contains":
      return "Contains Keyword";
    case "exact":
      return "Exact Match";
    case "starts_with":
      return "Starts With";
    case "any":
      return "Any (Catch-All)";
    default:
      return matchType;
  }
}

export function formatActionLabel(action: MetaSocialResponseAction): string {
  switch (action) {
    case "reply_comment_public":
      return "Public Comment Reply";
    case "reply_comment_private_dm":
      return "Private DM (Meta Private Replies)";
    case "reply_dm":
      return "Direct Message Reply";
    case "both_public_and_private":
      return "Public Reply + Private DM";
    default:
      return action;
  }
}

export function getLeadIntentBadge(intent: MetaSocialLeadClassification): {
  label: string;
  className: string;
} {
  switch (intent) {
    case "high_intent":
      return {
        label: "High Intent Lead",
        className: "bg-purple-100 text-purple-800 border-purple-200",
      };
    case "new_enquiry":
      return {
        label: "New Enquiry",
        className: "bg-blue-100 text-blue-800 border-blue-200",
      };
    case "followup_needed":
      return {
        label: "Follow-up Needed",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "general":
    default:
      return {
        label: "General Enquiry",
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(isoString).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}
