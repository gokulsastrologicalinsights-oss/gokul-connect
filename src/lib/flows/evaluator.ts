import { VisualFlow, FlowNode, FlowEdge } from "@/types/flows";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getFlowsForBusinessDb } from "./database";
import {
  WhatsAppContact,
  WhatsAppConversation,
  BusinessHoursConfig,
} from "@/types/database";

export interface FlowActionToDispatch {
  nodeId: string;
  action_type: "send_text_message" | "send_template_message" | "send_media_message";
  delay_seconds: number;
  payload: {
    message_text?: string;
    template_name?: string;
    template_language?: string;
    buttons?: Array<{ id: string; title: string }>;
    media_type?: string;
    media_url?: string;
  };
}

export interface FlowEvaluationResult {
  matched: boolean;
  flowId?: string;
  flowName?: string;
  executedNodeIds: string[];
  contactUpdates?: Partial<WhatsAppContact>;
  conversationUpdates?: Partial<WhatsAppConversation>;
  actionsToDispatch: FlowActionToDispatch[];
  skipReason?: string;
}

/**
 * Fetch active, published visual flows for a business tenant
 */
export async function getPublishedFlowsForBusiness(
  businessId: string,
  businessSlug: string = "workspace",
  client?: any
): Promise<VisualFlow[]> {
  const allFlows = await getFlowsForBusinessDb(businessId, businessSlug, client);
  return allFlows.filter(
    (f) => f.business_id === businessId && f.status === "published" && f.is_active === true
  );
}

/**
 * Deterministically match an inbound message against a flow's keyword trigger node
 */
export function matchFlowTrigger(flow: VisualFlow, text: string): FlowNode | null {
  if (!flow || !flow.nodes || flow.status !== "published" || !flow.is_active) {
    return null;
  }

  const triggerNode = flow.nodes.find((n) => n.type === "trigger");
  if (!triggerNode || !triggerNode.data?.config) {
    return null;
  }

  const config = triggerNode.data.config;
  const keywords = config.keywords || (flow.trigger_keyword ? [flow.trigger_keyword] : []);
  if (keywords.length === 0) {
    return null;
  }

  const normalized = (text || "").toLowerCase().trim();
  const matchType = config.matchType || "contains";

  const matched = keywords.some((kw) => {
    const k = kw.toLowerCase().trim();
    if (!k) return false;
    if (matchType === "exact") return normalized === k;
    if (matchType === "starts_with") return normalized.startsWith(k);
    return normalized.includes(k);
  });

  return matched ? triggerNode : null;
}

/**
 * Evaluate whether current time is within business hours for Asia/Kolkata
 */
