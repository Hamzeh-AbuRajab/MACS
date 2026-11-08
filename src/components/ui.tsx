import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'ok' | 'warn' | 'bad' | 'mute';

export const Spinner = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <Loader2 className={`animate-spin text-gold-400 ${className}`} aria-hidden />
);

export const Badge = ({ tone = 'mute', children }: { tone?: Tone; children: ReactNode }) => (
  <span className={`badge badge-${tone}`}>{children}</span>
);

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-white/[.06] ${className}`} aria-hidden />
);

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="جارٍ التحميل">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center">
      <div className="text-slate-500">{icon ?? <Inbox className="h-7 w-7" aria-hidden />}</div>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      {hint && <p className="max-w-sm text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/[.06] px-6 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-red-300" aria-hidden />
      <p className="text-sm font-semibold text-red-200">تعذّر تحميل البيانات</p>
      <p className="ltr max-w-md text-xs text-red-300/70">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn btn-outline mt-2 !py-1.5">إعادة المحاولة</button>}
    </div>
  );
}

/** Loading / error / empty / content in one place so every list handles all four states. */
export function AsyncView<T>({
  state, empty, emptyTitle, emptyHint, rows, children,
}: {
  state: { data: T[] | undefined; error: string | null; loading: boolean; reload: () => void };
  empty?: boolean; emptyTitle: string; emptyHint?: string; rows?: number;
  children: (data: T[]) => ReactNode;
}) {
  if (state.loading && !state.data) return <LoadingBlock rows={rows} />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data || state.data.length === 0 || empty) return <EmptyState title={emptyTitle} hint={emptyHint} />;
  return <>{children(state.data)}</>;
}

export function SectionTitle({ eyebrow, title, desc }: { eyebrow?: string; title: string; desc?: string }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="eyebrow ltr mb-2 text-start">{eyebrow}</p>}
      <h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
      <div className="mt-3 h-0.5 w-14 bg-gold-500" />
      {desc && <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">{desc}</p>}
    </div>
  );
}
