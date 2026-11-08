import {
  Bell, Flag, Boxes, Building2, CalendarOff, Crown, FileSignature, Gavel, LayoutDashboard, Megaphone,
  ScrollText, Search, Settings, Star, UserCog, Users, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string; label: string; icon: LucideIcon;
  /** UI visibility only. `perm: null` = every signed-in user. RLS still enforces access. */
  perm: string | string[] | null;
  /** Items stay registered but hidden until their phase ships, so no empty pages exist. */
  ready: boolean;
  phase: number;
  group: 'main' | 'ops' | 'admin';
}

export const NAV: NavItem[] = [
  { to: '/app', label: 'لوحة التحكم', icon: LayoutDashboard, perm: null, ready: true, phase: 1, group: 'main' },
  { to: '/app/notifications', label: 'الإشعارات', icon: Bell, perm: null, ready: true, phase: 1, group: 'main' },
  { to: '/app/profile', label: 'ملفي الشخصي', icon: UserCog, perm: null, ready: true, phase: 1, group: 'main' },

  { to: '/app/command', label: 'القيادة العليا', icon: Crown, perm: 'reports.view', ready: true, phase: 2, group: 'ops' },
  { to: '/app/personnel', label: 'شؤون الأفراد', icon: Users, perm: 'personnel.view', ready: true, phase: 2, group: 'ops' },
  { to: '/app/ranks', label: 'الرتب', icon: Star, perm: null, ready: true, phase: 2, group: 'ops' },
  { to: '/app/departments', label: 'الأقسام', icon: Building2, perm: null, ready: true, phase: 2, group: 'ops' },
  { to: '/app/laws', label: 'القوانين', icon: ScrollText, perm: null, ready: true, phase: 3, group: 'ops' },
  { to: '/app/decisions', label: 'القرارات', icon: FileSignature, perm: null, ready: true, phase: 3, group: 'ops' },
  { to: '/app/announcements', label: 'الإعلانات', icon: Megaphone, perm: null, ready: true, phase: 3, group: 'ops' },
  { to: '/app/requests', label: 'الترقيات والإجازات', icon: CalendarOff, perm: null, ready: true, phase: 3, group: 'ops' },
  { to: '/app/report', label: 'تقديم بلاغ', icon: Flag, perm: null, ready: true, phase: 5, group: 'ops' },
  { to: '/app/warehouses', label: 'المستودعات والعهد', icon: Boxes, perm: 'warehouses.view', ready: true, phase: 5, group: 'ops' },
  { to: '/app/intelligence', label: 'الاستخبارات', icon: Search, perm: 'cases.view', ready: true, phase: 5, group: 'ops' },
  { to: '/app/discipline', label: 'العقوبات', icon: Gavel, perm: 'discipline.view', ready: true, phase: 5, group: 'ops' },

  { to: '/app/admin', label: 'لوحة الإدارة', icon: Settings, perm: ['users.view', 'roles.view', 'site.update', 'audit.view'], ready: true, phase: 4, group: 'admin' },
];

export const GROUP_LABEL: Record<NavItem['group'], string> = { main: 'الرئيسية', ops: 'العمليات', admin: 'الإدارة' };
