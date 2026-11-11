"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ConversationNavPanel } from "./ConversationNavPanel";
import { ConversationListPanel } from "./ConversationListPanel";
import { ChatWindowPanel } from "./ChatWindowPanel";
import { StartConversationModal } from "./StartConversationModal";
import {
  assignConversationAgentAction,
  createCannedResponseAction,
  deleteCannedResponseAction,
  getApprovedTemplatesAction,
  getConversationMessagesAction,
  getMediaDownloadUrlAction,
  listCannedResponsesAction,
  retryFailedMediaMessageAction,
  sendWhatsAppMediaMessageAction,
  sendWhatsAppMessageAction,
  toggleConversationReadAction,
  updateCannedResponseAction,
  updateConversationLabelsAction,
  updateConversationStatusAction,
} from "@/app/actions/inbox";
import {
  Business,
  CannedResponse,
  InboxCounts,
  InboxFolder,
  SafeWhatsAppConnection,
  SupportedMediaType,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppMessageTemplate,
  TeamMemberWithProfile,
} from "@/types/database";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client";
import { X, Wifi, Radio } from "lucide-react";

interface InboxClientProps {
  business: Business;
  initialConversations: WhatsAppConversation[];
  initialCounts: InboxCounts;
  connections: SafeWhatsAppConnection[];
  initialMessages?: WhatsAppMessage[];
  initialHasMore?: boolean;
  initialSelectedConversationId?: string | null;
  initialFolder?: InboxFolder;
  initialConnectionId?: string;
  initialLabel?: string;
  initialCannedResponses?: CannedResponse[];
  currentUser?: any;
  currentMembership?: any;
  teamMembers?: TeamMemberWithProfile[];
}

