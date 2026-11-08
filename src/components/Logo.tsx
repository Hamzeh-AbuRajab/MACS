/** Generic shield emblem. A custom logo uploaded in site settings replaces it. */
export function Emblem({ size = 40, src }: { size?: number; src?: string | null }) {
  if (src) return <img src={src} width={size} height={size} alt="" className="object-contain" />;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M32 4l22 9v16c0 14-9.500 24-22 31C19.500 53 10 43 10 29V13z" fill="#111B2B" stroke="#B69A52" strokeWidth="2.500" />
      <path d="M32 11l15 6v11c0 10-6.500 17.500-15 22-8.500-4.500-15-12-15-22V17z" stroke="#B69A52" strokeOpacity=".45" strokeWidth="1" />
      <path d="M32 20l3.200 6.800 7.300.8-5.400 5 1.500 7.300L32 36.200 25.400 39.900l1.500-7.300-5.400-5 7.300-.8z" fill="#B69A52" />
    </svg>
  );
}

export function Wordmark({ logo, compact = false }: { logo?: string | null; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Emblem size={compact ? 34 : 44} src={logo} />
      <div className="leading-tight">
        <div className="ltr text-lg font-extrabold tracking-[.18em] text-white">MACS</div>
        {!compact && <div className="ltr text-[10px] tracking-[.16em] text-gold-400">DEPARTMENT OF DEFENSE</div>}
      </div>
    </div>
  );
}
