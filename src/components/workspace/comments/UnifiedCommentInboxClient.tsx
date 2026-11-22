"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  User,
  Share2,
  X,
  Languages,
  Check,
  AlertTriangle,
  Radio,
} from "lucide-react";
import {
  SocialComment,
  SocialCommentFilterParams,
  SocialCommentsStats,
  SocialReplyTemplate,
  SocialCommentPlatform,
  YouTubeChannelConnection,
} from "@/lib/social-comments/types";
import { SafeMetaSocialConnection } from "@/lib/meta-social/connections-store";
import {
  replyToSocialCommentAction,
  executeAutoRepliesAction,
  getSocialCommentsAction,
  initiateYouTubeOAuthAction,
  disconnectYouTubeAction,
} from "@/app/actions/social-comments";

interface UnifiedCommentInboxClientProps {
  businessSlug: string;
  businessName: string;
  userRole: string;
  initialComments: SocialComment[];
  initialStats: SocialCommentsStats;
  templates: SocialReplyTemplate[];
  youtubeConnections: YouTubeChannelConnection[];
  metaConnections: SafeMetaSocialConnection[];
}

export function UnifiedCommentInboxClient({
  businessSlug,
  businessName,
  userRole,
  initialComments,
  initialStats,
  templates,
  youtubeConnections,
  metaConnections,
}: UnifiedCommentInboxClientProps) {
  // Filters & Search
  const [platformFilter, setPlatformFilter] = useState<SocialCommentPlatform | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "replied" | "failed" | "keyword_matched">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Data State
  const [comments, setComments] = useState<SocialComment[]>(initialComments);
  const [stats, setStats] = useState<SocialCommentsStats>(initialStats);
  const [ytConnections, setYtConnections] = useState<YouTubeChannelConnection[]>(youtubeConnections);

  // Modal State for Manual Reply Composer
  const [activeReplyComment, setActiveReplyComment] = useState<SocialComment | null>(null);
  const [replyText, setReplyText] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<"ta" | "en">("ta");
  const [isConfirmingPublish, setIsConfirmingPublish] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccessMessage, setReplySuccessMessage] = useState<string | null>(null);

  // YouTube Channel Modal
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);

  // Transitions
  const [isPending, startTransition] = useTransition();
  const [isReplying, setIsReplying] = useState(false);
  const [isAutoReplying, setIsAutoReplying] = useState(false);

  // Refresh data
  const handleRefresh = () => {
    startTransition(async () => {
      const res = await getSocialCommentsAction(businessSlug, {
        platform: platformFilter,
        replyStatus: statusFilter,
        searchQuery,
      });
      if (res.success && res.comments && res.stats) {
        setComments(res.comments);
        setStats(res.stats);
      }
    });
  };

  // Filtered comments client-side for ultra-responsive search and toggling
  const displayedComments = useMemo(() => {
    return comments.filter((c) => {
      // Platform filter
      if (platformFilter !== "all" && c.platform !== platformFilter) return false;

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "keyword_matched" && !c.matchedKeyword) return false;
        if (statusFilter !== "keyword_matched" && c.replyStatus !== statusFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const textMatch = c.text.toLowerCase().includes(q);
        const nameMatch = c.commenterName.toLowerCase().includes(q);
        const postMatch = c.postTitle.toLowerCase().includes(q);
        const replyMatch = c.replyText?.toLowerCase().includes(q) || false;
        if (!textMatch && !nameMatch && !postMatch && !replyMatch) return false;
      }

      return true;
    });
  }, [comments, platformFilter, statusFilter, searchQuery]);

  // Open Reply Composer Modal
  const handleOpenReplyModal = (comment: SocialComment) => {
    setActiveReplyComment(comment);
    setReplyText("");
    setIsConfirmingPublish(false);
    setReplyError(null);
    setReplySuccessMessage(null);
  };

  // Close Reply Composer Modal
  const handleCloseReplyModal = () => {
    setActiveReplyComment(null);
    setReplyText("");
    setIsConfirmingPublish(false);
    setReplyError(null);
  };

  // Insert Template into Reply Composer
  const handleInsertTemplate = (templateText: string) => {
    setReplyText(templateText);
    setReplyError(null);
  };

  // Submit Manual Reply
  const handleSubmitReply = async () => {
    if (!activeReplyComment) return;
    if (!replyText.trim()) {
      setReplyError("Please enter a reply message before publishing.");
      return;
    }

    setIsReplying(true);
    setReplyError(null);

    try {
      const res = await replyToSocialCommentAction(businessSlug, {
        commentId: activeReplyComment.id,
        replyText: replyText.trim(),
      });

      if (!res.success) {
        setReplyError(res.error || "Failed to publish reply.");
        setIsReplying(false);
        setIsConfirmingPublish(false);
        return;
      }

      // Update local state immediately
      setComments((prev) =>
        prev.map((c) =>
          c.id === activeReplyComment.id
            ? {
                ...c,
                replyStatus: "replied",
                replyText: replyText.trim(),
                replyTimestamp: new Date().toISOString(),
                replyId: res.replyId,
              }
            : c
        )
      );

      // Update stats
      setStats((prev) => ({
        ...prev,
        pendingReplies: Math.max(0, prev.pendingReplies - 1),
        repliedComments: prev.repliedComments + 1,
      }));

      setReplySuccessMessage("Public reply published successfully!");
      setTimeout(() => {
        handleCloseReplyModal();
        setIsReplying(false);
      }, 1200);
    } catch (err: any) {
      setReplyError(err.message || "An unexpected error occurred while replying.");
      setIsReplying(false);
      setIsConfirmingPublish(false);
    }
  };

  // Execute Auto-Replies
  const handleRunAutoReplies = async () => {
    const pendingMatchedCount = comments.filter(
      (c) => c.replyStatus === "pending" && Boolean(c.matchedKeyword)
    ).length;

    if (pendingMatchedCount === 0) {
      alert("No pending comments with keyword triggers found to auto-reply.");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to execute automatic public replies for ${pendingMatchedCount} pending comment(s)?`
      )
    ) {
      return;
    }

    setIsAutoReplying(true);
    try {
      const res = await executeAutoRepliesAction(businessSlug);
      if (res.success) {
        handleRefresh();
      } else {
        alert(res.error || "Failed to execute auto-replies.");
      }
    } finally {
      setIsAutoReplying(false);
    }
  };

  // Handle YouTube Connect
  const handleConnectYouTube = async () => {
    try {
      const res = await initiateYouTubeOAuthAction(businessSlug);
      if (res.success && res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
      } else {
        alert(res.error || "Failed to initiate Google OAuth.");
      }
    } catch (err: any) {
      alert(err.message || "Error connecting YouTube.");
    }
  };

  // Handle YouTube Disconnect
  const handleDisconnectYouTube = async (connectionId: string) => {
    if (!confirm("Are you sure you want to disconnect this YouTube channel?")) return;
    try {
      const res = await disconnectYouTubeAction(businessSlug, connectionId);
      if (res.success) {
        setYtConnections((prev) => prev.filter((c) => c.id !== connectionId));
        handleRefresh();
      } else {
        alert(res.error || "Failed to disconnect channel.");
      }
    } catch (err: any) {
      alert(err.message || "Error disconnecting YouTube.");
    }
  };

  // Filter templates by selected language
  const availableTemplates = templates.filter((t) => t.language === selectedLanguage);

  // Platform badges helper
  const renderPlatformBadge = (platform: SocialCommentPlatform) => {
    switch (platform) {
      case "facebook":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            Facebook
          </span>
        );
      case "instagram":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-pink-50 text-pink-700 border border-pink-200">
            <span className="w-2 h-2 rounded-full bg-pink-600"></span>
            Instagram
          </span>
        );
      case "youtube":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-600"></span>
            YouTube
          </span>
        );
    }
  };

  // Status badge helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" />
            Pending Reply
          </span>
        );
      case "replied":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            Replied
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3" />
            Delivery Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ---------------------------------------------------------------------- */}
      {/* HEADER SECTION                                                         */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Social Comment Management</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Phase 13D
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Unified comment inbox and automated replies for <span className="font-semibold text-slate-800">{businessName}</span> across Facebook, Instagram, and YouTube.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* YouTube Connection Status & Manage Button */}
          <button
            onClick={() => setIsYouTubeModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <span className={`w-2 h-2 rounded-full ${ytConnections.length > 0 ? "bg-red-500" : "bg-slate-300"}`}></span>
            {ytConnections.length > 0 ? "YouTube Channel Connected" : "Connect YouTube"}
          </button>

          {/* Bulk Auto-Replies Execution Button */}
          <button
            onClick={handleRunAutoReplies}
            disabled={isAutoReplying}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isAutoReplying ? "Processing Auto-Replies..." : "Run Auto-Replies"}
          </button>

          {/* Sync / Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 transition-colors"
            title="Refresh comment list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* STATS OVERVIEW CARDS                                                   */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Total Comments</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalComments}</p>
          <div className="mt-2 text-xs text-slate-500 flex gap-2">
            <span>FB: {stats.facebookCount}</span>
            <span>•</span>
            <span>IG: {stats.instagramCount}</span>
            <span>•</span>
            <span>YT: {stats.youtubeCount}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/30 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-700">Pending Replies</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{stats.pendingReplies}</p>
          <p className="text-xs text-amber-600 mt-2">Awaiting operator or auto-reply</p>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm">
          <p className="text-xs font-medium text-emerald-700">Replied Comments</p>
          <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.repliedComments}</p>
          <p className="text-xs text-emerald-600 mt-2">Public replies published</p>
        </div>

        <div className="bg-white rounded-xl border border-indigo-200 bg-indigo-50/30 p-4 shadow-sm">
          <p className="text-xs font-medium text-indigo-700">Keyword Triggers</p>
          <p className="text-2xl font-bold text-indigo-900 mt-1">{stats.keywordMatched}</p>
          <p className="text-xs text-indigo-600 mt-2">Tamil & English matches</p>
        </div>

        <div className="bg-white rounded-xl border border-red-200 bg-red-50/30 p-4 shadow-sm">
          <p className="text-xs font-medium text-red-700">Failed Deliveries</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{stats.failedReplies}</p>
          <p className="text-xs text-red-600 mt-2">Rate limit or network errors</p>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* FILTER & SEARCH TOOLBAR                                                */}
      {/* ---------------------------------------------------------------------- */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Platform Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setPlatformFilter("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                platformFilter === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Platforms ({stats.totalComments})
            </button>
            <button
              onClick={() => setPlatformFilter("facebook")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                platformFilter === "facebook"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Facebook ({stats.facebookCount})
            </button>
            <button
              onClick={() => setPlatformFilter("instagram")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                platformFilter === "instagram"
                  ? "bg-white text-pink-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Instagram ({stats.instagramCount})
            </button>
            <button
              onClick={() => setPlatformFilter("youtube")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                platformFilter === "youtube"
                  ? "bg-white text-red-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              YouTube ({stats.youtubeCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search comments, commenters, or posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500 font-medium">Status Filter:</span>
          {(
            [
              { id: "all", label: "All Comments" },
              { id: "pending", label: "Pending Replies" },
              { id: "replied", label: "Replied" },
              { id: "keyword_matched", label: "Keyword Matched" },
              { id: "failed", label: "Failed" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === s.id
                  ? "bg-indigo-100 text-indigo-800 font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* COMMENTS LIST FEED                                                     */}
      {/* ---------------------------------------------------------------------- */}
      <div className="space-y-4">
        {displayedComments.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No comments found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No social comments match your current platform, status, or search filters.
            </p>
            {(platformFilter !== "all" || statusFilter !== "all" || searchQuery) && (
              <button
                onClick={() => {
                  setPlatformFilter("all");
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="mt-4 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          displayedComments.map((comment) => (
            <div
              key={comment.id}
              className={`bg-white rounded-xl border transition-all p-5 shadow-sm space-y-4 ${
                comment.replyStatus === "pending"
                  ? "border-amber-200 hover:border-amber-300"
                  : comment.replyStatus === "failed"
                  ? "border-red-200 hover:border-red-300"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Comment Header: Platform, Connected Account, Post Reference, Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  {renderPlatformBadge(comment.platform)}
                  <span className="font-semibold text-slate-700">{comment.accountName}</span>
                </div>

                <div className="flex items-center gap-2">
                  {comment.matchedKeyword && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      Trigger: <code className="font-mono font-bold">{comment.matchedKeyword}</code>
                    </span>
                  )}
                  {renderStatusBadge(comment.replyStatus)}
                </div>
              </div>

              {/* Post Context */}
              <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-600 border border-slate-100 flex items-center justify-between gap-2">
                <div className="truncate">
                  <span className="font-medium text-slate-700">Target Post/Video: </span>
                  <span className="text-slate-800 font-semibold">{comment.postTitle}</span>
                </div>
                {comment.postUrl && (
                  <a
                    href={comment.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 shrink-0 inline-flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Comment Body & Commenter Info */}
              <div className="flex items-start gap-3.5">
                {comment.commenterAvatar ? (
                  <img
                    src={comment.commenterAvatar}
                    alt={comment.commenterName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {comment.commenterName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{comment.commenterName}</span>
                    {comment.commenterUsername && (
                      <span className="text-xs text-slate-400">@{comment.commenterUsername}</span>
                    )}
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      {new Date(comment.timestamp).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  {/* Comment Text with Tamil Unicode rendering */}
                  <p className="text-sm text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                    {comment.text}
                  </p>

                  {/* Failure Alert Banner */}
                  {comment.replyStatus === "failed" && comment.failureReason && (
                    <div className="mt-2 text-xs bg-red-50 text-red-700 p-2.5 rounded-lg border border-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{comment.failureReason}</span>
                    </div>
                  )}

                  {/* Published Reply Snippet */}
                  {comment.replyStatus === "replied" && comment.replyText && (
                    <div className="mt-3 bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between text-emerald-800 font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Published Public Reply
                        </span>
                        {comment.replyTimestamp && (
                          <span className="text-emerald-600 font-normal">
                            {new Date(comment.replyTimestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 whitespace-pre-wrap">{comment.replyText}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  ID: <code className="font-mono text-slate-500">{comment.commentId}</code>
                </span>

                <button
                  onClick={() => handleOpenReplyModal(comment)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors ${
                    comment.replyStatus === "replied"
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  {comment.replyStatus === "replied" ? "Post Another Reply" : "Reply to Comment"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* MANUAL REPLY COMPOSER MODAL                                            */}
      {/* ---------------------------------------------------------------------- */}
      {activeReplyComment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Reply to {activeReplyComment.commenterName}
                </h3>
              </div>
              <button
                onClick={handleCloseReplyModal}
                disabled={isReplying}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Original Comment Quote */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-semibold text-slate-700">Original Comment:</span>
                  <div className="flex items-center gap-2">
                    {renderPlatformBadge(activeReplyComment.platform)}
                    <span>
                      {new Date(activeReplyComment.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-800 font-medium italic">
                  "{activeReplyComment.text}"
                </p>
              </div>

              {/* Quick Template Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Quick Reply Templates (Click to insert):
                  </span>

                  {/* Language Toggle */}
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedLanguage("ta")}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        selectedLanguage === "ta"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      தமிழ் (Tamil)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLanguage("en")}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        selectedLanguage === "en"
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Templates Chips */}
                <div className="grid grid-cols-1 gap-2">
                  {availableTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleInsertTemplate(tpl.text)}
                      className="text-left p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors text-xs space-y-0.5"
                    >
                      <div className="font-semibold text-indigo-900">{tpl.title}</div>
                      <div className="text-slate-600 line-clamp-1">{tpl.text}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea Composer */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Custom Public Reply Message (Tamil & English supported):
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    setReplyError(null);
                  }}
                  disabled={isReplying || isConfirmingPublish}
                  placeholder="Type your reply here or select a template above..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
                />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Formatting: Public Comment Reply</span>
                  <span>{replyText.length} characters</span>
                </div>
              </div>

              {/* Error Alert */}
              {replyError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex items-center gap-2 border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{replyError}</span>
                </div>
              )}

              {/* Success Notification */}
              {replySuccessMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-semibold">{replySuccessMessage}</span>
                </div>
              )}

              {/* Confirmation Step */}
              {isConfirmingPublish && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-3">
                  <div className="flex items-start gap-2.5 text-amber-900 font-semibold">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold">Confirm Public Comment Reply</p>
                      <p className="font-normal text-amber-800 mt-0.5">
                        This comment will be published publicly on{" "}
                        <span className="capitalize font-bold">{activeReplyComment.platform}</span> visible to all users. Are you sure you wish to publish?
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingPublish(false)}
                      disabled={isReplying}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors"
                    >
                      Back to Edit
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitReply}
                      disabled={isReplying}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isReplying ? "Publishing..." : "Yes, Publish Reply Now"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {!isConfirmingPublish && (
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseReplyModal}
                  disabled={isReplying}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!replyText.trim()) {
                      setReplyError("Please enter or select a reply before proceeding.");
                      return;
                    }
                    setIsConfirmingPublish(true);
                  }}
                  disabled={!replyText.trim() || isReplying}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  Send Reply...
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* YOUTUBE CONNECTION MODAL                                               */}
      {/* ---------------------------------------------------------------------- */}
      {isYouTubeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-red-600 text-white flex items-center justify-center font-bold text-xs">
                  YT
                </span>
                <h3 className="text-base font-bold text-slate-900">YouTube Channel Integration</h3>
              </div>
              <button
                onClick={() => setIsYouTubeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Connect your official YouTube channel via Google OAuth to ingest video comments, display them in the unified inbox, and publish public replies.
              </p>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Security & Isolation Safeguards:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>Google OAuth tokens are stored in a dedicated encrypted AES-256-GCM vault.</li>
                  <li>Zero tokens are ever exposed to the client browser.</li>
                  <li>Completely isolated from Meta Graph API credentials.</li>
                </ul>
              </div>

              {/* Connected Channels List */}
              {ytConnections.length > 0 ? (
                <div className="space-y-3">
                  <span className="font-semibold text-slate-800">Connected Channel:</span>
                  {ytConnections.map((conn) => (
                    <div
                      key={conn.id}
                      className="p-4 rounded-xl border border-red-200 bg-red-50/40 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {conn.thumbnailUrl ? (
                          <img
                            src={conn.thumbnailUrl}
                            alt={conn.channelTitle}
                            className="w-10 h-10 rounded-full object-cover border border-red-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-sm">
                            YT
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900">{conn.channelTitle}</p>
                          <p className="text-slate-500 font-mono text-[10px]">{conn.channelId}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDisconnectYouTube(conn.id)}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-white text-red-600 border border-red-300 hover:bg-red-50 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 border border-dashed border-slate-300 rounded-xl text-center space-y-3">
                  <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto font-bold text-sm">
                    YT
                  </div>
                  <p className="text-slate-600">No YouTube channel currently connected for this business.</p>
                  <button
                    onClick={handleConnectYouTube}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Authorize Google & YouTube
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsYouTubeModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
