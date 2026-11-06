export type BusinessSlug = 'astrology' | 'vivaham';

export interface Business {
  id: string;
  name: string;
  slug: BusinessSlug;
  description: string;
  icon_name: string;
  accent_color: 'purple' | 'rose' | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Dynamic business-scoped metrics for Business Selection Card
  stats?: {
    connectionStatus: 'connected' | 'disconnected' | 'testing';
    connectedNumbersCount: number;
    unreadEnquiriesCount: number;
    pendingRepliesCount: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  created_at: string;
  updated_at: string;
}

export type BusinessRole = 'owner' | 'admin' | 'agent';

export interface BusinessMember {
  id: string;
  business_id: string;
  user_id: string;
  role: BusinessRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  business?: Business;
  user_profile?: UserProfile;
}

export interface BusinessWorkspaceContext {
  business: Business;
  membership: BusinessMember;
  user: UserProfile;
}
