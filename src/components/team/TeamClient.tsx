"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  Business,
  BusinessMember,
  BusinessRole,
  BusinessInvitation,
  TeamActivityLog,
  TeamMemberWithProfile,
  AgentWorkload,
  UserProfile,
} from "@/types/database";
import {
  inviteTeamMemberAction,
  updateMemberRoleAction,
  toggleMemberStatusAction,
  removeMemberAction,
  revokeInvitationAction,
  resendInvitationAction,
} from "@/app/actions/team";
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Eye,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  Bot,
  RefreshCw,
  Trash2,
  X,
  ExternalLink,
  MessageSquare,
  Sparkles,
  BarChart2,
} from "lucide-react";
import Link from "next/link";

interface TeamClientProps {
  business: Business;
  currentUser: UserProfile;
  currentMembership: BusinessMember;
  initialMembers: TeamMemberWithProfile[];
  initialInvitations: BusinessInvitation[];
  initialActivities: TeamActivityLog[];
  initialWorkloads: AgentWorkload[];
}

export function TeamClient({
  business,
  currentUser,
  currentMembership,
  initialMembers,
  initialInvitations,
  initialActivities,
  initialWorkloads,
}: TeamClientProps) {
  const [members, setMembers] = useState<TeamMemberWithProfile[]>(initialMembers);
  const [invitations, setInvitations] = useState<BusinessInvitation[]>(initialInvitations);
  const [activities, setActivities] = useState<TeamActivityLog[]>(initialActivities);
  const [workloads, setWorkloads] = useState<AgentWorkload[]>(initialWorkloads);

  const [activeTab, setActiveTab] = useState<"members" | "workload" | "invitations" | "activity">("members");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<BusinessRole>("agent");

  const [editingMember, setEditingMember] = useState<TeamMemberWithProfile | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<BusinessRole>("agent");

  const [memberToRemove, setMemberToRemove] = useState<TeamMemberWithProfile | null>(null);

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isOwner = currentMembership.role === "owner";
  const isAdmin = currentMembership.role === "admin";
  const canManageTeam = isOwner || isAdmin;
  const isAstrology = business.slug === "astrology";
  const accentBorder = isAstrology ? "border-purple-500" : "border-rose-500";
  const accentBg = isAstrology ? "bg-purple-600 hover:bg-purple-700" : "bg-rose-600 hover:bg-rose-700";

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (statusFilter === "active" && !m.is_active) return false;
      if (statusFilter === "inactive" && m.is_active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (m.user_profile.full_name || "").toLowerCase();
        const email = m.user_profile.email.toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [members, roleFilter, statusFilter, searchQuery]);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      if (activityTypeFilter !== "all" && a.activity_type !== activityTypeFilter) return false;
      return true;
    });
  }, [activities, activityTypeFilter]);

  // KPI Computations
  const totalMembersCount = members.length;
  const activeMembersCount = members.filter((m) => m.is_active).length;
  const activeAgentsCount = members.filter((m) => m.is_active && (m.role === "agent" || m.role === "admin")).length;
  const pendingInvitesCount = invitations.filter((i) => i.status === "pending").length;
  const totalActiveAssignedConversations = workloads.reduce(
    (acc, w) => acc + (w.activeConversationsCount || 0),
    0
  );

  // Invite Handler
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await inviteTeamMemberAction({
        businessSlug: business.slug,
        email: inviteEmail,
        role: inviteRole,
        fullName: inviteFullName.trim() || undefined,
      });

      if (!res.success) {
        setActionError(res.error);
      } else {
        setActionSuccess(`Invitation successfully sent to ${res.invitation.email}!`);
        setInvitations((prev) => [res.invitation, ...prev]);
        setShowInviteModal(false);
        setInviteEmail("");
        setInviteFullName("");
        setInviteRole("agent");
      }
    });
  };

  // Role Update Handler
  const handleRoleUpdateSubmit = async () => {
    if (!editingMember) return;
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await updateMemberRoleAction({
        businessSlug: business.slug,
        memberId: editingMember.id,
        newRole: newSelectedRole,
      });

      if (!res.success) {
        setActionError(res.error);
      } else {
        setActionSuccess(`Role for ${editingMember.user_profile.full_name || editingMember.user_profile.email} updated to ${newSelectedRole.toUpperCase()}`);
        setMembers((prev) =>
          prev.map((m) => (m.id === editingMember.id ? { ...m, role: newSelectedRole } : m))
        );
        setEditingMember(null);
      }
    });
  };

  // Toggle Status Handler
  const handleToggleStatus = async (member: TeamMemberWithProfile) => {
    setActionError(null);
    setActionSuccess(null);

    const nextState = !member.is_active;
    startTransition(async () => {
      const res = await toggleMemberStatusAction({
        businessSlug: business.slug,
        memberId: member.id,
        isActive: nextState,
      });

      if (!res.success) {
        setActionError(res.error);
      } else {
        setActionSuccess(
          `${member.user_profile.full_name || member.user_profile.email} is now ${nextState ? "Active" : "Inactive"}`
        );
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, is_active: nextState } : m))
        );
      }
    });
  };

  // Remove Member Handler
  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await removeMemberAction({
        businessSlug: business.slug,
        memberId: memberToRemove.id,
      });

      if (!res.success) {
        setActionError(res.error);
      } else {
        setActionSuccess(`Removed ${memberToRemove.user_profile.full_name || memberToRemove.user_profile.email} from ${business.name}`);
        setMembers((prev) => prev.filter((m) => m.id !== memberToRemove.id));
        setMemberToRemove(null);
      }
    });
  };

  // Revoke Invitation Handler
  const handleRevokeInvitation = async (invitationId: string) => {
    startTransition(async () => {
      const res = await revokeInvitationAction({
        businessSlug: business.slug,
        invitationId,
      });
      if (res.success) {
        setInvitations((prev) =>
          prev.map((i) => (i.id === invitationId ? { ...i, status: "revoked" } : i))
        );
      } else {
        setActionError(res.error);
      }
    });
  };

  // Resend Invitation Handler
  const handleResendInvitation = async (invitationId: string) => {
    startTransition(async () => {
      const res = await resendInvitationAction({
        businessSlug: business.slug,
        invitationId,
      });
      if (res.success) {
        setActionSuccess("Invitation resent with a fresh 7-day validity window.");
        setInvitations((prev) =>
          prev.map((i) => (i.id === invitationId ? res.invitation : i))
        );
      } else {
        setActionError(res.error);
      }
    });
  };

  // Helper for Role Badges
  const renderRoleBadge = (role: BusinessRole) => {
    switch (role) {
      case "owner":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Sparkles className="w-3 h-3 text-amber-600" />
            Owner
          </span>
        );
      case "admin":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Shield className="w-3 h-3 text-indigo-600" />
            Admin
          </span>
        );
      case "agent":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="w-3 h-3 text-emerald-600" />
            Agent
          </span>
        );
      case "viewer":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <Eye className="w-3 h-3 text-slate-500" />
            Viewer
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                isAstrology ? "bg-purple-100 text-purple-800" : "bg-rose-100 text-rose-800"
              }`}
            >
              {business.slug.toUpperCase()} WORKSPACE
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500">
              Role: <strong className="text-slate-800 uppercase">{currentMembership.role}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Team Management & Agent Assignment
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage business staff, assign roles, inspect agent workload, and review team activity for {business.name}.
          </p>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            disabled={!canManageTeam}
            onClick={() => setShowInviteModal(true)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              canManageTeam
                ? `${accentBg} active:scale-95`
                : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-70"
            }`}
            title={
              canManageTeam
                ? "Invite a new member to this business"
                : "Only business owners and admins can invite team members"
            }
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {/* Global Notifications */}
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 text-rose-500 hover:text-rose-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 text-emerald-500 hover:text-emerald-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Members</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalMembersCount}</span>
            <span className="text-xs text-emerald-600 font-medium">({activeMembersCount} active)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Isolated to {business.name}</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Active Agents & Admins</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{activeAgentsCount}</span>
            <span className="text-xs text-slate-500">online/available</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Ready for conversation assignment</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pending Invitations</span>
            <Mail className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{pendingInvitesCount}</span>
            <span className="text-xs text-amber-600 font-medium">awaiting onboarding</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Valid 7 days from invite</p>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Assigned Workload</span>
            <MessageSquare className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalActiveAssignedConversations}</span>
            <span className="text-xs text-slate-500">active threads</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across all team members</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex items-center gap-1 sm:gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "members"
              ? `${accentBorder} text-slate-900`
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team Members ({members.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("workload")}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "workload"
              ? `${accentBorder} text-slate-900`
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Agent Workload ({workloads.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invitations")}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "invitations"
              ? `${accentBorder} text-slate-900`
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Pending Invitations ({invitations.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
            activeTab === "activity"
              ? `${accentBorder} text-slate-900`
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Activity Audit Log ({activities.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MEMBERS TABLE */}
      {/* ========================================================================= */}
      {activeTab === "members" && (
        <div className="space-y-4">
          {/* Search & Filters Toolbar */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search team members by name or email..."
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-slate-500 font-medium">Role:</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 font-medium"
              >
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="agent">Agent</option>
                <option value="viewer">Viewer</option>
              </select>

              <label className="text-slate-500 font-medium ml-2">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Business Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned Workload</th>
                    <th className="px-4 py-3">Last Login / Active</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No team members found matching your search and filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const workload = workloads.find((w) => w.userId === member.user_id);
                      const isTargetOwner = member.role === "owner";
                      const canModifyTarget =
                        isOwner || (isAdmin && !isTargetOwner && member.role !== "admin");

                      return (
                        <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                                {(member.user_profile.full_name || member.user_profile.email)
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                  <span>{member.user_profile.full_name || "Staff Member"}</span>
                                  {member.user_id === currentUser.id && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-100 text-slate-600 font-normal">
                                      You
                                    </span>
                                  )}
                                  {member.user_profile.is_superadmin && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-100 text-indigo-700 font-medium">
                                      Platform Superadmin
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {member.user_profile.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">{renderRoleBadge(member.role)}</td>

                          <td className="px-4 py-3">
                            {member.is_active ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                Deactivated
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {member.role === "viewer" ? (
                              <span className="text-slate-400 text-[11px] italic">Not assignable</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">
                                  {workload?.activeConversationsCount || 0}
                                </span>
                                <span className="text-slate-400 text-[11px]">conversations</span>
                                {workload && workload.unreadCount > 0 && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    {workload.unreadCount} unread
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-[11px] text-slate-500">
                            {member.last_login_at
                              ? new Date(member.last_login_at).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Never logged in"}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Change Role Button */}
                              <button
                                type="button"
                                disabled={!canModifyTarget}
                                onClick={() => {
                                  setEditingMember(member);
                                  setNewSelectedRole(member.role);
                                }}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                                  canModifyTarget
                                    ? "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                                    : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                }`}
                                title={
                                  canModifyTarget
                                    ? "Change member role"
                                    : "Insufficient permissions to change this member's role"
                                }
                              >
                                Change Role
                              </button>

                              {/* Activate / Deactivate Toggle */}
                              <button
                                type="button"
                                disabled={!canModifyTarget || (isTargetOwner && member.is_active)}
                                onClick={() => handleToggleStatus(member)}
                                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                                  canModifyTarget && !(isTargetOwner && member.is_active)
                                    ? member.is_active
                                      ? "bg-white border-rose-200 text-rose-600 hover:bg-rose-50"
                                      : "bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                    : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                }`}
                                title={
                                  isTargetOwner && member.is_active
                                    ? "Cannot deactivate the business owner"
                                    : member.is_active
                                    ? "Deactivate member"
                                    : "Activate member"
                                }
                              >
                                {member.is_active ? "Deactivate" : "Activate"}
                              </button>

                              {/* Remove Button */}
                              <button
                                type="button"
                                disabled={!canModifyTarget || isTargetOwner}
                                onClick={() => setMemberToRemove(member)}
                                className={`p-1.5 rounded-lg border text-xs transition-colors ${
                                  canModifyTarget && !isTargetOwner
                                    ? "bg-white border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200"
                                    : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                }`}
                                title={
                                  isTargetOwner
                                    ? "Cannot remove the business owner"
                                    : "Remove member from business"
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AGENT WORKLOAD */}
      {/* ========================================================================= */}
      {activeTab === "workload" && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Agent Workload & Capacity</h2>
            <p className="text-xs text-slate-500">
              Real-time assignment distribution across all agents in {business.name}. Ensure balanced response queues.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workloads.map((agent) => (
              <div
                key={agent.userId}
                className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                      {agent.userName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 truncate">
                        {agent.userName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{agent.email}</div>
                    </div>
                  </div>
                  {renderRoleBadge(agent.role)}
                </div>

                <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-lg text-center">
                  <div>
                    <div className="text-lg font-bold text-slate-800">
                      {agent.activeConversationsCount}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Active</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-600">{agent.unreadCount}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Unread</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-600">{agent.pendingHumanCount}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Handover</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Status: {agent.isActive ? "Online" : "Offline"}
                  </span>
                  <Link
                    href={`/workspace/${business.slug}/inbox`}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>View Inbox</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PENDING INVITATIONS */}
      {/* ========================================================================= */}
      {activeTab === "invitations" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Pending Business Invitations</h2>
                <p className="text-xs text-slate-500">
                  Invited users receive access to {business.name} once accepted.
                </p>
              </div>
              <button
                type="button"
                disabled={!canManageTeam}
                onClick={() => setShowInviteModal(true)}
                className={`px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 ${
                  canManageTeam ? accentBg : "bg-slate-300 cursor-not-allowed"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Member</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3">Invited Email</th>
                    <th className="px-4 py-3">Role Assigned</th>
                    <th className="px-4 py-3">Invited By</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Expires At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No pending invitations. Click &quot;Invite Member&quot; to add staff.
                      </td>
                    </tr>
                  ) : (
                    invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{inv.email}</td>
                        <td className="px-4 py-3">{renderRoleBadge(inv.role)}</td>
                        <td className="px-4 py-3 text-slate-500">{inv.invited_by_name || "Admin"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              inv.status === "pending"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : inv.status === "accepted"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(inv.expires_at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {inv.status === "pending" && canManageTeam && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleResendInvitation(inv.id)}
                                className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium"
                              >
                                Resend
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRevokeInvitation(inv.id)}
                                className="px-2.5 py-1 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-medium"
                              >
                                Revoke
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ACTIVITY AUDIT LOG */}
      {/* ========================================================================= */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          {/* Activity Filters */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-700">Filter Event Type:</span>
            <select
              value={activityTypeFilter}
              onChange={(e) => setActivityTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 font-medium"
            >
              <option value="all">All Activities</option>
              <option value="member_invited">Member Invitations</option>
              <option value="role_changed">Role Changes</option>
              <option value="member_activated">Member Activated</option>
              <option value="member_deactivated">Member Deactivated</option>
              <option value="member_removed">Member Removed</option>
              <option value="conversation_assigned">Conversation Assigned</option>
              <option value="conversation_reassigned">Conversation Reassigned</option>
              <option value="human_takeover">Human Takeover</option>
              <option value="bot_resumed">Bot Resumed</option>
              <option value="conversation_resolved">Conversation Resolved</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100">
            {filteredActivities.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No activity logs recorded matching this filter.
              </div>
            ) : (
              filteredActivities.map((act) => {
                let IconComponent = Clock;
                let iconColor = "text-slate-500 bg-slate-100";

                if (act.activity_type === "member_invited") {
                  IconComponent = UserPlus;
                  iconColor = "text-indigo-600 bg-indigo-50";
                } else if (act.activity_type === "role_changed") {
                  IconComponent = ShieldAlert;
                  iconColor = "text-amber-600 bg-amber-50";
                } else if (act.activity_type === "conversation_assigned" || act.activity_type === "conversation_reassigned") {
                  IconComponent = ArrowRightLeft;
                  iconColor = "text-blue-600 bg-blue-50";
                } else if (act.activity_type === "human_takeover") {
                  IconComponent = AlertTriangle;
                  iconColor = "text-rose-600 bg-rose-50";
                } else if (act.activity_type === "bot_resumed") {
                  IconComponent = Bot;
                  iconColor = "text-purple-600 bg-purple-50";
                } else if (act.activity_type === "conversation_resolved") {
                  IconComponent = CheckCircle2;
                  iconColor = "text-emerald-600 bg-emerald-50";
                }

                return (
                  <div key={act.id} className="p-4 flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                    <div className={`p-2 rounded-xl shrink-0 ${iconColor}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-900">{act.description}</span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(act.created_at).toLocaleTimeString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>Actor: <strong className="text-slate-700">{act.actor_name || "System"}</strong></span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-slate-400 uppercase">{act.activity_type}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INVITE MEMBER DIALOG */}
      {/* ========================================================================= */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Invite Team Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={inviteFullName}
                  onChange={(e) => setInviteFullName(e.target.value)}
                  placeholder="e.g. Priyadharshini"
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Role <span className="text-rose-500">*</span>
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as BusinessRole)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {isOwner && <option value="owner">Owner — Full control of this business</option>}
                  {isOwner && <option value="admin">Admin — Manage operational settings & team</option>}
                  <option value="agent">Agent — Reply to customers & manage conversations</option>
                  <option value="viewer">Viewer — Read-only access to permitted data</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {inviteRole === "owner" && "Grants full control over business settings and memberships."}
                  {inviteRole === "admin" && "Can manage operational settings, conversations, and assign agents."}
                  {inviteRole === "agent" && "Can respond to customers and update conversation status."}
                  {inviteRole === "viewer" && "Read-only access. Cannot send WhatsApp messages or modify data."}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !inviteEmail.trim()}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-sm ${accentBg} ${
                    isPending ? "opacity-70 cursor-wait" : ""
                  }`}
                >
                  {isPending ? "Sending Invitation..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHANGE ROLE DIALOG */}
      {/* ========================================================================= */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Change Member Role</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Update business role for{" "}
                <strong className="text-slate-900">
                  {editingMember.user_profile.full_name || editingMember.user_profile.email}
                </strong>
                .
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select New Role
                </label>
                <select
                  value={newSelectedRole}
                  onChange={(e) => setNewSelectedRole(e.target.value as BusinessRole)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {isOwner && <option value="owner">Owner (Full Business Control)</option>}
                  {isOwner && <option value="admin">Admin (Operational & Team Management)</option>}
                  <option value="agent">Agent (Customer Conversations & Inbox)</option>
                  <option value="viewer">Viewer (Read-Only Permitted Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending || newSelectedRole === editingMember.role}
                  onClick={handleRoleUpdateSubmit}
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-sm ${accentBg}`}
                >
                  {isPending ? "Updating Role..." : "Update Role"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REMOVE MEMBER CONFIRMATION */}
      {/* ========================================================================= */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Remove Team Member</h3>
              </div>
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to remove{" "}
                <strong className="text-slate-900">
                  {memberToRemove.user_profile.full_name || memberToRemove.user_profile.email}
                </strong>{" "}
                from <strong className="text-slate-900">{business.name}</strong>?
              </p>
              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                This will immediately revoke their access to this workspace. Any active conversations assigned to them will be moved to the unassigned queue.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMemberToRemove(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleRemoveMember}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
                >
                  {isPending ? "Removing..." : "Confirm Removal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
