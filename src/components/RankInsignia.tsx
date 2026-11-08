import type { RankCategory } from '@/lib/types';

interface Props { category: RankCategory; level: number; url?: string | null; size?: number; label?: string }

/** Uploaded insignia wins; otherwise a generated mark derived from category + level. */
export function RankInsignia({ category, level, url, size = 56, label }: Props) {
  if (url) return <img src={url} width={size} height={size} alt={label ?? ''} className="object-contain" />;

  const gold = '#B69A52';
  const marks: JSX.Element[] = [];
  if (category === 'supreme') {
    const n = Math.max(1, 5 - level);
    for (let i = 0; i < n; i++) {
      const cx = 32 + (i - (n - 1) / 2) * 13;
      marks.push(<path key={i} transform={`translate(${cx - 32} 0)`} fill={gold}
        d="M32 22l2.600 5.600 6 .6-4.500 4.100 1.300 6L32 35.300 26.600 38.300l1.300-6-4.500-4.100 6-.6z" />);
    }
  } else if (category === 'officer') {
    const n = 8 - level;                                   // 5→3 bars … 7→1
    for (let i = 0; i < n; i++) marks.push(<rect key={i} x="18" y={24 + i * 8 - ((n - 1) * 4 - 6)} width="28" height="4" rx="1" fill={gold} />);
  } else {
    const n = category === 'nco' ? 11 - level : 14 - level;   // nco 8→3 … ; enlisted 11→3 … 13→1, 14→0
    for (let i = 0; i < Math.max(0, n); i++) {
      const y = 22 + i * 9 - ((n - 1) * 4.500 - 6);
      marks.push(<path key={i} d={`M16 ${y + 8} L32 ${y} L48 ${y + 8}`} stroke={category === 'nco' ? gold : '#8E9BB0'}
        strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />);
    }
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label ?? 'شعار الرتبة'}>
      <circle cx="32" cy="32" r="29" fill="#111B2B" stroke={gold} strokeOpacity=".5" strokeWidth="1.500" />
      <circle cx="32" cy="32" r="25" fill="none" stroke={gold} strokeOpacity=".18" />
      {marks}
    </svg>
  );
}
