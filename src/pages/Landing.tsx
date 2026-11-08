import { Link } from 'react-router-dom';
import { ChevronDown, LogIn, Plane, Anchor, Shield, Swords, AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Emblem, Wordmark } from '@/components/Logo';
import { RankInsignia } from '@/components/RankInsignia';
import { AsyncView, Badge, SectionTitle } from '@/components/ui';
import { isConfigured, supabase } from '@/lib/supabase';
import { unwrap, useAsync } from '@/lib/useAsync';
import { DECISION_TYPE, IMPORTANCE, RANK_CATEGORY, fmtDate } from '@/lib/format';
import type {
  Announcement, Decision, Department, Law, LawCategory, MinistrySettings, NewsUpdate, Rank, RankCategory,
} from '@/lib/types';

const DEPT_ICON: Record<string, ReactNode> = {
  army: <Shield className="h-6 w-6" />, air_force: <Plane className="h-6 w-6" />,
  navy: <Anchor className="h-6 w-6" />, delta: <Swords className="h-6 w-6" />,
};

const usePublic = <T,>(fn: () => Promise<T>) => useAsync(fn, []);

export function Landing() {
  const settings = usePublic(async () => {
    const r = await supabase.from('site_settings').select('value').eq('key', 'ministry').maybeSingle();
    if (r.error) throw r.error;
    return (r.data?.value ?? {}) as MinistrySettings;
  });
  const ranks = usePublic(async () => unwrap(await supabase.from('ranks').select('*').order('level')) as Rank[]);
  const depts = usePublic(async () => unwrap(await supabase.from('departments').select('*').order('sort_order')) as Department[]);
  const decisions = usePublic(async () => unwrap(await supabase.from('decisions')
    .select('id,ref_number,title,body,decision_type,importance,issued_at').eq('status', 'published').eq('is_public', true)
    .order('issued_at', { ascending: false }).limit(6)) as Decision[]);
  const announcements = usePublic(async () => unwrap(await supabase.from('announcements')
    .select('id,title,body,image_url,pinned,published_at,is_public').eq('status', 'published').eq('is_public', true)
    .order('pinned', { ascending: false }).order('published_at', { ascending: false }).limit(6)) as Announcement[]);
  const news = usePublic(async () => unwrap(await supabase.from('news_updates')
    .select('id,title,summary,published_at').eq('status', 'published')
    .order('published_at', { ascending: false }).limit(6)) as NewsUpdate[]);
  const cats = usePublic(async () => unwrap(await supabase.from('law_categories').select('*').order('sort_order')) as LawCategory[]);
  const laws = usePublic(async () => unwrap(await supabase.from('laws')
    .select('id,category_id,title,content,responsible_party,updated_at').eq('status', 'published').eq('is_public', true)
    .order('sort_order')) as Law[]);

  const s = settings.data ?? {};
  const logo = s.logo_url ?? null;

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-white/[.06] bg-navy-900/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Wordmark logo={logo} compact />
          <nav className="hidden flex-1 items-center gap-6 text-sm text-slate-400 md:flex" aria-label="أقسام الصفحة">
            {[['#decisions', 'القرارات'], ['#announcements', 'الإعلانات'], ['#laws', 'القوانين'], ['#ranks', 'الرتب'], ['#departments', 'الأقسام']].map(([h, t]) => (
              <a key={h} href={h} className="hover:text-gold-300">{t}</a>
            ))}
          </nav>
          <div className="flex-1 md:hidden" />
          <Link to="/login" className="btn btn-gold !py-2"><LogIn className="h-4 w-4" aria-hidden /> دخول عسكري</Link>
        </div>
      </header>

      {!isConfigured && (
        <div role="alert" className="border-b border-gold-500/30 bg-gold-500/10 px-4 py-2.5 text-center text-xs text-gold-300">
          <AlertTriangle className="me-1 inline h-3.5 w-3.5" aria-hidden />
          قاعدة البيانات غير مهيّأة: أنشئ ملف <span className="ltr font-mono">.env</span> من <span className="ltr font-mono">.env.example</span> ثم أعد التشغيل.
        </div>
      )}

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="grid-bg absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.3fr_1fr]">
          <div className="animate-fade-up">
            <p className="eyebrow ltr text-start">Military Administration &amp; Command System</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white sm:text-6xl">
              {s.name_ar ?? 'وزارة الدفاع'}
            </h1>
            <p className="ltr mt-3 text-start text-xl font-semibold tracking-wide text-gold-300">{s.name_en ?? 'Department of Defense'}</p>
            {s.tagline && <p className="mt-6 text-lg text-slate-300">{s.tagline}</p>}
            <p className="mt-4 max-w-xl text-sm leading-8 text-slate-400">
              {s.about ?? (settings.loading ? '' : 'نظام داخلي لإدارة القوات المسلحة: الرتب والأقسام والقرارات والانضباط والعمليات.')}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login" className="btn btn-gold !px-7 !py-3 text-base"><LogIn className="h-5 w-5" aria-hidden /> تسجيل الدخول العسكري</Link>
              <a href="#laws" className="btn btn-outline !px-7 !py-3 text-base">القوانين العسكرية</a>
            </div>
          </div>
          <div className="relative mx-auto hidden aspect-square w-full max-w-sm place-items-center lg:grid" aria-hidden>
            <div className="absolute inset-0 rounded-full border border-gold-500/20" />
            <div className="absolute inset-8 rounded-full border border-dashed border-gold-500/20" />
            <Emblem size={190} src={logo} />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-24 px-4 pb-24 sm:px-6">
        <Block id="decisions" eyebrow="OFFICIAL DECISIONS" title="آخر القرارات العسكرية" desc="القرارات الصادرة عن القيادة والمعلنة للجميع.">
          <AsyncView state={decisions} emptyTitle="لا توجد قرارات معلنة حالياً" emptyHint="ستظهر هنا القرارات العامة التي تنشرها القيادة.">
            {(rows) => (
              <div className="grid gap-4 md:grid-cols-2">
                {rows.map((d) => (
                  <article key={d.id} className="card p-5 transition-colors hover:border-gold-500/40">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <Badge tone={IMPORTANCE[d.importance].tone}>{IMPORTANCE[d.importance].label}</Badge>
                      <span className="text-slate-500">{DECISION_TYPE[d.decision_type]}</span>
                      {d.ref_number && <span className="ltr font-mono text-slate-500">#{d.ref_number}</span>}
                      <span className="ms-auto text-slate-500">{fmtDate(d.issued_at)}</span>
                    </div>
                    <h3 className="mt-3 font-bold text-white">{d.title}</h3>
                    <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-7 text-slate-400">{d.body}</p>
                  </article>
                ))}
              </div>
            )}
          </AsyncView>
        </Block>

        <div className="grid gap-12 lg:grid-cols-2">
          <Block id="announcements" eyebrow="CIRCULARS" title="الإعلانات والتعاميم">
            <AsyncView state={announcements} emptyTitle="لا توجد إعلانات" rows={2}>
              {(rows) => (
                <ul className="space-y-3">
                  {rows.map((a) => (
                    <li key={a.id} className="card p-4">
                      <p className="font-semibold text-white">{a.pinned && '📌 '}{a.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">{a.body}</p>
                      <p className="mt-2 text-[11px] text-slate-500">{fmtDate(a.published_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncView>
          </Block>
          <Block id="updates" eyebrow="UPDATES" title="آخر التحديثات العسكرية">
            <AsyncView state={news} emptyTitle="لا توجد تحديثات" rows={2}>
              {(rows) => (
                <ul className="space-y-3">
                  {rows.map((n) => (
                    <li key={n.id} className="card border-s-2 border-s-gold-500 p-4">
                      <p className="font-semibold text-white">{n.title}</p>
                      {n.summary && <p className="mt-1 text-sm text-slate-400">{n.summary}</p>}
                      <p className="mt-2 text-[11px] text-slate-500">{fmtDate(n.published_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncView>
          </Block>
        </div>

        <Block id="laws" eyebrow="MILITARY LAW" title="القوانين العسكرية" desc="التصنيفات الرسمية للقوانين. تظهر هنا القوانين المعلنة للعموم فقط، أما بقية اللوائح فتتاح بعد تسجيل الدخول وحسب الصلاحية.">
          <AsyncView state={cats} emptyTitle="لا توجد تصنيفات">
            {(rows) => (
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((c) => {
                  const list = (laws.data ?? []).filter((l) => l.category_id === c.id);
                  return (
                    <details key={c.id} className="card group open:border-gold-500/40">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 text-sm font-semibold text-slate-100">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-gold-500/15 text-[11px] text-gold-300">{c.sort_order}</span>
                        <span className="flex-1">{c.name_ar}</span>
                        <span className="text-[11px] font-normal text-slate-500">{laws.loading ? '' : `${list.length} قانون`}</span>
                        <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="space-y-3 border-t border-white/[.06] px-4 py-4">
                        {list.length === 0 && <p className="text-xs text-slate-500">لا توجد قوانين معلنة في هذا التصنيف.</p>}
                        {list.map((l) => (
                          <div key={l.id}>
                            <p className="text-sm font-semibold text-white">{l.title}</p>
                            <p className="mt-1 whitespace-pre-line text-sm leading-7 text-slate-400">{l.content}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {l.responsible_party && <>الجهة المسؤولة: {l.responsible_party} · </>}آخر تحديث: {fmtDate(l.updated_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </AsyncView>
        </Block>

        <Block id="ranks" eyebrow="CHAIN OF COMMAND" title="الرتب والهيكل التنظيمي" desc="التسلسل العسكري من القيادة العليا حتى الأفراد.">
          <AsyncView state={ranks} emptyTitle="لا توجد رتب" rows={4}>
            {(rows) => (
              <div className="space-y-8">
                {(['supreme', 'officer', 'nco', 'enlisted'] as RankCategory[]).map((cat) => {
                  const list = rows.filter((r) => r.category === cat);
                  if (!list.length) return null;
                  return (
                    <div key={cat}>
                      <h3 className="mb-3 flex items-center gap-3 text-sm font-bold text-gold-300">
                        {RANK_CATEGORY[cat]} <span className="h-px flex-1 bg-white/[.08]" />
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {list.map((r) => (
                          <div key={r.id} className="card flex items-center gap-3 p-3.5">
                            <RankInsignia category={r.category} level={r.level} url={r.insignia_url} size={48} label={r.name_ar} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{r.name_ar}</p>
                              <p className="ltr truncate text-start text-[11px] text-slate-500">{r.name_en}</p>
                            </div>
                            <span className="ms-auto font-mono text-xs text-slate-600">{String(r.level).padStart(2, '0')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AsyncView>
        </Block>

        <Block id="departments" eyebrow="BRANCHES" title="الأقسام العسكرية">
          <AsyncView state={depts} emptyTitle="لا توجد أقسام" rows={2}>
            {(rows) => (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {rows.map((d) => (
                  <div key={d.id} className="card p-5 transition-colors hover:border-olive-500/60">
                    <div className="grid h-11 w-11 place-items-center rounded-md bg-olive-500/20 text-olive-400">
                      {d.emblem_url ? <img src={d.emblem_url} alt="" className="h-7 w-7 object-contain" /> : DEPT_ICON[d.code] ?? <Shield className="h-6 w-6" />}
                    </div>
                    <h3 className="mt-4 font-bold text-white">{d.name_ar}</h3>
                    <p className="ltr text-start text-[11px] tracking-wider text-gold-400">{d.name_en.toUpperCase()}</p>
                    {d.description && <p className="mt-3 text-sm leading-7 text-slate-400">{d.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </AsyncView>
        </Block>
      </main>

      <footer className="border-t border-white/[.06] bg-navy-800/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-8 text-center sm:px-6">
          <Wordmark logo={logo} />
          <p className="text-xs text-slate-500">نظام داخلي لإدارة وزارة الدفاع داخل سيرفر الـ Roleplay. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
}

function Block({ id, eyebrow, title, desc, children }: { id: string; eyebrow: string; title: string; desc?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <SectionTitle eyebrow={eyebrow} title={title} desc={desc} />
      {children}
    </section>
  );
}
