import { SocialComment } from "./types";

export interface YouTubeThreadItem {
  id: string;
  snippet: {
    channelId: string;
    videoId?: string;
    topLevelComment: {
      id: string;
      snippet: {
        authorDisplayName: string;
        authorProfileImageUrl?: string;
        authorChannelUrl?: string;
        textDisplay: string;
        textOriginal: string;
        publishedAt: string;
        updatedAt: string;
      };
    };
    totalReplyCount: number;
    isPublic: boolean;
  };
  replies?: {
    comments: Array<{
      id: string;
      snippet: {
        authorDisplayName: string;
        textDisplay: string;
        textOriginal: string;
        publishedAt: string;
      };
    }>;
  };
}

/**
 * Fetch video comments for a channel via commentThreads.list
 */
export async function fetchYouTubeVideoCommentThreads(params: {
  channelId: string;
  accessToken: string;
  limit?: number;
}): Promise<YouTubeThreadItem[]> {
  const { channelId, accessToken, limit = 25 } = params;

  if (accessToken.startsWith("mock_yt_")) {
    return [];
  }

  const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${encodeURIComponent(
    channelId
  )}&maxResults=${limit}&order=time`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("[YouTube API] Failed to fetch comments:", err?.error?.message || res.statusText);
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (err: any) {
    console.warn("[YouTube API] Network exception fetching comments:", err.message);
    return [];
  }
}

/**
 * Publish a public reply to a YouTube comment via comments.insert
 */
export async function replyToYouTubeComment(params: {
  parentId: string;
  text: string;
  accessToken: string;
}): Promise<{ id: string; publishedAt: string }> {
  const { parentId, text, accessToken } = params;

  if (!parentId?.trim()) throw new Error("Parent comment ID is required for YouTube reply.");
  if (!text?.trim()) throw new Error("Reply text is required.");
  if (!accessToken?.trim()) throw new Error("Access token is required.");

  if (accessToken.startsWith("mock_yt_")) {
    return {
      id: `yt_reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      publishedAt: new Date().toISOString(),
    };
  }

  const url = "https://www.googleapis.com/youtube/v3/comments?part=snippet";
  const payload = {
    snippet: {
      parentId: parentId.trim(),
      textOriginal: text.trim(),
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.error?.message || res.statusText;
    if (res.status === 403 && (message.includes("disabled") || err.error?.errors?.[0]?.reason === "commentsDisabled")) {
      throw new Error("Comments are disabled on this YouTube video. Public reply cannot be posted.");
    }
    if (res.status === 403 && (message.includes("quota") || err.error?.errors?.[0]?.reason === "quotaExceeded")) {
      throw new Error("YouTube API daily quota exceeded. Please retry tomorrow or upgrade quota.");
    }
    throw new Error(`YouTube API reply failed (${res.status}): ${message}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    publishedAt: data.snippet?.publishedAt || new Date().toISOString(),
  };
}
