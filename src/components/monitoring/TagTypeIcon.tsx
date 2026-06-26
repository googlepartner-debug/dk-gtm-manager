// SVG icons per tag category, mirroring GTM's colored-circle style.

interface Props {
  category: string;
  size?: number;
}

export function TagTypeIcon({ category, size = 20 }: Props) {
  const r = size / 2;
  const s = size;

  switch (category) {
    case 'GA4':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#4285F4" />
          {/* stylised bar chart */}
          <rect x={r * 0.42} y={r * 0.75} width={r * 0.28} height={r * 0.8} rx="1" fill="white" opacity=".95" />
          <rect x={r * 0.86} y={r * 0.42} width={r * 0.28} height={r * 1.13} rx="1" fill="white" opacity=".95" />
          <rect x={r * 1.30} y={r * 0.20} width={r * 0.28} height={r * 1.35} rx="1" fill="white" opacity=".95" />
        </svg>
      );

    case 'Google Ads':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#0D652D" />
          {/* simplified ads arrow/flag */}
          <path d={`M${r * 0.5} ${r * 1.5} L${r} ${r * 0.5} L${r * 1.5} ${r * 1.5}`} stroke="white" strokeWidth={size * 0.1} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );

    case 'Floodlight':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#1967D2" />
          {/* lightning bolt */}
          <path d={`M${r * 1.15} ${r * 0.35} L${r * 0.72} ${r * 1.05} L${r * 1.05} ${r * 1.05} L${r * 0.85} ${r * 1.65} L${r * 1.42} ${r * 0.92} L${r * 1.08} ${r * 0.92} Z`} fill="white" />
        </svg>
      );

    case 'Kameleoon':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#6B3FA0" />
          {/* K letter */}
          <text x={r} y={r * 1.35} textAnchor="middle" fill="white" fontSize={size * 0.55} fontWeight="700" fontFamily="sans-serif">K</text>
        </svg>
      );

    case 'AB Tasty':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#E91E63" />
          <text x={r} y={r * 1.35} textAnchor="middle" fill="white" fontSize={size * 0.38} fontWeight="700" fontFamily="sans-serif">AB</text>
        </svg>
      );

    case 'Meta Pixel':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#1877F2" />
          {/* Meta infinity-like curves */}
          <path d={`M${r * 0.42} ${r} C${r * 0.42} ${r * 0.62} ${r * 0.78} ${r * 0.62} ${r * 1.0} ${r} C${r * 1.22} ${r * 1.38} ${r * 1.58} ${r * 1.38} ${r * 1.58} ${r}`} stroke="white" strokeWidth={size * 0.1} fill="none" />
        </svg>
      );

    case 'TikTok':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#010101" />
          {/* TikTok musical note */}
          <path d={`M${r * 1.2} ${r * 0.4} C${r * 1.2} ${r * 0.4} ${r * 1.45} ${r * 0.38} ${r * 1.55} ${r * 0.65} L${r * 1.55} ${r * 0.65} L${r * 1.2} ${r * 0.65} L${r * 1.2} ${r * 1.45} C${r * 1.2} ${r * 1.65} ${r * 0.72} ${r * 1.72} ${r * 0.72} ${r * 1.45} C${r * 0.72} ${r * 1.18} ${r * 0.88} ${r * 1.12} ${r * 1.2} ${r * 1.18} Z`} fill="white" />
        </svg>
      );

    case 'Hotjar':
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#FD3A5C" />
          {/* H letter */}
          <text x={r} y={r * 1.35} textAnchor="middle" fill="white" fontSize={size * 0.55} fontWeight="700" fontFamily="sans-serif">H</text>
        </svg>
      );

    case 'HTML Custom':
    default:
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none">
          <circle cx={r} cy={r} r={r} fill="#607D8B" />
          {/* </> code brackets */}
          <path d={`M${r * 0.82} ${r * 0.62} L${r * 0.48} ${r} L${r * 0.82} ${r * 1.38}`} stroke="white" strokeWidth={size * 0.09} strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M${r * 1.18} ${r * 0.62} L${r * 1.52} ${r} L${r * 1.18} ${r * 1.38}`} stroke="white" strokeWidth={size * 0.09} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}
