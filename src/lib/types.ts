export type ServiceStatus = 'active' | 'on_leave' | 'suspended' | 'terminated' | 'reserve';
export type RankCategory = 'supreme' | 'officer' | 'nco' | 'enlisted';

export interface Rank {
  id: string; code: string; name_en: string; name_ar: string;
  category: RankCategory; level: number; description: string | null; insignia_url: string | null;
}
export interface Department {
  id: string; code: string; name_en: string; name_ar: string;
  description: string | null; missions: string | null; emblem_url: string | null;
  commander_id: string | null; deputy_id: string | null; sort_order: number;
}
export interface Profile {
  id: string; username: string; full_name: string; full_name_en: string | null;
  avatar_url: string | null; is_active: boolean;
}
export interface Personnel {
  id: string; user_id: string; military_number: string; rank_id: string; department_id: string | null;
  service_status: ServiceStatus; joined_at: string; admin_notes: string | null;
  rank: Rank | null; department: Department | null;
}
export interface Announcement {
  id: string; title: string; body: string; image_url: string | null; pinned: boolean;
  published_at: string | null; is_public: boolean;
}
export interface Decision {
  id: string; ref_number: string | null; title: string; body: string; decision_type: string;
  importance: 'normal' | 'important' | 'urgent' | 'critical'; issued_at: string;
}
export interface NewsUpdate { id: string; title: string; summary: string | null; published_at: string | null }
export interface LawCategory { id: string; code: string; name_ar: string; name_en: string | null; sort_order: number }
export interface Law {
  id: string; category_id: string; title: string; content: string;
  responsible_party: string | null; updated_at: string;
}
export interface AppNotification {
  id: string; type: string; title: string; body: string | null; link: string | null;
  is_read: boolean; created_at: string;
}
export interface PersonnelEvent {
  id: string; event_type: string; reason: string | null; created_at: string;
  from_rank: { name_ar: string } | null; to_rank: { name_ar: string } | null;
  from_department: { name_ar: string } | null; to_department: { name_ar: string } | null;
}
export interface MinistrySettings {
  name_ar?: string; name_en?: string; system_name?: string; system_name_ar?: string;
  tagline?: string; about?: string; logo_url?: string | null;
}

export interface PersonnelRow extends Personnel { profile: Profile }
export interface Law2 extends Law { department_id: string | null; restricted: boolean; is_public: boolean; status: string; sort_order: number }
