import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { VisualFlow } from "@/types/flows";
import { PREBUILT_FLOW_TEMPLATES } from "./templates";

// In-memory tenant-isolated store for mock/testing environments
const memoryFlows: Record<string, VisualFlow[]> = {};

function initMemoryStoreForBusiness(businessId: string, slug: string) {
  if (!memoryFlows[businessId]) {
    const templates = PREBUILT_FLOW_TEMPLATES.filter(
      (t) => t.businessCategory === slug || t.businessCategory === "both"
    );

    memoryFlows[businessId] = templates.map((t, idx) => ({
      id: `flow-${slug}-${idx + 1}`,
      business_id: businessId,
      name: t.name,
      description: t.description,
      trigger_keyword: t.nodes[0]?.data?.config?.keywords?.[0] || null,
      status: "published",
      flow_type: t.flow_type,
      nodes: t.nodes,
      edges: t.edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }
}

/**
 * List all visual flows for a given business tenant.
 * Guarantees 100% strict tenant isolation.
 */
export async function getFlowsForBusinessDb(
  businessId: string,
  businessSlug: string = "workspace",
  client?: any
): Promise<VisualFlow[]> {
  initMemoryStoreForBusiness(businessId, businessSlug);

  if (!isSupabaseConfigured() && !client) {
    return memoryFlows[businessId] || [];
  }

  try {
    const supabase = client || (await createServerSupabaseClient());
    const { data, error } = await supabase
      .from("wa_visual_flows")
      .select("*")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return memoryFlows[businessId] || [];
    }

    return data as VisualFlow[];
  } catch {
    return memoryFlows[businessId] || [];
  }
}

/**
 * Get a single visual flow by ID strictly scoped to this business.
 */
export async function getFlowByIdDb(
  businessId: string,
  businessSlug: string,
  flowId: string
): Promise<VisualFlow | null> {
  initMemoryStoreForBusiness(businessId, businessSlug);

  if (!isSupabaseConfigured()) {
    return memoryFlows[businessId]?.find((f) => f.id === flowId) || null;
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("wa_visual_flows")
      .select("*")
      .eq("id", flowId)
      .eq("business_id", businessId)
      .single();

    if (error || !data) {
      return memoryFlows[businessId]?.find((f) => f.id === flowId) || null;
    }

    return data as VisualFlow;
  } catch {
    return memoryFlows[businessId]?.find((f) => f.id === flowId) || null;
  }
}

/**
 * Save or update a visual conversation flow with tenant immutability.
 */
export async function saveFlowDb(
  businessId: string,
  businessSlug: string,
  flow: Partial<VisualFlow> & { name: string }
): Promise<VisualFlow> {
  initMemoryStoreForBusiness(businessId, businessSlug);

  const now = new Date().toISOString();
  const flowId = flow.id && !flow.id.startsWith("temp-") ? flow.id : `flow-${Date.now()}`;

  const flowRecord: VisualFlow = {
    id: flowId,
    business_id: businessId,
    name: flow.name,
    description: flow.description || null,
    trigger_keyword:
      flow.trigger_keyword ||
      flow.nodes?.find((n) => n.type === "trigger")?.data?.config?.keywords?.[0] ||
      null,
    status: flow.status || "draft",
    flow_type: flow.flow_type || "keyword",
    nodes: flow.nodes || [],
    edges: flow.edges || [],
    viewport: flow.viewport || { x: 0, y: 0, zoom: 1 },
    is_active: flow.is_active ?? true,
    created_at: flow.created_at || now,
    updated_at: now,
  };

  // Update in-memory fallback
  const existingIdx = memoryFlows[businessId]?.findIndex((f) => f.id === flowRecord.id);
  if (existingIdx !== undefined && existingIdx >= 0) {
    memoryFlows[businessId][existingIdx] = flowRecord;
  } else {
    memoryFlows[businessId] = [flowRecord, ...(memoryFlows[businessId] || [])];
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from("wa_visual_flows")
        .upsert(
          {
            id: flowRecord.id,
            business_id: businessId,
            name: flowRecord.name,
            description: flowRecord.description,
            trigger_keyword: flowRecord.trigger_keyword,
            status: flowRecord.status,
            flow_type: flowRecord.flow_type,
            nodes: flowRecord.nodes,
            edges: flowRecord.edges,
            viewport: flowRecord.viewport,
            is_active: flowRecord.is_active,
            updated_at: now,
          },
          { onConflict: "id,business_id" }
        )
        .select()
        .single();

      if (!error && data) {
        return data as VisualFlow;
      }
    } catch {
      // Return memory record on error
    }
  }

  return flowRecord;
}

/**
 * Delete a visual flow for a business tenant.
 */
export async function deleteFlowDb(
  businessId: string,
  flowId: string
): Promise<boolean> {
  if (memoryFlows[businessId]) {
    memoryFlows[businessId] = memoryFlows[businessId].filter((f) => f.id !== flowId);
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createServerSupabaseClient();
      await supabase
        .from("wa_visual_flows")
        .delete()
        .eq("id", flowId)
        .eq("business_id", businessId);
    } catch {}
  }

  return true;
}
