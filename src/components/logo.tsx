export function Logo({ className = "", light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`} dir="ltr">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? "#ffffff" : "#12213e"} />
        <path d="M8 23V12l8-5 8 5v11h-5v-6h-6v6H8Z" fill="none" stroke={light ? "#12213e" : "#fff"} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="23.5" cy="22.5" r="4.5" fill="#f97316" />
        <path d="m21.6 22.6 1.3 1.3 2.3-2.6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`text-xl ${light ? "text-white" : "text-navy-950"}`}>
        SNAG<span className="text-accent-500">IT</span>
      </span>
    </span>
  );
}