export function isWithinBusinessHours(
  businessHours?: BusinessHoursConfig,
  now: Date = new Date()
): boolean {
  if (!businessHours || !businessHours.enabled) {
    return true; // If hours not configured/enabled, default to open
  }

  // Convert now to Asia/Kolkata
  const kolkataTimeString = now.toLocaleString("en-US", {
    timeZone: businessHours.timezone || "Asia/Kolkata",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const parts = kolkataTimeString.split(" ");
  const dayShort = (parts[0]?.replace(",", "").toLowerCase() || "mon").slice(0, 3);
  const timePart = parts[1] || "12:00";
  const [currentHour, currentMin] = timePart.split(":").map(Number);
  const currentTotalMinutes = currentHour * 60 + currentMin;

  const DAY_MAP: Record<string, keyof BusinessHoursConfig["weekly_schedule"]> = {
    mon: "monday",
    tue: "tuesday",
    wed: "wednesday",
    thu: "thursday",
    fri: "friday",
    sat: "saturday",
    sun: "sunday",
  };

  const dayKey = DAY_MAP[dayShort] || "monday";
  const daySchedule = businessHours.weekly_schedule?.[dayKey];
  if (!daySchedule || !daySchedule.is_open) {
    return false;
  }

  const [openHour, openMin] = daySchedule.open_time.split(":").map(Number);
  const [closeHour, closeMin] = daySchedule.close_time.split(":").map(Number);

  const openTotalMinutes = openHour * 60 + openMin;
  const closeTotalMinutes = closeHour * 60 + closeMin;

  return (
    currentTotalMinutes >= openTotalMinutes &&
    currentTotalMinutes <= closeTotalMinutes
  );
}

/**
 * Execute a visual flow graph starting from the trigger node.
 * Evaluates conditions, gathers actions and message responses, enforces cycle limits.
 */
export function evaluateVisualFlow(params: {
  flow: VisualFlow;
  messageContent: string;
  contact: WhatsAppContact;
  conversation: WhatsAppConversation;
  businessHours?: BusinessHoursConfig;
  now?: Date;
}): FlowEvaluationResult {
  const { flow, messageContent, contact, conversation, businessHours, now = new Date() } = params;

  const result: FlowEvaluationResult = {
    matched: true,
    flowId: flow.id,
    flowName: flow.name,
    executedNodeIds: [],
    contactUpdates: {},
    conversationUpdates: {},
    actionsToDispatch: [],
  };

  const triggerNode = matchFlowTrigger(flow, messageContent);
  if (!triggerNode) {
    return {
      matched: false,
      executedNodeIds: [],
      actionsToDispatch: [],
      skipReason: "Trigger keyword did not match inbound message.",
    };
  }

  result.executedNodeIds.push(triggerNode.id);

  // Traverse nodes with cycle detection
  const visited = new Set<string>([triggerNode.id]);
  let currentNodeId: string | null = triggerNode.id;
  let currentDelaySeconds = 0;
  let maxSteps = 15; // Prevent infinite loops

  while (currentNodeId && maxSteps > 0) {
    maxSteps--;

    const outgoingEdges = flow.edges.filter((e) => e.source === currentNodeId);
    if (outgoingEdges.length === 0) {
      break; // End node reached
    }

    const currentNode = flow.nodes.find((n) => n.id === currentNodeId);
    let nextEdge: FlowEdge | null = null;

    if (currentNode?.type === "condition") {
      const config = currentNode.data.config;
      let conditionMet = false;

      if (config.conditionType === "business_hours") {
        const inHours = isWithinBusinessHours(businessHours, now);
        conditionMet = config.operator === "out_of_hours" ? !inHours : inHours;
      } else if (config.conditionType === "crm_stage") {
        conditionMet = contact.lifecycle_stage_slug === config.expectedValue;
      } else if (config.conditionType === "keyword_contains") {
        conditionMet = messageContent
          .toLowerCase()
          .includes((config.expectedValue || "").toLowerCase());
      } else {
        conditionMet = true;
      }

      // Branch along true/false handle
      nextEdge =
        outgoingEdges.find((e) =>
          conditionMet
            ? e.sourceHandle === "true" || e.label?.toLowerCase().includes("in hours") || e.label?.toLowerCase().includes("during")
            : e.sourceHandle === "false" || e.label?.toLowerCase().includes("after") || e.label?.toLowerCase().includes("out")
        ) || outgoingEdges[0];
    } else {
      // Linear transition
      nextEdge = outgoingEdges[0];
    }

    if (!nextEdge || !nextEdge.target) {
      break;
    }

    const targetNode = flow.nodes.find((n) => n.id === nextEdge.target);
    if (!targetNode) {
      break;
    }

    if (visited.has(targetNode.id)) {
      // Loop detected; stop safely
      break;
    }

    visited.add(targetNode.id);
    result.executedNodeIds.push(targetNode.id);
    currentNodeId = targetNode.id;

    // Process node effect
    if (targetNode.type === "delay") {
      const config = targetNode.data.config;
      const delayMins = config.delayMinutes || 0;
      const delayHrs = config.delayHours || 0;
      currentDelaySeconds += delayHrs * 3600 + delayMins * 60;
    } else if (targetNode.type === "action") {
      const config = targetNode.data.config;
      if (config.actionType === "human_takeover") {
        result.conversationUpdates!.status = "pending_human";
      } else if (config.actionType === "assign_agent") {
        if (config.agentId) result.conversationUpdates!.assigned_agent_id = config.agentId;
        if (config.agentName) result.conversationUpdates!.assigned_agent_name = config.agentName;
      }

      if (config.crmStage) {
        result.contactUpdates!.lifecycle_stage_slug = config.crmStage;
      }
      if (config.tag) {
        const existingTags = contact.tags || [];
        if (!existingTags.includes(config.tag)) {
          result.contactUpdates!.tags = [...existingTags, config.tag];
        }
      }
    } else if (targetNode.type === "message" || targetNode.type === "interactive") {
      const config = targetNode.data.config;
      let textBody = config.messageText || "";

      // If interactive buttons present, format them
      if (config.buttons && config.buttons.length > 0) {
        const btnOptions = config.buttons.map((b, i) => `[${i + 1}] ${b.title}`).join("\n");
        textBody = textBody ? `${textBody}\n\nOptions:\n${btnOptions}` : btnOptions;
      }

      result.actionsToDispatch.push({
        nodeId: targetNode.id,
        action_type: config.templateName ? "send_template_message" : "send_text_message",
        delay_seconds: currentDelaySeconds,
        payload: {
          message_text: textBody,
          template_name: config.templateName,
          buttons: config.buttons,
          media_type: config.mediaType,
          media_url: config.mediaUrl,
        },
      });

      // Reset delay for next message
      currentDelaySeconds = 0;
    }
  }

  return result;
}
