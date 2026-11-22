export type SocialCommentPlatform = "facebook" | "instagram" | "youtube";

export type SocialCommentReplyStatus = "pending" | "replied" | "failed";

export interface SocialComment {
  id: string;
  businessId: string;
  platform: SocialCommentPlatform;
  accountId: string;
  accountName: string;
  postId: string;
  postTitle: string;
  postUrl?: string;
  commentId: string;
  parentId?: string;
  commenterId: string;
  commenterName: string;
  commenterUsername?: string;
  commenterAvatar?: string;
  text: string;
  timestamp: string;
  replyStatus: SocialCommentReplyStatus;
  replyText?: string;
  replyTimestamp?: string;
  replyId?: string;
  matchedKeyword?: string;
  matchedRuleName?: string;
  canReply: boolean;
  failureReason?: string;
}

export interface SocialReplyTemplate {
  id: string;
  businessSlug: "astrology" | "vivaham" | "all";
  language: "ta" | "en";
  title: string;
  text: string;
  category: "general" | "pricing" | "consultation" | "registration";
}

export interface SocialCommentFilterParams {
  platform?: SocialCommentPlatform | "all";
  replyStatus?: SocialCommentReplyStatus | "keyword_matched" | "all";
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface SocialCommentsStats {
  totalComments: number;
  pendingReplies: number;
  repliedComments: number;
  failedReplies: number;
  keywordMatched: number;
  facebookCount: number;
  instagramCount: number;
  youtubeCount: number;
}

export interface ManualReplyResult {
  success: boolean;
  commentId: string;
  replyId?: string;
  replyText: string;
  replyTimestamp: string;
  error?: string;
}

export interface YouTubeChannelConnection {
  id: string;
  businessId: string;
  channelId: string;
  channelTitle: string;
  customUrl?: string;
  thumbnailUrl?: string;
  connectionStatus: "connected" | "disconnected" | "expired" | "error";
  isEnabled: boolean;
  hasCredential: boolean;
  credentialMaskedHint: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}
