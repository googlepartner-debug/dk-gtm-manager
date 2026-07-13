import { ALERT_THRESHOLD } from '../constants/ga4Events';

// Reuses the visual language of EventsPage's drill-down (CoverageBar, PRD §10) — same
// completion-based color coding, shared by VariableDrillDown and EventDetailDrawer.
export function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= ALERT_THRESHOLD ? 'var(--color-score-3, hsl(142 60% 40%))' : pct >= 60 ? 'var(--color-score-2, hsl(38 90% 50%))' : 'var(--color-score-1, hsl(0 70% 55%))';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: 'hsl(220 13% 91%)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(pct)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color, minWidth: '2.5rem', textAlign: 'right' }}>{Math.round(pct)}%</span>
    </div>
  );
}
