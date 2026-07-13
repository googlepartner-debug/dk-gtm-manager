import { useEffect, useRef, useState } from 'react';

interface InfoTooltipProps {
  children: React.ReactNode; // short explanation — one or two sentences, no more
}

// "What is this page for" affordance — a pill badge (same visual language as the rest of
// the app's Badge component) that reveals a short explanation on click, without permanently
// occupying screen space like a banner would.
export function InfoTooltip({ children }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors shrink-0 bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
        aria-expanded={open}
        aria-label="À quoi sert cette page ?"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 7.2v4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="4.6" r="0.9" fill="currentColor" />
        </svg>
        À quoi sert cette page ?
      </button>
      {open && (
        <div
          className="absolute left-0 top-7 z-50 w-72 rounded-lg shadow-lg p-3 text-xs leading-relaxed"
          style={{ backgroundColor: 'hsl(220 20% 15%)', color: 'white' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
