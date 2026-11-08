import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AsyncView } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { fmtDateTime } from '@/lib/format';
import type { AppNotification } from '@/lib/types';

const bump = () => window.dispatchEvent(new Event('macs:notifications'));

export function Notifications() {
  const { profile } = useAuth();
  const nav = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const state = useAsync(async () => {
    let q = supabase.from('notifications').select('id,type,title,body,link,is_read,created_at')
      .eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(100);
    if (filter === 'unread') q = q.eq('is_read', false);
    return unwrap(await q) as AppNotification[];
  }, [profile!.id, filter]);

  const read = async (n: AppNotification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', n.id);
      bump(); state.reload();
    }
    if (n.link) nav(n.link);
  };
  const readAll = async () => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', profile!.id).eq('is_read', false);
    bump(); state.reload();
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold text-white">مركز الإشعارات</h1>
        <div className="flex rounded-md border border-white/10 p-0.5 text-xs">
          {(['all', 'unread'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              className={`rounded px-3 py-1.5 font-semibold ${filter === f ? 'bg-gold-500 text-navy-900' : 'text-slate-400'}`}>
              {f === 'all' ? 'الكل' : 'غير المقروءة'}
            </button>
          ))}
        </div>
        <button onClick={readAll} className="btn btn-outline !py-1.5"><CheckCheck className="h-4 w-4" /> تعليم الكل كمقروء</button>
      </div>
      <AsyncView state={state} emptyTitle={filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات'}>
        {(rows) => (
          <ul className="card divide-y divide-white/[.06]">
            {rows.map((n) => (
              <li key={n.id}>
                <button onClick={() => read(n)} className="flex w-full items-start gap-3 px-4 py-3.5 text-start hover:bg-white/[.03]">
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-slate-600' : 'bg-gold-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.is_read ? 'text-slate-400' : 'font-semibold text-white'}`}>{n.title}</span>
                    {n.body && <span className="block text-xs text-slate-500">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-slate-500">{fmtDateTime(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </AsyncView>
    </div>
  );
}
