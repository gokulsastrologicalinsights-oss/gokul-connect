import { sanitizeMetaLog, MetaCloudApiError } from "@/lib/whatsapp/client";
import { WhatsAppMessageTemplate } from "./types";

const META_GRAPH_VERSION = "v26.0";
const META_GRAPH_BASE_URL = "https://graph.facebook.com";

export interface MetaRawTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components?: any[];
  rejected_reason?: string;
}

export interface MetaTemplatesResponse {
  data: MetaRawTemplate[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

/**
 * Retrieve approved WhatsApp templates from Meta Graph API for a WhatsApp Business Account (WABA).
 * Safely handles pagination, API error conditions, and never exposes access tokens.
 */
export async function fetchMetaTemplatesFromWaba(
  wabaId: string,
  accessToken: string,
  maxPages = 5
): Promise<MetaRawTemplate[]> {
  if (!wabaId?.trim()) throw new Error("wabaId is required to fetch Meta templates.");
  if (!accessToken?.trim()) throw new Error("accessToken is required to fetch Meta templates.");

  const allTemplates: MetaRawTemplate[] = [];
  let nextUrl: string | undefined =
    `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${encodeURIComponent(
      wabaId.trim()
    )}/message_templates?fields=name,status,category,language,components,id,rejected_reason&limit=100`;

  let pageCount = 0;

  while (nextUrl && pageCount < maxPages) {
    pageCount++;
    try {
      const response = await fetch(nextUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
          "Content-Type": "application/json",
        },
      });

      const json: MetaTemplatesResponse = await response.json();

      if (!response.ok || json.error) {
        const sanitizedUrl = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${wabaId}/message_templates`;
        throw new MetaCloudApiError(
          json.error || {
            message: `Failed to fetch message templates (HTTP ${response.status})`,
            type: "OAuthException",
            code: response.status,
          },
          sanitizedUrl
        );
      }

      if (Array.isArray(json.data)) {
        allTemplates.push(...json.data);
      }

      nextUrl = json.paging?.next;
    } catch (err: any) {
      if (err instanceof MetaCloudApiError) {
        throw err;
      }
      throw new Error(sanitizeMetaLog(err.message, accessToken));
    }
  }

  return allTemplates;
}
