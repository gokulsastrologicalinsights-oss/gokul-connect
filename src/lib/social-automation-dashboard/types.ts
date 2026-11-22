import type {
  MetaSocialRule,
  MetaSocialRulePlatform,
  MetaSocialRuleTarget,
  MetaSocialMatchType,
  MetaSocialResponseAction,
} from "@/lib/meta-social/types";
import type { SafeMetaSocialConnection } from "@/lib/meta-social/connections-store";
import type { MetaSocialLead, SocialLeadFilters } from "@/lib/meta-social/leads-store";
import type { MetaSocialReplyTemplate } from "@/lib/meta-social/rules-store";
import type { ConfigurationWarning, SocialDashboardData } from "@/app/actions/social-automations";

export type DashboardActiveTab =
  | "overview"
  | "rules"
  | "templates"
  | "leads"
  | "simulator"
  | "channels"
  | "activity";

export interface TabDefinition {
  id: DashboardActiveTab;
  label: string;
  badge?: number | string;
  iconName: string;
}

export interface RuleFormData {
  id?: string;
  ruleName: string;
  description: string;
  platform: MetaSocialRulePlatform;
  targetType: MetaSocialRuleTarget;
  keywords: string[];
  matchType: MetaSocialMatchType;
  responseAction: MetaSocialResponseAction;
  predefinedReply: string;
  predefinedDm: string;
  priority: number;
  isActive: boolean;
  stopProcessingOnMatch: boolean;
}

export {
  type MetaSocialRule,
  type MetaSocialRulePlatform,
  type MetaSocialRuleTarget,
  type MetaSocialMatchType,
  type MetaSocialResponseAction,
  type SafeMetaSocialConnection,
  type MetaSocialLead,
  type SocialLeadFilters,
  type MetaSocialReplyTemplate,
  type ConfigurationWarning,
  type SocialDashboardData,
};
