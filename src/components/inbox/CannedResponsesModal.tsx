"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Edit3,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { CannedResponse } from "@/types/database";
import { filterCannedResponses, normalizeShortcut } from "@/lib/inbox/slash-commands";

interface CannedResponsesModalProps {
  isOpen: boolean;
  onClose: () => void;
  responses: CannedResponse[];
  isViewer: boolean;
  canInsert: boolean;
  onInsertSnippet: (snippet: CannedResponse) => void;
  onCreateResponse: (input: {
    shortcut: string;
    title: string;
    content: string;
    category: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdateResponse: (input: {
    responseId: string;
    shortcut: string;
    title: string;
    content: string;
    category: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onDeleteResponse: (responseId: string) => Promise<{ success: boolean; error?: string }>;
}

const CATEGORIES = ["general", "pricing", "billing", "intake", "verification", "info"];

export function CannedResponsesModal({
  isOpen,
  onClose,
  responses,
  isViewer,
  canInsert,
  onInsertSnippet,
  onCreateResponse,
  onUpdateResponse,
  onDeleteResponse,
}: CannedResponsesModalProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [shortcut, setShortcut] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const filteredResponses = useMemo(() => {
    const byCat =
      categoryFilter === "all"
        ? responses
        : responses.filter((r) => r.category === categoryFilter);
    return filterCannedResponses(byCat, search);
  }, [responses, categoryFilter, search]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingId(null);
    setShortcut("");
    setTitle("");
    setCategory("general");
    setContent("");
    setError(null);
    setShowForm(false);
  };

  const startCreate = () => {
    setEditingId(null);
    setShortcut("");
    setTitle("");
    setCategory("general");
    setContent("");
    setError(null);
    setShowForm(true);
  };

  const startEdit = (item: CannedResponse) => {
    setEditingId(item.id);
    setShortcut(item.shortcut);
    setTitle(item.title);
    setCategory(item.category || "general");
    setContent(item.content);
    setError(null);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const cleanShortcut = normalizeShortcut(shortcut);
    if (!cleanShortcut) {
      setError("Shortcut must contain letters or numbers (e.g. pricing, hours).");
      return;
    }
    if (!title.trim() || !content.trim()) {
      setError("Title and snippet content are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = editingId
        ? await onUpdateResponse({
            responseId: editingId,
            shortcut: cleanShortcut,
            title: title.trim(),
            content: content.trim(),
            category,
          })
        : await onCreateResponse({
            shortcut: cleanShortcut,
            title: title.trim(),
            content: content.trim(),
            category,
          });

      if (res.success) {
        resetForm();
      } else {
        setError(res.error || "Failed to save quick reply.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save quick reply.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await onDeleteResponse(id);
      if (!res.success) {
        setError(res.error || "Failed to delete quick reply.");
      }
      if (editingId === id) {
        resetForm();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete quick reply.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="canned-responses-modal-title"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 id="canned-responses-modal-title" className="text-sm font-bold text-slate-900">
                Quick Replies &amp; Canned Responses
              </h3>
              <p className="text-[11px] text-slate-500">
                Type <code className="px-1 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono">/shortcut</code> in the composer to insert a saved reply instantly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isViewer && !showForm && (
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Quick Reply</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Close quick replies modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Create / Edit Form */}
          {showForm && !isViewer && (
            <form
              onSubmit={handleSave}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">
                  {editingId ? "Edit Quick Reply" : "Create New Quick Reply"}
                </h4>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Slash Shortcut *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-indigo-600">
                      /
                    </span>
                    <input
                      type="text"
                      required
                      value={shortcut}
                      onChange={(e) => setShortcut(e.target.value)}
                      placeholder="pricing"
                      className="w-full pl-6 pr-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Consultation Fee Details"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 capitalize"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Message Snippet Content *
                </label>
                <textarea
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter full canned response message (Tamil & English supported)..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{editingId ? "Update Snippet" : "Save Snippet"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by /shortcut, title, or message text..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 capitalize focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Snippets List */}
          <div className="space-y-2">
            {filteredResponses.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                No quick replies found matching your filter.
              </div>
            ) : (
              filteredResponses.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[11px] font-bold">
                        /{item.shortcut}
                      </span>
                      <span className="text-xs font-semibold text-slate-900">{item.title}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">
                      {item.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {canInsert && (
                      <button
                        type="button"
                        onClick={() => {
                          onInsertSnippet(item);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors"
                      >
                        Insert
                      </button>
                    )}
                    {!isViewer && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50"
                          title="Edit snippet"
                          aria-label={`Edit /${item.shortcut}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          title="Delete snippet"
                          aria-label={`Delete /${item.shortcut}`}
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
