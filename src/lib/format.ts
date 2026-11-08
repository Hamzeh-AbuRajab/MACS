import type { RankCategory, ServiceStatus } from './types';

const LOCALE = 'ar-u-nu-latn';

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(LOCALE, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

export const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const SERVICE_STATUS: Record<ServiceStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }> = {
  active: { label: 'على رأس الخدمة', tone: 'ok' },
  on_leave: { label: 'في إجازة', tone: 'warn' },
  suspended: { label: 'موقوف', tone: 'bad' },
  terminated: { label: 'منتهي الخدمة', tone: 'bad' },
  reserve: { label: 'احتياط', tone: 'mute' },
};

export const RANK_CATEGORY: Record<RankCategory, string> = {
  supreme: 'القيادة العليا',
  officer: 'القيادة والضباط',
  nco: 'ضباط الصف',
  enlisted: 'الأفراد',
};

export const DECISION_TYPE: Record<string, string> = {
  general: 'قرار عام', supreme: 'قرار القيادة العليا', promotion: 'قرار ترقية', appointment: 'قرار تعيين',
  dismissal: 'قرار فصل', transfer: 'قرار نقل', operation: 'قرار عمليات', department: 'قرار قسم',
};

export const IMPORTANCE: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }> = {
  normal: { label: 'عادي', tone: 'mute' }, important: { label: 'هام', tone: 'warn' },
  urgent: { label: 'عاجل', tone: 'bad' }, critical: { label: 'حرج', tone: 'bad' },
};

export const EVENT_LABEL: Record<string, string> = {
  joined: 'الانتساب للخدمة', promotion: 'ترقية', demotion: 'تخفيض رتبة', transfer: 'نقل',
  suspension: 'إيقاف', reinstatement: 'إعادة تفعيل', termination: 'إنهاء خدمة', assignment: 'تكليف', note: 'ملاحظة',
};

export const PENALTY: Record<string, string> = {
  warning: 'تنبيه', formal_warning: 'إنذار رسمي', deduction: 'خصم', temporary_suspension: 'إيقاف مؤقت',
  demotion: 'تخفيض رتبة', dismissal: 'فصل عسكري', military_trial_referral: 'إحالة للمحاكمة العسكرية',
};

export const REQUEST_STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }> = {
  pending: { label: 'قيد المراجعة', tone: 'warn' }, approved: { label: 'مقبول', tone: 'ok' },
  rejected: { label: 'مرفوض', tone: 'bad' }, cancelled: { label: 'ملغى', tone: 'mute' },
};

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
  if (s < 60) return rtf.format(-s, 'second');
  if (s < 3600) return rtf.format(-Math.floor(s / 60), 'minute');
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), 'hour');
  return rtf.format(-Math.floor(s / 86400), 'day');
};
