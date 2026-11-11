export type FlowNodeType =
  | "trigger"
  | "condition"
  | "message"
  | "interactive"
  | "action"
  | "delay";

export interface FlowNodeConfig {
  // Trigger config
  triggerType?: "keyword" | "inbound" | "opt_in" | "scheduled";
  keywords?: string[];
  matchType?: "exact" | "contains" | "starts_with";

  // Message config
  messageText?: string;
  templateName?: string;
  mediaType?: "image" | "document" | "video";
  mediaUrl?: string;

  // Interactive config
  interactiveType?: "quick_reply" | "list_menu";
  buttons?: Array<{ id: string; title: string }>;
  menuSections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;

  // Condition config
  conditionType?: "business_hours" | "language" | "crm_stage" | "keyword_contains";
  operator?: "equals" | "contains" | "in_hours" | "out_of_hours";
  expectedValue?: string;

  // Action config
  actionType?: "assign_agent" | "human_takeover" | "set_crm_stage" | "add_tag";
  agentId?: string;
  agentName?: string;
  crmStage?: string;
  tag?: string;

  // Delay config
  delayMinutes?: number;
  delayHours?: number;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  data: {
    title: string;
    description?: string;
    config: FlowNodeConfig;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  sourceHandle?: string; // 'out', 'true', 'false', 'btn-0', etc.
  target: string;
  targetHandle?: string;
  label?: string;
}

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface VisualFlow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  trigger_keyword: string | null;
  status: "draft" | "published" | "archived";
  flow_type: "keyword" | "intake" | "support" | "booking" | "marketing";
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: FlowViewport;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  flow_type: "keyword" | "intake" | "support" | "booking" | "marketing";
  businessCategory: "astrology" | "vivaham" | "both";
  nodes: FlowNode[];
  edges: FlowEdge[];
}
