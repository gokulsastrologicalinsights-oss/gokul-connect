import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  HelpCircle,
  Tag,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type {
  MetaSocialRule,
  MetaSocialRulePlatform,
  MetaSocialRuleTarget,
  MetaSocialMatchType,
  MetaSocialResponseAction,
} from "@/lib/meta-social/types";
import type { SaveSocialRuleInput } from "@/lib/meta-social/rules-store";

interface RuleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ruleInput: SaveSocialRuleInput) => Promise<boolean>;
  initialRule?: MetaSocialRule | null;
  businessSlug: string;
}

export function RuleFormModal({
  isOpen,
  onClose,
  onSave,
  initialRule,
  businessSlug,
}: RuleFormModalProps) {
  const isAstrology = businessSlug === "astrology";

  const [ruleName, setRuleName] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<MetaSocialRulePlatform>("both");
  const [targetType, setTargetType] = useState<MetaSocialRuleTarget>("comment");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [matchType, setMatchType] = useState<MetaSocialMatchType>("contains");
  const [responseAction, setResponseAction] =
    useState<MetaSocialResponseAction>("reply_comment_public");
  const [replyMode, setReplyMode] = useState<"bilingual" | "single">("bilingual");
  const [replyTa, setReplyTa] = useState("");
  const [replyEn, setReplyEn] = useState("");
  const [predefinedReply, setPredefinedReply] = useState("");
  const [predefinedDm, setPredefinedDm] = useState("");
  const [priority, setPriority] = useState<number>(100);
  const [isActive, setIsActive] = useState(false); // Default to disabled
  const [previewTab, setPreviewTab] = useState<"ta" | "en">("ta");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggestions for Tamil & English keywords based on workspace
  const keywordSuggestions = isAstrology
    ? [
        "ஜாதகம்",
        "ராசி பலன்",
        "திருமண பொருத்தம்",
        "ஜோதிடம்",
        "கட்டணம்",
        "விலை",
        "horoscope",
        "astrology",
        "marriage matching",
        "fee",
        "consultation",
      ]
    : [
        "திருமணம்",
        "வரன்",
        "பெண் தேவை",
        "மாப்பிள்ளை தேவை",
        "பதிவு",
        "கட்டணம்",
        "matrimony",
        "bride",
        "groom",
        "register",
        "plans",
      ];

  useEffect(() => {
    if (initialRule) {
      setRuleName(initialRule.rule_name);
      setDescription(initialRule.description || "");
      setPlatform(initialRule.platform);
      setTargetType(initialRule.target_type);
      setKeywords(initialRule.keywords || []);
      setMatchType(initialRule.match_type);
      setResponseAction(initialRule.response_action);
      setPriority(initialRule.priority ?? 100);
      setIsActive(initialRule.is_active);

      // Check if predefined_reply is bilingual JSON
      const rawReply = initialRule.predefined_reply || "";
      if (rawReply.trim().startsWith("{") && (rawReply.includes('"ta"') || rawReply.includes('"en"'))) {
        try {
          const parsed = JSON.parse(rawReply);
          setReplyMode("bilingual");
          setReplyTa(parsed.ta || "");
          setReplyEn(parsed.en || "");
          setPredefinedReply(parsed.ta || parsed.en || rawReply);
        } catch {
          setReplyMode("single");
          setPredefinedReply(rawReply);
        }
      } else {
        setReplyMode("single");
        setPredefinedReply(rawReply);
      }
      setPredefinedDm(initialRule.predefined_dm || "");
    } else {
      // Default new rule — strictly defaults to disabled
      setRuleName("");
      setDescription("");
      setPlatform("both");
      setTargetType("comment");
      setKeywords([]);
      setKeywordInput("");
      setMatchType("contains");
      setResponseAction("reply_comment_public");
      setReplyMode("bilingual");

      const defaultTa = isAstrology
        ? "வணக்கம்! உங்கள் ஜாதக பலன்கள் மற்றும் ஜோதிட ஆலோசனை விவரங்களை இன்பாக்ஸில் அனுப்பியுள்ளோம்."
        : "வணக்கம்! கோகுல் விவாஹம் வரன் பதிவு மற்றும் விவரங்களை எங்கள் குழு விரைவில் பகிர்ந்து கொள்ளும்.";

      const defaultEn = isAstrology
        ? "Namaste! Thank you for your comment. We have sent horoscope consultation details directly to your inbox."
        : "Namaste! Thank you for contacting Gokul Vivaham. Matrimony registration details have been sent to your inbox.";

      setReplyTa(defaultTa);
      setReplyEn(defaultEn);
      setPredefinedReply(defaultTa);
      setPredefinedDm("");
      setPriority(50);
      setIsActive(false); // ALL NEW RULES DEFAULT TO DISABLED
    }
    setError(null);
  }, [initialRule, isOpen, isAstrology]);

  if (!isOpen) return null;

  const handleAddKeyword = (kwToAdd?: string) => {
    const raw = kwToAdd || keywordInput;
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (!keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
    }
    if (!kwToAdd) {
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (indexToRemove: number) => {
    setKeywords(keywords.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ruleName.trim()) {
      setError("Rule name is required.");
      return;
    }

    if (matchType !== "any" && keywords.length === 0) {
      setError("Please add at least one keyword (Tamil or English) or change match type to 'Any'.");
      return;
    }

    let finalReply = predefinedReply.trim();
    if (replyMode === "bilingual") {
      if (!replyTa.trim() && !replyEn.trim()) {
        setError("Please enter a public reply in Tamil or English.");
        return;
      }
      finalReply = JSON.stringify({
        ta: replyTa.trim() || replyEn.trim(),
        en: replyEn.trim() || replyTa.trim(),
      });
    } else {
      if (!finalReply) {
        setError("Predefined reply message is required.");
        return;
      }
    }

    if (responseAction === "both_public_and_private") {
      if (!predefinedDm.trim()) {
        setError("Private DM reply is required when both Public and Private replies are selected.");
        return;
      }
      if (predefinedDm.trim() === finalReply) {
        setError(
          "Public reply and Private DM must be distinct. Reusing a public reply as a private reply directly is prohibited by Meta guidelines."
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const success = await onSave({
        id: initialRule?.id,
        ruleName: ruleName.trim(),
        description: description.trim() || undefined,
        platform,
        targetType,
        keywords,
        matchType,
        responseAction,
        predefinedReply: finalReply,
        predefinedReplyTa: replyMode === "bilingual" ? replyTa.trim() : undefined,
        predefinedReplyEn: replyMode === "bilingual" ? replyEn.trim() : undefined,
        predefinedDm: predefinedDm.trim() || undefined,
        priority: Number(priority) || 100,
        isActive,
      });

      if (success) {
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "Failed to save rule.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {initialRule ? "Edit Keyword Rule" : "Create Deterministic Keyword Rule"}
            </h3>
            <p className="text-xs text-slate-500">
              Configure Tamil & English keyword triggers for Facebook & Instagram automation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Rule Name & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Rule Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="e.g., Horoscope Consultation Enquiry"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Priority (1-100)</label>
              <input
                type="number"
                min="1"
                max="100"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Lower = Evaluated first</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Internal note on who this rule replies to"
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Platform & Target */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Platform Channel</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as MetaSocialRulePlatform)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="both">Both (Facebook & Instagram)</option>
                <option value="facebook">Facebook Only</option>
                <option value="instagram">Instagram Only</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Target Interaction</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as MetaSocialRuleTarget)}
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="both">Both (Comments & DMs)</option>
                <option value="comment">Comments Only (Posts & Reels)</option>
                <option value="message">Direct Messages (DMs)</option>
              </select>
            </div>
          </div>

          {/* Keywords & Matching */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Trigger Keywords (Unicode Tamil & English Supported)
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Match Type:</span>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as MetaSocialMatchType)}
                  className="text-xs px-2 py-1 rounded-md border border-slate-200 bg-slate-50"
                >
                  <option value="contains">Contains Keyword</option>
                  <option value="exact">Exact Match</option>
                  <option value="starts_with">Starts With</option>
                  <option value="any">Any (Wildcard)</option>
                </select>
              </div>
            </div>

            {/* Keyword tag input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddKeyword();
                    }
                  }}
                  placeholder="Type keyword in Tamil or English and press Enter..."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddKeyword()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {/* Keyword tags */}
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200">
                {keywords.map((kw, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium"
                  >
                    <Tag className="w-3 h-3 text-indigo-500" />
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(idx)}
                      className="hover:text-red-600 transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Preset Suggestions */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Quick suggestions for {isAstrology ? "Astrology" : "Vivaham"}:
              </span>
              <div className="flex flex-wrap gap-1">
                {keywordSuggestions.map((kw) => {
                  const isSelected = keywords.includes(kw);
                  return (
                    <button
                      key={kw}
                      type="button"
                      disabled={isSelected}
                      onClick={() => handleAddKeyword(kw)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors ${
                        isSelected
                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-default"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                      }`}
                    >
                      + {kw}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Response Action */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Response Action</label>
            <select
              value={responseAction}
              onChange={(e) => setResponseAction(e.target.value as MetaSocialResponseAction)}
              className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="both_public_and_private">
                Both: Public Comment Reply + Private DM (Recommended)
              </option>
              <option value="reply_comment_private_dm">
                Private DM Only (Meta Private Replies)
              </option>
              <option value="reply_comment_public">
                Public Comment Reply Only
              </option>
              <option value="reply_dm">Direct Message Reply (for Inbound DMs)</option>
            </select>
          </div>

          {/* Public Reply Configuration (Tamil & English) */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>Public Comment Reply Configuration</span>
                <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setReplyMode("bilingual")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    replyMode === "bilingual"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  தமிழ் + English
                </button>
                <button
                  type="button"
                  onClick={() => setReplyMode("single")}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    replyMode === "single"
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Single Template
                </button>
              </div>
            </div>

            {replyMode === "bilingual" ? (
              <div className="space-y-3">
                {/* Tamil Reply */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <span>தமிழ் பதில் (Tamil Public Reply)</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{replyTa.length} chars</span>
                  </div>
                  <textarea
                    rows={2}
                    value={replyTa}
                    onChange={(e) => setReplyTa(e.target.value)}
                    placeholder="வணக்கம்! உங்கள் பதிவிற்கான விவரங்கள்..."
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* English Reply */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <span>English Public Reply</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{replyEn.length} chars</span>
                  </div>
                  <textarea
                    rows={2}
                    value={replyEn}
                    onChange={(e) => setReplyEn(e.target.value)}
                    placeholder="Namaste! Thank you for reaching out..."
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Reply Message</span>
                  <span className="text-[10px] text-slate-400">{predefinedReply.length} chars</span>
                </div>
                <textarea
                  rows={2}
                  value={predefinedReply}
                  onChange={(e) => setPredefinedReply(e.target.value)}
                  placeholder="e.g., Thank you for reaching out! We sent consultation details to your inbox."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            )}

            {/* Live Preview of Expected Reply */}
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Preview Expected Public Reply
                </span>
                {replyMode === "bilingual" && (
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPreviewTab("ta")}
                      className={`px-2 py-0.5 rounded-md font-medium ${
                        previewTab === "ta" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      Tamil Match
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab("en")}
                      className={`px-2 py-0.5 rounded-md font-medium ${
                        previewTab === "en" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      English Match
                    </button>
                  </div>
                )}
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 shadow-2xs">
                <div className="text-[10px] font-bold text-indigo-600 mb-1">
                  {platform === "facebook" ? "Facebook Page Comment" : platform === "instagram" ? "Instagram Reel Comment" : "Facebook / Instagram Public Reply"}:
                </div>
                <p className="italic">
                  {replyMode === "bilingual"
                    ? previewTab === "ta"
                      ? replyTa || "—"
                      : replyEn || "—"
                    : predefinedReply || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Private DM Text (Optional / Legacy) */}
          {responseAction === "both_public_and_private" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Private DM Reply (Meta Private Replies to User Inbox)
                  <span className="text-red-500"> *</span>
                </label>
                <span className="text-[11px] text-slate-400">{predefinedDm.length} chars</span>
              </div>
              <textarea
                rows={3}
                value={predefinedDm}
                onChange={(e) => setPredefinedDm(e.target.value)}
                placeholder="Detailed consultation / registration message with pricing and contact steps..."
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-md border border-amber-200">
                Notice: Meta guidelines require the private DM to contain distinct value and not just duplicate the public acknowledgment.
              </p>
            </div>
          )}

          {/* Active status */}
          <div className="flex items-center gap-2 pt-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <input
              type="checkbox"
              id="isActiveToggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <div>
              <label htmlFor="isActiveToggle" className="text-xs font-semibold text-slate-800 cursor-pointer block">
                Enable Rule Automation
              </label>
              <span className="text-[11px] text-slate-500 block">
                All new rules default to disabled. Enable only when verified.
              </span>
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : initialRule ? "Update Rule" : "Create Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
