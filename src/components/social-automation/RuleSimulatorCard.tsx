import React, { useState } from "react";
import {
  Sparkles,
  Bot,
  Play,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Lock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { MetaSocialRule } from "@/lib/meta-social/types";
import { simulateSocialRuleAction } from "@/app/actions/social-automations";

interface RuleSimulatorCardProps {
  businessSlug: string;
}

export function RuleSimulatorCard({ businessSlug }: RuleSimulatorCardProps) {
  const isAstrology = businessSlug === "astrology";

  const [testText, setTestText] = useState(
    isAstrology
      ? "வணக்கம் ஐயா, எனக்கு திருமண பொருத்தம் மற்றும் ஜாதக கட்டணம் விவரம் வேண்டும்."
      : "வணக்கம், வரன் பதிவு செய்ய என்ன விவரங்கள் தேவை? Registration fee details please."
  );
  const [platform, setPlatform] = useState<"facebook" | "instagram">("instagram");
  const [eventType, setEventType] = useState<"comment" | "message">("comment");
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<{
    matched: boolean;
    rule?: MetaSocialRule;
    publicReply?: string;
    privateDm?: string;
  } | null>(null);

  const samplePrompts = isAstrology
    ? [
        "ஜாதகம் பார்க்க கட்டணம் எவ்வளவு?",
        "Horoscope consultation price details please",
        "திருமண பொருத்தம் பார்க்க முடியுமா?",
        "Office address and phone number please",
      ]
    : [
        "மாப்பிள்ளை வரன் பதிவு செய்ய கட்டணம் எவ்வளவு?",
        "Looking for verified bride profiles in Chennai",
        "திருமண பதிவு விவரங்கள் அனுப்பவும்",
        "What are your membership packages?",
      ];

  const handleSimulate = async () => {
    if (!testText.trim()) return;
    setIsSimulating(true);
    setResult(null);

    try {
      const res = await simulateSocialRuleAction(businessSlug, {
        text: testText.trim(),
        platform,
        eventType,
      });

      if (res.success) {
        setResult({
          matched: res.matched,
          rule: res.rule,
          publicReply: res.publicReplyPreview,
          privateDm: res.privateDmPreview,
        });
      }
    } catch {
      setResult({ matched: false });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Deterministic Rule Simulator (Safe Dry-Run Mode)
            </h3>
            <p className="text-xs text-slate-500">
              Test Tamil & English keyword matching live without publishing to Meta or sending messages.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
          <ShieldCheck className="w-3.5 h-3.5" />
          Offline Testing Only
        </span>
      </div>

      {/* Simulator Inputs */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Channel</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as any)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="instagram">Instagram (Reels / Post / DM)</option>
              <option value="facebook">Facebook (Page Post / Messenger)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Interaction Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="comment">Public Post / Reel Comment</option>
              <option value="message">Direct Message (DM)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            Simulated Inbound Text (Tamil or English)
          </label>
          <textarea
            rows={2}
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            placeholder="Type any enquiry in Tamil or English..."
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
          />
        </div>

        {/* Quick sample prompt chips */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] text-slate-400 font-medium">Try sample:</span>
          {samplePrompts.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setTestText(p)}
              className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              &quot;{p.slice(0, 32)}...&quot;
            </button>
          ))}
        </div>

        {/* Run Button */}
        <div>
          <button
            type="button"
            onClick={handleSimulate}
            disabled={isSimulating || !testText.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{isSimulating ? "Evaluating Rules..." : "Test Keyword Match"}</span>
          </button>
        </div>
      </div>

      {/* Simulation Result */}
      {result && (
        <div className="pt-3 border-t border-slate-100">
          {result.matched && result.rule ? (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-emerald-950 text-xs">
                      Rule Match Found: {result.rule.rule_name}
                    </h4>
                    <span className="text-[11px] text-emerald-700">
                      Priority #{result.rule.priority} | Match Type: {result.rule.match_type}
                    </span>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-medium">
                  Match Success
                </span>
              </div>

              {/* Reply Previews */}
              <div className="space-y-2 text-xs">
                {result.publicReply && (
                  <div className="p-2.5 rounded-lg bg-white border border-emerald-200 space-y-0.5">
                    <span className="font-semibold text-slate-600 flex items-center gap-1 text-[11px]">
                      <MessageSquare className="w-3 h-3 text-slate-500" />
                      Public Comment Response:
                    </span>
                    <p className="text-slate-900">{result.publicReply}</p>
                  </div>
                )}

                {result.privateDm && (
                  <div className="p-2.5 rounded-lg bg-white border border-indigo-200 space-y-0.5">
                    <span className="font-semibold text-indigo-700 flex items-center gap-1 text-[11px]">
                      <Lock className="w-3 h-3 text-indigo-600" />
                      Private DM (Meta Private Replies to User Inbox):
                    </span>
                    <p className="text-slate-900 whitespace-pre-line">{result.privateDm}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-700">
              <XCircle className="w-5 h-5 text-slate-400 shrink-0" />
              <div>
                <span className="font-semibold text-slate-900">No Rule Matched: </span>
                In live mode, this enquiry would be logged in the activity ledger as &apos;ignored&apos; without sending automated replies.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