export function InboxClient({
  business,
  initialConversations,
  initialCounts,
  connections,
  initialMessages = [],
  initialHasMore = false,
  initialSelectedConversationId = null,
  initialFolder = "all",
  initialConnectionId = "all",
  initialLabel = "all",
  initialCannedResponses = [],
  currentUser,
  currentMembership,
  teamMembers = [],
}: InboxClientProps) {
  const myUserId = currentUser?.id || "owner-user-00000000-0000-0000-0000-000000000001";
  const isViewer = currentMembership?.role === "viewer";
  const [conversations, setConversations] = useState<WhatsAppConversation[]>(initialConversations);
  const [activeFolder, setActiveFolder] = useState<InboxFolder>(initialFolder);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(initialConnectionId);
  const [selectedLabel, setSelectedLabel] = useState<string>(initialLabel || "all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showStartChatModal, setShowStartChatModal] = useState<boolean>(false);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>(initialCannedResponses);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialSelectedConversationId ?? (initialConversations.length > 0 ? initialConversations[0].id : null)
  );
  const [showMobileChat, setShowMobileChat] = useState<boolean>(!!initialSelectedConversationId);
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState<boolean>(false);

  // Real database message history state
  const [messages, setMessages] = useState<WhatsAppMessage[]>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(initialHasMore);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [approvedTemplates, setApprovedTemplates] = useState<WhatsAppMessageTemplate[]>([]);

  // Load approved templates and quick replies for this business
  useEffect(() => {
    let isMounted = true;
    getApprovedTemplatesAction(business.slug, selectedConnectionId !== "all" ? selectedConnectionId : undefined)
      .then((res) => {
        if (isMounted && res.success && res.templates) {
          setApprovedTemplates(res.templates);
        }
      })
      .catch((err) => console.error("Failed to load approved templates:", err));

    if (initialCannedResponses.length === 0) {
      listCannedResponsesAction(business.slug)
        .then((res) => {
          if (isMounted && res.success && res.responses) {
            setCannedResponses(res.responses);
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [business.slug, selectedConnectionId]);

  // Realtime subscription status
  const [realtimeStatus, setRealtimeStatus] = useState<"connected" | "connecting" | "polling">(
    isSupabaseConfigured() ? "connecting" : "polling"
  );

  // Upgraded: Supabase Realtime Subscriptions (WebSockets via supabase.channel)
  // Replaces constant 4-second polling with instant event-driven streaming
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setRealtimeStatus("polling");
      return;
    }

    let supabase: any = null;
    try {
      supabase = createClient();
    } catch {
      setRealtimeStatus("polling");
      return;
    }

    const channelName = `inbox-realtime-${business.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wa_messages",
          filter: `business_id=eq.${business.id}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new as WhatsAppMessage;

            // 1. If message belongs to active thread, append to messages
            if (newMsg.conversation_id === selectedConversationId) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                const clean = prev.filter((m) => {
                  if (m.id.startsWith("temp-") && m.content === newMsg.content && m.direction === newMsg.direction) {
                    return false;
                  }
                  return true;
                });
                return [...clean, newMsg];
              });
            }

            // 2. Update conversation list preview & unread count instantly
            setConversations((prev) => {
              const updated = prev.map((conv) => {
                if (conv.id === newMsg.conversation_id) {
                  const isCurrentView = conv.id === selectedConversationId;
                  const newUnread =
                    isCurrentView || newMsg.direction === "outbound"
                      ? conv.unread_count
                      : (conv.unread_count || 0) + 1;

                  return {
                    ...conv,
                    last_message_preview: newMsg.content || `[${newMsg.message_type}]`,
                    last_message_at: newMsg.created_at,
                    unread_count: newUnread,
                  };
                }
                return conv;
              });

              return updated.sort((a, b) => {
                const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
                const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
                return dateB - dateA;
              });
            });

            // 3. Broadcast unread update to sidebar
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("workspace:unread-count-sync", {
                  detail: { businessId: business.id, businessSlug: business.slug },
                })
              );
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedMsg = payload.new as WhatsAppMessage;
            if (updatedMsg.conversation_id === selectedConversationId) {
              setMessages((prev) =>
                prev.map((m) => (m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m))
              );
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wa_conversations",
          filter: `business_id=eq.${business.id}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            const newConv = payload.new as WhatsAppConversation;
            setConversations((prev) => {
              if (prev.some((c) => c.id === newConv.id)) return prev;
              return [newConv, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedConv = payload.new as WhatsAppConversation;
            setConversations((prev) =>
              prev.map((c) => (c.id === updatedConv.id ? { ...c, ...updatedConv } : c))
            );
          }

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("workspace:unread-count-sync", {
                detail: { businessId: business.id, businessSlug: business.slug },
              })
            );
          }
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("polling");
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [business.id, business.slug, selectedConversationId]);

  // Resilient fallback heartbeat: slow idle check (30s if Realtime is connected, 6s if offline/polling fallback)
  useEffect(() => {
    if (!selectedConversationId) return;

    let isMounted = true;
    const intervalMs = realtimeStatus === "connected" ? 30000 : 6000;

    const intervalId = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;

      try {
        const res = await getConversationMessagesAction(business.slug, selectedConversationId, { limit: 50 });
        if (isMounted && res.success && res.messages) {
          setMessages((prev) => {
            const prevMap = new Map(prev.map((m) => [m.id, m]));
            let hasChange = false;

            if (prev.length !== res.messages.length) {
              hasChange = true;
            } else {
              for (const newMsg of res.messages) {
                const old = prevMap.get(newMsg.id);
                if (!old || old.status !== newMsg.status) {
                  hasChange = true;
                  break;
                }
              }
            }

            if (!hasChange) return prev;

            const serverIds = new Set(res.messages.map((m) => m.id));
            const localPending = prev.filter((m) => m.id.startsWith("temp-") && !serverIds.has(m.id));

            return [...res.messages, ...localPending];
          });
        }
      } catch {
        // Silently ignore background polling failure
      }
    }, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [business.slug, selectedConversationId, realtimeStatus]);

  // Synchronize URL parameters with current inbox state
  const syncUrlParams = (
    convId: string | null,
    folder: InboxFolder,
    line: string,
    label: string = selectedLabel
  ) => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (convId) {
        url.searchParams.set("c", convId);
      } else {
        url.searchParams.delete("c");
      }
      if (folder && folder !== "all") {
        url.searchParams.set("folder", folder);
      } else {
        url.searchParams.delete("folder");
      }
      if (line && line !== "all") {
        url.searchParams.set("line", line);
      } else {
        url.searchParams.delete("line");
      }
      if (label && label !== "all") {
        url.searchParams.set("label", label);
      } else {
        url.searchParams.delete("label");
      }
      window.history.pushState({ c: convId, folder, line, label }, "", url.toString());
    } catch {
      // Fallback for non-standard environments
    }
  };

  // Support browser Back and Forward navigation via popstate
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const convId = params.get("c");
      const folder = (params.get("folder") as InboxFolder) || "all";
      const line = params.get("line") || "all";
      const label = params.get("label") || "all";

      setActiveFolder(folder);
      setSelectedConnectionId(line);
      setSelectedLabel(label);

      if (convId) {
        setSelectedConversationId(convId);
        setShowMobileChat(true);
      } else {
        setShowMobileChat(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Compute distinct conversation labels with counts for sidebar filter
  const availableLabels = useMemo(() => {
    const countsMap = new Map<string, number>();
    const activeConvs =
      selectedConnectionId === "all"
        ? conversations
        : conversations.filter((c) => c.connection_id === selectedConnectionId);

    for (const conv of activeConvs) {
      for (const lbl of conv.labels || []) {
        const clean = lbl.trim();
        if (!clean) continue;
        countsMap.set(clean, (countsMap.get(clean) || 0) + 1);
      }
    }

    return Array.from(countsMap.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [conversations, selectedConnectionId]);

  // Compute filtered conversations
  const filteredConversations = useMemo(() => {
    return conversations
      .filter((c) => {
        // 1. Connection filter
        if (selectedConnectionId !== "all" && c.connection_id !== selectedConnectionId) {
          return false;
        }

        // 1b. Label filter
        if (selectedLabel !== "all" && !(c.labels || []).includes(selectedLabel)) {
          return false;
        }

        // 2. Folder filter
        switch (activeFolder) {
          case "unread":
            return c.unread_count > 0;
          case "unassigned":
            return !c.assigned_agent_id;
          case "assigned_to_me":
            return c.assigned_agent_id === myUserId;
          case "open":
            return c.status === "open";
          case "pending":
            return c.status === "pending_human";
          case "resolved":
            return c.status === "closed";
          case "archived":
            return c.status === "archived";
          case "all":
          default:
            return c.status !== "archived";
        }
      })
      .filter((c) => {
        // 3. Search query filter
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const name = c.contact?.display_name?.toLowerCase() || "";
        const phone = c.contact?.phone_number?.toLowerCase() || "";
        const preview = c.last_message_preview?.toLowerCase() || "";
        const labels = (c.labels || []).join(" ").toLowerCase();
        return name.includes(q) || phone.includes(q) || preview.includes(q) || labels.includes(q);
      })
      .sort((a, b) => {
        const tA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tB - tA;
      });
  }, [conversations, selectedConnectionId, selectedLabel, activeFolder, searchQuery, myUserId]);

  // Dynamically recalculate folder counts based on current conversation states
  const counts: InboxCounts = useMemo(() => {
    const active = selectedConnectionId === "all"
      ? conversations
      : conversations.filter((c) => c.connection_id === selectedConnectionId);

    return {
      all: active.filter((c) => c.status !== "archived").length,
      unread: active.filter((c) => c.unread_count > 0 && c.status !== "archived").length,
      unassigned: active.filter((c) => !c.assigned_agent_id && c.status !== "archived").length,
      assigned_to_me: active.filter((c) => c.assigned_agent_id === myUserId && c.status !== "archived").length,
      open: active.filter((c) => c.status === "open").length,
      pending: active.filter((c) => c.status === "pending_human").length,
      resolved: active.filter((c) => c.status === "closed").length,
      archived: active.filter((c) => c.status === "archived").length,
    };
  }, [conversations, selectedConnectionId, myUserId]);

  // Selected conversation object
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  // Select conversation handler & load real message history
  const handleSelectConversation = async (convId: string) => {
    const prevId = selectedConversationId;
    setSelectedConversationId(convId);
    setShowMobileChat(true);

    // Synchronize selected conversation with browser URL parameters
    syncUrlParams(convId, activeFolder, selectedConnectionId);

    // Auto mark as read if has unread messages
    const target = conversations.find((c) => c.id === convId);
    if (target && target.unread_count > 0) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
      try {
        await toggleConversationReadAction(business.slug, convId, true);
      } catch (err) {
        console.error("Failed to mark conversation as read:", err);
      }
    }

    // Load real message history if changing conversation
    if (prevId !== convId) {
      setIsLoadingMessages(true);
      try {
        const res = await getConversationMessagesAction(business.slug, convId, { limit: 50 });
        if (res.success) {
          setMessages(res.messages);
          setHasMoreMessages(res.hasMore);
        }
      } catch (err) {
        console.error("Failed to load conversation messages from Supabase:", err);
        setMessages([]);
        setHasMoreMessages(false);
      } finally {
        setIsLoadingMessages(false);
      }
    }
  };

  // Load older messages for pagination
  const handleLoadOlderMessages = async () => {
    if (!selectedConversationId || isLoadingOlder || !hasMoreMessages) return;
    const oldestTimestamp = messages[0]?.created_at;
    if (!oldestTimestamp) return;

    setIsLoadingOlder(true);
    try {
      const res = await getConversationMessagesAction(business.slug, selectedConversationId, {
        limit: 50,
        before: oldestTimestamp,
      });
      if (res.success) {
        setMessages((prev) => [...res.messages, ...prev]);
        setHasMoreMessages(res.hasMore);
      }
    } catch (err) {
      console.error("Failed to load older messages from Supabase:", err);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Toggle Read / Unread handler
  const handleToggleRead = async (convId: string, currentUnread: number) => {
    const isNowRead = currentUnread > 0;
    const newCount = isNowRead ? 0 : 1;

    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unread_count: newCount } : c))
    );

    try {
      await toggleConversationReadAction(business.slug, convId, isNowRead);
    } catch (err) {
      console.error("Failed to toggle read state:", err);
    }
  };

  // Update Status handler
  const handleUpdateStatus = async (
    convId: string,
    newStatus: WhatsAppConversation["status"]
  ) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, status: newStatus } : c))
    );

    try {
      await updateConversationStatusAction(business.slug, convId, newStatus);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  // Assign Agent handler
  const handleAssignAgent = async (
    convId: string,
    agentId: string | null,
    agentName: string | null
  ) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, assigned_agent_id: agentId, assigned_agent_name: agentName }
          : c
      )
    );

    try {
      await assignConversationAgentAction(business.slug, convId, agentId, agentName);
    } catch (err) {
      console.error("Failed to assign agent:", err);
    }
  };

  // Update Labels handler (with optimistic update & rollback)
  const handleUpdateLabels = async (
    convId: string,
    nextLabels: string[]
  ): Promise<{ success: boolean; error?: string }> => {
    const previous = conversations.find((c) => c.id === convId)?.labels || [];

    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, labels: nextLabels } : c))
    );

    try {
      const res = await updateConversationLabelsAction({
        businessSlug: business.slug,
        conversationId: convId,
        labels: nextLabels,
      });

      if (res.success && res.labels) {
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, labels: res.labels } : c))
        );
        return { success: true };
      }

      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, labels: previous } : c))
      );
      return { success: false, error: res.error || "Failed to update labels." };
    } catch (err: any) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, labels: previous } : c))
      );
      return { success: false, error: err?.message || "Failed to update labels." };
    }
  };

  // Canned Responses CRUD handlers
  const handleCreateCannedResponse = async (input: {
    shortcut: string;
    title: string;
    content: string;
    category: string;
  }) => {
    const res = await createCannedResponseAction({
      businessSlug: business.slug,
      ...input,
    });
    if (res.success && res.response) {
      setCannedResponses((prev) =>
        [...prev, res.response!].sort((a, b) => a.shortcut.localeCompare(b.shortcut))
      );
    }
    return res;
  };

  const handleUpdateCannedResponse = async (input: {
    responseId: string;
    shortcut: string;
    title: string;
    content: string;
    category: string;
  }) => {
    const res = await updateCannedResponseAction({
      businessSlug: business.slug,
      ...input,
    });
    if (res.success && res.response) {
      setCannedResponses((prev) =>
        prev
          .map((r) => (r.id === res.response!.id ? res.response! : r))
          .sort((a, b) => a.shortcut.localeCompare(b.shortcut))
      );
    }
    return res;
  };

  const handleDeleteCannedResponse = async (responseId: string) => {
    const res = await deleteCannedResponseAction({
      businessSlug: business.slug,
      responseId,
    });
    if (res.success) {
      setCannedResponses((prev) => prev.filter((r) => r.id !== responseId));
    }
    return res;
  };

  // Handle newly initiated conversation from Start New Chat modal
  const handleConversationStarted = async (result: {
    conversationId: string;
    conversation?: WhatsAppConversation | null;
    message?: WhatsAppMessage;
  }) => {
    const { conversationId, conversation, message } = result;
    if (conversation) {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conversation.id);
        const merged = exists
          ? prev.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
          : [conversation, ...prev];
        return merged.sort((a, b) => {
          const tA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const tB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return tB - tA;
        });
      });
    }

    setActiveFolder("all");
    setSelectedLabel("all");
    setSelectedConversationId(conversationId);
    setShowMobileChat(true);
    syncUrlParams(conversationId, "all", selectedConnectionId, "all");

    if (message) {
      setMessages([message]);
      setHasMoreMessages(false);
    } else {
      setIsLoadingMessages(true);
      try {
        const res = await getConversationMessagesAction(business.slug, conversationId, { limit: 50 });
        if (res.success) {
          setMessages(res.messages);
          setHasMoreMessages(res.hasMore);
        }
      } catch {
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("workspace:unread-count-sync", {
          detail: { businessId: business.id, businessSlug: business.slug },
        })
      );
    }
  };

  const folderTitle = useMemo(() => {
    switch (activeFolder) {
      case "unread":
        return "Unread Enquiries";
      case "unassigned":
        return "Unassigned Chats";
      case "assigned_to_me":
        return "Assigned to Me";
      case "open":
        return "Open Conversations";
      case "pending":
        return "Pending Follow-ups";
      case "resolved":
        return "Resolved Cases";
      case "archived":
        return "Archived Enquiries";
      case "all":
      default:
        return "All Conversations";
    }
  }, [activeFolder]);

  // Phase 4B: Send interactive WhatsApp text message with optimistic UI update
  const handleSendMessage = async (text: string) => {
    if (!selectedConversationId || !activeConversation) {
      return { success: false, error: "No active conversation selected." };
    }

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // Create optimistic message
    const optimisticMsg: WhatsAppMessage = {
      id: tempId,
      business_id: business.id,
      connection_id: activeConversation.connection_id,
      conversation_id: activeConversation.id,
      contact_id: activeConversation.contact_id,
      direction: "outbound",
      message_type: "text",
      content: text,
      meta_message_id: null,
      status: "pending",
      error_code: null,
      error_message: null,
      sent_at: null,
      delivered_at: null,
      read_at: null,
      raw_payload: { text },
      created_at: nowIso,
      updated_at: nowIso,
    };

    // Optimistically update message list and conversation preview
    setMessages((prev) => [...prev, optimisticMsg]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? {
              ...c,
              last_message_preview: text.slice(0, 200),
              last_message_at: nowIso,
            }
          : c
      )
    );

    try {
      const res = await sendWhatsAppMessageAction({
        businessSlug: business.slug,
        conversationId: selectedConversationId,
        text,
      });

      if (res.success && res.message) {
        const persistedMsg = res.message;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? persistedMsg : m))
        );
        return { success: true };
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, status: "failed", error_message: res.error || "Delivery failed" }
              : m
          )
        );
        return {
          success: false,
          error: res.error,
          isWindowClosed: res.isWindowClosed,
        };
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, status: "failed", error_message: err.message || "Sending failed" }
            : m
        )
      );
      return { success: false, error: err.message || "Failed to send message" };
    }
  };

  // Phase 4B & Phase 11: Send approved WhatsApp template message with dynamic variables
  const handleSendTemplate = async (
    templateName: string,
    languageCode = "en_US",
    components?: Array<Record<string, unknown>>
  ) => {
    if (!selectedConversationId || !activeConversation) {
      return { success: false, error: "No active conversation selected." };
    }

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const preview = `[Template: ${templateName}]`;

    const optimisticMsg: WhatsAppMessage = {
      id: tempId,
      business_id: business.id,
      connection_id: activeConversation.connection_id,
      conversation_id: activeConversation.id,
      contact_id: activeConversation.contact_id,
      direction: "outbound",
      message_type: "template",
      content: preview,
      meta_message_id: null,
      status: "pending",
      error_code: null,
      error_message: null,
      sent_at: null,
      delivered_at: null,
      read_at: null,
      raw_payload: { template: { name: templateName, languageCode, components } },
      created_at: nowIso,
      updated_at: nowIso,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? {
              ...c,
              last_message_preview: preview,
              last_message_at: nowIso,
            }
          : c
      )
    );

    try {
      const res = await sendWhatsAppMessageAction({
        businessSlug: business.slug,
        conversationId: selectedConversationId,
        template: { name: templateName, languageCode, components },
      });

      if (res.success && res.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? res.message! : m))
        );
        return { success: true };
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, status: "failed", error_message: res.error || "Template failed" }
              : m
          )
        );
        return { success: false, error: res.error };
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, status: "failed", error_message: err.message || "Template error" }
            : m
        )
      );
      return { success: false, error: err.message || "Template error" };
    }
  };

  // Phase 12.2: Send interactive WhatsApp Media message (Image, Document, Audio, Video)
  const handleSendMedia = async (params: {
    mediaType: SupportedMediaType;
    filename: string;
    mimeType: string;
    fileSize: number;
    base64Data: string;
    caption?: string;
  }) => {
    if (!selectedConversationId || !activeConversation) {
      return { success: false, error: "No active conversation selected." };
    }

    const tempId = `temp-${Date.now()}`;
    const nowIso = new Date().toISOString();
    let preview = "";
    if (params.mediaType === "image") {
      preview = params.caption ? `📷 ${params.caption}` : "📷 Photo";
    } else if (params.mediaType === "document") {
      preview = params.caption ? `📄 ${params.caption}` : `📄 ${params.filename}`;
    } else if (params.mediaType === "audio") {
      preview = "🎤 Audio message";
    } else if (params.mediaType === "video") {
      preview = params.caption ? `🎥 ${params.caption}` : "🎥 Video";
    }

    // Create optimistic media message
    const optimisticMsg: WhatsAppMessage = {
      id: tempId,
      business_id: business.id,
      connection_id: activeConversation.connection_id,
      conversation_id: activeConversation.id,
      contact_id: activeConversation.contact_id,
      direction: "outbound",
      message_type: params.mediaType,
      content: preview,
      meta_message_id: null,
      status: "pending",
      error_code: null,
      error_message: null,
      sent_at: null,
      delivered_at: null,
      read_at: null,
      media_type: params.mediaType,
      file_name: params.filename,
      mime_type: params.mimeType,
      file_size: params.fileSize,
      caption: params.caption || null,
      download_status: "not_applicable",
      raw_payload: { [params.mediaType]: { filename: params.filename, caption: params.caption } },
      created_at: nowIso,
      updated_at: nowIso,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? {
              ...c,
              last_message_preview: preview.slice(0, 200),
              last_message_at: nowIso,
            }
          : c
      )
    );

    try {
      const res = await sendWhatsAppMediaMessageAction({
        businessSlug: business.slug,
        conversationId: selectedConversationId,
        ...params,
      });

      if (res.success && res.message) {
        const persisted = res.message;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? persisted : m))
        );
        return { success: true };
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, status: "failed", error_message: res.error || "Media dispatch failed" }
              : m
          )
        );
        return {
          success: false,
          error: res.error,
          isWindowClosed: res.isWindowClosed,
        };
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, status: "failed", error_message: err.message || "Upload failed" }
            : m
        )
      );
      return { success: false, error: err.message || "Failed to upload or send media" };
    }
  };

  // Phase 12.2: Retrieve short-lived signed URL for downloading/viewing private media
  const handleGetDownloadUrl = async (messageId: string) => {
    return await getMediaDownloadUrlAction({
      businessSlug: business.slug,
      messageId,
    });
  };

  // Phase 12.2: Retry failed media or text message dispatch
  const handleRetryMessage = async (messageId: string) => {
    return await retryFailedMediaMessageAction({
      businessSlug: business.slug,
      messageId,
    });
  };

  const handleBackMobile = () => {
    setShowMobileChat(false);
    syncUrlParams(null, activeFolder, selectedConnectionId);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-[calc(100dvh-4rem)] bg-white relative">
      {/* Mobile Slide-Over Drawer for Folders & WhatsApp Lines (visible on < lg) */}
      {mobileFoldersOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Inbox Folders and WhatsApp Lines"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileFoldersOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer Panel */}
          <div className="relative flex w-72 max-w-[85vw] flex-1 flex-col bg-white shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <span className="font-bold text-sm text-slate-900">Folders &amp; Lines</span>
              <button
                type="button"
                onClick={() => setMobileFoldersOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close folder navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationNavPanel
                activeFolder={activeFolder}
                onSelectFolder={(f) => {
                  setActiveFolder(f);
                  setMobileFoldersOpen(false);
                  setShowMobileChat(false);
                  syncUrlParams(selectedConversationId, f, selectedConnectionId);
                }}
                counts={counts}
                connections={connections}
                selectedConnectionId={selectedConnectionId}
                onSelectConnection={(connId) => {
                  setSelectedConnectionId(connId);
                  setMobileFoldersOpen(false);
                  syncUrlParams(selectedConversationId, activeFolder, connId, selectedLabel);
                }}
                accentColor={business.accent_color}
                availableLabels={availableLabels}
                selectedLabel={selectedLabel}
                onSelectLabel={(lbl) => {
                  setSelectedLabel(lbl);
                  setMobileFoldersOpen(false);
                  setShowMobileChat(false);
                  syncUrlParams(selectedConversationId, activeFolder, selectedConnectionId, lbl);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Panel 1: Left Navigation Folders (Desktop & Large Screens) */}
      <div className="hidden lg:flex">
        <ConversationNavPanel
          activeFolder={activeFolder}
          onSelectFolder={(f) => {
            setActiveFolder(f);
            setShowMobileChat(false);
            syncUrlParams(selectedConversationId, f, selectedConnectionId, selectedLabel);
          }}
          counts={counts}
          connections={connections}
          selectedConnectionId={selectedConnectionId}
          onSelectConnection={(connId) => {
            setSelectedConnectionId(connId);
            syncUrlParams(selectedConversationId, activeFolder, connId, selectedLabel);
          }}
          accentColor={business.accent_color}
          availableLabels={availableLabels}
          selectedLabel={selectedLabel}
          onSelectLabel={(lbl) => {
            setSelectedLabel(lbl);
            setShowMobileChat(false);
            syncUrlParams(selectedConversationId, activeFolder, selectedConnectionId, lbl);
          }}
        />
      </div>

      {/* Panel 2: Middle Customer Conversation List */}
      <div
        className={`flex-shrink-0 ${
          showMobileChat ? "hidden md:flex" : "flex w-full md:w-auto"
        }`}
      >
        <ConversationListPanel
          conversations={filteredConversations}
          totalCount={conversations.length}
          selectedConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          folderTitle={folderTitle}
          businessSlug={business.slug}
          activeFolder={activeFolder}
          unreadCount={counts.unread}
          realtimeStatus={realtimeStatus}
          onToggleMobileFolders={() => setMobileFoldersOpen(true)}
          onOpenStartChat={() => setShowStartChatModal(true)}
          isViewer={isViewer}
          selectedLabel={selectedLabel}
          onClearLabelFilter={() => {
            setSelectedLabel("all");
            syncUrlParams(selectedConversationId, activeFolder, selectedConnectionId, "all");
          }}
        />
      </div>

      {/* Panel 3: Right Chat Window with Live Chronological Messages */}
      <div
        className={`flex-1 flex flex-col h-full ${
          !showMobileChat ? "hidden md:flex" : "flex w-full"
        }`}
      >
        <ChatWindowPanel
          conversation={activeConversation}
          businessSlug={business.slug}
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          hasMoreMessages={hasMoreMessages}
          isLoadingOlder={isLoadingOlder}
          onLoadOlderMessages={handleLoadOlderMessages}
          onBackMobile={handleBackMobile}
          onToggleRead={handleToggleRead}
          onUpdateStatus={handleUpdateStatus}
          onAssignAgent={handleAssignAgent}
          onSendMessage={handleSendMessage}
          onSendMedia={handleSendMedia}
          onGetDownloadUrl={handleGetDownloadUrl}
          onRetryMessage={handleRetryMessage}
          onSendTemplate={handleSendTemplate}
          approvedTemplates={approvedTemplates}
          teamMembers={teamMembers}
          currentMembership={currentMembership}
          availableLabels={availableLabels.map((l) => l.label)}
          onUpdateLabels={handleUpdateLabels}
          cannedResponses={cannedResponses}
          onCreateCannedResponse={handleCreateCannedResponse}
          onUpdateCannedResponse={handleUpdateCannedResponse}
          onDeleteCannedResponse={handleDeleteCannedResponse}
        />
      </div>

      {/* Start New Chat Modal */}
      <StartConversationModal
        isOpen={showStartChatModal}
        onClose={() => setShowStartChatModal(false)}
        business={business}
        connections={connections}
        approvedTemplates={approvedTemplates}
        defaultConnectionId={selectedConnectionId}
        onConversationStarted={handleConversationStarted}
      />
    </div>
  );
}
