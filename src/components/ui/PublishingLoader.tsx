export function PublishingLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12">
      <svg className="animate-spin" width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="11" stroke="hsl(220 13% 88%)" strokeWidth="3" />
        <path d="M25 14a11 11 0 00-11-11" stroke="hsl(267 100% 59%)" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="text-xs text-muted-fg text-center max-w-[280px]">{label}</p>
    </div>
  );
}
