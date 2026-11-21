import type { NormalizedMetaSocialEvent } from "./types";

/**
 * Parses raw Meta Webhook JSON payloads from Facebook (`object: "page"`)
 * and Instagram (`object: "instagram"`) into normalized events.
 */
export function parseMetaSocialWebhook(payload: any): NormalizedMetaSocialEvent[] {
  const events: NormalizedMetaSocialEvent[] = [];

  if (!payload || !Array.isArray(payload.entry)) {
    return events;
  }

  const isFacebook = payload.object === "page";
  const isInstagram = payload.object === "instagram";

  if (!isFacebook && !isInstagram) {
    return events;
  }

  const platform = isFacebook ? "facebook" : "instagram";

  for (const entry of payload.entry) {
    const accountId = String(entry.id || "").trim();
    if (!accountId) continue;

    // 1. Check for Direct Messages (`messaging` array)
    if (Array.isArray(entry.messaging)) {
      for (const item of entry.messaging) {
        // Skip message echoes (messages sent by the page itself)
        if (item.message?.is_echo) {
          continue;
        }

        const mid = item.message?.mid;
        const text = item.message?.text;
        const senderId = item.sender?.id;

        if (mid && text && senderId) {
          events.push({
            platform,
            accountId,
            eventType: "message",
            metaEventId: String(mid),
            senderId: String(senderId),
            content: String(text).trim(),
            timestamp: item.timestamp || Date.now(),
          });
        }
      }
    }

    // 2. Check for Comments (`changes` array)
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        const field = change.field;
        const value = change.value;

        if (!value) continue;

        // Facebook comments on Page Posts (field: "feed")
        if (field === "feed") {
          // Only process new comments
          if (value.item === "comment" && value.verb === "add" && value.comment_id) {
            // Avoid replying to the page's own comments
            if (value.from?.id === accountId) {
              continue;
            }

            events.push({
              platform: "facebook",
              accountId,
              eventType: "comment",
              metaEventId: String(value.comment_id),
              senderId: String(value.from?.id || value.comment_id),
              senderName: value.from?.name || undefined,
              postId: value.post_id ? String(value.post_id) : undefined,
              commentId: String(value.comment_id),
              parentCommentId: value.parent_id ? String(value.parent_id) : undefined,
              content: String(value.message || "").trim(),
              timestamp: (value.created_time ? value.created_time * 1000 : null) || Date.now(),
            });
          }
        }

        // Instagram comments on Media / Reels (field: "comments")
        if (field === "comments") {
          const commentId = value.id;
          const text = value.text;

          // Avoid replying to the account's own comments
          if (value.from?.id === accountId) {
            continue;
          }

          if (commentId && text) {
            events.push({
              platform: "instagram",
              accountId,
              eventType: "comment",
              metaEventId: String(commentId),
              senderId: String(value.from?.id || value.from?.username || commentId),
              senderName: value.from?.username || undefined,
              postId: value.media?.id ? String(value.media.id) : undefined,
              commentId: String(commentId),
              content: String(text).trim(),
              timestamp: Date.now(),
            });
          }
        }
      }
    }
  }

  return events;
}
