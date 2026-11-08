import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { PageHeader, Tabs } from '@/components/kit';
import { EmptyState } from '@/components/ui';
import { Accounts } from './Accounts';
import { Audit } from './Audit';
import { Roles } from './Roles';
import { Site } from './Site';

type Tab = 'accounts' | 'roles' | 'site' | 'audit';

export function AdminHub() {
  const { can } = useAuth();
  const tabs: { id: Tab; label: string; ok: boolean }[] = [
    { id: 'accounts', label: 'الحسابات', ok: can('users.view') },
    { id: 'roles', label: 'الأدوار والصلاحيات', ok: can('roles.view') },
    { id: 'site', label: 'إدارة الموقع', ok: can('site.view') || can('site.update') },
    { id: 'audit', label: 'سجل الإدارة', ok: can('audit.view') },
  ];
  const allowed = tabs.filter((t) => t.ok);
  const [tab, setTab] = useState<Tab>(allowed[0]?.id ?? 'accounts');
  if (!allowed.length) return <EmptyState title="لا تملك صلاحيات إدارية" />;
  return (
    <div className="animate-fade-up">
      <PageHeader title="لوحة الإدارة" desc="الرتب والأقسام وملفات الأفراد تُدار من صفحاتها الخاصة في القائمة الجانبية." />
      <Tabs value={tab} onChange={setTab} tabs={allowed} />
      {tab === 'accounts' && <Accounts />}
      {tab === 'roles' && <Roles />}
      {tab === 'site' && <Site />}
      {tab === 'audit' && <Audit />}
    </div>
  );
}
